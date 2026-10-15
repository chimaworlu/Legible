import PDFDocument from "npm:pdfkit@0.15.2";

// Raw port of worker/jobs/export.ts's renderBookPdf and its helpers — same
// layout logic verbatim, only the Buffer-based collection swapped for
// Uint8Array (Deno has no global Buffer).

type SummarySection = { heading: string; body: string };

function flattenLineBreaks(text: string): string {
  return text.replace(/\s*\n+\s*/g, " ").trim();
}

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

const COLORS = {
  primary: "#00A705",
  textDark: "#232323",
  textMuted: "#6B6B63",
  divider: "#E4E0D2",
  paper: "#FBF9F2",
};

const PAGE_MARGIN = 68;
const MIN_SPACE_FOR_HEADING = 130;

// deno-lint-ignore no-explicit-any
function paperBackground(doc: any) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.paper);
  doc.restore();
}

// deno-lint-ignore no-explicit-any
function ensureRoomFor(doc: any, minSpace: number) {
  const remaining = doc.page.height - doc.page.margins.bottom - doc.y;
  if (remaining < minSpace) doc.addPage();
}

// deno-lint-ignore no-explicit-any
function drawDivider(doc: any, width?: number) {
  const w = width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.moveTo(doc.x, doc.y).lineTo(doc.x + w, doc.y).lineWidth(0.75).strokeColor(COLORS.divider).stroke();
}

// deno-lint-ignore no-explicit-any
function drawAccentRule(doc: any, centerX: number, width = 46) {
  doc.moveTo(centerX - width / 2, doc.y).lineTo(centerX + width / 2, doc.y).lineWidth(1.5).strokeColor(COLORS.primary).stroke();
}

// deno-lint-ignore no-explicit-any
function drawPageFooters(doc: any, bookTitle: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    if (i === 0) continue;
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
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

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function renderBookPdf(bookTitle: string, sections: { originalText: string; summary: string | null }[]): Promise<Uint8Array> {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, bufferPages: true });
  const chunks: Uint8Array[] = [];
  doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("end", () => resolve(concatChunks(chunks)));
    doc.on("error", reject);
  });
  paperBackground(doc);
  doc.on("pageAdded", () => paperBackground(doc));

  const centerX = doc.page.width / 2;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.textMuted).text("LEGIBLE", { align: "center", characterSpacing: 2 });
  doc.moveDown(8);
  doc.font("Times-Bold").fontSize(32).fillColor(COLORS.textDark).text(bookTitle, { align: "center" });
  doc.moveDown(0.6);
  drawAccentRule(doc, centerX, 60);
  doc.moveDown(0.7);
  const sectionWord = sections.length === 1 ? "section" : "sections";
  const generatedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.font("Times-Italic").fontSize(11).fillColor(COLORS.textMuted).text(`${sections.length} ${sectionWord} · ${generatedOn}`, { align: "center" });

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
    doc.font("Times-Italic").fontSize(9.5).fillColor(COLORS.textMuted).text("AI-generated summaries of the notes above — not part of the original transcript.");
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
