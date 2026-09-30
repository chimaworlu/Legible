"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/src/config";

type UploadDrawerProps = {
  open: boolean;
  onClose: () => void;
  onUploaded?: () => void;
  title?: string;
  bookId?: string;
  mode?: "upload" | "continue";
  // The plan's per-book image cap — the real ceiling a user will actually
  // hit, unlike config.caps.batchImageLimit (a flat technical limit on a
  // single request, same for every plan). Displaying and enforcing the
  // smaller of the two keeps the caption honest for whichever plan is
  // looking at it. Falls back to the technical limit if the caller doesn't
  // know the plan yet.
  imagesPerBook?: number;
};

type SelectedFile = {
  file: File;
  id: string;
  status: "queued" | "uploading" | "done";
  // A local blob: URL, not the R2 signed URL the book detail page uses —
  // this exists purely so the user sees what they picked before any network
  // request happens. Revoked on removal and on unmount (see the cleanup
  // effect below) so selecting many large batches doesn't leak memory.
  previewUrl: string;
};

const drawerStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  height: "100vh",
  width: "min(100vw, 32rem)",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  borderLeft: "1px solid var(--color-roles-surface-container-highest)",
  boxShadow: "var(--effect-medium-shadow)",
  zIndex: 120,
  display: "flex",
  flexDirection: "column",
  transform: "translateX(0)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "var(--spacing-collection-large-spacing)",
  borderBottom: "1px solid var(--color-roles-surface-container-highest)",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-medium-font-family)",
  fontSize: "var(--typography-title-medium-font-size)",
  fontWeight: "var(--typography-title-medium-font-weight)",
};

const bodyStyle: React.CSSProperties = {
  padding: "var(--spacing-collection-large-spacing)",
  overflowY: "auto",
  display: "grid",
  gap: "var(--spacing-collection-base-spacing)",
};

const dropStyle: React.CSSProperties = {
  border: "1.5px dashed var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-very-large-spacing) var(--spacing-collection-large-spacing)",
  backgroundColor: "var(--color-roles-surface-container-low)",
  transition: "border-color 0.15s ease, background-color 0.15s ease",
};

const dropLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "0.625rem",
  cursor: "pointer",
};

const dropTitleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-small-font-family)",
  fontSize: "var(--typography-title-small-font-size)",
  fontWeight: "var(--typography-title-small-font-weight)",
  color: "var(--color-roles-on-surface)",
};

const dropCaptionStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
};

// Standard visually-hidden technique: present in the accessibility tree and
// reachable via the wrapping <label>, invisible and out of layout otherwise.
const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  padding: "var(--spacing-collection-large-spacing)",
  borderTop: "1px solid var(--color-roles-surface-container-highest)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--color-roles-on-surface-variant)",
  padding: "0.625rem 0.875rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: "0.375rem",
    backgroundColor: "var(--color-roles-primary)",
    color: "var(--color-roles-on-primary)",
    padding: "0.625rem 1rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: "var(--typography-label-large-font-family)",
  };
}

const closeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: "0.25rem",
  cursor: "pointer",
  color: "var(--color-roles-on-surface-variant)",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  padding: "0.875rem 1rem",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
};

const fileCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
};

const fileCardLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  minWidth: 0,
};

const fileThumbStyle: React.CSSProperties = {
  width: "2.75rem",
  height: "2.75rem",
  borderRadius: "0.5rem",
  objectFit: "cover",
  flexShrink: 0,
  backgroundColor: "var(--color-roles-surface-container-high)",
};

// Shown instead of a broken-image glyph when the browser can't decode the
// picked file client-side — most notably HEIC/HEIF, which R1 accepts as a
// valid upload format but which only Safari renders natively in an <img>.
const fileThumbFallbackStyle: React.CSSProperties = {
  ...fileThumbStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "0.625rem",
  fontWeight: 700,
  color: "var(--color-roles-on-surface-variant)",
};

const removeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: "0.25rem",
  cursor: "pointer",
  color: "var(--color-roles-on-surface-variant)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const statusStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
};

