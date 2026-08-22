---
trigger: always_on
---

---
trigger: always_on
---

# git-conventions.md

Rules for how changes enter this repository.

## LAWS

1. Never commit directly to `main`. All work happens on a branch and enters
   `main` through a pull request.
2. Never merge a branch whose build fails. `tsc` clean and lint clean are
   pre-merge gates, not post-merge cleanup.
3. Never commit a secret. If a secret lands in any commit, even on a branch,
   the task has failed: rotate the secret immediately and scrub the history.
   Deleting the file in a follow-up commit is not a fix.
4. Schema and migration travel together. Any commit that changes
   `schema.prisma` includes its migration in the same commit. A schema change
   with no migration, or a migration with no schema change, is a failed task.
5. Every commit that implements or modifies a PRD requirement names the Rn
   number(s) in the message. Every commit that touches money, billing, plan
   limits, or the watermark gate names the rule file it obeyed
   (e.g. `money-and-billing.md`).
6. One concern per commit. Never bundle a schema migration, a feature, and a
   refactor into one commit. If it breaks, we must be able to revert one thing.
7. Never rewrite public history. No force-push to `main` or any shared branch.
8. Generated artifacts, `node_modules`, `.env` files, and local uploads never
   enter the repo. The `.gitignore` covering them is not edited to admit them.

## FORMAT (cheap and fixed)

- Branch names: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`.
- Commit message first line: `<type>: <what changed> (R12, R23)` under 72
  chars. Types: `feat`, `fix`, `chore`, `db`, `test`, `docs`.
- PR description states: requirements touched, AGENTS.md rules checked, and
  whether a migration is included.