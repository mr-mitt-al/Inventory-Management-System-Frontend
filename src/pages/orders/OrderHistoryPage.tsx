import { useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { OrderCard } from "@/components/order/OrderCard";
import { normalizeError } from "@/api/client";
import { ordersApi } from "@/api/orders";
import { useQuery } from "@tanstack/react-query";
import type { OrderStatus } from "@/types";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "In progress" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function OrderHistoryPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["orders", { page, status }],
    queryFn: () =>
      ordersApi.list({
        page,
        size: 10,
        status: status ? (status as OrderStatus) : undefined,
      }),
    placeholderData: (previous) => previous,
    // An order in this list may still be mid-saga, so refresh periodically rather
    // than leaving a PENDING row looking stuck.
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">My orders</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data ? `${data.total} ${data.total === 1 ? "order" : "orders"}` : "Loading…"}
          </p>
        </div>
        <div className="w-full sm:w-52">
          <Select
            name="status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={STATUS_FILTERS}
            aria-label="Filter by status"
          />
        </div>
      </div>

      {error && (
        <Alert tone="error" title="Could not load your orders">
          {normalizeError(error).message}
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className={`space-y-3 transition-opacity ${isFetching ? "opacity-70" : ""}`}>
            {data.items.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            size={data.size}
            onPageChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title={status ? "No orders with that status" : "You have not placed any orders yet"}
          description={
            status
              ? "Try a different filter."
              : "When you place an order it will appear here, and you can watch it progress."
          }
          action={
            !status && (
              <Link to="/">
                <Button>Browse products</Button>
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
