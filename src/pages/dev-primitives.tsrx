import { track, type Component } from "ripple";
import { Avatar } from "../components/Avatar.tsrx";
import { Button } from "../components/Button.tsrx";
import { Card } from "../components/Card.tsrx";
import { CardGrid } from "../components/CardGrid.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Field } from "../components/Field.tsrx";
import {
  IconBack,
  IconBell,
  IconBookmark,
  IconCatalog,
  IconCheck,
  IconChevronDown,
  IconClose,
  IconFlag,
  IconHome,
  IconMore,
  IconPlus,
  IconSearch,
  IconThread,
  IconUser,
} from "../components/Icons.tsrx";
import { Sheet } from "../components/Sheet.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { Tabs, type TabItem } from "../components/Tabs.tsrx";
import { Toggle } from "../components/Toggle.tsrx";
import { CHARACTERS } from "../lib/fixtures/characters.ts";
import type { Character } from "../lib/data/types.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/dev/primitives` — the design-system gallery. Development only.
 *
 * Not a product route: `src/specs/luaplot-pages.md` is untouched, the tab bar
 * never links here, and `scripts/spec-routes.mjs` filters `/dev/*` out of the
 * router set before comparing. Everything the pages compose from T-05 on is
 * proved here first.
 *
 * The theme switch writes `data-theme` on `<html>`; it leaves the chosen
 * flavour on the document after you navigate away — press System to go back to
 * `prefers-color-scheme`.
 */

type Theme = "system" | "mocha" | "latte" | "frappe" | "macchiato";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "mocha", label: "Mocha" },
  { id: "latte", label: "Latte" },
  { id: "frappe", label: "Frappé" },
  { id: "macchiato", label: "Macchiato" },
];

const WIDTHS = [360, 640, 900, 1280];

/* Gallery data is the real fixture set (`lib/fixtures`), never a synthetic shape: a card that
   only works on made-up rows proves nothing. The two long variants are spreads of a real character
   with one string replaced, so they still satisfy `Character` exactly. */
const SFW: Character = CHARACTERS.find((row) => !row.nsfw) ?? CHARACTERS[0];
const FLAGGED: Character = CHARACTERS.find((row) => row.nsfw) ?? CHARACTERS[0];

const LONG: Character = {
  ...SFW,
  name: "The Cartographer of the Drowned Archive, Second Keeper of the Western Stacks",
};

const LONG_TAGLINE: Character = {
  ...SFW,
  tagline:
    "Keeps a map of a city that has been underwater for sixty years, and answers every question about it with another question about the tide, the year, and who is asking.",
};

const GRID_ITEMS = CHARACTERS.slice(0, 4);

const TABS: TabItem[] = [
  { value: "creations", label: "Creations" },
  { value: "posts", label: "Posts" },
  { value: "followers", label: "Followers" },
  { value: "following", label: "Following" },
];

const ICONS: { name: string; Icon: Component }[] = [
  { name: "Home", Icon: IconHome },
  { name: "Thread", Icon: IconThread },
  { name: "Catalog", Icon: IconCatalog },
  { name: "Bell", Icon: IconBell },
  { name: "User", Icon: IconUser },
  { name: "Back", Icon: IconBack },
  { name: "More", Icon: IconMore },
  { name: "Search", Icon: IconSearch },
  { name: "Close", Icon: IconClose },
  { name: "Check", Icon: IconCheck },
  { name: "Plus", Icon: IconPlus },
  { name: "Bookmark", Icon: IconBookmark },
  { name: "ChevronDown", Icon: IconChevronDown },
  { name: "Flag", Icon: IconFlag },
];

