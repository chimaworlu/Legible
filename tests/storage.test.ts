import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above imports, so the mutable config object
// they close over has to be created through vi.hoisted rather than a plain
// module-level const (referencing an un-hoisted const here would throw).
const { mockR2Config } = vi.hoisted(() => ({
  mockR2Config: {
    accountId: "",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "",
  },
}));

vi.mock("@/src/config", () => ({
  config: { storage: { r2: mockR2Config } },
}));

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  // Must be a real function, not an arrow, so `new S3Client(...)` in the
  // adapter can construct it — a function that returns an object overrides
  // the constructed `this` with that object.
  S3Client: vi.fn().mockImplementation(function S3ClientMock() {
    return { send: sendMock };
  }),
  PutObjectCommand: vi.fn().mockImplementation(function PutObjectCommandMock(this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
  DeleteObjectCommand: vi.fn().mockImplementation(function DeleteObjectCommandMock(this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
  GetObjectCommand: vi.fn().mockImplementation(function GetObjectCommandMock(this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://r2.example/signed-url"),
}));

import { storage } from "@/src/services/storage";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// This test intentionally runs before any test below gives mockR2Config real
// values — the storage module caches its S3Client the first time one is
// built successfully, so the "credentials missing" guard is only observable
// pre-cache. Order within this file matters for that reason.
describe("storage credential guard", () => {
  it("throws a clear error instead of an SDK error when R2 credentials aren't configured", async () => {
    await expect(
      storage.putBookImage({
        userId: "user1",
        bookId: "book1",
        imageId: "image1",
        fileName: "note.jpg",
        contentType: "image/jpeg",
        body: new Uint8Array([1]),
      }),
    ).rejects.toThrow(/R2 credentials/i);
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("storage (with R2 configured)", () => {
  beforeEach(() => {
    Object.assign(mockR2Config, {
      accountId: "test-account",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      bucket: "test-bucket",
    });
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  describe("putBookImage", () => {
    it("builds an ownership-encoded key and uploads to R2", async () => {
      const key = await storage.putBookImage({
        userId: "user1",
        bookId: "book1",
        imageId: "image1",
        fileName: "note.jpg",
        contentType: "image/jpeg",
        body: new Uint8Array([1, 2, 3]),
      });

      expect(key).toBe("users/user1/books/book1/originals/image1.jpg");
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "users/user1/books/book1/originals/image1.jpg",
        Body: expect.any(Uint8Array),
        ContentType: "image/jpeg",
      });
      expect(sendMock).toHaveBeenCalledTimes(1);
    });

    it("falls back to a 'bin' extension when the file name has none", async () => {
      const key = await storage.putBookImage({
        userId: "u",
        bookId: "b",
        imageId: "i",
        fileName: "noextension",
        contentType: "image/jpeg",
        body: new Uint8Array(),
      });
      expect(key).toBe("users/u/books/b/originals/i.bin");
    });

    it("throws when the bucket name isn't configured, even with valid credentials", async () => {
      mockR2Config.bucket = "";
      await expect(
        storage.putBookImage({
          userId: "u",
          bookId: "b",
          imageId: "i",
          fileName: "note.jpg",
          contentType: "image/jpeg",
          body: new Uint8Array(),
        }),
      ).rejects.toThrow(/R2_BUCKET_NAME/);
    });
  });

  describe("delete", () => {
    it("issues a DeleteObjectCommand for the given key", async () => {
      await storage.delete("users/u/books/b/originals/i.jpg");
      expect(DeleteObjectCommand).toHaveBeenCalledWith({ Bucket: "test-bucket", Key: "users/u/books/b/originals/i.jpg" });
      expect(sendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getSignedReadUrl", () => {
    it("returns a signed URL scoped to the key, defaulting to a 300s expiry", async () => {
      const url = await storage.getSignedReadUrl("users/u/books/b/originals/i.jpg");
      expect(url).toBe("https://r2.example/signed-url");
      expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: "test-bucket", Key: "users/u/books/b/originals/i.jpg" });
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 300 });
    });

    it("honors a custom expiry", async () => {
      await storage.getSignedReadUrl("k", 60);
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 60 });
    });
  });
});
