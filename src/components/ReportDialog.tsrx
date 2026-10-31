import { track } from "ripple";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { Sheet } from "./Sheet.tsrx";
import { Skeleton } from "./Skeleton.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import {
  REPORT_REASON_MISMATCH,
  REPORT_REASON_REQUIRED,
  REPORT_SOURCE_REQUIRED,
  REPORT_WHAT_REQUIRED,
  reasonFitsPart,
  reportWriteSchema,
} from "../lib/schema.ts";
import { shortStamp } from "../lib/format.ts";
import type { ReportPart, ReportReasonCode, ReportTarget } from "../lib/data/types.ts";

/**
 * The Report dialog (T-12) — `src/specs/components/report.md`, pointed at one target.
 *
 * Two surfaces mount it and both are the same component: a character's settings menu and a comment's
 * footer. Nothing here may be specific to either, so it takes `{ target, onClose }` and owns the
 * rest of the flow.
 *
 * What it owns, and why:
 * - **The stepper is the spec's action list**, in order: *choose what* → *choose reason* → *name the
 *   source* (only for a copy claim) → *add details* (optional) → submit. **Back** and **Cancel** never
 *   submit.
 * - **Both stops are multi-select** (`report.md` → *Rules*): a viewer can report the image *and* the
 *   text in one report, for as many reasons as apply. The reason list is the union of what the chosen
 *   surfaces allow, deselecting a surface drops the reasons that no longer fit one, and the write's
 *   own superRefine refuses a reason that fits nothing that was picked.
 * - **The reason list is the schema's table** (`REPORT_REASONS_BY_PART`), so the dialog cannot offer
 *   a code the queue has no rendering for, and the part→reason relationship exists once instead of in
 *   markup.
 * - **Every gate is the write schema.** The submit parses `reportWriteSchema`; its issues are what the
 *   inline line reads, so the dialog, the adapter and the stored reason cannot disagree.
 * - **`myReport` is read at open, not on submit** — *Already reported* has to survive a remount, and a
 *   report on already-verified content opens no case at all, so a scan of `listReports` would miss it.
 *   The existing report is drawn as a record: no second submit, no withdrawal.
 * - **The reporter never sees an outcome.** No verdict, no case id, no `jev` field, no queue position:
 *   submitted reads as submitted, and already-verified reads exactly as the spec words it (*recorded and
 *   held; a review starts once the content changes*).
 * - **Plain tracked strings, never a nullable entity in the template.** Ripple 0.4.7 loses a `null`
 *   check across a branch (T-10B), so the record and the outcome are strings/booleans, not objects.
 *
 * Mounted inside `@if` like every sheet (no `open` prop); `Sheet` portals to `document.body`.
 */

type Step = "what" | "reason" | "source" | "details";

/**
 * Which parts a surface can carry. A comment has text only; a post's attachment waits for T-14,
 * because `reportPartSchema` has no attachment value and a copied post image is not an avatar.
 * Character / lorebook / preset carry both (`report.md` → *Rules*).
 */
const PARTS_BY_KIND: Record<ReportTarget["kind"], ReportPart[]> = {
  character: ["avatar", "text"],
  lorebook: ["avatar", "text"],
  preset: ["avatar", "text"],
  post: ["text"],
  comment: ["text"],
};

const PART_LABEL: Record<ReportPart, string> = {
  avatar: "Avatar or image",
  text: "Text",
};

const REASON_LABEL: Record<ReportReasonCode, string> = {
  "missing-nsfw": "Missing NSFW flag",
  illegal: "Illegal content",
  "copied-text": "Copied text",
  "copied-image": "Copied image",
};

/** The one line of help each reason earns, in the spec's own terms. */
const REASON_HELP: Record<ReportReasonCode, string> = {
  "missing-nsfw": "The flag on the item does not match what it shows.",
  illegal: "Escalated to a moderator, not triaged as an ordinary violation.",
  "copied-text": "A copy inside LuaPlot is compared; an outside link goes to a moderator.",
  "copied-image": "Every copied image goes to a moderator.",
};

function isCopyClaim(reason: ReportReasonCode | ""): boolean {
  return reason === "copied-text" || reason === "copied-image";
}

