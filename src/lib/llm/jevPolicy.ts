/**
 * The policy half of JEV — **code owns every number, the model owns every judgment.**
 *
 * `systems/jev.md` says what a classification is allowed to do; `docs/JEV.md` → *Policy* is the
 * mapping, and this file is that mapping. Nothing here calls a model, reads a clock or writes a
 * row: `jev.ts` builds the state and asks, `decision()` turns the answers into one of the four
 * actions the spec permits, and the adapter applies it. That split is what makes a threshold
 * reviewable — each constant carries the clause it comes from.
 *
 * Three rules the spec states in words, kept here as branches:
 *
 * - **A failure is `unsure`, never a silent pass** (*Failure*): no answers means the content stays
 *   as it was and the case is queued, exactly like a model that could not make up its mind.
 * - **A copied image, and copied text whose source is outside LuaPlot, are never judged** (*Scope*):
 *   they escalate with no verdict, because visual comparison and fetching an outside source are
 *   both outside what JEV may do.
 * - **`severity` is weight, not a verdict**: it is read for the note and never decides alone.
 */
import type { JevVerdict, ReportReasonCode, VotableKind } from "../data/types.ts";
import { reportSourceIsExternal } from "../schema.ts";

/**
 * Thresholds, each nailed to its clause. `docs/JEV.md` → *Policy*:
 * the minor rule never classes as unsure (`systems/jev.md` → *Rules*), a clear violation is what the
 * spec calls certain, and the band between *clear* and *unsure* is the one that goes to a person.
 */
export const JEV_MINOR_ESCALATION = 0.5;
export const JEV_CLEAR_VIOLATION = 0.85;
export const JEV_UNSURE = 0.55;
/** `docs/JEV.md` → *Policy*: an internal copy claim is compared, and 0.80 is the line it draws. */
export const JEV_SAME_TEXT = 0.8;

/** What the model answered, flattened out of the typed primitives. Absent = not asked. */
export type JevJudgment = {
  /** `noul`: any asset or the text is adult/gory while the flag is false. */
  unflagged_nsfw: number;
  /** `noul`: a realistic sexual depiction of a minor — escalation only, never a threshold call. */
  sexualizes_minor: number;
  /** `score`: position on the three-level severity line. Weight and note, never a verdict. */
  severity: number;
  /** `noul`, posts and comments only (`systems/jev.md` → *Scope* forbids it for authored text). */
  illegal_harm?: number;
  /** `noul`, second request only: are the claimed original and the candidate the same text? */
  same_text?: number;
};

/** What the report itself claims. Code's reading of the reason codes — never a model question. */
export type JevClaim = "none" | "internal" | "external" | "image";

export type JevDecision = Pick<JevVerdict, "verdict" | "confidence" | "action" | "note">;

/**
 * The claim a report carries, read from what the reporter chose rather than asked of the model:
 * the reason code already says *copied image*, and `reportSchema`'s own rule says a copy claim must
 * name a source, so *external* versus *internal* is `reportSourceIsExternal` — the same function the
 * queue prints from. Asking JEV to classify a fact the report states would be a judgment with one
 * right answer sitting in the payload.
 */
export function claimOf(reasons: readonly ReportReasonCode[], source?: string): JevClaim {
  if (reasons.includes("copied-image")) return "image";
  if (reasons.includes("copied-text")) {
    return source !== undefined && reportSourceIsExternal(source) ? "external" : "internal";
  }
  return "none";
}

/**
 * The action a clear violation earns (`systems/jev.md` → *Decisions*): authored content is made
 * private — never deleted — and a comment is removed. **A post has no status field yet** (filed as
 * its own ticket), so a certain violation on a post cannot be applied: it is recorded as
 * `escalated` with the reason in the note rather than claiming a removal the adapter did not make.
 * The moment `postSchema` grows `status`, this branch becomes `removed` and nothing else changes.
 */
