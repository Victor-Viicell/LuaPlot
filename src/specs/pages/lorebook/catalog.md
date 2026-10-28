# `/lorebook/catalog`

**Route** `/lorebook/catalog` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Browsable, searchable list of lorebooks. Each item links to [`/lorebook/[lorebook.id]`](detail.md), with an entry point to [`/lorebook/create`](create.md).

## Layout

- The same structure as [`/character/catalog`](../character/catalog.md): a toolbar holding search, the `All` filter, sort, and the [NSFW preference](../../systems/nsfw.md) toggles, above a grid of catalog cards.
- Each card opens its lorebook's [detail](detail.md); its author in the footer links to that author's [profile](../user/profile.md).
- A lorebook card adds nothing to the shared card structure: no entry count and no keyword list.
- Below the grid, **Load more** appends the next 24 cards and is absent once the list ends.

## Data

Built from the shared card structure, per the [conventions](../../luaplot-pages.md#conventions): the title in the header, the avatar, tagline, and tags between, and the author beside the ratio as a percentage in the footer. No comment count and no like or dislike counts on the card — those live on [detail](detail.md).

Entries and keywords are not listed here: they belong to [detail](detail.md), so the catalog never aggregates entries or keywords, and a page of cards reads only the lorebook rows.

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

Same URL-driven filter and sort state as [`/character/catalog`](../character/catalog.md), including the `All`-only filter. The [NSFW preference](../../systems/nsfw.md) is not part of that state: it belongs to the account. Paging is not in the URL either — returning to the page shows the first page of results.
