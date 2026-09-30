import type { Job, Section } from "@prisma/client";
import PDFDocument from "pdfkit";
import { jobRepo } from "@/src/db/repositories/job";
import { bookRepo } from "@/src/db/repositories/book";
import { sectionRepo } from "@/src/db/repositories/section";
import { storage } from "@/src/services/storage";
import { sanitizeError } from "./shared";

type SummarySection = { heading: string; body: string };

// A transcribed page carries the handwriting's own short physical line
// breaks as literal newlines (same reason BookDetailView's reader uses
// `white-space: normal` instead of `pre-wrap` — see its own comment).
// Unlike CSS, PDFKit's text() takes a newline as a forced line break, so
// without this every short handwritten line became its own PDF line,
// producing a narrow vertical column instead of paragraphs that flow across
// the full page width.
function flattenLineBreaks(text: string): string {
  return text.replace(/\s*\n+\s*/g, " ").trim();
}

// Mirrors BookDetailView's parseSummarySections (same defensive JSON parse
// of Section.summary) — duplicated rather than shared, since one lives in a
// client component and the other in a worker job with no natural common
// module between them for something this small.
function parseSummarySections(raw: string | null): SummarySection[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SummarySection => typeof item?.heading === "string" && typeof item?.body === "string");
  } catch {
    return [];
  }
}

// Matches the app's own design tokens (design-tokens.css) so the exported
// PDF reads as the same product, not a generic document — same primary
// green, plus a warm paper tone instead of stark white so it reads like a
// note someone would actually want to sit and read, not a business report.
const COLORS = {
  primary: "#00A705",
  textDark: "#232323",
  textMuted: "#6B6B63",
  divider: "#E4E0D2",
  paper: "#FBF9F2",
};

const PAGE_MARGIN = 68;
// Below this much remaining space on the page, a heading is pushed onto a
// fresh page rather than started here — otherwise a heading can land as the
// last line on a page with its body stranded on the next one.
const MIN_SPACE_FOR_HEADING = 130;

function paperBackground(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.paper);
  doc.restore();
}

function ensureRoomFor(doc: PDFKit.PDFDocument, minSpace: number) {
  const remaining = doc.page.height - doc.page.margins.bottom - doc.y;
  if (remaining < minSpace) doc.addPage();
}

function drawDivider(doc: PDFKit.PDFDocument, width?: number) {
  const w = width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.moveTo(doc.x, doc.y).lineTo(doc.x + w, doc.y).lineWidth(0.75).strokeColor(COLORS.divider).stroke();
}

// A short, centered accent rule — used under the cover title and under
// each section heading, tying the two together as the same visual motif.
function drawAccentRule(doc: PDFKit.PDFDocument, centerX: number, width = 46) {
  doc.moveTo(centerX - width / 2, doc.y).lineTo(centerX + width / 2, doc.y).lineWidth(1.5).strokeColor(COLORS.primary).stroke();
}

// Adds "BookTitle · Page X of Y" to every content page (not the cover) —
// done in one pass after all content exists, since only bufferPages lets a
// page's total count be known before the document is finalized.
function drawPageFooters(doc: PDFKit.PDFDocument, bookTitle: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    if (i === 0) continue; // cover page — no footer
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    // Temporarily zero the bottom margin so drawing inside it doesn't trip
    // pdfkit's own auto-page-break check.
    doc.page.margins.bottom = 0;
    doc
      .font("Times-Italic")
      .fontSize(8.5)
      .fillColor(COLORS.textMuted)
      .text(`${bookTitle}  ·  ${i + 1} / ${range.count}`, doc.page.margins.left, doc.page.height - bottomMargin + 18, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
      });
    doc.page.margins.bottom = bottomMargin;
  }
}

