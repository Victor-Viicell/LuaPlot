import { track } from "ripple";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Field } from "../components/Field.tsrx";
import { PersonaCard } from "../components/PersonaCard.tsrx";
import { Select } from "../components/Select.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, useQuery } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Persona } from "../lib/data/types.ts";
import { currentUser } from "../lib/state/session.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/persona` — the signed-in user's own personas (`src/specs/pages/persona/collection.md`).
 *
 * **This is a collection, not a catalog.** It holds only the viewer's rows, it has no tags, no NSFW
 * pair, no ratio and **no paging**: *the collection is personal and small, so every persona renders in
 * one grid and there is no **Load more** control*. The toolbar is search (name only), sort and
 * **Create** — the page's only entry to `/persona/create` — above one grid of `PersonaCard`s.
 *
 * Decisions recorded in `docs/DESIGN.md` → *Persona collection and detail (T-20)*:
 * - **One adapter call, page 1, and no Load more.** `repo.listPersonas` still slices at 24 like every
 *   listing; the collection asks for the first slice and draws every row it gets. With more than 24
 *   personas the adapter needs an unpaged answer — logged in `docs/NEXT.md` as the gap, not papered
 *   over with a control the spec forbids.
 * - **Search matches the name only**, and the rule lives in the adapter (`listPersonas`), because the
 *   spec says *filters the grid by name* and a page-local widening would be a second truth.
 * - **`Set as default` is on the card** (*Actions* lists it for the collection) and the page patches
 *   the two rows it knows about in place: the one that lost the mark and the one that took it.
 * - **Sort offers Newest, Oldest and Name** — the three orders a persona is meaningful under. `ratio`,
 *   `discussed` and `liked` are absent because a persona has no engagement at all.
 */

type SortChoice = "newest" | "oldest" | "name";
type Phase = "loading" | "ready" | "error";

const SORT_OPTIONS: { value: SortChoice; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name" },
];

/** The page's own reading of its URL, taken once at mount. */
function readQuery(): { q: string; sort: SortChoice } {
  const params = useQuery();
  const sort = params.get("sort");
  return {
    q: (params.get("q") ?? "").trim(),
    sort: sort === "oldest" || sort === "name" ? sort : "newest",
  };
}

/**
 * Write the collection's state into the URL without telling the router — `navigate()` would remount
 * the page and throw away the grid it just fetched (the same reason `preset-catalog` writes history
 * directly).
 */
function writeQuery(q: string, sort: SortChoice, mode: "push" | "replace"): void {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort !== "newest") params.set("sort", sort);

  const search = params.toString();
  const url = `${href("/persona")}${search ? `?${search}` : ""}`;
  if (mode === "replace") window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
}

