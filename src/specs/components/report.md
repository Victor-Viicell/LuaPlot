# Report

**Used by** every shared item — [character](../pages/character/detail.md), [lorebook](../pages/lorebook/detail.md), [preset](../pages/preset/detail.md), [post](../pages/post/detail.md) — and every [comment](comment-thread.md) · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

One consistent way to flag content that breaks the [terms of use](../pages/terms.md). It appears on every piece of shared content and on comments, so a violation is never reported through a different flow depending on where it was found.

## Rules

- Available on shared content and on comments. Personas have no report button, because they are personal and never shared.
- Signed in only.
- Reasons mirror the terms: copied content, missing NSFW flag, and illegal content, plus an optional free-text note.
- Reporting is not engagement: it does not move likes or dislikes, and the author is never shown who reported.
- Illegal content is not just another reason. It should be escalated rather than handled as an ordinary violation, and realistic sexual depictions of minors escalate immediately.

## What happens next

Submitting a report queues the item for [JEV](../systems/jev.md). The control itself makes no decision and shows no verdict: JEV may remove a comment or post, make a character, lorebook, or preset private, or escalate to human review when it is unsure.

## Actions

- **Report**
- **Choose reason**
- **Add details** (optional)
- **Submit**
- **Cancel**

## States

- **Signed out** — no button
- **Already reported**
- **Submitting**
- **Submitted**
- **Failed**

## Open questions

- Human review has no destination: JEV can escalate, but no route or role receives the escalation.
- Does reporting hide the item for the reporter while it is pending?
- One report per user per item, or are repeated reports allowed?
- Can a report be withdrawn?
- Should reporting be rate-limited?
- Does "illegal" need its own path — for example immediate escalation rather than the ordinary queue?
