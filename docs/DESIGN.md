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

Thirteen primitives exist: `Button, Field, Select, TagPicker, Toggle, Card, Sheet, Toast, Tabs,
EmptyState, Skeleton, Avatar, Icons` in `src/components/`. **Their look lives in `src/styles.css`,
not in scoped `<style>` blocks.** Reason: a scoped block cannot reach into a child component, so a page could
never style a primitive it does not own (`.empty .btn`, `.card .avatar`, spacing the action inside
an `EmptyState`). One stylesheet keeps the set in sync; a page's own `<style>` block is for page
layout only. Class names: `.btn`, `.field`, `.select`, `.tagpicker`, `.toggle`, `.card`, `.avatar`, `.sheet`,
`.toast`, `.tabs`, `.empty`, `.skeleton`. The tag dropdown picks rung **10** on the z-ladder (above
cards, below the shell's overflow menu) and its chips are 28px inside a 44px field — the one
sanctioned sub-44 target, because a token chip is a label with a corner, not a standalone action.

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

## Card and grid (decided in T-08, do not re-invent)

`Card` now takes **the entity** (`Character | Lorebook | Preset`, the `AuthoredItem` union) plus one
flag, and draws the three parts it always had. Five later tickets are this component in another
list, so the decisions below are the ones they inherit.

- **Posts do not ride this card.** The union stays `AuthoredItem`; a post has no `name`/`tagline` and
  gets its own `PostCard` (T-13, `DESIGN.md` → *Thread*). A card whose title slot is empty is a card
  that reads broken, and a post branch here would put the timeline's shape inside the catalogue's.
- **The prop is the item, not eight fields.** `name`, `tagline`, `tags`, `avatar.initials`,
  `author` and the counts all come from the schema, so the card renders `ratioOf(item)` and can never
  be handed a stored percentage. Title link is `href('/<kind>/<id>')` (via `href()`), author link is
  `/user/<handle>`, both real anchors — no clickable `<div>`. `post` is **not** in the union yet: its
  body and missing `name`/`tagline` need their own header, and T-13 owns that.
- **`nsfw` means "draw the cover", not "the item is flagged".** The listing computes the effective
  flag (`item.nsfw && prefs.blur`) and hands it over; the card never imports
  `lib/state/prefs.ts`. Show-off is the listing's job too — the card is never rendered for it.
- **Item pages show the avatar as a cover** (T-12 follow-up, owner's call): `Avatar size="hero"` emits no
  inline box and `.avatar.is-hero` gives it `width: 100%; aspect-ratio: 1/1` with the initials drawn as a
  **monogram**, `clamp(56px, 24vw, 112px)` at weight 500, on a two-stop `155deg` gradient of
  `--color-surface-hover → --color-surface → --color-bg-elevated`. At cover scale a 13px label in a 320px
  square reads as a placeholder that failed to load; the monogram and the gradient are what make the box
  look deliberate while there is no image set. The page owns the column — full content width on a phone, a
  fixed 320px column from `sm`, with the name and the settings button beside it — because a cover's size is
  a layout decision, not a primitive's. **Square means square at every width**: never a 56px circle again,
  and never a cropped rectangle, since there is no image set yet to crop and the initials must fit the box.
  The page's `.head` is a grid, and **every base placement rule is declared before the `@media` block**:
  same specificity, so a base rule written after the query wins at every width — that is exactly how the
  name ended up under the cover on desktop for one tick.
- **The thumbnail is a third of the card, square** (T-09, owner's call): `Avatar` takes
  `size="fluid"` and `.card-veil .avatar.is-fluid` gives it `width: 33%; aspect-ratio: 1/1` with a
  22px initial (18px from `md`). It is a stylesheet rule, not a `size` prop, because the box has to
  follow the card's own width; the tagline and the tag row share the remaining two thirds.
- **Blur is structural**: the veil (avatar + tagline + tags) gets `filter: blur(6px)`; the scrim is a
  **sibling** layer `.card-cover` over `.card-middle` at
  `color-mix(in srgb, var(--color-bg) 55%, transparent)`, and the `Reveal` `ghost` button sits in it
  at bottom-left, 44px tall. That is why the control stays clickable and unblurred: it is outside the
  filtered node. Both values are local custom properties on `.card` (`--card-blur`, `--card-scrim`,
  not global tokens) so a post/comment card can reuse them by name without a second value.
- **The header and footer never move.** `.card-foot` carries author + ratio at full contrast — no
  `opacity`, no filter, no scrim over it (spec: *the numbers are never hidden*). Verify it as
  `getComputedStyle(foot).filter === 'none'` on a covered card.
- **Reveal is the glance, the preference is the account.** `revealed = track(false)` is created
  *inside* the card (a prop expression is evaluated once, so it cannot be passed in), the cover is
  `@if (covered)` so revealing removes the button rather than dimming it, and the state dies with
  the mount — a re-sort remounts keyed `@for` rows and re-blurs. That is *a reveal lasts one view*,
  not a bug.
- **Focus order on a covered card is title → `Reveal` → author.** Document order follows the parts,
  and the title is safe to reach first because the header is crisp and legible; nothing inside the
  blurred veil is focusable (the veil carries `aria-hidden` while covered). A covered card is one
  extra Tab from its title, and the Reveal is never inside the blur.
- **Grid: a gutter grid, not the 1px-gap count strip.** `CardGrid` is a `<ul class="card-grid">` of
  `li.card-cell`, cards keep their own 1px border and 6px radius: gap 12px at 360, 16px from `sm`,
  20px at `lg`; columns 1 / 2 / 3 / 4 at 360 / 640 / 900 / 1200. The count-strip gesture needs square
  corners and the design law keeps cards at 6px, so it was rejected. Cells stretch to equal height
  (`li` flex, `.card` flex: 1) so a two-line tagline does not leave a ragged grid.
- **The grid owns the pref, the card owns the drawing.** `CardGrid` takes `blurNsfw` (the account's
  Blur preference, read by the page from the store) and ANDs it with each item's own flag. With Blur
  off a flagged item draws crisp; with it on, each flagged card keeps its own Reveal.
- **Proved on `/dev/primitives`**, against real fixtures: a SFW card, the flagged fixture covered
  pre-reveal, the same card one click later, the longest title and the longest tagline (spreads of a
  real character, so they still satisfy `Character`). The grid section sits **outside** the
  fixed-width stage, because its columns follow the viewport and a 360px stage would only ever prove
  the phone case. `/dev/data` renders the same card through the same component.

## Catalog (decided in T-09, do not re-invent)

`/character/catalog` is the first real host of the grid and the first listing that reads the NSFW
pair. The lorebook, preset, thread, bookmark and profile listings are this page with another entity,
so these are the decisions they inherit.

- **One phase union, not a shoal of booleans.** `phase: loading | ready | error` plus two derived
  predicates — `visible` (Show off filters the flagged rows out) and `searching` (a settled query) —
  produce all six states. A page that tracked `loading` and `hasError` separately would eventually
  render both.
- **Sort offers `Newest` and `Top rated`, through a `Select`.** The spec says *Sort* without naming
  options; these are the two `repo.SortOrder` already supports meaningfully for a listing (`ratio` =
  like share). It is a **native `<select>`** wearing the app's chrome (T-09, revised after a phone
  screenshot): a segmented row only ever grew sideways, and a selector is the one control every phone
  picker already drives. `Select` is a primitive now, so the profile's type filter and every later
  enumeration reuse it instead of inventing a third control language.
- **The filter is a tag field, and empty means `All`.** `TagPicker` (T-09, revised): the chosen tags
  live *inside* the field as chips with their own remove controls, typing narrows a dropdown of the
  tags actually in use (`repo.listTags`), and picking one keeps the field focused so several can be
  chosen in a row. Two tags match items carrying **either** — an all-of filter empties a small
  catalog on the second click. There is no separate `All` control: it is the empty state of this
  one, which is why the toolbar carries four rows and no chip.
- **The listing writes its own URL.** `writeQuery()` uses `replaceState` for the search settle and
  `pushState` for a sort, and never `navigate()`: `App.tsrx` reloads the page module whenever
  `path + search` changes, so a debounced keystroke would remount the page and drop the accumulated
  rows. Back/forward still remounts, and the page reads `useQuery()` at mount — which is exactly when
  it wants to.
- **`q` belongs to the shareable view**, although the spec's URL section names only filter and sort:
  a search *is* a narrowed view, and a searchable listing whose search cannot be shared is a bug with
  a link on it.
- **Paging is state, 24 at a time, and any new query or sort resets it.** `Load more` is a button; the
  `End of the list.` line appears only once a full page has been loaded, so a short list carries no
  editorial note about nothing.
- **Show off filters after the fetch, so a slice can be entirely hidden.** `fillIfBlank()` pulls the
  next page while nothing is visible — that is what stops "No results" from lying about an empty
  search.
- **Live props, three times over.** `CardGrid.items` and `CardGrid.blurNsfw` accept `Derived<…>` and
  are read inside the template, because a prop expression is evaluated once: a frozen array would
  never append and a frozen flag would never cover. **This amends T-08:** `Card` now takes `nsfw`
  (the item's own flag) *and* `blur` (the listing's live preference) and ANDs them itself — a
  per-item derived created inside the grid's keyed loop rendered nothing at all in ripple 0.4.7. The
  card still never imports `lib/state/prefs.ts`: it is handed a flag, not an opinion.
- **A page's scoped `<style>` cannot touch a primitive's elements.** `.toolbar .field`,
  `.prefs .toggle` and `.pager .btn` silently matched nothing — the search box collapsed into the
  narrow `auto` grid column and "Top rated" wrapped onto two lines on a real phone. Wrap the
  primitive in a **page-owned element** (`.search`, `.prefs`, `.pager-action`) and place or size that
  instead; primitives' own look stays in `styles.css` where it always was.
- **Chrome budget.** The toolbar is four rows, all full width on a phone: **search**, **tags**,
  **sort**, then the two switches. The lede is hidden below `sm` (kicker plus the search placeholder
  carry the meaning). Measured: at 390×844 the grid starts at 498 and the first card ends at 673,
  well clear of the 784 tab bar; at 360×740 it starts at 514 and ends at 690 against a bar top of
  680 — the card's last few pixels ride under the bar until the first scroll, which is what the
  60px content clearance is for. From `sm` the two fields keep the full width and sort sits beside
  the switches; from `md` the grid is `1fr 220px 1fr` so sort keeps a fixed 220px. The toolbar is
  **not sticky**: a 56px shell bar plus a sticky toolbar would leave a third of a phone for content.

## Character detail (decided in T-10, do not re-invent)

`/character/[character.id]` is the product's first detail page, and the lorebook/preset/post detail
pages are this page with another entity. The spec leaves its Layout *to be specified*; these are the
decisions, and T-10 recorded them here rather than in a comment nobody reads.

- **The settings menu lives in the page's own header row.** A 44px `IconMore` button at the top right
  of the identity block opens a `Sheet` (bottom sheet at 360, centred dialog from 900) of 44px rows:
  **New session**, **Bookmark / Remove bookmark**, **Report**, and **Edit** for the owner. This is a
  *second* menu on one screen — the shell's overflow already holds Bookmarks, Moderation, Terms and
  the preview switch — and the split is deliberate: the shell menu is app-level destinations, this
  one acts on *this* character. **An entry whose target lands later is drawn and `disabled`**, never
  wired to a write that does not exist: Report waited for T-12's dialog, so the menu was complete
  without a control that lied. **Report is wired now** and is absent, not disabled, while signed out
  (`components/report.md` → States): it closes this menu and opens the dialog as its **sibling**, so
  two sheets never share the z-ladder.
- **Counts are one row of four at 360** — likes, dislikes, ratio, comments — in the count-strip
  gesture (1px gap on `--color-border`, square corners). Four cells fit a 328px column at 12px
  labels, so a two-row split would only add a break to read across. The ratio is a percentage from
  `percent(ratioOf(item))`; the raw counts sit beside it because the detail page is where counts
  live, while a card keeps only the percentage (`luaplot-pages.md`).
- **Engagement comes before the definition on a phone.** `.cols` is a flex column below `lg` with the
  aside ordered first: header → byline → counts → vote/bookmark → definition → lorebooks. A reader
  who has to scroll a whole description to find **Like** does not find it. At `lg` the same two
  blocks become `minmax(0,1fr) 320px`, main left, aside right, both starting at the same y.
- **The aside carries counts and actions only; attached lorebooks stay in the main column** at every
  width. An attachment list is part of the definition (`detail.md` → *Attached lorebooks*: the full
  list, each a link), not metadata about it, so it does not move into a sidebar — this is the rule
  every later detail page inherits.
- **The veil covers the tagline and the description, nothing else.** On a Show-off route the body is
  blurred 6px behind the same sibling scrim + 44px `Reveal` a covered card uses; the header (name,
  kicker, in-session line, settings), the byline, the counts, the actions and the lorebook list stay
  crisp — *the numbers are never hidden*, and a blurred link list is a list nobody can click.
  `covered` is `nsfw && !show && !revealed`: **Blur is a listing preference** and this route is where
  the body gets read, so Blur on does not cover it. Signed out, Show is off, so a flagged row arrives
  covered behind its Reveal — the route still resolves (`nsfw.md`: never a 404).
- **Two refusal states, one line each, both with a way back.** Not found: `This character doesn't
  exist.`; private and not the viewer's: `This character isn't available.` No reason, no case number,
  no author — the moderation story is the owner's, and the owner sees it as a notice instead.
- **The owner's notice is a panel, not a dialog**: a 2px `--color-danger` left rule, the case
  sentence, every reason as `part · reason — details`, then the measure in JEV's terms. It sits
  between the byline and the engagement row so the page cannot be read as merely private-by-choice.
  **Request public again** is absent (no adapter method); the notice's last line says editing is the
  way, which is true of the product even while the control is unbuilt.
- **One live value per drawn field.** The page holds a `track()` per thing it draws (`likes`,
  `tagline`, `bookmarked`, …) instead of one nullable entity read in the template: a prop expression
  is evaluated once, and ripple 0.4.7 loses a `null` check across a branch, so a nullable entity in
  the template is a page that renders nothing the day the branch moves.

### Start / Continue and Fork (decided in T-10B)

- **One primary action, on its own row at 360.** The action row already carried Like / Dislike /
  Bookmark at 44px; a fourth control in that row squeezed all four under the target, so **Start a
  session / Continue** takes a full-width row first and joins the row from `sm`, where 162 + 3×132
  plus the gaps fills the 582px row exactly. It is the only `btn-primary` on the screen — the
  accent has one user. The wrapper `.start` is a grid because a page cannot style the primitive's
  `.btn` (T-09's trap): the wrapper is placed, the button stretches inside it.
- **Its label is the adapter's answer.** `repo.findSessionForCharacter(characterId, viewer)` →
  `null` reads *Start a session*, a row reads *Continue*. The page holds one `track()` for the
  session id and derives the label from it, so the word follows the write; Continue opens the
  session the adapter returned, never a guess about which one is newest.
- **A second session is deliberate.** **New session** in the settings menu calls the same
  `createSession`, which always appends fresh copies; the primary control is what refuses to start
  one by accident. That split is the spec's own (`character/detail.md`: *a second one is started
  deliberately, from the settings menu*), so the "one session per character per user" rule lives in
  the control rather than in a write that would make the menu entry a lie.
- **The preset has no picker yet** (`character/detail.md` says *the chosen preset*): the copy takes
  the viewer's own most recently updated preset, falling back to the newest public one. The persona
  is their default, else the first of theirs, else **absent** — an unattributed session, which
  `sessionSchema.personaId` allows because the spec says an account with no persona *is not
  prompted and not blocked*.
- **Fork lives in the settings menu and is absent while the row is private.** Save publishes
  (`character/create.md` — no draft state), so forking a privated row would republish exactly what
  moderation removed; `repo.forkCharacter` refuses it too, because `getCharacter` answers any id.
  The fork lands on its own detail route with the definition and the in-session name carried,
  `lorebookIds` still references (filtered to what the forker can see), engagement zeroed and
  `verified` cleared.
- **Continue and New session land on `/session/[id]`, still T-15's placeholder.** The write and the
  label are real; the transcript screen is not built, and this note is the honest half.

## Comments (decided in T-11, do not re-invent)

`src/components/CommentThread.tsrx` is shared by four detail pages, so nothing in it may be
character-specific: it takes the item id and the viewer's handle and owns the thread's whole surface.

- **The composer sits at the top of the thread**, in a 16px inset panel (`--color-bg-elevated`, 1px
  `--color-border`, 6px radius) under a 12px uppercase label — *Add a comment*, or *Reply to @handle*
  once a reply is targeted. It is inside the component because the spec puts it at the top of the
  thread on every page that mounts it.
- **One composer, retargeted.** A **Reply** control on any row points that same composer at the
  comment, adds a 44px **Cancel** beside the label, and scrolls the composer into view. The flatten
  rule means a reply *to a reply* still indents at the third level, so an inline third-level composer
  would have nowhere to go; at depth three the control reads **Reply** like every other row and the
  new row lands one indent deeper, which is where the spec puts it.
- **The NSFW flag is a native checkbox in a 44px row** (`.flag`, 18px box, `accent-color` the accent),
  not the `Toggle` primitive — that primitive is reserved for the two NSFW preferences, and the
  composer needs a field-level control, not a preference switch. Label: `NSFW`. Default SFW, and it is
  the comment's own flag, never the item's.
- **`Post comment` is the only primary here** and sits in a page-owned `.post` wrapper (a page — and a
  component — cannot style the primitive's `.btn`). It is disabled while empty or in flight; the error
  line under the field is the schema's own message.
- **Indentation is 16px per level at 360 and 24px from `sm`**, on the row's `--depth` custom property,
  so three levels cost 48px of a 328px column and the body stays readable. A placeholder indents at its
  own depth like any other row.
- **Placeholders keep the shape and lose the actions**: header (24px avatar, `@handle`, `<time>`), the
  sentence *This comment was deleted.* / *This comment was removed by moderation.* in 13px italic
  `--color-text-subtle` in place of the body, and a footer carrying only the reply count. A comment
  with nothing beneath it is dropped from the model, so it never draws at all.
- **Collapsing is a reply list's rule**: more than three replies under one comment shows three and a
  single 44px text button *Show N more replies* (singular *reply* at 1) at the children's indent. A
  thread's own roots are never cut. Expanding is one-way within the mount.
- **A comment's NSFW covers its body only** — 6px blur on `.row-body`, sibling scrim, 44px `Reveal`,
  header and footer crisp. The account's **Show** decides (Blur is a listing preference); an
  anchored row is marked with a 1px accent left rule and `scroll-margin-top: 72px` under the top bar.
- **Delete is two taps** on the author's own row: `Delete` → `Confirm delete` / `Cancel`. The adapter
  refuses another account's row, and the row it returns is already the placeholder — the page never
  fakes one.
- **The count strip's `Comments` cell is the thread's own number** (`onCount`), set from the item on
  load and re-read after every write, so the cell and the rows cannot disagree.
- **Report is the footer's last action**, after Reply and after Delete's pair, drawn only while signed in
  and only on a live row (a placeholder has no actions). It opens T-12's dialog with the comment as its
  target and changes nothing on the page: a report is not a delete, and the row stays where it is until a
  verdict is certain.

## Session surface (decided in T-15, do not re-invent)

`/session/[id]` is the one **immersive** route: `App.tsrx` holds one predicate
(`/^\/session\//`) that hides the shell's top bar, tab bar and rail, and the page owns the viewport.
The page is a three-row column — header, scrolling transcript, docked composer — with no page title
block and no cards.

- **Header**: 44px **back**, the character's **32px square avatar** (link), the in-session name, the
  persona line as the control that switches it, and **settings**. Blurred, hairline bottom border, no
  shadow and no accent.
- **Composer**: one field — a 22px-radius pill that grows to 160px, a 44px round accent **Send** with an
  up-arrow, `Enter` sends, `Shift+Enter` breaks. It is a **native `textarea` + a ref, not `Field`**: the
  label-and-box field belongs in forms, and a native element's `onInput` hands Ripple an event whose
  target is not the box, while `value={tracked}` stringifies to `[object Object]`. Read the ref, clear
  the ref.
- **Column**: the transcript and the composer share one **A4** cap (794px, 210mm at 96dpi) on a desktop
  and take the full width on a phone. The same cap is the shell outlet's, so no page invents a width.
- **Publish a cut** is 11px text beneath the field, never a second filled button: the accent on this
  screen belongs to Send.

## Report dialog (decided in T-12, do not re-invent)

`src/components/ReportDialog.tsrx` is one component for every surface (`components/report.md`). T-12
mounts it twice — the character menu and a comment's footer — and **lorebook/preset/post detail get the
same dialog by mounting it, not by a second flow**; a post's attachment has no part yet (see below).

- **A `Sheet` with a four-stop stepper**, the spec's own action order: *what* → *reason* → *source*
  (copy claims only) → *details* (optional) → **Submit report**. Each stop is one question; nothing is
  asked twice.
- **Choices are 44px rows**, a 1px `--color-border` box with a 2px lead, `--color-bg-elevated` behind,
  and `aria-pressed` carrying the selection — the accent border and a tick in the corner mark every one
  in force. Not radio inputs, and no longer single-select: **both stops are toggles** (the owner's call
  after the first build), because an item can be reported for its image *and* its text, for several
  reasons, in one report. One report, one weight.
- **The stepper's order is the dialog's; the rules are the schema's.** The submit parses
  `reportWriteSchema` and prints its first issue, so the inline line, the adapter's refusal and the
  stored reason are one string. A missing part or reason sends the reader back to that stop.
- **The reason list comes from `REPORT_REASONS_BY_PART` in `schema.ts`** — one table, keyed by part, so
  the window can never offer a code the queue has no rendering for. The dialog draws the **union** of
  what the chosen surfaces allow (`reasonFitsPart`, the same helper the write's `superRefine` uses), and
  deselecting a surface drops the reasons that no longer fit one — so the visible list and the accepted
  write can never disagree.
- **Which parts a target offers is `PARTS_BY_KIND`.** Character / lorebook / preset offer *Avatar or
  image* and *Text*; a comment offers *Text* only. **A post offers text only for now**: a copied post
  image is not an avatar, and `reportPartSchema` has no attachment value — T-14 decides that, and adding
  a part to the schema is a spec question, not a dialog one.
- **`myReport` is read when the dialog opens**, not on submit. *Already reported* then survives a
  remount, and a report on already-verified content — which opens no case at all — is still found. The
  record draws what was filed: the surfaces (`Avatar or image + Text`) · the reasons · the filed date,
  the source line if any, the note if any, and
  the one sentence *One report per item, and a report cannot be withdrawn.* **No second submit.**
- **A copy claim gets a source field**, a plain text input holding the item id or an outside link —
  **a field, not a picker**, because the adapter only needs the string and a picker would turn a report
  into a search. Recorded here so the picker is a product decision, not a drift.
- **The confirmation is the spec's, and never an outcome.** Submitted: *Report submitted. / It is on file.
  You will not see an outcome here.* Already verified: *Report recorded and held. / A review starts once
  the content changes.* — never "we are looking at it now". No verdict, no case id, no queue position.
- **The target is named at the top** (`Reporting a character` / `Reporting a comment`, then the label),
  because a sheet covers the page it came from.
- **Foot: primary on top at 360, Back and Cancel beneath it; one row from `sm`** with the primary right
  and the secondaries left. The primary is the only accent fill; *Submitting…* is its disabled label.
- **Failure** is one line in `--color-danger` under the last stop (*That report couldn't be filed.*) and
  the form keeps everything typed. Loading is a two-line `Skeleton` while `myReport` answers.

## Thread (decided in T-13, do not re-invent)

`/post/thread` is the first feed of **posts**, and it is where the post card lives. `thread.md` fixes
the card's parts and the loads; these are the choices the spec left open.

- **Posts are not catalogue cards.** `PostCard` shares `.card`'s box — border, radius, surface — and
  nothing else: a post has no `name` and no `tagline`, so a `Card` with an empty title slot would read
  as broken. `Card` takes the `AuthoredItem` union and **must not grow a post branch**; T-14's detail
  page and T-30's profile reuse `PostCard` instead. The two cards share `--card-blur` / `--card-scrim`
  so a covered post and a covered character blur by the same amount.
- **The control row is one row from `sm` and three on a phone**: sort, then the filter chip beside
  **Create**, then the two switches. A labelled `Select` (~66px tall), a chip, two switches and a
  button cannot share 328px, and an `auto` column sized by a long caption starves its neighbours
  (T-09's search box). The `sm` grid is `200px auto 1fr auto`; `md` widens the sort to 220px.
- **The filter is a chip, not a `Select`.** `All` is the only value the taxonomy allows
  (`repo.listTags("post")` answers `[]`), so the control is drawn at 13px in a 1px border and is not
  focusable: a one-option select is a dropdown that cannot change anything. When posts gain tags, the
  chip becomes the catalogue's `TagPicker` and this bullet is rewritten.
- **Sort is a discrete choice, so it is a history entry** (`pushState`), and `newest` is written out
  of the URL: `/post/thread?sort=discussed`. Load more never touches the URL.
- **Show off removes a post from the feed; Blur covers it.** They are independent and Show on + Blur on
  is legal. Measured on the fixtures: Show off → 11 of 12 rows, the flagged one absent, nothing
  covered even with Blur on; Show on + Blur on → 12 rows, one `.is-covered` whose `.post-veil` carries
  `blur(6px)` while `.post-foot` stays `filter: none` (*the numbers are never hidden*). Because a
  fetched slice can be entirely hidden, the page pulls the next page rather than draw an empty feed
  (the catalogue's `fillIfBlank`).
- **The comment count is the permalink, and the timestamp is the second way in.** The feed renders no
  comment at all (`thread.md` → *Layout*), so the count is an anchor to `/post/[id]` at 44px, and the
  `<time>` in the header is the conventional link that keeps a zero-comment post reachable.
- **A cut folds at two messages** — one user turn, one character turn, since a cut alternates — behind
  **Show more**, which expands **in place** from per-card state. The feed's scroll and the URL survive;
  the permalink is where the whole cut is read.
- **A character attachment is the author's own item, drawn as a bordered row**: 40px avatar, name, and
  the tagline on one ellipsised line. The listing resolves those characters **once per answer** and
  hands the record in live; a card that fetched its own attachment would be an N+1 the Supabase
  adapter would inherit, and a card handed `people[id]` would keep the `null` it saw before the
  lookup answered (a prop expression is evaluated once — the same trap as T-08's `blur`).
- **A post's image is not drawn.** The spec's *body with its inline images* has no field on
  `postSchema` yet; nothing invents one, and a body-only card is not a broken card.
- **End of feed** is a centred 12px line, drawn whenever `hasMore` is false and the feed has rows —
  including page 1, because the fixtures hold 12 posts. Load more is therefore **unreachable in the
  preview**: the control is mounted from `hasMore` and its append path is unverified until the
  fixtures grow past 24.

## Post detail and composer (decided in T-14, do not re-invent)

`/post/[id]` is the permalink `PostCard` already linked to, and `/post/create` is the only way to make
a post. `post/detail.md` leaves its *Layout* to us; `post/create.md` fixes the parts of the form but
not its frame. These are the choices.

- **The permalink reuses `PostCard` and adds only what a permalink adds.** The card takes
  `fold={false}` — the whole cut, no **Show more** (`detail.md`: *rendered in full here*) — and
  `foot={false}`, because a permalink owns engagement itself. Two props, not a second drawing of a
  post: T-30's profile reuses the same card with both on.
- **Engagement is four cells, ratio first**: `percent(ratioOf(...))` with the raw like and dislike
  counts beside it and the comment count, never a like/total fraction (`luaplot-pages.md` →
  *Engagement*). The cells are a 2×2 grid at 360, one row of four from `sm` and 2×2 again in the
  `md` aside, where the cell is 300px wide and four columns would make 70px of number.
- **One column on a phone, two from `md`.** The reading column holds the card and then the thread;
  the aside holds counts and the action row and is `position: sticky` at 88px. The DOM order —
  card, aside, comments — **is** the phone order, so the wide layout is a grid-area swap and not a
  second tree.
- **The action row is one column of 44px rows at 360 and `md`, one wrapped row at `sm`**: Like /
  Dislike (`aria-pressed` from `repo.myVote`), Bookmark, Report, and — for the author only — Delete.
  Delete is two-step (`Confirm delete` / `Cancel`) because it takes the whole thread with it, and its
  label says so when the post has comments.
- **Signed out is read-only**, and every action leads to `/authentification` rather than being hidden:
  a visitor can see the controls exist (`detail.md` → States → *Signed out — read only*).
- **Not-found, deleted and removed are one state.** The adapter answers `null` for all three; the page
  prints *This post doesn't exist.* and offers the thread. The spec's two sentences for a deleted and
  a removed post exist so neither is *privatized*, not so the page can guess which happened.
- **The composer is one column, and the sections are hairline labels, not nested cards.** At `md` it
  becomes the reading column (body) with a 340px attachment column beside it — a composer that stays
  328px at 1440 is a stretched phone.
- **The attachment picker is native radios in 44px rows** (`Toggle` is reserved for the two NSFW
  preferences), one list with *No attachment* first, then the viewer's own characters, then the
  viewer's own sessions as cuts with their message count. Empty lists print one sentence instead of an
  empty box.
- **Inline image and GIF insertion is deliberately not drawn.** There is no uploader and no storage,
  and `postSchema` has no media field, so the control would do nothing. It arrives with the uploader;
  the media rules in `create.md` (PNG/JPEG/WebP/GIF, 10 MB, four per post) have nothing to fire from
  until then.
- **A cut is stamped as text at publish time.** The character side always reads the session's
  character name; the user side reads the chosen attribution — the persona's name, or `User` when the
  session has no persona or the author picks the generic one. The choice appears only once a cut is
  attached (`create.md`: *Sender attribution appears only once a cut is attached*), and a later
  persona rename leaves the post alone.
- **The panel-over-the-page instance is built (T-15).** `/session/[id]` opens the same
  `components/PostComposer.tsrx` in a `Sheet` with the cut locked — see *Session* below for the
  two-step range and why one composer serves both hosts. Cancel returns to the session.

## Session (decided in T-15, do not re-invent)

`/session/[id]` is the only route in P1 where a conversation happens, and the spec leaves everything
below the settings button *to be specified*. These are the choices; `/session/…` is also the last
consumer of `Session` before P2.

- **The page is the transcript, not a dashboard.** Header: the copy character's **in-session name** as
  the title, the persona in use as `You are <persona>` beside the preset's name, and the settings
  button (44px, `IconMore`) at the top right of the identity block. Under it the turns, then the
  composer. No session name, no session list, no archive — the URL or the character's **Continue** is
  the only way in.
- **The settings `Sheet` holds exactly two rows**: **New Session** first, **Delete session** second
  with a confirmation in place (the sheet swaps to the sentence + Cancel / Delete, not a second
  dialog). Persona switching is its own underlined control beside the persona line, never a third
  menu item — the menu stays the spec's two options.
- **Delete goes to the character**, not the catalog, because that is where the next session starts;
  the route then answers not-found for the deleted id. **New Session** calls
  `createSession(sourceId, currentPersona)`, which is why the adapter gained an optional persona: the
  spec says *with the current persona*, which is not necessarily the account's default.
- **Copies are a disclosure, closed by default**, because a phone should open on prose. The header
  row reads `Session copies · 4 copies · 1 edited`; expanded, one row per participant (character,
  each lorebook, preset) with its kind, its name, its state as a **word** (`untouched` / `edited` /
  `unlinked`) and one line of fact (`2 entries · version 2`). A state is not a badge — there are
  three, and the badge language belongs to status chips.
- **One control per state.** *Linked* rows offer **Open the original** (a real link to
  `/<kind>/<sourceId>`) and **Update from original**, which confirms first because it overwrites the
  session's edits; **Restore** appears only while `edited`. *Unlinked* rows offer neither and print
  *The original is out of reach. This copy runs on.* — the copy keeps running, which is the whole
  point of the state.
- **Restore's honest limit.** The memory adapter has no version history, so `restoreCopy` re-reads the
  original as it stands and keeps the copy's own `version`; `updateCopyFromOriginal` re-reads it *and*
  moves the version forward. For every fixture the two are correct (the original is the pre-edit
  text); the one case where they differ is an author editing the original *after* a copy was edited.
  A stored snapshot is the fix, and it is a schema change, not a page change.
- **One scrollbar.** The shell scrolls the page, so the composer sits **in flow** after the
  transcript: no sticky element for a phone keyboard to cover, no second scroller, and the
  `scrollIntoView` dance a pinned transcript would need is not there to get wrong. The reading column
  caps at 68ch on the turn text.
- **Two columns from `lg`, never from `md`.** At `md` the outlet is 720 wide and a 300px aside leaves
  a 324px reading column — a transcript is prose, so it keeps the whole outlet there and the copies
  stay the one collapsed row they are on a phone. At `lg` the aside is 300px, `position: sticky` at
  88px, and the main column is the remaining 528 at 1200. DOM order is `aside` → `main`, which is the
  phone order (the collapsed row above the transcript), so the wide layout is a grid placement and
  not a second tree.
- **The user's own turns sit in a panel** (`--color-surface`, 1px border, 6px radius); the
  character's are plain prose under its in-session name. Time is `clockTime(at)` — `18:10`, not the
  thread's date-bearing `shortStamp` — because a transcript is read forwards under a date the header
  already gives. The entrance is one 160ms rise per turn, `prefers-reduced-motion` respected.
- **`Publish a cut` opens a two-step sheet.** Step one picks the range from two `Select`s (`3 · …`),
  defaults to the whole transcript, and **Continue** opens step two: `PostComposer` with the cut
  locked (range line, message count, attribution choice, NSFW toggle, body). Two steps exist because
  a prop expression is evaluated **once** — a composer mounted beside live selects would keep the
  range it was born with — and re-mounting the composer on every range change would throw the draft
  away silently. *Change the range* returns to step one, and that is the one path that loses a draft.
- **One composer, two hosts.** `components/PostComposer.tsrx` is the whole form T-14 built, with a
  `cut` prop: `null` draws the picker (`/post/create`), a value locks the attachment and stamps the
  turns from the session. One `postWriteSchema`, one `repo.addPost` — the panel is not a second
  composer with a private copy of the rules. The panel drops the picker's character list and the
  `md` two-column split, since a sheet has no second column.
- **Send is local, the reply is a seam.** `repo.appendTurn` writes the user's turn (`turnWriteSchema`
  trims and refuses an empty message); `repo.appendReply` writes the model's, through the same
  schema and the same adapter-owned id and clock, so a reply is a turn and there is one write path.
  `lib/llm/chat.ts → replyTo()` answers from `provider.ts` when `VITE_CHAT_ENDPOINT` is configured
  and from the deterministic `mock.ts` otherwise; `null` now means *the provider failed*, which the
  page draws as **Send failed** under the composer (*The model didn't answer. Your message is
  saved.*) because the transcript is append-only — a failure is a line, never a rollback.
- **`Awaiting model response` is the character's row as a two-line `Skeleton`**, inside the same
  `<ol>` as the turns and under its in-session name, with `aria-busy` on the list and Send disabled
  while it is in flight; it carries no entrance animation, because a skeleton that slides in and is
  then replaced reads as two events. The mock holds a fixed 180ms so the state paints a real frame
  instead of flashing past on the microtask that stored the user's turn.
- **`Preview mode` is a chip in the composer's meta line, not in the shell.** The session route is
  immersive — it hides the shell's top bar and tab bar — so the shell has nowhere to put it, and the
  honest place is beside *Publish a cut* at the foot of the transcript, where the reply itself lands:
  12px `--color-text-subtle`, 1px `--color-border-strong`, 2px radius, a `<span>` and never a button
  (the thread's filter chip, same rule: a state is drawn, not operated). It is drawn from
  `previewMode()` in the seam, so the chip and the mock's own sentence cannot disagree. At 360 the
  meta line reads `Publish a cut` … `Preview mode` at 16–344 of 328, and at 1200 the two sit at the
  ends of the same 794 A4 cap.
- **Not-found and not-a-participant are one state** (`This session doesn't exist.`), because
  `getSession` answers `null` for both; signed out is a sign-in `EmptyState`, not a spinner, because
  the route's `access` is `signed-in` and a page that waits forever on a signed-out viewer is a
  broken page.
- **`Edit session copy` is not built.** The spec's session-scoped editor needs its own form and a
  copy write schema (`sessionCopyWriteSchema`); the copy rows show state and the link actions only,
  and the ticket is in `docs/NEXT.md`.

## Character create and edit (decided in T-17, do not re-invent)

`character/create.md` fixes the parts of the form but not its frame, and `character/edit.md` leaves its
*Layout* entirely *to be specified*. Both routes mount the **same** `components/CharacterForm.tsrx`
(`character: null` is create, a row is edit), so these choices are the shape every authored-item form
(T-18, T-19, T-20) copies.

- **One column at 360, in the spec's own order**: identity (Name, In-session name) → Description /
  personality → image and NSFW → lorebook attachments → Save / Cancel. `md` splits the ID input from
  its **Add by ID** button onto one row; `lg` puts identity and the image in a 360px right column with
  the definition beside it and the attachments across the full width. A form that stayed 328px at
  1440 would be a stretched phone.
- **Description and personality are one field.** `create.md` names them as a single bullet and
  `characterSchema` carries a single `description`; a second write field would be a value the row
  cannot hold. Splitting them is a schema change (row, 28 fixtures, `characterCopySchema`, the detail
  page), filed in `docs/NEXT.md` rather than half-done.
- **The avatar is initials, and the field says so.** There is no uploader and `avatarSchema` is
  `{initials}`-shaped, so the form offers an **Initials** control (four characters at most) whose hint
  states the situation. Left empty the schema fills it from the name (`initialsOf`), so the row's
  required `initials` is never a blank and a page never upper-cases a label.
- **NSFW is its own half of the image row**: at 360 it stacks under Initials; from `md` the two sit
  side by side, which is where the pair reads as "how this character is shown".
- **The attachment list is three pieces, exactly as the spec counts them**: an ID input with **Add by
  ID**, a `Select` picker of `repo.listAttachableLorebooks()` (own lorebooks plus bookmarked ones from
  other authors, attached ones filtered out), and the current rows beneath in one `<ul>`, each with a
  **Remove** ghost button. The empty state is a sibling sentence, not a row. An id that no longer
  resolves stays in the list drawn as its id plus `unavailable — the lorebook is gone or private`;
  the write still accepts it because it is already on the row, so saving cannot erase it.
- **The picker is narrower than the by-ID rule, on purpose**: the spec's *Data* allows *any public
  lorebook* by id, while the picker is *own plus bookmarked*. Both live in the adapter
  (`listAttachableLorebooks`, `attachableLorebook`) so no page compares an author handle.
- **Delete is its own row above the form's foot**, marked by a 2px `--color-danger` left rule, and it
  confirms **in place** (the row swaps to the sentence plus Cancel / Confirm delete) — the session
  settings sheet's pattern, not a second dialog. The sentence names the cascade, because the spec is
  explicit that there is no undo, no trash and no grace period.
- **Save goes to the character's detail page** on both routes, and **Cancel** follows the spec's own
  two targets: the catalog from create, the detail page from edit.
- **Three refusal states on edit, one line each**: `This character doesn't exist.`,
  `This character isn't yours to edit.` (forbidden, never a silent redirect), and a load-failure line
  that offers the catalog. The adapter refuses the write as well, so the page check is the state, not
  the guard.
- **No draft state and no verification step.** *Save publishes*, so `isPublic` is true on write and
  the row is `verified: false` until JEV or a moderator looks at it — the same rule a new post
  follows. A tagline is not a field, so a character authored here carries `tagline: ""` and no tags.

## Lorebook create and edit (decided in T-18, do not re-invent)

`lorebook/create.md` fixes the form's parts and `lorebook/edit.md` leaves its frame *to be specified*.
Both routes mount the **same** `components/LorebookForm.tsrx` (`lorebook: null` is create, a row is
edit), and the frame is T-17's `CharacterForm` unchanged: one column at 360 in the spec's own order
(identity → description → image and NSFW → entries → Save/Cancel), `md` splitting the image row, `lg`
putting identity and media in a 320px right column with the entries across the full width. The
differences are all about the **entries editor**, which T-19's settings form does not need and T-20
(personas) does not have.

- **Keywords are one comma-separated field per entry**, not the `TagPicker` chip list. An entry's
  keywords are the entry's own vocabulary, not the item's tags, and at 360 a chip input inside a block
  inside a list is three nested controls deep. The split lives in `lorebookEntryWriteSchema`
  (`splitKeywords`), never in the page, so the inline error and the stored row cannot disagree. The
  schema accepts the typed line **or** an already-split list, because the adapter parses the write
  again and a schema must accept its own output.
- **Add entry appends below the list.** The list reads in the author's order, and a block inserted at
  the top would push the first entry down on every add.
- **Reorder is two 44px buttons (Up / Down) on each block's header row, never a drag handle**: a phone
  drag target is 20px, and the header already carries **Remove**. The first block's Up and the last
  block's Down are `disabled` rather than hidden, so the row does not reflow as entries move.
- **A block never collapses in the form**, even with many entries: the form is where every field is
  meant to be editable, and a collapsed block would hide a validation error. Detail does not collapse
  either (`detail.md`), but that is the read page's own rule.
- **`entry-1`, `entry-2` … are the adapter's labels**, numbered in display order by `numberEntries`
  in `memory.ts`. The form never invents an id, so two blocks cannot collide and a fork cannot inherit
  a duplicate.
- **A block's validation error is a template-owned paragraph**, not a `Field.error` prop: a prop
  expression is evaluated once, so the line would never appear while the entry list kept its keys. The
  schema's issue path (`entries.2.keywords`) is what picks the block.
- **Delete sits at the foot of edit, after the form**, marked by the same 2px `--color-danger` rule and
  confirming in place: `edit.md` requires it *set apart from the save controls so the two are never
  adjacent*. Its sentence states the consequence once — entries and thread go, characters keep the
  attachment listed as unavailable — and no reverse lookup is run.
- **`Request public again` is drawn disabled** (owner, while private): `detail.md` names it but no
  write exists, so it says *Not available yet* rather than pretending to succeed.
- **Cancel differs by host**: catalog from create, detail from edit; Save lands on detail both ways.

## Preset create and edit (decided in T-19, do not re-invent)

`preset/create.md` fixes the form's order (*the avatar and the NSFW toggle at the top, then the
generation settings, then Save and Cancel*) and `preset/edit.md` leaves its frame *to be specified*.
Both routes mount the **same** `components/PresetForm.tsrx` (`preset: null` is create, a row is
edit). The frame is T-17/T-18's unchanged — one column at 360 in the spec's order (identity →
description → image and NSFW → generation settings → Save/Cancel), the image row splitting at `sm`,
and at `lg` a two-column grid with identity and media in a 320px right column, the description and
the settings down the left, and the foot across both.

- **Model is a `Select` of `PRESET_MODELS`, never a free-text field.** *Data* → *Model* says the
  model is *chosen by its author from the ones the app offers*, so a text box would let an author
  name a model that does not exist, and the inline error would have nothing to point at. The list
  lives in `schema.ts` beside `presetSettingsSchema` — the app's generation layer is DeepSeek, so it
  holds `deepseek-chat` and `deepseek-reasoner`, which is exactly what the five fixtures carry.
  The option labels are the ids themselves: the id is the word the detail page shows "as saved", and
  a friendly alias here would make the form and the read page disagree.
- **`presetSettingsSchema.model` stays `min(1)`, not an enum.** *The settings list follows the
  generation layer and is added here as that surface settles*, so a new model is a list-and-fixture
  change, not a migration of every stored preset. The control offers what exists; the row records
  what was chosen.
- **The provider is not a control and not shown as one.** *It is never a field and is not shown*, so
  the block carries one `Select` and a sentence saying the provider belongs to the app. No provider
  chip, no second select, no "via …" suffix on the option labels.
- **Settings get their own labelled section although the list is flat.** The spec's *not grouped
  into sections* is about the fields — a section here is the labelled region every other block of
  the frame already has, and it is what makes **Model** findable at `lg` in the wide column's second
  row. A preset's settings are its payload, so the block is not folded into the description.
- **Detail shows the settings after the description and before the comments**, as a `<dl>`: one row
  per field, term above value at 360 and side by side from `sm`, the value in `--font-mono` because
  it is a saved token rather than prose. Values are **as saved** — no default beside them, no mark of
  what the author changed, no friendly name (`detail.md`). A preset's description is the one prose
  line above them; it is the row's `description`, which the catalog searches.
- **Delete's sentence names only what `edit.md` names**: the comment thread goes, and *a running
  session keeps its own copy*. A preset has no entries, so there is no entries cascade to state, and
  it is not attachable the way a lorebook is — the character form's `unavailable` sentence would be
  a promise about a reference that does not exist.
- **`Request public again` is drawn disabled** (owner, while private), exactly as on lorebook detail:
  `detail.md` names it, no write exists.
- **A component's root element cannot be styled** (found in T-19, applies to every `.tsrx`): Ripple
  0.4.7 scopes a `<style>` block by adding a `tsrx-<hash>` class to the elements it emits, and the
  root element does not get one — so a rule written on `.preset-form` is dropped by the compiler and
  the form silently stays `display: block`. That is why `CharacterForm`, `LorebookForm` and
  `PresetForm` all now put their grid on a child `.layout` div. The same fix was applied to the two
  older forms in T-19: their `lg` two-column layout had never actually applied.

## Persona collection and detail (decided in T-20, do not re-invent)

`persona/collection.md` and `detail.md` describe the **only** page family in the app that is neither
authored content nor a shared surface: a persona is personal, never shared, never moderated and never
counted. That one sentence removes most of the chrome the other item pages inherit, and this section
is what is left.

- **The persona card is its own component, not `Card`.** The catalogue card's footer *is* an author
  link and the derived ratio, and the spec says a persona card has *no author, no ratio, no comment
  count*. `Card`'s `item` prop is also the `AuthoredItem` union, which a persona is deliberately not
  a member of, so a "no footer" switch would have dragged it into a union the spec keeps it out of.
  `components/PersonaCard.tsrx` draws avatar (56px), name, tagline and the default line, and shares
  the box through `.persona-card` in `src/styles.css` (1px border, 6px radius, elevated surface), so a
  persona grid and a catalogue grid still read as one system. The **grid** is the app's `card-grid` /
  `card-cell` classes — 1 / 2 / 3 / 4-up at 360 / 640 / 900 / 1200 — with no page-local gutter.
- **The default mark is a line above the name**: a 2px `--color-accent` top edge plus the word
  `default` at 11px, uppercase. Settled at 360 with two personas, one default, against a corner badge
  (collides with the name's ellipsis) and an eyebrow line (reads as a second title). A line cannot
  collide with anything, and it survives a name that truncates.
- **`Set as default` sits on the card and on detail**, because *Actions* lists it in both places, and
  it is **drawn disabled** (`Default persona`) when this persona already holds the mark — idempotent
  writes should not be dressed as live actions. The collection patches the two rows it knows about
  (previous holder, new holder) instead of refetching the grid it already has.
- **The collection is a collection: one adapter call, page 1, no Load more.** `listPersonas` still
  slices at 24 like every listing; the page draws every row it is handed and never draws a paging
  control the spec forbids. **Search is by name only** and the rule lives in the adapter — the
  catalogues match name, tagline and description, this one does not.
- **Sort is Newest / Oldest / Name.** `ratio`, `discussed` and `liked` are absent because a persona
  carries no engagement at all, and a sort that silently falls back would be a control that lies.
- **Detail carries no shared chrome**: no engagement row, no report, no comment thread, no owner
  notice, no settings `Sheet`. Header = cover (`Avatar size="hero"`, 320px column from `sm`, the
  T-12 item-page frame), name, tagline, the mark, and the four actions; description read-only beneath.
- **Missing and unowned are one sentence**: `This persona doesn't exist in your collection.`
  `repo.getPersona` answers `null` for another account's row, and the edit page has **no `forbidden`
  phase** — unlike the three authored types, where "not yours" is its own state.
- **Delete has two hosts and one row.** `components/DeleteRow.tsrx` is the in-place confirmation used
  by detail (directly under the header, where the spec lists the action) and by edit (at the foot,
  after Save and Cancel): one sentence, one write, one landing — `/persona`. It is never a dialog.
  The copy names only what `edit.md` names: immediate, no undo, no trash, the mark moves to the most
  recently created remaining persona, and a session that pinned it keeps its transcript and reads
  `User`.
- **`Start a session` asks for a character first, in a `Sheet`.** The picker lists the viewer's **own**
  characters, by name; choosing one reopens the session they already have with that character (with
  this persona attached through `repo.setSessionPersona`) or creates one with the persona in the same
  write (`repo.createSession(characterId, personaId)`). There is no preset step — the preset travels
  with the character — and the persona is never attached to an arbitrary character.

## Do not

No emoji in UI chrome. No stock illustrations. No gradients on text. No shadows on flat cards.
No icon set sprawl — one 20px stroke set, inlined as components. No animation on scroll.
