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
- **State page.** `/dev/state` (T-04) is the third dev-only route: who is signed in, the NSFW pair
  as two real `Toggle`s, and a count of how many times each store has notified (a silent store and
  a wired one look identical otherwise). Same chrome as `/dev/data` — kicker, 26px title, lede,
  badge row, 1px-gap count strip — because a dev page that invents its own look stops being
  evidence.
- **Dev block in the overflow menu.** The menu keeps its three product destinations, then a hairline
  and a **Preview only · not a product control** block: the sign-in/sign-out switch, one line of
  NSFW state read as a sentence (*listed, blurred* / *hidden from listings* / *off (signed out)*),
  and a link to `/dev/state`. 12px `--color-text-subtle`, no accent; it exists so a reviewer can
  flip the signed-out states in two taps, and it disappears the moment T-30 brings real auth.

## Home (decided in T-05, do not re-invent)

- `/` is a **title page, not a landing page**: kicker (12px, `.12em`, `--color-text-subtle`) →
  wordmark 34px/600 (`-0.035em`, 44px at `lg`) → one paragraph → hairline → a `session ·` reading →
  one control. Nothing else. No hero, no feature rows, no second link (the overflow menu owns Terms).
- **The block is vertically centred** in the content area, not split into a top block and a control
  pinned to the bottom: `space-between` at 360×740 leaves a 240px hole in the middle that reads as a
  failed load. Optical centring (the block lands a few px high) is deliberate.
- **Measure:** the paragraph is 44ch and left-aligned; the whole column is 560px at `lg`, centred in
  the 1120 outlet. At 900–1199 the column is the full 720 outlet — the paragraph still holds 44ch,
  so the ragged edge does not stretch.
- **Entry row:** full-width `btn btn-primary` at 360 (thumb-reach), a left reading + right control
  from `sm`. The control is an `<a class="btn btn-primary">`, never a `Button` — a `<button>` cannot
  carry `href`, and the spec's entry control navigates.
- **Zero scroll on the first screen** is bought with
  `min-height: calc(100dvh - <chrome>)`: 228 (56 top bar + 60 tab bar + 60 scroller clearance + 52
  outlet padding) / 240 at `sm` (64 outlet padding) / 132 at `md` (no tab bar) / 144 at `lg`. That
  arithmetic mirrors `App.tsrx` and breaks silently if the bars change — re-measure
  `scrollHeight == clientHeight` at 360×740 whenever the shell moves.
- Copy is spec-grounded and names only what exists: characters, lorebooks, sessions, cuts. No
  marketing sentence, no counts, no "trusted by".

## Auth (decided in T-06, do not re-invent)

`authentification.md` leaves Layout `_To be specified_`; these are the decisions, so `/onboarding` and
`/terms` extend the same entry sequence instead of inventing a second one.

- **The same title page as `/`.** Kicker (`a writing room for fiction`) → wordmark → one 44ch
  paragraph → hairline → controls. Same type sizes, same chrome arithmetic (228 / 240 / 132 / 144),
  same `justify-content: center`. Only the paragraph and what sits under the rule change: the two
  entry screens are one sequence, not two designs. `space-between` is still banned here.
