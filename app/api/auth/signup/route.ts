import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/src/db/client";
import { sendWelcomeEmail } from "@/src/email/mailer";
import { hashRequestPayload, isUniqueConstraintError, isValidIdempotencyKey } from "@/src/auth/idempotency";
import { checkRateLimit, extractClientIp, rateLimitedResponse } from "@/src/services/rateLimit";
import { config } from "@/src/config";

const BCRYPT_COST_FACTOR = 12;

// Letters and spaces only, at least two words (first + last name). A 3rd,
// 4th, ... word (middle names, double surnames) is a valid edge case and is
// collected as-is into the single `name` column, which is an unbounded
// Postgres `text` field (no length or word-count cap).
const NAME_LETTERS_ONLY = /^[A-Za-z\s]*$/;
const NAME_AT_LEAST_TWO_WORDS = /^\S+\s+\S+.*$/;

const signupSchema = z.object({
  name: z
    .string()
    .min(1, "Full name is required")
    .regex(NAME_LETTERS_ONLY, "Full Name Must Use Only Letters")
    .regex(NAME_AT_LEAST_TWO_WORDS, "Full Name Must Contain At Least 2 Words"),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const ip = extractClientIp(req.headers);
  const rateLimit = await checkRateLimit(`signup:ip:${ip}`, config.rateLimits.signupPerIp);
  if (!rateLimit.allowed) {
    return rateLimitedResponse("Too many signup attempts from this network. Please try again later.");
  }

  const idempotencyKey = req.headers.get("idempotency-key");
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return Response.json({ message: "Missing or invalid Idempotency-Key header" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const result = signupSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ message: result.error.issues[0].message }, { status: 400 });
  }

  const { name, password } = result.data;
  // Lowercase so "User@Example.com" and "user@example.com" are treated as
  // the same account — Postgres' unique constraint is case-sensitive by
  // default and won't catch this on its own.
  const email = result.data.email.toLowerCase();
  const requestHash = hashRequestPayload({ name, email, password });

  // Replay check: has this exact key already been (or is currently being) processed?
  const existingKey = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
  if (existingKey) {
    if (existingKey.requestHash !== requestHash) {
      return Response.json({ message: "Idempotency key reused with a different request" }, { status: 422 });
    }
    if (existingKey.status === "completed") {
      return Response.json(existingKey.responseBody as object, { status: existingKey.responseStatus ?? 200 });
    }
    return Response.json({ message: "A request with this Idempotency-Key is already in progress" }, { status: 409 });
  }

  // Reserve the key. If we lose a tight race to another request with the
  // same key, defer to whichever one won and reply based on its outcome.
  try {
    await prisma.idempotencyKey.create({ data: { key: idempotencyKey, requestHash, status: "pending" } });
  } catch (err) {
    if (isUniqueConstraintError(err, "key")) {
      const winner = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
      if (winner?.status === "completed") {
        return Response.json(winner.responseBody as object, { status: winner.responseStatus ?? 200 });
      }
      return Response.json({ message: "A request with this Idempotency-Key is already in progress" }, { status: 409 });
    }
    throw err;
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

    // user.create's own `email` unique constraint is the actual race guard
    // here (not a pre-check) — two concurrent signups for the same email
    // can only ever result in one successful insert.
    const { user, responseBody } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash } });
      const responseBody = { message: "Success" };
      await tx.idempotencyKey.update({
        where: { key: idempotencyKey },
        data: { status: "completed", responseStatus: 200, responseBody },
      });
      return { user, responseBody };
    });

    // Fire-and-forget: a failure here must not block or fail account
    // creation. The verification code itself is intentionally NOT sent at
    // signup — it's only generated/sent when the user clicks "Verify" on
    // the dashboard (see EmailVerificationBanner + resend-verification route).
    sendWelcomeEmail(user.email, user.name ?? "there").catch((err) => {
      console.error("Failed to send welcome email", { userId: user.id, error: err instanceof Error ? err.message : err });
    });

    return Response.json(responseBody, { status: 200 });
  } catch (err) {
    if (isUniqueConstraintError(err, "email")) {
      const responseBody = { message: "Email already exists" };
      // The transaction above rolled back (email conflict aborts it), so the
      // reservation from earlier is still "pending" — resolve it here as its
      // own statement so a replay of this key returns the same cached result.
      await prisma.idempotencyKey
        .update({ where: { key: idempotencyKey }, data: { status: "completed", responseStatus: 400, responseBody } })
        .catch(() => {});
      return Response.json(responseBody, { status: 400 });
    }

    // Unexpected failure: release the reservation so a genuine retry with
    // the same key can start fresh instead of being stuck replaying nothing.
    await prisma.idempotencyKey.delete({ where: { key: idempotencyKey } }).catch(() => {});
    return Response.json({ message: "Internal Error" }, { status: 500 });
  }
}
