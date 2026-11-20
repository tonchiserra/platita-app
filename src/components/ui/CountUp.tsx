"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/utils/format";
import type { Currency } from "@/lib/constants/currencies";
import { isHydrated, markHydrated } from "./hydration";

/**
 * A figure that counts up to its value when it appears after a navigation.
 * On the first page load it shows the server-rendered value as is: animating
 * from zero there would flash the real figure, then zero, then count.
 */
export function CountUp({
  value,
  currency = "ARS",
  decimals = 0,
  duration = 900,
  signed = false,
}: {
  value: number;
  currency?: Currency;
  decimals?: number;
  duration?: number;
  /** Prefix a + on positive values. */
  signed?: boolean;
}) {
  const [shown, setShown] = useState(() => (isHydrated() ? 0 : value));
  // The last painted value, so a new target counts from where the old one stopped.
  const last = useRef(shown);

  useEffect(() => {
    markHydrated();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    let from = 0;
    let t0 = 0;
    const step = (t: number) => {
      if (!t0) {
        t0 = t;
        from = last.current;
      }
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      const next = from + (value - from) * eased;
      last.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span>
      <span className="money-value">{formatMoney(shown, currency, { decimals, signed })}</span>
      <span className="money-mask" aria-label="Monto oculto">
        ••••••
      </span>
    </span>
  );
}
