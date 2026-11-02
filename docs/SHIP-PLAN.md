# LuaPlot — ship plan

Ordered phases → tickets. One ticket per session unless the baton says otherwise. Acceptance is
always mechanically checkable. `[X]` = done (PROGRESS.md has the proof).

Design law: `docs/DESIGN.md`. Stack law: `docs/ARCHITECTURE.md`. Rules: `docs/CONTRACT.md`.

## P0 — Foundation (nothing else is worth doing first)

- [x] **T-01 Router + shell skeleton.** `src/router.ts` with the full route table from
      `src/specs/luaplot-pages.md`, `App.tsrx` rendering `<RouterOutlet>`, mobile top bar + bottom
      tab bar + desktop sidebar, base-path aware. Accept: every route renders a titled placeholder;
      deep link `/character/catalog` works after reload on the Pages URL.
- [x] **T-02 Design primitives.** `Button, Field, Toggle, Card, Sheet, Toast, Tabs, EmptyState,
      Skeleton, Avatar, Icons` on the Catppuccin tokens, keyboard + `:focus-visible` states,
      44px targets. Accept: a `/dev/primitives` route renders every variant in both themes at
      360px and 1280px with no overflow.
- [x] **T-03 Data contract + memory adapter.** `lib/data/types.ts`, `repo.ts`, `memory.ts`,
      `lib/fixtures/*` (≥8 characters, 6 lorebooks, 5 presets, 3 personas, 12 posts with comments,
      notifications, reports, 2 sessions with transcripts). Accept: a `/dev/data` route lists
      counts per entity from `resolveRepo()`.
- [x] **T-04 Session + NSFW preference state.** `lib/state/session.ts` (mock signed-in user,
      switchable signed-out), `lib/state/prefs.ts` (Show/Blur, persisted per account in the adapter).
      Accept: toggling Blur in one place is reflected on a catalog after navigation.
      — `/dev/state` flips both stores; the adapter keeps the pair keyed by handle, so sign-out →
      sign-in restores it. A listing reading `nsfwPreference()` follows without a page-local copy.

## P1 — The pages that define the product

- [x] **T-05 `/` home.** One screen: name, one paragraph, entry control (sign-in or profile).
      Accept: renders signed-out and signed-in; matches spec states exactly.
      — `src/pages/home.tsrx` is a title page, not a landing page: kicker, wordmark, 44ch paragraph,
      hairline, `session ·` reading, one control. Zero scroll at 360×740; the control follows the
      session live (`/authentification` / `/user/you`) and a signed-in visitor is never redirected.
- [x] **T-06 `/authentification`.** Three provider buttons, redirecting/cancelled/failed states.
      Accept: buttons call the auth seam; mobile layout has no scroll at 360×740.
      — `src/lib/auth.ts` is the seam (`signInWithProvider` → redirecting / cancelled / failed, no
      `ok`, no session write, `?auth=` preview switch); `src/pages/authentification.tsrx` is home's
      title page with three equal secondary providers in a 420 measure, one `track<AuthStatus>`, and
      a status row that reserves 20px so no state re-centres the page. Zero scroll in all four states.
      `Button.disabled` now takes `Derived<boolean>` — a live disable needs the derived, not the value.
- [x] **T-07 `/onboarding`.** Username (3–24, `[a-z0-9_]`, case-insensitive uniqueness), display
      name, NSFW toggles; inline errors; Finish gated. Accept: invalid handle and taken handle both
      block Finish with the spec's copy; valid submit lands on profile.
      — The repo's first form page: kicker, 26/34 title, hairline, two `Field`s, two `Toggle`s
      (through `lib/state/prefs.ts`), `Finish`. `lib/validate.ts` is the one reading both the inline
      error and the gate use; `repo.currentProfile` / `isHandleTaken` / `saveProfile` are the three
      profile methods the adapter now owns, and the debounced draft write is what makes *resumed
      after abandonment* true. `session.setAccount` is how a saved display name reaches the store.
      `Field.error` is live now (T-02 froze it at mount).
- [x] **T-07B Zod at every boundary.** `bun add zod`; `src/lib/schema.ts` holds one schema per entity
      and per input; `lib/data/types.ts` becomes `z.infer` of those schemas; `lib/validate.ts` reports
      the schema's issues instead of owning a regex; fixtures parse on load and every adapter write
      parses its input; `scripts/schema-check.ts` + a fifth `check.sh` section make the gate the
      guarantee; `ARCHITECTURE.md` → **Validation** and one CONTRACT bullet record it for every later
      ticket. Accept: `check.sh` GREEN with the schema section, onboarding copy unchanged, no
      duplicated entity shape, no `z.any()`.
      — `src/lib/schema.ts` (~380 lines, every shape + its normalisation, `z.strictObject` throughout,
      spec cited per group) is the one home; `types.ts` is now nothing but `z.infer`; `validate.ts`
      classifies the `ZodError` issue code instead of running a regex; `memory.ts` parses all nine
      fixture collections at load (64 rows, message names collection + row + path) and both profile
      writes; `router.ts` matches `[user.username]` with `isHandle()` from the schema. Section 5 of
      the gate (`bun run schema:check`) proves 64 rows parse, three negative cases fail, and the
      `z.lazy` reply tree is not `any`. It also caught a real bug: fixture ids were decimal strings
      (37–38 chars, not UUIDs), so **every seeded detail link was a 404** — `ids.ts` now emits hex.
