import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { bookRepo } from "@/src/db/repositories/book";
import { jobRepo } from "@/src/db/repositories/job";
import { queue } from "@/src/services/queue";
import { storage } from "@/src/services/storage";
import { checkRateLimit, rateLimitedResponse } from "@/src/services/rateLimit";
import { config } from "@/src/config";

// Thin route handler (AGENTS.md section 4): enqueues an EXPORT job and
// returns. PDF generation happens only in the worker (ai-pipeline.md law 12
// applies here too, even though EXPORT never calls an AI provider — heavy
// work stays out of the request path regardless).
export async function POST(req: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const rateLimit = await checkRateLimit(`export:user:${userId}`, config.rateLimits.exportPerUser);
  if (!rateLimit.allowed) {
    return rateLimitedResponse("Too many export requests. Please wait a while and try again.");
  }

  const { bookId } = await params;
  const book = await bookRepo.findForUser(bookId, userId);
  if (!book) {
    return Response.json({ message: "Book not found" }, { status: 404 });
  }

  if (book.status !== "READY") {
    return Response.json({ message: "This book isn't ready to export yet." }, { status: 409 });
  }

  const existing = await jobRepo.findLatestForBook(book.id, "EXPORT");
  if (existing && (existing.status === "QUEUED" || existing.status === "RUNNING")) {
    return Response.json({ message: "An export is already being generated for this book." }, { status: 409 });
  }

  await queue.enqueueExportJob({ userId, bookId: book.id });

  return Response.json({ status: "QUEUED" });
}

// Thin, read-only route — polled by the UI while a PDF is generating.
export async function GET(_req: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { bookId } = await params;
  const book = await bookRepo.findForUser(bookId, userId);
  if (!book) {
    return Response.json({ message: "Book not found" }, { status: 404 });
  }

  const job = await jobRepo.findLatestForBook(book.id, "EXPORT");
  const downloadUrl = job?.status === "SUCCEEDED" ? await storage.getBookExportSignedUrl(userId, book.id) : null;

  return Response.json({
    status: job?.status ?? null,
    error: job?.status === "FAILED" ? "Could not generate the export. Please try again." : null,
    downloadUrl,
  });
}
