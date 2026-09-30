// Worker Entry Point for AI Pipeline
//
// Dedicated long-running process, separate from Next.js (AGENTS.md section
// 4) — polls the Job table (the v1 interim queue; see
// src/services/queue/index.ts's own comment) for QUEUED TRANSCRIBE jobs and
// runs them through worker/jobs/transcribe.ts. Concurrency is capped per the
// active provider's maxConcurrency via an in-process semaphore (law 15) —
// no distributed lock, since this is a single long-running process.

import type { Job } from "@prisma/client";
import { config } from "@/src/config";
import { jobRepo } from "@/src/db/repositories/job";
import { runTranscribeJob } from "./jobs/transcribe";
import { runSummarizeJob } from "./jobs/summarize";
import { runExportJob } from "./jobs/export";
import { createSemaphore } from "@/src/lib/semaphore";

const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 20;

// PDF generation is CPU/IO-bound, not gated by an AI provider's rate limit —
// a small fixed cap is enough for a single worker process, unlike
// providerConcurrency below which TRANSCRIBE/SUMMARIZE need.
const EXPORT_CONCURRENCY = 3;

function providerConcurrency(providerName: string): number {
  const providers = config.ai.providers as Record<string, { rateLimit: { maxConcurrency: number } }>;
  return providers[providerName]?.rateLimit.maxConcurrency ?? 1;
}

// One handler per JobType this worker knows how to run. STRUCTURE has no
// handler yet (out of scope — see the transcribe-only pipeline plan);
// SUMMARIZE and EXPORT are separate, independent actions from the
// TRANSCRIBE pipeline (see each job file's own doc comment).
const JOB_HANDLERS: Partial<Record<Job["type"], (job: Job) => Promise<void>>> = {
  TRANSCRIBE: runTranscribeJob,
  SUMMARIZE: runSummarizeJob,
  EXPORT: runExportJob,
};

export async function runWorker() {
  console.log("Worker started...");
  // Concurrency is capped per provider (law 15); TRANSCRIBE and SUMMARIZE
  // can use different providers (config.ai.activeProvider vs.
  // summarizeProvider), so each job type gets its own semaphore rather than
  // sharing one sized for whichever provider happened to be read first.
  const semaphores: Partial<Record<Job["type"], ReturnType<typeof createSemaphore>>> = {
    TRANSCRIBE: createSemaphore(providerConcurrency(config.ai.activeProvider)),
    SUMMARIZE: createSemaphore(providerConcurrency(config.ai.summarizeProvider)),
    EXPORT: createSemaphore(EXPORT_CONCURRENCY),
  };

  async function pollOnce() {
    for (const jobType of Object.keys(JOB_HANDLERS) as Job["type"][]) {
      try {
        const jobs = await jobRepo.listQueuedByType(jobType, BATCH_SIZE);
        const handler = JOB_HANDLERS[jobType];
        const semaphore = semaphores[jobType];
        if (!handler || !semaphore) continue;

        for (const job of jobs) {
          semaphore.run(() =>
            handler(job).catch((error) => {
              // Each handler handles every expected failure path itself
              // (markFailed, and for TRANSCRIBE, the book roll-up) —
              // reaching here means something outside that handling broke,
              // so it's logged, not swallowed.
              console.error(`Unhandled error running ${jobType} job ${job.id}:`, error);
            }),
          );
        }
      } catch (error) {
        console.error(`Worker poll failed for ${jobType}:`, error);
      }
    }
  }

  await pollOnce();
  setInterval(pollOnce, POLL_INTERVAL_MS);
}

// Ensure it can be run standalone
if (require.main === module) {
  runWorker().catch(console.error);
}
