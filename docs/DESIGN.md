# LuaPlot — design law

Derived from `LuaPlot.variables.json` and `src/styles.css` (already in the repo). This file stops
each session from re-inventing the look. Read it before touching a component.

## Direction

**Editorial terminal for fiction.** A writing tool that feels like a well-made instrument:
monospace everywhere, generous vertical rhythm, thin rules instead of boxes, one loud accent
used sparingly. Reference points: Are.na's restraint, Read.cv's typographic care, a good
terminal theme. Not: dashboards, glassmorphism, gradient blobs, emoji headers, purple-on-white
SaaS.

## Tokens (never hard-code a colour)

Catppuccin palette is already declared in `src/styles.css` as `--ctp-*`, with semantic aliases
(`--color-bg`, `--color-text`, `--color-accent`, `--color-border`, …). **App code uses the
semantic aliases only.** Flavours: Mocha (default dark), Latte, Frappé, Macchiato, switched by
`data-theme` on `<html>`; with no attribute the app follows `prefers-color-scheme`.

- Accent (`--ctp-mauve`) is for the one primary action per screen, active nav, and focus. Never
  for decoration.
- Surfaces: `--color-bg` page, `--color-bg-elevated` panels, `--color-surface` inputs and cards.
- Danger is `--ctp-red` and is only for destructive actions, moderation states, and errors.

## Type

- One family: JetBrains Mono Variable (`--font-body`). No second font, no serif accents.
- Scale: 12 / 13 / 14 / 16 / 20 / 26 / 34. Body is 14 on mobile, 15 at `md`. Long-form
  (character descriptions, lorebook entries, cut bodies) uses `line-height: 1.7`, max 68ch.
- Titles are `font-weight: 600`, never 700. Labels are 12px, uppercase, `letter-spacing: .08em`,
  `--color-text-subtle`.
- No text under 12px. No centred paragraphs.

## Space and shape

- 4px grid. Page gutter 16 mobile / 24 `sm` / 32 `lg`. Vertical rhythm in multiples of 8.
- Radius: 2px on inputs and buttons, 0 on rules and dividers, 6px on cards and sheets. Nothing
  is a pill except status chips.
- Borders: 1px `--color-border`. Shadows only on sheets/dialogs (`0 18px 40px rgb(0 0 0 / .35)`).
- Cards: title header, middle (avatar/tagline/tags), footer row (author + ratio). This structure
  is load-bearing for NSFW blur — keep the chrome outside the blurred middle.

## Motion

- 120ms for state changes, 180ms for sheets, `cubic-bezier(.2,.8,.2,1)`. Nothing bounces.
- One orchestrated entrance per page: content fades up 8px, staggered 40ms, capped at 6 items.
- Respect `prefers-reduced-motion`: everything collapses to opacity only.

## Layout law

Mobile (default, 360–639): single column, sticky top bar with back + title + overflow menu,
bottom tab bar for the 5 destinations (Home, Thread, Catalog, Notifications, Profile). Content
scrolls under the bar with `padding-bottom: env(safe-area-inset-bottom)`.

`sm` 640–899: two-column catalogue grid, tab bar stays.

`md` 900–1199: sidebar rail appears (icon + label), bottom bar goes.

`lg` 1200+: fixed 240px sidebar, content max-width 1120, detail pages become two columns
(main + 320px aside for author/engagement/attached items).

Every listing: toolbar (search, filter, sort, NSFW toggles) → grid → `Load more`. `Load more` is
a button, never infinite scroll. Paging lives in component state, filters in the query string.

## States (design them, do not leave them to chance)

Loading = skeleton matching the final layout, never a spinner. Empty = one line of copy + the
primary action. No-results = the query echoed back + Clear. Error = what failed + Retry. NSFW
blur = middle covered, footer numbers visible, per-item Reveal.

## Shell (decided in T-01, do not re-invent)

- Top bar 56px: 44×44 back and overflow targets, title 13px/600, current path as a 12px
  `--color-text-subtle` crumb at `lg` only. No glass, no blur, no shadow on the bar.
- Mobile tab bar 60px + safe area: Home, Thread, Catalog, **Alerts**, Profile. The inbox page is
  titled *Notifications*; the tab reads *Alerts* because five 12px labels must fit a 72px cell at
  360. Never shorten the other four.
- Active destination: `--color-accent` on icon and label, plus a 20×2px accent tick above the icon
  (mobile / rail) or a 2px accent bar on the left edge (`lg`). The 1200+ sidebar is 240px, the rail
  at `md` is 84px icon-over-label.
- Overflow menu (top right) holds Bookmarks, Moderation, Terms — app-level destinations that are
  not in the tab bar. It is a 6px sheet with the one sanctioned shadow; the scrim is invisible.
- Content outlet: 16/24/32 gutters, capped at 720px until `lg`, then 1120px.
- Placeholder pages (until their ticket lands): spec path as a 12px kicker, 26/34px title, the
  spec's one-line summary, a hairline rule, then `Not built yet.` in `--color-text-subtle`.
- Icons: 20px, 1.5 stroke, `currentColor`, `stroke-linecap: round`, declared once as `.ico` in
  `src/styles.css` and inlined in `src/components/Icons.tsrx`.

## Do not

No emoji in UI chrome. No stock illustrations. No gradients on text. No shadows on flat cards.
No icon set sprawl — one 20px stroke set, inlined as components. No animation on scroll.
