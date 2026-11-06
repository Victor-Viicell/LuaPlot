# LuaPlot — Design & Implementation Guide

This is the canonical guide for **every component and page** in this repository. Read it before
creating or changing a `.tsrx` file, and keep it current when you establish a new precedent.

> **Agent contract**
>
> 1. Before a new component or page: find the closest existing one, copy its anatomy, then change only
>    what the task needs.
> 2. Never introduce a second pattern for something this file already answers. If a genuinely new
>    precedent is needed, add one line to the **Decision registry** (§13) in the same change.
> 3. Comments explain *why*, not *what*. Cite the spec or the reason a non-obvious choice exists.
> 4. Run the gates in §12 before declaring the work done.

Several source headers cite `docs/DESIGN.md`, `docs/ARCHITECTURE.md` or `docs/CONTRACT.md`. Those
files are not present in this checkout; **this document is the live source of truth** for how a
component or page is built. Treat a cited `docs/DESIGN.md` section name as a pointer to the closest
section here (see §13).

---

## 1. Stack and source map

| Concern | Where it lives |
| --- | --- |
| App shell, chrome, route mounting | `src/App.tsrx` |
| Route table + navigation seams | `src/router.ts` |
| Pages (one per route) | `src/pages/*.tsrx` (kebab-case files, PascalCase exports) |
| Reusable components | `src/components/*.tsrx` (PascalCase files and exports) |
| Icons | `src/components/Icons.tsrx` |
| Global tokens + shared primitive styles | `src/styles.css` |
| Shapes, parsing, normalisation, messages | `src/lib/schema.ts` |
| Entity types | `src/lib/data/types.ts` (`z.infer` only) |
| Data adapter | `src/lib/data/repo.ts`, `src/lib/data/memory.ts` |
| App-wide stores | `src/lib/state/*.ts` (session, prefs, inbox, subscription) |
| Display formatting | `src/lib/format.ts` |
| Live-prop reader | `src/lib/reactive.ts` (`read`) |
| Toasts | `src/lib/toast.ts` |
| Validation readings for forms | `src/lib/validate.ts` |
| Native boundary | `src/lib/native.ts` |

Stack: **Ripple 0.4** (`.tsrx`, `track`, `Derived`, `effect`, `Portal`), **TypeScript strict**,
**Zod 4**, **Vite**, **Tauri 2**, no CSS framework, no router dependency.

`src/components/layout/` and `src/components/ui/` are currently empty. Do not invent a nested
component taxonomy until there is a real group of components to move; flat files are the pattern.

---

## 2. The laws (non-negotiable)

1. **Screens are pages, drawings are components.** A page owns the route, fetching, the query
   string, listing policy and navigation. A component owns its markup and its own ephemeral UI
   state. A presentational component never fetches, never reads a store, and never writes the URL.
2. **One shape, one home.** A type is `z.infer` of a schema in `src/lib/schema.ts`. Never declare a
   hand-written entity type beside its schema. `safeParse` at every edge (input, adapter, LLM/JEV).
3. **One rule, one implementation.** Normalisation lives in the schema, formatting in
   `lib/format.ts`, path building in `router.ts`, navigation in `follow()` / `navigate()` /
   `commitQuery()`. Never duplicate a regex, a base-path calculation, or a URL write.
4. **The adapter owns identity and numbers.** It writes ids, authors, clocks, counts, vote state and
   bookmarks. A page renders what came back; it never increments or recomputes a count. A ratio is
   always derived by `ratioOf()`.
