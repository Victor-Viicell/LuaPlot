import { track } from "ripple";
import { Avatar } from "../components/Avatar.tsrx";
import { Button } from "../components/Button.tsrx";
import { CardGrid } from "../components/CardGrid.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { PostCard } from "../components/PostCard.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { Tabs } from "../components/Tabs.tsrx";
import { href, useParams, useQuery } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type {
  AuthoredItem,
  Character,
  Post,
  Profile,
  ProfileCreationType,
  ProfileTab,
} from "../lib/data/types.ts";
import { handleSchema, profileCreationTypeSchema, profileTabSchema } from "../lib/schema.ts";
import { currentUser } from "../lib/state/session.ts";
import { nsfwPreference, onPrefs } from "../lib/state/prefs.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/user/[user.username]` — somebody's public profile (`src/specs/pages/user/profile.md`).
 *
 * This is the first page that draws **another** account, so nothing here may assume the viewer is
 * the author: the header's one control is Follow/Unfollow on a stranger's page and Edit profile on
 * your own, and a signed-out visitor is sent to `/authentification` instead of being given a
 * follow that would have nobody to write.
 *
 * What the page owns:
 * - **Four tabs in `?tab=`**, the type control row in `?type=` on the creations tab only. Both are
 *   written straight through `history` — `navigate()` remounts and throws away the rows.
 * - **One fetch path per tab**, `(1, "replace")` on a change and `(next, "append")` for **Load
 *   more**; paging is deliberately not in the URL (`luaplot-pages.md` → *Conventions*).
 * - **The follow write never remounts**: the answer is the updated profile, so the figure and the
 *   button move in place and the tab stays where it was.
 * - **Absence is the adapter's**: private and moderated rows never arrive, so a tab count, a paging
 *   remainder and a title cannot leak them.
 * - **No personas**: a persona is personal and is never listed here.
 */

const TABS: { value: ProfileTab; label: string }[] = [
  { value: "creations", label: "Creations" },
  { value: "posts", label: "Posts" },
  { value: "followers", label: "Followers" },
  { value: "following", label: "Following" },
];

/** The creations tab's filter row — a control over one listing, never a fifth tab. */
const TYPES: { value: ProfileCreationType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "character", label: "Characters" },
  { value: "lorebook", label: "Lorebooks" },
  { value: "preset", label: "Presets" },
];

/** The page's own reading of its URL, taken once at mount. */
function readQuery(): { tab: ProfileTab; type: ProfileCreationType } {
  const params = useQuery();
  const rawTab = params.get("tab");
  const rawType = params.get("type");
  const tab = rawTab === null ? null : profileTabSchema.safeParse(rawTab);
  const type = rawType === null ? null : profileCreationTypeSchema.safeParse(rawType);

  // Parsed, not trusted: an unknown value falls back to the spec's default rather than a new state.
  return {
    tab: tab?.success ? tab.data : "creations",
    type: type?.success ? type.data : "all",
  };
}

/** Write tab/type through history without telling the router (see the page's header comment). */
function writeQuery(tab: ProfileTab, type: ProfileCreationType, mode: "push" | "replace"): void {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (tab === "creations" && type !== "all") params.set("type", type);

  const url = `${window.location.pathname}?${params.toString()}`;
  if (mode === "replace") window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
}

type Phase = "loading" | "ready" | "missing" | "error";
type ListPhase = "loading" | "ready" | "error";

