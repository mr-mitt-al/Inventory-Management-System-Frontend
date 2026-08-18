/**
 * The axios instance every API module uses.
 *
 * Two things here are load-bearing:
 *
 * 1. **Single-flight token refresh.** Access tokens live 15 minutes. When one
 *    expires, a page typically has several requests in flight at once, and all of
 *    them get a 401 together. Refreshing per request would fire N refreshes — and
 *    because the backend ROTATES refresh tokens (each use revokes the previous
 *    one), the first refresh invalidates the token the other N-1 are using. The
 *    backend then sees a revoked token being replayed, treats it as theft, and
 *    revokes every session for the user. The result is a user being logged out for
 *    no reason at all.
 *
 *    So the first 401 starts a refresh and every concurrent 401 waits on that same
 *    promise, then replays with the new token.
 *
 * 2. **Correlation ids originate here.** One id per request, echoed back by the
 *    gateway and threaded through every event the backend publishes as a result.
 *    A checkout is traceable across six services from a single value in devtools.
 */

import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import type { ApiError, TokenResponse } from "@/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

/** Endpoints that must never trigger a refresh-and-retry: a 401 from them IS the
 *  answer, and retrying would recurse. */
const AUTH_FREE_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ---------------------------------------------------------------- token access
// Kept in module scope rather than imported from the store, so this file has no
// dependency on React. The store registers its accessors at startup.
type TokenAccessors = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onRefreshed: (tokens: TokenResponse) => void;
  onAuthLost: () => void;
};

let accessors: TokenAccessors = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  onRefreshed: () => {},
  onAuthLost: () => {},
};

export function registerTokenAccessors(next: TokenAccessors): void {
  accessors = next;
}

// -------------------------------------------------------------------- requests
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = accessors.getAccessToken();
  if (token && !AUTH_FREE_PATHS.some((p) => config.url?.startsWith(p))) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Trace starts at the click, not at the API.
  config.headers["X-Correlation-Id"] = crypto.randomUUID();
  return config;
});

// ------------------------------------------------------------------- responses
interface RetriableConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

/** The in-flight refresh, if any. Every concurrent 401 awaits this one promise. */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = accessors.getRefreshToken();
  if (!refreshToken) throw new Error("no refresh token");

  // A bare axios call, not `api` — going through the instance would re-enter these
  // interceptors and attach the expired access token.
  const { data } = await axios.post<TokenResponse>(
    `${BASE_URL}/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { "Content-Type": "application/json" }, timeout: 15_000 },
  );

  accessors.onRefreshed(data);
  return data.access_token;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const canRetry =
      status === 401 &&
      config &&
      !config._retried &&
      !AUTH_FREE_PATHS.some((p) => config.url?.startsWith(p)) &&
      accessors.getRefreshToken() !== null;

    if (!canRetry) return Promise.reject(error);

    config._retried = true;

    try {
      // Start a refresh, or join the one already running.
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      const token = await refreshInFlight;

      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      return api.request(config);
    } catch {
      // The refresh token is expired or revoked. Nothing left to try.
      accessors.onAuthLost();
      return Promise.reject(error);
    }
  },
);

// ----------------------------------------------------------------- error shape
export interface NormalizedError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Turn any thrown value into something renderable.
 *
 * Every component that shows an error needs this; without it each one
 * re-implements the `error.response?.data?.error?.message ?? ...` chain slightly
 * differently and some end up printing "[object Object]".
 */
export function normalizeError(error: unknown): NormalizedError {
  if (axios.isAxiosError<ApiError>(error)) {
    const payload = error.response?.data;

    if (payload?.error) {
      return {
        status: error.response?.status ?? 0,
        code: payload.error.code,
        message: payload.error.message,
        details: payload.error.details,
        correlationId: payload.correlation_id,
      };
    }

    // FastAPI's own 422 shape, which does not use our error envelope.
    const detail = (error.response?.data as unknown as { detail?: unknown })?.detail;
    if (Array.isArray(detail)) {
      const first = detail[0] as { loc?: string[]; msg?: string } | undefined;
      const field = first?.loc?.filter((l) => l !== "body").join(".");
      return {
        status: 422,
        code: "validation_error",
        message: field ? `${field}: ${first?.msg ?? "invalid"}` : (first?.msg ?? "invalid input"),
      };
    }
    if (typeof detail === "string") {
      return { status: error.response?.status ?? 0, code: "error", message: detail };
    }

    if (error.code === "ECONNABORTED") {
      return { status: 0, code: "timeout", message: "The request timed out." };
    }
    if (!error.response) {
      return {
        status: 0,
        code: "network_error",
        message: "Could not reach the server. Is the backend running?",
      };
    }

    return {
      status: error.response.status,
      code: "http_error",
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return { status: 0, code: "client_error", message: error.message };
  }
  return { status: 0, code: "unknown", message: "Something went wrong." };
}

/** Absolute URL for a path — needed by the SSE reader, which bypasses axios. */
export function apiUrl(path: string): string {
  if (BASE_URL.startsWith("http")) return `${BASE_URL}${path}`;
  return `${window.location.origin}${BASE_URL}${path}`;
}
