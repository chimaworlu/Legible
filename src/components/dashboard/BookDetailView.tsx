"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UploadDrawer } from "./UploadDrawer";

type BookDetailViewProps = {
  book: { id: string; title: string; status: string };
  images: Array<{ id: string; format: string; status: string; createdAt: Date }>;
  imagesPerBook?: number;
};

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
  marginBottom: "var(--spacing-collection-extra-small-spacing)",
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

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.375rem",
  background: "var(--color-roles-surface-container-lowest)",
  color: "var(--color-roles-on-surface)",
  padding: "0.5625rem 1rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: "var(--typography-label-large-font-weight)",
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

const captionStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  fontWeight: "var(--typography-label-medium-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "var(--spacing-collection-base-spacing)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(10.5rem, 1fr))",
  gap: "var(--spacing-collection-base-spacing)",
};

const imageCardStyle: React.CSSProperties = {
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const thumbPlaceholderStyle: React.CSSProperties = {
  aspectRatio: "1 / 1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--color-roles-on-surface-variant)",
};

const imageFooterStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  padding: "0.5rem 0.625rem",
  borderTop: "1px solid var(--color-roles-surface-container-highest)",
};

const imageFooterLabelStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "0.6875rem",
  fontWeight: "var(--typography-label-medium-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const imageDeleteButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  border: "none",
  background: "none",
  padding: "0.25rem",
  cursor: "pointer",
  color: "var(--color-roles-error)",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "var(--spacing-collection-very-large-spacing)",
  backgroundColor: "var(--color-roles-surface-container-low)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  color: "var(--color-roles-on-surface-variant)",
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

const IMAGE_STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Uploaded",
  QUALITY_FAILED: "Quality failed",
  ACCEPTED: "Accepted",
  TRANSCRIBED: "Transcribed",
  FAILED: "Failed",
};

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImagePlaceholderIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.12 0L4 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

export function BookDetailView({ book, images, imagesPerBook }: BookDetailViewProps) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; format: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function confirmDeleteImage() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/books/${book.id}/images/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setDeleteError(body?.message ?? "Could not delete image. Please try again.");
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
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
          <button type="button" style={secondaryButtonStyle} onClick={() => setUploadOpen(true)}>
            Upload More
          </button>
          <button type="button" style={primaryButtonStyle(true)} disabled title="Processing isn't available yet">
            Start Processing
          </button>
        </div>
      </div>

      <div style={captionStyle}>
        {images.length} {images.length === 1 ? "Image" : "Images"} Uploaded
      </div>

      {images.length === 0 ? (
        <div style={emptyStateStyle}>No images uploaded yet. Click &quot;Upload More&quot; to add some.</div>
      ) : (
        <div style={gridStyle}>
          {images.map((image) => (
            <div key={image.id} style={imageCardStyle}>
              <div style={thumbPlaceholderStyle}>
                <ImagePlaceholderIcon />
              </div>
              <div style={imageFooterStyle}>
                <span style={imageFooterLabelStyle}>
                  IMAGE/{image.format.toUpperCase()} · {IMAGE_STATUS_LABELS[image.status] ?? image.status}
                </span>
                <button
                  type="button"
                  style={imageDeleteButtonStyle}
                  onClick={() => {
                    setDeleteError("");
                    setDeleteTarget({ id: image.id, format: image.format });
                  }}
                  aria-label="Delete image"
                  title="Delete image"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadDrawer
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => setUploadOpen(false)}
        title={book.title}
        bookId={book.id}
        mode="continue"
        imagesPerBook={imagesPerBook}
      />

      {deleteTarget && (
        <div style={modalOverlayStyle} role="presentation" onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            style={modalStyle}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-image-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              id="delete-image-heading"
              style={{ fontFamily: "var(--typography-title-medium-font-family)", fontSize: "var(--typography-title-medium-font-size)", fontWeight: "var(--typography-title-medium-font-weight)" }}
            >
              Delete this image?
            </div>
            <p style={{ fontFamily: "var(--typography-body-medium-font-family)", fontSize: "var(--typography-body-medium-font-size)", color: "var(--color-roles-on-surface-variant)", margin: 0 }}>
              This permanently removes the image and any notes transcribed from it. This cannot be undone.
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
              <button type="button" style={modalDeleteButtonStyle(deleting)} onClick={confirmDeleteImage} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
