# JEV

**Type** asynchronous moderation system · **Index** [luaplot-pages.md](../luaplot-pages.md) · **Related** [report](../components/report.md) · [moderation queue](../pages/moderation/queue.md) · [terms](../pages/terms.md)

## Purpose

JEV is the classification model that watches reported content and, when it detects a violation, changes what other people can see. It has no page of its own and never speaks to users directly. Two constraints define it: for authored content it can only change visibility, never destroy; posts and comments, which have no private state, can be removed.

## Scope

What JEV actually judges:

- **Visual assets** — avatars, images, and GIFs, on any shared content. An unflagged NSFW avatar is a violation in its own right: the flag is what keeps that image from users who filtered NSFW out.
- **Text** — posts and comments, plus the text of characters, lorebooks, and presets. For the three authored types, only the NSFW flag and copying are judged.
- Character, lorebook, and preset bodies are creative content. They are judged for the NSFW flag and copied text, but not for illegal content.
- A copy claim must name its source.
  - Copied **text**: an internal source is fetched and compared; an external source goes to a moderator.
  - Copied **images** always go to a moderator, because visual comparison is not precise enough to automate.
- Personas are personal, so nobody else can report one; whether JEV still scans a persona avatar on its own is undecided.

## Pipeline

1. A report is filed, or JEV detects a violation on its own.
2. If the content is verified and has not been edited since, the report is recorded but starts no scan.
3. If the content already has an open case, the report joins it: no new queue entry and no new scan, but it adds weight to the item's place in the [moderation queue](../pages/moderation/queue.md).
4. JEV classifies the content against the [terms](../pages/terms.md).
5. When the violation is clear, it acts immediately: posts and comments are removed, while characters, lorebooks, and presets are made private. The case does not wait for a moderator.
6. When JEV is unsure, the content **stays public** and the case escalates to [`/moderation`](../pages/moderation/queue.md). Nothing is hidden pending review.
7. A copied image, or copied text whose source is outside LuaPlot, has no automatic verdict; it escalates to a moderator to verify.
8. Every action is notified to the creator.

## Decisions

| Content | JEV may | JEV may never |
| --- | --- | --- |
| Comment | Remove once the violation is clear | Make private |
| Post | Remove once the violation is clear | Make private |
| Character | Make private — its only lever over a violating avatar or image | Delete, or remove the avatar |
| Lorebook | Make private — its only lever over a violating avatar or image | Delete, or remove the avatar |
| Preset | Make private — its only lever over a violating avatar or image | Delete, or remove the avatar |
| Character, lorebook, preset text | Judge the NSFW flag and compare copied text | Judge it as illegal content |
| Missing NSFW flag on an avatar, image, or GIF | Treat it as a violation | Assume the flag is cosmetic |
| Missing NSFW flag on post or comment text | Treat it as a violation | Assume the flag is cosmetic |
| Copied text, source inside LuaPlot | Fetch both items and compare them | Act without the second item |
| Copied text, source outside LuaPlot | Send the claim to a moderator | Fetch an outside source |
| Copied image, any source | Send the claim to a moderator | Decide on a visual comparison |
| Realistic sexual depiction of a minor | Escalate immediately | Wait in the queue |
| Anything it is unsure about | Leave the content public and escalate | Hide it pending review |

## Privacy and republication

- Private is a visibility change, not a deletion. The content still exists and its owner can still open it.
- The owner sees the report, the reasons, and the measures taken on the content page itself.
- Once every reason has been patched, the owner may request public again. The content is flagged for re-verification, and JEV checks it before it becomes public.
- Posts and comments cannot be made private. Their only enforcement is removal, which happens as soon as JEV is certain; an unsure verdict leaves them visible.

## Verification

Verification exists to keep JEV's API calls bounded: content is scanned once per version, not once per report.

- A scan that finds nothing passes the content, marks it verified, and leaves it public. This is a positive result, not a suspicion.
- Verified content does not enter the report queue.
- Reports on verified content are **not archived**. They stay attached to the item, and if the item is reported again they count toward its weight.
- Any edit by the creator clears the flag and makes the new version eligible again, but an edit starts no scan of its own: a **fresh report after the change** is what queues it.
- A republication request runs the same check: when it passes, the flag is set and the content returns to public.
- Verification is cached per content version, so the flag is only as good as the last edit. A replacement avatar therefore waits for a fresh report like any other edit.

## Cumulative reports

Many reporters, one case, one scan.

- Every report on an item joins whatever case is already open for it, rather than opening a new one.
- No additional scan starts while a case is open, no matter how many reports arrive.
- Each report keeps its own reason and details, so the moderator sees the total count and the spread of reasons when deciding.
- Every new report adds weight, and the queue is ordered by weight: the most-reported item is reviewed first.
- The same guard covers spam: a burst of reports on one item costs one scan, not one scan per report.

## Rules

- JEV never hard deletes authored content. Only the creator can delete a character, lorebook, or preset.
- A verified item is exempt from the queue until it changes. Reports filed meanwhile are held, not discarded.
- Reports are cumulative per item: many reporters share one case and one scan, so a pile-on cannot multiply JEV calls.
- A new report adds weight to the item's place in the moderation queue.
- JEV removes a post or comment as soon as the violation is clear. There is no hidden intermediate state: an unsure verdict leaves it public and sends it to a moderator.
- JEV acts as soon as it detects a violation; the report queue is not its only input.
- Only visual assets and text are classified. Text on a character, lorebook, or preset is judged for its NSFW flag and for copying, not for illegal content.
- An unflagged NSFW avatar is a violation even when the surrounding text is fine. The flag is what stops the image from reaching users who filtered NSFW out.
- A copy claim must name its source: copied text from inside LuaPlot is compared automatically, copied text from outside needs a moderator, and every copied image needs a moderator.
- Realistic sexual depictions of minors are never classed as unsure. They escalate immediately, ahead of the periodic queue.
- Stylized loli and shota content is not treated as literal CSAM. It is judged as ordinary NSFW content: a violation only when the flag is missing.
- Human review covers whatever JEV cannot classify confidently, every copied image, and copied text from an outside source. The moderator concludes by choosing visibility, and may remove the avatar when the avatar is the violation while the text is valid.

## States

- **Queued**
- **Classifying**
- **Made private** — characters, lorebooks, presets
- **Removed** — posts and comments
- **Escalated to moderation** — content remains public unless JEV already acted
- **Dismissed** — no violation found
- **Held** — a report on verified content, waiting for a fresh report after a change
- **Flagged for re-verification**
- **Verified** — passed a scan, exempt from the queue until the next edit
- **Verified and public again**

## Open questions

- An immediate removal or privatisation is irreversible from the moderator side. Is there any human check on JEV's confirmed verdict, or is the creator's re-verification the only recovery?
- Are persona avatars scanned at all? They are never shared, so no one can report them, but they are still images.
- How does an owner "patch" a reason: by editing the content, or by acknowledging each reason individually?
- Does re-verification run immediately on request, or wait for the periodic queue?
- Can comments be edited at all? If they cannot, a verified comment never becomes eligible for the queue again.
- Is the verified flag exposed to authors, or is it internal only?
- Is the reporter ever told the outcome?
- What happens to the replies under a removed comment, or the comments under a removed post?
- Do JEV's immediate actions get an entry in the moderation queue for audit, or are they invisible to moderators?
- Does JEV scan content on publish, or only on report and on republication requests?
- How long does an open case block new scans — only until it concludes, or for a cool-down afterwards?
- Are reporters told that their report joined an existing case?
- How long is the queue period?
