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
      <h2
        style={{
          fontFamily: "var(--typography-headline-small-font-family)",
          fontSize: "var(--typography-headline-small-font-size)",
          lineHeight: "var(--typography-headline-small-line-height)",
          letterSpacing: "var(--typography-headline-small-letter-spacing)",
          fontWeight: "var(--typography-headline-small-font-weight)",
          marginBottom: "var(--spacing-collection-very-large-spacing)",
          textAlign: "center",
        }}
      >
        What students are saying
      </h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "var(--spacing-collection-large-spacing)",
          maxWidth: "62.5rem",
        }}
      >
        {TESTIMONIALS.map((testimonial) => (
          <div
            key={testimonial.name}
            style={{
              backgroundColor: "var(--color-roles-surface-container)",
              color: "var(--color-roles-on-surface)",
              borderRadius: "0.75rem",
              padding: "var(--spacing-collection-extra-large)",
              boxShadow: "var(--effect-soft-shadow)",
              width: "17.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-collection-base-spacing)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--typography-body-medium-font-family)",
                fontSize: "var(--typography-body-medium-font-size)",
                lineHeight: "var(--typography-body-medium-line-height)",
                letterSpacing: "var(--typography-body-medium-letter-spacing)",
                fontWeight: "var(--typography-body-medium-font-weight)",
                color: "var(--color-roles-on-surface)",
              }}
            >
              &ldquo;{testimonial.quote}&rdquo;
            </p>

            <div>
              <p
                style={{
                  fontFamily: "var(--typography-title-small-font-family)",
                  fontSize: "var(--typography-title-small-font-size)",
                  lineHeight: "var(--typography-title-small-line-height)",
                  letterSpacing: "var(--typography-title-small-letter-spacing)",
                  fontWeight: "var(--typography-title-small-font-weight)",
                }}
              >
                {testimonial.name}
              </p>
              <p
                style={{
                  fontFamily: "var(--typography-label-medium-font-family)",
                  fontSize: "var(--typography-label-medium-font-size)",
                  lineHeight: "var(--typography-label-medium-line-height)",
                  letterSpacing: "var(--typography-label-medium-letter-spacing)",
                  fontWeight: "var(--typography-label-medium-font-weight)",
                  color: "var(--color-roles-on-surface-variant)",
                }}
              >
                {testimonial.role}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
