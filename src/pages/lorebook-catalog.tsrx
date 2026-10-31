import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { CardGrid } from "../components/CardGrid.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Field } from "../components/Field.tsrx";
import { Select } from "../components/Select.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { TagPicker } from "../components/TagPicker.tsrx";
import { Toggle } from "../components/Toggle.tsrx";
import { href, navigate, useQuery } from "../router.ts";
import { PAGE_SIZE, resolveRepo } from "../lib/data/repo.ts";
import type { Lorebook } from "../lib/data/types.ts";
import { currentUser } from "../lib/state/session.ts";
import { nsfwPreference, onPrefs, setBlurNsfw, setShowNsfw } from "../lib/state/prefs.ts";

/**
 * `/lorebook/catalog` — the grid's second host (`src/specs/pages/lorebook/catalog.md`, which says
 * *the same structure as /character/catalog*).
 *
 * Everything the character catalog settled is inherited unchanged — the listing policy, the one
 * fetch path with `(1, "replace")` / `(next, "append")`, the URL-driven query, and the six states.
 * What the lorebook spec adds is a **subtraction**: a card adds *nothing* to the shared structure —
 * no entry count and no keyword list — so a page of lorebooks reads only the lorebook rows and never
 * aggregates its entries. Collecting entries for a catalog would be a join the spec explicitly
 * refuses.
 *
 * The toolbar keeps the tag field: the spec's *All* filter is the empty tag field, and the empty
 * **card** tag row (the taxonomy is undecided) is the card's business, not the toolbar's.
 */

type Phase = "loading" | "ready" | "error";

type SortChoice = "newest" | "ratio";

const SORT_OPTIONS: { value: SortChoice; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "ratio", label: "Top rated" },
];

/** The page's own reading of its URL, taken once at mount. */
function readQuery(): { q: string; sort: SortChoice; tags: string[] } {
  const params = useQuery();
  const tags = (params.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    q: (params.get("q") ?? "").trim(),
    sort: params.get("sort") === "ratio" ? "ratio" : "newest",
    tags,
  };
}

/**
 * Write the listing's state into the URL without telling the router.
 *
 * `navigate()` emits, and `App.tsrx` reloads the page module whenever `path + search` changes — so
 * a debounced search settle would remount the catalog and throw away its accumulated rows. Writing
 * history directly keeps the URL shareable, and a back/forward still lands a remount that reads the
 * query at mount, which is exactly when this page wants to read it.
 */
function writeQuery(
  q: string,
  sort: SortChoice,
  tags: string[],
  mode: "push" | "replace",
): void {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tags.length > 0) params.set("tags", tags.join(","));
  if (sort !== "newest") params.set("sort", sort);

  const search = params.toString();
  const url = `${href("/lorebook/catalog")}${search ? `?${search}` : ""}`;
  if (mode === "replace") window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
}

