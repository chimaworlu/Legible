import { jobRepo } from "@/src/db/repositories/job";
import { config } from "@/src/config";

// Enqueue-only queue client used by the app (AGENTS.md section 4). The app
// writes Job rows; the worker (a Supabase Edge Function — see
// supabase/functions/process-jobs) picks them up and runs them. v1 uses the
// Job table as the queue; swapping to Redis/BullMQ only touches this module.

// Fire-and-forget nudge to the worker right after enqueueing — Supabase's
// own cron trigger already calls it every minute as the reliable fallback,
// so a failure/timeout here is never a correctness issue, only a missed
// chance to skip the wait for the next tick. Never awaited by callers.
function triggerWorker(): void {
  const { processJobsUrl, processJobsSecret } = config.worker;
  if (!processJobsUrl) return;
  fetch(processJobsUrl, { method: "POST", headers: { "x-process-jobs-secret": processJobsSecret } }).catch(() => {});
}

export const queue = {
  async enqueueTranscribeJobs(input: { userId: string; bookId: string; sourceImageIds: string[] }) {
    if (input.sourceImageIds.length === 0) return;
    await jobRepo.createMany(
      input.sourceImageIds.map((sourceImageId) => ({
        userId: input.userId,
        bookId: input.bookId,
        sourceImageId,
        type: "TRANSCRIBE" as const,
      })),
    );
    triggerWorker();
  },

  async enqueueSummarizeJob(input: { userId: string; bookId: string; sourceImageId: string }) {
    await jobRepo.createMany([{ ...input, type: "SUMMARIZE" as const }]);
    triggerWorker();
  },

  async enqueueExportJob(input: { userId: string; bookId: string }) {
    await jobRepo.createMany([{ ...input, type: "EXPORT" as const }]);
    triggerWorker();
  },
};
