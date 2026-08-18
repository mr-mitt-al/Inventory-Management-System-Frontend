import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Package, ShoppingCart, Store, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/useAuth";
import { selectIsAdmin, useAuthStore } from "@/store/authStore";
import { selectCartCount, useCartStore } from "@/store/cartStore";

export function Navbar() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const isAdmin = useAuthStore(selectIsAdmin);
  const cartCount = useCartStore(selectCartCount);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold text-zinc-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Store className="h-4 w-4" aria-hidden />
          </span>
          <span className="hidden sm:inline">Order Processing</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <NavItem to="/">Shop</NavItem>
          {isAuthenticated && <NavItem to="/orders">My orders</NavItem>}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/cart"
            className="relative rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
          >
            <ShoppingCart className="h-5 w-5" aria-hidden />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white tabular">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {isAdmin && (
            <Link to="/admin" className="hidden sm:block">
              <Button variant="outline" size="sm" leftIcon={<LayoutDashboard className="h-4 w-4" />}>
                Admin
              </Button>
            </Link>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/orders"
                className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 sm:flex"
              >
                <UserIcon className="h-4 w-4 text-zinc-400" aria-hidden />
                <span className="max-w-[10rem] truncate">{user?.full_name ?? "Account"}</span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void logout()}
                aria-label="Sign out"
                leftIcon={<LogOut className="h-4 w-4" />}
              >
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                Sign in
              </Button>
              <Button size="sm" onClick={() => navigate("/register")}>
                Sign up
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav: the desktop links collapse, but cart and orders must stay
          reachable without a hamburger menu. */}
      <nav className="flex items-center gap-1 border-t border-zinc-100 px-4 py-1.5 md:hidden">
        <NavItem to="/">
          <Store className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
          Shop
        </NavItem>
        {isAuthenticated && (
          <NavItem to="/orders">
            <Package className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
            Orders
          </NavItem>
        )}
        {isAdmin && (
          <NavItem to="/admin">
            <LayoutDashboard className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
            Admin
          </NavItem>
        )}
      </nav>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      // `end` on the root link, or "/" stays highlighted on every page.
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          isActive ? "bg-brand-50 text-brand-700" : "text-zinc-600 hover:bg-zinc-100",
        )
      }
    >
      {children}
    </NavLink>
  );
}
