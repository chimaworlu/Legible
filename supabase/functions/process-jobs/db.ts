import { Pool } from "npm:pg@8.22.0";

// Raw-SQL port of src/db/repositories/{job,sourceImage,section,book,user}.ts
// — Prisma Client's own query engine can't run inside Deno (see the repo's
// process-jobs README / the conversation that led here: Prisma on Deno
// Deploy is unsupported as of Prisma 5.22, the version this repo is pinned
// to). Table/column names below match prisma/schema.prisma exactly — no
// @map/@@map is used anywhere in that schema, so Prisma's own identifiers
// are the real Postgres identifiers.

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL"), max: 3 });

export type JobRow = {
  id: string;
  userId: string;
  bookId: string;
  sourceImageId: string | null;
  type: "TRANSCRIBE" | "STRUCTURE" | "EXPORT" | "SUMMARIZE";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL";
  attempts: number;
  error: string | null;
};

export const jobRepo = {
  async listQueuedByType(type: JobRow["type"], limit: number): Promise<JobRow[]> {
    const { rows } = await pool.query(
      `SELECT id, "userId", "bookId", "sourceImageId", type, status, attempts, error
       FROM "Job" WHERE type = $1 AND status = 'QUEUED' ORDER BY "createdAt" ASC LIMIT $2`,
      [type, limit],
    );
    return rows;
  },

  async listForBook(bookId: string, type: JobRow["type"]): Promise<JobRow[]> {
    const { rows } = await pool.query(`SELECT status FROM "Job" WHERE "bookId" = $1 AND type = $2`, [bookId, type]);
    return rows;
  },

  async markRunning(id: string): Promise<void> {
    await pool.query(`UPDATE "Job" SET status = 'RUNNING', attempts = attempts + 1, "updatedAt" = now() WHERE id = $1`, [id]);
  },

  async markSucceeded(id: string): Promise<void> {
    await pool.query(`UPDATE "Job" SET status = 'SUCCEEDED', error = NULL, "updatedAt" = now() WHERE id = $1`, [id]);
  },

  async markFailed(id: string, error: string): Promise<void> {
    await pool.query(`UPDATE "Job" SET status = 'FAILED', error = $2, "updatedAt" = now() WHERE id = $1`, [id, error]);
  },
};

export const bookRepo = {
  async findForUser(id: string, userId: string): Promise<{ id: string; title: string; aiCostSpentMinor: number } | null> {
    const { rows } = await pool.query(`SELECT id, title, "aiCostSpentMinor" FROM "Book" WHERE id = $1 AND "userId" = $2`, [id, userId]);
    return rows[0] ?? null;
  },

  async updateStatus(id: string, status: "DRAFT" | "PROCESSING" | "READY" | "ARCHIVED"): Promise<void> {
    await pool.query(`UPDATE "Book" SET status = $2, "updatedAt" = now() WHERE id = $1`, [id, status]);
  },

  async incrementCostSpent(id: string, amountMinor: number): Promise<void> {
    await pool.query(`UPDATE "Book" SET "aiCostSpentMinor" = "aiCostSpentMinor" + $2, "updatedAt" = now() WHERE id = $1`, [id, amountMinor]);
  },
};

export const sourceImageRepo = {
  async findForBook(id: string, bookId: string): Promise<{ id: string; storageKey: string; format: string; imageOrder: number | null } | null> {
    const { rows } = await pool.query(`SELECT id, "storageKey", format, "imageOrder" FROM "SourceImage" WHERE id = $1 AND "bookId" = $2`, [id, bookId]);
    return rows[0] ?? null;
  },

  async updateStatus(id: string, status: "UPLOADED" | "QUALITY_FAILED" | "ACCEPTED" | "TRANSCRIBED" | "FAILED", qualityScore?: number): Promise<void> {
    if (qualityScore === undefined) {
      await pool.query(`UPDATE "SourceImage" SET status = $2 WHERE id = $1`, [id, status]);
    } else {
      await pool.query(`UPDATE "SourceImage" SET status = $2, "qualityScore" = $3 WHERE id = $1`, [id, status, qualityScore]);
    }
  },
};

export const sectionRepo = {
  async findForSourceImage(sourceImageId: string): Promise<{ id: string; originalText: string } | null> {
    const { rows } = await pool.query(`SELECT id, "originalText" FROM "Section" WHERE "sourceImageId" = $1 LIMIT 1`, [sourceImageId]);
    return rows[0] ?? null;
  },

  async updateSummary(id: string, summary: string): Promise<void> {
    await pool.query(`UPDATE "Section" SET summary = $2, "updatedAt" = now() WHERE id = $1`, [id, summary]);
  },

  async listForBook(bookId: string): Promise<{ originalText: string; summary: string | null }[]> {
    const { rows } = await pool.query(`SELECT "originalText", summary FROM "Section" WHERE "bookId" = $1 ORDER BY "order" ASC`, [bookId]);
    return rows;
  },

  // Section + its TranscriptionFlag rows, written atomically — same
  // guarantee as the Prisma version's $transaction (a half-written section
  // would silently violate R10/R11: GAP/LOW flags must always land
  // alongside the text they flag).
  async createWithFlags(input: {
    bookId: string;
    sourceImageId: string;
    order: number;
    originalText: string;
    confidence: "HIGH" | "LOW" | "GAP";
    flags: { startOffset: number; endOffset: number; type: "LOW" | "GAP" }[];
  }): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const sectionId = crypto.randomUUID();
      await client.query(
        `INSERT INTO "Section" (id, "bookId", "sourceImageId", "order", "originalText", confidence, "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [sectionId, input.bookId, input.sourceImageId, input.order, input.originalText, input.confidence],
      );
      for (const flag of input.flags) {
        await client.query(
          `INSERT INTO "TranscriptionFlag" (id, "sectionId", "startOffset", "endOffset", type) VALUES ($1, $2, $3, $4, $5)`,
          [crypto.randomUUID(), sectionId, flag.startOffset, flag.endOffset, flag.type],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};

export const userRepo = {
  async findPlanById(id: string): Promise<"FREE" | "PRO" | null> {
    const { rows } = await pool.query(`SELECT plan FROM "User" WHERE id = $1`, [id]);
    return rows[0]?.plan ?? null;
  },
};
