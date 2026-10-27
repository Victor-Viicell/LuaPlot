# `/preset/catalog`

**Route** `/preset/catalog` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Browsable, searchable list of presets. Each item links to [`/preset/[preset.id]`](detail.md), with an entry point to [`/preset/create`](create.md).

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

Same URL-driven filter and sort state as the other catalogs, including the `All`-only filter. The [NSFW preference](../../systems/nsfw.md) is not part of that state: it belongs to the account.

## Open questions

- Does the preset card preview any settings beyond the shared card structure?
- Is a preset tied to a specific model or provider, and does that become a filter later?
- Pagination style, matching the other catalogs.
