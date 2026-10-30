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
