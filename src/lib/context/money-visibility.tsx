"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface MoneyVisibilityContextValue {
  showMoney: boolean;
  toggleMoney: () => void;
  mask: (value: string) => string;
}

const MoneyVisibilityContext = createContext<MoneyVisibilityContextValue>({
  showMoney: true,
  toggleMoney: () => {},
  mask: (v) => v,
});

const STORAGE_KEY = "platita-show-money";

export function MoneyVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [showMoney, setShowMoney] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "false") setShowMoney(false);
  }, []);

  const toggleMoney = useCallback(() => {
    setShowMoney((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const mask = useCallback(
    (value: string) => (showMoney ? value : "******"),
    [showMoney]
  );

  return (
    <MoneyVisibilityContext.Provider value={{ showMoney, toggleMoney, mask }}>
      {children}
    </MoneyVisibilityContext.Provider>
  );
}

export function useMoneyVisibility() {
  return useContext(MoneyVisibilityContext);
}
