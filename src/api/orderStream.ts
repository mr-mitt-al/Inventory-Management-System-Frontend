/**
 * Server-Sent Events reader for live order status.
 *
 * ## Why this is not `EventSource`
 *
 * The obvious implementation is `new EventSource("/orders/{id}/stream")`. It does
 * not work here: **the native EventSource API cannot set request headers**, and the
 * backend endpoint requires `Authorization: Bearer <token>`. So the connection is
 * rejected with 401 before a single event arrives.
 *
 * The usual workarounds are both bad:
 *   - put the token in the query string — it then lands in access logs, proxy logs
 *     and browser history, which is not somewhere a credential should be
 *   - make the endpoint cookie-authenticated — a different auth model for one
 *     endpoint, and the backend verifies bearer tokens everywhere else
 *
 * So this reads the stream with `fetch` and parses the SSE wire format by hand.
 * It is about forty lines, supports headers, and gives real cancellation through
 * AbortController.
 *
 * The frontend also polls as a fallback (see useOrderTracking), so if this stream
 * drops the page still converges — a dropped stream costs latency, never
 * correctness.
 */

import { apiUrl } from "@/api/client";
import type { OrderStatus } from "@/types";

export interface OrderStatusEvent {
  order_id: string;
  status: OrderStatus;
  failure_reason: string | null;
  total_amount: string;
  updated_at: string;
}

export interface StreamHandlers {
  onStatus: (event: OrderStatusEvent) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

interface ParsedFrame {
  event: string;
  data: string;
}

/** Split one SSE frame ("event: x\ndata: {...}") into its fields. */
function parseFrame(raw: string): ParsedFrame | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) continue; // comment / keepalive
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).trimStart();

    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * Open the stream. Returns a function that closes it.
 *
 * Resolves nothing — consumers react through the handlers.
 */
export function streamOrderStatus(
  orderId: string,
  token: string,
  handlers: StreamHandlers,
): () => void {
  const controller = new AbortController();

  void (async () => {
    try {
      const response = await fetch(apiUrl(`/orders/${orderId}/stream`), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
          "X-Correlation-Id": crypto.randomUUID(),
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        // Fall silently back to polling. A 401 here usually means the access token
        // expired mid-stream; the next poll will refresh it through axios.
        handlers.onError?.(`stream unavailable (${response.status})`);
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += value;

        // Frames are separated by a blank line. A chunk can split a frame in half,
        // so anything after the last separator stays buffered for the next read.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const raw of frames) {
          const frame = parseFrame(raw);
          if (!frame) continue;

          if (frame.event === "status") {
            try {
              handlers.onStatus(JSON.parse(frame.data) as OrderStatusEvent);
            } catch {
              // A malformed frame is not worth tearing the stream down over.
            }
          } else if (frame.event === "done") {
            handlers.onDone?.();
            return;
          } else if (frame.event === "error" || frame.event === "timeout") {
            handlers.onError?.(frame.data);
            return;
          }
        }
      }
    } catch (error) {
      // AbortError is the normal path when the component unmounts.
      if (error instanceof DOMException && error.name === "AbortError") return;
      handlers.onError?.(error instanceof Error ? error.message : "stream failed");
    }
  })();

  return () => controller.abort();
}