export function UserProfile() @{
  const repo = resolveRepo();
  const params = useParams();
  const start = readQuery();

  // A route param is an edge: parsed through the one handle rule, which also lowercases it.
  const parsedHandle = handleSchema.safeParse(params.username ?? "");
  const handle = parsedHandle.success ? parsedHandle.data : "";

  const viewer = currentUser();
  const myHandle = viewer?.handle ?? "";

  /** The page's own state: the header, then the selected tab's body separately — a tab swap must
   * not blank the header the reader is looking at. */
  const phase = track<Phase>("loading");
  const listPhase = track<ListPhase>("loading");
  const failure = track("");
  const row = track<Profile | null>(null);
  const following = track(false);
  const followBusy = track(false);

  const tab = track<ProfileTab>(start.tab);
  const type = track<ProfileCreationType>(start.type);

  const creations = track<AuthoredItem[]>([]);
  const posts = track<Post[]>([]);
  const people = track<Profile[]>([]);
  const attachments = track<Record<string, Character>>({});

  const hasMore = track(false);
  const nextPage = track(1);
  const appending = track(false);
  const appendFailure = track("");

  /** Mirrors of the account's pair: Show off removes a flagged row, Blur covers it in the card. */
  const show = track(nsfwPreference().show);
  const blur = track(nsfwPreference().blur);
  onPrefs((next) => {
    show.value = next.show;
    blur.value = next.blur;
  });

  const visibleCreations = track(() =>
    show.value ? creations.value : creations.value.filter((item) => !item.nsfw),
  );
  const own = track(() => myHandle !== "" && myHandle === handle);
  const initials = track(() => row.value?.avatar.initials ?? handle.slice(0, 2).toUpperCase());

  /** One flat chain in the template: is the selected tab empty, and what does it say? */
  const sectionEmpty = track(() =>
    tab.value === "creations"
      ? visibleCreations.value.length === 0
      : tab.value === "posts"
        ? posts.value.length === 0
        : people.value.length === 0,
  );
  const sectionEmptyCopy = track(() =>
    tab.value === "creations"
      ? "Nothing public here yet."
      : tab.value === "posts"
        ? "No posts yet."
        : tab.value === "followers"
          ? "No followers yet."
          : "Not following anyone yet.",
  );

  let seq = 0;

  /** Attachment characters for the posts tab, one lookup per distinct id (the thread's rule). */
  function resolveAttachments(rows: Post[]): void {
    const wanted = new Set<string>();
    for (const post of rows) {
      const attachment = post.attachment;
      if (attachment?.kind === "character" && !attachments.value[attachment.characterId]) {
        wanted.add(attachment.characterId);
      }
    }
    if (wanted.size === 0) return;

    Promise.all([...wanted].map((id) => repo.getCharacter(id))).then(
      (found) => {
        const next = { ...attachments.value };
        for (const item of found) if (item) next[item.id] = item;
        attachments.value = next;
      },
      () => {
        // A missing attachment is not a listing failure: the card draws no attachment.
      },
    );
  }

  /** Start one fetch. `replace` clears the tab's rows, `append` keeps them. */
  function begin(mode: "replace" | "append"): number | null {
    appendFailure.value = "";
    if (mode === "append") {
      if (appending.value) return null;
      appending.value = true;
    } else {
      listPhase.value = "loading";
      hasMore.value = false;
      nextPage.value = 1;
      creations.value = [];
      posts.value = [];
      people.value = [];
    }
    return ++seq;
  }

  function settle(page: number, listing: { hasMore: boolean }): void {
    hasMore.value = listing.hasMore;
    nextPage.value = page + 1;
    appending.value = false;
    listPhase.value = "ready";
  }

  function fail(mode: "replace" | "append"): void {
    appending.value = false;
    if (mode === "append") {
      appendFailure.value = "The next page didn't load.";
      return;
    }
    listPhase.value = "error";
    failure.value = "This profile couldn't be loaded.";
  }

  function loadCreations(page: number, mode: "replace" | "append"): void {
    const mine = begin(mode);
    if (mine === null) return;

    repo.profileCreations(handle, { type: type.value, page }).then(
      (listing) => {
        if (mine !== seq) return;
        if (mode === "append") creations.value = [...creations.value, ...listing.items];
        else creations.value = listing.items;
        settle(page, listing);
      },
      () => {
        if (mine !== seq) return;
        fail(mode);
      },
    );
  }

  function loadPosts(page: number, mode: "replace" | "append"): void {
    const mine = begin(mode);
    if (mine === null) return;

    repo.profilePosts(handle, { page }).then(
      (listing) => {
        if (mine !== seq) return;
        posts.value = mode === "append" ? [...posts.value, ...listing.items] : listing.items;
        settle(page, listing);
        resolveAttachments(listing.items);
      },
      () => {
        if (mine !== seq) return;
        fail(mode);
      },
    );
  }

  function loadPeople(
    side: "followers" | "following",
    page: number,
    mode: "replace" | "append",
  ): void {
    const mine = begin(mode);
    if (mine === null) return;

    const call = side === "followers" ? repo.followersOf : repo.followingOf;
    call(handle, { page }).then(
      (listing) => {
        if (mine !== seq) return;
        people.value = mode === "append" ? [...people.value, ...listing.items] : listing.items;
        settle(page, listing);
      },
      () => {
        if (mine !== seq) return;
        fail(mode);
      },
    );
  }

  function load(page: number, mode: "replace" | "append"): void {
    if (tab.value === "posts") loadPosts(page, mode);
    else if (tab.value === "followers") loadPeople("followers", page, mode);
    else if (tab.value === "following") loadPeople("following", page, mode);
    else loadCreations(page, mode);
  }

  function boot(): void {
    const mine = ++seq;
    phase.value = "loading";
    listPhase.value = "loading";
    failure.value = "";

    if (handle === "") {
      phase.value = "missing";
      return;
    }

    const follows =
      myHandle === handle ? Promise.resolve(false) : repo.isFollowing(handle);

    Promise.all([repo.getProfile(handle), follows]).then(
      ([found, isFollowing]) => {
        if (mine !== seq) return;
        if (!found) {
          phase.value = "missing";
          return;
        }
        row.value = found;
        following.value = isFollowing;
        phase.value = "ready";
        // The tab is written once, after the profile is known, so a shared link keeps its state.
        writeQuery(tab.value, type.value, "replace");
        load(1, "replace");
      },
      () => {
        if (mine !== seq) return;
        phase.value = "error";
        failure.value = "This profile couldn't be loaded.";
      },
    );
  }

  function chooseTab(next: string): void {
    const parsed = profileTabSchema.safeParse(next);
    if (!parsed.success || parsed.data === tab.value) return;

    tab.value = parsed.data;
    writeQuery(parsed.data, type.value, "push");
    load(1, "replace");
  }

  function chooseType(next: string): void {
    const parsed = profileCreationTypeSchema.safeParse(next);
    if (!parsed.success || parsed.data === type.value) return;

    type.value = parsed.data;
    writeQuery(tab.value, parsed.data, "push");
    load(1, "replace");
  }

  function loadMore(): void {
    if (!hasMore.value || appending.value) return;
    load(nextPage.value, "append");
  }

  /** Follow / unfollow: the answer is the updated profile, so nothing is re-read and no tab moves. */
  async function toggleFollow(): Promise<void> {
    if (followBusy.value) return;
    followBusy.value = true;

    const answer = following.value
      ? await repo.unfollowUser(handle).catch(() => null)
      : await repo.followUser(handle).catch(() => null);

    followBusy.value = false;
    if (!answer) {
      toast(following.value ? "Couldn't unfollow this account." : "Couldn't follow this account.");
      return;
    }

    row.value = answer;
    following.value = !following.value;
    // The followers tab lists the same edges this write just changed, so it cannot stay as it was.
    if (tab.value === "followers") load(1, "replace");
  }

  boot();

  <div class="profile">
    <style>
      .profile {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .profile-head {
        display: grid;
        grid-template-columns: 56px minmax(0, 1fr);
        grid-template-areas:
          "avatar who"
          "action action";
        gap: 14px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--color-border);
      }

      .head-avatar {
        grid-area: avatar;
      }

      .who {
        grid-area: who;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .name {
        margin: 0;
        color: var(--color-text);
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }

      .handle {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .bio {
        max-width: 56ch;
        margin: 2px 0 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.65;
        text-wrap: pretty;
      }

      /* Plain figures, never links: the followers and following tabs are the only way in. */
      .figures {
        display: flex;
        gap: 16px;
        margin: 6px 0 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.4;
      }

      .figure strong {
        color: var(--color-text);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .head-action {
        grid-area: action;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .head-action > * {
        min-width: 140px;
      }

      /* The type row: a filter over one listing, drawn as chips rather than a second tab strip. */
      .type-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .type-chip {
        min-height: 44px;
        padding: 0 14px;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        background-color: var(--color-bg-elevated);
        color: var(--color-text-muted);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }

      .type-chip.is-on {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .people {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .person + .person {
        border-top: 1px solid var(--color-border);
      }

      .person-link {
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr);
        align-items: start;
        gap: 12px;
        min-height: 44px;
        padding: 14px 0;
        color: inherit;
        text-decoration: none;
      }

      .person-who {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .person-name {
        margin: 0;
        color: var(--color-text);
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .person-handle {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.4;
      }

      .person-bio {
        margin: 4px 0 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.55;
        text-wrap: pretty;
      }

      .feed {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .slab {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      .pager,
      .alert {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .alert {
        align-items: flex-start;
        padding: 16px 0;
      }

      .alert-text {
        margin: 0;
        color: var(--color-danger);
        font-size: 14px;
        line-height: 1.6;
      }

      @media (min-width: 640px) {
        .profile-head {
          grid-template-columns: 72px minmax(0, 1fr) auto;
          grid-template-areas: "avatar who action";
          align-items: start;
          gap: 18px;
        }

        .name {
          font-size: 26px;
        }

        .head-action {
          justify-content: flex-end;
        }

        .pager {
          align-items: center;
        }

        .pager > div {
          min-width: 200px;
        }
      }

      @media (min-width: 900px) {
        .profile {
          gap: 22px;
        }

        .name {
          font-size: 30px;
        }

        .bio {
          font-size: 15px;
        }

        .person-link:hover .person-name {
          color: var(--color-accent);
        }
      }
    </style>

    @if (phase.value === "loading") {
      <div class="slab" aria-busy="true" aria-label="Loading profile">
        <Skeleton variant="block" height={22} />
        <Skeleton variant="block" height={14} />
        <Skeleton variant="block" height={56} />
      </div>
    } @else if (phase.value === "missing") {
      <EmptyState message="This user doesn't exist." />
    } @else if (phase.value === "error") {
      <div class="alert" role="alert">
        <p class="alert-text">{failure.value}</p>
        <Button variant="secondary" onClick={boot}>Retry</Button>
      </div>
    } @else {
      <>
        <header class="profile-head">
          <div class="head-avatar">
            <Avatar
              initials={initials.value}
              label={`${row.value?.displayName ?? handle} avatar`}
              size={56}
            />
          </div>

          <div class="who">
            <h1 class="name">{row.value?.displayName}</h1>
            <p class="handle">{`@${handle}`}</p>
            @if (row.value && row.value.bio) {
              <p class="bio">{row.value.bio}</p>
            }
            <p class="figures">
              <span class="figure"><strong>{row.value?.followers ?? 0}</strong> followers</span>
              <span class="figure"><strong>{row.value?.following ?? 0}</strong> following</span>
            </p>
          </div>

          <div class="head-action">
            @if (own.value) {
              <a class="btn btn-secondary" href={href(`/user/${handle}/edit`)}>Edit profile</a>
            } @else if (myHandle === "") {
              <a class="btn btn-primary" href={href("/authentification")}>Sign in to follow</a>
            } @else {
              <Button
                variant={following.value ? "secondary" : "primary"}
                disabled={followBusy}
                onClick={toggleFollow}
              >
                {following.value ? "Unfollow" : "Follow"}
              </Button>
            }
          </div>
        </header>

        <Tabs items={TABS} value={tab} onChange={chooseTab} label="Profile sections" />

        @if (tab.value === "creations") {
          <div class="type-row" role="group" aria-label="Filter creations by type">
            @for (const option of TYPES; key option.value) {
              <button
                type="button"
                class={type.value === option.value ? "type-chip is-on" : "type-chip"}
                aria-pressed={type.value === option.value ? "true" : "false"}
                onClick={() => chooseType(option.value)}
              >
                {option.label}
              </button>
            }
          </div>
        }

        @if (listPhase.value === "loading") {
          <div class="slab" aria-busy="true" aria-label="Loading this section">
            <Skeleton variant="block" height={18} />
            <Skeleton variant="block" height={56} />
          </div>
        } @else if (listPhase.value === "error") {
          <div class="alert" role="alert">
            <p class="alert-text">{failure.value}</p>
            <Button variant="secondary" onClick={boot}>Retry</Button>
          </div>
        } @else if (sectionEmpty.value) {
          <EmptyState message={sectionEmptyCopy.value} />
        } @else if (tab.value === "creations") {
          <CardGrid items={visibleCreations} blurNsfw={blur} label="Creations" />
        } @else if (tab.value === "posts") {
          <ul class="feed" aria-label="Posts">
            @for (const post of posts.value; key post.id) {
              <li>
                <PostCard post={post} people={attachments} blur={blur} />
              </li>
            }
          </ul>
        } @else {
          <ul class="people" aria-label={tab.value}>
            @for (const person of people.value; key person.handle) {
              <li class="person">
                <a class="person-link" href={href(`/user/${person.handle}`)}>
                  <Avatar
                    initials={person.avatar.initials}
                    label={`${person.displayName} avatar`}
                    size={40}
                  />
                  <span class="person-who">
                    <span class="person-name">{person.displayName}</span>
                    <span class="person-handle">{`@${person.handle}`}</span>
                    @if (person.bio) {
                      <span class="person-bio">{person.bio}</span>
                    }
                  </span>
                </a>
              </li>
            }
          </ul>
        }

        @if (listPhase.value === "ready") {
          <div class="pager">
            @if (appendFailure.value) {
              <div class="alert" role="alert">
                <p class="alert-text">{appendFailure.value}</p>
                <Button variant="secondary" onClick={loadMore}>Retry</Button>
              </div>
            } @else if (hasMore.value) {
              <div>
                <Button variant="secondary" block disabled={appending} onClick={loadMore}>
                  {appending.value ? "Loading…" : "Load more"}
                </Button>
              </div>
            }
          </div>
        }
      </>
    }
  </div>
}

export default UserProfile;
