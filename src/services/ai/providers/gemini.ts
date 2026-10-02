import { GoogleGenAI } from "@google/genai";
import { config } from "@/src/config";
import type { AiImageRef, AiService, SummarizeResult, TranscribeResult } from "@/src/services/ai";
import { summarizeResponseSchema, transcribeResponseSchema } from "@/src/services/ai/schema";
import { TRANSCRIBE_PROMPT } from "@/src/services/ai/prompts/transcribe";
import { buildSummarizePrompt } from "@/src/services/ai/prompts/summarize";

// --- Required human sign-offs (ai-pipeline.md rule 5) ---
// Retention:   NOT YET RECORDED — verify Gemini's data retention / training
//              usage is disabled for this account before any real call.
// Capability:  NOT YET RECORDED — confirm the configured Gemini model
//              actually accepts image input and returns usable span-level
//              confidence for handwriting before this adapter is wired into
//              activeProvider. Gemini's public docs are more explicit than
//              DeepSeek's about vision support for gemini-2.0-flash, which
//              may make this faster to verify — that is a pointer for where
//              to look, not a substitute for actually checking.
// This adapter must not be selected by config.ai.activeProvider until both
// lines above are dated and filled in by a human (see getAiService's
// 'default' guard in src/services/ai/index.ts).

// No provider-specific SDK import lives outside this file (ai-pipeline.md
// rule 1) — only this module ever imports @google/genai.
let cachedClient: GoogleGenAI | null = null;

function geminiClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;

  const { apiKey, baseUrl } = config.ai.providers.gemini;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  cachedClient = new GoogleGenAI(baseUrl ? { apiKey, httpOptions: { baseUrl } } : { apiKey });
  return cachedClient;
}

async function transcribe(image: AiImageRef): Promise<TranscribeResult> {
  const { model, temperature, maxOutputTokens, costPerImageMinor } = config.ai.providers.gemini;
  const base64 = Buffer.from(image.bytes).toString("base64");

  const response = await geminiClient().models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: TRANSCRIBE_PROMPT }, { inlineData: { mimeType: image.mimeType, data: base64 } }],
      },
    ],
    config: {
      temperature,
      maxOutputTokens,
      responseMimeType: "application/json",
    },
  });

  const raw = response.text ?? "";
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("Gemini response was not valid JSON (ai-pipeline.md law 6 — failed structured-output call)");
  }

  // Requesting responseMimeType: "application/json" leans on Gemini's own
  // structured-output support, but that is never the only gate — the shared
  // zod schema (same one DeepSeek validates against) is what actually
  // enforces law 6 here, independent of whichever provider answered.
  const parsed = transcribeResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`Gemini response failed schema validation: ${parsed.error.message}`);
  }

  // Normalization lives here (law 3): Gemini's raw response is mapped onto
  // the same shared contract DeepSeek's adapter produces. Fabrication-net
  // and GAP/LOW flag mapping run once in worker/jobs/transcribe.ts, not here.
  return {
    text: parsed.data.text,
    spans: parsed.data.spans,
    diagramRegions: parsed.data.diagramRegions,
    // Real cost from this call's own token usage (law 11) — see the
    // matching comment in deepseek.ts; 0 here means unmeasured, not free.
    costMinor: costPerImageMinor,
  };
}

async function summarize(text: string): Promise<SummarizeResult> {
  const { model, temperature, maxOutputTokens, costPerImageMinor } = config.ai.providers.gemini;

  const response = await geminiClient().models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: buildSummarizePrompt(text) }] }],
    config: { temperature, maxOutputTokens, responseMimeType: "application/json" },
  });

  const raw = response.text ?? "";
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("Gemini summarize response was not valid JSON (ai-pipeline.md law 6 — failed structured-output call)");
  }

  const parsed = summarizeResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`Gemini summarize response failed schema validation: ${parsed.error.message}`);
  }

  return { sections: parsed.data.sections, costMinor: costPerImageMinor };
}

export const geminiAiService: AiService = { transcribe, summarize };
