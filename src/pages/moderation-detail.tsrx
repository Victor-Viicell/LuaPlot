import { track } from "ripple";
import { Avatar } from "../components/Avatar.tsrx";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Field } from "../components/Field.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import type {
  AuthoredItem,
  CaseDecision,
  CaseEvent,
  CaseOutcome,
  Comment,
  Post,
  Report,
  ReportReasonCode,
} from "../lib/data/types.ts";
import { percent, relativeAge } from "../lib/format.ts";
import { previewMode } from "../lib/llm/jev.ts";
import {
  CASE_TERMS_REQUIRED,
  TERMS_RULES,
  TERMS_RULES_ORDER,
  caseCommentSchema,
  caseConcludeSchema,
  caseDismissSchema,
  reportIdSchema,
  type TermsRule,
} from "../lib/schema.ts";
import { currentUser } from "../lib/state/session.ts";
import { href, navigate, useParams, useQuery } from "../router.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/moderation/[report.id]` — one case, and the only surface a human moderator decides on
 * (`src/specs/pages/moderation/detail.md`, T-26B).
 *
 * The page is the counterpart of the queue and copies its idiom, with one inversion: **the queue
 * carries no content, this page carries nothing else.** A moderator cannot judge a cover or a body
 * they are not allowed to read, so the reported item is rendered here in full — and read-only. No
 * edit control, no link to the public page (an admin must not act where a visitor acts), no vote, no
 * comment box of the item's own. The one content edit a moderator has lives inside *Conclude*:
 * **Remove avatar**, which exists only while the avatar carries the violation and the text is valid.
 *
 * What this page settles, and why:
 *
 * - **One operation, not a form.** *Conclude* writes the outcome, the status, the clock, the history
 *   event and the creator's notification in the adapter (`repo.concludeReport`). The page hands over
 *   a `caseConcludeSchema`-shaped write and nothing else; the decision is not assembled here.
 * - **A concluded case is final.** No reopen control for any admin, and no disabled *Conclude*
 *   either: the closed case is drawn as a record — decision, reason, who, when — above its history.
 * - **The history is flat.** One chronological list of events, each with the admin's handle and its
 *   time; a note is a row with text, a state change is a row without one. JEV is **not** in it: its
 *   action already happened to the content and is printed as *what it did*, with no admin attached.
 * - **Dismiss needs the terms.** The three prohibitions from `TERMS_RULES`, one checkbox each, all
 *   required; the button's gate and `caseDismissSchema` are the same rule.
 * - **The reporter is never told.** Neither state renders a verdict for them: the notification goes
 *   to the creator, and only on a conclusion.
 * - **JEV is read, never recomputed** (T-27 owns the model). Verdict, confidence and action are the
 *   stored `report.jev`, printed as they are.
 * - **The admin gate is a state, not a redirect** — `forbidden` is an arm of the phase union, and
 *   `?admin=1` is the same preview switch the queue uses, carried in from the row that opened this
 *   case and re-attached to every in-app link this page writes.
 */

type Phase = "loading" | "ready" | "forbidden" | "notfound" | "error";

/** Every value the template draws is its own field: ripple loses a narrowing across a branch. */
type ItemView = {
  kind: string;
  title: string;
  author: string;
  initials: string;
  /** `Public` / `Private` / `Visible` / `Removed` / `Gone` — one word, decided in code. */
  visibility: string;
  /** `NSFW` or `SFW`. */
  flag: string;
  body: string;
  /** The one extra line a type carries: a tagline, an entry count, a model, a comment's state. */
  detail: string;
  available: boolean;
};

type ReasonRow = {
  key: string;
  reasons: string;
  parts: string;
  details: string;
  source: string;
  external: boolean;
  age: string;
};

type EventRow = {
  id: string;
  actor: string;
  word: string;
  body: string;
  age: string;
};

type OutcomePick = { value: CaseOutcome; label: string; note: string };

/** A reason as a moderator reads it; `REPORT_REASONS_BY_PART` is what may be filed. */
const REASON_WORD: Record<ReportReasonCode, string> = {
  "missing-nsfw": "NSFW flag",
  illegal: "illegal content",
  "copied-text": "copied text",
  "copied-image": "copied image",
};

