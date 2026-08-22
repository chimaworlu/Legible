"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type MarketingSection = "home" | "testimonials" | "contact";

interface MarketingSectionContextValue {
  active: MarketingSection;
  setActive: (section: MarketingSection) => void;
}

const MarketingSectionContext = createContext<MarketingSectionContextValue | null>(null);

export function MarketingSectionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<MarketingSection>("home");

  return (
    <MarketingSectionContext.Provider value={{ active, setActive }}>
      {children}
    </MarketingSectionContext.Provider>
  );
}

export function useMarketingSection() {
  const context = useContext(MarketingSectionContext);
  if (!context) {
    throw new Error("useMarketingSection must be used within a MarketingSectionProvider");
  }
  return context;
}
