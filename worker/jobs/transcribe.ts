import type { Job } from "@prisma/client";
import { config } from "@/src/config";
import { jobRepo } from "@/src/db/repositories/job";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";
import { sectionRepo } from "@/src/db/repositories/section";
import { bookRepo } from "@/src/db/repositories/book";
import { userRepo } from "@/src/db/repositories/user";
import { storage } from "@/src/services/storage";
import { getAiService } from "@/src/services/ai";
import { checkImageQuality } from "@/src/domain/imageQuality";
import { checkCostCeiling } from "@/src/domain/processingGates";
import { getPlanLimits } from "@/src/domain/planLimits";
import { detectFabricationSignals, isLengthInconsistent, toTranscriptionFlags, sectionConfidenceFrom } from "@/src/domain/transcription";
import { backoffMs, providerConfigFor, sanitizeError, sleep } from "./shared";

// Book.status has no PARTIAL value and is locked (AGENTS.md 2.3) — once
// every TRANSCRIBE job for this book reaches a terminal state, the book
// moves to READY regardless of how many individual jobs FAILED (law 13).
// Per-image failure stays visible only at SourceImage.status/Job.status.
async function rollUpBookStatus(bookId: string): Promise<void> {
  const jobs = await jobRepo.listForBook(bookId, "TRANSCRIBE");
  const stillPending = jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING");
  if (!stillPending) {
    await bookRepo.updateStatus(bookId, "READY");
  }
}

export async function runTranscribeJob(job: Job): Promise<void> {
  if (!job.sourceImageId) {
    // TRANSCRIBE always carries a sourceImageId (AGENTS.md 2.3) — a job
    // without one is a data-integrity issue, not a transient failure.
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId}: TRANSCRIBE job missing sourceImageId`);
    await rollUpBookStatus(job.bookId);
    return;
  }

  await jobRepo.markRunning(job.id);

  const [book, image] = await Promise.all([
    bookRepo.findForUser(job.bookId, job.userId),
    sourceImageRepo.findForBook(job.sourceImageId, job.bookId),
  ]);

  if (!book || !image) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId} image=${job.sourceImageId}: book or image not found`);
    if (book) await rollUpBookStatus(job.bookId);
    return;
  }

  const context = { jobId: job.id, bookId: job.bookId, sourceImageId: image.id, provider: config.ai.activeProvider };

  let bytes: Uint8Array;
  try {
    bytes = await storage.getObjectBytes(image.storageKey);
  } catch (error) {
    // A failed R2 read isolates this image only (law 13) — the batch
    // continues.
    await sourceImageRepo.updateStatus(image.id, "FAILED");
    await jobRepo.markFailed(job.id, sanitizeError(error, context));
    await rollUpBookStatus(job.bookId);
    return;
  }

  // Gate order per ai-pipeline.md law 10: quality check before cost ceiling
  // — a quality-failed image should never count toward cost.
  const quality = checkImageQuality({ byteLength: bytes.byteLength, format: image.format });
  if (!quality.passed) {
    await sourceImageRepo.updateStatus(image.id, "QUALITY_FAILED", quality.qualityScore);
    await jobRepo.markFailed(job.id, `${sanitizeError(new Error(quality.reason ?? "quality check failed"), context)}`);
    await rollUpBookStatus(job.bookId);
    return;
  }

  const user = await userRepo.findById(job.userId);
  const limits = getPlanLimits(user?.plan ?? "FREE");
  const providerConfig = providerConfigFor(config.ai.activeProvider);
  const estimatedCallCostMinor = providerConfig?.costPerImageMinor ?? 0;

  const costGate = checkCostCeiling(book, limits.bookAiCostCeilingMinor, estimatedCallCostMinor);
  if (!costGate.allowed) {
    // Not retried — retrying a cost-ceiling failure would defeat the gate
    // (ai-pipeline.md law 10/11).
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId} image=${image.id}: ${costGate.reason}`);
    await rollUpBookStatus(job.bookId);
    return;
  }

  let aiService: ReturnType<typeof getAiService>;
  try {
    aiService = getAiService();
  } catch (error) {
    // No provider enabled yet (ai-pipeline.md law 5) — a configuration
    // state, not a transient failure, so this fails without burning retries.
    await sourceImageRepo.updateStatus(image.id, "FAILED");
    await jobRepo.markFailed(job.id, sanitizeError(error, context));
    await rollUpBookStatus(job.bookId);
    return;
  }

  const retryLimit = providerConfig?.retryLimit ?? 3;
  let lastError: unknown;
  let result: Awaited<ReturnType<typeof aiService.transcribe>> | undefined;

  for (let attempt = 0; attempt <= retryLimit; attempt++) {
    try {
      result = await aiService.transcribe({ storageKey: image.storageKey, mimeType: `image/${image.format}`, bytes });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < retryLimit) await sleep(backoffMs(attempt));
    }
  }

  if (!result) {
    // Retries exhausted (law 12) — this image is isolated, the batch
    // continues (law 13).
    await sourceImageRepo.updateStatus(image.id, "FAILED");
    await jobRepo.markFailed(job.id, sanitizeError(lastError, context));
    await rollUpBookStatus(job.bookId);
    return;
  }

  if (result.diagramRegions.length > 0) {
    // Detected regions satisfy the AiService contract (ai-pipeline.md law
    // 2), but cropping them into R2 objects + Diagram rows is explicitly
    // deferred (no image-manipulation dependency in this repo yet) — logged
    // as a count only, never region content.
    console.log(`Transcribe job ${job.id}: ${result.diagramRegions.length} diagram region(s) detected, not yet cropped`);
  }

  const flaggedSpans = detectFabricationSignals(result.spans);
  const lengthInconsistent = isLengthInconsistent(result.text, bytes.byteLength);
  const flags = toTranscriptionFlags(flaggedSpans, config.ai.confidenceThreshold, lengthInconsistent);
  const confidence = sectionConfidenceFrom(flags);

  await sectionRepo.createWithFlags({
    bookId: job.bookId,
    sourceImageId: image.id,
    order: image.imageOrder ?? 0,
    originalText: result.text,
    confidence,
    flags,
  });
  await sourceImageRepo.updateStatus(image.id, "TRANSCRIBED");
  await bookRepo.incrementCostSpent(job.bookId, result.costMinor);
  await jobRepo.markSucceeded(job.id);
  await rollUpBookStatus(job.bookId);
}
