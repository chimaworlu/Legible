import { describe, expect, it } from "vitest";
import { detectFabricationSignals, isLengthInconsistent, sectionConfidenceFrom, toTranscriptionFlags } from "@/src/domain/transcription";
import type { AiSpan } from "@/src/services/ai";

function span(overrides: Partial<AiSpan> = {}): AiSpan {
  return { startOffset: 0, endOffset: 10, confidence: 0.95, readable: true, ...overrides };
}

describe("detectFabricationSignals (ai-pipeline.md law 7)", () => {
  it("flags an unreadable span", () => {
    const [flagged] = detectFabricationSignals([span({ readable: false })]);
    expect(flagged.fabricationSignal).toBe("UNREADABLE");
  });

  it("flags a confidence value outside 0-1", () => {
    const [tooHigh] = detectFabricationSignals([span({ confidence: 1.5 })]);
    const [negative] = detectFabricationSignals([span({ confidence: -0.1 })]);
    expect(tooHigh.fabricationSignal).toBe("CONFIDENCE_OUT_OF_RANGE");
    expect(negative.fabricationSignal).toBe("CONFIDENCE_OUT_OF_RANGE");
  });

  it("does not flag a normal readable, in-range span", () => {
    const [flagged] = detectFabricationSignals([span()]);
    expect(flagged.fabricationSignal).toBeNull();
  });
});

describe("isLengthInconsistent (ai-pipeline.md law 7, whole-response signal)", () => {
  it("flags text implausibly long for the image's estimated text area", () => {
    expect(isLengthInconsistent("x".repeat(10_000), 10)).toBe(true);
  });

  it("flags text implausibly short (empty) for a page with real text area", () => {
    expect(isLengthInconsistent("", 10_000)).toBe(true);
  });

  it("does not flag ordinary proportions", () => {
    expect(isLengthInconsistent("A normal paragraph of transcribed handwriting.", 1000)).toBe(false);
  });

  it("never flags when the area estimate is zero (nothing to compare against)", () => {
    expect(isLengthInconsistent("anything", 0)).toBe(false);
  });
});

describe("toTranscriptionFlags (R10/R11, law 8)", () => {
  const threshold = 0.8;

  it("converts a fabrication-signal span to GAP", () => {
    const flagged = detectFabricationSignals([span({ readable: false })]);
    const flags = toTranscriptionFlags(flagged, threshold, false);
    expect(flags).toEqual([{ startOffset: 0, endOffset: 10, type: "GAP" }]);
  });

  it("converts a below-threshold span to LOW", () => {
    const flagged = detectFabricationSignals([span({ confidence: 0.5 })]);
    const flags = toTranscriptionFlags(flagged, threshold, false);
    expect(flags).toEqual([{ startOffset: 0, endOffset: 10, type: "LOW" }]);
  });

  it("produces no flag for a confident, readable span", () => {
    const flagged = detectFabricationSignals([span({ confidence: 0.99 })]);
    const flags = toTranscriptionFlags(flagged, threshold, false);
    expect(flags).toEqual([]);
  });

  it("marks every span GAP when the whole response is length-inconsistent, regardless of per-span confidence", () => {
    const flagged = detectFabricationSignals([span({ confidence: 0.99 })]);
    const flags = toTranscriptionFlags(flagged, threshold, true);
    expect(flags).toEqual([{ startOffset: 0, endOffset: 10, type: "GAP" }]);
  });
});

describe("sectionConfidenceFrom", () => {
  it("is GAP if any GAP flag exists", () => {
    expect(sectionConfidenceFrom([{ startOffset: 0, endOffset: 1, type: "GAP" }, { startOffset: 1, endOffset: 2, type: "LOW" }])).toBe("GAP");
  });

  it("is LOW if any LOW flag exists and no GAP", () => {
    expect(sectionConfidenceFrom([{ startOffset: 0, endOffset: 1, type: "LOW" }])).toBe("LOW");
  });

  it("is HIGH with no flags", () => {
    expect(sectionConfidenceFrom([])).toBe("HIGH");
  });
});
