"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Lottie from "lottie-react";
import confettiAnimation from "@/public/animations/confetti.json";

const ANIMATION_DURATION_MS = 2500;

// Fires once when the user arrives fresh from onboarding (see the
// `?celebrate=1` redirects in app/(app)/onboarding/page.tsx for both the
// "Skip" and "Get Started" paths).
//
// Captured once via the useState initializer, not read reactively on every
// render: the URL is cleaned up below with a raw history.replaceState call
// rather than router.replace, because router.replace triggers a real Next.js
// navigation that re-fetches this page's server-rendered payload and briefly
// swaps the surrounding Suspense boundary to its fallback — which unmounts
// this component (and kills the animation) well before it finishes playing.
export function ConfettiCelebration() {
  const searchParams = useSearchParams();
  const [shouldCelebrate] = useState(() => searchParams.get("celebrate") === "1");
  const [visible, setVisible] = useState(shouldCelebrate);

  useEffect(() => {
    if (!shouldCelebrate) return;

    window.history.replaceState(null, "", "/dashboard");

    const timer = setTimeout(() => setVisible(false), ANIMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [shouldCelebrate]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      <Lottie animationData={confettiAnimation} loop={false} autoplay style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
