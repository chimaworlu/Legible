"use client";

import { useState } from "react";
import type { BillingInterval } from "@/src/domain/billing";
import { UpgradePlanModal } from "./UpgradePlanModal";

const triggerButtonStyle: React.CSSProperties = {
  backgroundColor: "var(--color-roles-surface-container-high)",
  color: "var(--color-roles-on-surface-variant)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.375rem",
  padding: "0.5rem 1rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.875rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  cursor: "pointer",
};

// A badge, not a call-to-action — an already-PRO user shouldn't be told to
// "Upgrade". Still opens the same modal on click (to switch interval, resume,
// or check plan details), so only the label/style differ from the FREE case.
const proBadgeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
  backgroundColor: "var(--color-roles-primary-container)",
  color: "var(--color-roles-on-primary-container)",
  border: "1px solid transparent",
  borderRadius: "2rem",
  padding: "0.5rem 1rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.875rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  cursor: "pointer",
};

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.85 6.24 6.65.66-5.02 4.6 1.45 6.7L12 17.3l-5.93 3.4 1.45-6.7-5.02-4.6 6.65-.66L12 2.5z" />
    </svg>
  );
}

export function UpgradePlanButton({
  plan,
  currentInterval,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: {
  plan: string;
  currentInterval?: BillingInterval | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isPro = plan === "PRO";

  return (
    <>
      <button type="button" style={isPro ? proBadgeStyle : triggerButtonStyle} onClick={() => setOpen(true)}>
        {isPro && <StarIcon />}
        <span className="upgrade-plan-full">{isPro ? "PRO Plan" : "Upgrade Plan"}</span>
        <span className="upgrade-plan-short">{isPro ? "PRO" : "Upgrade"}</span>
      </button>

      {open && (
        <UpgradePlanModal
          plan={plan}
          currentInterval={currentInterval}
          currentPeriodEnd={currentPeriodEnd}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
