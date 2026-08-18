import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "@/App";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { normalizeError } from "@/api/client";
// Importing the store here registers the axios token accessors before any request
// can fire.
import "@/store/authStore";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Off by default: the order tracking page opts in explicitly, and refetching
      // every list on every window focus is a lot of traffic for little benefit.
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const { status } = normalizeError(error);
        // 4xx will not fix itself by asking again. 401 is handled by the axios
        // interceptor, which refreshes and replays the request.
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      // Never auto-retry a mutation. Retrying "place order" or "refund" without the
      // user asking is how duplicates happen; order creation is protected by an
      // idempotency key precisely because retries must be deliberate.
      retry: false,
    },
  },
});

const container = document.getElementById("root");
if (!container) throw new Error("#root element is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
