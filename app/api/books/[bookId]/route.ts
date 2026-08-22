import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { bookRepo } from "@/src/db/repositories/book";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";
import { diagramRepo } from "@/src/db/repositories/diagram";
import { storage } from "@/src/services/storage";

export async function DELETE(req: Request, { params }: { params: Promise<{ bookId: string }> }) {
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

  const [imageKeys, diagramKeys] = await Promise.all([
    sourceImageRepo.listStorageKeysForBook(book.id),
    diagramRepo.listStorageKeysForBook(book.id),
  ]);

  // uploads-and-storage.md rule 11: deletion parity — R2 objects are removed
  // alongside the rows. The Prisma cascade (database-schema.md law 8) handles
  // every row once `bookRepo.delete` runs below; storage needs this explicit pass.
  const storageKeys = [...imageKeys, ...diagramKeys];
  const results = await Promise.allSettled(storageKeys.map((key) => storage.delete(key)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("Failed to delete storage object for book", { bookId: book.id, key: storageKeys[index], error: result.reason });
    }
  });

  await bookRepo.delete(book.id);

  return Response.json({ message: "Book deleted" });
}
