"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./BookDetailView.module.css";

type SectionFlag = { startOffset: number; endOffset: number; type: "LOW" | "GAP" };
type ImageSection = { originalText: string; confidence: "HIGH" | "LOW" | "GAP"; flags: SectionFlag[]; summary: string | null };

type BookDetailViewProps = {
  book: { id: string; title: string; status: string; exportStatus: string | null };
  images: Array<{ id: string; format: string; status: string; createdAt: Date; previewUrl: string; section: ImageSection | null }>;
};

// While the batch is processing, poll for the book to reach a terminal
// status (READY) — the smallest polling convention available here, reusing
// router.refresh() rather than introducing a new client-side data layer.
const PROCESSING_POLL_MS = 4000;

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  color: "var(--color-roles-primary)",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
  textDecoration: "none",
  marginBottom: "var(--spacing-collection-base-spacing)",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
  marginBottom: "var(--spacing-collection-base-spacing)",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-headline-medium-font-family)",
  fontSize: "var(--typography-headline-medium-font-size)",
  fontWeight: "var(--typography-headline-medium-font-weight)",
};

const buttonGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: "0.375rem",
    backgroundColor: "var(--color-roles-primary)",
    color: "var(--color-roles-on-primary)",
    padding: "0.625rem 1.125rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.9375rem",
    fontWeight: "var(--typography-label-large-font-weight)",
  };
}

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "var(--spacing-collection-very-large-spacing)",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  color: "var(--color-roles-on-surface-variant)",
};

const uploadedImagesNoticeStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
  marginBottom: "var(--spacing-collection-base-spacing)",
};

const uploadedImagesGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))",
  gap: "var(--spacing-collection-base-spacing)",
};

const uploadedImageCardStyle: React.CSSProperties = {
  borderRadius: "0.625rem",
  overflow: "hidden",
  border: "1px solid var(--color-roles-surface-container-highest)",
  backgroundColor: "var(--color-roles-surface-container-low)",
};

const uploadedImageThumbStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  aspectRatio: "3 / 4",
  objectFit: "cover",
  backgroundColor: "var(--color-roles-surface-container-highest)",
};

function uploadedImageStatusStyle(isError: boolean): React.CSSProperties {
  return {
    padding: "0.5rem 0.625rem",
    fontFamily: "var(--typography-label-medium-font-family)",
    fontSize: "var(--typography-label-medium-font-size)",
    color: isError ? "var(--color-roles-error)" : "var(--color-roles-on-surface-variant)",
  };
}

// Per-image status label (design-system-rule.md law 12 — a failed image must
// be individually identifiable, not hidden behind one batch-level message).
function uploadedImageStatusLabel(status: string): string {
  switch (status) {
    case "QUALITY_FAILED":
      return "Quality issue";
    case "FAILED":
      return "Failed";
    case "TRANSCRIBED":
      return "Transcribed";
    default:
      return "Waiting to process";
  }
}

// Shown for any image that hasn't produced a Section yet — freshly
// uploaded, still queued/processing, or one that failed on its own without
// taking the whole batch down with it. The photo itself is the point: a
// student should be able to see what they uploaded before (or instead of)
// reading a status message (R6).
function UploadedImagesGrid({ images }: { images: Array<{ id: string; status: string; previewUrl: string }> }) {
  return (
    <div style={uploadedImagesGridStyle}>
      {images.map((image) => (
        <div key={image.id} style={uploadedImageCardStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed R2 URL, not a static/local asset next/image can optimize */}
          <img src={image.previewUrl} alt="" style={uploadedImageThumbStyle} loading="lazy" />
          <div style={uploadedImageStatusStyle(image.status === "FAILED" || image.status === "QUALITY_FAILED")}>
            {uploadedImageStatusLabel(image.status)}
          </div>
        </div>
      ))}
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--spacing-collection-base-spacing)",
  zIndex: 200,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "22rem",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  borderRadius: "0.75rem",
  boxShadow: "var(--effect-medium-shadow)",
  padding: "var(--spacing-collection-large-spacing)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-base-spacing)",
};

const modalButtonRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
};

const modalCancelButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--color-roles-on-surface-variant)",
  padding: "0.625rem 0.875rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
};

function modalDeleteButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: "0.375rem",
    backgroundColor: "var(--color-roles-error)",
    color: "var(--color-roles-on-error)",
    padding: "0.625rem 1rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "var(--typography-label-large-font-family)",
  };
}

const readerSidebarLabelStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "0.6875rem",
  fontWeight: "var(--typography-label-medium-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "0.25rem",
};

function readerChapterButtonStyle(active: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    border: "none",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    cursor: "pointer",
    backgroundColor: active ? "var(--color-roles-primary)" : "transparent",
    color: active ? "var(--color-roles-on-primary)" : "var(--color-roles-on-surface)",
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.875rem",
    fontWeight: active ? 600 : "var(--typography-label-large-font-weight)",
  };
}

const readerContentTitleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-medium-font-family)",
  fontSize: "var(--typography-title-medium-font-size)",
  fontWeight: "var(--typography-title-medium-font-weight)",
  marginBottom: "0.75rem",
};

const sectionTextBoxStyle: React.CSSProperties = {
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.625rem",
  padding: "1rem",
};

const readerBodyTextStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "0.9375rem",
  lineHeight: 1.6,
  color: "var(--color-roles-on-surface)",
  // "normal" (not pre-wrap): a handwritten page transcribes with its own
  // short physical line breaks, which pre-wrap would render literally as a
  // tall column of short lines. Collapsing those into flowing paragraphs is
  // display-only — it never touches originalText or the flag offsets
  // sliced from it, both of which still operate on the untouched string.
  whiteSpace: "normal",
};

const readerEmptyStateStyle: React.CSSProperties = {
  color: "var(--color-roles-on-surface-variant)",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "0.875rem",
};

const readyBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  color: "var(--color-roles-primary)",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
};

const deleteBookButtonStyle: React.CSSProperties = {
  border: "1px solid var(--color-roles-error)",
  borderRadius: "0.375rem",
  background: "none",
  color: "var(--color-roles-error)",
  padding: "0.5625rem 1rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
};

const processErrorStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  color: "var(--color-roles-error)",
  marginBottom: "var(--spacing-collection-base-spacing)",
};

function exportButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid var(--color-roles-primary)",
    borderRadius: "0.375rem",
    background: "none",
    color: "var(--color-roles-primary)",
    padding: "0.5625rem 1rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.9375rem",
    fontWeight: "var(--typography-label-large-font-weight)",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    textDecoration: "none",
  };
}

const exportErrorStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  color: "var(--color-roles-error)",
  marginBottom: "var(--spacing-collection-base-spacing)",
};

const kebabButtonStyle: React.CSSProperties = {
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.375rem",
  background: "none",
  color: "var(--color-roles-on-surface)",
  padding: "0.5rem 0.625rem",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const kebabMenuStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 0.375rem)",
  right: 0,
  minWidth: "11rem",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.5rem",
  boxShadow: "var(--effect-medium-shadow)",
  overflow: "hidden",
  zIndex: 30,
};

function kebabMenuItemStyle(options: { danger?: boolean; disabled?: boolean } = {}): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    width: "100%",
    padding: "0.625rem 0.875rem",
    border: "none",
    background: "none",
    textAlign: "left",
    cursor: options.disabled ? "not-allowed" : "pointer",
    opacity: options.disabled ? 0.6 : 1,
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.875rem",
    color: options.danger ? "var(--color-roles-error)" : "var(--color-roles-on-surface)",
    textDecoration: "none",
  };
}

// Kebab ("⋮") menu — collapses actions that don't fit comfortably side by
// side on a narrow screen (see .headerButtonsCompact's own comment) into a
// single tap target. Closes on an outside click, Escape, or picking any
// item (the click bubbles up to the menu container itself, so this doesn't
// need to know what each item does).
function HeaderActionsMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        style={kebabButtonStyle}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
      >
        <MoreIcon />
      </button>
      {open && (
        <div role="menu" style={kebabMenuStyle} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function summarizeButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: "999px",
    backgroundColor: "var(--color-roles-primary)",
    color: "var(--color-roles-on-primary)",
    padding: "0.625rem 1.125rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "var(--typography-label-large-font-family)",
    fontSize: "0.8125rem",
    fontWeight: "var(--typography-label-large-font-weight)",
    boxShadow: "var(--effect-medium-shadow)",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
  };
}

