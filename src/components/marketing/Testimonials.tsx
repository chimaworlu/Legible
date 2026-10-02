const TESTIMONIALS = [
  {
    quote:
      "I photographed a whole semester of lecture notes and had a searchable digital book by the next morning.",
    name: "Amara Chukwu",
    role: "Nursing student",
  },
  {
    quote:
      "The structure it pulls out of messy handwriting is honestly better than what I'd have typed up myself.",
    name: "David Okafor",
    role: "Law student",
  },
  {
    quote:
      "Flagged the two pages it couldn't read clearly instead of guessing. That's the kind of honesty I want from a tool.",
    name: "Priya Nair",
    role: "Medical student",
  },
];

const eyebrowStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-large-font-family)",
  fontSize: "var(--typography-label-large-font-size)",
  fontWeight: "var(--typography-label-large-font-weight)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-roles-primary)",
  textAlign: "center",
  marginBottom: "var(--spacing-collection-small-spacing)",
};

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--typography-headline-small-font-family)",
  fontSize: "var(--typography-headline-small-font-size)",
  lineHeight: "var(--typography-headline-small-line-height)",
  letterSpacing: "var(--typography-headline-small-letter-spacing)",
  fontWeight: "var(--typography-headline-small-font-weight)",
  textAlign: "center",
};

const subheadingStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  lineHeight: "var(--typography-body-medium-line-height)",
  color: "var(--color-roles-on-surface-variant)",
  textAlign: "center",
  maxWidth: "28rem",
  marginTop: "var(--spacing-collection-small-spacing)",
  marginBottom: "var(--spacing-collection-very-large-spacing)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(17rem, 1fr))",
  gap: "var(--spacing-collection-large-spacing)",
  width: "100%",
  maxWidth: "62.5rem",
  alignItems: "stretch",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--color-roles-surface-container-lowest)",
  color: "var(--color-roles-on-surface)",
  border: "1px solid var(--color-roles-surface-container-highest)",
  borderRadius: "0.75rem",
  padding: "var(--spacing-collection-extra-large)",
  boxShadow: "var(--effect-soft-shadow)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-collection-base-spacing)",
};

const starRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.1875rem",
};

const quoteStyle: React.CSSProperties = {
  fontFamily: "var(--typography-body-medium-font-family)",
  fontSize: "var(--typography-body-medium-font-size)",
  lineHeight: "var(--typography-body-medium-line-height)",
  letterSpacing: "var(--typography-body-medium-letter-spacing)",
  fontWeight: "var(--typography-body-medium-font-weight)",
  color: "var(--color-roles-on-surface)",
  flex: 1,
};

const footerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-collection-small-spacing)",
  paddingTop: "var(--spacing-collection-base-spacing)",
  borderTop: "1px solid var(--color-roles-surface-container-highest)",
};

const avatarStyle: React.CSSProperties = {
  flexShrink: 0,
  width: "2.75rem",
  height: "2.75rem",
  borderRadius: "50%",
  backgroundColor: "var(--color-roles-primary-container)",
  color: "var(--color-roles-on-primary-container)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--typography-title-small-font-family)",
  fontSize: "var(--typography-title-small-font-size)",
  fontWeight: "var(--typography-title-small-font-weight)",
};

const nameStyle: React.CSSProperties = {
  fontFamily: "var(--typography-title-small-font-family)",
  fontSize: "var(--typography-title-small-font-size)",
  lineHeight: "var(--typography-title-small-line-height)",
  letterSpacing: "var(--typography-title-small-letter-spacing)",
  fontWeight: "var(--typography-title-small-font-weight)",
};

const roleStyle: React.CSSProperties = {
  fontFamily: "var(--typography-label-medium-font-family)",
  fontSize: "var(--typography-label-medium-font-size)",
  lineHeight: "var(--typography-label-medium-line-height)",
  letterSpacing: "var(--typography-label-medium-letter-spacing)",
  fontWeight: "var(--typography-label-medium-font-weight)",
  color: "var(--color-roles-on-surface-variant)",
};

function StarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--color-roles-primary)" aria-hidden="true">
      <path d="M12 2.5l2.9 6.07 6.6.74-4.95 4.6 1.3 6.59L12 17.27l-5.85 3.23 1.3-6.59-4.95-4.6 6.6-.74L12 2.5z" />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Testimonials() {
  return (
    <section
      id="testimonials"
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
      <p style={eyebrowStyle}>Testimonials</p>
      <h2 style={headingStyle}>What students are saying</h2>
      <p style={subheadingStyle}>
        Real feedback from students who turned their handwritten notes into digital books.
      </p>

      <div style={gridStyle}>
        {TESTIMONIALS.map((testimonial) => (
          <div key={testimonial.name} className="testimonial-card" style={cardStyle}>
            <div style={starRowStyle} aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} />
              ))}
            </div>

            <p style={quoteStyle}>&ldquo;{testimonial.quote}&rdquo;</p>

            <div style={footerRowStyle}>
              <div style={avatarStyle}>{initials(testimonial.name)}</div>
              <div>
                <p style={nameStyle}>{testimonial.name}</p>
                <p style={roleStyle}>{testimonial.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
