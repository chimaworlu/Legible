import { config } from "@/src/config";
import { deepseekAiService } from "./providers/deepseek";
import { geminiAiService } from "./providers/gemini";

// The single AI service interface (AGENTS.md section 4, ai-pipeline.md laws
// 1-4). Every pipeline stage talks to this interface only — no provider
// name, SDK import, model string, or provider-specific prompt quirk exists
// outside src/services/ai. Reach a provider adapter only through
// getAiService() below; never import a provider file directly from a
// worker job, route, or domain module.

export type AiTaskType = "transcribe" | "caption" | "group";

export interface AiImageRef {
  storageKey: string;
  mimeType: string;
  bytes: Uint8Array;
}

// One span of the transcribed text, mapped onto the shared contract
// (ai-pipeline.md law 2). `readable` and out-of-range `confidence` are the
// fabrication signals src/domain/transcription.ts checks for (law 7).
export interface AiSpan {
  startOffset: number;
  endOffset: number;
  confidence: number;
  readable: boolean;
}

export interface AiDiagramRegion {
  boundingBox: { x: number; y: number; width: number; height: number };
  caption?: string;
}

export interface TranscribeResult {
  text: string;
  spans: AiSpan[];
  diagramRegions: AiDiagramRegion[];
  // Real cost of this call in kobo, from the provider's own usage data
  // (law 11) — never a flat estimate computed here.
  costMinor: number;
}

export interface SummarySection {
  heading: string;
  body: string;
}

export interface SummarizeResult {
  sections: SummarySection[];
  // Real cost of this call in kobo, from the provider's own usage data
  // (law 11) — never a flat estimate computed here.
  costMinor: number;
}

export interface AiService {
  transcribe(image: AiImageRef): Promise<TranscribeResult>;
  // Text-in, text-out — a condensed restatement of already-transcribed
  // text, never a replacement for it (Section.summary is its own field,
  // always shown separately from Section.originalText). Still bound by the
  // same no-fabrication spirit as transcribe: the prompt (see
  // prompts/summarize.ts) instructs the model to restate, not invent facts
  // the source text doesn't contain.
  summarize(text: string): Promise<SummarizeResult>;
}

// caption/group task types are declared for the full contract (law 2) but
// have no adapter yet — STRUCTURE (Stage 5 grouping) is out of scope for
// the transcribe-only pass this factory currently serves.

function serviceFor(provider: string): AiService {
  switch (provider) {
    case "deepseek":
      return deepseekAiService;
    case "gemini":
      return geminiAiService;
    default:
      // ai-pipeline.md law 5: no provider is enabled until its retention and
      // capability sign-offs are dated and recorded in that provider's
      // adapter file. This is correct, intentional behavior for an
      // unconfigured pipeline — never silently fall back to a provider that
      // hasn't cleared that gate.
      throw new Error(
        `No AI provider is enabled (config value is '${provider}'). ` +
          "See ai-pipeline.md law 5 — a provider adapter must record dated " +
          "retention and capability sign-offs before it can be activated.",
      );
  }
}

export function getAiService(): AiService {
  return serviceFor(config.ai.activeProvider);
}

// Summarization is a separate, on-demand feature from the TRANSCRIBE
// pipeline (never blended into it — R10/R11's honesty guarantee stays
// intact for the literal transcript) and is deliberately allowed to use a
// different active provider (law 4: the provider is selected in config,
// nowhere else) — DeepSeek has no vision capability, but this call is
// text-only, so its capability gap for TRANSCRIBE doesn't apply here.
export function getSummarizeService(): AiService {
  return serviceFor(config.ai.summarizeProvider);
}
