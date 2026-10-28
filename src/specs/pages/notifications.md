# `/notifications`

**Route** `/notifications` · **Access** signed in · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

The signed-in user's inbox, modeled on YouTube rather than on a per-event log. A notification exists to tell someone something is worth returning for, not to acknowledge every interaction, so the page shows deliberately fewer rows than there is activity behind it. A quiet app is a working app: too many notifications is a bug, not a sign of engagement.

## Data

Events worth notifying about:

- New public content from a user they follow (post, character, lorebook, preset). Every new item notifies; the burst rule is what keeps a prolific author from filling the list.
- A comment on one of their own posts.
- A new follower.
- A moderation decision on their own content: made private, an avatar removed, or a post or comment removed. Any action by JEV or a moderator reaches the creator. The alert names the measure taken and opens the content, where the report and its reasons are recorded; the reasons themselves are not restated in the row.

Rules that keep the volume down:

- **Aggregate by target.** Events of the same kind on the same target collapse into one row, showing the newest actor plus a count: "Ada and 3 others commented on your post." The key is the target and the kind, never the actor: two people commenting on one post share a row, one person commenting on two posts gets two.
- **Collapse bursts.** When a single target or a single actor produces a burst, only the first event surfaces; the rest fold into that row and do not create new ones until it is read.
- **Return, don't interrupt.** Above a volume threshold, events stop arriving as individual rows and are delivered as a periodic summary instead. Deferral starts once the inbox holds 10 unread rows, the point where the badge saturates, and the summary arrives once a day.
- **A summary stands in for what it defers.** Deferred events never appear as rows of their own: the summary is one row in their place, counting what it holds, and it sits at the top of the list until read. Rows already in the list are not replaced.
- **Stay quiet about counts.** Engagement figures such as likes or reactions never notify individually, and a user is never notified about their own actions.
- **In-app only.** No native OS notification and no toast: the badge is the only signal outside the page.

## Layout

One column, newest first. Each row puts the actor's avatar beside a single sentence naming the actor, the event, and the target, with the time at the end, and the whole row is the link to it. Unread rows are marked. **Mark all read** sits at the top of the list, and the periodic summary, when one exists, is the first row.

## Actions

- **Open** → deep link to the source post, content, or profile.
- **Mark read**
- **Mark all read**

## States

- **Empty**
- **Individual row**
- **Aggregated row**
- **Periodic summary**
- **Loading**

## Badge

The app shell carries the same badge YouTube does: a hint that something is waiting, not a running tally of activity.

- Counts unread notification **rows**, not underlying events. Because events aggregate before they reach the list, a single busy post is one increment rather than forty.
- Shows `9+` once the count passes the cap, instead of a number that keeps growing. The cap is fixed at 9 and does not scale with the nav layout.
- Hidden at zero, and it does not reset on app launch: only reading rows clears it. Opening the inbox clears nothing by itself; the badge drops as rows are read, one per row.
- Never announces itself — no toast, no animation, no increment per event. It changes only when the inbox changes.
- Ignores activity that was aggregated away or deferred into a digest, until that summary actually exists.
