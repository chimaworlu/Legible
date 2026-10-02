import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { userRepo } from "@/src/db/repositories/user";
import { transactionRepo } from "@/src/db/repositories/transaction";
import { subscriptionRepo } from "@/src/db/repositories/subscription";
import { getProPricing, fromDbInterval } from "@/src/domain/billing";
import { nextPeriodStart } from "@/src/domain/subscription";
import { config } from "@/src/config";
import { createStandardCheckout, createUserPaymentPlan } from "@/src/services/billing/flutterwave";
import { checkRateLimit, rateLimitedResponse } from "@/src/services/rateLimit";
import { logPaymentEvent, redactPaymentPayload } from "@/src/services/billing/paymentLog";
import { expireSubscriptionIfDue } from "@/src/services/billing/reconcile";

const checkoutSchema = z.object({
  interval: z.enum(["monthly", "yearly"]),
  // "card" auto-renews (a Payment Plan is created for it — see
  // createUserPaymentPlan — which is what makes it possible to safely
  // cancel a superseded subscription later; see
  // cancelActiveSubscriptionsForPlan's doc comment). "other" offers
  // transfer/USSD/etc. (R32 — never card-only) but the subscription won't
  // auto-renew — see RenewalMode in prisma/schema.prisma.
  method: z.enum(["card", "other"]).default("card"),
  // Set only after the client has shown the DOUBLE_CHARGE_RISK warning
  // below and the user explicitly chose to proceed anyway. Only still
  // reachable for a legacy AUTO subscription with no providerPlanId (see
  // below) — anyone with one gets their old plan safely cancelled instead.
  confirmDoubleCharge: z.boolean().default(false),
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
  const { interval, method, confirmDoubleCharge } = result.data;
  const amountMinor = interval === "monthly" ? pricing.monthlyMinor : pricing.yearlyMinor;

  let queuedStartDate: Date | null = null;
  // Reuse the existing Payment Plan only when resuming the exact same
  // interval it was created for — a real interval change needs a fresh plan
  // regardless, since a Payment Plan's amount/interval are fixed at creation.
  let reusablePlanId: string | null = null;

  if (user.plan === "PRO") {
    // Correct stale ACTIVE state before deciding anything below — otherwise
    // a subscription whose period already lapsed (but hasn't hit the lazy
    // check in GET /api/billing/status yet) could be mistaken for a
    // still-running one to queue after.
    await expireSubscriptionIfDue(userId);

    const [latestCharge, subscription] = await Promise.all([
      transactionRepo.findLatestSubscriptionCharge(userId),
      subscriptionRepo.findByUserId(userId),
    ]);
    const currentInterval = fromDbInterval(latestCharge?.interval, latestCharge?.amountMinor);

    const now = new Date();
    const periodStart = subscription ? nextPeriodStart(subscription, now) : now;
    const stillRunning = periodStart.getTime() > now.getTime();

    if (stillRunning && subscription) {
      queuedStartDate = periodStart;

      // Blocked only when nothing has changed: same interval, and the
      // current plan isn't set to lapse. If the user cancelled
      // (cancelAtPeriodEnd) and is now paying again for the same interval,
      // that's a legitimate resume, not a pointless repurchase.
      if (currentInterval === interval && !subscription.cancelAtPeriodEnd) {
        return Response.json({ message: `You're already on the ${interval} plan.` }, { status: 400 });
      }

      if (method === "card" && currentInterval === interval && subscription.providerPlanId) {
        reusablePlanId = subscription.providerPlanId;
      }

      // A subscription with a providerPlanId gets its old Flutterwave plan
      // safely cancelled once this new charge is confirmed (see
      // reconcileTransaction) — that plan was created exclusively for this
      // user (createUserPaymentPlan), so there's no risk of touching anyone
      // else's subscription. Only a legacy AUTO row with no providerPlanId
      // (predates that scheme) still carries the real risk: Flutterwave may
      // keep charging the old shared plan regardless of anything done here,
      // whichever method this new checkout uses, since there's no safe way
      // to identify which of its subscriptions is this specific grant's.
      // Block those until explicitly acknowledged.
      if (subscription.renewalMode === "AUTO" && !subscription.providerPlanId && !confirmDoubleCharge) {
        return Response.json(
          {
            code: "DOUBLE_CHARGE_RISK",
            message: `You have an active auto-renewing ${currentInterval ?? "PRO"} subscription (running until ${periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}). We can't automatically cancel it on our end, so your card may still be billed on its own schedule even after this. Continue only if you understand this.`,
          },
          { status: 409 },
        );
      }
    }
  }

  try {
    // Only the card path attaches a Payment Plan — that's what makes
    // Flutterwave auto-renew it, and it's also what forces the checkout to
    // card-only. The "other" path deliberately excludes "card" from its
    // payment_options so a customer can't slip through with no Payment Plan
    // attached and end up with a DB row that claims AUTO renewal (see
    // reconcileTransaction, which derives renewalMode from the verified
    // payment_type rather than trusting this request's intent).
    const paymentPlanId = method === "card" ? reusablePlanId ?? (await createUserPaymentPlan({ userId, interval, amountMinor })) : null;
    const paymentOptions = method === "card" ? config.billing.flutterwave.cardOnlyPaymentOptions : config.billing.flutterwave.manualPaymentOptions;

    // Shape must stay "sub_<userId>_<interval>_<planId>_<random>" —
    // reconcileTransaction parses the userId, granted interval, and Payment
    // Plan id back out of this (see parseSubscriptionTxRef in
    // src/services/billing/reconcile.ts). "0" is the sentinel for "no plan"
    // (the "other" method never has one).
    const txRef = `sub_${userId}_${interval}_${paymentPlanId ?? "0"}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    const checkout = await createStandardCheckout({
      txRef,
      amountMinor,
      currency: pricing.currency,
      customerEmail: user.email,
      customerName: user.name ?? undefined,
      redirectUrl: config.billing.flutterwave.redirectUrl,
      paymentPlanId: paymentPlanId ?? undefined,
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
      payload: redactPaymentPayload({ interval, method, redirectUrl: checkout.link, queuedStartDate, doubleChargeAcknowledged: confirmDoubleCharge }),
    });

    return Response.json({ redirectUrl: checkout.link, amountMinor, queuedStartDate });
  } catch (error) {
    console.error("Flutterwave checkout failed", { userId, error: error instanceof Error ? error.message : error });
    return Response.json({ message: "Checkout could not be started. Please try again." }, { status: 502 });
  }
}