// Renders the book as one continuously flowing document, like a real book
// rather than a slide per section — sections run on into one another with
// generous spacing and a rule between them, only breaking onto a fresh page
// when content actually needs it (or, for the appendix, because it's
// genuinely a separate closing part). Ends with a clearly separate, clearly
// labeled "AI Study Summaries" appendix when any section has one (R10/R11:
// a summary is never blended into the literal transcript it summarizes).
function renderBookPdf(bookTitle: string, sections: Pick<Section, "originalText" | "summary">[]): Promise<Buffer> {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Every page gets the same warm paper tint — the first page is created
  // implicitly by `new PDFDocument()` so it needs one manual call; every
  // page after that (including ones pdfkit adds automatically mid-flow)
  // fires "pageAdded", including the ones it adds automatically when text
  // overflows a page.
  paperBackground(doc);
  doc.on("pageAdded", () => paperBackground(doc));

  // Cover
  const centerX = doc.page.width / 2;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.textMuted).text("LEGIBLE", { align: "center", characterSpacing: 2 });
  doc.moveDown(8);
  doc.font("Times-Bold").fontSize(32).fillColor(COLORS.textDark).text(bookTitle, { align: "center" });
  doc.moveDown(0.6);
  drawAccentRule(doc, centerX, 60);
  doc.moveDown(0.7);
  const sectionWord = sections.length === 1 ? "section" : "sections";
  const generatedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc
    .font("Times-Italic")
    .fontSize(11)
    .fillColor(COLORS.textMuted)
    .text(`${sections.length} ${sectionWord} · ${generatedOn}`, { align: "center" });

  // Sections flow on one after another; the very first one gets its own
  // page (a title page followed immediately by dense text looks cramped),
  // later ones just continue unless they'd be orphaned by a page break.
  doc.addPage();
  sections.forEach((section, index) => {
    if (index > 0) {
      doc.moveDown(1.5);
      ensureRoomFor(doc, MIN_SPACE_FOR_HEADING);
      drawDivider(doc, 120);
      doc.moveDown(1.1);
    }
    ensureRoomFor(doc, MIN_SPACE_FOR_HEADING);
    doc.font("Times-Bold").fontSize(19).fillColor(COLORS.textDark).text(`Section ${index + 1}`);
    doc.moveDown(0.6);
    doc.font("Times-Roman").fontSize(11.5).fillColor(COLORS.textDark).text(flattenLineBreaks(section.originalText), { align: "justify", lineGap: 5 });
  });

  const summarized = sections
    .map((section, index) => ({ index, parts: parseSummarySections(section.summary) }))
    .filter((entry) => entry.parts.length > 0);

  if (summarized.length > 0) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.primary).text("APPENDIX", { characterSpacing: 1 });
    doc.moveDown(0.2);
    doc.font("Times-Bold").fontSize(21).fillColor(COLORS.textDark).text("AI Study Summaries");
    doc.moveDown(0.3);
    doc
      .font("Times-Italic")
      .fontSize(9.5)
      .fillColor(COLORS.textMuted)
      .text("AI-generated summaries of the notes above — not part of the original transcript.");
    doc.moveDown(0.85);
    drawDivider(doc);
    doc.moveDown(0.9);

    summarized.forEach((entry, entryIndex) => {
      if (entryIndex > 0) {
        doc.moveDown(0.9);
        ensureRoomFor(doc, MIN_SPACE_FOR_HEADING);
        drawDivider(doc, 120);
        doc.moveDown(1);
      }
      ensureRoomFor(doc, MIN_SPACE_FOR_HEADING);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.primary).text(`SECTION ${entry.index + 1}`, { characterSpacing: 0.5 });
      doc.moveDown(0.3);
      entry.parts.forEach((part, partIndex) => {
        if (partIndex > 0) doc.moveDown(0.6);
        doc.font("Times-Bold").fontSize(13).fillColor(COLORS.textDark).text(part.heading);
        doc.moveDown(0.2);
        doc.font("Times-Roman").fontSize(10.5).fillColor(COLORS.textMuted).text(flattenLineBreaks(part.body), { align: "justify", lineGap: 3 });
      });
    });
  }

  drawPageFooters(doc, bookTitle);
  doc.end();
  return done;
}

// Book-level, not per-image (job.sourceImageId is null) — independent of the
// TRANSCRIBE/STRUCTURE pipeline beyond requiring the book to already be
// READY (enforced by the route before this is ever enqueued, not re-checked
// here since a job already queued was valid when accepted).
export async function runExportJob(job: Job): Promise<void> {
  await jobRepo.markRunning(job.id);

  const context = { jobId: job.id, bookId: job.bookId };

  const book = await bookRepo.findForUser(job.bookId, job.userId);
  if (!book) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId}: book not found`);
    return;
  }

  const sections = await sectionRepo.listForBook(job.bookId);
  if (sections.length === 0) {
    await jobRepo.markFailed(job.id, `job=${job.id} book=${job.bookId}: no transcribed sections to export`);
    return;
  }

  try {
    const pdfBytes = await renderBookPdf(book.title, sections);
    await storage.putBookExport(job.userId, job.bookId, pdfBytes);
    await jobRepo.markSucceeded(job.id);
  } catch (error) {
    await jobRepo.markFailed(job.id, sanitizeError(error, context));
  }
}