const errorStyle: React.CSSProperties = {
  color: "var(--color-roles-error)",
  fontFamily: "var(--typography-label-medium-font-family)",
};

const successContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "0.875rem",
  padding: "var(--spacing-collection-very-large-spacing) var(--spacing-collection-base-spacing)",
};

const successTitleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-medium-font-family)",
  fontSize: "var(--typography-title-medium-font-size)",
  fontWeight: "var(--typography-title-medium-font-weight)",
  color: "var(--color-roles-on-surface)",
};

const successDescriptionStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface-variant)",
  maxWidth: "22rem",
};

const successButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  border: "none",
  borderRadius: "0.5rem",
  backgroundColor: "var(--color-roles-primary)",
  color: "var(--color-roles-on-primary)",
  padding: "0.75rem 1.5rem",
  cursor: "pointer",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "0.9375rem",
  fontWeight: "var(--typography-label-large-font-weight)",
  marginTop: "0.25rem",
};

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5V4M7 9l5-5 5 5"
        stroke="var(--color-roles-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3"
        stroke="var(--color-roles-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SuccessCheckIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="var(--color-roles-primary)" strokeWidth="1.5" />
      <path d="M8 12.5l2.5 2.5 5.5-5.5" stroke="var(--color-roles-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h11M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KB`;
  return `${(kib / 1024).toFixed(1)} MB`;
}

function isAcceptedImage(file: File): boolean {
  return ["image/jpeg", "image/png", "image/heic", "image/heif"].includes(file.type);
}

function FilePreviewThumb({ src, fileName }: { src: string; fileName: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    const ext = fileName.split(".").pop()?.toUpperCase().slice(0, 4) ?? "IMG";
    return <div style={fileThumbFallbackStyle}>{ext}</div>;
  }
  return <img src={src} alt="" style={fileThumbStyle} onError={() => setFailed(true)} />;
}

