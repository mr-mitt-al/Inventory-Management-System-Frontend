import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";

export interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  size: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, total, size, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;

  const first = (page - 1) * size + 1;
  const last = Math.min(page * size, total);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 pt-2"
      aria-label="Pagination"
    >
      <p className="text-sm text-zinc-500 tabular">
        Showing <span className="font-medium text-zinc-700">{first}</span>–
        <span className="font-medium text-zinc-700">{last}</span> of{" "}
        <span className="font-medium text-zinc-700">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          leftIcon={<ChevronLeft className="h-4 w-4" />}
        >
          Previous
        </Button>
        <span className="px-2 text-sm text-zinc-600 tabular">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          rightIcon={<ChevronRight className="h-4 w-4" />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
