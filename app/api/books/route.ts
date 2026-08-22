import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { userRepo } from "@/src/db/repositories/user";
import { bookRepo } from "@/src/db/repositories/book";
import { getPlanLimits, checkBookCreationAllowance } from "@/src/domain/planLimits";

const createBookSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
});

// Scaffolds book creation only — the Book row itself (title, DRAFT status).
// Uploading images and running the pipeline (TRANSCRIBE/STRUCTURE/EXPORT)
// happen later, in worker/, once this row exists (AGENTS.md section 4).
export async function POST(req: Request) {
  // 1. Session first (security.md rule 1, api-route-scaffolder step 1).
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  // 2. Validate input.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  const result = createBookSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ message: result.error.issues[0].message }, { status: 400 });
  }

  // 4. Plan limit, checked before the write (R31) — the same "Books this
  // month" cap already shown on the dashboard stat card.
  const user = await userRepo.findById(userId);
  const plan = user?.plan ?? "FREE";
  const limits = getPlanLimits(plan);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const booksThisMonth = await bookRepo.countCreatedSince(userId, startOfMonth);

  const allowance = checkBookCreationAllowance(limits, booksThisMonth);
  if (!allowance.allowed) {
    return Response.json({ error: "PLAN_LIMIT", message: allowance.message }, { status: 403 });
  }

  // 5. Act thin: one small write through src/db.
  const book = await bookRepo.create({ title: result.data.title, userId });

  // 6. Answer clearly.
  return Response.json({ book }, { status: 201 });
}