const summarizeErrorStyle: React.CSSProperties = {
  marginTop: "0.75rem",
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  color: "var(--color-roles-error)",
};

const summaryPanelStyle: React.CSSProperties = {
  marginTop: "1.25rem",
  borderRadius: "0.625rem",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  overflow: "hidden",
};

const summaryPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  padding: "0.75rem 1rem",
  cursor: "pointer",
  border: "none",
  background: "none",
  width: "100%",
  textAlign: "left",
};

const summaryPanelTitleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--color-roles-primary)",
};

const summaryPanelBodyStyle: React.CSSProperties = {
  padding: "0 1rem 1.125rem",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const summarySectionHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: 700,
  color: "var(--color-roles-on-surface)",
  marginBottom: "0.375rem",
};

const summarySectionBodyStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "0.875rem",
  lineHeight: 1.6,
  color: "var(--color-roles-on-surface-variant)",
  whiteSpace: "normal",
};

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" opacity="0.7" />
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: up ? "rotate(180deg)" : undefined }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type SummarySection = { heading: string; body: string };
// Shared shape for any polled background job (summarize, export, ...) — just
// mirrors Job.status plus null for "nothing started yet". Deliberately
// excludes Prisma's JobStatus.PARTIAL: no job type this hook drives can ever
// reach it (only worker/jobs/transcribe.ts's book-level roll-up produces
// that, which isn't polled through this hook shape).
type JobPollStatus = null | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
const SUMMARIZE_POLL_MS = 3000;
const EXPORT_POLL_MS = 3000;

function toJobPollStatus(value: string | null): JobPollStatus {
  return value === "QUEUED" || value === "RUNNING" || value === "SUCCEEDED" || value === "FAILED" ? value : null;
}

// Parses the JSON the worker stored in Section.summary. A malformed or
// legacy value (e.g. an older plain-string summary) is treated as "nothing
// to show" rather than crashing the reader — one bad summary should never
// break the page.
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

