import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import type { Category, ProductSort } from "@/types";

export interface FilterState {
  q: string;
  category: string;
  sort: ProductSort;
  inStockOnly: boolean;
}

export interface ProductFiltersProps {
  value: FilterState;
  categories: Category[];
  onChange: (next: FilterState) => void;
  resultCount?: number;
}

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name_asc", label: "Name: A to Z" },
];

export function ProductFilters({
  value,
  categories,
  onChange,
  resultCount,
}: ProductFiltersProps) {
  const hasFilters =
    value.q !== "" || value.category !== "" || value.inStockOnly || value.sort !== "newest";

  function update(patch: Partial<FilterState>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            name="search"
            placeholder="Search products, SKUs…"
            value={value.q}
            onChange={(event) => update({ q: event.target.value })}
            leftIcon={<Search className="h-4 w-4" />}
            aria-label="Search products"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            name="sort"
            value={value.sort}
            onChange={(event) => update({ sort: event.target.value as ProductSort })}
            options={SORT_OPTIONS}
            aria-label="Sort products"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={value.category === ""}
          onClick={() => update({ category: "" })}
        >
          All
        </FilterChip>
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            active={value.category === category.slug}
            onClick={() =>
              update({ category: value.category === category.slug ? "" : category.slug })
            }
          >
            {category.name}
          </FilterChip>
        ))}

        <span className="mx-1 hidden h-5 w-px bg-zinc-200 sm:block" aria-hidden />

        <FilterChip
          active={value.inStockOnly}
          onClick={() => update({ inStockOnly: !value.inStockOnly })}
        >
          In stock only
        </FilterChip>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ q: "", category: "", sort: "newest", inStockOnly: false })}
            leftIcon={<X className="h-3.5 w-3.5" />}
          >
            Clear
          </Button>
        )}

        {resultCount !== undefined && (
          <p className="ml-auto text-sm text-zinc-500 tabular">
            {resultCount} {resultCount === 1 ? "product" : "products"}
          </p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
      )}
    >
      {children}
    </button>
  );
}
