import { track } from "ripple";
import { ratioOf, type AuthoredItem } from "../lib/data/types.ts";
import { percent } from "../lib/format.ts";
import { href } from "../router.ts";
import { Avatar } from "./Avatar.tsrx";
import { Button } from "./Button.tsrx";

/**
 * Catalogue card — one authored item (character, lorebook or preset), drawn in three parts.
 *
 * Header (title link) and footer (author beside the derived ratio) stay crisp at all times; only
 * the middle — avatar, tagline, tags — is what the NSFW cover blurs. That split is load-bearing:
 * `specs/systems/nsfw.md` says *the numbers are never hidden*.
 *
 * The card takes the **entity** and reads the fields the schema already owns (`name`, `tagline`,
 * `tags`, `avatar`, `author`, counts), so it renders `ratioOf(item)` and can never be handed a
 * stored percentage. It never reads `lib/state/prefs.ts`: `nsfw` here is the **effective cover
 * flag** the listing computed (`item.nsfw && prefs.blur`), because the policy is the listing's and
 * the drawing is the card's.
 *
 * Reveal is the *glance*, not the preference: `revealed` is created inside the card and forgotten
 * on unmount, which is the spec's *a reveal lasts one view*. A prop expression is evaluated once,
 * so this state cannot be passed in — it would freeze.
 *
 * No comment count and no vote counts on a card: engagement on a listing is the ratio, and counts
 * live on the detail page (`luaplot-pages.md`). The tags row is absent, not empty, while the
 * taxonomy is undecided.
 */
export function Card({
  item,
  nsfw = false,
  onOpen,
}: {
  item: AuthoredItem;
  /** Effective cover flag, computed by the listing — not the account preference itself. */
  nsfw?: boolean;
  onOpen?: (event: MouseEvent) => void;
}) @{
  const revealed = track(false);
  const covered = track(() => nsfw && !revealed.value);
  const path = `/${item.kind}/${item.id}`;

  <article class={covered.value ? "card is-covered" : "card"}>
    <div class="card-head">
      <a class="card-title" href={href(path)} onClick={onOpen}>{item.name}</a>
    </div>

    <div class="card-middle">
      <div class="card-veil" aria-hidden={covered.value ? "true" : "false"}>
        <Avatar initials={item.avatar.initials} size={40} />
        <div class="card-body">
          @if (item.tagline) {
            <p class="card-tagline">{item.tagline}</p>
          }
          @if (item.tags.length > 0) {
            <ul class="card-tags">
              @for (const tag of item.tags; key tag) {
                <li class="card-tag">{tag}</li>
              }
            </ul>
          }
        </div>
      </div>

      @if (covered.value) {
        <div class="card-cover">
          <Button variant="ghost" onClick={() => (revealed.value = true)}>Reveal</Button>
        </div>
      }
    </div>

    <div class="card-foot">
      <a class="card-author" href={href(`/user/${item.author}`)}>{`@${item.author}`}</a>
      <span class="card-ratio">{percent(ratioOf(item))}</span>
    </div>
  </article>
}