5. **Live props are `Derived<T> | T`, read through `read()`.** A prop expression is evaluated once
   at the call, so anything a page changes after mount must be handed in as a `Derived` (or as the
   store's value mirrored into a `track`). This applies to values, flags, error lines and arrays.
6. **No module-scope `track()`.** A tracked value must be created inside a component. App-wide state
   is a subscribe/notify store; a component mirrors it into its own `track()`.
7. **Real elements, real links.** Use `<button type="button">` for actions and `<a
   href={href(path)} onClick={follow(path)}>` for navigation. `follow()` takes an **app path**, never
   an `href()`. Modified clicks stay with the browser.
8. **Semantic tokens only.** No raw palette values, no hex, no `--ctp-*` in app code. The accent is a
   **mark** colour; text uses `--color-accent-text` and a text hover uses
   `--color-accent-hover-text`.
9. **Mobile first at 360.** A page must be designed and legible at 360×740 before it grows. Minimum
   touch target is 44px.
10. **Never hide the numbers.** NSFW cover withholds the body, never the chrome (name, author,
    ratio, counts, actions). NSFW is not access control; a detail route still resolves.
11. **States are part of the page.** Loading, empty, no-results, loading-more, end-of-list and error
    are all rendered. A spinner is not a loading state; a skeleton shaped like the answer is.
12. **No silent failures.** A failed mutation shows a toast or an inline error. A disabled control
    explains itself in a line of copy rather than being a dead button.

---

## 3. File and naming conventions

- **Components**: `src/components/Button.tsrx`, export `Button`. PascalCase file and export.
- **Pages**: `src/pages/discover-characters.tsrx`, export `CharacterCatalog`, plus
  `export default CharacterCatalog;` at the bottom (the router imports the default).
- **Stores**: `src/lib/state/prefs.ts`, named exports (`nsfwPreference`, `onPrefs`, setters).
- Imports use explicit extensions: `../components/Button.tsrx`, `../lib/schema.ts`.
- Import order used throughout: component imports → `ripple` → router → data → stores → `lib`
  helpers. Keep it readable, not ceremonial.
- One component per file. A page-specific helper component stays in the page file unless it is
  reused, at which point it moves to `src/components/`.
- A route's file name is the route's noun (`character-detail.tsrx`, `persona-edit.tsrx`). A
  create and an edit page mount the **same form component**; they never contain two copies.

---

## 4. Component anatomy

### 4.1 Template

```tsrx
import { track, type Derived } from "ripple";
import { read } from "../lib/reactive.ts";

/**
 * What this is, in one sentence.
 *
 * What it owns, and what it deliberately does not. Cite the spec or the ticket that decided a
 * non-obvious rule. Note the live props and why they are live.
 */
export function Thing({
  title,
  value,
  onChange,
}: {
  title: string;
  /** May be live: a page changing it has to repaint this component. */
  value: Derived<string> | string;
  onChange: (next: string) => void;
}) @{
  const open = track(false);

  <>
    <style>
      .thing { display: flex; gap: 8px; }
    </style>
    <section class="thing">
      <h2>{title}</h2>
      @if (read(value)) {
        <p>{read(value)}</p>
      }
    </section>
  </>
}
```

Rules:

- **Props are an inline object type**, with a JSDoc line per non-obvious prop. No `interface Props`
  ceremony unless it is exported and reused.
- **Stateless components** may return JSX directly (`export function X(props) { return (...) }`).
  **Stateful components** use the `@{ ... }` body. Do not add a body just to hold one constant.
- **`children?: Children`** for composition; import `Children` from `ripple`.
- **Callbacks** are `(value) => void` and report; they do not perform navigation or writes on the
  page's behalf unless the component's whole job is that write (`DeleteRow`, `ReportDialog`).
- **Transient UI state belongs to the component**: an NSFW reveal, an open menu, a typed filter, a
  measured tag overflow. Persisted or shared state belongs to the page or a store.
- **Never import a store in a presentational component.** Pass the value/flag down. The listing
  reads the preference; the card is told whether to cover.
- **Never reach into a child's internals.** Style around it with the shared class (`.empty .btn`)
  or add a prop. A page may style a primitive's documented class.
- **Do not fork a primitive.** Extend the existing one (`Button` variants, `Tabs` counts,
  `Avatar` sizes) and keep the old call sites working. If a different *concept* is needed, build a
  separate component and say why in its header (see `PersonaCard` vs `Card`).

### 4.2 Ripple syntax used in this repo

- Attributes: `class`, `for`, `tabindex`, `maxlength`, `aria-*`; not `className`/`htmlFor`.
- Style objects use camelCase and **explicit units**: `style={{ height: `${px}px` }}`.
- `@if (cond) { ... } @else if (...) { ... } @else { ... }`
- `@for (const item of list; key item.id) { ... }` — **always key a loop**.
- Fragments: `<> ... </>`.
- Events: `onClick={(event) => ...}`, `onInput={(event) => ...}`, typed DOM events.
- Refs: `ref={(element) => { ... }}` for measurement, focus or observers.
- An expression containing braces/backticks is written as an interpolation:
  `` {`+${count}`} ``.
- **Word-break rule**: Ripple trims boundary whitespace next to an element. When a literal must
  keep a space after an inline element, write `{" "}`. `scripts/wordbreak-check.mjs` enforces this
  on the built bundle.

### 4.3 The primitive set

| Component | Use it for | Do not |
| --- | --- | --- |
| `Button` | All actions. `primary` once per screen, `secondary` default, `ghost` in rows, `danger` destructive only. | Substitute an `<a>` for an action, or add a second focus ring. |
| `Field` | Labelled text input / textarea, help and error lines. | Float the label, or keep a local copy of the value. |
| `Select` | A named choice from a growing list, opened as a **floating list of our own** — 44px trigger with `data-value` and the chosen label, then a fixed, viewport-clamped panel (flipped above when there is no room) that cannot be clipped by a card or the scrolling outlet. Keyboard: Up/Down/Home/End, Enter/Space, Escape, Tab. Outside press closes through the scrim. | Use a segmented row that cannot grow, or a native `<select>` — the OS popup ignores every token we have and looks nothing like the card menu beside it. |
| `Toggle` | A two-state row (`aria-pressed`). | Use `role="switch"`; the press state is the contract. |
| `Tabs` | Underline tab strip with an icon per tab and optional counts. On phones only the selected label opens; from `sm` up all labels show. | Let it write the query; the page owns `?tab=`. |
| `TagPicker` | Multi-select tag filter with chips. | Invent a taxonomy; options come from the adapter. |
| `Avatar` | Initials fallback, numeric / `fluid` / `hero` size. | Add an uploader before storage exists. |
| `AvatarButton` | An avatar that opens `AvatarViewer` (wheel / pinch zoom, drag pan). | Copy the viewer state into a page. |
| `Excerpt` | Clamped copy (tagline, bio) that opens in full in a `Sheet`. | Use it for text that already fits. |
| `Sheet` | Bottom sheet (mobile) / centred dialog (`md`). Mount in `@if`. | Nest one sheet inside another, or build a bespoke modal. |
| `Skeleton` | Loading placeholder shaped like the content. | Use a spinner. |
| `EmptyState` | One line + one primary action. | Add an illustration or a second paragraph. |
| `Toast` + `toast()` | Transient failure/success notice. | Use it for field-level validation. |
| `Icons` | Inline 24×24, 1.5-stroke, `currentColor`, `.ico`. The shell adds `IconMark`, `IconCompass`, `IconMenu`, `IconSpark`, `IconDoc`. | Add an icon dependency. |
| `Card` / `CardGrid` | Catalogue items (`AuthoredItem`). | Give `Card` a post branch; posts use `PostCard`. |
| `PostCard` | One timeline post: header, body, counts. | Reuse the catalogue card. |
| `PersonaCard` | Personal persona: avatar, name, tagline, default mark. | Draw author/ratio/engagement fields. |
| `DeleteRow`, `ReportDialog` | One write with its own confirm/validation copy. | Duplicate the same confirm text in two pages. |

Shared looks live in `src/styles.css` so a page can style a primitive it does not own. Page- and
component-specific CSS lives in a `<style>` block in the `.tsrx` file.

---

## 5. Page anatomy

### 5.1 Template

```tsrx
import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { useParams, useQuery } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";

/**
 * `/the/route` — what the reader gets (`src/specs/pages/...md`).
 *
 * What this page owns: the fetch path, the states, the query string, policy.
 * What it deliberately does not: draw the card, compute a count, normalise a value.
 */
type Phase = "loading" | "ready" | "empty" | "error";

export function ThingPage() @{
  const repo = resolveRepo();
  const id = useParams().id ?? "";
  const start = useQuery();

  const phase = track<Phase>("loading");
  const failure = track("");
  const items = track<{ id: string; name: string }[]>([]);

  let seq = 0;

  function load(): void {
    const mine = ++seq;
    phase.value = "loading";
    failure.value = "";
    repo.listThings({ id, query: start.get("q") ?? "" }).then(
      (rows) => {
        if (mine !== seq) return;
        items.value = rows;
        phase.value = rows.length === 0 ? "empty" : "ready";
      },
      () => {
        if (mine !== seq) return;
        phase.value = "error";
        failure.value = "The list could not be loaded.";
      },
    );
  }

  load();

  <>
    <style>
      .things { display: flex; flex-direction: column; gap: 20px; }
    </style>
    <div class="things">
      @if (phase.value === "loading") {
        <Skeleton variant="lines" lines={4} />
      } @else if (phase.value === "error") {
        <p class="alert">{failure.value}</p>
        <Button variant="secondary" onClick={load}>Retry</Button>
      } @else if (phase.value === "empty") {
        <EmptyState message="Nothing here yet." />
      } @else {
        @for (const item of items.value; key item.id) {
          <p>{item.name}</p>
        }
      }
    </div>
  </>
}

export default ThingPage;
```

### 5.2 Page rules

- **Register the route** in `src/router.ts`: `path`, `title`, `access` (`public` | `signed-in` |
  `onboarding` | `admin`), an optional `layout` (`"reading"` by default, `"wide"` for a browse
  surface), and a lazy `page: () => import("./pages/....tsrx")`. The table is sorted
  so fixed segments beat params; ids are UUID-shaped and a `[user.username]` segment reuses
  `isHandle`. Never add a second matching rule.
- **Default export is required.** The shell imports `module.default`.
- **Read location once per mount.** `useParams()` and `useQuery()` are snapshots, not
  subscriptions. Never parse `location.pathname` yourself — the router already matched it.
- **Write location through the router:**
  - `navigate(path)` for a new route.
  - `commitQuery(query)` for this page's own filters/tabs/sort. It writes history **and** moves the
    shell's mounted key, so the page is not remounted mid-typing and the URL stays shareable.
  - Never call `history.*` directly. `scripts/history-check.mjs` enforces this.
- **Links**: `href={href(path)}` + `onClick={follow(path)}`. Both take an app path. Passing an href
  to `follow` doubles the base on Pages.
- **Keep a view model, not a nullable entity, in the template.** Ripple 0.4 can lose a narrowing
  across a branch. Give each drawn field its own `track()` (or a non-null local) and fill it at
  load. Do not read `entity.field` inside the markup under `@if (entity)`.
- **Guard races with `seq`.** Every fetch that can be replaced increments a counter; a late answer
  whose counter no longer matches is dropped.
- **One fetch path.** `(1, "replace")` for a new query/tab/sort/Retry/mount; `(next, "append")` for
  Load more. Do not write a second inline fetch for a state.
- **Debounce typing** at ~250ms; never a request per keystroke. Commit a search with `replace`, and
  a discrete choice (sort, tab, tag) with `push`.
- **Mirror stores into tracks** at mount (`onSession`, `onPrefs`, `onInbox`) and derive from them.
  Stores are subscribe/notify because a module-scope `track()` has no owning block.
- **Styles**: a `<style>` block in the component's output, beside the markup it styles (scoped to
  siblings and below). Shared looks belong in `src/styles.css`. No global selectors from a page.
