# `/user/[user.username]`

**Route** `/user/[user.username]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md)

## Purpose

Public profile for one user. Shows who they are, their follower and following counts, and a tabbed body: their public creations (characters, lorebooks, presets — never personas) and their posts. Offers follow/unfollow, and shows the edit entry point when viewing your own profile.

There is no reporting and no hiding at the user level: a report names a shared item or a comment, and the graph is follow-only, so a person is acted on through the item that broke the [terms](../terms.md), never through their profile. The page links to no sessions either — a session is private, there is no session list anywhere, and one is reached from its character's **Continue** or by its own URL.

## Layout

- A header with the avatar, display name, `@username`, bio, the follow control, and the follower and following counts as plain figures. The counts are not links of their own: the followers and following tabs are the only way into those lists, so the header does not duplicate that target.
- Four tabs under the header — Creations, Posts, Followers, Following — and the selected tab renders beneath them, with the page's own gap between the tab strip and whatever the tab draws.
- **Followers and Following are drawn with the catalog card**: the same card a character wears, with the display name as the title, the handle beneath it, **the bio in the tagline's slot**, and a footer carrying **followers and following** instead of an author and a ratio. The thumbnail is the same third-of-the-card square.
- The creations tab is one grid holding all three types, in the card the catalogs use, refined by a type control row: All (default), Characters, Lorebooks, Presets. Type is a filter here rather than a tab, because the profile's tabs are already creations, posts, followers, and following, and the three creation types share one card and one paging.
- The posts tab uses the [thread](../post/thread.md) card, newest first, with the same engagement footer. The followers and following tabs list profile cards, each linking to that user.
- Both grids page with **Load more**, per the [conventions](../../luaplot-pages.md#conventions); paging stays out of the URL.
- No persona is ever *listed* on a profile — they are personal. The owner does get the **Personas** control beside **Edit profile**, which opens the persona dialog: listing and editing happen in place, never as a page.

## Data

Known so far:

- Both content tabs honour the viewer's [NSFW preference](../../systems/nsfw.md): NSFW items are hidden or covered for that viewer, not removed from the profile.
- Creations are the user's public characters, lorebooks, and presets; posts are their public posts. Content under moderation or made private is absent from both, exactly as it is absent from its catalog.
- Per card, the fields its card already shows elsewhere, plus enough to link back to the item.

## Actions

- **Follow / unfollow**
- **Switch tab**: creations, posts, followers, following
- **Filter creations by type** — All, Characters, Lorebooks, Presets; the posts tab has no type control
- **Open a creation** → its detail page
- **Open a post** → [post detail](../post/detail.md)
- **Open a follower or following** → their profile
- **Personas** (own profile only) — opens the persona dialog (list, create, edit, delete; full screen on a phone)
- **Edit profile** (own profile only) → [edit](edit.md)

## States

- **Own profile**
- **Another user's profile**
- **No content** — nothing public in the selected tab, and an empty type filter reads the same way rather than as an error
- **Not found** — "This user doesn't exist."

## URL

Tabs and filters use the query string, per the [conventions](../../luaplot-pages.md#conventions): `?tab=creations&type=` — the tab is one of `creations`, `posts`, `followers`, `following`, the type is one of `all`, `character`, `lorebook`, `preset`, and `type` is only read on the creations tab. The [NSFW preference](../../systems/nsfw.md) is not part of that state: it belongs to the account, not to the view.
