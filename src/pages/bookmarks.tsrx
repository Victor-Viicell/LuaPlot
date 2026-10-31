import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { Card } from "../components/Card.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Field } from "../components/Field.tsrx";
import { PostCard } from "../components/PostCard.tsrx";
import { Select } from "../components/Select.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { Tabs } from "../components/Tabs.tsrx";
import { href, useQuery } from "../router.ts";
import { PAGE_SIZE, resolveRepo, type SortOrder } from "../lib/data/repo.ts";
import type {
  AuthoredItem,
  BookmarkCounts,
  BookmarkKind,
  BookmarkRow,
  Character,
  Post,
} from "../lib/data/types.ts";
import { bookmarkKindSchema } from "../lib/schema.ts";
import { currentUser } from "../lib/state/session.ts";
import { nsfwPreference, onPrefs } from "../lib/state/prefs.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/bookmarks` — the signed-in user's saved items, one catalog per type
 * (`src/specs/pages/bookmarks.md`).
 *
 * What this page owns:
 * - **Four tabs, counts from the adapter.** *The type is the tab, never a filter*, and the count is
 *   **saved rows, not visible rows** — with Show off a tab may read 3 and draw 1, which is correct.
 *   The strip is `components/Tabs.tsrx`, extended with counts; the page owns the query string.
 * - **The default tab**: the kind holding the most recently saved item (`latestBookmarkKind`), and
 *   Characters when nothing is saved at all — the spec's own list order (`docs/DESIGN.md` →
 *   *Bookmarks*).
 * - **The dead card.** A saved row whose item is gone still draws its type's card box, reads the
 *   type's not-exist sentence in the title slot, links nowhere and **still carries Remove bookmark**.
 *   That is the one thing this page exists to guarantee, so removal goes through
 *   `repo.removeBookmark` (key-only), never `toggleBookmark`, which refuses a missing row.
 * - **URL state**: `?type=&q=&sort=` written straight through `history` — `navigate()` would remount
 *   the page and drop the rows it just fetched (the rule `character-catalog` records in DESIGN).
 *   The NSFW pair is deliberately **not** here: it belongs to the account.
 * - **Six states**, all drawn: loading, empty (*Nothing saved here yet.*), no results, a tab entirely
 *   hidden by the NSFW preference, end of list, error.
 *
 * The remove control is a **page-owned wrapper** (`.saved-card` in `src/styles.css`), not a `Card`
 * prop: the card's footer is author + ratio, and a footer slot would have to be threaded through
 * four drawings to say the same thing. On a covered card the control sits outside the blurred veil,
 * so it stays crisp exactly as Reveal does.
 */

type SortChoice = "recent" | "oldest" | "name";
type Phase = "loading" | "ready" | "error";

const TABS: { value: BookmarkKind; label: string }[] = [
  { value: "character", label: "Characters" },
  { value: "lorebook", label: "Lorebooks" },
  { value: "preset", label: "Presets" },
  { value: "post", label: "Posts" },
];

/** Newest saved first is the spec's default, so it is the first option and the fallback. */
const SORT_OPTIONS: { value: SortChoice; label: string }[] = [
  { value: "recent", label: "Newest saved" },
  { value: "oldest", label: "Oldest saved" },
  { value: "name", label: "Title A–Z" },
];

/** The type's own not-exist sentence (`luaplot-pages.md`: not-found is reported per type). */
const MISSING: Record<BookmarkKind, string> = {
  character: "This character doesn't exist.",
  lorebook: "This lorebook doesn't exist.",
  preset: "This preset doesn't exist.",
  post: "This post doesn't exist anymore.",
};

/**
 * One cell of the grid. Built once, **outside the template**, because ripple loses a discriminated
 * union inside a block (PostCard's own comment): the narrowing from `row.kind` happens in
 * `cellOf()`, and the template only ever reads a cell that already knows what it is.
 */
type Cell = { key: string; kind: BookmarkKind; id: string } & (
  | { mode: "item"; item: AuthoredItem; nsfw: boolean }
  | { mode: "post"; post: Post; nsfw: boolean }
  | { mode: "gone"; title: string }
);

function cellOf(row: BookmarkRow): Cell {
  const base = { key: `${row.kind}:${row.id}`, kind: row.kind, id: row.id };

  if (row.kind === "post") {
    return row.item
      ? { ...base, mode: "post", post: row.item, nsfw: row.item.nsfw }
      : { ...base, mode: "gone", title: MISSING.post };
  }

  return row.item
    ? { ...base, mode: "item", item: row.item, nsfw: row.item.nsfw }
    : { ...base, mode: "gone", title: MISSING[row.kind] };
}

