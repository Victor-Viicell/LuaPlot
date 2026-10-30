# Baton — what the next session does

**Ticket: T-02 — Design primitives.**
Why next: every page ticket from T-05 on composes the same eleven components; building them page by
page would fork the button, the field and the sheet four times over. The shell and the route table
now exist (T-01), so there is somewhere to mount a variant gallery.

## Do

1. Build `src/components/` on the tokens already in `src/styles.css` (semantic aliases only):
   - `Button.tsrx` — `primary` (accent fill, `--color-accent-contrast` text), `secondary` (1px
     `--color-border-strong` outline), `ghost`, `danger` (`--color-danger`, destructive only).
     Height 44, radius 2, 14px label, focus ring inherited from the base `:focus-visible`.
   - `Field.tsrx` — label (12px uppercase, `.08em`, `--color-text-subtle`), input/textarea, help
     line, error line in `--color-danger`. Radius 2. No floating labels.
   - `Toggle.tsrx` — the SFW/NSFW and Show/Blur control: 44px row, label + switch, `aria-pressed`.
   - `Card.tsrx` — catalogue card *structure* only (title header / middle / footer row); the NSFW
     blur is T-08. Footer takes `author` + `ratio`, never a comment count.
   - `Sheet.tsrx` — bottom sheet on mobile, centred dialog at `md`. 6px radius, the one sanctioned
     shadow, 180ms `cubic-bezier(.2,.8,.2,1)`, `Portal` to `document.body`, Escape closes, focus
     trapped, scrim `rgb(0 0 0 / .35)`.
   - `Toast.tsrx` — a host plus `toast(message)`; 120ms, no bounce, polite live region.
   - `Tabs.tsrx` — underline tab strip for profile and bookmark tabs; state comes from the caller.
   - `EmptyState.tsrx` — one line of copy + the primary action (DESIGN "States").
   - `Skeleton.tsrx` — `lines` / `block` variants matching the real layout; never a spinner.
   - `Avatar.tsrx` — square, 2px radius, 1px border, initials fallback; no image set yet.
   - `Icons.tsrx` — extend the existing file (7 icons now); keep the one 20px / 1.5 stroke set.
2. Add a dev gallery `/dev/primitives` that renders every variant in both themes at 360 and 1280.
   **Trap:** any path in `ROUTES` that is not in the spec fails `scripts/spec-routes.mjs`. For this
   ticket exclude the dev namespace in the script — filter `r.startsWith("/dev/")` out of the router
   set before comparing, with a comment that `/dev/*` is not a product route. Do **not** add
   `/dev/*` to `src/specs/luaplot-pages.md`, and keep it out of the tab bar.
3. The gallery needs a live theme switch to prove both flavours: set `data-theme` on `<html>`, do not
   add a second stylesheet. If you add a control for it, it is dev-only — keep it off the shell.

## Traps

- `.tsrx` is not JSX: `class` not `className`; control flow via `@if` / `@for` / `@switch` blocks; a
  scoped `<style>` block never reaches into a child component, so a primitive carries its own block
  or takes a class prop (pass a theme's `$class` via `apply` for a shared look).
- `track()` must be created **inside** a component. A module-scope `track()` has no owning block and
  every write to it throws (`Cannot read properties of null (reading 'f')`) while the URL keeps
  changing — that is why `src/router.ts` is a plain subscribe/notify store. A module-level toast
  queue must be created in `App.tsrx` and handed down, or held in a `Context`.
- `aria-*` props take `undefined`, not `null`, when the attribute should be absent.
- `<style>` never styles the element that contains it; a block inside `@if`/`@for` still ships.
- Tap targets ≥ 44px, labels ≥ 12px. A 44px button is the floor, not a guide.
- `scripts/check.sh` is the gate: typecheck + build + `spec-routes.mjs`. It must print GREEN.

## Open decisions

- Toast placement: bottom above the tab bar, or top under the bar. Pick one, record it in
  `docs/DESIGN.md`, and put toast and sheet on the same z-index ladder.
- Does `Tabs` own the query-string write or does the page? Default: the page owns the query (spec:
  tabs live in the query string), `Tabs` only renders and calls back.
- JEV's route is settled: `typesafe/jev-1.14` on the OpenRouter decisions endpoint, question set in
  `docs/JEV.md`. T-27 implements it; do not re-open the model choice.
- Tag taxonomy still undecided (no tags row yet), Stripe surface still undefined, Supabase project
  still unprovisioned (memory adapter remains the truth).

## Found while working

- `scripts/spec-routes.mjs` normalised `:name` on one side and `[entity.field]` on the other, so no
  route spelling could pass both checks. Fixed in T-01: `norm()` folds both shapes to `:p` and both
  sets are compared through it.
- Ripple `track()` at module scope is a silent trap: reads work, the first write throws and the app
  stops updating. Keep module state plain and mirror it into a component-scoped `track()`.
- `document.title` shows a leading emoji when read through the browser tooling — the automation
  harness marking its tab, not app output. Do not chase it.
- A `docs/JEV.md` commit landed mid-session (15:57) from outside this tick; it touched `NEXT.md`
  only. No conflict, but treat the tree as shared and re-read before rewriting docs.
