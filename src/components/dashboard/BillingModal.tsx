"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Subscription, Transaction } from "@prisma/client";
import { formatNaira } from "@/src/domain/billing";

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
  maxWidth: "32rem",
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

const closeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: "0.25rem",
  cursor: "pointer",
  color: "var(--color-roles-on-surface-variant)",
  flexShrink: 0,
};

const summaryCardStyle: React.CSSProperties = {
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-base-spacing)",
  display: "flex",
  flexDirection: "column",
  gap: "0.625rem",
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-medium-font-family)",
  fontSize: "var(--typography-title-medium-font-size)",
  fontWeight: "var(--typography-title-medium-font-weight)",
};

const upgradeLinkStyle: React.CSSProperties = {
  display: "inline-block",
  textAlign: "center",
  border: "none",
  borderRadius: "0.375rem",
  backgroundColor: "var(--color-roles-primary)",
  color: "var(--color-roles-on-primary)",
  padding: "0.625rem 1rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  cursor: "pointer",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.625rem",
  borderBottom: "1px solid var(--color-roles-surface-container-highest)",
  color: "var(--color-roles-on-surface-variant)",
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  fontWeight: "var(--typography-label-medium-font-weight)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.625rem",
  borderBottom: "1px solid var(--color-roles-surface-container-highest)",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "var(--spacing-collection-base-spacing)",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.5rem",
  color: "var(--color-roles-on-surface-variant)",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
};

const cancelLinkStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "var(--color-roles-error)",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.875rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  textAlign: "center",
  padding: "0.25rem",
};

const confirmBoxStyle: React.CSSProperties = {
  border: "1px solid var(--color-roles-error)",
  borderRadius: "0.5rem",
  padding: "var(--spacing-collection-base-spacing)",
  display: "flex",
  flexDirection: "column",
  gap: "0.625rem",
};

const confirmTextStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface)",
};

const confirmButtonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
};

function destructiveButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    border: "none",
    borderRadius: "0.375rem",
    backgroundColor: "var(--color-roles-error)",
    color: "var(--color-roles-on-error)",
    padding: "0.625rem 1rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.875rem",
    fontWeight: "var(--typography-label-large-font-weight)",
  };
}

const keepPlanButtonStyle: React.CSSProperties = {
  flex: 1,
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.375rem",
  backgroundColor: "transparent",
  color: "var(--color-roles-on-surface)",
  padding: "0.625rem 1rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.875rem",
  fontWeight: "var(--typography-label-large-font-weight)",
};

const errorTextStyle: React.CSSProperties = {
  color: "var(--color-roles-error)",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "0.8125rem",
  textAlign: "center",
};

const PLAN_LABELS: Record<string, string> = { FREE: "Free plan", PRO: "Pro plan" };
const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = { ACTIVE: "Active", PAST_DUE: "Past due", CANCELED: "Canceled" };
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION_CHARGE: "Subscription payment",
  CREDIT_PURCHASE: "Credit purchase",
  CREDIT_SPEND: "Credits used",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function transactionAmountLabel(transaction: { amountMinor: number | null; credits: number | null }): string {
  if (transaction.amountMinor !== null) return formatNaira(transaction.amountMinor);
  if (transaction.credits !== null) return `${transaction.credits} credits`;
  return "—";
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Shared by UserMenu (opened from the account menu, any page) and the
// Settings page's "Manage Billing" button — one implementation of the
// cancel/resume/payment-history flow so money-code logic (money-and-
// billing.md) never has two places to drift apart.
export function BillingModal({
  plan,
  subscription,
  transactions,
  onClose,
  onCancelled,
  onUpgradeClick,
}: {
  plan: string;
  subscription: Subscription | null;
  transactions: Transaction[];
  onClose: () => void;
  onCancelled: () => void;
  onUpgradeClick: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = plan === "PRO" && subscription?.status === "ACTIVE" && !subscription.cancelAtPeriodEnd;
  const isEndingAtPeriodEnd = plan === "PRO" && subscription?.status === "ACTIVE" && subscription.cancelAtPeriodEnd;

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(body?.message ?? "Something went wrong. Please try again.");
        setCancelling(false);
        return;
      }
      onClose();
      onCancelled();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setCancelling(false);
    }
  }

  return (
    <div style={overlayStyle} role="presentation" onClick={onClose}>
      <div style={modalStyle} role="dialog" aria-modal="true" aria-labelledby="billing-modal-heading" onClick={(event) => event.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div id="billing-modal-heading" style={modalTitleStyle}>
            Billing
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div style={summaryCardStyle}>
          <div style={summaryRowStyle}>
            <span>Plan</span>
            <strong>{PLAN_LABELS[plan] ?? plan}</strong>
          </div>

          {subscription && (
            <>
              <div style={summaryRowStyle}>
                <span>Subscription status</span>
                <strong>{SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status}</strong>
              </div>
              <div style={summaryRowStyle}>
                <span>{subscription.status === "CANCELED" ? "Ended" : isEndingAtPeriodEnd ? "Ends" : "Renews"}</span>
                <strong>{formatDate(subscription.currentPeriodEnd)}</strong>
              </div>
            </>
          )}

          {plan !== "PRO" && (
            <button type="button" style={upgradeLinkStyle} onClick={onUpgradeClick}>
              Upgrade to PRO
            </button>
          )}
        </div>

        <div style={sectionTitleStyle}>Payment history</div>

        {transactions.length === 0 ? (
          <div style={emptyStateStyle}>No payments yet.</div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td style={tdStyle}>{formatDate(transaction.createdAt)}</td>
                    <td style={tdStyle}>{TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type}</td>
                    <td style={tdStyle}>{transactionAmountLabel(transaction)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isEndingAtPeriodEnd && subscription && (
          <div style={confirmTextStyle}>
            Your plan is set to end on {formatDate(subscription.currentPeriodEnd)} and won&apos;t renew.
            {subscription.renewalMode === "AUTO" && !subscription.providerPlanId
              ? " Note: if your card is still charged around that date despite this, contact support — we can't guarantee Flutterwave stopped it on their end."
              : ""}{" "}
            <button type="button" style={cancelLinkStyle} onClick={onUpgradeClick}>
              Resume plan
            </button>
          </div>
        )}

        {canCancel && !confirming && (
          <button type="button" style={cancelLinkStyle} onClick={() => setConfirming(true)}>
            Cancel Subscription
          </button>
        )}

        {canCancel && confirming && subscription && (
          <div style={confirmBoxStyle}>
            <div style={confirmTextStyle}>
              Cancelling stops automatic renewal — you&apos;ll keep PRO access until {formatDate(subscription.currentPeriodEnd)}, then your account
              moves to Free.
              {subscription.renewalMode === "AUTO"
                ? subscription.providerPlanId
                  ? " Your card won't be charged again."
                  : " Note: we can't guarantee this stops Flutterwave from charging your card again on its own schedule — contact support if that happens."
                : ""}
            </div>
            {error && <div style={errorTextStyle}>{error}</div>}
            <div style={confirmButtonRowStyle}>
              <button type="button" style={keepPlanButtonStyle} onClick={() => setConfirming(false)} disabled={cancelling}>
                Keep my plan
              </button>
              <button type="button" style={destructiveButtonStyle(cancelling)} onClick={handleCancel} disabled={cancelling}>
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
