import { Avatar } from "./Avatar.tsrx";
import { follow, href } from "../router.ts";
import type { Profile } from "../lib/data/types.ts";

/**
 * UserCard — the catalog card's design, worn by a person.
 *
 * The owner asked for one card language across the app: a profile in a Followers or Following list
 * is drawn exactly like a character is drawn in a catalog, with two fields swapped — **the bio takes
 * the tagline's slot** and **the footer carries followers and following** instead of an author and a
 * ratio. Everything else is the shared `.card` structure (`luaplot-pages.md` → Conventions), so a
 * person reads at the same rhythm as an item.
 *
 * The handle sits under the title rather than in the footer: the footer is the counts, and a handle
 * is identity, not engagement. It is **not** a second link to the profile (T-47): the title already
 * opens it, and the handle line measured under the 44px floor, so it is plain text with the same type.
 */
export function UserCard({ person }: { person: Profile }) @{
  const to = `/user/${person.handle}`;

  <article class="card">
    <div class="card-head">
      <a class="card-title" href={href(to)} onClick={follow(to)}>{person.displayName}</a>
    </div>

    <p class="card-handle">{`@${person.handle}`}</p>

    <div class="card-middle">
      <div class="card-veil">
        <div class="card-top">
          <Avatar initials={person.avatar.initials} size="fluid" label={`${person.displayName} avatar`} />
          <div class="card-body">
            @if (person.bio) {
              <p class="card-tagline">{person.bio}</p>
            }
          </div>
        </div>
      </div>
    </div>

    <div class="card-foot">
      <span>{`${person.followers} ${person.followers === 1 ? "follower" : "followers"}`}</span>
      <span>{`${person.following} following`}</span>
    </div>
  </article>
}

export default UserCard;