- **Kicker pattern**: a page header is a 12px uppercase kicker (`letter-spacing: 0.12em`,
  `--color-text-subtle`), then the title, then content. Do not invent a new page header.

### 5.3 The shell

The shell has **one top bar at every width**. There is no sidebar and no bottom tab bar; do not
reintroduce one for a new destination.

- **Left:** a **Back** button (history back, falling back to `/`), then the brand — `IconMark` plus
  the wordmark `LuaPlot` — linking home (`/`).
- **Right:** a **Discover** control (`IconCompass`, links `/discover/characters`) and the **options
  menu** trigger (`IconMenu`). Discover is deliberately *not* in the menu because it has its own
  control; it is active on `/` and every `/discover/*` path.
- **The header carries no route title and no path crumb.** Pages own their headings. Never add an
  indexing line back to the bar.
- **Every other destination lives in `optionsFor()`** in `App.tsrx`, in the conventional order:
  Alerts, Thread, Bookmarks, Profile, Subscription, Moderation, Terms of use — content first, then
  the account, then admin/legal. Each entry has an icon and a `prefix` used for the active state.
  Profile is the only session-dependent target (signed out → `/authentification`).
- **Menu rules**: `role="menu"`, items are real anchors with `role="menuitem"`, each row is
  `.menu-item` → `.menu-icon` + `.menu-text`. The current route gets `.is-active` +
  `aria-current="page"`. A row click closes the menu itself (a same-route press would not remount).
