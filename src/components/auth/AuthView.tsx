"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useMarketingSection } from "../../context/MarketingSectionContext";

export type AuthMode = "login" | "signup" | "forgot-password";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  lineHeight: "var(--typography-label-large-line-height)",
  letterSpacing: "var(--typography-label-large-letter-spacing)",
  fontWeight: "var(--typography-label-large-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
};

const fieldErrorStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  lineHeight: "var(--typography-label-medium-line-height)",
  color: "var(--color-roles-error)",
};

function getInputStyle(hasError: boolean, trailingPadding?: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--typography-body-medium-font-family)",
    fontSize: "var(--typography-body-medium-font-size)",
    lineHeight: "var(--typography-body-medium-line-height)",
    color: "var(--color-roles-on-surface)",
    backgroundColor: "var(--color-roles-surface-container-lowest)",
    border: `1px solid ${hasError ? "var(--color-roles-error)" : "var(--color-roles-surface-container-highest)"}`,
    borderRadius: "0.5rem",
    padding: "var(--spacing-collection-medium-spacing) var(--spacing-collection-base-spacing)",
    paddingRight: trailingPadding ? "2.5rem" : undefined,
    width: "100%",
    boxSizing: "border-box",
    transition: "background-color 0.15s ease",
  };
}

const passwordToggleButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  right: "var(--spacing-collection-base-spacing)",
  transform: "translateY(-50%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "var(--color-roles-on-surface-variant)",
};

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {open ? (
        <>
          <path
            d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <path
            d="M3 3l18 18M10.6 5.6C11.05 5.53 11.52 5.5 12 5.5c6.5 0 10.5 7 10.5 7-.6 1.06-1.4 2.23-2.42 3.32M6.6 6.6C3.53 8.4 1.5 12 1.5 12s4 7 10.5 7c1.53 0 2.9-.39 4.1-1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.9 10a3 3 0 0 0 4.24 4.13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

function getSubmitButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    marginTop: "var(--spacing-collection-small-spacing)",
    backgroundColor: "var(--color-roles-primary)",
    color: "var(--color-roles-on-primary)",
    border: "none",
    borderRadius: "0.375rem",
    padding: "0.625rem 1.75rem",
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.9375rem",
    fontWeight: "var(--typography-label-large-font-weight)",
    lineHeight: "var(--typography-label-large-line-height)",
    boxShadow: disabled ? "none" : "var(--effect-soft-shadow)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

// Same dot pattern as the onboarding flow's progress indicator — reused
// here so Reset Password's own 3-step sequence (request → code → new
// password) reads the same way.
const RESET_STEP_ORDER: Array<"request" | "verify-code" | "new-password"> = [
  "request",
  "verify-code",
  "new-password",
];

function getStepDotStyle(active: boolean): React.CSSProperties {
  return {
    width: active ? "1.5rem" : "0.5rem",
    height: "0.5rem",
    borderRadius: "1rem",
    backgroundColor: active ? "var(--color-roles-primary)" : "var(--color-roles-surface-container-highest)",
    transition: "width 0.2s ease, background-color 0.2s ease",
  };
}

const TITLES: Record<AuthMode, string> = {
  login: "Log In",
  signup: "Create Account",
  "forgot-password": "Reset Password",
};

type FieldSpec = { id: string; label: string; value: string };

const PASSWORD_REQUIREMENTS: { label: string; test: (password: string) => boolean }[] = [
  { label: "Password must contain a lowercase letter", test: (password) => /[a-z]/.test(password) },
  { label: "Password must contain an uppercase letter", test: (password) => /[A-Z]/.test(password) },
  { label: "Password must contain a number", test: (password) => /[0-9]/.test(password) },
  { label: "Password must contain a special character(#@>^)", test: (password) => /[#@>^]/.test(password) },
  { label: "Minimum Of 8 Characters", test: (password) => password.length >= 8 },
];

// Standard visually-hidden technique: present in the accessibility tree and
// readable by screen readers, invisible and untouched in layout for everyone else.
const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5 9 17.5 20 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Requirements that are already met stay in the list instead of vanishing —
// shown checked and in the brand color — so meeting 4 of 5 rules reads as
// progress rather than the field still looking broken.
function PasswordRequirementList({ password }: { password: string }) {
  if (password.length === 0) return null;

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        marginTop: "var(--spacing-collection-extra-small-spacing)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-collection-extra-small-spacing)",
      }}
    >
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.test(password);
        return (
          <li key={requirement.label} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            {met && (
              <span style={{ display: "flex", flexShrink: 0, color: "var(--color-roles-primary)" }}>
                <CheckIcon />
              </span>
            )}
            <span style={met ? { ...fieldErrorStyle, color: "var(--color-roles-primary)" } : fieldErrorStyle}>
              {requirement.label}
              <span style={srOnlyStyle}>{met ? " — Met" : " — Not yet met"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AuthView({
  initialMode,
  initialRegistered,
}: {
  initialMode: AuthMode;
  initialRegistered: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [justRegistered, setJustRegistered] = useState(initialRegistered);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [justReset, setJustReset] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "verify-code" | "new-password">("request");
  const [resetInfo, setResetInfo] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const isPasswordValid = PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));
  const isSignupComplete = name.trim() !== "" && email.trim() !== "" && isPasswordValid;
  const isNewPasswordValid = PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(newPassword));
  const isNewPasswordStepComplete = isNewPasswordValid && confirmPassword.length > 0 && confirmPassword === newPassword;
  const router = useRouter();
  const { setActive } = useMarketingSection();

  useEffect(() => {
    document.title = `${TITLES[mode]} | Legible`;
  }, [mode]);

  function goHome(e: React.MouseEvent) {
    e.preventDefault();
    setActive("home");
    router.push("/");
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setFieldErrors({});
    setJustRegistered(false);
    setJustReset(false);
    setResetStep("request");
    setResetInfo("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    router.replace(`/auth?mode=${next}`, { scroll: false });
  }

  function clearFieldError(id: string) {
    setFieldErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function validateField(id: string, label: string, value: string): boolean {
    if (!value.trim()) {
      setFieldErrors((prev) => ({ ...prev, [id]: `${label} field Cannot Be Empty` }));
      return false;
    }
    clearFieldError(id);
    return true;
  }

  const NAME_LETTERS_ONLY = /^[A-Za-z\s]*$/;

  function validateName(value: string): boolean {
    const trimmed = value.trim();

    if (!trimmed) {
      setFieldErrors((prev) => ({ ...prev, "signup-name": "Full name field Cannot Be Empty" }));
      return false;
    }
    if (!NAME_LETTERS_ONLY.test(value)) {
      setFieldErrors((prev) => ({ ...prev, "signup-name": "Full Name Must Use Only Letters" }));
      return false;
    }

    // Everything after the first word must contain a real second word,
    // not just trailing whitespace — first + last name at minimum.
    // A 3rd, 4th, ... word (middle names, double surnames) is fine and collected as-is.
    const firstWordEnd = trimmed.indexOf(" ");
    const restAfterFirstWord = firstWordEnd === -1 ? "" : trimmed.slice(firstWordEnd).trim();
    if (!restAfterFirstWord) {
      setFieldErrors((prev) => ({ ...prev, "signup-name": "Full Name Must Contain At Least 2 Words" }));
      return false;
    }

    clearFieldError("signup-name");
    return true;
  }

  function validateEmailFormat(id: string, value: string): boolean {
    if (!value.trim()) {
      setFieldErrors((prev) => ({ ...prev, [id]: "Email field Cannot Be Empty" }));
      return false;
    }

    // Real-time: flag it as soon as they start typing, clear it the moment
    // a domain shows up after the @ (e.g. "jane@e" is enough to clear it).
    const atIndex = value.indexOf("@");
    const hasDomainAfterAt = atIndex !== -1 && value.slice(atIndex + 1).trim().length > 0;
    if (!hasDomainAfterAt) {
      setFieldErrors((prev) => ({ ...prev, [id]: "Enter A Valid Email Address" }));
      return false;
    }

    clearFieldError(id);
    return true;
  }

  function validateSignupEmail(value: string): boolean {
    return validateEmailFormat("signup-email", value);
  }

  function validateAll(fields: FieldSpec[]): boolean {
    let allValid = true;
    for (const field of fields) {
      if (!validateField(field.id, field.label, field.value)) {
        allValid = false;
      }
    }
    return allValid;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loginSubmitting) return;
    setError("");

    const trimmedEmail = email.trimEnd();
    const trimmedPassword = password.trimEnd();
    if (trimmedEmail !== email) setEmail(trimmedEmail);
    if (trimmedPassword !== password) setPassword(trimmedPassword);

    const valid = validateAll([
      { id: "login-email", label: "Email", value: trimmedEmail },
      { id: "login-password", label: "Password", value: trimmedPassword },
    ]);
    if (!valid) return;

    setLoginSubmitting(true);
    try {
      const res = await signIn("credentials", {
        email: trimmedEmail,
        password: trimmedPassword,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid credentials");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (signupSubmitting) return;
    setError("");

    const trimmedName = name.trimEnd();
    const trimmedEmail = email.trimEnd();
    const trimmedPassword = password.trimEnd();
    if (trimmedName !== name) setName(trimmedName);
    if (trimmedEmail !== email) setEmail(trimmedEmail);
    if (trimmedPassword !== password) setPassword(trimmedPassword);

    const nameValid = validateName(trimmedName);
    const emailValid = validateSignupEmail(trimmedEmail);
    const passwordValid = validateField("signup-password", "Password", trimmedPassword);
    if (!nameValid || !emailValid || !passwordValid) return;

    setSignupSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail, password: trimmedPassword }),
      });

      if (res.ok) {
        const signInRes = await signIn("credentials", {
          email: trimmedEmail,
          password: trimmedPassword,
          redirect: false,
        });

        setName("");
        setEmail("");
        setPassword("");

        if (signInRes?.error) {
          // Account was created but auto sign-in failed; fall back to asking
          // the user to log in manually rather than losing the new account.
          switchMode("login");
          setJustRegistered(true);
          return;
        }

        router.push("/onboarding");
      } else {
        const data = await res.json();
        setError(data.message || "Sign up failed");
      }
    } finally {
      setSignupSubmitting(false);
    }
  }

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetSubmitting) return;
    setError("");
    setResetInfo("");

    const trimmedEmail = email.trimEnd();
    if (trimmedEmail !== email) setEmail(trimmedEmail);
    if (!validateEmailFormat("reset-email", trimmedEmail)) return;

    setResetSubmitting(true);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = await res.json();

      if (res.ok) {
        setResetInfo(data.message);
        setResetStep("verify-code");
      } else {
        setError(data.message || "Something went wrong. Try again.");
      }
    } finally {
      setResetSubmitting(false);
    }
  }

  async function handleResendResetCode() {
    setError("");
    const res = await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trimEnd() }),
    });
    const data = await res.json();
    setResetInfo(data.message || "");
  }

  async function handleVerifyResetCode(e: React.FormEvent) {
    e.preventDefault();
    if (resetSubmitting) return;
    setError("");

    if (!validateField("reset-code", "Code", resetCode)) return;

    setResetSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trimEnd(), code: resetCode }),
      });
      const data = await res.json();

      if (res.ok) {
        setResetInfo("");
        setResetStep("new-password");
      } else {
        setError(data.message || "Invalid code");
      }
    } finally {
      setResetSubmitting(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (resetSubmitting) return;
    setError("");

    const passwordValid = validateField("reset-new-password", "New password", newPassword);
    const confirmValid = validateField("reset-confirm-password", "Confirm password", confirmPassword);
    if (!passwordValid || !confirmValid) return;
    if (!isNewPasswordValid) {
      setFieldErrors((prev) => ({ ...prev, "reset-new-password": "Password does not meet the requirements" }));
      return;
    }
    if (confirmPassword !== newPassword) {
      setFieldErrors((prev) => ({ ...prev, "reset-confirm-password": "Passwords do not match" }));
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trimEnd(), code: resetCode, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setPassword("");
        switchMode("login");
        setJustReset(true);
      } else {
        setError(data.message || "Could not reset password");
      }
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: "safe center",
        alignItems: "center",
        paddingTop: "var(--spacing-collection-base-spacing)",
        paddingBottom: "var(--spacing-collection-base-spacing)",
        paddingLeft: "var(--spacing-collection-very-large-spacing)",
        paddingRight: "var(--spacing-collection-very-large-spacing)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: "26rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "var(--spacing-collection-very-large-spacing)",
          }}
        >
          <Link href="/" onClick={goHome} aria-label="Go to homepage">
            <Image
              src="/favicon.svg"
              alt="Legible Favicon Logo"
              width={48}
              height={48}
              style={{ borderRadius: "0.75rem" }}
            />
          </Link>
        </div>

        <h1
          style={{
            fontFamily: "var(--typography-headline-small-font-family)",
            fontSize: "var(--typography-headline-small-font-size)",
            lineHeight: "var(--typography-headline-small-line-height)",
            letterSpacing: "var(--typography-headline-small-letter-spacing)",
            fontWeight: "var(--typography-headline-small-font-weight)",
            marginBottom: "var(--spacing-collection-small-spacing)",
            textAlign: "center",
          }}
        >
          {TITLES[mode]}
        </h1>

        <p
          style={{
            fontFamily: "var(--typography-body-medium-font-family)",
            fontSize: "var(--typography-body-medium-font-size)",
            lineHeight: "var(--typography-body-medium-line-height)",
            color: "var(--color-roles-on-surface-variant)",
            marginBottom: "var(--spacing-collection-base-spacing)",
            textAlign: "center",
          }}
        >
          {mode === "login" && "Sign in to pick up where you left off."}
          {mode === "signup" && "Start turning photos of handwritten notes into a digital book."}
          {mode === "forgot-password" && resetStep === "request" && "Enter your email and we'll send you a reset code."}
          {mode === "forgot-password" && resetStep === "verify-code" && "Enter the code we sent you."}
          {mode === "forgot-password" && resetStep === "new-password" && "Choose a new password."}
        </p>

        {mode === "forgot-password" && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.375rem",
              marginBottom: "var(--spacing-collection-base-spacing)",
            }}
          >
            {RESET_STEP_ORDER.map((step) => (
              <div key={step} style={getStepDotStyle(step === resetStep)} />
            ))}
          </div>
        )}

        {(justRegistered || justReset) && mode === "login" && (
          <div
            role="status"
            style={{
              backgroundColor: "var(--color-roles-primary-container)",
              color: "var(--color-roles-on-primary-container)",
              borderRadius: "0.75rem",
              padding: "var(--spacing-collection-base-spacing)",
              marginBottom: "var(--spacing-collection-base-spacing)",
              textAlign: "center",
              fontFamily: "var(--typography-body-medium-font-family)",
              fontSize: "var(--typography-body-medium-font-size)",
              lineHeight: "var(--typography-body-medium-line-height)",
            }}
          >
            {justReset ? "Password reset — log in with your new password." : "Account created — log in below."}
          </div>
        )}

        {resetInfo && mode === "forgot-password" && (
          <div
            role="status"
            style={{
              backgroundColor: "var(--color-roles-primary-container)",
              color: "var(--color-roles-on-primary-container)",
              borderRadius: "0.75rem",
              padding: "var(--spacing-collection-base-spacing)",
              marginBottom: "var(--spacing-collection-base-spacing)",
              textAlign: "center",
              fontFamily: "var(--typography-body-medium-font-family)",
              fontSize: "var(--typography-body-medium-font-size)",
              lineHeight: "var(--typography-body-medium-line-height)",
            }}
          >
            {resetInfo}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: "var(--color-roles-error-container)",
              color: "var(--color-roles-on-error-container)",
              borderRadius: "0.75rem",
              padding: "var(--spacing-collection-base-spacing)",
              marginBottom: "var(--spacing-collection-base-spacing)",
              textAlign: "center",
              fontFamily: "var(--typography-body-medium-font-family)",
              fontSize: "var(--typography-body-medium-font-size)",
              lineHeight: "var(--typography-body-medium-line-height)",
            }}
          >
            {error}
          </div>
        )}

        {mode === "login" && (
          <form
            onSubmit={handleLogin}
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-medium-spacing)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="login-email" style={labelStyle}>Email</label>
              <input
                id="login-email"
                type="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("login-email");
                }}
                onBlur={() => {
                  const trimmed = email.trimEnd();
                  if (trimmed !== email) setEmail(trimmed);
                  validateField("login-email", "Email", trimmed);
                }}
                aria-invalid={Boolean(fieldErrors["login-email"])}
                aria-describedby={fieldErrors["login-email"] ? "login-email-error" : undefined}
                className="contact-input"
                style={getInputStyle(Boolean(fieldErrors["login-email"]))}
              />
              {fieldErrors["login-email"] && (
                <span id="login-email-error" role="alert" style={fieldErrorStyle}>
                  {fieldErrors["login-email"]}
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="login-password" style={labelStyle}>Password</label>
                <button
                  type="button"
                  onClick={() => switchMode("forgot-password")}
                  className="nav-link-hover"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--typography-label-medium-font-family)", fontSize: "var(--typography-label-medium-font-size)", color: "var(--color-roles-primary)", paddingBottom: "1px" }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("login-password");
                    if (!e.target.value) setShowLoginPassword(false);
                  }}
                  onBlur={() => {
                    const trimmed = password.trimEnd();
                    if (trimmed !== password) setPassword(trimmed);
                    validateField("login-password", "Password", trimmed);
                  }}
                  aria-invalid={Boolean(fieldErrors["login-password"])}
                  aria-describedby={fieldErrors["login-password"] ? "login-password-error" : undefined}
                  className="contact-input"
                  style={getInputStyle(Boolean(fieldErrors["login-password"]), true)}
                />
                {password.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                    aria-pressed={showLoginPassword}
                    style={passwordToggleButtonStyle}
                  >
                    <EyeIcon open={showLoginPassword} />
                  </button>
                )}
              </div>
              {fieldErrors["login-password"] && (
                <span id="login-password-error" role="alert" style={fieldErrorStyle}>
                  {fieldErrors["login-password"]}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="contact-submit-button"
              disabled={loginSubmitting}
              style={getSubmitButtonStyle(loginSubmitting)}
            >
              {loginSubmitting ? "Logging in…" : "Log In"}
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form
            onSubmit={handleSignUp}
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-medium-spacing)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="signup-name" style={labelStyle}>Full name</label>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError("signup-name");
                }}
                onBlur={() => {
                  const trimmed = name.trimEnd();
                  if (trimmed !== name) setName(trimmed);
                  validateName(trimmed);
                }}
                aria-invalid={Boolean(fieldErrors["signup-name"])}
                aria-describedby={fieldErrors["signup-name"] ? "signup-name-error" : undefined}
                className="contact-input"
                style={getInputStyle(Boolean(fieldErrors["signup-name"]))}
              />
              {fieldErrors["signup-name"] && (
                <span id="signup-name-error" role="alert" style={fieldErrorStyle}>
                  {fieldErrors["signup-name"]}
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="signup-email" style={labelStyle}>Email</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("signup-email");
                }}
                onBlur={() => {
                  const trimmed = email.trimEnd();
                  if (trimmed !== email) setEmail(trimmed);
                  validateSignupEmail(trimmed);
                }}
                aria-invalid={Boolean(fieldErrors["signup-email"])}
                aria-describedby={fieldErrors["signup-email"] ? "signup-email-error" : undefined}
                className="contact-input"
                style={getInputStyle(Boolean(fieldErrors["signup-email"]))}
              />
              {fieldErrors["signup-email"] && (
                <span id="signup-email-error" role="alert" style={fieldErrorStyle}>
                  {fieldErrors["signup-email"]}
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="signup-password" style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-password"
                  type={showSignupPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("signup-password");
                    if (!e.target.value) setShowSignupPassword(false);
                  }}
                  onBlur={() => {
                    const trimmed = password.trimEnd();
                    if (trimmed !== password) setPassword(trimmed);
                    validateField("signup-password", "Password", trimmed);
                  }}
                  aria-invalid={Boolean(fieldErrors["signup-password"])}
                  aria-describedby={fieldErrors["signup-password"] ? "signup-password-error" : undefined}
                  className="contact-input"
                  style={getInputStyle(Boolean(fieldErrors["signup-password"]), true)}
                />
                {password.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((prev) => !prev)}
                    aria-label={showSignupPassword ? "Hide password" : "Show password"}
                    aria-pressed={showSignupPassword}
                    style={passwordToggleButtonStyle}
                  >
                    <EyeIcon open={showSignupPassword} />
                  </button>
                )}
              </div>
              {fieldErrors["signup-password"] && (
                <span id="signup-password-error" role="alert" style={fieldErrorStyle}>
                  {fieldErrors["signup-password"]}
                </span>
              )}
              <PasswordRequirementList password={password} />
            </div>

            <button
              type="submit"
              className="contact-submit-button"
              disabled={!isSignupComplete || signupSubmitting}
              style={getSubmitButtonStyle(!isSignupComplete || signupSubmitting)}
            >
              {signupSubmitting ? "Signing up…" : "Sign Up"}
            </button>
          </form>
        )}

        {mode === "forgot-password" && resetStep === "request" && (
          <form
            onSubmit={handleRequestReset}
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-medium-spacing)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="reset-email" style={labelStyle}>Email</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("reset-email");
                }}
                onBlur={() => {
                  const trimmed = email.trimEnd();
                  if (trimmed !== email) setEmail(trimmed);
                  validateEmailFormat("reset-email", trimmed);
                }}
                aria-invalid={Boolean(fieldErrors["reset-email"])}
                aria-describedby={fieldErrors["reset-email"] ? "reset-email-error" : undefined}
                className="contact-input"
                style={getInputStyle(Boolean(fieldErrors["reset-email"]))}
              />
              {fieldErrors["reset-email"] && (
                <span id="reset-email-error" role="alert" style={fieldErrorStyle}>
                  {fieldErrors["reset-email"]}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="contact-submit-button"
              disabled={resetSubmitting}
              style={getSubmitButtonStyle(resetSubmitting)}
            >
              {resetSubmitting ? "Sending…" : "Send reset code"}
            </button>
          </form>
        )}

        {mode === "forgot-password" && resetStep === "verify-code" && (
          <form
            onSubmit={handleVerifyResetCode}
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-medium-spacing)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="reset-code" style={labelStyle}>Reset code</label>
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={resetCode}
                onChange={(e) => {
                  setResetCode(e.target.value.replace(/\D/g, ""));
                  clearFieldError("reset-code");
                }}
                aria-invalid={Boolean(fieldErrors["reset-code"])}
                aria-describedby={fieldErrors["reset-code"] ? "reset-code-error" : undefined}
                className="contact-input"
                style={{ ...getInputStyle(Boolean(fieldErrors["reset-code"])), letterSpacing: "0.25rem" }}
              />
              {fieldErrors["reset-code"] && (
                <span id="reset-code-error" role="alert" style={fieldErrorStyle}>
                  {fieldErrors["reset-code"]}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="contact-submit-button"
              disabled={resetCode.length !== 6 || resetSubmitting}
              style={getSubmitButtonStyle(resetCode.length !== 6 || resetSubmitting)}
            >
              {resetSubmitting ? "Verifying…" : "Verify code"}
            </button>

            <button
              type="button"
              onClick={handleResendResetCode}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-roles-primary)", fontSize: "var(--typography-label-medium-font-size)" }}
            >
              Resend code
            </button>
          </form>
        )}

        {mode === "forgot-password" && resetStep === "new-password" && (
          <form
            onSubmit={handleResetPassword}
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-medium-spacing)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="reset-new-password" style={labelStyle}>New password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="reset-new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    clearFieldError("reset-new-password");
                    if (!e.target.value) setShowNewPassword(false);
                  }}
                  aria-invalid={Boolean(fieldErrors["reset-new-password"])}
                  aria-describedby={fieldErrors["reset-new-password"] ? "reset-new-password-error" : undefined}
                  className="contact-input"
                  style={getInputStyle(Boolean(fieldErrors["reset-new-password"]), true)}
                />
                {newPassword.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    aria-pressed={showNewPassword}
                    style={passwordToggleButtonStyle}
                  >
                    <EyeIcon open={showNewPassword} />
                  </button>
                )}
              </div>
              {fieldErrors["reset-new-password"] && (
                <span id="reset-new-password-error" role="alert" style={fieldErrorStyle}>
                  {fieldErrors["reset-new-password"]}
                </span>
              )}
              <PasswordRequirementList password={newPassword} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="reset-confirm-password" style={labelStyle}>Confirm new password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearFieldError("reset-confirm-password");
                    if (!e.target.value) setShowConfirmPassword(false);
                  }}
                  aria-invalid={Boolean(fieldErrors["reset-confirm-password"])}
                  aria-describedby={fieldErrors["reset-confirm-password"] ? "reset-confirm-password-error" : undefined}
                  className="contact-input"
                  style={getInputStyle(Boolean(fieldErrors["reset-confirm-password"]), true)}
                />
                {confirmPassword.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    aria-pressed={showConfirmPassword}
                    style={passwordToggleButtonStyle}
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                )}
              </div>
              {fieldErrors["reset-confirm-password"] && (
                <span id="reset-confirm-password-error" role="alert" style={fieldErrorStyle}>
                  {fieldErrors["reset-confirm-password"]}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="contact-submit-button"
              disabled={!isNewPasswordStepComplete || resetSubmitting}
              style={getSubmitButtonStyle(!isNewPasswordStepComplete || resetSubmitting)}
            >
              {resetSubmitting ? "Resetting…" : "Reset Password"}
            </button>
          </form>
        )}

        <p
          style={{
            marginTop: "var(--spacing-collection-base-spacing)",
            textAlign: "center",
            fontFamily: "var(--typography-body-medium-font-family)",
            fontSize: "var(--typography-body-medium-font-size)",
            color: "var(--color-roles-on-surface-variant)",
          }}
        >
          {mode === "login" && (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="nav-link-hover"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-roles-primary)" }}
              >
                Sign up
              </button>
            </>
          )}
          {mode === "signup" && (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="nav-link-hover"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-roles-primary)" }}
              >
                Log in
              </button>
            </>
          )}
          {mode === "forgot-password" && (
            <>
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="nav-link-hover"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-roles-primary)" }}
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
