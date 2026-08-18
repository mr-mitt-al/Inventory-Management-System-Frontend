import { Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { AdminRoute, ProtectedRoute } from "@/routes/ProtectedRoute";
import { useSessionBootstrap } from "@/hooks/useAuth";

import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { CartPage } from "@/pages/shop/CartPage";
import { CheckoutPage } from "@/pages/shop/CheckoutPage";
import { ProductDetailPage } from "@/pages/shop/ProductDetailPage";
import { ProductListPage } from "@/pages/shop/ProductListPage";
import { OrderHistoryPage } from "@/pages/orders/OrderHistoryPage";
import { OrderTrackingPage } from "@/pages/orders/OrderTrackingPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminDlqPage } from "@/pages/admin/AdminDlqPage";
import { AdminInventoryPage } from "@/pages/admin/AdminInventoryPage";
import { AdminOrdersPage } from "@/pages/admin/AdminOrdersPage";
import { AdminProductsPage } from "@/pages/admin/AdminProductsPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  // Restores a session from the persisted refresh token before the guards run, so a
  // page reload does not bounce a signed-in user to /login.
  useSessionBootstrap();

  return (
    <Routes>
      <Route element={<ShopLayout />}>
        {/* Public */}
        <Route index element={<ProductListPage />} />
        <Route path="products/:productId" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* Requires a signed-in user */}
        <Route element={<ProtectedRoute />}>
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<OrderHistoryPage />} />
          <Route path="orders/:orderId" element={<OrderTrackingPage />} />
          {/* The design doc used /orders/:id/tracking; the detail page IS the tracking
              page, so the old path redirects rather than 404ing a bookmarked link. */}
          <Route path="orders/:orderId/tracking" element={<TrackingRedirect />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Admin. Convenience only — every admin endpoint is enforced server-side. */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="dlq" element={<AdminDlqPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

function TrackingRedirect() {
  const path = window.location.pathname.replace(/\/tracking\/?$/, "");
  return <Navigate to={path} replace />;
}
