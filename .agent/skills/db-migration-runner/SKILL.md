---
name: db-migration-runner
description: Use this skill whenever schema.prisma changes in any way. Triggers include migration, schema, new model, new field, new enum, new index, new relation, or any task that mentions storing a new thing. Also use it when a task seems to need a change the locked schema forbids, so the change can be flagged instead of made.
---

# DB Migration Runner

How to change the database safely. The laws live in `database-schema.md`. The locked schema is PRD section 10.

## Steps

1. Write one sentence: what the change is and which requirement (Rn) needs it. No Rn, no change.
2. Classify the change. Additive (new model, new optional field, new enum value, new index): proceed. Rename, repurpose, type change, or delete: stop, flag for human sign-off recorded as a comment in the migration (database-schema.md rule 10), and wait.
3. Confirm nothing locked is touched: PlanType stays FREE and PRO, money stays amountMinor Int plus currency, TranscriptionFlag keeps its offsets, Job keeps sourceImageId, Diagram keeps sectionId and order (database-schema.md rules 2 to 6).
4. Edit prisma/schema.prisma using the house patterns below.
5. Run: npx prisma migrate dev --name <short_snake_case_name>
6. Open the generated SQL. Search for DROP and ALTER COLUMN. Finding either on an additive task means something went wrong. Do not apply. Investigate.
7. Run npx prisma generate and confirm tsc passes.
8. Update repositories in src/db only. No other file touches the Prisma client (AGENTS.md section 4).
9. Commit schema and migration together in one commit, tagged db: with the Rn (git-conventions.md rules 4 and 5).

## Skeletons

New money field, always this shape (money-and-billing.md rule 1):

    amountMinor Int
    currency    String @default("NGN")

New relation, always an index on the foreign key and an explicit onDelete that preserves the cascade (R28, R29):

    book   Book   @relation(fields: [bookId], references: [id], onDelete: Cascade)
    @@index([bookId])

New status-like field: an enum, never a free-text string.

## Traps

- Adding a CREDITS plan value back. Credits are a balance, never a plan (database-schema.md rule 2).
- A new relation that breaks the deletion chain. Ask of every relation: when the user deletes their account, does this row die too? Unclear answer means wrong relation.
- Storing bytes. No image, PDF, or base64 column, ever (database-schema.md rule 9).
- Editing an old migration instead of writing a new one. Migrations are forward-only.

## Verify before done

- [ ] Change is additive, or carries recorded human sign-off
- [ ] Generated SQL contains no destructive statement
- [ ] Deletion cascade reaches every new row type
- [ ] Money fields follow the kobo pattern
- [ ] Schema and migration in one commit with an Rn
- [ ] Tests to write: cascade delete removes the new rows; any business rule the field carries has a domain test