/** The page's own reading of its URL, taken once at mount. */
function readQuery(): { type: BookmarkKind | null; q: string; sort: SortChoice } {
  const params = useQuery();

  const rawType = params.get("type");
  const parsedType = rawType === null ? null : bookmarkKindSchema.safeParse(rawType);
  const rawSort = params.get("sort");

  return {
    // Parsed, not trusted: an unknown `?type=` falls back to the default tab, never a fifth tab.
    type: parsedType?.success ? parsedType.data : null,
    q: (params.get("q") ?? "").trim(),
    sort: rawSort === "oldest" || rawSort === "name" ? rawSort : "recent",
  };
}

/** The page's sort vocabulary → the adapter's. `recent` is the adapter's `newest`. */
function adapterSort(sort: SortChoice): SortOrder {
  if (sort === "oldest") return "oldest";
  if (sort === "name") return "name";
  return "newest";
}

/** Write the tab state into the URL without telling the router (see the page's header comment). */
function writeQuery(type: BookmarkKind, q: string, sort: SortChoice, mode: "push" | "replace"): void {
  const params = new URLSearchParams();
  params.set("type", type);
  if (q) params.set("q", q);
  if (sort !== "recent") params.set("sort", sort);

  const url = `${href("/bookmarks")}?${params.toString()}`;
  if (mode === "replace") window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
}