export function LorebookCatalog() @{
  const repo = resolveRepo();
  const start = readQuery();

  const phase = track<Phase>("loading");
  const failure = track("");
  const items = track<Lorebook[]>([]);
  const hasMore = track(false);
  const nextPage = track(1);
  const appending = track(false);
  const appendFailure = track("");

  /** The input's text, and the settled text the listing was actually fetched for. */
  const draft = track(start.q);
  const applied = track(start.q);
  const sort = track<SortChoice>(start.sort);
  /** The chosen tags — the page's state and the page's URL; the picker only reports them. */
  const tags = track<string[]>(start.tags);
  /** Every tag in use, from the adapter. Empty until the first answer, which just means no menu. */
  const tagOptions = track<string[]>([]);

  /** Mirrors of the account's pair, so a toggle re-renders the grid without a refetch. */
  const show = track(nsfwPreference().show);
  const blur = track(nsfwPreference().blur);
  onPrefs((next) => {
    show.value = next.show;
    blur.value = next.blur;
    fillIfBlank();
  });

  /** Show off wins over Blur: a flagged row is absent, whatever Blur says (`nsfw.md` → States). */
  const visible = track(() => (show.value ? items.value : items.value.filter((row) => !row.nsfw)));
  const filtered = track(() => applied.value.length > 0 || tags.value.length > 0);

  let seq = 0;

  /**
   * Pull one page. `replace` starts over (new query, tags, sort, Retry, first mount); `append` is
   * **Load more**. An answer that arrives after a newer fetch started is dropped.
   */
  function fetchPage(page: number, mode: "replace" | "append"): void {
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

    repo
      .listLorebooks({ query: applied.value, tags: tags.value, sort: sort.value, page })
      .then(
        (listing) => {
          if (mine !== seq) return;

          items.value = mode === "append" ? [...items.value, ...listing.items] : listing.items;
          hasMore.value = listing.hasMore;
          nextPage.value = page + 1;
          appending.value = false;
          phase.value = "ready";

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
          failure.value = "The catalog could not be loaded.";
        },
      );
  }

  /**
   * A fetched slice can be entirely hidden: with Show off, 24 rows may leave nothing to draw while
   * more wait behind them. Pulling the next page is what stops "No results" from lying.
   */
  function fillIfBlank(): void {
    if (appending.value || !hasMore.value) return;
    if (visible.value.length > 0) return;

    fetchPage(nextPage.value, "append");
  }

  /** The tag vocabulary is the adapter's answer, not this page's list. */
  function loadTags(): void {
    repo.listTags("lorebook").then(
      (next) => (tagOptions.value = next),
      () => (tagOptions.value = []),
    );
  }

  let settleTimer: ReturnType<typeof setTimeout> | undefined;

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
    writeQuery(value, sort.value, tags.value, "replace");
    fetchPage(1, "replace");
  }

  function clearFilters(): void {
    draft.value = "";
    applied.value = "";
    tags.value = [];
    writeQuery("", sort.value, [], "replace");
    fetchPage(1, "replace");
  }

  function chooseSort(next: string): void {
    if (next !== "newest" && next !== "ratio") return;
    if (next === sort.value) return;

    sort.value = next;
    // A sort is a discrete choice, so it earns a history entry; keystrokes do not.
    writeQuery(applied.value, next, tags.value, "push");
    fetchPage(1, "replace");
  }

  function chooseTags(next: string[]): void {
    tags.value = next;
    writeQuery(applied.value, sort.value, next, "push");
    fetchPage(1, "replace");
  }

  /** The preference belongs to the account. Signed out there is nowhere to put it (`nsfw.md`). */
  function toggleShow(next: boolean): void {
    if (!currentUser()) {
      navigate("/authentification");
      return;
    }
    setShowNsfw(next);
  }

  function toggleBlur(next: boolean): void {
    if (!currentUser()) {
      navigate("/authentification");
      return;
    }
    setBlurNsfw(next);
  }

  function loadMore(): void {
    if (appending.value || !hasMore.value) return;
    fetchPage(nextPage.value, "append");
  }

  /** The card's title is a real anchor; this intercepts a plain click so navigation stays in-app. */
  function openItem(event: MouseEvent, item: { id: string }): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(`/lorebook/${item.id}`);
  }

  loadTags();
  fetchPage(1, "replace");

  <>
    <style>
      .catalog {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--color-border);
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      /* One line of copy, and only where there is room for it: at 360 the catalog opens on the
         controls instead, because 100px of introduction pushes the first card below the fold. */
      .lede {
        display: none;
        max-width: 52ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      /* Four rows, all full width until `sm`: search, tags, sort, the two switches. Nothing is
         sticky — at 360 the shell's 56px bar plus a sticky toolbar would leave a third of a phone
         for the grid. */
      .toolbar {
        display: grid;
        gap: 10px;
      }

      /* Page-owned wrappers, never `.toolbar .field`: a scoped block cannot reach into a child
         component's elements, so a selector naming a primitive's class silently does nothing. */
      .search,
      .tags,
      .prefs,
      .pager-action {
        grid-column: 1 / -1;
      }

      /* Stacked: the two labels are long enough that a row of them wraps to three lines each. */
      .prefs {
        display: flex;
        flex-direction: column;
        padding-top: 4px;
        border-top: 1px solid var(--color-border);
      }

      /* Skeleton cells: the same grid, the same one/two/three/four columns. */
      .skel-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
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

      .pager {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding-top: 4px;
      }

      .pager-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
        text-align: center;
      }

      @media (min-width: 640px) {
        .head {
          align-items: flex-end;
        }

        .lede {
          display: block;
          font-size: 15px;
        }

        /* The two text fields keep the full width; sort and the switches share the row beneath. */
        .toolbar {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          align-items: end;
          gap: 12px 16px;
        }

        .sort {
          grid-column: 1;
        }

        .prefs {
          flex-direction: row;
          align-items: center;
          gap: 32px;
          grid-column: 2;
          border-top: 0;
        }

        .pager {
          align-items: center;
        }

        .pager-action {
          min-width: 200px;
        }
      }

      @media (min-width: 900px) {
        .toolbar {
          grid-template-columns: minmax(0, 1fr) 220px minmax(0, 1fr);
        }

        .search {
          grid-column: 1 / 3;
        }

        .tags {
          grid-column: 1 / -1;
        }

        .sort {
          grid-column: 2;
        }

        .prefs {
          grid-column: 3;
        }
      }

      @media (min-width: 1200px) {
        .lede {
          max-width: 68ch;
        }
      }
    </style>

    <div class="catalog">
      <header class="head">
        <div>
          <p class="kicker">lorebook catalog</p>
          <p class="lede">
            Everything published, newest first. Search matches a name or a description; the tag field
            narrows to what is tagged with any of the tags you pick.
          </p>
        </div>
        <a
          class="btn btn-secondary"
          href={href("/lorebook/create")}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            navigate("/lorebook/create");
          }}
        >
          New lorebook
        </a>
      </header>

      <div class="toolbar">
        <div class="search">
          <Field
            label="Search"
            type="search"
            name="q"
            value={draft}
            placeholder="Name, description"
            onInput={onSearchInput}
          />
        </div>

        <div class="tags">
          <TagPicker
            label="Tags"
            options={tagOptions}
            selected={tags}
            onChange={chooseTags}
            placeholder="Any tag"
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

        <div class="prefs">
          <Toggle
            label="Show NSFW content"
            hint="Keeps flagged lorebooks in the list."
            pressed={show}
            onToggle={toggleShow}
          />
          <Toggle
            label="Blur NSFW content"
            hint="Keeps them listed but covered."
            pressed={blur}
            onToggle={toggleBlur}
          />
        </div>
      </div>

      @if (phase.value === "loading") {
        <ul class="card-grid" aria-busy="true" aria-label="Loading lorebooks">
          @for (const cell of [0, 1, 2, 3, 4, 5]; key cell) {
            <li class="card-cell">
              <div class="skel-card">
                <Skeleton variant="block" height={18} />
                <Skeleton variant="block" height={64} />
                <Skeleton variant="block" height={14} />
              </div>
            </li>
          }
        </ul>
      } @else if (phase.value === "error") {
        <div class="alert" role="alert">
          <p class="alert-text">{failure.value}</p>
          <Button variant="secondary" onClick={() => fetchPage(1, "replace")}>Retry</Button>
        </div>
      } @else if (visible.value.length === 0 && filtered.value) {
        <EmptyState
          message="Nothing matches those filters."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      } @else if (visible.value.length === 0) {
        <EmptyState
          message="No lorebooks yet."
          actionLabel="Create a lorebook"
          href={href("/lorebook/create")}
        />
      } @else {
        <>
          <CardGrid items={visible} blurNsfw={blur} label="Lorebooks" onOpen={openItem} />

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
            } @else if (items.value.length >= PAGE_SIZE) {
              <p class="pager-note">End of the list.</p>
            }
          </div>
        </>
      }
    </div>
  </>
}

export default LorebookCatalog;
