import { z } from "zod";
import { prisma } from "@/src/db/client";
import { passwordResetCodeRepo } from "@/src/db/repositories/passwordResetCode";
import { verifyCodeHash, MAX_VERIFICATION_ATTEMPTS } from "@/src/auth/verificationCode";
import { checkRateLimit, extractClientIp, rateLimitedResponse } from "@/src/services/rateLimit";
import { config } from "@/src/config";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

const INVALID_CODE_RESPONSE = { message: "Invalid or expired code. Request a new one." };

// Checks the code without consuming it — the actual password reset
// (which deletes the code) still happens in POST /api/auth/reset-password.
export async function POST(req: Request) {
  const ip = extractClientIp(req.headers);
  const rateLimit = await checkRateLimit(`password-reset-verify:ip:${ip}`, config.rateLimits.passwordResetVerifyPerIp);
  if (!rateLimit.allowed) {
    return rateLimitedResponse();
  }

  const body = await req.json();
  const result = verifySchema.safeParse(body);
  if (!result.success) {
    return Response.json({ message: result.error.issues[0].message }, { status: 400 });
  }

  const email = result.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return Response.json(INVALID_CODE_RESPONSE, { status: 400 });
  }

  const active = await passwordResetCodeRepo.findActiveByUser(user.id);
  if (!active || active.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    if (active) await passwordResetCodeRepo.delete(active.id).catch(() => {});
    return Response.json(INVALID_CODE_RESPONSE, { status: 400 });
  }

  if (!verifyCodeHash(result.data.code, active.codeHash)) {
    const updated = await passwordResetCodeRepo.incrementAttempts(active.id);
    if (updated.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await passwordResetCodeRepo.delete(active.id).catch(() => {});
      return Response.json({ message: "Too many attempts. Request a new code." }, { status: 400 });
    }
    return Response.json({ message: "Invalid code" }, { status: 400 });
  }

  return Response.json({ message: "Code verified" });
}
