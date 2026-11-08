/**
 * Scratch file — the current shapes of the authored entities, the personal ones (persona, session),
 * and their form shapes, as plain interfaces, so the field tables can be decided (and reordered) here.
 *
 * Mirrors the **output** of `src/lib/schema.ts` (`characterSchema`, `lorebookSchema`,
 * `presetSchema`, `personaSchema`, `sessionSchema` and their `*Write` form shapes). Nothing imports
 * this file; it is a worksheet.
 */

/** `avatarSchema` — an uploaded image. No initials; when `url` is absent the card draws the `kind` icon. */
interface Avatar {
  url?: string;
}

/** `lorebookEntrySchema` — one stored entry, id numbered by the adapter (`entry-1`, `sa-1`…). */
interface LorebookEntry {
  id: string;
  /** The keys that activate the content (comma-separated in the form, split on write). */
  keywords: string[];
  /** Additional keys required to activate; ignored unless `selective` is true. */
  secondaryKeywords: string[];
  /** The content sent to the AI when the entry is triggered. */
  content: string;
  /** Whether the entry can trigger at all. */
  enabled: boolean;
  /** Lower insertion order is inserted higher when several entries fire. */
  insertionOrder: number;
  /** Whether keywords match case-sensitively. */
  caseSensitive: boolean;
  /** When the token budget is reached, lower priority is discarded first. */
  priority: number;
  /** Require both `keywords` and `secondaryKeywords` to trigger. */
  selective: boolean;
  /** How secondary keys combine: included (AND) or excluded (NOT). Ignored unless `selective`. */
  selectiveLogic: "AND" | "NOT";
  /** Always trigger, within the token budget. */
  constant: boolean;
  /** Percent chance the content activates when the entry is triggered. */
  probability: number;
}

/** `presetSettingsSchema` — prompt structure first, generation parameters second. */
interface PresetSettings {
  /* ------------------------------------------------------------------------------------------
   * Prompt structure
   * ---------------------------------------------------------------------------------------- */

  /** Added to the prompt to set the bot's behaviour. */
  preHistoryInstructions: string;
  /** Added at the very end of the prompt, after the chat history; blank means unused. */
  postHistoryInstructions: string;
  /** The prompt the Impersonation feature uses to write the user's next response. */
  impersonationPrompt: string;

  /* ------------------------------------------------------------------------------------------
   * Generation parameters
   * ---------------------------------------------------------------------------------------- */

  /** One of the models the app offers: `deepseek-flash` or `deepseek-v4-pro`. */
  model: string;
  /**
   * Thinking-mode switch. When omitted the mode follows `reasoningEffort`; when present it takes
   * precedence over `reasoningEffort`.
   */
  thinking?: { type: "enabled" | "disabled" };
  /** `none` disables thinking; `low` / `high` / `max` enable it. Default effort is `high`. */
  reasoningEffort?: "none" | "low" | "high" | "max";
  /** 1–393216. Default is 8K without thinking, 64K with it (128K at `max` effort). */
  maxTokens?: number;
  /**
   * Token budget for the prompt history. App-side only — never sent to the API: turns are trimmed
   * from the oldest message outward until the conversation fits, leaving room for the reply.
   */
  contextSize?: number;
  /** Up to 16 sequences that stop generation. */
  stop?: string[];
  /** Sampling temperature, 0–2 (default 1). No effect in thinking mode. */
  temperature?: number;
  /** Nucleus sampling, (0, 1] (default 1). Effective value depends on the model and mode. */
  topP?: number;
}

/**
 * `AUTHORED_SHAPE` — fields every authored item (character / lorebook / preset) shares.
 * `kind` is narrowed to one literal in each concrete interface below.
 *
 * `avatar` is an uploaded image; when it is absent the card falls back to the icon for the item's `kind`.
 */
interface AuthoredBase {
  id: string;
  kind: "character" | "lorebook" | "preset";
  name: string;
  author: string;
  avatar: Avatar;
  /** Shown in search and on cards; never part of the prompt. */
  tagline: string;
  /** Shown on the detail page; never part of the prompt. */
  creatorNotes: string;
  /** Public / Private / Unlisted — replaces the old `isPublic` boolean. */
  visibility: "public" | "private" | "unlisted";
  nsfw: boolean;
  /** Publish under the author's handle vs. as “Anonymous”. */
  anonymous: boolean;
  tags: string[];
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  likes: number;
  dislikes: number;
  bookmarks: number;
  commentCount: number;
}

/* ------------------------------------------------------------------------------------------------
 * Character
 * ---------------------------------------------------------------------------------------------- */

interface Character extends AuthoredBase {
  kind: "character";
  /** Individual person vs. narrator/world. */
  characterType: "character" | "narrator";
  inSessionName?: string;
  description: string;
  initialMessage: string;
  scenario: string;
  exampleDialogs: string;
  /** The only advanced field kept; prompts, PHI, notes and the character book live elsewhere. */
  alternateGreetings: string[];
  lorebookIds: string[];
}

/* ------------------------------------------------------------------------------------------------
 * Lorebook
 * ---------------------------------------------------------------------------------------------- */

interface Lorebook extends AuthoredBase {
  kind: "lorebook";
  entries: LorebookEntry[];
}

/* ------------------------------------------------------------------------------------------------
 * Preset
 * ---------------------------------------------------------------------------------------------- */

interface Preset extends AuthoredBase {
  kind: "preset";
  settings: PresetSettings;
}

/* ------------------------------------------------------------------------------------------------
 * Persona
 * ---------------------------------------------------------------------------------------------- */

