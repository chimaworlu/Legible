"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { daysUntil } from "@/src/domain/subscription";

const RENEWAL_WARNING_WINDOW_DAYS = 7;

const containerStyle: React.CSSProperties = {
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderLeft: "4px solid var(--color-roles-tertiary)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-base-spacing)",
  marginBottom: "var(--spacing-collection-large-spacing)",
  boxShadow: "var(--effect-soft-shadow)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "var(--spacing-collection-base-spacing)",
};

const textStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  color: "var(--color-roles-on-surface)",
};

const linkStyle: React.CSSProperties = {
  flexShrink: 0,
  color: "var(--color-roles-primary)",
  fontFamily: "var(--typography-label-large-font-family)",
  fontWeight: "var(--typography-label-large-font-weight)",
  textDecoration: "none",
};

type BillingStatus = {
  plan: string;
  subscription: { status: string; renewalMode: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean } | null;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ManualRenewalBanner() {
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setStatus(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subscription = status?.subscription;
  const isManual = subscription?.status === "ACTIVE" && subscription.renewalMode === "MANUAL";
  const isCancelling = subscription?.status === "ACTIVE" && subscription.cancelAtPeriodEnd;
  if (!subscription || (!isManual && !isCancelling)) {
    return null;
  }

  const periodEnd = new Date(subscription.currentPeriodEnd);
  const daysLeft = daysUntil(periodEnd, new Date());
  const isUrgent = daysLeft <= RENEWAL_WARNING_WINDOW_DAYS;

  // A cancelled-but-still-AUTO plan only gets this heads-up once it's
  // genuinely close to lapsing — the user already saw and confirmed the
  // cancellation when they did it, so a reminder a year out is just noise.
  // A MANUAL plan keeps the persistent reminder regardless of how far out
  // it is, since nothing else will ever prompt the user to renew it.
  if (isCancelling && !isManual && !isUrgent) {
    return null;
  }

  const reason = isCancelling ? "is set to end" : "renews manually";

  return (
    <div role="status" style={containerStyle}>
      <span style={textStyle}>
        {isUrgent
          ? `Your PRO plan ${reason} and ${daysLeft <= 0 ? "has expired" : `expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`} (${formatDate(periodEnd)}). Check out again to keep it active.`
          : `Your PRO plan ${reason} — active until ${formatDate(periodEnd)}.`}
      </span>
      <Link href="/checkout?interval=monthly" style={linkStyle}>
        Renew now
      </Link>
    </div>
  );
}