export function ReportDialog({
  target,
  onClose,
}: {
  target: ReportTarget;
  onClose: () => void;
}) @{
  const repo = resolveRepo();

  /** The read at open. `reading` draws a skeleton, `reported` swaps the form for the record. */
  const reading = track(true);
  const reported = track(false);
  const recordMeta = track("");
  const recordSource = track("");
  const recordDetails = track("");

  const step = track<Step>("what");
  /** The surfaces and the reasons are both sets: one report can cover an image and a text. */
  const partsSel = track<ReportPart[]>([]);
  const reasonsSel = track<ReportReasonCode[]>([]);
  const source = track("");
  const details = track("");

  const error = track("");
  const busy = track(false);
  /** `""` = still in the form; otherwise *submitted*, *held* or *already*. */
  const outcome = track<"" | "submitted" | "held" | "already">("");

  const parts = PARTS_BY_KIND[target.kind];
  /** The union of what the chosen surfaces allow, in the table's order: one list, no per-part copy. */
  const offered = track<ReportReasonCode[]>(() => {
    const seen: ReportReasonCode[] = [];
    for (const code of Object.keys(REASON_LABEL) as ReportReasonCode[]) {
      if (partsSel.value.some((part) => reasonFitsPart(part, code))) seen.push(code);
    }
    return seen;
  });
  /** A copy claim is any selected reason that names a source. */
  const copyClaim = track(() => reasonsSel.value.some((code) => isCopyClaim(code)));
  /** The primary reads *Submit report* on the last stop only. */
  const last = track(() => step.value === "details");
  const primaryLabel = track(() => (last.value ? "Submit report" : "Continue"));

  repo
    .myReport(target.kind, target.id)
    .then((mine) => {
      if (mine === null) return;
      reported.value = true;
      const what = mine.parts.map((part) => PART_LABEL[part]).join(" + ");
      const why = mine.reasons.map((code) => REASON_LABEL[code]).join(", ");
      recordMeta.value = `${what} · ${why} · filed ${shortStamp(mine.at)}`;
      recordSource.value = mine.source ?? "";
      recordDetails.value = mine.details ?? "";
    })
    .catch(() => {
      // A failed read is not a report: the form stays usable and the adapter still refuses a double.
      reported.value = false;
    })
    .finally(() => {
      reading.value = false;
    });

  /** Toggle one surface. A reason that no longer fits anything gets dropped with it. */
  function pickPart(next: ReportPart): void {
    partsSel.value = partsSel.value.includes(next)
      ? partsSel.value.filter((part) => part !== next)
      : [...partsSel.value, next];

    reasonsSel.value = reasonsSel.value.filter((code) =>
      partsSel.value.some((part) => reasonFitsPart(part, code)),
    );
    error.value = "";
  }

  function pickReason(next: ReportReasonCode): void {
    reasonsSel.value = reasonsSel.value.includes(next)
      ? reasonsSel.value.filter((code) => code !== next)
      : [...reasonsSel.value, next];
    error.value = "";
  }

  function back(): void {
    error.value = "";
    if (step.value === "details") step.value = copyClaim.value ? "source" : "reason";
    else if (step.value === "source") step.value = "reason";
    else step.value = "what";
  }

  /** Advance one stop. The dialog owns the order; the copy it refuses with is the schema's. */
  function next(): void {
    if (busy.value) return;
    error.value = "";

    if (step.value === "what") {
      if (partsSel.value.length === 0) {
        error.value = REPORT_WHAT_REQUIRED;
        return;
      }
      step.value = "reason";
      return;
    }

    if (step.value === "reason") {
      if (reasonsSel.value.length === 0) {
        error.value = REPORT_REASON_REQUIRED;
        return;
      }
      if (reasonsSel.value.some((code) => !offered.value.includes(code))) {
        error.value = REPORT_REASON_MISMATCH;
        return;
      }
      step.value = copyClaim.value ? "source" : "details";
      return;
    }

    if (step.value === "source") {
      if (source.value.trim() === "") {
        error.value = REPORT_SOURCE_REQUIRED;
        return;
      }
      step.value = "details";
      return;
    }

    submit();
  }

  async function submit(): Promise<void> {
    const parsed = reportWriteSchema.safeParse({
      target,
      parts: partsSel.value,
      reasons: reasonsSel.value,
      details: details.value.trim() === "" ? undefined : details.value,
      source: source.value.trim() === "" ? undefined : source.value,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      // A missing surface/reason can only be a step that was skipped; send the reader back to it.
      if (issue?.path[0] === "parts") {
        step.value = "what";
        error.value = REPORT_WHAT_REQUIRED;
        return;
      }
      if (issue?.path[0] === "reasons") {
        step.value = "reason";
        error.value = issue.message;
        return;
      }
      error.value = issue?.message ?? "That report couldn't be filed.";
      if (issue?.path[0] === "source") step.value = "source";
      return;
    }

    busy.value = true;
    const answer = await repo.addReport(parsed.data).catch(() => null);
    busy.value = false;

    if (!answer) {
      error.value = "That report couldn't be filed.";
      return;
    }

    outcome.value = answer.state;
  }

  <>
    <style>
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* The target, named: a reviewer always knows what the report is about. */
    .target {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .target-kicker {
      margin: 0;
      color: var(--color-text-subtle);
      font-size: 11px;
      letter-spacing: 0.1em;
      line-height: 1.4;
      text-transform: uppercase;
    }

    .target-name {
      margin: 0;
      overflow: hidden;
      color: var(--color-text);
      font-size: 14px;
      line-height: 1.5;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .prompt {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 13px;
      line-height: 1.6;
    }

    .choices {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* A choice is a 44px row with a 2px lead; the accent and a tick mark every one in force —
       these are toggles, so more than one can be pressed at a time. */
    .choice {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      min-height: 44px;
      padding: 10px 36px 10px 12px;
      border: 1px solid var(--color-border);
      border-left-width: 2px;
      border-radius: 2px;
      background-color: var(--color-bg-elevated);
      color: var(--color-text);
      font: inherit;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
    }

    .choice:hover {
      border-color: var(--color-border-strong);
      background-color: var(--color-surface);
    }

    .choice[aria-pressed="true"] {
      border-color: var(--color-accent);
    }

    .choice[aria-pressed="true"]::after {
      content: "✓";
      position: absolute;
      top: 12px;
      right: 12px;
      color: var(--color-accent);
      font-size: 14px;
      line-height: 1;
    }

    .choice-label {
      font-weight: 600;
    }

    .choice-help {
      color: var(--color-text-subtle);
      font-size: 12px;
      line-height: 1.5;
    }

    .note {
      margin: 0;
      color: var(--color-text-subtle);
      font-size: 12px;
      line-height: 1.6;
    }

    .error {
      margin: 0;
      color: var(--color-danger);
      font-size: 13px;
      line-height: 1.6;
    }

    /* The primary on top at 360, the secondaries beneath it; one row from `sm`. */
    .foot {
      display: grid;
      gap: 8px;
    }

    .foot-main {
      display: grid;
    }

    .foot-main.is-alone {
      justify-content: end;
    }

    .foot-sub {
      display: flex;
      gap: 8px;
    }

    .slot {
      display: grid;
      flex: 1 1 0;
    }

    /* The record of an existing report: no submit, no withdrawal. */
    .record {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--color-border);
      border-left: 2px solid var(--color-accent);
      border-radius: 0 6px 6px 0;
      background-color: var(--color-bg-elevated);
    }

    .record-line {
      margin: 0;
      color: var(--color-text);
      font-size: 14px;
      line-height: 1.6;
    }

    .record-meta {
      margin: 0;
      color: var(--color-text-subtle);
      font-size: 12px;
      line-height: 1.6;
    }

    .record-quote {
      margin: 0;
      padding-left: 10px;
      border-left: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: 13px;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    .done {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .done-line {
      margin: 0;
      color: var(--color-text);
      font-size: 14px;
      line-height: 1.6;
    }

    .done-sub {
      margin: 0;
      color: var(--color-text-subtle);
      font-size: 13px;
      line-height: 1.6;
    }

    .loading {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    @media (min-width: 640px) {
      .foot {
        grid-template-columns: auto 1fr;
        align-items: center;
      }

      .foot-main {
        grid-column: 2;
        justify-content: end;
      }

      .foot-sub {
        grid-column: 1;
        grid-row: 1;
      }

      .slot {
        flex: 0 0 auto;
      }
    }
  </style>

  <Sheet title="Report" onClose={onClose}>
    <div class="dlg">
      <div class="target">
        <p class="target-kicker">
          {target.kind === "comment" ? "Reporting a comment" : `Reporting a ${target.kind}`}
        </p>
        <p class="target-name">{target.label}</p>
      </div>

      @if (reading.value) {
        <div class="loading" aria-busy="true" aria-label="Checking your reports">
          <Skeleton lines={2} />
        </div>
      } @else if (reported.value) {
        <>
          <div class="record">
            <p class="record-line">You already reported this.</p>
            <p class="record-meta">{recordMeta.value}</p>
            @if (recordSource.value !== "") {
              <p class="record-quote">{`Source: ${recordSource.value}`}</p>
            }
            @if (recordDetails.value !== "") {
              <p class="record-quote">{recordDetails.value}</p>
            }
            <p class="note">
              One report per item, and a report cannot be withdrawn.
            </p>
          </div>
          <div class="foot-main">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </>
      } @else if (outcome.value !== "") {
        <>
          <div class="done" role="status">
          @if (outcome.value === "held") {
            <>
              <p class="done-line">Report recorded and held.</p>
              <p class="done-sub">A review starts once the content changes.</p>
            </>
          } @else if (outcome.value === "already") {
            <>
              <p class="done-line">You already reported this.</p>
              <p class="done-sub">One report per item, and a report cannot be withdrawn.</p>
            </>
          } @else {
            <>
              <p class="done-line">Report submitted.</p>
              <p class="done-sub">It is on file. You will not see an outcome here.</p>
            </>
          }
        </div>
        <div class="foot-main">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
        </>
      } @else {
        <>
        @if (step.value === "what") {
          <>
          <p class="prompt">What are you reporting?</p>
          <ul class="choices">
            @for (const option of parts; key option) {
              <li>
                <button
                  class="choice"
                  type="button"
                  aria-pressed={partsSel.value.includes(option) ? "true" : "false"}
                  onClick={() => pickPart(option)}
                >
                  <span class="choice-label">{PART_LABEL[option]}</span>
                </button>
              </li>
            }
          </ul>
          @if (parts.length > 1) {
            <p class="note">Pick one, or both — the image and the text can go in the same report.</p>
          }
          </>
        } @else if (step.value === "reason") {
          <>
          <p class="prompt">Why?</p>
          <ul class="choices">
            @for (const option of offered.value; key option) {
              <li>
                <button
                  class="choice"
                  type="button"
                  aria-pressed={reasonsSel.value.includes(option) ? "true" : "false"}
                  onClick={() => pickReason(option)}
                >
                  <span class="choice-label">{REASON_LABEL[option]}</span>
                  <span class="choice-help">{REASON_HELP[option]}</span>
                </button>
              </li>
            }
          </ul>
          <p class="note">Pick as many as apply. One report, one weight.</p>
          </>
        } @else if (step.value === "source") {
          <>
          <p class="prompt">Where was it copied from?</p>
          <Field
            label="Source"
            value={source}
            placeholder="Character id, or a link"
            help="A copy claim names its source: the item inside LuaPlot, or an outside link."
            error={error}
            onInput={(value) => {
              source.value = value;
              error.value = "";
            }}
          />
          </>
        } @else {
          <>
          <p class="prompt">Add details (optional)</p>
          <Field
            label="Details"
            multiline={true}
            rows={3}
            value={details}
            help="A moderator reads this. Nothing about the report is shown to the author."
            error={error}
            onInput={(value) => {
              details.value = value;
              error.value = "";
            }}
          />
          </>
        }

        @if (step.value === "what" || step.value === "reason") {
          @if (error.value !== "") {
            <p class="error" role="alert">{error.value}</p>
          }
        }

        <div class="foot">
          <div class="foot-main">
            <Button variant="primary" disabled={busy} onClick={next}>
              {busy.value ? "Submitting…" : primaryLabel.value}
            </Button>
          </div>
          <div class="foot-sub">
            @if (step.value !== "what") {
              <div class="slot">
                <Button variant="ghost" onClick={back}>Back</Button>
              </div>
            }
            <div class="slot">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        </div>
        </>
      }
    </div>
  </Sheet>
  </>
}

export default ReportDialog;
