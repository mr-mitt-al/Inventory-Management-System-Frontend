/**
 * Order status metadata — the single place the UI decides what a status means.
 *
 * Mirrors `common/order_status.py`. If the backend adds a state, this file is the
 * one to change; everything else derives from it.
 */

import type { OrderStatus } from "@/types";

export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  "DELIVERED",
  "CANCELLED",
  "FAILED",
];

export function isTerminal(status: OrderStatus | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.includes(status);
}

/** Statuses a customer may cancel from. SHIPPED is excluded: once it is with the
 *  courier it is a returns problem, not an order problem. */
export const CANCELLABLE: readonly OrderStatus[] = [
  "PENDING",
  "INVENTORY_RESERVED",
  "PAID",
  "CONFIRMED",
];

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE.includes(status);
}

export interface StatusMeta {
  label: string;
  /** What the customer should understand is happening, in plain language. */
  description: string;
  tone: "progress" | "success" | "error" | "neutral";
  className: string;
  dotClassName: string;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDING: {
    label: "Order placed",
    description: "We have your order and are checking stock.",
    tone: "progress",
    className: "bg-purple-50 text-purple-700 ring-purple-200",
    dotClassName: "bg-purple-500",
  },
  INVENTORY_RESERVED: {
    label: "Stock reserved",
    description: "Your items are set aside. Taking payment now.",
    tone: "progress",
    className: "bg-brand-50 text-brand-700 ring-brand-200",
    dotClassName: "bg-brand-500",
  },
  PAID: {
    label: "Payment received",
    description: "Payment went through. Finalising your order.",
    tone: "progress",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
    dotClassName: "bg-sky-500",
  },
  CONFIRMED: {
    label: "Confirmed",
    description: "Your order is confirmed and being prepared.",
    tone: "success",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dotClassName: "bg-emerald-500",
  },
  SHIPPED: {
    label: "Shipped",
    description: "On its way to you.",
    tone: "progress",
    className: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    dotClassName: "bg-indigo-500",
  },
  DELIVERED: {
    label: "Delivered",
    description: "Delivered. Thanks for shopping with us.",
    tone: "success",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-300",
    dotClassName: "bg-emerald-600",
  },
  FAILED: {
    label: "Could not complete",
    // The second sentence matters: it tells the customer the compensation ran, so
    // they know their items are no longer being held and no money was taken.
    description: "This order could not be completed. Nothing was charged.",
    tone: "error",
    className: "bg-red-50 text-red-700 ring-red-200",
    dotClassName: "bg-red-500",
  },
  CANCELLED: {
    label: "Cancelled",
    description: "This order was cancelled.",
    tone: "neutral",
    className: "bg-zinc-100 text-zinc-700 ring-zinc-300",
    dotClassName: "bg-zinc-500",
  },
};

/**
 * The four steps the tracking page shows.
 *
 * PAID and CONFIRMED are collapsed into one visual step: the backend records them
 * separately (money taken, then order accepted) but they happen milliseconds apart,
 * and showing both would make the stepper flicker for no benefit.
 */
export interface SagaStep {
  key: string;
  label: string;
  /** Statuses that mean this step is finished. */
  completedBy: OrderStatus[];
  /** The status that means this step is currently running. */
  activeAt: OrderStatus;
}

export const SAGA_STEPS: readonly SagaStep[] = [
  {
    key: "placed",
    label: "Order placed",
    completedBy: ["INVENTORY_RESERVED", "PAID", "CONFIRMED", "SHIPPED", "DELIVERED"],
    activeAt: "PENDING",
  },
  {
    key: "reserved",
    label: "Stock reserved",
    completedBy: ["PAID", "CONFIRMED", "SHIPPED", "DELIVERED"],
    activeAt: "INVENTORY_RESERVED",
  },
  {
    key: "paid",
    label: "Payment",
    completedBy: ["CONFIRMED", "SHIPPED", "DELIVERED"],
    activeAt: "PAID",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    completedBy: ["SHIPPED", "DELIVERED"],
    activeAt: "CONFIRMED",
  },
];

export type StepState = "complete" | "active" | "failed" | "upcoming";

/**
 * Work out how to render each step for a given status.
 *
 * The interesting case is failure: the steps that already succeeded must stay
 * ticked, and the step where it broke shows the cross. Resetting the whole stepper
 * to "failed" would hide that stock was reserved and then released — which is the
 * part worth seeing.
 */
export function resolveStepStates(
  status: OrderStatus,
  history: { to_status: string }[] = [],
): StepState[] {
  const reached = new Set<string>([status, ...history.map((h) => h.to_status)]);
  const failed = status === "FAILED" || status === "CANCELLED";

  return SAGA_STEPS.map((step, index) => {
    if (step.completedBy.some((s) => reached.has(s))) return "complete";
    if (step.activeAt === status) return failed ? "failed" : "active";

    if (failed) {
      // The first step not reached is where it broke.
      const previousComplete = SAGA_STEPS.slice(0, index).every((prior) =>
        prior.completedBy.some((s) => reached.has(s)) || reached.has(prior.activeAt),
      );
      const thisOneReached = reached.has(step.activeAt);
      if (previousComplete && !thisOneReached) return "failed";
      return "upcoming";
    }

    if (reached.has(step.activeAt)) return "complete";
    return "upcoming";
  });
}

/** Human-readable payment failure reasons, keyed by the backend's failure_code. */
export const FAILURE_CODE_LABELS: Record<string, string> = {
  card_declined: "Your bank declined the card",
  insufficient_funds: "The card has insufficient funds",
  card_expired: "The card has expired",
  gateway_timeout: "The payment provider did not respond",
  payment_error: "The payment could not be processed",
};

export function failureLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return FAILURE_CODE_LABELS[code] ?? code.replace(/_/g, " ");
}
