"use client";

import { useEffect, useRef, useState } from "react";

const CODE_LENGTH = 6;

const containerStyle: React.CSSProperties = {
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderLeft: "4px solid var(--color-roles-primary)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-base-spacing)",
  marginBottom: "var(--spacing-collection-large-spacing)",
  boxShadow: "var(--effect-soft-shadow)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-base-spacing)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "var(--spacing-collection-base-spacing)",
};

const leftGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-collection-small-spacing)",
};

const iconBadgeStyle: React.CSSProperties = {
  flexShrink: 0,
  width: "2.5rem",
  height: "2.5rem",
  borderRadius: "50%",
  backgroundColor: "var(--color-roles-primary-container)",
  color: "var(--color-roles-on-primary-container)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  lineHeight: "var(--typography-label-large-line-height)",
  fontWeight: "var(--typography-label-large-font-weight)",
  color: "var(--color-roles-on-surface)",
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  lineHeight: "var(--typography-label-medium-line-height)",
  color: "var(--color-roles-on-surface-variant)",
};

// Outlined rather than solid-filled: this is a dismissable account nudge,
// not a page-level action, so it shouldn't visually compete with primary
// CTAs like "+ New Book" that sit directly below it.
const buttonStyle: React.CSSProperties = {
  flexShrink: 0,
  backgroundColor: "transparent",
  color: "var(--color-roles-primary)",
  border: "1.5px solid var(--color-roles-primary)",
  borderRadius: "0.375rem",
  padding: "0.5rem 1.25rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontWeight: "var(--typography-label-large-font-weight)",
  cursor: "pointer",
};

const otpRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "var(--spacing-collection-small-spacing)",
};

function getOtpBoxStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "2.75rem",
    height: "3rem",
    textAlign: "center",
    fontFamily: "var(--typography-title-large-font-family)",
    fontSize: "var(--typography-title-large-font-size)",
    color: "var(--color-roles-on-surface)",
    backgroundColor: "var(--color-roles-surface-container-lowest)",
    border: `1.5px solid ${hasError ? "var(--color-roles-error)" : "var(--color-roles-surface-container-highest)"}`,
    borderRadius: "0.5rem",
    outline: "none",
  };
}

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-collection-base-spacing)",
};

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "var(--color-roles-primary)",
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
};

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 6.5 12 13l8.5-6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const closeButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  padding: "0.25rem",
  cursor: "pointer",
  color: "var(--color-roles-on-surface-variant)",
  borderRadius: "0.375rem",
};

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

// sessionStorage (not localStorage) is the point: it survives page reloads
// and in-app navigation for the rest of this browser session, but is gone
// the moment the browser tab/window is closed — so a dismissal reappears on
// the next fresh session for as long as the address stays unverified.
// Keyed by email so it can't leak a dismissal from one account to another
// signed in later in the same tab.
const DISMISS_KEY_PREFIX = "legible:email-verify-dismissed:";

const SUCCESS_SNACKBAR_DURATION_MS = 10000;

// Reuses the same primary-container / on-primary-container pairing AuthView
// already uses for its own success banners — it's a verified-accessible
// green combination (light green fill, dark green text, ~7.3:1 contrast),
// not the raw brand green, which fails WCAG contrast as white-on-fill.
const snackbarStyle: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  top: "var(--spacing-collection-large-spacing)",
  transform: "translateX(-50%)",
  backgroundColor: "var(--color-roles-primary-container)",
  color: "var(--color-roles-on-primary-container)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-small-spacing) var(--spacing-collection-base-spacing)",
  boxShadow: "var(--effect-medium-shadow)",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
  zIndex: 1000,
};

