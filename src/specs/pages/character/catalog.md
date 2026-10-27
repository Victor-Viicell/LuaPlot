# `/character/catalog`

**Route** `/character/catalog` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Browsable, searchable list of characters. Each item links to [`/character/[character.id]`](detail.md), and the page offers an entry point to [`/character/create`](create.md).

## Layout

- A toolbar holding search, the `All` filter, sort, and the [NSFW preference](../../systems/nsfw.md) toggles, above a grid of catalog cards.
- Each card opens its character's detail page; its author in the footer links to that author's [profile](../user/profile.md).
- Below the grid, **Load more** appends the next page of 24 cards and is absent once the list ends.

## Data

Built from the shared card structure, per the [conventions](../../luaplot-pages.md#conventions): the title in the header, the avatar, tagline, and tags between, and the author beside the ratio as a percentage in the footer. No comment count and no like or dislike counts on the card — those live on [detail](detail.md).

The **tags row** stays empty while the tag taxonomy is undecided: the row is not rendered, and no placeholder text stands in for it.

## Actions

- **Search**
- **Filter** — only `All` for now
- **NSFW preference** — the Show and Blur toggles from [NSFW preference](../../systems/nsfw.md); they edit the account, not this view
- **Sort**
- **Open item** → [detail](detail.md)
- **Open author** → [profile](../user/profile.md)
- **Load more** — appends the next page
- **Create** → [create](create.md)

## States

- **Loading**
- **Empty**
- **No results for the active query**
- **Loading more**
- **End of list** — no **Load more** control
- **Error**

## URL

Filter and sort state lives in the query string so a narrowed view can be shared, bookmarked, and restored by back/forward. The only filter option for now is `All`, since tag categories are undecided; the parameter is reserved but exposes nothing else. The [NSFW preference](../../systems/nsfw.md) is not part of this state: it belongs to the account, not to the view. Paging is not in the URL either — returning to the page shows the first page of results.
