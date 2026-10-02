import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { subscriptionRepo } from "@/src/db/repositories/subscription";
import { transactionRepo } from "@/src/db/repositories/transaction";
import { fromDbInterval } from "@/src/domain/billing";
import { userRepo } from "@/src/db/repositories/user";
import { EmailVerificationBanner } from "@/src/components/dashboard/EmailVerificationBanner";
import { SettingsAccountActions } from "@/src/components/dashboard/SettingsAccountActions";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Legible account, billing, and security.",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  color: "var(--color-roles-primary)",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
  textDecoration: "none",
  marginBottom: "var(--spacing-collection-base-spacing)",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-headline-medium-font-family)",
  fontSize: "var(--typography-headline-medium-font-size)",
  fontWeight: "var(--typography-headline-medium-font-weight)",
  marginBottom: "var(--spacing-collection-large-spacing)",
};

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
  margin: 0,
};

const secondaryLinkButtonStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.375rem",
  background: "none",
  color: "var(--color-roles-on-surface)",
  padding: "0.625rem 1rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Account, security & billing (the recommended, smaller scope) — no in-app
// password change yet, since there's no authenticated "old password + new
// password" endpoint; "Reset Password" reuses the existing forgot-password
// flow instead of building a parallel one.
export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id: string } | undefined)?.id;
  const user = userId ? await userRepo.findById(userId) : null;

  // The (app) layout already redirects an unauthenticated visitor to /auth
  // before this renders; this is just type narrowing for the lookup above.
  if (!user) return null;

  const [subscription, transactions] = await Promise.all([subscriptionRepo.findByUserId(user.id), transactionRepo.listForUser(user.id)]);
  const latestCharge = transactions.find((transaction) => transaction.type === "SUBSCRIPTION_CHARGE") ?? null;
  const currentInterval = fromDbInterval(latestCharge?.interval, latestCharge?.amountMinor);

  return (
    <div>
      <Link href="/dashboard" style={backLinkStyle}>
        <BackArrowIcon />
        Back to Dashboard
      </Link>

      <h1 style={titleStyle}>Settings</h1>

      <EmailVerificationBanner />

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Password</div>
        <div style={sectionRowStyle}>
          <p style={sectionBodyStyle}>Send yourself a password reset code by email.</p>
          <Link href="/auth?mode=forgot-password" style={secondaryLinkButtonStyle}>
            Reset Password
          </Link>
        </div>
      </div>

      <SettingsAccountActions plan={user.plan} subscription={subscription} transactions={transactions} currentInterval={currentInterval} />
    </div>
  );
}