export function PersonaCollection() @{
  const repo = resolveRepo();
  const start = readQuery();
  const viewer = currentUser();
  const signedIn = viewer !== null;

  const phase = track<Phase>("loading");
  const items = track<Persona[]>([]);
  /** Whether the account holds any persona at all — the empty state differs from "no match". */
  const anyPersona = track(false);
  const busyId = track("");

  const draft = track(start.q);
  const applied = track(start.q);
  const sort = track<SortChoice>(start.sort);

  let seq = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * One call: the collection is unpaged, so there is no append path and no `hasMore`. The answer also
   * settles `anyPersona`, which is what makes the empty prompt and "no results" different states.
   */
  function load(mode: "initial" | "filter"): void {
    const mine = ++seq;
    phase.value = "loading";

    repo.listPersonas({ query: applied.value, sort: sort.value, page: 1 }).then(
      (listing) => {
        if (mine !== seq) return;
        items.value = listing.items;
        phase.value = "ready";

        if (mode === "initial") anyPersona.value = listing.items.length > 0;
        else if (listing.items.length > 0) anyPersona.value = true;
        else if (applied.value === "") anyPersona.value = false;
      },
      () => {
        if (mine !== seq) return;
        phase.value = "error";
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
    writeQuery(value, sort.value, "replace");
    load("filter");
  }

  function chooseSort(next: string): void {
    if (next !== "newest" && next !== "oldest" && next !== "name") return;
    if (next === sort.value) return;

    sort.value = next;
    // A sort is a discrete choice, so it earns a history entry; keystrokes do not.
    writeQuery(applied.value, next, "push");
    load("filter");
  }

  /**
   * **Set as default** — one adapter write; the page then moves the mark on the two rows it knows
   * about (the previous holder and this one) instead of refetching the list it already has.
   */
  async function setDefault(id: string): Promise<void> {
    if (busyId.value !== "") return;
    busyId.value = id;
    const next = await repo.setDefaultPersona(id).catch(() => null);
    busyId.value = "";

    if (!next) {
      toast("That persona couldn't become the default.");
      return;
    }

    items.value = items.value.map((row) =>
      row.isDefault === (row.id === id) ? row : { ...row, isDefault: row.id === id },
    );
  }

  load("initial");

  <div class="personas-page">
    <header class="head">
      <p class="kicker">personas</p>
      <h1 class="title">Your personas</h1>
      <p class="lede">
        The side you speak from in a session. Personal, never shared, never moderated — and only the
        one marked default is used when you do not pick.
      </p>
    </header>

    @if (!signedIn) {
      <EmptyState
        message="Sign in to see your personas."
        actionLabel="Sign in"
        href={href("/authentification")}
      />
    } @else {
      <>
      <div class="toolbar">
        <div class="search">
          <Field
            label="Search"
            type="search"
            name="q"
            value={draft}
            placeholder="Name"
            onInput={onSearchInput}
          />
        </div>
        <div class="sort">
          <Select label="Sort" name="sort" value={sort.value} options={SORT_OPTIONS} onChange={chooseSort} />
        </div>
        <div class="create">
          <a class="btn btn-primary" href={href("/persona/create")}>Create</a>
        </div>
      </div>

      @if (phase.value === "loading") {
        <ul class="card-grid" aria-busy="true" aria-label="Loading personas">
          @for (const cell of [0, 1, 2]; key cell) {
            <li class="card-cell">
              <div class="skel-card">
                <Skeleton variant="block" height={56} />
                <Skeleton variant="block" height={48} />
              </div>
            </li>
          }
        </ul>
      } @else if (phase.value === "error") {
        <EmptyState
          message="Your personas couldn't be loaded."
          actionLabel="Try again"
          onAction={() => load("initial")}
        />
      } @else if (!anyPersona) {
        <EmptyState
          message="You have no personas yet. The first one you save becomes your default."
          actionLabel="Create a persona"
          href={href("/persona/create")}
        />
      } @else if (items.value.length === 0) {
        <p class="no-results" role="status">
          No persona matches that name.{" "}
          <a class="no-results-link" href={href("/persona/create")}>Create one</a> if it is not here yet.
        </p>
      } @else {
        <ul class="card-grid" aria-label="Your personas">
          @for (const row of items.value; key row.id) {
            <li class="card-cell">
              <PersonaCard
                persona={row}
                busy={busyId.value !== ""}
                onSetDefault={(id) => setDefault(id)}
              />
            </li>
          }
        </ul>
      }
      </>
    }

    <style>
      .personas-page {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 6px;
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

      .lede {
        max-width: 58ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      .toolbar {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--color-border);
      }

      .create .btn {
        display: flex;
        width: 100%;
        justify-content: center;
      }

      .no-results {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .no-results-link {
        color: var(--color-accent);
      }

      .skel-card {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
      }

      @media (min-width: 640px) {
        .title {
          font-size: 28px;
        }

        .lede {
          font-size: 15px;
        }

        /* Search keeps the row; sort and Create share the line beneath it. */
        .toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          align-items: end;
          gap: 16px;
        }

        .search {
          grid-column: 1 / span 2;
        }

        .create .btn {
          width: auto;
          min-width: 120px;
        }
      }

      @media (min-width: 900px) {
        /* One line at the widest: search grows, the two controls keep their own widths. */
        .toolbar {
          grid-template-columns: minmax(0, 1fr) 200px auto;
        }

        .search {
          grid-column: 1;
        }
      }
    </style>
  </div>
}

export default PersonaCollection;
