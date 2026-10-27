# `/bookmarks`

**Route** `/bookmarks` · **Access** signed in · **Index** [luaplot-pages.md](../luaplot-pages.md) · **Related** [notifications](notifications.md)

## Purpose

The signed-in user's saved items. Any shared content can be bookmarked — characters, lorebooks, presets, and posts — so this is the one page that mixes types, ordered by when it was saved. It is personal: nobody else sees what a user bookmarks, and bookmarks never appear on a profile.

## Layout

_To be specified._

## Data

- The bookmarked items across all four shared types, each with enough to recognize it and link back.
- When it was saved, and what type it is.

## Actions

- **Open item** → its detail page
- **Remove bookmark**
- **Filter by type** — only `All` for now
- **Sort** — newest saved first by default

## States

- **Empty**
- **Populated**
- **Item no longer available**
- **Loading**

## URL

Type filter and sort live in the query string, per the [conventions](../luaplot-pages.md#conventions).

## Open questions

- Does the list group by type, or stay one chronological list with type labels?
- What happens when a bookmarked item is deleted by its author, or otherwise stops resolving?
- Can a user bookmark their own content, and does it show up here if so?
- Is there an unbookmark affordance directly in the list, or only on the item's own page?
- Do bookmarks feed notifications (for example, activity on something you saved), or stay purely a private list?
