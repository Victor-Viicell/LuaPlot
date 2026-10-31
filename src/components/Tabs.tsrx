import type { Derived } from "ripple";
import { read } from "../lib/reactive.ts";

/**
 * Tabs: the underline strip for profile and bookmark tabs.
 * It renders and calls back; it never writes the query string — the page owns
 * that (spec: tab state lives in the query string, so the page decides how it
 * is written and restored).
 *
 * **Counts are the adapter's** (`/bookmarks` → *Layout*: *each carrying its saved count*). They are
 * handed in live — a saved row being removed has to move the number without remounting the strip —
 * and a tab with no count entry simply draws its label, so the profile's tabs keep working unchanged.
 * The count is a saved **row** count, not a visible one: it is deliberately not filtered by the NSFW
 * preference, which is what makes a tab read `3` while the grid draws `1`.
 */

export type TabItem = { value: string; label: string };

export function Tabs({
  items,
  value,
  onChange,
  label,
  counts,
}: {
  items: TabItem[];
  value: Derived<string> | string;
  onChange: (value: string) => void;
  /** Accessible name for the tab list, e.g. "Profile sections". */
  label: string;
  /** Per-tab count, printed after the label. Absent means no count at all. */
  counts?: Derived<Record<string, number>> | Record<string, number>;
}) {
  return (
    <div class="tabs" role="tablist" aria-label={label}>
      @for (const item of items; key item.value) {
        <button
          type="button"
          class="tab-pill"
          role="tab"
          aria-selected={read(value) === item.value ? "true" : "false"}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          @if (counts !== undefined) {
            <span class="tab-count">{read(counts)[item.value] ?? 0}</span>
          }
        </button>
      }
    </div>
  );
}
