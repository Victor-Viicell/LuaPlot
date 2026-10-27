# `/persona/create`

**Route** `/persona/create` · **Access** signed in · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [collection](collection.md) · [detail](detail.md)

## Purpose

Authoring view for a new persona: the character the user themselves roleplays as during a session. Saved to the user's account only; a persona is never published or shared.

## Layout

_To be specified._

## Data

Fields to be specified. Likely mirrors a character, minus sharing. Known so far:

- **Name** — display label only; duplicates allowed.
- **Description / personality**
- **Avatar** — the persona's image.

## Actions

- **Save** → [detail](detail.md)
- **Cancel** → [collection](collection.md)

## States

- **Validation error**
- **Submitting**
- **Save failed**

## Open questions

- Is a persona structurally a character without sharing, or a distinct, smaller model? This decides whether the two editors can share components.
- Is the first persona created here automatically made the default?
- Can a persona attach a lorebook or preset, or are those session-level choices only?
- Does a persona need an NSFW flag, given it never leaves the account?
