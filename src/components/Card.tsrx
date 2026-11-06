import { track, type Derived } from "ripple";
import { ratioOf, type AuthoredItem } from "../lib/data/types.ts";
import { percent } from "../lib/format.ts";
import { read } from "../lib/reactive.ts";
import { follow, href } from "../router.ts";
import { AvatarButton } from "./AvatarButton.tsrx";
import { Button } from "./Button.tsrx";
import { Excerpt } from "./Excerpt.tsrx";

/**
 * Catalogue card — one authored item (character, lorebook or preset), drawn in three parts.
 *
 * Header (title link) and footer (author beside the derived ratio) stay crisp at all times; only
 * the middle — image, tagline, tags — is what the NSFW cover blurs. That split is load-bearing:
 * `specs/systems/nsfw.md` says *the numbers are never hidden*.
 *
 * The card takes the **entity** and reads the fields the schema already owns (`name`, `tagline`,
 * `tags`, `avatar`, `author`, counts), so it renders `ratioOf(item)` and can never be handed a
 * stored percentage. It never reads `lib/state/prefs.ts`: `nsfw` here is the **effective cover
 * flag** the listing computed (`item.nsfw && prefs.blur`), because the policy is the listing's and
 * the drawing is the card's.
 *
 * Reveal is the *glance*, not the preference: `revealed` is created inside the card and forgotten
 * on unmount, which is the spec's *a reveal lasts one view*. A prop expression is evaluated once,
 * so this state cannot be passed in — it would freeze.
 *
 * No comment count and no vote counts on a card: engagement on a listing is the ratio, and counts
 * live on the detail page (`luaplot-pages.md`). The tags row is absent, not empty, when a row has
 * no tags — every kind that reaches a discover listing carries them in the fixture set.
 *
 * The image and the tagline are also doors: the image opens its viewer (zoom/pan), and a clipped
 * tagline opens in full — a listing row keeps one height whether the copy is one line or ten.
 */
