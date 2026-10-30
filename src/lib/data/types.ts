/**
 * Entity shapes for `src/lib/data/repo.ts`, derived from `src/specs/` — not from imagination.
 *
 * What the types encode, and where each rule comes from (`src/specs/luaplot-pages.md`):
 * - identity is the id; names repeat freely across every type and are display-only;
 * - `ratio` is **never** stored — `ratioOf()` derives it from the vote counts, because a stored
 *   percentage drifts the moment a vote is added;
 * - personas are personal: no engagement, no NSFW flag, no public flag, no follows;
 * - sessions read **copies** (`SessionCopy`), never live items, and nothing flows backwards;
 * - posts and comments are written once: no `updatedAt`, no edit route.
 */

/** 3–24 of `[A-Za-z0-9_]`, claimed at onboarding (`onboarding.md`); same rule as `router.ts`. */
export type Handle = string;

/** ISO-8601 timestamp. Every `*At` field is one, so fixtures and a real database agree. */
export type Iso = string;

export type AvatarRef = {
  /** Initials fallback — the image set does not exist yet, `Avatar` stands in (`docs/DESIGN.md`). */
  initials: string;
  /** Present once uploads land; the primitive falls back to the initials. */
  url?: string;
};

/** The three authored, shareable types. A persona is deliberately not one of them. */
export type ItemKind = "character" | "lorebook" | "preset";

/** What a shared item is counted on. On a card only the ratio is shown; counts live on detail. */
export type Engagement = {
  likes: number;
  dislikes: number;
  bookmarks: number;
  /** The whole thread, placeholders and replies included (`components/comment-thread.md`). */
  commentCount: number;
};

type AuthoredBase = {
  id: string;
  kind: ItemKind;
  /** Display label. Never identity: duplicates are allowed, with no check and no warning. */
  name: string;
  author: Handle;
  /** Boolean on the content row, not a tag. A missing flag where there is NSFW is a violation. */
  nsfw: boolean;
  /**
   * The card's middle line (`luaplot-pages.md`: a card puts avatar, tagline and tags between its
   * title and its footer) and the persona's own identity line. Shared by every authored type.
   */
  tagline: string;
  createdAt: Iso;
  updatedAt: Iso;
  avatar: AvatarRef;
  /** JEV's only lever over an authored item: made private, never deleted. */
  isPublic: boolean;
  /** Internal cache from `systems/jev.md` → Verification. Never rendered, never a badge. */
  verified: boolean;
  /** Kept empty while the taxonomy is undecided — the row is absent, not blank. */
  tags: string[];
} & Engagement;

export type Character = AuthoredBase & {
  kind: "character";
  /** How a session addresses the character ("Sonic"); optional, falls back to `name`. */
  inSessionName?: string;
  /** Description / personality, one free-text body (create labels it "Description / personality"). */
  description: string;
  /** References, never copies: editing a lorebook changes what every character reads. */
  lorebookIds: string[];
};

export type LorebookEntry = {
  id: string;
  /** Visible on the detail page: they are what decides when an entry is injected. */
  keywords: string[];
  content: string;
};

export type Lorebook = AuthoredBase & {
  kind: "lorebook";
  description: string;
  /** The author's order is the reading order; the catalog never aggregates them. */
  entries: LorebookEntry[];
};

/**
 * The generation surface is not finalised (`preset/create.md`): the settings are a flat list of
 * whatever the generation layer exposes, and `model` is the only field the spec names so far.
 * A preset is exactly that set — nothing here is a placeholder for a grouping.
 */
export type PresetSettings = {
  model: string;
};

export type Preset = AuthoredBase & {
  kind: "preset";
  description: string;
  settings: PresetSettings;
};

/**
 * Personal, never shared. No engagement, no NSFW flag, no public flag: if a field here counted
 * anything, the type would describe a feature the spec refuses.
 */
export type Persona = {
  id: string;
  /** The user's own handle — a persona belongs to exactly one account, by construction. */
  owner: Handle;
  name: string;
  tagline: string;
  description: string;
  avatar: AvatarRef;
  /** Exactly one persona carries it once the collection holds any. */
  isDefault: boolean;
  createdAt: Iso;
  updatedAt: Iso;
  /** Internal cache, same rule as an authored item's: an edit clears it. */
  verified: boolean;
};

/** A published cut records text and attribution — never a pointer back into the session. */
export type CutMessage = {
  speaker: "character" | "user";
  /** The name printed on the turn: the character's in-session name, or the chosen attribution. */
  attribution: string;
  text: string;
};

/** At most one attachment per post, and always the author's own (`luaplot-pages.md`). */
export type PostAttachment =
  | { kind: "character"; characterId: string }
  | { kind: "cut"; messages: CutMessage[] };

export type Post = {
  id: string;
  author: Handle;
  /** Images and GIFs live inside the body, not in a second list. */
  body: string;
  createdAt: Iso;
  nsfw: boolean;
  /** No `kind` field: body alone is a text post, body plus attachment is the rest. */
  attachment: PostAttachment | null;
  /** Internal cache, same rule as above. */
  verified: boolean;
} & Engagement;

/** A deleted or removed comment keeps its header and its replies; only the body goes. */
export type CommentStatus = "visible" | "deleted" | "removed";

