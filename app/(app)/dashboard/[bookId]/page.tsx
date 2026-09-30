import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { bookRepo } from "@/src/db/repositories/book";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";
import { sectionRepo } from "@/src/db/repositories/section";
import { jobRepo } from "@/src/db/repositories/job";
import { storage } from "@/src/services/storage";
import { config } from "@/src/config";
import { BookDetailView } from "@/src/components/dashboard/BookDetailView";

export default async function BookDetailPage({ params }: { params: Promise<{ bookId: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id: string })?.id;

  const { bookId } = await params;
  const book = await bookRepo.findForUser(bookId, userId);
  if (!book) notFound();

  const [images, sections, exportJob] = await Promise.all([
    sourceImageRepo.listForBook(book.id),
    sectionRepo.listForBook(book.id),
    jobRepo.findLatestForBook(book.id, "EXPORT"),
  ]);
  const sectionByImageId = new Map(sections.map((section) => [section.sourceImageId, section]));

  // Signed, short-lived, owner-scoped preview URLs (security.md rule 8) — the
  // bucket stays private; the page never gets a permanent object URL. Signing
  // is a local HMAC operation (no network round trip), so doing this for
  // every image up front is cheap.
  const imagesWithSections = await Promise.all(
    images.map(async (image) => {
      const section = sectionByImageId.get(image.id);
      const previewUrl = await storage.getSignedReadUrl(image.storageKey, config.storage.r2.imagePreviewUrlTtlSeconds);

      return {
        id: image.id,
        format: image.format,
        status: image.status,
        createdAt: image.createdAt,
        previewUrl,
        section: section
          ? {
              originalText: section.originalText,
              confidence: section.confidence,
              flags: section.flags.map((flag) => ({ startOffset: flag.startOffset, endOffset: flag.endOffset, type: flag.type })),
              summary: section.summary,
            }
          : null,
      };
    }),
  );

  return (
    <BookDetailView
      book={{ id: book.id, title: book.title, status: book.status, exportStatus: exportJob?.status ?? null }}
      images={imagesWithSections}
    />
  );
}
