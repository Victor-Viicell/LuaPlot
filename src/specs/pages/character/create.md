# `/character/create`

**Route** `/character/create` · **Access** signed in, else redirect to `/authentification` · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [detail](detail.md)

## Purpose

Authoring view for a new character: defines its identity, description and personality fields, and any attached lorebook. Saves into the current user's account and goes to the character's detail page.

## Layout

_To be specified._

## Data

Fields to be specified. Known so far:

- **Name** — display label only; duplicates are allowed, per the [conventions](../../luaplot-pages.md#conventions).
- **Description / personality**
- **Avatar** — the character's image.
- **NSFW** — boolean toggle, SFW by default.
- **Attached lorebook**

## Actions

- **Save** → [detail](detail.md)
- **Cancel** → [catalog](catalog.md)

## States

- **Validation error**
- **Duplicate name warning**
- **Submitting**
- **Save failed**

## Open questions

- Is the lorebook attached at creation, or only once the character exists?
- Can a character be saved as a draft, or is it public the moment it saves?
- Is the duplicate-name warning inline while typing, or raised on save?