- [x] **T-08 Catalog card + grid.** `Card` takes the `AuthoredItem` entity + the effective cover
      flag; veil blurred 6px, scrim sibling layer, per-item `Reveal` (44px, outside the filter), footer
      crisp. `CardGrid` 1/2/3/4-up, gutter grid. Accept: verified in the DOM at 360/640/900/1200.
- [x] **T-09 `/character/catalog`.** Toolbar (search debounced 250ms, `All` filter, sort, NSFW
      toggles), grid, `Load more` (+24, hidden at end), query-string state, all six states.
      Accept: filter+sort survive reload; empty/no-results/end-of-list each render. Landed with the
      grid/card props made live, and fixtures grown to 27 characters so paging has a second page.
- [x] **T-10 `/character/[id]`.** Identity, attached lorebooks (incl. unavailable), counts + ratio,
      bookmark, vote, settings menu shell, owner moderation notice. **Report is T-12's dialog and
      Start/Continue + fork are T-10B** — those menu entries are drawn and disabled rather than
      faked. Accept: vote/bookmark mutate the adapter and the UI shows its answer; the private
      fixture shows the notice to its owner and *unavailable* to everyone else. Landed with
      `useParams()`, `repo.myVote`, listings filtered to `isPublic` only, and `CHARACTER(28)` +
      `REPORT(5)` as the private case.
- [x] **T-10B Fork + Start/Continue.** `repo.forkCharacter` and `repo.createSession` (copies with
      `sourceId` links, a live persona reference, `personaId` optional for the unattributed start);
      the detail page's one `btn-primary` reads Start or Continue from `findSessionForCharacter` and
      a second session comes only from **New Session**. Landed with **Fork** in the settings menu
      (absent while private; the adapter refuses a private source) and DESIGN's *Start / Continue
      and Fork*. Brief: `docs/tickets/T-10B-fork-and-session-control.md`.
- [x] **T-11 Comment thread component.** `CommentThread.tsrx` builds the tree in code (oldest first
      at every level, deeper than three folded onto the third indent, an orphan placeholder dropped),
      renders placeholders with no actions but with their branch, folds a reply list past three
      behind `Show N more replies`, retargets its one composer from any row's **Reply**, covers an
      NSFW comment's own body, and honours `#comment-[id]` at mount. Adapter gained `addComment` /
      `deleteComment` (author only, counts recomputed on every write, `replyCount` now the whole
      branch) and `schema.ts` gained `commentBodySchema` / `commentWriteSchema` plus the row's
      visible-has-text refinement. Mounted under the lorebooks on `/character/[id]` with a live
      `Comments` cell. Accept: verified at 360/640/900/1200 via CDP metrics — deleting a parent keeps
      its replies, posting moves the count.
- [x] **T-12 Report dialog.** `ReportDialog.tsrx` — a `Sheet` stepper (what → reason → source for a
      copy claim → optional details → submit) mounted by the character settings menu and by every
      live comment footer. Reasons come from `REPORT_REASONS_BY_PART` in `schema.ts`, `reportWriteSchema`
      is the one gate (source required for a copy claim, part/reason pair checked), and the adapter
      owns one report per viewer per item, cumulative cases (`weight + 1`, `lastReportAt`) and
      already-verified *held*. Accept met: a report opens/joins a case in the adapter with cumulative
      weight (5/3-open → 6/4-open on `/dev/data` without a reload).
- [x] **T-13 `/post/thread`.** Public timeline, composer entry, NSFW handling, Load more. Landed: post
      card (own primitive), sort in the URL (`newest | discussed | liked`), `All` chip, Show/Blur pair,
      Load more mounted from `hasMore`. Load more's append path is unverified — 12 fixtures, page 24.
- [x] **T-14 `/post/[id]` + `/post/create`.** Body + at most one attachment (own character or cut),
      image/GIF embed, no edit route. Landed: permalink reuses `PostCard` (`fold={false}`,
      `foot={false}`) + ratio/counts aside + vote/bookmark/report/delete + `CommentThread`;
      composer with body gate (`postWriteSchema`), own-characters / own-session-cut picker,
      attribution for a cut, NSFW toggle. `repo.addPost` / `deletePost` (cascade) / `listMySessions`.
      Accept met: the adapter refuses a character the viewer does not author, and the picker only
      lists the viewer's own. Image/GIF embed deliberately not drawn — no uploader, no media field.
