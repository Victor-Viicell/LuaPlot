/**
 * Entity types for `src/lib/data/repo.ts`, derived from `src/lib/schema.ts` — never declared here.
 *
 * One shape, one home: every type below is `z.infer` of a schema that owns the parsing *and* the
 * normalisation (handle trimmed and lowercased, display name collapsed, timestamps checked as
 * ISO-8601). `z.infer` is the **output** type — what the app holds after a parse — so a value that
 * arrived through `repo` never needs re-normalising in a page. A hand-written entity type may not
 * sit beside its schema: add a field to the schema, not to this file.
 *
 * What the shapes encode, and where each rule comes from (`src/specs/luaplot-pages.md`):
 * - identity is the id; names repeat freely across every type and are display-only;
 * - `ratio` is **never** stored — `ratioOf()` derives it from the vote counts, because a stored
 *   percentage drifts the moment a vote is added;
 * - personas are personal: no engagement, no NSFW flag, no public flag, no follows;
 * - sessions read **copies** (`SessionCopy`), never live items, and nothing flows backwards;
 * - posts and comments are written once: no `updatedAt`, no edit route.
 */
import type { z } from "zod";
import type {
  accountPreferencesSchema,
  authoredItemSchema,
  avatarSchema,
  characterSchema,
  characterWriteSchema,
  chatReplySchema,
  commentSchema,
  commentWriteSchema,
  cutMessageSchema,
  engagementSchema,
  handleSchema,
  isoSchema,
  itemKindSchema,
  jevVerdictSchema,
  lorebookEntrySchema,
  lorebookEntryWriteSchema,
  lorebookSchema,
  lorebookWriteSchema,
  notificationKindSchema,
  notificationSchema,
  notificationTargetSchema,
  personaSchema,
  postAttachmentSchema,
  postSchema,
  postWriteSchema,
  presetSchema,
  presetSettingsSchema,
  presetWriteSchema,
  reportOutcomeSchema,
  reportPartSchema,
  reportReasonCodeSchema,
  reportEntrySchema,
  reportSchema,
  reportStatusSchema,
  reportTargetSchema,
  reportWriteSchema,
  sessionCopySchema,
  sessionSchema,
  turnSchema,
  turnWriteSchema,
  userSchema,
  votableKindSchema,
  voteDirectionSchema,
} from "../schema.ts";

/** A `*At` field: a string that really is ISO-8601 (see `isoSchema`). */
export type Iso = z.infer<typeof isoSchema>;

/** 3–24 of `[A-Za-z0-9_]`, claimed at onboarding (`onboarding.md`); the output is lowercased. */
export type Handle = z.infer<typeof handleSchema>;

/** Initials stand in until uploads land (`docs/DESIGN.md`); `url` is the uploaded image. */
export type AvatarRef = z.infer<typeof avatarSchema>;

/** The three authored, shareable types. A persona is deliberately not one of them. */
export type ItemKind = z.infer<typeof itemKindSchema>;

/** The five things a viewer can vote on. A persona is not one of them. */
export type VotableKind = z.infer<typeof votableKindSchema>;

export type VoteDirection = z.infer<typeof voteDirectionSchema>;

/** What a shared item is counted on. On a card only the ratio is shown; counts live on detail. */
export type Engagement = z.infer<typeof engagementSchema>;

/** The union a listing or a detail lookup can answer with; `kind` is the discriminator. */
export type AuthoredItem = z.infer<typeof authoredItemSchema>;

export type Character = z.infer<typeof characterSchema>;
/**
 * One authoring submission (`characterWriteSchema`): exactly the fields the author fills. The
 * adapter owns the id, the author handle, `verified`, the clock and the empty engagement — a page
 * never writes a row, the same way it never writes a vote count.
 */
export type CharacterWrite = z.infer<typeof characterWriteSchema>;
export type LorebookEntry = z.infer<typeof lorebookEntrySchema>;
export type Lorebook = z.infer<typeof lorebookSchema>;
/**
 * One entry row as the editor holds it (`lorebookEntryWriteSchema`): keywords as one typed line,
 * content as typed. The adapter turns each into a stored `LorebookEntry` and numbers its id.
 */
