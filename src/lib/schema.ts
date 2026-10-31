/**
 * The one home for every shape in the app (T-07B).
 *
 * `src/lib/data/types.ts` is nothing but `z.infer` of what is declared here, so a shape exists
 * exactly once: no hand type beside a schema, no `z.any()`, no `as` past a failed parse. Rules:
 *
 * - **Zod is the one parser and the one normaliser.** Trimming, lowercasing a handle, collapsing
 *   display-name whitespace and ISO-string checking happen here, never in a page, so a saved row
 *   cannot differ from a validated one. Display formatting (`percent`, `relativeTime`) belongs to
 *   `lib/format.ts` — Zod is shape and input, not presentation.
 * - **`safeParse` at every edge** (form input, adapter return/accept, JEV/LLM payload); `parse`
 *   only for an internal invariant that a bug — not a user — could break.
 * - **`z.strictObject` everywhere**, so an unknown key fails instead of being silently dropped: a
 *   fixture that grows a field no spec names fails the gate instead of shipping.
 * - **Shapes the specs forbid do not exist here**: no stored `ratio` (it is `ratioOf()`), no
 *   engagement / NSFW / public flag on a persona, no `updatedAt` on a post or a comment.
 * - **A fixture that fails is fixed against the spec**, never by loosening a schema.
 *
 * Every schema group cites the spec file and section its fields come from.
 */
import { z } from "zod";
import { initialsOf } from "./format.ts";

/* ------------------------------------------------------------------------------------------------
 * Primitives
 * ---------------------------------------------------------------------------------------------- */

/**
 * ISO-8601 (`specs/luaplot-pages.md`: every `*At` is a timestamp, and sessions read copies of an
 * ordered transcript). Deliberately **never** `z.coerce.date()`: the adapter and every fixture hold
 * a string, and a `Date` would silently change every sort and comparison.
 *
 * A shape check is not enough — `2026-13-01` is 10 characters and is not a date — so the calendar
 * is validated too: the regex admits the fields, `Date.UTC` round-trip rejects `2026-13-01`,
 * `2026-02-30` and `2026-10-32`.
 */
export const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:Z|[+-]\d{2}:\d{2})$/;

export const isoMessage = "Must be an ISO-8601 timestamp.";

export const isoSchema = z.string().refine((value) => {
  const match = ISO_8601.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    !Number.isNaN(new Date(value).getTime())
  );
}, isoMessage);

/** 3–24 of `[A-Za-z0-9_]`, claimed at onboarding, lowercased on save. */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

/**
 * The one sentence the form shows for a handle that does not match. The spec dictates only the
 * taken copy (`Username taken`) and names no alternative, so this is the format line it leaves to
 * us: factual, one rule, no encouragement. `lib/validate.ts` re-exports it, so the inline error,
 * the Finish gate and the saved row all read this string.
 */
export const HANDLE_RULE = "Lowercase letters, digits and underscores, 3–24 characters.";

export const HANDLE_REQUIRED = "A handle is required.";

export const HANDLE_PATTERN = /^[a-z0-9_]+$/;

/**
 * The one normalisation of a handle: trim, then lowercase (`onboarding.md` — *lowercased on save*;
 * `Avis_2` and `avis_2` are the same handle). Exported because the adapter must compare handles the
 * same way it stores them: `memory.ts` calls this instead of trimming on its own.
 */
export function normaliseHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * `onboarding.md` → **Username**: *lowercase letters, digits and underscores, 3–24 characters,
 * lowercased on save. The format is a constraint, not a suggestion: a handle that does not match is
 * rejected inline.*
 *
 * Uppercase **input** is accepted and normalised, because the constraint is on what an account
 * holds, not on what a keyboard produces — a phone capitalises the first letter of every field.
 * Everything else (length, alphabet) is rejected rather than repaired.
 *
 * Two pipes, two issue codes: emptiness is `too_small` with `minimum: 1` (*required*) and every
 * other failure is *format*. `lib/validate.ts` reads those codes instead of re-running a regex.
 */
export const handleSchema = z
  .string()
  .transform(normaliseHandle)
  .pipe(z.string().min(1, HANDLE_REQUIRED))
  .pipe(z.string().min(HANDLE_MIN).max(HANDLE_MAX).regex(HANDLE_PATTERN, HANDLE_RULE));

/**
 * Is this string a handle? For code that only needs the answer and not the value — `router.ts`'s
 * `[user.username]` segment uses exactly this, so the route rule and the onboarding rule are one
 * rule instead of two regexes waiting to drift. Uppercase passes because the schema normalises it.
 */
export function isHandle(value: string): boolean {
  return handleSchema.safeParse(value).success;
}

/** Trim, then collapse runs of whitespace: a display name is a label, not a document. */
export function normaliseDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** `onboarding.md` → **Display name**: *required, free text, duplicates allowed.* */
export const displayNameSchema = z
  .string()
  .transform(normaliseDisplayName)
  .pipe(z.string().min(1, "A display name is required."));

