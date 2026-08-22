"use client";

import Hero from "../../src/components/marketing/Hero";
import Testimonials from "../../src/components/marketing/Testimonials";
import Contact from "../../src/components/marketing/Contact";
import { useMarketingSection } from "../../src/context/MarketingSectionContext";

export default function MarketingPage() {
  const { active } = useMarketingSection();

  return (
    <main
      style={{
        height: "100%",
        backgroundColor: "var(--color-roles-surface)",
        color: "var(--color-roles-on-surface)",
      }}
    >
      {active === "home" && <Hero />}
      {active === "testimonials" && <Testimonials />}
      {active === "contact" && <Contact />}
    </main>
  );
}
