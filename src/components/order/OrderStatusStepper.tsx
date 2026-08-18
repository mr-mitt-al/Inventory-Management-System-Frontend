/**
 * The saga, rendered.
 *
 * This is the component that justifies the whole frontend design. The backend
 * returns 202 Accepted and then works through reserve → charge → confirm
 * asynchronously, so the user needs to see where their order actually is rather
 * than a spinner and a hope.
 *
 * The important detail is the failure rendering: steps that already succeeded stay
 * ticked and only the step that broke shows a cross. Resetting the whole strip to
 * "failed" would hide that stock WAS reserved and then released — which is exactly
 * the compensation the user needs to understand.
 */

import { Check, Loader2, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { SAGA_STEPS, resolveStepStates, type StepState } from "@/lib/orderStatus";
import type { OrderStatus, StatusHistoryEntry } from "@/types";

export interface OrderStatusStepperProps {
  status: OrderStatus;
  history?: StatusHistoryEntry[];
}

const CIRCLE: Record<StepState, string> = {
  complete: "border-emerald-500 bg-emerald-500 text-white",
  active: "border-brand-500 bg-white text-brand-600 animate-pulse-ring",
  failed: "border-red-500 bg-red-500 text-white",
  upcoming: "border-zinc-300 bg-white text-zinc-300",
};

const LABEL: Record<StepState, string> = {
  complete: "text-zinc-900",
  active: "text-brand-700 font-semibold",
  failed: "text-red-700 font-semibold",
  upcoming: "text-zinc-400",
};

const CONNECTOR: Record<StepState, string> = {
  complete: "bg-emerald-500",
  active: "bg-gradient-to-r from-emerald-500 to-zinc-200",
  failed: "bg-red-300",
  upcoming: "bg-zinc-200",
};

/** When each step happened, taken from the status history. */
function stepTimestamps(history: StatusHistoryEntry[]): Record<string, string> {
  const times: Record<string, string> = {};
  for (const entry of history) {
    // First occurrence wins: a status reached twice (a retried payment) should show
    // when it first got there.
    if (!times[entry.to_status]) times[entry.to_status] = entry.created_at;
  }
  return times;
}

export function OrderStatusStepper({ status, history = [] }: OrderStatusStepperProps) {
  const states = resolveStepStates(status, history);
  const times = stepTimestamps(history);

  return (
    <div>
      {/* Horizontal on desktop, vertical on mobile — a four-step horizontal strip
          is unreadable at 360px wide. */}
      <ol className="hidden items-start sm:flex" aria-label="Order progress">
        {SAGA_STEPS.map((step, index) => {
          const state = states[index];
          const time = times[step.activeAt] ?? times[step.completedBy[0]];

          return (
            <li key={step.key} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-24 flex-col items-center text-center">
                <StepCircle state={state} />
                <p className={cn("mt-2 text-xs leading-tight", LABEL[state])}>{step.label}</p>
                {time && state !== "upcoming" && (
                  <p className="mt-0.5 text-[11px] text-zinc-400 tabular">{formatTime(time)}</p>
                )}
              </div>

              {index < SAGA_STEPS.length - 1 && (
                <div className="mt-4 h-0.5 flex-1" aria-hidden>
                  <div className={cn("h-full w-full rounded-full", CONNECTOR[state])} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <ol className="space-y-0 sm:hidden" aria-label="Order progress">
        {SAGA_STEPS.map((step, index) => {
          const state = states[index];
          const time = times[step.activeAt] ?? times[step.completedBy[0]];
          const isLast = index === SAGA_STEPS.length - 1;

          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepCircle state={state} />
                {!isLast && (
                  <div className={cn("my-1 w-0.5 flex-1 rounded-full", CONNECTOR[state])} aria-hidden />
                )}
              </div>
              <div className={cn("pb-4", isLast && "pb-0")}>
                <p className={cn("text-sm", LABEL[state])}>{step.label}</p>
                {time && state !== "upcoming" && (
                  <p className="text-xs text-zinc-400 tabular">{formatTime(time)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepCircle({ state }: { state: StepState }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        CIRCLE[state],
      )}
      // The list carries the accessible label; each circle is decorative and its
      // state is conveyed by the adjacent text.
      aria-hidden
    >
      {state === "complete" && <Check className="h-4 w-4" strokeWidth={3} />}
      {state === "failed" && <X className="h-4 w-4" strokeWidth={3} />}
      {state === "active" && <Loader2 className="h-4 w-4 animate-spin" />}
      {state === "upcoming" && <span className="h-2 w-2 rounded-full bg-current" />}
    </span>
  );
}