/**
 * `luaplot-pages.md` → *Every item a user authors carries an image … posts and comments can embed
 * images and GIFs.* The image set does not exist yet, so `initials` is the required fallback the
 * `Avatar` primitive draws and `url` arrives with uploads.
 */
export const avatarSchema = z.strictObject({
  initials: z.string().min(1).max(4),
  url: z.url().optional(),
});

/**
 * `luaplot-pages.md` → *Every shared item … carries likes, dislikes, the ratio between them, a
 * comment count, and a bookmark.* **No `ratio` field**: it is derived by `ratioOf()`, so the
 * percentage cannot drift from the counts that produce it.
 */
export const engagementSchema = z.strictObject({
  likes: z.number().int().nonnegative(),
  dislikes: z.number().int().nonnegative(),
  bookmarks: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
});

export const itemKindSchema = z.enum(["character", "lorebook", "preset"]);
export const votableKindSchema = z.enum(["character", "lorebook", "preset", "post", "comment"]);
export const voteDirectionSchema = z.enum(["like", "dislike"]);

/* ------------------------------------------------------------------------------------------------
 * Authored content — character / lorebook / preset
 * ---------------------------------------------------------------------------------------------- */

/**
 * The three authored, shareable types share one field set (`luaplot-pages.md`): identity is the id
 * and names may repeat freely (*Names are display-only and duplicates are allowed*); `nsfw` is a
 * boolean on the content row, not a tag (*Everyone carries it, personas do not*); `isPublic` is
 * JEV's only lever over authored content (*enforcement changes visibility*); `verified` is the
 * internal scan cache (*Verification is cached … any edit clears the flag*) and is never rendered;
 * `tags` stays an empty array while the taxonomy is undecided (*the row is absent, not blank*).
 *
 * A factory rather than `.extend()`: every type gets a fresh `strictObject`, so strictness does not
 * depend on what `extend` inherits.
 */
const AUTHORED_SHAPE = {
  id: z.uuid(),
  name: z.string().min(1),
  author: handleSchema,
  tagline: z.string(),
  nsfw: z.boolean(),
  avatar: avatarSchema,
  isPublic: z.boolean(),
  verified: z.boolean(),
  tags: z.array(z.string().min(1)),
  createdAt: isoSchema,
  updatedAt: isoSchema,
  ...engagementSchema.shape,
} as const;

const authored = <const K extends z.infer<typeof itemKindSchema>, S extends z.ZodRawShape>(
  kind: K,
  shape: S,
) => z.strictObject({ ...AUTHORED_SHAPE, kind: z.literal(kind), ...shape });

/**
 * `character/detail.md` + `luaplot-pages.md`: *Only characters carry an **in-session name** … it is
 * optional and falls back to the character's name.* `lorebookIds` are **references**: *one lorebook
 * can serve many characters and editing it changes what all of them read.*
 */
export const characterSchema = authored("character", {
  inSessionName: z.string().min(1).optional(),
  description: z.string(),
  lorebookIds: z.array(z.uuid()),
});

/**
 * The authoring form's one shape (`character/create.md`, and `character/edit.md` *is the same form*),
 * parsed by `CharacterForm` **and** again by `repo.addCharacter` / `repo.updateCharacter`, so the
 * inline error, the submit gate and the stored row are one rule — the pattern `postWriteSchema`
 * established in T-14.
 *
 * - **Description / personality is one field.** `create.md` names it as one bullet
 *   (*Description / personality*) and `characterSchema` carries one `description`, so a second
 *   `personality` field would be a write value the row cannot hold. Splitting it is a schema change
 *   (row, every fixture, `characterCopySchema`, the detail page) and is recorded in
 *   `docs/DESIGN.md`, not invented here.
 * - **`inSessionName` normalises empty to absent**: *when left empty the Name is used*, and the
 *   stored row's `inSessionName` is optional with `min(1)` — so `""` is not a value it can hold.
 * - **`avatar.initials` is filled from the name when the field is left empty**, because
 *   `avatarSchema.initials` is required and there is no uploader: the initials are what the `Avatar`
 *   primitive already draws. The derivation is here so a page never upper-cases a label itself.
 * - **`lorebookIds` is deduped in input order** — an attachment is a set of references, and the
 *   order the author added them is the order the row keeps.
 */
export const CHARACTER_NAME_REQUIRED = "A character needs a name.";
export const LOREBOOK_NOT_ATTACHABLE =
  "That ID isn't a lorebook you can attach — use one of your own or a public one.";
export const LOREBOOK_ID_INVALID = "A lorebook ID is a 36-character code like 3f2a…-….";
export const LOREBOOK_ALREADY_ATTACHED = "That lorebook is already attached.";

/**
 * **Add by ID**'s input (`character/create.md` → *By ID*): a pasted id, trimmed by the schema so the
 * form never trims anything itself. Whether the id *resolves to something the author may attach* is
 * `repo.attachableLorebook`'s question — shape here, permission in the adapter.
 */
