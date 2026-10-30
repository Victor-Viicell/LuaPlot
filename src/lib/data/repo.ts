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

  /** Bookmark state for the signed-in viewer; a persona has none, so it is not a `VotableKind`. */
  isBookmarked(kind: ItemKind | "post", id: string): Promise<boolean>;

  /** Adds or removes the viewer's bookmark and returns the item's new state. */
  toggleBookmark(kind: ItemKind | "post", id: string): Promise<{ bookmarked: boolean } | null>;

  /**
   * The character page's **Start a session** / **Continue**: one session per character per user,
   * and Continue reopens the most recent one. `null` means the control reads Start.
   */
  findSessionForCharacter(characterId: string, owner: Handle): Promise<Session | null>;
};

/**
 * Memory until a Supabase project ref exists (`docs/ARCHITECTURE.md` → open decisions 2).
 * When `supabase.ts` lands this is the one line that changes, and the badge on `/dev/data`
 * starts telling the truth about which adapter answered.
 */
export function resolveRepo(): Repo {
  return memoryRepo;
}
