"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SWIPE_THRESHOLD_PX = 50;

const iconBadgeStyle: React.CSSProperties = {
  width: "4rem",
  height: "4rem",
  borderRadius: "50%",
  backgroundColor: "var(--color-roles-primary-container)",
  color: "var(--color-roles-on-primary-container)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto var(--spacing-collection-base-spacing)",
};

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--typography-headline-large-font-family)",
  fontSize: "var(--typography-headline-large-font-size)",
  lineHeight: "var(--typography-headline-large-line-height)",
  fontWeight: "var(--typography-headline-large-font-weight)",
  letterSpacing: "var(--typography-headline-large-letter-spacing)",
  marginBottom: "var(--spacing-collection-small-spacing)",
};

const bodyStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-large-font-family)",
  fontSize: "var(--typography-body-large-font-size)",
  lineHeight: "var(--typography-body-large-line-height)",
  color: "var(--color-roles-on-surface-variant)",
  marginBottom: "var(--spacing-collection-very-large-spacing)",
};

const skipButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: "var(--spacing-collection-base-spacing)",
  right: "var(--spacing-collection-base-spacing)",
  backgroundColor: "transparent",
  color: "var(--color-roles-on-surface-variant)",
  border: "1.5px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.375rem",
  padding: "0.5rem 1rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.875rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  cursor: "pointer",
};

const backLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0.625rem 1rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
};

function getSubmitButtonStyle(): React.CSSProperties {
  return {
    width: "100%",
    backgroundColor: "var(--color-roles-primary)",
    color: "var(--color-roles-on-primary)",
    border: "none",
    borderRadius: "0.375rem",
    padding: "0.875rem 1.75rem",
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.9375rem",
    fontWeight: "var(--typography-label-large-font-weight)",
    lineHeight: "var(--typography-label-large-line-height)",
    boxShadow: "var(--effect-soft-shadow)",
    cursor: "pointer",
  };
}

function getDotStyle(active: boolean): React.CSSProperties {
  return {
    width: active ? "1.5rem" : "0.5rem",
    height: "0.5rem",
    borderRadius: "1rem",
    backgroundColor: active ? "var(--color-roles-primary)" : "var(--color-roles-surface-container-highest)",
    transition: "width 0.2s ease, background-color 0.2s ease",
  };
}

// Mirrors the brand mark's own motif (see public/favicon.svg): a messy
// handwritten line resolving into clean, structured lines.
function TransformIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6 Q7 2.5 10 6" stroke="currentColor" strokeWidth="1.75" fill="none" strokeLinecap="round" />
      <path d="M4 12h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 17h6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M15 5.5 20 3v14l-5 2.5v-14Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function HonestyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16.2 16.2 21 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7.5 11.5c1-1.5 2.5-1.5 3.5 0s2.5 1.5 3.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2.2 2.2" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5 14.2 8.4l5.3.6-4 3.6 1.1 5.3L12 15.2l-4.6 2.7 1.1-5.3-4-3.6 5.3-.6L12 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const STEPS = [
  {
    icon: TransformIcon,
    title: "Welcome to Legible",
    body: "Snap a photo of your handwritten notes. We turn it into a clean, structured digital book. No retyping.",
  },
  {
    icon: HonestyIcon,
    title: "We never guess what we can't read",
    body: (
      <>
        If a word isn&apos;t clear, we say so instead of guessing.
        <br />
        You confirm it in a tap.
      </>
    ),
  },
  {
    icon: PlanIcon,
    title: "You're on the Free plan",
    body: "30 images, 3 books, every month, on us. Upgrade to Pro anytime to remove watermarks and raise your limits.",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const isLastStep = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;
  const touchStartX = useRef<number | null>(null);

  function handleNext() {
    if (isLastStep) {
      router.push("/dashboard?celebrate=1");
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  // Swipe is an addition, not a replacement — Next/Back stay fully
  // functional, so anything reachable by swipe is also reachable with a
  // single tap (WCAG 2.5.1 Pointer Gestures).
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    if (deltaX < 0) {
      handleNext();
    } else if (step > 0) {
      handleBack();
    }
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 var(--spacing-collection-large-spacing)", boxSizing: "border-box" }}>
      {!isLastStep && (
        <button type="button" onClick={() => router.push("/dashboard?celebrate=1")} style={skipButtonStyle}>
          Skip
        </button>
      )}

      <div
        role="group"
        aria-label={`Onboarding, step ${step + 1} of ${STEPS.length}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ maxWidth: "30rem", width: "100%", margin: "0 auto", textAlign: "center" }}
      >
        <div aria-live="polite" aria-atomic="true">
          <div style={iconBadgeStyle}>
            <Icon />
          </div>

          <h1 style={headingStyle}>{current.title}</h1>
          <p style={bodyStyle}>{current.body}</p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "0.375rem", marginBottom: "var(--spacing-collection-large-spacing)" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={getDotStyle(i === step)} />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <button type="button" onClick={handleNext} style={getSubmitButtonStyle()}>
            {isLastStep ? "Get Started" : "Next"}
          </button>
          {step > 0 && (
            <button type="button" onClick={handleBack} style={backLinkStyle}>
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
