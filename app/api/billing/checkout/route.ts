import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { userRepo } from "@/src/db/repositories/user";
import { transactionRepo } from "@/src/db/repositories/transaction";
import { getProPricing, intervalForAmountMinor } from "@/src/domain/billing";
import { config } from "@/src/config";
import { createStandardCheckout, getOrCreatePaymentPlanId } from "@/src/services/billing/flutterwave";
import { checkRateLimit, rateLimitedResponse } from "@/src/services/rateLimit";
import { logPaymentEvent, redactPaymentPayload } from "@/src/services/billing/paymentLog";

const checkoutSchema = z.object({
  interval: z.enum(["monthly", "yearly"]),
  // "card" auto-renews (Payment Plan attached, forced to card-only by
  // Flutterwave). "other" offers transfer/USSD/etc. but the subscription
  // won't auto-renew — see RenewalMode in prisma/schema.prisma.
  method: z.enum(["card", "other"]).default("card"),
});

export async function POST(req: Request) {
  // 1. Session first (security.md rule 1).
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const rateLimit = await checkRateLimit(`checkout:user:${userId}`, config.rateLimits.checkoutPerUser);
  if (!rateLimit.allowed) {
    return rateLimitedResponse("Too many checkout attempts. Please wait a few minutes and try again.");
  }

  // 2. Validate input.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  const result = checkoutSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ message: result.error.issues[0].message }, { status: 400 });
  }

  const user = await userRepo.findById(userId);
  if (!user) {
    return Response.json({ message: "Account not found" }, { status: 404 });
  }

  const pricing = getProPricing();
  const { interval, method } = result.data;

  // PRO users are only blocked from re-buying the exact plan they're
  // already on. A different interval is a legitimate switch, but note the
  // superseded recurring subscription is NOT auto-cancelled on Flutterwave's
  // side (see the doc comment on listActiveSubscriptionsForEmail in
  // flutterwave.ts for why that lookup was removed as unsafe) — the old
  // plan may keep auto-charging until it's cancelled manually.
  if (user.plan === "PRO") {
    const latestCharge = await transactionRepo.findLatestSubscriptionCharge(userId);
    const currentInterval = latestCharge?.amountMinor != null ? intervalForAmountMinor(latestCharge.amountMinor) : null;
    if (currentInterval === interval) {
      return Response.json({ message: `You're already on the ${interval} plan.` }, { status: 400 });
    }
  }
  const amountMinor = interval === "monthly" ? pricing.monthlyMinor : pricing.yearlyMinor;

  try {
    // Only the card path attaches a Payment Plan — that's what makes
    // Flutterwave auto-renew it, and it's also what forces the checkout to
    // card-only. The "other" path deliberately excludes "card" from its
    // payment_options so a customer can't slip through with no Payment Plan
    // attached and end up with a DB row that claims AUTO renewal (see
    // reconcileTransaction, which derives renewalMode from the verified
    // payment_type rather than trusting this request's intent).
    const paymentPlanId = method === "card" ? await getOrCreatePaymentPlanId(interval, amountMinor) : undefined;
    const paymentOptions = method === "card" ? config.billing.flutterwave.cardOnlyPaymentOptions : config.billing.flutterwave.manualPaymentOptions;

    // Shape must stay "sub_<userId>_<random>" — the webhook parses the
    // userId back out of this (see userIdFromReference in the webhook route).
    const txRef = `sub_${userId}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    const checkout = await createStandardCheckout({
      txRef,
      amountMinor,
      currency: pricing.currency,
      customerEmail: user.email,
      customerName: user.name ?? undefined,
      redirectUrl: config.billing.flutterwave.redirectUrl,
      paymentPlanId,
      paymentOptions,
    });

    await logPaymentEvent({
      source: "CHECKOUT",
      eventType: "checkout.initiated",
      outcome: "initiated",
      userId,
      txRef,
      amountMinor,
      currency: pricing.currency,
      payload: redactPaymentPayload({ interval, method, redirectUrl: checkout.link }),
    });

    return Response.json({ redirectUrl: checkout.link });
  } catch (error) {
    console.error("Flutterwave checkout failed", { userId, error: error instanceof Error ? error.message : error });
    return Response.json({ message: "Checkout could not be started. Please try again." }, { status: 502 });
  }
}
