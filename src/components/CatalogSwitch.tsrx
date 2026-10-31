import { href, navigate } from "../router.ts";

/**
 * CatalogSwitch: the way between the three catalogs.
 *
 * Before this, `/character/catalog` was a dead end — the only route to lorebooks and presets was
 * their item pages, so a reader could not browse either from the navigation. The switcher is a
 * **link strip, not a `Tabs` control**: these are three routes, not three views of one page, so each
 * tab is a real anchor (middle-click, back/forward, a shared URL all work) and `aria-current` marks
 * the one you are on.
 *
 * The active tab carries the accent underline the tab strip uses; everything else is the same
 * 44px target, so a phone can hit it.
 */

export type CatalogKey = "characters" | "lorebooks" | "presets";

const CATALOGS: { key: CatalogKey; label: string; to: string }[] = [
  { key: "characters", label: "Characters", to: "/character/catalog" },
  { key: "lorebooks", label: "Lorebooks", to: "/lorebook/catalog" },
  { key: "presets", label: "Presets", to: "/preset/catalog" },
];

/** Intercept a plain click so navigation stays in-app, like every other link in the shell. */
function openLink(event: MouseEvent, to: string): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  navigate(to);
}

export function CatalogSwitch({ current }: { current: CatalogKey }) {
  return (
    <nav class="cat-switch" aria-label="Catalogs">
      @for (const item of CATALOGS; key item.key) {
        <a
          class="cat-tab"
          href={href(item.to)}
          aria-current={item.key === current ? "page" : undefined}
          onClick={(event) => openLink(event, item.to)}
        >
          {item.label}
        </a>
      }
    </nav>
  );
}

export default CatalogSwitch;
