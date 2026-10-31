/**
 * The data seam. The only surface a page calls.
 *
 * Two implementations are planned (`docs/ARCHITECTURE.md`): `memory.ts` now, `supabase.ts` when a
 * project ref exists. Every method is `async` even in memory, so the swap is a new file rather
 * than a rewrite of every caller. Nothing here calls `fetch`.
 *
 * Shape, decided in T-03 and recorded in ARCHITECTURE:
 * - listings take `{ query?, sort?, page }` and return `{ items, hasMore }`, 24 per page;
 * - a lookup returns the entity or `null` — a missing item is a *not-found state*, not an error;
 * - a mutation returns the updated entity, so the caller never re-reads to show the new counts.
 * The error envelope lands with the adapter that can actually fail (Supabase); inventing one now
 * would make every page pay for a transport it does not have.
 */
import type {
  AccountPreferences,
  Character,
  Comment,
  CommentWrite,
  EntityOf,
  Handle,
  ItemKind,
  Lorebook,
  Notification,
  Persona,
  Post,
  PostWrite,
  Preset,
  Report,
  ReportOutcome,
  ReportEntry,
  ReportStatus,
  ReportTarget,
  ReportWrite,
  Session,
  User,
  VoteDirection,
  VotableKind,
} from "./types.ts";
import { memoryRepo } from "./memory.ts";

/** One page of a listing — the spec's explicit **Load more** step. */
export const PAGE_SIZE = 24;

/**
 * `newest` sorts on `createdAt` descending; `ratio` on the derived ratio, high first; `discussed` and
 * `liked` are the thread's two engagement orders (T-13) — comment count and likes, both high first,
 * with `createdAt` as the tie-break so a zero-engagement feed is still reverse-chronological. They are
 * declared on the shared union so every listing names a real order, but only a listing whose adapter
 * accessors carry the counts can honour them; the rest fall back to `newest`.
 */
export type SortOrder = "newest" | "oldest" | "ratio" | "name" | "discussed" | "liked";

export type ListOptions = {
  /** Matched against the title/name and the tagline, case-insensitive. Debounced by the page. */
  query?: string;
  /**
   * Tags the row must carry at least one of (`character/catalog.md`): the filter is a multi-select
   * of the tags in use, and an empty list means `All`. Any-of rather than all-of, because two tags
   * on a card are often alternatives in a reader's mind, and an all-of filter empties a small
   * catalog on the second click.
   */
  tags?: string[];
  /** Defaults to `newest`. */
  sort?: SortOrder;
  /** 1-based, held in component state — never in the URL (paging is not part of the URL). */
  page?: number;
};

export type Listing<T> = { items: T[]; hasMore: boolean };

export type ReportFilter = ReportStatus | "all";

