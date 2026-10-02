import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { bookRepo } from "@/src/db/repositories/book";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";

// Thin, read-only route (AGENTS.md section 4) — polled by the book detail
// page while a book is PROCESSING. Never does heavy work, never touches AI.
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

  const images = await sourceImageRepo.listForBook(book.id);

  return Response.json({
    status: book.status,
    images: images.map((image) => ({ id: image.id, status: image.status })),
  });
}
