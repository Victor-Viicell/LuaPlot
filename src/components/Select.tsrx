import { track, type Derived } from "ripple";
import { read } from "../lib/reactive.ts";
import { IconChevron } from "./Icons.tsrx";

/**
 * Select — a **floating dropdown** in the app's own clothes (owner's call, replacing the native one).
 *
 * A native `<select>` was the cheap answer to "a control that grows", but it opens the operating
 * system's list: on Android a full-screen wheel, on a desktop a grey popup that ignores every token in
 * `src/styles.css`, next to a card menu that is already ours. One product, one dropdown.
 *
 * What this owns:
 * - **The trigger** is a real `<button role="combobox">` with `aria-haspopup="listbox"` and
 *   `aria-expanded`, showing the chosen label and the same 44px box the field uses. It carries
 *   `data-value` so a walk or a test can read the state without opening anything.
 * - **The panel** is `position: fixed` and clamped into the viewport, flipped above the trigger when
 *   there is no room beneath — a card or a scrolling outlet cannot clip it.
 * - **The keyboard is the point**: Up/Down move the active option (held on the trigger, mirrored to
 *   `aria-activedescendant`), Home/End jump, Enter/Space choose, Escape closes, Tab closes and moves on.
 * - **Outside press closes** through a scrim, the same trick the card's `+N` menu uses.
 *
 * The label stays visible above the control, exactly like `Field` — no floating labels.
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
  const menuId = `${id}-menu`;

  const open = track(false);
  /** Index of the option the keyboard is on; `-1` when the list is closed. */
  const active = track(-1);
  const left = track(0);
  const top = track(0);
  const width = track(0);

  const current = track(() => {
    const chosen = read(value);
    return options.find((option) => option.value === chosen)?.label ?? "";
  });

  let trigger: HTMLButtonElement | undefined;

  /** Panel height estimate: one 44px row per option plus the 8px padding. */
  const panelHeight = () => options.length * 44 + 8;

  function place(): void {
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    const margin = 8;
    const height = panelHeight();
    const below = box.bottom + 6;
    const fitsBelow = below + height <= window.innerHeight - margin;
    const fitsAbove = box.top - height - 6 >= margin;

    left.value = Math.max(margin, Math.min(box.left, window.innerWidth - box.width - margin));
    width.value = box.width;
    top.value = fitsBelow || !fitsAbove ? below : box.top - height - 6;
  }

  function openMenu(): void {
    if (open.value) return;
    place();
    const chosen = options.findIndex((option) => option.value === read(value));
    active.value = chosen === -1 ? 0 : chosen;
    open.value = true;
    document.addEventListener("keydown", onEscape);
  }

  function close(focusBack = true): void {
    open.value = false;
    active.value = -1;
    document.removeEventListener("keydown", onEscape);
    if (focusBack) trigger?.focus();
  }

  function onEscape(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function pick(option: { value: string; label: string }): void {
    onChange(option.value);
    close();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }

    if (!open.value) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        openMenu();
      }
      return;
    }

    if (event.key === "ArrowDown") active.value = Math.min(options.length - 1, active.value + 1);
    else if (event.key === "ArrowUp") active.value = Math.max(0, active.value - 1);
    else if (event.key === "Home") active.value = 0;
    else if (event.key === "End") active.value = options.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      const option = options[active.value];
      if (option) pick(option);
    } else if (event.key === "Tab") close(false);
  }

  <>
    <div class="select">
      <label class="select-label" for={id}>{label}</label>
      <button
        class="select-input"
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open.value ? "true" : "false"}
        aria-controls={open.value ? menuId : undefined}
        aria-activedescendant={open.value && active.value >= 0 ? `${menuId}-${active.value}` : undefined}
        data-value={read(value)}
        data-name={name}
        ref={(element) => {
          trigger = element;
        }}
        onClick={() => (open.value ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span class="select-value">{current.value}</span>
        <IconChevron class="select-caret" />
      </button>
    </div>

    @if (open.value) {
      <>
        <div class="select-scrim" onClick={() => close()}></div>
        <ul
          class="select-menu"
          id={menuId}
          role="listbox"
          aria-label={label}
          style={{ top: `${top.value}px`, left: `${left.value}px`, width: `${width.value}px`, maxHeight: `${Math.min(panelHeight(), window.innerHeight - 16)}px` }}
        >
          @for (const option of options; key option.value) {
            <li
              id={`${menuId}-${option.value}`}
              class="select-option"
              role="option"
              aria-selected={read(value) === option.value ? "true" : "false"}
              data-value={option.value}
              onClick={() => pick(option)}
              onMouseEnter={() => (active.value = options.findIndex((row) => row.value === option.value))}
            >
              <span class="select-option-label">{option.label}</span>
              @if (read(value) === option.value) {
                <span class="select-tick" aria-hidden="true">✓</span>
              }
            </li>
          }
        </ul>
      </>
    }
  </>
}

export default Select;
