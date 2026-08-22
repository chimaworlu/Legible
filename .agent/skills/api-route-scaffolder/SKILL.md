---
name: api-route-scaffolder
description: Use this skill whenever creating or editing a Next.js API route, route handler, or server action. Triggers include route, endpoint, handler, server action, or any feature where the browser asks the server for something. Use it before writing the handler, because the opening ritual is the whole point.
---

# API Route Scaffolder

Every route has the same skeleton. Routes are thin: they check, they enqueue or read, they answer. The laws live in `security.md` and AGENTS.md section 4.

## Steps

1. Resolve the authenticated user first. No session, respond 401, stop (security.md rule 1).
2. Validate body and params with a zod schema. Invalid input, respond 400 naming the failed field, stop.
3. Fetch every client-sent id scoped to the session user's id. Not found under that scope, respond 404. Never fetch by id alone (security.md rule 1).
4. If the action consumes allowance, check the plan limit through the domain function reading src/config, before any cost is incurred (R3, R31).
5. Act thin: enqueue a job, read status, or one small write through src/db. Never call the AI, process an image, or render a PDF here (AGENTS.md section 4).
6. Answer clearly. Blocked actions name what happened and the way forward (R31).

## Skeleton

    export async function POST(req: Request) {
      const user = await requireUser();                    // step 1
      const input = uploadSchema.parse(await req.json());  // step 2

      const book = await bookRepo.findForUser(input.bookId, user.id); // step 3
      if (!book) return notFound();

      const gate = checkUploadAllowance(user, book, input.count);     // step 4
      if (!gate.ok) return blocked(gate);

      const job = await queue.enqueueTranscribe({ bookId: book.id, userId: user.id }); // step 5
      return Response.json({ jobId: job.id });                         // step 6
    }

Blocked-message shape (R31):

    { error: "PLAN_LIMIT", message: "This upload exceeds your plan's 30 images this month. Upgrade to PRO or buy credits to continue." }

## Traps

- Reordering the ritual. Ownership before session, or work before limits, opens holes and spends money on blocked users.
- An AI SDK import or provider name in a route (ai-pipeline.md rule 1).
- Streaming image or PDF bytes through the response. Hand out signed URLs instead (uploads-and-storage.md rule 6).
- A price, cap, or limit as a literal number (coding-standards.md law 8).
- "Upload failed" as a message. Specific reason, specific next step, always.

## Verify before done

- [ ] Ritual steps 1 to 4 present, in order
- [ ] Handler body under roughly 30 lines; anything bigger belongs in the worker or domain
- [ ] Blocked responses follow the message pattern
- [ ] No provider names, no literals, no unscoped queries
- [ ] tsc and lint clean
- [ ] Tests to write: 401 with no session; 404 for another user's resource; blocked response at the plan limit