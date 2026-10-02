import { prisma } from "@/src/db/client";
import { transactionRepo } from "@/src/db/repositories/transaction";
import { isUniqueConstraintError } from "@/src/auth/idempotency";
import { verifyTransaction, cancelActiveSubscriptionsForPlan, type VerifiedTransaction } from "./flutterwave";
import { getProPricing, toDbInterval, BILLING_PERIOD_DAYS, type BillingInterval } from "@/src/domain/billing";
import { isSubscriptionExpired, nextPeriodStart } from "@/src/domain/subscription";
import { sendManualRenewalReminderEmail } from "@/src/email/mailer";
import { logPaymentEvent, redactPaymentPayload } from "./paymentLog";

// Our checkout route (app/api/billing/checkout) generates tx_ref shaped
// "sub_<userId>_<interval>_<planId>_<random8hex>" — userId is a cuid, which
// never contains an underscore, so the fixed
// "_<monthly|yearly>_<digits>_<8 hex chars>" suffix anchors the match
// regardless of userId's length. planId is the per-user Flutterwave Payment
// Plan this charge was made against (see createUserPaymentPlan in
// flutterwave.ts) — carried here rather than looked up from Flutterwave's
// response because it's already known and trustworthy: we generated it.
// "0" is the sentinel for a manual (transfer/USSD/other) checkout, which has
// no Payment Plan at all (R32 — card-only would drop those payment paths).
export function parseSubscriptionTxRef(txRef: string): { userId: string; interval: BillingInterval; planId: string } | null {
  const match = txRef.match(/^sub_(.+)_(monthly|yearly)_(\d+)_[0-9a-f]{8}$/);
  if (!match) return null;
  return { userId: match[1], interval: match[2] as BillingInterval, planId: match[3] };
}

export function userIdFromTxRef(txRef: string): string | null {
  return parseSubscriptionTxRef(txRef)?.userId ?? null;
}

export type ReconcileOutcome =
  | { status: "granted"; userId: string; txRef: string }
  | { status: "already_processed"; txRef: string }
  | { status: "not_successful"; txRef: string }
  | { status: "unknown_tx_ref"; txRef: string }
  | { status: "verification_mismatch"; txRef: string; reason: string }
  | { status: "user_not_found"; userId: string };

export type ReconcileSource = "WEBHOOK" | "CALLBACK";

