import type { Derived } from "ripple";
import { read } from "../lib/reactive.ts";
import { IconChevron } from "./Icons.tsrx";

/**
 * Select — a native `<select>` wearing the app's clothes.
 *
 * The catalog's sort is the first user: two or three named options, one of them active, and a choice
 * that belongs in the query string. A segmented row said "one of these" well for two options but it
 * does not grow — a fourth sort, or a list of tag categories, needs a control that opens. A native
 * select is the one control every phone and every keyboard already knows how to operate, so it stays
 * a real `<select>`; only the chrome is ours (`.select` in `src/styles.css`).
 *
 * The label is always visible above the control, exactly like `Field` — no floating labels, no
 * placeholder-as-label.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  /** The chosen option's value. May be live so a query-string change repaints it. */
  value: Derived<string> | string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  name?: string;
}) @{
  const id = `select-${Math.random().toString(36).slice(2, 8)}`;

  <div class="select">
    <label class="select-label" for={id}>{label}</label>
    <div class="select-wrap">
      <select
        class="select-input"
        id={id}
        name={name}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        @for (const option of options; key option.value) {
          <option value={option.value} selected={read(value) === option.value}>
            {option.label}
          </option>
        }
      </select>
      <IconChevron class="select-caret" />
    </div>
  </div>
}
