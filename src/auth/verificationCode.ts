import { randomBytes, createHash, timingSafeEqual } from "crypto";

export const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_VERIFICATION_ATTEMPTS = 5;

// 32 bytes of CSPRNG entropy, folded down into a 6-digit code a user can type in.
export function generateVerificationCode(): string {
  const buffer = randomBytes(32);
  const num = buffer.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, "0");
}

export function hashVerificationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function verifyCodeHash(code: string, hash: string): boolean {
  const candidate = Buffer.from(hashVerificationCode(code));
  const expected = Buffer.from(hash);
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
