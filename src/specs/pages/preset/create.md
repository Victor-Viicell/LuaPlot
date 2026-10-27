# `/preset/create`

**Route** `/preset/create` · **Access** signed in, else redirect to `/authentification` · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [detail](detail.md)

## Purpose

Authoring view for a new preset: generation and model settings grouped into reusable configurations.

## Layout

_To be specified._

## Data

Fields to be specified. The full settings list is undecided; a preset groups whatever the generation layer exposes, so this section should be written once that surface is settled. Known so far:

- **Avatar** — the preset's image.
- **NSFW** — boolean toggle, SFW by default.

## Actions

- **Save** → [detail](detail.md)
- **Cancel** → [catalog](catalog.md)

## States

- **Validation error**
- **Submitting**
- **Save failed**

## Open questions

- Which settings belong in a preset versus in the session itself?
- Are model and provider chosen by the user, or fixed by the app?
- Can a preset be duplicated from another as a starting point?
