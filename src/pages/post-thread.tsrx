import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { NsfwControl } from "../components/NsfwControl.tsrx";
import { PostCard } from "../components/PostCard.tsrx";
import { Select } from "../components/Select.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { commitQuery, href, navigate, useQuery } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Character, Post } from "../lib/data/types.ts";
import { nsfwPreference, onPrefs } from "../lib/state/prefs.ts";

/**
 * `/post/thread` — the public timeline (`src/specs/pages/post/thread.md`).
 *
 * What this page owns, and what it deliberately does not:
 * - **The listing policy.** With Show off, flagged posts are **absent** from the feed — not blurred
 *   (`systems/nsfw.md`); Blur is a separate, independent preference that covers a post once it is
 *   listed. Show on + Blur on is legal and means "listed, covered". A fetched slice can be entirely
 *   hidden, so `fillIfBlank` pulls the next page rather than let an empty feed lie.
 * - **The sort, in the query string** (`?sort=`), like the catalog's: `newest` is the default and is
 *   written out of the URL, a choice is a history entry, and Load more never touches the URL.
 * - **One fetch path** — `(1, "replace")` for a sort change or Retry, `(next, "append")` for **Load
 *   more**. `seq` drops a late answer.
 * - **Attachment resolution**, once per listing answer and not per card: a card that fetched its own
 *   attachment would be an N+1 the Supabase adapter would inherit.
 *
 * The filter is `All` **and only `All`**: `repo.listTags("post")` answers `[]` because the taxonomy
 * has not decided what a post is tagged with, and a `Select` with one option is a control that cannot
 * do anything. A non-interactive chip says the same thing without pretending (`DESIGN.md` → *Thread*).
 */

type Phase = "loading" | "ready" | "error";

type SortChoice = "newest" | "discussed" | "liked";

const SORT_OPTIONS: { value: SortChoice; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "discussed", label: "Most discussed" },
  { value: "liked", label: "Most liked" },
];

function readSort(params: URLSearchParams): SortChoice {
  const value = params.get("sort");
  return value === "discussed" || value === "liked" ? value : "newest";
}

/**
 * Write the sort into the URL through `commitQuery()` (T-66) — a remount would lose the loaded rows,
 * and a raw write left the router's mounted key on the pre-sort location.
 */
function writeSort(sort: SortChoice, mode: "push" | "replace"): void {
  commitQuery(sort === "newest" ? "" : `sort=${sort}`, mode);
}

