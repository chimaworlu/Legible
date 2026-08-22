import type { Prisma } from "@prisma/client";
import { paymentLogRepo, type PaymentLogInput } from "@/src/db/repositories/paymentLog";

// Containers that hold customer PII or card metadata in Flutterwave
// payloads — dropped whole, wherever they appear, before storage
// (security.md rule 14: log ids, not content).
//
// Deliberately NOT a broader list of individual field names like "name" or
// "email": those words are also used for unrelated, non-PII fields
// elsewhere in the same payloads (e.g. a Payment Plan's own `plan.name`,
// "month") — a blanket field-name match would silently corrupt the log by
// stripping data that was never PII in the first place. Only the two known
// PII-bearing container keys are removed.
const SENSITIVE_CONTAINER_KEYS = new Set(["customer", "card"]);

// The customer's IP address, a sibling field alongside tx_ref/amount/status
// in charge payloads — also PII, but specific enough a name that (unlike
// "name" or "email") no unrelated field is realistically going to collide
// with it in these payloads.
const SENSITIVE_SCALAR_KEYS = new Set(["ip"]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_CONTAINER_KEYS.has(key) || SENSITIVE_SCALAR_KEYS.has(key)) continue;
      result[key] = redact(val);
    }
    return result;
  }
  return value;
}

export function redactPaymentPayload(raw: unknown): Prisma.InputJsonValue {
  return redact(raw) as Prisma.InputJsonValue;
}

// The write path for the audit trail. Logging must never break the actual
// payment flow — a failure here is caught and reported, never rethrown, so
// a PaymentLog outage can't turn a real grant (or a real rejection) into an
// unrelated 500.
export async function logPaymentEvent(input: PaymentLogInput): Promise<void> {
  try {
    await paymentLogRepo.create(input);
  } catch (error) {
    console.error("Failed to write PaymentLog row (payment flow continues regardless)", {
      source: input.source,
      eventType: input.eventType,
      error: error instanceof Error ? error.message : error,
    });
  }
}
