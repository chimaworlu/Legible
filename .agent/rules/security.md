---
trigger: always_on
---

---
trigger: always_on
---

# security.md

Rules protecting user data, money flows, and access. Every rule here is a law.
There is no guidance section in this file on purpose.

## Identity and access

1. Every API route and server action that touches user data verifies the
   session first and scopes every query to the authenticated user's id.
   An endpoint that returns another user's book, image, flag, or transaction
   is a failed task regardless of how it was reached.
2. No minimum sign-up age is enforced (R26 removed by product decision). Do
   not reintroduce an age gate without a new explicit instruction.
3. Auth flows are rate-limited. Sign-up, login, and password endpoints must
   have per-IP and per-account throttles. Upload endpoints are rate-limited
   per user.
4. Sessions and tokens follow Auth.js defaults or stricter. Never store a
   session token in localStorage. Never log a token, password, or session id.

## Payments and webhooks

5. Every Flutterwave webhook is verified against its signature/secret hash
   before any handler logic runs. An unverified webhook is dropped and logged.
   Processing an unverified webhook is a failed task.
6. Webhook handlers are idempotent. The same event delivered twice must not
   grant credits twice or extend a subscription twice. Use the provider
   reference as an idempotency key.
7. Payment state changes come only from verified webhooks or verified
   server-side confirmation calls. Never trust a client-side "payment
   succeeded" signal to grant anything.

## Files and storage

8. All R2 access goes through short-lived signed URLs. Buckets are never
   public. A permanently public object URL for user content is a failed task.
9. Uploads are validated server-side: file type (JPEG, PNG, HEIC per R1),
   size limit from config, and content sniffing — never trust the client's
   declared MIME type or extension.
10. Exported PDFs are private objects, fetched through signed URLs scoped to
    the owning user.

## AI provider

11. Every call to the AI provider runs with training/retention disabled, set
    explicitly in the request or account configuration — never assumed from
    provider defaults. User notes are never used to train any model. This is
    a promise in the PRD (section 9) and breaking it silently is the worst
    failure this file describes.
12. Prompts sent to the AI never include another user's content, and never
    include secrets or internal config.

## Data protection

13. Deletion is real deletion. R28 and R29 delete database rows AND the
    corresponding R2 objects (images, diagram crops, exported PDFs). Rows
    gone but objects orphaned in storage is a failed task.
14. Personally identifying data and note content never appear in logs. Log
    ids, not content.
15. All traffic is HTTPS. All environment secrets live in the deployment
    platform's secret store, never in the repo or build output.
16. Dependencies with known critical vulnerabilities block the build. Run the
    audit in CI; never ship with a known-critical advisory unaddressed.