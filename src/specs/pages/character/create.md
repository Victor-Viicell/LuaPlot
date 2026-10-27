# `/character/create`

**Route** `/character/create` · **Access** signed in, else redirect to `/authentification` · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [detail](detail.md)

## Purpose

Authoring view for a new character: defines its identity, description and personality fields, and any attached lorebook. Saves into the current user's account and goes to the character's detail page.

Save publishes: there is no draft state, so the character is public the moment it saves, and moderation is the only thing that can take it out of public view.

## Layout

- One form, one column: the identity fields, then description and personality, then the image and the SFW/NSFW toggle, then the lorebook attachment.
- **Save** and **Cancel** sit at the end of the form.

## Data

Fields:

- **Name** — display label only; duplicates are allowed, per the [conventions](../../luaplot-pages.md#conventions).
- **Description / personality**
- **Avatar** — the character's image.
- **NSFW** — boolean toggle, SFW by default.
- **Attached lorebook** — optional, picked from the author's own lorebooks and stored by ID; the same field is editable afterwards on [edit](edit.md), where the attachment can also be cleared.

## Actions

- **Save** → [detail](detail.md)
- **Cancel** → [catalog](catalog.md)

## States

- **Validation error**
- **Duplicate name warning** — inline under the name field while typing, once the name matches another character the author owns; it is advisory and never blocks **Save**
- **Submitting**
- **Save failed**
