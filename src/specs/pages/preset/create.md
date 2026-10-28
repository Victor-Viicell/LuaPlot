# `/preset/create`

**Route** `/preset/create` · **Access** signed in, else redirect to `/authentification` · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [detail](detail.md)

## Purpose

Authoring view for a new preset: generation and model settings grouped into reusable configurations.

Save publishes, like every other authored item: there is no draft state, so the preset is public the moment it saves.

## Layout

- One form, one column: the avatar and the SFW/NSFW toggle at the top, then the generation settings, then **Save** and **Cancel** at the end.
- The settings are a flat list of fields, not grouped into sections, and the list is whatever the generation layer exposes.

## Data

Fields. The full settings list follows the generation layer and is added here as that surface settles; a preset is exactly that set, nothing more. Known so far:

- **Avatar** — the preset's image.
- **NSFW** — boolean toggle, SFW by default.
- **Model** — the model the preset generates with, chosen by its author from the ones the app offers. The provider behind it belongs to the app: it is never a field and is not shown.

Every generation setting belongs to the preset, and the session carries none of its own. A session copies the preset when it starts and adjusts it only by rewriting that copy, per [the session spec](../session/detail.md) — there is no per-session settings surface.

## Actions

- **Save** → [detail](detail.md)
- **Cancel** → [catalog](catalog.md)
- **Duplicate** — not offered here: this page always starts blank, and a copy of another preset is made from its [detail](detail.md) page's **Fork / copy**, which puts it in the author's account and opens it in [edit](edit.md).

## States

- **Validation error**
- **Submitting**
- **Save failed**
