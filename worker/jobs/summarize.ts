import type { Job } from "@prisma/client";
import { config } from "@/src/config";
import { jobRepo } from "@/src/db/repositories/job";
import { sectionRepo } from "@/src/db/repositories/section";
import { getSummarizeService } from "@/src/services/ai";
import { backoffMs, providerConfigFor, sanitizeError, sleep } from "./shared";

// On-demand, per-section summary — independent of the TRANSCRIBE/STRUCTURE/
// EXPORT pipeline and Book.status. Never touches SourceImage.status or the
// book's roll-up; a summarize failure only affects this one job.
export async function runSummarizeJob(job: Job): Promise<void> {
  if (!job.sourceImageId) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId}: SUMMARIZE job missing sourceImageId`);
    return;
  }

  await jobRepo.markRunning(job.id);

  const context = { jobId: job.id, bookId: job.bookId, sourceImageId: job.sourceImageId, provider: config.ai.summarizeProvider };

  const section = await sectionRepo.findForSourceImage(job.sourceImageId);
  if (!section) {
    // Can't summarize text that doesn't exist yet — the image hasn't been
    // transcribed (or transcription failed). Not a transient failure.
    await jobRepo.markFailed(job.id, `${context.jobId} book=${context.bookId} image=${context.sourceImageId}: no transcribed section found to summarize`);
    return;
  }

  let aiService: ReturnType<typeof getSummarizeService>;
  try {
    aiService = getSummarizeService();
  } catch (error) {
    // No provider enabled yet (ai-pipeline.md law 5) — a configuration
    // state, not a transient failure, so this fails without burning retries.
    await jobRepo.markFailed(job.id, sanitizeError(error, context));
    return;
  }

  const providerConfig = providerConfigFor(config.ai.summarizeProvider);
  const retryLimit = providerConfig?.retryLimit ?? 3;
  let lastError: unknown;
  let result: Awaited<ReturnType<typeof aiService.summarize>> | undefined;

  for (let attempt = 0; attempt <= retryLimit; attempt++) {
    try {
      result = await aiService.summarize(section.originalText);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < retryLimit) await sleep(backoffMs(attempt));
    }
  }

  if (!result) {
    await jobRepo.markFailed(job.id, sanitizeError(lastError, context));
    return;
  }

  // Section.summary stores the structured sections as JSON — no schema
  // migration needed for this shape change, and the client (which already
  // owns the rendering) parses it back out; see BookDetailView's
  // SummaryPanel.
  await sectionRepo.updateSummary(section.id, JSON.stringify(result.sections));
  await jobRepo.markSucceeded(job.id);
}
