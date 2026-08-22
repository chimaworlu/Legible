"use client";

import { useState } from "react";

type UploadNotesLauncherProps = {
  disabled?: boolean;
};

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
  color: "var(--color-roles-primary)",
  cursor: "pointer",
  background: "none",
  border: "none",
  padding: 0,
};

const panelStyle: React.CSSProperties = {
  marginTop: "var(--spacing-collection-base-spacing)",
  padding: "var(--spacing-collection-large-spacing)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  backgroundColor: "var(--color-roles-surface-container-low)",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-medium-font-family)",
  fontSize: "var(--typography-title-medium-font-size)",
  fontWeight: "var(--typography-title-medium-font-weight)",
  marginBottom: "var(--spacing-collection-extra-small-spacing)",
};

const textStyle: React.CSSProperties = {
  color: "var(--color-roles-on-surface-variant)",
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
};

export function UploadNotesLauncher({ disabled = false }: UploadNotesLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        style={linkStyle}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        Upload notes →
      </button>

      {open && (
        <section id="upload-mount-point" style={panelStyle}>
          <h2 style={titleStyle}>Upload handwritten notes</h2>
          <p style={textStyle}>
            This panel is where the upload UI belongs. Add single or bulk note images here so the AI can transcribe, flag gaps, and organize the book.
          </p>
          <div style={{ marginTop: "var(--spacing-collection-base-spacing)", color: "var(--color-roles-on-surface-variant)" }}>
            Upload fields and file controls should be rendered here.
          </div>
        </section>
      )}
    </div>
  );
}
