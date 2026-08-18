import { useQuery } from "@tanstack/react-query";

import { catalogApi } from "@/api/catalog";
import { inventoryApi } from "@/api/inventory";
import { PAGE_SIZE } from "@/lib/constants";
import type { ProductQuery } from "@/types";

export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: ["products", query],
    queryFn: () => catalogApi.listProducts({ size: PAGE_SIZE, ...query }),
    // Catalog is cache-fronted server-side and stock changes are eventually
    // consistent anyway, so a short client cache costs nothing.
    staleTime: 30_000,
    placeholderData: (previous) => previous, // keeps the grid stable while paging
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => catalogApi.getProduct(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => catalogApi.listCategories(),
    staleTime: 5 * 60_000, // categories change rarely
  });
}

/**
 * Authoritative stock for one product.
 *
 * A product's `cached_stock` is a denormalized display copy owned by the inventory
 * service. The detail page asks inventory directly so the number next to the Add to
 * Cart button is the real one.
 */
export function useStock(productId: string | undefined) {
  return useQuery({
    queryKey: ["stock", productId],
    queryFn: () => inventoryApi.getStock(productId as string),
    enabled: Boolean(productId),
    staleTime: 10_000,
    // A product with no stock record yet is a 404, not an error worth retrying.
    retry: false,
  });
}
