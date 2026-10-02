"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import type { Subscription, Transaction } from "@prisma/client";
import type { BillingInterval } from "@/src/domain/billing";
import { BillingModal } from "./BillingModal";
import { UpgradePlanModal } from "./UpgradePlanModal";

const PLAN_LABELS: Record<string, string> = { FREE: "Free plan", PRO: "Pro plan" };

const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-large-spacing)",
  marginBottom: "var(--spacing-collection-large-spacing)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-medium-font-family)",
  fontSize: "var(--typography-title-medium-font-size)",
  fontWeight: "var(--typography-title-medium-font-weight)",
  marginBottom: "var(--spacing-collection-small-spacing)",
};

const sectionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const sectionBodyStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.375rem",
  background: "none",
  color: "var(--color-roles-on-surface)",
  padding: "0.625rem 1rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  whiteSpace: "nowrap",
};

const dangerSectionStyle: React.CSSProperties = {
  ...sectionStyle,
  border: "1px solid var(--color-roles-error)",
  marginBottom: 0,
};

const dangerButtonStyle: React.CSSProperties = {
  border: "1px solid var(--color-roles-error)",
  borderRadius: "0.375rem",
  background: "none",
  color: "var(--color-roles-error)",
  padding: "0.625rem 1rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  whiteSpace: "nowrap",
};

const modalOverlayStyle: React.CSSProperties = {
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
  maxWidth: "24rem",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  borderRadius: "0.75rem",
  boxShadow: "var(--effect-medium-shadow)",
  padding: "var(--spacing-collection-large-spacing)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-base-spacing)",
};

const modalHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-medium-font-family)",
  fontSize: "var(--typography-title-medium-font-size)",
  fontWeight: "var(--typography-title-medium-font-weight)",
};

const modalBodyStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
  margin: 0,
};

const modalButtonRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
};

const modalCancelButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--color-roles-on-surface-variant)",
  padding: "0.625rem 0.875rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
};

function modalDeleteButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: "0.375rem",
    backgroundColor: "var(--color-roles-error)",
    color: "var(--color-roles-on-error)",
    padding: "0.625rem 1rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "var(--typography-label-large-font-family)",
  };
}

const errorTextStyle: React.CSSProperties = {
  color: "var(--color-roles-error)",
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
};

// Billing management and account deletion — the two actions on this page
// that need real interactivity (a modal, a confirm step, an API call), so
// they're split into their own client island rather than making the whole
// Settings page a client component.
export function SettingsAccountActions({
  plan,
  subscription,
  transactions,
  currentInterval,
}: {
  plan: string;
  subscription: Subscription | null;
  transactions: Transaction[];
  currentInterval?: BillingInterval | null;
}) {
  const [billingOpen, setBillingOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/auth/delete-account", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setDeleteError(body?.message ?? "Could not delete account. Please try again.");
        setDeleting(false);
        return;
      }
      // The account (and its session) no longer exist server-side — sign
      // out client-side too and land on the marketing page.
      await signOut({ callbackUrl: "/" });
    } catch {
      setDeleteError("Could not delete account. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Billing</div>
        <div style={sectionRowStyle}>
          <p style={sectionBodyStyle}>
            You&apos;re on the {PLAN_LABELS[plan] ?? plan}
            {subscription?.status === "ACTIVE" && plan === "PRO" ? subscription.cancelAtPeriodEnd ? " (ending)" : " (renewing)" : ""}.
          </p>
          <button type="button" style={secondaryButtonStyle} onClick={() => setBillingOpen(true)}>
            Manage Billing
          </button>
        </div>
      </div>

      <div style={dangerSectionStyle}>
        <div style={sectionTitleStyle}>Danger Zone</div>
        <div style={sectionRowStyle}>
          <p style={sectionBodyStyle}>Permanently delete your account and all of your books, images, and transcribed notes.</p>
          <button type="button" style={dangerButtonStyle} onClick={() => setDeleteOpen(true)}>
            Delete Account
          </button>
        </div>
      </div>

      {billingOpen && (
        <BillingModal
          plan={plan}
          subscription={subscription}
          transactions={transactions}
          onClose={() => setBillingOpen(false)}
          onCancelled={() => {}}
          onUpgradeClick={() => {
            setBillingOpen(false);
            setUpgradeModalOpen(true);
          }}
        />
      )}

      {upgradeModalOpen && (
        <UpgradePlanModal
          plan={plan}
          currentInterval={currentInterval}
          currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
          cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd ?? false}
          onClose={() => setUpgradeModalOpen(false)}
        />
      )}

      {deleteOpen && (
        <div style={modalOverlayStyle} role="presentation" onClick={() => !deleting && setDeleteOpen(false)}>
          <div
            style={modalStyle}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div id="delete-account-heading" style={modalHeadingStyle}>
              Delete your account?
            </div>
            <p style={modalBodyStyle}>
              This permanently deletes your account, every book, uploaded image, and transcribed note. This cannot be undone.
            </p>
            {deleteError && (
              <span role="alert" style={errorTextStyle}>
                {deleteError}
              </span>
            )}
            <div style={modalButtonRowStyle}>
              <button type="button" style={modalCancelButtonStyle} onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" style={modalDeleteButtonStyle(deleting)} onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
