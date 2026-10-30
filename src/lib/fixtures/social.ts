import type { Notification, Report } from "../data/types.ts";
import { at, CHARACTER, COMMENT, LOREBOOK, NOTIFICATION, POST, REPORT } from "./ids.ts";

/**
 * Notifications are deliberately sparse: same kind on the same target folds into one row, and the
 * row carries the newest actor plus a count. Nothing here notifies about a like — engagement
 * figures never notify (`notifications.md`), and nobody is notified about their own action.
 *
 * One moderation row is present because a decision on your own content always reaches you, and
 * the row has to name the measure: `measure` is the field that keeps the sentence short without
 * restating the reasons, which stay on the content page.
 */
export const NOTIFICATIONS: Notification[] = [
  {
    id: NOTIFICATION(1),
    kind: "comment",
    actor: "ada",
    target: { kind: "post", id: POST(1), label: "\"Started a character with no combat stats…\"" },
    count: 2,
    read: false,
    createdAt: at(20, 11, 5),
  },
  {
    id: NOTIFICATION(2),
    kind: "comment",
    actor: "ada",
    target: { kind: "character", id: CHARACTER(1), label: "Aurelia of the Tides" },
    count: 1,
    read: false,
    createdAt: at(24, 18, 10),
  },
  {
    id: NOTIFICATION(3),
    kind: "new-content",
    actor: "mira",
    target: { kind: "character", id: CHARACTER(7), label: "Sister Ivaine" },
    count: 1,
    read: false,
    createdAt: at(13, 19, 0),
  },
  {
    id: NOTIFICATION(4),
    kind: "new-content",
    actor: "ada",
    target: { kind: "lorebook", id: LOREBOOK(2), label: "Ashmarket Gazetteer" },
    count: 3,
    read: true,
    createdAt: at(19, 11, 30),
  },
  {
    id: NOTIFICATION(5),
    kind: "follow",
    actor: "quill",
    target: { kind: "user", id: "quill", label: "quill" },
    count: 1,
    read: true,
    createdAt: at(18, 8, 0),
  },
  {
    id: NOTIFICATION(6),
    kind: "moderation",
    target: { kind: "character", id: CHARACTER(4), label: "Hollow Saint" },
    count: 1,
    read: true,
    createdAt: at(29, 3, 12),
    measure: "made-private",
  },
];

/**
 * Four cases, two open. Weight is the cumulative report count and the queue orders on it; the
 * reasons keep their own detail so a moderator sees the spread, not just the total.
 *
 * Nothing here is a case JEV already decided on its own: an immediate action opens no case and
 * never enters `/moderation` (`systems/jev.md`). So `jev.action` is `escalated` on every open one.
 */
export const REPORTS: Report[] = [
  {
    id: REPORT(1),
    target: { kind: "character", id: CHARACTER(4), label: "Hollow Saint" },
    reasons: [
      {
        part: "avatar",
        reason: "missing-nsfw",
        details: "The avatar is explicit and the item is flagged SFW in the catalog card.",
        at: at(28, 22, 40),
      },
      {
        part: "text",
        reason: "copied-text",
        details: "The first paragraph appears to come from another character on the site.",
        source: CHARACTER(3),
        at: at(29, 1, 15),
      },
      { part: "text", reason: "illegal", details: "Reporter could not name a specific rule.", at: at(29, 1, 20) },
      { part: "avatar", reason: "missing-nsfw", at: at(29, 6, 5) },
      { part: "avatar", reason: "missing-nsfw", at: at(29, 7, 40) },
      { part: "text", reason: "copied-text", source: CHARACTER(3), at: at(29, 9, 0) },
    ],
    weight: 6,
    status: "open",
    jev: {
      verdict: "unsure",
      confidence: 0.58,
      action: "escalated",
      note: "Copied text claimed with an internal source that does not resolve to a comparable body; avatar read as borderline.",
      at: at(29, 9, 1),
    },
    createdAt: at(28, 22, 40),
    lastReportAt: at(29, 9, 0),
  },
  {
    id: REPORT(2),
    target: { kind: "post", id: POST(7), label: "\"The closed chapter's litany…\"" },
    reasons: [
      {
        part: "avatar",
        reason: "copied-image",
        details: "Image looks lifted from an artist's portfolio; no source given.",
        at: at(27, 12, 30),
      },
      { part: "text", reason: "missing-nsfw", at: at(27, 13, 0) },
      { part: "avatar", reason: "copied-image", at: at(28, 9, 45) },
    ],
    weight: 3,
    status: "open",
    jev: {
      verdict: "unsure",
      confidence: 0.44,
      action: "escalated",
      note: "A copied image always needs a moderator: visual comparison is not precise enough to automate.",
      at: at(28, 9, 46),
    },
    createdAt: at(27, 12, 30),
    lastReportAt: at(28, 9, 45),
  },
  {
    id: REPORT(3),
    target: { kind: "comment", id: COMMENT(12), label: "Comment by you on a flagged post" },
    reasons: [
      {
        part: "text",
        reason: "missing-nsfw",
        details: "Reply in an adult thread posted without its own flag.",
        at: at(23, 14, 0),
      },
      { part: "text", reason: "missing-nsfw", at: at(23, 16, 20) },
    ],
    weight: 2,
    status: "concluded",
    jev: {
      verdict: "violation",
      confidence: 0.91,
      action: "escalated",
      note: "Flag missing on the comment's own row, not inherited from the post.",
      at: at(23, 16, 21),
    },
    createdAt: at(23, 14, 0),
    lastReportAt: at(23, 16, 20),
    concludedAt: at(24, 10, 0),
  },
  {
    id: REPORT(4),
    target: { kind: "lorebook", id: LOREBOOK(6), label: "Unfiled Notes on the Ninth" },
    reasons: [
      { part: "text", reason: "copied-text", details: "Claimed as copied from an outside document.", source: "https://example.org/notes", at: at(13, 9, 0) },
      { part: "text", reason: "copied-text", source: "https://example.org/notes", at: at(13, 10, 0) },
      { part: "text", reason: "copied-text", source: "https://example.org/notes", at: at(13, 11, 0) },
      { part: "text", reason: "copied-text", source: "https://example.org/notes", at: at(13, 12, 0) },
      { part: "text", reason: "copied-text", source: "https://example.org/notes", at: at(13, 13, 0) },
      { part: "text", reason: "copied-text", source: "https://example.org/notes", at: at(13, 14, 0) },
      { part: "text", reason: "copied-text", source: "https://example.org/notes", at: at(13, 15, 0) },
      { part: "text", reason: "copied-text", source: "https://example.org/notes", at: at(13, 16, 0) },
      { part: "text", reason: "copied-text", source: "https://example.org/notes", at: at(13, 17, 0) },
    ],
    weight: 9,
    status: "concluded",
    jev: {
      verdict: "unsure",
      confidence: 0.5,
      action: "escalated",
      note: "Copied text whose source is outside LuaPlot: JEV never fetches an outside source.",
      at: at(13, 17, 1),
    },
    createdAt: at(13, 9, 0),
    lastReportAt: at(13, 17, 0),
    concludedAt: at(15, 16, 30),
  },
];
