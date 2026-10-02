import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { config } from "@/src/config";

// Route-level test: exercises the actual exported POST handlers, mocking
// only the session so real config keys/values and call ordering (rate limit
// checked before any DB/Flutterwave work) are what's under test — not a
// reimplementation of checkRateLimit itself (see rateLimit.test.ts for that).
vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-auth")>();
  return { ...actual, getServerSession: vi.fn() };
});

import { getServerSession } from "next-auth";
import { POST as checkoutPost } from "@/app/api/billing/checkout/route";
import { POST as cancelPost } from "@/app/api/billing/cancel/route";

const mockedGetServerSession = vi.mocked(getServerSession);

function mockSessionFor(userId: string) {
  mockedGetServerSession.mockResolvedValue({ user: { id: userId } } as never);
}

function checkoutRequest(): Request {
  return new Request("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interval: "monthly" }),
  });
}

// Neither handler needs a real user/subscription row to reach its rate-limit
// check — it runs before any DB lookup in both routes — so a throwaway
// userId that matches nothing is enough; only the RateLimitBucket row it
// creates needs cleaning up.
const rateLimitKeysToClean: string[] = [];
afterEach(async () => {
  await prisma.rateLimitBucket.deleteMany({ where: { key: { in: rateLimitKeysToClean.splice(0) } } });
  vi.clearAllMocks();
});

describe("POST /api/billing/checkout rate limiting", () => {
  // Generous timeout: each attempt is a real Postgres round trip through the
  // route handler, and this file runs alongside every other suite's own DB
  // traffic under vitest's default parallel file execution — plenty under
  // isolated conditions, but pool contention can push a handful of
  // sequential round trips past the 5s default when the whole suite runs.
  it(
    `allows up to ${config.rateLimits.checkoutPerUser.limit} attempts, then returns 429`,
    async () => {
      const userId = `test-checkout-${randomUUID()}`;
      rateLimitKeysToClean.push(`checkout:user:${userId}`);
      mockSessionFor(userId);

      for (let i = 0; i < config.rateLimits.checkoutPerUser.limit; i++) {
        const res = await checkoutPost(checkoutRequest());
        expect(res.status, `attempt ${i + 1} should not be rate-limited yet`).not.toBe(429);
      }

      const blocked = await checkoutPost(checkoutRequest());
      expect(blocked.status).toBe(429);
      const body = (await blocked.json()) as { message?: string };
      expect(body.message).toMatch(/too many/i);
    },
    20000,
  );

  it(
    "keeps separate users' quotas independent",
    async () => {
      const userA = `test-checkout-${randomUUID()}`;
      const userB = `test-checkout-${randomUUID()}`;
      rateLimitKeysToClean.push(`checkout:user:${userA}`, `checkout:user:${userB}`);

      mockSessionFor(userA);
      for (let i = 0; i < config.rateLimits.checkoutPerUser.limit; i++) {
        await checkoutPost(checkoutRequest());
      }
      expect((await checkoutPost(checkoutRequest())).status).toBe(429);

      mockSessionFor(userB);
      expect((await checkoutPost(checkoutRequest())).status).not.toBe(429);
    },
    20000,
  );
});

describe("POST /api/billing/cancel rate limiting", () => {
  it(
    `allows up to ${config.rateLimits.cancelPerUser.limit} attempts, then returns 429`,
    async () => {
      const userId = `test-cancel-${randomUUID()}`;
      rateLimitKeysToClean.push(`cancel:user:${userId}`);
      mockSessionFor(userId);

      for (let i = 0; i < config.rateLimits.cancelPerUser.limit; i++) {
        const res = await cancelPost();
        expect(res.status, `attempt ${i + 1} should not be rate-limited yet`).not.toBe(429);
      }

      const blocked = await cancelPost();
      expect(blocked.status).toBe(429);
      const body = (await blocked.json()) as { message?: string };
      expect(body.message).toMatch(/too many/i);
    },
    20000,
  );

  it(
    "keeps separate users' quotas independent",
    async () => {
      const userA = `test-cancel-${randomUUID()}`;
      const userB = `test-cancel-${randomUUID()}`;
      rateLimitKeysToClean.push(`cancel:user:${userA}`, `cancel:user:${userB}`);

      mockSessionFor(userA);
      for (let i = 0; i < config.rateLimits.cancelPerUser.limit; i++) {
        await cancelPost();
      }
      expect((await cancelPost()).status).toBe(429);

      mockSessionFor(userB);
      expect((await cancelPost()).status).not.toBe(429);
    },
    20000,
  );
});
