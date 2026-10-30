/**
 * Fixture ids.
 *
 * They must be real 36-character UUIDs: `src/router.ts` matches an id parameter with
 * `/^[0-9a-f-]{36}$/i`, so a readable slug like `char-aurelia` would make every detail
 * link a 404. Deterministic rather than random, so a fixture id can be pasted into a test
 * or a URL and still resolve after a reseed.
 */

/**
 * Hex, not decimal: `String(0xc0a1b2c3)` is `"3231822531"`, which made every seeded id 37–38
 * characters and put it outside both the router's `[0-9a-f-]{36}` rule and `z.uuid()` — so every
 * detail link in the preview resolved to a 404. Caught by the schema check (T-07B).
 */
const group = (n: number): string => (n >>> 0).toString(16).padStart(8, "0");
const tail = (n: number): string => (n >>> 0).toString(16).padStart(12, "0");

/** `8-4-4-4-12`, hex only. `bucket` keeps the types apart, `n` keeps the rows apart. */
export function uuid(bucket: number, n: number): string {
  return `${group(bucket)}-0000-4000-8000-${tail(n)}`;
}

/** One bucket per entity type, so no two fixtures can collide by accident. */
export const CHARACTER = (n: number): string => uuid(0xc0a1b2c3, n);
export const LOREBOOK = (n: number): string => uuid(0x10eb00c5, n);
export const PRESET = (n: number): string => uuid(0x9e5e7000, n);
export const PERSONA = (n: number): string => uuid(0x9e45014a, n);
export const POST = (n: number): string => uuid(0x90570000, n);
export const COMMENT = (n: number): string => uuid(0xc0a3e07a, n);
export const NOTIFICATION = (n: number): string => uuid(0x0f141e00, n);
export const REPORT = (n: number): string => uuid(0x4e90047a, n);
export const SESSION = (n: number): string => uuid(0x5e551000, n);

/** Fixed timestamps: a fixture that reads "3 days ago" today must still read that next week. */
export const at = (day: number, hour = 9, minute = 0): string => {
  const d = String(day).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  return `2026-10-${d}T${h}:${m}:00.000Z`;
};