export const lorebookIdSchema = z.string().trim().pipe(z.uuid(LOREBOOK_ID_INVALID));

/**
 * The initials a card draws, shared by both authored forms (`characterWriteSchema`,
 * `lorebookWriteSchema`): upper-cased on the way in, four at most. One control, one rule.
 */
const initialsInputSchema = z
  .string()
  .transform((raw) => raw.trim().toUpperCase())
  .pipe(z.string().max(4, "Four letters at most."));

/** Empty initials are filled from the name — the transform both authored writes share (T-17). */
function withInitials<T extends { name: string; avatar: { initials: string } }>(value: T): T {
  return {
    ...value,
    avatar: {
      initials: value.avatar.initials === "" ? initialsOf(value.name) : value.avatar.initials,
    },
  };
}

export const characterWriteSchema = z
  .strictObject({
    name: z
      .string()
      .transform(normaliseDisplayName)
      .pipe(z.string().min(1, CHARACTER_NAME_REQUIRED)),
    inSessionName: z
      .string()
      .optional()
      .transform((raw) => {
        const value = normaliseDisplayName(raw ?? "");
        return value === "" ? undefined : value;
      }),
    description: z.string().transform((raw) => raw.trim()),
    nsfw: z.boolean(),
    avatar: z.strictObject({ initials: initialsInputSchema }),
    lorebookIds: z.array(z.uuid()).transform((ids) => [...new Set(ids)]),
  })
  .transform(withInitials);

/**
 * `lorebook/detail.md`: entries are visible because *they are what decides when an entry is
 * injected* — `keywords` pick the moment, `content` is the injected body, and the author's order is
 * the reading order. Entry ids are the author's own short labels (`sa-1`), not entity UUIDs.
 */
export const lorebookEntrySchema = z.strictObject({
  id: z.string().min(1),
  keywords: z.array(z.string().min(1)),
  content: z.string().min(1),
});

export const lorebookSchema = authored("lorebook", {
  description: z.string(),
  entries: z.array(lorebookEntrySchema),
});

/* --- The lorebook form's write (T-18) ------------------------------------------------------------ */

export const LOREBOOK_NAME_REQUIRED = "A lorebook needs a name.";
export const ENTRY_KEYWORD_REQUIRED = "An entry needs at least one keyword.";
export const ENTRY_CONTENT_REQUIRED = "An entry needs content.";

/**
 * **Keywords are typed as one comma-separated line** and split here, never in the page
 * (`lorebook/create.md` → *Keywords*: *the words an entry is matched on; at least one per entry*).
 * `entry-1`, `entry-2` … are **not** the author's to invent: the adapter numbers them on write, so
 * two entries in one form cannot collide and a fork cannot inherit a duplicate label.
 *
 * An entry is one row of the editor: its keywords as typed, its content as typed. The shape the row
 * is stored in is `lorebookEntrySchema` and stays the only row shape — this is the input to it.
 */
export function splitKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

export const lorebookEntryWriteSchema = z.strictObject({
  /**
   * Accepts the typed line **or** an already-split list: the form hands strings, and the adapter
   * parses the write again, so the schema has to accept its own output or a second parse would
   * refuse a write the first one just normalised (T-18).
   */
  keywords: z
    .union([z.string(), z.array(z.string())])
    .transform((raw) => (Array.isArray(raw) ? raw : splitKeywords(raw)))
    // Trimmed and deduped in typed order: a keyword twice is one keyword.
    .transform((words) => [...new Set(words.map((word) => word.trim()).filter((word) => word.length > 0))])
    .pipe(z.array(z.string().min(1)).min(1, ENTRY_KEYWORD_REQUIRED)),
  content: z
    .string()
    .transform((raw) => raw.trim())
    .pipe(z.string().min(1, ENTRY_CONTENT_REQUIRED)),
});

/**
 * The lorebook form's one shape (`lorebook/create.md`, and `edit.md` is the same form), parsed by
 * `LorebookForm` **and** again by `repo.addLorebook` / `repo.updateLorebook` — the pattern
 * `characterWriteSchema` established in T-17.
 *
 * Deliberately no `tagline` (`luaplot-pages.md`: a lorebook has none, so the card's stays `""`) and
 * no tags (the taxonomy is undecided). `entries` may be empty: *No entries yet* is a state of the
 * form, not a validation error.
 */
export const lorebookWriteSchema = z
  .strictObject({
    name: z
      .string()
      .transform(normaliseDisplayName)
      .pipe(z.string().min(1, LOREBOOK_NAME_REQUIRED)),
    description: z.string().transform((raw) => raw.trim()),
    nsfw: z.boolean(),
    avatar: z.strictObject({ initials: initialsInputSchema }),
    entries: z.array(lorebookEntryWriteSchema),
  })
  .transform(withInitials);

/**
 * `preset/create.md`: the generation surface is not finalised, so `settings` is a flat list of
 * whatever that layer exposes. `model` is the only field the spec names, and the provider behind it
 * belongs to the app — it is never a field here. No version or compatibility marker: presets are
 * not versioned.
 */
