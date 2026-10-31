# Baton — what the next session does

**Ticket: T-26B — the case itself (`/moderation/[report.id]`). P3 continues.**

Spec: `src/specs/pages/moderation/detail.md` (whole file — *Purpose*, *Data*, *Actions*, *States*,
*Rules*); `src/specs/systems/jev.md` → *Decisions*, *Privacy and republication*, *Cumulative reports*;
`src/specs/components/report.md` → what a report holds and why the reporter sees no outcome;
`src/specs/pages/terms.md` → the three terms the dismissal checklist ticks (anchors already in
`TERMS_RULES`). `docs/DESIGN.md` → *Moderation queue (decided in T-26)* — this page copies that row
idiom — and *Notifications (T-22)* for the notice the conclusion writes.

Why next: T-26 built the list and every row already links to `/moderation/<report.id>`, which is still
a `PagePlaceholder`. Escalation now has a destination but not a decision surface: `systems/jev.md`'s
whole half — *unsure → a human decides* — has nowhere to land. This is the last moderation surface
before the JEV adapter (T-27), and it is the page T-27's verdict will be displayed on.

## Approach

1. **Read the adapter first, then the gaps.** `reportSchema` (line ~861 of `schema.ts`) already holds
   everything the *Data* list names except the case's own writes: there is **no** stored history,
   **no** case comment, **no** conclude, **no** dismiss. This ticket adds those writes to
   `repo.ts` + `memory.ts` **and their shapes to `schema.ts`** (`caseCommentSchema`,
   `caseDecisionSchema` or two narrower writes, `caseEventSchema` for the flat history). Every write
   is `safeParse`d at the adapter, `z.infer` in `types.ts` — never a hand type.
2. **The history is append-only and flat.** *Comments are a flat chronological list, never a thread —
   no replies — and every admin sees the whole history.* One array of events (`comment`, `concluded`,
   `dismissed`, `reason-set`, `avatar-removed`), each with the admin's handle and its time; JEV's own
   action appears **without an admin attached**, as what it already did, not as an event.
3. **`Conclude` is one operation, not a form.** A visibility outcome (`public` | `private`), plus the
   optional `Remove avatar` when the avatar carries the violation while the text is valid, plus the
   reason. It writes: the outcome, `status: "concluded"`, `concludedAt`, the history event, and the
   creator's notification (`measure: made-private | avatar-removed`, `kind: "moderation"`) through
   the same shape `repo.listNotifications` already returns. Removing the avatar clears the verified
   flag like any edit (`detail.md` → *Rules*) but does not delay the conclusion.
4. **`Dismiss` needs the terms checklist ticked.** No violation, no visibility change (escalated
   content was never hidden). The checklist is `TERMS_RULES`' three entries — render the rule title
   and a checkbox per rule, all three required, gate the button on all three (a derived, handed to
   `Button` as a tracked, never an inline expression that freezes at mount).
5. **`Remove avatar` is not standalone** (`detail.md` → *Actions*): it is an option inside the
   conclude flow, drawn disabled with its own line when the item has no avatar (*No avatar to
   remove*).
6. **The case is still a display of metadata plus the content** — this is the one page where the item
   *is* rendered (the moderator must inspect it): type, content, avatar, current visibility, the
   cumulative reports with each reason and details, the copy claim's named source (internal id or
   link, split by `reportSourceIsExternal()`), and JEV's classification with its confidence
   (`percent()` from `lib/format.ts`). Keep the item itself in a read-only block: no edit controls,
   no link to the public page that would let an admin act there.
7. **One phase union**, like T-26: `loading | ready | forbidden | notfound | error`. Not found is the
   spec's own sentence, *"This report doesn't exist."* `currentUser()?.isAdmin` is false on the mock,
   so `?admin=1` stays the reviewer's switch (`docs/DESIGN.md` → *Moderation queue*), read here the
   same way T-26 reads it — the queue's filter **and** its row links already carry it.
8. **Zod at every boundary**: the route param is a uuid — `reportIdSchema.safeParse`-style
   (`z.uuid()`) before the adapter call, so a malformed deep link is *not found*, not a crash; the
   conclude/dismiss writes parse before storage; the notification is built from the schema.

## Traps

- **`/moderation/[report.id]` is already routed** (`router.ts`, `access: "admin"`) — replace
  `pages/moderation-detail.tsrx`, keep the entry.
- **A concluded case is final.** No reopen control for any admin (`detail.md` → *Rules*); a fresh
  report opens a new case. Do not draw a disabled Conclude either — draw the case as read-only with
  its decision and history.
- **Authored content is never deleted**, only made private; a post or comment is *removed* only after
  a confirmed violation, and a removed comment becomes the placeholder `comment-thread.md` describes.
- **The reporter is never told anything** — no notification to the reporter, no verdict on their
  surface. Only the creator gets one.
- **`weight` and `jev` are not editable** by this page: weight is the report count, JEV's verdict is
  stored history.
- **Page CSS cannot reach a primitive** (T-09): wrap `Checkbox`/`Field`/`Button` in page-owned
  elements.
- **A keyed `@for` needs the row's own identity**: `key event.id`, never the index.
- **Ripple:** a raw `try` statement inside a `@{ … }` setup block breaks the compiler (see *Found
  while working*); use `.then/.catch`. JSX text after an `{expr}` loses its leading space — put
  separators inside a template literal.

