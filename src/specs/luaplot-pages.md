# Luaplot Pages

Every route has its own spec under [`pages/`](pages). This file is the route index plus the rules that apply to all pages; the fine details (layout, fields, states) live in each page's file.

## Routes

### Entry

| Route | Spec | Summary |
| --- | --- | --- |
| `/` | [pages/home.md](pages/home.md) | Landing page and entry point |
| `/authentification` | [pages/authentification.md](pages/authentification.md) | Sign in or register |
| `/onboarding` | [pages/onboarding.md](pages/onboarding.md) | First-run setup |

### Personal

| Route | Spec | Summary |
| --- | --- | --- |
| `/notifications` | [pages/notifications.md](pages/notifications.md) | Follow and interaction inbox |
| `/bookmarks` | [pages/bookmarks.md](pages/bookmarks.md) | Saved items, one catalog per type |

### People

| Route | Spec | Summary |
| --- | --- | --- |
| `/user/[user.username]` | [pages/user/profile.md](pages/user/profile.md) | Public profile: creations, posts, follows |
| `/user/[user.username]/edit` | [pages/user/edit.md](pages/user/edit.md) | Edit your own account |

### Characters

| Route | Spec | Summary |
| --- | --- | --- |
| `/character/catalog` | [pages/character/catalog.md](pages/character/catalog.md) | Browse and search characters |
| `/character/create` | [pages/character/create.md](pages/character/create.md) | Author a character |
| `/character/[character.id]` | [pages/character/detail.md](pages/character/detail.md) | Read a character |
| `/character/[character.id]/edit` | [pages/character/edit.md](pages/character/edit.md) | Edit a character |

### Lorebooks

| Route | Spec | Summary |
| --- | --- | --- |
| `/lorebook/catalog` | [pages/lorebook/catalog.md](pages/lorebook/catalog.md) | Browse and search lorebooks |
| `/lorebook/create` | [pages/lorebook/create.md](pages/lorebook/create.md) | Author a lorebook |
| `/lorebook/[lorebook.id]` | [pages/lorebook/detail.md](pages/lorebook/detail.md) | Read a lorebook |
| `/lorebook/[lorebook.id]/edit` | [pages/lorebook/edit.md](pages/lorebook/edit.md) | Edit a lorebook |

### Presets

| Route | Spec | Summary |
| --- | --- | --- |
| `/preset/catalog` | [pages/preset/catalog.md](pages/preset/catalog.md) | Browse and search presets |
| `/preset/create` | [pages/preset/create.md](pages/preset/create.md) | Author a preset |
| `/preset/[preset.id]` | [pages/preset/detail.md](pages/preset/detail.md) | Read a preset |
| `/preset/[preset.id]/edit` | [pages/preset/edit.md](pages/preset/edit.md) | Edit a preset |

### Personas

| Route | Spec | Summary |
| --- | --- | --- |
| `/persona` | [pages/persona/collection.md](pages/persona/collection.md) | Your own personas |
| `/persona/create` | [pages/persona/create.md](pages/persona/create.md) | Author a persona |
| `/persona/[persona.id]` | [pages/persona/detail.md](pages/persona/detail.md) | Read one of your personas |
| `/persona/[persona.id]/edit` | [pages/persona/edit.md](pages/persona/edit.md) | Edit one of your personas |

### Posts

| Route | Spec | Summary |
| --- | --- | --- |
| `/post/thread` | [pages/post/thread.md](pages/post/thread.md) | Public timeline |
| `/post/create` | [pages/post/create.md](pages/post/create.md) | Compose a post |
| `/post/[post.id]` | [pages/post/detail.md](pages/post/detail.md) | Read a post and its comments |

### Sessions

| Route | Spec | Summary |
| --- | --- | --- |
| `/session/[session.id]` | [pages/session/detail.md](pages/session/detail.md) | Continue or review a chat session |

### Moderation

