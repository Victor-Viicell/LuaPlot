import { track, type Derived } from "ripple";
import { read } from "../lib/reactive.ts";

/**
 * TagPicker — the tag filter: a multi-select field the reader types into.
 *
 * The catalog's second control (after search). Typing narrows the dropdown to the tags already in
 * use; picking one puts it *inside the field* as a chip, so the current filter is one line of text
 * the reader can read at a glance, and removing one is a tap on its own chip. Empty means "All" —
 * which is why the catalog no longer carries a one-option `All` control.
 *
 * Two rules it enforces for the page:
 * - **Options are the tags in use**, handed in by the adapter (`repo.listTags`). The picker never
 *   invents a taxonomy and never renders an option nobody wrote.
 * - **It does not fetch and it does not own the query.** `selected` is the page's state (and the
 *   page's URL); this component only says what the reader picked.
 *
 * Live props: `selected` is read inside the template, because a prop expression is evaluated once
 * and a frozen array would leave the chips stale (`docs/DESIGN.md` → *Catalog*).
 */

let counter = 0;

export function TagPicker({
  label,
  options,
  selected,
  onChange,
  placeholder = "Any tag",
}: {
  label: string;
  /** Every tag in use, from the adapter. May be live: it arrives after mount. */
  options: Derived<string[]> | string[];
  /** The chosen tags. May be live. */
  selected: Derived<string[]> | string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) @{
  counter += 1;
  const id = `tagpicker-${counter}`;
  const menuId = `${id}-menu`;

  const text = track("");
  const open = track(false);
  const active = track(-1);
  let root: HTMLDivElement | undefined;
  let blurTimer: ReturnType<typeof setTimeout> | undefined;

  const chosen = (): string[] => read(selected);

  /** Options not already chosen, narrowed by what has been typed. */
  const available = (): string[] => {
    const needle = text.value.trim().toLowerCase();
    return read(options).filter(
      (tag) => !chosen().includes(tag) && (needle === "" || tag.toLowerCase().includes(needle)),
    );
  };

  function add(tag: string | undefined): void {
    if (!tag || chosen().includes(tag)) return;
    onChange([...chosen(), tag]);
    text.value = "";
    active.value = -1;
    open.value = true;
  }

  function remove(tag: string): void {
    onChange(chosen().filter((entry) => entry !== tag));
  }

  function onKeyDown(event: KeyboardEvent): void {
    const list = available();

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open.value) {
        open.value = true;
        return;
      }
      if (list.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      active.value = (active.value + step + list.length) % list.length;
      return;
    }

    if (event.key === "Enter") {
      if (open.value && list.length > 0) {
        event.preventDefault();
        add(active.value >= 0 ? list[active.value] : list[0]);
      }
      return;
    }

    if (event.key === "Escape") {
      open.value = false;
      active.value = -1;
      return;
    }

    if (event.key === "Backspace" && text.value === "") {
      const current = chosen();
      if (current.length > 0) remove(current[current.length - 1]);
    }
  }

  /** A click on an option must not blur the input before it lands. */
  function keepFocus(event: MouseEvent): void {
    event.preventDefault();
  }

  function closeIfOutside(): void {
    if (blurTimer) clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      if (!root || !root.contains(document.activeElement)) open.value = false;
    }, 120);
  }

  <div class="tagpicker" ref={(element) => {
      root = element;
    }}>
    <label class="tagpicker-label" for={id}>{label}</label>

    <div
      class={open.value ? "tagpicker-field is-open" : "tagpicker-field"}
      onClick={() => (open.value = true)}
    >
      @for (const tag of read(selected); key tag) {
        <span class="tag-chip">
          <span class="tag-chip-text">{tag}</span>
          <button
            type="button"
            class="tag-chip-x"
            aria-label={`Remove ${tag}`}
            onClick={() => remove(tag)}
          >
            ×
          </button>
        </span>
      }

      <input
        class="tagpicker-input"
        id={id}
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        aria-expanded={open.value ? "true" : "false"}
        aria-controls={menuId}
        aria-activedescendant={active.value >= 0 ? `${menuId}-${active.value}` : undefined}
        value={text.value}
        placeholder={read(selected).length === 0 ? placeholder : ""}
        onInput={(event) => {
          text.value = event.currentTarget.value;
          active.value = -1;
          open.value = true;
        }}
        onFocus={() => (open.value = true)}
        onBlur={closeIfOutside}
        onKeyDown={onKeyDown}
      />
    </div>

    @if (open.value) {
      @if (available().length > 0) {
        <ul class="tagpicker-menu" id={menuId} role="listbox" aria-label={label}>
          @for (const entry of available().map((tag, index) => ({ tag, index })); key entry.tag) {
            <li
              id={`${menuId}-${entry.index}`}
              class={entry.index === active.value ? "tagpicker-option is-active" : "tagpicker-option"}
              role="option"
              aria-selected={entry.index === active.value ? "true" : "false"}
              onMouseDown={keepFocus}
              onClick={() => add(entry.tag)}
            >
              {entry.tag}
            </li>
          }
        </ul>
      } @else {
        <p class="tagpicker-empty">
          {text.value.trim() ? `No tag matches “${text.value.trim()}”.` : "No other tags yet."}
        </p>
      }
    }
  </div>
}
