---
trigger: glob
---

---
trigger: glob
---

# design-system-rule.md

Rules for the product UI. The design system is defined in
`design-tokens.tokens.json` and compiled to CSS variables in the generated
tokens file. That file is the single source of visual truth.

## LAWS — token usage

1. The generated CSS variables file is machine-generated. Never edit it by
   hand. All visual changes happen in `design-tokens.tokens.json` and are
   recompiled. A hand-edited generated file is a failed task.
2. Apply semantic Color Roles only (`--color-roles-*`). Never apply a
   primitive color (`--primitive-colors-*`) directly to any UI element. The
   primitives are foundation values that feed the roles. This includes the
   error palette: `--primitive-colors-error-color-palette-*` is never used
   directly, even though no error role exists yet (see law 4).
3. Never hardcode a color, shadow, spacing value, font family, font size, or
   line height in a component, stylesheet, or inline style. Every visual
   value resolves to a token:
   - Colors: `--color-roles-*`
   - Spacing: `--spacing-collection-*` (0, 4, 8, 12, 16, 20, 24, 32)
   - Type: `--typography-*` scale variables
   - Shadows: `--effect-*-shadow`
   A raw hex, px margin, or font-family string in component code is a failed
   task even if it visually matches a token.
4. When the system has a gap, extend the system — never bypass it. The
   current roles define primary, secondary, and tertiary only. Known gaps
   that MUST become new semantic tokens in the source JSON before use:
   - Error/danger roles (map them to the existing error primitive palette)
   - Surface and background roles (map to the neutral palette)
   - Transcription flag roles: `flag-low` and `flag-gap` container and
     on-container colors for the R18 highlight rendering
   Adding the token first, then using it, passes. Inlining a hex "just for
   now" fails.
5. Typography uses the token type scale exclusively: display, headline,
   title, body, and label variants as defined. Bricolage Grotesque is the
   only UI font family, always referenced through the typography tokens,
   never as a literal string. New type sizes are added to the token source,
   not improvised in components.
6. Spacing uses the named scale only. If a layout needs a value outside
   0/4/8/12/16/20/24/32, that is a design decision: add it to the token
   source or compose from existing tokens. Never write an arbitrary px gap.
7. Elevation uses the three effect shadows (soft, medium, hard). Never write
   a custom box-shadow.

## LAWS — PRD-driven visibility (unchanged from PRD requirements)

8. Low-confidence and GAP spans are always visibly distinct in the editor
   and reader (R18), rendered through the `flag-low` and `flag-gap` tokens
   from law 4. A user must spot a flagged span without hovering or toggling.
9. LOW and GAP flags are visually distinct from each other and never rely on
   color alone: pair color with an underline, icon, or hatching so
   color-blind users can tell them apart.
10. The free-plan export watermark is visible on every page of the exported
    PDF (R25). Never render it so faint, small, or cropped that it is
    effectively absent.
11. Every blocked action shows a clear, specific message (R31): what
    happened and what the user can do next. "Upload failed" alone is a
    failed task.
12. Every async pipeline state is visible: uploading, queued, processing,
    partial failure, done (R6), with per-image status in batches so a failed
    image is identifiable and re-uploadable (R5).
13. All interactive elements are keyboard-reachable with accessible names.
    Text meets WCAG AA contrast. When picking role pairings, use the
    on-color tokens (`on-primary`, `on-primary-container`, etc.) — they
    exist to guarantee the contrast pairing. A custom foreground on a role
    background that breaks AA is a failed task.
14. The app is responsive and usable at 360px width on a low-end phone. The
    primary persona uploads from a phone camera. A desktop-only flow is a
    failed task.

## GUIDANCE

- Default component recipe: `primary` for main actions, `on-primary` for
  their text, `*-container` roles for filled surfaces like cards and
  banners, `on-*-container` for text on them.
- Body text defaults to body-medium (14px); dense metadata uses body-small
  or label variants; page titles use headline variants. Display sizes are
  for marketing surfaces, not the app shell.
- Prefer `base-spacing` (16px) as the default gap and padding rhythm;
  step up or down the scale deliberately.
- The tight letterspacing in the type scale is part of the brand voice —
  do not override it per component.