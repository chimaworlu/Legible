---
name: r2-storage-handler
description: Use this skill whenever files move or die. Triggers include upload, storing an image or PDF, signed URL, storage key, R2, deleting a book, deleting an account, or diagram crops. The deletion procedure at the end is the part most often botched, so read it whenever anything is deleted.
---

# R2 Storage Handler

All bytes live in Cloudflare R2, reached only through src/services/storage. PostgreSQL holds keys and metadata, never bytes. The laws live in `uploads-and-storage.md` and `security.md` rules 8 to 10.

## Steps

1. Build keys with ownership encoded, from validated ids only, never raw client input (uploads-and-storage.md rule 5):

       users/<userId>/books/<bookId>/originals/<imageId>.<ext>
       users/<userId>/books/<bookId>/diagrams/<diagramId>.png
       users/<userId>/books/<bookId>/exports/<exportId>.pdf

2. Verify on every read and write that the requesting user matches the key's userId segment.
3. Validate uploads server-side: magic bytes say JPEG, PNG, or HEIC (R1); size under the config limit. The client's declared type is a claim, not a fact (uploads-and-storage.md rule 1, security.md rule 9).
4. Write the object and the SourceImage row as a pair. Object write fails: no row. Row write fails: delete the object (uploads-and-storage.md rule 10).
5. Make upload retries idempotent per file, keyed on a client-supplied upload id, so a dropped connection never produces two copies charged twice (uploads-and-storage.md rule 9).
6. Run the quality check next, before any AI spend (R4).
7. Hand files to users through short-lived signed URLs scoped to the owner. Buckets stay private (uploads-and-storage.md rule 6, security.md rule 8).
8. Treat originals as immutable. Every derived asset gets its own key. The side-by-side compare view (R20) depends on the untouched original (uploads-and-storage.md rule 7).

## The deletion procedure

Deletion parity means rows AND objects, together, always (uploads-and-storage.md rule 11).

Delete a book (R28):

1. List every storage key belonging to the book: originals, diagram crops, exports.
2. Delete the database rows in one transaction; the cascade takes sections, flags, diagrams, jobs.
3. Delete the listed objects. Log and retry any object that fails; a lingering object is an open promise.

Delete an account (R29): the same procedure across every book, then the user row. Verify afterward: a key listing under users/<userId>/ returns empty.

## Traps

- Rows deleted, objects orphaned. The failure users never see and never forgive.
- A permanent public URL for user content.
- Streaming bytes through an API route when a signed URL will do.
- Overwriting an original during processing.
- Skipping cleanup of worker temp files on the failure path. Clean in a finally (uploads-and-storage.md rule 13).

## Verify before done

- [ ] Magic-byte validation, size from config
- [ ] Row and object written as a pair, both failure paths handled
- [ ] Upload retries idempotent per file
- [ ] No public URLs; signed URLs short-lived and owner-scoped
- [ ] Originals never modified; derived assets on their own keys
- [ ] Post-delete key listing is empty
- [ ] Tests to write: orphan prevention in both directions; double-upload retry yields one object; book delete leaves zero rows and zero objects