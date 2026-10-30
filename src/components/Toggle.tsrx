import type { Derived } from "ripple";
import { read } from "../lib/reactive.ts";

/**
 * Toggle: the SFW/NSFW and Show/Blur control. A 44px row, label on the left,
 * switch on the right, `aria-pressed` carrying the state (a toggle button, not
 * a `role="switch"` — the press state is what the spec asks for).
 * The caller owns the value; `pressed` may be tracked so the row follows it.
 */
export function Toggle({
  label,
  hint,
  pressed,
  onToggle,
  disabled = false,
}: {
  label: string;
  hint?: string;
  pressed: Derived<boolean> | boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      class="toggle"
      aria-pressed={read(pressed) ? "true" : "false"}
      disabled={disabled}
      onClick={() => onToggle(!read(pressed))}
    >
      <span class="toggle-text">
        <span class="toggle-label">{label}</span>
        @if (hint) {
          <span class="toggle-hint">{hint}</span>
        }
      </span>
      <span class="toggle-track" aria-hidden="true">
        <span class="toggle-knob"></span>
      </span>
    </button>
  );
}
