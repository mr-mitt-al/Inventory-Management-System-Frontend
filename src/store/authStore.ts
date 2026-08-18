/**
 * Auth session.
 *
 * Token placement is a deliberate trade-off:
 *
 *   access token  -> memory only, NOT persisted. Short-lived (15 min), and keeping
 *                    it out of localStorage limits what an XSS payload can read.
 *   refresh token -> localStorage. It has to survive a page reload or the user is
 *                    logged out every refresh, which nobody accepts.
 *
 * This is the standard compromise and it is worth being honest about: a determined
 * XSS can still use the refresh token. Fully avoiding that needs an httpOnly cookie
 * and a CSRF strategy, which the backend does not implement.
 *
 * On reload, the access token is gone but the refresh token is not — so the app
 * silently exchanges it for a new pair during bootstrap.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { registerTokenAccessors } from "@/api/client";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Role, TokenClaims, TokenResponse, User } from "@/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  /** True until bootstrap has finished, so guards do not redirect prematurely. */
  initializing: boolean;

  setTokens: (tokens: TokenResponse) => void;
  setUser: (user: User | null) => void;
  clear: () => void;
  setInitializing: (value: boolean) => void;
}

/** Decode a JWT payload without verifying it.
 *
 *  Safe for UI decisions only — the signature is checked by every backend service.
 *  A forged token buys nothing but a misleading navbar. */
export function decodeClaims(token: string): TokenClaims | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as TokenClaims;
  } catch {
    return null;
  }
}

export function isExpired(token: string, skewSeconds = 30): boolean {
  const claims = decodeClaims(token);
  if (!claims?.exp) return true;
  // Treat "about to expire" as expired, so a request does not leave with a token
  // that dies in flight.
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      initializing: true,

      setTokens: (tokens) =>
        set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }),

      setUser: (user) => set({ user }),

      clear: () => set({ accessToken: null, refreshToken: null, user: null }),

      setInitializing: (value) => set({ initializing: value }),
    }),
    {
      name: STORAGE_KEYS.auth,
      storage: createJSONStorage(() => localStorage),
      // ONLY the refresh token is written to disk. The access token stays in memory
      // and the user object is re-fetched, so a stale role can never be trusted
      // from storage.
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
);

// ---------------------------------------------------------------- api plumbing
// Wire the axios interceptors to this store once, at module load. The client
// deliberately does not import the store itself, so it stays framework-free.
registerTokenAccessors({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onRefreshed: (tokens) => useAuthStore.getState().setTokens(tokens),
  onAuthLost: () => useAuthStore.getState().clear(),
});

// ------------------------------------------------------------------- selectors
export const selectIsAuthenticated = (s: AuthState): boolean => s.accessToken !== null;

/** Role comes from the token, matching what the backend authorizes on.
 *  Falls back to the fetched user so /me reflects a change before token expiry. */
export const selectRole = (s: AuthState): Role | null => {
  if (s.accessToken) {
    const claims = decodeClaims(s.accessToken);
    if (claims?.role) return claims.role;
  }
  return s.user?.role ?? null;
};

export const selectIsAdmin = (s: AuthState): boolean => selectRole(s) === "admin";
