# `/character/catalog`

**Route** `/character/catalog` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Browsable, searchable list of characters. Each item links to [`/character/[character.id]`](detail.md), and the page offers an entry point to [`/character/create`](create.md).

## Layout

- A toolbar of four rows: **search** across the full width, a **tag** field across the full width, a **sort** selector, then the [NSFW preference](../../systems/nsfw.md) toggles. The grid follows beneath it.
- Each card opens its character's detail page; its author in the footer links to that author's [profile](../user/profile.md).
- Below the grid, **Load more** appends the next page of 24 cards and is absent once the list ends.

## Data

Built from the shared card structure, per the [conventions](../../luaplot-pages.md#conventions): the title in the header, the avatar, tagline, and tags between, and the author beside the ratio as a percentage in the footer. No comment count and no like or dislike counts on the card — those live on [detail](detail.md).

Every card renders its **tags row** when the item carries tags; an item with none renders no row and no placeholder. The tag vocabulary is authored on the content, never invented by a listing (`luaplot-pages.md` → Conventions), so the filter's options are exactly the tags in use.

## Actions

- **Search** — matches a name, a tagline, or a description
- **Filter by tags** — a multi-select field: typing narrows the dropdown to the tags in use, picking one puts it inside the field as a chip, and every chip carries its own remove control. Picking two tags matches items carrying **either**; no tag selected means **All**
- **NSFW preference** — the Show and Blur toggles from [NSFW preference](../../systems/nsfw.md); they edit the account, not this view
- **Sort** — a selector: `Newest` (default) or `Top rated`
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

The search, the tags, and the sort live in the query string — `?q=…&tags=blue,haunted&sort=ratio` — so a narrowed view can be shared, bookmarked, and restored by back/forward. The [NSFW preference](../../systems/nsfw.md) is not part of this state: it belongs to the account, not to the view. Paging is not in the URL either — returning to the page shows the first page of results.
