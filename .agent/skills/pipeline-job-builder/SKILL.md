---
name: pipeline-job-builder
description: Use this skill whenever building or editing anything that runs in the worker. Triggers include pipeline stage, TRANSCRIBE, STRUCTURE, EXPORT, queue processor, retry, job status, batch, watermark, PDF export, or any slow task that reads notes or builds books. If the code runs outside a request handler, this is the manual.
---

# Pipeline Job Builder

All heavy work runs in worker/, a long-running process outside Next.js. The laws live in `ai-pipeline.md`, `uploads-and-storage.md`, and AGENTS.md section 4.

## Steps

1. Pick granularity. One image (intake, transcription, flagging, diagram detection): TRANSCRIBE, per image, Job.sourceImageId set. Whole book (grouping, assembly): STRUCTURE. The PDF: EXPORT. Never invent a fourth type; map new stages into these three (ai-pipeline.md rule 12, PRD section 6).
2. Run the gates in this exact order and stop at the first failure: plan allowance covers the work (R3, R31); the image passed quality check (R4); the book is under its AI cost ceiling (PRD section 6). A call fired before its gates is a failed task even with a perfect result (ai-pipeline.md rule 10).
3. Mark the job RUNNING before work, SUCCEEDED or FAILED after. Write status on every transition so the front end shows live progress (R6).
4. Call the AI only through aiService, the one desk (ai-pipeline.md rule 1).
5. Write spans as TranscriptionFlag rows with offsets (R10, R11).
6. Record the call's cost against the book, in kobo (ai-pipeline.md rule 11).
7. On error: log ids (job, book, image, provider), never note content; rethrow so the queue retries with backoff from config (ai-pipeline.md rule 12).
8. Clean temp files in a finally, success or failure (uploads-and-storage.md rule 13).

## Skeleton

    worker.process("TRANSCRIBE", async (job) => {
      const { bookId, sourceImageId, userId } = job.data;
      await jobRepo.markRunning(job.id);
      try {
        await runGates({ userId, bookId, sourceImageId });      // step 2, order fixed
        const result = await aiService.transcribe(imageRef);    // step 4
        await sectionRepo.writeWithFlags(result);               // step 5
        await costRepo.record(bookId, result.costMinor);        // step 6
        await jobRepo.markSucceeded(job.id);
      } catch (err) {
        await jobRepo.markFailed(job.id, sanitize(err));        // step 7
        throw err;
      } finally {
        await cleanupTemp(job.id);                              // step 8
      }
    });

## The export stage

1. Read the watermark gate fresh from one source of truth: an ACTIVE Subscription with currentPeriodEnd in the future (R25, R34, money-and-billing.md rule 10). Never User.plan, never a cached flag.
2. Place each diagram at its recorded sectionId and order (R23). Appending diagrams at chapter end is a failed task.
3. Write the PDF through src/services/storage as a private object; the route hands out a signed URL.

## Traps

- Sending the whole book in one grouping call. Cluster with per-section embeddings, then a bounded pass over cluster summaries (ai-pipeline.md rule 14). The shortcut works in the demo and dies at 300 images.
- One failed image failing the batch. Isolate it, mark it, resolve the batch PARTIAL (uploads-and-storage.md rule 8).
- Spending AI money on an image that failed quality check.
- Logging note content in errors.

## Verify before done

- [ ] Correct job type and granularity, sourceImageId set for per-image work
- [ ] Gates in order, before any spend
- [ ] Status written on every transition
- [ ] Retry via the queue, backoff from config
- [ ] Cost recorded in kobo per call
- [ ] Temp files cleaned both paths
- [ ] Tests to write: gate order stops at first failure; one failed image yields PARTIAL not FAILED; export watermark flips with subscription state