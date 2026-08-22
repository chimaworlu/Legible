import { describe, expect, it } from "vitest";
import { formatNaira, getProBenefits, getProPricing } from "@/src/domain/billing";
import { config } from "@/src/config";

describe("getProPricing", () => {
  it("reads monthly and yearly prices straight from config", () => {
    const pricing = getProPricing();
    expect(pricing.monthlyMinor).toBe(config.plans.PRO.priceMinorMonthly);
    expect(pricing.yearlyMinor).toBe(config.plans.PRO.priceMinorYearly);
    expect(pricing.currency).toBe("NGN");
  });

  it("computes the yearly plan as cheaper than paying monthly all year", () => {
    const pricing = getProPricing();
    expect(pricing.yearlyMinor).toBeLessThan(pricing.monthlyMinor * 12);
    expect(pricing.yearlySavingsPercent).toBeGreaterThan(0);
  });
});

describe("getProBenefits", () => {
  it("returns a non-empty list of benefit strings", () => {
    const benefits = getProBenefits();
    expect(benefits.length).toBeGreaterThan(0);
    benefits.forEach((benefit) => expect(typeof benefit).toBe("string"));
  });

  it("names the actual configured image allowance, not a hardcoded number", () => {
    const benefits = getProBenefits();
    expect(benefits.some((benefit) => benefit.includes(String(config.plans.PRO.imagesPerMonth)))).toBe(true);
  });
});

describe("formatNaira", () => {
  it("formats a whole-Naira amount with the currency symbol and grouping", () => {
    expect(formatNaira(500000)).toBe("₦5,000");
    expect(formatNaira(5000000)).toBe("₦50,000");
  });

  it("never renders a decimal point (integer arithmetic only)", () => {
    expect(formatNaira(500000)).not.toContain(".");
  });
});
