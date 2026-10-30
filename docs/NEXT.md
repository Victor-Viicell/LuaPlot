# Baton — what the next session does

**Ticket: T-05 — `/` home.**
Why next: it is the first page and the entry point every reviewer opens; T-04 just made
`currentUser()` real, and home is the only page whose whole spec is "the session state and two
links". It also proves the two stores are reachable from a page outside `/dev/*` before T-07
onboarding and T-23 settings depend on them.

## Do

1. Replace `src/pages/home.tsrx`'s `PagePlaceholder` with the real page
   (`src/specs/pages/home.md` — it is short, read all 29 lines):
   - **One screen, no sections**: the product name, one short paragraph saying what Luaplot is, the
     entry control. No hero, no feature blocks, no marketing narrative — the spec forbids them by
     name.
   - **Signed out** → the control links to `/authentification`. **Signed in** → it links to the
     viewer's own profile, `href(\`/user/${user.handle}\`)`.
   - The page **renders for a signed-in visitor** instead of redirecting: the control is the way in.
   - Reads the session only. No listings, no counts, no content rows — `home.md` → Data.
2. Mirror the session store into a local `track()` (`onSession`), the way `App.tsrx` and
   `/dev/state` do. `currentUser()` is a snapshot; a page that calls it once in setup will show a
   stale control after the dev sign-out in the overflow menu.
3. Layout: `docs/DESIGN.md` — mono, 16/24/32 gutters, one accent on the primary action, first
   screen at 360×740 with **no scroll**, nothing that reads as a stretched phone at `lg`
   (the outlet is already 1120 max; a single short column should sit in a deliberate measure, not
   stuck to the left edge).
4. Two states only, both must be checkable: signed out (signed-out copy + Sign in) and signed in
   (greeting with the handle + Open profile). Use the real `Button` primitive; a link styled
   `class="btn btn-primary"` is the established pattern (`/dev/state` does it).

## Traps

- **`track()` at module scope throws** on the first write. Session is a subscribe/notify store;
  mirror it inside the component or the control never updates.
- **A `.tsrx` statement container crashes on `try`/`catch`** (bogus `'{' or ';' expected` at `@{`).
  `.then(onOk, onFail)` or nothing — home reads no async data, so it should need neither.
- **`@if`/`@else` renders exactly one node**; a multi-child branch needs `<>…</>`. A `<style>` block
  must be a child of an element or fragment.
- Component files need `export default Home;` — the router's lazy import typechecks `PageModule`.
- **Do not add a redirect for signed-in visitors** and do not touch `access` in `router.ts`; the
  redirect matrix is T-30 (`docs/ARCHITECTURE.md` → Session).
- The shell already sets `document.title` per route; do not set it on the page.

## Open decisions

- Whether the signed-in greeting names the handle (`@you`) or the display name (`You`). Default:
  display name in the copy, handle only in the link target — the profile page owns the handle.
- Whether home keeps a secondary link to `/terms`. The spec names one control; **leave it out** and
  let `luaplot-pages.md` (which links terms from the overflow menu) stand.
- Preferences still reset on reload (memory adapter, no Supabase ref). Do not fake persistence.
- Tag taxonomy still undecided (keep `tags` empty), Stripe surface still undefined.

## Found while working

- **`session.ts` seeds `you` signed in**, and the overflow menu carries a *Preview only* switch that
  flips it. `/dev/state` is the honest one: it shows the pair, the two emit counters, and the
  toggles. Neither is a product control; T-30 deletes both.
- **`prefs.ts` clears to off before every read**, so a switch never renders the previous account's
  flags. Verified: Show+Blur on → sign out (both read off, toggles disabled) → sign in → pair
  restored from the adapter, because prefs are keyed by handle and not by device.
- **`savePreferences` returns the whole pair**; a caller that merges a partial into its own state
  will drift from the adapter the first time two fields change in one step.
- **The memory adapter's `VIEWER` is still a constant.** Signing out hides nothing in a listing —
  that is T-30, not a bug. Do not "fix" it by importing the session into `memory.ts`; it makes
  `repo → memory → session → prefs → repo` a module cycle.
- **`PAGE_SIZE`/`ratioOf`/counts rules are unchanged** and still true: fixture counts are never
  authored (`memory.ts` recomputes `commentCount`/`replyCount` from the thread); `ratioOf()` is a
  function, not a field; a memory-adapter mutation mutates the row in place, so read counts into
  locals *before* `await repo.vote(...)` if a page prints "before → after"; one fixture lorebook is
  deliberately private (`Unfiled Notes on the Ninth`) — do not "fix" it.
- `publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.
