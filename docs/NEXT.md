# Baton — what the next session does

**Ticket: T-06 — `/authentification`.**

Why next: `/` now hands every signed-out visitor to this route (T-05), so it is the only dead end
left in the entry flow: tap **Sign in** on the live preview and you land on a placeholder. It is also
the first page that needs an **auth seam**, which does not exist yet (`src/lib` has no `auth.ts` and
`lib/data/supabase.ts` was never written) — better to define that seam against one real page than to
invent it later inside T-30's redirect matrix.

## Do

1. Read `src/specs/pages/authentification.md` (30 lines) and `src/specs/pages/onboarding.md` §Purpose.
   The spec is short and strict: **three provider buttons** (Google, GitHub, Discord), no password
   field, no reset flow, no provider management, no email/name fields.
2. Create `src/lib/auth.ts` — the seam. Shape it so T-30 can swap the body and keep the signature:
   `signInWithProvider(provider: Provider): Promise<AuthOutcome>` where
   `Provider = "google" | "github" | "discord"` and
   `AuthOutcome = { status: "redirecting" } | { status: "cancelled" } | { status: "failed"; reason: string }`
   (an `ok` status only means something once Supabase exists — leave it out rather than fake a
   signed-in session; `session.signIn()` must not be called by this page).
   Preview body: no network, resolve `cancelled` after ~600ms, and never touch `session.ts`.
3. Build the page in `src/pages/authentification.tsrx` as the **same title page as home** (kicker →
   wordmark → one paragraph → hairline → the controls), so the two entry screens read as one
   sequence. Three `Button` primitives with `block` on mobile, the product name nowhere in the button
   labels: `Continue with Google` / `Continue with GitHub` / `Continue with Discord`.
4. States, all reachable and all honest:
   - **Redirecting to provider** — the pressed button goes `disabled`, all three disable (one attempt
     at a time), the label stays put and a 12px line reads `Redirecting to Google…`. No spinner.
   - **Provider cancelled** — inline line in `--color-text-muted` + the buttons re-enabled.
   - **Callback failed** — inline error in `--color-danger` (one of the three sanctioned uses) with a
     `Try again` action.
   - **Onboarding incomplete** — a plain link to `/onboarding` is enough; do not build the gate.
   Put the state in one `track<AuthStatus>` and derive the copy; do not scatter booleans.
5. Record the layout choice in `docs/DESIGN.md` under a new "Auth (decided in T-06)" section **in the
   same commit** — `authentification.md` says `_To be specified_`, and CONTRACT.md requires the
   decision to live there so the next page does not re-invent it.
6. `docs/SHIP-PLAN.md` tick + `docs/PROGRESS.md` entry, as always.

## Traps

- **`access` says "signed-in visitors redirected away" — do not implement it.** The redirect matrix
  is T-30 (`ARCHITECTURE.md` → Session), and `session.ts` is seeded signed in, so an eager redirect
  would make the page unreachable in the preview. Render the page for everyone; note the gap.
- **Do not call `signIn()` on success.** A preview stub that signs the mock user in turns the page
  into a fake callback and hides the states the spec asks you to show.
- **`track()` at module scope throws** (no owning block). Inside the component only.
- **A `.tsrx` statement container crashes on `try`/`catch`** around `@{` blocks: use
  `.then(onOk, onFail)` on the seam's promise.
- A `<style>` block must be a child of an element or fragment; a `.tsrx` file needs
  `export default Authentification;` for the router's `PageModule` typecheck.
- **`min-height: calc(100dvh - …)`**: reuse home's numbers (228 / 240 / 132 / 144) — they include the
  scroller's own 60px tab-bar clearance, which is easy to forget, and they are what makes
  "no scroll at 360×740" true. Verify with `scrollHeight == clientHeight`, not by eye.
- Headless Chromium screenshots **freeze CSS entrance animations at opacity 0**, so a capture can
  look like "content failed to load" while the DOM is perfect. Verify states by reading the DOM, or
  capture with animations disabled.
- The `Preview mode` chip convention (T-16, `ARCHITECTURE.md`) is not built yet. One `12px
  --color-text-subtle` line saying the preview contacts no provider is enough; do not invent a chip.

## Open decisions

- **How the three states are reached in the preview.** Recommended: make the stub deterministic and
  its outcome switchable through one query value on the page (`?provider=cancelled|failed`), used
  only while the provider is a stub — that keeps the product surface at exactly three buttons while
  letting a reviewer see every state. Whatever you choose, it must be visible from `/` in two taps.
- Whether the signed-out copy mentions the terms out loud. `luaplot-pages.md` links Terms from the
  overflow menu; keep the page to the spec's three actions and no legal line.
- Whether the three buttons carry brand marks. There is one 20px stroke icon set and no brand assets;
  **text-only labels** keep it consistent until someone draws real logos.
- Preferences still reset on reload (memory adapter, no Supabase ref). Do not fake persistence.
- Tag taxonomy still undecided (keep `tags` empty); Stripe surface still undefined.

## Found while working

- **The shell's scroller carries 60px of tab-bar clearance as its own padding** (`.content`), on top
  of the 60px tab bar and the outlet padding. Any page that wants "one screen, no scroll" has to
  subtract all of it; both of my first two attempts scrolled by exactly 60px because of it.
- **`document.title` for `/` is `LuaPlot`** and the shell already owns it — the page must not set a
  title (T-05 trap held true).
- **`space-between` on a short first screen reads as a hole, not as a composition.** The title page
  went to `justify-content: center` after looking at a 360×740 capture; a control pinned to the very
  bottom reads as an account footer. Worth remembering for `/onboarding` and `/terms`.
- **Copy fixes the silhouette.** A 4-line paragraph ended in a 15%-wide runt line; measuring wrapped
  line widths in the browser and rephrasing to a 3-line 82% shape fixed it without touching CSS. Do
  that again rather than fiddling with `max-width`.
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair and the emit counters. Neither is a product control (T-30
  deletes both).
- `publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.
