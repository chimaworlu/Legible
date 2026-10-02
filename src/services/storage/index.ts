import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/src/config";

// Cloudflare R2 adapter. This module is the only place that touches object
// storage (AGENTS.md section 4). Call sites never build a key, talk to the
// S3 client directly, or read/write bytes themselves.

export interface PutObjectInput {
  userId: string;
  bookId: string;
  imageId: string;
  fileName: string;
  contentType: string;
  body: Uint8Array;
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "bin";
}

function bucketName(): string {
  const { bucket } = config.storage.r2;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not configured");
  return bucket;
}

let cachedClient: S3Client | null = null;
function client(): S3Client {
  if (cachedClient) return cachedClient;
  const { accountId, accessKeyId, secretAccessKey } = config.storage.r2;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 credentials are not configured");
  }
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

// Ownership-encoded key (r2-storage-handler skill step 1) — built only from
// ids the caller already validated (a session's own userId, a book/image row
// it already looked up), never from raw client input. Lets every read/write
// be checked against the requesting user before touching R2.
function originalKey(userId: string, bookId: string, imageId: string, fileName: string): string {
  return `users/${userId}/books/${bookId}/originals/${imageId}.${extensionOf(fileName)}`;
}

// Deterministic (no export id) — each new export simply overwrites the
// previous one, so there's nothing to track or clean up on Book/Job beyond
// the Job row itself.
function exportKey(userId: string, bookId: string): string {
  return `users/${userId}/books/${bookId}/export.pdf`;
}

export const storage = {
  async putBookImage({ userId, bookId, imageId, fileName, contentType, body }: PutObjectInput): Promise<string> {
    const key = originalKey(userId, bookId, imageId, fileName);
    await client().send(
      new PutObjectCommand({
        Bucket: bucketName(),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  },

  async delete(key: string): Promise<void> {
    await client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
  },

  // r2-storage-handler skill step 7 / security.md rule 8: all client access
  // goes through a short-lived signed URL — the bucket itself stays private,
  // never a permanent public object URL.
  async getSignedReadUrl(key: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<string> {
    return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucketName(), Key: key }), { expiresIn: expiresInSeconds });
  },

  // Server-side only (worker jobs, never a Next.js request handler) — the
  // AI pipeline needs actual bytes to send to a provider, not a browser-
  // facing signed URL. This is the only place that reads raw object bytes.
  async getObjectBytes(key: string): Promise<Uint8Array> {
    const response = await client().send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
    if (!response.Body) throw new Error(`R2 object has no body: ${key}`);
    return response.Body.transformToByteArray();
  },

  // Worker-only (the EXPORT job). Overwrites any previous export for this
  // book at the same deterministic key.
  async putBookExport(userId: string, bookId: string, body: Uint8Array): Promise<void> {
    await client().send(
      new PutObjectCommand({
        Bucket: bucketName(),
        Key: exportKey(userId, bookId),
        Body: body,
        ContentType: "application/pdf",
      }),
    );
  },

  async getBookExportSignedUrl(userId: string, bookId: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<string> {
    return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucketName(), Key: exportKey(userId, bookId) }), { expiresIn: expiresInSeconds });
  },
};
