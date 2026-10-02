import { describe, expect, it } from "vitest";
import { parseSubscriptionTxRef, userIdFromTxRef } from "@/src/services/billing/reconcile";

describe("parseSubscriptionTxRef", () => {
  it("extracts the userId, interval, and plan id from a well-formed tx_ref", () => {
    expect(parseSubscriptionTxRef("sub_ckuser123abc_monthly_242274_a1b2c3d4")).toEqual({
      userId: "ckuser123abc",
      interval: "monthly",
      planId: "242274",
    });
    expect(parseSubscriptionTxRef("sub_ckuser123abc_yearly_242276_a1b2c3d4")).toEqual({
      userId: "ckuser123abc",
      interval: "yearly",
      planId: "242276",
    });
  });

  it("returns null for a tx_ref missing the sub_ prefix", () => {
    expect(parseSubscriptionTxRef("other_ckuser123abc_monthly_242274_a1b2c3d4")).toBeNull();
  });

  it("returns null for an unrecognized interval", () => {
    expect(parseSubscriptionTxRef("sub_ckuser123abc_weekly_242274_a1b2c3d4")).toBeNull();
  });

  it("returns null for a non-numeric plan id", () => {
    expect(parseSubscriptionTxRef("sub_ckuser123abc_monthly_abc_a1b2c3d4")).toBeNull();
  });

  it("returns null for a legacy tx_ref with no plan id segment", () => {
    expect(parseSubscriptionTxRef("sub_ckuser123abc_monthly_a1b2c3d4")).toBeNull();
  });
});

describe("userIdFromTxRef", () => {
  it("returns just the userId for a well-formed tx_ref", () => {
    expect(userIdFromTxRef("sub_ckuser123abc_monthly_242274_a1b2c3d4")).toBe("ckuser123abc");
  });

  it("returns null for a malformed tx_ref", () => {
    expect(userIdFromTxRef("garbage")).toBeNull();
  });
});
