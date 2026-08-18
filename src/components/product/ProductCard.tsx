import { Link } from "react-router-dom";
import { Check, ImageOff, Plus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { StockBadge } from "@/components/product/StockBadge";
import { formatMoney } from "@/lib/money";
import { selectIsInCart, useCartStore } from "@/store/cartStore";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  const addToCart = useCartStore((s) => s.add);
  const inCart = useCartStore(selectIsInCart(product.id));
  const soldOut = product.cached_stock <= 0;

  return (
    <article className="surface group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link to={`/products/${product.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-300">
              <ImageOff className="h-8 w-8" aria-hidden />
            </div>
          )}
          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <span className="rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-medium text-white">
                Sold out
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product.category && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            {product.category.name}
          </p>
        )}

        <Link to={`/products/${product.id}`} className="mt-0.5">
          <h3 className="line-clamp-2 text-sm font-medium text-zinc-900 group-hover:text-brand-700">
            {product.name}
          </h3>
        </Link>

        <p className="mt-1 font-mono text-[11px] text-zinc-400">{product.sku}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-base font-semibold text-zinc-900 tabular">
            {formatMoney(product.price, product.currency)}
          </p>
          {/* approximate: this is the catalog's denormalized copy, not inventory. */}
          <StockBadge quantity={product.cached_stock} approximate />
        </div>

        <div className="mt-4 flex-1" />

        <Button
          size="sm"
          fullWidth
          variant={inCart ? "outline" : "primary"}
          disabled={soldOut}
          onClick={() => addToCart(product)}
          leftIcon={
            inCart ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />
          }
        >
          {soldOut ? "Unavailable" : inCart ? "In cart — add another" : "Add to cart"}
        </Button>
      </div>
    </article>
  );
}