| Route | Spec | Summary |
| --- | --- | --- |
| `/moderation` | [pages/moderation/queue.md](pages/moderation/queue.md) | Admin queue of what JEV could not decide |
| `/moderation/[report.id]` | [pages/moderation/detail.md](pages/moderation/detail.md) | Review and conclude one case |

### Legal

| Route | Spec | Summary |
| --- | --- | --- |
| `/terms` | [pages/terms.md](pages/terms.md) | Terms of use: what content is not allowed |

## Shared components

| Component | Spec | Used by |
| --- | --- | --- |
| Comment thread | [components/comment-thread.md](components/comment-thread.md) | Every character, lorebook, preset, and post detail page |
| Report | [components/report.md](components/report.md) | Every shared item and every comment |

## Shared systems

| System | Spec | Role |
| --- | --- | --- |
| JEV | [systems/jev.md](systems/jev.md) | Classifies reported content and decides what happens to it |
| NSFW preference | [systems/nsfw.md](systems/nsfw.md) | Per-account Show and Blur controls for NSFW listings |

## Conventions

- Content is identified by a stable ID, not by its name: `/character/[character.id]`, `/lorebook/[lorebook.id]`, `/preset/[preset.id]`, `/persona/[persona.id]`. One user may own two characters with the same name, so the name cannot carry identity.
- The type segment comes first, so the same name may be reused across types and nothing collides between a character, lorebook, preset, and persona.
- Names are display-only and duplicates are allowed: every type may be created under a name already in use, by the same author or another, with no uniqueness check and no warning. Telling two same-named items apart is a UI concern (differentiation), never an enforcement one.
- Only characters carry an **in-session name** — the short form used inside a session, "Sonic" for "Sonic the Hedgehog" — because a session addresses the character by it. It is optional and falls back to the character's name; no other type has one, and it never replaces the public name anywhere but the transcript.
- Usernames are not part of content URLs, since they no longer disambiguate anything and would only add a segment that goes stale on rename.
- Fixed segments (`catalog`, `create`, `thread`) are matched before the ID parameter, and IDs must use a constrained format (e.g. UUID) so no real ID can collide with those words.
- Catalog and thread state belongs in the query string, not the path, so one set of routes serves every filtered view. The same convention should be reused for the persona collection, for profile tabs, and for the bookmark tabs.
- Catalogs and feeds page with an explicit **Load more** control that appends the next 24 items. No page numbers and no scroll-triggered fetching, and paging is not part of the URL: returning to a listing shows its first page.
- Tags are authored on the content, never invented by a listing: characters, lorebooks and presets may carry tags, a card renders them when present and shows no row when there are none, and a catalog's tag filter offers exactly the tags in use (`repo.listTags`) as a multi-select. Picking two tags matches items carrying **either**, and no tag selected means **All**; the choice lives in the URL (`?tags=a,b`) so links stay shareable.
- Personas are personal, not confidential: they are not shared because sharing them serves no purpose. The consequence is scope, not secrecy — no public catalog, no owner-qualified URL, no follows — and nothing is lost if a persona is named in a published cut.
- Profiles and posts are public. Personas are absent from profiles because they are personal rather than shared content; a persona's name appears in a cut only when the author chooses to attribute their own messages that way.
- Deleting a persona is allowed, the default included: the mark moves to the most recently created remaining persona in the same step, so the collection is never left holding personas with no default. Sessions that pinned the deleted persona keep their transcript and read `User` on the user's side until **Switch persona** attaches another, since a session references the persona live rather than copying it; a published cut is untouched.
- The social graph is follow-only: one-directional follows, no friend requests, no mutual-follow requirement, and no direct messages. Following does not gate visibility, since all shared content is already public.
- Notifications are deliberately sparse, following a YouTube-like model: same-kind events on the same target aggregate into one row, bursts fold into the row that already exists, and high volume degrades into a periodic summary. Per-event rows are the exception, not the default.
- Every shared item — character, lorebook, preset, and post — carries likes, dislikes, the ratio between them, a comment count, and a bookmark. Personas carry none of these, because they are personal rather than shared. Each viewer gets one vote per item, and switching between like and dislike replaces the earlier vote.
- Own content takes engagement like anyone else's: the author may vote on their own post, character, lorebook, or preset, and that vote counts in the ratio exactly as another viewer's would. No type exempts its author, and the one-vote-per-viewer rule is the only limit.
- Reporting is available on every shared item and on every comment, and nowhere on personas. It is the one action that leaves no public trace: it is not engagement and never changes likes or dislikes.
- NSFW is a boolean on the content row, not a tag. Every create and edit surface for shared content exposes an SFW/NSFW toggle that defaults to SFW, and the terms and [JEV](systems/jev.md) both read that value. Personas carry none: a persona is never published, so nothing would read the flag.
- The viewer's side is a separate per-account [NSFW preference](systems/nsfw.md): **Show NSFW content** and **Blur NSFW content**, editable at onboarding, in account settings, and from the catalogs and the post thread. It changes listings, never publication, and every listing surface honours it — catalogs, thread, profiles, bookmarks, and search. It hides or covers content but never blocks a route. Signed-out visitors get it off, with a control that leads to sign-in.
- A catalog card puts the title in its top header, and in a single footer row the author beside the ratio as a percentage, with the avatar, tagline, and tags between them. The card shows no comment count. A post or a comment puts the poster's profile and the time of posting in its header, and likes, dislikes, and the comment count in its footer. The NSFW blur relies on that structure: it covers the middle and leaves the unit identifiable, and the ratio is never hidden by it.
- Sessions are private and unmoderated even when the viewer hides NSFW: only the distribution of public content is subject to the terms.
- A session starts from copies, never from the live items: the character, every lorebook attached to it, and the preset are snapshotted when the session begins, and every session takes its own copies. Each copy keeps the ID of its original, so the session owner can rewrite the copy without touching the original, pull the author's current version while the link holds, or revert to the version that was copied. A deleted or unreachable original costs only the link — the session keeps running, and a copy edited inside one is answerable to the terms only once it leaves as a published cut.
- A published cut is a snapshot: it records the message text and the attribution chosen when it was published, so no later edit — renaming or deleting the persona, refreshing or rewriting a copy inside the session, changing a message in the session — alters a post that already went out.
- Every item a user authors carries an image: characters, lorebooks, presets, and personas have an avatar, while posts and comments can embed images and GIFs.
- One character starts one session per user: the detail page's primary control reads **Start a session** until a session with that character exists and **Continue** afterwards, reopening the most recent one. A second session is started only on purpose, from a settings menu — the character's own, or the session's — whose first option is **New Session**, so chatting again never silently spawns another copy of the character.
- Reports feed [JEV](systems/jev.md). For characters, lorebooks, and presets, enforcement changes visibility; only their creator can delete them. Posts and comments have no private state: they are removed as soon as JEV is certain, and a case it is unsure about leaves them public while it escalates to a moderator.
- Removal leaves no listing entry, and a pending case leaves no mark: a post removed by JEV or deleted by its author drops out of the thread and out of its author's profile in the same step, while a bookmark to it survives as a dead card, per [`/bookmarks`](pages/bookmarks.md). Nothing on a listing signals that a case is open.
- JEV's immediate actions leave no case behind. A removal or an item made private happens without a moderator and never enters [`/moderation`](pages/moderation/queue.md), whose cases exist only for what JEV could not decide; the creator's notification and the reasons on the content page are the record, and the audit trail of a moderator's own decision is the case history.
- Moderation watches visual assets — avatars, images, and GIFs — plus text. Post and comment text is judged for all three rules; character, lorebook, and preset text only for the NSFW flag and copying. Copy claims name their source; copied text from inside LuaPlot is compared automatically, while copied text from outside and every copied image go to a moderator.
- Privatized content stays visible to its owner, who sees the report, the reasons, and the measures taken. Once every reason is fixed the owner can request publication again; that request flags the content so JEV verifies it before it becomes public.
- Verification is cached. Content that passes a scan is flagged as verified and kept out of the report queue until its creator edits it; any edit clears the flag. Reports filed in that window are held rather than archived, and a fresh report after a change is what starts a scan.
- Reports are cumulative and scans are not repeated: every report on an item joins the case already open for it, so a pile-on costs one scan rather than one per report. Each new report raises the item's weight, and the moderation queue is ordered most-reported first.
- A character references any number of lorebooks, from none upward, and they need not be its author's: any public lorebook can be attached. An attachment is added by its ID or picked from the author's own lorebooks and the lorebooks they bookmarked from other authors, and it is a reference rather than a copy, so one lorebook can serve many characters and editing it changes what all of them read.
- Comments are their own entity rather than a post type: every shared item has a comment section, and comments can themselves be commented on. A comment carries likes, dislikes, and a reply count, but deliberately no bookmark. Deleting or removing a comment never takes its replies: the comment becomes a placeholder ("This comment was deleted." or "This comment was removed by moderation.") and the branch beneath it stays. Deleting a post, character, lorebook, or preset deletes its whole thread in cascade from the database. The shared rules live in [components/comment-thread.md](components/comment-thread.md).
- A post is a body plus at most one optional attachment, and no kind field: a body alone is a plain text post, a body with a character is a character share, and a body with a cut renders the cut. The attachment is always the author's own — their character, or a cut from one of their own sessions — never another author's item, a lorebook, or a preset; a lorebook and a preset reach a post only through a character that carries them. Posts carry images and GIFs inside the body, not in a second list. A post is written once: no edit route exists, so correcting one means deleting and publishing again.
- Engagement is metadata on a listing and actions on a detail page: a card shows only the ratio, as a percentage, with the author beside it; the like counts, dislike counts, and comment count live on the detail page, where voting, commenting, and bookmarking also happen.
- Followers and following are tabs on `/user/[user.username]` rather than their own routes; promote them only if they need to be deep-linked.
- `/user/[user.username]` is used instead of a bare `/[user.username]` so every top-level segment stays a fixed word (`character`, `lorebook`, `preset`, `persona`, `post`, `session`, `user`, `notifications`, `bookmarks`, `terms`, `moderation`, `authentification`, `onboarding`) and no username has to be reserved.
- `/character/create`, `/lorebook/create`, `/preset/create`, and `/persona/create` assume a signed-in user and should redirect to `/authentification` otherwise.
- Page specs share one skeleton (Purpose, Layout, Data, Actions, States, Open questions); shared rules are stated here rather than repeated per page.
- Not-found is reported per type: each detail route names the content that is missing ("This character doesn't exist.", "This lorebook doesn't exist.", and so on) instead of falling back to one generic message. Unknown usernames and unowned personas use the same rule.
- Authentication is delegated to Supabase with Google, GitHub, and Discord. The app never collects or stores passwords, so there is no password field, reset flow, or credential handling in the client.
- The three providers are the whole list and each provider is its own account: signing in with a second provider creates a new account rather than linking identities, so there is no linking, merging, or unlinking anywhere. Provider-supplied name and email are optional; the handle is claimed at onboarding.
- There is no appeal. A creator cannot contest JEV's action or a moderator's conclusion, and a concluded case never reopens: the only route back is fixing the reasons the decision names and requesting publication again, which JEV re-verifies, while a fresh report on the item opens a new case. The reporter is told neither outcome.
- Admin is not granted inside the app: the operator marks an account as admin, and the app only checks that mark at [`/moderation`](pages/moderation/queue.md). No page, invite, request, or self-service control hands the role out, and there is one admin role with no hierarchy — every admin sees every case and its whole history.
