# `/`

**Route** `/` · **Access** public · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

Landing page and entry point. Explains what Luaplot is and routes the visitor onward: to `/authentification` when signed out, or into their content when a session exists.

## Layout

- One screen, no sections: the product name, a short paragraph explaining what Luaplot is, and the entry control.
- A bare entry screen, not a campaign: no hero, no feature blocks, no narrative or marketing sections.
- The entry control carries the visitor onward — to [authentification](authentification.md) signed out, to their own [profile](user/profile.md) signed in.
- The page still renders for a signed-in visitor instead of redirecting them away: the control, not a redirect, is the way into their content.

## Data

- The session state only — whether the viewer is signed in, and the handle their profile link points at.
- No listings, counts, or content rows are read here: the page shows nothing from the catalogues or the thread.

## Actions

- **Signed out** → link to [authentification](authentification.md).
- **Signed in** → link to the viewer's own [profile](user/profile.md), which carries their creations, posts, and follows.

## States

- **Signed out**
- **Signed in**
