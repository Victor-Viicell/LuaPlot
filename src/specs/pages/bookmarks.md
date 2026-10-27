# `/bookmarks`

**Route** `/bookmarks` · **Access** signed in · **Index** [luaplot-pages.md](../luaplot-pages.md) · **Related** [notifications](notifications.md)

## Purpose

The signed-in user's saved items, kept as one catalog per shared type — characters, lorebooks, presets, and posts. Nothing is mixed: each type's bookmarks are browsed the way that type is browsed everywhere else, with its own search, sort, and filter, so a saved character is found by the same means as a character in the [catalog](character/catalog.md). It is personal: nobody else sees what a user bookmarks, and bookmarks never appear on a profile. It is also silent: saving, removing, or activity on a saved item notifies nobody on that account of its own, because [notifications](notifications.md) lists every event worth one and bookmarks are not among them.

## Layout

- Four tabs across the top — Characters, Lorebooks, Presets, Posts — each carrying its saved count. The type is the tab, never a filter, so one type's view is never diluted by another's.
- The page opens on the type holding the most recently saved item. A type with nothing saved is still selectable and shows its own empty state.
- The selected tab renders a catalog of that type's saved items, laid out in the card that type already uses: the [catalog](character/catalog.md) card for characters, lorebooks, and presets, the [thread](post/thread.md) card for posts.
- One control row above the grid: search, sort, filter, and the tab's saved count.
- Every card carries its remove control, so unbookmarking never requires opening the item.
- Newest saved first is the default order inside a tab; the grid otherwise behaves like the catalog it mirrors.

## Data

- Per tab, the items of that type the user saved, each with the fields its card shows and enough to link back.
- When each one was saved, which is what the save-order sorts read.
- A bookmark outlives the item: when the item is deleted by its author or removed by moderation, its card stays, keeps its type, and its title slot reads the type's not-exist sentence ("This character doesn't exist."). It links nowhere and **Remove bookmark** clears it.
- Own content is bookmarkable: a user's own character, lorebook, preset, or post sits in its tab like any other.
- NSFW items follow the viewer's [NSFW preference](../systems/nsfw.md) per tab: with Show off they are absent from the grid, and with Blur on their cards stay but are covered.

## Actions

- **Switch tab** — Characters, Lorebooks, Presets, Posts
- **Search** — the same matching the type's catalog uses, restricted to what the user saved
- **Sort** — newest saved first (default), oldest saved first, or title A–Z
- **Filter** — only `All` for now, reserved for the same undecided tag taxonomy the catalogs wait on
- **Open item** → its detail page
- **Remove bookmark** — from the card itself, without opening the item

## States

- **Empty** — nothing saved from the selected type: "Nothing saved here yet."
- **Populated**
- **No results for the active query**
- **Item no longer available**
- **Loading**

## URL

Type, search, sort, and filter all live in the query string — `?type=character&q=&sort=recent&tag=` — per the [conventions](../luaplot-pages.md#conventions), so a narrowed view can be shared, bookmarked, and restored by back/forward. The [NSFW preference](../systems/nsfw.md) is not part of that state: it belongs to the account, not to the view.
