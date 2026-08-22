"use client";

import { useEffect, useState } from "react";
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KB`;
  return `${(kib / 1024).toFixed(1)} MB`;
}

function isAcceptedImage(file: File): boolean {
  return ["image/jpeg", "image/png", "image/heic", "image/heif"].includes(file.type);
}

export function UploadDrawer({ open, onClose, onUploaded, title: bookName, bookId, mode = "upload", imagesPerBook }: UploadDrawerProps) {
  const router = useRouter();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const maxPerBatch = Math.min(imagesPerBook ?? config.caps.batchImageLimit, config.caps.batchImageLimit);

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
        .map((file) => ({ file, id: `${file.name}-${file.lastModified}-${file.size}`, status: "queued" as const }))
        .filter((item) => !existingIds.has(item.id));

      const combined = [...current, ...additions];
      if (combined.length > maxPerBatch) {
        setError(`A batch is limited to ${maxPerBatch} images on your plan. Only the first ${maxPerBatch} were kept.`);
      } else {
        setError("");
      }
      return combined.slice(0, maxPerBatch);
    });
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((item) => item.id !== id));
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

      setFiles((current) => current.map((item) => ({ ...item, status: "done" })));
      router.refresh();
      onUploaded?.();
    } finally {
      setSubmitting(false);
    }
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
              <div>
                <div style={{ fontFamily: "var(--typography-label-large-font-family)", fontWeight: "var(--typography-label-large-font-weight)" }}>{item.file.name}</div>
                <div style={statusStyle}>
                  {formatSize(item.file.size)} · {item.status}
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
    </div>
  );
}
