import { describe, expect, it } from "vitest";
import { redactPaymentPayload } from "@/src/services/billing/paymentLog";

describe("redactPaymentPayload", () => {
  it("strips customer and card objects wherever they appear", () => {
    const raw = {
      event: "charge.completed",
      data: {
        id: 123,
        tx_ref: "sub_abc_123",
        status: "successful",
        amount: 5000,
        currency: "NGN",
        customer: { id: 1, email: "person@example.com", name: "Jane Doe" },
        card: { first_6digits: "536613", last_4digits: "8816", issuer: "MASTERCARD" },
      },
    };

    const redacted = redactPaymentPayload(raw) as typeof raw;

    expect(JSON.stringify(redacted)).not.toContain("person@example.com");
    expect(JSON.stringify(redacted)).not.toContain("Jane Doe");
    expect(JSON.stringify(redacted)).not.toContain("536613");
    expect((redacted.data as Record<string, unknown>).customer).toBeUndefined();
    expect((redacted.data as Record<string, unknown>).card).toBeUndefined();
  });

  it("strips top-level PII-shaped keys used by subscription.cancelled payloads", () => {
    const raw = {
      event: "subscription.cancelled",
      data: {
        status: "deactivated",
        currency: "NGN",
        amount: 5000,
        customer: { email: "person@example.com", full_name: "Anonymous customer" },
        plan: { id: 1, name: "month", amount: 5000, currency: "NGN", interval: "monthly" },
      },
    };

    const redacted = redactPaymentPayload(raw) as { data: Record<string, unknown> };

    expect(redacted.data.customer).toBeUndefined();
    expect(redacted.data.plan).toEqual(raw.data.plan);
  });

  it("keeps every non-PII transactional field intact", () => {
    const raw = { event: "charge.completed", data: { id: 1, tx_ref: "sub_a_1", status: "successful", amount: 5000, currency: "NGN" } };
    expect(redactPaymentPayload(raw)).toEqual(raw);
  });

  it("strips the customer's IP address", () => {
    const raw = { event: "charge.completed", data: { id: 1, tx_ref: "sub_a_1", status: "successful", ip: "72.140.222.142" } };
    const redacted = redactPaymentPayload(raw) as { data: Record<string, unknown> };
    expect(redacted.data.ip).toBeUndefined();
    expect(redacted.data.tx_ref).toBe("sub_a_1");
  });

  it("handles null and primitive input without throwing", () => {
    expect(redactPaymentPayload(null)).toBe(null);
    expect(redactPaymentPayload("plain string")).toBe("plain string");
    expect(redactPaymentPayload(42)).toBe(42);
  });
});
