# E-Commerce Order Processing — Frontend

React 18 + TypeScript storefront and admin panel for the event-driven backend.

**Status: complete.** 0 type errors, production build passes, dev server verified.

> **A note on the language.** You asked for "react.js"; this is built in
> **TypeScript**, as specified in `DESIGN.md` §11 — the Zod schemas mirror the
> backend's Pydantic models and the API types mirror its response shapes, which is
> most of the value. If you actually wanted plain JavaScript, say so and I will
> convert it (mechanical: strip type annotations, rename `.tsx` → `.jsx`).

## Running it

**With the backend (recommended)** — one command brings up everything:

```powershell
cd "E:\E-Commerce Order Processing System\E-Commerce Backend"
.\dev.ps1 up
```

Then open **http://localhost:5173**. Nginx serves the built app and proxies
`/api` to the gateway.

**Frontend only, against a running backend:**

```powershell
cd "E:\E-Commerce Order Processing System\E-Commerce Frontend"
npm install
Copy-Item .env.example .env
npm run dev            # http://localhost:5173
```

Vite proxies `/api` → `http://localhost:8000`, so the browser stays on one origin
and CORS never comes up.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck then production build to `dist/` |
| `npm run typecheck` | Types only, no emit |
| `npm run preview` | Serve the built bundle locally |

## Pages

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | public | Product grid, search, filters, sort — state lives in the URL |
| `/products/:id` | public | Detail with **authoritative** stock from the inventory service |
| `/cart` | public | Re-validates prices and stock against the server |
| `/checkout` | auth | Address, test-card picker, place order |
| `/orders/:id` | auth | **Live saga tracking** — the centrepiece |
| `/orders` | auth | Order history |
| `/admin` | admin | Dashboard: in-flight orders, revenue, held stock, DLQ depth |
| `/admin/orders` | admin | All orders, ship/deliver, force-cancel, full saga trace |
| `/admin/products` | admin | Product CRUD |
| `/admin/inventory` | admin | Restock vs. correct-count, plus the stock ledger |
| `/admin/users` | admin | Promote/demote, activate/deactivate |
| `/admin/dlq` | admin | Parked messages, stack traces, replay and discard |

## The three decisions that shaped this

### 1. `POST /orders` returns 202, so the UI cannot claim success

The backend accepts an order and *then* reserves stock and charges the card. A
naive frontend shows "Order placed successfully!" and is wrong, because payment
can decline two seconds later.

So checkout navigates to a tracking page that shows the saga running, and on
failure says explicitly:

> **Payment declined — insufficient funds**
> You have not been charged.
> The items reserved for this order have been returned to stock.

That last line is the UI surfacing the compensating transaction. Steps that
already succeeded stay ticked and only the failed step shows a cross — resetting
the whole stepper would hide that stock *was* reserved and then released.

### 2. `EventSource` cannot do authenticated SSE

`DESIGN.md` specified `new EventSource(url, { withCredentials: true })`. That does
not work: **the native EventSource API cannot set request headers**, and the stream
endpoint requires `Authorization: Bearer`. It would be rejected with 401 before a
single event arrived.

Putting the token in the query string would leak a credential into access logs and
browser history. So [`src/api/orderStream.ts`](src/api/orderStream.ts) reads the
stream with `fetch` + `ReadableStream` and parses the SSE wire format directly —
about forty lines, supports headers, real cancellation via `AbortController`.

Polling runs alongside it at 2s. Belt and braces: SSE gives sub-second updates,
polling guarantees the page converges if the stream drops or a proxy buffers it.
Both stop the moment the order is terminal.

### 3. Single-flight token refresh

Access tokens live 15 minutes and the backend **rotates** refresh tokens — each use
revokes the previous one. When a token expires, several requests 401 together. Naive
per-request refresh fires N refreshes; the first invalidates the token the other
N−1 are using; the backend sees a revoked token replayed, treats it as theft, and
**revokes every session for the user**.

So the first 401 starts a refresh and every concurrent 401 awaits that same promise.
See the comment block in [`src/api/client.ts`](src/api/client.ts).

## Other things done deliberately

- **Money is never a JS number.** The backend sends decimal strings from `NUMERIC`
  columns; parsing to float reintroduces the error it avoided. All arithmetic is in
  integer paise ([`src/lib/money.ts`](src/lib/money.ts)).
- **One idempotency key per checkout**, generated in a `useRef` at mount — not per
  click. Per-click keys would let a double-click create two orders and charge twice.
- **The client cannot send a price.** `OrderItemRequest` carries `product_id` and
  `quantity` only; the backend prices from its own read-model.
- **Card numbers never leave the browser.** Only a token is sent, because the value
  is copied into Kafka events retained for seven days.
- **Access token in memory, refresh token in localStorage.** The standard
  compromise, documented with its limitation in
  [`src/store/authStore.ts`](src/store/authStore.ts).
- **Cart is client-side.** No cart service, deliberately — a cart needs no
  consistency guarantees. Cost: no cross-device cart.
- **Stock wording is honest.** A product card says "In stock" (the catalog's
  denormalized copy) while the detail page shows an exact count (from inventory).
  Quoting a precise number we know may be stale invites a complaint at checkout.

## Demonstrating the compensation

1. Sign in, add something to the cart, go to checkout.
2. Pick **4000 0000 0000 0002 — Declined by bank**.
3. Place the order and watch: *Order placed* ✓ → *Stock reserved* ✓ → *Payment* ✗
4. The failure card states no charge was made and the items went back to stock.
5. Confirm in `/admin/inventory` — `available` is back to its original value.

Card **4242 4242 4242 4242** takes the happy path instead.

## Stack

React 18 · TypeScript 5.7 · Vite 6 · Tailwind 3.4 · TanStack Query 5 · Zustand 5 ·
React Router 6 · React Hook Form + Zod · Axios · lucide-react

`DESIGN.md` named shadcn/ui. I hand-rolled ten primitives in
[`src/components/ui/`](src/components/ui/) instead — shadcn requires a CLI that
generates files into the project, and for this many components the generated code
would be more to review than the ~400 lines here.

## Layout

```
src/
  api/          axios client (refresh queue), one module per service, SSE reader
  components/
    ui/         Button Input Select Badge Card Alert Modal Table Pagination …
    layout/     Navbar, ShopLayout, AdminLayout
    order/      OrderStatusStepper ← the centrepiece, timeline, failure card
    product/    ProductCard, filters, StockBadge
    cart/       CartLineRow
  hooks/        useAuth (+ session bootstrap), useOrderTracking, useProducts
  lib/          money (integer paise), orderStatus (state machine), format, cn
  pages/        auth/ shop/ orders/ admin/
  routes/       ProtectedRoute, AdminRoute
  store/        authStore, cartStore (both persisted)
  types/        API contracts mirroring the backend
```

## Not done

- **No tests.** Vitest + React Testing Library was in the plan and is not here. The
  highest-value targets would be `resolveStepStates` (the failure-rendering logic),
  the money helpers, and the refresh-queue behaviour.
- **No dark mode.** Light only, painted explicitly.
- **Retry-payment reuses the success token** rather than collecting fresh card
  details, since there is no real PSP element to collect them with.
- **Not run against a live backend.** Docker is not installed on this machine, so
  every request path is verified by types and compilation only — no response has
  actually been parsed. That is the first thing to check once the stack is up.
