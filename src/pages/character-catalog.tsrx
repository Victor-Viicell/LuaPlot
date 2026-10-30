import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { CardGrid } from "../components/CardGrid.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Field } from "../components/Field.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { Toggle } from "../components/Toggle.tsrx";
import { href, navigate, useQuery } from "../router.ts";
import { PAGE_SIZE, resolveRepo } from "../lib/data/repo.ts";
import type { Character } from "../lib/data/types.ts";
import { currentUser } from "../lib/state/session.ts";
import { nsfwPreference, onPrefs, setBlurNsfw, setShowNsfw } from "../lib/state/prefs.ts";

/**
 * `/character/catalog` — the first real host of the grid (`src/specs/pages/character/catalog.md`).
 *
 * What this page owns, and what it deliberately does not:
 * - **The listing policy**, not the drawing. Show off removes flagged rows; Blur on keeps them and
 *   `CardGrid` ANDs the account's Blur with each item's own flag. The card never learns the
 *   preference, and the grid never learns the query.
 * - **One fetch path**: `(1, "replace")` for a new query or sort, `(next, "append")` for **Load
 *   more**, and the same call reached from Retry. `seq` drops an answer that lands after a newer one.
 * - **The query string**, written straight through `history`: `docs/DESIGN.md` → *Catalog* records
 *   why `navigate()` is not used for the search settle.
 * - **Six states**, all rendered: loading (a skeleton shaped like the grid), empty, no-results,
 *   loading more (the button reports it), end of list (no control), error.
 *
 * The filter is `All` and nothing else because the tag taxonomy is undecided: it renders as a
 * pressed chip that says so, and the reserved `filter=all` parameter is kept in the URL so a shared
 * link keeps meaning what it meant.
 */

type Phase = "loading" | "ready" | "error";

type SortChoice = "newest" | "ratio";

