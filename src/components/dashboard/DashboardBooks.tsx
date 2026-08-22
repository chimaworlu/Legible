"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadDrawer } from "./UploadDrawer";

type DashboardBooksProps = {
  books: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: Date;
    images: { id: string }[];
  }>;
  imagesPerBook?: number;
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(18.75rem, 1fr))",
  gap: "var(--spacing-collection-base-spacing)",
};

const cardStyle: React.CSSProperties = {
  padding: "var(--spacing-collection-base-spacing)",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-extra-small-spacing)",
};

const continueButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
  color: "var(--color-roles-on-primary)",
  backgroundColor: "var(--color-roles-primary)",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.5rem 0.875rem",
  cursor: "pointer",
};

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
  color: "var(--color-roles-primary)",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const optionsButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.75rem",
  height: "1.75rem",
  flexShrink: 0,
  border: "none",
  borderRadius: "0.375rem",
  background: "none",
  color: "var(--color-roles-on-surface-variant)",
  cursor: "pointer",
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 0.25rem)",
  right: 0,
  minWidth: "9rem",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.5rem",
  boxShadow: "var(--effect-medium-shadow)",
  padding: "0.25rem",
  zIndex: 10,
};

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "none",
  borderRadius: "0.375rem",
  padding: "0.5rem 0.625rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  color: "var(--color-roles-error)",
  cursor: "pointer",
};

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
  maxWidth: "24rem",
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

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h11M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="5" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="19" r="1.75" fill="currentColor" />
    </svg>
  );
}

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  PROCESSING: "Processing",
  READY: "Ready",
  ARCHIVED: "Archived",
};

const statusColors: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: "var(--color-roles-surface-container-high)", fg: "var(--color-roles-on-surface-variant)" },
  PROCESSING: { bg: "var(--color-roles-tertiary-container)", fg: "var(--color-roles-on-tertiary-container)" },
  READY: { bg: "var(--color-roles-primary-container)", fg: "var(--color-roles-on-primary-container)" },
  ARCHIVED: { bg: "var(--color-roles-surface-container-high)", fg: "var(--color-roles-on-surface-variant)" },
};

function statusStyle(status: string): React.CSSProperties {
  const colors = statusColors[status] ?? statusColors.DRAFT;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.1875rem 0.5rem",
    borderRadius: "1rem",
    fontFamily: "var(--typography-label-medium-font-family)",
    fontSize: "var(--typography-label-medium-font-size)",
    fontWeight: "var(--typography-label-medium-font-weight)",
    backgroundColor: colors.bg,
    color: colors.fg,
  };
}

function formatBookDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function DashboardBooks({ books, imagesPerBook }: DashboardBooksProps) {
  const router = useRouter();
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const activeBook = useMemo(() => books.find((book) => book.id === activeBookId) ?? null, [activeBookId, books]);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  function openDeleteConfirm(book: { id: string; title: string }) {
    setMenuOpenId(null);
    setDeleteError("");
    setDeleteTarget(book);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/books/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setDeleteError(body?.message ?? "Could not delete book. Please try again.");
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div style={gridStyle}>
        {books.map((book) => {
          const hasNotes = book.images.length > 0;
          const menuOpen = menuOpenId === book.id;
          return (
            <div key={book.id} style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={{ fontFamily: "var(--typography-title-medium-font-family)", fontSize: "var(--typography-title-medium-font-size)", fontWeight: "var(--typography-title-medium-font-weight)" }}>
                  {book.title}
                </span>
                <div style={{ position: "relative" }} ref={menuOpen ? menuContainerRef : undefined}>
                  <button
                    type="button"
                    style={optionsButtonStyle}
                    onClick={() => setMenuOpenId((current) => (current === book.id ? null : book.id))}
                    aria-label={`Options for ${book.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <DotsIcon />
                  </button>
                  {menuOpen && (
                    <div style={menuStyle} role="menu">
                      <button type="button" role="menuitem" style={menuItemStyle} onClick={() => openDeleteConfirm(book)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <span style={{ fontFamily: "var(--typography-label-medium-font-family)", fontSize: "var(--typography-label-medium-font-size)", color: "var(--color-roles-on-surface-variant)" }}>
                Created {formatBookDate(book.createdAt)}
              </span>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "var(--spacing-collection-extra-small-spacing)" }}>
                <span style={statusStyle(book.status)}>{statusLabels[book.status] ?? book.status}</span>
                {hasNotes ? (
                  <button type="button" style={continueButtonStyle} onClick={() => router.push(`/dashboard/${book.id}`)}>
                    Continue
                    <ArrowRightIcon />
                  </button>
                ) : (
                  <button type="button" style={linkStyle} onClick={() => setActiveBookId(book.id)}>
                    Upload notes
                    <ArrowRightIcon />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <UploadDrawer
        open={Boolean(activeBook)}
        onClose={() => setActiveBookId(null)}
        title={activeBook?.title ?? ""}
        bookId={activeBook?.id}
        mode={activeBook && activeBook.images.length > 0 ? "continue" : "upload"}
        imagesPerBook={imagesPerBook}
      />

      {deleteTarget && (
        <div style={modalOverlayStyle} role="presentation" onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            style={modalStyle}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-book-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div id="delete-book-heading" style={{ fontFamily: "var(--typography-title-medium-font-family)", fontSize: "var(--typography-title-medium-font-size)", fontWeight: "var(--typography-title-medium-font-weight)" }}>
              Delete &quot;{deleteTarget.title}&quot;?
            </div>
            <p style={{ fontFamily: "var(--typography-body-medium-font-family)", fontSize: "var(--typography-body-medium-font-size)", color: "var(--color-roles-on-surface-variant)", margin: 0 }}>
              This permanently deletes the book, its uploaded images, and all transcribed notes. This cannot be undone.
            </p>
            {deleteError && (
              <span role="alert" style={{ fontFamily: "var(--typography-label-medium-font-family)", fontSize: "var(--typography-label-medium-font-size)", color: "var(--color-roles-error)" }}>
                {deleteError}
              </span>
            )}
            <div style={modalButtonRowStyle}>
              <button type="button" style={modalCancelButtonStyle} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" style={modalDeleteButtonStyle(deleting)} onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
