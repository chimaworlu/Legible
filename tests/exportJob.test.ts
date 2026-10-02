import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@prisma/client";

const { jobRepo, bookRepo, sectionRepo, storage } = vi.hoisted(() => ({
  jobRepo: {
    markRunning: vi.fn(),
    markSucceeded: vi.fn(),
    markFailed: vi.fn(),
  },
  bookRepo: {
    findForUser: vi.fn(),
  },
  sectionRepo: {
    listForBook: vi.fn(),
  },
  storage: {
    putBookExport: vi.fn(),
  },
}));

vi.mock("@/src/db/repositories/job", () => ({ jobRepo }));
vi.mock("@/src/db/repositories/book", () => ({ bookRepo }));
vi.mock("@/src/db/repositories/section", () => ({ sectionRepo }));
vi.mock("@/src/services/storage", () => ({ storage }));

import { runExportJob } from "@/worker/jobs/export";

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job1",
    userId: "user1",
    bookId: "book1",
    sourceImageId: null,
    type: "EXPORT",
    status: "QUEUED",
    attempts: 0,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Job;
}

describe("runExportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bookRepo.findForUser.mockResolvedValue({ id: "book1", userId: "user1", title: "My Book", status: "READY" });
    sectionRepo.listForBook.mockResolvedValue([
      { originalText: "First section text.", summary: null },
      { originalText: "Second section text.", summary: JSON.stringify([{ heading: "Recap", body: "A short recap." }]) },
    ]);
    storage.putBookExport.mockResolvedValue(undefined);
  });

  it("on success: renders a PDF, uploads it, and marks the job SUCCEEDED", async () => {
    await runExportJob(baseJob());

    expect(storage.putBookExport).toHaveBeenCalledTimes(1);
    const [userId, bookId, body] = storage.putBookExport.mock.calls[0];
    expect(userId).toBe("user1");
    expect(bookId).toBe("book1");
    // A real PDF stream — just assert it's non-trivial bytes starting with
    // the PDF magic header, not a specific byte-for-byte fixture.
    expect(body).toBeInstanceOf(Buffer);
    expect(Buffer.from(body).subarray(0, 5).toString("ascii")).toBe("%PDF-");

    expect(jobRepo.markSucceeded).toHaveBeenCalledWith("job1");
    expect(jobRepo.markFailed).not.toHaveBeenCalled();
  });

  it("fails without calling storage when the book isn't found", async () => {
    bookRepo.findForUser.mockResolvedValue(null);

    await runExportJob(baseJob());

    expect(storage.putBookExport).not.toHaveBeenCalled();
    expect(jobRepo.markFailed).toHaveBeenCalledTimes(1);
    expect(jobRepo.markFailed.mock.calls[0][1]).toMatch(/book not found/i);
  });

  it("fails without calling storage when there are no transcribed sections yet", async () => {
    sectionRepo.listForBook.mockResolvedValue([]);

    await runExportJob(baseJob());

    expect(storage.putBookExport).not.toHaveBeenCalled();
    expect(jobRepo.markFailed).toHaveBeenCalledTimes(1);
    expect(jobRepo.markFailed.mock.calls[0][1]).toMatch(/no transcribed sections/i);
  });

  it("marks the job FAILED if uploading the PDF throws", async () => {
    storage.putBookExport.mockRejectedValue(new Error("R2 upload exploded"));

    await runExportJob(baseJob());

    expect(jobRepo.markSucceeded).not.toHaveBeenCalled();
    expect(jobRepo.markFailed).toHaveBeenCalledTimes(1);
    expect(jobRepo.markFailed.mock.calls[0][1]).toMatch(/R2 upload exploded/);
  });
});
