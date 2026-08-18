import { Badge } from "@/components/ui/Badge";

export interface StockBadgeProps {
  quantity: number;
  /** True when the number came from a product's `cached_stock` rather than from the
   *  inventory service. Changes the wording, because the two are not equally
   *  trustworthy and the UI should not imply otherwise. */
  approximate?: boolean;
  lowThreshold?: number;
}

export function StockBadge({ quantity, approximate = false, lowThreshold = 5 }: StockBadgeProps) {
  if (quantity <= 0) {
    return (
      <Badge tone="danger" dot>
        Out of stock
      </Badge>
    );
  }

  if (quantity <= lowThreshold) {
    return (
      <Badge tone="warning" dot>
        Only {quantity} left
      </Badge>
    );
  }

  return (
    <Badge tone="success" dot>
      {/* "In stock" rather than an exact count when the figure is the denormalized
          display copy — quoting a precise number we know may be stale invites a
          complaint when checkout disagrees. */}
      {approximate ? "In stock" : `${quantity} in stock`}
    </Badge>
  );
}
