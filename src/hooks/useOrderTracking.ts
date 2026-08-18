/**
 * Live order tracking — the centrepiece of this frontend.
 *
 * The backend returns 202 Accepted and processes the order asynchronously, so the
 * UI has to make an in-flight saga legible. Two mechanisms, deliberately overlapping:
 *
 *   SSE      pushes status changes the moment they happen (sub-second)
 *   polling  re-reads the order every 2s while it is in flight
 *
 * Belt and braces on purpose. SSE gives the responsiveness; polling guarantees the
 * page converges even if the stream drops, a proxy buffers it, or the tab was
 * backgrounded. Never rely on a single delivery mechanism for something the user is
 * actively watching.
 *
 * Both stop the moment the order reaches a terminal state, so a finished order does
 * not hold a connection open or keep querying forever.
 */

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { normalizeError } from "@/api/client";
import { ordersApi } from "@/api/orders";
import { streamOrderStatus } from "@/api/orderStream";
import { ORDER_POLL_INTERVAL_MS } from "@/lib/constants";
import { isTerminal } from "@/lib/orderStatus";
import { useAuthStore } from "@/store/authStore";
import type { OrderDetail } from "@/types";

export const orderQueryKey = (orderId: string) => ["order", orderId] as const;

export function useOrderTracking(orderId: string | undefined) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  // Keeps the SSE effect from re-subscribing every time the token is refreshed.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const query = useQuery({
    queryKey: orderQueryKey(orderId ?? "none"),
    queryFn: () => ordersApi.get(orderId as string),
    enabled: Boolean(orderId),
    // Poll only while in flight. `false` stops it once terminal.
    refetchInterval: (q) =>
      isTerminal(q.state.data?.status) ? false : ORDER_POLL_INTERVAL_MS,
    // Keep polling when the tab is hidden: an order placed and then backgrounded
    // should be finished when the user looks again, not frozen mid-saga.
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: (failureCount, error) => {
      const { status } = normalizeError(error);
      // A 403/404 will not fix itself.
      if (status === 403 || status === 404) return false;
      return failureCount < 3;
    },
  });

  const status = query.data?.status;
  const finished = isTerminal(status);

  useEffect(() => {
    if (!orderId || finished || !tokenRef.current) return;

    const close = streamOrderStatus(orderId, tokenRef.current, {
      onStatus: (event) => {
        // Patch the cache directly instead of invalidating: an invalidate would fire
        // an immediate refetch, throwing away the update we were just handed.
        queryClient.setQueryData<OrderDetail>(orderQueryKey(orderId), (previous) =>
          previous
            ? {
                ...previous,
                status: event.status,
                failure_reason: event.failure_reason,
                updated_at: event.updated_at,
              }
            : previous,
        );

        // The stream carries status only, not the history rows the timeline needs,
        // so fetch the full record once the saga settles.
        if (isTerminal(event.status)) {
          void queryClient.invalidateQueries({ queryKey: orderQueryKey(orderId) });
        }
      },
      onDone: () => {
        void queryClient.invalidateQueries({ queryKey: orderQueryKey(orderId) });
      },
      // Errors are intentionally swallowed: polling is already covering us, and a
      // visible "stream failed" warning would alarm the user about nothing.
      onError: () => {},
    });

    return close;
    // `finished` is in the deps so the stream is torn down as soon as the order
    // settles, rather than lingering until unmount.
  }, [orderId, finished, queryClient]);

  return {
    order: query.data,
    isLoading: query.isLoading,
    error: query.error ? normalizeError(query.error) : null,
    isTerminal: finished,
    refetch: query.refetch,
  };
}