- **Badges float on the icon they annotate.** The Alerts row carries `.badge` inside its
  `.menu-icon`; the trigger carries the same count. Both are decorative (`aria-hidden`), and the
  anchor/trigger `aria-label` carries the unread count.
- **Session routes are immersive**: `.shell.is-immersive` hides the header, and the page owns its
  chrome and the whole viewport.

---

## 6. States and feedback

Every data surface renders all of these:

| State | Treatment |
| --- | --- |
| Loading | `Skeleton` shaped like the result (card grid → skeleton cards; body → lines). A route change keeps the mounted page until the next module is in hand — only the first boot draws the shell placeholder. Surface is `aria-busy`. |
| Ready | The content. |
| Empty | `EmptyState`: one sentence + one primary action. |
| No results | Different copy from empty: filters are set, and a **Clear filters** action. |
| Loading more | The button reports it (`disabled`, label change); existing rows stay. |
| End of list | No control at all. |
| Error | A short, factual line + Retry, or a toast if the surface is already usable. |
| Signed out | `EmptyState` with a **Sign in** link to `/authentification`; never a dead action. |
| Unavailable / private | An explanatory `EmptyState`, not a 404, when the route resolved but content may not be shown. |

Copy is factual and short: "The catalog could not be loaded.", "That vote didn't save.",
"Nothing here yet." No exclamation marks, no encouragement, no apology.

