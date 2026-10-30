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

## Primitives (decided in T-02, do not re-invent)

Eleven primitives exist: `Button, Field, Toggle, Card, Sheet, Toast, Tabs, EmptyState, Skeleton,
Avatar, Icons` in `src/components/`. **Their look lives in `src/styles.css`, not in scoped
`<style>` blocks.** Reason: a scoped block cannot reach into a child component, so a page could
never style a primitive it does not own (`.empty .btn`, `.card .avatar`, spacing the action inside
an `EmptyState`). One stylesheet keeps the set in sync; a page's own `<style>` block is for page
layout only. Class names: `.btn`, `.field`, `.toggle`, `.card`, `.avatar`, `.sheet`, `.toast`,
`.tabs`, `.empty`, `.skeleton`.

- **Live props.** A Ripple prop is evaluated once when the component is called, so anything a page
  will change (a field value, a toggle's state, a tab) is passed as a `Tracked<T>`/`Derived<T>` and
  read through `read()` in `src/lib/reactive.ts`. Plain strings are for static copy.
- **Button.** `primary` accent fill with `--color-accent-contrast` text, `secondary` 1px
  `--color-border-strong` outline, `ghost` for in-row actions, `danger` for destructive only.
  44px minimum, radius 2, 14px label. No loading spinner state: a busy button belongs to its page.
- **Field.** Label 12px uppercase `.08em` above the control, help line below, error line in
  `--color-danger` with `aria-invalid` + `aria-describedby`. Inputs/textarea 44px minimum, radius 2.
- **Toggle.** A 44px row, label left, 40×22 switch right, state in `aria-pressed` (a toggle button,
  not `role="switch"`). Used for Show NSFW / Blur NSFW only.
- **Card.** Structure only, and the three parts are separate elements because T-08's blur covers
  the middle: `.card-head` (title), `.card-middle` (avatar, tagline, tags), `.card-foot`
  (author + ratio). The tags row is absent — not empty — while the taxonomy is undecided.
- **Sheet.** Bottom sheet on mobile, centred dialog from `md` (900). Mounted inside `@if`, so there
  is no `open` prop. `Portal` to `document.body`, 6px radius, the one sanctioned shadow, 180ms
  `cubic-bezier(.2,.8,.2,1)`, scrim `rgb(0 0 0 / .35)`, Escape closes, Tab is trapped, focus lands
  on the panel. Focus is deferred until the portal has inserted the panel — a ref runs before
  insertion and `focus()` on a detached node does nothing.
- **Toast.** `toast(message)` from `src/lib/toast.ts` (a plain subscribe/notify store, because a
  module-scope `track()` has no owning block); `<ToastHost />` is mounted once in `App.tsrx`.
  **Placement: bottom, above the tab bar** (72px + safe area on mobile, 24px from `md`), 120ms, no
  bounce, polite live region, three at most, 3.4s each. No shadow — a toast is not a sheet.
- **Tabs.** Renders and calls back; it does **not** write the query string. The page owns the
  query (spec: tab state lives in the query string), so back/forward stays the page's business.
- **Skeleton.** `lines` / `block`, matching the shape of what it stands in for. No spinner anywhere.
- **Z-index ladder.** Overflow menu scrim 8 / menu 9 · sheet scrim 40 · sheet panel 41 · toast 60.
  Anything new that floats must pick a rung on this ladder rather than invent a number.
- **Dev gallery.** `/dev/primitives` renders every primitive at 360/640/900/1280 with a theme
  switch that writes `data-theme` on `<html>`. It is not a product route: absent from
  `src/specs/luaplot-pages.md`, absent from the tab bar, and `scripts/spec-routes.mjs` drops
  `/dev/*` before comparing. The sheet's dialog form follows the real viewport, not the stage width.
- **Data page.** `/dev/data` (T-03) is the second dev-only route: counts per entity, the fixture
  names per kind, and the `resolveRepo()` badge. It uses the real `Card`, `Skeleton` and
  `EmptyState` — it is the primitives' second proof, so it must never grow its own card look. The
  counts strip is a 1px-gap grid on `--color-border` (2-up at 360, 4-up at `sm`), and the mutation
  strip is the only control on any dev page that writes to the adapter.

## Do not

No emoji in UI chrome. No stock illustrations. No gradients on text. No shadows on flat cards.
No icon set sprawl — one 20px stroke set, inlined as components. No animation on scroll.