- [x] **T-15 `/session/[id]`.** Transcript, composer, awaiting-response state, settings menu
      (New Session, Delete with confirmation), Switch persona, publish-a-cut flow, participant
      copies with Edited/Updated/Restore/Unlinked states. Landed: header with in-session name +
      persona control, append-only transcript (`repo.appendTurn`), in-flow composer with a
      `lib/llm/chat.ts` reply seam (`replyTo()` → `null`, nothing faked), settings sheet with exactly
      New Session / Delete session (confirmation + `repo.deleteSession`), `repo.setSessionPersona`,
      copies disclosure with `updateCopyFromOriginal` / `restoreCopy` and an unlinked state that keeps
      the copy running, publish-a-cut via a two-step sheet around the extracted
      `components/PostComposer.tsrx`. **Not done:** `Edit session copy` (needs a copy write schema +
      form) and the *Awaiting model response* state (T-16's, nothing to draw it for yet).
- [x] **T-16 LLM seam + mock turns.** `lib/llm/chat.ts` + `mock.ts` + `Preview mode` chip; a turn
      appends to the transcript with the character's in-session name. Accept: in preview mode a
      sent message produces a deterministic reply after the awaiting state. Landed: `chat.ts` splits
      into `provider.ts` (a `VITE_CHAT_ENDPOINT` URL and no key — the function holds it) and a pure
      `mock.ts` (reply = f(transcript length, in-session name), fixed 180ms so the state paints);
      `repo.appendReply` is the one model write path, through `turnWriteSchema`; `chatReplySchema`
      is the one payload shape, `safeParse`d on both transports. The page draws *Awaiting model
      response* as a two-line skeleton under the in-session name and *Send failed* under the
      composer (`null` now means the provider failed, never "no model"). The `Preview mode` chip
      sits in the composer's meta line, because the session route hides the shell's top bar.

## P2 — Authoring, collections, people

- [x] **T-17 `/character/create` + `/edit`.** One-column form, avatar pick, SFW/NSFW toggle,
      lorebook attachments by ID and picker, unavailable rows kept. Accept: save publishes and
      lands on detail; invalid lorebook ID blocks with the spec's error.
- [x] **T-18 `/lorebook/*` (catalog, create, detail, edit).** Entries list, body editor. Accept: a
      lorebook saves with its entries, edit preloads them, reorder persists, and delete removes the row
      without touching a character's attachment.
- [x] **T-19 `/preset/*` (catalog, create, detail, edit).** Generation settings form.
- [x] **T-20 `/persona` collection + create/edit/detail.** Default persona rules, delete moves the
      mark, never shared/flagged. Accept: deleting the default reassigns in one step.
- [x] **T-21 `/bookmarks`.** One catalog per type, dead cards for removed items, tabs in query.
- [x] **T-22 `/notifications`.** Aggregated rows (same kind + same target fold), read state.
- [x] **T-23 `/user/[username]` + `/user/edit`.** Profile tabs (creations, posts, follows,
      followers), account settings incl. NSFW prefs, no email/provider/delete controls.
- [x] **T-24 `/terms`.** Static legal copy from the spec, anchors, NSFW/JEV cross-links. Three
      prohibitions as a numbered list, five notes, `TERMS_RULES` / `REPORT_REASON_RULE` in
      `schema.ts` shared with `ReportDialog`, `lg` contents rail; onboarding's **Finish** now says
      it is the acceptance and links here.

## P3 — Moderation and JEV

- [x] **T-25 NSFW preference everywhere.** `NsfwControl` on the three catalogs and the thread
      (pair signed in, one sign-in control signed out); the same single action on
      `/authentification`, held as an intent in `prefs.ts` and applied at sign-in; reveals keyed by
      a per-fetch epoch so a refetch re-covers them. Detail routes already drew the Show-off veil.
- [x] **T-26 `/moderation` queue.** Weight-ordered, cumulative report list, open/concluded filter,
      counts, admin gate. Row is metadata only — no preview of the reported content.
      — `pages/moderation-queue.tsrx` draws the list on page 1 (`Select` filter in the URL, counts
      from two `listReports` calls), the `forbidden` state for the mock account, and `?admin=1` as
      the reviewer's switch. JEV's verdict is read from the row, never recomputed.
- [x] **T-26B `/moderation/[report.id]`.** The case itself: cumulative reports, conclude with a
      visibility outcome (remove avatar as part of it), dismiss after the full term checklist, set
      reason, internal comments, flat history, and the notification the conclusion writes. Needs its
      own writes (`caseCommentSchema`, conclude, dismiss) — split out of T-26 on purpose.
      — `pages/moderation-detail.tsrx` draws the case read-only above its paperwork; `repo` gained
      `concludeReport` / `dismissReport` / `addCaseComment` / `getComment`, `reportSchema` gained
      `history` + `decision`, and the conclusion writes the creator's moderation row.
- [x] **T-27 JEV adapter.** `lib/llm/jev.ts` posting `{model,state,questions}` to
      `POST https://openrouter.ai/api/alpha/decisions` with `typesafe/jev-1.14` (docs/JEV.md has the
      exact question set and state shape); `lib/llm/jevPolicy.ts` holding the thresholds and the
      action table from `systems/jev.md`; clear→act, unsure→escalate, copy claims→moderator; cached
      verification flag cleared on edit. Accept: a real verdict returns for a sample item, the
      policy maps it to the spec's action, and a model failure falls through to "unsure".
      — `lib/llm/jev.ts` (decisions transport, `provider: "TypeSafe"` required, `null` on every
      failure), `lib/llm/jevPolicy.ts` (thresholds + claim reading + action table, no I/O),
      `jevPayloadSchema`/`jevRequestSchema` in `schema.ts`, `mockJevAnswers` for the preview, and
      `addReport` now scans once per item change: act + notify with no case, or escale with the
      verdict on the case. T-28B gave a post a status, so a certain violation now removes it.
- [x] **T-28 Moderation surfaces on detail pages.** Owner notice (report, reasons, measures),
      Awaiting re-verification, Request public again. — `moderationNoticeSchema` (one row per measure,
      keyed by target) + `repo.moderationNotice(kind,id)` (newest of that row and the case that hid the
      item) + `repo.requestRepublication(kind,id)` (runs `classify()` at once, owner-only); the three
      authored detail pages draw the notice, the gate (`updatedAt > notice.at`) and the three states.
- [x] **T-28B A post can be removed.** `postSchema` grew `status: "visible" | "removed"` (T-28B) —
      fixtures (post 6 seeded `removed`), `clearAction("post")` answers `removed`, `applyJevAction` and
      `concludeReport` share `removePost` (row kept, thread deleted in cascade, vote dropped), every
      listing drops the row (`livePost`) while `getPost` still answers it by id, the bookmarks tab reads
      it as a dead card, and `/post/[id]` draws the spec's *Removed by JEV* sentence plus one
      consequence line for the author.

## P4 — Real backend

- [ ] **T-29 Supabase schema.** `supabase/migrations/0001_init.sql`: every entity, FKs, cascades
      (delete item → thread), vote uniqueness, cumulative report joins, verified flags, RLS
      policies per role. Accept: migrations apply cleanly on a scratch DB and `repo.supabase.ts`
      passes the same contract test as `memory.ts`.
- [ ] **T-30 Auth wiring.** Google/GitHub/Discord via Supabase, onboarding gate, redirect matrix.
- [ ] **T-31 Storage.** Avatars, post images/GIFs, size/type limits, NSFW-flag metadata.
- [ ] **T-32 Edge Functions.** `chat` (DeepSeek) + `jev` (OpenRouter), streaming off, strict JSON,
      secrets set with `supabase secrets`, no key in the bundle. Accept: a real turn and a real JEV
      verdict return from the deployed function, and the client falls back to mock without env.

## P5 — Tauri (desktop + mobile hardware)

- [x] **T-33 Tauri shell hardening.** Window sizing per breakpoint, persistent session, deep-link
      handling, `Ctrl/Cmd+K`. Accept: `bun run tauri dev` opens the app on desktop.
      — **The window half.** Opens at 1200×900 (`lg`) instead of 800×600, floors at 360×740, label
      `main` matching the capability, and `scripts/tauri-config.mjs` puts all of it in the gate
      (section 6). Accept measured on this box: `bun run tauri dev` under the live Hyprland session,
      `hyprctl clients` → `{class:"luaplot", title:"LuaPlot", mapped:true}`, `grim` shows the rendered
      `lg` shell. The other three deliverables moved to **T-33B** — they were not done, and two of
      them cannot be done as written.
- [ ] **T-33B Tauri shell, part two: the session, the deep link, the key.** (a) *Persistent session* —
      the app must remember signed-in / signed-out across a restart; `lib/state/session.ts` is
      memory-only today. Persist through `schema.ts` (a `handleSchema.safeParse` on read), never a raw
      `JSON.parse`. (b) *Deep-link handling* — needs `tauri-plugin-deep-link` + a `luaplot://` scheme
      registered in the bundle config; the ticket must name that dependency before it lands.
      (c) *`Ctrl/Cmd+K`* — **blocked on a decision**: no spec file describes a command palette
      (`src/specs/` has no `palette`, no `ctrl+k`), and `luaplot-pages.md` is product law. Either a
      human records the palette in `docs/DESIGN.md` or (c) is struck from the ticket.
      — **(a) is done (T-33B(a)):** `session.ts` keeps `{handle, displayName}` in `localStorage` under
      `luaplot.session` through `storedSessionSchema` (no `JSON.parse` at the store, `isAdmin` never
      persisted), proven on the live site by sign-out → reload → still signed out and sign in → reload →
      still signed in, plus `schema:check` section 4. **The webview half is also proven** (same day):
      a `bun run tauri dev` window on Hyprland, signed out and signed back in, then relaunched on both
      states — `SESSION · signed out` survived one restart and `SESSION · signed in as You` the next,
      with WebKit's own store holding UTF-16 `null` / `{"handle":"you","displayName":"You"}` and no
      `isAdmin`. **(b) and (c) stay blocked** exactly as below: one needs a named
      dependency, the other a product decision. `docs/NEXT.md` carries the keyboard-only drive recipe.
- [x] **T-34 Native bridge.** `lib/native.ts` with haptics, share, clipboard, image picker, badge;
      browser fallbacks proven. Accept: web build has zero Tauri imports in the bundle graph.
      — `nativeResultSchema` on every call, ladder plugin → web API → `unsupported`, dynamic
      `@tauri-apps/api/core` chunk (`core-*.js`) that the browser never requests (measured), and
      `/dev/native` exercising all five. Rung 1 is inert: no plugin is compiled into `src-tauri`.
- [ ] **T-35 Android toolchain.** Install cmdline-tools + platform 35 + NDK, rust targets
      `aarch64-linux-android`/`armv7`/`i686`/`x86_64`, `tauri android init`. Accept: debug APK
      builds; note the exact commands in PROGRESS.
- [ ] **T-36 Mobile polish.** Safe areas, keyboard-avoiding composer, pull-to-refresh off,
      hardware back button mapping, 60fps transcript scroll. Accept: APK runs on device/emulator
      with no clipped input and haptics fire on send.
      — **T-36(a) done:** `src/lib/viewport.ts` writes `--keyboard-inset` from
      `innerHeight - visualViewport.height - offsetTop` (clamped 0…400, rAF-coalesced, `resize` +
      `scroll` on the visual viewport), installed once in `App.tsrx`; walk row 32 shadows
      `vv.height` at 360×740 and reads the session dock's bottom padding 8 → 328px. The rest of
      T-36 (a real APK, keyboard on device, hardware back, 60fps scroll) still needs T-35's
      Android toolchain.

## P6 — Release

- [x] **T-37 Accessibility + perf pass.** Focus order, labels, contrast ≥ 4.5, bundle < 300KB gz,
      no layout shift on fonts.
- [x] **T-37B Light-flavour contrast.** `--color-accent-text` is the accent's text tier — the mark on
      dark flavours, `color-mix(… 85%, --ctp-text)` on Latte (`#7f3cdb`) — used by the active nav
      label and three link hovers; marks keep `--color-accent`. Smoke row 31 measures the tab pair in
      the page per flavour via media emulation: Mocha 8.64:1, Latte 4.83:1 (was 4.45).
      — **Done** (T-37C): the rest of the accent's text joined the tier and the hover got a tier of
      its own (`--color-accent-hover-text`: lavender on dark, `color-mix(… 40%, --ctp-text)` = `#64469f`
      on Latte, 5.91:1 on a card and 4.66:1 on `--color-surface`). `a`, `a:hover`, `a.card-title:hover`,
      `a.persona-card-name:hover`, `a.persona-card-open:hover`, `.post-comments:hover`,
      `.persona-card-mark` and the selected tab's count moved; every fill kept `--color-accent`. The
      `md` rail stopped filling — its active indicator is now the 2px bar `lg` drew (DESIGN → *Layout
      law*). Row 31 grew, `EXPECTED_ROWS` stayed 31: bare link 4.83 / hover 5.91 (Latte), rail 4.83
      on the rail's own plate with no fill.
- [x] **T-38 End-to-end smoke.** Scripted walk of the 12 primary journeys against the Pages build.
      — `scripts/smoke.mjs` (+ `scripts/smoke.sh`, `bun run smoke`) walks all twelve in one session at
      360×740 and asserts on the DOM at every step; 12/12, ~7s; `--live` walks the published URL.
- [ ] **T-39 Release.** Signed Android APK, desktop AppImage, README with links, tag `v0.1.0`.
- [x] **T-40 Two stale renders the walk cannot see.** `/character/[id]/edit` can show another
      character's name in its fields when read ~1.5s after navigation (a 1.8s read sees the right
      one), and `/moderation/[case.id]`'s *THE ITEM* panel keeps the old body after *Conclude* until
      a reload. Accept: an edit form's inputs always hold the character named in the URL, and the
      item panel re-renders the outcome in place; both proven by a `scripts/smoke.mjs` step.
      — The edit half did not reproduce: the form mounts only in the page's `ready` branch, so it is
      created from the row the URL names (measured: the only stale frame is the shell's own
      transition, ~1 frame before the outlet's skeleton). The case half was real and is fixed: the
      post chip read a hard-coded `No visibility`, so a concluded *Removed* case still said nothing
      had happened. Both are now steps in the walk (13 rows then; 16 after T-41).
- [x] **T-41 Walk the other three authored forms.** `/persona/[id]/edit`, `/preset/[id]/edit` and
      `/lorebook/[id]/edit` mount the same phase-union → skeleton → form pattern as the character
      editor and no session has ever opened one. Accept: three new `scripts/smoke.mjs` journeys
      (16 rows) each proving preload identity twice, a real save, and the saved value on the detail
      page. Why next: it is the only work left that a headless session can verify.
      — All three walked clean; no defect reproduced. The walk is 16 rows: a fifth lorebook entry
      block that the detail page then prints, a preset model change that leaves the description
      intact, and a persona tagline that reaches both the detail page and the collection card (plus
      the *missing* sentence that replaces `forbidden` for a persona). Two read-back helpers
      (`retype`, `choose`) now make every field edit a two-read proof.
- [x] **T-42 The refusal states have never been walked.** Every authored edit route declares a
      `missing` / `forbidden` / `error` union and the walk only ever opens the `ready` arm: a
      fixture owned by someone else must read *isn't yours to edit* and an unused id in the right
      bucket must read the form's own *doesn't exist* sentence. Accept: four new journeys (20 rows)
      over `/character`, `/lorebook`, `/preset` on a row owned by `ada` (forbidden) and on a dead id
      (missing), each asserting the exact sentence and that the refusal offers the main action's
      destination. Why next: read-only, fixture-backed, and the only remaining coverage a headless
      session can prove.
      — Landed as **three journeys, 19 rows** (the baton allowed 19 or 22; one row per type with two
      hops, because each hop is a fresh mount and a fresh page read, so the second assertion is
      independent evidence). Personas are excluded: a persona has no `forbidden` arm (T-41 walks its
      `missing` sentence). Each hop asserts three facts through a new `refusal()` helper — the exact
      sentence, that **no `<form>` mounted**, and that `Back to catalog` resolves under the served
      base to that type's own catalog (`/LuaPlot/…` live). No defect reproduced. The first run failed
      all three rows because my `OTHER_*` constants omitted the trailing `/edit` — the routes then
      answered the app's 404, which is exactly the mistake the baton's bucket trap warns about; the
      failure message named the sentence and the path, so it was a one-line fix.
- [x] **T-43 Walk `/dev/native`'s presses.** The one dev page whose evidence is still hand-asserted in
      `PROGRESS` (T-34): the four `native.ts` calls, the clipboard road and the Tauri chunk boundary
      are proven by prose, not by a script. Accept: new `scripts/smoke.mjs` journeys that press each
      control with a **real** `Input.dispatchMouseEvent` (a synthetic `.click()` cannot copy — see the
      finding in `docs/NEXT.md`) and assert the parsed `nativeResultSchema` answer each press prints,
      plus zero `core-*` resource entries after every press. Why next: the only page with behaviour
      behind it that no script has ever exercised.
      — Landed as **five journeys, 24 rows**: one per capability, because one row pressing all five
      would prove something answered, never which road ran. Pick intercepts the chooser and hands a
      real temp PNG to the opened node; Badge presses 3, reads, clears, reads (the title is derived
      from the page's own pre-press title — `(3) Native — LuaPlot`, not the `(3) LuaPlot` the brief
      guessed, because `App.tsrx` titles every non-root route). Two engine facts recorded: this
      Chromium answers `navigator.vibrate` truthy (T-34 measured `false`), so that row asserts one of
      the two legal verdicts instead of a literal.
- [x] **T-44 Walk the three remaining dev pages, and measure a breakpoint.** `/dev/state`,
      `/dev/data` and `/dev/primitives` are the last pages a headless session can reach. Accept:
      three `scripts/smoke.mjs` journeys (27 rows) — the NSFW/session stores read back through a
      product page, one `/dev/data` mutation found again in `/character/catalog`, and `/dev/primitives`
      read at 360/640/900/1200 through `Emulation.setDeviceMetricsOverride` (no document-level
      horizontal scroll, a grid that gains columns, 44px targets at 360), cleared in a `finally`.
      Why next: the 24 rows all run at 360×740 — the contract's mandatory desktop responsiveness has
      never been measured by anything. Every other open ticket is blocked on hardware or a project ref
      (register in `docs/NEXT.md`).
      — Landed as **27 rows**. The ladder as measured, live:
      `360:1col/field1/rail0/btn44/outlet340 · 640:2col/field2/rail0/btn44/outlet620 ·
      900:3col/field2/rail84/btn44/outlet794 · 1200:3col/field2/rail240/btn44/outlet794`.
      The accept line's "a grid that gains columns" holds at `sm`/`md` and **stops at `lg`**: the
      stylesheet keeps three columns because the reading column is 794px, so `DESIGN.md`'s
      "1 / 2 / 3 / 4" was stale and was corrected here. `/dev/data` is proved by a round trip to
      `/character/catalog` *and* the character page's Likes cell, because the card's ratio rounds
      (96% → 96% on this fixture set).
- [x] **T-45 Home's entry control must stop re-booting the app.** The landing page's one control is
      `<a class="btn btn-primary" href={target.value}>` with **no `follow()`**, so *Sign in* / *Open
      profile* discards the running app and boots it again — the last full document load in the shell,
      and the reason walk row 1 used to pass on a seed bug instead of a sign-in. Accept: the anchor keeps
      `href` but navigates in-app (`onClick={follow(target.value)}`), no second `reload` navigation entry
      appears when it is pressed, the **signed-in arm** (`/user/{handle}`) joins the walk as row 28, and
      `check.sh` GREEN + `smoke.sh` 28/28 locally and `--live`. Why next: the only open defect that is
      neither blocked nor cosmetic; the fix is one attribute and the proof is the work.
      **Done** (T-45): `follow()` now lives in `router.ts` (one seam, `App.tsrx` and `CatalogSwitch.tsrx`
      use it too), the walk proves document identity rather than a URL, and the live walk caught the
      ticket's real trap — `follow(href(x))` doubled the base on Pages. `EXPECTED_ROWS` is now explicit so
      a vanished row is a red walk instead of a green one.
- [x] **T-46 Every in-app link is a push, not a load.** T-45 gave the app one seam (`follow()` in
      `router.ts`) and converted home; ~30 anchors remain bare — *Edit profile* on your own profile,
      the catalogs' *Create* buttons, the signed-out *Sign in* buttons on the create pages, and the
      card title/handle/author links. Each is a document load: the mock re-seeds and the shell
      repaints from scratch. Accept: every internal anchor pairs `href={href(path)}` with
      `onClick={follow(path)}` (a **path**, never `href(...)` — that doubles the base on Pages),
      hash links stay bare, `scripts/link-check.mjs` enforces the rule as a `check.sh` section and is
      proved red against a broken copy, and walk row 29 presses *Edit profile* and proves no reload.
      Why next: it is the same defect class T-45 just made cheap to fix, and the work is mechanical.
      Brief: `docs/NEXT.md` → T-46.
      — **Done** (T-46): 53 internal anchors now pair `href={href(path)}` with `onClick={follow(path)}`;
      `EmptyState` takes the **path** (`to=`) and owns the pair itself, so its 39 call sites cannot
      regress; the three page-local `openLink()` copies of `follow()`'s modifier check are gone.
      `scripts/link-check.mjs` is gate section 7 and was proved red on a broken copy (single-line and
      multi-line tags, fragment and `target="_blank"` exempt). Row 29 presses *Edit profile* and proves
      document identity; 29/29 local and `--live`.
- [x] **T-47 The card's links reach the 44px floor.** Measured in T-44 and carried in the failure
      bank: `.card-foot`'s author link was a ~16px text run, `PostCard`'s avatar link was 36×36, and
      `UserCard` put two links on one destination. Accept: `.card-foot` is a 44px band whose only
      interactive child is the stretched author link (the ratio stays plain text), `.post-avatar` is a
      44×44 box *around* the 36px drawing, the person card's handle is not a link, `DESIGN.md` → *Card*
      carries the rule and the numbers, and walk row 30 measures both at 360×740 with no horizontal
      scroll. No new class, no colour, no dependency.
      — **Done** (T-47): `line-height: 44px` is the band (type unchanged), `flex: 1 1 auto` is what
      makes it a 44px *wide* target — the first run failed for a 36px-wide box around a 2-letter
      handle. `.post-avatar` grew by `margin: -4px` so the drawing did not move. Row 30 prints
      `catalog author 244×44 in a 45px foot … thread avatar link 44×44 around a 36px drawing`, and was
      proved red (16px) with the band removed. 30/30 local and `--live`.
- [x] **T-48 A static guard for the accent's text tier.** `--color-accent` / `--color-accent-hover` may
      paint `background-color`, `border-*`, `outline`, `box-shadow`, `fill`, `stroke` and
      `accent-color` — never the `color` property. Accept: `scripts/tier-check.mjs` scans
      `src/styles.css` and every `src/**/*.tsrx` `<style>` block, `check.sh` grows section 8 and still
      prints `GREEN`, the scanner is proved red on an injected `a:hover { color: var(--color-accent) }`
      (naming `file:line`), and no colour changes in the commit. Why next: it is the only way the tier
      survives a page nobody walked — T-37C's sweep is a list in a doc today. Brief: `docs/NEXT.md`.
      **Done, with one premise corrected:** the tree was *not* byte-identical to what passed row 31 —
      T-37C's sweep reached `src/styles.css` only, and the `.tsrx` `<style>` blocks still had **26**
      declarations painting text with the mark. Section 8 found them on its first run; they took the
      text/hover tiers, and the three `.vote`/`.save` pressed pills (own `--color-surface`, where no
      static accent tier clears AA in Latte) became an accent fill with `--color-accent-contrast`. The
      walk stayed 31/31 with row 31 unmoved, so `styles.css` was not touched at all.
- [x] **T-49 The session's copies become a walk row.** The product law *sessions read copies, never
      live items* had no row: nothing had opened the **Session copies** disclosure, read a copy's
      state or pressed **Restore**. Row **33** (33/33 local and `--live`) reads the closed header, the
      three states (`edited` / `unlinked` / `untouched`), the per-state controls, and the restore's
      effect on both the row and the tracked sentence. Proved red first. Two ticket premises were
      wrong and the DOM won: session 2 holds three copies (not four) and the summary drops the suffix
      rather than printing `0 edited`.
- [x] **T-50 A persona carries none of the shared-item chrome.** The law *personas are personal
      (never shared, never moderated, never counted)* is a law about **absences**, so no gate that
      reads what a page has can see it break. Row **34** (34/34 local and `--live`) opens an own
      persona and counts, inside `.detail` only: 0 report controls, 0 save/bookmark controls, 0
      engagement elements, 0 comment elements, 0 forms — after reading the name and the four controls
      the spec does require, so an empty page cannot pass. Then `/persona` is own-only (one
      `.persona-card` per `.card-cell`, every card under the served base to a seeded persona id), and
      an unowned id reads the one sentence with no form and a road back to `/persona`. Proved red
      first by injecting a `Report` button. Brief: `docs/NEXT.md`.
- [x] **T-51 A fixed segment wins over an id param.** The law *IDs carry identity, names never do.
      Fixed segments (`catalog`, `create`, `thread`) win over `[id]` params* is a **precedence** rule
      — `spec-routes.mjs` proves every route's page module resolves, never which row of the table
      wins a path, so no gate could see it break. Row **35** (35/35 local and `--live`) walks the
      nine literal siblings as addresses (`/character/catalog`, `/character/create`,
      `/lorebook/catalog`, `/lorebook/create`, `/preset/catalog`, `/preset/create`,
      `/persona/create`, `/post/thread`, `/post/create`) and reads four landmarks per page: its own
      root class (`.catalog` / `.create-page` / `.thread` / `.compose-page`), its `.kicker`
      sentence, `document.title`, and on a create page a mounted `<form>` — with `.detail`'s
      **absence** as the other half. The control half opens a real uuid at the same depth and must
      still reach the detail page. Proved red first: `/character/catalog` mounted the detail page
      (`.detail ×1`, title `Character — LuaPlot`) and the row named it. Brief: `docs/NEXT.md`.
- [x] **T-52 Engagement is a ratio on a card, and counts live on the detail page.** The law *Engagement
      is metadata on cards (ratio only) and actions on detail pages (counts live there)* is a rule
      about **where a number lives**, and every existing gate reads presence — `tier-check.mjs` reads
      colours, `link-check.mjs` reads anchors, row 30 measures a card's links, row 31 a token's
      contrast. Row **36** (36/36 local and `--live`) reads the engagement surface of every card on
      `/character/catalog` as data: one `.card-ratio` each, text a whole percent, a `SPAN` outside any
      `a`/`button`/`[role=button]`, and zero `.count`/`.counts`/`.count-label`/`.count-value`/
      `.comments` inside it (20/20 cards). The other half opens `/character/[id]` and asserts the four
      engagement cells and both `.vote` controls, and `/post/thread` is measured as the **other** card
      on purpose — two `.post-count` cells and one comment link, no ratio, which is what `thread.md`
      fixes for posts. Proved **red** first: a `<span class="count">{item.likes}</span>` in the card
      footer made the row report `the card for "The Lamplighter's Widow" … with ["count"] inside it —
      20/20 card(s) fail`. Brief: `docs/NEXT.md`.

## Failure bank (the ways this class of product breaks)

1. Card blur hides the numbers → footer stays outside the blur (T-08).
2. Session reads live items, so author edits corrupt running chats → copies only (T-15).
3. `Load more` state lost on back → paging in component state, filters in URL (T-09).
4. NSFW preference treated as access control (404s) → detail routes always resolve (T-25).
5. Voting allows multiple votes per viewer → uniqueness in adapter and DB (T-03, T-29).
6. Report piles create one scan per report → cumulative case joins (T-27).
7. Deleting an item orphans its thread → cascade delete (T-29).
8. Deleting a persona leaves the collection without a default → reassign in one step (T-20).
9. JEV deletes authored content → visibility only, ever (T-27).
10. API keys end up in the client bundle → server-only Edge Functions (T-32).
11. Preview build looks produced but is mock → `Preview mode` chip stays until real backend (T-16).
12. Deep links 404 on Pages → `404.html` fallback published by `publish.sh` (T-01).
13. Repo goes private again → Pages breaks; `check.sh` warns if the remote is private.