A destructive action uses `DeleteRow`'s **one in-place confirm row**, never a dialog. A multi-field
action uses `Sheet` mounted in `@if`, with Escape and a focus trap (already in `Sheet`).

---

## 7. Data, validation and types

- Types come from `src/lib/data/types.ts`, which is nothing but `z.infer` of `src/lib/schema.ts`.
- Schemas use `z.strictObject`: an unknown key fails instead of being dropped.
- `safeParse` at every boundary. `parse` only for an internal invariant that a bug (not a user)
  could break.
- Normalisation (trim, lowercase a handle, collapse display-name whitespace, ISO validation,
  deriving initials, deduping ids) happens in the schema. A page never trims or upper-cases.
- Error messages live in the schema and are re-exported where a form reads them. Do not restate a
  rule in a page.
- Write types (`CharacterWrite`, `PersonaWrite`, …) contain exactly what the author fills. The
  adapter owns id/author/clock/counts.
- Formatting (percentages, timestamps, relative age, badge cap, initials) is `src/lib/format.ts`.
  Zod is shape and input, never presentation.
- A fixture that fails is fixed against the spec, never by loosening a schema.

Repo calls from a page:

```ts
repo.listCharacters({ query, tags, sort, page }).then(onOk, onErr)
repo.addCharacter(parsed.data).catch(() => null)
```

Catch a failed mutation into `null`, then show a toast or inline line. Do not let a rejected
promise reach the page unhandled.

---

## 8. Styling and layout

### 8.1 Tokens

Use only the semantic tokens declared in `:root` of `src/styles.css`:

`--color-bg`, `--color-bg-elevated`, `--color-bg-sunken`, `--color-surface`,
`--color-surface-hover`, `--color-border`, `--color-border-strong`, `--color-text`,
`--color-text-muted`, `--color-text-subtle`, `--color-avatar-text`, `--color-accent`,
`--color-accent-hover`, `--color-accent-text`, `--color-accent-hover-text`,
`--color-accent-contrast`, `--color-success`, `--color-warning`, `--color-danger`,
`--color-info`, `--color-focus-ring`, plus `--font-body` / `--font-mono`.

Themes are Catppuccin flavours selected by `data-theme` on `<html>`; without it the app follows
`prefers-color-scheme`. Every rule must hold in Mocha **and** Latte.

### 8.2 Contrast and the accent

- **The accent is a mark.** Use `--color-accent` for fills, borders, ticks, focus rings and 2px
  indicators. Text that would be accent-coloured uses `--color-accent-text`; its hover uses
  `--color-accent-hover-text`.
- A nav indicator is a mark (a 2px bar), never an accent backplate behind a label.
- Body text is `--color-text`; prose is `--color-text-muted`; 12px labels use
  `--color-text-subtle` and rely on size + tracking for hierarchy, not on a lighter tone.
- 4.5:1 minimum for text, including on `--color-surface` and `--color-bg-elevated`.
- `scripts/tier-check.mjs` fails a `color: var(--color-accent)` declaration anywhere.

### 8.3 Geometry and type

- Mobile-first; design at **360px**. Breakpoints: `640` (`sm`), `900` (`md`), `1200` (`lg`).
- Reading column: max **794px** (one A4 page), centred, with 16/24/32px gutters as it grows.
  **A route marked `layout: "wide"` takes the whole content area instead** (`/`, `/discover/*`
  today); its card grids grow to **at most four columns**. A page never sets its own width — the
  route decides and the shell applies it.
- The shell is **a single 56px header** at every breakpoint. There is no rail to widen at `md` and
  no bottom bar to hide: content height is the viewport minus the header (and the safe areas).
- Minimum target: **44px** for every control (buttons, tabs, icon buttons, toggles).
- Control radius **2px**; card radius **6px**; borders **1px**; no decorative shadows. The sheet
  panel carries the one sanctioned shadow.
- Borders are the separator. Count strips use a 1px-gap grid over `--color-border`; catalogue
  grids use real gutters (12/16/20px) so cards keep their radius.
- Type: JetBrains Mono throughout. Body 14–15px / 1.6; page title 26px / 1.15 / `-0.02em`; kicker
  12px uppercase / `0.12em`; labels 12px uppercase / `0.08em`; mono tabular numbers where aligned.
- Transitions are 120ms `cubic-bezier(0.2, 0.8, 0.2, 1)`; honour
  `@media (prefers-reduced-motion: reduce)`.
