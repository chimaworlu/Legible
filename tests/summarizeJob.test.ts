import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@prisma/client";

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    ai: {
      summarizeProvider: "deepseek",
      providers: {
        deepseek: { costPerImageMinor: 0, retryLimit: 2 },
        gemini: { costPerImageMinor: 0, retryLimit: 2 },
      },
    },
  },
}));

vi.mock("@/src/config", () => ({ config: mockConfig }));

const { jobRepo, sectionRepo, aiService, getSummarizeService } = vi.hoisted(() => {
  const aiService = { summarize: vi.fn(), transcribe: vi.fn() };
  return {
    jobRepo: {
      markRunning: vi.fn(),
      markSucceeded: vi.fn(),
      markFailed: vi.fn(),
    },
    sectionRepo: {
      findForSourceImage: vi.fn(),
      updateSummary: vi.fn(),
    },
    aiService,
    getSummarizeService: vi.fn(() => aiService),
  };
});

vi.mock("@/src/db/repositories/job", () => ({ jobRepo }));
vi.mock("@/src/db/repositories/section", () => ({ sectionRepo }));
vi.mock("@/src/services/ai", () => ({ getSummarizeService }));

import { runSummarizeJob } from "@/worker/jobs/summarize";

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job1",
    userId: "user1",
    bookId: "book1",
    sourceImageId: "image1",
    type: "SUMMARIZE",
    status: "QUEUED",
    attempts: 0,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Job;
}

describe("runSummarizeJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sectionRepo.findForSourceImage.mockResolvedValue({ id: "section1", originalText: "hello world", summary: null });
  });

  it("on success: stores the structured sections as JSON and marks the job SUCCEEDED", async () => {
    const sections = [{ heading: "Executive Summary", body: "A short recap." }];
    aiService.summarize.mockResolvedValue({ sections, costMinor: 0 });

    await runSummarizeJob(baseJob());

    expect(sectionRepo.updateSummary).toHaveBeenCalledWith("section1", JSON.stringify(sections));
    expect(jobRepo.markSucceeded).toHaveBeenCalledWith("job1");
    expect(jobRepo.markFailed).not.toHaveBeenCalled();
  });

  it("fails without calling the AI when no transcribed section exists yet", async () => {
    sectionRepo.findForSourceImage.mockResolvedValue(null);

    await runSummarizeJob(baseJob());

    expect(aiService.summarize).not.toHaveBeenCalled();
    expect(jobRepo.markFailed).toHaveBeenCalledTimes(1);
    expect(jobRepo.markFailed.mock.calls[0][1]).toMatch(/no transcribed section/i);
  });

  it("retries up to the provider's retryLimit before failing, never touching sectionRepo.updateSummary", async () => {
    aiService.summarize.mockRejectedValue(new Error("provider exploded"));

    await runSummarizeJob(baseJob());

    // retryLimit is 2 in mockConfig -> attempts 0, 1, 2 = 3 calls total.
    expect(aiService.summarize).toHaveBeenCalledTimes(3);
    expect(sectionRepo.updateSummary).not.toHaveBeenCalled();
    expect(jobRepo.markFailed).toHaveBeenCalledTimes(1);
  });

  it("fails without retrying when no provider is enabled (law 5)", async () => {
    getSummarizeService.mockImplementationOnce(() => {
      throw new Error("No AI provider is enabled");
    });

    await runSummarizeJob(baseJob());

    expect(aiService.summarize).not.toHaveBeenCalled();
    expect(jobRepo.markFailed).toHaveBeenCalledTimes(1);
  });
});
