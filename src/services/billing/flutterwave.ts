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

// Payment Plans are reusable objects — created once, then referenced by id
// on every checkout for that interval. In-memory cache covers a single
// running process; set FLUTTERWAVE_MONTHLY_PLAN_ID/FLUTTERWAVE_YEARLY_PLAN_ID
// once you've created them for a stable id across restarts and instances.
const planIdCache = new Map<BillingInterval, string>();

export async function getOrCreatePaymentPlanId(interval: BillingInterval, amountMinor: number): Promise<string> {
  const configured = interval === "monthly" ? config.billing.flutterwave.monthlyPlanId : config.billing.flutterwave.yearlyPlanId;
  if (configured) return configured;

  const cached = planIdCache.get(interval);
  if (cached) return cached;

  const plan = await flutterwaveRequest<{ id: number }>("/payment-plans", {
    method: "POST",
    body: JSON.stringify({
      name: `PRO (${interval})`,
      amount: amountMinor / 100,
      interval,
    }),
  });

  const planId = String(plan.id);
  planIdCache.set(interval, planId);
  console.warn(`Created Flutterwave payment plan for ${interval} billing: ${planId}. Pin it via FLUTTERWAVE_${interval.toUpperCase()}_PLAN_ID to avoid recreating it on every restart.`);
  return planId;
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
// are one-off; Flutterwave has no way to re-charge them next cycle.
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

export type ProviderSubscription = { id: number; amount: number; status: string };

// DO NOT filter/cancel by email alone and assume the results all belong to
// one app user. Confirmed live against the Flutterwave sandbox: the
// customer email it records can be a shared synthetic value reused across
// DIFFERENT real app users (not derived from whatever email we submit at
// checkout). An earlier version of this module had a
// cancelStaleProviderSubscriptions(email, amount) helper built on this
// endpoint for exactly that purpose — during live testing it cancelled a
// different customer's unrelated active subscription and was removed. Only
// cancel a ProviderSubscription.id you already know for certain belongs to
// the current user (e.g. one they just confirmed on a Flutterwave-hosted
// page), never one discovered via this list.
export async function listActiveSubscriptionsForEmail(email: string): Promise<ProviderSubscription[]> {
  const data = await flutterwaveRequest<ProviderSubscription[]>(`/subscriptions?email=${encodeURIComponent(email)}`, { method: "GET" });
  return data.filter((subscription) => subscription.status === "active");
}

export async function cancelProviderSubscription(id: number): Promise<void> {
  await flutterwaveRequest<{ status: string }>(`/subscriptions/${id}/cancel`, { method: "PUT" });
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