export type Repo = {
  /** Which adapter answered — the `/dev/data` badge, never a product surface. */
  readonly id: "memory" | "supabase";
  /** The signed-in handle the adapter is answering for. */
  readonly viewer: Handle;

  listCharacters(options?: ListOptions): Promise<Listing<Character>>;
  listLorebooks(options?: ListOptions): Promise<Listing<Lorebook>>;
  listPresets(options?: ListOptions): Promise<Listing<Preset>>;
  listPosts(options?: ListOptions): Promise<Listing<Post>>;
  /** The persona collection is personal and unpaged in the spec; it still pages at 24. */
  listPersonas(options?: ListOptions): Promise<Listing<Persona>>;

  /**
   * Every tag in use on the given kind, sorted, so a listing's tag filter offers what exists rather
   * than an invented taxonomy (`luaplot-pages.md` → Conventions). Deduplicated across the rows the
   * viewer may see; unpaged on purpose — a vocabulary is small and the filter must be complete.
   */
  listTags(kind: ItemKind): Promise<string[]>;

  getCharacter(id: string): Promise<Character | null>;
  getLorebook(id: string): Promise<Lorebook | null>;
  getPreset(id: string): Promise<Preset | null>;
  getPersona(id: string): Promise<Persona | null>;
  getPost(id: string): Promise<Post | null>;
  getSession(id: string): Promise<Session | null>;
  getReport(id: string): Promise<Report | null>;

  /**
   * The whole thread for one item, oldest first, replies included — a thread is a conversation,
   * not a ranked listing, so it has no page or sort control. The page builds the tree from
   * `parentId` and folds branches deeper than three levels (`components/comment-thread.md`).
   */
  listComments(itemId: string): Promise<Comment[]>;

  /**
   * Publish a post (`post/create.md`). The write is `postWriteSchema`-shaped and parsed here, so the
   * composer's gate and the stored row are one rule; `body` arrives already trimmed.
   *
   * **The attachment must be the author's own** — that is the creator's accept line, and it is
   * enforced here, not in the picker: a character id the viewer does not author is refused (`null`),
   * so a caller cannot attach somebody else's item even by posting the id by hand. A cut carries no
   * id at all — it is text stamped at publish time — so there is nothing to own.
   *
   * Engagement starts at zero and `verified` is **false**: a new post has not been scanned, and
   * moderation (`JEV`) is what flips the flag. Returns the stored row, or `null` on a failed parse or
   * a refused attachment.
   */
  addPost(input: PostWrite): Promise<Post | null>;

  /**
   * Delete one post — **author only** — and, in cascade, its whole comment thread
   * (`post/detail.md` → *Delete*: *deletes the post and, in cascade, its entire comment thread*).
   * The comments are dropped, never orphaned: an orphaned reply would keep counting on a parent that
   * no longer exists. `false` when the post is missing or another account's.
   */
  deletePost(id: string): Promise<boolean>;

  /**
   * The viewer's own sessions, newest first — what `post/create` offers as a **cut** source. A session
   * is participant-only, so this answers the viewer's rows and nobody else's by construction.
   */
  listMySessions(): Promise<Session[]>;

  /**
   * Append a comment or a reply (`T-11`). The write is `commentWriteSchema`-shaped, parsed by the
   * adapter before it stores — the composer's gate and the stored row are the same schema, so the
   * two cannot disagree. The row's **author is the signed-in account**, its `nsfw` flag is its own
   * (SFW by default at the call site, never inherited), and `replyCount` / the item's
   * `commentCount` are **recomputed after the write**, so the count strip can never disagree with
   * the thread it counts. `null` when the item (or the parent being replied to) does not exist.
   */
  addComment(input: CommentWrite): Promise<Comment | null>;

  /**
   * Delete one comment — **author only**, refused for another account's row exactly as RLS will.
   * Deletion never takes the branch: the row becomes a `deleted` placeholder (body gone, engagement
   * zeroed, header and time kept) and every reply beneath stays. Returns the placeholder, or `null`
   * when the row is missing or not the viewer's.
   */
  deleteComment(id: string): Promise<Comment | null>;

  /** Newest first. Rows are already aggregated by kind + target. */
  listNotifications(options?: ListOptions): Promise<Listing<Notification>>;

  /** Most-reported first; equal weight falls back to the newest report. */
  listReports(options?: ListOptions & { status?: ReportFilter }): Promise<Listing<Report>>;

  /**
   * File a report (`components/report.md`, T-12). The write is `reportWriteSchema`-shaped and parsed
   * here before it is stored, so the dialog's gate and the stored reason are the same schema.
   *
   * The adapter owns the three rules no page may re-derive:
   * - **one report per viewer per item** — a second submit answers `already` instead of appending;
   * - **cumulative cases** — an open case for the target takes the reason, `weight` + 1 and a new
   *   `lastReportAt`; with no open case the write opens one at weight 1. Those numbers are computed
   *   here, exactly as every other count is;
   * - **already verified** — a target whose `verified` flag is set leaves the report *on file* and
   *   starts no scan, which is the spec's `held`.
   *
   * The answer is a `ReportOutcome`, never the case: `weight`, `status` and `jev` are the
   * moderator's view, and *the reporter never sees an outcome*. `null` when the target is gone or
   * the write does not parse.
   */
  addReport(input: ReportWrite): Promise<ReportOutcome | null>;

  /**
   * The viewer's own report on an item, or `null` when they have not filed one — what makes
   * *Already reported* true on a remount. It answers the **reason record** (part, reason, details,
   * source, time) and never the case, for the same reason `addReport` answers an outcome: the
   * reporter is not shown the verdict, the queue position or who acted.
   */
  myReport(kind: ReportTarget["kind"], id: string): Promise<ReportEntry | null>;

  /**
   * One vote per viewer per item, and a switch replaces the earlier vote — the adapter owns that
   * rule so no page can get it wrong. Returns the updated entity, or `null` when it is gone.
   */
  vote<V extends VotableKind>(
    kind: V,
    id: string,
    direction: VoteDirection,
  ): Promise<EntityOf<V> | null>;

  /**
   * The viewer's own vote on an item, or `null` when they have not voted. The **Voted** state has
   * to survive a remount (`character/detail.md` → States), and only the adapter knows the vote in
   * force, so a page never guesses it from a count that another viewer could have moved.
   */
  myVote<V extends VotableKind>(kind: V, id: string): Promise<VoteDirection | null>;

  /** Bookmark state for the signed-in viewer; a persona has none, so it is not a `VotableKind`. */
  isBookmarked(kind: ItemKind | "post", id: string): Promise<boolean>;

  /** Adds or removes the viewer's bookmark and returns the item's new state. */
  toggleBookmark(kind: ItemKind | "post", id: string): Promise<{ bookmarked: boolean } | null>;

  /**
   * The character page's **Start a session** / **Continue**: one session per character per user,
   * and Continue reopens the most recent one. `null` means the control reads Start.
   */
  findSessionForCharacter(characterId: string, owner: Handle): Promise<Session | null>;

  /**
   * Start a session from this character, per `session/detail.md`: the character, every attached
   * lorebook the viewer can see, and the preset are **copied** at start, each copy keeping the id
   * of its original (`sourceId`); the persona is a live reference, not a copy, and is the viewer's
   * default one — absent when the account has none, since an unattributed session is allowed.
   *
   * It always appends a **new** session: the settings menu's **New session** starts a fresh one
   * *leaving this session and its copies untouched*, so a second session may exist. What the
   * primary control must never do is start a second one by accident — that is why it asks
   * `findSessionForCharacter` instead of calling this blindly.
   *
   * `null` when the character is not startable (missing, or another author's private row) or when
   * there is no preset to copy.
   */
  createSession(characterId: string): Promise<Session | null>;

  /**
   * **Fork / copy** (`character/detail.md`): a new character owned by the viewer with the same
   * definition — in-session name included — and `lorebookIds` carried as **references**, so the
   * fork reads the same lorebooks the original does and an attachment the forker cannot see is
   * dropped rather than arriving broken. A fork is a new item: engagement, bookmarks and comments
   * start at zero.
   *
   * `null` when the source does not exist, or is private: a copy of a privated definition would
   * publish exactly what moderation took out of view, so the write refuses it.
   */
  forkCharacter(id: string): Promise<Character | null>;

  /**
   * The account's NSFW pair (`src/specs/systems/nsfw.md`). Per account, never per device: the
   * store in `lib/state/prefs.ts` re-reads it on every sign-in, so one account's Show flag cannot
   * survive into another's. An unknown handle answers the new-account defaults, both off — the
   * spec's "skipping onboarding writes nothing, since off is what the account already holds".
   */
  getPreferences(handle: Handle): Promise<AccountPreferences>;

  /**
   * The signed-in account's saved profile, or `null` when onboarding has written nothing for it
   * yet. This is what makes the spec's **Resumed after abandonment** state honest: the form
   * restores what was typed from the adapter, not from a page-local draft or `localStorage`.
   * Signed out, or with no row, it answers `null` — a missing profile is a state, not an error.
   */
  currentProfile(): Promise<User | null>;

  /**
   * Whether a handle is already claimed by another account. Compared case-insensitively across
   * accounts, and **never** across the viewer's own current handle: typing the handle you already
   * hold is not a collision. `null`/empty answers `false` — that is the validator's business
   * (`lib/validate.ts`), not a lookup. The adapter owns this rule so no page scans fixtures for it,
   * exactly like one vote per viewer per item.
   */
  isHandleTaken(handle: Handle): Promise<boolean>;

  /**
   * The whole onboarding form in one write: the claimed handle and the display name. Returns the
   * saved account, with the handle trimmed and lowercased by the adapter. `isAdmin` is never set
   * from here — the operator grants it by hand, so this cannot take it away either.
   *
   * The page calls it for the **draft** too (debounced), so an abandoned first run still has what
   * was typed; `Finish` is the same write plus the session update. Splitting a "commit" flag out
   * would be a second way to write the same row for no gain in the preview.
   */
  saveProfile(patch: { handle: Handle; displayName: string }): Promise<User>;

  /**
   * Writes one or both flags and returns the account's whole pair, so the caller never merges a
   * partial into its own idea of the state.
   */
  savePreferences(
    handle: Handle,
    patch: Partial<AccountPreferences>,
  ): Promise<AccountPreferences>;
};

/**
 * Memory until a Supabase project ref exists (`docs/ARCHITECTURE.md` → open decisions 2).
 * When `supabase.ts` lands this is the one line that changes, and the badge on `/dev/data`
 * starts telling the truth about which adapter answered.
 */
export function resolveRepo(): Repo {
  return memoryRepo;
}