export const presetSettingsSchema = z.strictObject({
  model: z.string().min(1),
});

/**
 * The models a preset may name — *chosen by its author from the ones the app offers*
 * (`preset/create.md` → *Data* → *Model*). The app's generation layer is DeepSeek
 * (`docs/ARCHITECTURE.md` → *LLM (chat turns)*), so these are its two models, and this list is the
 * one place both the form's control and the fixtures read it from.
 *
 * `presetSettingsSchema.model` stays `min(1)` rather than an enum of this list: the spec says the
 * settings list *follows the generation layer*, so adding a model is a fixture-and-list change, not
 * a migration of every stored preset. The control offers what exists; the row records what was
 * chosen.
 */
export const PRESET_MODELS: readonly string[] = ["deepseek-chat", "deepseek-reasoner"];

export const presetSchema = authored("preset", {
  description: z.string(),
  settings: presetSettingsSchema,
});

/**
 * The preset form's one shape (`preset/create.md`, and `edit.md` *is the same form*, preloaded),
 * parsed by `PresetForm` **and** again by `repo.addPreset` / `repo.updatePreset` — the pattern
 * `characterWriteSchema` and `lorebookWriteSchema` established.
 *
 * Deliberately no `tagline` (a preset has none, so the card's stays `""`) and no tags (the taxonomy
 * is undecided). `settings` is the whole generation block: `model` is the only named field, and the
 * provider behind it belongs to the app, so it is not a field a write can carry.
 */
export const PRESET_NAME_REQUIRED = "A preset needs a name.";

export const presetWriteSchema = z
  .strictObject({
    name: z
      .string()
      .transform(normaliseDisplayName)
      .pipe(z.string().min(1, PRESET_NAME_REQUIRED)),
    description: z.string().transform((raw) => raw.trim()),
    nsfw: z.boolean(),
    avatar: z.strictObject({ initials: initialsInputSchema }),
    settings: presetSettingsSchema,
  })
  .transform(withInitials);

/** The union a listing or a detail lookup can answer with; `kind` is the discriminator. */
export const authoredItemSchema = z.discriminatedUnion("kind", [
  characterSchema,
  lorebookSchema,
  presetSchema,
]);

/**
 * `luaplot-pages.md` → *Personas are personal, not confidential.* No engagement, no NSFW flag, no
 * public flag, no follows, no `avatar`-less case: a field here counting anything would describe a
 * feature the spec refuses. `isDefault` sits on exactly one persona once the collection holds any
 * (*the mark moves to the most recently created remaining persona*), and `verified` is the same
 * internal cache an authored item carries.
 */
export const personaSchema = z.strictObject({
  id: z.uuid(),
  owner: handleSchema,
  name: z.string().min(1),
  tagline: z.string(),
  description: z.string(),
  avatar: avatarSchema,
  isDefault: z.boolean(),
  createdAt: isoSchema,
  updatedAt: isoSchema,
  verified: z.boolean(),
});

/**
 * The persona **write** (`persona/create.md` → *Data*, `edit.md` → *Same fields as create*).
 *
 * A persona is *a smaller, distinct model rather than a character with sharing removed* — its own
 * schema, not a subset — so this carries `tagline` (the collection card draws it) and nothing the
 * spec's *Absent by design* list refuses: no `nsfw`, no `isPublic`, no tags, no lorebooks, no preset,
 * no in-session name, no engagement. `isDefault` is **not** a write value: the adapter owns the mark
 * (`addPersona` and `deletePersona` move it in the same step), so a page can never save a persona
 * that claims the default while another holds it.
 *
 * `withInitials` fills an empty avatar from the name, exactly as the character/lorebook/preset writes
 * do, and its output is valid input to this schema (a transform must accept its own output).
 */
export const PERSONA_NAME_REQUIRED = "A persona needs a name.";

export const personaWriteSchema = z
  .strictObject({
    name: z
      .string()
      .transform(normaliseDisplayName)
      .pipe(z.string().min(1, PERSONA_NAME_REQUIRED)),
    tagline: z.string().transform((raw) => raw.trim()),
    description: z.string().transform((raw) => raw.trim()),
    avatar: z.strictObject({ initials: initialsInputSchema }),
  })
  .transform(withInitials);

/* ------------------------------------------------------------------------------------------------
 * Posts and comments
 * ---------------------------------------------------------------------------------------------- */

/**
 * `luaplot-pages.md` → *A published cut is a snapshot: it records the message text and the
 * attribution chosen when it was published.* `speaker` is the turn's side, `attribution` is the
 * name printed on it.
 */
export const cutMessageSchema = z.strictObject({
  speaker: z.enum(["character", "user"]),
  attribution: z.string().min(1),
  text: z.string().min(1),
});

/**
 * `luaplot-pages.md` → *A post is a body plus at most one optional attachment, and no kind field …
 * The attachment is always the author's own … never another author's item, a lorebook, or a
 * preset.* Two attachment kinds and nothing else.
 */
