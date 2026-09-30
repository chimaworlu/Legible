import { z } from "zod";

// The one structured-output shape every provider adapter must produce
// (ai-pipeline.md law 2, law 6). Both adapters validate their provider's raw
// response against this exact schema before it ever reaches the pipeline —
// a response that fails validation is a failed call (law 6), never patched
// by hand.
export const aiSpanSchema = z.object({
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  // Provider-reported confidence. Deliberately not constrained to [0, 1]
  // here — an out-of-range value is one of the named fabrication signals
  // (law 7) and must survive validation so src/domain/transcription.ts can
  // flag it as a GAP, not be silently rejected or clamped at this layer.
  confidence: z.number(),
  // False when the provider itself marked this region unreadable — the
  // other named fabrication signal (law 7).
  readable: z.boolean(),
});

export const aiDiagramRegionSchema = z.object({
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  caption: z.string().optional(),
});

export const transcribeResponseSchema = z.object({
  text: z.string(),
  spans: z.array(aiSpanSchema),
  diagramRegions: z.array(aiDiagramRegionSchema),
});

export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;

export const summarySectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
});

export const summarizeResponseSchema = z.object({
  sections: z.array(summarySectionSchema),
});

export type SummarizeResponse = z.infer<typeof summarizeResponseSchema>;
