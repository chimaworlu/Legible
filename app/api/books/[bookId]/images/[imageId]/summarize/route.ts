import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { bookRepo } from "@/src/db/repositories/book";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";
import { sectionRepo } from "@/src/db/repositories/section";
import { jobRepo } from "@/src/db/repositories/job";
import { queue } from "@/src/services/queue";
import { checkRateLimit, rateLimitedResponse } from "@/src/services/rateLimit";
import { config } from "@/src/config";

// Thin route handler (AGENTS.md section 4): enqueues a SUMMARIZE job and
// returns. The actual AI call happens only in the worker (ai-pipeline.md
// law 12) — never here.
export async function POST(req: Request, { params }: { params: Promise<{ bookId: string; imageId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const rateLimit = await checkRateLimit(`summarize:user:${userId}`, config.rateLimits.summarizePerUser);
  if (!rateLimit.allowed) {
    return rateLimitedResponse("Too many summarize requests. Please wait a while and try again.");
  }

  const { bookId, imageId } = await params;
  const book = await bookRepo.findForUser(bookId, userId);
  if (!book) {
    return Response.json({ message: "Book not found" }, { status: 404 });
  }

  const image = await sourceImageRepo.findForBook(imageId, book.id);
  if (!image) {
    return Response.json({ message: "Image not found" }, { status: 404 });
  }

  const section = await sectionRepo.findForSourceImage(image.id);
  if (!section) {
    return Response.json({ message: "This note hasn't been transcribed yet." }, { status: 400 });
  }

  const existing = await jobRepo.findLatestForSourceImage(image.id, "SUMMARIZE");
  if (existing && (existing.status === "QUEUED" || existing.status === "RUNNING")) {
    return Response.json({ message: "A summary is already being generated for this note." }, { status: 409 });
  }

  await queue.enqueueSummarizeJob({ userId, bookId: book.id, sourceImageId: image.id });

  return Response.json({ status: "QUEUED" });
}

// Thin, read-only route — polled by the reader while a summary is generating.
export async function GET(_req: Request, { params }: { params: Promise<{ bookId: string; imageId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { bookId, imageId } = await params;
  const book = await bookRepo.findForUser(bookId, userId);
  if (!book) {
    return Response.json({ message: "Book not found" }, { status: 404 });
  }

  const image = await sourceImageRepo.findForBook(imageId, book.id);
  if (!image) {
    return Response.json({ message: "Image not found" }, { status: 404 });
  }

  const [section, job] = await Promise.all([
    sectionRepo.findForSourceImage(image.id),
    jobRepo.findLatestForSourceImage(image.id, "SUMMARIZE"),
  ]);

  return Response.json({
    status: job?.status ?? null,
    error: job?.status === "FAILED" ? "Could not generate a summary. Please try again." : null,
    summary: section?.summary ?? null,
  });
}
