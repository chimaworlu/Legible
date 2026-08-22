import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Get started with Legible: learn how AI note structuring, honesty flags, and student plans work.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
