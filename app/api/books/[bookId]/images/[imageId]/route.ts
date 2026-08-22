import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { bookRepo } from "@/src/db/repositories/book";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";
import { diagramRepo } from "@/src/db/repositories/diagram";
import { storage } from "@/src/services/storage";

export async function DELETE(req: Request, { params }: { params: Promise<{ bookId: string; imageId: string }> }) {
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

  // uploads-and-storage.md rule 11: deletion parity — R2 objects removed
  // alongside the rows. The Prisma cascade handles Section/Diagram rows once
  // deleteManyByIds runs below; storage needs this explicit pass.
  const diagramKeys = await diagramRepo.listStorageKeysForImage(image.id);
  const storageKeys = [image.storageKey, ...diagramKeys];
  const results = await Promise.allSettled(storageKeys.map((key) => storage.delete(key)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("Failed to delete storage object for image", { bookId: book.id, imageId: image.id, key: storageKeys[index], error: result.reason });
    }
  });

  await sourceImageRepo.deleteManyByIds([image.id]);

  return Response.json({ message: "Image deleted" });
}
