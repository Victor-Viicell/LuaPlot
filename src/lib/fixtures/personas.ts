import type { Persona } from "../data/types.ts";
import { at, PERSONA } from "./ids.ts";

/**
 * Three personas, all owned by `you` — a persona belongs to exactly one account and has no
 * public catalog, so there is no other owner to seed.
 *
 * No likes, dislikes, ratios, comment counts, bookmarks or NSFW flag: this type carries none of
 * them, and a field here would describe a feature the spec refuses. `isDefault` sits on exactly
 * one persona once the collection holds any, and moves in the same step as a delete.
 */
export const PERSONAS: Persona[] = [
  {
    id: PERSONA(1),
    owner: "you",
    name: "Nell",
    tagline: "Blunt, curious, asks the question nobody wants.",
    description:
      "Nell is a dock clerk who has read more than she lets on. She talks in short sentences, notices what is left out, and would rather be rude than vague. Default persona: every new session starts under this name.",
    avatar: { initials: "NL" },
    isDefault: true,
    verified: true,
    createdAt: at(1, 7, 30),
    updatedAt: at(22, 18, 0),
  },
  {
    id: PERSONA(2),
    owner: "you",
    name: "The Correspondent",
    tagline: "Writes letters, waits for answers, never hurries.",
    description:
      "A voice for slow scenes: formal, warm, faintly archaic. Sentences run long. Questions are asked politely and answered in the next message rather than the same one.",
    avatar: { initials: "TC" },
    isDefault: false,
    verified: false,
    createdAt: at(8, 13, 20),
    updatedAt: at(8, 13, 20),
  },
  {
    id: PERSONA(3),
    owner: "you",
    name: "Ash",
    tagline: "Tired pilot. Dry humour, no patience.",
    description:
      "Ash works a night shift nobody assigned her. She swears mildly, deflects sincerely, and gives ground only when a fact forces her to.",
    avatar: { initials: "AS" },
    isDefault: false,
    verified: true,
    createdAt: at(16, 4, 10),
    updatedAt: at(27, 4, 10),
  },
];
