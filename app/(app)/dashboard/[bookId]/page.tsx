import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { bookRepo } from "@/src/db/repositories/book";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";
import { userRepo } from "@/src/db/repositories/user";
import { getPlanLimits } from "@/src/domain/planLimits";
import { BookDetailView } from "@/src/components/dashboard/BookDetailView";

export default async function BookDetailPage({ params }: { params: Promise<{ bookId: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id: string })?.id;

  const { bookId } = await params;
  const [book, user] = await Promise.all([bookRepo.findForUser(bookId, userId), userId ? userRepo.findById(userId) : null]);
  if (!book) notFound();

  const images = await sourceImageRepo.listForBook(book.id);
  const limits = getPlanLimits(user?.plan ?? "FREE");

  return (
    <BookDetailView
      book={{ id: book.id, title: book.title, status: book.status }}
      images={images.map((image) => ({
        id: image.id,
        format: image.format,
        status: image.status,
        createdAt: image.createdAt,
      }))}
      imagesPerBook={limits.imagesPerBook}
    />
  );
}
