/**
 * The failure state — where the compensation becomes visible to the customer.
 *
 * The sentence that matters is "your reserved items have been returned to stock".
 * Without it a customer sees "payment failed" and has no idea whether the items are
 * still being held for them, whether they were charged, or what to do next. That one
 * line is the UI proving the saga rolled back correctly.
 */

import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { failureLabel } from "@/lib/orderStatus";
import type { OrderDetail, Payment } from "@/types";

export interface OrderFailureCardProps {
  order: OrderDetail;
  payment?: Payment | null;
  onRetryPayment?: () => void;
  retrying?: boolean;
}

/** Did the saga get far enough to hold stock? Drives whether we can honestly claim
 *  the items were returned. */
function stockWasReserved(order: OrderDetail): boolean {
  return order.history.some((h) => h.to_status === "INVENTORY_RESERVED");
}

export function OrderFailureCard({
  order,
  payment,
  onRetryPayment,
  retrying,
}: OrderFailureCardProps) {
  const cancelled = order.status === "CANCELLED";
  const reserved = stockWasReserved(order);
  const reason = failureLabel(payment?.failure_code) ?? order.failure_reason;

  // A timeout is not offered as a one-click retry: the charge may have landed at the
  // provider, so blindly retrying risks a double charge. The backend marks these
  // retryable=false for the same reason.
  const canRetry =
    !cancelled &&
    Boolean(onRetryPayment) &&
    payment?.status === "FAILED" &&
    payment.failure_code !== "gateway_timeout";

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-red-900">
            {cancelled ? "This order was cancelled" : "This order could not be completed"}
          </h3>

          {reason && <p className="mt-1 text-sm text-red-800">{reason}</p>}

          <ul className="mt-3 space-y-1.5 text-sm text-red-800">
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>
                {payment?.status === "REFUNDED"
                  ? "Your payment has been refunded and should reach your account within a few business days."
                  : "You have not been charged."}
              </span>
            </li>
            {reserved && (
              <li className="flex gap-2">
                <span aria-hidden>•</span>
                {/* The compensating transaction, said out loud. */}
                <span>The items reserved for this order have been returned to stock.</span>
              </li>
            )}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            {canRetry && (
              <Button
                variant="danger"
                size="sm"
                onClick={onRetryPayment}
                loading={retrying}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Retry payment
              </Button>
            )}
            <Link to="/cart">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back to cart
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                Continue shopping
              </Button>
            </Link>
          </div>

          {payment?.failure_code === "gateway_timeout" && (
            <p className="mt-3 text-xs text-red-700">
              The payment provider did not respond, so we cannot tell whether the charge
              went through. Please check your statement before trying again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
