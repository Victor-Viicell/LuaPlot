/**
 * Display formatting — the only place a stored value becomes a string for a human.
 *
 * Zod is shape and input, never presentation (`docs/ARCHITECTURE.md` → Validation), so a ratio
 * leaves the schema as a number and becomes `87%` here. Grows only when a ticket needs it:
 * `relativeTime()` waits for the card that shows `2h` (T-13), not this one.
 */

/**
 * `ratioOf(item)` → `0%`…`100%`. A ratio is 0–1 and may be 0 when nobody has voted; anything
 * outside that range (or `NaN`) is clamped rather than rendered as `Infinity%`.
 */
export function percent(ratio: number): string {
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return `${Math.round(safe * 100)}%`;
}

/** One formatter for every `*At` a page shows; built once, since a thread draws one per row. */
const stampFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * A posted time for a comment header (T-11): `24 Oct · 18:10`, in the reader's own zone.
 *
 * The full timestamp stays the field; this is its short reading. The `<time datetime>` attribute
 * keeps the ISO string, so nothing is lost by shortening the text. An unparseable value degrades to
 * an empty string rather than `Invalid Date` in a header.
 */
export function shortStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = stampFormat.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month")} · ${pick("hour")}:${pick("minute")}`;
}

/**
 * The clock time of one turn in a transcript: `18:10`, reader's zone.
 *
 * A transcript is read forwards, under a date that the session header already gives, so the day is
 * noise in every row. `shortStamp` keeps it for a thread whose rows can be days apart.
 */
const clockFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export function clockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return clockFormat.format(date);
}

const daysFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/**
 * An inbox row's age, in the reader's zone: `now`, `12m`, `5h`, `3d`, then `24 Oct`.
 *
 * A notification is read as *how long ago*, not as a clock time (`shortStamp` stays the thread's
 * reading, where two rows hours apart need their hour). Past a week the day itself is more useful
 * than `9d`, so it falls through to a date — day and month only, because a row that old does not
 * need its minute and the column is narrow. An unparseable value degrades to an empty string.
 */
export function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return daysFormat.format(date);
}


/** The badge's cap, fixed by `pages/notifications.md` → *Badge*: it does not scale with the nav. */
export const BADGE_CAP = 9;

/**
 * The unread **row** count as the badge prints it: `1`…`9`, then `9+`, and nothing at zero —
 * *hidden at zero* is the shell's `@if`, so an empty string is the value that draws no badge.
 */
export function badgeCount(unread: number): string {
  const safe = Number.isFinite(unread) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(unread))) : 0;
  if (safe === 0) return "";
  return safe > BADGE_CAP ? `${BADGE_CAP}+` : String(safe);
}

/**
 * The two letters a comment's `Avatar` draws from its author's handle.
 *
 * A handle has no display name or image on a comment row — the spec's *header with the author's
 * profile* is the handle itself — so the initials are derived here rather than stored. The leading
 * `@` is not part of the value that reaches this function.
 */
export function initialsOf(handle: string): string {
  return handle.slice(0, 2).toUpperCase();
}
