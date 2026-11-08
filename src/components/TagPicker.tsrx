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
  creatable = false,
}: {
  label: string;
  /** Every tag in use, from the adapter. May be live: it arrives after mount. */
  options: Derived<string[]> | string[];
  /** The chosen tags. May be live. */
  selected: Derived<string[]> | string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /**
   * Whether the typed text may become a tag of its own. The catalog filters with an existing
   * vocabulary, so it leaves this off; an authored form needs to mint the first tag.
   */
  creatable?: boolean;
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

  /** Options not already chosen, narrowed by what has been typed; the typed tag comes first. */
  const available = (): string[] => {
    const needle = text.value.trim().toLowerCase();
    const typed = text.value.trim();
    const all = read(options);
    const list = all.filter(
      (tag) =>
        !chosen().includes(tag) &&
        (needle === "" || tag.toLowerCase().includes(needle)),
    );
    if (
      creatable &&
      typed !== "" &&
      !all.some((tag) => tag.toLowerCase() === typed.toLowerCase()) &&
      !chosen().some((tag) => tag.toLowerCase() === typed.toLowerCase())
    ) {
      list.unshift(typed);
    }
    return list;
  };

  function add(tag: string | undefined): void {
    if (!tag || chosen().includes(tag)) return;
    onChange([...chosen(), tag]);
    text.value = "";
    active.value = -1;
    openMenu();
  }

  function remove(tag: string): void {
    onChange(chosen().filter((entry) => entry !== tag));
  }

  /**
   * The menu is a popup, so it listens to the document while it is open: a press or a focus that
   * lands outside the field closes it at once. A blur alone is not enough — the reader can tab or
   * click straight into another control, and waiting on `document.activeElement` left the list
   * hanging open beside it.
   */
  function onOutside(event: Event): void {
    if (!root || !root.contains(event.target as Node)) closeMenu();
  }

  function openMenu(): void {
    open.value = true;
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("focusin", onOutside, true);
  }

  function closeMenu(): void {
    open.value = false;
    active.value = -1;
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("focusin", onOutside, true);
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = undefined;
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    const list = available();

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open.value) {
        openMenu();
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
      closeMenu();
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

  /** Blur is the fallback for focus that leaves the page without a `focusin` (e.g. the window). */
  function closeIfOutside(): void {
    if (blurTimer) clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      if (!root || !root.contains(document.activeElement)) closeMenu();
    }, 120);
  }

  <div
    class="tagpicker"
    ref={(element) => {
      root = element;
    }}
  >
    <label class="tagpicker-label" for={id}>
      {label}
    </label>

    <div
      class={open.value ? "tagpicker-field is-open" : "tagpicker-field"}
      onClick={() => openMenu()}
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
        aria-activedescendant={
          active.value >= 0 ? `${menuId}-${active.value}` : undefined
        }
        value={text.value}
        placeholder={read(selected).length === 0 ? placeholder : ""}
        onInput={(event) => {
          text.value = event.currentTarget.value;
          active.value = -1;
          openMenu();
        }}
        onFocus={() => openMenu()}
        onBlur={closeIfOutside}
        onKeyDown={onKeyDown}
      />
    </div>

    @if (open.value) {
      @if (available().length > 0) {
        <ul
          class="tagpicker-menu"
          id={menuId}
          role="listbox"
          aria-label={label}
        >
          @for (
            const entry of available().map((tag, index) => ({ tag, index }));
            key entry.tag
          ) {
            <li
              id={`${menuId}-${entry.index}`}
              class={
                entry.index === active.value
                  ? "tagpicker-option is-active"
                  : "tagpicker-option"
              }
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
          {text.value.trim()
            ? `No tag matches “${text.value.trim()}”.`
            : "No other tags yet."}
        </p>
      }
    }
  </div>
}
