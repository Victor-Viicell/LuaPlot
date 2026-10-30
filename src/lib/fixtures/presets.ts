import type { Preset } from "../data/types.ts";
import { at, PRESET } from "./ids.ts";

/**
 * Five presets. `settings` is a flat list of whatever the generation layer exposes
 * (`preset/create.md`); `model` is the only field the spec names, and the provider behind it
 * belongs to the app — it is never a field here.
 *
 * No version or compatibility marker: presets are not versioned, so nothing claims a match with
 * the current build.
 */
export const PRESETS: Preset[] = [
  {
    id: PRESET(1),
    kind: "preset",
    name: "Quiet Draft",
    author: "you",
    tagline: "Short replies, low heat. For thinking out loud.",
    description:
      "Tuned for scene-setting: the character answers in two or three sentences and leaves room for the user. Low temperature, no flourish.",
    nsfw: false,
    avatar: { initials: "QD" },
    isPublic: true,
    verified: true,
    tags: [],
    likes: 57,
    dislikes: 2,
    bookmarks: 23,
    commentCount: 0,
    createdAt: at(4, 10, 30),
    updatedAt: at(20, 10, 30),
    settings: { model: "deepseek-chat" },
  },
  {
    id: PRESET(2),
    kind: "preset",
    name: "Long Table",
    author: "ada",
    tagline: "Long answers, dense detail, no summary.",
    description:
      "For lore-heavy scenes where the character is expected to hold the room. Wide context, higher verbosity, little narrative restraint.",
    nsfw: false,
    avatar: { initials: "LT" },
    isPublic: true,
    verified: true,
    tags: [],
    likes: 41,
    dislikes: 9,
    bookmarks: 18,
    commentCount: 0,
    createdAt: at(6, 8, 5),
    updatedAt: at(6, 8, 5),
    settings: { model: "deepseek-reasoner" },
  },
  {
    id: PRESET(3),
    kind: "preset",
    name: "Cold Open",
    author: "bram",
    tagline: "No preamble: the first line is already the scene.",
    description:
      "Opens mid-action and refuses to recap. The character never explains itself, so the user has to read the situation.",
    nsfw: false,
    avatar: { initials: "CO" },
    isPublic: true,
    verified: true,
    tags: [],
    likes: 88,
    dislikes: 4,
    bookmarks: 44,
    commentCount: 0,
    createdAt: at(7, 15, 45),
    updatedAt: at(24, 12, 10),
    settings: { model: "deepseek-chat" },
  },
  {
    id: PRESET(4),
    kind: "preset",
    name: "Two-Hander",
    author: "mira",
    tagline: "Balanced turns, one idea per reply.",
    description:
      "Keeps a two-character conversation even: the reply mirrors the length of the last user turn and commits to a single beat.",
    nsfw: false,
    avatar: { initials: "2H" },
    isPublic: true,
    verified: false,
    tags: [],
    likes: 26,
    dislikes: 3,
    bookmarks: 11,
    commentCount: 0,
    createdAt: at(9, 21, 0),
    updatedAt: at(9, 21, 0),
    settings: { model: "deepseek-chat" },
  },
  {
    id: PRESET(5),
    kind: "preset",
    name: "Night Ledger",
    author: "sable",
    tagline: "Slow, close, adult. Flagged for a reason.",
    description:
      "A deliberately slow register for adult scenes: measured pacing, close attention, no fade to black. The preset itself carries the NSFW flag, as every create and edit surface must.",
    nsfw: true,
    avatar: { initials: "NL" },
    isPublic: true,
    verified: false,
    tags: [],
    likes: 34,
    dislikes: 19,
    bookmarks: 6,
    commentCount: 0,
    createdAt: at(14, 23, 15),
    updatedAt: at(28, 1, 0),
    settings: { model: "deepseek-reasoner" },
  },
];
