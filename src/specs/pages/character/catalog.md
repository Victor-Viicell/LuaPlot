# `/character/catalog`

**Route** `/character/catalog` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Browsable, searchable list of characters. Each item links to [`/character/[character.id]`](detail.md), and the page offers an entry point to [`/character/create`](create.md).

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

Filter and sort state lives in the query string so a narrowed view can be shared, bookmarked, and restored by back/forward. The only filter option for now is `All`, since tag categories are undecided; the parameter is reserved but exposes nothing else.

## Open questions

- Which fields appear on a catalog card?
- Page size and pagination style: page numbers, infinite scroll, or load more?
- Does the catalog show each item's author, and link to their profile?
