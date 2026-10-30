import type { Session } from "../data/types.ts";
import { at, CHARACTER, LOREBOOK, PERSONA, PRESET, SESSION } from "./ids.ts";

/**
 * Two sessions, both owned by `you` (a session is participant-only, and there is no session list
 * anywhere: it is reached by the character's **Continue** or by its own URL).
 *
 * Every participant is a copy that keeps its original's id. Session 1 is the ordinary state:
 * copies untouched, both lorebook links live. Session 2 proves the other two states at once — the
 * character copy is `edited` (so **Restore** is offered) and the lorebook copy is `unlinked`,
 * because its original `LOREBOOK(6)` is now private (`lorebooks.ts`), which costs the link and
 * nothing else.
 *
 * The persona is *not* a copy: it is a live reference to the owner's persona, swappable
 * mid-session, and a switch leaves no mark on the transcript.
 */
export const SESSIONS: Session[] = [
  {
    id: SESSION(1),
    owner: "you",
    character: {
      kind: "character",
      sourceId: CHARACTER(1),
      version: 4,
      edited: false,
      unlinked: false,
      name: "Aurelia of the Tides",
      inSessionName: "Aurelia",
      description:
        "Aurelia reads the water. She was raised on a salvage barge and learned the currents the way other people learn letters. She speaks plainly and treats every shipwreck as a library.",
      avatar: { initials: "AT" },
    },
    lorebooks: [
      {
        kind: "lorebook",
        sourceId: LOREBOOK(1),
        version: 2,
        edited: false,
        unlinked: false,
        name: "The Salt Archive",
        description: "Records kept below the tideline, in salt and wax.",
        entries: [
          {
            id: "sa-1",
            keywords: ["archive", "strongroom", "below"],
            content:
              "The Salt Archive occupies a basalt strongroom six fathoms down, entered through a hatch that only opens on a falling tide.",
          },
          {
            id: "sa-3",
            keywords: ["ledger", "borrowed name", "mother"],
            content:
              "The borrowed-name ledger records everyone who ever sailed under a name that was not theirs.",
          },
        ],
      },
      {
        kind: "lorebook",
        sourceId: LOREBOOK(2),
        version: 1,
        edited: false,
        unlinked: false,
        name: "Ashmarket Gazetteer",
        description: "Every stall, every debt, every rumour with a stall number.",
        entries: [
          {
            id: "ag-3",
            keywords: ["salvage", "barge", "crew"],
            content: "Salvage crews sign on for a share, not a wage. A crew of five splits four ways.",
          },
        ],
      },
    ],
    preset: {
      kind: "preset",
      sourceId: PRESET(1),
      version: 3,
      edited: false,
      unlinked: false,
      name: "Quiet Draft",
      description: "Short replies, low heat. For thinking out loud.",
      settings: { model: "deepseek-chat" },
    },
    personaId: PERSONA(1),
    turns: [
      {
        id: "s1t1",
        role: "character",
        text: "The hatch lifts a hand's width, then stops. Water goes over the lip in a sheet and Aurelia swears, once, without heat. 'Wrong tide. Give it a minute.'",
        at: at(24, 16, 40),
      },
      {
        id: "s1t2",
        role: "user",
        text: "We don't have a minute. The barge is already dragging on the reef.",
        at: at(24, 16, 41),
      },
      {
        id: "s1t3",
        role: "character",
        text: "She looks at you the way she looks at a manifest that does not add up. 'Then we go in wet, and we do not read anything we cannot carry.' She pulls the hatch wide and drops through before you can argue.",
        at: at(24, 16, 43),
      },
      {
        id: "s1t4",
        role: "user",
        text: "Inside. Salt everywhere, and the panels are stacked like roof tiles. What's the first one that isn't blank?",
        at: at(24, 16, 50),
      },
      {
        id: "s1t5",
        role: "character",
        text: "'Second stack, third panel down.' She does not look at it; she is listening to the water behind her. 'It has a cut in the page and new thread in the cut. Somebody re-sewed it.'",
        at: at(24, 16, 52),
      },
      {
        id: "s1t6",
        role: "user",
        text: "Can you read it by touch?",
        at: at(24, 16, 55),
      },
      {
        id: "s1t7",
        role: "character",
        text: "Aurelia runs her thumb along the panel, slowly, twice. 'Some of it. A name I don't know, and a date I do.' She stops. 'That is my mother's year, and it is not her hand.'",
        at: at(24, 17, 2),
      },
      {
        id: "s1t8",
        role: "user",
        text: "Take it with us. We'll read it on the barge.",
        at: at(24, 17, 4),
      },
    ],
    createdAt: at(24, 16, 35),
    updatedAt: at(24, 17, 4),
  },
  {
    id: SESSION(2),
    owner: "you",
    character: {
      kind: "character",
      sourceId: CHARACTER(8),
      version: 2,
      edited: true,
      unlinked: false,
      name: "The Ninth Engine",
      inSessionName: "Ninth",
      description:
        "A machine voice with a house around it. It speaks in measurements, offers no comfort, and becomes more precise the less it knows. (Rewritten inside this session: the voice is now second person, which the original is not.)",
      avatar: { initials: "NE" },
    },
    lorebooks: [
      {
        kind: "lorebook",
        sourceId: LOREBOOK(6),
        version: 1,
        edited: false,
        unlinked: true,
        name: "Unfiled Notes on the Ninth",
        description: "Loose pages about a machine that answers in measurements.",
        entries: [
          {
            id: "un-1",
            keywords: ["Ninth", "engine", "measurement"],
            content:
              "Every answer the Ninth Engine gives is a measurement: a distance, a duration, a count of something.",
          },
          {
            id: "un-2",
            keywords: ["house", "rooms", "doors"],
            content: "The house has eleven rooms and nine doors. Two rooms are reached only through the other two.",
          },
        ],
      },
    ],
    preset: {
      kind: "preset",
      sourceId: PRESET(3),
      version: 1,
      edited: false,
      unlinked: false,
      name: "Cold Open",
      description: "No preamble: the first line is already the scene.",
      settings: { model: "deepseek-chat" },
    },
    personaId: PERSONA(3),
    turns: [
      {
        id: "s2t1",
        role: "character",
        text: "You are standing 1.4 metres inside the doorway. The corridor ahead is 11 metres long and lit at intervals of 2.7 metres. Nothing in it is moving except the air.",
        at: at(27, 21, 10),
      },
      {
        id: "s2t2",
        role: "user",
        text: "Which room is the warm one?",
        at: at(27, 21, 12),
      },
      {
        id: "s2t3",
        role: "character",
        text: "The third door on your left is 0.9 degrees warmer than the corridor at the same height. This is not a measurement of occupancy.",
        at: at(27, 21, 13),
      },
      {
        id: "s2t4",
        role: "user",
        text: "That's not what I asked.",
        at: at(27, 21, 15),
      },
      {
        id: "s2t5",
        role: "character",
        text: "Correct. The question 'which room is the warm one' has no measured answer. The question you intended has 0.4 probability of being answerable from inside this house.",
        at: at(27, 21, 16),
      },
      {
        id: "s2t6",
        role: "user",
        text: "Open the third door.",
        at: at(27, 21, 20),
      },
    ],
    createdAt: at(27, 21, 5),
    updatedAt: at(27, 21, 20),
  },
];
