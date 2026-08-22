---
name: ui-component-builder
description: Use this skill whenever building or editing anything a user sees. Triggers include component, screen, page, button, editor, reader, upload view, status display, colors, spacing, fonts, styling, or design system. Read it before styling anything, because the token discipline is the first thing agents break.
---

# UI Component Builder

The design system lives in design-tokens.tokens.json, compiled to CSS variables. The laws live in `design-system-rule.md`.

## Steps

1. Pick colors from semantic roles only: --color-roles-*. Never a --primitive-colors-* variable, never a raw hex (design-system-rule.md rules 2 and 3).
2. Pair roles with their on-colors: primary with on-primary, primary-container with on-primary-container. The pairs guarantee WCAG AA contrast (design-system-rule.md rule 13).
3. Take spacing from --spacing-collection-* (0, 4, 8, 12, 16, 20, 24, 32), type from the --typography-* scale, shadows from the three --effect-*-shadow values (design-system-rule.md rule 3).
4. When a token is missing (error, surface, and the two flag roles are known gaps): add the semantic token to design-tokens.tokens.json mapped onto an existing primitive palette, recompile, then use it. Never inline a hex "just for now" (design-system-rule.md rule 4). If the addition needs a taste call, flag it and wait.
5. Render transcription flags per the pattern below, visible without hovering (R18).
6. Show per-image status in every batch view: uploading, queued, processing, failed, done, with failed images individually re-uploadable (R5, R6, design-system-rule.md rule 12).
7. Render blocked messages exactly as the route sent them (R31). Never replace a specific message with a generic one.
8. Verify the component at 360px width and by keyboard (design-system-rule.md rules 13 and 14).

## Skeleton

Flag rendering, the pattern this product lives or dies on (R18, R19):

    <span className={flag.type === "LOW" ? "flag-low" : "flag-gap"}>
      {flag.type === "GAP" ? "…" : text.slice(flag.start, flag.end)}
    </span>

Rules of the rendering: LOW pairs its tint with a dotted underline, GAP renders as a hatched placeholder block, so the two differ by more than color (design-system-rule.md rule 9). Clicking a flag opens accept, edit, delete, with the original image alongside (R20). Resolving updates the resolved field through the route, never local-only state.

## Traps

- Grabbing the error primitive directly because no error role exists yet. Add the role first.
- A custom foreground on a role background that breaks AA. Use the on-color pairs.
- One spinner over a whole batch. Per-image status, always.
- Hover-only actions. The primary persona is on a phone.
- Hand-editing the generated CSS variables file. Changes go to the token source (design-system-rule.md rule 1).

## Verify before done

- [ ] Grep the diff for hex codes and px literals: none outside the token files
- [ ] No --primitive-colors-* usage
- [ ] Flags visible, distinguishable, not color-only
- [ ] Per-image status in any batch view
- [ ] Works at 360px; keyboard pass done
- [ ] Tests to write: flag spans render for LOW and GAP fixtures; resolve persists through the route; blocked message renders verbatim