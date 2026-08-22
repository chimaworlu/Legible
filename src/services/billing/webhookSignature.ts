import { timingSafeEqual } from "crypto";

// developer.flutterwave.com/v3.0.0/docs/webhooks: the `verif-hash` header
// must equal the secret hash you configured in the dashboard — a direct
// comparison, not an HMAC. Using a timing-safe comparison anyway, since
// there's no downside to it for a security-sensitive equality check.
export function isValidFlutterwaveSignature(signatureHeader: string | null, secretHash: string): boolean {
  if (!signatureHeader || !secretHash) return false;

  const expectedBuffer = Buffer.from(secretHash);
  const actualBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
