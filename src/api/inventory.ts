import { api } from "@/api/client";
import type { LedgerEntry, Page, Reservation, Stock } from "@/types";

export const inventoryApi = {
  /** Authoritative stock, unlike a product's cached_stock. */
  getStock: (productId: string) =>
    api.get<Stock>(`/stock/${productId}`).then((r) => r.data),

  /** Batch form so the cart re-validates in one request instead of N.
   *  Products with no stock record are simply absent from the response. */
  getStockBatch: (productIds: string[]) =>
    api
      .get<Stock[]>("/stock", {
        params: { product_id: productIds },
        // Repeat the key: ?product_id=a&product_id=b, which is what the backend's
        // list-valued Query expects. Default axios serialization would send
        // product_id[]=a and the values would never bind.
        paramsSerializer: { indexes: null },
      })
      .then((r) => r.data),

  // ---- admin ----
  listStock: (params: { page?: number; size?: number }) =>
    api.get<Page<Stock>>("/admin/stock", { params }).then((r) => r.data),

  listLowStock: (params: { page?: number; size?: number }) =>
    api.get<Page<Stock>>("/admin/stock/low", { params }).then((r) => r.data),

  createStockItem: (body: {
    product_id: string;
    sku: string;
    quantity: number;
    low_stock_threshold?: number | null;
  }) => api.post<Stock>("/admin/stock", body).then((r) => r.data),

  /** Relative: ADDS units. */
  restock: (productId: string, body: { quantity: number; low_stock_threshold?: number | null }) =>
    api.post<Stock>(`/admin/stock/${productId}/restock`, body).then((r) => r.data),

  /** Absolute: SETS available stock. A stock-take correction, recorded as a signed
   *  delta in the ledger. */
  adjust: (
    productId: string,
    body: { available_qty: number; low_stock_threshold?: number | null },
  ) => api.patch<Stock>(`/admin/stock/${productId}`, body).then((r) => r.data),

  ledger: (productId: string, params: { page?: number; size?: number }) =>
    api
      .get<Page<LedgerEntry>>(`/admin/stock/${productId}/ledger`, { params })
      .then((r) => r.data),

  listReservations: (params: { page?: number; size?: number }) =>
    api.get<Page<Reservation>>("/admin/reservations", { params }).then((r) => r.data),

  reservationStats: () =>
    api.get<Record<string, number>>("/admin/reservations/stats").then((r) => r.data),
};
