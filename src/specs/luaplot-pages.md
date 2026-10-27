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

## Conventions

- Content is identified by a stable ID, not by its name: `/character/[character.id]`, `/lorebook/[lorebook.id]`, `/preset/[preset.id]`, `/persona/[persona.id]`. One user may own two characters with the same name, so the name cannot carry identity.
- The type segment comes first, so the same name may be reused across types and nothing collides between a character, lorebook, preset, and persona.
- Names are display-only and duplicates are allowed. Telling two same-named items apart is a UI concern (differentiation, not uniqueness enforcement); a warning while creating is reasonable, but do not block the save.
- Usernames are not part of content URLs, since they no longer disambiguate anything and would only add a segment that goes stale on rename.
- Fixed segments (`catalog`, `create`, `thread`) are matched before the ID parameter, and IDs must use a constrained format (e.g. UUID) so no real ID can collide with those words.
- Catalog and thread state belongs in the query string, not the path, so one set of routes serves every filtered view. The same convention should be reused for the persona collection and for profile tabs.
- Filters currently expose only `All` because the tag taxonomy is undecided. Keep the parameter in the URL so links stay shareable, but do not invent tag names in markup.
- Personas are personal, not confidential: they are not shared because sharing them serves no purpose. The consequence is scope, not secrecy — no public catalog, no owner-qualified URL, no follows — and nothing is lost if a persona is named in a published cut.
- Profiles and posts are public. Personas are absent from profiles because they are personal rather than shared content; a persona's name appears in a cut only when the author chooses to attribute their own messages that way.
- The social graph is follow-only: one-directional follows, no friend requests, no mutual-follow requirement, and no direct messages. Following does not gate visibility, since all shared content is already public.
- Notifications are deliberately sparse, following a YouTube-like model: same-kind events on the same target aggregate into one row, bursts fold into the row that already exists, and high volume degrades into a periodic summary. Per-event rows are the exception, not the default.
- Every shared item — character, lorebook, preset, and post — carries likes, dislikes, the ratio between them, a comment count, and a bookmark. Personas carry none of these, because they are personal rather than shared. Each viewer gets one vote per item, and switching between like and dislike replaces the earlier vote.
- Reporting is available on every shared item and on every comment, and nowhere on personas. It is the one action that leaves no public trace: it is not engagement and never changes likes or dislikes.
- NSFW is a boolean on the content row, not a tag. Every create and edit surface exposes an SFW/NSFW toggle that defaults to SFW, and the terms and [JEV](systems/jev.md) both read that value.
- Every item a user authors carries an image: characters, lorebooks, presets, and personas have an avatar, while posts and comments can embed images and GIFs.
- Reports feed [JEV](systems/jev.md), an asynchronous classifier. It can remove comments and posts, or make characters, lorebooks, and presets private, but it never deletes authored content.
- Comments are their own entity rather than a post type: every shared item has a comment section, and comments can themselves be commented on. A comment carries likes, dislikes, and a reply count, but deliberately no bookmark. The shared rules live in [components/comment-thread.md](components/comment-thread.md).
- Engagement is metadata on a listing and actions on a detail page: cards may show the ratio and comment count, while voting, commenting, and bookmarking happen on [`/character/[character.id]`](pages/character/detail.md) and its siblings.
- Followers and following are tabs on `/user/[user.username]` rather than their own routes; promote them only if they need to be deep-linked.
- `/user/[user.username]` is used instead of a bare `/[user.username]` so every top-level segment stays a fixed word (`character`, `lorebook`, `preset`, `persona`, `post`, `session`, `user`, `notifications`, `bookmarks`, `terms`, `authentification`, `onboarding`) and no username has to be reserved.
- `/character/create`, `/lorebook/create`, `/preset/create`, and `/persona/create` assume a signed-in user and should redirect to `/authentification` otherwise.
- Page specs share one skeleton (Purpose, Layout, Data, Actions, States, Open questions); shared rules are stated here rather than repeated per page.
- Not-found is reported per type: each detail route names the content that is missing ("This character doesn't exist.", "This lorebook doesn't exist.", and so on) instead of falling back to one generic message. Unknown usernames and unowned personas use the same rule.
- Authentication is delegated to Supabase with Google, GitHub, and Discord. The app never collects or stores passwords, so there is no password field, reset flow, or credential handling in the client.

## Not yet specified

- Human review: JEV can escalate — immediately for realistic sexual depictions of minors — but no route, role, or queue exists for a reviewer to receive it.
- NSFW enforcement in listings: the flag exists, but nothing blurs, hides, or filters by it yet.
- Appeals: a creator cannot contest a JEV decision, and no route restores content.


