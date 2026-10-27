# NSFW preference

**Type** per-account setting · **Index** [luaplot-pages.md](../luaplot-pages.md) · **Related** [terms](../pages/terms.md) · [onboarding](../pages/onboarding.md) · [account settings](../pages/user/edit.md) · [character catalog](../pages/character/catalog.md) · [post thread](../pages/post/thread.md) · [profile](../pages/user/profile.md) · [bookmarks](../pages/bookmarks.md)

## Purpose

Decides how NSFW-flagged public content reaches a viewer. The creator's NSFW boolean describes the content; this preference describes the viewer's appetite for it. It is not a rule and never changes what is published — only what is listed and how it is drawn.

## Settings

| Setting | Type | Covers | Effect |
| --- | --- | --- | --- |
| **Show NSFW content** | boolean | posts, comments, images, characters, lorebooks, presets | off keeps NSFW items out of listings |
| **Blur NSFW content** | boolean | catalog card metadata, posts, comments | on keeps them listed but covered until revealed |

- The two switches are independent. A contradictory pair — Show off, Blur on — is allowed; blur simply has nothing to act on.
- Blur only matters while Show is on.
- Personas are outside both settings: they are personal and never listed publicly.

## Where it lives

The same two settings are editable in three places, all editing the account, not a per-view filter:

- [Onboarding](../pages/onboarding.md) — set once during first-run setup.
- [Account settings](../pages/user/edit.md) — changed later.
- Each catalog and the [post thread](../pages/post/thread.md) — a control on the listing itself, so the viewer does not have to leave it.

## Rules

- Applies to public listings only. Sessions are private and unmoderated; this preference does not alter a conversation.
- **It is not access control.** No route is blocked, no 404, no redirect: a direct link still resolves. Only content is hidden or covered.
- Show off removes the item from the listing. Blur on leaves it there, covered.
- **Blur is structural.** The unit keeps its chrome. On a catalog card the top header is the title and the bottom footer is a single row holding the author beside the ratio as a percentage; the bottom line carries no comment count. The blurred area is exactly what sits between them — the avatar, the tagline, and the tags. On a post or a comment, the header carries the poster's profile and the time of posting, the footer carries likes, dislikes, and the comment count, and the body between them is what gets blurred. **The numbers are never hidden** — only the body is covered.
- **Every blurred item carries its own reveal button.** Revealing one item never reveals the rest, and every blurred item must offer the control.
- Neither setting exempts the viewer's own content: their own NSFW items are hidden or covered like anyone else's.
- Every listing honours the settings — the catalogs, the [post thread](../pages/post/thread.md), [profile](../pages/user/profile.md) tabs, [bookmarks](../pages/bookmarks.md), and search results.
- **Signed out**, NSFW is off by default: nothing NSFW is shown, but the control is still visible, and activating it leads to [`/authentification`](../pages/authentification.md).
- The preference belongs to the account, so it follows the user rather than a single page.

## States

- **Show on / Blur off** — plain listing
- **Show on / Blur on** — catalog cards keep the title and the footer row (author and ratio); the avatar, tagline, and tags are covered. Posts and comments keep their header and footer; the body is covered. Each has its own reveal button.
- **Show off** — NSFW items absent, whatever Blur says
- **Signed out** — nothing NSFW shown; the control is visible and leads to sign-in

## Open questions

- What are the defaults for a new account, and can onboarding skip the two toggles?
- Does a revealed item stay revealed after a reload, or return to blurred?
- With Show off, what does a detail route render: the item with its content hidden, a notice explaining the preference, or nothing?
- While signed out, is the control a single "Show NSFW" action or the full pair of toggles?
- After signing in from that control, does the visitor return to the page they were on?