// The single source of truth for "grant PRO for this Flutterwave
// transaction id" — an independent, verified server-side confirmation
// (security.md rule 7 explicitly allows this as an alternative to a
// webhook). Used by:
//  - the webhook handler, for the normal path
//  - the redirect callback, as backup polling for exactly the case where a
//    webhook was never delivered (e.g. no public URL registered) —
//    Flutterwave's own best-practice guidance
// Idempotent by tx_ref either way, so it's safe for both to fire for the
// same payment.
//
// Every outcome is written to PaymentLog before returning — this function
// is the funnel both callers go through, so it's the one place that can
// guarantee a consistent audit trail regardless of which path triggered it.
export async function reconcileTransaction(transactionId: string, source: ReconcileSource): Promise<ReconcileOutcome> {
  let verified: VerifiedTransaction;
  try {
    verified = await verifyTransaction(transactionId);
  } catch (error) {
    // The verify call itself failing (Flutterwave unreachable, erroring,
    // rate-limiting us, ...) is exactly the kind of event this table exists
    // to not lose — log it before rethrowing so callers keep their existing
    // retry behavior (webhook: 500 → Flutterwave retries).
    await logPaymentEvent({
      source,
      eventType: "charge.completed",
      outcome: "verify_api_error",
      transactionId,
      payload: redactPaymentPayload({ error: error instanceof Error ? error.message : String(error) }),
    });
    throw error;
  }

  async function logAndReturn(outcome: ReconcileOutcome, userId?: string | null): Promise<ReconcileOutcome> {
    await logPaymentEvent({
      source,
      eventType: "charge.completed",
      outcome: outcome.status,
      userId: userId ?? null,
      txRef: verified.txRef,
      transactionId,
      amountMinor: verified.amountMinor,
      currency: verified.currency,
      payload: redactPaymentPayload({ ...verified, reason: "reason" in outcome ? outcome.reason : undefined }),
    });
    return outcome;
  }

  if (verified.status !== "successful") {
    return logAndReturn({ status: "not_successful", txRef: verified.txRef });
  }

  const parsedRef = parseSubscriptionTxRef(verified.txRef);
  if (!parsedRef) {
    return logAndReturn({ status: "unknown_tx_ref", txRef: verified.txRef });
  }
  const { userId, interval, planId } = parsedRef;

  const seen = await transactionRepo.findByReference(verified.txRef);
  if (seen) {
    return logAndReturn({ status: "already_processed", txRef: verified.txRef }, userId);
  }

  const pricing = getProPricing();
  if (verified.currency !== pricing.currency) {
    return logAndReturn(
      { status: "verification_mismatch", txRef: verified.txRef, reason: `currency ${verified.currency} !== ${pricing.currency}` },
      userId,
    );
  }

  // Every checkout charges exactly one plan's full price — a mid-cycle
  // interval switch queues a full-price period after the current one
  // instead of prorating a partial charge (see nextPeriodStart below), so
  // this is a plain equality check, not a range.
  const expectedAmountMinor = interval === "monthly" ? pricing.monthlyMinor : pricing.yearlyMinor;
  if (verified.amountMinor !== expectedAmountMinor) {
    return logAndReturn(
      {
        status: "verification_mismatch",
        txRef: verified.txRef,
        reason: `amountMinor ${verified.amountMinor} !== ${expectedAmountMinor} expected for ${interval}`,
      },
      userId,
    );
  }

  // renewalMode is derived from what Flutterwave says actually happened
  // (paymentType), never from which checkout path we intended — the "other
  // methods" checkout excludes "card" from its payment_options specifically
  // so this can never come back AUTO without a real Payment Plan behind it.
  const renewalMode = verified.paymentType === "card" ? "AUTO" : "MANUAL";
  // A manual charge has no Payment Plan, so its tx_ref carries the "0"
  // sentinel rather than a real plan id — never store that as if it were one.
  const resolvedProviderPlanId = renewalMode === "AUTO" ? planId : null;

  // The findByReference check above closes most of the window, but the
  // webhook and the redirect callback can both call reconcileTransaction
  // for the same payment nearly simultaneously — the check-then-write gap
  // between them is real. Transaction.reference has a DB-level unique
  // constraint as the actual guard (same pattern as signup's idempotency
  // key, src/auth/idempotency.ts): if a concurrent call already committed
  // first, this one's tx.transaction.create throws P2002, the whole
  // transaction rolls back cleanly, and that's reported as already handled.
  try {
    const grantResult = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return null;

      // Queue after exhaustion: if a still-running subscription already
      // exists (switching interval, or resubscribing after cancelling
      // before the paid-for period ended), this new period starts right
      // after it ends rather than from now — no credit/refund math needed,
      // since nothing is wasted or overlapped either way. A fresh subscribe,
      // or resubscribing after everything already lapsed, starts from now.
      const existingSubscription = await tx.subscription.findUnique({ where: { userId } });
      const periodStart = nextPeriodStart(existingSubscription, new Date());
      const currentPeriodEnd = new Date(periodStart.getTime() + BILLING_PERIOD_DAYS[interval] * 24 * 60 * 60 * 1000);

      // Captured before the upsert overwrites it — this is the plan (if any)
      // this new one is superseding, cancelled below once the grant commits.
      const previousProviderPlanId = existingSubscription?.providerPlanId ?? null;

      await tx.user.update({ where: { id: userId }, data: { plan: "PRO" } });
      await tx.subscription.upsert({
        where: { userId },
        create: { userId, status: "ACTIVE", renewalMode, currentPeriodEnd, cancelAtPeriodEnd: false, providerPlanId: resolvedProviderPlanId, providerRef: verified.txRef, providerCustomerEmail: verified.customerEmail },
        // cancelAtPeriodEnd resets to false here deliberately: a successful
        // charge — whether the user resubscribing on purpose, or an AUTO
        // renewal Flutterwave pushed through despite a prior local
        // cancellation (see the field's doc comment in schema.prisma) —
        // means the subscription actually continued, so a stale
        // cancellation flag from before this charge no longer applies.
        update: { status: "ACTIVE", renewalMode, currentPeriodEnd, cancelAtPeriodEnd: false, providerPlanId: resolvedProviderPlanId, providerRef: verified.txRef, providerCustomerEmail: verified.customerEmail },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: "SUBSCRIPTION_CHARGE",
          amountMinor: verified.amountMinor,
          currency: verified.currency,
          reference: verified.txRef,
          interval: toDbInterval(interval),
        },
      });
      return { user, currentPeriodEnd, previousProviderPlanId };
    });

    if (!grantResult) {
      return logAndReturn({ status: "user_not_found", userId }, userId);
    }

    if (renewalMode === "MANUAL") {
      const { user: grantedUser, currentPeriodEnd } = grantResult;
      sendManualRenewalReminderEmail(grantedUser.email, currentPeriodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })).catch((err) => {
        console.error("Failed to send manual renewal reminder email", { userId, error: err instanceof Error ? err.message : err });
      });
    }

    // Cancel the superseded plan's Flutterwave-side subscription now that
    // the new one is confirmed committed — only after, never before,
    // otherwise an abandoned/failed new checkout could cancel a perfectly
    // good still-running one for nothing. Only when there was an old plan
    // and it actually changed (a same-interval card renewal reuses the same
    // plan id, and a fresh/manual charge has no plan at all — nothing to
    // cancel either way). Best-effort: a failure here doesn't undo the grant
    // that just succeeded — it's logged so it can be followed up, same
    // principle as the manual renewal reminder email above.
    const { previousProviderPlanId } = grantResult;
    if (previousProviderPlanId && previousProviderPlanId !== resolvedProviderPlanId) {
      try {
        await cancelActiveSubscriptionsForPlan(previousProviderPlanId);
        await logPaymentEvent({ source, eventType: "subscription.old_plan_cancelled", outcome: "cancelled", userId, payload: redactPaymentPayload({ previousProviderPlanId, newProviderPlanId: resolvedProviderPlanId }) });
      } catch (error) {
        console.error("Failed to cancel superseded Flutterwave Payment Plan", { userId, previousProviderPlanId, error: error instanceof Error ? error.message : error });
        await logPaymentEvent({ source, eventType: "subscription.old_plan_cancelled", outcome: "cancel_failed", userId, payload: redactPaymentPayload({ previousProviderPlanId, newProviderPlanId: resolvedProviderPlanId, error: error instanceof Error ? error.message : String(error) }) });
      }
    }

    return logAndReturn({ status: "granted", userId, txRef: verified.txRef }, userId);
  } catch (error) {
    if (isUniqueConstraintError(error, "reference")) {
      return logAndReturn({ status: "already_processed", txRef: verified.txRef }, userId);
    }
    throw error;
  }
}

// Nothing will renew a MANUAL subscription (no Payment Plan behind it) or
// one the user cancelled (cancelAtPeriodEnd), so once its period lapses with
// no new payment it must be actively downgraded, not left ACTIVE forever.
// There's no scheduler in this app (worker/index.ts is a stub), so this runs
// lazily: called from GET /api/billing/status, which every authenticated
// page hits on load via the renewal banner, and from the checkout route so
// stale ACTIVE state can't be mistaken for a still-running period to queue
// after. Returns whether it actually expired something.
export async function expireSubscriptionIfDue(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription || !isSubscriptionExpired(subscription, new Date())) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { plan: "FREE" } });
    await tx.subscription.update({ where: { userId }, data: { status: "CANCELED" } });
  });

  return true;
}
