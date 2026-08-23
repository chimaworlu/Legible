export type SubscriptionSnapshot = {
  renewalMode: "AUTO" | "MANUAL";
  status: "ACTIVE" | "PAST_DUE" | "CANCELED";
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

// Nothing will renew a subscription past currentPeriodEnd once either:
//  - it's MANUAL (paid by transfer/USSD/etc. — no Payment Plan behind it,
//    so Flutterwave has no way to re-charge it), or
//  - the user asked to cancel (cancelAtPeriodEnd) — access was left running
//    until the paid-for period ends rather than being revoked immediately
//    (see app/api/billing/cancel/route.ts), so once that date passes there's
//    nothing left to keep active.
// An AUTO subscription that hasn't been cancelled is never "expired" here
// even past its date — a renewal charge either already extended
// currentPeriodEnd, or is still due; see billing/status/route.ts's lazy
// check, which is what actually flips ACTIVE -> CANCELED once this is true.
export function isSubscriptionExpired(subscription: SubscriptionSnapshot, now: Date): boolean {
  if (subscription.status !== "ACTIVE" && subscription.status !== "PAST_DUE") return false;
  if (subscription.currentPeriodEnd.getTime() > now.getTime()) return false;
  return subscription.renewalMode === "MANUAL" || subscription.cancelAtPeriodEnd;
}

// The date a newly paid-for period should start counting from. If there's
// no still-running subscription to preserve, it starts now (a fresh
// subscribe, or a renewal after everything already lapsed). Otherwise it's
// appended right after the current period ends — this is what lets a PRO
// user switch interval, or resubscribe after cancelling, without losing any
// already-paid-for time and without overlapping/double-charging for the
// same days (see calculateIntervalSwitchAmount's removal — queuing after
// exhaustion replaces crediting a partial refund).
export function nextPeriodStart(existing: SubscriptionSnapshot | null, now: Date): Date {
  if (!existing) return now;
  if (existing.status === "CANCELED") return now;
  return existing.currentPeriodEnd.getTime() > now.getTime() ? existing.currentPeriodEnd : now;
}

// Whole days remaining until a date, rounded up so "23 hours left" reads as
// 1 day, not 0 — a MANUAL subscriber shouldn't see "0 days left" and still
// have almost a full day of access.
export function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
