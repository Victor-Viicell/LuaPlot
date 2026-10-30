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
import {
  accountPreferencesSchema,
  accountPreferencesPatchSchema,
  handleSchema,
  normaliseHandle,
  profileWriteSchema,
  seedSchemas,
  userSchema,
  type SeedCollection,
} from "../schema.ts";
import type { z } from "zod";
import { PAGE_SIZE } from "./repo.ts";
import type { Listing, ListOptions, ReportFilter, Repo, SortOrder } from "./repo.ts";
import {
  ratioOf,
  type AccountPreferences,
  type Character,
  type Comment,
  type EntityOf,
  type Handle,
  type ItemKind,
  type Lorebook,
  type Persona,
  type Post,
  type Preset,
  type User,
  type VoteDirection,
  type VotableKind,
} from "./types.ts";

/**
 * The adapter's account, and deliberately still a constant. T-04 made the session readable from a
 * page (`lib/state/session.ts`), but importing it here would make
 * `repo → memory → session → prefs → repo` a module cycle, and RLS-less memory data has no viewer
 * to protect anyway. It matches `MOCK_USER.handle` and every fixture owner, so a profile link and a
 * fixture owner are the same person. Wiring the adapter to the session is T-30's job; until then
 * signing out hides nothing in a listing.
 */
export const VIEWER: Handle = "you";

/**
 * Every collection is derived from its fixture, so the store is exactly what `seedSchemas` says.
 * A mapped type over the schemas — not a second hand-written shape.
 */
type Store = { [K in SeedCollection]: z.infer<(typeof seedSchemas)[K]> };

/**
 * Parse one fixture collection. A bad row **throws here, at module load**, naming the collection,
 * the row index and the failing path — a broken fixture must never ship, and the next session must
 * not have to bisect which collection it was in.
 */
function parseCollection<T>(name: string, schema: z.ZodType<T>, rows: unknown): T {
  const result = schema.safeParse(rows);
  if (result.success) return result.data;

  const issues = result.error.issues.slice(0, 3).map((issue) => {
    const [head, ...rest] = issue.path;
    const row = typeof head === "number" ? `[${head}]` : "";
    const path = [row, rest.join(".")].filter(Boolean).join(" ");
    return `${path || "(row)"}: ${issue.message}`;
  });
  throw new Error(`Fixture "${name}" failed its schema — ${issues.join("; ")}`);
}

/**
 * Deep copy: fixtures are module constants and must survive a page voting on them. A parse is
 * already a fresh object graph, so the clone happens by validating rather than by `structuredClone`.
 */
