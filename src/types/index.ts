/**
 * API contracts, mirroring the backend's Pydantic models.
 *
 * Money arrives as a STRING, not a number. The backend uses postgres NUMERIC and
 * serialises it as a decimal string; parsing it into a JS number would introduce
 * the floating-point error the backend deliberately avoids. Format for display,
 * and do arithmetic in integer paise (see lib/money.ts).
 */

// ---------------------------------------------------------------- pagination
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  pages: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  correlation_id?: string;
}

// ---------------------------------------------------------------------- auth
export type Role = "customer" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterResponse {
  user: User;
  message: string;
}

/** Claims we read out of the access token. The `role` here is what every backend
 *  service authorizes on, so the UI must agree with it. */
export interface TokenClaims {
  sub: string;
  email: string;
  role: Role;
  type: "access" | "refresh";
  exp: number;
  iat: number;
  jti: string;
}

// ------------------------------------------------------------------- catalog
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  image_url: string | null;
  is_active: boolean;
  category: Category | null;
  created_at: string;
  updated_at: string;
  /** Display copy owned by the inventory service and eventually consistent.
   *  Never treat as authoritative — checkout re-validates. */
  cached_stock: number;
  in_stock: boolean;
}

export type ProductSort = "newest" | "price_asc" | "price_desc" | "name_asc";

export interface ProductQuery {
  page?: number;
  size?: number;
  category?: string;
  q?: string;
  min_price?: string;
  max_price?: string;
  in_stock?: boolean;
  sort?: ProductSort;
}

// ----------------------------------------------------------------- inventory
export interface Stock {
  product_id: string;
  sku: string;
  available_qty: number;
  reserved_qty: number;
  low_stock_threshold: number;
  updated_at: string;
  total_qty: number;
  is_low: boolean;
}

export interface Reservation {
  id: string;
  order_id: string;
  user_id: string;
  status: "HELD" | "COMMITTED" | "RELEASED" | "EXPIRED";
  expires_at: string;
  created_at: string;
  items: { product_id: string; quantity: number }[];
}

export interface LedgerEntry {
  id: string;
  product_id: string;
  delta: number;
  reason: "RESERVE" | "RELEASE" | "COMMIT" | "RESTOCK" | "ADJUST" | "EXPIRE";
  ref_order_id: string | null;
  balance_after: number;
  created_at: string;
}

// --------------------------------------------------------------------- order
export type OrderStatus =
  | "PENDING"
  | "INVENTORY_RESERVED"
  | "PAID"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED";

export interface Address {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string | null;
}

export interface OrderItem {
  product_id: string;
  sku: string;
  name: string;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface StatusHistoryEntry {
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: string;
  currency: string;
  shipping_address: Address;
  payment_method: PaymentMethodPayload;
  failure_reason: string | null;
  correlation_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  items: OrderItem[];
  is_terminal: boolean;
}

export interface OrderDetail extends Order {
  history: StatusHistoryEntry[];
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  total_amount: string;
  currency: string;
  created_at: string;
  items: OrderItem[];
}

/** The backend returns 202 Accepted here — the order exists but is NOT confirmed. */
export interface CreateOrderResponse {
  order_id: string;
  status: OrderStatus;
  total_amount: string;
  currency: string;
  message: string;
  track_url: string;
}

export interface PaymentMethodPayload {
  type: "CARD" | "UPI" | "COD";
  /** A token. A card number never reaches the backend. */
  token: string;
  last4?: string | null;
  label?: string | null;
}

export interface CreateOrderRequest {
  /** product_id + quantity only. There is no price field, by design. */
  items: { product_id: string; quantity: number }[];
  shipping_address: Address;
  payment_method: PaymentMethodPayload;
}

// ------------------------------------------------------------------- payment
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export interface Refund {
  id: string;
  amount: string;
  reason: string | null;
  status: "PENDING" | "COMPLETED" | "FAILED";
  provider_ref: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  user_id: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  method: string;
  card_last4: string | null;
  provider_ref: string | null;
  failure_code: string | null;
  failure_message: string | null;
  attempts: number;
  paid_at: string | null;
  created_at: string;
  refunds: Refund[];
}

// --------------------------------------------------------------------- admin
export interface OrderStats {
  by_status: Record<string, number>;
  revenue_24h: number;
  dlq_depth: number;
}

export interface PaymentStats {
  by_status: Record<string, number>;
  captured_total: number;
  failures_by_code: Record<string, number>;
}

export interface DeadLetter {
  id: string;
  original_topic: string;
  original_key: string | null;
  failed_by: string;
  error_type: string;
  error_message: string;
  attempts: number;
  status: "PARKED" | "REPLAYED" | "DISCARDED";
  note: string | null;
  created_at: string;
  replayed_at: string | null;
}

export interface DeadLetterDetail extends DeadLetter {
  original_event: Record<string, unknown> | null;
  raw_message: string | null;
  stack_trace: string | null;
}

// ---------------------------------------------------------------------- cart
/** Cart lives in the browser — there is no cart service.
 *  Price and name are cached for display; checkout sends only id + quantity and
 *  the backend prices the order from its own read-model. */
export interface CartLine {
  product_id: string;
  sku: string;
  name: string;
  unit_price: string;
  currency: string;
  image_url: string | null;
  quantity: number;
  /** Snapshot of display stock when added, used to warn about staleness. */
  stock_at_add: number;
}