export type LorebookEntryWrite = z.infer<typeof lorebookEntryWriteSchema>;
/** One lorebook submission — the fields the author writes; id, author, clock and counts are the adapter's. */
export type LorebookWrite = z.infer<typeof lorebookWriteSchema>;
export type PresetSettings = z.infer<typeof presetSettingsSchema>;
export type Preset = z.infer<typeof presetSchema>;
/**
 * One preset submission (`presetWriteSchema`): the fields the author writes. The adapter owns the
 * id, the author, the clock, the `tagline`/tags it never has and the empty engagement.
 */
export type PresetWrite = z.infer<typeof presetWriteSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type CutMessage = z.infer<typeof cutMessageSchema>;
export type PostAttachment = z.infer<typeof postAttachmentSchema>;
export type Post = z.infer<typeof postSchema>;
export type PostWrite = z.infer<typeof postWriteSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type CommentStatus = Comment["status"];

/**
 * One composer submission (`commentWriteSchema`): the text plus the comment's own NSFW flag. The
 * author is deliberately not part of the write — the adapter writes the row for whoever is signed
 * in, the same way it owns one vote per viewer.
 */
export type CommentWrite = z.infer<typeof commentWriteSchema>;
export type NotificationKind = z.infer<typeof notificationKindSchema>;
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type ReportPart = z.infer<typeof reportPartSchema>;
export type ReportReasonCode = z.infer<typeof reportReasonCodeSchema>;
export type ReportEntry = z.infer<typeof reportEntrySchema>;
/** What a report is filed against — `kind`, `id`, and the label a moderator reads. */
export type ReportTarget = z.infer<typeof reportTargetSchema>;
/**
 * One dialog submission (`reportWriteSchema`): the target, the part, the reason and the optional
 * note/source. The reporter is deliberately absent — the adapter files it for whoever is signed in,
 * exactly as `CommentWrite` carries no author.
 */
export type ReportWrite = z.infer<typeof reportWriteSchema>;
/** The only thing a submit answers with: never the case, never a verdict (`report.md`). */
export type ReportOutcome = z.infer<typeof reportOutcomeSchema>;
export type JevVerdict = z.infer<typeof jevVerdictSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type Report = z.infer<typeof reportSchema>;
export type SessionCopy = z.infer<typeof sessionCopySchema>;
export type CharacterCopy = Extract<SessionCopy, { kind: "character" }>;
export type LorebookCopy = Extract<SessionCopy, { kind: "lorebook" }>;
export type PresetCopy = Extract<SessionCopy, { kind: "preset" }>;
export type Turn = z.infer<typeof turnSchema>;
/** One typed message (`turnWriteSchema`) — trimmed and non-empty before it reaches the adapter. */
export type TurnWrite = z.infer<typeof turnWriteSchema>;
/** One model reply (`chatReplySchema`) — the only shape that crosses the LLM seam. */
export type ChatReply = z.infer<typeof chatReplySchema>;
export type Session = z.infer<typeof sessionSchema>;
export type User = z.infer<typeof userSchema>;
export type AccountPreferences = z.infer<typeof accountPreferencesSchema>;

export type EntityOf<V extends VotableKind> = {
  character: Character;
  lorebook: Lorebook;
  preset: Preset;
  post: Post;
  comment: Comment;
}[V];

/**
 * Likes / (likes + dislikes), 0 when nobody has voted — derived, never stored.
 * Zero votes is 0 rather than 100: an unvoted item has no ratio, not a perfect one.
 *
 * Presentation only: formatting this as a percentage is `lib/format.ts`'s job, not Zod's.
 */
export function ratioOf(item: { likes: number; dislikes: number }): number {
  const total = item.likes + item.dislikes;
  if (total <= 0) return 0;
  return item.likes / total;
}
