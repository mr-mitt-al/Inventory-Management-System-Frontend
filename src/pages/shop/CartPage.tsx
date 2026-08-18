import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShoppingCart } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CartLineRow } from "@/components/cart/CartLineRow";
import { catalogApi } from "@/api/catalog";
import { inventoryApi } from "@/api/inventory";
import { formatMinor } from "@/lib/money";
import { selectCartCurrency, useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { sumLines } from "@/lib/money";
import type { Stock } from "@/types";

export function CartPage() {
  const navigate = useNavigate();
  const lines = useCartStore((s) => s.lines);
  const currency = useCartStore(selectCartCurrency);
  const isAuthenticated = useAuthStore((s) => s.accessToken !== null);

  const productIds = useMemo(() => lines.map((l) => l.product_id), [lines]);

  /**
   * Re-validate the cart against the server.
   *
   * The cart lives in localStorage and can be days old — prices change, products get
   * withdrawn, stock sells out. This is UX, not enforcement: the backend prices the
   * order from its own read-model and re-checks stock during reservation, so a stale
   * cart can never cause a wrong charge or an oversell. It just fails later and less
   * pleasantly, which is what this avoids.
   */
  const { data: stockList } = useQuery({
    queryKey: ["cart", "stock", productIds],
    queryFn: () => inventoryApi.getStockBatch(productIds),
    enabled: productIds.length > 0,
    staleTime: 15_000,
    retry: false,
  });

  const { data: products } = useQuery({
    queryKey: ["cart", "products", productIds],
    queryFn: () => Promise.all(productIds.map((id) => catalogApi.getProduct(id))),
    enabled: productIds.length > 0,
    staleTime: 30_000,
    retry: false,
  });

  const stockByProduct = useMemo(() => {
    const map: Record<string, Stock> = {};
    for (const stock of stockList ?? []) map[stock.product_id] = stock;
    return map;
  }, [stockList]);

  const priceByProduct = useMemo(() => {
    const map: Record<string, string> = {};
    for (const product of products ?? []) map[product.id] = product.price;
    return map;
  }, [products]);

  // Total uses live prices where known, so what the user sees matches what the
  // backend will charge.
  const subtotal = useMemo(
    () =>
      sumLines(
        lines.map((line) => ({
          unit_price: priceByProduct[line.product_id] ?? line.unit_price,
          quantity: line.quantity,
        })),
      ),
    [lines, priceByProduct],
  );

  const priceDrift = lines.filter((line) => {
    const current = priceByProduct[line.product_id];
    return current !== undefined && current !== line.unit_price;
  });

  const blockers = lines.filter((line) => {
    const stock = stockByProduct[line.product_id];
    return stock !== undefined && line.quantity > stock.available_qty;
  });

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-10 w-10" />}
        title="Your cart is empty"
        description="Browse the shop and add something to get started."
        action={
          <Link to="/">
            <Button>Browse products</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Your cart</h1>

      {priceDrift.length > 0 && (
        <Alert tone="warning" title="Some prices have changed since you added these">
          <ul className="mt-1 space-y-0.5">
            {priceDrift.map((line) => (
              <li key={line.product_id}>{line.name}</li>
            ))}
          </ul>
          <p className="mt-2">
            The updated prices are shown below and are what you will be charged.
          </p>
        </Alert>
      )}

      {blockers.length > 0 && (
        <Alert tone="error" title="Some items are no longer available in that quantity">
          Adjust or remove them before checking out.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader title={`${lines.length} ${lines.length === 1 ? "item" : "items"}`} />
          <CardBody className="divide-y divide-zinc-100 py-0">
            {lines.map((line) => (
              <CartLineRow
                key={line.product_id}
                line={line}
                currentPrice={priceByProduct[line.product_id]}
                stock={stockByProduct[line.product_id]}
              />
            ))}
          </CardBody>
        </Card>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader title="Summary" />
            <CardBody className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">Subtotal</span>
                <span className="font-medium text-zinc-900 tabular">
                  {formatMinor(subtotal, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">Shipping</span>
                <span className="text-zinc-500">Calculated at checkout</span>
              </div>

              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-zinc-900">Total</span>
                  <span className="text-lg font-semibold text-zinc-900 tabular">
                    {formatMinor(subtotal, currency)}
                  </span>
                </div>
              </div>

              <Button
                fullWidth
                size="lg"
                disabled={blockers.length > 0}
                onClick={() =>
                  navigate(isAuthenticated ? "/checkout" : "/login", {
                    state: isAuthenticated ? undefined : { from: "/checkout" },
                  })
                }
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {isAuthenticated ? "Checkout" : "Sign in to checkout"}
              </Button>

              <Link to="/" className="block">
                <Button variant="ghost" fullWidth>
                  Continue shopping
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
