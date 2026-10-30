/**
 * The memory adapter: the truth until a Supabase project ref exists.
 *
 * It answers the same `Repo` as the real client will, from `src/lib/fixtures/`, and it owns the
 * three rules that must never live in a page:
 * - **one vote per viewer per item**, and a switch between like and dislike replaces the earlier
 *   vote instead of stacking on it;
 * - **counts are derived**, never authored: `commentCount` and every `replyCount` are recomputed
 *   from the thread on load, so a fixture cannot disagree with its comments;
 * - **listings hide what the viewer may not see**: an item that is not public and is not the
 *   viewer's own is absent, exactly as RLS will make it absent later. A detail lookup still
 *   returns it, because the owner and a moderator open it by id.
 *
 * No artificial latency: a `setTimeout` here would make the preview flicker and would let a page
 * ship a Loading state that never actually renders. Every method is still `async`, so callers
 * `await` from the first day and the swap is not a rewrite.
 */
import { seed } from "../fixtures/index.ts";
import { PAGE_SIZE } from "./repo.ts";
import type { Listing, ListOptions, ReportFilter, Repo, SortOrder } from "./repo.ts";
import {
  ratioOf,
  type Character,
  type Comment,
  type EntityOf,
  type Handle,
  type ItemKind,
  type Lorebook,
  type Notification,
  type Persona,
  type Post,
  type Preset,
  type Report,
  type Session,
  type VoteDirection,
  type VotableKind,
} from "./types.ts";

/**
 * The signed-in account, until T-04 brings real session state. It matches `App.tsrx`'s profile
 * tab handle, so a profile link and a fixture owner are the same person from the first page.
 */
export const VIEWER: Handle = "you";

type Store = {
  characters: Character[];
  lorebooks: Lorebook[];
  presets: Preset[];
  personas: Persona[];
  posts: Post[];
  comments: Comment[];
  notifications: Notification[];
  reports: Report[];
  sessions: Session[];
};

/** Deep copy: fixtures are module constants and must survive a page voting on them. */
function load(): Store {
  const store: Store = structuredClone({
    characters: seed.characters,
    lorebooks: seed.lorebooks,
    presets: seed.presets,
    personas: seed.personas,
    posts: seed.posts,
    comments: seed.comments,
    notifications: seed.notifications,
    reports: seed.reports,
    sessions: seed.sessions,
  });

  // Derived counts. Placeholders count too: the branch beneath them still exists.
  for (const comment of store.comments) {
    comment.replyCount = store.comments.filter((row) => row.parentId === comment.id).length;
  }
  for (const item of [...store.characters, ...store.lorebooks, ...store.presets, ...store.posts]) {
    item.commentCount = store.comments.filter((row) => row.itemId === item.id).length;
  }

  return store;
}

const store = load();

/** `kind:id:viewer` → the vote in force. */
const votes = new Map<string, VoteDirection>();
/** `kind:id:viewer` → saved. A persona has no bookmark, so only shared content is ever a key. */
const bookmarks = new Set<string>();

function voteKey(kind: string, id: string): string {
  return `${kind}:${id}:${VIEWER}`;
}

/** Public, or the viewer's own — the memory adapter's stand-in for an RLS policy. */
function visible<T extends { isPublic: boolean; author: Handle }>(item: T): boolean {
  return item.isPublic || item.author === VIEWER;
}

/** Case-insensitive substring match over the fields a listing can search. */
function matches(haystack: (string | undefined)[], query: string | undefined): boolean {
  const needle = query?.trim().toLowerCase();
  if (!needle) return true;
  return haystack.some((part) => part !== undefined && part.toLowerCase().includes(needle));
}

type Accessors<T> = {
  createdAt: (row: T) => string;
  name: (row: T) => string;
  /** Absent for personas: they carry no engagement, so `ratio` is not a meaningful sort there. */
  ratio?: (row: T) => number;
};

function order<T>(rows: T[], sort: SortOrder = "newest", access: Accessors<T>): T[] {
  const sorted = [...rows];
  switch (sort) {
    case "oldest":
      sorted.sort((a, b) => access.createdAt(a).localeCompare(access.createdAt(b)));
      break;
    case "name":
      sorted.sort((a, b) => access.name(a).localeCompare(access.name(b)));
      break;
    case "ratio": {
      const ratio = access.ratio;
      if (ratio) sorted.sort((a, b) => ratio(b) - ratio(a));
      else sorted.sort((a, b) => access.createdAt(b).localeCompare(access.createdAt(a)));
      break;
    }
    default:
      sorted.sort((a, b) => access.createdAt(b).localeCompare(access.createdAt(a)));
  }
  return sorted;
}

/** Slice one page. `hasMore` is what hides **Load more**; paging lives in component state. */
function pageOf<T>(rows: T[], options: ListOptions | undefined): Listing<T> {
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const start = (page - 1) * PAGE_SIZE;
  const items = rows.slice(start, start + PAGE_SIZE);
  return { items, hasMore: start + items.length < rows.length };
}

const ENGAGED: Accessors<Character | Lorebook | Preset | Post> = {
  createdAt: (row) => row.createdAt,
  name: (row) => ("name" in row ? row.name : row.body),
  ratio: (row) => ratioOf(row),
};