export function Card({
  item,
  nsfw = false,
  blur = false,
  onOpen,
  onTagClick,
}: {
  item: AuthoredItem;
  /** The item's own NSFW flag. */
  nsfw?: boolean | Derived<boolean>;
  /**
   * The listing's Blur preference, handed in live. The card combines the two itself and reads both
   * through `read()`, because a listing that flips Blur has to repaint cards it already mounted and
   * a prop expression is evaluated once (T-09). The card still never imports the preference store:
   * it is given a flag, not an opinion.
   */
  blur?: boolean | Derived<boolean>;
  onOpen?: (event: MouseEvent) => void;
  /**
   * A tag is a door into the listing's filter when the host offers one. The card reports the tag and
   * closes its `+N` menu; it never edits the query itself.
   */
  onTagClick?: (tag: string) => void;
}) @{
  const revealed = track(false);
  const covered = track(() => read(nsfw) && read(blur) && !revealed.value);
  const path = `/${item.kind}/${item.id}`;

  /**
   * Tags never wrap on a card (`owner's call`): the row is one line and the ones that do not fit go
   * behind a `+N` chip that opens a floating list.
   *
   * The measurement needs every chip at its real size, so a **hidden mirror** of the row is rendered
   * inside the same body (absolutely positioned, `visibility: hidden`). It costs one extra list per
   * card and never touches layout, while giving `offsetLeft`/`offsetWidth` for all tags even after
   * most of them have been dropped from the visible row. `fits` is the state; a `ResizeObserver` on
   * the card re-measures when the grid changes column count or the viewport turns.
   */
  const fits = track(item.tags.length);
  const hidden = track(() => item.tags.slice(fits.value));
  const menuOpen = track(false);
  const menuX = track(0);
  const menuY = track(0);

  let mirror: HTMLUListElement | undefined;
  let row: HTMLUListElement | undefined;
  let observer: ResizeObserver | undefined;

  /** Pick a tag from the card (or its `+N` menu) and hand it to the listing. */
  function pickTag(tag: string): void {
    closeMenu();
    onTagClick?.(tag);
  }

  /** Escape closes the list; the scrim closes it on an outside tap. */
  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") closeMenu();
  }

  function closeMenu(): void {
    menuOpen.value = false;
    document.removeEventListener("keydown", onKeyDown);
  }

  /** Width the `+N` chip needs, so the count is stable whatever the number reads. */
  const MORE_W = 42;

  function measure(): void {
    if (!mirror || !row) return;
    const room = row.clientWidth;
    if (room === 0) return;

    const chips = [...mirror.querySelectorAll<HTMLElement>(".card-tag")];
    if (chips.length === 0) return;

    const total = chips.length;
    // Try dropping one chip at a time: the last visible set has to fit *and* leave room for `+N`.
    let keep = total;
    while (keep > 0) {
      const used = chips[keep - 1].offsetLeft + chips[keep - 1].offsetWidth;
      const needsMore = keep < total;
      if (used + (needsMore ? 6 + MORE_W : 0) <= room) break;
      keep -= 1;
    }

    if (keep !== fits.value) fits.value = keep;
  }

  /** Open the floating list under the `+N` chip, clamped into the viewport. */
  function openMenu(event: MouseEvent): void {
    if (menuOpen.value) {
      closeMenu();
      return;
    }
    const chip = event.currentTarget as HTMLElement;
    const box = chip.getBoundingClientRect();
    const width = 200;
    menuX.value = Math.max(
      8,
      Math.min(box.left, window.innerWidth - width - 8),
    );
    menuY.value = box.bottom + 6;
    menuOpen.value = true;
    document.addEventListener("keydown", onKeyDown);
  }

  <article
    class={covered.value ? "card is-covered" : "card"}
    ref={(element) => {
      if (!element || observer) return;
      observer = new ResizeObserver(() => {
        if (menuOpen.value) closeMenu();
        measure();
      });
      observer.observe(element);
    }}
  >
    <div class="card-head">
      <a class="card-title" href={href(path)} onClick={onOpen}>
        {item.name}
      </a>
    </div>

    <div class="card-middle">
      <div class="card-veil" aria-hidden={covered.value ? "true" : "false"}>
        <div class="card-top">
          <AvatarButton initials={item.avatar.initials} label={item.name} />
          <div class="card-body">
            @if (item.tagline) {
              <Excerpt
                class="card-tagline"
                text={item.tagline}
                title={item.name}
              />
            }
          </div>
        </div>
        <div class="card-body">
          @if (item.tags.length > 0) {
            <>
              <ul
                class="card-tags"
                ref={(element) => {
                  row = element;
                  queueMicrotask(measure);
                }}
              >
                @for (const tag of item.tags.slice(0, fits.value); key tag) {
                  <li class="card-tag">
                    @if (onTagClick) {
                      <button
                        class="card-tag-action"
                        type="button"
                        onClick={() => pickTag(tag)}
                      >
                        {tag}
                      </button>
                    } @else {
                      <span>{tag}</span>
                    }
                  </li>
                }
                @if (hidden.value.length > 0) {
                  <li>
                    <button
                      class="card-tag is-more"
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen.value ? "true" : "false"}
                      aria-label={`${hidden.value.length} more tags`}
                      onClick={openMenu}
                    >
                      {`+${hidden.value.length}`}
                    </button>
                  </li>
                }
              </ul>

              <ul
                class="card-tags is-measure"
                aria-hidden="true"
                ref={(element) => {
                  mirror = element;
                  queueMicrotask(measure);
                }}
              >
                @for (const tag of item.tags; key tag) {
                  <li class="card-tag">{tag}</li>
                }
              </ul>
            </>
          }
        </div>
      </div>

      @if (covered.value) {
        <div class="card-cover">
          <Button variant="ghost" onClick={() => (revealed.value = true)}>
            Reveal
          </Button>
        </div>
      }
    </div>

    @if (menuOpen.value) {
      <>
        <div class="card-menu-scrim" onClick={closeMenu}></div>
        <div
          class="card-menu"
          role="menu"
          aria-label="All tags"
          style={{ top: `${menuY.value}px`, left: `${menuX.value}px` }}
        >
          <ul class="card-menu-tags">
            @for (const tag of hidden.value; key tag) {
              <li class="card-tag">
                @if (onTagClick) {
                  <button
                    class="card-tag-action"
                    type="button"
                    onClick={() => pickTag(tag)}
                  >
                    {tag}
                  </button>
                } @else {
                  <span>{tag}</span>
                }
              </li>
            }
          </ul>
        </div>
      </>
    }

    <div class="card-foot">
      <a
        class="card-author"
        href={href(`/user/${item.author}`)}
        onClick={follow(`/user/${item.author}`)}
      >{`@${item.author}`}</a>
      <span class="card-ratio">{percent(ratioOf(item))}</span>
    </div>
  </article>
}
