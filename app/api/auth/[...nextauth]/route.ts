import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/src/db/client";
import { checkRateLimit, extractClientIp } from "@/src/services/rateLimit";
import { config } from "@/src/config";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // security.md rule 3: per-IP and per-account throttles on login.
        // Rate-limited attempts fail the same way as wrong credentials
        // (return null) — never a distinct error — so this can't be used
        // as an oracle to detect throttling versus a bad password.
        const email = credentials.email.toLowerCase();
        const ip = extractClientIp(req?.headers);
        const [ipLimit, accountLimit] = await Promise.all([
          checkRateLimit(`login:ip:${ip}`, config.rateLimits.loginPerIp),
          checkRateLimit(`login:account:${email}`, config.rateLimits.loginPerAccount),
        ]);
        if (!ipLimit.allowed || !accountLimit.allowed) return null;

        // Emails are stored lowercased at signup; normalize here too so
        // login isn't case-sensitive against how the user originally typed it.
        const user = await prisma.user.findUnique({
          where: { email }
        });

        if (user && user.passwordHash && (await bcrypt.compare(credentials.password, user.passwordHash))) {
          return { id: user.id, email: user.email, name: user.name };
        }
        return null;
      }
    })
    // Note: Social login (Google etc) half of R27 is deferred, not dropped.
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: IS_PRODUCTION ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: IS_PRODUCTION,
        maxAge: SESSION_MAX_AGE_SECONDS,
      },
    },
    csrfToken: {
      name: IS_PRODUCTION ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: IS_PRODUCTION,
      },
    },
  },
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    async session({ session, token }: { session: unknown; token: unknown }) {
      const sess = session as { user?: { id: string; email?: string | null; name?: string | null }; expires: string };
      const tok = token as { sub: string };
      if (sess.user) {
        sess.user.id = tok.sub;
      }
      return sess;
    }
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
