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
  characterWriteSchema,
  commentSchema,
  commentWriteSchema,
  handleSchema,
  lorebookEntrySchema,
  lorebookSchema,
  lorebookWriteSchema,
  normaliseHandle,
  profileWriteSchema,
  reportOutcomeSchema,
  reportEntrySchema,
  postSchema,
  postWriteSchema,
  presetSchema,
  presetWriteSchema,
  reportSchema,
  reportWriteSchema,
  seedSchemas,
  sessionSchema,
  turnWriteSchema,
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
  type Session,
  type SessionCopy,
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
 * May the viewer attach this lorebook by id? `character/create.md` → *Data*: **the author's own
 * lorebooks and any public lorebook authored by someone else.** One function, because the adapter's
 * write check and the page's **Add by ID** resolution must not be two opinions.
 */
function attachableBook(id: string): Lorebook | null {
  const book = store.lorebooks.find((row) => row.id === id) ?? null;
  if (!book) return null;
  return book.author === VIEWER || book.isPublic ? book : null;
}

/**
 * The write's `lorebookIds`, or `null` when one of them may not be attached.
 *
 * `already` is the row's own current list: an attachment that no longer resolves stays allowed on
 * the row it is already on (*an attachment that no longer resolves stays listed as unavailable*), so
 * re-saving an edit cannot erase data the author never removed.
 */
function checkedLorebookIds(ids: string[], already: readonly string[]): string[] | null {
  for (const id of ids) {
    if (already.includes(id)) continue;
    if (!attachableBook(id)) return null;
  }
  return ids;
}

/**
 * The entries a write stores, in the author's order, with the **adapter's** labels: `entry-1`,
 * `entry-2` … (`lorebook/detail.md`: an entry id is a short label, not an entity id). The form hands
 * `{keywords, content}` rows and never an id, so two blocks cannot collide and a fork cannot inherit
 * a duplicate. Each row is parsed through `lorebookEntrySchema` before it is stored.
 */