const PART_WORD: Record<string, string> = { avatar: "avatar", text: "text" };

/** The history's vocabulary: what one event *did*, in the past tense. */
const EVENT_WORD: Record<CaseEvent["kind"], string> = {
  comment: "left a note",
  concluded: "concluded the case",
  dismissed: "dismissed the case",
  "avatar-removed": "removed the avatar",
};

/** JEV's action in a sentence. `escalated` is why the case exists at all. */
const ACTION_WORD: Record<Report["jev"]["action"], string> = {
  none: "and took no action",
  escalated: "and escalated it without acting",
  "made-private": "and made it private",
  removed: "and removed it",
  held: "and held it back",
};

const VERDICT_WORD: Record<Report["jev"]["verdict"], string> = {
  unsure: "not sure",
  violation: "a violation",
  clean: "clean",
};

const DECISION_WORD: Record<CaseOutcome, string> = {
  public: "public",
  private: "private",
  removed: "removed",
};

/**
 * Which conclusions a target can take (`detail.md` → *Actions*): an authored item is never deleted by
 * moderation, so it goes **public** or stays **private**; a post or comment has no visibility to set,
 * so a confirmed violation **removes** it. The same split the adapter enforces, drawn as the only
 * choices the moderator is offered.
 */
function outcomesFor(kind: Report["target"]["kind"]): OutcomePick[] {
  if (kind === "post" || kind === "comment") {
    return [
      {
        value: "removed",
        label: "Removed",
        note:
          kind === "comment"
            ? "The comment becomes a placeholder and keeps its replies."
            : "A confirmed violation removes the post.",
      },
    ];
  }

  return [
    { value: "public", label: "Public", note: "Back in the catalog under its author's name." },
    { value: "private", label: "Private", note: "Stays out of every listing. Nothing is deleted." },
  ];
}

function reasonList(codes: ReportReasonCode[]): string {
  return codes.map((code) => REASON_WORD[code]).join(", ");
}

function ageText(iso: string): string {
  const age = relativeAge(iso);
  return age === "" ? "unknown" : age;
}

/**
 * The reported item, flattened into strings — including whether it still exists. A case outlives a
 * deletion by its author (`luaplot-pages.md`), so a missing row is a state the page draws, never an
 * error.
 */
function itemViewOf(
  kind: Report["target"]["kind"],
  label: string,
  row: AuthoredItem | Post | Comment | null,
): ItemView {
  if (row === null) {
    return {
      kind,
      title: label,
      author: "",
      initials: "",
      visibility: "Gone",
      flag: "",
      body: "",
      detail: "Its author deleted this — the case stays, the content does not.",
      available: false,
    };
  }

  if (kind === "character" || kind === "lorebook" || kind === "preset") {
    const item = row as AuthoredItem;
    const detail =
      item.kind === "lorebook"
        ? `${item.entries.length} entries`
        : item.kind === "preset"
          ? `Model ${item.settings.model}`
          : item.tagline;

    return {
      kind,
      title: item.name,
      author: item.author,
      initials: item.avatar.initials,
      visibility: item.isPublic ? "Public" : "Private",
      flag: item.nsfw ? "NSFW" : "SFW",
      body: item.description,
      detail,
      available: true,
    };
  }

  if (kind === "post") {
    const post = row as Post;
    return {
      kind,
      title: label,
      author: post.author,
      initials: post.author.slice(0, 2).toUpperCase(),
      visibility: "No visibility",
      flag: post.nsfw ? "NSFW" : "SFW",
      body: post.body,
      detail: post.attachment === null ? "No attachment" : `Attachment: ${post.attachment.kind}`,
      available: true,
    };
  }

  const comment = row as Comment;
  return {
    kind,
    title: label,
    author: comment.author,
    initials: comment.author.slice(0, 2).toUpperCase(),
    visibility:
      comment.status === "visible" ? "Visible" : comment.status === "removed" ? "Removed" : "Deleted",
    flag: comment.nsfw ? "NSFW" : "SFW",
    body: comment.body,
    detail: `On a thread · ${comment.replyCount} replies beneath`,
    available: true,
  };
}

