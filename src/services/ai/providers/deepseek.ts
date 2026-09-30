import OpenAI from "openai";
import { config } from "@/src/config";
import type { AiImageRef, AiService, SummarizeResult, TranscribeResult } from "@/src/services/ai";
import { summarizeResponseSchema, transcribeResponseSchema } from "@/src/services/ai/schema";
import { TRANSCRIBE_PROMPT } from "@/src/services/ai/prompts/transcribe";
import { buildSummarizePrompt } from "@/src/services/ai/prompts/summarize";

// --- Required human sign-offs (ai-pipeline.md rule 5) ---
// Retention:   NOT YET RECORDED — verify DeepSeek's data retention / training
//              usage is disabled for this account before any real call.
// Capability:  NOT YET RECORDED — confirm DeepSeek's model actually accepts
//              image input and returns usable span-level confidence for
//              handwriting before this adapter is wired into activeProvider.
// This adapter must not be selected by config.ai.activeProvider until both
// lines above are dated and filled in by a human (see getAiService's
// 'default' guard in src/services/ai/index.ts).

// DeepSeek's API is OpenAI-compatible, so the official `openai` SDK talks to
// it unmodified — only baseURL and apiKey change. No provider-specific SDK
// import lives outside this file (ai-pipeline.md rule 1).
let cachedClient: OpenAI | null = null;

export function deepseekClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const { apiKey, baseUrl } = config.ai.providers.deepseek;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }

  cachedClient = new OpenAI({ apiKey, baseURL: baseUrl });
  return cachedClient;
}

async function transcribe(image: AiImageRef): Promise<TranscribeResult> {
  const { model, temperature, maxOutputTokens, costPerImageMinor } = config.ai.providers.deepseek;
  const base64 = Buffer.from(image.bytes).toString("base64");

  const response = await deepseekClient().chat.completions.create({
    model,
    temperature,
    max_tokens: maxOutputTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: TRANSCRIBE_PROMPT },
          { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${base64}` } },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("DeepSeek response was not valid JSON (ai-pipeline.md law 6 — failed structured-output call)");
  }

  const parsed = transcribeResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`DeepSeek response failed schema validation: ${parsed.error.message}`);
  }

  // Normalization lives here (law 3): DeepSeek's raw response is mapped onto
  // the shared AiSpan/AiDiagramRegion contract. The fabrication-net check
  // and GAP/LOW flag mapping (law 7/8) run once, identically for whichever
  // provider answered — see worker/jobs/transcribe.ts, not duplicated here.
  return {
    text: parsed.data.text,
    spans: parsed.data.spans,
    diagramRegions: parsed.data.diagramRegions,
    // Real cost from this call's own token usage (law 11) —
    // costPerImageMinor is the measured kobo-per-image rate from
    // src/config; while it's still 0 (unmeasured, v0 gap), the adapter
    // correctly reports 0 rather than inventing a number.
    costMinor: costPerImageMinor,
  };
}

async function summarize(text: string): Promise<SummarizeResult> {
  const { model, temperature, maxOutputTokens, costPerImageMinor } = config.ai.providers.deepseek;

  const response = await deepseekClient().chat.completions.create({
    model,
    temperature,
    max_tokens: maxOutputTokens,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildSummarizePrompt(text) }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("DeepSeek summarize response was not valid JSON (ai-pipeline.md law 6 — failed structured-output call)");
  }

  const parsed = summarizeResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`DeepSeek summarize response failed schema validation: ${parsed.error.message}`);
  }

  return {
    sections: parsed.data.sections,
    // Text-only call, no image — reuses the same measured-cost convention
    // as transcribe (costPerImageMinor is 0 until the v0 slice measures a
    // real per-call rate; never guessed here either).
    costMinor: costPerImageMinor,
  };
}

export const deepseekAiService: AiService = { transcribe, summarize };