- z-index ladder: scrim **40**, sheet **41**, toast **60**. Do not invent another layer.

### 8.4 Ripple `<style>` scoping

A `<style>` block styles its **siblings and everything below them**, never its containing element.
Put it in a fragment beside the markup it styles. Selectors that cannot reach anything are dropped
by the compiler. Use `:global(...)` only to react to something you do not own (a theme attribute on
`<html>`); keep a scoped prefix in front. Global resets and tokens live in `src/styles.css`.

---

## 9. Accessibility

- One `<h1>` per page, in the page header; sections use `<h2>`.
- Buttons are buttons; links are links with a real `href`. No clickable `<div>`.
- Every icon-only control has `aria-label`; decorative icons are `aria-hidden`.
- `Field` draws the label above the control and wires `aria-invalid` / `aria-describedby`; keep that
  behaviour when composing your own control.
- `Sheet` provides `role="dialog"`, `aria-modal`, Escape, focus trap and initial focus. Mount it
  with `@if`.
- `Tabs` uses `role="tablist"` / `role="tab"` / `aria-selected`; the page owns the panel content. A phone's folded label is clipped, not removed, so the tab keeps its accessible name.
- An avatar or a clamped excerpt is a `<button>` carrying `aria-haspopup="dialog"`; the avatar viewer and the full-text sheet are `role="dialog"` and both dismiss on Escape.
- `Toggle` uses `aria-pressed`, not `role="switch"`.
- Focus style comes from the global `:focus-visible` rule. Never add a second ring.
- The options menu is a `role="menu"` with `role="menuitem"` anchors; the trigger is a real button
  carrying `aria-haspopup="menu"` and `aria-expanded`. The unread count is in the accessible name,
  not only in the decorative badge.
- Announce async failures politely: the toast host is a live region. Do not move focus on a toast.
- Respect `prefers-reduced-motion`; keep the sheet and toast usable without animation.

---

## 10. Security and platform

- Treat the adapter as the source of truth for permission; a page still gates UI by which surface
  the viewer is on (owner vs stranger, signed in vs out).
- NSFW preferences are per account, held by `state/prefs.ts`; the listing applies Show/Blur. A
  card is told the effective flag; it never reads the store.
- Never hardcode the base path. `import.meta.env.BASE_URL` is handled by `href()` so Pages
  (`/LuaPlot/`) and Tauri (`/`) both work.
- Tauri capabilities go through `src/lib/native.ts`; every Tauri import stays inside the
  `isNative()` branch so the browser bundle never loads it.
- No secrets in `src/`. Server-side keys never ship (see `.env.example`; `.env*` is ignored).

---

## 11. Recurring page shapes

- **Catalogue** (`/`, `/discover/*`): kicker → search → tag picker → sort → preference switches →
  grid. Empty tag field means All. Cards show ratio only. Four toolbar rows on mobile, one row from
  `md`.
- **Detail**: header (cover, name, author, settings), counts strip, actions, body, attachments,
  discussion. The chrome stays crisp when covered; only the body is withheld. The page's one
  `btn-primary` is the main action (Start/Continue).
- **Create / edit**: page frame (kicker, lede, signed-out state) + **one shared form component**
  (`character={null}` vs a row). Save navigates to the saved item; Cancel returns to the listing.
  The form parses with the write schema before submitting and shows the schema's message inline.
- **Collection** (`/persona`, `/bookmarks`): tabs in `?tab=`, counts from the adapter, one fetch path
  per tab, Load more appends. Tab switching uses `commitQuery`, never `navigate`.
- **Thread / session**: a conversation owns its viewport (the shell hides its chrome for
  `/session/*`). A composer is one component reused inside a page or a `Sheet`. Keep the input's
  caret: never remount on query-like state.
- **Moderation / admin**: dense rows, filters, explicit state transitions; every conclusion carries
  a reason and an outcome; an audit trail is flat, not a thread.

---

## The dropdown is the app's, not the OS's

`Select` was a native `<select>` until now, and on Android that opens a full-screen wheel while on a
desktop it opens a grey popup sharing no token with the rest of the product — next to a card menu that
is already ours. It is a real dropdown now:

- **Trigger**: `<button role="combobox">`, 44px, the chosen label, the caret, `aria-expanded`,
  `aria-activedescendant` while open, and **`data-value`** so a walk or a test reads the state without
  opening anything.
- **Panel**: `position: fixed`, one 44px row per option, width = the trigger's width, clamped into the
  viewport and **flipped above** when the space beneath is short; scrolls past ~8 options.
