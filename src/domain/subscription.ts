export type SubscriptionSnapshot = {
  renewalMode: "AUTO" | "MANUAL";
  status: "ACTIVE" | "PAST_DUE" | "CANCELED";
  currentPeriodEnd: Date;
};

// A MANUAL subscription (paid by transfer/USSD/etc.) has no Payment Plan
// behind it, so nothing will ever charge it again — once its period ends
// with no renewal, it's expired, not just "due soon."
export function isManualSubscriptionExpired(subscription: SubscriptionSnapshot, now: Date): boolean {
  return subscription.renewalMode === "MANUAL" && subscription.status === "ACTIVE" && subscription.currentPeriodEnd.getTime() <= now.getTime();
}

// Whole days remaining until a date, rounded up so "23 hours left" reads as
// 1 day, not 0 — a MANUAL subscriber shouldn't see "0 days left" and still
// have almost a full day of access.
export function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
