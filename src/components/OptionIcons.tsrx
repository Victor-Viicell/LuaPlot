import type { Children } from "ripple";

function Icon({ children }: { children?: Children }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      style="stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"
    >
      {children}
    </svg>
  );
}

export function MapIcon() {
  return (
    <Icon>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </Icon>
  );
}

export function InventoryIcon() {
  return (
    <Icon>
      <path d="M4 9h16l-1.2 11H5.2L4 9Z" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
    </Icon>
  );
}

export function BodyIcon() {
  return (
    <Icon>
      <circle cx="12" cy="4.5" r="2.5" />
      <path d="M12 7v7" />
      <path d="m12 14-4 7" />
      <path d="m12 14 4 7" />
      <path d="M6 10h12" />
    </Icon>
  );
}

export function SettingsIcon() {
  return (
    <Icon>
      <path d="M4 7h10" />
      <circle cx="17" cy="7" r="3" />
      <path d="M20 17H10" />
      <circle cx="7" cy="17" r="3" />
    </Icon>
  );
}
