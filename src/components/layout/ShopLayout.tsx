import { Outlet } from "react-router-dom";

import { Navbar } from "@/components/layout/Navbar";

export function ShopLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Keyboard users should be able to jump past the nav on every page. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <Navbar />

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <p className="text-sm text-zinc-500">
            Event-driven order processing demo · FastAPI · Kafka · PostgreSQL
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Orders are processed asynchronously. Placing one returns immediately and the
            saga completes in the background — watch it on the tracking page.
          </p>
        </div>
      </footer>
    </div>
  );
}