export function PostThread() @{
  const repo = resolveRepo();

  const phase = track<Phase>("loading");
  const failure = track("");
  const items = track<Post[]>([]);
  const hasMore = track(false);
  const nextPage = track(1);
  const appending = track(false);
  const appendFailure = track("");
  const sort = track<SortChoice>(readSort(useQuery()));

  /** Attachment characters by id, filled once per listing answer. */
  const people = track<Record<string, Character>>({});

  const show = track(nsfwPreference().show);
  const blur = track(nsfwPreference().blur);
  onPrefs((next) => {
    show.value = next.show;
    blur.value = next.blur;
    fillIfBlank();
  });

  /** Show off wins over Blur: a flagged post is absent from the feed, not covered. */
  const visible = track(() => (show.value ? items.value : items.value.filter((row) => !row.nsfw)));

  /**
   * Which fetch this is. It rides in each row's key, so a refetch remounts the cards and every
   * reveal is forgotten (`nsfw.md` → *A reveal lasts one view*); **Load more** leaves it alone.
   */
  const epoch = track(0);
  const feed = track(() =>
    visible.value.map((post) => ({ key: `${post.id}#${epoch.value}`, post })),
  );

  let seq = 0;

  function fetchPage(page: number, mode: "replace" | "append"): void {
    const mine = ++seq;
    appendFailure.value = "";

    if (mode === "replace") {
      phase.value = "loading";
      failure.value = "";
      items.value = [];
      hasMore.value = false;
      nextPage.value = 1;
      epoch.value += 1;
    } else {
      appending.value = true;
    }

    repo.listPosts({ sort: sort.value, page }).then(
      (listing) => {
        if (mine !== seq) return;

        items.value = mode === "append" ? [...items.value, ...listing.items] : listing.items;
        hasMore.value = listing.hasMore;
        nextPage.value = page + 1;
        appending.value = false;
        phase.value = "ready";

        resolvePeople(listing.items, mine);
        fillIfBlank();
      },
      () => {
        if (mine !== seq) return;
        appending.value = false;

        if (mode === "append") {
          appendFailure.value = "The next page didn't load.";
          return;
        }

        phase.value = "error";
        failure.value = "The thread could not be loaded.";
      },
    );
  }

  /** One `getCharacter` per distinct attachment id, and never twice for a row already known. */
  function resolvePeople(rows: Post[], mine: number): void {
    const wanted = new Set<string>();
    for (const row of rows) {
      const attachment = row.attachment;
      if (attachment?.kind === "character" && !people.value[attachment.characterId]) {
        wanted.add(attachment.characterId);
      }
    }
    if (wanted.size === 0) return;

    Promise.all([...wanted].map((id) => repo.getCharacter(id))).then(
      (found) => {
        if (mine !== seq) return;
        const next = { ...people.value };
        for (const row of found) if (row) next[row.id] = row;
        people.value = next;
      },
      () => {
        // A missing attachment character is not a listing failure: the card simply draws no
        // attachment, which is what a post whose character was removed by moderation looks like.
      },
    );
  }

  /** A fetched slice can be entirely hidden: pull the next page rather than draw an empty feed. */
  function fillIfBlank(): void {
    if (appending.value || !hasMore.value) return;
    if (visible.value.length > 0) return;
    fetchPage(nextPage.value, "append");
  }

  function chooseSort(next: string): void {
    if (next !== "newest" && next !== "discussed" && next !== "liked") return;
    if (next === sort.value) return;

    sort.value = next;
    writeSort(next, "push");
    fetchPage(1, "replace");
  }

  function loadMore(): void {
    if (appending.value || !hasMore.value) return;
    fetchPage(nextPage.value, "append");
  }

  function openCreate(event: MouseEvent): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate("/post/create");
  }

  fetchPage(1, "replace");

  <>
    <style>
      .thread {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .kicker {
        margin: 0 0 2px;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }


      /* Three rows on a phone: sort, then the filter chip beside Create, then the two switches. A
         single row cannot hold a labelled select, a chip, two switches and a button in 328px, and an
         `auto` column sized by a long caption starves its neighbours (T-09's search box). */
      .controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--color-border);
      }

      .sort {
        grid-column: 1 / -1;
      }

      .filter {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .filter-label {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1;
        text-transform: uppercase;
      }

      /* Not a control: `All` is the only filter the taxonomy allows, so it is drawn, not operated. */
      .filter-chip {
        padding: 7px 10px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        color: var(--color-text);
        font-size: 13px;
        line-height: 1;
      }

      .prefs {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .create {
        justify-self: end;
      }

      .alert {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        padding: 16px 0;
      }

      .alert-text {
        margin: 0;
        color: var(--color-danger);
        font-size: 14px;
        line-height: 1.6;
      }

      .feed {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .pager {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .pager-action {
        width: 100%;
      }

      .pager-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
        text-align: center;
      }

      .skel-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      @media (min-width: 640px) {

        /* One row from `sm`: sort keeps a column, the chip and the switches take the middle, the
           button ends the row. */
        .controls {
          grid-template-columns: 200px minmax(0, 1fr) auto;
          align-items: end;
          gap: 24px;
        }

        .sort {
          grid-column: 1;
        }

        .prefs {
          grid-column: 2;
          flex-direction: row;
          align-items: center;
          gap: 24px;
          justify-self: start;
        }

        .create {
          grid-column: 3;
        }

        .feed {
          gap: 16px;
        }

        .pager-action {
          width: auto;
          min-width: 200px;
          margin: 0 auto;
        }
      }


      /* Under `md` the four-across row squeezed both switches to 115px. Two rows instead: sort and
         Create on top, the pair across the width beneath. */
      @media (min-width: 640px) and (max-width: 899px) {
        .prefs {
          grid-column: 1 / -1;
          grid-row: 2;
        }

        .create {
          grid-row: 1;
        }
      }

      @media (min-width: 900px) {
        .controls {
          grid-template-columns: 220px auto minmax(0, 1fr) auto;
        }

      }
    </style>

    <div class="thread">
      <header class="head">
        <p class="kicker">thread</p>
      </header>

      <div class="controls">
        <div class="sort">
          <Select
            label="Sort"
            name="sort"
            value={sort}
            options={SORT_OPTIONS}
            onChange={chooseSort}
          />
        </div>

        <div class="prefs">
          <NsfwControl noun="posts" />
        </div>

        <div class="create">
          <a class="btn btn-primary" href={href("/post/create")} onClick={openCreate}>Create</a>
        </div>
      </div>

      @if (phase.value === "loading") {
        <ul class="feed" aria-busy="true" aria-label="Loading posts">
          @for (const cell of [0, 1, 2]; key cell) {
            <li class="skel-card">
              <Skeleton variant="block" height={14} />
              <Skeleton variant="block" height={64} />
              <Skeleton variant="block" height={12} />
            </li>
          }
        </ul>
      } @else if (phase.value === "error") {
        <div class="alert" role="alert">
          <p class="alert-text">{failure.value}</p>
          <Button variant="secondary" onClick={() => fetchPage(1, "replace")}>Retry</Button>
        </div>
      } @else if (visible.value.length === 0) {
        <EmptyState
          message="No posts yet."
          actionLabel="Write the first one"
          to="/post/create"
        />
      } @else {
        <>
          <ul class="feed" aria-label="Posts">
            @for (const cell of feed.value; key cell.key) {
              <li>
                <PostCard post={cell.post} people={people} blur={blur} />
              </li>
            }
          </ul>

          <div class="pager">
            @if (appendFailure.value) {
              <div class="alert" role="alert">
                <p class="alert-text">{appendFailure.value}</p>
                <Button variant="secondary" onClick={loadMore}>Retry</Button>
              </div>
            } @else if (hasMore.value) {
              <div class="pager-action">
                <Button variant="secondary" block disabled={appending} onClick={loadMore}>
                  {appending.value ? "Loading…" : "Load more"}
                </Button>
              </div>
            } @else {
              <p class="pager-note">End of feed.</p>
            }
          </div>
        </>
      }
    </div>
  </>
}

export default PostThread;
