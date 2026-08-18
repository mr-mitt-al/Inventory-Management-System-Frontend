import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, PackageCheck, Truck } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { normalizeError } from "@/api/client";
import { ordersApi } from "@/api/orders";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { formatRelative, shortId } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { isCancellable } from "@/lib/orderStatus";
import type { OrderStatus } from "@/types";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "INVENTORY_RESERVED", label: "Stock reserved" },
  { value: "PAID", label: "Paid" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "orders", { page, status }],
    queryFn: () =>
      ordersApi.adminList({
        page,
        size: ADMIN_PAGE_SIZE,
        status: status ? (status as OrderStatus) : undefined,
      }),
    placeholderData: (previous) => previous,
    // Orders here may be mid-saga; a static table would look stuck.
    refetchInterval: 15_000,
  });

  const detail = useQuery({
    queryKey: ["admin", "order", openOrderId],
    queryFn: () => ordersApi.adminGet(openOrderId as string),
    enabled: Boolean(openOrderId),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "order", openOrderId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "orderStats"] });
  }

  const ship = useMutation({
    mutationFn: (id: string) => ordersApi.ship(id),
    onSuccess: invalidate,
  });
  const deliver = useMutation({
    mutationFn: (id: string) => ordersApi.deliver(id),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => ordersApi.adminCancel(id, "cancelled by admin"),
    onSuccess: () => {
      invalidate();
      setOpenOrderId(null);
    },
  });

  const actionError = ship.error ?? deliver.error ?? cancel.error;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Orders</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data ? `${data.total} total` : "Loading…"}
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select
            name="status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            aria-label="Filter by status"
          />
        </div>
      </header>

      {error && (
        <Alert tone="error" title="Could not load orders">
          {normalizeError(error).message}
        </Alert>
      )}
      {actionError && (
        <Alert tone="error" title="Action failed">
          {normalizeError(actionError).message}
        </Alert>
      )}

      <TableWrapper>
        <Table>
          <Thead>
            <Tr>
              <Th>Order</Th>
              <Th>Status</Th>
              <Th align="center">Items</Th>
              <Th align="right">Total</Th>
              <Th>Placed</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRowSkeleton key={index} columns={6} />
              ))
            ) : (
              data?.items.map((order) => {
                const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <Tr key={order.id}>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setOpenOrderId(order.id)}
                        className="font-mono text-sm font-medium text-brand-700 hover:underline"
                      >
                        #{shortId(order.id)}
                      </button>
                    </Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                    <Td align="center">
                      <span className="tabular">{itemCount}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-medium tabular">
                        {formatMoney(order.total_amount, order.currency)}
                      </span>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap text-xs text-zinc-500">
                        {formatRelative(order.created_at)}
                      </span>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        {order.status === "CONFIRMED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={ship.isPending && ship.variables === order.id}
                            onClick={() => ship.mutate(order.id)}
                            leftIcon={<Truck className="h-3.5 w-3.5" />}
                          >
                            Ship
                          </Button>
                        )}
                        {order.status === "SHIPPED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={deliver.isPending && deliver.variables === order.id}
                            onClick={() => deliver.mutate(order.id)}
                            leftIcon={<PackageCheck className="h-3.5 w-3.5" />}
                          >
                            Delivered
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setOpenOrderId(order.id)}>
                          View
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </TableWrapper>

      {data && (
        <Pagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          size={data.size}
          onPageChange={setPage}
        />
      )}

      <Modal
        open={Boolean(openOrderId)}
        onClose={() => setOpenOrderId(null)}
        title={`Order #${shortId(openOrderId ?? "")}`}
        description="Full saga trace as recorded by the order service"
        size="lg"
        footer={
          detail.data && isCancellable(detail.data.status) ? (
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => cancel.mutate(detail.data!.id)}
              leftIcon={<Ban className="h-4 w-4" />}
            >
              Force cancel
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setOpenOrderId(null)}>
              Close
            </Button>
          )
        }
      >
        {detail.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : detail.data ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <OrderStatusBadge status={detail.data.status} />
              <span className="text-sm font-semibold tabular">
                {formatMoney(detail.data.total_amount, detail.data.currency)}
              </span>
            </div>

            {detail.data.failure_reason && (
              <Alert tone="error" title="Failure reason">
                {detail.data.failure_reason}
              </Alert>
            )}

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Items
              </p>
              <ul className="divide-y divide-zinc-100 text-sm">
                {detail.data.items.map((item) => (
                  <li key={item.product_id} className="flex justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-zinc-800">{item.name}</span>
                      <span className="font-mono text-[11px] text-zinc-400">{item.sku}</span>
                    </span>
                    <span className="shrink-0 text-right tabular">
                      <span className="block text-zinc-500">×{item.quantity}</span>
                      <span className="text-zinc-900">
                        {formatMoney(item.line_total, detail.data!.currency)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Saga trace
              </p>
              <OrderTimeline history={detail.data.history} />
            </div>

            <p className="font-mono text-[11px] text-zinc-400">
              correlation id: {detail.data.correlation_id}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
