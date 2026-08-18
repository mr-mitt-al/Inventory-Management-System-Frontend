import { useEffect, useState } from "react";

/**
 * Delay a rapidly-changing value.
 *
 * Used on the product search box: without it every keystroke fires a request, so
 * typing "headphones" sends ten queries and the answers can arrive out of order.
 */
export function useDebounce<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
