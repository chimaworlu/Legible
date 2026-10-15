import { jobRepo, bookRepo, sourceImageRepo, sectionRepo, userRepo, type JobRow } from "./db.ts";
import { transcribeWithGemini, summarizeWithDeepseek } from "./ai.ts";
import { getObjectBytes, putBookExport } from "./storage.ts";
import { renderBookPdf } from "./pdf.ts";
import {
  checkImageQuality,
  checkCostCeiling,
  bookAiCostCeilingMinorFor,
  detectFabricationSignals,
  isLengthInconsistent,
  toTranscriptionFlags,
  sectionConfidenceFrom,
} from "./domain.ts";

// Raw port of worker/jobs/{transcribe,summarize,export}.ts + worker/
// index.ts's poll loop, adapted to run as one bounded pass per invocation
// instead of a persistent setInterval loop (AGENTS.md's "dedicated
// long-running worker process" doesn't fit Vercel+Supabase-only hosting —
// see the conversation that led here). Triggered on a schedule (Supabase
// cron) rather than continuously polling.

const BATCH_SIZE = 5;
const CONFIDENCE_THRESHOLD = 0.8; // config.ai.confidenceThreshold
const RETRY_LIMIT = 3; // providerConfig.retryLimit (same for both providers currently)
const GEMINI_COST_PER_IMAGE_MINOR = 0; // providerConfig.costPerImageMinor

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return 500 * 2 ** attempt;
}

function sanitizeError(error: unknown, context: { jobId: string; bookId: string; sourceImageId?: string; provider?: string }): string {
  const message = error instanceof Error ? error.message : "unknown error";
  const imagePart = context.sourceImageId ? ` image=${context.sourceImageId}` : "";
  const providerPart = context.provider ? ` provider=${context.provider}` : "";
  return `job=${context.jobId} book=${context.bookId}${imagePart}${providerPart}: ${message}`;
}

async function rollUpBookStatus(bookId: string): Promise<void> {
  const jobs = await jobRepo.listForBook(bookId, "TRANSCRIBE");
  const stillPending = jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING");
  if (!stillPending) await bookRepo.updateStatus(bookId, "READY");
}

