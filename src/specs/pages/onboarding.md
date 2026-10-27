# `/onboarding`

**Route** `/onboarding` · **Access** signed in, not yet onboarded · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

First-run setup after registration. Collects the essentials (username, display name, preferences) needed before the user can browse or create anything. Creating a persona is not required here.

## Layout

_To be specified._

## Data

Known so far:

- **Username** — claimed here, since an OAuth provider supplies no handle.
- **Display name**
- **Show NSFW content** — boolean
- **Blur NSFW content** — boolean

The two toggles are the first write of the [NSFW preference](../systems/nsfw.md).

## Actions

- **Finish** → entry content

## States

- **First visit**
- **Resumed after abandonment**

## Open questions

- Given that signing up happens through an OAuth provider, the username cannot come from the provider and is claimed here. How are collisions and reserved words handled?
- What happens if the user abandons onboarding midway: locked out of the app, or let in with defaults?
- Which preferences are required, and which can be skipped?
