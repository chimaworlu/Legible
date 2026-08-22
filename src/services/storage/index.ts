import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { config } from "@/src/config";

// Storage interface. This module is the only place that touches object
// storage (AGENTS.md section 4). Call sites never build a key or read bytes.

export interface PutObjectInput {
  bookId: string;
  fileName: string;
  contentType: string;
  body: Uint8Array;
}

function extensionOf(fileName: string): string {
  const ext = path.extname(fileName).replace(/^\./, "").toLowerCase();
  return ext || "bin";
}

function sanitizeKey(key: string): string {
  const normalized = path.normalize(key).replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

async function resolvePath(key: string): Promise<string> {
  const safeKey = sanitizeKey(key);
  const base = path.resolve(process.cwd(), config.storage.local.baseDir);
  const full = path.resolve(base, safeKey);
  if (!full.startsWith(base)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export const storage = {
  async putBookImage({ bookId, fileName, body }: PutObjectInput): Promise<string> {
    const key = `books/${bookId}/${randomUUID()}.${extensionOf(fileName)}`;
    const full = await resolvePath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return key;
  },

  async delete(key: string): Promise<void> {
    const full = await resolvePath(key);
    await fs.rm(full, { force: true });
  },
};
