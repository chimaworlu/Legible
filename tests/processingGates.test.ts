import { describe, expect, it } from "vitest";
import { checkCostCeiling, checkPlanAllowance } from "@/src/domain/processingGates";
import { getPlanLimits } from "@/src/domain/planLimits";

const freeLimits = getPlanLimits("FREE");

describe("checkPlanAllowance (R3/R31)", () => {
  it("allows processing under the monthly allowance", () => {
    expect(checkPlanAllowance(0, freeLimits).allowed).toBe(true);
  });

  it("blocks once the monthly allowance is used up", () => {
    const result = checkPlanAllowance(freeLimits.imagesPerMonth, freeLimits);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.action).toBe("block");
      expect(result.reason).toMatch(/monthly/i);
    }
  });
});

describe("checkCostCeiling (ai-pipeline.md law 10/11 — never exceed the per-book AI cost ceiling)", () => {
  it("allows a call that stays under the ceiling", () => {
    const result = checkCostCeiling({ aiCostSpentMinor: 0 }, 1000, 100);
    expect(result.allowed).toBe(true);
  });

  it("blocks a call that would push spend over the ceiling", () => {
    const result = checkCostCeiling({ aiCostSpentMinor: 950 }, 1000, 100);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.action).toBe("pause");
    }
  });

  it("blocks exactly at the boundary (spend + call > ceiling)", () => {
    const result = checkCostCeiling({ aiCostSpentMinor: 900 }, 1000, 101);
    expect(result.allowed).toBe(false);
  });

  it("allows exactly reaching the ceiling (spend + call === ceiling)", () => {
    const result = checkCostCeiling({ aiCostSpentMinor: 900 }, 1000, 100);
    expect(result.allowed).toBe(true);
  });
});
