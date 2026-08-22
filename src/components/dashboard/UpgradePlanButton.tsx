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

export function UpgradePlanButton({
  plan,
  currentInterval,
  currentPeriodEnd,
}: {
  plan: string;
  currentInterval?: BillingInterval | null;
  currentPeriodEnd?: Date | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" style={triggerButtonStyle} onClick={() => setOpen(true)}>
        <span className="upgrade-plan-full">Upgrade Plan</span>
        <span className="upgrade-plan-short">Upgrade</span>
      </button>

      {open && (
        <UpgradePlanModal plan={plan} currentInterval={currentInterval} currentPeriodEnd={currentPeriodEnd} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
