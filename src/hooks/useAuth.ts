/**
 * Auth actions plus session bootstrap.
 *
 * On a page reload the access token is gone (memory only) but the refresh token is
 * not, so `bootstrap` exchanges it for a fresh pair and re-fetches the user. Without
 * this the app would show a logged-out navbar to a signed-in user until they
 * navigated somewhere that happened to trigger a 401.
 */

import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { normalizeError } from "@/api/client";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import type { TokenResponse } from "@/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { accessToken, user, initializing, setTokens, setUser, clear, setInitializing } =
    useAuthStore();

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => authApi.login(body),
    onSuccess: async (tokens) => {
      setTokens(tokens);
      const me = await authApi.me();
      setUser(me);
    },
  });

  const register = useMutation({
    mutationFn: (body: { email: string; password: string; full_name: string }) =>
      authApi.register(body),
  });

  const logout = useCallback(async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      // Best effort: a failed revoke must not trap the user in a signed-in UI.
      try {
        await authApi.logout(refreshToken);
      } catch {
        /* ignore */
      }
    }
    clear();
    // Drop cached responses so the next user does not see the previous one's orders.
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [clear, navigate, queryClient]);

  return {
    user,
    accessToken,
    isAuthenticated: accessToken !== null,
    initializing,
    login,
    register,
    logout,
    loginError: login.error ? normalizeError(login.error) : null,
    registerError: register.error ? normalizeError(register.error) : null,
    setInitializing,
  };
}

/** Runs once at app start. Silently restores a session from the refresh token. */
export function useSessionBootstrap(): void {
  const { refreshToken, accessToken, setTokens, setUser, clear, setInitializing } =
    useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!refreshToken || accessToken) {
        setInitializing(false);
        return;
      }

      try {
        // Bare axios, not the api instance: going through the interceptors would
        // attach a token we do not have yet.
        const { data } = await axios.post<TokenResponse>(
          `${BASE_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { headers: { "Content-Type": "application/json" }, timeout: 15_000 },
        );
        if (cancelled) return;
        setTokens(data);

        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        // Expired or revoked. Clear it rather than retrying on every mount.
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // Deliberately runs once: re-running on token change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Clears the cart after a successful checkout. */
export function useClearCart() {
  return useCartStore((s) => s.clear);
}