/**
 * `personaSchema` — the viewer's own chat identity. Not an `AuthoredBase`: a persona has no author,
 * tags, visibility or engagement counts, and only its owner can edit it.
 */
interface Persona {
  id: string;
  owner: string;
  /** “Name (not in-chat name)” — the label in the viewer's persona list. */
  name: string;
  /** “In-Chat Name” — the name used inside a chat; falls back to `name` when empty. */
  inSessionName?: string;
  tagline: string;
  description: string;
  avatar: Avatar;
  /** Whether this is the persona chats start with. */
  isDefault: boolean;
  /** Every lorebook attached to this persona; any number may be attached. */
  lorebookIds: string[];
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------------------------------------
 * Session
 * ---------------------------------------------------------------------------------------------- */

/** Per-chat switches that used to live on the preset. Both default to `true`. */
interface SessionSettings {
  /** Whether the session's lorebooks are used at all. Default: `true`. */
  useLorebooks: boolean;
  /** Whether the character's own preset is used instead of the session's. Default: `true`. */
  useCharacterPreset: boolean;
}

/**
 * A snapshot keeps the id of the source it was built from (`version`), whether the copy has since
 * been edited, and whether the source is gone (`unlinked` — a removed source costs only the link,
 * the chat keeps working).
 */
interface SessionCopyBase {
  sourceId: string;
  version: number;
  edited: boolean;
  unlinked: boolean;
}

/** The character as it stood when the session was built. */
interface CharacterCopy extends SessionCopyBase {
  kind: "character";
  name: string;
  inSessionName?: string;
  description: string;
  avatar: Avatar;
}

/** One lorebook as it stood when the session was built. */
interface LorebookCopy extends SessionCopyBase {
  kind: "lorebook";
  name: string;
  entries: LorebookEntry[];
}

/** The preset as it stood when the session was built. */
interface PresetCopy extends SessionCopyBase {
  kind: "preset";
  name: string;
  settings: PresetSettings;
}

/**
 * `sessionSchema` — one chat the viewer has started, built from copies, not from the live items: at
 * creation it snapshots the character, its lorebooks and the preset, so a later edit or deletion of
 * any source never rewrites an existing chat. Only its owner reads or writes a session.
 */
interface Session {
  id: string;
  owner: string;
  character: CharacterCopy;
  lorebooks: LorebookCopy[];
  preset: PresetCopy;
  /** The session's own switches, defaulted to `true`. */
  settings: SessionSettings;
  /**
   * The viewer persona speaking in this chat. A live reference, not a copy: it is swappable
   * mid-session and switching it leaves no mark on the transcript.
   */
  personaId?: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------------------------------------
 * Form writes — what the author fills; the adapter owns id, author, clock, verified, engagement.
 * ---------------------------------------------------------------------------------------------- */

interface CharacterWrite {
  name: string;
  avatar: Avatar;
  tagline: string;
  /** “In-Chat Name” — the name used inside a chat; falls back to `name` when empty. */
  inSessionName?: string;
  creatorNotes: string;
  tags: string[];
  visibility: "public" | "private" | "unlisted";
  nsfw: boolean;
  anonymous: boolean;

  description: string;
  firstMessage: string;
  scenario: string;
  exampleDialogs: string;
  /** The only advanced field kept; prompts, PHI, notes and the character book live elsewhere. */
  alternateGreetings: string[];

  lorebookIds: string[];
}

interface LorebookEntryWrite {
  /** Typed as one comma-separated line (or an already-split list). */
  keywords: string | string[];
  /** Typed as one comma-separated line (or an already-split list). */
  secondaryKeywords: string | string[];
  content: string;
  enabled: boolean;
  insertionOrder: number;
  caseSensitive: boolean;
  priority: number;
  selective: boolean;
  selectiveLogic: "AND" | "NOT";
  constant: boolean;
  probability: number;
}

interface LorebookWrite {
  name: string;
  avatar: Avatar;
  tagline: string;
  creatorNotes: string;
  visibility: "public" | "private" | "unlisted";
  nsfw: boolean;
  anonymous: boolean;
  tags: string[];
  entries: LorebookEntryWrite[];
}

interface PresetWrite {
  name: string;
  /** Shown in search and on cards; never part of the prompt. */
  tagline: string;
  /** Shown on the detail page; never part of the prompt. */
  creatorNotes: string;
  nsfw: boolean;
  tags: string[];
  avatar: Avatar;
  settings: PresetSettings;
}

/**
 * `personaWriteSchema` — the persona form. `isDefault` is not here: the first persona and
 * `setDefaultPersona` are the adapter's, exactly as with the other writes.
 */
interface PersonaWrite {
  /** “Name (not in-chat name)” — the label in the viewer's persona list. */
  name: string;
  /** “In-Chat Name” — the name used inside a chat; falls back to `name` when empty. */
  inSessionName?: string;
  tagline: string;
  description: string;
  avatar: Avatar;
  /** Every lorebook attached to this persona; any number may be attached. */
  lorebookIds: string[];
}

/**
 * `sessionWriteSchema` — what starting a chat needs: which character, which lorebooks, and the
 * preset the user set for it. These are references; the adapter then builds the session from copies
 * of each source. `id`, `owner` and the clock are the adapter's.
 */
interface SessionWrite {
  characterId: string;
  lorebookIds: string[];
  presetId: string;
  /** Both switches default to `true` when omitted. */
  settings?: Partial<SessionSettings>;
  personaId?: string;
}
