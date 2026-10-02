import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { config } from "@/src/config";

vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-auth")>();
  return { ...actual, getServerSession: vi.fn() };
});

import { getServerSession } from "next-auth";
import { POST as summarizePost, GET as summarizeGet } from "@/app/api/books/[bookId]/images/[imageId]/summarize/route";

const mockedGetServerSession = vi.mocked(getServerSession);

function mockSessionFor(userId: string) {
  mockedGetServerSession.mockResolvedValue({ user: { id: userId } } as never);
}

function req(): Request {
  return new Request("http://localhost/api/books/x/images/y/summarize", { method: "POST" });
}

function callPost(bookId: string, imageId: string) {
  return summarizePost(req(), { params: Promise.resolve({ bookId, imageId }) });
}

function callGet(bookId: string, imageId: string) {
  return summarizeGet(req(), { params: Promise.resolve({ bookId, imageId }) });
}

const userIdsToClean: string[] = [];
const rateLimitKeysToClean: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIdsToClean.splice(0) } } }); // cascades book/image/section/job rows
  await prisma.rateLimitBucket.deleteMany({ where: { key: { in: rateLimitKeysToClean.splice(0) } } });
  vi.clearAllMocks();
});

async function seedUserBookImage(options: { withSection?: boolean } = {}) {
  const user = await prisma.user.create({ data: { email: `test-summarize-${randomUUID()}@example.com` } });
  userIdsToClean.push(user.id);
  const book = await prisma.book.create({ data: { title: "Test Book", userId: user.id, status: "READY" } });
  const image = await prisma.sourceImage.create({
    data: { bookId: book.id, storageKey: `users/${user.id}/books/${book.id}/originals/img1.jpg`, format: "jpeg", imageOrder: 0, status: "TRANSCRIBED" },
  });
  if (options.withSection) {
    await prisma.section.create({ data: { bookId: book.id, sourceImageId: image.id, order: 0, originalText: "hello world" } });
  }
  return { user, book, image };
}

describe("POST /api/books/[bookId]/images/[imageId]/summarize", () => {
  it("returns 401 without a session", async () => {
    mockedGetServerSession.mockResolvedValue(null as never);
    const res = await callPost("b", "i");
    expect(res.status).toBe(401);
  });

  it("returns 404 for an image the user doesn't own", async () => {
    const { user } = await seedUserBookImage({ withSection: true });
    mockSessionFor(user.id);
    const res = await callPost("nonexistent-book", "nonexistent-image");
    expect(res.status).toBe(404);
  });

  it("returns 400 when the note hasn't been transcribed yet", async () => {
    const { user, book, image } = await seedUserBookImage({ withSection: false });
    mockSessionFor(user.id);
    const res = await callPost(book.id, image.id);
    expect(res.status).toBe(400);
  });

  it("enqueues a SUMMARIZE job on success", async () => {
    const { user, book, image } = await seedUserBookImage({ withSection: true });
    mockSessionFor(user.id);

    const res = await callPost(book.id, image.id);
    expect(res.status).toBe(200);

    const jobs = await prisma.job.findMany({ where: { bookId: book.id, sourceImageId: image.id, type: "SUMMARIZE" } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("QUEUED");
  });

  it("returns 409 when a summarize job is already in progress for this image", async () => {
    const { user, book, image } = await seedUserBookImage({ withSection: true });
    mockSessionFor(user.id);

    await callPost(book.id, image.id);
    const second = await callPost(book.id, image.id);
    expect(second.status).toBe(409);
  });

  it(
    `allows up to ${config.rateLimits.summarizePerUser.limit} attempts, then returns 429`,
    async () => {
      const userId = `test-summarize-rl-${randomUUID()}`;
      rateLimitKeysToClean.push(`summarize:user:${userId}`);
      mockSessionFor(userId);

      for (let i = 0; i < config.rateLimits.summarizePerUser.limit; i++) {
        const res = await callPost("nonexistent", "nonexistent");
        expect(res.status, `attempt ${i + 1} should not be rate-limited yet`).not.toBe(429);
      }

      const blocked = await callPost("nonexistent", "nonexistent");
      expect(blocked.status).toBe(429);
    },
    20000,
  );
});

describe("GET /api/books/[bookId]/images/[imageId]/summarize", () => {
  it("returns the stored summary once the job succeeds", async () => {
    const { user, book, image } = await seedUserBookImage({ withSection: true });
    mockSessionFor(user.id);

    await prisma.section.updateMany({ where: { sourceImageId: image.id }, data: { summary: "A short recap." } });
    await prisma.job.create({ data: { userId: user.id, bookId: book.id, sourceImageId: image.id, type: "SUMMARIZE", status: "SUCCEEDED" } });

    const res = await callGet(book.id, image.id);
    const body = (await res.json()) as { status: string; summary: string | null };
    expect(body.status).toBe("SUCCEEDED");
    expect(body.summary).toBe("A short recap.");
  });
});