- **Three equal `secondary` buttons, stacked.** No `primary` — three providers are three equal
  choices and the accent belongs to the one action per screen. `block` at 360 for thumb reach; from
  `sm` the group is capped at **420px** so 640 never renders a 592px-wide button. The rules above and
  below keep spanning the whole column (a rule wider than the measure is home's look). Never a row
  of three: `Continue with Google` at 14px mono does not fit three-up in a 560 column.
- **Provider names are text.** No brand marks exist and there is one 20px stroke icon set, so the
  labels are `Continue with Google` / `GitHub` / `Discord` — the product name never appears in them.
- **One status row, height reserved.** `.status` is a 20px flex row when idle (empty, transparent
  text) and grows to the retry button's 44 when there is one. Reserving it means a state change does
  not re-centre the page; a two-line error wraps *inside* the 44 band instead of pushing the page
  into a scroll at 360×740.
- **One `track<AuthStatus>`**, a union of `idle | redirecting | cancelled | failed`; `busy`,
  `message`, `tone`, `retryProvider`, `retryLabel` are derived from it. No scattered booleans.
- **Redirecting**: all three buttons disabled (one attempt at a time), the pressed one keeps its
  label, and the line below reads `Redirecting to Google…` at 12px. No spinner — nothing spins.
- **Cancelled** is `--color-text-muted` (`Google sign-in was cancelled.`). **Failed** is
  `--color-danger` with `Try again` in the same row, `flex: none`, `aria-label="Try again with
  GitHub"`, retrying the provider that failed rather than asking again.
- **Onboarding is a footer line, not a state.** `New account? Continue to onboarding` at 12px,
  `--color-text-muted`, underlined, 44px tap box. Only T-30's matrix knows who is incomplete, so the
  page links the route instead of pretending to gate it.
- **Preview line** under the controls: `Preview — no provider is contacted.` 12px
  `--color-text-subtle`, full stop included. Not the T-16 `Preview mode` chip.
- **A signed-in visitor is not redirected away**, though the spec's Access line says so: that matrix
  is T-30 and `session.ts` ships seeded signed in, so an eager redirect would make the page
  unreachable in the preview.
- **Seam:** `src/lib/auth.ts` — `signInWithProvider(provider): Promise<AuthOutcome>`,
  `AuthOutcome = { redirecting } | { cancelled } | { failed; reason }`. No `ok` (success is a browser
  redirect, not a value) and no `session.signIn()` call. The stub's outcome is switched by
  `?auth=cancelled|failed|redirecting` — **preview only, deleted with the stub**.
- **Live `disabled` takes the derived, not the value.** `Button` accepts `boolean |
  Derived<boolean>` and reads it inside its own render; `disabled={busy.value}` froze the buttons
  enabled because a prop expression is evaluated once at the call. `Field.disabled` and
  `Toggle.disabled` still take a plain boolean — same trap, unfixed on purpose.

## Onboarding (decided in T-07, do not re-invent)

`onboarding.md` also leaves Layout `_To be specified_`, and it is the repo's first **form page**.
These are the decisions, so every later form (`/character/create`, `/user/edit`) extends them
instead of inventing a second answer.

- **A form page, not a title page.** The shell's top bar already says *Onboarding*, so a 34px
  wordmark underneath would read as a second marketing screen. The page opens with the 12px kicker
  (`first run`), a 26px / 34px `lg` title, one 52ch line of copy, a hairline, then the form. Same
  rule + spacing language as `/` and `/authentification` — the entry sequence shares one column
  (560px at `lg`, centred in the 1120 outlet).
- **Order inside the form:** username → display name → hairline → `nsfw content` caption → Show →
  Blur → `Finish`. The second rule is the only thing that separates "required" from "optional";
  there is no box, no card, no legend.
- **`Finish` is the last element in the column, never pinned.** It is `btn-primary btn-block` at
  360 (thumb reach, 328×44) and a left-aligned 200px minimum from `sm`, where a line of note sits
  beside it. The page scrolls (five rows do not fit 360×740) and the shell's 60px tab-bar
  clearance + outlet padding keeps the button clear of the bar: measured at 360×740 the scroller
  scrolls 277px and `Finish` lands at y 477–521 against a bar top of 680. Nothing on this page is
  fixed or sticky, so the phone keyboard cannot cover a field — it is all in flow.
- **The rule is the help line until it is the error.** `Field.help` carries the factual format line
  (`Lowercase letters, digits and underscores, 3–24 characters.`) and it is *removed* when the same
  sentence becomes the inline error, because a red line repeating the grey line above it reads as a
  rendering bug. Errors appear once a field has settled (the 250ms debounce), never on the first
  keystroke; the taken copy is the spec's verbatim `Username taken`.
- **Uniqueness is asked, not remembered.** A verdict carries the handle it is about, so a stale
  answer can never disable `Finish` for a different value. `Finish` is enabled only for a settled,
  format-valid handle the adapter has answered *free*, plus a non-empty display name.
- **Draft persistence: one debounced `saveProfile` + `savePreferences`.** The same 250ms settle
  that runs the uniqueness check writes the draft, and only for a form that could actually be
  finished (a two-character handle is never written as the account's profile — otherwise a draft
  could claim a handle by accident). `Finish` is the same write, then `setAccount`, then
  `/user/<handle>`. Reloading the preview still empties the form, because the memory adapter is the
  only row that exists; nothing fakes persistence with `localStorage`.
- **The NSFW pair is the store's, not the page's.** Both toggles read `lib/state/prefs.ts` and write
  through `setShowNsfw` / `setBlurNsfw`; the finished form writes the pair under the *saved* handle
  before `setAccount` switches the session, so the store's re-read on session change finds the same
  values instead of flashing off.
- **`Field.error` is live.** T-02 froze `invalid` at mount (`const invalid = read(error)`), so a
  dynamic error line updated while the border and `aria-invalid` stayed stale. T-07 makes it a
  `Derived` like `Button.disabled`. `Toggle.disabled` is still a plain boolean — same trap, unfixed
  until a page needs a live one.
- **No prefill in the preview.** The spec prefills the display name from the provider; the mock
  account ships the literal `You`, which is not a provider label, so only a saved draft prefills.
  T-30 replaces that line with `currentUser()?.displayName`.
- **Signed-out visitors are not redirected.** `access: "onboarding"` is declarative; the matrix is
  T-30, and an eager redirect would make the page unreachable from `/authentification`'s footer
  link in the preview.

## Do not

No emoji in UI chrome. No stock illustrations. No gradients on text. No shadows on flat cards.
No icon set sprawl — one 20px stroke set, inlined as components. No animation on scroll.
