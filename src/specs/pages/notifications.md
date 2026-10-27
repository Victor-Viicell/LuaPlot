# `/notifications`

**Route** `/notifications` · **Access** signed in · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

The signed-in user's inbox, modeled on YouTube rather than on a per-event log. A notification exists to tell someone something is worth returning for, not to acknowledge every interaction, so the page shows deliberately fewer rows than there is activity behind it. A quiet app is a working app: too many notifications is a bug, not a sign of engagement.

## Data

Events worth notifying about:

- New public content from a user they follow (post, character, lorebook, preset).
- A comment on one of their own posts.
- A new follower.
- A moderation decision on their own content: a comment or post removed, or a creation made private by JEV.

Rules that keep the volume down:

- **Aggregate by target.** Events of the same kind on the same target collapse into one row, showing the newest actor plus a count: "Ada and 3 others commented on your post."
- **Collapse bursts.** When a single target or a single actor produces a burst, only the first event surfaces; the rest fold into that row and do not create new ones until it is read.
- **Return, don't interrupt.** Above a volume threshold, events stop arriving as individual rows and are delivered as a periodic summary instead.
- **Stay quiet about counts.** Engagement figures such as likes or reactions never notify individually, and a user is never notified about their own actions.

## Layout

_To be specified._

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
- Shows `9+` once the count passes the cap, instead of a number that keeps growing.
- Hidden at zero, and it does not reset on app launch: only reading rows clears it.
- Never announces itself — no toast, no animation, no increment per event. It changes only when the inbox changes.
- Ignores activity that was aggregated away or deferred into a digest, until that summary actually exists.

## Open questions

- What is the burst threshold, and what is the digest interval: once per app session, daily, or both?
- Does the periodic summary replace the individual rows for that period, or sit above them?
- Do followed users always notify on new content, or only their first post after a quiet stretch?
- In-app only, or also a native OS notification through Tauri?
- Is the aggregation key the target, the actor, or both? This decides whether two commenters on two different posts merge.
- Does a moderation alert explain the reason (copied content, missing NSFW flag, illegal) and link to the terms?
- Does opening the inbox clear the badge immediately, or only as rows are actually read?
- Is the cap `9+`, or does it scale with the nav layout?
