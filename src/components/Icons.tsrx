/**
 * One stroke set, 20px, currentColor — inlined as components, never an icon dependency.
 * Shared presentation lives in `.ico` in `src/styles.css` so every icon scopes identically.
 * T-02 extends this file; keep the geometry on a 24×24 box with a 1.5 stroke.
 */

export function IconHome() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function IconThread() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5h16v10H10l-4.5 3.5v-3.5H4z" />
      <path d="M8 9.5h8" />
      <path d="M8 12.5h5" />
    </svg>
  );
}

export function IconDiscover() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

export function IconBell() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15z" />
      <path d="M10 21h4" />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  );
}

export function IconBack() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5.5 7.5 12l6.5 6.5" />
    </svg>
  );
}

export function IconArrowUp() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V6" />
      <path d="M6 12l6-6 6 6" />
    </svg>
  );
}

export function IconArrowDown() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v13" />
      <path d="M6 12l6 6 6-6" />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 12h8l1-12" />
      <path d="M10.5 10.5v5.5" />
      <path d="M13.5 10.5v5.5" />
    </svg>
  );
}

export function IconMore() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18.5" cy="12" r="1" />
    </svg>
  );
}

/* ---- Added in T-02: what the shells and forms need next. Same 20px / 1.5 set. ---- */

export function IconSearch() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
    </svg>
  );
}

export function IconClose() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </svg>
  );
}

export function IconCheck() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 6.5" />
    </svg>
  );
}

export function IconPlus() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconBookmark() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 4h11v16L12 16.5 6.5 20z" />
    </svg>
  );
}

export function IconChevronDown() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 9.5 12 15l5.5-5.5" />
    </svg>
  );
}

export function IconFlag() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4v16" />
      <path d="M6 5h11l-2 3.5 2 3.5H6z" />
    </svg>
  );
}

/** The caret a `<select>` cannot draw for itself. */
export function IconChevron({ class: className }: { class?: string }) {
  return (
    <svg
      class={className ? `ico ${className}` : "ico"}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M6 9.5 12 15l6-5.5" />
    </svg>
  );
}

/* ---- The shell's own set: brand, Discover, the options trigger, and the menu's entries. ---- */

/** The LuaPlot mark: axes with a plotted line and its last point. */
export function IconMark() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 4.5v15h15" />
      <path d="M7.5 15.5l4-5 3 3 5-6.5" />
      <circle cx="19.5" cy="7" r="1" />
    </svg>
  );
}

/** The header's own way into Discover. */
export function IconCompass() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M15 9l-1.7 4.3L9 15l1.7-4.3z" />
    </svg>
  );
}

/** The options trigger: three rules, not a kebab. */
export function IconMenu() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

/** Subscription — a four-point spark. */
export function IconSpark() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z" />
    </svg>
  );
}

/** Terms — a document with two ruled lines. */
export function IconDoc() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h7l4 4v12H7z" />
      <path d="M14 4v4h4" />
      <path d="M9.5 12h6" />
      <path d="M9.5 15.5h6" />
    </svg>
  );
}

/* ---- The tab strips' set: one icon per tab, so a compact strip still names each choice. ---- */

/** A lorebook — an open book meeting at the spine. */
export function IconBook() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 7c-1.6-1-3.6-1.5-6-1.5H4v12h2c2.4 0 4.4.5 6 1.5" />
      <path d="M12 7c1.6-1 3.6-1.5 6-1.5h2v12h-2c-2.4 0-4.4.5-6 1.5" />
      <path d="M12 7v12" />
    </svg>
  );
}

/** A preset — a wand with its spark. */
export function IconWand() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19 14.5 9.5" />
      <path d="M13.5 8.5 15.5 10.5" />
      <path d="M18 4.5v3" />
      <path d="M16.5 6h3" />
    </svg>
  );
}

/** Creations — a pencil, the author's own mark. */
export function IconPen() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 19.5 5.5 15 15.5 5l3.5 3.5L9 18.5z" />
      <path d="M13.5 7 17 10.5" />
    </svg>
  );
}

/** Followers — two people. */
export function IconUsers() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.6" />
      <path d="M17 14.2c2.1.5 3.5 2.3 3.5 4.8" />
    </svg>
  );
}

/** Following — one person, checked. */
export function IconUserCheck() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9.5" cy="8.5" r="3.5" />
      <path d="M3.5 20c0-3.2 2.6-5.5 6-5.5 1.5 0 2.9.5 3.9 1.3" />
      <path d="M14.5 17.5 16.5 19.5 20.5 15" />
    </svg>
  );
}
