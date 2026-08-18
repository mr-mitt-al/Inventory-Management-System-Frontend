import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  ArrowRight,
  IndianRupee,
  PackageCheck,
  ShoppingBag,
  Warehouse,
} from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { inventoryApi } from "@/api/inventory";
import { ordersApi } from "@/api/orders";
import { paymentsApi } from "@/api/payments";
import { cn } from "@/lib/cn";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus } from "@/types";

export function AdminDashboardPage() {
  const orderStats = useQuery({
    queryKey: ["admin", "orderStats"],
    queryFn: () => ordersApi.stats(),
    refetchInterval: 15_000,
  });

  const paymentStats = useQuery({
    queryKey: ["admin", "paymentStats"],
    queryFn: () => paymentsApi.stats(),
    refetchInterval: 30_000,
  });

  const lowStock = useQuery({
    queryKey: ["admin", "lowStock", 1],
    queryFn: () => inventoryApi.listLowStock({ page: 1, size: 5 }),
    refetchInterval: 60_000,
  });

  const reservations = useQuery({
    queryKey: ["admin", "reservationStats"],
    queryFn: () => inventoryApi.reservationStats(),
    refetchInterval: 30_000,
  });

  const dlqDepth = orderStats.data?.dlq_depth ?? 0;
  const inFlight =
    (orderStats.data?.by_status.PENDING ?? 0) +
    (orderStats.data?.by_status.INVENTORY_RESERVED ?? 0) +
    (orderStats.data?.by_status.PAID ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Live counters, refreshed automatically.</p>
      </header>

      {/* The alert that matters most. A non-zero DLQ means a consumer is failing
          permanently and orders may be stuck with no error surfacing anywhere else. */}
      {dlqDepth > 0 && (
        <Alert
          tone="error"
          title={`${dlqDepth} message${dlqDepth === 1 ? "" : "s"} parked in the dead letter queue`}
          action={
            <Link
              to="/admin/dlq"
              className="inline-flex items-center gap-1 text-sm font-medium underline"
            >
              Inspect and replay
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        >
          A consumer is failing permanently. Orders behind it may be stuck.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Orders in flight"
          value={orderStats.isLoading ? null : inFlight}
          hint="Placed but not yet confirmed"
          icon={<ShoppingBag className="h-4 w-4" />}
          tone="brand"
        />
        <StatTile
          label="Revenue (24h)"
          value={
            orderStats.isLoading
              ? null
              : new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(orderStats.data?.revenue_24h ?? 0)
          }
          hint="Paid and beyond"
          icon={<IndianRupee className="h-4 w-4" />}
          tone="success"
        />
        <StatTile
          label="Stock held"
          value={reservations.isLoading ? null : (reservations.data?.HELD ?? 0)}
          hint="Active reservations"
          icon={<Warehouse className="h-4 w-4" />}
          tone="info"
        />
        <StatTile
          label="Dead letters"
          value={orderStats.isLoading ? null : dlqDepth}
          hint="Parked, awaiting review"
          icon={<AlertOctagon className="h-4 w-4" />}
          tone={dlqDepth > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Orders by status" />
          <CardBody>
            {orderStats.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <StatusBreakdown counts={orderStats.data?.by_status ?? {}} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Payment outcomes"
            description="Failure codes come straight from the gateway"
          />
          <CardBody className="space-y-4">
            {paymentStats.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(paymentStats.data?.by_status ?? {}).map(([status, count]) => (
                    <div key={status} className="rounded-lg bg-zinc-50 p-3">
                      <dt className="text-xs text-zinc-500">{status}</dt>
                      <dd className="mt-0.5 text-lg font-semibold text-zinc-900 tabular">
                        {count}
                      </dd>
                    </div>
                  ))}
                </dl>

                {Object.keys(paymentStats.data?.failures_by_code ?? {}).length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Failures by code
                    </p>
                    <ul className="space-y-1.5">
                      {Object.entries(paymentStats.data?.failures_by_code ?? {}).map(
                        ([code, count]) => (
                          <li key={code} className="flex items-center justify-between text-sm">
                            <span className="font-mono text-xs text-zinc-600">{code}</span>
                            <Badge tone="danger">{count}</Badge>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Low stock"
          description="At or below the reorder threshold"
          action={
            <Link
              to="/admin/inventory"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Manage inventory
            </Link>
          }
        />
        <CardBody>
          {lowStock.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : lowStock.data && lowStock.data.items.length > 0 ? (
            <ul className="divide-y divide-zinc-100">
              {lowStock.data.items.map((stock) => (
                <li key={stock.product_id} className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-sm text-zinc-700">{stock.sku}</span>
                  <span className="flex items-center gap-3 text-sm">
                    <span className="text-zinc-500 tabular">
                      {stock.available_qty} / {stock.low_stock_threshold}
                    </span>
                    <Badge tone={stock.available_qty === 0 ? "danger" : "warning"}>
                      {stock.available_qty === 0 ? "Out" : "Low"}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <PackageCheck className="h-4 w-4 text-emerald-500" aria-hidden />
              Everything is above its threshold.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

const TILE_TONES = {
  brand: "bg-brand-50 text-brand-600",
  success: "bg-emerald-50 text-emerald-600",
  info: "bg-sky-50 text-sky-600",
  danger: "bg-red-50 text-red-600",
  neutral: "bg-zinc-100 text-zinc-500",
} as const;

function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number | string | null;
  hint: string;
  icon: React.ReactNode;
  tone: keyof typeof TILE_TONES;
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          {value === null ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <p className="mt-1 truncate text-2xl font-semibold text-zinc-900 tabular">{value}</p>
          )}
          <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>
        </div>
        <span
          className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TILE_TONES[tone])}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

function StatusBreakdown({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return <p className="text-sm text-zinc-500">No orders yet.</p>;

  const ordered = Object.entries(counts).sort(([, a], [, b]) => b - a);

  return (
    <ul className="space-y-2.5">
      {ordered.map(([status, count]) => {
        const meta = STATUS_META[status as OrderStatus];
        const percent = Math.round((count / total) * 100);

        return (
          <li key={status}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-zinc-700">{meta?.label ?? status}</span>
              <span className="text-zinc-500 tabular">
                {count} <span className="text-zinc-400">({percent}%)</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={cn("h-full rounded-full", meta?.dotClassName ?? "bg-zinc-400")}
                style={{ width: `${percent}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
