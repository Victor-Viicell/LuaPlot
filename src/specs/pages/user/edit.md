# `/user/[user.username]/edit`

**Route** `/user/[user.username]/edit` · **Access** signed in, own account only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [profile](profile.md)

## Purpose

Edit the signed-in user's own account. Reachable from the extra option that only appears on the viewer's own [profile](profile.md); anyone else has no entry point and is rejected by the route itself.

## Layout

_To be specified._

## Data

Fields to be specified. Known so far:

- **Display name**
- **Avatar**
- **Bio**
- **Username** — changing it changes the profile URL.

## Actions

- **Save** → [profile](profile.md)
- **Cancel** → [profile](profile.md)

## States

- **Owner**
- **Not the owner** → forbidden
- **Username taken**
- **Validation error**
- **Saving**
- **Save failed**

## Open questions

- Changing the username changes `/user/[user.username]`, so every existing profile link breaks. Accept that, or keep the old handle as a redirect?
- Are email and linked providers displayed here, or is identity entirely Supabase's concern?
- Is account deletion part of this page, or out of scope for now?
