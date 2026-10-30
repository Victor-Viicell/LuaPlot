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