function clearAction(kind: VotableKind): JevDecision["action"] {
  if (kind === "character" || kind === "lorebook" || kind === "preset") return "made-private";
  if (kind === "comment") return "removed";
  return "escalated";
}

/** The severity line's own words, for a note that says why rather than repeating a number. */
const SEVERITY_WORDS = ["no violation", "needs the NSFW flag or a fix", "would harm users if left public"];

/**
 * One decision from one set of answers.
 *
 * `judgment === null` is the model failing (5xx, timeout, a response that did not parse, or one
 * that came back from anything but a decisions model) — *unsure*, per `systems/jev.md` → *Failure*.
 */
export function decide(input: {
  kind: VotableKind;
  claim: JevClaim;
  /** True when the report points only at a visual surface: no description reached the model. */
  imageOnly: boolean;
  judgment: JevJudgment | null;
}): JevDecision {
  const { kind, claim, imageOnly, judgment } = input;

  if (judgment === null) {
    return {
      verdict: "unsure",
      confidence: 0.5,
      action: "escalated",
      note: "The model did not answer, so nothing was judged: the content is untouched and the case is queued.",
    };
  }

  // Ahead of everything, and never *unsure*: a realistic sexual depiction of a minor is escalated
  // the moment it is recognised (`systems/jev.md` → *Rules*).
  if (judgment.sexualizes_minor >= JEV_MINOR_ESCALATION) {
    return {
      verdict: "violation",
      confidence: judgment.sexualizes_minor,
      action: "escalated",
      note: "Realistic sexual depiction of a minor. Escalated ahead of the queue; the content stays public until a moderator decides.",
    };
  }

  // Copy claims are routed by what they name, never judged on an image or an outside source.
  if (claim === "image") {
    return {
      verdict: "unsure",
      confidence: 0.5,
      action: "escalated",
      note: "A copied image goes to a moderator: visual comparison is not precise enough to automate.",
    };
  }

  if (claim === "external") {
    return {
      verdict: "unsure",
      confidence: 0.5,
      action: "escalated",
      note: "Copied text whose source is outside LuaPlot: JEV never fetches an outside source.",
    };
  }

  if (claim === "internal") {
    if (judgment.same_text === undefined) {
      return {
        verdict: "unsure",
        confidence: 0.5,
        action: "escalated",
        note: "The claimed source could not be fetched, so the two texts were never compared.",
      };
    }
    if (judgment.same_text >= JEV_SAME_TEXT) {
      return {
        verdict: "violation",
        confidence: judgment.same_text,
        action: clearAction(kind),
        note: `The claimed original and this text are the same text (${Math.round(judgment.same_text * 100)}%).`,
      };
    }
    return {
      verdict: "clean",
      confidence: 1 - judgment.same_text,
      action: "none",
      note: "Compared against the claimed source; the two texts are not the same.",
    };
  }

  if (imageOnly) {
    return {
      verdict: "unsure",
      confidence: 0.5,
      action: "escalated",
      note: "The report points at an image only, and this build cannot describe one: a moderator has to look.",
    };
  }

  if (judgment.unflagged_nsfw >= JEV_CLEAR_VIOLATION) {
    const action = clearAction(kind);
    return {
      verdict: "violation",
      confidence: judgment.unflagged_nsfw,
      action,
      note:
        action === "escalated"
          ? "Flag missing and the violation is clear, but a post cannot be removed until it carries a status: escalated."
          : `Flag missing and the violation is clear (${SEVERITY_WORDS[2]}).`,
    };
  }

  if (judgment.unflagged_nsfw >= JEV_UNSURE) {
    return {
      verdict: "unsure",
      confidence: judgment.unflagged_nsfw,
      action: "escalated",
      note: `Borderline: the model reads this as ${SEVERITY_WORDS[1] ?? "a possible violation"} but not clearly enough to act.`,
    };
  }

  return {
    verdict: "clean",
    confidence: 1 - judgment.unflagged_nsfw,
    action: "none",
    note: "Scanned and found within the terms; the content is marked verified until its next edit.",
  };
}
