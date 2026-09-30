import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@prisma/client";

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    ai: {
      activeProvider: "deepseek",
      confidenceThreshold: 0.8,
      providers: {
        deepseek: { costPerImageMinor: 50, retryLimit: 2 },
        gemini: { costPerImageMinor: 50, retryLimit: 2 },
      },
    },
    caps: { minImageBytes: 10, bookAiCostCeilingMinorFree: 100000, bookAiCostCeilingMinorPro: 100000 },
    plans: { FREE: { imagesPerMonth: 30 }, PRO: { imagesPerMonth: 150 } },
  },
}));

vi.mock("@/src/config", () => ({ config: mockConfig }));

// vi.mock factories are hoisted above imports (and above plain module-level
// consts), so every mock object a factory closes over has to come from
// vi.hoisted — a plain `const` here throws "Cannot access before
// initialization" (confirmed by running this file without it).
const { jobRepo, sourceImageRepo, sectionRepo, bookRepo, userRepo, storage, aiService } = vi.hoisted(() => ({
  jobRepo: {
    markRunning: vi.fn(),
    markSucceeded: vi.fn(),
    markFailed: vi.fn(),
    listForBook: vi.fn(),
    listQueuedByType: vi.fn(),
    createMany: vi.fn(),
  },
  sourceImageRepo: {
    findForBook: vi.fn(),
    updateStatus: vi.fn(),
  },
  sectionRepo: {
    createWithFlags: vi.fn(),
  },
  bookRepo: {
    findForUser: vi.fn(),
    updateStatus: vi.fn(),
    incrementCostSpent: vi.fn(),
  },
  userRepo: {
    findById: vi.fn(),
  },
  storage: {
    getObjectBytes: vi.fn(),
  },
  aiService: {
    transcribe: vi.fn(),
  },
}));

vi.mock("@/src/db/repositories/job", () => ({ jobRepo }));
vi.mock("@/src/db/repositories/sourceImage", () => ({ sourceImageRepo }));
vi.mock("@/src/db/repositories/section", () => ({ sectionRepo }));
vi.mock("@/src/db/repositories/book", () => ({ bookRepo }));
vi.mock("@/src/db/repositories/user", () => ({ userRepo }));
vi.mock("@/src/services/storage", () => ({ storage }));
vi.mock("@/src/services/ai", () => ({ getAiService: () => aiService }));

import { runTranscribeJob } from "@/worker/jobs/transcribe";

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job1",
    userId: "user1",
    bookId: "book1",
    sourceImageId: "image1",
    type: "TRANSCRIBE",
    status: "QUEUED",
    attempts: 0,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Job;
}

const validAiResult = {
  text: "hello world",
  spans: [{ startOffset: 0, endOffset: 11, confidence: 0.95, readable: true }],
  diagramRegions: [],
  costMinor: 50,
};

describe("runTranscribeJob (ai-pipeline.md laws 10, 12, 13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bookRepo.findForUser.mockResolvedValue({ id: "book1", userId: "user1", aiCostSpentMinor: 0, status: "PROCESSING" });
    sourceImageRepo.findForBook.mockResolvedValue({ id: "image1", bookId: "book1", storageKey: "k", format: "jpeg", imageOrder: 0 });
    storage.getObjectBytes.mockResolvedValue(new Uint8Array(1000));
    userRepo.findById.mockResolvedValue({ id: "user1", plan: "FREE" });
    jobRepo.listForBook.mockResolvedValue([{ status: "SUCCEEDED" }]);
  });

  it("on success: writes a Section+flags, marks the image TRANSCRIBED, increments book cost, marks the job SUCCEEDED", async () => {
    aiService.transcribe.mockResolvedValue(validAiResult);

    await runTranscribeJob(baseJob());

    expect(sectionRepo.createWithFlags).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: "book1", sourceImageId: "image1", originalText: "hello world", confidence: "HIGH" }),
    );
    expect(sourceImageRepo.updateStatus).toHaveBeenCalledWith("image1", "TRANSCRIBED");
    expect(bookRepo.incrementCostSpent).toHaveBeenCalledWith("book1", 50);
    expect(jobRepo.markSucceeded).toHaveBeenCalledWith("job1");
    expect(jobRepo.markFailed).not.toHaveBeenCalled();
  });

  it("isolates one image's AI failure: marks only that image/job FAILED, never touches other jobs, batch still rolls up", async () => {
    aiService.transcribe.mockRejectedValue(new Error("provider exploded"));

    await runTranscribeJob(baseJob());

    expect(sourceImageRepo.updateStatus).toHaveBeenCalledWith("image1", "FAILED");
    expect(jobRepo.markFailed).toHaveBeenCalledTimes(1);
    expect(jobRepo.markFailed.mock.calls[0][0]).toBe("job1");
    expect(sectionRepo.createWithFlags).not.toHaveBeenCalled();
    // roll-up ran and only looked at this book's jobs, never reached for a
    // "PARTIAL" status that doesn't exist on BookStatus.
    expect(jobRepo.listForBook).toHaveBeenCalledWith("book1", "TRANSCRIBE");
  });

  it("retries up to the provider's retryLimit before failing", async () => {
    aiService.transcribe.mockRejectedValue(new Error("transient"));

    await runTranscribeJob(baseJob());

    // retryLimit is 2 in mockConfig -> attempts 0, 1, 2 = 3 calls total.
    expect(aiService.transcribe).toHaveBeenCalledTimes(3);
  });

  it("does not retry a cost-ceiling failure", async () => {
    bookRepo.findForUser.mockResolvedValue({ id: "book1", userId: "user1", aiCostSpentMinor: 999999, status: "PROCESSING" });

    await runTranscribeJob(baseJob());

    expect(aiService.transcribe).not.toHaveBeenCalled();
    expect(jobRepo.markFailed).toHaveBeenCalledTimes(1);
    expect(jobRepo.markFailed.mock.calls[0][1]).toMatch(/cost ceiling/i);
  });

  it("marks the image QUALITY_FAILED and never calls the AI when bytes are undersized", async () => {
    storage.getObjectBytes.mockResolvedValue(new Uint8Array(1));

    await runTranscribeJob(baseJob());

    expect(sourceImageRepo.updateStatus).toHaveBeenCalledWith("image1", "QUALITY_FAILED", 0);
    expect(aiService.transcribe).not.toHaveBeenCalled();
  });

  it("rolls the book up to READY once every TRANSCRIBE job for it is terminal, regardless of failures", async () => {
    jobRepo.listForBook.mockResolvedValue([{ status: "SUCCEEDED" }, { status: "FAILED" }]);
    aiService.transcribe.mockResolvedValue(validAiResult);

    await runTranscribeJob(baseJob());

    expect(bookRepo.updateStatus).toHaveBeenCalledWith("book1", "READY");
  });

  it("leaves the book PROCESSING while sibling jobs are still queued/running", async () => {
    jobRepo.listForBook.mockResolvedValue([{ status: "SUCCEEDED" }, { status: "QUEUED" }]);
    aiService.transcribe.mockResolvedValue(validAiResult);

    await runTranscribeJob(baseJob());

    expect(bookRepo.updateStatus).not.toHaveBeenCalled();
  });
});
