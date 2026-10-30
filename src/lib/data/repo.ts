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
  EntityOf,
  Handle,
  ItemKind,
  Lorebook,
  Notification,
  Persona,
  Post,
  Preset,
  Report,
  ReportStatus,
  Session,
  User,
  VoteDirection,
  VotableKind,
} from "./types.ts";
import { memoryRepo } from "./memory.ts";

/** One page of a listing — the spec's explicit **Load more** step. */
export const PAGE_SIZE = 24;

/** `newest` sorts on `createdAt` descending; `ratio` on the derived ratio, high first. */
export type SortOrder = "newest" | "oldest" | "ratio" | "name";

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

  /** Newest first. Rows are already aggregated by kind + target. */
  listNotifications(options?: ListOptions): Promise<Listing<Notification>>;

  /** Most-reported first; equal weight falls back to the newest report. */
  listReports(options?: ListOptions & { status?: ReportFilter }): Promise<Listing<Report>>;

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
