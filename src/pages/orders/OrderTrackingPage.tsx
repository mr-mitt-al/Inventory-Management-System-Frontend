/**
 * Order tracking — the page that makes the asynchronous backend legible.
 *
 * `POST /orders` returned 202 Accepted, so when the user lands here the order exists
 * but is not confirmed: stock is not reserved and the card is not charged. Both happen
 * over the next second or two and either can fail.
 *
 * A naive frontend would have shown "Order placed successfully!" on the previous page
 * and been wrong. This page shows the saga actually running, and — when it fails —
 * says explicitly that no money was taken and the reserved items went back to stock.
 */

import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Package, RefreshCw } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { OrderFailureCard } from "@/components/order/OrderFailureCard";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { OrderStatusStepper } from "@/components/order/OrderStatusStepper";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { normalizeError } from "@/api/client";
import { ordersApi } from "@/api/orders";
import { paymentsApi } from "@/api/payments";
import { orderQueryKey, useOrderTracking } from "@/hooks/useOrderTracking";
import { TEST_CARDS } from "@/lib/constants";
import { formatDateTime, shortId } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { STATUS_META, isCancellable } from "@/lib/orderStatus";

export function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const justPlaced = searchParams.get("placed") === "1";

  const [cancelOpen, setCancelOpen] = useState(false);

  const { order, isLoading, error, isTerminal } = useOrderTracking(orderId);

  // Payment details carry the failure code, which is what turns "payment failed" into
  // "your bank declined the card".
  const { data: payment } = useQuery({
    queryKey: ["payment", orderId],
    queryFn: () => paymentsApi.getForOrder(orderId as string),
    enabled: Boolean(orderId) && (order?.status === "FAILED" || order?.status === "CANCELLED"),
    retry: false,
  });

  const retryPayment = useMutation({
    mutationFn: () =>
      paymentsApi.retry(orderId as string, {
        // Retry with the card that works, since the point of a retry here is to get
        // the order through. A production UI would collect fresh card details.
        token: TEST_CARDS[0].token,
        last4: TEST_CARDS[0].last4,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderQueryKey(orderId as string) });
      void queryClient.invalidateQueries({ queryKey: ["payment", orderId] });
    },
  });

  const cancelOrder = useMutation({
    mutationFn: () => ordersApi.cancel(orderId as string, "cancelled by customer"),
    onSuccess: () => {
      setCancelOpen(false);
      void queryClient.invalidateQueries({ queryKey: orderQueryKey(orderId as string) });
    },
  });

  if (isLoading) return <PageLoader label="Loading your order" />;

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Could not load this order">
          {error?.message ?? "Order not found."}
        </Alert>
        <Link to="/orders">
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            My orders
          </Button>
        </Link>
      </div>
    );
  }

  const meta = STATUS_META[order.status];
  const failed = order.status === "FAILED" || order.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            My orders
          </Link>
          <h1 className="mt-1 font-mono text-xl font-semibold text-zinc-900">
            #{shortId(order.id)}
          </h1>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {justPlaced && !isTerminal && (
        <Alert tone="info" title="Order received">
          We have your order. Stock is being reserved and payment taken now — this page
          updates by itself.
        </Alert>
      )}

      <Card>
        <CardBody className="space-y-5 py-6">
          <OrderStatusStepper status={order.status} history={order.history} />

          <div className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3">
            {!isTerminal && <Spinner className="mt-0.5 h-4 w-4 shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900">{meta.label}</p>
              <p className="mt-0.5 text-sm text-zinc-600">{meta.description}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {failed && (
        <OrderFailureCard
          order={order}
          payment={payment}
          onRetryPayment={() => retryPayment.mutate()}
          retrying={retryPayment.isPending}
        />
      )}

      {retryPayment.error && (
        <Alert tone="error" title="Retry failed">
          {normalizeError(retryPayment.error).message}
        </Alert>
      )}

      <Card>
        <CardHeader
          title="Items"
          description={`${order.items.length} ${order.items.length === 1 ? "product" : "products"}`}
        />
        <CardBody className="divide-y divide-zinc-100 py-0">
          {order.items.map((item) => (
            <div key={item.product_id} className="flex items-start gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
                <Package className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                <p className="font-mono text-[11px] text-zinc-400">{item.sku}</p>
                <p className="mt-0.5 text-xs text-zinc-500 tabular">
                  {formatMoney(item.unit_price, order.currency)} × {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium text-zinc-900 tabular">
                {formatMoney(item.line_total, order.currency)}
              </p>
            </div>
          ))}
        </CardBody>
        <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3">
          <span className="font-semibold text-zinc-900">Total</span>
          <span className="text-lg font-semibold text-zinc-900 tabular">
            {formatMoney(order.total_amount, order.currency)}
          </span>
        </div>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader title="Shipping to" />
          <CardBody className="text-sm text-zinc-600">
            <address className="not-italic">
              {order.shipping_address.line1}
              {order.shipping_address.line2 && <>, {order.shipping_address.line2}</>}
              <br />
              {order.shipping_address.city}, {order.shipping_address.state}
              <br />
              {order.shipping_address.postal_code}, {order.shipping_address.country}
              {order.shipping_address.phone && (
                <>
                  <br />
                  {order.shipping_address.phone}
                </>
              )}
            </address>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Payment" />
          <CardBody className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Method</span>
              <span className="text-zinc-900">
                {order.payment_method.type}
                {order.payment_method.last4 && ` •••• ${order.payment_method.last4}`}
              </span>
            </div>
            {payment && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className="text-zinc-900">{payment.status}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-500">Placed</span>
              <span className="text-zinc-900">{formatDateTime(order.created_at)}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Progress log"
          description="Every state change, as recorded by the order service"
        />
        <CardBody>
          <OrderTimeline history={order.history} />
        </CardBody>
      </Card>

      {isCancellable(order.status) && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => setCancelOpen(true)}
            leftIcon={<Ban className="h-4 w-4" />}
          >
            Cancel this order
          </Button>
        </div>
      )}

      {/* Correlation id, exposed on purpose. It is the single value that traces this
          order through all six backend services in the logs. */}
      <p className="text-center font-mono text-[11px] text-zinc-400">
        correlation id: {order.correlation_id}
      </p>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this order?"
        description="Reserved stock is released and any payment taken is refunded."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep the order
            </Button>
            <Button
              variant="danger"
              loading={cancelOrder.isPending}
              onClick={() => cancelOrder.mutate()}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Cancel order
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          This cannot be undone. If payment has already been taken, a refund is issued
          automatically and should reach your account within a few business days.
        </p>
        {cancelOrder.error && (
          <Alert tone="error" title="Could not cancel" className="mt-3">
            {normalizeError(cancelOrder.error).message}
          </Alert>
        )}
      </Modal>
    </div>
  );
}
