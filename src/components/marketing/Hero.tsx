import Link from "next/link";

export default function Hero() {
  return (
    <section
      id="hero"
      className="hero-section"
      style={{
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        paddingLeft: "4.5rem",
        paddingRight: "4.5rem",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "37.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--typography-display-small-font-family)",
            fontSize: "var(--typography-display-small-fluid-font-size)",
            lineHeight: "var(--typography-display-small-fluid-line-height)",
            letterSpacing: "var(--typography-display-small-fluid-letter-spacing)",
            fontWeight: "var(--typography-display-small-font-weight)",
            marginBottom: "var(--spacing-collection-medium-spacing)",
            textAlign: "center",
          }}
        >
          Handwritten Notes to Digital Book
        </h1>

        <p
          style={{
            fontFamily: "var(--typography-body-large-font-family)",
            fontSize: "var(--typography-body-large-font-size)",
            lineHeight: "var(--typography-body-large-line-height)",
            letterSpacing: "var(--typography-body-large-letter-spacing)",
            fontWeight: "var(--typography-body-large-font-weight)",
            marginBottom: "var(--spacing-collection-very-large-spacing)",
            color: "var(--color-roles-on-surface-variant)",
            maxWidth: "30rem",
            marginLeft: "auto",
            marginRight: "auto",
            wordWrap: "break-word",
            textAlign: "center",
          }}
        >
          Turn photos of your handwritten student notes into a clean, structured,
          editable digital book.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Link
            href="/auth?mode=signup"
            className="hero-primary-button"
            style={{
              display: "inline-block",
              backgroundColor: "var(--color-roles-primary)",
              color: "var(--color-roles-on-primary)",
              padding: "0.5rem 1.75rem",
              borderRadius: "0.375rem",
              fontFamily: "var(--typography-label-large-font-family)",
              fontSize: "0.9375rem",
              fontWeight: "var(--typography-label-large-font-weight)",
              lineHeight: "var(--typography-label-large-line-height)",
              boxShadow: "var(--effect-soft-shadow)",
              textDecoration: "none",
            }}
          >
            Get Started
          </Link>
        </div>
      </div>
    </section>
  );
}
