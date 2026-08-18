/**
 * The raw saga trace, straight from `order_status_history`.
 *
 * The stepper above it is the customer-friendly view; this is the full record,
 * including the transitions the stepper collapses and the reason recorded for each.
 * It is what makes "why did this order fail" answerable after the fact.
 */

import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus, StatusHistoryEntry } from "@/types";

function statusMeta(status: string) {
  return STATUS_META[status as OrderStatus] ?? null;
}

export function OrderTimeline({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-zinc-500">No history recorded yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {history.map((entry, index) => {
        const meta = statusMeta(entry.to_status);
        const isLast = index === history.length - 1;

        return (
          <li key={`${entry.to_status}-${entry.created_at}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white",
                  meta?.dotClassName ?? "bg-zinc-400",
                )}
                aria-hidden
              />
              {!isLast && <div className="my-1 w-px flex-1 bg-zinc-200" aria-hidden />}
            </div>

            <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-5")}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-sm font-medium text-zinc-900">
                  {meta?.label ?? entry.to_status}
                </p>
                {entry.from_status && (
                  <span className="font-mono text-[11px] text-zinc-400">
                    {entry.from_status} → {entry.to_status}
                  </span>
                )}
              </div>
              {entry.reason && <p className="mt-0.5 text-sm text-zinc-600">{entry.reason}</p>}
              <p className="mt-0.5 text-xs text-zinc-400 tabular">
                {formatDateTime(entry.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
