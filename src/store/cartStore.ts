/**
 * Shopping cart — client-side only.
 *
 * There is no cart service, and that is a deliberate architectural decision rather
 * than a missing feature: a cart is per-user, ephemeral, and needs no consistency
 * guarantees. A service for it would be a database, a deployment and an event topic
 * in exchange for nothing.
 *
 * The cost, stated plainly: the cart does not follow the user across devices, and
 * clearing site data clears it.
 *
 * Price and name here are DISPLAY CACHES. Checkout sends only `product_id` and
 * `quantity`; the backend prices the order from its own read-model, so a stale or
 * tampered price in localStorage cannot affect what is charged.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { STORAGE_KEYS } from "@/lib/constants";
import { sumLines } from "@/lib/money";
import type { CartLine, Product } from "@/types";

interface CartState {
  lines: CartLine[];

  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /** Refresh cached prices/names after a re-validation against the server. */
  reconcile: (updates: Record<string, { unit_price: string; name: string }>) => void;
}

const MAX_QUANTITY_PER_LINE = 100; // matches the backend's per-item cap

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      add: (product, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.product_id === product.id);

          if (existing) {
            // Adding an item already in the cart increases its quantity rather than
            // appending a second line: the backend rejects duplicate product lines,
            // and two lines for one product is confusing anyway.
            return {
              lines: state.lines.map((line) =>
                line.product_id === product.id
                  ? {
                      ...line,
                      quantity: Math.min(line.quantity + quantity, MAX_QUANTITY_PER_LINE),
                    }
                  : line,
              ),
            };
          }

          return {
            lines: [
              ...state.lines,
              {
                product_id: product.id,
                sku: product.sku,
                name: product.name,
                unit_price: product.price,
                currency: product.currency,
                image_url: product.image_url,
                quantity: Math.min(quantity, MAX_QUANTITY_PER_LINE),
                stock_at_add: product.cached_stock,
              },
            ],
          };
        }),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          // Dropping to zero removes the line — a zero-quantity line would fail
          // backend validation and there is nothing else it could mean.
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.product_id !== productId)
              : state.lines.map((line) =>
                  line.product_id === productId
                    ? { ...line, quantity: Math.min(quantity, MAX_QUANTITY_PER_LINE) }
                    : line,
                ),
        })),

      remove: (productId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.product_id !== productId) })),

      clear: () => set({ lines: [] }),

      reconcile: (updates) =>
        set((state) => ({
          lines: state.lines.map((line) => {
            const update = updates[line.product_id];
            return update ? { ...line, unit_price: update.unit_price, name: update.name } : line;
          }),
        })),
    }),
    {
      name: STORAGE_KEYS.cart,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

// ------------------------------------------------------------------- selectors
export const selectCartCount = (s: CartState): number =>
  s.lines.reduce((total, line) => total + line.quantity, 0);

/** Subtotal in minor units (paise), computed with integer arithmetic. */
export const selectCartSubtotal = (s: CartState): number => sumLines(s.lines);

export const selectCartCurrency = (s: CartState): string => s.lines[0]?.currency ?? "INR";

export const selectIsInCart =
  (productId: string) =>
  (s: CartState): boolean =>
    s.lines.some((l) => l.product_id === productId);
