# `/post/thread`

**Route** `/post/thread` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

The public timeline. A reverse-chronological feed of every post, with sorting (newest first by default, most discussed, most liked) kept in the URL. Filtering exposes only `All` for now, pending a tag taxonomy. Everything in the thread is public, so following changes what a user is notified about, not what they can see.

## Layout

- One column of post cards under a single control row: sort, filter, the Show and Blur toggles of the [NSFW preference](../../systems/nsfw.md), and **Create** at the end of the row.
- The card is the structure the [conventions](../../luaplot-pages.md#conventions) fix for posts: a header with the poster's profile and the time of posting, the body with its inline images, and a footer with likes, dislikes, and the comment count. No comment renders in the feed; the count opens the permalink, which is the only place the thread is shown.
- The attachment renders inside the card, under the body: a character shows its avatar, name, and tagline, and a cut shows its first messages with the rest folded behind **Show more**, which expands in place instead of opening the permalink.
- **Load more** sits at the bottom of the column and appends the next 24 posts, per the paging convention: no scroll-triggered fetching, no page numbers, and paging stays out of the URL.

## Data

- Every public post, newest first — and nothing narrower. There is no following-only view and no per-author variant: following changes what a viewer is notified about, not what the thread lists, since all shared content is already public.
- Per card: the poster, the time of posting, the body, the attachment's own line, likes, dislikes, and the comment count. No comment bodies, and no engagement beyond those three numbers.
- Moderation leaves no mark on a card. A post with an open case, an unsure JEV verdict included, renders exactly like any other; a post removed by moderation or deleted by its author simply leaves the list, and leaves it everywhere else it is listed too.

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
