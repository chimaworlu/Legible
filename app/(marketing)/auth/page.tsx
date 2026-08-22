import type { Metadata } from "next";
import { AuthView, type AuthMode } from "../../../src/components/auth/AuthView";

type SearchParams = Promise<{ mode?: string; registered?: string }>;

function resolveMode(mode?: string): AuthMode {
  if (mode === "signup" || mode === "forgot-password") return mode;
  return "login";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const resolved = resolveMode((await searchParams).mode);

  const copy: Record<AuthMode, { title: string; description: string }> = {
    login: {
      title: "Log In",
      description: "Sign in to your Legible account to access your digital books and handwritten notes.",
    },
    signup: {
      title: "Create Account",
      description: "Create a free Legible account and start turning photos of handwritten notes into digital books.",
    },
    "forgot-password": {
      title: "Reset Password",
      description: "Reset the password for your Legible account.",
    },
  };

  return copy[resolved];
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { mode, registered } = await searchParams;

  return (
    <AuthView
      initialMode={resolveMode(mode)}
      initialRegistered={registered === "true"}
    />
  );
}
