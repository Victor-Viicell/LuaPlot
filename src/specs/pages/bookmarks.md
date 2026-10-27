# `/bookmarks`

**Route** `/bookmarks` · **Access** signed in · **Index** [luaplot-pages.md](../luaplot-pages.md) · **Related** [notifications](notifications.md)

## Purpose

The signed-in user's saved items. Any shared content can be bookmarked — characters, lorebooks, presets, and posts — so this is the one page that mixes types, ordered by when it was saved. It is personal: nobody else sees what a user bookmarks, and bookmarks never appear on a profile. It is also silent: saving, removing, or activity on a saved item notifies nobody on that account of its own, because [notifications](notifications.md) lists every event worth one and bookmarks are not among them.

## Layout

- One list in save order, newest first: types are labelled per row rather than grouped into sections, so the ordering never restarts mid-page.
- Each row carries its remove control, so unbookmarking never requires opening the item.

## Data

- The bookmarked items across all four shared types, each with enough to recognize it and link back.
- When it was saved, and what type it is.
- A bookmark outlives the item: when the item is deleted by its author or removed by moderation, the row stays, keeps its type, and its title slot reads the type's not-exist sentence ("This character doesn't exist."). It links nowhere and **Remove bookmark** clears it.
- Own content is bookmarkable: a user's own character, lorebook, preset, or post sits in the list like any other.
- NSFW items follow the viewer's [NSFW preference](../systems/nsfw.md): with Show off they are absent from the list, and with Blur on their cards stay but are covered.

## Actions

- **Open item** → its detail page
- **Remove bookmark** — from the row itself, without opening the item
- **Filter by type** — only `All` for now
- **Sort** — newest saved first by default

## States

- **Empty**
- **Populated**
- **Item no longer available**
- **Loading**

## URL

Type filter and sort live in the query string, per the [conventions](../luaplot-pages.md#conventions).
