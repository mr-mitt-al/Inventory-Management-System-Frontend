import { Badge } from "@/components/ui/Badge";
import { STATUS_META } from "@/lib/orderStatus";
import type { OrderStatus } from "@/types";

const TONE_BY_STATUS = {
  progress: "brand",
  success: "success",
  error: "danger",
  neutral: "neutral",
} as const;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];

  return (
    <Badge tone={TONE_BY_STATUS[meta.tone]} className={meta.className} dot dotClassName={meta.dotClassName}>
      {meta.label}
    </Badge>
  );
}
