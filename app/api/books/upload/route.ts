import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { userRepo } from "@/src/db/repositories/user";
import { bookRepo } from "@/src/db/repositories/book";
import { sourceImageRepo } from "@/src/db/repositories/sourceImage";
import { getPlanLimits, checkBookCreationAllowance, checkImageUploadAllowance } from "@/src/domain/planLimits";
import { storage } from "@/src/services/storage";
import { queue } from "@/src/services/queue";
import { config } from "@/src/config";
import { checkRateLimit, rateLimitedResponse } from "@/src/services/rateLimit";

// R1: accepted formats.
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);

function toFileList(formData: FormData): File[] {
  return formData.getAll("images").filter((item): item is File => item instanceof File);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // security.md rule 3: upload endpoints are rate-limited per user.
  const rateLimit = await checkRateLimit(`upload:user:${userId}`, config.rateLimits.uploadPerUser);
  if (!rateLimit.allowed) {
    return rateLimitedResponse("Too many upload requests. Please wait a while and try again.");
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ message: "Invalid form data" }, { status: 400 });
  }

  const files = toFileList(formData).filter((file) => ACCEPTED_TYPES.has(file.type));
  if (files.length === 0) {
    return Response.json({ message: "Select at least one JPEG, PNG, HEIC, or HEIF image" }, { status: 400 });
  }

  // R3: technical per-batch ceiling, never a user allowance.
  if (files.length > config.caps.batchImageLimit) {
    return Response.json({ message: `A single batch is limited to ${config.caps.batchImageLimit} images.` }, { status: 400 });
  }

  const titleValue = formData.get("title");
  const title = typeof titleValue === "string" && titleValue.trim().length > 0 ? titleValue.trim() : "Untitled book";

  const bookIdValue = formData.get("bookId");
  const bookId = typeof bookIdValue === "string" && bookIdValue.trim().length > 0 ? bookIdValue.trim() : null;

  const user = await userRepo.findById(userId);
  const plan = user?.plan ?? "FREE";
  const limits = getPlanLimits(plan);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const imagesThisMonth = await sourceImageRepo.countCreatedSinceForUser(userId, startOfMonth);
  const booksThisMonth = await bookRepo.countCreatedSince(userId, startOfMonth);

  let book;
  let currentBookImages = 0;
  const createdBook = bookId === null;

  if (bookId) {
    book = await bookRepo.findForUser(bookId, userId);
    if (!book) {
      return Response.json({ message: "Book not found" }, { status: 404 });
    }
    currentBookImages = await sourceImageRepo.countForBook(book.id);
  } else {
    const allowance = checkBookCreationAllowance(limits, booksThisMonth);
    if (!allowance.allowed) {
      return Response.json({ error: "PLAN_LIMIT", message: allowance.message }, { status: 403 });
    }
    book = await bookRepo.create({ title, userId });
  }

  // R3 + R31: cap enforcement happens before any bytes are stored.
  const imageAllowance = checkImageUploadAllowance(limits, imagesThisMonth, files.length, currentBookImages);
  if (!imageAllowance.allowed) {
    if (createdBook) await bookRepo.delete(book.id);
    return Response.json({ error: "PLAN_LIMIT", message: imageAllowance.message }, { status: 403 });
  }

  const storedKeys: string[] = [];
  let createdImageIds: string[] = [];

  try {
    for (const file of files) {
      const storageKey = await storage.putBookImage({
        bookId: book.id,
        fileName: file.name,
        contentType: file.type,
        body: new Uint8Array(await file.arrayBuffer()),
      });
      storedKeys.push(storageKey);
    }

    // R7: store every original and link it to the account and book.
    const images = await sourceImageRepo.createMany(
      book.id,
      files.map((file, index) => ({
        storageKey: storedKeys[index],
        format: file.type.replace("image/", ""),
        imageOrder: index,
      })),
    );
    createdImageIds = images.map((image) => image.id);

    // R8: one TRANSCRIBE job per accepted image.
    await queue.enqueueTranscribeJobs({ userId, bookId: book.id, sourceImageIds: createdImageIds });
  } catch (error) {
    console.error("Upload failed:", error);
    await Promise.allSettled(createdImageIds.map((id) => sourceImageRepo.deleteManyByIds([id])));
    await Promise.allSettled(storedKeys.map((key) => storage.delete(key)));
    if (createdBook) await bookRepo.delete(book.id).catch(() => {});
    return Response.json({ error: "UPLOAD_FAILED", message: "Upload failed. Please try again." }, { status: 500 });
  }

  return Response.json(
    {
      book: {
        id: book.id,
        title: book.title,
      },
      uploadedCount: files.length,
      message: "Upload complete. Images stored and transcription jobs queued.",
    },
    { status: 201 },
  );
}