/** The page's own reading of its URL, taken once at mount. */
function readQuery(): { q: string; sort: SortChoice } {
  const params = useQuery();
  return {
    q: (params.get("q") ?? "").trim(),
    sort: params.get("sort") === "ratio" ? "ratio" : "newest",
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
function writeQuery(q: string, sort: SortChoice, mode: "push" | "replace"): void {
  const params = new URLSearchParams();
  // Reserved until tags exist (`luaplot-pages.md` → Conventions), but kept in the URL.
  params.set("filter", "all");
  if (q) params.set("q", q);
  if (sort !== "newest") params.set("sort", sort);

  const url = `${href("/character/catalog")}?${params.toString()}`;
  if (mode === "replace") window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
}

export function CharacterCatalog() @{
  const repo = resolveRepo();
  const start = readQuery();

  const phase = track<Phase>("loading");
  const failure = track("");
  const items = track<Character[]>([]);
  const hasMore = track(false);
  const nextPage = track(1);
  const appending = track(false);
  const appendFailure = track("");

  /** The input's text, and the settled text the listing was actually fetched for. */
  const draft = track(start.q);
  const applied = track(start.q);
  const sort = track<SortChoice>(start.sort);

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
  const searching = track(() => applied.value.length > 0);

  let seq = 0;

  /**
   * Pull one page. `replace` starts over (new query, new sort, Retry, first mount); `append` is
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

    repo.listCharacters({ query: applied.value, sort: sort.value, page }).then(
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
    writeQuery(value, sort.value, "replace");
    fetchPage(1, "replace");
  }

  function clearSearch(): void {
    draft.value = "";
    applySearch("");
  }

  function chooseSort(next: SortChoice): void {
    if (next === sort.value) return;

    sort.value = next;
    // A sort is a discrete choice, so it earns a history entry; keystrokes do not.
    writeQuery(applied.value, next, "push");
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
    navigate(`/character/${item.id}`);
  }

  fetchPage(1, "replace");

  <>
    <style>
      .catalog {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 16px;
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

      /* Not sticky on purpose: at 360 the shell's 56px bar plus a stacked toolbar would leave the
         grid a third of the screen. Search takes the full width; filter and sort share the line
         beneath it; the account switches close the block. */
      .toolbar {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 12px;
      }

      .toolbar .field {
        grid-column: 1 / -1;
      }

      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        height: 32px;
        padding: 0 10px;
        border: 1px solid var(--color-accent);
        border-radius: 2px;
        color: var(--color-accent);
        font-size: 12px;
        letter-spacing: 0.04em;
        line-height: 1;
        text-transform: uppercase;
      }

      .controls-filter {
        grid-column: 1;
      }

      .controls-sort {
        grid-column: 2;
        justify-self: end;
      }

      .filter-note {
        display: none;
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.5;
      }

      /* Sort — a two-option segmented control. A <select> would be a second control language for
         one row; the segmented pair keeps the app's "one of these" gesture at 44px. */
      .seg {
        display: inline-flex;
        overflow: hidden;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
      }

      .seg-btn {
        min-height: 44px;
        padding: 0 12px;
        border: 0;
        background: transparent;
        color: var(--color-text-muted);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
        transition:
          background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
          color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .seg-btn + .seg-btn {
        border-left: 1px solid var(--color-border-strong);
      }

      .seg-btn[aria-pressed="true"] {
        background-color: var(--color-accent);
        color: var(--color-accent-contrast);
      }

      .seg-btn:hover:not([aria-pressed="true"]) {
        background-color: var(--color-surface);
        color: var(--color-text);
      }

      .prefs {
        display: flex;
        flex-direction: column;
        grid-column: 1 / -1;
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

        /* From `sm` the three controls sit on one line — search, filter, sort — and the two
           account switches move beneath them. Stacking four rows at 900 leaves the grid half a
           screen down for no gain. */
        .toolbar {
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: end;
          gap: 12px 16px;
        }

        .toolbar .field {
          grid-column: 1;
        }

        .controls-filter {
          grid-column: 2;
        }

        /* Scoped, so it cannot lose to the base rule on order. */
        .controls-filter .filter-note {
          display: block;
        }

        .controls-sort {
          grid-column: 3;
        }

        .prefs {
          flex-direction: row;
          align-items: center;
          gap: 32px;
          grid-column: 1 / -1;
        }

        .prefs .toggle {
          width: auto;
        }

        .pager {
          align-items: center;
        }

        .pager .btn {
          min-width: 200px;
        }
      }

      @media (min-width: 1200px) {
        .toolbar {
          gap: 16px;
        }

        .lede {
          max-width: 68ch;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .seg-btn {
          transition: none;
        }
      }
    </style>

    <div class="catalog">
      <header class="head">
        <div>
          <p class="kicker">character catalog</p>
          <p class="lede">
            Everything published, newest first. Search matches a name, a tagline, or a description;
            the two switches below decide how flagged characters reach this list.
          </p>
        </div>
        <a
          class="btn btn-secondary"
          href={href("/character/create")}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            navigate("/character/create");
          }}
        >
          New character
        </a>
      </header>

      <div class="toolbar">
        <Field
          label="Search"
          type="search"
          name="q"
          value={draft}
          placeholder="Name, tagline, description"
          onInput={onSearchInput}
        />

        <div class="controls controls-filter">
          <span class="chip">{`All`}</span>
          <p class="filter-note">Tags are undecided, so All is the only filter.</p>
        </div>

        <div class="controls controls-sort">
          <div class="seg" role="group" aria-label="Sort">
            <button
              type="button"
              class="seg-btn"
              aria-pressed={sort.value === "newest" ? "true" : "false"}
              onClick={() => chooseSort("newest")}
            >
              Newest
            </button>
            <button
              type="button"
              class="seg-btn"
              aria-pressed={sort.value === "ratio" ? "true" : "false"}
              onClick={() => chooseSort("ratio")}
            >
              Top rated
            </button>
          </div>
        </div>

        <div class="prefs">
          <Toggle
            label="Show NSFW content"
            hint="Keeps flagged characters in the list."
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
        <ul class="card-grid" aria-busy="true" aria-label="Loading characters">
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
      } @else if (visible.value.length === 0 && searching.value) {
        <EmptyState
          message={`Nothing matches “${applied.value}”.`}
          actionLabel="Clear search"
          onAction={clearSearch}
        />
      } @else if (visible.value.length === 0) {
        <EmptyState
          message="No characters yet."
          actionLabel="Create a character"
          href={href("/character/create")}
        />
      } @else {
        <>
          <CardGrid items={visible} blurNsfw={blur} label="Characters" onOpen={openItem} />

          <div class="pager">
            @if (appendFailure.value) {
              <div class="alert" role="alert">
                <p class="alert-text">{appendFailure.value}</p>
                <Button variant="secondary" onClick={loadMore}>Retry</Button>
              </div>
            } @else if (hasMore.value) {
              <Button variant="secondary" block disabled={appending} onClick={loadMore}>
                {appending.value ? "Loading…" : "Load more"}
              </Button>
            } @else if (items.value.length >= PAGE_SIZE) {
              <p class="pager-note">End of the list.</p>
            }
          </div>
        </>
      }
    </div>
  </>
}

export default CharacterCatalog;
