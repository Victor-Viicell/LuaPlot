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

export function IconCatalog() {
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
    <svg class={className ? `ico ${className}` : "ico"} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9.5 12 15l6-5.5" />
    </svg>
  );
}
