import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { userRepo } from "@/src/db/repositories/user";
import { bookRepo } from "@/src/db/repositories/book";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";
import Link from "next/link";
import { getPlanLimits, checkBookCreationAllowance } from "@/src/domain/planLimits";
import { computeUsagePercent, type UsageStat } from "@/src/domain/usage";
import { config } from "@/src/config";
import { EmailVerificationBanner } from "@/src/components/dashboard/EmailVerificationBanner";
import { UpgradeSuccessBanner } from "@/src/components/dashboard/UpgradeSuccessBanner";
import { ManualRenewalBanner } from "@/src/components/dashboard/ManualRenewalBanner";
import { ConfettiCelebration } from "@/src/components/dashboard/ConfettiCelebration";
import { NewBookButton } from "@/src/components/dashboard/NewBookButton";
import { DashboardBooks } from "@/src/components/dashboard/DashboardBooks";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "View and manage your digitized handwritten books.",
};

const PLAN_LABELS: Record<string, string> = {
  FREE: "Free plan",
  PRO: "Pro plan",
};

function planBadgeStyle(plan: string): React.CSSProperties {
  const isPro = plan === "PRO";
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.25rem 0.75rem",
    borderRadius: "1rem",
    fontFamily: "var(--typography-label-medium-font-family)",
    fontSize: "var(--typography-label-medium-font-size)",
    fontWeight: "var(--typography-label-medium-font-weight)",
    backgroundColor: isPro ? "var(--color-roles-primary-container)" : "var(--color-roles-surface-container-high)",
    color: isPro ? "var(--color-roles-on-primary-container)" : "var(--color-roles-on-surface-variant)",
  };
}

const statsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
  gap: "var(--spacing-collection-base-spacing)",
  marginBottom: "var(--spacing-collection-extra-large)",
};

const statCardStyle: React.CSSProperties = {
  position: "relative",
  padding: "var(--spacing-collection-base-spacing)",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-extra-small-spacing)",
};

const statLabelStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  fontWeight: "var(--typography-label-medium-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const statValueStyle: React.CSSProperties = {
  fontFamily: "var(--typography-headline-medium-font-family)",
  fontSize: "var(--typography-headline-medium-font-size)",
  fontWeight: "var(--typography-headline-medium-font-weight)",
  color: "var(--color-roles-on-surface)",
};

function statLabel(base: string, max: number | null): string {
  return (max === null ? base : `${base} (${max} max)`).toUpperCase();
}

function usagePillStyle(kind: "used" | "empty"): React.CSSProperties {
  const colors =
    kind === "used"
      ? { bg: "var(--color-roles-primary-container)", fg: "var(--color-roles-on-primary-container)" }
      : { bg: "var(--color-roles-surface-container-high)", fg: "var(--color-roles-on-surface-variant)" };
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.1875rem",
    padding: "0.125rem 0.4375rem",
    borderRadius: "1rem",
    fontFamily: "var(--typography-label-medium-font-family)",
    fontSize: "0.6875rem",
    fontWeight: "var(--typography-label-medium-font-weight)",
    backgroundColor: colors.bg,
    color: colors.fg,
  };
}

function TrendArrowIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V7M7 12l5-5 5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsagePill({ usage }: { usage: UsageStat }) {
  if (usage.kind === "uncapped") return null;
  return (
    <span className="stat-trend-pill" style={usagePillStyle(usage.kind === "used" ? "used" : "empty")}>
      {usage.kind === "used" && <TrendArrowIcon />}
      {usage.kind === "used" && `${usage.percent}%`}
      {usage.kind === "empty" && "0%"}
    </span>
  );
}

function EmptyStateIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const BOOK_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PROCESSING: "Processing",
  READY: "Ready",
  ARCHIVED: "Archived",
};

const BOOK_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: "var(--color-roles-surface-container-high)", fg: "var(--color-roles-on-surface-variant)" },
  PROCESSING: { bg: "var(--color-roles-tertiary-container)", fg: "var(--color-roles-on-tertiary-container)" },
  READY: { bg: "var(--color-roles-primary-container)", fg: "var(--color-roles-on-primary-container)" },
  ARCHIVED: { bg: "var(--color-roles-surface-container-high)", fg: "var(--color-roles-on-surface-variant)" },
};

function bookStatusPillStyle(status: string): React.CSSProperties {
  const colors = BOOK_STATUS_COLORS[status] ?? BOOK_STATUS_COLORS.DRAFT;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.1875rem 0.5rem",
    borderRadius: "1rem",
    fontFamily: "var(--typography-label-medium-font-family)",
    fontSize: "var(--typography-label-medium-font-size)",
    fontWeight: "var(--typography-label-medium-font-weight)",
    backgroundColor: colors.bg,
    color: colors.fg,
  };
}

function formatBookDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const limitBannerStyle: React.CSSProperties = {
  backgroundColor: "var(--color-roles-error-container)",
  color: "var(--color-roles-on-error-container)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-base-spacing)",
  marginTop: "var(--spacing-collection-large-spacing)",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  textAlign: "center",
};

const limitBannerLinkStyle: React.CSSProperties = {
  color: "var(--color-roles-on-error-container)",
  fontWeight: "var(--typography-label-large-font-weight)",
  textDecoration: "underline",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id: string })?.id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [user, books, imagesThisMonth, booksThisMonth] = await Promise.all([
    userRepo.findById(userId),
    bookRepo.listForUserWithImages(userId),
    sourceImageRepo.countCreatedSinceForUser(userId, startOfMonth),
    bookRepo.countCreatedSince(userId, startOfMonth),
  ]);

  const plan = user?.plan ?? "FREE";
  const limits = getPlanLimits(plan);
  const imagesUsage = computeUsagePercent(imagesThisMonth, limits.imagesPerMonth);
  const booksUsage = computeUsagePercent(booksThisMonth, limits.booksPerMonth);
  const bookCreationAllowance = checkBookCreationAllowance(limits, booksThisMonth);

  const nearLimit =
    plan === "FREE" &&
    ((imagesUsage.kind === "used" && imagesUsage.percent >= config.plans.FREE.usageWarningThresholdPercent) ||
      (booksUsage.kind === "used" && booksUsage.percent >= config.plans.FREE.usageWarningThresholdPercent));

  return (
    <div>
      <Suspense fallback={null}>
        <ConfettiCelebration />
      </Suspense>
      <Suspense fallback={null}>
        <UpgradeSuccessBanner />
      </Suspense>

      <EmailVerificationBanner />
      <ManualRenewalBanner />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-collection-base-spacing)" }}>
        <span style={planBadgeStyle(plan)}>{PLAN_LABELS[plan] ?? plan}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-collection-base-spacing)" }}>
          <NewBookButton disabled={!bookCreationAllowance.allowed} />
        </div>
      </div>

      <div style={statsRowStyle}>
        <div className="stat-card" style={statCardStyle}>
          <span style={statLabelStyle}>{statLabel("Images this month", limits.imagesPerMonth)}</span>
          <div className="stat-value-row">
            <span style={statValueStyle}>{imagesThisMonth}</span>
            <UsagePill usage={imagesUsage} />
          </div>
        </div>
        <div className="stat-card" style={statCardStyle}>
          <span style={statLabelStyle}>{statLabel("Books this month", limits.booksPerMonth)}</span>
          <div className="stat-value-row">
            <span style={statValueStyle}>{booksThisMonth}</span>
            <UsagePill usage={booksUsage} />
          </div>
        </div>
        <div className="stat-card" style={statCardStyle}>
          <span style={statLabelStyle}>Max images per book</span>
          <span style={statValueStyle}>{limits.imagesPerBook}</span>
        </div>
      </div>

      <h1 style={{ fontFamily: "var(--typography-headline-medium-font-family)", fontSize: "var(--typography-headline-medium-font-size)", fontWeight: "var(--typography-headline-medium-font-weight)", marginBottom: "var(--spacing-collection-base-spacing)" }}>Your Books</h1>

      {books.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--spacing-collection-very-large-spacing)", backgroundColor: "var(--color-roles-surface-container-low)", border: "1px solid var(--color-roles-surface-container-highest)", borderRadius: "0.75rem" }}>
          <div style={{ width: "3.5rem", height: "3.5rem", borderRadius: "50%", backgroundColor: "var(--color-roles-primary-container)", color: "var(--color-roles-on-primary-container)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--spacing-collection-base-spacing)" }}>
            <EmptyStateIcon />
          </div>
          <h3 style={{ fontFamily: "var(--typography-title-medium-font-family)", fontSize: "var(--typography-title-medium-font-size)", fontWeight: "var(--typography-title-medium-font-weight)", marginBottom: "var(--spacing-collection-small-spacing)" }}>
            No books yet
          </h3>
          <p style={{ color: "var(--color-roles-on-surface-variant)" }}>
            Click &quot;New Book&quot; to upload your first batch of handwritten notes.
          </p>
        </div>
      ) : (
        <DashboardBooks books={books} imagesPerBook={limits.imagesPerBook} />
      )}

      {nearLimit && (
        <div role="status" style={limitBannerStyle}>
          You&apos;re approaching your Free plan limits.{" "}
          <Link href="/checkout?interval=monthly" style={limitBannerLinkStyle}>
            Upgrade to PRO
          </Link>{" "}
          for {config.plans.PRO.imagesPerMonth} images and no monthly book limit.
        </div>
      )}
    </div>
  );
}
