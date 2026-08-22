import { jobRepo } from "@/src/db/repositories/job";

// Enqueue-only queue client used by the app (AGENTS.md section 4). The app
// writes Job rows; the long-running worker polls and executes them. v1 uses
// the Job table as the queue; swapping to Redis/BullMQ only touches this
// module.

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
  },
};
