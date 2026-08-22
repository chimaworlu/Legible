import { z } from "zod";
import { prisma } from "@/src/db/client";
import { userRepo } from "@/src/db/repositories/user";
import { isValidFlutterwaveSignature } from "@/src/services/billing/webhookSignature";
import { reconcileTransaction, userIdFromTxRef } from "@/src/services/billing/reconcile";
import { logPaymentEvent, redactPaymentPayload } from "@/src/services/billing/paymentLog";
import { config } from "@/src/config";

// developer.flutterwave.com/v3.0.0/docs/webhooks — two shapes handled here:
// { event: "charge.completed", data: { id, tx_ref, status, amount, currency, ... } }
// { event: "subscription.cancelled", data: { customer: { email }, ... } }
const baseEventSchema = z.object({ event: z.string() });

const chargeCompletedSchema = z.object({
  event: z.literal("charge.completed"),
  data: z.object({
    id: z.number(),
    tx_ref: z.string(),
    status: z.string(),
    amount: z.number(),
    currency: z.string(),
  }),
});

const subscriptionCancelledSchema = z.object({
  event: z.literal("subscription.cancelled"),
  data: z.object({
    customer: z.object({ email: z.string() }),
  }),
});

async function handleChargeCompleted(data: z.infer<typeof chargeCompletedSchema>["data"]): Promise<Response> {
  const userId = userIdFromTxRef(data.tx_ref);
  if (!userId) {
    console.error("Flutterwave webhook tx_ref did not match the expected shape", { txRef: data.tx_ref });
    await logPaymentEvent({
      source: "WEBHOOK",
      eventType: "charge.completed",
      outcome: "unknown_tx_ref",
      txRef: data.tx_ref,
      transactionId: String(data.id),
      amountMinor: Math.round(data.amount * 100),
      currency: data.currency,
    });
    return new Response(null, { status: 200 });
  }

  if (data.status !== "successful") {
    // A failed charge — most commonly a declined renewal. Flutterwave
    // retries 3x over ~90 minutes before it gives up and later fires
    // subscription.cancelled; in the meantime we mark the existing
    // subscription PAST_DUE (a grace period, not an immediate downgrade —
    // flutterwave-billing skill step 5). No Transaction row: no money moved.
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing && existing.status === "ACTIVE") {
      await prisma.subscription.update({ where: { userId }, data: { status: "PAST_DUE" } });
    }
    await logPaymentEvent({
      source: "WEBHOOK",
      eventType: "charge.completed",
      outcome: "charge_failed",
      userId,
      txRef: data.tx_ref,
      transactionId: String(data.id),
      amountMinor: Math.round(data.amount * 100),
      currency: data.currency,
    });
    return new Response(null, { status: 200 });
  }

  // reconcileTransaction independently re-verifies via a fresh authenticated
  // call to Flutterwave (security.md rule 7) before granting anything — the
  // webhook signature only proves the request came from Flutterwave, not
  // that this specific payload wasn't altered. It also writes its own
  // PaymentLog row for the outcome, since it's the single funnel both this
  // webhook and the redirect callback go through.
  try {
    const outcome = await reconcileTransaction(String(data.id), "WEBHOOK");
    if (outcome.status === "verification_mismatch") {
      console.error("Flutterwave webhook did not match its own verification", outcome);
    } else if (outcome.status === "unknown_tx_ref" || outcome.status === "user_not_found") {
      console.error("Flutterwave webhook could not be reconciled", outcome);
    }
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Failed to reconcile Flutterwave webhook", { txRef: data.tx_ref, error: error instanceof Error ? error.message : error });
    return new Response(null, { status: 500 }); // transient — let Flutterwave retry
  }
}

async function handleSubscriptionCancelled(data: z.infer<typeof subscriptionCancelledSchema>["data"]): Promise<Response> {
  const user = await userRepo.findByEmail(data.customer.email);
  if (!user) {
    console.error("Flutterwave subscription.cancelled for an unknown email");
    await logPaymentEvent({ source: "WEBHOOK", eventType: "subscription.cancelled", outcome: "unknown_email" });
    return new Response(null, { status: 200 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { plan: "FREE" } });
    await tx.subscription.updateMany({ where: { userId: user.id }, data: { status: "CANCELED" } });
  });

  await logPaymentEvent({ source: "WEBHOOK", eventType: "subscription.cancelled", outcome: "cancelled", userId: user.id });

  return new Response(null, { status: 200 });
}

export async function POST(req: Request) {
  // Read the raw body once, up front, so a rejected/malformed request still
  // gets logged with whatever we received — the audit trail shouldn't have
  // a blind spot exactly where a real attack or a misconfigured secret
  // would show up.
  const rawBody = await req.text();
  let parsedJson: unknown = null;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    // leave parsedJson null; still worth logging that something arrived
  }
  const eventTypeForLog = typeof (parsedJson as { event?: unknown })?.event === "string" ? (parsedJson as { event: string }).event : "unknown";

  // 1. Verify the signature before anything else runs (security.md rule 5).
  // v3 webhooks are a direct `verif-hash` header comparison, not HMAC.
  const signatureHeader = req.headers.get("verif-hash");
  if (!isValidFlutterwaveSignature(signatureHeader, config.billing.flutterwave.secretHash)) {
    console.warn("Unverified Flutterwave webhook dropped");
    await logPaymentEvent({
      source: "WEBHOOK",
      eventType: eventTypeForLog,
      outcome: "rejected_signature",
      payload: parsedJson !== null ? redactPaymentPayload(parsedJson) : undefined,
    });
    return new Response(null, { status: 401 });
  }

  // 2. Validate shape.
  const base = baseEventSchema.safeParse(parsedJson);
  if (!base.success) {
    console.error("Flutterwave webhook payload failed validation", { error: base.error.message });
    await logPaymentEvent({
      source: "WEBHOOK",
      eventType: eventTypeForLog,
      outcome: "invalid_shape",
      payload: parsedJson !== null ? redactPaymentPayload(parsedJson) : undefined,
    });
    return new Response(null, { status: 400 });
  }

  // 3. Act on the event types we understand; ack anything else so
  // Flutterwave doesn't retry it forever.
  if (base.data.event === "charge.completed") {
    const parsed = chargeCompletedSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("Flutterwave charge.completed payload failed validation", { error: parsed.error.message });
      await logPaymentEvent({ source: "WEBHOOK", eventType: "charge.completed", outcome: "invalid_shape", payload: redactPaymentPayload(parsedJson) });
      return new Response(null, { status: 400 });
    }
    return handleChargeCompleted(parsed.data.data);
  }

  if (base.data.event === "subscription.cancelled") {
    const parsed = subscriptionCancelledSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("Flutterwave subscription.cancelled payload failed validation", { error: parsed.error.message });
      await logPaymentEvent({ source: "WEBHOOK", eventType: "subscription.cancelled", outcome: "invalid_shape", payload: redactPaymentPayload(parsedJson) });
      return new Response(null, { status: 400 });
    }
    return handleSubscriptionCancelled(parsed.data.data);
  }

  await logPaymentEvent({ source: "WEBHOOK", eventType: base.data.event, outcome: "unhandled_event_type", payload: redactPaymentPayload(parsedJson) });
  return new Response(null, { status: 200 });
}
