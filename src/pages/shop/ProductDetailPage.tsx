import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ImageOff, Minus, Plus, ShoppingCart } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/Spinner";
import { StockBadge } from "@/components/product/StockBadge";
import { normalizeError } from "@/api/client";
import { useProduct, useStock } from "@/hooks/useProducts";
import { formatMoney } from "@/lib/money";
import { selectIsInCart, useCartStore } from "@/store/cartStore";

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading, error } = useProduct(productId);
  // Authoritative stock, straight from the inventory service. The product's
  // cached_stock is a denormalized copy, so the number next to the buy button should
  // not come from it.
  const { data: stock } = useStock(productId);

  const addToCart = useCartStore((s) => s.add);
  const inCart = useCartStore(selectIsInCart(productId ?? ""));

  if (isLoading) return <PageLoader label="Loading product" />;

  if (error || !product) {
    const message = error ? normalizeError(error).message : "Product not found";
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Could not load this product">
          {message}
        </Alert>
        <Link to="/">
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to shop
          </Button>
        </Link>
      </div>
    );
  }

  // Prefer the authoritative figure; fall back to the display copy if inventory has
  // no record yet (a product created but not stocked).
  const available = stock?.available_qty ?? product.cached_stock;
  const soldOut = available <= 0;
  const maxQuantity = Math.min(available, 100);

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to shop
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="surface aspect-square overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-300">
              <ImageOff className="h-16 w-16" aria-hidden />
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <Link
              to={`/?category=${product.category.slug}`}
              className="text-xs font-medium uppercase tracking-wide text-brand-600 hover:underline"
            >
              {product.category.name}
            </Link>
          )}

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            {product.name}
          </h1>
          <p className="mt-1 font-mono text-xs text-zinc-400">{product.sku}</p>

          <p className="mt-4 text-3xl font-semibold text-zinc-900 tabular">
            {formatMoney(product.price, product.currency)}
          </p>

          <div className="mt-3">
            {/* Not approximate: this came from the inventory service. */}
            <StockBadge quantity={available} approximate={stock === undefined} />
          </div>

          {product.description && (
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-zinc-600">
              {product.description}
            </p>
          )}

          {!product.is_active && (
            <Alert tone="warning" title="No longer for sale" className="mt-5">
              This product has been withdrawn and cannot be ordered.
            </Alert>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-lg border border-zinc-300">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="p-2.5 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:text-zinc-300"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-10 text-center text-sm font-medium tabular">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                disabled={quantity >= maxQuantity}
                className="p-2.5 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:text-zinc-300"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Button
              size="lg"
              disabled={soldOut || !product.is_active}
              onClick={() => addToCart(product, quantity)}
              leftIcon={
                inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />
              }
            >
              {soldOut ? "Out of stock" : inCart ? "Add more to cart" : "Add to cart"}
            </Button>

            {inCart && (
              <Button variant="outline" size="lg" onClick={() => navigate("/cart")}>
                View cart
              </Button>
            )}
          </div>

          {stock && (
            <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-6 text-sm">
              <div>
                <dt className="text-zinc-500">Available now</dt>
                <dd className="mt-0.5 font-medium text-zinc-900 tabular">
                  {stock.available_qty}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Held for other orders</dt>
                <dd className="mt-0.5 font-medium text-zinc-900 tabular">
                  {stock.reserved_qty}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