function load(): Store {
  const store: Store = {
    characters: parseCollection("characters", seedSchemas.characters, seed.characters),
    lorebooks: parseCollection("lorebooks", seedSchemas.lorebooks, seed.lorebooks),
    presets: parseCollection("presets", seedSchemas.presets, seed.presets),
    personas: parseCollection("personas", seedSchemas.personas, seed.personas),
    posts: parseCollection("posts", seedSchemas.posts, seed.posts),
    comments: parseCollection("comments", seedSchemas.comments, seed.comments),
    notifications: parseCollection(
      "notifications",
      seedSchemas.notifications,
      seed.notifications,
    ),
    reports: parseCollection("reports", seedSchemas.reports, seed.reports),
    sessions: parseCollection("sessions", seedSchemas.sessions, seed.sessions),
  };

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

/**
 * Preferences are per **account**, so this is keyed by handle and not by device — the bug the
 * specs call out. An unknown handle answers the new-account defaults: both off.
 */
const preferences = new Map<Handle, AccountPreferences>();
const DEFAULT_PREFERENCES: AccountPreferences = { show: false, blur: false };

/**
 * The viewer's saved profile — the account's handle and display name, written by onboarding.
 *
 * Keyed by the adapter's **account** (`VIEWER`), not by the handle it holds, because the handle is
 * what the account claims here; a Supabase row is keyed by `auth.uid()` for exactly the same
 * reason. `null` means onboarding has written nothing, which is the spec's *first visit*.
 */
let profile: User | null = null;

/**
 * Handles owned by other accounts in the preview. Fixture authors are real people here, so their
 * handles are claimed; without this the preview would happily hand out `ada` and then show two
 * accounts whose URL is `/user/ada`.
 */
const CLAIMED_HANDLES = new Set(
  [
    ...seed.characters.map((row) => row.author),
    ...seed.lorebooks.map((row) => row.author),
    ...seed.presets.map((row) => row.author),
    ...seed.posts.map((row) => row.author),
  ].map(normaliseHandle),
);


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

/** Any-of tag match; an empty selection is `All` (`repo.ts` → `ListOptions.tags`). */
function tagged(tags: string[], wanted: string[] | undefined): boolean {
  if (!wanted || wanted.length === 0) return true;
  return tags.some((tag) => wanted.includes(tag));
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
      (row) =>
        visible(row) &&
        matches([row.name, row.tagline, row.description], options?.query) &&
        tagged(row.tags, options?.tags),
    );
    return pageOf(order(rows, options?.sort, ENGAGED), options);
  },

  async listLorebooks(options) {
    const rows = store.lorebooks.filter(
      (row) =>
        visible(row) &&
        matches([row.name, row.tagline, row.description], options?.query) &&
        tagged(row.tags, options?.tags),
    );
    return pageOf(order(rows, options?.sort, ENGAGED), options);
  },

  async listPresets(options) {
    const rows = store.presets.filter(
      (row) =>
        visible(row) &&
        matches([row.name, row.tagline, row.description], options?.query) &&
        tagged(row.tags, options?.tags),
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

  async listTags(kind) {
    const rows =
      kind === "character" ? store.characters : kind === "lorebook" ? store.lorebooks : store.presets;
    const seen = new Set<string>();
    for (const row of rows) {
      if (!visible(row)) continue;
      for (const tag of row.tags) seen.add(tag);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
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

  async getPreferences(handle) {
    // A copy, so a caller cannot mutate the stored row by holding on to the answer.
    return { ...(preferences.get(handle) ?? DEFAULT_PREFERENCES) };
  },

  async savePreferences(handle, patch) {
    // Both edges are parsed: the handle through the one handle rule, the patch through the pair's
    // schema, and the merged row through `accountPreferencesSchema` before it is stored — so a
    // stored pair cannot differ from a validated one.
    const key = handleSchema.parse(handle);
    const write = accountPreferencesPatchSchema.parse(patch);
    const next = accountPreferencesSchema.parse({
      ...(preferences.get(key) ?? DEFAULT_PREFERENCES),
      ...write,
    });
    preferences.set(key, next);
    return { ...next };
  },

  async currentProfile() {
    // A copy: the caller must not be able to mutate the account by holding on to the answer.
    return profile ? { ...profile } : null;
  },

  async isHandleTaken(handle) {
    const needle = normaliseHandle(handle);
    if (!needle) return false;

    // The viewer's own handles are never "taken" from the viewer: the rule compares accounts, and
    // typing the handle you already hold is a no-op, not a collision. `VIEWER` is the mock
    // account's current handle; `profile.handle` is the one onboarding has drafted or claimed.
    if (needle === normaliseHandle(VIEWER)) return false;
    if (profile && normaliseHandle(profile.handle) === needle) return false;

    return CLAIMED_HANDLES.has(needle);
  },

  async saveProfile(patch) {
    // Both edges are parsed: the form's write through `profileWriteSchema` (which trims, lowercases
    // the handle and collapses the display name) and the row through `userSchema` before it is
    // stored. `isAdmin` is carried over rather than written: only the operator grants it
    // (`luaplot-pages.md`).
    const write = profileWriteSchema.parse(patch);
    const next = userSchema.parse({
      handle: write.handle,
      displayName: write.displayName,
      isAdmin: profile?.isAdmin ?? false,
    });
    profile = next;
    return { ...next };
  },
};
