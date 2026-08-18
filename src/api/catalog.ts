import { api } from "@/api/client";
import type { Category, Page, Product, ProductQuery } from "@/types";

export const catalogApi = {
  listProducts: (query: ProductQuery) =>
    api.get<Page<Product>>("/products", { params: query }).then((r) => r.data),

  getProduct: (id: string) => api.get<Product>(`/products/${id}`).then((r) => r.data),

  listCategories: () => api.get<Category[]>("/categories").then((r) => r.data),

  // ---- admin ----
  adminListProducts: (params: { page?: number; size?: number; q?: string }) =>
    api.get<Page<Product>>("/admin/products", { params }).then((r) => r.data),

  createProduct: (body: {
    sku: string;
    name: string;
    description?: string | null;
    price: string;
    currency?: string;
    category_id?: string | null;
    image_url?: string | null;
    initial_stock?: number;
  }) => api.post<Product>("/admin/products", body).then((r) => r.data),

  updateProduct: (
    id: string,
    body: Partial<{
      name: string;
      description: string | null;
      price: string;
      category_id: string | null;
      image_url: string | null;
      is_active: boolean;
    }>,
  ) => api.patch<Product>(`/admin/products/${id}`, body).then((r) => r.data),

  /** Soft delete — historical orders reference this product from another database. */
  deactivateProduct: (id: string) =>
    api.delete<void>(`/admin/products/${id}`).then((r) => r.data),

  createCategory: (body: { name: string; slug: string; description?: string | null }) =>
    api.post<Category>("/admin/categories", body).then((r) => r.data),
};
