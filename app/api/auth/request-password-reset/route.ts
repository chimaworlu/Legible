import { z } from "zod";
import { prisma } from "@/src/db/client";
import { passwordResetCodeRepo } from "@/src/db/repositories/passwordResetCode";
import { sendPasswordResetEmail } from "@/src/email/mailer";
import { generateVerificationCode, hashVerificationCode, VERIFICATION_CODE_TTL_MS } from "@/src/auth/verificationCode";
import { checkRateLimit, extractClientIp, rateLimitedResponse } from "@/src/services/rateLimit";
import { config } from "@/src/config";

const RESEND_COOLDOWN_MS = 60 * 1000;

const requestSchema = z.object({
  email: z.string().email(),
});

// Always returns the same generic message regardless of whether the email
// is registered, so this endpoint can't be used to enumerate accounts.
const GENERIC_RESPONSE = { message: "If an account exists for that email, we've sent a password reset code." };

export async function POST(req: Request) {
  const ip = extractClientIp(req.headers);
  const ipLimit = await checkRateLimit(`password-reset-request:ip:${ip}`, config.rateLimits.passwordResetRequestPerIp);
  if (!ipLimit.allowed) {
    return rateLimitedResponse(GENERIC_RESPONSE.message);
  }

  const body = await req.json();
  const result = requestSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ message: result.error.issues[0].message }, { status: 400 });
  }

  const email = result.data.email.toLowerCase();

  // Keyed by the submitted email itself (not "does this account exist") so
  // this can't be used to distinguish real accounts from typos by timing —
  // a nonexistent email just gets its own harmless bucket.
  const accountLimit = await checkRateLimit(`password-reset-request:account:${email}`, config.rateLimits.passwordResetRequestPerAccount);
  if (!accountLimit.allowed) {
    return rateLimitedResponse(GENERIC_RESPONSE.message);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return Response.json(GENERIC_RESPONSE);
  }

  const latest = await passwordResetCodeRepo.findLatestByUser(user.id);
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    // Still return the generic message — don't reveal that a cooldown (i.e.
    // an account) exists to a potential enumerator.
    return Response.json(GENERIC_RESPONSE);
  }

  await passwordResetCodeRepo.invalidateActiveForUser(user.id);
  const code = generateVerificationCode();
  await passwordResetCodeRepo.create({
    userId: user.id,
    codeHash: hashVerificationCode(code),
    expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
  });

  sendPasswordResetEmail(user.email, code).catch((err) => {
    console.error("Failed to send password reset email", { userId: user.id, error: err instanceof Error ? err.message : err });
  });

  return Response.json(GENERIC_RESPONSE);
}
