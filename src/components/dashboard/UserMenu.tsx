"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Subscription, Transaction } from "@prisma/client";
import type { BillingInterval } from "@/src/domain/billing";
import { UpgradePlanModal } from "./UpgradePlanModal";
import { BillingModal } from "./BillingModal";

const triggerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-collection-small-spacing)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0.25rem",
  borderRadius: "2rem",
  color: "var(--color-roles-on-surface)",
};

const avatarStyle: React.CSSProperties = {
  flexShrink: 0,
  width: "2.25rem",
  height: "2.25rem",
  borderRadius: "50%",
  backgroundColor: "var(--color-roles-primary-container)",
  color: "var(--color-roles-on-primary-container)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--typography-label-large-font-family)",
  fontWeight: "var(--typography-label-large-font-weight)",
};

const nameStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 0.5rem)",
  right: 0,
  minWidth: "14rem",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  boxShadow: "var(--effect-medium-shadow)",
  padding: "var(--spacing-collection-small-spacing)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-extra-small-spacing)",
  zIndex: 20,
};

const menuNameStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
  color: "var(--color-roles-on-surface)",
  padding: "var(--spacing-collection-extra-small-spacing) var(--spacing-collection-small-spacing)",
};

const menuEmailStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
  padding: "0 var(--spacing-collection-small-spacing) var(--spacing-collection-extra-small-spacing)",
};

const dividerStyle: React.CSSProperties = {
  height: "1px",
  backgroundColor: "var(--color-roles-surface-container-highest)",
  margin: "var(--spacing-collection-extra-small-spacing) 0",
};

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-collection-small-spacing)",
  background: "none",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  padding: "var(--spacing-collection-small-spacing)",
  borderRadius: "0.5rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  color: "var(--color-roles-on-surface)",
  textDecoration: "none",
};

const signOutButtonStyle: React.CSSProperties = {
  ...menuItemStyle,
  color: "var(--color-roles-error)",
};

function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 20c1.5-4 4.5-6 7.5-6s6 2 7.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h9M17 7h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 12h3M11 12h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 17h9M17 17h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TOAST_DURATION_MS = 5000;

const toastStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "1.5rem",
  right: "1.5rem",
  backgroundColor: "var(--color-roles-primary)",
  color: "var(--color-roles-on-primary)",
  padding: "0.75rem 1.25rem",
  borderRadius: "0.5rem",
  boxShadow: "var(--effect-medium-shadow)",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  zIndex: 300,
};

export function UserMenu({
  name,
  email,
  plan,
  subscription,
  transactions,
  currentInterval,
}: {
  name: string;
  email: string;
  plan: string;
  subscription: Subscription | null;
  transactions: Transaction[];
  currentInterval?: BillingInterval | null;
}) {
  const [open, setOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [showCancelToast, setShowCancelToast] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showCancelToast) return;
    const timer = setTimeout(() => setShowCancelToast(false), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showCancelToast]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} style={triggerStyle} aria-haspopup="menu" aria-expanded={open}>
        <div style={avatarStyle}>{initial}</div>
        <span style={nameStyle}>{name}</span>
      </button>

      {open && (
        <div role="menu" style={menuStyle}>
          <div style={menuNameStyle}>{name}</div>
          <div style={menuEmailStyle}>{email}</div>
          <div style={dividerStyle} />
          <Link href="/dashboard/profile" role="menuitem" onClick={() => setOpen(false)} style={menuItemStyle}>
            <ProfileIcon />
            My Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setBillingOpen(true);
            }}
            style={menuItemStyle}
          >
            <BillingIcon />
            Billing
          </button>
          <Link href="/dashboard/settings" role="menuitem" onClick={() => setOpen(false)} style={menuItemStyle}>
            <SettingsIcon />
            Settings
          </Link>
          <div style={dividerStyle} />
          <button type="button" role="menuitem" onClick={() => signOut({ callbackUrl: "/" })} style={signOutButtonStyle}>
            <SignOutIcon />
            Sign out
          </button>
        </div>
      )}

      {billingOpen && (
        <BillingModal
          plan={plan}
          subscription={subscription}
          transactions={transactions}
          onClose={() => setBillingOpen(false)}
          onCancelled={() => setShowCancelToast(true)}
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

      {showCancelToast && (
        <div style={toastStyle} role="status">
          Successfully done
        </div>
      )}
    </div>
  );
}
