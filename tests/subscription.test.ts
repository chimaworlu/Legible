import { describe, expect, it } from "vitest";
import { daysUntil, isManualSubscriptionExpired } from "@/src/domain/subscription";

const NOW = new Date("2026-08-21T12:00:00.000Z");

describe("isManualSubscriptionExpired", () => {
  it("is false for an AUTO subscription even past its period end", () => {
    const subscription = { renewalMode: "AUTO" as const, status: "ACTIVE" as const, currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z") };
    expect(isManualSubscriptionExpired(subscription, NOW)).toBe(false);
  });

  it("is false for a MANUAL subscription still within its period", () => {
    const subscription = { renewalMode: "MANUAL" as const, status: "ACTIVE" as const, currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z") };
    expect(isManualSubscriptionExpired(subscription, NOW)).toBe(false);
  });

  it("is true for a MANUAL ACTIVE subscription past its period end", () => {
    const subscription = { renewalMode: "MANUAL" as const, status: "ACTIVE" as const, currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z") };
    expect(isManualSubscriptionExpired(subscription, NOW)).toBe(true);
  });

  it("is false for a MANUAL subscription already CANCELED (nothing left to expire)", () => {
    const subscription = { renewalMode: "MANUAL" as const, status: "CANCELED" as const, currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z") };
    expect(isManualSubscriptionExpired(subscription, NOW)).toBe(false);
  });
});

describe("daysUntil", () => {
  it("rounds up partial days so time remaining is never understated", () => {
    const almostOneDay = new Date(NOW.getTime() + 23 * 60 * 60 * 1000);
    expect(daysUntil(almostOneDay, NOW)).toBe(1);
  });

  it("returns 0 for a date exactly now", () => {
    expect(daysUntil(NOW, NOW)).toBe(0);
  });

  it("returns a negative number for a date in the past", () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(daysUntil(yesterday, NOW)).toBe(-1);
  });
});