// AI-generated, always shown separately from — never blended into —
// originalText (R10/R11's honesty spirit: a summary is clearly a summary,
// not presented as what the student actually wrote).
//
// A single instance lives in BookReader (not remounted per section, since
// it must be called unconditionally per the rules of hooks) — state is
// reset below whenever `imageId` changes, using React's documented
// "adjusting state during render" pattern (comparing against the previous
// value in the render body) rather than an effect, which would cause an
// extra cascading render.
function useSummarize(bookId: string, imageId: string, initialSummary: string | null) {
  const [prevImageId, setPrevImageId] = useState(imageId);
  const [sections, setSections] = useState<SummarySection[]>(() => parseSummarySections(initialSummary));
  const [status, setStatus] = useState<JobPollStatus>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);

  if (imageId !== prevImageId) {
    setPrevImageId(imageId);
    setSections(parseSummarySections(initialSummary));
    setStatus(null);
    setError("");
    setExpanded(true);
  }

  const pending = status === "QUEUED" || status === "RUNNING";

  useEffect(() => {
    if (!pending || !imageId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/books/${bookId}/images/${imageId}/summarize`);
        if (!res.ok) return;
        const body = (await res.json()) as { status: JobPollStatus; error: string | null; summary: string | null };
        if (body.status === "SUCCEEDED") {
          setSections(parseSummarySections(body.summary));
          setExpanded(true);
          setStatus(null);
        } else if (body.status === "FAILED") {
          setError(body.error ?? "Could not generate a summary. Please try again.");
          setStatus(null);
        }
      } catch {
        // Transient poll failure — the interval just tries again next tick.
      }
    }, SUMMARIZE_POLL_MS);
    return () => clearInterval(interval);
  }, [pending, bookId, imageId]);

  async function handleClick() {
    if (pending || !imageId) return;
    setError("");
    setStatus("QUEUED");
    try {
      const res = await fetch(`/api/books/${bookId}/images/${imageId}/summarize`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Could not start summarizing. Please try again.");
        setStatus(null);
      }
    } catch {
      setError("Could not start summarizing. Please try again.");
      setStatus(null);
    }
  }

  return { sections, pending, error, expanded, toggleExpanded: () => setExpanded((value) => !value), handleClick };
}

function SummaryPanel({ sections, expanded, onToggle }: { sections: SummarySection[]; expanded: boolean; onToggle: () => void }) {
  return (
    <div style={summaryPanelStyle}>
      <button type="button" style={summaryPanelHeaderStyle} onClick={onToggle} aria-expanded={expanded}>
        <span style={summaryPanelTitleStyle}>
          <SparkleIcon />
          AI Study Summary &amp; Rephrased Notes
        </span>
        <ChevronIcon up={expanded} />
      </button>
      {expanded && (
        <div style={summaryPanelBodyStyle}>
          {sections.map((section, index) => (
            <div key={index}>
              <div style={summarySectionHeadingStyle}>{section.heading}</div>
              <div style={summarySectionBodyStyle}>{section.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Book-level (not per-section, unlike useSummarize) — polls the one EXPORT
// job for this book. initialStatus comes from the server (page.tsx reads
// the latest EXPORT job) so a returning user who already exported doesn't
// see the button flash back to "Export Book"; the effect below still does
// one fetch on mount to pick up a fresh signed download URL, since the
// server only passes the status, never a URL that could go stale by the
// time it's clicked.
function useExport(bookId: string, initialStatus: JobPollStatus) {
  const [status, setStatus] = useState<JobPollStatus>(initialStatus);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const pending = status === "QUEUED" || status === "RUNNING";

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/books/${bookId}/export`);
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { status: JobPollStatus; error: string | null; downloadUrl: string | null };
        if (cancelled) return;
        setStatus(body.status);
        setDownloadUrl(body.downloadUrl);
        setError(body.status === "FAILED" ? (body.error ?? "Could not generate the export. Please try again.") : "");
      } catch {
        // Transient poll failure — retried next tick while still pending.
      }
    }

    poll();
    if (!pending) return () => { cancelled = true; };
    const interval = setInterval(poll, EXPORT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bookId, pending]);

  async function handleClick() {
    if (pending) return;
    if (status === "SUCCEEDED" && downloadUrl) {
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setError("");
    setStatus("QUEUED");
    try {
      const res = await fetch(`/api/books/${bookId}/export`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Could not start export. Please try again.");
        setStatus(null);
      }
    } catch {
      setError("Could not start export. Please try again.");
      setStatus(null);
    }
  }

  return { status, pending, downloadUrl, error, handleClick };
}

// Plain reading text — no visual LOW/GAP highlighting. The flags themselves
// still live on TranscriptionFlag rows in the database (R10/R11 requires
// storing them, not necessarily rendering them here); this is purely a
// display choice, not a data change.
function SectionText({ section, containerStyle }: { section: ImageSection; containerStyle: React.CSSProperties }) {
  return <div style={containerStyle}>{section.originalText}</div>;
}

type ReaderImage = { id: string; section: ImageSection | null };

