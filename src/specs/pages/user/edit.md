# `/user/[user.username]/edit`

**Route** `/user/[user.username]/edit` · **Access** signed in, own account only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [profile](profile.md)

## Purpose

Edit the signed-in user's own account. Reachable from the extra option that only appears on the viewer's own [profile](profile.md); anyone else has no entry point and is rejected by the route itself.

The page edits only what LuaPlot owns. Sign-in identity stays with Supabase, so no email address and no provider is shown, chosen, or switched here, and nothing links, merges, or unlinks an identity. Account deletion is not part of it either: there is no delete control on this page and no route that removes an account.

## Layout

_To be specified._

## Data

Fields to be specified. Known so far:

- **Display name** — required, free text, duplicates allowed.
- **Avatar**
- **Bio**
- **NSFW preference** — **Show NSFW content** and **Blur NSFW content** ([details](../../systems/nsfw.md))
- **Username** — the handle `/user/[user.username]` is built from, under the rules [onboarding](../onboarding.md) already enforces: unique across accounts case-insensitively, 3–24 characters of lowercase letters, digits, and underscores. Changing it moves the profile URL and no alias is kept, so a link to the previous handle reports not-found rather than redirecting; the account keeps its content, follows, and bookmarks, since none of them are addressed by username.

## Actions

- **Save** → [profile](profile.md)
- **Cancel** → [profile](profile.md)

## States

- **Owner**
- **Not the owner** → forbidden
- **Username taken**
- **Validation error**
- **Saving**
- **Save failed**
- **Handle changed** — the profile loads at the new URL; the previous one is not-found, and no redirect is offered