export type Comment = {
  id: string;
  /** The shared item whose thread this sits in (character / lorebook / preset / post id). */
  itemId: string;
  /** `null` at the top level; the answered comment otherwise. Depth is unbounded in the model. */
  parentId: string | null;
  author: Handle;
  body: string;
  createdAt: Iso;
  /** Its own flag, never inherited from the item: covering one reply must not cover the thread. */
  nsfw: boolean;
  /** Likes and dislikes, and deliberately **no** bookmark: a comment is already reachable. */
  likes: number;
  dislikes: number;
  /** The whole branch beneath it, at every depth. */
  replyCount: number;
  status: CommentStatus;
};

export type NotificationKind = "new-content" | "comment" | "follow" | "moderation";

export type NotificationTarget = {
  kind: ItemKind | "post" | "comment" | "user";
  id: string;
  /** The row's own sentence needs a name, and the loader must not fetch the item to get it. */
  label: string;
};

/**
 * Rows aggregate: one row per kind per target, newest actor plus a count. Per-event rows are the
 * exception, so `count` is part of the entity rather than a rendering detail.
 */
export type Notification = {
  id: string;
  kind: NotificationKind;
  /** The newest actor: "Ada and 3 others…". Never the viewer, and absent on a moderation row. */
  actor?: Handle;
  target: NotificationTarget;
  /** 1 for a single event; bursts fold into the row that already exists. */
  count: number;
  /**
   * Moderation rows name the measure taken (`notifications.md`); every other kind leaves it out.
   * The reasons stay on the content page — the row never restates them.
   */
  measure?: "made-private" | "removed" | "avatar-removed";
  read: boolean;
  /** When the newest event arrived — the list sorts on it. */
  createdAt: Iso;
};

/** Which surface the report is against; the reason list follows this choice. */
export type ReportPart = "avatar" | "text";

export type ReportReasonCode = "missing-nsfw" | "illegal" | "copied-text" | "copied-image";

export type ReportReason = {
  part: ReportPart;
  reason: ReportReasonCode;
  details?: string;
  /** Required for a copy claim: an internal item id, or a link to an outside source. */
  source?: string;
  at: Iso;
};

/**
 * JEV's classification is stored, not recomputed: the case history has to survive a model change.
 * `verdict` is the judgment, `action` is what was actually applied.
 */
export type JevVerdict = {
  verdict: "unsure" | "violation" | "clean";
  /** 0–1, calibrated; a Noul near 0.5 is "no idea", not "medium". */
  confidence: number;
  action: "none" | "escalated" | "made-private" | "removed" | "held";
  /** Shown to the moderator as the reason the case is here. */
  note?: string;
  at: Iso;
};

export type ReportStatus = "open" | "concluded";

/** One cumulative case per item: `weight` is the report count, and the queue orders on it. */
export type Report = {
  id: string;
  target: { kind: ItemKind | "post" | "comment"; id: string; label: string };
  /** Every report keeps its own reason, so the moderator sees the spread, not just the total. */
  reasons: ReportReason[];
  /** Cumulative, never capped and never decaying. */
  weight: number;
  status: ReportStatus;
  jev: JevVerdict;
  createdAt: Iso;
  /** Newest report — the tie-break inside the queue. */
  lastReportAt: Iso;
  concludedAt?: Iso;
};

type CopyBase = {
  /** The id of the item this copy came from: the link, and the only path back. */
  sourceId: string;
  /** Which version of the original was copied — `Update from original` moves it forward. */
  version: number;
  /** Rewritten inside the session; `Restore` exists only when this is true. */
  edited: boolean;
  /** The original is gone or out of reach: the copy runs on, without the link actions. */
  unlinked: boolean;
};

export type CharacterCopy = CopyBase & {
  kind: "character";
  name: string;
  inSessionName?: string;
  description: string;
  avatar: AvatarRef;
};

export type LorebookCopy = CopyBase & {
  kind: "lorebook";
  name: string;
  description: string;
  entries: LorebookEntry[];
};

export type PresetCopy = CopyBase & {
  kind: "preset";
  name: string;
  description: string;
  settings: PresetSettings;
};

/** The character, each attached lorebook, and the preset, each snapshotted at session start. */
export type SessionCopy = CharacterCopy | LorebookCopy | PresetCopy;

export type Turn = {
  id: string;
  role: "character" | "user";
  text: string;
  at: Iso;
};

/**
 * Private and unmoderated. The persona is *not* copied: it is a live reference, swappable
 * mid-session, and a switch leaves no mark on the transcript.
 */
export type Session = {
  id: string;
  /** Participant only; a session is never addressed across accounts. */
  owner: Handle;
  character: CharacterCopy;
  lorebooks: LorebookCopy[];
  preset: PresetCopy;
  personaId: string;
  /** Append-only: a message is never edited or deleted once sent. */
  turns: Turn[];
  createdAt: Iso;
  updatedAt: Iso;
};

/** The five things a viewer can vote on. A persona is not one of them. */
export type VotableKind = "character" | "lorebook" | "preset" | "post" | "comment";

export type EntityOf<V extends VotableKind> = {
  character: Character;
  lorebook: Lorebook;
  preset: Preset;
  post: Post;
  comment: Comment;
}[V];

export type VoteDirection = "like" | "dislike";

/**
 * Likes / (likes + dislikes), 0 when nobody has voted — derived, never stored.
 * Zero votes is 0 rather than 100: an unvoted item has no ratio, not a perfect one.
 */
export function ratioOf(item: { likes: number; dislikes: number }): number {
  const total = item.likes + item.dislikes;
  if (total <= 0) return 0;
  return item.likes / total;
}
