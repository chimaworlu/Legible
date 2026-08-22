import { config } from "@/src/config";

// PRO benefits over FREE, derived from src/config and src/domain/planLimits
// so this copy can never drift from the limits actually enforced elsewhere
// (coding-standards.md law 8 — no literal caps hardcoded here).
export function getProBenefits(): string[] {
  return [
    `${config.plans.PRO.imagesPerMonth} images every month, up from ${config.plans.FREE.imagesPerMonth} on Free`,
    `No monthly limit on how many books you create, up from ${config.plans.FREE.booksAllowance} on Free`,
    `${config.caps.bookImageLimitPro} images per book, up from ${config.caps.bookImageLimitFree} on Free`,
    "No watermark on exported PDFs",
    "Hold and spend credits for extra images beyond your monthly allowance",
  ];
}

export type ProPricing = {
  monthlyMinor: number;
  yearlyMinor: number;
  currency: string;
  yearlySavingsPercent: number;
};

// Rounding rule: nearest whole percent, same as domain/usage.ts's
// computeUsagePercent (money-and-billing.md law 2 — explicit, documented
// rounding on any money-derived percentage).
export function getProPricing(): ProPricing {
  const monthlyMinor = config.plans.PRO.priceMinorMonthly;
  const yearlyMinor = config.plans.PRO.priceMinorYearly;
  const costOfPayingMonthlyForAYear = monthlyMinor * 12;
  const yearlySavingsPercent = Math.round(
    ((costOfPayingMonthlyForAYear - yearlyMinor) / costOfPayingMonthlyForAYear) * 100,
  );

  return { monthlyMinor, yearlyMinor, currency: "NGN", yearlySavingsPercent };
}

// Display only. These amounts are always whole Naira (no kobo remainder),
// so this stays integer division rather than a float divide.
export function formatNaira(amountMinor: number): string {
  const major = Math.floor(amountMinor / 100);
  return `₦${major.toLocaleString("en-NG")}`;
}

export type BillingInterval = "monthly" | "yearly";

// There's no stored "interval" field on Subscription (see
// database-schema.md) — a user's current billing interval is derived from
// the amount of their latest SUBSCRIPTION_CHARGE Transaction, the same way
// reconcileTransaction derives it when granting one.
export function intervalForAmountMinor(amountMinor: number): BillingInterval | null {
  const pricing = getProPricing();
  if (amountMinor === pricing.monthlyMinor) return "monthly";
  if (amountMinor === pricing.yearlyMinor) return "yearly";
  return null;
}

export function otherInterval(interval: BillingInterval): BillingInterval {
  return interval === "monthly" ? "yearly" : "monthly";
}
