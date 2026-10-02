import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { config } from "@/src/config";

vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-auth")>();
  return { ...actual, getServerSession: vi.fn() };
});

const { storage } = vi.hoisted(() => ({
  storage: { getBookExportSignedUrl: vi.fn().mockResolvedValue("https://r2.example/signed-export-url") },
}));
vi.mock("@/src/services/storage", () => ({ storage }));

import { getServerSession } from "next-auth";
import { POST as exportPost, GET as exportGet } from "@/app/api/books/[bookId]/export/route";

const mockedGetServerSession = vi.mocked(getServerSession);

function mockSessionFor(userId: string) {
  mockedGetServerSession.mockResolvedValue({ user: { id: userId } } as never);
}

function req(): Request {
  return new Request("http://localhost/api/books/x/export", { method: "POST" });
}

function callPost(bookId: string) {
  return exportPost(req(), { params: Promise.resolve({ bookId }) });
}

function callGet(bookId: string) {
  return exportGet(req(), { params: Promise.resolve({ bookId }) });
}

const userIdsToClean: string[] = [];
const rateLimitKeysToClean: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIdsToClean.splice(0) } } }); // cascades book/job rows
  await prisma.rateLimitBucket.deleteMany({ where: { key: { in: rateLimitKeysToClean.splice(0) } } });
  vi.clearAllMocks();
  storage.getBookExportSignedUrl.mockResolvedValue("https://r2.example/signed-export-url");
});

async function seedUserBook(status: "DRAFT" | "PROCESSING" | "READY" = "READY") {
  const user = await prisma.user.create({ data: { email: `test-export-${randomUUID()}@example.com` } });
  userIdsToClean.push(user.id);
  const book = await prisma.book.create({ data: { title: "Test Book", userId: user.id, status } });
  return { user, book };
}

describe("POST /api/books/[bookId]/export", () => {
  it("returns 401 without a session", async () => {
    mockedGetServerSession.mockResolvedValue(null as never);
    const res = await callPost("b");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a book the user doesn't own", async () => {
    const { user } = await seedUserBook();
    mockSessionFor(user.id);
    const res = await callPost("nonexistent-book");
    expect(res.status).toBe(404);
  });

  it("returns 409 when the book isn't READY yet", async () => {
    const { user, book } = await seedUserBook("PROCESSING");
    mockSessionFor(user.id);
    const res = await callPost(book.id);
    expect(res.status).toBe(409);
  });

  it("enqueues an EXPORT job on success", async () => {
    const { user, book } = await seedUserBook();
    mockSessionFor(user.id);

    const res = await callPost(book.id);
    expect(res.status).toBe(200);

    const jobs = await prisma.job.findMany({ where: { bookId: book.id, type: "EXPORT" } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("QUEUED");
    expect(jobs[0].sourceImageId).toBeNull();
  });

  it("returns 409 when an export is already in progress for this book", async () => {
    const { user, book } = await seedUserBook();
    mockSessionFor(user.id);

    await callPost(book.id);
    const second = await callPost(book.id);
    expect(second.status).toBe(409);
  });

  it(
    `allows up to ${config.rateLimits.exportPerUser.limit} attempts, then returns 429`,
    async () => {
      const userId = `test-export-rl-${randomUUID()}`;
      rateLimitKeysToClean.push(`export:user:${userId}`);
      mockSessionFor(userId);

      for (let i = 0; i < config.rateLimits.exportPerUser.limit; i++) {
        const res = await callPost("nonexistent");
        expect(res.status, `attempt ${i + 1} should not be rate-limited yet`).not.toBe(429);
      }

      const blocked = await callPost("nonexistent");
      expect(blocked.status).toBe(429);
    },
    20000,
  );
});

describe("GET /api/books/[bookId]/export", () => {
  it("returns a download URL once the job succeeds", async () => {
    const { user, book } = await seedUserBook();
    mockSessionFor(user.id);
    await prisma.job.create({ data: { userId: user.id, bookId: book.id, type: "EXPORT", status: "SUCCEEDED" } });

    const res = await callGet(book.id);
    const body = (await res.json()) as { status: string; downloadUrl: string | null };
    expect(body.status).toBe("SUCCEEDED");
    expect(body.downloadUrl).toBe("https://r2.example/signed-export-url");
  });

  it("returns no download URL while the job is still running", async () => {
    const { user, book } = await seedUserBook();
    mockSessionFor(user.id);
    await prisma.job.create({ data: { userId: user.id, bookId: book.id, type: "EXPORT", status: "RUNNING" } });

    const res = await callGet(book.id);
    const body = (await res.json()) as { status: string; downloadUrl: string | null };
    expect(body.status).toBe("RUNNING");
    expect(body.downloadUrl).toBeNull();
    expect(storage.getBookExportSignedUrl).not.toHaveBeenCalled();
  });

  it("returns null status when no export has ever been started", async () => {
    const { user, book } = await seedUserBook();
    mockSessionFor(user.id);

    const res = await callGet(book.id);
    const body = (await res.json()) as { status: string | null; downloadUrl: string | null };
    expect(body.status).toBeNull();
    expect(body.downloadUrl).toBeNull();
  });
});
