import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "@/src/db/client";
import { passwordResetCodeRepo } from "@/src/db/repositories/passwordResetCode";
import { verifyCodeHash, MAX_VERIFICATION_ATTEMPTS } from "@/src/auth/verificationCode";
import { checkRateLimit, extractClientIp, rateLimitedResponse } from "@/src/services/rateLimit";
import { config } from "@/src/config";

const BCRYPT_COST_FACTOR = 12;

// Same complexity policy shown to the user on signup: 8+ chars, lowercase,
// uppercase, number, special char.
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[#@>^]).{8,}$/;

const resetSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
  newPassword: z.string().regex(PASSWORD_POLICY, "Password does not meet the requirements"),
});

const INVALID_CODE_RESPONSE = { message: "Invalid or expired code. Request a new one." };

export async function POST(req: Request) {
  const ip = extractClientIp(req.headers);
  const rateLimit = await checkRateLimit(`password-reset-complete:ip:${ip}`, config.rateLimits.passwordResetCompletePerIp);
  if (!rateLimit.allowed) {
    return rateLimitedResponse();
  }

  const body = await req.json();
  const result = resetSchema.safeParse(body);
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

  const passwordHash = await bcrypt.hash(result.data.newPassword, BCRYPT_COST_FACTOR);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  // The code's job ends the moment it's used — delete it, same as verify-email.
  await passwordResetCodeRepo.delete(active.id);

  return Response.json({ message: "Password reset successfully" });
}