async function runTranscribeJob(job: JobRow): Promise<void> {
  if (!job.sourceImageId) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId}: TRANSCRIBE job missing sourceImageId`);
    await rollUpBookStatus(job.bookId);
    return;
  }

  await jobRepo.markRunning(job.id);

  const [book, image] = await Promise.all([bookRepo.findForUser(job.bookId, job.userId), sourceImageRepo.findForBook(job.sourceImageId, job.bookId)]);
  if (!book || !image) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId} image=${job.sourceImageId}: book or image not found`);
    if (book) await rollUpBookStatus(job.bookId);
    return;
  }

  const context = { jobId: job.id, bookId: job.bookId, sourceImageId: image.id, provider: "gemini" };

  let bytes: Uint8Array;
  try {
    bytes = await getObjectBytes(image.storageKey);
  } catch (error) {
    await sourceImageRepo.updateStatus(image.id, "FAILED");
    await jobRepo.markFailed(job.id, sanitizeError(error, context));
    await rollUpBookStatus(job.bookId);
    return;
  }

  const quality = checkImageQuality({ byteLength: bytes.byteLength, format: image.format });
  if (!quality.passed) {
    await sourceImageRepo.updateStatus(image.id, "QUALITY_FAILED", quality.qualityScore);
    await jobRepo.markFailed(job.id, sanitizeError(new Error(quality.reason ?? "quality check failed"), context));
    await rollUpBookStatus(job.bookId);
    return;
  }

  const plan = (await userRepo.findPlanById(job.userId)) ?? "FREE";
  const ceilingMinor = bookAiCostCeilingMinorFor(plan);
  const costGate = checkCostCeiling(book, ceilingMinor, GEMINI_COST_PER_IMAGE_MINOR);
  if (!costGate.allowed) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId} image=${image.id}: ${costGate.reason}`);
    await rollUpBookStatus(job.bookId);
    return;
  }

  let lastError: unknown;
  let result: Awaited<ReturnType<typeof transcribeWithGemini>> | undefined;
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      result = await transcribeWithGemini({ mimeType: `image/${image.format}`, bytes });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_LIMIT) await sleep(backoffMs(attempt));
    }
  }

  if (!result) {
    await sourceImageRepo.updateStatus(image.id, "FAILED");
    await jobRepo.markFailed(job.id, sanitizeError(lastError, context));
    await rollUpBookStatus(job.bookId);
    return;
  }

  if (result.diagramRegions.length > 0) {
    console.log(`Transcribe job ${job.id}: ${result.diagramRegions.length} diagram region(s) detected, not yet cropped`);
  }

  const flaggedSpans = detectFabricationSignals(result.spans);
  const lengthInconsistent = isLengthInconsistent(result.text, bytes.byteLength);
  const flags = toTranscriptionFlags(flaggedSpans, CONFIDENCE_THRESHOLD, lengthInconsistent);
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

async function runSummarizeJob(job: JobRow): Promise<void> {
  if (!job.sourceImageId) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId}: SUMMARIZE job missing sourceImageId`);
    return;
  }

  await jobRepo.markRunning(job.id);
  const context = { jobId: job.id, bookId: job.bookId, sourceImageId: job.sourceImageId, provider: "deepseek" };

  const section = await sectionRepo.findForSourceImage(job.sourceImageId);
  if (!section) {
    await jobRepo.markFailed(job.id, `${context.jobId} book=${context.bookId} image=${context.sourceImageId}: no transcribed section found to summarize`);
    return;
  }

  let lastError: unknown;
  let result: Awaited<ReturnType<typeof summarizeWithDeepseek>> | undefined;
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      result = await summarizeWithDeepseek(section.originalText);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_LIMIT) await sleep(backoffMs(attempt));
    }
  }

  if (!result) {
    await jobRepo.markFailed(job.id, sanitizeError(lastError, context));
    return;
  }

  await sectionRepo.updateSummary(section.id, JSON.stringify(result.sections));
  await jobRepo.markSucceeded(job.id);
}

async function runExportJob(job: JobRow): Promise<void> {
  await jobRepo.markRunning(job.id);
  const context = { jobId: job.id, bookId: job.bookId };

  const book = await bookRepo.findForUser(job.bookId, job.userId);
  if (!book) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId}: book not found`);
    return;
  }

  const sections = await sectionRepo.listForBook(job.bookId);
  if (sections.length === 0) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId}: no transcribed sections to export`);
    return;
  }

  try {
    const pdfBytes = await renderBookPdf(book.title, sections);
    await putBookExport(job.userId, job.bookId, pdfBytes);
    await jobRepo.markSucceeded(job.id);
  } catch (error) {
    await jobRepo.markFailed(job.id, sanitizeError(error, context));
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("PROCESS_JOBS_SECRET");
  if (secret && req.headers.get("x-process-jobs-secret") !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = { transcribe: { picked: 0, done: 0 }, summarize: { picked: 0, done: 0 }, export: { picked: 0, done: 0 }, errors: [] as string[] };

  try {
    const transcribeJobs = await jobRepo.listQueuedByType("TRANSCRIBE", BATCH_SIZE);
    summary.transcribe.picked = transcribeJobs.length;
    for (const job of transcribeJobs) {
      try {
        await runTranscribeJob(job);
        summary.transcribe.done++;
      } catch (error) {
        summary.errors.push(`transcribe ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const summarizeJobs = await jobRepo.listQueuedByType("SUMMARIZE", BATCH_SIZE);
    summary.summarize.picked = summarizeJobs.length;
    for (const job of summarizeJobs) {
      try {
        await runSummarizeJob(job);
        summary.summarize.done++;
      } catch (error) {
        summary.errors.push(`summarize ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const exportJobs = await jobRepo.listQueuedByType("EXPORT", BATCH_SIZE);
    summary.export.picked = exportJobs.length;
    for (const job of exportJobs) {
      try {
        await runExportJob(job);
        summary.export.done++;
      } catch (error) {
        summary.errors.push(`export ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    summary.errors.push(`poll: ${error instanceof Error ? error.message : String(error)}`);
  }

  return Response.json(summary);
});
