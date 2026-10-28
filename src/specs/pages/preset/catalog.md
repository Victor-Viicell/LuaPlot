# `/preset/catalog`

**Route** `/preset/catalog` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Browsable, searchable list of presets. Each item links to [`/preset/[preset.id]`](detail.md), with an entry point to [`/preset/create`](create.md).

## Layout

- A toolbar holding search, the `All` filter, sort, and the [NSFW preference](../../systems/nsfw.md) toggles, above a grid of catalog cards.
- Each card opens its preset's detail page; its author in the footer links to that author's [profile](../user/profile.md).
- Below the grid, **Load more** appends the next page of 24 cards and is absent once the list ends.

## Data

Built from the shared card structure, per the [conventions](../../luaplot-pages.md#conventions): the title in the header, the avatar, tagline, and tags between, and the author beside the ratio as a percentage in the footer. No comment count and no like or dislike counts on the card.

The card previews no setting beyond that structure — no model, no parameter values, no list of what the preset changes. The card identifies the preset and nothing more; its settings are read on [detail](detail.md).

The **tags row** stays empty while the tag taxonomy is undecided: the row is not rendered, and no placeholder text stands in for it.

A preset is not tied to a provider, and its model is a setting rather than a facet: neither ever appears as a filter option.

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

Same URL-driven filter and sort state as the other catalogs, including the `All`-only filter. The [NSFW preference](../../systems/nsfw.md) is not part of that state: it belongs to the account. Paging is not in the URL either — returning to the catalog shows the first page of 24.