export function ModerationDetail() @{
  const repo = resolveRepo();
  const routeParams = useParams();
  const previewAdmin = useQuery().get("admin") === "1";
  const admin = currentUser()?.isAdmin === true || previewAdmin;

  /** The route param is an id before it is anything else: a malformed deep link is *not found*. */
  const parsedId = reportIdSchema.safeParse(routeParams.id ?? "");
  const reportId = parsedId.success ? parsedId.data : "";

  const phase = track<Phase>(admin ? "loading" : "forbidden");
  const failure = track("");
  const missing = track(false);

  const kicker = track("");
  const title = track("");
  const statusWord = track("");
  const weightLine = track("");
  const lastLine = track("");

  /** True while the mock classified: the JEV section says so rather than passing a mock for a model. */
  const preview = track(previewMode());

  const jevVerdict = track("");
  const jevConfidence = track("");
  const jevAction = track("");
  const jevNote = track("");

  const item = track<ItemView>({
    kind: "",
    title: "",
    author: "",
    initials: "",
    visibility: "",
    flag: "",
    body: "",
    detail: "",
    available: false,
  });

  const rows = track<ReasonRow[]>([]);
  const reasonTotal = track("");
  const events = track<EventRow[]>([]);

  const concluded = track(false);
  const decisionWord = track("");
  const decisionReason = track("");
  const decisionBy = track("");
  const decisionAge = track("");

  /** The choices this target offers, and the one chosen (the first until the moderator moves). */
  const picks = track<OutcomePick[]>([]);
  const outcome = track<CaseOutcome>("public");
  const hasAvatar = track(false);

  /** The write surface: one reason field serves both decisions, plus the checklist and a note. */
  const reason = track("");
  const removeAvatar = track(false);
  const ticks = track<TermsRule[]>([]);
  const busy = track(false);
  /** Both are **off** flags: `Button.disabled` is the thing they feed, never an inverted inline. */
  const concludeOff = track(true);
  const dismissOff = track(true);
  const termsHint = track("");

  const noteBody = track("");
  const noteBusy = track(false);
  const reasonError = track("");

  const queueHref = previewAdmin ? "/moderation?admin=1" : "/moderation";

  /** Both button gates read this and nothing else, so a tick and its button cannot disagree. */
  function syncGate(): void {
    const hasReason = reason.value.trim().length > 0;
    concludeOff.value = !hasReason || busy.value;
    dismissOff.value =
      !hasReason || ticks.value.length !== TERMS_RULES_ORDER.length || busy.value;
    termsHint.value = ticks.value.length === TERMS_RULES_ORDER.length ? "" : CASE_TERMS_REQUIRED;
  }

  function applyDecision(decision: CaseDecision): void {
    decisionWord.value =
      decision.kind === "dismissed"
        ? "Dismissed — no violation"
        : `Concluded · ${DECISION_WORD[decision.outcome ?? "private"]}`;
    decisionReason.value = decision.reason;
    decisionBy.value = `by @${decision.actor}`;
    decisionAge.value = ageText(decision.at);
  }

  function renderReport(report: Report, row: AuthoredItem | Post | Comment | null): void {
    const view = itemViewOf(report.target.kind, report.target.label, row);
    const kind = report.target.kind;

    kicker.value = `case · ${kind}`;
    title.value = view.title;
    statusWord.value = report.status;
    weightLine.value = `${report.weight} ${report.weight === 1 ? "report" : "reports"}`;
    lastLine.value = `last report ${ageText(report.lastReportAt)}`;

    jevVerdict.value = VERDICT_WORD[report.jev.verdict];
    jevConfidence.value = percent(report.jev.confidence);
    jevAction.value = ACTION_WORD[report.jev.action];
    jevNote.value = report.jev.note ?? "";

    item.value = view;
    hasAvatar.value = view.available && (kind === "character" || kind === "lorebook" || kind === "preset");

    rows.value = report.reasons.map((entry, index) => ({
      key: `${entry.at}-${index}`,
      reasons: reasonList(entry.reasons),
      parts: entry.parts.map((part) => PART_WORD[part] ?? part).join(" + "),
      details: entry.details ?? "",
      source: entry.source ?? "",
      external: entry.source !== undefined && /^https?:\/\//i.test(entry.source),
      age: ageText(entry.at),
    }));
    reasonTotal.value = `${report.reasons.length} ${report.reasons.length === 1 ? "reason" : "reasons"} on file`;

    events.value = report.history.map((event) => ({
      id: event.id,
      actor: `@${event.actor}`,
      word: EVENT_WORD[event.kind],
      body: event.body ?? "",
      age: ageText(event.at),
    }));

    concluded.value = report.status === "concluded";
    picks.value = outcomesFor(kind);
    outcome.value = picks.value[0]?.value ?? "public";
    if (report.decision !== undefined) applyDecision(report.decision);
  }

  /**
   * Load the case and the row it is about. `loading` is only drawn on the first pass: a write that
   * re-reads afterwards must not flash a skeleton under the moderator's thumb.
   */
  function boot(): void {
    if (phase.value !== "ready") phase.value = "loading";
    failure.value = "";

    repo
      .getReport(reportId)
      .then((report) => {
        if (report === null) {
          missing.value = true;
          return null;
        }

        const target = report.target;
        const load =
          target.kind === "character"
            ? repo.getCharacter(target.id)
            : target.kind === "lorebook"
              ? repo.getLorebook(target.id)
              : target.kind === "preset"
                ? repo.getPreset(target.id)
                : target.kind === "post"
                  ? repo.getPost(target.id)
                  : repo.getComment(target.id);

        return load.then((row) => {
          renderReport(report, row);
        });
      })
      .then(() => {
        phase.value = missing.value ? "notfound" : "ready";
        syncGate();
      })
      .catch(() => {
        phase.value = "error";
        failure.value = "This case couldn't be loaded.";
      });
  }

  /**
   * One conclusion. The write is parsed by `caseConcludeSchema` on the way out and again in the
   * adapter; a rejection is a policy answer (an outcome the target cannot take), never a silent
   * success — the toast says so and the case stays open.
   */
  function conclude(): void {
    if (concludeOff.value) return;

    const write = caseConcludeSchema.safeParse({
      reportId,
      outcome: outcome.value,
      removeAvatar: removeAvatar.value && hasAvatar.value,
      reason: reason.value,
    });

    if (!write.success) {
      reasonError.value = write.error.issues[0]?.message ?? "";
      return;
    }

    reasonError.value = "";
    busy.value = true;
    syncGate();

    repo
      .concludeReport(write.data)
      .then((report) => {
        busy.value = false;
        if (report === null) {
          toast("That case is closed, or the outcome doesn't fit it.");
          syncGate();
          return;
        }
        reason.value = "";
        removeAvatar.value = false;
        toast("Case concluded. The creator has been told.");
        boot();
      })
      .catch(() => {
        busy.value = false;
        toast("The case couldn't be concluded.");
        syncGate();
      });
  }

  /**
   * One dismissal. The button is gated on all three terms and on a reason; the same `terms` array is
   * what `caseDismissSchema` checks, so a submission the schema would refuse cannot be built here.
   */
  function dismiss(): void {
    if (dismissOff.value) return;

    const write = caseDismissSchema.safeParse({
      reportId,
      reason: reason.value,
      terms: ticks.value,
    });

    if (!write.success) {
      reasonError.value = write.error.issues[0]?.message ?? "";
      return;
    }

    reasonError.value = "";
    busy.value = true;
    syncGate();

    repo
      .dismissReport(write.data)
      .then((report) => {
        busy.value = false;
        if (report === null) {
          toast("That case is closed already.");
          syncGate();
          return;
        }
        reason.value = "";
        ticks.value = [];
        toast("Case dismissed. Nothing changed visibility.");
        boot();
      })
      .catch(() => {
        busy.value = false;
        toast("The case couldn't be dismissed.");
        syncGate();
      });
  }

  /** An internal note: flat history, never a reply, and only while the case is open. */
  function addNote(): void {
    if (noteBusy.value) return;

    const write = caseCommentSchema.safeParse({ reportId, body: noteBody.value });
    if (!write.success) {
      toast(write.error.issues[0]?.message ?? "Write the note first.");
      return;
    }

    noteBusy.value = true;

    repo
      .addCaseComment(write.data)
      .then((event) => {
        noteBusy.value = false;
        if (event === null) {
          toast("That case is closed — the history is final.");
          return;
        }
        noteBody.value = "";
        boot();
      })
      .catch(() => {
        noteBusy.value = false;
        toast("The note couldn't be saved.");
      });
  }

  function toggleTerm(rule: TermsRule, checked: boolean): void {
    const next = ticks.value.filter((entry) => entry !== rule);
    if (checked) next.push(rule);
    // Kept in the spec's order, so the value reads the way the checklist does.
    ticks.value = TERMS_RULES_ORDER.filter((entry) => next.includes(entry));
    syncGate();
  }

  function setReason(value: string): void {
    reason.value = value;
    reasonError.value = "";
    syncGate();
  }

  function goBack(event: MouseEvent): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(queueHref);
  }

  if (admin && parsedId.success) boot();

  <>
    <style>
      .case {
        display: flex;
        flex-direction: column;
        gap: 24px;
        max-width: 1040px;
        margin: 0 auto;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .back {
        align-self: flex-start;
        min-height: 24px;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-decoration: none;
        text-transform: uppercase;
      }

      .back:hover {
        color: var(--color-text);
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        overflow-wrap: anywhere;
        color: var(--color-text);
        font-size: 24px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      /* The status line is paperwork: what state, how loud, how old. Tabular, one line. */
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        line-height: 1.5;
      }

      .meta-strong {
        color: var(--color-text-muted);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .cols {
        display: flex;
        flex-direction: column;
        gap: 24px;
        min-width: 0;
      }

      .main,
      .aside {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      .section {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
      }

      .section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--color-border);
      }

      .section-title {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .section-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }

      /* The item: one body, no box, no controls. It is evidence, not a page. */
      .item-head {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .item-who {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .item-author {
        margin: 0;
        color: var(--color-text);
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
      }

      .item-detail {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.5;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-left: auto;
      }

      .chip {
        padding: 2px 6px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        color: var(--color-text-muted);
        font-size: 11px;
        letter-spacing: 0.08em;
        line-height: 1.5;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .item-body {
        margin: 0;
        overflow-wrap: anywhere;
        color: var(--color-text);
        font-size: 14px;
        line-height: 1.7;
        white-space: pre-wrap;
      }

      .item-missing {
        color: var(--color-text-muted);
        font-style: italic;
      }

      .preview-chip {
        padding: 5px 8px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        color: var(--color-text-subtle);
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.02em;
      }

      /* JEV: a ledger row, not a banner. Two words and a sentence. */
      .jev {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px;
        border-left: 2px solid var(--color-border-strong);
        background-color: var(--color-bg-elevated);
      }

      .jev-line {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .jev-word {
        color: var(--color-text);
        font-weight: 600;
      }

      .jev-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
        text-wrap: pretty;
      }

      /* Reports: one row per filing, the reason lead, the detail under it. */
      .rows {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .row {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 10px 0;
        border-bottom: 1px solid var(--color-border);
      }

      .row:last-child {
        border-bottom: 0;
      }

      .row-line {
        margin: 0;
        color: var(--color-text);
        font-size: 13px;
        line-height: 1.5;
      }

      .row-parts {
        color: var(--color-text-subtle);
        font-size: 12px;
      }

      .row-detail {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.6;
        text-wrap: pretty;
      }

      .row-source {
        margin: 0;
        overflow: hidden;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.5;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .row-source a {
        color: var(--color-info);
      }

      .row-age {
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }

      /* The closed case's record: the decision is the loudest line on the page. */
      .decision {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px;
        border: 1px solid var(--color-border-strong);
        background-color: var(--color-bg-elevated);
      }

      .decision-word {
        margin: 0;
        color: var(--color-text);
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.3;
      }

      .decision-reason {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      .decision-meta {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        line-height: 1.5;
      }

      /* The panel: the only place on the page a moderator can act. */
      .panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 14px;
        border: 1px solid var(--color-border-strong);
        background-color: var(--color-surface);
      }

      .panel-block {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .panel-title {
        margin: 0;
        color: var(--color-text);
        font-size: 13px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .panel-hint {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      /* One column of choices at 360: a label plus its sentence does not fit side by side. */
      .picks {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .pick {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        min-height: 44px;
        padding: 10px 0;
        cursor: pointer;
      }

      .pick input {
        flex: none;
        width: 18px;
        height: 18px;
        margin: 2px 0 0;
        accent-color: var(--color-accent);
      }

      .pick-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .pick-label {
        color: var(--color-text);
        font-size: 14px;
        line-height: 1.4;
      }

      .pick-note {
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.5;
      }

      .pick-note a {
        color: var(--color-info);
      }

      .pick.is-off {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .divider {
        height: 1px;
        margin: 0;
        border: 0;
        background-color: var(--color-border-strong);
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .rule-error {
        margin: 0;
        color: var(--color-danger);
        font-size: 12px;
        line-height: 1.5;
      }

      .history {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .event {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 10px 0;
        border-bottom: 1px solid var(--color-border);
      }

      .event:last-child {
        border-bottom: 0;
      }

      .event-line {
        margin: 0;
        color: var(--color-text);
        font-size: 13px;
        line-height: 1.5;
      }

      .event-actor {
        font-weight: 600;
      }

      .event-body {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.6;
        text-wrap: pretty;
      }

      .empty-line {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.6;
      }

      .alert {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        padding: 16px 0;
      }

      .alert-text {
        margin: 0;
        color: var(--color-danger);
        font-size: 14px;
        line-height: 1.6;
      }

      .skel {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      @media (min-width: 640px) {
        .title {
          font-size: 28px;
        }

        .item-body,
        .row-detail,
        .event-body {
          font-size: 14px;
        }

        .picks {
          flex-direction: row;
          flex-wrap: wrap;
          gap: 0 24px;
        }
      }

      @media (min-width: 900px) {
        .cols {
          flex-direction: row;
          align-items: flex-start;
          gap: 32px;
        }

        .main {
          flex: 1 1 auto;
        }

        .aside {
          flex: 0 0 340px;
          position: sticky;
          top: 24px;
        }

        .panel,
        .decision {
          padding: 16px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .back,
        .row,
        .event {
          transition: none;
        }
      }
    </style>

    <div class="case">
      @if (phase.value === "forbidden") {
        <>
        <header class="head">
          <p class="kicker">moderation</p>
          <h1 class="title">Case</h1>
        </header>
        <EmptyState
          message="Only a moderator can open a case."
          actionLabel="Go home"
          href={href("/")}
        />
        </>
      } @else if (phase.value === "notfound") {
        <>
        <header class="head">
          <p class="kicker">moderation</p>
          <h1 class="title">Case</h1>
        </header>
        <EmptyState
          message="This report doesn't exist."
          actionLabel="Back to the queue"
          href={href(queueHref)}
        />
        </>
      } @else if (phase.value === "loading") {
        <>
        <header class="head">
          <p class="kicker">moderation</p>
          <Skeleton variant="block" height={28} />
        </header>
        <div class="skel" aria-busy="true" aria-label="Loading case">
          <Skeleton variant="block" height={14} />
          <Skeleton variant="block" height={96} />
          <Skeleton variant="block" height={14} />
          <Skeleton variant="block" height={72} />
          <Skeleton variant="block" height={140} />
        </div>
        </>
      } @else if (phase.value === "error") {
        <>
        <header class="head">
          <p class="kicker">moderation</p>
          <h1 class="title">Case</h1>
        </header>
        <div class="alert" role="alert">
          <p class="alert-text">{failure.value}</p>
          <Button variant="secondary" onClick={boot}>Retry</Button>
        </div>
        </>
      } @else {
        <>
        <header class="head">
          <a class="back" href={href(queueHref)} onClick={goBack}>Queue</a>
          <p class="kicker">{kicker.value}</p>
          <h1 class="title">{title.value}</h1>
          <p class="meta">
            <span class="meta-strong">{statusWord.value}</span>
            <span>{weightLine.value}</span>
            <span>{lastLine.value}</span>
          </p>
        </header>

        <div class="cols">
          <div class="main">
            <section class="section" aria-labelledby="jev-heading">
              <div class="section-head">
                <h2 class="section-title" id="jev-heading">JEV</h2>
                <p class="section-note">{`${jevConfidence.value} confident`}</p>
                @if (preview.value) {
                  <span class="preview-chip" title="No model is connected: this verdict was classified locally from the reported text.">
                    Preview mode
                  </span>
                }
              </div>
              <div class="jev">
                <p class="jev-line">
                  <span class="jev-word">{jevVerdict.value}</span>
                  <span>{` · ${jevAction.value}`}</span>
                </p>
                @if (jevNote.value !== "") {
                  <p class="jev-note">{jevNote.value}</p>
                }
              </div>
            </section>

            <section class="section" aria-labelledby="item-heading">
              <div class="section-head">
                <h2 class="section-title" id="item-heading">The item</h2>
                <p class="section-note">read only</p>
              </div>
              <div class="item-head">
                @if (item.value.available) {
                  <Avatar initials={item.value.initials} size={40} />
                }
                <div class="item-who">
                  <p class="item-author">
                    @if (item.value.author !== "") {
                      <span>{`@${item.value.author}`}</span>
                    } @else {
                      <span>{item.value.title}</span>
                    }
                  </p>
                  <p class="item-detail">{item.value.detail}</p>
                </div>
                <div class="chips">
                  <span class="chip">{item.value.visibility}</span>
                  @if (item.value.flag !== "") {
                    <span class="chip">{item.value.flag}</span>
                  }
                </div>
              </div>
              @if (item.value.available) {
                <p class="item-body">{item.value.body}</p>
              } @else {
                <p class="item-body item-missing">{item.value.detail}</p>
              }
            </section>

            <section class="section" aria-labelledby="reports-heading">
              <div class="section-head">
                <h2 class="section-title" id="reports-heading">Reports</h2>
                <p class="section-note">{reasonTotal.value}</p>
              </div>
              <ul class="rows" aria-label="Reports on file">
                @for (const row of rows.value; key row.key) {
                  <li class="row">
                    <p class="row-line">
                      <span>{row.reasons}</span>
                      <span class="row-parts">{` · ${row.parts}`}</span>
                      <span class="row-age">{` · ${row.age}`}</span>
                    </p>
                    @if (row.details !== "") {
                      <p class="row-detail">{row.details}</p>
                    }
                    @if (row.source !== "") {
                      @if (row.external) {
                        <p class="row-source">
                          <span>Source: </span>
                          <a href={row.source} target="_blank" rel="noopener noreferrer">{row.source}</a>
                        </p>
                      } @else {
                        <p class="row-source">{`Source: item ${row.source}`}</p>
                      }
                    }
                  </li>
                }
              </ul>
            </section>
          </div>

          <aside class="aside">
            @if (concluded.value) {
              <section class="section" aria-labelledby="decision-heading">
                <div class="section-head">
                  <h2 class="section-title" id="decision-heading">Decision</h2>
                  <p class="section-note">final</p>
                </div>
                <div class="decision">
                  <p class="decision-word">{decisionWord.value}</p>
                  <p class="decision-reason">{decisionReason.value}</p>
                  <p class="decision-meta">
                    <span>{decisionBy.value}</span>
                    <span>{` · ${decisionAge.value}`}</span>
                  </p>
                </div>
              </section>
            } @else {
              <section class="section" aria-labelledby="decide-heading">
                <div class="section-head">
                  <h2 class="section-title" id="decide-heading">Decide</h2>
                  <p class="section-note">one operation</p>
                </div>

                <div class="panel">
                  <div class="panel-block">
                    <p class="panel-title">Conclude</p>
                    <div class="picks">
                      @for (const pick of picks.value; key pick.value) {
                        <label class="pick">
                          <input
                            type="radio"
                            name="outcome"
                            value={pick.value}
                            checked={outcome.value === pick.value}
                            onChange={() => {
                              outcome.value = pick.value;
                            }}
                          />
                          <span class="pick-text">
                            <span class="pick-label">{pick.label}</span>
                            <span class="pick-note">{pick.note}</span>
                          </span>
                        </label>
                      }
                      @if (hasAvatar.value) {
                        <label class="pick">
                          <input
                            type="checkbox"
                            name="remove-avatar"
                            checked={removeAvatar.value}
                            onChange={(event) => {
                              removeAvatar.value = event.currentTarget.checked;
                            }}
                          />
                          <span class="pick-text">
                            <span class="pick-label">Remove avatar</span>
                            <span class="pick-note">
                              When the avatar carries the violation and the text itself is valid.
                            </span>
                          </span>
                        </label>
                      } @else {
                        <span class="pick is-off">
                          <input type="checkbox" name="remove-avatar" disabled={true} />
                          <span class="pick-text">
                            <span class="pick-label">Remove avatar</span>
                            <span class="pick-note">No avatar to remove.</span>
                          </span>
                        </span>
                      }
                    </div>
                  </div>

                  <div class="panel-block">
                    <Field
                      label="Reason"
                      name="reason"
                      value={reason}
                      onInput={setReason}
                      multiline={true}
                      rows={3}
                      placeholder="What you read, and what decided it."
                      error={reasonError}
                    />
                  </div>

                  <div class="actions">
                    <Button variant="primary" disabled={concludeOff} onClick={conclude}>
                      Conclude case
                    </Button>
                  </div>

                  <hr class="divider" />

                  <div class="panel-block">
                    <p class="panel-title">Or dismiss</p>
                    <p class="panel-hint">
                      No violation, so nothing changes visibility — escalated content was never hidden.
                    </p>
                    <div class="picks">
                      @for (const rule of TERMS_RULES_ORDER; key rule) {
                        <label class="pick">
                          <input
                            type="checkbox"
                            name={`term-${rule}`}
                            value={rule}
                            checked={ticks.value.includes(rule)}
                            onChange={(event) => toggleTerm(rule, event.currentTarget.checked)}
                          />
                          <span class="pick-text">
                            <span class="pick-label">{TERMS_RULES[rule].title}</span>
                            <span class="pick-note">
                              <a href={href(`/terms#${TERMS_RULES[rule].anchor}`)}>What this asserts</a>
                            </span>
                          </span>
                        </label>
                      }
                    </div>
                    @if (termsHint.value !== "") {
                      <p class="rule-error">{termsHint.value}</p>
                    }
                    <div class="actions">
                      <Button variant="secondary" disabled={dismissOff} onClick={dismiss}>
                        Dismiss, no violation
                      </Button>
                    </div>
                  </div>

                  <hr class="divider" />

                  <div class="panel-block">
                    <p class="panel-title">Case note</p>
                    <p class="panel-hint">
                      Internal. Every admin sees the whole history; nobody outside moderation does.
                    </p>
                    <Field
                      label="Note"
                      name="note"
                      value={noteBody}
                      onInput={(value) => {
                        noteBody.value = value;
                      }}
                      multiline={true}
                      rows={3}
                      placeholder="What you checked, and what you found."
                    />
                    <div class="actions">
                      <Button variant="ghost" disabled={noteBusy} onClick={addNote}>Add note</Button>
                    </div>
                  </div>
                </div>
              </section>
            }

            <section class="section" aria-labelledby="history-heading">
              <div class="section-head">
                <h2 class="section-title" id="history-heading">Case history</h2>
                <p class="section-note">flat, oldest first</p>
              </div>
              @if (events.value.length === 0) {
                <p class="empty-line">
                  No activity yet. Every note and every decision lands here, with its author.
                </p>
              } @else {
                <ul class="history" aria-label="Case history">
                  @for (const entry of events.value; key entry.id) {
                    <li class="event">
                      <p class="event-line">
                        <span class="event-actor">{entry.actor}</span>
                        <span>{` ${entry.word}`}</span>
                        <span class="row-age">{` · ${entry.age}`}</span>
                      </p>
                      @if (entry.body !== "") {
                        <p class="event-body">{entry.body}</p>
                      }
                    </li>
                  }
                </ul>
              }
            </section>
          </aside>
        </div>
        </>
      }
    </div>
  </>
}

export default ModerationDetail;