export const postAttachmentSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("character"), characterId: z.uuid() }),
  z.strictObject({ kind: z.literal("cut"), messages: z.array(cutMessageSchema).min(1) }),
]);

/**
 * `luaplot-pages.md` → *A post is written once: no edit route exists.* Hence no `updatedAt`, which
 * is also why the shape cannot gain one later without a spec change. `nsfw` is its own flag; the
 * post's `kind` does not exist, so body-alone and body-plus-attachment are the same shape.
 */
export const postSchema = z.strictObject({
  id: z.uuid(),
  author: handleSchema,
  body: z.string().min(1),
  createdAt: isoSchema,
  nsfw: z.boolean(),
  attachment: postAttachmentSchema.nullable(),
  verified: z.boolean(),
  ...engagementSchema.shape,
});

/**
 * The composer's gate (`post/create.md` → *States* → *Validation error*). Parsed by the form's
 * `safeParse` **and** again by `repo.addPost`, so the inline line and the stored row are one rule.
 *
 * Only the body is gated today: there is no uploader, so the image and size rules the spec lists
 * have no control to fire from, and the attachment is either a character id or a non-empty cut —
 * both already constrained by `postAttachmentSchema`. The body is **trimmed** here, which is what
 * makes *a body of spaces* the empty body the spec refuses.
 */
export const POST_REQUIRED = "Write something before publishing.";

export const postWriteSchema = z.strictObject({
  body: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, POST_REQUIRED)),
  nsfw: z.boolean(),
  attachment: postAttachmentSchema.nullable(),
});

export const commentStatusSchema = z.enum(["visible", "deleted", "removed"]);

/** The composer's one rule, so the inline error and the adapter cannot disagree. */
export const COMMENT_REQUIRED = "Write something first.";
export const COMMENT_TOO_LONG = "Keep it under 2000 characters.";
export const COMMENT_MAX = 2000;

/**
 * A comment's text: **trimmed** where it enters, capped where it is stored. Deliberately not
 * `min(1)` here — a placeholder keeps its row with the body **gone** (`components/comment-thread.md`
 * → *Deleting a comment keeps its replies*: *the body, likes, and attachments go*), so the
 * required-text rule belongs to the write (`commentWriteSchema`) and the visible-row invariant to
 * `commentSchema`'s refinement below.
 */
export const commentBodySchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().max(COMMENT_MAX, COMMENT_TOO_LONG));

/**
 * One composer submission — a comment (`parentId: null`) or a reply. **No `author`**: the row is
 * written for whoever is signed in, which the adapter owns (memory: `VIEWER`; Supabase:
 * `auth.uid()`), exactly as `vote` owns one-vote-per-viewer. `nsfw` is the comment's own flag, SFW
 * by default at the call site — never inherited from the item it sits under.
 */
export const commentWriteSchema = z.strictObject({
  itemId: z.uuid(),
  parentId: z.uuid().nullable(),
  body: commentBodySchema.pipe(z.string().min(1, COMMENT_REQUIRED)),
  nsfw: z.boolean(),
});

/**
 * `components/comment-thread.md` + `luaplot-pages.md` → *A comment carries likes, dislikes, and a
 * reply count, but deliberately no bookmark*; *NSFW is its own flag, never inherited*; *deleting or
 * removing a comment never takes its replies* (so `status` decides what `body` may still be read
 * for, and the branch beneath stays). Rows are **flat**: the tree is built from `parentId`, and
 * `replyCount` counts the whole branch beneath at every depth.
 */
export const commentSchema = z
  .strictObject({
    id: z.uuid(),
    itemId: z.uuid(),
    parentId: z.uuid().nullable(),
    author: handleSchema,
    body: commentBodySchema,
    createdAt: isoSchema,
    nsfw: z.boolean(),
    likes: z.number().int().nonnegative(),
    dislikes: z.number().int().nonnegative(),
    replyCount: z.number().int().nonnegative(),
    status: commentStatusSchema,
  })
  /**
   * The one cross-field rule the row carries: a visible comment has text, a **placeholder does not**
   * — its body is gone (`comment-thread.md`), and the sentence in its place belongs to the
   * component, not to the data. `superRefine` keeps the object schema's `.shape` and its inferred
   * type, so nothing downstream pays for the check.
   */
  .superRefine((row, ctx) => {
    if (row.status === "visible" && row.body.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: COMMENT_REQUIRED,
        path: ["body"],
      });
    }
  });

/**
 * The one **recursive** shape in the app: the branch a page renders from the flat rows above.
 * `z.lazy` is required because the schema refers to itself, and the emitted type is checked (not
 * `any`) by `scripts/schema-check.ts` — a schema typed `any` would hide exactly the drift this file
 * exists to catch.
 */
export type CommentBranch = { comment: z.infer<typeof commentSchema>; replies: CommentBranch[] };

