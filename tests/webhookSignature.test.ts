import { describe, expect, it } from "vitest";
import { isValidFlutterwaveSignature } from "@/src/services/billing/webhookSignature";

const SECRET_HASH = "test_secret_hash";

describe("isValidFlutterwaveSignature", () => {
  it("accepts a header that matches the configured secret hash", () => {
    expect(isValidFlutterwaveSignature(SECRET_HASH, SECRET_HASH)).toBe(true);
  });

  it("rejects a header that doesn't match", () => {
    expect(isValidFlutterwaveSignature("something-else", SECRET_HASH)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isValidFlutterwaveSignature(null, SECRET_HASH)).toBe(false);
  });

  it("rejects when no secret hash is configured", () => {
    expect(isValidFlutterwaveSignature(SECRET_HASH, "")).toBe(false);
  });

  it("rejects a same-length header that differs only in one character", () => {
    const almost = `${SECRET_HASH.slice(0, -1)}x`;
    expect(isValidFlutterwaveSignature(almost, SECRET_HASH)).toBe(false);
  });
});
