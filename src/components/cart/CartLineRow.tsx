import { Link } from "react-router-dom";
import { ImageOff, Minus, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatMinor, formatMoney, lineTotal, priceChanged } from "@/lib/money";
import { useCartStore } from "@/store/cartStore";
import type { CartLine, Stock } from "@/types";

export interface CartLineRowProps {
  line: CartLine;
  /** Live figures from the server, if a re-validation has run. */
  currentPrice?: string;
  stock?: Stock;
}

export function CartLineRow({ line, currentPrice, stock }: CartLineRowProps) {
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);

  const drifted = currentPrice !== undefined && priceChanged(line.unit_price, currentPrice);
  const available = stock?.available_qty;
  const exceedsStock = available !== undefined && line.quantity > available;
  const soldOut = available !== undefined && available <= 0;

  return (
    <div className="flex gap-4 py-4">
      <Link
        to={`/products/${line.product_id}`}
        className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100"
      >
        {line.image_url ? (
          <img src={line.image_url} alt={line.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-300">
            <ImageOff className="h-6 w-6" aria-hidden />
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={`/products/${line.product_id}`}
          className="line-clamp-2 text-sm font-medium text-zinc-900 hover:text-brand-700"
        >
          {line.name}
        </Link>
        <p className="mt-0.5 font-mono text-[11px] text-zinc-400">{line.sku}</p>

        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span
            className={cn(
              "text-sm tabular",
              drifted ? "text-zinc-400 line-through" : "text-zinc-600",
            )}
          >
            {formatMoney(line.unit_price, line.currency)}
          </span>
          {drifted && currentPrice && (
            <span className="text-sm font-medium text-amber-700 tabular">
              {formatMoney(currentPrice, line.currency)}
            </span>
          )}
        </div>

        {/* Availability warnings. These are UX only — the backend re-validates during
            reservation, so a stale cart can never oversell, it just fails later. */}
        {soldOut ? (
          <p className="mt-1.5 text-xs font-medium text-red-600">
            Out of stock — remove this item to continue
          </p>
        ) : exceedsStock ? (
          <p className="mt-1.5 text-xs font-medium text-amber-700">
            Only {available} available — reduce the quantity to continue
          </p>
        ) : null}

        <div className="mt-3 flex items-center gap-3">
          <div className="inline-flex items-center rounded-lg border border-zinc-300">
            <button
              type="button"
              onClick={() => setQuantity(line.product_id, line.quantity - 1)}
              className="p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:text-zinc-300"
              aria-label={`Decrease quantity of ${line.name}`}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-8 px-1 text-center text-sm font-medium tabular">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(line.product_id, line.quantity + 1)}
              disabled={available !== undefined && line.quantity >= available}
              className="p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:text-zinc-300"
              aria-label={`Increase quantity of ${line.name}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => remove(line.product_id)}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove
          </button>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-zinc-900 tabular">
          {formatMinor(lineTotal(currentPrice ?? line.unit_price, line.quantity), line.currency)}
        </p>
      </div>
    </div>
  );
}
