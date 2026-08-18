/**
 * Money handling.
 *
 * The backend sends decimal STRINGS from postgres NUMERIC columns. Parsing those
 * into JS numbers reintroduces exactly the floating-point error the backend went
 * to the trouble of avoiding: `0.1 + 0.2 === 0.30000000000000004`, and a cart of
 * three items can total a paisa short.
 *
 * So all arithmetic happens in integer minor units (paise), and the string form is
 * only ever parsed once at the boundary.
 */

const CURRENCY_LOCALES: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

/** "26990.00" -> 2699000 (paise). Integer, so it is safe to add and multiply. */
export function toMinorUnits(amount: string | number): number {
  const value = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(value)) return 0;
  // Round after scaling: parseFloat("0.07") * 100 is 7.000000000000001.
  return Math.round(value * 100);
}

/** 2699000 (paise) -> "26990.00", the wire format the backend expects. */
export function fromMinorUnits(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Sum line totals without ever touching a float. */
export function sumLines(lines: { unit_price: string; quantity: number }[]): number {
  return lines.reduce(
    (total, line) => total + toMinorUnits(line.unit_price) * line.quantity,
    0,
  );
}

export function lineTotal(unitPrice: string, quantity: number): number {
  return toMinorUnits(unitPrice) * quantity;
}

/** Format minor units for display: 2699000 -> "₹26,990.00" */
export function formatMinor(minor: number, currency = "INR"): string {
  return new Intl.NumberFormat(CURRENCY_LOCALES[currency] ?? "en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Format a wire-format decimal string for display. */
export function formatMoney(amount: string | number, currency = "INR"): string {
  return formatMinor(toMinorUnits(amount), currency);
}

/** True when two wire amounts differ — used to detect price drift in the cart. */
export function priceChanged(a: string, b: string): boolean {
  return toMinorUnits(a) !== toMinorUnits(b);
}
