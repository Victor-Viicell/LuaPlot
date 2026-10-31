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
  characterSchema,
  commentSchema,
  commentWriteSchema,
  handleSchema,
  normaliseHandle,
  profileWriteSchema,
  reportOutcomeSchema,
  reportEntrySchema,
  reportSchema,
  reportWriteSchema,
  seedSchemas,
  sessionSchema,
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
  type ReportEntry,
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
  const next: Store = {
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
  recount(next);

  return next;
}

/**
 * Recompute every derived count from the thread.
 *
 * `replyCount` is the **whole branch** beneath a comment at every depth (not just its direct
 * children — the schema says so and the footer reads it as *N replies*), and an item's
 * `commentCount` is its whole thread, placeholders included (`comment-thread.md` → *Counts*).
 *
 * Called at load **and after every write**: a count that only refreshes at load is a count that
 * disagrees with the thread the moment a reply lands, and the page's count strip reads the item's
 * number while the thread draws the rows.
 */
function recount(target: Store): void {
  const children = new Map<string | null, Comment[]>();
  for (const row of target.comments) {
    const bucket = children.get(row.parentId) ?? [];
    bucket.push(row);
    children.set(row.parentId, bucket);
  }

  const sizes = new Map<string, number>();
  const branchSize = (id: string): number => {
    const known = sizes.get(id);
    if (known !== undefined) return known;
    const kids = children.get(id) ?? [];
    const size = kids.reduce((sum, kid) => sum + 1 + branchSize(kid.id), 0);
    sizes.set(id, size);
    return size;
  };

  for (const comment of target.comments) {
    comment.replyCount = branchSize(comment.id);
  }
  for (const item of [...target.characters, ...target.lorebooks, ...target.presets, ...target.posts]) {
    item.commentCount = target.comments.filter((row) => row.itemId === item.id).length;
  }
}

const store = load();

/** `kind:id:viewer` → the vote in force. */
const votes = new Map<string, VoteDirection>();
/** `kind:id:viewer` → saved. A persona has no bookmark, so only shared content is ever a key. */
const bookmarks = new Set<string>();
/**
 * `kind:id:viewer` → **the viewer's own report** on that item, the rule `report.md` calls *one report
 * per user per item*. A `Map` rather than a `Set` because *Already reported* has to show what was
 * filed, and because the page must read its own record without scanning the case list (a case on
 * already-verified content is deliberately never opened, so a scan would miss it).
 */
const myReports = new Map<string, ReportEntry>();

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

/** A row a session creates. `crypto.randomUUID()` is a v4 UUID, which `z.uuid()` accepts. */
function freshId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * What the viewer may attach or start a session from: their own rows and public ones. Another
 * author's private row is neither, and `getCharacter` answers it anyway, so this is a rule the
 * adapter owns rather than one each page re-derives.
 */
function reachable(row: { isPublic: boolean; author: Handle }): boolean {
  return row.isPublic || row.author === VIEWER;
}

/**
 * The preset a session starts with. `character/detail.md` says *the chosen preset*, but no picker
 * exists yet, so the default is the viewer's own most recently updated preset, falling back to the
 * newest public one — the choice a picker will replace, recorded in `docs/DESIGN.md`.
 */
function pickPreset(): Preset | null {
  const mine = store.presets.filter((row) => row.author === VIEWER);
  const pool = mine.length > 0 ? mine : store.presets.filter((row) => row.isPublic);
  return [...pool].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

/** The viewer's default persona, with the first of their own as the fallback; `null` = unattributed. */
function pickPersona(): Persona | null {
  const mine = store.personas.filter((row) => row.owner === VIEWER);
  return mine.find((row) => row.isDefault) ?? mine[0] ?? null;
}

/**
 * **Listings see published rows only.** This is the adapter's stand-in for the RLS policy on a
 * listing: `isPublic` is JEV's lever (*enforcement changes visibility*), so a row that was made
 * private must be absent from a catalog even for its own author — otherwise the catalog would show
 * a private character back to the person who was told it is private.
 *
 * Owner visibility is the **detail page's** rule, not a listing's: `getCharacter` deliberately
 * returns any row by id (the owner and a moderator open it by id), and `character/detail.md` splits
 * *owner sees the notice* from *everyone else sees it unavailable*. T-10 settled this — the earlier
 * "public **or mine**" filter put a privated row back in the public catalog.
 */
function listed(item: { isPublic: boolean }): boolean {
  return item.isPublic;
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
  /** `discussed` — the comment count (T-13). Without it the order falls back to `newest`. */
  comments?: (row: T) => number;
  /** `liked` — the like count (T-13). Without it the order falls back to `newest`. */
  likes?: (row: T) => number;
};

function newestFirst<T>(rows: T[], access: Accessors<T>): T[] {
  return rows.sort((a, b) => access.createdAt(b).localeCompare(access.createdAt(a)));
}

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
      else newestFirst(sorted, access);
      break;
    }
    /** Ties fall to `newest`: a feed of equal counts must still read as a feed. */
    case "discussed": {
      const count = access.comments;
      if (count)
        sorted.sort(
          (a, b) => count(b) - count(a) || access.createdAt(b).localeCompare(access.createdAt(a)),
        );
      else newestFirst(sorted, access);
      break;
    }
    case "liked": {
      const likes = access.likes;
      if (likes)
        sorted.sort(
          (a, b) => likes(b) - likes(a) || access.createdAt(b).localeCompare(access.createdAt(a)),
        );
      else newestFirst(sorted, access);
      break;
    }
    default:
      newestFirst(sorted, access);
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
  comments: (row) => row.commentCount,
  likes: (row) => row.likes,
};

