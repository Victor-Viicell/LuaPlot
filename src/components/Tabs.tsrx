import type { Derived } from "ripple";
import { read } from "../lib/reactive.ts";

/**
 * Tabs: the underline strip for profile and bookmark tabs.
 * It renders and calls back; it never writes the query string — the page owns
 * that (spec: tab state lives in the query string, so the page decides how it
 * is written and restored).
 */

export type TabItem = { value: string; label: string };

export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem[];
  value: Derived<string> | string;
  onChange: (value: string) => void;
  /** Accessible name for the tab list, e.g. "Profile sections". */
  label: string;
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
        </button>
      }
    </div>
  );
}
