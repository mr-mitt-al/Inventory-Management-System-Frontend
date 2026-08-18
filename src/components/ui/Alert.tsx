import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<Tone, { wrapper: string; icon: typeof Info }> = {
  info: { wrapper: "border-sky-200 bg-sky-50 text-sky-900", icon: Info },
  success: { wrapper: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: CheckCircle2 },
  warning: { wrapper: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle },
  error: { wrapper: "border-red-200 bg-red-50 text-red-900", icon: XCircle },
};

export interface AlertProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone = "info", title, children, action, className }: AlertProps) {
  const { wrapper, icon: Icon } = TONES[tone];

  return (
    <div
      className={cn("flex gap-3 rounded-lg border p-4 text-sm", wrapper, className)}
      // Errors and warnings interrupt; info and success are announced politely.
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-1", "text-current/90")}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
