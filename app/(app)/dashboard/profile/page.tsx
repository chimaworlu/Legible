import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { userRepo } from "@/src/db/repositories/user";

export const metadata: Metadata = {
  title: "My Profile",
  description: "View your Legible account details.",
};

const PLAN_LABELS: Record<string, string> = { FREE: "Free plan", PRO: "Pro plan" };

function formatMemberSince(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

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

const identityCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-collection-base-spacing)",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-large-spacing)",
  marginBottom: "var(--spacing-collection-large-spacing)",
};

const avatarStyle: React.CSSProperties = {
  flexShrink: 0,
  width: "3.5rem",
  height: "3.5rem",
  borderRadius: "50%",
  backgroundColor: "var(--color-roles-primary-container)",
  color: "var(--color-roles-on-primary-container)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--typography-title-large-font-family)",
  fontSize: "var(--typography-title-large-font-size)",
  fontWeight: "var(--typography-title-large-font-weight)",
};

const nameStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-medium-font-family)",
  fontSize: "var(--typography-title-medium-font-size)",
  fontWeight: "var(--typography-title-medium-font-weight)",
  color: "var(--color-roles-on-surface)",
};

const emailRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  marginTop: "0.25rem",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
};

function statusBadgeStyle(verified: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.125rem 0.5rem",
    borderRadius: "1rem",
    fontFamily: "var(--typography-label-medium-font-family)",
    fontSize: "var(--typography-label-medium-font-size)",
    fontWeight: "var(--typography-label-medium-font-weight)",
    backgroundColor: verified ? "var(--color-roles-primary-container)" : "var(--color-roles-surface-container-high)",
    color: verified ? "var(--color-roles-on-primary-container)" : "var(--color-roles-on-surface-variant)",
  };
}

const detailsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
  gap: "var(--spacing-collection-base-spacing)",
};

const detailCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-extra-small-spacing)",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-base-spacing)",
};

const detailLabelStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  fontWeight: "var(--typography-label-medium-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const detailValueStyle: React.CSSProperties = {
  fontFamily: "var(--typography-headline-small-font-family)",
  fontSize: "var(--typography-headline-small-font-size)",
  fontWeight: "var(--typography-headline-small-font-weight)",
  color: "var(--color-roles-on-surface)",
};

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Read-only (the recommended, smaller scope — editing the display name
// would need a new PATCH endpoint this repo doesn't have yet). Pulled
// straight from the User row already loaded for the dashboard layout, same
// pattern as app/(app)/dashboard/page.tsx and layout.tsx.
export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id: string } | undefined)?.id;
  const user = userId ? await userRepo.findById(userId) : null;

  // The (app) layout already redirects an unauthenticated visitor to /auth
  // before this renders; this is just type narrowing for the lookup above.
  if (!user) return null;

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div>
      <Link href="/dashboard" style={backLinkStyle}>
        <BackArrowIcon />
        Back to Dashboard
      </Link>

      <h1 style={titleStyle}>My Profile</h1>

      <div style={identityCardStyle}>
        <div style={avatarStyle}>{initial}</div>
        <div>
          <div style={nameStyle}>{user.name || "No name set"}</div>
          <div style={emailRowStyle}>
            {user.email}
            <span style={statusBadgeStyle(user.emailVerified)}>{user.emailVerified ? "Verified" : "Unverified"}</span>
          </div>
        </div>
      </div>

      <div style={detailsGridStyle}>
        <div style={detailCardStyle}>
          <span style={detailLabelStyle}>Plan</span>
          <span style={detailValueStyle}>{PLAN_LABELS[user.plan] ?? user.plan}</span>
        </div>
        <div style={detailCardStyle}>
          <span style={detailLabelStyle}>Credit balance</span>
          <span style={detailValueStyle}>{user.creditBalance}</span>
        </div>
        <div style={detailCardStyle}>
          <span style={detailLabelStyle}>Member since</span>
          <span style={detailValueStyle}>{formatMemberSince(user.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
