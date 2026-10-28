# `/onboarding`

**Route** `/onboarding` · **Access** signed in, not yet onboarded · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

First-run setup after registration. Collects the essentials (username, display name, preferences) needed before the user can browse or create anything. Creating a persona is not required here.

## Layout

_To be specified._

## Data

- **Username** — claimed here, since an OAuth provider supplies no handle. Required, and the only handle the account has: `/user/[user.username]` is built from it.
  - Unique across accounts, compared case-insensitively; a handle already taken blocks **Finish** with **Username taken** and names no alternative.
  - Lowercase letters, digits, and underscores, 3–24 characters, lowercased on save. The format is a constraint, not a suggestion: a handle that does not match is rejected inline.
  - No reserved-word list. Every top-level segment stays a fixed word and handles live under `/user/`, so no handle competes with a route, per the [conventions](../luaplot-pages.md#conventions).
- **Display name** — required, free text, duplicates allowed; it is a label and never part of a URL. Prefilled from the provider's name when the provider returned one, empty otherwise.
- **Show NSFW content** — boolean, optional here, off for a new account.
- **Blur NSFW content** — boolean, optional here, off for a new account.

The two toggles are the first write of the [NSFW preference](../systems/nsfw.md): they are the account's values, not a per-page filter, and [account settings](user/edit.md) changes them later.

Only **Username** and **Display name** block **Finish**. The toggles may be left as they are; skipping them costs nothing, because off is the default a new account already holds.

## Actions

- **Finish** → entry content. Enabled once the two required fields are valid; the whole form is written in one save, so an abandoned first run keeps what was typed.

## States

- **First visit**
- **Resumed after abandonment** — an account that never finished is incomplete, and every other route returns here: the entered values are restored, so the run continues rather than restarts.
- **Username taken** — inline on the field, **Finish** stays disabled
- **Invalid username** — inline on the field, **Finish** stays disabled
