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
- **NSFW preference** — the Show and Blur toggles from [NSFW preference](../../systems/nsfw.md); they edit the account, not this view
- **Sort**
- **Open item** → [detail](detail.md)
- **Create** → [create](create.md)

## States

- **Loading**
- **Empty**
- **No results for the active query**
- **Error**

## URL

Filter and sort state lives in the query string so a narrowed view can be shared, bookmarked, and restored by back/forward. The only filter option for now is `All`, since tag categories are undecided; the parameter is reserved but exposes nothing else. The [NSFW preference](../../systems/nsfw.md) is not part of this state: it belongs to the account, not to the view.

## Open questions

- The card shows tags, but the tag taxonomy is undecided — what fills that row until it exists?
- Page size and pagination style: page numbers, infinite scroll, or load more?
- Does the author in the card footer link to their profile?
