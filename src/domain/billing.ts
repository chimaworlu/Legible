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

// Every SUBSCRIPTION_CHARGE always charges exactly one plan's full price
// (see nextPeriodStart in domain/subscription.ts — a mid-cycle switch queues
// a full-price period after the current one instead of prorating a partial
// charge), so this is a reliable fallback for rows written before
// Transaction.interval existed. Prefer the stored field via fromDbInterval
// below when it's available; this is what it falls back to when it isn't.
export function intervalForAmountMinor(amountMinor: number): BillingInterval | null {
  const pricing = getProPricing();
  if (amountMinor === pricing.monthlyMinor) return "monthly";
  if (amountMinor === pricing.yearlyMinor) return "yearly";
  return null;
}

export function otherInterval(interval: BillingInterval): BillingInterval {
  return interval === "monthly" ? "yearly" : "monthly";
}

export type DbBillingInterval = "MONTHLY" | "YEARLY";

export function toDbInterval(interval: BillingInterval): DbBillingInterval {
  return interval === "monthly" ? "MONTHLY" : "YEARLY";
}

// amountMinorFallback covers rows written before Transaction.interval
// existed — see intervalForAmountMinor's doc comment.
export function fromDbInterval(
  value: DbBillingInterval | null | undefined,
  amountMinorFallback?: number | null,
): BillingInterval | null {
  if (value === "MONTHLY") return "monthly";
  if (value === "YEARLY") return "yearly";
  return amountMinorFallback != null ? intervalForAmountMinor(amountMinorFallback) : null;
}

export const BILLING_PERIOD_DAYS: Record<BillingInterval, number> = { monthly: 30, yearly: 365 };
