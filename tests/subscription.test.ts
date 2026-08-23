import { describe, expect, it } from "vitest";
import { daysUntil, isSubscriptionExpired, nextPeriodStart } from "@/src/domain/subscription";

const NOW = new Date("2026-08-21T12:00:00.000Z");

describe("isSubscriptionExpired", () => {
  it("is false for an AUTO, not-cancelled subscription even past its period end", () => {
    const subscription = {
      renewalMode: "AUTO" as const,
      status: "ACTIVE" as const,
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    };
    expect(isSubscriptionExpired(subscription, NOW)).toBe(false);
  });

  it("is false for a MANUAL subscription still within its period", () => {
    const subscription = {
      renewalMode: "MANUAL" as const,
      status: "ACTIVE" as const,
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    };
    expect(isSubscriptionExpired(subscription, NOW)).toBe(false);
  });

  it("is true for a MANUAL ACTIVE subscription past its period end", () => {
    const subscription = {
      renewalMode: "MANUAL" as const,
      status: "ACTIVE" as const,
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    };
    expect(isSubscriptionExpired(subscription, NOW)).toBe(true);
  });

  it("is true for an AUTO subscription that was cancelled and is past its period end", () => {
    const subscription = {
      renewalMode: "AUTO" as const,
      status: "ACTIVE" as const,
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      cancelAtPeriodEnd: true,
    };
    expect(isSubscriptionExpired(subscription, NOW)).toBe(true);
  });

  it("is false for a cancelled AUTO subscription still within its period (access continues until then)", () => {
    const subscription = {
      renewalMode: "AUTO" as const,
      status: "ACTIVE" as const,
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
      cancelAtPeriodEnd: true,
    };
    expect(isSubscriptionExpired(subscription, NOW)).toBe(false);
  });

  it("is false for a subscription already CANCELED (nothing left to expire)", () => {
    const subscription = {
      renewalMode: "MANUAL" as const,
      status: "CANCELED" as const,
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      cancelAtPeriodEnd: true,
    };
    expect(isSubscriptionExpired(subscription, NOW)).toBe(false);
  });
});

describe("nextPeriodStart", () => {
  it("starts now when there's no existing subscription", () => {
    expect(nextPeriodStart(null, NOW)).toEqual(NOW);
  });

  it("starts now when the existing subscription is already CANCELED", () => {
    const existing = {
      renewalMode: "MANUAL" as const,
      status: "CANCELED" as const,
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
      cancelAtPeriodEnd: true,
    };
    expect(nextPeriodStart(existing, NOW)).toEqual(NOW);
  });

  it("starts now when the existing period has already ended", () => {
    const existing = {
      renewalMode: "AUTO" as const,
      status: "ACTIVE" as const,
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    };
    expect(nextPeriodStart(existing, NOW)).toEqual(NOW);
  });

  it("queues after the existing period end when it's still running", () => {
    const periodEnd = new Date("2026-09-01T00:00:00.000Z");
    const existing = { renewalMode: "AUTO" as const, status: "ACTIVE" as const, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false };
    expect(nextPeriodStart(existing, NOW)).toEqual(periodEnd);
  });

  it("queues after the existing period end for a PAST_DUE subscription still in its grace period", () => {
    const periodEnd = new Date("2026-08-25T00:00:00.000Z");
    const existing = { renewalMode: "AUTO" as const, status: "PAST_DUE" as const, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false };
    expect(nextPeriodStart(existing, NOW)).toEqual(periodEnd);
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
