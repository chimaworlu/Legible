"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira, getProBenefits, getProPricing, type BillingInterval } from "@/src/domain/billing";

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--spacing-collection-base-spacing)",
  zIndex: 200,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "28rem",
  maxHeight: "calc(100vh - 2 * var(--spacing-collection-base-spacing))",
  overflowY: "auto",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  borderRadius: "0.75rem",
  boxShadow: "var(--effect-medium-shadow)",
  padding: "var(--spacing-collection-large-spacing)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-base-spacing)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const modalTitleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-large-font-family)",
  fontSize: "var(--typography-title-large-font-size)",
  fontWeight: "var(--typography-title-large-font-weight)",
};

const modalSubtitleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
  marginTop: "0.25rem",
};

const closeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: "0.25rem",
  cursor: "pointer",
  color: "var(--color-roles-on-surface-variant)",
  flexShrink: 0,
};

const benefitListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.625rem",
};

const benefitItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.5rem",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface)",
};

const benefitIconStyle: React.CSSProperties = {
  flexShrink: 0,
  color: "var(--color-roles-primary)",
  marginTop: "0.125rem",
};

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
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.1875rem",
  };
}

const toggleTopRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.375rem",
};

function toggleCaptionStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: active ? "var(--color-roles-on-primary)" : "var(--color-roles-on-surface-variant)",
    opacity: 0.85,
  };
}

const savingsBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.0625rem 0.375rem",
  borderRadius: "1rem",
  fontSize: "0.6875rem",
  fontWeight: 700,
  backgroundColor: "var(--color-roles-primary-container)",
  color: "var(--color-roles-on-primary-container)",
};

const priceRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.375rem",
};

const priceAmountStyle: React.CSSProperties = {
  fontFamily: "var(--typography-headline-medium-font-family)",
  fontSize: "var(--typography-headline-medium-font-size)",
  fontWeight: "var(--typography-headline-medium-font-weight)",
};

const priceUnitStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
};

function upgradeButtonStyle(disabled: boolean): React.CSSProperties {
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

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5 9 17.5 20 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The plan-selection step (Monthly vs Yearly, pricing, benefits) shared by
// every entry point that offers an upgrade or a billing-interval switch —
// the header's "Upgrade Plan" trigger and the Billing modal's "Upgrade to
// PRO" button both open this same component, so a new user and an existing
// PRO user land on identical UI (the only difference is currentInterval).
export function UpgradePlanModal({
  plan,
  currentInterval,
  currentPeriodEnd,
  onClose,
}: {
  plan: string;
  currentInterval?: BillingInterval | null;
  currentPeriodEnd?: Date | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>(currentInterval ?? "monthly");

  const isPro = plan === "PRO";
  const pricing = getProPricing();
  const benefits = getProBenefits();
  const selectedPriceMinor = interval === "monthly" ? pricing.monthlyMinor : pricing.yearlyMinor;
  const isAlreadyOnSelectedPlan = isPro && interval === currentInterval;

  function goToCheckout() {
    router.push(`/checkout?interval=${interval}`);
    onClose();
  }

  return (
    <div style={overlayStyle} role="presentation" onClick={onClose}>
      <div style={modalStyle} role="dialog" aria-modal="true" aria-labelledby="upgrade-plan-heading" onClick={(event) => event.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <div id="upgrade-plan-heading" style={modalTitleStyle}>
              {isPro ? "Your PRO Plan" : "Upgrade to PRO"}
            </div>
            <div style={modalSubtitleStyle}>
              {isPro
                ? `You're currently on the PRO plan (${currentInterval === "yearly" ? "Yearly" : "Monthly"})${
                    currentPeriodEnd
                      ? `, renews ${currentPeriodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                      : ""
                  }.`
                : "You're currently on the Free plan. Here's what changes on PRO:"}
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {!isPro && (
          <ul style={benefitListStyle}>
            {benefits.map((benefit) => (
              <li key={benefit} style={benefitItemStyle}>
                <span style={benefitIconStyle}>
                  <CheckIcon />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        )}

        <div style={toggleGroupStyle} role="radiogroup" aria-label="Billing interval">
          <button
            type="button"
            role="radio"
            aria-checked={interval === "monthly"}
            style={toggleButtonStyle(interval === "monthly")}
            onClick={() => setInterval("monthly")}
          >
            <span style={toggleTopRowStyle}>Monthly</span>
            {isPro && (
              <span style={toggleCaptionStyle(interval === "monthly")}>
                {currentInterval === "monthly" ? "Current Plan" : "Downgrade"}
              </span>
            )}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={interval === "yearly"}
            style={toggleButtonStyle(interval === "yearly")}
            onClick={() => setInterval("yearly")}
          >
            <span style={toggleTopRowStyle}>
              Yearly
              <span style={savingsBadgeStyle}>Save {pricing.yearlySavingsPercent}%</span>
            </span>
            {isPro && (
              <span style={toggleCaptionStyle(interval === "yearly")}>
                {currentInterval === "yearly" ? "Current Plan" : "Upgrade"}
              </span>
            )}
          </button>
        </div>

        <div>
          <div style={priceRowStyle}>
            <span style={priceAmountStyle}>{formatNaira(selectedPriceMinor)}</span>
            <span style={priceUnitStyle}>/ {interval === "monthly" ? "month" : "year"}</span>
          </div>
          {interval === "yearly" && (
            <div style={modalSubtitleStyle}>That&apos;s {formatNaira(Math.floor(pricing.yearlyMinor / 12))}/month, billed once a year.</div>
          )}
        </div>

        <button
          type="button"
          style={upgradeButtonStyle(isAlreadyOnSelectedPlan)}
          onClick={goToCheckout}
          disabled={isAlreadyOnSelectedPlan}
          title={isAlreadyOnSelectedPlan ? "You're already on this plan" : undefined}
        >
          {isPro ? `Switch to ${interval === "monthly" ? "Monthly" : "Yearly"}` : "Continue to checkout"}
        </button>
      </div>
    </div>
  );
}
