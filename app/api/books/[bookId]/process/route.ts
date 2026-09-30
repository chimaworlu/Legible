import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { bookRepo } from "@/src/db/repositories/book";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";
import { userRepo } from "@/src/db/repositories/user";
import { queue } from "@/src/services/queue";
import { getPlanLimits } from "@/src/domain/planLimits";
import { checkPlanAllowance } from "@/src/domain/processingGates";
import { checkRateLimit, rateLimitedResponse } from "@/src/services/rateLimit";
import { config } from "@/src/config";

// Thin route handler (AGENTS.md section 4): enqueues TRANSCRIBE jobs and
// returns. Never touches the AI, never fetches image bytes — that's the
// worker's job, not this request path.
export async function POST(req: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  // security.md rule 3: throttle this action per user.
  const rateLimit = await checkRateLimit(`process:user:${userId}`, config.rateLimits.processPerUser);
  if (!rateLimit.allowed) {
    return rateLimitedResponse("Too many processing requests. Please wait a while and try again.");
  }

  const { bookId } = await params;
  const book = await bookRepo.findForUser(bookId, userId);
  if (!book) {
    return Response.json({ message: "Book not found" }, { status: 404 });
  }

  if (book.status !== "DRAFT") {
    return Response.json({ message: `This book is already ${book.status.toLowerCase()}.` }, { status: 409 });
  }

  const images = await sourceImageRepo.listForBook(book.id);
  if (images.length === 0) {
    return Response.json({ message: "Upload at least one image before processing." }, { status: 400 });
  }

  // R3/R31 — checked once, up front (fetching image bytes per-image happens
  // only in the worker, never in this request path).
  const user = await userRepo.findById(userId);
  const limits = getPlanLimits(user?.plan ?? "FREE");
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const imagesThisMonth = await sourceImageRepo.countTranscribedSinceForUser(userId, startOfMonth);
  const allowance = checkPlanAllowance(imagesThisMonth, limits);
  if (!allowance.allowed) {
    return Response.json({ error: "PLAN_LIMIT", message: allowance.reason }, { status: 403 });
  }

  await bookRepo.updateStatus(book.id, "PROCESSING");
  await queue.enqueueTranscribeJobs({ userId, bookId: book.id, sourceImageIds: images.map((image) => image.id) });

  return Response.json({ status: "PROCESSING" });
}
