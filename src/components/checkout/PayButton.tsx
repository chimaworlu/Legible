"use client";

import { useState } from "react";

type Method = "card" | "other";

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

export function PayButton({ interval, label }: { interval: "monthly" | "yearly"; label: string }) {
  const [method, setMethod] = useState<Method>("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval, method }),
      });
      const body = (await res.json().catch(() => null)) as { redirectUrl?: string; message?: string } | null;

      if (!res.ok || !body?.redirectUrl) {
        setError(body?.message ?? "Checkout could not be started. Please try again.");
        return;
      }

      window.location.href = body.redirectUrl;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

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

      <button type="button" style={payButtonStyle(submitting)} onClick={handlePay} disabled={submitting}>
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
