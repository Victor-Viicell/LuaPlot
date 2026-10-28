# `/persona/create`

**Route** `/persona/create` · **Access** signed in · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [collection](collection.md) · [detail](detail.md)

## Purpose

Authoring view for a new persona: the character the user themselves roleplays as during a session. Saved to the user's account only; a persona is never published or shared. It holds the user's side of the conversation and nothing else: the character, that character's lorebooks, and the preset arrive with the session, so none of them is chosen here.

## Layout

- One form, one column: the name and tagline, then the description and personality, then the avatar.
- No lorebook picker and no preset picker: those are settled when the session starts, from the character chosen there, per [the session spec](../session/detail.md).
- **Save** and **Cancel** sit at the end of the form.

## Data

A persona is a smaller, distinct model rather than a character with sharing removed — its own schema, not a subset of the character's:

- **Name** — display label only; duplicates allowed. Personas are addressed by ID, so two may carry the same name.
- **Tagline** — the one-line summary the card carries in the [collection](collection.md).
- **Description / personality**
- **Avatar** — the persona's image.

Absent by design, because the user's side of a session needs only an identity:

- No in-session name — that belongs to characters, the only type a session addresses by a short form.
- No attached lorebooks and no preset — both come from the character the session is started with.
- No NSFW flag — a persona is never listed publicly, so nothing reads one.
- No likes, dislikes, ratio, comment count, or bookmark — personas are personal rather than shared.

## Actions

- **Save** → [detail](detail.md). Saving the user's first persona also makes it the default, in the same step; there is no separate promotion afterwards.
- **Cancel** → [collection](collection.md)

## States

- **Validation error**
- **Submitting**
- **Save failed**
- **First persona** — saving makes it the default, so the new persona arrives in [detail](detail.md) already carrying the mark
