import { S3Client, GetObjectCommand, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.1116.0";

// Raw port of src/services/storage/index.ts's read path plus putBookExport —
// everything this Edge Function's TRANSCRIBE and EXPORT jobs need. Signed-
// URL generation for the client stays on the Vercel side (src/services/
// storage's own getBookExportSignedUrl, used by app/api/books/[bookId]/export).

let cachedClient: S3Client | null = null;
function client(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  if (!accountId || !accessKeyId || !secretAccessKey) throw new Error("Cloudflare R2 credentials are not configured");
  cachedClient = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
  return cachedClient;
}

function bucketName(): string {
  const bucket = Deno.env.get("R2_BUCKET_NAME");
  if (!bucket) throw new Error("R2_BUCKET_NAME is not configured");
  return bucket;
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const response = await client().send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
  if (!response.Body) throw new Error(`R2 object has no body: ${key}`);
  return response.Body.transformToByteArray();
}

// Deterministic key (no export id) — matches src/services/storage's own
// exportKey format exactly, so a signed URL generated on the Vercel side
// resolves to whatever this writes.
function exportKey(userId: string, bookId: string): string {
  return `users/${userId}/books/${bookId}/export.pdf`;
}

export async function putBookExport(userId: string, bookId: string, body: Uint8Array): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: bucketName(), Key: exportKey(userId, bookId), Body: body, ContentType: "application/pdf" }));
}