export const commentBranchSchema: z.ZodType<CommentBranch> = z.lazy(() =>
  z.strictObject({
    comment: commentSchema,
    replies: z.array(commentBranchSchema),
  }),
);

/** The thread a page renders: the roots of the reply tree, each branch recursive. */
export const commentThreadSchema = z.array(commentBranchSchema);

/** `true` when `T` is `any` — the one thing a `z.lazy` self-reference can collapse into. */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Compile-time proof that the recursive shape is a real type: this const only typechecks when
 * `CommentBranch` is not `any`, so `bun run build` (which typechecks `src/`) enforces it and
 * `schema:check` prints it.
 */
export const commentBranchIsTyped: IsAny<CommentBranch> extends true ? never : true = true;

/* ------------------------------------------------------------------------------------------------
 * Notifications
 * ---------------------------------------------------------------------------------------------- */

export const notificationKindSchema = z.enum(["new-content", "comment", "follow", "moderation"]);

export const notificationTargetSchema = z.strictObject({
  kind: z.enum(["character", "lorebook", "preset", "post", "comment", "user"]),
  /** A handle for a `follow` row, an entity id otherwise — the row never fetches the item. */
  id: z.string().min(1),
  /** The row's own sentence needs a name, so the loader must not fetch the item to get it. */
  label: z.string().min(1),
});

/**
 * `pages/notifications.md` + `luaplot-pages.md`: *same-kind events on the same target aggregate into
 * one row* — so `count` is part of the entity, not a rendering detail. `actor` is the newest actor
 * and is absent on a moderation row (nobody acts on your behalf but the system). `measure` names
 * the measure taken and stays off every other kind.
 */
export const notificationSchema = z.strictObject({
  id: z.uuid(),
  kind: notificationKindSchema,
  actor: handleSchema.optional(),
  target: notificationTargetSchema,
  count: z.number().int().min(1),
  measure: z.enum(["made-private", "removed", "avatar-removed"]).optional(),
  read: z.boolean(),
  createdAt: isoSchema,
});

/* ------------------------------------------------------------------------------------------------
 * Reports and JEV
 * ---------------------------------------------------------------------------------------------- */

export const reportPartSchema = z.enum(["avatar", "text"]);
export const reportReasonCodeSchema = z.enum([
  "missing-nsfw",
  "illegal",
  "copied-text",
  "copied-image",
]);

/**
 * What a report is filed against. `label` is the name a moderator reads in the queue, taken at the
 * moment of filing so a later rename cannot rewrite the case's history.
 */
export const reportTargetSchema = z.strictObject({
  kind: z.enum(["character", "lorebook", "preset", "post", "comment"]),
  id: z.uuid(),
  label: z.string().trim().min(1),
});

/**
 * `components/report.md` → *What can be reported depends on the surface, not the content type*:
 * **avatars, images and GIFs** carry a missing flag, illegal content or a copied image; **text**
 * carries a missing flag, illegal content or copied text. One table, so the dialog's reason list and
 * the write's validation cannot drift apart — and a code the queue has no rendering for can never be
 * filed. The dialog renders straight from this map.
 */
export const REPORT_REASONS_BY_PART = {
  avatar: ["missing-nsfw", "illegal", "copied-image"],
  text: ["missing-nsfw", "illegal", "copied-text"],
} as const satisfies Record<z.infer<typeof reportPartSchema>, readonly z.infer<typeof reportReasonCodeSchema>[]>;

/** Does this reason fit that surface? The one place the pair rule lives (`report.md` → *Rules*). */
export function reasonFitsPart(
  part: z.infer<typeof reportPartSchema>,
  reason: z.infer<typeof reportReasonCodeSchema>,
): boolean {
  return (REPORT_REASONS_BY_PART[part] as readonly string[]).includes(reason);
}

export const REPORT_WHAT_REQUIRED = "Choose what is being reported.";
export const REPORT_REASON_REQUIRED = "Choose a reason.";
export const REPORT_SOURCE_REQUIRED = "Name the source: the item it was copied from, or a link.";
export const REPORT_DETAILS_TOO_LONG = "Keep the note under 1000 characters.";
export const REPORT_SOURCE_TOO_LONG = "Keep the source under 400 characters.";
export const REPORT_REASON_MISMATCH = "That reason doesn't fit what you chose to report.";

const REPORT_DETAILS_MAX = 1000;
const REPORT_SOURCE_MAX = 400;

/** Trimmed where it enters, capped where it is stored — the same shape for both free-text fields. */
const reportText = (max: number, message: string) =>
  z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(max, message));

/**
 * One submission of the dialog. **No reporter id**: the row is filed for whoever is signed in, which
 * the adapter owns (memory: `VIEWER`; Supabase: `auth.uid()`), exactly as `vote` owns one vote per
 * viewer and `commentWrite` owns its author. `source` is required for every copy claim
 * (*a copy claim names its source*) and the part/reason pair is checked against the table above, so
 * a write that the dialog could never produce is refused at the adapter too.
 */
