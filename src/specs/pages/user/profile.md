# `/user/[user.username]`

**Route** `/user/[user.username]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md)

## Purpose

Public profile for one user. Shows who they are, their follower and following counts, and a tabbed body: their public creations (characters, lorebooks, presets — never personas) and their posts. Offers follow/unfollow, and shows the edit entry point when viewing your own profile.

## Layout

_To be specified._

## Data

Known so far:

- Both content tabs honour the viewer's [NSFW preference](../../systems/nsfw.md): NSFW items are hidden or covered for that viewer, not removed from the profile.

## Actions

- **Follow / unfollow**
- **Switch tab**: creations, posts, followers, following
- **Open a creation** → its detail page
- **Open a post** → [post detail](../post/detail.md)
- **Edit profile** (own profile only) → [edit](edit.md)

## States

- **Own profile**
- **Another user's profile**
- **No content**
- **Not found** — "This user doesn't exist."

## URL

Tabs and filters use the query string, per the [conventions](../../luaplot-pages.md#conventions). Parameter names still to be decided.

## Open questions

- Are the follower and following counts links into the corresponding tabs?
- How are the user's creations grouped when they have all three types?
- Is there a way to report a user or hide their content, or is that out of scope?
- Does the own-profile view need a link to the account's sessions as well, given sessions are private?
