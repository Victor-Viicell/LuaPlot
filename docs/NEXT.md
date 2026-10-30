# Baton — what the next session does

**Ticket: T-07 — `/onboarding`.**

Why next: it is the last dead end in the entry flow — `/authentification` now links straight to it
(T-06), and a new account's first screen is otherwise a placeholder. It is also the first page that
**writes an account**, and the data contract has no write for one: `repo.ts` can read preferences and
mutate content, but there is no `saveProfile`, no `isHandleTaken`, and `session.ts` has no way to
change a display name. Define those three against one real form now, or T-30's redirect matrix will
invent them from scratch. The handle rules are also the first mechanically checkable validation in
the repo (`3–24`, `[a-z0-9_]`, case-insensitive uniqueness), which makes the ticket easy to prove.

## Do

1. Read `src/specs/pages/onboarding.md` (36 lines) — it is the shortest and strictest page spec in
   the repo — plus `src/specs/luaplot-pages.md` §Conventions for why there is no reserved-word list.
2. Extend the **data contract** before the page, in the same commit as `memory.ts`:
   `isHandleTaken(handle): Promise<boolean>` (case-insensitive across accounts, never across the
   viewer's own current handle) and `saveProfile(patch: { handle, displayName }): Promise<User>`.
   Every method stays `async`, there is still no error envelope (`ARCHITECTURE.md`), and both go in
   the memory adapter with a fixture-safe answer. Document the pair in `ARCHITECTURE.md` → data, and
   say in the type comments that `supabase.ts` (T-30) must implement them.
3. Decide how the saved account reaches `session.ts` and **record it in `DESIGN.md`**: `signIn()`
   fabricates `MOCK_USER.displayName`, so a saved display name silently disappears unless the store
   grows a mutator (e.g. `setAccount({ handle, displayName })` that emits like `signIn` does).
   T-30 replaces the body; the signature is what matters.
4. Build `src/pages/onboarding.tsrx`. This is the **first form page**, not a title page: the shell's
   top bar already says *Onboarding*, so the page opens with a 12px kicker, a 26px `/ 34px` title,
   one line of copy, a hairline, then the form — same rule + spacing language as `/` and
   `/authentification`. Two `Field`s (username, display name), two `Toggle`s (Show / Blur NSFW,
   through `lib/state/prefs.ts`, never page-local booleans), then `Finish`.
5. Validation is **one pure function** (`lib/validate.ts` or a local `readHandle()`), used by both
   the inline error and the Finish gate, so the two can never disagree. Rules: lowercase letters,
   digits, underscores, 3–24, lowercased on save; empty display name is invalid. Copy: the spec's
   `Username taken` verbatim (and it names no alternative), and one format line of your own that the
   spec does not dictate — keep it factual, e.g. `Lowercase letters, digits and underscores, 3–24
   characters.`
6. States: first visit (empty, Finish disabled), resumed after abandonment (values restored from the
   adapter), username taken (inline on the field, Finish stays disabled), invalid username (same
   place). Finish writes the whole form and then lands the visitor on entry content — recommended
   target `/user/<handle>`, the same screen T-05's control opens once signed in.
7. `docs/DESIGN.md` gains an "Onboarding (decided in T-07)" section in the same commit: the page is
   a form page, the label/error/toggle order, where `Finish` sits relative to the tab bar, and the
   draft-persistence decision you take in step 8. `docs/SHIP-PLAN.md` tick + `docs/PROGRESS.md`.

## Traps

- **`repo.ts` has no profile write and no handle lookup.** Adding them is this ticket's real work;
  the page is the easy half. Do not fake the uniqueness check in the page by scanning
  `listPersonas` or a fixture array — the adapter owns that rule, exactly like one-vote-per-viewer.
- **`Field.disabled` and `Toggle.disabled` still take plain booleans.** T-06 gave `Button`
  `disabled: boolean | Derived<boolean>` (read through `read()` inside its own render); the other
  two primitives were left alone on purpose. A `Finish` that disables on live validity must be a
  `Button` — if a field needs a live `disabled`, fix that primitive first and record it.
- **The "abandoned first run keeps what was typed" line is load-bearing.** "The whole form is
  written in one save" and "the entered values are restored" cannot both be true of a Finish-only
  write. Recommended: one draft write (`saveProfile` + preferences) on a 250ms debounce or on blur,
  and `Finish` = the same write plus whatever marks the account onboarded. Whichever you pick, write
  it down — the next form page will copy it.
- **The session store loses the display name.** See step 3; a page that only calls
  `session.signIn(handle)` will show `You` everywhere afterwards.
- **The NSFW pair is per account and already has a store** (`lib/state/prefs.ts`,
  `setShowNsfw` / `setBlurNsfw`). Page-local booleans would pass a DOM check and still leave
  `/dev/state` and every listing wrong.
- **This page is allowed to scroll.** Five rows, help lines and inline errors do not fit 360×740 —
  the zero-scroll rule belongs to `/` and `/authentification`. What matters is that `Finish` is
  reachable and never hidden under the 60px tab bar + safe area, and that no field is pushed under
  the keyboard (a phone webview crops ~40% of the viewport).
- `track()` at module scope throws (no owning block). Inside the component only.
- A `.tsrx` statement container crashes on `try`/`catch` around `@{` blocks: use `.then(onOk, onFail)`.
- A `<style>` block must be a child of an element or fragment, and the file needs
  `export default Onboarding;` for the router's `PageModule` typecheck.
- Headless Chromium screenshots freeze entrance animations at opacity 0 — verify by reading the DOM.
- **A hidden tab clamps timers**: a 600ms resolve measured ~1.4s in the CDP-driven browser (T-06).
  Never conclude "the state never arrives" from a 700ms wait.

## Open decisions

- **Where `Finish` lands.** Recommended `/user/<handle>` (entry content, and the handle is the one
  URL the account has). The redirect matrix is T-30 and out of scope here.
- **Whether the page keeps the title-page shape** (wordmark + paragraph, like `/` and
  `/authentification`) or becomes a plain form page. Recommended: form page — a form under a 34px
  wordmark reads as a marketing screen, and the shell already supplies the title.
- **Draft persistence granularity** (blur vs debounce vs Finish + localStorage). Recommended:
  debounce through the adapter, so "resumed" is honest and nothing is written twice.
- **Whether the handle is checked on blur as well as on submit.** Recommended: both — one check per
  blur is not per-keystroke, so the 250ms debounce rule is satisfied.
- Preferences still reset on reload only where nothing writes them; the adapter keeps them per
  handle, so a finished onboarding should survive a reload. Do not fake Supabase persistence.
- Tag taxonomy still undecided (keep `tags` empty); Stripe surface still undefined.

## Found while working

- **A live `disabled` needs the derived, not the value.** `disabled={busy.value}` at a call site is
  frozen at mount — props are evaluated once. T-06 fixed `Button`; `Field`/`Toggle` still have the
  trap, and any page that gates a submit on validity will meet it.
- **`Continue with {name}` renders `Continue withGoogle`.** JSX text before an expression loses its
  trailing space; use one template literal. Check the rendered `textContent`, not the source.
- **The failed state is the height test, not the idle state.** A 20px status line that grows to the
  retry button's 44 fits; the same line stacked above the button adds ~56 and scrolls at 360×740.
- **Measured, not guessed:** at 360 the outlet is 328px and 14px mono is ~8.4px/char, so a 44ch
  paragraph is 3 lines and ~39 chars wrap per line. That arithmetic is what decides whether a block
  fits a 512px content area — do it before writing CSS.
- **Rules wider than the measure** is the house look (home's hairline spans 560 while the paragraph
  holds 44ch), so capping `.providers` at 420 and leaving `.gate` full width is correct, not sloppy.
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair and the emit counters. Neither is a product control (T-30
  deletes both).
- `publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.
