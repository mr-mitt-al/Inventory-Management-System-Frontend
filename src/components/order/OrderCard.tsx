import { Link } from "react-router-dom";
import { ChevronRight, Package } from "lucide-react";

import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { formatRelative, pluralize, shortId } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { OrderSummary } from "@/types";

export function OrderCard({ order }: { order: OrderSummary }) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const preview = order.items
    .slice(0, 2)
    .map((item) => item.name)
    .join(", ");
  const remaining = order.items.length - 2;

  return (
    <Link
      to={`/orders/${order.id}`}
      className="surface group flex items-center gap-4 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
        <Package className="h-5 w-5" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-zinc-900">
            #{shortId(order.id)}
          </span>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 truncate text-sm text-zinc-600">
          {preview}
          {remaining > 0 && ` +${remaining} more`}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">
          {pluralize(itemCount, "item")} · {formatRelative(order.created_at)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-semibold text-zinc-900 tabular">
          {formatMoney(order.total_amount, order.currency)}
        </p>
      </div>

      <ChevronRight
        className="h-5 w-5 shrink-0 text-zinc-300 transition-colors group-hover:text-brand-500"
        aria-hidden
      />
    </Link>
  );
}
