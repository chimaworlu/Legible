"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const overlayStyle: React.CSSProperties = {
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

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
};

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  color: "var(--color-roles-on-surface)",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.5rem",
  padding: "var(--spacing-collection-medium-spacing) var(--spacing-collection-base-spacing)",
  width: "100%",
  boxSizing: "border-box",
};

const errorStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  color: "var(--color-roles-error)",
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

function modalSubmitButtonStyle(disabled: boolean): React.CSSProperties {
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

export function NewBookButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openModal() {
    if (disabled) return;
    setTitle("");
    setError("");
    setOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setOpen(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) {
        setError(data?.message ?? "Could not create book. Please try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="contact-submit-button"
        disabled={disabled}
        onClick={openModal}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "var(--spacing-collection-small-spacing) var(--spacing-collection-base-spacing)",
          backgroundColor: "var(--color-roles-primary)",
          color: "var(--color-roles-on-primary)",
          border: "none",
          borderRadius: "0.375rem",
          fontFamily: "var(--typography-label-large-font-family)",
          fontSize: "0.9375rem",
          fontWeight: "var(--typography-label-large-font-weight)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          boxShadow: disabled ? "none" : "var(--effect-soft-shadow)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        New Book
      </button>

      {open && (
        <div style={overlayStyle} role="presentation" onClick={closeModal}>
          <div
            style={modalStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-book-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              id="new-book-heading"
              style={{
                fontFamily: "var(--typography-title-medium-font-family)",
                fontSize: "var(--typography-title-medium-font-size)",
                fontWeight: "var(--typography-title-medium-font-weight)",
              }}
            >
              Name your book
            </div>
            <form onSubmit={handleCreate} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-base-spacing)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
                <label htmlFor="new-book-title" style={labelStyle}>Book title</label>
                <input
                  id="new-book-title"
                  type="text"
                  autoFocus
                  maxLength={200}
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    if (error) setError("");
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "new-book-title-error" : undefined}
                  className="contact-input"
                  style={inputStyle}
                />
                {error && (
                  <span id="new-book-title-error" role="alert" style={errorStyle}>
                    {error}
                  </span>
                )}
              </div>

              <div style={modalButtonRowStyle}>
                <button type="button" style={modalCancelButtonStyle} onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" style={modalSubmitButtonStyle(submitting)} disabled={submitting}>
                  {submitting ? "Creating…" : "Create book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
