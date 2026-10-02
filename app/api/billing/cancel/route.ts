import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { subscriptionRepo } from "@/src/db/repositories/subscription";
import { prisma } from "@/src/db/client";
import { config } from "@/src/config";
import { checkRateLimit, rateLimitedResponse } from "@/src/services/rateLimit";
import { cancelActiveSubscriptionsForPlan } from "@/src/services/billing/flutterwave";
import { logPaymentEvent } from "@/src/services/billing/paymentLog";

// User-initiated cancellation from the billing modal — distinct from
// handleSubscriptionCancelled in the webhook route, which only reacts to
// Flutterwave telling us a subscription was already cancelled on their side.
//
// This stops short of an immediate downgrade: the period is already paid
// for, so access continues until currentPeriodEnd (cancelAtPeriodEnd flips
// the lazy expiry check in expireSubscriptionIfDue, called from GET
// /api/billing/status, to actually downgrade once that date passes — see
// its doc comment).
//
// If the subscription has a providerPlanId (a Flutterwave Payment Plan
// created exclusively for this user — see createUserPaymentPlan in
// flutterwave.ts), this also cancels it on Flutterwave's side, so the card
// genuinely won't be charged again. Older rows have no providerPlanId (they
// predate that scheme, or were originally written to look the provider
// subscription up by providerCustomerEmail — live testing against the
// sandbox proved Flutterwave can reuse the same synthetic customer email
// across DIFFERENT real app users, and that lookup cancelled a different
// customer's unrelated subscription during testing). For those, an AUTO
// subscription's card may still be charged by Flutterwave on its own
// schedule despite this — surfaced honestly in the response rather than
// silently promised away, so the UI can warn the user.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const rateLimit = await checkRateLimit(`cancel:user:${userId}`, config.rateLimits.cancelPerUser);
  if (!rateLimit.allowed) {
    return rateLimitedResponse("Too many attempts. Please wait a few minutes and try again.");
  }

  const subscription = await subscriptionRepo.findByUserId(userId);
  if (!subscription || subscription.status !== "ACTIVE") {
    return Response.json({ message: "No active subscription to cancel." }, { status: 400 });
  }
  if (subscription.cancelAtPeriodEnd) {
    return Response.json({ message: "Your subscription is already set to end and won't renew." }, { status: 400 });
  }

  let providerCancelled = false;
  if (subscription.renewalMode === "AUTO" && subscription.providerPlanId) {
    try {
      await cancelActiveSubscriptionsForPlan(subscription.providerPlanId);
      providerCancelled = true;
    } catch (error) {
      // Best-effort: local cancellation still proceeds below regardless —
      // the user's access is correctly bounded by currentPeriodEnd either
      // way, this only affects whether Flutterwave might still auto-charge.
      console.error("Failed to cancel Flutterwave-side subscription", { userId, providerPlanId: subscription.providerPlanId, error: error instanceof Error ? error.message : error });
    }
  }

  await prisma.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd: true } });

  await logPaymentEvent({
    source: "DASHBOARD",
    eventType: "subscription.cancel_requested",
    outcome: providerCancelled ? "cancel_at_period_end_provider_cancelled" : "cancel_at_period_end",
    userId,
  });

  return Response.json({
    status: "cancel_at_period_end",
    currentPeriodEnd: subscription.currentPeriodEnd,
    // The UI should show this as a caveat, not a guarantee it silently drops
    // — only true when there was nothing to cancel provider-side, or the
    // attempt failed.
    autoRenewalMayStillCharge: subscription.renewalMode === "AUTO" && !providerCancelled,
  });
}
