import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.1116.0";

// Raw port of the read path from src/services/storage/index.ts — only
// getObjectBytes is needed here (TRANSCRIBE's own only storage call).
// putBookExport/signed-URL generation stay on the Vercel side (and in the
// not-yet-ported EXPORT job).

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
