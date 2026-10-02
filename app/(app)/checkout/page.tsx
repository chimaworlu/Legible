import Link from "next/link";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { formatNaira, getProPricing, fromDbInterval } from "@/src/domain/billing";
import { nextPeriodStart } from "@/src/domain/subscription";
import { userRepo } from "@/src/db/repositories/user";
import { transactionRepo } from "@/src/db/repositories/transaction";
import { subscriptionRepo } from "@/src/db/repositories/subscription";
import { expireSubscriptionIfDue } from "@/src/services/billing/reconcile";
import { PayButton } from "@/src/components/checkout/PayButton";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your PRO plan and complete checkout.",
};

const cardStyle: React.CSSProperties = {
  maxWidth: "28rem",
  margin: "0 auto",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-large-spacing)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-base-spacing)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
};

const backLinkStyle: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  color: "var(--color-roles-primary)",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  textDecoration: "none",
};

const activePlanBannerStyle: React.CSSProperties = {
  maxWidth: "28rem",
  margin: "0 auto var(--spacing-collection-base-spacing)",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-base-spacing)",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface)",
};

function formatLongDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  const { interval: rawInterval } = await searchParams;
  const interval = rawInterval === "yearly" ? "yearly" : "monthly";

  const pricing = getProPricing();
  const priceMinor = interval === "monthly" ? pricing.monthlyMinor : pricing.yearlyMinor;

  // Current subscription state, so the page can show the active/running
  // plan up front (never silently skip straight to a fresh checkout) and
  // PayButton can show the double-charge warning before the user even
  // submits, rather than only after a blocked attempt.
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (userId) await expireSubscriptionIfDue(userId);
  const user = userId ? await userRepo.findById(userId) : null;
  const [latestCharge, subscription] = user?.plan === "PRO"
    ? await Promise.all([transactionRepo.findLatestSubscriptionCharge(user.id), subscriptionRepo.findByUserId(user.id)])
    : [null, null];
  const currentInterval = fromDbInterval(latestCharge?.interval, latestCharge?.amountMinor);

  const now = new Date();
  const periodStart = subscription ? nextPeriodStart(subscription, now) : now;
  const queuedStartDate = periodStart.getTime() > now.getTime() ? periodStart : null;

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--typography-headline-medium-font-family)",
          fontSize: "var(--typography-headline-medium-font-size)",
          fontWeight: "var(--typography-headline-medium-font-weight)",
          textAlign: "center",
          marginBottom: "var(--spacing-collection-large-spacing)",
        }}
      >
        {queuedStartDate ? "Confirm New Subscription" : "Checkout"}
      </h1>

      {queuedStartDate && subscription && (
        <div style={activePlanBannerStyle} role="status">
          You have an active PRO plan
          {currentInterval ? ` (${currentInterval === "monthly" ? "Monthly" : "Yearly"})` : ""} running until{" "}
          <strong>{formatLongDate(subscription.currentPeriodEnd)}</strong>
          {subscription.cancelAtPeriodEnd ? " — it's set to end then and won't renew." : "."}
        </div>
      )}

      <div style={cardStyle}>
        <div style={rowStyle}>
          <span>Plan</span>
          <strong>PRO</strong>
        </div>
        <div style={rowStyle}>
          <span>Billing</span>
          <strong>{interval === "monthly" ? "Monthly" : "Yearly"}</strong>
        </div>
        <div style={rowStyle}>
          <span>{queuedStartDate ? "Due today" : "Total due today"}</span>
          <strong>{formatNaira(priceMinor)}</strong>
        </div>
        {queuedStartDate && (
          <div style={rowStyle}>
            <span>Starts</span>
            <strong>{formatLongDate(queuedStartDate)}</strong>
          </div>
        )}

        <PayButton
          interval={interval}
          label={queuedStartDate ? `Confirm New Subscription — starts ${formatLongDate(queuedStartDate)}` : `Pay ${formatNaira(priceMinor)}`}
          currentInterval={currentInterval}
          renewalMode={subscription?.renewalMode ?? null}
          hasProviderPlan={subscription?.providerPlanId != null}
          queuedStartDate={queuedStartDate}
        />

        <Link href="/dashboard" style={backLinkStyle}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
