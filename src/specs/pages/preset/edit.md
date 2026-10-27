# `/preset/[preset.id]/edit`

**Route** `/preset/[preset.id]/edit` · **Access** owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Owner-only editor for an existing preset, preloaded with current values, with save and delete.

## Layout

_To be specified._

## Data

Same fields as [create](create.md), preloaded.

## Actions

- **Save** → [detail](detail.md)
- **Delete** with confirmation
- **Cancel** → [detail](detail.md)

## States

- **Owner**
- **Not the owner** → forbidden
- **Not found** — "This preset doesn't exist."
- **Delete confirmation**
- **Submitting**

## Open questions

- Do sessions already running on this preset keep the old values, or pick up edits on the next turn?
- Is there version history, or is a preset simply overwritten?
