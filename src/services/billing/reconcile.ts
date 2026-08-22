import { prisma } from "@/src/db/client";
import { transactionRepo } from "@/src/db/repositories/transaction";
import { isUniqueConstraintError } from "@/src/auth/idempotency";
import { verifyTransaction, type VerifiedTransaction } from "./flutterwave";
import { getProPricing } from "@/src/domain/billing";
import { isManualSubscriptionExpired } from "@/src/domain/subscription";
import { sendManualRenewalReminderEmail } from "@/src/email/mailer";
import { logPaymentEvent, redactPaymentPayload } from "./paymentLog";

const SUBSCRIPTION_PERIOD_DAYS = { monthly: 30, yearly: 365 } as const;

// Our checkout route (app/api/billing/checkout) generates tx_ref shaped
// "sub_<userId>_<random>" — userId is a cuid, which never contains an
// underscore, so splitting on the last "_" safely isolates it regardless of
// length.
export function userIdFromTxRef(txRef: string): string | null {
  if (!txRef.startsWith("sub_")) return null;
  const rest = txRef.slice(4);
  const lastUnderscore = rest.lastIndexOf("_");
  if (lastUnderscore <= 0) return null;
  return rest.slice(0, lastUnderscore);
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

  const userId = userIdFromTxRef(verified.txRef);
  if (!userId) {
    return logAndReturn({ status: "unknown_tx_ref", txRef: verified.txRef });
  }

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

  const interval = verified.amountMinor === pricing.monthlyMinor ? "monthly" : verified.amountMinor === pricing.yearlyMinor ? "yearly" : null;
  if (!interval) {
    return logAndReturn(
      { status: "verification_mismatch", txRef: verified.txRef, reason: `amountMinor ${verified.amountMinor} matched no known plan price` },
      userId,
    );
  }

  const currentPeriodEnd = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS[interval] * 24 * 60 * 60 * 1000);

  // renewalMode is derived from what Flutterwave says actually happened
  // (paymentType), never from which checkout path we intended — the "other
  // methods" checkout excludes "card" from its payment_options specifically
  // so this can never come back AUTO without a real Payment Plan behind it.
  const renewalMode = verified.paymentType === "card" ? "AUTO" : "MANUAL";

  // The findByReference check above closes most of the window, but the
  // webhook and the redirect callback can both call reconcileTransaction
  // for the same payment nearly simultaneously — the check-then-write gap
  // between them is real. Transaction.reference has a DB-level unique
  // constraint as the actual guard (same pattern as signup's idempotency
  // key, src/auth/idempotency.ts): if a concurrent call already committed
  // first, this one's tx.transaction.create throws P2002, the whole
  // transaction rolls back cleanly, and that's reported as already handled.
  try {
    const grantedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return null;

      await tx.user.update({ where: { id: userId }, data: { plan: "PRO" } });
      await tx.subscription.upsert({
        where: { userId },
        create: { userId, status: "ACTIVE", renewalMode, currentPeriodEnd, providerRef: verified.txRef, providerCustomerEmail: verified.customerEmail },
        update: { status: "ACTIVE", renewalMode, currentPeriodEnd, providerRef: verified.txRef, providerCustomerEmail: verified.customerEmail },
      });
      await tx.transaction.create({
        data: { userId, type: "SUBSCRIPTION_CHARGE", amountMinor: verified.amountMinor, currency: verified.currency, reference: verified.txRef },
      });
      return user;
    });

    if (!grantedUser) {
      return logAndReturn({ status: "user_not_found", userId }, userId);
    }

    if (renewalMode === "MANUAL") {
      sendManualRenewalReminderEmail(grantedUser.email, currentPeriodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })).catch((err) => {
        console.error("Failed to send manual renewal reminder email", { userId, error: err instanceof Error ? err.message : err });
      });
    }

    return logAndReturn({ status: "granted", userId, txRef: verified.txRef }, userId);
  } catch (error) {
    if (isUniqueConstraintError(error, "reference")) {
      return logAndReturn({ status: "already_processed", txRef: verified.txRef }, userId);
    }
    throw error;
  }
}

// A MANUAL subscription has no Payment Plan behind it — nothing will ever
// charge it again, so once its period lapses with no new payment it must be
// actively downgraded, not left ACTIVE forever. There's no scheduler in
// this app (worker/index.ts is a stub), so this runs lazily: called from
// GET /api/billing/status, which every authenticated page hits on load via
// the renewal banner. Returns whether it actually expired something.
export async function expireManualSubscriptionIfDue(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription || !isManualSubscriptionExpired(subscription, new Date())) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { plan: "FREE" } });
    await tx.subscription.update({ where: { userId }, data: { status: "CANCELED" } });
  });

  return true;
}
