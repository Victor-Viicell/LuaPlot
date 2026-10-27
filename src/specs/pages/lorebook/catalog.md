# `/lorebook/catalog`

**Route** `/lorebook/catalog` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Browsable, searchable list of lorebooks. Each item links to [`/lorebook/[lorebook.id]`](detail.md), with an entry point to [`/lorebook/create`](create.md).

## Layout

_To be specified._

## Data

_To be specified._

## Actions

- **Search**
- **Filter** — only `All` for now
- **Sort**
- **Open item** → [detail](detail.md)
- **Create** → [create](create.md)

## States

- **Loading**
- **Empty**
- **No results for the active query**
- **Error**

## URL

Same URL-driven filter and sort state as [`/character/catalog`](../character/catalog.md), including the `All`-only filter.

## Open questions

- Which fields appear on a lorebook card — entry count, keywords, author?
- Are entry and keyword counts cheap enough to show without loading the whole book?
- Pagination style, matching the character catalog.
