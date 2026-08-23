import { config } from "@/src/config";

// Flutterwave v3 adapter. This module is the only place that talks to
// Flutterwave (AGENTS.md section 4 provider-boundary pattern, mirrored from
// src/services/storage and src/services/ai) — call sites never build a
// Flutterwave request or read a raw Flutterwave response shape.
//
// Only the Standard hosted-checkout flow is used: the customer is
// redirected to a Flutterwave-hosted page, so raw card data never reaches
// this server (developer.flutterwave.com/v3.0.0/docs/flutterwave-standard-1).
// Recurring billing rides on Flutterwave's native Payment Plans — once a
// charge is made against a plan id, Flutterwave auto-charges the same card
// each cycle and fires a webhook per charge
// (developer.flutterwave.com/v3.0.0/docs/payment-plans-1).

function billingConfig() {
  const { secretKey } = config.billing.flutterwave;
  if (!secretKey) {
    throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");
  }
  return config.billing.flutterwave;
}

async function flutterwaveRequest<T>(path: string, init: RequestInit): Promise<T> {
  const { apiBaseUrl, secretKey } = billingConfig();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const body = (await response.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
  if (!response.ok || body?.status === "error") {
    throw new Error(`Flutterwave request to ${path} failed (${response.status}): ${body?.message ?? "unknown error"}`);
  }
  if (body?.data === undefined) {
    throw new Error(`Flutterwave request to ${path} returned no data`);
  }
  return body.data;
}

export type BillingInterval = "monthly" | "yearly";

// One Payment Plan per user, never one shared per interval across every
// customer (that was the earlier design — see cancelActiveSubscriptionsForPlan's
// doc comment for why it made cancellation unsafe). Always creates a fresh
// plan; the caller (checkout/route.ts) decides whether to reuse a
// previously-created one (Subscription.providerPlanId) or call this again —
// a real interval or price change needs a new plan object regardless, since
// a Payment Plan's amount/interval are fixed at creation.
export async function createUserPaymentPlan(input: { userId: string; interval: BillingInterval; amountMinor: number }): Promise<string> {
  const plan = await flutterwaveRequest<{ id: number }>("/payment-plans", {
    method: "POST",
    body: JSON.stringify({
      name: `PRO ${input.interval} — ${input.userId}`,
      amount: input.amountMinor / 100,
      interval: input.interval,
    }),
  });
  return String(plan.id);
}

export type StandardCheckout = { link: string };

// amountMinor is kobo (money-and-billing.md rule 1); Flutterwave's v3 API
// expects a major-unit decimal, so the conversion happens here, once, at
// the boundary (flutterwave-billing skill step 4).
//
// paymentPlanId is optional on purpose: attaching one forces the checkout
// to card-only (developer.flutterwave.com/v3.0.0/docs/payment-plans-1 —
// "the payment method will automatically be fixed to card"), which is
// exactly what auto-renewing subscriptions need. Omit it to offer other
// methods (transfer, USSD, ...) via paymentOptions instead — those charges
// are one-off; Flutterwave has no way to re-charge them next cycle (R32).
export async function createStandardCheckout(input: {
  txRef: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  redirectUrl: string;
  paymentPlanId?: string;
  paymentOptions: string;
}): Promise<StandardCheckout> {
  const data = await flutterwaveRequest<{ link: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: input.amountMinor / 100,
      currency: input.currency,
      redirect_url: input.redirectUrl,
      payment_options: input.paymentOptions,
      ...(input.paymentPlanId ? { payment_plan: input.paymentPlanId } : {}),
      customer: { email: input.customerEmail, name: input.customerName },
    }),
  });

  return { link: data.link };
}

export type ProviderSubscription = { id: number; amount: number; status: string; plan: number };

export async function cancelProviderSubscription(id: number): Promise<void> {
  await flutterwaveRequest<{ status: string }>(`/subscriptions/${id}/cancel`, { method: "PUT" });
}

// Cancels every active Flutterwave subscription under one Payment Plan.
// Safe ONLY because planId here must always be a plan created exclusively
// for one user via createUserPaymentPlan — never a plan shared across
// multiple users. Confirmed live against the Flutterwave sandbox
// (2026-08-23): filtering /v3/subscriptions by the OLD shared monthly plan
// id returned 8 active subscriptions across several different customer ids
// (all recorded under a near-identical synthetic email) — exactly the
// failure mode that made the earlier email-based lookup
// (listActiveSubscriptionsForEmail, since removed) cancel a different
// customer's unrelated subscription during testing. A per-user plan doesn't
// have that problem: no other user was ever given this plan id to check out
// with, so anything found here is this user's own (possibly more than one,
// e.g. a duplicate checkout — cancelling all of them is still correct).
// Does not paginate past the first page of results; fine for a per-user
// plan's small subscription count, but would need to if that assumption
// ever changes.
export async function cancelActiveSubscriptionsForPlan(planId: string): Promise<void> {
  const data = await flutterwaveRequest<ProviderSubscription[]>(`/subscriptions?plan=${encodeURIComponent(planId)}`, { method: "GET" });
  const active = data.filter((subscription) => subscription.status === "active");
  await Promise.all(active.map((subscription) => cancelProviderSubscription(subscription.id)));
}

export type VerifiedTransaction = {
  status: string;
  amountMinor: number;
  currency: string;
  txRef: string;
  paymentType: string;
  customerEmail: string;
};

// Server-side re-verification — used by the redirect callback and, more
// importantly, is the thing that must be true before granting anything
// (security.md rule 7: never trust a client-side "payment succeeded" signal).
// paymentType ("card", "banktransfer", "ussd", ...) is what actually
// happened on Flutterwave's side — the source of truth for whether this
// charge can auto-renew, regardless of which options we offered.
export async function verifyTransaction(transactionId: string): Promise<VerifiedTransaction> {
  const data = await flutterwaveRequest<{
    status: string;
    amount: number;
    currency: string;
    tx_ref: string;
    payment_type: string;
    customer: { email: string };
  }>(`/transactions/${transactionId}/verify`, { method: "GET" });

  return {
    status: data.status,
    amountMinor: Math.round(data.amount * 100),
    currency: data.currency,
    txRef: data.tx_ref,
    paymentType: data.payment_type,
    customerEmail: data.customer.email,
  };
}
