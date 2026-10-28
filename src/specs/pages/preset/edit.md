# `/preset/[preset.id]/edit`

**Route** `/preset/[preset.id]/edit` · **Access** owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Owner-only editor for an existing preset, preloaded with current values, with save and delete.

## Layout

_To be specified._

## Data

Same fields as [create](create.md), preloaded.

- **Save overwrites the preset in place** — no version history, no revision kept, no draft: what was saved is what the detail page shows from then on, and an earlier state is not recoverable.
- **A running session keeps its own copy** — the preset was snapshotted when that session started, so an edit here never reaches it on its own; the session takes the new values only through **Update from original** in [the session](../session/detail.md).
- Any edit clears the preset's verified flag, so it is scanned again on the next report, per the [conventions](../../luaplot-pages.md#conventions).

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

