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
- **Open post** → [detail](detail.md)
- **Open author** → [profile](../user/profile.md)
- **Create** → [create](create.md)

## States

- **Loading**
- **Empty**
- **Error**
- **End of feed**

## URL

Sorting and filtering live in the query string, per the [conventions](../../luaplot-pages.md#conventions), so a filtered thread is shareable.

## Open questions

- Pagination: infinite scroll or explicit load more?
- Is there a "following only" view, or is the thread always global?
- Are comments shown inline under a post in the feed, or only on the permalink?
- Do posts surface their attached content preview directly in the feed?