export function DevPrimitives() @{
  const theme = track<Theme>("system");
  const width = track(360);
  const section = track("creations");
  const title = track("Aurelia of the Tides");
  const showNsfw = track(false);
  const blurNsfw = track(false);
  const sheetOpen = track(false);

  function setTheme(next: Theme) {
    theme.value = next;
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = next;
  }

  <>
    <style>
      .gallery {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding-bottom: 40px;
      }

      .g-head {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .g-kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .g-title {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.2;
      }

      .g-note {
        max-width: 68ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .g-tools {
        display: flex;
        flex-wrap: wrap;
        gap: 16px 28px;
        padding: 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      .g-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }

      .g-label {
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .g-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .chip {
        min-height: 44px;
        padding: 0 12px;
        border: 1px solid var(--color-border);
        border-radius: 2px;
        background: transparent;
        color: var(--color-text-muted);
        font-size: 12px;
        letter-spacing: 0.01em;
        cursor: pointer;
        transition:
          color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
          border-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .chip:hover {
        border-color: var(--color-border-strong);
        color: var(--color-text);
      }

      .chip.is-on {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .g-pan {
        overflow-x: auto;
        padding-bottom: 6px;
      }

      .g-stage {
        display: flex;
        flex-direction: column;
        gap: 28px;
        max-width: none;
        padding: 16px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg);
      }

      .g-sec {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .g-sec-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 4px 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--color-border);
      }

      .g-sec-title {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .g-sec-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.4;
      }

      .g-row-mid {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }

      .g-col {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .g-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
      }

      .g-icons {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
        gap: 8px;
      }

      .g-icon {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        padding: 8px;
        border: 1px solid var(--color-border);
        border-radius: 2px;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.3;
      }

      @media (min-width: 640px) {
        .g-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .g-stage {
          padding: 20px;
        }
      }
    </style>

    <div class="gallery">
      <header class="g-head">
        <p class="g-kicker">/dev/primitives</p>
        <h1 class="g-title">Primitives</h1>
        <p class="g-note">
          Every primitive and every variant, on one stage. The theme switch writes
          {" "}<code>data-theme</code>{" "}on the document; the stage width is the layout width, while the
          sheet's dialog form follows the real viewport (900 up).
        </p>
      </header>

      <div class="g-tools">
        <div class="g-group">
          <span class="g-label">Theme</span>
          <div class="g-row">
            @for (const item of THEMES; key item.id) {
              <button
                type="button"
                class={theme.value === item.id ? "chip is-on" : "chip"}
                onClick={() => setTheme(item.id)}
              >
                {item.label}
              </button>
            }
          </div>
        </div>
        <div class="g-group">
          <span class="g-label">Stage width</span>
          <div class="g-row">
            @for (const w of WIDTHS; key w) {
              <button
                type="button"
                class={width.value === w ? "chip is-on" : "chip"}
                onClick={() => (width.value = w)}
              >
                {w}px
              </button>
            }
          </div>
        </div>
      </div>

      <div class="g-pan">
        <div class="g-stage" style={{ width: `${width.value}px` }}>
          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Button</h2>
              <p class="g-sec-note">44px floor, radius 2, one accent per screen</p>
            </div>
            <div class="g-row-mid">
              <Button variant="primary">Start a session</Button>
              <Button variant="secondary">Save draft</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Delete</Button>
              <Button variant="secondary" disabled>Disabled</Button>
            </div>
            <div class="g-col">
              <Button variant="primary" block>Block primary</Button>
            </div>
          </section>

          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Field</h2>
              <p class="g-sec-note">label / control / help or error</p>
            </div>
            <div class="g-grid">
              <Field
                label="Character name"
                value={title}
                placeholder="Sonic the Hedgehog"
                help="Display-only. Two characters may share a name."
                onInput={(next) => (title.value = next)}
              />
              <Field
                label="In-session name"
                value=""
                placeholder="Sonic"
                error="Optional, but cannot contain spaces."
                onInput={() => {}}
              />
              <Field
                label="Tagline"
                value=""
                multiline
                rows={3}
                placeholder="One line that sets the scene."
                onInput={() => {}}
              />
              <Field label="Handle" value="you" disabled help="Claimed at onboarding." onInput={() => {}} />
            </div>
          </section>

          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Toggle</h2>
              <p class="g-sec-note">Show / Blur — edits the account, not this view</p>
            </div>
            <div class="g-col">
              <Toggle
                label="Show NSFW content"
                hint="Keeps flagged items in the listings."
                pressed={showNsfw}
                onToggle={(next) => (showNsfw.value = next)}
              />
              <Toggle
                label="Blur NSFW content"
                hint="Keeps them listed but covered until revealed."
                pressed={blurNsfw}
                onToggle={(next) => (blurNsfw.value = next)}
              />
              <Toggle label="Disabled" pressed={true} disabled onToggle={() => {}} />
            </div>
          </section>

          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Card</h2>
              <p class="g-sec-note">Real fixtures · header and footer crisp, middle covered until Reveal</p>
            </div>
            <div class="g-grid">
              <Card item={SFW} />
              <Card item={FLAGGED} nsfw />
              <Card item={LONG} />
              <Card item={LONG_TAGLINE} />
            </div>
            <p class="g-sec-note">
              The second card is the fixture flagged NSFW, covered pre-reveal: the avatar and tagline
              blur behind the scrim while the title, author and <code>ratio</code> stay at full
              contrast. Press <strong>Reveal</strong> on it — that is the third state, and the same
              component one click later, because reveal state is created inside the card and lasts
              exactly this mount. The third and fourth cards hold the longest title and the longest
              tagline in the set: the title ellipses on one line, the tagline clamps at two.
            </p>
          </section>

          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Tabs</h2>
              <p class="g-sec-note">The page owns the query; Tabs only renders and calls back</p>
            </div>
            <Tabs
              items={TABS}
              value={section}
              label="Profile sections"
              onChange={(next) => (section.value = next)}
            />
            <div class="g-row-mid">
              <span class="g-sec-note">Selected: {section.value}</span>
            </div>
          </section>

          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Empty state</h2>
              <p class="g-sec-note">One line of copy plus the primary action</p>
            </div>
            <EmptyState
              message="Nothing here yet. Characters you create show up on this tab."
              actionLabel="Create a character"
              href="#primitives"
            />
          </section>

          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Skeleton</h2>
              <p class="g-sec-note">Matches the layout it stands in for — never a spinner</p>
            </div>
            <div class="g-grid">
              <Skeleton variant="lines" lines={4} />
              <Skeleton variant="block" height={120} />
            </div>
          </section>

          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Avatar</h2>
              <p class="g-sec-note">Square, 2px radius, initials fallback</p>
            </div>
            <div class="g-row-mid">
              <Avatar initials="VC" label="Victor Viicell" size={56} />
              <Avatar initials="AU" label="Aurelia of the Tides" size={40} />
              <Avatar initials="LL" size={32} />
              <Avatar initials="K" size={24} />
            </div>
          </section>

          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Sheet + Toast</h2>
              <p class="g-sec-note">Portal to body · z 40/41 · toast 60</p>
            </div>
            <div class="g-row-mid">
              <Button variant="secondary" onClick={() => (sheetOpen.value = true)}>
                Open sheet
              </Button>
              <Button
                variant="ghost"
                onClick={() => toast("Saved to your draft cut.")}
              >
                Show toast
              </Button>
            </div>
          </section>

          <section class="g-sec">
            <div class="g-sec-head">
              <h2 class="g-sec-title">Icons</h2>
              <p class="g-sec-note">One 20px / 1.5 stroke set, currentColor</p>
            </div>
            <div class="g-icons">
              @for (const item of ICONS; key item.name) {
                <div class="g-icon">
                  <{item.Icon} />
                  <span>{item.name}</span>
                </div>
              }
            </div>
          </section>
        </div>
      </div>

      <section class="g-sec">
        <div class="g-sec-head">
          <h2 class="g-sec-title">Card grid</h2>
          <p class="g-sec-note">
            Outside the stage on purpose: its columns follow the viewport (1-up at 360, 2-up sm,
            3-up md, 4-up lg), so a 360px stage would only ever prove the phone case. Blur preference
            on — the one flagged fixture in the first four is covered until its own Reveal.
          </p>
        </div>
        <CardGrid items={GRID_ITEMS} blurNsfw label="Characters" />
      </section>
    </div>

    @if (sheetOpen.value) {
      <Sheet
        title="Report this character"
        onClose={() => (sheetOpen.value = false)}
      >
        <p>Reasons come from the report component (T-12). Escape closes, Tab stays inside.</p>
        <div class="g-row-mid">
          <Button variant="primary" block onClick={() => (sheetOpen.value = false)}>
            Submit report
          </Button>
        </div>
      </Sheet>
    }
  </>
}

export default DevPrimitives;
