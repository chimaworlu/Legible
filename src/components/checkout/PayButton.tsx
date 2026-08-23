"use client";

import { useState } from "react";
import type { BillingInterval } from "@/src/domain/billing";

type Method = "card" | "other";
type RenewalMode = "AUTO" | "MANUAL";

function formatLongDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const toggleGroupStyle: React.CSSProperties = {
  display: "flex",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.5rem",
  padding: "0.25rem",
  gap: "0.25rem",
};

function toggleButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    border: "none",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    cursor: "pointer",
    backgroundColor: active ? "var(--color-roles-primary)" : "transparent",
    color: active ? "var(--color-roles-on-primary)" : "var(--color-roles-on-surface-variant)",
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.875rem",
    fontWeight: "var(--typography-label-large-font-weight)",
  };
}

const hintStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
};

function payButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: "0.375rem",
    backgroundColor: "var(--color-roles-primary)",
    color: "var(--color-roles-on-primary)",
    padding: "0.75rem 1rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.9375rem",
    fontWeight: "var(--typography-label-large-font-weight)",
    width: "100%",
  };
}

const errorStyle: React.CSSProperties = {
  color: "var(--color-roles-error)",
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
};

const warningBoxStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  padding: "0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--color-roles-error)",
  backgroundColor: "var(--color-roles-error-container)",
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  color: "var(--color-roles-on-error-container)",
};

const warningCheckboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.5rem",
  cursor: "pointer",
};

export function PayButton({
  interval,
  label,
  currentInterval = null,
  renewalMode = null,
  hasProviderPlan = false,
  queuedStartDate = null,
}: {
  interval: BillingInterval;
  label: string;
  currentInterval?: BillingInterval | null;
  renewalMode?: RenewalMode | null;
  // True when the current subscription has its own Flutterwave Payment Plan
  // (see Subscription.providerPlanId) — that plan gets safely cancelled once
  // this new charge is confirmed (reconcileTransaction), so there's no
  // double-charge risk to warn about even while switching/resuming.
  hasProviderPlan?: boolean;
  // Set when there's a still-running subscription this new period will
  // queue after (see nextPeriodStart) — null means a fresh charge starting
  // now (first subscribe, or resubscribing after everything already lapsed).
  queuedStartDate?: Date | null;
}) {
  const [method, setMethod] = useState<Method>("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [doubleChargeWarning, setDoubleChargeWarning] = useState("");
  const [acknowledgedDoubleCharge, setAcknowledgedDoubleCharge] = useState(false);

  // Only a legacy AUTO subscription with no providerPlanId carries real
  // risk — Flutterwave gives no safe way to identify and cancel which of
  // its subscriptions belongs to this user on the old shared-plan scheme
  // (see the doc comment in app/api/billing/checkout/route.ts). Anyone with
  // a providerPlanId gets it cancelled automatically and safely instead.
  const hasDoubleChargeRisk = queuedStartDate != null && renewalMode === "AUTO" && !hasProviderPlan;

  const requiresAcknowledgement = (hasDoubleChargeRisk || doubleChargeWarning !== "") && !acknowledgedDoubleCharge;

  async function handlePay() {
    if (submitting || requiresAcknowledgement) return;
    setSubmitting(true);
    setError("");
    setDoubleChargeWarning("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval, method, confirmDoubleCharge: acknowledgedDoubleCharge }),
      });
      const body = (await res.json().catch(() => null)) as
        | { redirectUrl?: string; message?: string; code?: string }
        | null;

      if (!res.ok || !body?.redirectUrl) {
        // Defensive fallback: the server independently re-checks this risk
        // (never trust client-only gating for a money-affecting decision),
        // so surface it the same way even if our props were stale.
        if (body?.code === "DOUBLE_CHARGE_RISK") {
          setDoubleChargeWarning(body.message ?? "Switching plans may charge your card twice — see below.");
        } else {
          setError(body?.message ?? "Checkout could not be started. Please try again.");
        }
        return;
      }

      window.location.href = body.redirectUrl;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeWarning = hasDoubleChargeRisk
    ? `You have an active auto-renewing ${currentInterval ?? "PRO"} subscription${queuedStartDate ? ` (running until ${formatLongDate(queuedStartDate)})` : ""}. We can't automatically cancel it on our end, so your card may still be billed on its own schedule even after this.`
    : doubleChargeWarning;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={toggleGroupStyle} role="radiogroup" aria-label="Payment method">
        <button type="button" role="radio" aria-checked={method === "card"} onClick={() => setMethod("card")} style={toggleButtonStyle(method === "card")}>
          Card
        </button>
        <button type="button" role="radio" aria-checked={method === "other"} onClick={() => setMethod("other")} style={toggleButtonStyle(method === "other")}>
          Transfer / USSD / Other
        </button>
      </div>
      <span style={hintStyle}>
        {method === "card"
          ? "Renews automatically each billing period."
          : "One-time payment — you'll need to check out again next period to keep PRO active."}
      </span>

      {queuedStartDate && (
        <span style={hintStyle}>
          You keep your current plan until it ends — this one starts right after, on {formatLongDate(queuedStartDate)}. No paid time is lost.
        </span>
      )}

      {activeWarning && (
        <div role="alert" style={warningBoxStyle}>
          <span>{activeWarning}</span>
          <label style={warningCheckboxRowStyle}>
            <input
              type="checkbox"
              checked={acknowledgedDoubleCharge}
              onChange={(event) => setAcknowledgedDoubleCharge(event.target.checked)}
            />
            <span>I understand and want to continue anyway.</span>
          </label>
        </div>
      )}

      <button type="button" style={payButtonStyle(submitting || requiresAcknowledgement)} onClick={handlePay} disabled={submitting || requiresAcknowledgement}>
        {submitting ? "Redirecting to Flutterwave…" : label}
      </button>
      {error && (
        <span role="alert" style={errorStyle}>
          {error}
        </span>
      )}
    </div>
  );
}