export const reportWriteSchema = z
  .strictObject({
    target: reportTargetSchema,
    /** One or more surfaces — an image and a text can be reported together. */
    parts: z.array(reportPartSchema).min(1),
    /** One or more reasons; each must fit at least one of the chosen surfaces (checked below). */
    reasons: z.array(reportReasonCodeSchema).min(1),
    details: reportText(REPORT_DETAILS_MAX, REPORT_DETAILS_TOO_LONG).optional(),
    source: reportText(REPORT_SOURCE_MAX, REPORT_SOURCE_TOO_LONG).optional(),
  })
  .superRefine((write, ctx) => {
    // Every chosen reason has to land on something the reporter actually pointed at: "copied image"
    // with only the text selected is a claim about a surface that was never chosen.
    const orphan = write.reasons.find(
      (reason) => !write.parts.some((part) => reasonFitsPart(part, reason)),
    );
    if (orphan !== undefined) {
      ctx.addIssue({ code: "custom", message: REPORT_REASON_MISMATCH, path: ["reasons"] });
    }
    const copyClaim = write.reasons.includes("copied-text") || write.reasons.includes("copied-image");
    if (copyClaim && write.source === undefined) {
      ctx.addIssue({ code: "custom", message: REPORT_SOURCE_REQUIRED, path: ["source"] });
    }
  });

/**
 * What a write answers the dialog with. **Never the case**: `weight`, `status` and `jev` are the
 * moderator's view, and `report.md` says the reporter never sees an outcome. `held` is the spec's
 * *already verified* — recorded and held, no scan started until the content changes; `already` is
 * *one report per user per item*, answered with the report that is on file rather than a second one.
 */
export const reportOutcomeSchema = z.strictObject({
  state: z.enum(["submitted", "held", "already"]),
  at: isoSchema,
});

/** `components/report.md`: one reason per report, with its own detail and, for a copy claim, a source. */
/**
 * One report on file. **The surfaces and the reasons are sets, not a pair**: `report.md` lets a
 * viewer report an item's image *and* its text in one report, for as many reasons as apply — so the
 * row keeps what was filed instead of fanning into one row per (part, reason) pair, which would
 * print the same reason twice in the owner's notice and in the queue. `parts` is what the claim
 * points at, `reasons` is why, and the pair rule is enforced at write time.
 */
export const reportEntrySchema = z.strictObject({
  parts: z.array(reportPartSchema).min(1),
  reasons: z.array(reportReasonCodeSchema).min(1),
  details: z.string().min(1).optional(),
  /** Required for a copy claim: an internal item id, or a link to an outside source. */
  source: z.string().min(1).optional(),
  at: isoSchema,
});

/**
 * `systems/jev.md`: the classification is stored, not recomputed — the case history has to survive
 * a model change. `verdict` is the judgment, `action` is what was actually applied, and
 * `confidence` is calibrated (`a Noul near 0.5 is "no idea", not "medium"`).
 */
export const jevVerdictSchema = z.strictObject({
  verdict: z.enum(["unsure", "violation", "clean"]),
  confidence: z.number().min(0).max(1),
  action: z.enum(["none", "escalated", "made-private", "removed", "held"]),
  note: z.string().min(1).optional(),
  at: isoSchema,
});

export const reportStatusSchema = z.enum(["open", "concluded"]);

/**
 * `systems/jev.md` + `luaplot-pages.md`: *Reports are cumulative … each new report raises the
 * item's weight, and the moderation queue is ordered most-reported first.* One case per item, its
 * own reasons kept, `lastReportAt` as the tie-break, `concludedAt` only on a concluded case.
 */
export const reportSchema = z.strictObject({
  id: z.uuid(),
  target: reportTargetSchema,
  reasons: z.array(reportEntrySchema).min(1),
  weight: z.number().int().min(1),
  status: reportStatusSchema,
  jev: jevVerdictSchema,
  createdAt: isoSchema,
  lastReportAt: isoSchema,
  concludedAt: isoSchema.optional(),
});

/* ------------------------------------------------------------------------------------------------
 * Sessions
 * ---------------------------------------------------------------------------------------------- */

/**
 * `luaplot-pages.md` → *A session starts from copies, never from the live items … each copy keeps
 * the ID of its original.* `version` is which version was copied (*Update from original* moves it
 * forward), `edited` is what makes **Restore** appear, and `unlinked` is a deleted or unreachable
 * original, which *costs only the link*.
 */
const COPY_SHAPE = {
  sourceId: z.uuid(),
  version: z.number().int().min(1),
  edited: z.boolean(),
  unlinked: z.boolean(),
} as const;

export const characterCopySchema = z.strictObject({
  ...COPY_SHAPE,
  kind: z.literal("character"),
  name: z.string().min(1),
  inSessionName: z.string().min(1).optional(),
  description: z.string(),
  avatar: avatarSchema,
});

export const lorebookCopySchema = z.strictObject({
  ...COPY_SHAPE,
  kind: z.literal("lorebook"),
  name: z.string().min(1),
  description: z.string(),
  entries: z.array(lorebookEntrySchema),
});

