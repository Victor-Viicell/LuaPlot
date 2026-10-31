# Baton — what the next session does

**Ticket: T-28 — the owner's side of a moderation outcome. P3 closes for real.**

Spec: `src/specs/pages/character/detail.md` → *Owner*, *States*; the same sections in
`src/specs/pages/lorebook/detail.md` and `src/specs/pages/preset/detail.md`;
`src/specs/systems/jev.md` → *Privacy and republication* and *Verification*;
`src/specs/components/report.md` → *What happens next*.

Why next: T-27 made JEV act. A certain violation now **makes an authored item private immediately
and opens no case**, which means the notice `character-detail.tsrx` already draws
(`loadNotice` → `listReports` filtered by target) has **nothing to read** for exactly the content
that most needs it. The owner sees a private item with no report, no reasons, and no measure — the
spec's *Privated by moderation* state without its notice. That gap, plus the two states the detail
pages have never had (**Awaiting re-verification**, **Request public again**), is this ticket.

## Approach

1. **Decide where an immediate action's record lives** (open decision below — decide it first, in
   writing, in `docs/DESIGN.md`, before drawing anything). The spec is explicit that an immediate
   action *opens no case and never enters `/moderation`*, yet the owner must see *the report, the
   reasons, and the measures taken on the content page itself*. Whatever is chosen must be readable
   by `loadNotice` on all three detail pages and must not put the row in the open queue.
2. **`repo.requestRepublication(id)`** — authored kinds only: flags the item for re-verification,
   runs `classify()` from `lib/llm/jev.ts` against the item's current text, and on a clean answer
   sets `verified: true` and `isPublic: true`; on anything else the item stays private and the
   owner sees *Awaiting re-verification* until the answer lands. A request starts its check at once
   (`systems/jev.md` → *Verification*), so the page's phase is `awaiting` while the call runs.
3. **The button is owner-only and appears only while private**, next to the notice; it is absent
   on someone else's item and on a visible one. Tap targets ≥ 44px, and it must survive the
   in-app-navigation rule (no hard reload: the memory adapter loses runtime rows).
4. **States on all three pages**: *Privated by moderation* (notice + reasons + measures),
   *Awaiting re-verification* (a live region, no spinner without a skeleton), *Verified and public
   again* (a one-line confirmation that clears itself into the ordinary public view).
5. **Patch the same three pages only.** `comment` and `post` have no republication: removal is
   final (`systems/jev.md` → *Privacy and republication*), so no control appears for them anywhere.

## Traps

- **`loadNotice` reads cases, and an immediate action has none.** Whatever record is chosen, the
  notice loader changes with it — do not bolt a second lookup beside the first.
- **`navigate()` writes only what you give it**; any navigation the new control adds must stay
  in-app, never `location`.
- **`verified` is internal** (`systems/jev.md` → *Verification*): no badge, no field. The only
  visible effects are *awaiting* and the item coming back public.
- **An edit already clears `verified`** in `updateCharacter` / `updateLorebook` / `updatePreset` —
  do not add a second clearing path, and do not clear it on open.
- **A republication request runs the model**, so the page needs Loading / Error / Success and a
  `Preview mode` chip while `previewMode()` is true (`docs/JEV.md` → *Mock mode*).
- **Ripple:** `@if` branch = one node; `@for` needs `const`; `effect()` is the only hook; a page's
  scoped CSS cannot reach a primitive's internals (wrap them).
- **Never** let a republication request touch a post or comment, and never delete anything: JEV
  changes visibility only.

## Open decisions

- **What an immediate action leaves behind.** Candidates: (a) a concluded case whose decision is
  JEV's own — gives the owner a full notice but puts the row in `/moderation?status=concluded`;
  (b) a `moderation` notification **plus** a `noticeSchema` row keyed by target, storing the
  reasons and the measure; (c) keep the notification only and let the notice read the creator's
  notification rows. Pick one and record why in `docs/DESIGN.md` + `docs/ARCHITECTURE.md`; the
  schema must own the shape whichever it is.
- **Whether *Request public again* is gated on the reasons being patched.** The spec says the owner
  may request *once every reason has been patched*, and that reasons are not acknowledged one by
  one — there is no per-reason record, so the gate can only be *the item was edited since the
  decision*. Decide and write it down.

