# Baton — what the next session does

**Ticket: T-04 — Session + NSFW preference state.**
Why next: every page from T-05 on asks "who is this, and may they see this" before it asks
anything else. `App.tsrx` still hard-codes `SELF_HANDLE = "you"` for the profile tab, the adapter
answers for a module constant `VIEWER = "you"` (`src/lib/data/memory.ts`), and every route declares
an `access` value that nothing reads. Build the two stores now, or ten pages will each invent their
own idea of "signed in".

## Do

1. `src/lib/state/session.ts` — a plain subscribe/notify store, modelled on `src/lib/toast.ts` and
   `src/lib/router.ts`, **never** a module-scope `track()`:
   - `currentUser(): User | null` (handle + display name + `isAdmin`, all mock: `you`, admin false),
   - `isSignedIn()`, `signIn()`, `signOut()`, `onSession(listener)`.
   - Seed signed in: every fixture is owned by `you`, and the preview is worth opening signed in.
     `signOut()` forces the signed-out states pages must render; the switch has to live somewhere
     reachable in the shell (overflow menu) so a reviewer can flip it in two taps, and it must be
     labelled as a dev affordance, not a product control.
   - `access` enforcement is **not** this ticket (T-30 owns the redirect matrix). Do not add
     redirects to `router.ts` here; just make the state readable.
2. `src/lib/state/prefs.ts` — Show NSFW / Blur NSFW, per account, **persisted in the adapter**:
   - `nsfwPreference(): { show: boolean; blur: boolean }`, `setShowNsfw(bool)`, `setBlurNsfw(bool)`,
     `onPrefs(listener)`. Same store shape. Blur is only meaningful while Show is on (the spec's
     two controls are independent toggles, so keep them independent and let the page decide).
   - Add the persistence to the seam, not to `localStorage`: `resume/save` go through
     `repo.getPreferences(handle)` / `repo.savePreferences(handle, patch)` in `repo.ts` +
     `memory.ts` (a map keyed by handle). `docs/ARCHITECTURE.md` gets the two new methods in the
     same commit.
   - Signed out: both off, and `prefs.ts` must return `{ show: false, blur: false }` without a
     signed-in user. The signed-out control that leads to sign-in is a page concern (T-25).
3. Wire the shell: the profile tab's handle comes from `currentUser()` (falling back to `/` when
   signed out instead of `/user/you`), and `nsfwPreference()` gains a visible readout only where it
   already exists — do **not** build a settings page (T-23).
4. `src/pages/dev-state.tsrx` — `/dev/state`, third dev route: current user, the two prefs, the
   store's notification count, and buttons that flip sign-in and both prefs. Add the route to
   `ROUTES` only. Use `Toggle` for the two flags and `Button` for the session switch; no new look.

## Traps

- **`track()` at module scope throws** the first time anything writes to it. This is why `toast.ts`
  and `router.ts` are subscribe/notify stores and why `App.tsrx` mirrors one into its own tracked
  value. Both new stores must follow that shape exactly.
- **Do not import `track` in `session.ts`/`prefs.ts`** and do not make the module state reactive
  "just this once".
- **Preferences are per account**, so `prefs.ts` re-reads them on sign-in/sign-out; a stale Show
  flag surviving an account switch is a bug the specs call out (per-account, not per-device).
- **`repo.ts` is the only place with data access.** `prefs.ts` calls the adapter; it does not touch
  `localStorage` or a fixture.
- **A `.tsrx` statement container crashes on `try`/`catch`.** `tsrx-tsc` reports a bogus
  `'{' or ';' expected` at the `@{` line and a `No source map entry` warning; the real cause is a
  `try` block in the setup. Use `.then(onOk, onFail)` (App's load path does this) or a helper that
  already returns a promise. Costs an hour if you do not know it.
- **A `@if`/`@else` branch renders exactly one node**, and a `<style>` block must be a child of an
  element or fragment: wrap both in `<>…</>`. The error ("A code block renders a single node") only
  appears once the transform stops choking on the `try`.
- Component files need `export default Component;` or the router's lazy import fails to typecheck
  (`PageModule` requires a default export).
- `/dev/*` is already filtered out of `scripts/spec-routes.mjs`; adding a route to `ROUTES` is
  enough, and the spec index must stay untouched.

## Open decisions

- Whether "signed in" should start true in the preview. Default here: yes, because every fixture is
  owned by `you`; flip it if the catalog starts looking empty.
- Where the sign-in/sign-out dev switch lives: overflow menu vs `/dev/state` only. Default: both,
  with `/dev/state` as the honest one.
- Supabase adapter still unprovisioned, so preferences persist in memory only — a reload resets
  them. Do not fake persistence with `localStorage` "just for the preview"; that would make the
  pages depend on something the real client will not provide.
- Tag taxonomy still undecided (keep `tags` empty), Stripe surface still undefined.

## Found while working

- **The vote/comment counts in a fixture must never be authored.** `memory.ts` recomputes
  `commentCount` and every `replyCount` from the thread on load, so a fixture that says
  `commentCount: 3` while three comments carry a different `itemId` cannot drift. Keep that.
- **`ratioOf()` is a function, not a field.** `/dev/data` proves it: vote once and the card's
  percentage moves without any stored value changing.
- **A memory-adapter mutation mutates the row in place**, so a snapshot you already hold shows the
  post-mutation numbers. Read counts into locals *before* `await repo.vote(...)` if you are going to
  print "before → after".
- **One fixture lorebook is deliberately private** (`Unfiled Notes on the Ninth`, `isPublic: false`),
  which is why the catalog shows 5 of 6 and why session 2's copy of it is `unlinked`. Both are the
  states T-08 and T-15 have to prove; do not "fix" them.
- `publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.
