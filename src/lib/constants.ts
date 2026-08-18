/** App-wide constants. */

/**
 * Test cards, mapped to the tokens the mock payment gateway understands.
 *
 * Exposed in checkout on purpose: being able to trigger a decline on demand is what
 * makes the compensation path demonstrable instead of theoretical. The card number
 * never leaves the browser — only the token is sent.
 */
export interface TestCard {
  number: string;
  token: string;
  last4: string;
  label: string;
  outcome: "success" | "failure";
  hint: string;
}

export const TEST_CARDS: readonly TestCard[] = [
  {
    number: "4242 4242 4242 4242",
    token: "tok_test_success",
    last4: "4242",
    label: "Succeeds",
    outcome: "success",
    hint: "Order completes: stock committed, order confirmed.",
  },
  {
    number: "4000 0000 0000 0002",
    token: "tok_test_declined",
    last4: "0002",
    label: "Declined by bank",
    outcome: "failure",
    hint: "Triggers compensation: reserved stock is released back.",
  },
  {
    number: "4000 0000 0000 9995",
    token: "tok_test_insufficient",
    last4: "9995",
    label: "Insufficient funds",
    outcome: "failure",
    hint: "Also triggers compensation, with a different failure code.",
  },
  {
    number: "4000 0000 0000 0127",
    token: "tok_test_timeout",
    last4: "0127",
    label: "Gateway timeout",
    outcome: "failure",
    hint: "Not auto-retryable: the charge may or may not have landed.",
  },
];

export const PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 20;

/** How often the tracking page re-reads an in-flight order when SSE is unavailable. */
export const ORDER_POLL_INTERVAL_MS = 2000;

export const STORAGE_KEYS = {
  auth: "eop.auth",
  cart: "eop.cart",
} as const;
