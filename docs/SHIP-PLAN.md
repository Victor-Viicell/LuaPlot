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
- [ ] **T-03 Data contract + memory adapter.** `lib/data/types.ts`, `repo.ts`, `memory.ts`,
      `lib/fixtures/*` (≥8 characters, 6 lorebooks, 5 presets, 3 personas, 12 posts with comments,
      notifications, reports, 2 sessions with transcripts). Accept: a `/dev/data` route lists
      counts per entity from `resolveRepo()`.
- [ ] **T-04 Session + NSFW preference state.** `state/session.ts` (mock signed-in user, switchable
      signed-out), `state/prefs.ts` (Show/Blur, persisted per account in the adapter).
      Accept: toggling Blur in one place is reflected on a catalog after navigation.

## P1 — The pages that define the product

- [ ] **T-05 `/` home.** One screen: name, one paragraph, entry control (sign-in or profile).
      Accept: renders signed-out and signed-in; matches spec states exactly.
- [ ] **T-06 `/authentification`.** Three provider buttons, redirecting/cancelled/failed states.
      Accept: buttons call the auth seam; mobile layout has no scroll at 360×740.
- [ ] **T-07 `/onboarding`.** Username (3–24, `[a-z0-9_]`, case-insensitive uniqueness), display
      name, NSFW toggles; inline errors; Finish gated. Accept: invalid handle and taken handle both
      block Finish with the spec's copy; valid submit lands on profile.
- [ ] **T-08 Catalog card + grid.** Shared card (title header; avatar/tagline/tags middle;
      author + ratio footer), NSFW blur with per-item Reveal. Accept: blur covers only the middle;
      ratio visible while blurred; card opens detail.
- [ ] **T-09 `/character/catalog`.** Toolbar (search debounced 250ms, `All` filter, sort, NSFW
      toggles), grid, `Load more` (+24, hidden at end), query-string state, all six states.
      Accept: filter+sort survive reload; empty/no-results/end-of-list each render.
- [ ] **T-10 `/character/[id]`.** Identity, attached lorebooks (incl. unavailable), counts + ratio,
      bookmark, vote, report, settings menu (New Session/Bookmark/Report/Edit), Start/Continue,
      fork, owner moderation notice. Accept: every action mutates the adapter and the UI reflects it.
- [ ] **T-11 Comment thread component.** Depth-limited nesting, reply, vote, delete → placeholder,
      removed → placeholder, no bookmark on comments. Accept: deleting a parent keeps its replies.
- [ ] **T-12 Report dialog.** Reasons from `components/report.md`, one-tap submit, identical
      confirmation whether it opened or joined a case. Accept: report appears on the moderation
      queue in the adapter with cumulative weight.
- [ ] **T-13 `/post/thread`.** Public timeline, composer entry, NSFW handling, Load more.
- [ ] **T-14 `/post/[id]` + `/post/create`.** Body + at most one attachment (own character or cut),
      image/GIF embed, no edit route. Accept: attaching another author's item is impossible.
- [ ] **T-15 `/session/[id]`.** Transcript, composer, awaiting-response state, settings menu
      (New Session, Delete with confirmation), Switch persona, publish-a-cut flow, participant
      copies with Edited/Updated/Restore/Unlinked states.
- [ ] **T-16 LLM seam + mock turns.** `lib/llm/chat.ts` + `mock.ts` + `Preview mode` chip; a turn
      appends to the transcript with the character's in-session name. Accept: in preview mode a
      sent message produces a deterministic reply after the awaiting state.

## P2 — Authoring, collections, people

- [ ] **T-17 `/character/create` + `/edit`.** One-column form, avatar pick, SFW/NSFW toggle,
      lorebook attachments by ID and picker, unavailable rows kept. Accept: save publishes and
      lands on detail; invalid lorebook ID blocks with the spec's error.
- [ ] **T-18 `/lorebook/*` (catalog, create, detail, edit).** Entries list, body editor.
- [ ] **T-19 `/preset/*` (catalog, create, detail, edit).** Generation settings form.
- [ ] **T-20 `/persona` collection + create/edit/detail.** Default persona rules, delete moves the
      mark, never shared/flagged. Accept: deleting the default reassigns in one step.
- [ ] **T-21 `/bookmarks`.** One catalog per type, dead cards for removed items, tabs in query.
- [ ] **T-22 `/notifications`.** Aggregated rows (same kind + same target fold), read state.
- [ ] **T-23 `/user/[username]` + `/user/edit`.** Profile tabs (creations, posts, follows,
      followers), account settings incl. NSFW prefs, no email/provider/delete controls.
- [ ] **T-24 `/terms`.** Static legal copy from the spec, anchors, NSFW/JEV cross-links.

## P3 — Moderation and JEV

- [ ] **T-25 NSFW preference everywhere.** Every listing surface honours Show/Blur; signed-out
      state exposes the sign-in control; blur survives navigation per the one-view rule.
- [ ] **T-26 `/moderation` queue + `/moderation/[id]`.** Weight-ordered, cumulative report list,
      conclude action (visibility/removal), case history, admin gate.
- [ ] **T-27 JEV adapter.** `lib/llm/jev.ts` posting `{model,state,questions}` to
      `POST https://openrouter.ai/api/alpha/decisions` with `typesafe/jev-1.14` (docs/JEV.md has the
      exact question set and state shape); `lib/llm/jevPolicy.ts` holding the thresholds and the
      action table from `systems/jev.md`; clear→act, unsure→escalate, copy claims→moderator; cached
      verification flag cleared on edit. Accept: a real verdict returns for a sample item, the
      policy maps it to the spec's action, and a model failure falls through to "unsure".
- [ ] **T-28 Moderation surfaces on detail pages.** Owner notice (report, reasons, measures),
      Awaiting re-verification, Request public again.

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

- [ ] **T-33 Tauri shell hardening.** Window sizing per breakpoint, persistent session, deep-link
      handling, `Ctrl/Cmd+K`. Accept: `bun run tauri dev` opens the app on desktop.
- [ ] **T-34 Native bridge.** `lib/native.ts` with haptics, share, clipboard, image picker, badge;
      browser fallbacks proven. Accept: web build has zero Tauri imports in the bundle graph.
- [ ] **T-35 Android toolchain.** Install cmdline-tools + platform 35 + NDK, rust targets
      `aarch64-linux-android`/`armv7`/`i686`/`x86_64`, `tauri android init`. Accept: debug APK
      builds; note the exact commands in PROGRESS.
- [ ] **T-36 Mobile polish.** Safe areas, keyboard-avoiding composer, pull-to-refresh off,
      hardware back button mapping, 60fps transcript scroll. Accept: APK runs on device/emulator
      with no clipped input and haptics fire on send.

## P6 — Release

- [ ] **T-37 Accessibility + perf pass.** Focus order, labels, contrast ≥ 4.5, bundle < 300KB gz,
      no layout shift on fonts.
- [ ] **T-38 End-to-end smoke.** Scripted walk of the 12 primary journeys against the Pages build.
- [ ] **T-39 Release.** Signed Android APK, desktop AppImage, README with links, tag `v0.1.0`.

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
