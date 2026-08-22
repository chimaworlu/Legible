import { verificationCodeRepo } from "../db/repositories/verificationCode";
import { sendVerificationEmail } from "../email/mailer";
import { generateVerificationCode, hashVerificationCode, VERIFICATION_CODE_TTL_MS } from "./verificationCode";

export async function issueVerificationCode(userId: string, email: string): Promise<void> {
  await verificationCodeRepo.invalidateActiveForUser(userId);

  const code = generateVerificationCode();
  await verificationCodeRepo.create({
    userId,
    codeHash: hashVerificationCode(code),
    expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
  });

  await sendVerificationEmail(email, code);
}
