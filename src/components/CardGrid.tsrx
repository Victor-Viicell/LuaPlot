import type { Children } from "ripple";
import type { AuthoredItem } from "../lib/data/types.ts";
import { Card } from "./Card.tsrx";

/**
 * The listing grid every catalogue reuses: 1-up at 360, 2-up at `sm` (640), 3-up at `md` (900),
 * 4-up at `lg` (1200). A **gutter grid** (12/16/20px gaps) with the cards' own 1px border and 6px
 * radius — not the 1px-gap count-strip gesture, which needs square corners and would fight the
 * card radius (`docs/DESIGN.md` → Cards, decided in T-08).
 *
 * The grid is the listing's chrome, so it owns the two listing-level decisions and the card owns
 * none of them: `blurNsfw` is the account's Blur preference (the caller reads the store) and is
 * ANDed with each item's own flag to produce the card's effective cover flag. With Blur off a
 * flagged item draws crisp; with it on, that one card is covered until its own Reveal.
 *
 * A `<ul>` because it is a list of items: the `li` carries the layout, the card carries the
 * meaning. The link on each title is the entry point (plus `onOpen` for a page that wants the
 * event); nothing here is a clickable `<div>`.
 */
export function CardGrid({
  items,
  blurNsfw = false,
  onOpen,
  label,
  children,
}: {
  items: AuthoredItem[];
  /** The account's Blur NSFW preference — the card never reads the store. */
  blurNsfw?: boolean;
  onOpen?: (event: MouseEvent, item: AuthoredItem) => void;
  /** Accessible name for the list, e.g. `Characters`. */
  label?: string;
  /** The listing's empty state, rendered inside the grid when there is nothing to draw. */
  children?: Children;
}) @{
  @if (items.length === 0) {
    <div class="card-grid-empty">{children}</div>
  } @else {
    <ul class="card-grid" aria-label={label}>
      @for (const item of items; key item.id) {
        <li class="card-cell">
          <Card
            {item}
            nsfw={item.nsfw && blurNsfw}
            onOpen={onOpen ? (event) => onOpen(event, item) : undefined}
          />
        </li>
      }
    </ul>
  }
}
