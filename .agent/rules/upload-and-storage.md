---
trigger: always_on
---

---
trigger: always_on
---

# uploads-and-storage.md

Rules for file intake, object storage, and batch behavior. Storage is
Cloudflare R2, reached only through `src/services/storage`.

## Intake

1. Accepted formats are JPEG, PNG, and HEIC (R1). Reject everything else
   server-side. Validation checks real file content (magic bytes), never just
   the extension or client-declared MIME type.
2. Max file size and the 50-image technical batch ceiling come from
   `src/config`. Plan caps are enforced BEFORE the batch ceiling (R3, R31),
   and both before any byte is stored or any AI call is made.
3. The quality check (R4) runs before transcription. An image that fails
   quality is marked `QUALITY_FAILED` with a re-upload prompt (R5) and never
   proceeds to a paid AI call. Never spend AI cost on an image that already
   failed intake.

## Where bytes live

4. All binary data lives in R2: originals, diagram crops, exported PDFs.
   PostgreSQL stores only `storageKey` and metadata. A blob in a database
   column is a failed task (AGENTS.md section 4).
5. Object keys encode ownership: `users/<userId>/books/<bookId>/...`. Every
   storage read and write verifies the requesting user matches the key's
   owner. Never construct a key from unvalidated client input.
6. All client access to objects is through short-lived signed URLs. Buckets
   stay private (see security.md rule 8).
7. Original images are immutable once accepted. Processing never overwrites
   an original; derived assets (crops, thumbnails) get their own keys. The
   original is the source of truth for re-transcription and the side-by-side
   compare view (R20).

## Batch behavior

8. Uploads are per-image, with per-image status and an overall batch status
   (R6). One failed image never fails the batch: it is isolated, marked
   `FAILED` or `QUALITY_FAILED`, and the batch continues to a `PARTIAL`
   outcome where needed (AGENTS.md section 4).
9. Uploads are resumable or safely retryable. On a dropped connection, a
   retry must not create duplicate images: uploads are idempotent per file
   within a batch. This exists because slow connectivity is a named PRD risk
   (section 9).
10. A book upload writes the `SourceImage` row and the R2 object as a pair.
    If the object write fails, no row persists; if the row write fails, the
    object is cleaned up. Never leave a row without an object or an object
    without a row.

## Retention and deletion

11. Deletion parity is absolute: deleting a book deletes its R2 objects
    (originals, crops, PDFs) along with its rows (R28). Deleting an account
    deletes everything (R29). Rows-deleted-objects-orphaned is a failed task.
12. Originals are kept until the user deletes them (PRD confirmed
    assumption). Never add an automatic expiry or cleanup job that removes a
    living user's originals.
13. Temporary and intermediate files created during processing are cleaned up
    by the worker when the job ends, success or failure.