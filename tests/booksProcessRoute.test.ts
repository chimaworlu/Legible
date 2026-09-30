import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { config } from "@/src/config";

// Route-level test mirroring tests/billingRateLimit.test.ts's convention:
// mock only the session, exercise the real route handler against the real
// (test) Postgres database, so rate-limit ordering, ownership checks, and
// status transitions are all under test as actually wired, not reimplemented.
vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-auth")>();
  return { ...actual, getServerSession: vi.fn() };
});

import { getServerSession } from "next-auth";
import { POST as processPost } from "@/app/api/books/[bookId]/process/route";

const mockedGetServerSession = vi.mocked(getServerSession);

function mockSessionFor(userId: string) {
  mockedGetServerSession.mockResolvedValue({ user: { id: userId } } as never);
}

function processRequest(): Request {
  return new Request("http://localhost/api/books/x/process", { method: "POST" });
}

function callProcess(bookId: string) {
  return processPost(processRequest(), { params: Promise.resolve({ bookId }) });
}

const userIdsToClean: string[] = [];
const rateLimitKeysToClean: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIdsToClean.splice(0) } } }); // cascades book/image/job rows
  await prisma.rateLimitBucket.deleteMany({ where: { key: { in: rateLimitKeysToClean.splice(0) } } });
  vi.clearAllMocks();
});

async function seedUserWithBook(options: { bookStatus?: "DRAFT" | "PROCESSING"; withImage?: boolean } = {}) {
  const user = await prisma.user.create({ data: { email: `test-process-${randomUUID()}@example.com` } });
  userIdsToClean.push(user.id);
  const book = await prisma.book.create({ data: { title: "Test Book", userId: user.id, status: options.bookStatus ?? "DRAFT" } });
  if (options.withImage) {
    await prisma.sourceImage.create({ data: { bookId: book.id, storageKey: `users/${user.id}/books/${book.id}/originals/img1.jpg`, format: "jpeg", imageOrder: 0 } });
  }
  return { user, book };
}

describe("POST /api/books/[bookId]/process", () => {
  it("returns 401 without a session", async () => {
    mockedGetServerSession.mockResolvedValue(null as never);
    const res = await callProcess("nonexistent");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a book the user doesn't own", async () => {
    const { user } = await seedUserWithBook({ withImage: true });
    mockSessionFor(user.id);
    const res = await callProcess("some-other-book-id");
    expect(res.status).toBe(404);
  });

  it("returns 400 when the book has no images", async () => {
    const { user, book } = await seedUserWithBook({ withImage: false });
    mockSessionFor(user.id);
    const res = await callProcess(book.id);
    expect(res.status).toBe(400);
  });

  it("returns 409 when the book isn't in DRAFT", async () => {
    const { user, book } = await seedUserWithBook({ bookStatus: "PROCESSING", withImage: true });
    mockSessionFor(user.id);
    const res = await callProcess(book.id);
    expect(res.status).toBe(409);
  });

  it("transitions a DRAFT book to PROCESSING and enqueues a TRANSCRIBE job per image", async () => {
    const { user, book } = await seedUserWithBook({ withImage: true });
    mockSessionFor(user.id);

    const res = await callProcess(book.id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("PROCESSING");

    const updated = await prisma.book.findUnique({ where: { id: book.id } });
    expect(updated?.status).toBe("PROCESSING");

    const jobs = await prisma.job.findMany({ where: { bookId: book.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe("TRANSCRIBE");
    expect(jobs[0].status).toBe("QUEUED");
  });

  it(
    `allows up to ${config.rateLimits.processPerUser.limit} attempts, then returns 429`,
    async () => {
      const userId = `test-process-rl-${randomUUID()}`;
      rateLimitKeysToClean.push(`process:user:${userId}`);
      mockSessionFor(userId);

      for (let i = 0; i < config.rateLimits.processPerUser.limit; i++) {
        const res = await callProcess("nonexistent");
        expect(res.status, `attempt ${i + 1} should not be rate-limited yet`).not.toBe(429);
      }

      const blocked = await callProcess("nonexistent");
      expect(blocked.status).toBe(429);
    },
    20000,
  );
});
