/**
 * The onboarding handle rule, in one place (`src/specs/pages/onboarding.md`).
 *
 * The spec makes the handle the only URL an account has and the first field in the repo that is
 * mechanically checkable, so the rule is a pure function rather than a regex repeated in a page, an
 * inline error and a Finish gate. `readHandle` is the single answer all three read: the inline
 * error and the submit gate cannot disagree because there is nothing to disagree with.
 *
 * **Uniqueness is not here.** Whether a handle is free is the adapter's question
 * (`repo.isHandleTaken`), exactly like one-vote-per-viewer — the preview cannot answer it by
 * scanning fixtures without making the check a page's opinion.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

/**
 * The one sentence the form shows for a handle that does not match. The spec dictates only the
 * taken copy (`Username taken`) and names no alternative, so this is the format line it leaves to
 * us: factual, one rule, no encouragement.
 */
export const HANDLE_RULE = "Lowercase letters, digits and underscores, 3–24 characters.";

export type HandleProblem = "required" | "format" | null;

export type HandleReading = {
  /** What gets saved: trimmed and lowercased. `Avis_2` and `avis_2` are the same handle. */
  handle: string;
  /** `null` when the value may be claimed; otherwise the reason the form reports. */
  problem: HandleProblem;
};

const PATTERN = /^[a-z0-9_]+$/;

/**
 * Read a typed handle. Uppercase input is accepted and normalized (`lowercased on save`), because
 * the spec's constraint is on what an account holds, not on what a keyboard produces — a phone
 * capitalizes the first letter of every field, and rejecting that would be a rule the spec does
 * not have. Everything else (length, alphabet) is rejected rather than repaired.
 */
export function readHandle(raw: string): HandleReading {
  const handle = raw.trim().toLowerCase();
  if (!handle) return { handle, problem: "required" };
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX || !PATTERN.test(handle)) {
    return { handle, problem: "format" };
  }
  return { handle, problem: null };
}

export type NameReading = {
  /** Trimmed, with runs of whitespace collapsed: a display name is a label, not a document. */
  name: string;
  /** `null` when the field may be saved. Duplicates are allowed, so this is only emptiness. */
  problem: "required" | null;
};

/** Read a typed display name. Required, free text, never part of a URL, duplicates allowed. */
export function readDisplayName(raw: string): NameReading {
  const name = raw.trim().replace(/\s+/g, " ");
  return { name, problem: name ? null : "required" };
}
