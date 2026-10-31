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
 * The two letters a comment's `Avatar` draws from its author's handle.
 *
 * A handle has no display name or image on a comment row — the spec's *header with the author's
 * profile* is the handle itself — so the initials are derived here rather than stored. The leading
 * `@` is not part of the value that reaches this function.
 */
export function initialsOf(handle: string): string {
  return handle.slice(0, 2).toUpperCase();
}
