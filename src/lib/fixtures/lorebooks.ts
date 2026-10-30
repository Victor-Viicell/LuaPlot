import type { Lorebook } from "../data/types.ts";
import { at, LOREBOOK } from "./ids.ts";

/**
 * Six lorebooks. Every character references them by id (`characters.ts`), and editing one changes
 * what every character reads — attachments are references, never copies.
 *
 * `LOREBOOK(6)` ("Unfiled Notes on the Ninth") is deliberately *unreachable from a session*: the
 * second fixture session takes a copy of it whose original is gone, so the copy carries
 * `unlinked: true` and no link actions. That is the state T-15 has to prove, and it is cheaper to
 * seed it than to fake it in a test.
 */
export const LOREBOOKS: Lorebook[] = [
  {
    id: LOREBOOK(1),
    kind: "lorebook",
    name: "The Salt Archive",
    author: "you",
    tagline: "Records kept below the tideline, in salt and wax.",
    description:
      "What the reef keeps, and who is allowed to read it. Entries are written on whalebone panels and stored in a drowned strongroom; the water is the lock.",
    nsfw: false,
    avatar: { initials: "SA" },
    isPublic: true,
    verified: true,
    tags: [],
    likes: 44,
    dislikes: 2,
    bookmarks: 27,
    commentCount: 0,
    createdAt: at(1, 9, 10),
    updatedAt: at(23, 15, 0),
    entries: [
      {
        id: "sa-1",
        keywords: ["archive", "strongroom", "below"],
        content:
          "The Salt Archive occupies a basalt strongroom six fathoms down, entered through a hatch that only opens on a falling tide. Nothing inside is dry. Panels are read by touch, then copied onto wax before the reading is spoken aloud.",
      },
      {
        id: "sa-2",
        keywords: ["tide-reader", "Aurelia", "reader"],
        content:
          "A tide-reader is licensed, not born. The licence is a brass token stamped with the year of the last drowning; the archive keeps the register of every token ever issued, and a reader who loses hers is not replaced.",
      },
      {
        id: "sa-3",
        keywords: ["ledger", "borrowed name", "mother"],
        content:
          "The borrowed-name ledger records everyone who ever sailed under a name that was not theirs. One line is entered in an unfamiliar hand and left unsigned — the page has been cut and re-sewn twice.",
      },
      {
        id: "sa-4",
        keywords: ["fine", "penalty", "law"],
        content:
          "Reading a panel without a token costs a season's salvage. Quoting one aloud costs the reader's name, which the archive then holds in escrow until the debt is repaid in full.",
      },
    ],
  },
  {
    id: LOREBOOK(2),
    kind: "lorebook",
    name: "Ashmarket Gazetteer",
    author: "ada",
    tagline: "Every stall, every debt, every rumour with a stall number.",
    description:
      "A working guide to Ashmarket: what is sold where, who fronts whom, and which alleys change their names after dark. Dry, alphabetical, quietly judgemental.",
    nsfw: false,
    avatar: { initials: "AG" },
    isPublic: true,
    verified: true,
    tags: [],
    likes: 88,
    dislikes: 5,
    bookmarks: 61,
    commentCount: 0,
    createdAt: at(2, 12, 0),
    updatedAt: at(19, 11, 30),
    entries: [
      {
        id: "ag-1",
        keywords: ["Ashmarket", "market", "layout"],
        content:
          "Ashmarket is four streets and a yard. The streets are named for what burned there; the yard is named for nothing, which is how you know it is the important part.",
      },
      {
        id: "ag-2",
        keywords: ["chandler", "shop", "upstairs room"],
        content:
          "The chandler's shop on Rope Row rents its upper floor to a cartographer who pays in maps and never in coin. Ask for the stairs, not the map.",
      },
      {
        id: "ag-3",
        keywords: ["salvage", "barge", "crew"],
        content:
          "Salvage crews sign on for a share, not a wage. A crew of five splits four ways: the barge keeps one, and nobody argues about it twice.",
      },
      {
        id: "ag-4",
        keywords: ["rumour", "whisper", "night"],
        content:
          "After dark the alleys swap names on the painted boards. A guide older than a week is a liability, which is why the Gazetteer is reissued every season and never reprinted.",
      },
    ],
  },
  {
    id: LOREBOOK(3),
    kind: "lorebook",
    name: "Litany of the Drowned Choir",
    author: "sable",
    tagline: "The order's vows, sung once and never repeated.",
    description:
      "The closed chapter that produced the Hollow Saint: its vows, its silences, and the practical arrangements it made for a god that stopped answering.",
    nsfw: false,
    avatar: { initials: "DC" },
    isPublic: true,
    verified: false,
    tags: [],
    likes: 31,
    dislikes: 12,
    bookmarks: 9,
    commentCount: 0,
    createdAt: at(6, 18, 40),
    updatedAt: at(17, 21, 0),
    entries: [
      {
        id: "dc-1",
        keywords: ["vow", "silence", "order"],
        content:
          "The order took four vows: silence, attendance, repair, and return. Silence was the only one with a penalty, and the penalty was more silence.",
      },
      {
        id: "dc-2",
        keywords: ["choir", "litany", "singing"],
        content:
          "The litany is sung once per tide and never written down. Each voice is taught its own line in isolation, so no member of the choir ever heard the whole piece — a precaution, not a cruelty.",
      },
      {
        id: "dc-3",
        keywords: ["lighthouse", "Ivaine", "last"],
        content:
          "One lamp was left lit after the chapter closed. The keeper who tends it keeps the fourth vow on behalf of everyone who stopped.",
      },
    ],
  },
  {
    id: LOREBOOK(4),
    kind: "lorebook",
    name: "House Verity: Lineage and Debt",
    author: "bram",
    tagline: "Three generations, one signature, no survivors of the audit.",
    description:
      "A family history written to settle a claim. Names, marriages, and the ledger entries that outlive the people who signed them.",
    nsfw: false,
    avatar: { initials: "HV" },
    isPublic: true,
    verified: true,
    tags: [],
    likes: 27,
    dislikes: 1,
    bookmarks: 14,
    commentCount: 0,
    createdAt: at(8, 9, 55),
    updatedAt: at(8, 9, 55),
    entries: [
      {
        id: "hv-1",
        keywords: ["Verity", "house", "lineage"],
        content:
          "House Verity holds its land by a signature, not a title. The signature is on a bond that has been renewed four times and is now, technically, held by a bank that no longer exists.",
      },
      {
        id: "hv-2",
        keywords: ["audit", "debt", "ledger"],
        content:
          "The audit of the third generation found every account in order and every heir missing. The house has been administered by trustees since, who meet annually and decide nothing.",
      },
    ],
  },
  {
    id: LOREBOOK(5),
    kind: "lorebook",
    name: "The Cartographer's Marginalia",
    author: "ada",
    tagline: "Notes written in the gaps of other people's maps.",
    description:
      "What the Cartographer writes where nobody asked: corrections, arguments with dead surveyors, and the occasional apology.",
    nsfw: false,
    avatar: { initials: "CM" },
    isPublic: true,
    verified: true,
    tags: [],
    likes: 19,
    dislikes: 0,
    bookmarks: 7,
    commentCount: 0,
    createdAt: at(10, 16, 10),
    updatedAt: at(25, 13, 20),
    entries: [
      {
        id: "cm-1",
        keywords: ["margin", "correction", "survey"],
        content:
          "A margin note outranks the map it sits on. Surveyors disagree; the person who has actually stood there does not.",
      },
      {
        id: "cm-2",
        keywords: ["straight line", "coast", "drawing"],
        content:
          "A straight line on a coast is a confession that the draughtsman did not go ashore. The Cartographer has never drawn one and has been paid less for it every year.",
      },
    ],
  },
  {
    id: LOREBOOK(6),
    kind: "lorebook",
    name: "Unfiled Notes on the Ninth",
    author: "quill",
    tagline: "Loose pages about a machine that answers in measurements.",
    description:
      "Quill's working notes: measurements, contradictions, and a growing suspicion that the Engine's precision is a way of not answering.",
    nsfw: false,
    avatar: { initials: "UN" },
    isPublic: false,
    verified: false,
    tags: [],
    likes: 12,
    dislikes: 8,
    bookmarks: 3,
    commentCount: 0,
    createdAt: at(12, 20, 25),
    updatedAt: at(22, 20, 25),
    entries: [
      {
        id: "un-1",
        keywords: ["Ninth", "engine", "measurement"],
        content:
          "Every answer the Ninth Engine gives is a measurement: a distance, a duration, a count of something. Ask it how it feels and it will tell you how far away it is.",
      },
      {
        id: "un-2",
        keywords: ["house", "rooms", "doors"],
        content:
          "The house has eleven rooms and nine doors. Two rooms are reached only through the other two, which is either an oversight or the point.",
      },
      {
        id: "un-3",
        keywords: ["question", "forgotten", "build"],
        content:
          "Built to answer one question. The manual names the question nowhere; the Engineer's notes refer to it only as 'the standing item'.",
      },
    ],
  },
];
