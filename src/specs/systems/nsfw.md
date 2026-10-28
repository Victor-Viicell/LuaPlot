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
- A new account starts with both off, and [onboarding](../pages/onboarding.md) may leave them untouched: neither toggle blocks **Finish**, and skipping them writes nothing, since off is what the account already holds.
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
- **A reveal lasts one view.** It uncovers that one item until the page is reloaded or the listing is fetched again, and nothing about it is written to the account: Blur on stays the account's answer, and a reveal is a single look, not a change of preference.
- Neither setting exempts the viewer's own content: their own NSFW items are hidden or covered like anyone else's.
- Every listing honours the settings — the catalogs, the [post thread](../pages/post/thread.md), [profile](../pages/user/profile.md) tabs, [bookmarks](../pages/bookmarks.md), and search results.
- **With Show off, a detail route still resolves.** The item draws with its chrome intact and the body withheld behind the same reveal control a blurred item carries; there is no separate notice page and no empty render. The preference hides listings, never a route.
- **Signed out**, NSFW is off by default: nothing NSFW is shown, but the control is still visible, and activating it leads to [`/authentification`](../pages/authentification.md). There it is a single **Show NSFW content** action rather than the pair, since there is no account to hold a Blur setting.
- Signing in from that control follows the ordinary outcome of [`/authentification`](../pages/authentification.md) — a new account continues to [onboarding](../pages/onboarding.md), a returning one to its content. No return-to-page parameter is carried, so the visitor does not come back to the listing they left.
- The preference belongs to the account, so it follows the user rather than a single page.

## States

- **Show on / Blur off** — plain listing
- **Show on / Blur on** — catalog cards keep the title and the footer row (author and ratio); the avatar, tagline, and tags are covered. Posts and comments keep their header and footer; the body is covered. Each has its own reveal button.
- **Show off** — NSFW items absent, whatever Blur says
- **Revealed** — one item uncovered for this view only; it returns to covered on reload
- **Signed out** — nothing NSFW shown; a single **Show NSFW content** control is visible and leads to sign-in
