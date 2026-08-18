import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Wide tables scroll inside their own container. The page body must never scroll
 *  horizontally — that breaks the whole layout on a phone. */
export function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="table-scroll">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return <table className="min-w-full divide-y divide-zinc-200 text-sm">{children}</table>;
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="bg-zinc-50">{children}</thead>;
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-zinc-100 bg-white">{children}</tbody>;
}

export function Tr({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(onClick && "cursor-pointer transition-colors hover:bg-zinc-50", className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-zinc-700",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}
