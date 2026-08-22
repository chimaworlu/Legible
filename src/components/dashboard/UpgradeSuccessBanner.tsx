"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BANNER_DURATION_MS = 10000;

// Reuses the same primary-container / on-primary-container pairing as the
// "Email Verified Successfully!" snackbar in EmailVerificationBanner — the
// app's one verified-accessible green for a positive confirmation, so every
// "you just did a good thing" moment looks consistent.
const containerStyle: React.CSSProperties = {
  backgroundColor: "var(--color-roles-primary-container)",
  color: "var(--color-roles-on-primary-container)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-base-spacing)",
  marginBottom: "var(--spacing-collection-large-spacing)",
  boxShadow: "var(--effect-soft-shadow)",
  display: "flex",
  alignItems: "center",
  gap: "0.625rem",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
};

const iconWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "flex",
};

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12.5 10.5 15 16 9.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Fires once when the Flutterwave redirect callback (app/api/billing/flutterwave/callback)
// sends the user back with ?upgrade=success. Captured once via the useState
// initializer, not read reactively — same reasoning as ConfettiCelebration:
// the URL is cleaned up with a raw history.replaceState rather than
// router.replace, which would trigger a real navigation and unmount this
// before the 10s timer finishes.
export function UpgradeSuccessBanner() {
  const searchParams = useSearchParams();
  const [shouldShow] = useState(() => searchParams.get("upgrade") === "success");
  const [visible, setVisible] = useState(shouldShow);

  useEffect(() => {
    if (!shouldShow) return;

    window.history.replaceState(null, "", "/dashboard");

    const timer = setTimeout(() => setVisible(false), BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [shouldShow]);

  if (!visible) return null;

  return (
    <div role="status" style={containerStyle}>
      <span style={iconWrapStyle}>
        <CheckCircleIcon />
      </span>
      <span>
        Payment successful! Welcome to <strong>PRO</strong>. Your account has been upgraded and higher limits are now active.
      </span>
    </div>
  );
}
