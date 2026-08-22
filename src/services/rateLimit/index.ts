import { prisma } from "@/src/db/client";

export type RateLimitConfig = { limit: number; windowMs: number };
export type RateLimitResult = { allowed: boolean; remaining: number; limit: number };

// Postgres-backed fixed-window counter (AGENTS.md section 4 provider-boundary
// pattern, mirrored from src/services/storage). This project's
// docker-compose.yml provisions Postgres only — no Redis — so this rides
// the datastore actually available here rather than assuming
// infrastructure that isn't part of this project. Swapping to Redis later
// only touches this module.
//
// Atomicity: the INSERT ... ON CONFLICT is one statement, so two concurrent
// requests for the same key can't both read a stale pre-increment count —
// Postgres serializes the conflicting upserts against each other.
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + config.windowMs);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${resetAt} ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count"
  `;

  const count = rows[0]?.count ?? 1;
  return { allowed: count <= config.limit, remaining: Math.max(0, config.limit - count), limit: config.limit };
}

export function rateLimitedResponse(message = "Too many requests. Please try again later."): Response {
  return Response.json({ message }, { status: 429 });
}

// Accepts either a fetch Headers instance (Next.js Route Handlers) or the
// plain header record NextAuth's authorize() receives — same extraction
// logic either way.
export function extractClientIp(headers: Headers | Record<string, unknown> | undefined): string {
  if (!headers) return "unknown";
  const raw = typeof (headers as Headers).get === "function" ? (headers as Headers).get("x-forwarded-for") : (headers as Record<string, unknown>)["x-forwarded-for"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === "string" && value.trim().length > 0) {
    return value.split(",")[0].trim();
  }
  return "unknown";
}
