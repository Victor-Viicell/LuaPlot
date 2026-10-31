import type { BookmarkKind } from "../data/types.ts";
import { at, CHARACTER, LOREBOOK, POST, PRESET, uuid } from "./ids.ts";

/**
 * The viewer's saved rows, seeded so `/bookmarks` opens worth looking at — one catalog per tab, and
 * **one dead card out of the box** (`pages/bookmarks.md` → *Data*: *a bookmark outlives the item*).
 *
 * The dead row is a saved key with **no item behind it**, which is exactly what the adapter leaves
 * behind when an author deletes a character: the key survives, the row does not. Seeding it is
 * cheaper and more honest than a `--seed` step that deletes a fixture, and it means the preview
 * shows the state T-21 exists to draw without anyone clicking Delete first.
 *
 * Order is by `savedAt`, and the newest row here is the dead character — so the page's default tab
 * (the type holding the most recently saved item) is Characters, the spec's own list order.
 */
export type BookmarkSeed = { kind: BookmarkKind; id: string; savedAt: string };

/** A bucket of its own, so this id cannot collide with any fixture row. */
const GONE_CHARACTER = uuid(0xbeef0000, 1);

export const BOOKMARKS: BookmarkSeed[] = [
  { kind: "character", id: GONE_CHARACTER, savedAt: at(31, 8, 15) },
  { kind: "post", id: POST(1), savedAt: at(30, 21, 5) },
  { kind: "character", id: CHARACTER(5), savedAt: at(29, 12, 0) },
  { kind: "lorebook", id: LOREBOOK(1), savedAt: at(28, 16, 30) },
  { kind: "character", id: CHARACTER(2), savedAt: at(27, 10, 45) },
  { kind: "preset", id: PRESET(1), savedAt: at(26, 9, 20) },
  { kind: "post", id: POST(3), savedAt: at(25, 19, 10) },
  { kind: "lorebook", id: LOREBOOK(2), savedAt: at(24, 11, 0) },
];
