import { config } from "@/src/config";

// Shared by every job handler (worker/jobs/*.ts) — kept in one place so
// retry/backoff timing and error sanitization (ai-pipeline.md law 12) stay
// identical across job types rather than drifting between copies.

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function backoffMs(attempt: number): number {
  return 500 * 2 ** attempt;
}

// ai-pipeline.md law 12: logged with job id, book id, image id, provider,
// and a sanitized error — never the note content itself. Every error a job
// handler throws or catches originates from our own JSON/schema handling or
// an SDK's HTTP layer, not user content. sourceImageId/provider are optional
// since a book-level job (e.g. EXPORT) has neither.
export function sanitizeError(error: unknown, context: { jobId: string; bookId: string; sourceImageId?: string; provider?: string }): string {
  const message = error instanceof Error ? error.message : "unknown error";
  const imagePart = context.sourceImageId ? ` image=${context.sourceImageId}` : "";
  const providerPart = context.provider ? ` provider=${context.provider}` : "";
  return `job=${context.jobId} book=${context.bookId}${imagePart}${providerPart}: ${message}`;
}

// Reads a per-provider config bucket by whichever provider name is active
// for a given task (activeProvider for transcribe, summarizeProvider for
// summarize) — kept generic so it works for either config key.
export function providerConfigFor(providerName: string): { costPerImageMinor: number; retryLimit: number } | null {
  const providers = config.ai.providers as Record<string, { costPerImageMinor: number; retryLimit: number }>;
  return providers[providerName] ?? null;
}
