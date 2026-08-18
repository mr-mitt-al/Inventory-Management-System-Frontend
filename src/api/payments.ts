import { api } from "@/api/client";
import type { Page, Payment, PaymentStats, PaymentStatus, Refund } from "@/types";

export const paymentsApi = {
  /** Tokens the mock gateway understands, so checkout can offer a deliberate
   *  failure and make the compensation path demonstrable. */
  testTokens: () => api.get<Record<string, string>>("/payments/test-tokens").then((r) => r.data),

  getForOrder: (orderId: string) =>
    api.get<Payment>(`/payments/order/${orderId}`).then((r) => r.data),

  listMine: (params: { page?: number; size?: number }) =>
    api.get<Page<Payment>>("/payments", { params }).then((r) => r.data),

  /** Only a FAILED payment can be retried, and it needs a new token — retrying the
   *  same declined card is pointless. */
  retry: (orderId: string, body: { token: string; last4?: string | null }) =>
    api.post<Payment>(`/payments/order/${orderId}/retry`, body).then((r) => r.data),

  // ---- admin ----
  listAll: (params: { page?: number; size?: number; status?: PaymentStatus; user_id?: string }) =>
    api.get<Page<Payment>>("/admin/payments", { params }).then((r) => r.data),

  stats: () => api.get<PaymentStats>("/admin/payments/stats").then((r) => r.data),

  refund: (paymentId: string, body: { reason: string; amount?: string | null }) =>
    api.post<Refund>(`/admin/payments/${paymentId}/refund`, body).then((r) => r.data),
};
