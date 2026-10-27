# `/lorebook/[lorebook.id]/edit`

**Route** `/lorebook/[lorebook.id]/edit` · **Access** owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Owner-only editor for an existing lorebook and its entries, preloaded with current values, with save and delete.

## Layout

_To be specified._

## Data

Same fields and entry list as [create](create.md), preloaded.

## Actions

- **Save** → [detail](detail.md)
- **Add / remove / reorder entries**
- **Delete** with confirmation
- **Cancel** → [detail](detail.md)

## States

- **Owner**
- **Not the owner** → forbidden
- **Not found** — "This lorebook doesn't exist."
- **Delete confirmation**
- **Submitting**

## Open questions

- Which characters reference this lorebook, and are they shown before deletion?
- Does editing an entry affect sessions already in progress, or only future turns?
