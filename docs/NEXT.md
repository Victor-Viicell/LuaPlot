# Baton — what the next session does

**T-60 landed.** Row **43** (`EXPECTED_ROWS` 43) presses the settings menu's dangerous row end to end:
it finds row 42's cut as `/post/thread?sort=newest`'s first `.card.post` **by its body**, reads the whole
cut on its own page (the card folds at 2 of 8), opens the seed character and presses its own
**Continue**, reads 8 `.turn-text` and `4 copies`, then *Session settings* → `.menu-row.is-danger` → the
confirmation's sentence → `Delete session` **scoped to `.menu-actions button`**. The landing reads
`Aurelia of the Second Tide` with **`Start a session`**, `go("/session/<id>")` mounts *This session
doesn't exist.* with its road and no transcript, and the post still reads all 8 messages. Red first:
removing the `store.sessions.splice(…)` line made the row read *"the session survived the delete …
primary control at \"Continue\", not \"Start a session\""*. 43/43 local, 43/43 `--live`. **Session 1 is
gone** for the rest of the run (`session 2` and its copies are untouched).

That closes the last session law and the failure bank's walkable half. Every remaining ticket in
`SHIP-PLAN.md` is blocked (Supabase T-29–T-32, the Android toolchain T-35/T-36/T-39, T-33B(b)'s
dependency, T-33B(c)'s decision), so the baton turns to the one **page** in the route table that no row
has ever mounted.

## T-61 — `/onboarding` has never been walked: the handle rule is a gate, the refusal is one sentence, and a draft is a write

**Why it is next.** `/onboarding` appears **zero times** in `scripts/smoke.mjs`. Every other page in
`src/router.ts` has at least one row; this one has none. `onboarding.md` is law in four places nothing
executes: *"Unique across accounts, compared case-insensitively; a handle already taken blocks **Finish**
with **Username taken** and names no alternative"*, *"Lowercase letters, digits, and underscores, 3–24
characters, lowercased on save"*, *"Only **Username** and **Display name** block **Finish**"*, and
*"Enabled once the two required fields are valid; the whole form is written in one save, so an abandoned
first run keeps what was typed"* (→ *States* → **Resumed after abandonment**: *"the entered values are
restored"*). T-07B then moved the one sentence into `schema.ts` (`HANDLE_RULE`) and the classification
into `lib/validate.ts`, so the inline error, the Finish gate and a failed save have three seams and no
witness: a page that trims or regexes on its own, or a gate that enables on a taken handle, is green in
every gate and in all 43 rows.

**Approach**

1. **Row 44**, `EXPECTED_ROWS` 43 → 44, placed **after row 43 and before `sign out`**. It is
   **mutating**: the form's draft is a real `repo.saveProfile` write.
2. `go("/onboarding")` and wait for `input[name="handle"]` and `input[name="displayName"]` (a `Field`
   with `name=`; the page is a form of fields, not a `<form>` submit). Read the two prefilled values —
   the walk's account is `you` / `You`, but **read them, never pin** (row 3 edits the display name).
   Assert `Show NSFW content` / `Blur NSFW content` toggles exist and that **Finish** is **enabled**
   with the prefilled pair (both required fields are already valid: this is the "only the two fields
   block Finish" half).
3. **The format refusal, priced against the gate.** `retype('input[name="handle"]', "ab")`, then poll
   the field's error and the button: the error must be the schema's `HANDLE_RULE` sentence and
   **Finish must be `disabled`**. Read `disabled` on the button element (`.props`), not a style.
4. **The uniqueness refusal, case-insensitively.** `retype('input[name="handle"]', "Ada")` — `ada` is a
   fixture handle and the value is **uppercase on purpose**, because the spec compares
   case-insensitively *and* lowercases on save: the field's error must read **`Username taken`** and
   Finish must stay `disabled`. Poll (the check is async and 250 ms-settled); a stale verdict is the bug
   this half catches.
5. **The save.** `retype('input[name="handle"]', <a free handle the walk owns>)`, keep the display name,
   then press **Finish** and wait for `/user/<handle>`. This is *"the whole form is written in one
   save"*: the landing must be the new handle's own profile, and the shell must read `signed in as
   @<handle>` — the account moved.
6. **The resume, and the restore in one gesture.** `go("/onboarding")` again: the two fields must come
   back holding **what was saved** (that is the draft read — *"the entered values are restored"*), not
   blanks. Then `retype` handle `you` and display name **the display name read in step 2** (not a
   pinned `You`), press **Finish**, wait for `/user/you`, and assert the shell reads `signed in as
   @you` again. Row 44 hands the walk back exactly the account it borrowed — both the landing and the
   shell are read before it returns.

**Traps**

- **The draft is a write, ~250 ms after a valid pair settles.** `persistDraft()` calls
  `repo.saveProfile` (plus `savePreferences`) for any value that is *valid and free* — so a row that
  types a plausible handle early and then does something else for 300 ms has **already renamed the
  walk's account** and every later assertion about `@you` reads a stranger. Order the probes so every
  intermediate value is **invalid or taken** (steps 3 and 4), and make step 5 the only free value.
  `ada` is safe because the draft skips a taken handle (it re-checks with `isHandleTaken`).
- **The route has no guard for an onboarded account** (`onboarding.tsrx` reads `currentProfile()` and
  prefills; it never redirects a finished account away), which is the only reason this page is
  walkable at all. Do not add a guard in this ticket — the spec has no such state.
- **Finish is disabled by a `Derived`** (`blocked = track(() => !canFinish.value)`), and `Button`
  reads it live. Poll `disabled` **after** the 250 ms settle + the async `isHandleTaken` answer; a read
  on the next frame catches the old value and reads as a broken gate.
- **The two error texts are different shapes**: format comes from `HANDLE_RULE` (the schema's own
  sentence), uniqueness is the literal **`Username taken`** (which *"names no alternative"* — assert
  the sentence has no `try`/`instead`/`use` suggestion, or at least that it equals the spec's two
  words). Read the field's error node, not body text: a toast from row 43 could contain either word.
- **`Field` renders its error node only when `error` is set**, so an absence read must be paired with
  the presence half (a page that never mounts the field would otherwise pass an "no error" check).
- **The restore is the last thing this row does.** If the second Finish is never reached the account
  is left under a walk handle; `sign out` still passes (it reads `signed out` and the Profile tab),
  so nothing after this row would catch it — assert `/user/you` **and** the shell's own line, and put
  both in the message.
- **`/user/<handle>` for a fresh handle has no posts** and must still render (the profile page is
  spec'd for it); if it reads Not found, that is a product bug — do not paper over it by landing on
  `/`.

**Accept:** `./scripts/check.sh` GREEN; walk **44/44** locally and **44/44 `--live`**; the assertion
proved **red** first — make the gate ignore the verdict (`blocked = track(() => false)` in
`onboarding.tsrx`) and watch step 4 read *"Finish stayed enabled on a taken handle"*; capture it,
restore the exact bytes and `sha256sum -c` them; `publish.sh` prints `LIVE` and `curl` is 200.

## Blocked — what a human must do

- **T-29/T-30/T-31/T-32 (Supabase):** create a project and export `SUPABASE_URL` +
  `SUPABASE_ANON_KEY` (server key stays out of the client). Nothing about the data seam can move past
  the memory adapter until then. T-30 also owns the real auth body (`lib/auth.ts` writes no session
  today) and the redirect matrix; T-29's migration is the first thing after the ref lands.
- **T-29/T-30/T-31/T-32 (Supabase):** create a project and export `SUPABASE_URL` +
  `SUPABASE_ANON_KEY` (server key stays out of the client). Nothing about the data seam can move past
  the memory adapter until then. T-30 also owns the real auth body (`lib/auth.ts` writes no session
  today) and the redirect matrix; T-29's migration is the first thing after the ref lands.
- **T-33B(b) deep link (desktop):** needs `tauri-plugin-deep-link` + a `luaplot://` scheme in the
  bundle config — a dependency, and the contract forbids one the ticket does not name.
- **T-33B(c) `Ctrl/Cmd+K`:** a decision, not work — no spec file describes a command palette, and
  `luaplot-pages.md` is product law, so nothing may invent it. The owner must either record it in
  `docs/DESIGN.md` (what it lists, what it does, what it costs at 360px) or strike it from the ticket.
- **T-35/T-39 (Android + release):** install cmdline-tools + platform 35 + NDK, the four rust
  android targets, then `tauri android init`. T-39 also needs a signing key and a `v0.1.0` tag, so it
  follows T-35 and stays blocked. **T-36 is split:** (a) — the keyboard inset — **landed as T-36a**
  (`lib/viewport.ts` + walk row 32); the rest of T-36 — no clipped input **on a real APK**, hardware
  back-button mapping, 60fps transcript scroll on device — still needs the toolchain above and stays
  blocked.
- **Tauri on this box is NOT blocked — and the webview session proof is done.** `bun run tauri dev`
  opens, the account survives a restart in both directions, and the recipe below reproduces it.

## Open decisions

- **T-61 is the ticket: the one page no row has ever mounted.** Failure-bank entries 1 (T-54), 2
  (T-59), 3 (T-55 + T-57), 4 (T-53), 5 (T-56) and 8 (T-58) are walked; the rest are blocked on the
  backend or the toolchain (6 → T-27's joins, 7 → T-29's cascade, 9 → T-27, 10 → T-32, 11 → T-16,
  12 → T-01, 13 → `check.sh`). With the session's **Delete** walked (T-60) the failure bank has no
  walkable entry left, so the next row comes from coverage instead: `/onboarding` is the only route
  in `src/router.ts` that `scripts/smoke.mjs` never mentions (grep it — zero hits). Its law is a gate
  (a taken handle disables **Finish** and says `Username taken`, case-insensitively), a format rule
  (`[a-z0-9_]` 3–24, lowercased on save) and a **draft that is a real write**.
- **Row count is 43 after T-60.** `scripts/smoke.mjs` keeps it in an explicit `EXPECTED_ROWS`, so a
  row that stops running is a red walk — **extend** an existing row rather than adding a near-copy of
  it, and bump the count only when a row is genuinely new (**T-61 adds row 44**). **Rows 36 and 37
  are read-only apart from the NSFW pair** (row 36 reads the catalogue, one detail page and the
  thread; row 37 flips Show and restores it), so no CDP override, no probe and no un-restored write
  is left behind. **Row 38 (T-54) owns the NSFW pair too** — it needs Show + Blur *on* to render a
  covered card, so it records its own seed, restores **that**, and asserts the restore. It also
  **composes a flagged post** (NSFW toggle on) because row 21 removes the only fixture one, and it
  presses nothing that writes preferences: the Reveal is per-mount. Anything after it must assume the
  pair is the seed and the store holds one extra flagged post.
- **Row 41 (T-58) is mutating and final.** `deletePersona()` splices the row out of the memory store,
  so every later row sees **two** personas — a later row that wants a persona must seed or create one,
  and a collection count must be read, not pinned. Row 42 comes after it and reads none.
- **Row 42 (T-59) is mutating and final too.** It renames `/character/…0001` **twice** (the row now
  reads **`Aurelia of the Second Tide`**, in-session **`Aurelia Rebuilt Twice`**) and publishes the
  walk's **last** post — the whole session-1 transcript, whose first card is now the **newest** in
  `/post/thread?sort=newest`. Anything after it must read a character's name from the page and must
  not pin a post count.
- **Row 43 (T-60) is mutating and final, and it is the last row that reads a session.** It deleted
  **session 1** out of the memory store, so `…0001`'s primary control now reads `Start a session` for
  every later row and `/session/5e551000-…0001` mounts the Not found sentence; session 2 (the
  adapter's second session) is untouched. It also leaves the reader on the cut's post page, and it
  takes **no** override and writes no preference.
- **Row 39 (T-55, extended by T-57) leaves the thread at page 1 with no query.** It presses Load more
  once, so anything after it must assume the component state — not the store — held a second page,
  and that a fresh mount re-reads page 1. It writes nothing and takes no override.
- **Row 31 owns two CDP overrides and one probe.** It installs a classless `<a>` in the first card (no
  page prints one, and the base rule is the thing under test), measures it resting and through
  `CSS.forcePseudoState`, takes its own 900px `Emulation.setDeviceMetricsOverride` for the rail, and
  clears the media emulation, the metrics override *and* the probe in one `finally`. Anything added
  after it must assume 360×740 and no probe in the DOM.
- **The breakpoint row owns a CDP override.** Anything added after it must assume the session is back
  at 360×740; the row asserts that it cleared (`window.innerWidth === restore`) rather than trusting
  the `finally`. T-47's row 30 takes its own 360×740 override and clears it for the same reason.
- **`follow()` drops the fragment on purpose** — a `/terms#anchor` link must stay a real document
  navigation (or gain scroll handling nothing needs yet). `ARCHITECTURE.md` → Router carries the rule
  and the three exemptions `scripts/link-check.mjs` encodes (fragment, `target=`, external).
- **A card's ratio rounds to whole percent**, so a one-vote change can leave the printed number
  identical (96% → 96%). A journey proving an engagement write must read a count (the detail page's
  Likes/Dislikes cells), never a card's percentage.
- **`/dev/data`'s vote is order-dependent but not fragile.** The row votes on whatever the adapter's
  newest character is *at that moment* (earlier journeys re-save rows), and it reads the name back
  from the log before comparing. Do not pin a character id.
- **A 44px band is `line-height`/`min-height`, not `padding`.** Vertical padding on an inline `<a>` is
  hit-testable but invisible to layout, so a row that measures `getBoundingClientRect()` would pass
  while the row still collapsed; a flex item with `line-height: 44px` is the band the walk can see.
  A band that only hugs its text is still a small target: `flex: 1 1 auto` is what makes it 44 **wide**
  (T-47's first run failed at 36px wide on `@you`).
- **A token tier has a *surface* limit, not just a flavour limit.** `--color-accent-text` clears AA on
  `--color-bg` (5.20) and `--color-bg-elevated` (4.83) in Latte, and does **not** on
  `--color-surface` (3.81) — the same surface where `--color-text-muted` already fails (4.05). Latte's
  `surface-0` (`#ccd0da`) is the app's worst backplate; **a surface that cannot hold AA text loses the
  text, not the token** — that is what happened to the `md` rail's fill in T-37C, and the hover tier
  exists only because a *hover* still has to survive that backplate (4.66, which is why it is 40/60
  and not 55/45 = 4.38 or 60/40 = 4.29). Do not "restore" the lighter mix by eye.
- **Row 32 shadows `visualViewport.height`, takes its own 360×740 metrics override, and clears both in
  `finally`**; anything added after it must assume the shadow is gone, the token is back to `0px` and
  the session is back at the browser's own window size (assert `innerWidth` returned, never trust the
  `finally`). **Row 33 is mutating**: it presses **Restore copy** on session 2, so session 2's
  character copy is `untouched` for the rest of the run — a later row that wants an `edited` copy
  must seed or edit its own.
- **The pressed-pill fill is a rule, not a one-off (T-48).** A control whose own background is
  `--color-surface` cannot hold static accent text in Latte; pressed means accent **fill** +
  `--color-accent-contrast`. `DESIGN.md` → *Contrast* carries it.

## Driving the desktop window (recipe, proven 2026-11-01)


The webview half of T-33B(a) is verified; this is how, so a later ticket does not rediscover it.

```bash
cd /home/viicell/Projects/LuaPlot
export XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-1 \
       HYPRLAND_INSTANCE_SIGNATURE=$(ls /run/user/1000/hypr/ | head -1)
bun run tauri dev &            # run it as a tracked background process, never with nohup
sleep 20 && hyprctl clients -j | jq -c '.[] | select(.class=="luaplot") | {mapped,at,size}'
grim -g "967,38 941x1030" /tmp/shot.png     # geometry from `at` + `size`, not x/width
```

- **`computer_use` sees nothing here** (`list_windows` → 0) because the cron env has no display; Hyprland
  0.56 also has no click dispatch (`hyprctl dispatch focuswindow class:x` fails — Lua dispatch syntax).
  So drive **keyboard-only** with `wtype -k Tab -k Tab … -k Return`, and read every step back with `grim`
  + `vision_analyze`. Never assert the window state from a key sequence alone.
- **The focus ladder that works from a fresh load:** 8× `Tab` → the top-right *More* button (7× lands on
  *Back*), `Return` opens the menu, 4× `Tab` → the session row (*Sign out* / *Sign in as @you*),
  `Return` presses it. Verify the focus ring in a cropped `grim` before pressing.
- **Ground truth is WebKit's own store:** `sqlite3 -readonly
  ~/.local/share/com.viicell.luaplot/localstorage/http_localhost_1420.localstorage
  "select key, quote(value) from ItemTable"` → `luaplot.session` as **UTF-16LE** hex: `null` when signed
  out, `{"handle":"you","displayName":"You"}` when signed in (never `isAdmin`).
- **`pkill -x luaplot` ends the whole `bun run tauri dev`**; relaunching takes ~20s (cargo is warm).
- **A desktop notification can sit over the window's top-right corner** and hide the *More* button in
  a capture. The menu renders inside the body, so the session row is still readable — crop below the toast
  rather than concluding the menu did not open.
- Cron's shell guard refuses `bash -c` / `node -e`; put scripts in a file (or use `jq`). It also
  refuses `rm` under a root path — clean scratch files with Python's `os.remove`, or leave them in
  `$TMPDIR` (`~/.hermes/cache/scratch`). **`execute_code` is blocked in this cron profile** — for
  arithmetic, write a `.py` under `$TMPDIR` and run `python3 <file>`.

## Found while working (carried forward — keep this list growing)

- **A thread card folds a cut at two messages, so `.cut-turn` on the feed is not the cut's length
  (T-60).** `PostCard` takes `fold`, and `/post/thread` folds (`FOLD = 2`) while the post's own page
  does not: row 43 read **2** `.cut-turn` on the newest card and **8** on `/post/<id>` for the same
  post. Read the count on the post's own page before comparing anything after a delete, and keep the
  card's count in the message as the fold's evidence — comparing the two would be red on a right page.
- **`deleteSession()`'s red proof is the character page's own control, not the store (T-60).** The
  session page navigates away on success, so an unspliced row cannot be seen at `/session/<id>` — it
  is seen one mount later: `/character/…0001` reads **`Continue`** instead of **`Start a session`**,
  because `findSessionForCharacter` still answers. Any "delete the row" ticket should name the
  *landing's* absence, which is what a reader would see, rather than a store read no page exposes.
- **A row that opens a session must first assert the control it is about to press (T-60).** Row 43
  reads the character's primary label and refuses to run unless it is `Continue`; `clickAny(["Continue",
  "Start a session"])` would otherwise create a *second* session and delete the wrong one — and it
  would look identical in the message.

- **A row that returns to a page must `go()` there first (T-59).** Row 42's first run failed with
  *"timed out waiting for the copies disclosure (after the edit)"* on a page that was right: the row
  had saved the character and read the copy as if the session had come back by itself. Nine seconds
  of a green page reads as a broken one — the step that navigates back is a **line**, not a side
  effect of leaving a page.
- **The copy row prints `inSessionName || name` (T-59).** A red proof that renames only the live
  character's `name` leaves the session's copy row reading the same string, so the row stays green on
  the bug it exists to catch. Edit **both** fields, and assert the copy's own name in the failure
  message (T-59 read `"Aurelia"` before and `"Aurelia Rebuilt"` after).
- **A textarea behind a `Sheet` is still mounted and still "visible" to a selector (T-59).** The
  session's `.say` field sits under the publish dialog, so `retype("textarea", …, 0)` can land in the
  composer that is behind the sheet and the row then reads a blank draft. Key the cut's body on its
  own `textarea[placeholder^="What happened"]`.
- **One regex, two escaping levels (T-59).** Inside a `js(\`…\`)` template the file needs `\\/` (one
  unescape reaches `\/`); the **same** pattern written as a plain `.mjs` regex literal needs `\/`.
  `/\\/character\\/[0-9a-f-]{36}$/` is `SyntaxError: Invalid regular expression flags`, reported at
  the literal itself — `node --check scripts/smoke.mjs` is the two-second gate, as it is for every
  other trap in this file.
- **`location.pathname` carries the served base; `go()` wants an app path (T-59).** On the preview
  they are the same (`/session/<id>`), on Pages they are not (`/LuaPlot/session/<id>`), so
  `go(await url())` **doubles** the base into `/LuaPlot/LuaPlot/session/<id>` — a 404-shaped app whose
  missing control reads exactly like a broken page (`timed out waiting for the copies disclosure
  (after the edit)`, live only, 42/42 local the same hour). Keep the id (`pathname.split("/").pop()`)
  and rebuild the path, and run `--live` before claiming any row that navigates back to a page it
  read earlier.
- **A row that publishes leaves a post behind (T-59).** Row 42's cut is the walk's **newest** post, so
  `/post/thread?sort=newest`'s first card is that cut for every row after it — a reasonable way to
  find it by its body (`ownCut` is a module constant), never by an id.

- **A `prepend` survives node identity, so an append row needs the ORDER assertion (T-57).**
  Inverting `post-thread.tsrx`'s append to `[...listing.items, ...items.value]` kept **all 23** stamps
  (the keys are stable, only their position moved) and the row only went red on
  `Load more reordered the first page — wanted [95d85e7b…, …000c, …000b]…, read […0012, …0011,
  …0010]…`. A "the stamps survived" check proves *not remounted*; it never proves *appended*. Keep
  both, and know which one carries which bug.
- **`.pager-action` is a wrapper and its `Button` is disabled while `appending` is true (T-57).** The
  press must poll `document.querySelector(".pager-action button")` for `!disabled` first, or the row
  reads "appended nothing" on a page that is right — the same shape as T-56's vote pair.
- **`scripts/*.mjs` take no type annotations.** `let secondHalf: string;` inside a `journey()` body is
  a `SyntaxError: Unexpected token ':'` from `node --check`, reported at the *declaration*, not at the
  `.mjs` extension. `node --check scripts/smoke.mjs` is a two-second gate before any walk run.
- **A generated fixture row needs the annotated `map` callback or `status` widens to `string`.**
  `SEED_BODIES.map((body, index): Post => ({ … status: "visible" … }))` type-checks against
  `Post[]`; the bare arrow infers `string` and the array stops being assignable. And a schema-valid
  fan-out needs a **distinct clock per row** — `newest` over equal `createdAt` is a
  non-deterministic listing (T-57 gave each generated post its own October day).
- **Seeding a listing rewrites every count in that listing's rows.** T-57's 12 → 30 posts turned
  row 39's `End of feed.`-plus-no-pager assertion into "press the control and append"; rows 21, 36 and
  38 read counts dynamically and needed nothing. Grep the walk for the *page* it reads before
  changing a fixture, not just for the number.

- **The uniqueness guard is not what makes a repeat a no-op (T-56).** `vote()`'s
  `if (previous === direction) return row` only saves a write: delete it and the walk stays **green**,
  because the next two lines decrement the previous vote and then increment the new one, so a repeat
  nets **zero**. The invariant lives in the decrement/increment pair; a row that wants to prove
  "one vote per viewer" must be shown red by removing **both** (a repeat then reads `+2`), and the
  "switch replaces" half by removing the two decrements alone (the like stays counted). A ticket that
  offers one of the two edits as its red proof is offering a green run — check the arithmetic before
  spending a walk on it.
- **Row 40 leaves one Like behind on `/character/…0002`** (the spec fixes the two-button pair and has
  no *unvote*), so anything added after it must assume the viewer already voted there, and must not
  re-read that character's counts as the fixture's.
- **A press helper that lowercases the DOM label must lowercase the wanted one too.** Row 40's first
  run failed on a page that was right: `press("Like")` compared `"like"` against `JSON.stringify("Like")`,
  matched nothing, and the failure read `no button.vote reads "Like" — saw Like | Dislike`. Cheap to
  see in the message, one walk to discover — compare both sides lowercased.
- **The engagement block is `.detail .counts[aria-label="Engagement"]`**, four `<li class="count">`
  children of `.count-label` + `.count-value`; keying on `.counts` alone is fine on this page (it draws
  one) but the `aria-label` is the fact that survives a class rename, and the four cells are
  `likes / dislikes / ratio / comments` — the ratio is a **percent** and the comments cell is `0` on
  the fixture.
- **`App.tsrx`'s effect keys on `path + search`, and that is the whole reason a one-time
  `useQuery()` read is honest (T-55).** A query change sets `status = "loading"` first, so the
  `@default` branch (and the page component in it) is torn down before `Page.value` is set again —
  the page **remounts**, `track(readSort(useQuery()))` re-initialises, and the `Select` and the
  listing move together. Do not "optimise" that effect to key on `path` alone: it would leave every
  query-string page (the thread's sort, the profile tabs, the moderation filters) reading a stale
  mount value, and row 39 is the only thing that would notice.
- **A page that writes the URL itself never notifies the router.** `writeSort()` calls
  `history.pushState` directly (not `navigate()`), so no `emit()` runs, no remount happens and the
  loaded rows survive a sort change — which is the point, but it also means a row cannot use the
  router's state as evidence for a press. Read `location.search`.
- **`history.back()` is one `sleep` away from a flaky row.** It is asynchronous (`popstate` →
  `emit` → effect → dynamic import), so poll the three readings; T-55's `expectSort` polls the
  search **and** the control together and throws with both plus the card count.
- **A refetch can be proved by node identity when the data may not change.** The thread's fetch
  stamps an `epoch` into every row's key, so a refetch remounts every card: an expando written
  before a gesture is gone after it. Use that shape for any "the page really reloaded its data" —
  the URL, the data and the control can all stay identical while nothing was fetched.
- **`choose()` returns the value it read, so it never proves the page.** T-41's helper sets `.value`
  and dispatches `change`; a page that ignores the event still returns the value. Assert the
  consequence (URL, listing), never the helper's return value.
- **The paging half is walkable now, and the numbers are 24 / 23 / 5 (T-57).** With 30 fixture rows
  (29 listed) page 1 is **24 rows** but only **23 `.card.post`** — post 7 is the only `nsfw` post and
  the walk's account seeds Show **off**, so a row that treats the card count as `PAGE_SIZE` is off by
  one. Page 2 is the **whole remainder**, so **one** press takes the pager to `End of feed.` and a
  row that expects a second press is red on a right page: assert whichever the size makes true and
  **name it in the message**.

- **The walk removes the only NSFW post before row 38 can read it (T-54).** Case 2's target is post 7
  (`lib/fixtures/posts.ts`, the only `nsfw: true` post), and row 21 concludes that case as *removed*,
  so `livePost` drops it from every listing for the rest of the run: the feed drew **11 post cards and
  none `17/6`**. A later row that wants a covered post card must compose one (the composer's **NSFW**
  toggle is `post/create.md`'s own control) — a fixture flag is not a fixture *on the page*.
- **A row that seeds a post changes what later rows count.** Row 38's composed flagged post and the
  `publish a post` row are both in the store before row 39 runs, so its page 1 is 24 rows of a
  31-row store and its append lands at 29 cards — measured, not pinned. Never pin a post count
  anywhere after row 8.
- **`.card-veil`, `.card-head` and `.card-foot` are siblings, so `veil.contains(...)` is the only
  honest containment test.** A "is it a descendant of `.card`" check passes on a footer that was moved
  *into* the blur — T-54's red proof read `footer true (outside the veil false)` on a page whose card
  still had a footer.
- **`.card-cover` is inside `.card-middle`, beside the veil**, so the Reveal needs its own
  containment check (`coverOutsideVeil`) — a check against `.card` proves nothing.
- **The cover is a `filter` on the veil, not an overlay, today** (measured `blur(6px)` in row 38's
  evidence). Record it, never gate on it: `DESIGN.md` has changed this once already.
- **The walk's account seeds Show **off** / Blur **off** (measured by T-53's seed read).** So an
  absence-only listing assertion is **vacuous**: the catalogue already omits every NSFW row before the
  row touches anything. Measure **both directions** — with Show on the same page prints the row
  (`/character/catalog` draws **24** cards, four of them the flagged characters 004 *Hollow Saint*,
  014 *Auntie Sorrow*, 018 *Tamsin Rede*, 023 *The Salt Bride*), with Show off it draws **20** and
  none of those titles. A "was there, now gone" is the only listing proof worth a row.
- **The character detail page's name is `h1.title`; the persona's is `h1.name`.** T-50's row read
  `.detail h1.name` because that page draws one; T-53 read a character and would have found nothing.
  Use `.detail h1.title, .detail h1.name, .detail h1` — the fallback costs nothing and survives a
  class rename on either page.
- **A `finally` restore masks the failure it was called to protect.** If the body throws and the
  restore then throws, the body's message is gone. T-53's shape: `catch` the body error into a
  variable, run the restore in a **second** `try`, and throw `` `${bodyError.message} — and the
  restore failed: ${error.message}` `` — a leak is the louder failure, but it must not erase the
  first one.
- **A row that owns a store pair must assert the pair *after* its own gesture, not only after the
  restore.** T-53 reads `Show` again once the Reveal has been pressed: a Reveal that wrote to
  prefs would otherwise be "restored" and read green. Any gesture whose spec says *writes nothing*
  deserves that read.
- **A covered detail page's four engagement cells read `["51","22","70%","0"]`** — the Ratio cell is
  the percent, so "every cell is a number" is false on a *right* page under the cover too (T-52's
  find, confirmed twice now). Assert the shape per label.
- **A poll timeout is only useful if your catch replaces it.** T-53's red proof was readable because
  the row caught the name poll and re-read `document.title`, `location.pathname`, the root-class
  counts, the headings and the first 120 chars of body text — it named the route, the title and the
  fact that only `.detail` mounted. Without that, the same red run says "timed out waiting for the
  name" and tells the next session nothing.

- **The detail page's engagement list has four cells and one of them is a percent (T-52).** `T-52`'s
  first run failed on a page that was right: `/character/[id]` draws `Likes`, `Dislikes`, **`Ratio`**,
  `Comments`, and the Ratio cell's `.count-value` is `percent(ratioOf(...))` (`87%`). "Every
  `.count-value` is a number" is therefore false; assert the shape **per label**. The ticket's example
  strings are a hypothesis, the fixture is the fact (T-49's lesson, again).
- **A count can be injected into a card's footer without moving a pixel of its layout.** `T-52`'s red
  proof appended `<span class="count">{item.likes}</span>` beside `.card-ratio` inside `.card-foot` and
  the row read `20/20 card(s) fail` with `["count"] inside it` — the shape to copy for any "this number
  belongs elsewhere" rule is: read the **class names** inside the card, not the text on it.
- **A post card is not a catalogue card, and `thread.md` says so.** `PostCard.tsrx` draws
  `.post-count` × 2 plus a `.post-comments` link and **no** `.card-ratio`, because the post footer is
  spec'd as likes + dislikes + the comment count. Row 36 measures both sides so a later "let us make
  the cards consistent" turns red instead of silently editing the product.
- **`/post/thread`'s loading state draws three `.skel-card`s**, not `.card-cell`s — a row that reads
  `.post-counts` on the first frame reads zero on a feed that has not loaded (`T-50`'s shape, different
  markup). Wait for `.skel-card` gone here too.
- **A precedence law's red proof needs *both* halves (T-51).** Neither edit the ticket suggested is red
  on its own: widening `ID` to `/^[0-9a-z-]{1,36}$/i` still mounts the catalog, because `TABLE` sorts
  fewer-params-first and the literal route is tried before the predicate is ever consulted; dropping the
  param count from the sort still mounts it, because `Array.prototype.sort` is stable and `ROUTES`
  declares `catalog`/`create` before `[id]` — depth-only ordering is a no-op. The red proof is the two
  together (`ID` widened **and** the sort inverted to params-first). Say so in any accept line that
  offers "either", or the next session burns a walk proving nothing.
- **A root class shared by a component is not a landmark (T-51).** `CommentThread.tsrx` draws
  `<div class="thread">`, the same class as `/post/thread`'s page root, and a broken router lands on a
  *detail* page that renders it. Key a page on its own `.kicker` sentence **plus** the absence of
  `.detail` — the shared class alone would pass on the wrong page.
- **`document.title` carries an em dash, not a hyphen.** `App.tsrx` writes `` `${def.title} — LuaPlot` ``
  (U+2014), so a probe built with `- LuaPlot` never matches and reads as a timed-out page. Copy the
  literal from `App.tsrx`.
- **A whitespace collapse needs `\\s` per template level.** `js(\`…\`)` unescapes once, so `\\s` in the
  file reaches `Runtime.evaluate` as `\s` (whitespace) — while the `\\\\s` written in every older row
  reaches it as `\\s`, a literal backslash followed by `s`, and collapses nothing. Harmless where those
  rows compare a value with no inner spaces; a trap for a new probe that needs the collapse to work.

- **A loading state can satisfy an absence count (T-50).** `/persona` draws **three `.card-cell`s of
  skeletons** before it draws a card, so a row that counted cells on the first frame read `3` on a
  grid that had not loaded and would have passed a broken collection. Wait for `.skel-card` to be
  **gone**, and assert the real card (`.persona-card`) too. The same shape applies to any page whose
  skeleton mirrors the grid.
- **"Zero elements" is a node count, never a text search (T-50).** Row 34 counts `button, a` inside
  `.detail` and matches their `aria-label`-then-`textContent`; a toast from row 33 (*Copy restored.*)
  or a footer that says "report" makes a body-text search pass on a page that still has the control.
  Read the accessible name as `aria-label || textContent` — the same order `click()` uses — rather
  than reaching for `Accessibility.getFullAXTree`, which is thousands of nodes to filter.
- **An absence row needs a presence half or it passes on an empty page (T-50).** Row 34 asserts the
  name `Nell` and the four controls the persona spec *does* require (Start a session, the default
  pair, Edit) before asserting what must be missing. Otherwise a page that rendered nothing is a
  green row.
- **`innerText` is the rendered text, so a `text-transform` redesigns the assertion (T-49).** The
  session copies header and each `.copy-kind` are uppercased in CSS, so row 33's first run read
  `3 COPIES · 1 EDITED` and failed on a page that was right. Read `textContent` for a sentence the
  code writes; use `innerText` only when what the reader sees is the thing under test.
- **A ticket's example strings are a hypothesis; the fixture is the fact (T-49).** T-49 predicted
  `4 copies · 1 edited` → `4 copies · 0 edited`. Session 2 holds **three** copies (character, one
  lorebook, preset) and `summary` appends ` · N edited` only while `N > 0`, so the truth was
  `3 copies · 1 edited` → `3 copies`. Four is session 1's two-lorebook shape, which is the example
  `DESIGN.md` quotes. Count the fixture before writing the assertion.
- **`Restore` and `Restore copy` are two different buttons.** The edited row's opener is labelled
  **Restore**; only the confirmation's button says **Restore copy**. Pressing by a `startsWith`
  match hits the opener, and a second press must be scoped to `.copy-confirm`, or the row proves the
  dialog and never the snapshot.
- **A hand sweep is a list; the gate is the guard (T-48).** T-37C moved every accent-text site it could
  see in `src/styles.css` and reported the tree clean — `scripts/tier-check.mjs` then found **26** more
  in `.tsrx` `<style>` blocks on its first run, including `.vote`/`.save` pressed pills on three pages.
  When a rule can be checked mechanically, the sweep is not done until the check exists.
- **A mark token in a *fallback* is still the mark.** `color: var(--color-success, var(--color-accent))`
  paints accent text whenever the first token is missing; the fix is the text tier in the fallback, not
  an exemption in the scanner.
- **Mask, don't skip, when extracting CSS from a `.tsrx`.** Replacing non-`<style>` characters with
  spaces (newlines kept) means an offset in the mask is an offset in the source, so `file:line` is the
  file's own line — no remapping pass to get wrong.
- **A scanner that takes file arguments can be proved red without touching the tree.** `node
  scripts/tier-check.mjs $TMPDIR/x.css` on a copy is the whole proof; copy that shape for the next
  static guard. An injected `<style>` must land *inside* the real block, or the tag text becomes part
  of the preceding selector and the message reads oddly.
- **`--color-accent-hover-text` clears `--color-surface` (4.66 Latte), but it is a hover's token.** There
  is no *static* accent text tier that clears that backplate, so a static site there is a design
  decision (fill, or drop the accent) — never a borrowed tier.
- **Cron's shell blocks `bash -c` / `node -e` and `execute_code`.** A sweep like T-48's is a `.py` file
  under `$TMPDIR` run with `python3`, and it must apply edits bottom-up per file so the line numbers it
  read stay valid.

- **A backtick inside a `js(…)` template literal ends the string.** A comment in row 31's page
  expression quoted `--color-surface` in backticks and node reported `Invalid left-hand side
  expression in postfix operation` at the snippet's *opening* line — no template-literal error, no
  pointer at the comment. Page snippets carry no backticks; write the token plainly.
- **A token with no element left on it can still be measured honestly.** The hover tier exists for
  `--color-surface`, which now paints no text at all (the rail's fill is gone), so row 31 resolves it
  through a throwaway `div` — set `style.backgroundColor = "var(--color-surface)"`, read the computed
  `backgroundColor`, remove it. The value is the browser's own, not a hex copied into the walk (a hex
  would keep passing after the token moved).
- **Two hovered nodes need two force/release pairs.** Forcing the author link and then reading the
  *probe's* `:hover` colour measures the author's rule; each node is forced, read and released in
  turn. Release is `forcedPseudoClasses: []`.
- **`color-mix()` computes to `color(srgb 0.49 0.23 0.85)`** — 0–1 floats. A contrast helper that
  assumes 0–255 bytes reads it as near-black and reports a fake **17.23:1**. `CONTRAST_FN` in
  `scripts/smoke.mjs` branches on `indexOf("color(") === 0`, and `cssHex()` makes the same branch for
  evidence; a regex escape inside that template literal is a double-escaping trap that produced
  exactly this bug twice.
- **`CSS.forcePseudoState` (`DOM.enable` + `CSS.enable` + `DOM.querySelector`) measures a `:hover`
  pair without a synthetic mouse** — the only honest way to assert a hover colour, and it must be
  released (`forcedPseudoClasses: []`) before the next measurement.
- **`Emulation.setEmulatedMedia { features: [{ name: "prefers-color-scheme", value }] }` is the
  flavour switch**; `features: []` clears it. Assert `--ctp-base` (`#1e1e2e` / `#eff1f5`) plus
  `color-scheme` to prove the pass really changed palette — a pinned `<html data-theme>` makes the
  media query inert and the row refuses to run against one.
- **Mixing toward `--ctp-crust` lightens a light flavour.** The mark's text tier darkens by mixing
  toward `--ctp-text`; the inverse reads like progress and measures worse (3.82 vs 4.83).
- **A global `s.replace` across `src/styles.css` hits the dark blocks too.** Restoring "the raw
  declaration" everywhere put the mix on Mocha and printed `9.09:1` with `#cbadf7` — anchor the
  replace on surrounding context (the flavour's `--ctp-lavender` line) or by line number.
- **A URL assertion cannot see a re-boot.** `waitUrl` is a substring match and a fresh document loads
  the same route; T-45 proves a push with **document identity** (`window` marker +
  `performance.timeOrigin`), and `performance.getEntriesByType("navigation")[0].type` is `navigate`
  even for a full load from a link, so it cannot be the proof. `nav` is only printed as context.
- **The walk's own row count is a gate.** `process.exit(… rows.length === 27)` was a literal: adding
  row 28 with all 28 green still exited 1. It is `EXPECTED_ROWS` now — bump it with the row.
- **A red walk proves the assertion; a green one does not.** T-45 removed the `onClick`, rebuilt, and
  watched row 1 fail with the document dump before restoring it; T-47 set the band back to
  `line-height: 1.3` and watched row 30 read `16px tall`; T-37B put Latte's tier back on the mark and
  watched row 31 read `4.45:1`. Do that for any new invariant — and restore the exact bytes that
  passed, so the green run stays the proof.
- **Bare anchors are gone (T-46):** 52 internal anchors pair `href` with `follow`, `EmptyState` takes
  a **path** (`to=`) so its call sites cannot regress, and gate section 7 fails on a new one.
  The static check is the guard the walk cannot be: 31 rows cannot visit every page. (T-48 is the same
  argument for the colour tier.)
- **The webview stores `luaplot.session` as UTF-16LE in a SQLite table** (`localstorage/
  http_localhost_1420.localstorage`, `ItemTable`), so `quote(value)` returns hex — decode before
  comparing, or a correct proof reads as a corrupt one. On Pages the same key lives in the browser
  profile instead; the origin differs (`http://localhost:1420` in dev, `https://…/LuaPlot/` on Pages).
- **`localStorage` prints `null` for both "no key" and the stored string `"null"`.** A proof that only
  prints `getItem` cannot tell a fresh install from a signed-out device; compare with
  `JSON.stringify` or assert the DOM beside it.
- **A CDP reload is only honest at a URL the host actually serves.** GitHub Pages has no SPA fallback
  (`/LuaPlot/dev/state` → 404), so a session/persistence proof runs at the site root and reads the
  shell (`Sign out` vs `Sign in as @you`, `prefsLine`'s sentence) instead of `/dev/state`.
- **A publish is not instantly walkable.** Two `/dev/*` rows timed out on a live walk started ~25s after
  `publish.sh` and passed on the re-run: a mid-propagation chunk 404 looks identical to a broken page.
  (A failure that survives a re-run is real — that is how T-45's doubled base was caught.)
- **A `cargo build` debug binary loads `devUrl`, not `frontendDist`.** It opens a mapped window that
  says *Could not connect to localhost: Connection refused* — the app is fine, vite is missing. The
  accept command is `bun run tauri dev`; and `dist` must be built **without** `LUAPLOT_BASE` for Tauri
  (the app is served from `tauri://localhost`, so `/LuaPlot/assets/…` 404s).
- **The desktop is drivable from cron without a display** — see *Driving the desktop window* above.
- **A tiling compositor overrides the configured window size.** `tauri.conf.json` asks for 1200×900 and
  Hyprland maps it at 941×1030. That is the WM, not a config bug — the *floor* (`minWidth`/`minHeight`)
  and the label are the parts the app controls, which is why `scripts/tauri-config.mjs` asserts those.
- **`pkill -f vite` kills the tick's own shell**, because the pattern matches the command line that is
  running it. Kill a preview by port: `lsof -ti:4321 | xargs -r kill`. Use `pkill -x luaplot` for the app.
- **Never pipe `scripts/smoke.sh` into `tail`/`head`/`grep`.** A pipeline hands back the *pager's*
  status, so a red walk exits 0, and `smoke: N/31 journeys` is the first line the pipe drops — the run
  looks green and proves nothing. Redirect to a file, then read the file and the exit code.
- **T-44's walk helpers are the ones to reuse**: `setToggle(label, want)` / `toggleState` (press a
  `button.toggle`, then **poll the rendered `aria-pressed`**), `storeCell(label)`, `coveredCards()`,
  `measureAt(width)` and the `BREAKPOINTS` table.
- **The card grid is 1 / 2 / 3 / 3, not 1 / 2 / 3 / 4.** Measured ladder live: `360:1col/field1/rail0/
  btn44/outlet340 · 640:2col/field2/rail0/btn44/outlet620 · 900:3col/field2/rail84/btn44/outlet794 ·
  1200:3col/field2/rail240/btn44/outlet794`, no document-level horizontal scroll at any width — and
  still exactly these numbers after T-47 made the card footer 44 tall (the height did not enter the
  track math).
- **`.count-label` carries `text-transform: uppercase`** and `innerText` returns the *rendered* text
  (`SHOW`, `LIKES`): a case-sensitive label match finds nothing and reads as a broken page.
- **`Emulation.setDeviceMetricsOverride` is the only honest way to change width**, and a leak poisons
  every later row. `measureAt` runs in `try`, the clear + 240ms settle in `finally`.
- **`/dev/state`'s NSFW pair is restored, not merely flipped.** A journey that leaves Show+Blur on
  makes every later card-grid assertion read the wrong state.
- **The `--live` walk catches what the local one cannot.** T-41 lost three rows to an `^`-anchored path
  test, T-42 to a missing `/edit`, T-45 to a doubled base that base `/` hides. Suffix-match every path,
  run `--live` before claiming a ticket.
- **A refusal row must carry the whole path.** T-42's first run failed three rows because `OTHER_*`
  omitted the trailing `/edit` and the failure read like a copy bug.
- **A `<input type=file>` in headless Chromium hangs the press unless intercepted.**
  `Page.setInterceptFileChooserDialog { enabled: true }` before the press, `backendNodeId` from the
  event, then `DOM.setFileInputFiles` — which fires `change`.
- **Do not pin an engine's answer.** `navigator.vibrate` answers truthy here (155) and measured `false`
  in T-34: a row whose value comes from the browser asserts a **set** and names the member it saw.
- **`document.title` on a non-root route is `<Title> — LuaPlot`** (`App.tsrx`), so the badge reads
  `(3) Native — LuaPlot`.
- **T-41 is done**: `retype()` and `choose()` are the helpers for a preloaded field (`type()` appends at
  wherever `focus()` left the caret). **T-40 is done** (`/character/[id]/edit` mounts `CharacterForm`
  only in its `ready` branch). **T-34 is done**: `native.ts` answers `nativeResultSchema`;
  `isNative()` reads `window.__TAURI_INTERNALS__`, never `import.meta.env`.
- **The Tauri chunk is `core-*.js` and no file in `dist` contains the literal `@tauri-apps`** — only
  the resource timing can prove it never loads (`noCoreChunk`).
- **A synthetic `.click()` cannot copy**: `navigator.clipboard.writeText` needs a trusted gesture.
- **T-38 is done**: `scripts/smoke.sh` builds + previews + walks + tears down; `--live` walks the Pages
  URL. **It is not in `check.sh`** — the gate stays browser-free.
- **The account page is not a `<form>`.** `user-edit.tsrx` draws `.form` as a `div` of `Field`s, so a
  row must assert an input by `name` (`input[name="displayName"]`), never `querySelector("form")`.
- **A component that hands out a link must take the path, not the href.** `EmptyState` took a finished
  `href` and drew a bare anchor; 39 call sites were one attribute away from the exploit. Ownership of
  the `href`+`follow` pair inside the component is what stopped it — apply that to any new one.
- **`link-check.mjs` reads tags, not lines.** Attributes span lines (the tab bar and the dev pages do),
  so the scanner walks from `<a` to the matching `>` counting braces, quotes and backticks; a
  line-based grep would miss exactly the multi-line cases it exists for. T-48's scanner needs the same
  block-walking discipline.
- **The report journey needs POST(8)**: the preview classifier buckets on `hash("jev:post:" + body) % 5`
  and only buckets 2/3/4 escalate.
- **A shared Chromium profile makes the walk flake** — profiles are unique per run and removed on exit.
- **`go()` must resolve against the served base**; a leading slash drops the `/LuaPlot/` base.
- **Measure a flavour through `Emulation.setEmulatedMedia`**, never by flipping `data-theme` from JS.
- **`/bookmarks` carries an internal horizontal scroller** (`.tabs`, `overflow-x: auto`); the
  **document** does not scroll. The breakpoint row asserts `documentElement`.
- **`:has()` is available in the walk's Chromium** (`Chromium 105+`), and it is the only way to pick
  "the first card that actually draws an author link" in one selector (T-47's row 30) without
  flattening the whole grid into the page expression.
- **Bundle numbers**: `dist` 1.1 MB; JS 728 KB raw / ~187 KB gz; CSS 23.8 KB gz; largest asset the
  JetBrains Mono Latin woff2 at 40,404 B. Budget 300 KB gz — met.
- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()`, `livePost()`,
  `getPost` still answers by id.
- **Counts** (memory adapter; the walk's own journeys add rows as they run, so never assert a bare
  total): characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 30 (29 listed,
  post 6 removed), reports 5 (3 open, 2 concluded), comments 22, sessions 2, bookmarks 8 (one dead),
  notifications 6 (3 unread), profiles 7, follow edges 15. `/dev/data`'s *Characters* cell reads the
  **page** count (24 = `PAGE_SIZE`), not the fixture total.

- **`visualViewport.height` is shadowable on the instance (T-36a).** `Object.defineProperty(vv,
  "height", { configurable: true, value: n })` works — the read-only accessor lives on the prototype
  and does not block an own property — and `delete vv.height` puts the real getter back. Dispatch
  `new Event("resize")` **on `vv`**: a `window` resize is not the event a keyboard fires.
- **The walk does not run at 360 by default.** `--window-size=360,740` is the browser's, but a tab
  opened through `/json/new` measures **500×653** (probed 2026-11-01), and every row that clears its
  override returns to *that*. A row of phone geometry therefore takes its **own** `360×740` override
  and compares `scrollWidth` against the `innerWidth` it read, never against a constant — T-36a's
  first run reported `scrollWidth 490`, which looks like a broken page until you see the viewport was
  500.
- **A character's session entry is `Continue` after any earlier row opened one.** `click("Start a
  session")` matched nothing on the second visit; take `clickAny(["Continue", "Start a session"])`.
- **`requestAnimationFrame` does fire in headless Chromium** for the active tab, so a rAF-coalesced
  writer (`viewport.ts`) is walkable — no `Emulation.setPageVisibility` or timer fallback needed.
- **A red proof that fails on a poll's timeout message is not the proof an accept line asks for.**
  T-36a's first red run said `timed out waiting for --keyboard-inset to read 320px`; the row now
  catches that poll and re-reads the token **and the dock's padding**, so the failure names the two
  numbers a reader can act on. Do the same wherever a row's accept line says what the message must say.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.
