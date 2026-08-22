import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/src/db/client";
import { subscriptionRepo } from "@/src/db/repositories/subscription";
import { config } from "@/src/config";
import { checkRateLimit, rateLimitedResponse } from "@/src/services/rateLimit";
import { logPaymentEvent } from "@/src/services/billing/paymentLog";

// User-initiated cancellation from the billing modal — distinct from
// handleSubscriptionCancelled in the webhook route, which only reacts to
// Flutterwave telling us a subscription was already cancelled on their side.
//
// This does NOT also cancel the Flutterwave-side recurring subscription.
// It was originally written to look it up by providerCustomerEmail and
// cancel every active subscription found under that email, but live testing
// against the sandbox proved Flutterwave can reuse the same synthetic
// customer email across DIFFERENT real app users — that lookup cancelled a
// different customer's unrelated active subscription during testing.
// Removed rather than patched: there is currently no field that reliably
// identifies which Flutterwave subscription id belongs to this one grant
// (see providerCustomerEmail's doc comment in schema.prisma). Until that
// exists, the safe behavior is to downgrade locally only — the card may
// still be auto-charged by Flutterwave next cycle, which needs a support
// follow-up or a manual cancel in the Flutterwave dashboard for now.
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

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { plan: "FREE" } });
    await tx.subscription.update({ where: { userId }, data: { status: "CANCELED" } });
  });

  await logPaymentEvent({ source: "DASHBOARD", eventType: "subscription.cancel_requested", outcome: "cancelled", userId });

  return Response.json({ status: "cancelled" });
}
