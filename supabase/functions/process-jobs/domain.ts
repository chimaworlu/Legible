// Raw port of src/domain/{imageQuality,processingGates,planLimits,transcription}.ts
// — pure functions, copied verbatim in logic (not reinterpreted). Kept
// separate from the Node originals because Deno can't import a `@/` alias
// or reach outside this function's own folder; this is the same code, not a
// redesign.

const ACCEPTED_FORMATS = new Set(["jpeg", "jpg", "png", "heic", "heif"]);
const MIN_IMAGE_BYTES = 2048; // config.caps.minImageBytes

export function checkImageQuality(input: { byteLength: number; format: string }): { passed: boolean; qualityScore: number; reason?: string } {
  if (input.byteLength < MIN_IMAGE_BYTES) {
    return { passed: false, qualityScore: 0, reason: "Image file is too small to be a valid photo (likely truncated or corrupt)." };
  }
  if (!ACCEPTED_FORMATS.has(input.format.toLowerCase())) {
    return { passed: false, qualityScore: 0, reason: `Unrecognized image format: ${input.format}` };
  }
  return { passed: true, qualityScore: 1.0 };
}

export type GateResult = { allowed: true } | { allowed: false; reason: string };

export function checkCostCeiling(book: { aiCostSpentMinor: number }, ceilingMinor: number, estimatedCallCostMinor: number): GateResult {
  if (book.aiCostSpentMinor + estimatedCallCostMinor > ceilingMinor) {
    return { allowed: false, reason: "This book has reached its AI processing cost ceiling. Spend credits or upgrade to continue processing." };
  }
  return { allowed: true };
}

const BOOK_AI_COST_CEILING_MINOR_FREE = 20 * 2000;
const BOOK_AI_COST_CEILING_MINOR_PRO = 300 * 2000;

export function bookAiCostCeilingMinorFor(plan: "FREE" | "PRO"): number {
  return plan === "PRO" ? BOOK_AI_COST_CEILING_MINOR_PRO : BOOK_AI_COST_CEILING_MINOR_FREE;
}

export interface AiSpan {
  startOffset: number;
  endOffset: number;
  confidence: number;
  readable: boolean;
}

export type FabricationSignal = "UNREADABLE" | "CONFIDENCE_OUT_OF_RANGE" | "LENGTH_INCONSISTENT";
export interface FlaggedSpan extends AiSpan {
  fabricationSignal: FabricationSignal | null;
}

export function detectFabricationSignals(spans: AiSpan[]): FlaggedSpan[] {
  return spans.map((span) => {
    if (!span.readable) return { ...span, fabricationSignal: "UNREADABLE" };
    if (!Number.isFinite(span.confidence) || span.confidence < 0 || span.confidence > 1) {
      return { ...span, fabricationSignal: "CONFIDENCE_OUT_OF_RANGE" };
    }
    return { ...span, fabricationSignal: null };
  });
}

export function isLengthInconsistent(text: string, imageTextAreaEstimate: number): boolean {
  if (imageTextAreaEstimate <= 0) return false;
  const MIN_CHARS_PER_AREA_UNIT = 0.01;
  const MAX_CHARS_PER_AREA_UNIT = 50;
  const density = text.length / imageTextAreaEstimate;
  return density < MIN_CHARS_PER_AREA_UNIT || density > MAX_CHARS_PER_AREA_UNIT;
}

export interface NewTranscriptionFlag {
  startOffset: number;
  endOffset: number;
  type: "LOW" | "GAP";
}

export function toTranscriptionFlags(spans: FlaggedSpan[], confidenceThreshold: number, wholeResponseLengthInconsistent: boolean): NewTranscriptionFlag[] {
  return spans
    .map((span): NewTranscriptionFlag | null => {
      if (span.fabricationSignal !== null || wholeResponseLengthInconsistent) {
        return { startOffset: span.startOffset, endOffset: span.endOffset, type: "GAP" };
      }
      if (span.confidence < confidenceThreshold) {
        return { startOffset: span.startOffset, endOffset: span.endOffset, type: "LOW" };
      }
      return null;
    })
    .filter((flag): flag is NewTranscriptionFlag => flag !== null);
}

export function sectionConfidenceFrom(flags: NewTranscriptionFlag[]): "HIGH" | "LOW" | "GAP" {
  if (flags.some((flag) => flag.type === "GAP")) return "GAP";
  if (flags.some((flag) => flag.type === "LOW")) return "LOW";
  return "HIGH";
}
