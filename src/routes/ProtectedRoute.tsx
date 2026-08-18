import { Navigate, Outlet, useLocation } from "react-router-dom";

import { PageLoader } from "@/components/ui/Spinner";
import { selectIsAdmin, useAuthStore } from "@/store/authStore";

/**
 * Requires a signed-in user.
 *
 * The `initializing` check is load-bearing: on a page reload the access token is
 * gone (it is memory-only) and is being silently restored from the refresh token.
 * Redirecting before that finishes would bounce a signed-in user to /login on every
 * refresh — a bug that looks like broken auth.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const initializing = useAuthStore((s) => s.initializing);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (initializing) return <PageLoader label="Restoring your session" />;

  if (!accessToken) {
    // Remember where they were headed so login can send them back rather than
    // dumping them on the home page.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

/**
 * Requires an admin.
 *
 * This is convenience only, never enforcement. Every admin endpoint is guarded
 * server-side by `require_admin`, which verifies the JWT signature locally — a user
 * who edits their local state to fake a role sees admin screens full of 403s.
 */
export function AdminRoute() {
  const location = useLocation();
  const initializing = useAuthStore((s) => s.initializing);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAdmin = useAuthStore(selectIsAdmin);

  if (initializing) return <PageLoader label="Checking permissions" />;

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}
