import type { Derived } from "ripple";
import { read } from "../lib/reactive.ts";

/**
 * Field: 12px uppercase label, 44px control, help line, error line.
 * No floating labels. The label is always visible above the control.
 *
 * `value` may be a `Tracked<string>` (live, cleared by the page) or a plain
 * string (initial value only) — read it through `read()` inside the render.
 * The caller owns the value; this component never keeps a copy.
 */

let counter = 0;

export function Field({
  label,
  value,
  onInput,
  placeholder,
  help,
  error,
  multiline = false,
  rows = 4,
  type = "text",
  name,
  disabled = false,
  maxLength,
}: {
  label: string;
  value: Derived<string> | string;
  onInput: (value: string) => void;
  placeholder?: string;
  help?: Derived<string> | string;
  /** When set the control is invalid and the line renders in `--color-danger`. */
  error?: Derived<string> | string;
  multiline?: boolean;
  rows?: number;
  type?: "text" | "email" | "search" | "url" | "tel";
  name?: string;
  disabled?: boolean;
  maxLength?: number;
}) @{
  counter += 1;
  const id = `field-${counter}`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const invalid = read(error) ? true : false;

  <div class="field">
    <label class="field-label" for={id}>{label}</label>
    @if (multiline) {
      <textarea
        class={invalid ? "field-input is-invalid" : "field-input"}
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        value={read(value)}
        disabled={disabled}
        maxlength={maxLength}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={read(error) ? errorId : read(help) ? helpId : undefined}
        onInput={(event) => onInput(event.currentTarget.value)}
      ></textarea>
    } @else {
      <input
        class={invalid ? "field-input is-invalid" : "field-input"}
        id={id}
        type={type}
        name={name}
        placeholder={placeholder}
        value={read(value)}
        disabled={disabled}
        maxlength={maxLength}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={read(error) ? errorId : read(help) ? helpId : undefined}
        onInput={(event) => onInput(event.currentTarget.value)}
      />
    }
    @if (read(help)) {
      <p class="field-help" id={helpId}>{read(help)}</p>
    }
    @if (read(error)) {
      <p class="field-error" id={errorId}>{read(error)}</p>
    }
  </div>
}
