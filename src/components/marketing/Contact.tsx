"use client";

import { useState } from "react";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  lineHeight: "var(--typography-label-large-line-height)",
  letterSpacing: "var(--typography-label-large-letter-spacing)",
  fontWeight: "var(--typography-label-large-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
};

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  lineHeight: "var(--typography-body-medium-line-height)",
  color: "var(--color-roles-on-surface)",
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.5rem",
  padding: "var(--spacing-collection-medium-spacing) var(--spacing-collection-base-spacing)",
};

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Could not send your message. Please try again.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Could not send your message. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <section
      id="contact"
      style={{
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: "var(--spacing-collection-very-large-spacing)",
        paddingBottom: "var(--spacing-collection-very-large-spacing)",
        paddingLeft: "var(--spacing-collection-very-large-spacing)",
        paddingRight: "var(--spacing-collection-very-large-spacing)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: "28rem" }}>
        <h2
          style={{
            fontFamily: "var(--typography-headline-small-font-family)",
            fontSize: "var(--typography-headline-small-font-size)",
            lineHeight: "var(--typography-headline-small-line-height)",
            letterSpacing: "var(--typography-headline-small-letter-spacing)",
            fontWeight: "var(--typography-headline-small-font-weight)",
            marginBottom: "var(--spacing-collection-small-spacing)",
            textAlign: "center",
          }}
        >
          Get in touch
        </h2>

        <p
          style={{
            fontFamily: "var(--typography-body-medium-font-family)",
            fontSize: "var(--typography-body-medium-font-size)",
            lineHeight: "var(--typography-body-medium-line-height)",
            color: "var(--color-roles-on-surface-variant)",
            marginBottom: "var(--spacing-collection-very-large-spacing)",
            textAlign: "center",
          }}
        >
          Questions, feedback, or a bug to report? Send us a note.
        </p>

        {submitted ? (
          <div
            role="status"
            style={{
              backgroundColor: "var(--color-roles-primary-container)",
              color: "var(--color-roles-on-primary-container)",
              borderRadius: "0.75rem",
              padding: "var(--spacing-collection-extra-large)",
              textAlign: "center",
              fontFamily: "var(--typography-body-medium-font-family)",
              fontSize: "var(--typography-body-medium-font-size)",
              lineHeight: "var(--typography-body-medium-line-height)",
            }}
          >
            Thanks for reaching out — we&apos;ll get back to you soon.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-base-spacing)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="contact-name" style={labelStyle}>
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                className="contact-input"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="contact-email" style={labelStyle}>
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                className="contact-input"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-collection-extra-small-spacing)" }}>
              <label htmlFor="contact-message" style={labelStyle}>
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={4}
                className="contact-input"
                style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--typography-body-medium-font-family)" }}
              />
            </div>

            {error && (
              <span
                role="alert"
                style={{
                  fontFamily: "var(--typography-label-medium-font-family)",
                  fontSize: "var(--typography-label-medium-font-size)",
                  color: "var(--color-roles-error)",
                }}
              >
                {error}
              </span>
            )}

            <button
              type="submit"
              className="contact-submit-button"
              disabled={submitting}
              style={{
                marginTop: "var(--spacing-collection-small-spacing)",
                backgroundColor: "var(--color-roles-primary)",
                color: "var(--color-roles-on-primary)",
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.625rem 1.75rem",
                fontFamily: "var(--typography-label-large-font-family)",
                fontSize: "0.9375rem",
                fontWeight: "var(--typography-label-large-font-weight)",
                lineHeight: "var(--typography-label-large-line-height)",
                boxShadow: "var(--effect-soft-shadow)",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
