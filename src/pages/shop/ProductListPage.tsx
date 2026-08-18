import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PackageSearch } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductFilters, type FilterState } from "@/components/product/ProductFilters";
import { normalizeError } from "@/api/client";
import { useDebounce } from "@/hooks/useDebounce";
import { useCategories, useProducts } from "@/hooks/useProducts";
import { PAGE_SIZE } from "@/lib/constants";
import type { ProductSort } from "@/types";

export function ProductListPage() {
  // Filters live in the URL so a filtered view is shareable and survives a reload
  // or a back-button press.
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FilterState = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      category: searchParams.get("category") ?? "",
      sort: (searchParams.get("sort") as ProductSort) ?? "newest",
      inStockOnly: searchParams.get("in_stock") === "1",
    }),
    [searchParams],
  );

  const page = Number(searchParams.get("page") ?? 1);

  // Local mirror of the search box, so typing feels instant while requests are
  // debounced.
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const debouncedSearch = useDebounce(searchDraft, 350);

  const { data: categories = [] } = useCategories();

  const { data, isLoading, isFetching, error } = useProducts({
    page,
    size: PAGE_SIZE,
    q: debouncedSearch || undefined,
    category: filters.category || undefined,
    sort: filters.sort,
    in_stock: filters.inStockOnly || undefined,
  });

  function applyFilters(next: FilterState) {
    setSearchDraft(next.q);
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.category) params.set("category", next.category);
    if (next.sort !== "newest") params.set("sort", next.sort);
    if (next.inStockOnly) params.set("in_stock", "1");
    // Any filter change resets to page 1 — staying on page 4 of a new result set
    // usually lands on an empty page.
    setSearchParams(params, { replace: true });
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Shop</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Stock shown here is a display copy and may be a moment behind. Availability is
          confirmed at checkout.
        </p>
      </header>

      <ProductFilters
        value={{ ...filters, q: searchDraft }}
        categories={categories}
        onChange={applyFilters}
        resultCount={data?.total}
      />

      {error && (
        <Alert tone="error" title="Could not load products">
          {normalizeError(error).message}
        </Alert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div
            // Dim while refetching so a filter change reads as "updating" rather than
            // as a frozen grid.
            className={`grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-4 ${
              isFetching ? "opacity-60" : "opacity-100"
            }`}
          >
            {data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            size={data.size}
            onPageChange={goToPage}
          />
        </>
      ) : (
        <EmptyState
          icon={<PackageSearch className="h-10 w-10" />}
          title="No products match those filters"
          description="Try a different search term or clear the filters to see everything."
        />
      )}
    </div>
  );
}