// Reading view for the book's transcribed content — a chapters sidebar plus
// a reading pane. Each image maps to one Section (no chapter-grouping stage
// exists yet, so entries are labeled by order, not a fabricated chapter
// title — R10/R11's "never invent" spirit applies to labels too, not just
// transcribed text).
function BookReader({ bookId, images }: { bookId: string; images: ReaderImage[] }) {
  const sections = images.filter((image): image is ReaderImage & { section: ImageSection } => image.section !== null);
  const [selectedId, setSelectedId] = useState(sections[0]?.id);
  const selected = sections.find((image) => image.id === selectedId) ?? sections[0];

  // Called unconditionally (rules of hooks) with safe fallbacks — the hook
  // itself resets its state whenever the resolved imageId changes, which
  // covers switching sections; an empty imageId simply keeps it inert.
  const summarize = useSummarize(bookId, selected?.id ?? "", selected?.section.summary ?? null);

  if (sections.length === 0) return null;

  return (
    <div className={styles.readerWrapper}>
      <div className={styles.readerSection}>
        <div className={styles.readerSidebar}>
          <div style={readerSidebarLabelStyle}>Chapters</div>
          {sections.map((image, index) => (
            <button key={image.id} type="button" style={readerChapterButtonStyle(image.id === selected?.id)} onClick={() => setSelectedId(image.id)}>
              Section {index + 1}
            </button>
          ))}
        </div>
        <div className={styles.readerContent}>
          {selected ? (
            <div className={styles.readerScrollArea}>
              <h2 style={readerContentTitleStyle}>Section {sections.indexOf(selected) + 1}</h2>
              <div style={sectionTextBoxStyle}>
                <SectionText section={selected.section} containerStyle={readerBodyTextStyle} />
              </div>
              {summarize.error && (
                <div role="alert" style={summarizeErrorStyle}>
                  {summarize.error}
                </div>
              )}
              {summarize.sections.length > 0 && (
                <SummaryPanel sections={summarize.sections} expanded={summarize.expanded} onToggle={summarize.toggleExpanded} />
              )}
            </div>
          ) : (
            <div style={readerEmptyStateStyle}>Nothing transcribed yet.</div>
          )}
        </div>
      </div>
      {selected && (
        <div className={styles.summarizeButtonRow}>
          <button
            type="button"
            className={styles.summarizeButton}
            style={summarizeButtonStyle(summarize.pending)}
            onClick={summarize.handleClick}
            disabled={summarize.pending}
          >
            <SparkleIcon />
            {summarize.pending ? "Summarizing…" : "Summarize Notes"}
          </button>
        </div>
      )}
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 18v1.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.75 12a2 2 0 0 0 2 1.9h5.5a2 2 0 0 0 2-1.9L17.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BookDetailView({ book, images }: BookDetailViewProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState("");
  const [deleteBookOpen, setDeleteBookOpen] = useState(false);
  const [deletingBook, setDeletingBook] = useState(false);
  const [deleteBookError, setDeleteBookError] = useState("");

  const hasImages = images.length > 0;
  const hasSections = images.some((image) => image.section !== null);
  const unprocessedImages = images.filter((image) => image.section === null);
  const exportState = useExport(book.id, toJobPollStatus(book.exportStatus));

  // While the book is PROCESSING, poll for the batch to finish — mirrors
  // the file's existing "act, then router.refresh()" convention, just on a
  // timer instead of a click, since no other polling convention exists yet.
  useEffect(() => {
    if (book.status !== "PROCESSING") return;
    const interval = setInterval(() => router.refresh(), PROCESSING_POLL_MS);
    return () => clearInterval(interval);
  }, [book.status, router]);

  async function startProcessing() {
    if (processing) return;
    setProcessing(true);
    setProcessError("");
    try {
      const res = await fetch(`/api/books/${book.id}/process`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setProcessError(body?.message ?? "Could not start processing. Please try again.");
        return;
      }
      router.refresh();
    } finally {
      setProcessing(false);
    }
  }

  async function confirmDeleteBook() {
    if (deletingBook) return;
    setDeletingBook(true);
    setDeleteBookError("");
    try {
      const res = await fetch(`/api/books/${book.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setDeleteBookError(body?.message ?? "Could not delete book. Please try again.");
        return;
      }
      router.push("/dashboard");
    } finally {
      setDeletingBook(false);
    }
  }

  return (
    <div>
      <Link href="/dashboard" style={backLinkStyle}>
        <BackArrowIcon />
        Back to My Books
      </Link>

      <div style={headerRowStyle}>
        <h1 style={titleStyle}>{book.title}</h1>
        <div style={buttonGroupStyle}>
          {book.status === "READY" ? (
            <span style={readyBadgeStyle}>
              <CheckCircleIcon />
              Book Ready
            </span>
          ) : (
            <button
              type="button"
              style={primaryButtonStyle(processing || images.length === 0 || book.status === "PROCESSING")}
              disabled={processing || images.length === 0 || book.status === "PROCESSING"}
              onClick={startProcessing}
              title={images.length === 0 ? "Upload at least one image first" : undefined}
            >
              {book.status === "PROCESSING" ? "Processing…" : processing ? "Starting…" : "Start Processing"}
            </button>
          )}
          {/* Desktop: Export and Delete as their own buttons — there's room
              side by side. Hidden below 640px in favor of the kebab menu
              below, which collapses both into one tap target instead of
              cramming three controls into a narrow header row. */}
          <div className={styles.headerButtonsFull}>
            {book.status === "READY" && (
              exportState.status === "SUCCEEDED" && exportState.downloadUrl ? (
                <a href={exportState.downloadUrl} style={exportButtonStyle(false)} target="_blank" rel="noopener noreferrer">
                  <DownloadIcon />
                  Download PDF
                </a>
              ) : (
                <button type="button" style={exportButtonStyle(exportState.pending)} disabled={exportState.pending} onClick={exportState.handleClick}>
                  <DownloadIcon />
                  {exportState.pending ? "Exporting…" : exportState.status === "FAILED" ? "Retry Export" : "Export Book"}
                </button>
              )
            )}
            <button type="button" style={deleteBookButtonStyle} onClick={() => setDeleteBookOpen(true)}>
              <TrashIcon />
              Delete Book
            </button>
          </div>

          {/* Mobile: same two actions, collapsed into a kebab menu. */}
          <div className={styles.headerButtonsCompact}>
            <HeaderActionsMenu>
              {book.status === "READY" && (
                exportState.status === "SUCCEEDED" && exportState.downloadUrl ? (
                  <a href={exportState.downloadUrl} style={kebabMenuItemStyle()} target="_blank" rel="noopener noreferrer">
                    <DownloadIcon />
                    Download PDF
                  </a>
                ) : (
                  <button type="button" style={kebabMenuItemStyle({ disabled: exportState.pending })} disabled={exportState.pending} onClick={exportState.handleClick}>
                    <DownloadIcon />
                    {exportState.pending ? "Exporting…" : exportState.status === "FAILED" ? "Retry Export" : "Export Book"}
                  </button>
                )
              )}
              <button type="button" style={kebabMenuItemStyle({ danger: true })} onClick={() => setDeleteBookOpen(true)}>
                <TrashIcon />
                Delete Book
              </button>
            </HeaderActionsMenu>
          </div>
        </div>
      </div>

      {processError && (
        <div role="alert" style={processErrorStyle}>
          {processError}
        </div>
      )}

      {exportState.error && (
        <div role="alert" style={exportErrorStyle}>
          {exportState.error}
        </div>
      )}

      <BookReader bookId={book.id} images={images} />

      {!hasImages && <div style={emptyStateStyle}>No images uploaded yet.</div>}
      {unprocessedImages.length > 0 && (
        <div style={hasSections ? { marginTop: "var(--spacing-collection-large-spacing)" } : undefined}>
          <div style={uploadedImagesNoticeStyle}>
            {book.status === "PROCESSING"
              ? "Processing your notes…"
              : hasSections
                ? "Not yet transcribed:"
                : 'Click "Start Processing" to transcribe your uploaded images.'}
          </div>
          <UploadedImagesGrid images={unprocessedImages} />
        </div>
      )}

      {deleteBookOpen && (
        <div style={modalOverlayStyle} role="presentation" onClick={() => !deletingBook && setDeleteBookOpen(false)}>
          <div
            style={modalStyle}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-book-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              id="delete-book-heading"
              style={{ fontFamily: "var(--typography-title-medium-font-family)", fontSize: "var(--typography-title-medium-font-size)", fontWeight: "var(--typography-title-medium-font-weight)" }}
            >
              Delete &quot;{book.title}&quot;?
            </div>
            <p style={{ fontFamily: "var(--typography-body-medium-font-family)", fontSize: "var(--typography-body-medium-font-size)", color: "var(--color-roles-on-surface-variant)", margin: 0 }}>
              This permanently deletes the book, its uploaded images, and all transcribed notes. This cannot be undone.
            </p>
            {deleteBookError && (
              <span role="alert" style={{ fontFamily: "var(--typography-label-medium-font-family)", fontSize: "var(--typography-label-medium-font-size)", color: "var(--color-roles-error)" }}>
                {deleteBookError}
              </span>
            )}
            <div style={modalButtonRowStyle}>
              <button type="button" style={modalCancelButtonStyle} onClick={() => setDeleteBookOpen(false)} disabled={deletingBook}>
                Cancel
              </button>
              <button type="button" style={modalDeleteButtonStyle(deletingBook)} onClick={confirmDeleteBook} disabled={deletingBook}>
                {deletingBook ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