## Found while working (carried forward — keep this list growing)

- **T-27 is done**: `lib/llm/jev.ts` (decisions route, `provider: "TypeSafe"` required, `null` on
  failure, second `same_text` request), `lib/llm/jevPolicy.ts` (thresholds + `claimOf` + `decide`),
  `jevPayloadSchema` / `jevRequestSchema` / `jevContentStateSchema` in `schema.ts`,
  `mockJevAnswers` / `mockSameText` in `mock.ts`. `addReport` is the one scan point: verified →
  held, open case → join and add weight, otherwise one `classify()` → act-and-notify with no case,
  clean-and-verify, or escalate with the verdict stored on the case.
- **An immediate action files no report row at all** (T-27): the dialog is answered `submitted` and
  nothing is stored except the creator's notification. That is why the owner's notice is empty for
  exactly that content — see T-28's open decision.
- **A certain violation on a post escalates, not removes** (T-27): `postSchema` has no `status`, so
  `clearAction()` in `jevPolicy.ts` returns `escalated` for a post and the note says why. **Filed as
  T-28B** — flip that one branch when the row can hold a removal.
- **`assets: []` is deliberate** (T-27): there is no vision pass, so an image-only report escalates
  (`imageOnly`) instead of asking a text model to judge a picture. A vision pass belongs with the
  `jev` Edge Function (T-32).
- **A new case needs `history: []`**: `reportSchema` requires it since T-26B, and `addReport` was
  the one place that did not set it (every report that opened a case threw until T-27 fixed it).
  Any new case-building code goes through `reportSchema.parse`, which is what caught it.
- **`postSchema` has no status, so a post cannot be marked removed** (T-26B/T-27): the conclusion
  is recorded on the case, the row stays where it is, and nothing hides it from a listing.
- **"Set reason" is folded into the decision** (T-26B): the case panel's one `Reason` field is the
  moderator's words, written by `concludeReport`/`dismissReport` as `decision.reason`.
- **`event` is a DOM global**: name history helpers `historyEvent`.
- **`@for` needs `const`**: `@for (row of rows)` crashes `tsrx-tsc` with *Cannot read properties of
  undefined (reading '0')*. Write `@for (const row of rows; key row.id)`.
- **An `@if` branch renders one node**: wrap a header plus a body in `<>…</>`.
- **A gate named for the positive is a bug waiting**: name the flag for its effect
  (`concludeOff`) and check it in the browser.
- **The preview loses runtime rows on a hard reload** — every flow that writes must be walked
  **in-app**; a `goto_url` re-seed looks like a bug in the write.
- **T-26 is done**: `pages/moderation-queue.tsrx` is the queue — page 1, `Select` filter in the URL
  (`?status=open|concluded|all`), counts from two `listReports` calls, `forbidden` as a phase,
  `?admin=1` the reviewer's switch; `reportFilterSchema` + `reportSourceIsExternal()` in
  `schema.ts`; `relativeAge()` in `lib/format.ts`.
- **Open rows on `/moderation` are the escalated cases only**: a row prints an action word only for
  `made-private` / `removed` / `held`.
- **T-25 is done**: `components/NsfwControl.tsrx`; a reveal's lifetime is a fetch epoch
  (`CardGrid`'s `revealEpoch`), and any new listing that can refetch must pass it.
- **`/user/[username]`'s posts feed still keys on `post.id`** — one line when that feed is next
  touched.
- **`/terms` is done** (T-24): `TERMS_RULES` + `REPORT_REASON_RULE` in `schema.ts`, ids
  `#copied-content` / `#unmarked-nsfw` / `#illegal-content`; a hash in the URL needs a mount jump.
- **`<a>` and `<button>` do not nest**; **`{<Component />}` inside a fragment is a parse error**;
  **`effect()` is the only lifecycle hook**; **a component's root element cannot be styled**.
- **`/notifications` is done** (T-22): `markNotificationRead`, `markAllNotificationsRead`,
  `unreadNotificationCount`, `lib/state/inbox.ts`, badge in both nav hosts.
- **Counts now: characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12,
  reports 5 (3 open, 2 concluded), comments 22 (one removed placeholder), sessions 2, bookmarks 8
  (one dead), notifications 6 (3 unread), profiles 7, follow edges 15.**

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.
