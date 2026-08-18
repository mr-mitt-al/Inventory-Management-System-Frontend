import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  // Decorative: the surrounding live region announces the loading state, so
  // labelling the icon too would make a screen reader say it twice.
  return <Loader2 className={cn("h-5 w-5 animate-spin text-zinc-400", className)} aria-hidden />;
}

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Spinner className="h-7 w-7" />
      <p className="text-sm text-zinc-500">{label}…</p>
    </div>
  );
}
