import Link from "next/link";
import type { Metadata } from "next";
import { formatNaira, getProPricing } from "@/src/domain/billing";
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

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  const { interval: rawInterval } = await searchParams;
  const interval = rawInterval === "yearly" ? "yearly" : "monthly";

  const pricing = getProPricing();
  const priceMinor = interval === "monthly" ? pricing.monthlyMinor : pricing.yearlyMinor;

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
        Checkout
      </h1>

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
          <span>Total due today</span>
          <strong>{formatNaira(priceMinor)}</strong>
        </div>

        <PayButton interval={interval} label={`Pay ${formatNaira(priceMinor)}`} />

        <Link href="/dashboard" style={backLinkStyle}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