export function Bookmarks() @{
  const repo = resolveRepo();
  const start = readQuery();
  const signedIn = currentUser() !== null;

  const phase = track<Phase>("loading");
  const failure = track("");
  const counts = track<BookmarkCounts>({ character: 0, lorebook: 0, preset: 0, post: 0 });
  const items = track<BookmarkRow[]>([]);
  const hasMore = track(false);
  const nextPage = track(1);
  const appending = track(false);
  const appendFailure = track("");
  const busy = track(false);

  const tab = track<BookmarkKind>(start.type ?? "character");
  const draft = track(start.q);
  const applied = track(start.q);
  const sort = track<SortChoice>(start.sort);

  /** Mirrors of the account's pair, exactly as the catalog does: the grid repaints, no refetch. */
  const show = track(nsfwPreference().show);
  const blur = track(nsfwPreference().blur);
  onPrefs((next) => {
    show.value = next.show;
    blur.value = next.blur;
  });

  /** Attachment characters for saved posts, resolved once per distinct id (the thread's rule). */
  const people = track<Record<string, Character>>({});

  const cells = track(() => items.value.map(cellOf));
  /** Show off removes a flagged row; Blur keeps it and covers it (`Card`/`PostCard` own that). */
  const visible = track(() =>
    show.value ? cells.value : cells.value.filter((cell) => cell.mode === "gone" || !cell.nsfw),
  );

  let seq = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  /** One `getCharacter` per distinct attachment id, never twice for a row already known. */
  function resolvePeople(rows: Cell[]): void {
    const wanted = new Set<string>();
    for (const cell of rows) {
      if (cell.mode !== "post") continue;
      const attachment = cell.post.attachment;
      if (attachment?.kind === "character" && !people.value[attachment.characterId]) {
        wanted.add(attachment.characterId);
      }
    }
    if (wanted.size === 0) return;

    Promise.all([...wanted].map((id) => repo.getCharacter(id))).then(
      (found) => {
        const next = { ...people.value };
        for (const row of found) if (row) next[row.id] = row;
        people.value = next;
      },
      () => {
        // A missing attachment character is not a listing failure: the card draws no attachment,
        // which is what a post whose character was removed looks like.
      },
    );
  }

  /**
   * Pull one tab's page. `replace` starts over (new tab, query, sort, Retry, first mount); `append`
   * is **Load more**. An answer that lands after a newer fetch started is dropped.
   */
  function load(page: number, mode: "replace" | "append"): void {
    const mine = ++seq;
    appendFailure.value = "";

    if (mode === "replace") {
      phase.value = "loading";
      failure.value = "";
      items.value = [];
      hasMore.value = false;
      nextPage.value = 1;
    } else {
      appending.value = true;
    }

    repo.listBookmarks(tab.value, { query: applied.value, sort: adapterSort(sort.value), page }).then(
      (listing) => {
        if (mine !== seq) return;

        items.value = mode === "append" ? [...items.value, ...listing.items] : listing.items;
        hasMore.value = listing.hasMore;
        nextPage.value = page + 1;
        appending.value = false;
        phase.value = "ready";

        resolvePeople(cells.value);
      },
      () => {
        if (mine !== seq) return;
        appending.value = false;

        if (mode === "append") {
          appendFailure.value = "The next page didn't load.";
          return;
        }

        phase.value = "error";
        failure.value = "Your bookmarks couldn't be loaded.";
      },
    );
  }

  /**
   * First read: the counts and the tab to open on, then that tab's first page. Both come from the
   * adapter, so the page never guesses a count from the slice it is about to fetch.
   */
  function boot(): void {
    const mine = ++seq;

    Promise.all([repo.bookmarkCounts(), repo.latestBookmarkKind()]).then(
      ([nextCounts, latest]) => {
        if (mine !== seq) return;
        counts.value = nextCounts;

        // A `?type=` in the URL wins; otherwise the most recently saved kind, else Characters.
        if (start.type === null) tab.value = latest ?? "character";
        writeQuery(tab.value, applied.value, sort.value, "replace");
        load(1, "replace");
      },
      () => {
        if (mine !== seq) return;
        phase.value = "error";
        failure.value = "Your bookmarks couldn't be loaded.";
      },
    );
  }

  /** 250ms settle, never a request per keystroke (`docs/CONTRACT.md` → Engineering law). */
  function onSearchInput(next: string): void {
    draft.value = next;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => applySearch(next), 250);
  }

  function applySearch(next: string): void {
    const value = next.trim();
    if (value === applied.value) return;

    applied.value = value;
    writeQuery(tab.value, value, sort.value, "replace");
    load(1, "replace");
  }

  function chooseSort(next: string): void {
    if (next !== "recent" && next !== "oldest" && next !== "name") return;
    if (next === sort.value) return;

    sort.value = next;
    // A sort is a discrete choice, so it earns a history entry; keystrokes do not.
    writeQuery(tab.value, applied.value, next, "push");
    load(1, "replace");
  }

  function chooseTab(next: string): void {
    const parsed = bookmarkKindSchema.safeParse(next);
    if (!parsed.success || parsed.data === tab.value) return;

    tab.value = parsed.data;
    writeQuery(parsed.data, applied.value, sort.value, "push");
    load(1, "replace");
  }

  function clearSearch(): void {
    draft.value = "";
    applied.value = "";
    writeQuery(tab.value, "", sort.value, "replace");
    load(1, "replace");
  }

  function loadMore(): void {
    if (appending.value || !hasMore.value) return;
    load(nextPage.value, "append");
  }

  /**
   * **Remove bookmark** — from the card, on a live item or a dead one. `removeBookmark` works on the
   * saved key alone, so the dead card is removable; the row leaves the grid, the tab count drops by
   * one, and a page emptied that way pulls the next one rather than pretending the tab is finished.
   * No success toast: the card disappearing is the feedback, and bookmarks are silent.
   */
  async function remove(cell: Cell): Promise<void> {
    if (busy.value) return;
    busy.value = true;

    const removed = await repo.removeBookmark(cell.kind, cell.id).catch(() => false);
    busy.value = false;

    if (!removed) {
      toast("That bookmark couldn't be removed.");
      return;
    }

    items.value = items.value.filter((row) => !(row.kind === cell.kind && row.id === cell.id));
    counts.value = { ...counts.value, [cell.kind]: Math.max(0, counts.value[cell.kind] - 1) };

    if (items.value.length === 0 && hasMore.value) load(nextPage.value, "append");
  }

  if (signedIn) boot();

  <>
    <style>
      .bookmarks {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        color: var(--color-text);
        font-size: 24px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      /* One line, and only where there is room: at 360 the strip and the toolbar are the page. */
      .lede {
        display: none;
        max-width: 56ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      /* Three rows at 360: search, sort, the filter note with the count. */
      .toolbar {
        display: grid;
        gap: 10px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--color-border);
      }

      .search,
      .sort,
      .meta {
        grid-column: 1 / -1;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 6px 16px;
      }

      .filter-note,
      .saved-count {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .saved-count {
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
      }

      .skel-card {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      .pager {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .pager-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
        text-align: center;
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

      @media (min-width: 640px) {
        .title {
          font-size: 28px;
        }

        .lede {
          display: block;
          font-size: 15px;
        }

        .toolbar {
          grid-template-columns: minmax(0, 1fr) 220px;
          align-items: end;
          gap: 12px 16px;
        }

        .search {
          grid-column: 1 / -1;
        }

        .pager {
          align-items: center;
        }

        .pager > div {
          min-width: 200px;
        }
      }

      @media (min-width: 900px) {
        /* One line: search grows, sort keeps its width, the note and count sit beside it. */
        .toolbar {
          grid-template-columns: minmax(0, 1fr) 200px auto;
        }

        .search {
          grid-column: 1;
        }

        .meta {
          grid-column: 3;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
      }
    </style>

    <div class="bookmarks">
      <header class="head">
        <p class="kicker">bookmarks</p>
        <h1 class="title">Saved</h1>
        <p class="lede">
          One catalog per type, so a saved character is found the way a character is found anywhere
          else. Private to you: nothing here appears on a profile, and it notifies no one.
        </p>
      </header>

      @if (!signedIn) {
        <EmptyState
          message="Sign in to see what you have saved."
          actionLabel="Sign in"
          href={href("/authentification")}
        />
      } @else {
        <>
          <Tabs items={TABS} value={tab} counts={counts} label="Saved types" onChange={chooseTab} />

          <div class="toolbar">
            <div class="search">
              <Field
                label="Search"
                type="search"
                name="q"
                value={draft}
                placeholder="Your saved items"
                onInput={onSearchInput}
              />
            </div>

            <div class="sort">
              <Select
                label="Sort"
                name="sort"
                value={sort.value}
                options={SORT_OPTIONS}
                onChange={chooseSort}
              />
            </div>

            <div class="meta">
              <p class="filter-note">Filter: All — the tag taxonomy is still undecided.</p>
              <p class="saved-count">{`${counts.value[tab.value]} saved`}</p>
            </div>
          </div>

          @if (phase.value === "loading") {
            <ul class="card-grid" aria-busy="true" aria-label="Loading bookmarks">
              @for (const cell of [0, 1, 2, 3]; key cell) {
                <li class="card-cell">
                  <div class="skel-card">
                    <Skeleton variant="block" height={18} />
                    <Skeleton variant="block" height={56} />
                    <Skeleton variant="block" height={14} />
                  </div>
                </li>
              }
            </ul>
          } @else if (phase.value === "error") {
            <div class="alert" role="alert">
              <p class="alert-text">{failure.value}</p>
              <Button variant="secondary" onClick={boot}>Retry</Button>
            </div>
          } @else if (visible.value.length === 0 && applied.value) {
            <EmptyState
              message="Nothing matches that search."
              actionLabel="Clear search"
              onAction={clearSearch}
            />
          } @else if (visible.value.length === 0 && counts.value[tab.value] > 0) {
            <EmptyState
              message="Everything saved here is hidden by your NSFW preference."
              actionLabel="Account settings"
              href={href("/onboarding")}
            />
          } @else if (visible.value.length === 0) {
            <EmptyState message="Nothing saved here yet." />
          } @else {
            <>
              <ul class="card-grid" aria-label={`Saved ${tab.value}s`}>
                @for (const cell of visible.value; key cell.key) {
                  <li class="card-cell">
                    <div class="saved-card">
                      @if (cell.mode === "gone") {
                        <article class="card is-missing">
                          <div class="card-head">
                            <p class="card-title">{cell.title}</p>
                          </div>
                          <div class="card-middle">
                            <p class="card-missing-note">
                              Deleted by its author or removed by moderation. The item is gone; the
                              bookmark is not.
                            </p>
                          </div>
                        </article>
                      } @else if (cell.mode === "post") {
                        <PostCard post={cell.post} people={people} blur={blur} />
                      } @else {
                        <Card item={cell.item} nsfw={cell.nsfw} blur={blur} />
                      }
                      <div class="saved-card-remove">
                        <Button
                          variant="ghost"
                          disabled={busy}
                          label={`Remove bookmark on this ${cell.kind}`}
                          onClick={() => remove(cell)}
                        >
                          Remove bookmark
                        </Button>
                      </div>
                    </div>
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
                  <div>
                    <Button variant="secondary" block disabled={appending} onClick={loadMore}>
                      {appending.value ? "Loading…" : "Load more"}
                    </Button>
                  </div>
                } @else if (items.value.length >= PAGE_SIZE) {
                  <p class="pager-note">End of the list.</p>
                }
              </div>
            </>
          }
        </>
      }
    </div>
  </>
}

export default Bookmarks;