## Open decisions

- **Whether the conclude and dismiss forms are a `Sheet` or an inline panel** under the case. The
  report dialog is the app's only sheet; a moderator's decision is rarer and longer, so an inline
  panel that keeps the history visible may be better. Decide once and record it.
- **The history's event vocabulary** — the exact strings and whether a `reason-set` is its own event
  or an edit of the concluded one.
- **The reason on a case**: `detail.md` says *record or correct the reason behind the decision*, and
  `reportSchema.reasons` is the reporters' set. A moderator's reason needs its own slot (a
  `decision.reason` on the case), not a rewrite of what was filed.
- **Where the conclusion's notification lands** when the case is on a comment (a comment has no
  route of its own — `/notifications` already draws such a row without a link).

## After this

**T-27 JEV adapter** — `lib/llm/jev.ts` posting `{model,state,questions}` to
`POST https://openrouter.ai/api/alpha/decisions` with `typesafe/jev-1.14`, `lib/llm/jevPolicy.ts`
holding the thresholds and the action table. Read `.agents/skills/typesafe-ai/SKILL.md` and the live
docs first; decisions models never go through `chat/completions`, and the response must carry
`provider: "TypeSafe"` before any answer is trusted. The case page is where its verdict is displayed,
which is why it waits behind T-26B.

## Found while working (carried forward — keep this list growing)

- **T-26 is done**: `pages/moderation-queue.tsrx` is the queue — page 1, `Select` filter in the URL
  (`?status=open|concluded|all`), counts from two `listReports` calls, `forbidden` as a phase,
  `?admin=1` the reviewer's switch. `reportFilterSchema` + `reportSourceIsExternal()` live in
  `schema.ts`; `relativeAge()` (`2d ago`, `on 13 Oct`) lives in `lib/format.ts`; `ReportFilter` is
  now `z.infer`, not a hand union in `repo.ts`.
- **A raw `try` statement inside a `@{ … }` setup block breaks `tsrx-tsc`** (T-26): the compiler
  produces no source-map entry for the `try` and falls back to plain TypeScript, which then reports a
  dozen bogus `Unexpected token` errors inside the component's `<style>` block. Use `.then/.catch`
  (the notifications idiom) or move the logic into a plain `.ts` module. **When the errors point at
  CSS, look at the setup code first.**
- **JSX text after `{expr}` loses its leading space** (T-26): `{a} concluded` renders `2concluded` —
  put the separator in a template literal (`{` · ${b} concluded`}`).
- **`navigate()` writes only what you give it** (T-26): a filter change dropped `?admin=1` and locked
  the preview out of the page. Any URL the queue page writes must re-add the preview switch.
- **Open rows on `/moderation` are the escalated cases only**: `jev.action` is `escalated` on every
  open fixture (an immediate action opens no case), so the row prints an action word only for
  `made-private` / `removed` / `held`.
- **T-25 is done**: `components/NsfwControl.tsrx` draws the Show/Blur pair signed in and one
  **Show NSFW content** control leading to `/authentification` signed out, on all three catalogs and
  `/post/thread` — never a page-local pair again. `lib/state/prefs.ts` holds the signed-out answer as
  one **pending intent** (`requestShowNsfw` / `showRequested`), applies it after the sign-in re-read,
  and drops it on sign-out.
- **A reveal's lifetime is now a fetch epoch** (T-25): `CardGrid` takes `revealEpoch`, and every
  `replace` fetch bumps the counter; an `append` does not. **Any new listing that can refetch must
  pass it.**
- **`/user/[username]`'s posts feed still keys on `post.id`** (T-25): a revealed post there survives
  a tab switch. One line to fix when that feed is next touched.
- **The preview's sign-in switch is the only way into the signed-out states** — a hard reload seeds
  `session.ts` signed in again.
- **`/terms` is done** (T-24): `TERMS_RULES` + `REPORT_REASON_RULE` in `schema.ts`, ids
  `#copied-content` / `#unmarked-nsfw` / `#illegal-content`.
- **A hash in the URL needs a mount jump** (T-24): `effect()` → `scrollIntoView` plus
  `scroll-margin-top: 72px` on every target.
- **`<a>` and `<button>` do not nest**; **`{<Component />}` inside a fragment is a parse error**;
  **`effect()` is the only lifecycle hook** (T-24).
- **A component's root element cannot be styled** (T-19) and **a page's scoped block cannot reach a
  primitive's elements** (T-09): wrap primitives in page-owned elements.
- **`/user/[username]` and `/user/[username]/edit` are done** (T-23); `profileWriteSchema` is
  onboarding's two-field write; the NSFW pair lives in `repo.savePreferences`, not the profile row.
- **A rename moves the account** (T-23): the memory adapter's `VIEWER` constant and vote/bookmark keys
  still name the old handle; viewer wiring is T-30's.
- **`/notifications` is done** (T-22): `markNotificationRead`, `markAllNotificationsRead`,
  `unreadNotificationCount`, `lib/state/inbox.ts`, badge in both nav hosts.
- **`repo.myVote` / `repo.myReport` / `isBookmarked` exist** — never a page-local flag.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread), profiles 7, follow
  edges 15.**
- **The memory adapter loses runtime rows on a hard reload** (T-18): navigation must stay in-app.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.
