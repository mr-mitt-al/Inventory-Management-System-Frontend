import { NavLink, Outlet } from "react-router-dom";
import {
  AlertOctagon,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Warehouse,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Navbar } from "@/components/layout/Navbar";
import { ordersApi } from "@/api/orders";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, end: false },
  { to: "/admin/products", label: "Products", icon: Package, end: false },
  { to: "/admin/inventory", label: "Inventory", icon: Warehouse, end: false },
  { to: "/admin/users", label: "Users", icon: Users, end: false },
  { to: "/admin/dlq", label: "Dead letters", icon: AlertOctagon, end: false },
];

export function AdminLayout() {
  // Surfaced in the sidebar because a non-zero DLQ means a consumer is failing
  // permanently and orders may be stuck — it should not require opening a page to
  // discover that.
  const { data: stats } = useQuery({
    queryKey: ["admin", "orderStats"],
    queryFn: () => ordersApi.stats(),
    refetchInterval: 30_000,
    retry: false,
  });

  const dlqDepth = stats?.dlq_depth ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {to === "/admin/dlq" && dlqDepth > 0 && (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 tabular">
                    {dlqDepth}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Horizontal nav below lg, where the sidebar is hidden. */}
          <nav className="no-scrollbar mb-5 flex gap-1 overflow-x-auto lg:hidden">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-brand-50 text-brand-700" : "text-zinc-600 hover:bg-zinc-100",
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
                {to === "/admin/dlq" && dlqDepth > 0 && (
                  <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">
                    {dlqDepth}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
