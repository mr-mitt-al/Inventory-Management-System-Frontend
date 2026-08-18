import { api } from "@/api/client";
import type { Page, RegisterResponse, Role, TokenResponse, User } from "@/types";

export const authApi = {
  /** Always creates a customer. The backend has no field that could make an admin. */
  register: (body: { email: string; password: string; full_name: string }) =>
    api.post<RegisterResponse>("/auth/register", body).then((r) => r.data),

  login: (body: { email: string; password: string }) =>
    api.post<TokenResponse>("/auth/login", body).then((r) => r.data),

  logout: (refresh_token: string) =>
    api.post<void>("/auth/logout", { refresh_token }).then((r) => r.data),

  /** Reads the database rather than the token, so a role change or deactivation
   *  shows up immediately instead of at token expiry. */
  me: () => api.get<User>("/auth/me").then((r) => r.data),

  // ---- admin ----
  listUsers: (params: {
    page?: number;
    size?: number;
    role?: Role;
    is_active?: boolean;
    q?: string;
  }) => api.get<Page<User>>("/auth/users", { params }).then((r) => r.data),

  setRole: (userId: string, role: Role) =>
    api.patch<User>(`/auth/users/${userId}/role`, { role }).then((r) => r.data),

  setActive: (userId: string, is_active: boolean) =>
    api.patch<User>(`/auth/users/${userId}/status`, { is_active }).then((r) => r.data),
};