- **z-ladder**: scrim 19, panel 21 — above the card's `+N` menu (20), below a sheet (40). The scrim is
  an outside-press catcher, not a dimmer: a dropdown is not a dialog.
- **The keyboard is the reason to keep a native control, so it is the reason this one had to be built
  properly**: Up/Down move the active row, Home/End jump, Enter/Space choose, Escape closes and returns
  focus, Tab closes and moves on.
- **The `value` prop must be the track, not `.value`** — every caller was passing a mount-time
  snapshot, which is why the first build changed the listing but not the label. The frozen-prop trap,
  in one sentence.

## 12. Verification gates

Run from the project root:

```sh
bun run build          # tsrx-tsc --noEmit && vite build
bun run schema:check   # every fixture parses; negative cases fail
bash scripts/check.sh  # build + routes + schema + tauri + links + tiers + history + wordbreak
bash scripts/smoke.sh  # route walk / behaviour smoke, when the change is visual or navigational
```

Minimum before handing work back:

1. `bun run build` is green (this covers types and template compilation).
2. If you touched schemas or fixtures: `bun run schema:check`.
3. If you added a route: `node scripts/spec-routes.mjs` (also run by `check.sh`).
4. If you added a link: `node scripts/link-check.mjs`.
5. If you used accent colour for text: `node scripts/tier-check.mjs`.
6. If you wrote to the address bar: `node scripts/history-check.mjs`.
7. If you wrote literal text beside an inline element: `node scripts/wordbreak-check.mjs`.

Also inspect the page at **360**, **900** and **1200** in both Mocha and Latte. State the
commands you actually ran; never claim a gate you did not run.

---

## 13. Decision registry

New precedents get one line here. Long rationale belongs in the file's header comment, not here.

