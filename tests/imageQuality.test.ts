import { describe, expect, it } from "vitest";
import { checkImageQuality } from "@/src/domain/imageQuality";
import { config } from "@/src/config";

describe("checkImageQuality (R4/R5 — intake quality gate)", () => {
  it("rejects a byte length under the configured floor", () => {
    const result = checkImageQuality({ byteLength: config.caps.minImageBytes - 1, format: "jpeg" });
    expect(result.passed).toBe(false);
    expect(result.qualityScore).toBe(0);
  });

  it("rejects an unrecognized format even with a healthy byte length", () => {
    const result = checkImageQuality({ byteLength: config.caps.minImageBytes * 10, format: "bmp" });
    expect(result.passed).toBe(false);
  });

  it("accepts a well-formed jpeg above the size floor", () => {
    const result = checkImageQuality({ byteLength: config.caps.minImageBytes * 10, format: "jpeg" });
    expect(result.passed).toBe(true);
    expect(result.qualityScore).toBe(1.0);
  });

  it("accepts formats case-insensitively", () => {
    const result = checkImageQuality({ byteLength: config.caps.minImageBytes * 10, format: "JPEG" });
    expect(result.passed).toBe(true);
  });
});
