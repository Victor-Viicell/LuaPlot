# `/post/thread`

**Route** `/post/thread` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

The public timeline. A reverse-chronological feed of every post, with sorting (newest first by default, most discussed, most liked) kept in the URL. Filtering exposes only `All` for now, pending a tag taxonomy. Everything in the thread is public, so following changes what a user is notified about, not what they can see.

## Layout

_To be specified._

## Data

_To be specified._

## Actions

- **Sort**
- **Filter** — only `All` for now
- **NSFW preference** — the Show and Blur toggles from [NSFW preference](../../systems/nsfw.md); they edit the account, not this view
- **Open post** → [detail](detail.md)
- **Open author** → [profile](../user/profile.md)
- **Create** → [create](create.md)

## States

- **Loading**
- **Empty**
- **Error**
- **End of feed**

## URL

Sorting and filtering live in the query string, per the [conventions](../../luaplot-pages.md#conventions), so a filtered thread is shareable. The [NSFW preference](../../systems/nsfw.md) is not part of that state: it belongs to the account, and with Show off, NSFW posts are absent from the feed.

## Open questions

- Pagination: infinite scroll or explicit load more?
- Is there a "following only" view, or is the thread always global?
- Are comments shown inline under a post in the feed, or only on the permalink?
- Do posts surface their attached content preview directly in the feed?
- Do removed posts disappear from the thread, from profile post lists, and from bookmarks?
- Does a post awaiting a moderator's decision (JEV unsure) carry any visible marker, or does it look untouched?