const PERSONA_ACCESS: Accessors<Persona> = {
  createdAt: (row) => row.createdAt,
  name: (row) => row.name,
};

/** The mutable row behind a votable kind, or `null` when it does not exist. */
function rowFor(kind: VotableKind, id: string): Character | Lorebook | Preset | Post | Comment | null {
  switch (kind) {
    case "character":
      return store.characters.find((row) => row.id === id) ?? null;
    case "lorebook":
      return store.lorebooks.find((row) => row.id === id) ?? null;
    case "preset":
      return store.presets.find((row) => row.id === id) ?? null;
    case "post":
      return store.posts.find((row) => row.id === id) ?? null;
    case "comment":
      return store.comments.find((row) => row.id === id) ?? null;
  }
}

/**
 * The same lookup restricted to bookmarked content: a comment is deliberately not bookmarkable
 * (it is already reachable from its parent) and a persona is not shared at all.
 */
function sharedRowFor(
  kind: ItemKind | "post",
  id: string,
): Character | Lorebook | Preset | Post | null {
  const row = rowFor(kind, id);
  return row && "bookmarks" in row ? row : null;
}

export const memoryRepo: Repo = {
  id: "memory",
  viewer: VIEWER,

  async listCharacters(options) {
    const rows = store.characters.filter(
      (row) => visible(row) && matches([row.name, row.tagline, row.description], options?.query),
    );
    return pageOf(order(rows, options?.sort, ENGAGED), options);
  },

  async listLorebooks(options) {
    const rows = store.lorebooks.filter(
      (row) => visible(row) && matches([row.name, row.tagline, row.description], options?.query),
    );
    return pageOf(order(rows, options?.sort, ENGAGED), options);
  },

  async listPresets(options) {
    const rows = store.presets.filter(
      (row) => visible(row) && matches([row.name, row.tagline, row.description], options?.query),
    );
    return pageOf(order(rows, options?.sort, ENGAGED), options);
  },

  async listPosts(options) {
    const rows = store.posts.filter((row) => matches([row.body], options?.query));
    return pageOf(order(rows, options?.sort, ENGAGED), options);
  },

  async listPersonas(options) {
    const rows = store.personas.filter(
      (row) => row.owner === VIEWER && matches([row.name, row.tagline, row.description], options?.query),
    );
    return pageOf(order(rows, options?.sort, PERSONA_ACCESS), options);
  },

  async getCharacter(id) {
    return store.characters.find((row) => row.id === id) ?? null;
  },
  async getLorebook(id) {
    return store.lorebooks.find((row) => row.id === id) ?? null;
  },
  async getPreset(id) {
    return store.presets.find((row) => row.id === id) ?? null;
  },
  async getPersona(id) {
    const row = store.personas.find((entry) => entry.id === id) ?? null;
    // A persona is never addressed across accounts, so another owner's is not found.
    return row && row.owner === VIEWER ? row : null;
  },
  async getPost(id) {
    return store.posts.find((row) => row.id === id) ?? null;
  },
  async getSession(id) {
    const row = store.sessions.find((entry) => entry.id === id) ?? null;
    // Participant only: not-a-participant reads the same as not-found (`session/detail.md`).
    return row && row.owner === VIEWER ? row : null;
  },
  async getReport(id) {
    return store.reports.find((row) => row.id === id) ?? null;
  },

  async listComments(itemId) {
    return store.comments
      .filter((row) => row.itemId === itemId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async listNotifications(options) {
    const rows = [...store.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return pageOf(rows, options);
  },

  async listReports(options) {
    const status: ReportFilter = options?.status ?? "open";
    const rows = store.reports
      .filter((row) => status === "all" || row.status === status)
      .filter((row) => matches([row.target.label], options?.query))
      // Weight never decays: most-reported first, then the newest report.
      .sort((a, b) => b.weight - a.weight || b.lastReportAt.localeCompare(a.lastReportAt));
    return pageOf(rows, options);
  },

  async vote<V extends VotableKind>(
    kind: V,
    id: string,
    direction: VoteDirection,
  ): Promise<EntityOf<V> | null> {
    const row = rowFor(kind, id);
    if (!row) return null;

    const key = voteKey(kind, id);
    const previous = votes.get(key);
    if (previous === direction) return row as EntityOf<V>;

    // Replacing a vote moves one count and leaves the other where it is.
    if (previous === "like") row.likes = Math.max(0, row.likes - 1);
    if (previous === "dislike") row.dislikes = Math.max(0, row.dislikes - 1);
    if (direction === "like") row.likes += 1;
    else row.dislikes += 1;
    votes.set(key, direction);

    return row as EntityOf<V>;
  },

  async isBookmarked(kind, id) {
    return bookmarks.has(voteKey(kind, id));
  },

  async toggleBookmark(kind, id) {
    const item = sharedRowFor(kind, id);
    if (!item) return null;

    const key = voteKey(kind, id);
    const saved = !bookmarks.has(key);
    if (saved) bookmarks.add(key);
    else bookmarks.delete(key);
    item.bookmarks = Math.max(0, item.bookmarks + (saved ? 1 : -1));
    return { bookmarked: saved };
  },

  async findSessionForCharacter(characterId, owner) {
    const rows = store.sessions
      .filter((row) => row.owner === owner && row.character.sourceId === characterId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return rows[0] ?? null;
  },
};
