import type { AiSpan } from "@/src/services/ai";
import type { FlagType, SectionConfidence } from "@prisma/client";

// The one place "never fabricate" (ai-pipeline.md law 7, R10/R11) is
// enforced. Both provider adapters funnel their raw output through these
// same pure functions — an adapter never decides fabrication handling
// itself (law 3: normalization lives here, not per-provider).

export type FabricationSignal = "UNREADABLE" | "CONFIDENCE_OUT_OF_RANGE" | "LENGTH_INCONSISTENT";

export interface FlaggedSpan extends AiSpan {
  fabricationSignal: FabricationSignal | null;
}

// Named fabrication signals (law 7): text for a region the model marked
// unreadable, a confidence value missing or outside 0-1, or output length
// wildly inconsistent with the image's detected text area. Any one of these
// converts the affected span to a GAP flag, regardless of provider.
export function detectFabricationSignals(spans: AiSpan[]): FlaggedSpan[] {
  return spans.map((span) => {
    if (!span.readable) {
      return { ...span, fabricationSignal: "UNREADABLE" };
    }
    if (!Number.isFinite(span.confidence) || span.confidence < 0 || span.confidence > 1) {
      return { ...span, fabricationSignal: "CONFIDENCE_OUT_OF_RANGE" };
    }
    return { ...span, fabricationSignal: null };
  });
}

// Third named signal — checked at the whole-response level, since it's a
// property of total output length vs. the image, not any one span.
export function isLengthInconsistent(text: string, imageTextAreaEstimate: number): boolean {
  if (imageTextAreaEstimate <= 0) return false;
  // A page with a plausible text area should not transcribe to an
  // essentially empty string, nor to an implausibly large wall of text —
  // either extreme is a fabrication signal at the response level (law 7).
  const MIN_CHARS_PER_AREA_UNIT = 0.01;
  const MAX_CHARS_PER_AREA_UNIT = 50;
  const density = text.length / imageTextAreaEstimate;
  return density < MIN_CHARS_PER_AREA_UNIT || density > MAX_CHARS_PER_AREA_UNIT;
}

export interface NewTranscriptionFlag {
  startOffset: number;
  endOffset: number;
  type: FlagType;
  suggestion?: string;
}

// Maps flagged spans onto TranscriptionFlag rows (R10/R11, law 8). A
// fabrication-signal span always becomes GAP; a span below the configured
// confidence threshold becomes LOW; everything else produces no flag.
// `confidenceThreshold` is always a parameter — never a constant here
// (law 8's "the threshold value is config, never a constant in a stage").
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

// Drives Section.confidence: GAP if any GAP flag exists, else LOW if any LOW
// flag exists, else HIGH.
export function sectionConfidenceFrom(flags: NewTranscriptionFlag[]): SectionConfidence {
  if (flags.some((flag) => flag.type === "GAP")) return "GAP";
  if (flags.some((flag) => flag.type === "LOW")) return "LOW";
  return "HIGH";
}
