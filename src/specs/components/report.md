# Report

**Used by** every shared item — [character](../pages/character/detail.md), [lorebook](../pages/lorebook/detail.md), [preset](../pages/preset/detail.md), [post](../pages/post/detail.md) — and every [comment](comment-thread.md) · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

One consistent way to flag content that breaks the [terms of use](../pages/terms.md). It appears on every piece of shared content and on comments, so a violation is never reported through a different flow depending on where it was found.

## Rules

- Available on shared content and on comments. Personas have no report button, because they are personal and never shared.
- Signed in only.
- **What can be reported depends on the surface, not the content type.**
  - **Avatars, images, and GIFs** (on any content): a missing NSFW flag, illegal content, or a copied image.
  - **Post and comment text**: a missing NSFW flag, illegal content, or copied text.
  - **Character, lorebook, and preset text**: a missing NSFW flag, copied text, or illegal content. These bodies are never judged for illegal content by [JEV](../systems/jev.md) — that reason goes straight to a moderator.
- **A copy claim names its source** — the item inside LuaPlot it was copied from, or a link to an outside source. Copied text with an internal source is compared by [JEV](../systems/jev.md); copied text from outside, and every copied image, goes to a moderator.
- An optional free-text note is always allowed.
- Reporting is not engagement: it does not move likes or dislikes, and the author is never shown who reported.
- Reports are cumulative: reporting an item that already has an open case adds to that case instead of starting a new scan, and raises the item's weight in the [moderation queue](../pages/moderation/queue.md).
- **One report per user per item** — a viewer who already reported it sees that state instead of a second submit, since a duplicate from the same account would only inflate weight.
- **A report cannot be withdrawn.** It is a record, not a vote, and JEV's work is per item rather than per report, so there is nothing to take back.
- **No separate rate limit.** One report per user per item is the limit; there is no cooldown on top of it, because a pile-on on one item already costs a single scan.
- Illegal content is not just another reason. It should be escalated rather than handled as an ordinary violation, and realistic sexual depictions of minors escalate immediately. Every other illegal report is still triaged by JEV first: it removes what is clear and escalates what it is unsure about.
- **The reporter never sees an outcome** — not the verdict, not the surface a claim was judged on, and not who acted. The only confirmation is that the report was submitted, or that it was recorded on already-verified content.

## What happens next

Submitting a report queues the item for [JEV](../systems/jev.md), unless the content is already verified — a clean scan leaves the report on file but starts no scan until the content changes and a fresh report arrives — or already has an open case, in which case the report joins that case without a new scan and raises the item's weight in the queue. The control itself makes no decision and shows no verdict. JEV may remove a post or comment as soon as a violation is clear, make a character, lorebook, or preset private, or leave uncertain content public while it escalates to [`/moderation`](../pages/moderation/queue.md). A copied image, or copied text from an outside source, always goes to a moderator, and so does illegal content in a character, lorebook, or preset body. In serious cases a moderator can also remove an avatar. Authored content is never deleted by moderation — only its creator can delete it.

## Actions

- **Report**
- **Choose what is being reported** — the avatar or image, or the text; the reason list follows that choice
- **Choose reason**
- **Name the source** — the copied-from item or an outside link; required for every copy claim
- **Add details** (optional)
- **Submit**
- **Cancel**

## States

- **Signed out** — no button
- **Already reported** — the control shows the existing report and offers no second submit; the item's weight in the moderation queue is unchanged by the viewer
- **Already verified** — recorded and held; the confirmation says a review starts once the content changes, and never claims the report is being looked at now
- **Submitting**
- **Submitted**
- **Failed**
