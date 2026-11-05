import type { Component } from "ripple";
import { follow, href } from "../router.ts";
import { IconBook, IconUser, IconWand } from "./Icons.tsrx";

/**
 * DiscoverSwitch: the way between the three Discover surfaces.
 *
 * Characters is the home page (`/`), so its tab is the one landing surface; lorebooks and presets
 * live below `/discover/*`. Before this, the character listing was a dead end — the only route to
 * lorebooks and presets was their item pages, so a reader could not browse either from the
 * navigation. The switcher is a **link strip, not a `Tabs` control**: these are three routes, not
 * three views of one page, so each tab is a real anchor (middle-click, back/forward, a shared URL
 * all work) and `aria-current` marks the one you are on.
 *
 * It shares the tab strip's compact behaviour: an icon per tab, the selected one opens to show its
 * label on a phone, and every label is visible and left-aligned from `sm` up. The active tab carries
 * the accent underline; everything else is the same 44px target, so a phone can hit it.
 */

export type DiscoverKey = "characters" | "lorebooks" | "presets";

const DISCOVER: {
  key: DiscoverKey;
  label: string;
  to: string;
  icon: Component;
}[] = [
  {
    key: "characters",
    label: "Characters",
    to: "/discover/characters",
    icon: IconUser,
  },
  {
    key: "lorebooks",
    label: "Lorebooks",
    to: "/discover/lorebooks",
    icon: IconBook,
  },
  { key: "presets", label: "Presets", to: "/discover/presets", icon: IconWand },
];

export function DiscoverSwitch({ current }: { current: DiscoverKey }) {
  return (
    <nav class="cat-switch" aria-label="Discover">
      @for (const item of DISCOVER; key item.key) {
        <a
          class="cat-tab"
          href={href(item.to)}
          aria-current={item.key === current ? "page" : undefined}
          onClick={follow(item.to)}
        >
          <span class="cat-icon" aria-hidden="true">
            <{item.icon} />
          </span>
          <span class="cat-label">
            <span class="cat-label-text">{item.label}</span>
          </span>
        </a>
      }
    </nav>
  );
}

export default DiscoverSwitch;