function numberEntries(
  rows: { keywords: string[]; content: string }[],
): z.infer<typeof lorebookEntrySchema>[] {
  return rows.map((row, index) =>
    lorebookEntrySchema.parse({ id: `entry-${index + 1}`, keywords: row.keywords, content: row.content }),
  );
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
 * A copy rebuilt from its original **as it stands now** — the body of both **Update from original**
 * and **Restore**. Returns `null` when the link no longer resolves (the item is gone, or it is
 * another author's private row), which is the *unlinked* state: the copy keeps running and the row
 * loses its actions (`session/detail.md` → *States*).
 *
 * `version` comes from the copy being replaced, so the caller decides whether the write moves it
 * forward (update) or keeps it (restore), and no page computes a version number.
 */
function copyFromOriginal(
  kind: SessionCopy["kind"],
  sourceId: string,
  session: Session,
): SessionCopy | null {
  const previous =
    kind === "character"
      ? session.character
      : kind === "lorebook"
        ? session.lorebooks.find((row) => row.sourceId === sourceId)
        : session.preset;
  if (!previous || previous.sourceId !== sourceId) return null;

  const base = { sourceId, version: previous.version, edited: false, unlinked: false } as const;

  if (kind === "character") {
    const item = store.characters.find((row) => row.id === sourceId) ?? null;
    if (!item || !reachable(item)) return null;
    return {
      ...base,
      kind: "character",
      name: item.name,
      ...(item.inSessionName ? { inSessionName: item.inSessionName } : {}),
      description: item.description,
      avatar: item.avatar,
    };
  }

  if (kind === "lorebook") {
    const item = store.lorebooks.find((row) => row.id === sourceId) ?? null;
    if (!item || !reachable(item)) return null;
    return {
      ...base,
      kind: "lorebook",
      name: item.name,
      description: item.description,
      entries: item.entries,
    };
  }

  const item = store.presets.find((row) => row.id === sourceId) ?? null;
  if (!item || !reachable(item)) return null;
  return {
    ...base,
    kind: "preset",
    name: item.name,
    description: item.description,
    settings: item.settings,
  };
}

/**
 * A spent link: the original is gone, or it is another author's private row, so the copy loses the
 * link and **nothing else** (`session/detail.md` → *The link*). The copy keeps running, the row drops
 * its link actions, and the session is still usable — that is why an action whose original vanished
 * answers the session instead of `null`.
 */
function markUnlinked(
  session: Session,
  kind: SessionCopy["kind"],
  sourceId: string,
): Session | null {
  const next = sessionSchema.parse({
    ...session,
    character:
      kind === "character" && session.character.sourceId === sourceId
        ? { ...session.character, unlinked: true }
        : session.character,
    lorebooks: session.lorebooks.map((row) =>
      kind === "lorebook" && row.sourceId === sourceId ? { ...row, unlinked: true } : row,
    ),
    preset:
      kind === "preset" && session.preset.sourceId === sourceId
        ? { ...session.preset, unlinked: true }
        : session.preset,
    updatedAt: nowIso(),
  });

  Object.assign(session, next);
  return next;
}

/**
 * Replace one copy in place and re-parse the session, so the stored row is exactly what
 * `sessionSchema` says — a copy is a write, and a write goes through its schema
 * (`docs/ARCHITECTURE.md` → *Validation*).
 */
function commitCopy(
  session: Session,
  copy: SessionCopy,
  patch: { edited: boolean; version: number },
): Session {
  const next = { ...copy, version: patch.version, edited: patch.edited };

  const merged = sessionSchema.parse({
    ...session,
    character: copy.kind === "character" ? next : session.character,
    lorebooks: session.lorebooks.map((row) =>
      copy.kind === "lorebook" && row.sourceId === copy.sourceId ? { ...copy, ...patch } : row,
    ),
    preset: copy.kind === "preset" ? next : session.preset,
    updatedAt: nowIso(),
  });

  Object.assign(session, merged);
  return merged;
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

  /**
   * Publish a post. Parsed through `postWriteSchema` **before** anything is stored, so the composer's
   * gate and the row are the same rule, and the **attachment is checked against ownership here** —
   * the picker filters to the viewer's own characters, but a picker cannot be the only guard
   * (`luaplot-pages.md`: *the attachment is always the author's own*).
   *
   * A new post is unscanned: `verified: false`, zero engagement. A cut is text with no id, so it has
   * no owner to verify — the composer stamps it from the viewer's own session.
   */
  async addPost(input) {
    const parsed = postWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const write = parsed.data;
    const attachment = write.attachment;
    if (attachment?.kind === "character") {
      const person = store.characters.find((row) => row.id === attachment.characterId) ?? null;
      if (!person || person.author !== VIEWER) return null;
    }

    const row = postSchema.parse({
      id: freshId(),
      author: VIEWER,
      body: write.body,
      createdAt: nowIso(),
      nsfw: write.nsfw,
      attachment: write.attachment,
      verified: false,
      likes: 0,
      dislikes: 0,
      bookmarks: 0,
      commentCount: 0,
    });

    store.posts.push(row);
    recount(store);
    return row;
  },

  /**
   * Delete a post and, in cascade, its whole thread — **author only**. The comments are removed from
   * the store rather than left as placeholders: a placeholder keeps a branch alive because its
   * replies still exist, and here there is no parent page left to draw them on. Every dropped
   * comment's vote goes with it, and the post's own vote too.
   */
  async deletePost(id) {
    const index = store.posts.findIndex((row) => row.id === id);
    if (index < 0) return false;
    if (store.posts[index].author !== VIEWER) return false;

    store.posts.splice(index, 1);

    for (const row of store.comments) {
      if (row.itemId === id) votes.delete(voteKey("comment", row.id));
    }
    store.comments = store.comments.filter((row) => row.itemId !== id);
    votes.delete(voteKey("post", id));

    recount(store);
    return true;
  },

  /**
   * **Save** on `/character/create`. `characterWriteSchema` is parsed here before anything is stored,
   * and every attachment is checked against the same `attachableBook` rule the **Add by ID** control
   * resolves through, so a hand-built write cannot attach what the picker would have refused.
   *
   * A new character is published (`isPublic: true` — *save publishes, there is no draft state*) and
   * unscanned (`verified: false`); engagement starts at zero. `tagline` and `tags` stay empty: the
   * create form names no tagline field and the tag taxonomy is undecided, so the row is honest about
   * what the author actually wrote.
   */
  async addCharacter(input) {
    const parsed = characterWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const write = parsed.data;
    const lorebookIds = checkedLorebookIds(write.lorebookIds, []);
    if (!lorebookIds) return null;

    const at = nowIso();
    const row = characterSchema.parse({
      kind: "character",
      id: freshId(),
      name: write.name,
      inSessionName: write.inSessionName,
      author: VIEWER,
      tagline: "",
      description: write.description,
      nsfw: write.nsfw,
      avatar: write.avatar,
      lorebookIds,
      isPublic: true,
      verified: false,
      tags: [],
      likes: 0,
      dislikes: 0,
      bookmarks: 0,
      commentCount: 0,
      createdAt: at,
      updatedAt: at,
    });

    store.characters.push(row);
    recount(store);
    return row;
  },

  /**
   * **Save** on `/character/[id]/edit` — author only. Everything the author does not own on the row
   * is kept (`id`, `author`, `createdAt`, engagement, `isPublic`); the fields the write names are
   * replaced, `updatedAt` moves and `verified` clears, because any edit invalidates the cached scan.
   */
  async updateCharacter(id, input) {
    const row = store.characters.find((entry) => entry.id === id) ?? null;
    if (!row || row.author !== VIEWER) return null;

    const parsed = characterWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const write = parsed.data;
    const lorebookIds = checkedLorebookIds(write.lorebookIds, row.lorebookIds);
    if (!lorebookIds) return null;

    const next = characterSchema.parse({
      ...row,
      name: write.name,
      inSessionName: write.inSessionName,
      description: write.description,
      nsfw: write.nsfw,
      avatar: write.avatar,
      lorebookIds,
      verified: false,
      updatedAt: nowIso(),
    });

    store.characters.splice(store.characters.indexOf(row), 1, next);
    recount(store);
    return next;
  },

  /**
   * **Delete** — author only, immediate, with the character's whole comment thread and the votes and
   * bookmarks on it (`edit.md`: *the character row and its comment thread go in cascade*). The
   * lorebooks it referenced are untouched: an attachment is a reference, not a copy.
   */
  async deleteCharacter(id) {
    const index = store.characters.findIndex((row) => row.id === id);
    if (index < 0) return false;
    if (store.characters[index].author !== VIEWER) return false;

    store.characters.splice(index, 1);

    const kept: Comment[] = [];
    for (const row of store.comments) {
      if (row.itemId !== id) {
        kept.push(row);
        continue;
      }
      votes.delete(voteKey("comment", row.id));
      bookmarks.delete(voteKey("comment", row.id));
    }
    store.comments = kept;
    votes.delete(voteKey("character", id));
    bookmarks.delete(voteKey("character", id));

    recount(store);
    return true;
  },

  /**
   * **Save** on `/lorebook/create` (`lorebook/create.md`). `lorebookWriteSchema` is parsed here before
   * anything is stored, so the form's gate and the stored row are one rule, exactly as
   * `addCharacter` does it.
   *
   * The adapter owns every entry's id: `entry-1`, `entry-2` … in the order the author left them, so
   * the form cannot invent a collision and a fork cannot inherit a duplicate label. A new lorebook
   * is published and unscanned; `tagline` and `tags` stay empty because the create form names
   * neither.
   */
  async addLorebook(input) {
    const parsed = lorebookWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const write = parsed.data;
    const at = nowIso();
    const row = lorebookSchema.parse({
      kind: "lorebook",
      id: freshId(),
      name: write.name,
      author: VIEWER,
      tagline: "",
      description: write.description,
      nsfw: write.nsfw,
      avatar: write.avatar,
      entries: numberEntries(write.entries),
      isPublic: true,
      verified: false,
      tags: [],
      likes: 0,
      dislikes: 0,
      bookmarks: 0,
      commentCount: 0,
      createdAt: at,
      updatedAt: at,
    });

    store.lorebooks.push(row);
    recount(store);
    return row;
  },

  /**
   * **Save** on `/lorebook/[id]/edit` — author only. Everything the author does not write on the row
   * is kept (`id`, `author`, `createdAt`, engagement, `isPublic`); the entries are replaced wholesale
   * and renumbered, `updatedAt` moves and `verified` clears.
   */
  async updateLorebook(id, input) {
    const row = store.lorebooks.find((entry) => entry.id === id) ?? null;
    if (!row || row.author !== VIEWER) return null;

    const parsed = lorebookWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const write = parsed.data;
    const next = lorebookSchema.parse({
      ...row,
      name: write.name,
      description: write.description,
      nsfw: write.nsfw,
      avatar: write.avatar,
      entries: numberEntries(write.entries),
      verified: false,
      updatedAt: nowIso(),
    });

    store.lorebooks.splice(store.lorebooks.indexOf(row), 1, next);
    recount(store);
    return next;
  },

  /**
   * **Delete** — author only, immediate, with the entries and the whole comment thread. It reaches
   * no further: a character's `lorebookIds` keeps the id (the attachment degrades to *unavailable*
   * on its own page) and a session keeps the copy it started from.
   */
  async deleteLorebook(id) {
    const index = store.lorebooks.findIndex((row) => row.id === id);
    if (index < 0) return false;
    if (store.lorebooks[index].author !== VIEWER) return false;

    store.lorebooks.splice(index, 1);

    const kept: Comment[] = [];
    for (const row of store.comments) {
      if (row.itemId !== id) {
        kept.push(row);
        continue;
      }
      votes.delete(voteKey("comment", row.id));
      bookmarks.delete(voteKey("comment", row.id));
    }
    store.comments = kept;
    votes.delete(voteKey("lorebook", id));
    bookmarks.delete(voteKey("lorebook", id));

    recount(store);
    return true;
  },

  /**
   * Fork: a new lorebook owned by the viewer, every entry copied as it stands and renumbered. A new
   * item takes none of the original's engagement, bookmarks or comments, and starts unverified.
   * Private rows are refused: a copy would republish what moderation removed.
   */
  async forkLorebook(id) {
    const source = store.lorebooks.find((row) => row.id === id) ?? null;
    if (!source || !source.isPublic) return null;

    const at = nowIso();
    const fork = lorebookSchema.parse({
      ...source,
      id: freshId(),
      author: VIEWER,
      entries: numberEntries(
        source.entries.map((entry) => ({ keywords: entry.keywords, content: entry.content })),
      ),
      isPublic: true,
      verified: false,
      likes: 0,
      dislikes: 0,
      bookmarks: 0,
      commentCount: 0,
      createdAt: at,
      updatedAt: at,
    });

    store.lorebooks.push(fork);
    return fork;
  },

  /**
   * The preset picker's four writes copy the lorebook four exactly: the adapter owns the id, the
   * author, the clock and the empty engagement, and `settings` is stored as written because a preset
   * has no entries and no derived field.
   */
  async addPreset(input) {
    const parsed = presetWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const write = parsed.data;
    const at = nowIso();
    const row = presetSchema.parse({
      kind: "preset",
      id: freshId(),
      name: write.name,
      author: VIEWER,
      tagline: "",
      description: write.description,
      nsfw: write.nsfw,
      avatar: write.avatar,
      settings: write.settings,
      isPublic: true,
      verified: false,
      tags: [],
      likes: 0,
      dislikes: 0,
      bookmarks: 0,
      commentCount: 0,
      createdAt: at,
      updatedAt: at,
    });

    store.presets.push(row);
    recount(store);
    return row;
  },

  async updatePreset(id, input) {
    const row = store.presets.find((entry) => entry.id === id) ?? null;
    if (!row || row.author !== VIEWER) return null;

    const parsed = presetWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const write = parsed.data;
    const next = presetSchema.parse({
      ...row,
      name: write.name,
      description: write.description,
      nsfw: write.nsfw,
      avatar: write.avatar,
      settings: write.settings,
      verified: false,
      updatedAt: nowIso(),
    });

    store.presets.splice(store.presets.indexOf(row), 1, next);
    recount(store);
    return next;
  },

  async deletePreset(id) {
    const index = store.presets.findIndex((row) => row.id === id);
    if (index < 0) return false;
    if (store.presets[index].author !== VIEWER) return false;

    store.presets.splice(index, 1);

    const kept: Comment[] = [];
    for (const row of store.comments) {
      if (row.itemId !== id) {
        kept.push(row);
        continue;
      }
      votes.delete(voteKey("comment", row.id));
      bookmarks.delete(voteKey("comment", row.id));
    }
    store.comments = kept;
    votes.delete(voteKey("preset", id));
    bookmarks.delete(voteKey("preset", id));

    recount(store);
    return true;
  },

  /**
   * Fork: every setting as it now stands, the NSFW flag included — `detail.md` is explicit that a
   * copy starts from all of the values rather than from a diff. Private rows are refused, because a
   * copy would republish what moderation removed.
   */
  async forkPreset(id) {
    const source = store.presets.find((row) => row.id === id) ?? null;
    if (!source || !source.isPublic) return null;

    const at = nowIso();
    const fork = presetSchema.parse({
      ...source,
      id: freshId(),
      author: VIEWER,
      settings: { ...source.settings },
      isPublic: true,
      verified: false,
      likes: 0,
      dislikes: 0,
      bookmarks: 0,
      commentCount: 0,
      createdAt: at,
      updatedAt: at,
    });

    store.presets.push(fork);
    return fork;
  },

  /**
   * The picker's list: the viewer's own lorebooks (private included) plus the ones they bookmarked
   * from other authors, by name. The by-ID control is wider — any public lorebook — and that split is
   * the spec's, not a simplification.
   */
  async listAttachableLorebooks() {
    const rows = store.lorebooks.filter(
      (row) =>
        reachable(row) &&
        (row.author === VIEWER || bookmarks.has(voteKey("lorebook", row.id))),
    );
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  },

  async attachableLorebook(id) {
    return attachableBook(id);
  },

  async listMySessions() {
    return store.sessions
      .filter((row) => row.owner === VIEWER)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  /**
   * Send message: one appended user turn. `turnWriteSchema` trims and refuses an empty message, so
   * the page's gate and the stored turn are the same sentence. The role is the adapter's, the id is
   * fresh, and the time is now — the transcript keeps no persona record, so nothing else is written
   * (`session/detail.md` → *Data* → *The transcript*).
   */
  async appendTurn(id, input) {
    const row = store.sessions.find((entry) => entry.id === id) ?? null;
    if (!row || row.owner !== VIEWER) return null;

    const parsed = turnWriteSchema.safeParse(input);
    if (!parsed.success) return null;

    const at = nowIso();
    const next = sessionSchema.parse({
      ...row,
      turns: [
        ...row.turns,
        { id: freshId(), role: "user", text: parsed.data.text, at },
      ],
      updatedAt: at,
    });

    Object.assign(row, next);
    return next;
  },

  /**
   * The model's side of the same transcript. Same shape, same `turnWriteSchema` trim, same adapter
   * clock — only the role differs, and the role is not the page's to choose (`lib/llm/chat.ts` hands
   * this method text and nothing else).
   */
  async appendReply(id, text) {
    const row = store.sessions.find((entry) => entry.id === id) ?? null;
    if (!row || row.owner !== VIEWER) return null;

    const parsed = turnWriteSchema.safeParse({ text });
    if (!parsed.success) return null;

    const at = nowIso();
    const next = sessionSchema.parse({
      ...row,
      turns: [
        ...row.turns,
        { id: freshId(), role: "character", text: parsed.data.text, at },
      ],
      updatedAt: at,
    });

    Object.assign(row, next);
    return next;
  },

  /**
   * Delete a session — participant only — with its transcript and copies. Published cuts survive:
   * a cut is a post, stamped as text at publish time, so there is nothing to cascade into.
   */
  async deleteSession(id) {
    const index = store.sessions.findIndex((row) => row.id === id);
    if (index < 0) return false;
    if (store.sessions[index].owner !== VIEWER) return false;
    store.sessions.splice(index, 1);
    return true;
  },

  /**
   * Update from original, per participant. The copy is rebuilt from the item **as it stands now**,
   * which is what makes the action overwrite the session's edits (`session/detail.md`: *It
   * overwrites the session's own edits to that copy*), so the page confirms before calling here.
   * `version` moves forward and `edited` clears. `null` when the link no longer resolves: the copy
   * keeps running, so a spent link is not an error.
   */
  async updateCopyFromOriginal(sessionId, kind, sourceId) {
    const session = store.sessions.find((entry) => entry.id === sessionId) ?? null;
    if (!session || session.owner !== VIEWER) return null;

    const replacement = copyFromOriginal(kind, sourceId, session);
    if (!replacement) return markUnlinked(session, kind, sourceId);

    return commitCopy(session, replacement, { edited: false, version: replacement.version + 1 });
  },

  /**
   * Restore: the copy goes back to the version it was taken from and the session's edits are
   * discarded. The memory adapter has no version history, so it re-reads the original as it stands
   * and keeps the copy's own `version` — recorded in `docs/DESIGN.md` → *Session*.
   */
  async restoreCopy(sessionId, kind, sourceId) {
    const session = store.sessions.find((entry) => entry.id === sessionId) ?? null;
    if (!session || session.owner !== VIEWER) return null;

    const replacement = copyFromOriginal(kind, sourceId, session);
    if (!replacement) return markUnlinked(session, kind, sourceId);

    return commitCopy(session, replacement, { edited: false, version: replacement.version });
  },

  /**
   * Switch persona: one field, and the transcript is untouched — the turns carry no persona record,
   * so a cut takes the attribution chosen at publish time (`session/detail.md` → *Data*). Another
   * account's persona is refused rather than attached; `null` detaches.
   */
  async setSessionPersona(id, personaId) {
    const row = store.sessions.find((entry) => entry.id === id) ?? null;
    if (!row || row.owner !== VIEWER) return null;

    if (personaId !== null) {
      const persona = store.personas.find((entry) => entry.id === personaId) ?? null;
      if (!persona || persona.owner !== VIEWER) return null;
    }

    const { personaId: _previous, ...rest } = row;
    const next = sessionSchema.parse({
      ...rest,
      ...(personaId === null ? {} : { personaId }),
      updatedAt: nowIso(),
    });

    Object.assign(row, next);
    return next;
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
  async createSession(characterId, personaId) {
    const character = store.characters.find((row) => row.id === characterId) ?? null;
    const preset = pickPreset();
    // Another author's private row is not startable: `getCharacter` answers it by id, so the
    // refusal belongs here rather than in a page's if.
    if (!character || !reachable(character) || !preset) return null;

    // **New session** carries the session's current persona (`session/detail.md`). An id that is not
    // the viewer's own is ignored rather than attached: a persona is never shared.
    const carried = personaId ? store.personas.find((row) => row.id === personaId) : null;
    const persona = carried && carried.owner === VIEWER ? carried : pickPersona();
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
