import { api } from "@/api/client";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  DeadLetter,
  DeadLetterDetail,
  Order,
  OrderDetail,
  OrderStats,
  OrderStatus,
  OrderSummary,
  Page,
} from "@/types";

export const ordersApi = {
  /**
   * Place an order. Returns **202 Accepted**, not 201.
   *
   * The order exists but is not confirmed — stock is not yet reserved and the card
   * is not yet charged. Both happen over the next second or two and either can
   * fail. The caller must send the user to tracking, not show a success message.
   *
   * `idempotencyKey` must be generated ONCE per checkout attempt and reused across
   * retries. Generating it per click means a double-click creates two orders,
   * reserves stock twice and charges twice.
   */
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    api
      .post<CreateOrderResponse>("/orders", body, {
        headers: { "Idempotency-Key": idempotencyKey },
      })
      .then((r) => r.data),

  list: (params: { page?: number; size?: number; status?: OrderStatus }) =>
    api.get<Page<OrderSummary>>("/orders", { params }).then((r) => r.data),

  /** Includes the status history, which drives the tracking timeline. */
  get: (orderId: string) =>
    api.get<OrderDetail>(`/orders/${orderId}`).then((r) => r.data),

  /** Publishes order.cancelled with a was_paid flag; each backend service then
   *  decides its own compensation. */
  cancel: (orderId: string, reason: string) =>
    api.post<Order>(`/orders/${orderId}/cancel`, { reason }).then((r) => r.data),

  // ---- admin ----
  adminList: (params: {
    page?: number;
    size?: number;
    status?: OrderStatus;
    user_id?: string;
    created_after?: string;
    created_before?: string;
  }) => api.get<Page<OrderSummary>>("/admin/orders", { params }).then((r) => r.data),

  adminGet: (orderId: string) =>
    api.get<OrderDetail>(`/admin/orders/${orderId}`).then((r) => r.data),

  stats: () => api.get<OrderStats>("/admin/orders/stats").then((r) => r.data),

  ship: (orderId: string) =>
    api.post<Order>(`/admin/orders/${orderId}/ship`).then((r) => r.data),

  deliver: (orderId: string) =>
    api.post<Order>(`/admin/orders/${orderId}/deliver`).then((r) => r.data),

  adminCancel: (orderId: string, reason: string) =>
    api.post<Order>(`/admin/orders/${orderId}/cancel`, { reason }).then((r) => r.data),

  // ---- dead letter queue ----
  listDeadLetters: (params: {
    page?: number;
    size?: number;
    status?: "PARKED" | "REPLAYED" | "DISCARDED";
    topic?: string;
  }) => api.get<Page<DeadLetter>>("/admin/dlq", { params }).then((r) => r.data),

  getDeadLetter: (id: string) =>
    api.get<DeadLetterDetail>(`/admin/dlq/${id}`).then((r) => r.data),

  /** Republishes the original event. Safe to press twice — consumers dedupe on
   *  event_id and the replay reuses the original envelope. */
  replayDeadLetter: (id: string, note?: string) =>
    api.post<DeadLetter>(`/admin/dlq/${id}/replay`, { note }).then((r) => r.data),

  discardDeadLetter: (id: string, note?: string) =>
    api.post<DeadLetter>(`/admin/dlq/${id}/discard`, { note }).then((r) => r.data),
};
