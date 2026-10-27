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
| `/bookmarks` | [pages/bookmarks.md](pages/bookmarks.md) | Saved characters, lorebooks, presets, and posts |

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
- Names are display-only and duplicates are allowed. Telling two same-named items apart is a UI concern (differentiation, not uniqueness enforcement); a warning while creating is reasonable, but do not block the save.
- Usernames are not part of content URLs, since they no longer disambiguate anything and would only add a segment that goes stale on rename.
- Fixed segments (`catalog`, `create`, `thread`) are matched before the ID parameter, and IDs must use a constrained format (e.g. UUID) so no real ID can collide with those words.
- Catalog and thread state belongs in the query string, not the path, so one set of routes serves every filtered view. The same convention should be reused for the persona collection and for profile tabs.
- Filters currently expose only `All` because the tag taxonomy is undecided. Keep the parameter in the URL so links stay shareable, but do not invent tag names in markup. Cards do carry a tags row; what populates it belongs to the same undecided taxonomy.
- Personas are personal, not confidential: they are not shared because sharing them serves no purpose. The consequence is scope, not secrecy — no public catalog, no owner-qualified URL, no follows — and nothing is lost if a persona is named in a published cut.
- Profiles and posts are public. Personas are absent from profiles because they are personal rather than shared content; a persona's name appears in a cut only when the author chooses to attribute their own messages that way.
- The social graph is follow-only: one-directional follows, no friend requests, no mutual-follow requirement, and no direct messages. Following does not gate visibility, since all shared content is already public.
- Notifications are deliberately sparse, following a YouTube-like model: same-kind events on the same target aggregate into one row, bursts fold into the row that already exists, and high volume degrades into a periodic summary. Per-event rows are the exception, not the default.
- Every shared item — character, lorebook, preset, and post — carries likes, dislikes, the ratio between them, a comment count, and a bookmark. Personas carry none of these, because they are personal rather than shared. Each viewer gets one vote per item, and switching between like and dislike replaces the earlier vote.
- Reporting is available on every shared item and on every comment, and nowhere on personas. It is the one action that leaves no public trace: it is not engagement and never changes likes or dislikes.
- NSFW is a boolean on the content row, not a tag. Every create and edit surface exposes an SFW/NSFW toggle that defaults to SFW, and the terms and [JEV](systems/jev.md) both read that value.
- The viewer's side is a separate per-account [NSFW preference](systems/nsfw.md): **Show NSFW content** and **Blur NSFW content**, editable at onboarding, in account settings, and from the catalogs and the post thread. It changes listings, never publication, and every listing surface honours it — catalogs, thread, profiles, bookmarks, and search. It hides or covers content but never blocks a route. Signed-out visitors get it off, with a control that leads to sign-in.
- A catalog card puts the title in its top header, and in a single footer row the author beside the ratio as a percentage, with the avatar, tagline, and tags between them. The card shows no comment count. A post or a comment puts the poster's profile and the time of posting in its header, and likes, dislikes, and the comment count in its footer. The NSFW blur relies on that structure: it covers the middle and leaves the unit identifiable, and the ratio is never hidden by it.
- Sessions are private and unmoderated even when the viewer hides NSFW: only the distribution of public content is subject to the terms.
- Every item a user authors carries an image: characters, lorebooks, presets, and personas have an avatar, while posts and comments can embed images and GIFs.
- Reports feed [JEV](systems/jev.md). For characters, lorebooks, and presets, enforcement changes visibility; only their creator can delete them. Posts and comments have no private state: they are removed as soon as JEV is certain, and a case it is unsure about leaves them public while it escalates to a moderator.
- Moderation watches visual assets — avatars, images, and GIFs — plus text. Post and comment text is judged for all three rules; character, lorebook, and preset text only for the NSFW flag and copying. Copy claims name their source; copied text from inside LuaPlot is compared automatically, while copied text from outside and every copied image go to a moderator.
- Privatized content stays visible to its owner, who sees the report, the reasons, and the measures taken. Once every reason is fixed the owner can request publication again; that request flags the content so JEV verifies it before it becomes public.
- Verification is cached. Content that passes a scan is flagged as verified and kept out of the report queue until its creator edits it; any edit clears the flag. Reports filed in that window are held rather than archived, and a fresh report after a change is what starts a scan.
- Reports are cumulative and scans are not repeated: every report on an item joins the case already open for it, so a pile-on costs one scan rather than one per report. Each new report raises the item's weight, and the moderation queue is ordered most-reported first.
- Comments are their own entity rather than a post type: every shared item has a comment section, and comments can themselves be commented on. A comment carries likes, dislikes, and a reply count, but deliberately no bookmark. Deleting or removing a comment never takes its replies: the comment becomes a placeholder ("This comment was deleted." or "This comment was removed by moderation.") and the branch beneath it stays. Deleting a post, character, lorebook, or preset deletes its whole thread in cascade from the database. The shared rules live in [components/comment-thread.md](components/comment-thread.md).
- Engagement is metadata on a listing and actions on a detail page: a card shows only the ratio, as a percentage, with the author beside it; the like counts, dislike counts, and comment count live on the detail page, where voting, commenting, and bookmarking also happen.
- Followers and following are tabs on `/user/[user.username]` rather than their own routes; promote them only if they need to be deep-linked.
- `/user/[user.username]` is used instead of a bare `/[user.username]` so every top-level segment stays a fixed word (`character`, `lorebook`, `preset`, `persona`, `post`, `session`, `user`, `notifications`, `bookmarks`, `terms`, `moderation`, `authentification`, `onboarding`) and no username has to be reserved.
- `/character/create`, `/lorebook/create`, `/preset/create`, and `/persona/create` assume a signed-in user and should redirect to `/authentification` otherwise.
- Page specs share one skeleton (Purpose, Layout, Data, Actions, States, Open questions); shared rules are stated here rather than repeated per page.
- Not-found is reported per type: each detail route names the content that is missing ("This character doesn't exist.", "This lorebook doesn't exist.", and so on) instead of falling back to one generic message. Unknown usernames and unowned personas use the same rule.
- Authentication is delegated to Supabase with Google, GitHub, and Discord. The app never collects or stores passwords, so there is no password field, reset flow, or credential handling in the client.
- The three providers are the whole list and each provider is its own account: signing in with a second provider creates a new account rather than linking identities, so there is no linking, merging, or unlinking anywhere. Provider-supplied name and email are optional; the handle is claimed at onboarding.

## Not yet specified

- Appeals: a creator cannot contest a decision; the only path is to patch the reasons and request publication again, which JEV re-verifies.
- Admin role: [`/moderation`](pages/moderation/queue.md) assumes one exists, but nothing defines how a user is granted it.
- Audit: whether JEV's immediate actions leave a record in [`/moderation`](pages/moderation/queue.md), or are invisible to moderators.


