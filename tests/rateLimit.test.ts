import { randomUUID } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, extractClientIp } from "@/src/services/rateLimit";
import { prisma } from "@/src/db/client";

const testKeys: string[] = [];
function uniqueKey(): string {
  const key = `test:${randomUUID()}`;
  testKeys.push(key);
  return key;
}

afterEach(async () => {
  await prisma.rateLimitBucket.deleteMany({ where: { key: { in: testKeys.splice(0) } } });
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit, then blocks", async () => {
    const key = uniqueKey();
    const config = { limit: 3, windowMs: 60_000 };

    expect((await checkRateLimit(key, config)).allowed).toBe(true);
    expect((await checkRateLimit(key, config)).allowed).toBe(true);
    expect((await checkRateLimit(key, config)).allowed).toBe(true);
    const fourth = await checkRateLimit(key, config);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("tracks separate keys independently", async () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    const config = { limit: 1, windowMs: 60_000 };

    expect((await checkRateLimit(keyA, config)).allowed).toBe(true);
    expect((await checkRateLimit(keyA, config)).allowed).toBe(false);
    expect((await checkRateLimit(keyB, config)).allowed).toBe(true);
  });

  it("resets the count once the window has expired", async () => {
    const key = uniqueKey();
    // Wide enough that two back-to-back DB round trips can't accidentally
    // straddle the window boundary under load (that flaked at 10ms).
    const shortWindow = { limit: 1, windowMs: 300 };

    expect((await checkRateLimit(key, shortWindow)).allowed).toBe(true);
    expect((await checkRateLimit(key, shortWindow)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect((await checkRateLimit(key, shortWindow)).allowed).toBe(true);
  });
});

describe("extractClientIp", () => {
  it("reads x-forwarded-for from a fetch Headers instance", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(extractClientIp(headers)).toBe("203.0.113.5");
  });

  it("reads x-forwarded-for from a plain header record (NextAuth's authorize req)", () => {
    expect(extractClientIp({ "x-forwarded-for": "198.51.100.7" })).toBe("198.51.100.7");
  });

  it("returns 'unknown' when the header is absent", () => {
    expect(extractClientIp({})).toBe("unknown");
    expect(extractClientIp(undefined)).toBe("unknown");
  });
});
