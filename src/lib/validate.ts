/**
 * The onboarding field readings — the *reporting* half of the handle rule, not the rule itself.
 *
 * `src/lib/schema.ts` owns the rule now (T-07B): `handleSchema` trims, lowercases and validates,
 * `displayNameSchema` trims and collapses, and `HANDLE_RULE` **is** that schema's message. This
 * module only turns a `safeParse` into the two shapes the form already consumes
 * (`{ handle, problem }` / `{ name, problem }`) and classifies the failure from the `ZodError`
 * issue code, so there is no second regex to drift from the schema's and no normalisation here at
 * all — a page never trims what the schema already trimmed.
 *
 * **Uniqueness is not here.** Whether a handle is free is the adapter's question
 * (`repo.isHandleTaken`), exactly like one-vote-per-viewer — the preview cannot answer it by
 * scanning fixtures without making the check a page's opinion.
 */
import { type ZodError } from "zod";
import { HANDLE_MAX, HANDLE_MIN, displayNameSchema, handleSchema } from "./schema.ts";

export { HANDLE_MAX, HANDLE_MIN };

/**
 * The one sentence the form shows for a handle that does not match. Re-exported from the schema
 * rather than restated, so the inline error, the Finish gate and a failed save cannot disagree.
 */
export { HANDLE_RULE } from "./schema.ts";

export type HandleProblem = "required" | "format" | null;

export type HandleReading = {
  /** What gets saved: trimmed and lowercased by the schema. `Avis_2` and `avis_2` are one handle. */
  handle: string;
  /** `null` when the value may be claimed; otherwise the reason the form reports. */
  problem: HandleProblem;
};

/**
 * Read a typed handle through the schema — the one rule, including the decision to accept and
 * lowercase uppercase *input* while rejecting length and alphabet.
 *
 * A failure is classified from the issue the schema emitted: the presence pipe reports
 * `too_small` with `minimum: 1`, which is *required*; every other issue is a format failure. The
 * normalised value is still returned on failure, so the page can keep showing what was typed.
 */
export function readHandle(raw: string): HandleReading {
  const result = handleSchema.safeParse(raw);
  if (result.success) return { handle: result.data, problem: null };

  const issue = (result.error as ZodError).issues[0];
  const missing =
    issue !== undefined && issue.code === "too_small" && "minimum" in issue && Number(issue.minimum) === 1;
  return { handle: raw.trim().toLowerCase(), problem: missing ? "required" : "format" };
}

export type NameReading = {
  /** Trimmed, with runs of whitespace collapsed: a display name is a label, not a document. */
  name: string;
  /** `null` when the field may be saved. Duplicates are allowed, so this is only emptiness. */
  problem: "required" | null;
};

/** Read a typed display name through the schema: required, free text, never part of a URL. */
export function readDisplayName(raw: string): NameReading {
  const result = displayNameSchema.safeParse(raw);
  if (result.success) return { name: result.data, problem: null };
  // The schema's only display-name failure is emptiness, so there is nothing to salvage.
  return { name: "", problem: "required" };
}
