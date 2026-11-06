import { track } from "ripple";
import type { Children, Derived } from "ripple";
import type { AuthoredItem } from "../lib/data/types.ts";
import { read } from "../lib/reactive.ts";
import { Card } from "./Card.tsrx";

/**
 * The listing grid every catalogue reuses: 1-up at 360, 2-up at `sm` (640), 3-up at `md` (900) in
 * the reading column, and **at most 4-up** on a `wide` route (`lg`, 1200). A **gutter grid**
 * (12/16/20px gaps) with the cards' own 1px border and 6px radius — not the 1px-gap count-strip
 * gesture, which needs square corners and would fight the card radius (`docs/DESIGN.md` → Cards,
 * decided in T-08).
 *
 * The grid is the listing's chrome, so it owns the two listing-level decisions and the card owns
 * none of them: `blurNsfw` is the account's Blur preference (the caller reads the store) and is
 * ANDed with each item's own flag to produce the card's effective cover flag. With Blur off a
 * flagged item draws crisp; with it on, that one card is covered until its own Reveal.
 *
 * A `<ul>` because it is a list of items: the `li` carries the layout, the card carries the
 * meaning. The link on each title is the entry point (plus `onOpen` for a page that wants the
 * event); nothing here is a clickable `<div>`.
 *
 * **Both props are live** (decided in T-09). A prop expression is evaluated once when the component
 * is called, so a page that appends another 24 rows or flips Blur would hand this component a frozen
 * array or a frozen flag and the grid would never repaint — the same trap `Button.disabled` and
 * `Field.error` already carry the fix for. `items` and `blurNsfw` accept `Derived<…>` as well as a
 * plain value and are read through `read()` inside the render, so a static call site
 * (`/dev/primitives`, `/dev/data`) is unchanged.
 */
export function CardGrid({
  items,
  blurNsfw = false,
  revealEpoch = 0,
  onOpen,
  onTagClick,
  label,
  children,
}: {
  items: Derived<AuthoredItem[]> | AuthoredItem[];
  /** The account's Blur NSFW preference — the card never reads the store. */
  blurNsfw?: Derived<boolean> | boolean;
  /**
   * A counter the listing bumps whenever it **fetches again** (`nsfw.md` → *A reveal lasts one
   * view*). It rides in each row's key, so a refetch remounts the rows and every reveal is
   * forgotten — a keyed `@for` otherwise reuses the block under the same item id and a revealed
   * card would survive the fetch that was supposed to cover it (T-20's trap, T-25's fix). An
   * append (`Load more`) leaves it alone: the rows already on screen are the same view.
   */
  revealEpoch?: Derived<number> | number;
  onOpen?: (event: MouseEvent, item: AuthoredItem) => void;
  /** A listing that filters by tag hands this down so a card's tags can feed the filter. */
  onTagClick?: (tag: string) => void;
  /** Accessible name for the list, e.g. `Characters`. */
  label?: string;
  /** The listing's empty state, rendered inside the grid when there is nothing to draw. */
  children?: Children;
}) @{
  /** Rows carry their own key: the item's identity **and** the fetch it arrived in. */
  const cells = track(() =>
    read(items).map((item) => ({
      key: `${item.id}#${read(revealEpoch)}`,
      item,
    })),
  );

  @if (read(items).length === 0) {
    <div class="card-grid-empty">{children}</div>
  } @else {
    <ul class="card-grid" aria-label={label}>
      @for (const cell of cells.value; key cell.key) {
        <li class="card-cell">
          <Card
            item={cell.item}
            nsfw={cell.item.nsfw}
            blur={blurNsfw}
            onOpen={onOpen ? (event) => onOpen(event, cell.item) : undefined}
            onTagClick={onTagClick}
          />
        </li>
      }
    </ul>
  }
}
