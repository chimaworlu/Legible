import { describe, expect, it } from "vitest";
import { getPlanLimits, checkImageUploadAllowance } from "@/src/domain/planLimits";

const freeLimits = getPlanLimits("FREE");

describe("checkImageUploadAllowance (R3, R31)", () => {
  it("allows an upload within the monthly allowance and per-book cap", () => {
    const result = checkImageUploadAllowance(freeLimits, 5, 10, 0);
    expect(result.allowed).toBe(true);
  });

  it("blocks an upload that exceeds the monthly allowance", () => {
    const result = checkImageUploadAllowance(freeLimits, 25, 10, 0);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.message).toMatch(/monthly allowance/);
    }
  });

  it("blocks an upload with zero images left this month", () => {
    const result = checkImageUploadAllowance(freeLimits, 30, 1, 0);
    expect(result.allowed).toBe(false);
  });

  it("blocks an upload that exceeds the per-book cap", () => {
    const result = checkImageUploadAllowance(freeLimits, 0, freeLimits.imagesPerBook + 1, 0);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.message).toMatch(/per book|at most/);
    }
  });

  it("counts images already in the book against the per-book cap", () => {
    const result = checkImageUploadAllowance(freeLimits, 0, 5, freeLimits.imagesPerBook - 2);
    expect(result.allowed).toBe(false);
  });

  it("never returns a negative remaining allowance", () => {
    const result = checkImageUploadAllowance(freeLimits, 100, 1, 0);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.message).toMatch(/0 images left/);
    }
  });
});