export function UploadDrawer({ open, onClose, onUploaded, title: bookName, bookId, mode = "upload", imagesPerBook }: UploadDrawerProps) {
  const router = useRouter();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadSucceeded, setUploadSucceeded] = useState(false);
  const maxPerBatch = Math.min(imagesPerBook ?? config.caps.batchImageLimit, config.caps.batchImageLimit);

  // Lets the unmount-cleanup effect below always see the latest files
  // without re-subscribing on every state change (it only needs to run once,
  // at actual unmount — see its own comment).
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // The drawer stays mounted between opens (see the comment on the effect
  // below), so a fresh open has to explicitly clear a success screen left
  // over from the previous batch — otherwise reopening to upload more shows
  // "Upload Complete!" again instead of the drop zone.
  useEffect(() => {
    if (open) setUploadSucceeded(false);
  }, [open]);

  // The drawer stays mounted (controlled by `open`, not conditionally
  // rendered by its parent), so object URLs created via addFiles only get
  // revoked here, on the rare actual unmount — removeFile handles the normal
  // per-file case below.
  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  if (!open) return null;

  function addFiles(nextFiles: File[]) {
    if (nextFiles.length === 0) return; // e.g. the file picker was cancelled

    const accepted = nextFiles.filter(isAcceptedImage);
    if (accepted.length === 0) {
      setError("Select at least one JPEG, PNG, HEIC, or HEIF image.");
      return;
    }

    setFiles((current) => {
      const existingIds = new Set(current.map((item) => item.id));
      const additions: SelectedFile[] = accepted
        .map((file) => ({ file, id: `${file.name}-${file.lastModified}-${file.size}`, status: "queued" as const, previewUrl: URL.createObjectURL(file) }))
        .filter((item) => {
          if (existingIds.has(item.id)) {
            URL.revokeObjectURL(item.previewUrl); // duplicate of an already-selected file — its preview is never rendered
            return false;
          }
          return true;
        });

      const combined = [...current, ...additions];
      if (combined.length > maxPerBatch) {
        setError(`A batch is limited to ${maxPerBatch} images on your plan. Only the first ${maxPerBatch} were kept.`);
      } else {
        setError("");
      }
      const kept = combined.slice(0, maxPerBatch);
      const droppedByBatchCap = combined.slice(maxPerBatch);
      droppedByBatchCap.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return kept;
    });
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    setError("");
  }

  async function handleUpload() {
    if (submitting || files.length === 0) return;

    setSubmitting(true);
    setFiles((current) => current.map((item) => ({ ...item, status: "uploading" })));

    try {
      const formData = new FormData();
      files.forEach((item) => formData.append("images", item.file));
      if (bookId) formData.append("bookId", bookId);

      let response: Response;
      try {
        response = await fetch("/api/books/upload", { method: "POST", body: formData });
      } catch {
        setError("Network error. Please try again.");
        setFiles((current) => current.map((item) => ({ ...item, status: "queued" })));
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Upload could not be started.");
        setFiles((current) => current.map((item) => ({ ...item, status: "queued" })));
        return;
      }

      // Refresh now so the underlying page's data (the book's image grid) is
      // already current by the time "View My Notes" navigates there — the
      // drawer itself stays open on the success screen until the user acts,
      // rather than closing out from under them with no confirmation.
      router.refresh();
      files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setFiles([]);
      setUploadSucceeded(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleViewNotes() {
    setUploadSucceeded(false);
    onClose();
    onUploaded?.();
    if (bookId) router.push(`/dashboard/${bookId}`);
  }

  return (
    <div style={drawerStyle} role="dialog" aria-modal="true" aria-labelledby="upload-drawer-heading">
      <div style={headerStyle}>
        <div>
          <div id="upload-drawer-heading" style={titleStyle}>
            {mode === "continue" ? "Continue" : "Upload handwritten notes"}
          </div>
          <div style={statusStyle}>{bookName ? `${bookName} - ` : ""}Add images, upload them, then continue to review the notes.</div>
        </div>
        <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close drawer">
          <CloseIcon />
        </button>
      </div>

      {uploadSucceeded ? (
        <div style={bodyStyle}>
          <div style={successContainerStyle}>
            <SuccessCheckIcon />
            <div style={successTitleStyle}>Upload Complete!</div>
            <div style={successDescriptionStyle}>
              Your notes have been successfully saved to this book. You can view them below.
            </div>
            <button type="button" style={successButtonStyle} onClick={handleViewNotes}>
              View My Notes
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={bodyStyle}>
            <div
              style={{
                ...dropStyle,
                borderColor: isDragging ? "var(--color-roles-primary)" : "var(--color-roles-surface-container-highest)",
                backgroundColor: isDragging ? "var(--color-roles-primary-container)" : "var(--color-roles-surface-container-low)",
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(Array.from(event.dataTransfer.files));
              }}
            >
              <label htmlFor="upload-files" style={dropLabelStyle}>
                <UploadIcon />
                <span style={dropTitleStyle}>Click or drag images here</span>
                <span style={dropCaptionStyle}>JPEG, PNG, HEIC, HEIF · up to {maxPerBatch} per batch</span>
                <input
                  id="upload-files"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/heic,image/heif"
                  style={srOnlyStyle}
                  onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
                />
              </label>
            </div>

            {files.length > 0 ? (
              files.map((item) => (
                <div key={item.id} style={fileCardStyle}>
                  <div style={fileCardLeftStyle}>
                    <FilePreviewThumb src={item.previewUrl} fileName={item.file.name} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--typography-label-large-font-family)",
                          fontWeight: "var(--typography-label-large-font-weight)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.file.name}
                      </div>
                      <div style={statusStyle}>
                        {formatSize(item.file.size)} · {item.status}
                      </div>
                    </div>
                  </div>
                  <button type="button" style={removeButtonStyle} onClick={() => removeFile(item.id)} aria-label={`Remove ${item.file.name}`} title="Remove file">
                    <RemoveIcon />
                  </button>
                </div>
              ))
            ) : (
              <div style={statusStyle}>No files selected yet.</div>
            )}

            {error && <div style={errorStyle}>{error}</div>}
          </div>

          <div style={buttonRowStyle}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button type="button" onClick={handleUpload} disabled={submitting || files.length === 0} style={primaryButtonStyle(submitting || files.length === 0)}>
              {submitting ? "Uploading…" : "Upload notes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