export function EmailVerificationBanner() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!showSuccessSnackbar) return;
    const timer = setTimeout(() => setShowSuccessSnackbar(false), SUCCESS_SNACKBAR_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showSuccessSnackbar]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setEmail(data.email);
        setVerified(Boolean(data.emailVerified));
        if (sessionStorage.getItem(DISMISS_KEY_PREFIX + data.email)) {
          setDismissed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitCode(code: string) {
    setError("");
    setSubmitting(true);

    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();

    setSubmitting(false);
    if (res.ok) {
      setVerified(true);
      setShowSuccessSnackbar(true);
    } else {
      setError(data.message || "Verification failed");
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    }
  }

  function handleDigitChange(index: number, rawValue: string) {
    const value = rawValue.replace(/\D/g, "");

    // Handles pasting a full code into any box.
    if (value.length > 1) {
      const pasted = value.slice(0, CODE_LENGTH).split("");
      const next = Array(CODE_LENGTH).fill("");
      pasted.forEach((d, i) => (next[i] = d));
      setDigits(next);
      const lastFilled = Math.min(pasted.length, CODE_LENGTH) - 1;
      inputRefs.current[lastFilled]?.focus();
      if (pasted.length === CODE_LENGTH) submitCode(pasted.join(""));
      return;
    }

    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError("");

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== "")) {
      submitCode(next.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  // Shared by the initial "Verify" click and "Resend code" — this is the
  // only place a verification code is actually generated and emailed.
  // Signup itself does not send one (see app/api/auth/signup/route.ts).
  async function sendVerificationCode(successMessage: string) {
    setError("");
    setSendingCode(true);

    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const data = await res.json();

    setSendingCode(false);
    if (res.ok) {
      setResendStatus(successMessage);
    } else {
      setError(data.message || "Failed to send verification code");
    }
  }

  function handleVerifyClick() {
    setShowForm(true);
    sendVerificationCode("A verification code has been sent to your email.");
  }

  function handleResend() {
    setResendStatus("");
    sendVerificationCode("A new code has been sent.");
  }

  function handleDismiss() {
    setDismissed(true);
    if (email) {
      sessionStorage.setItem(DISMISS_KEY_PREFIX + email, "1");
    }
  }

  if (loading) return null;

  return (
    <>
      {!verified && !dismissed && (
        <div role="status" style={containerStyle}>
          <div style={rowStyle}>
            <div style={leftGroupStyle}>
              <div style={iconBadgeStyle}>
                <MailIcon />
              </div>
              <div>
                <div style={titleStyle}>Verify your email address</div>
                <div style={subtitleStyle}>
                  {showForm
                    ? sendingCode
                      ? <>Sending a code to <strong>{email}</strong>…</>
                      : <>Enter the 6-digit code sent to <strong>{email}</strong></>
                    : "Confirm your email to unlock full access."}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-collection-small-spacing)" }}>
              {!showForm && (
                <button type="button" onClick={handleVerifyClick} style={buttonStyle}>
                  Verify
                </button>
              )}
              <button type="button" onClick={handleDismiss} aria-label="Dismiss email verification reminder" style={closeButtonStyle}>
                <CloseIcon />
              </button>
            </div>
          </div>

          {showForm && (
            <>
              <div style={otpRowStyle}>
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={CODE_LENGTH}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    aria-label={`Digit ${i + 1} of verification code`}
                    autoFocus={i === 0}
                    disabled={submitting || sendingCode}
                    style={getOtpBoxStyle(Boolean(error))}
                  />
                ))}
              </div>

              <div style={actionsRowStyle}>
                {submitting && <span style={subtitleStyle}>Verifying…</span>}
                <button type="button" onClick={handleResend} disabled={sendingCode} style={linkButtonStyle}>
                  Resend code
                </button>
              </div>

              {error && (
                <span role="alert" style={{ color: "var(--color-roles-error)", fontFamily: "var(--typography-label-medium-font-family)", fontSize: "var(--typography-label-medium-font-size)" }}>
                  {error}
                </span>
              )}
              {resendStatus && <span style={subtitleStyle}>{resendStatus}</span>}
            </>
          )}
        </div>
      )}

      {showSuccessSnackbar && (
        <div role="status" style={snackbarStyle}>
          Email Verified Successfully!
        </div>
      )}
    </>
  );
}