| Area | Decision |
| --- | --- |
| Layout law | 794px reading column, 360px design floor, breakpoints 640/900/1200; indicators are marks, never backplates. |
| Page width | `RouteDef.layout` decides the outlet: `reading` (default, 794px A4) or `wide` (whole content area). `/` and `/discover/*` are `wide` and their card grids grow to **at most four columns**; a profile's grids stop at **two**. |
| Route loading | A navigation keeps the mounted page until the next page module resolves (`shown`, not the URL route, drives `wide`/`immersive`); the shell's three-bar placeholder is only the first boot, when no page exists. The page is keyed by `path + search`, so a same-module navigation (a tab, a search, a profile handle) still remounts and re-reads the URL. Data loading is each page's own skeleton, shaped like the answer. The outlet never blinks to a full-page skeleton. |
| Shell navigation | One header at every width: Back then brand on the left; Discover (`IconCompass`) plus an icon options menu on the right. No sidebar, no bottom tab bar, no route title/crumb in the bar. Discover lives outside the menu; every other destination is `optionsFor()` with an icon and a prefix, ordered Alerts → Thread → Bookmarks → Profile → Subscription → Moderation → Terms. Menu rows are anchors with icons, an active state, and a floating unread badge. |
| Contrast | Accent is a mark. Text uses `--color-accent-text`; text hover uses `--color-accent-hover-text`. 4.5:1 everywhere, including surfaces. |
| Cards | Catalogue card: crisp title and footer, covered middle; radius 6, 1px border, gutter grid. Ratio only — counts live on detail. The image is square and takes half of the top row, with the tagline beside it. The tagline clamps at three lines with an ellipsis so a listing row keeps one height; pressing it opens the whole copy in a `Sheet`. |
| Card and grid | `CardGrid` owns listing-level NSFW policy; `Card` is told the effective cover flag. Posts use `PostCard`; `Card` has no post branch. |
| Discover cards | Every authored kind (character, lorebook, preset) draws tags; the image is half of the top row and the tagline the other half. Discover grids cap at four columns, profile grids at two. |
| Excerpts | A card tagline and the profile bio clamp at three lines with an ellipsis (`.excerpt`); the whole text opens in a `Sheet` on press. The copy stays in the DOM in full for screen readers and find-in-page. |
| Avatar viewer | A card image and a profile portrait are buttons. They open a dialog on the `Sheet` layer (scrim 40, panel 41, toast 60): wheel and two-finger pinch zoom 1–4×, drag pans when zoomed, double-click resets, Escape and Close dismiss. The avatar is a monogram until uploads exist. |
| Catalog | Four-row toolbar (search, tags, sort, preferences); empty tag field means All; tags come from `repo.listTags`; 250ms search settle committed with `commitQuery` (replace), discrete choices with `push`. |
| States | Empty = one sentence + primary action. Loading = skeleton, never spinner. No-results is distinct from empty. Error = factual line + Retry. |
| Auth | `/authentification` reuses `/`'s title-page frame (kicker → wordmark → paragraph → hairline → controls). Redirects are a later access-matrix concern, not a page's. |
| Thread | One composer component for both the page and the cut-attachment sheet; attached cut locks the picker. |
| Tab strips | Every tab carries an icon (`Tabs` buttons and `DiscoverSwitch` links alike). On phones the strip is compact — each tab is its icon, the selected one opens to reveal its label — and it spreads with `space-between`; from `sm` up all labels stay visible and the strip is left-aligned. Counts sit after the label and stay visible. The label reveals by animating a `0fr → 1fr` grid track over 160ms (lands on the text's own width, no `max-width` guess) and the 2px accent tick settles in on mount, because the Discover strip remounts on every route change. |
| Bookmarks | Default tab is the kind of the most recently saved row, Characters when none; tab counts are saved rows, not visible rows. |
| Profile creations filter | The type row (`All / Characters / Lorebooks / Presets`) is one row of compact chips at 12px with control radius 2px — the tag-chip language, not 999px pills — so all four fit at 360 and it never wraps into a 3 + 1 orphan. On phones it is justified edge to edge (`space-between`); from `sm` up the chips are left-aligned. |
| Persona collection and detail | Personas use their own card (avatar, name, tagline, default mark) — no author, ratio or engagement. Delete uses one in-place confirm row, never a dialog. |
| Profile head | On phones the head is the catalogue card's anatomy: a square `fluid` avatar in one half of a `1fr / 1fr` row with name, handle and bio in the other, then the actions and the followers/following figures as full-width rows (actions split the row, figures centred). From `sm` up it is `160px | name block | actions`: the avatar keeps the phone's size, the actions stack, the figures sit under the name, and the avatar is the tallest block, so it reaches the content's bottom with the head's usual 18px gap before the separation rule. |
| Persona create and edit | Tagline is a real field (never an empty string the adapter invents); the form is the preset form minus settings/NSFW plus tagline. |
| Lorebook create and edit | One comma-separated keywords field per entry, not a chip input — an entry's keywords are its own vocabulary. |
| Preset create and edit | Model is a `Select` over the offered models, never free text; the form is one flat list of fields. |
| Session | Restore re-reads the original as it stands and keeps the copy's version; the starting preset is the viewer's most recent, falling back to the newest public one. |
| Avatar | Initials stand in until uploads exist; `fluid` and `hero` leave the box to `styles.css` because both follow their container. |
| Toast | Bottom, above the tab bar; polite live region; three visible; 3.4s lifetime. |
| Sheet | Bottom sheet below 900, centred dialog above; Portal to `body`; Escape + focus trap; scrim 40, panel 41, toast 60. |

---

## 14. New page checklist

- [ ] Route added to `ROUTES` with `path`, `title`, `access`, optional `layout`, lazy import.
- [ ] Page file exports PascalCase component **and** `export default`.
- [ ] Header JSDoc cites the route and what the page owns / does not.
- [ ] `useParams()` / `useQuery()` read once at mount; no `location` parsing.
- [ ] All location writes go through `commitQuery()` or `navigate()`.
- [ ] Every link is `<a href={href(path)} onClick={follow(path)}>`.
- [ ] Loading, empty, no-results, loading-more, end, error and signed-out states are handled.
- [ ] Fetch path has a `seq` guard and a single replace/append shape.
- [ ] View model fields are non-null `track()`s; no nullable read in the template.
- [ ] Live props are `Derived<T> | T` and read with `read()`.
- [ ] Styles are in a scoped `<style>` block; only semantic tokens; 360-first.
- [ ] 44px targets, real headings, labelled controls, keyboard paths.
- [ ] NSFW: chrome crisp, body withheld; numbers never hidden.
- [ ] Gates in §12 run and reported.

## 15. New component checklist

- [ ] It is drawing and behaviour, not a route: no fetch, no store import, no URL write.
- [ ] Reuses an existing primitive instead of forking one; otherwise the header explains the split.
- [ ] Props are an inline type; live values are `Derived<T> | T`; callbacks report.
- [ ] Ephemeral state is local; shared/persisted state is the page's.
- [ ] Shared look goes in `src/styles.css`; component-specific look in a scoped `<style>`.
- [ ] Real elements, labelled icon buttons, 44px targets, focus-visible untouched.
- [ ] Loop keys are stable (`item.id`, not the array index).
- [ ] Copy is factual, one line where possible, and matches the existing voice.
- [ ] Header comment says what it owns, what it does not, and any non-obvious decision.
- [ ] `bun run build` passes, and it was checked at 360/900/1200 in both themes.