const PERSONA_ACCESS: Accessors<Persona> = {
  createdAt: (row) => row.createdAt,
  name: (row) => row.name,
};

/**
 * Is there an item for a comment thread to live on? Posts have threads too, and a thread dies with
 * its item (`comment-thread.md` → *The thread dies with its item*), so a write naming a missing
 * item is refused rather than parked on no page.
 */
function threadOwner(id: string): boolean {
  return [...store.characters, ...store.lorebooks, ...store.presets, ...store.posts].some(
    (row) => row.id === id,
  );
}

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
        listed(row) &&
        matches([row.name, row.tagline, row.description], options?.query) &&
        tagged(row.tags, options?.tags),
    );
    return pageOf(order(rows, options?.sort, ENGAGED), options);
  },

  async listLorebooks(options) {
    const rows = store.lorebooks.filter(
      (row) =>
        listed(row) &&
        matches([row.name, row.tagline, row.description], options?.query) &&
        tagged(row.tags, options?.tags),
    );
    return pageOf(order(rows, options?.sort, ENGAGED), options);
  },

  async listPresets(options) {
    const rows = store.presets.filter(
      (row) =>
        listed(row) &&
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
      if (!listed(row)) continue;
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

  /**
   * Append a comment or a reply. The write is parsed through `commentWriteSchema` **before** it is
   * stored (the composer's gate is that same schema, `safeParse` at the edge here), the author is
   * the adapter's account — never a page's idea of who is posting — and both counts are recomputed
   * afterwards, so `commentCount` on the page's strip and `replyCount` in each footer agree with
   * the thread the moment it grows.
   *
   * `null` when the item is gone or the parent is not a comment on the same item: a reply can never
   * hang off another thread.
   */
  async addComment(input) {
    const parsed = commentWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const write = parsed.data;
    if (!threadOwner(write.itemId)) return null;

    if (write.parentId !== null) {
      const parent = store.comments.find((row) => row.id === write.parentId) ?? null;
      if (!parent || parent.itemId !== write.itemId) return null;
    }

    const row = commentSchema.parse({
      id: crypto.randomUUID(),
      itemId: write.itemId,
      parentId: write.parentId,
      author: VIEWER,
      body: write.body,
      createdAt: new Date().toISOString(),
      nsfw: write.nsfw,
      likes: 0,
      dislikes: 0,
      replyCount: 0,
      status: "visible",
    });

    store.comments.push(row);
    recount(store);
    return row;
  },

  /**
   * Delete one comment — **author only** (another account's row is refused, which is what RLS will
   * do to the Supabase adapter). The branch survives: the row stays as a `deleted` placeholder with
   * its body gone, its engagement zeroed and its own vote dropped, and every reply beneath it keeps
   * rendering at its depth (`comment-thread.md` → *Deleting a comment keeps its replies*).
   */
  async deleteComment(id) {
    const row = store.comments.find((entry) => entry.id === id) ?? null;
    if (!row || row.author !== VIEWER) return null;
    // Already a placeholder: nothing left to take, and it must stay while replies hang beneath it.
    if (row.status !== "visible") return row;

    row.status = "deleted";
    row.body = "";
    row.likes = 0;
    row.dislikes = 0;
    votes.delete(voteKey("comment", id));
    recount(store);
    return row;
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

  /**
   * File a report. Parsed through `reportWriteSchema` **before** anything is stored (the dialog's
   * gate is the same schema), and the three rules `components/report.md` puts on the write are
   * owned here:
   *
   * - **one report per viewer per item** — `myReports` is keyed `kind:id:viewer`, the shape `votes`
   *   already uses, so a second submit answers `already` with the report on file instead of
   *   appending and inflating weight;
   * - **cumulative cases** — an open case for the target takes the reason, `weight + 1` and a new
   *   `lastReportAt`; without one the write opens a case at weight 1 (weight is the report count,
   *   not the reason count);
   * - **already verified** — the target's own `verified` flag means *a clean scan leaves the report
   *   on file but starts no scan until the content changes*, so the reason is recorded for the
   *   viewer and no case opens. A comment carries no flag, so a comment report always queues.
   */
  async addReport(input) {
    const parsed = reportWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const write = parsed.data;
    const row = rowFor(write.target.kind, write.target.id);
    if (!row) return null;

    const key = voteKey(write.target.kind, write.target.id);
    const onFile = myReports.get(key);
    if (onFile) return reportOutcomeSchema.parse({ state: "already", at: onFile.at });

    const at = nowIso();
    const reason = reportEntrySchema.parse({
      parts: write.parts,
      reasons: write.reasons,
      details: write.details,
      source: write.source,
      at,
    });
    myReports.set(key, reason);

    const verified = "verified" in row && row.verified;
    if (verified) return reportOutcomeSchema.parse({ state: "held", at });

    const open = store.reports.find(
      (entry) =>
        entry.status === "open" &&
        entry.target.kind === write.target.kind &&
        entry.target.id === write.target.id,
    );

    if (open) {
      open.reasons.push(reason);
      open.weight += 1;
      open.lastReportAt = at;
    } else {
      store.reports.push(
        reportSchema.parse({
          id: freshId(),
          target: write.target,
          reasons: [reason],
          weight: 1,
          status: "open",
          /**
           * A case opens *before* a scan: nothing has been judged and nothing has been applied, so
           * the verdict is `unsure` at 0.5 — the schema's own reading of "no idea", not a guess —
           * and `action: none`. The dialog never reads this; `/moderation` does.
           */
          jev: {
            verdict: "unsure",
            confidence: 0.5,
            action: "none",
            note: "Queued for a first scan; the reasons are the reporter's, not a judgment.",
            at,
          },
          createdAt: at,
          lastReportAt: at,
        }),
      );
    }

    return reportOutcomeSchema.parse({ state: "submitted", at });
  },

  async myReport(kind, id) {
    return myReports.get(voteKey(kind, id)) ?? null;
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

  async myVote(kind, id) {
    return votes.get(voteKey(kind, id)) ?? null;
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

  /**
   * Start a session: **copies**, never live items (`session/detail.md`). The character, each
   * attached lorebook the viewer can see, and the preset are snapshotted with `sourceId` kept as
   * the link; `version` starts at 1 and `edited`/`unlinked` at false, so **Restore** is not offered
   * where there is nothing to restore. The persona is a **live reference** and may be absent.
   *
   * It appends rather than replaces, because **New session** starts a fresh one *leaving this
   * session and its copies untouched*; the page's primary control is what keeps a second session
   * from starting by accident, and it asks `findSessionForCharacter` for that.
   */
  async createSession(characterId) {
    const character = store.characters.find((row) => row.id === characterId) ?? null;
    const preset = pickPreset();
    // Another author's private row is not startable: `getCharacter` answers it by id, so the
    // refusal belongs here rather than in a page's if.
    if (!character || !reachable(character) || !preset) return null;

    const persona = pickPersona();
    const at = nowIso();
    const session = sessionSchema.parse({
      id: freshId(),
      owner: VIEWER,
      character: {
        kind: "character",
        sourceId: character.id,
        version: 1,
        edited: false,
        unlinked: false,
        name: character.name,
        ...(character.inSessionName ? { inSessionName: character.inSessionName } : {}),
        description: character.description,
        avatar: character.avatar,
      },
      lorebooks: character.lorebookIds.flatMap((ref) => {
        const book = store.lorebooks.find((row) => row.id === ref);
        if (!book || !reachable(book)) return [];
        return [
          {
            kind: "lorebook" as const,
            sourceId: book.id,
            version: 1,
            edited: false,
            unlinked: false,
            name: book.name,
            description: book.description,
            entries: book.entries,
          },
        ];
      }),
      preset: {
        kind: "preset",
        sourceId: preset.id,
        version: 1,
        edited: false,
        unlinked: false,
        name: preset.name,
        description: preset.description,
        settings: preset.settings,
      },
      ...(persona ? { personaId: persona.id } : {}),
      turns: [],
      createdAt: at,
      updatedAt: at,
    });

    store.sessions.push(session);
    return session;
  },

  /**
   * Fork: a new item, so it takes none of the original's engagement, bookmarks or comments
   * (`luaplot-pages.md`: engagement is per item) and starts unverified, since *any edit clears the
   * cached scan*. `isPublic` is true because `character/create.md` has no draft state — save
   * publishes. Attachments stay **references**, filtered to what the forker can see.
   */
  async forkCharacter(id) {
    const source = store.characters.find((row) => row.id === id) ?? null;
    // A copy of a privated definition would republish exactly what moderation took out of view.
    // `getCharacter` answers any id, so a page cannot be the guard. `forkCharacter` refuses and
    // the page hides the control for the same reason.
    if (!source || !source.isPublic) return null;

    const at = nowIso();
    const fork = characterSchema.parse({
      ...source,
      id: freshId(),
      author: VIEWER,
      lorebookIds: source.lorebookIds.filter((ref) => {
        const book = store.lorebooks.find((row) => row.id === ref);
        return book !== undefined && reachable(book);
      }),
      isPublic: true,
      verified: false,
      likes: 0,
      dislikes: 0,
      bookmarks: 0,
      commentCount: 0,
      createdAt: at,
      updatedAt: at,
    });

    store.characters.push(fork);
    return fork;
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