export const presetCopySchema = z.strictObject({
  ...COPY_SHAPE,
  kind: z.literal("preset"),
  name: z.string().min(1),
  description: z.string(),
  settings: presetSettingsSchema,
});

/** The character, each attached lorebook, and the preset — each snapshotted at session start. */
export const sessionCopySchema = z.discriminatedUnion("kind", [
  characterCopySchema,
  lorebookCopySchema,
  presetCopySchema,
]);

/** `session/detail.md`: a turn is append-only — *a message is never edited or deleted once sent.* */
export const turnSchema = z.strictObject({
  id: z.string().min(1),
  role: z.enum(["character", "user"]),
  text: z.string().min(1),
  at: isoSchema,
});

/**
 * **Send message** (`session/detail.md` → *Actions*). The user's own side is the only thing typed:
 * the role, the time and the id are the adapter's, so the write is one trimmed string. Trimmed
 * here, never in the page — a saved turn cannot differ from a validated one.
 */
export const TURN_REQUIRED = "Write a message first.";
export const TURN_MAX = 4000;
export const turnWriteSchema = z.strictObject({
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, TURN_REQUIRED).max(TURN_MAX, "Keep it under 4000 characters.")),
});

/**
 * `luaplot-pages.md` → *Sessions are private and unmoderated*; *the persona is not copied: it is a
 * live reference, swappable mid-session, and a switch leaves no mark on the transcript.* Hence
 * `personaId` and no persona copy on the session.
 *
 * `personaId` is **optional** because `character/detail.md` allows the unattributed start: *an
 * account with no persona is not prompted and not blocked: the session starts unattributed, the
 * user's side reads `User`, and **Switch persona** attaches one later.* A required id would make a
 * persona-less account unable to start the session the spec says it can.
 */
export const sessionSchema = z.strictObject({
  id: z.uuid(),
  owner: handleSchema,
  character: characterCopySchema,
  lorebooks: z.array(lorebookCopySchema),
  preset: presetCopySchema,
  personaId: z.uuid().optional(),
  turns: z.array(turnSchema),
  createdAt: isoSchema,
  updatedAt: isoSchema,
});

/* ------------------------------------------------------------------------------------------------
 * The model boundary
 * ---------------------------------------------------------------------------------------------- */

/**
 * The **only** shape that crosses the model seam (`docs/ARCHITECTURE.md` → *Validation*: *every
 * JEV/LLM payload is `safeParse`d before any code reads a field*). A reply is one string — the role,
 * the id and the time belong to the adapter, exactly as they do for the user's own turn — trimmed
 * here so neither a provider nor the mock can hand a page `"  "`, and capped at `TURN_MAX` because a
 * reply is stored as a turn and a longer one could never be stored.
 *
 * `strictObject`, like every other shape: a provider that answers `{text, finish_reason}` fails here
 * instead of leaking a field into the transcript.
 */
export const CHAT_REPLY_EMPTY = "The model answered with nothing.";
export const chatReplySchema = z.strictObject({
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, CHAT_REPLY_EMPTY).max(TURN_MAX, "That reply is too long to store.")),
});

/* ------------------------------------------------------------------------------------------------
 * The account
 * ---------------------------------------------------------------------------------------------- */

/**
 * `onboarding.md` + `systems/nsfw.md`: a per-account pair, never per device, both off on a new
 * account, and independent of each other (*Show off with Blur on is allowed*).
 */
export const accountPreferencesSchema = z.strictObject({
  show: z.boolean(),
  blur: z.boolean(),
});

/** A partial write of the pair — what `repo.savePreferences` accepts. */
export const accountPreferencesPatchSchema = z.strictObject({
  show: z.boolean().optional(),
  blur: z.boolean().optional(),
});

/**
 * The signed-in account as **this client** needs it: a handle to address, a display name to print,
 * the admin mark `/moderation` checks. Deliberately not the auth record — no email, no provider, no
 * token, since authentication is Supabase's and this shape never duplicates it.
 */
export const userSchema = z.strictObject({
  handle: handleSchema,
  displayName: displayNameSchema,
  isAdmin: z.boolean(),
});

/** The onboarding form's write: the handle and the display name, nothing else. */
export const profileWriteSchema = z.strictObject({
  handle: handleSchema,
  displayName: displayNameSchema,
});

/* ------------------------------------------------------------------------------------------------
 * Collections — what the adapter loads and what `schema:check` parses
 * ---------------------------------------------------------------------------------------------- */

export const seedSchemas = {
  characters: z.array(characterSchema),
  lorebooks: z.array(lorebookSchema),
  presets: z.array(presetSchema),
  personas: z.array(personaSchema),
  posts: z.array(postSchema),
  comments: z.array(commentSchema),
  notifications: z.array(notificationSchema),
  reports: z.array(reportSchema),
  sessions: z.array(sessionSchema),
} as const;

export type SeedCollection = keyof typeof seedSchemas;
