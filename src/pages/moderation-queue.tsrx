import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Select } from "../components/Select.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { PAGE_SIZE, resolveRepo } from "../lib/data/repo.ts";
import type { Listing, ReportFilter } from "../lib/data/repo.ts";
import type { Report, ReportReasonCode } from "../lib/data/types.ts";
import { relativeAge } from "../lib/format.ts";
import { reportFilterSchema, reportSourceIsExternal } from "../lib/schema.ts";
import { previewMode } from "../lib/llm/jev.ts";
import { currentUser } from "../lib/state/session.ts";
import { href, navigate, useQuery } from "../router.ts";

/**
 * `/moderation` — the queue of cases JEV could not decide (`src/specs/pages/moderation/queue.md`).
 *
 * This is the app's first admin page, so what it settles is copied by the case page (T-26B):
 *
 * - **A row is metadata only.** Content type, JEV's classification, the reason spread, the weight, the
 *   age of the last report, and the status. No avatar, no image, no body: *a queue that shows the
 *   content is a queue that gets read in public.* The one string naming the item is `target.label` —
 *   taken at filing time by `reportTargetSchema` for exactly this row — and it is clamped to a single
 *   line, so a post's label reads as a title, never as an excerpt.
 * - **Weight is the order and the only order** (the adapter sorts; this page never re-sorts). It is
 *   also the loudest thing in the row: a tabular numeral in a fixed leading column under a
 *   `weight / case` header, because *most reported first* is the whole reading of the list.
 * - **`weight` is the report count, never a score.** The page prints it and computes nothing from it —
 *   no severity, no ranking helper.
 * - **The filter is a `Select`** — three real options (open, concluded, all) — living in the query
 *   string. No sort control, no claim/assign control, no moderator column: the spec says ordering is
 *   not a control and a case belongs to nobody.
 * - **Counts come from the adapter.** Two listings are asked for on every mount, open and concluded,
 *   and the numbers printed above the list are those answers' lengths (`24+` when a page said
 *   `hasMore`, never a total invented from a slice). The visible rows are the answer for the chosen
 *   filter, so two calls settle both the counts and the list.
 * - **Page 1 only, no `Load more`.** The spec's *States* has no paging step and the fixtures are five
 *   cases; a `hasMore` is what would force a control. Recorded in `docs/DESIGN.md`.
 * - **The admin gate is a state, not a redirect.** No route change: the router keeps its declarative
 *   `access`, and the redirect matrix is T-30. `?admin=1` is the preview switch that lets a reviewer
 *   *see* the queue before roles are real — the `?auth=` idiom from T-06.
 * - **One phase union** — `loading | ready | forbidden | error` — exactly as the catalogs do it.
 *   Empty is a `ready` state with nothing in it, not a sixth phase.
 */

type Phase = "loading" | "ready" | "forbidden" | "error";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "concluded", label: "Concluded" },
  { value: "all", label: "All" },
];

/** A reason as a moderator reads it; `REPORT_REASONS_BY_PART` is what may be filed. */
const REASON_WORD: Record<ReportReasonCode, string> = {
  "missing-nsfw": "NSFW flag",
  illegal: "illegal content",
  "copied-text": "copied text",
  "copied-image": "copied image",
};

/**
 * What JEV already did, when it did anything. `escalated` is the state every open case is in by
 * definition (*unsure → stays public and escalates*), so printing it would be a tautology, and `none`
 * means nothing happened: silence is the right word for both.
 */
const ACTION_WORD: Partial<Record<Report["jev"]["action"], string>> = {
  "made-private": "JEV made it private",
  removed: "JEV removed it",
  held: "JEV held it",
};

const EMPTY_COPY: Record<ReportFilter, string> = {
  open: "No open cases.",
  concluded: "No concluded cases.",
  all: "No cases yet.",
};

/**
 * A row, worked out **once, outside the template** (the `cellOf` rule from `/bookmarks`): ripple loses
 * a discriminated union inside a block, so every string is decided here and the template reads strings.
 */
type Row = {
  id: string;
  /** Content type, uppercase by CSS. */
  kind: string;
  label: string;
  status: string;
  /** JEV's classification plus the spread of reasons — the spec's *why is this case here*. */
  causes: string;
  weight: number;
  /** The age of the last report, phrased (`2d ago`). */
  age: string;
  /** What JEV already did, or empty when it did nothing — the meta line's second clause. */
  did: string;
  at: string;
  open: boolean;
};

/**
 * *Why the case is here: JEV unsure, copied image, external copied text, or a combination.* The
 * classification leads, then every reason the case's reports actually carry, with the copy claim split
 * into internal (`copied text`) and outside (`copied text from outside`) because those two take
 * different routes through JEV (`systems/jev.md` → *Scope*).
 */
function causesOf(report: Report): string {
  const words: string[] = [`JEV ${report.jev.verdict}`];
  const codes = new Set<ReportReasonCode>();
  for (const entry of report.reasons) {
    for (const code of entry.reasons) codes.add(code);
  }

  if (codes.has("missing-nsfw")) words.push(REASON_WORD["missing-nsfw"]);
  if (codes.has("illegal")) words.push(REASON_WORD.illegal);
  if (codes.has("copied-image")) words.push(REASON_WORD["copied-image"]);
  if (codes.has("copied-text")) {
    const outside = report.reasons.some(
      (entry) =>
        entry.reasons.includes("copied-text") &&
        entry.source !== undefined &&
        reportSourceIsExternal(entry.source),
    );
    words.push(outside ? "copied text from outside" : REASON_WORD["copied-text"]);
  }

  return words.join(" · ");
}

function rowOf(report: Report): Row {
  const age = relativeAge(report.lastReportAt);

  return {
    id: report.id,
    kind: report.target.kind,
    label: report.target.label,
    status: report.status,
    causes: causesOf(report),
    weight: report.weight,
    age: age === "" ? "unknown" : age,
    did: ACTION_WORD[report.jev.action] ?? "",
    at: report.lastReportAt,
    open: report.status === "open",
  };
}

/** A page's count, honest about the page: `24+` when the adapter said there is more behind it. */
function counted(listing: Listing<Report>): string {
  return listing.hasMore ? `${PAGE_SIZE}+` : String(listing.items.length);
}

export function ModerationQueue() @{
  const repo = resolveRepo();

  /**
   * The admin gate. `isAdmin` is false on the mock account (`session.ts`), so the forbidden drawing is
   * what the preview shows by default; `?admin=1` is the reviewer's switch until T-30 has real roles.
   */
  const previewAdmin = useQuery().get("admin") === "1";
  const admin = currentUser()?.isAdmin === true || previewAdmin;

  /** The filter is the URL's, parsed once at mount — an unknown `?status=` falls back to open. */
  const parsedFilter = reportFilterSchema.safeParse(useQuery().get("status") ?? "open");
  const filter = track<ReportFilter>(parsedFilter.success ? parsedFilter.data : "open");

  /** A verdict on this page is the mock's when no model is connected; the chip says so. */
  const preview = track(previewMode());

  const phase = track<Phase>(admin ? "loading" : "forbidden");
  const failure = track("");
  const rows = track<Row[]>([]);
  const openCount = track("");
  const concludedCount = track("");

  function boot(): void {
    phase.value = "loading";
    failure.value = "";

    // Both counts are answers, never a slice this page happens to hold: one call per status.
    Promise.all([
      repo.listReports({ status: "open" }),
      repo.listReports({ status: "concluded" }),
    ])
      .then(([open, concluded]) => {
        openCount.value = counted(open);
        concludedCount.value = counted(concluded);

        // The visible rows are the answer for the chosen filter, so the counts and the list
        // cannot disagree: `all` is the one case that needs its own question.
        if (filter.value === "open") return open.items;
        if (filter.value === "concluded") return concluded.items;
        return repo.listReports({ status: "all" }).then((every) => every.items);
      })
      .then((active) => {
        rows.value = active.map(rowOf);
        phase.value = "ready";
      })
      .catch(() => {
        phase.value = "error";
        failure.value = "The queue couldn't be loaded.";
      });
  }

  /**
   * A filter is a discrete choice and lives in the query string. `navigate()` remounts the page, which
   * is exactly what is wanted: the module reads `?status=` at mount and asks the adapter with the
   * newly chosen word — no second source of truth for the filter inside the page.
   */
  function chooseFilter(next: string): void {
    const parsed = reportFilterSchema.safeParse(next);
    if (!parsed.success || parsed.data === filter.value) return;

    // `open` is the default, so it is written as the bare path; the preview switch rides along so a
    // filter change cannot lock a reviewer out of the page they are filtering.
    const params = new URLSearchParams();
    if (parsed.data !== "open") params.set("status", parsed.data);
    if (previewAdmin) params.set("admin", "1");

    const search = params.toString();
    navigate(search === "" ? "/moderation" : `/moderation?${search}`);
  }

  /**
   * Opening a case stays in-app: the memory adapter loses runtime rows on a hard reload. The preview
   * switch rides along here too — a row that opens the forbidden drawing would be a dead link.
   */
  function openCase(row: Row): (event: MouseEvent) => void {
    const to = `/moderation/${row.id}${previewAdmin ? "?admin=1" : ""}`;

    return (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      navigate(to);
    };
  }

  if (admin) boot();

  <>
    <style>
      .queue {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 4px;
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
        color: var(--color-text);
        font-size: 24px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      /* One paragraph, and only where there is room: at 360 the list is the page. */

      .preview-chip {
        align-self: flex-start;
        margin: 0;
        padding: 6px 9px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.02em;
      }

      /* Counts on the left, the one filter on the right, one hairline under both. */
      .toolbar {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--color-border);
      }

      .counts {
        margin: 0 0 12px;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        line-height: 1.5;
      }

      .counts-open {
        color: var(--color-text);
      }

      /* Page-owned wrapper: a page's scoped block cannot reach a primitive's own elements (T-09). */
      .filter {
        flex: none;
        width: 148px;
      }

      .rows {
        max-width: 720px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      /* The column header: weight is a figure with a meaning, so the list names it once. */
      .col-head {
        display: flex;
        gap: 12px;
        padding: 0 0 6px;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .col-weight {
        flex: none;
        width: 44px;
      }

      .row {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 0;
        border-bottom: 1px solid var(--color-border);
        transition: background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
        animation: queue-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .row:last-child {
        border-bottom: 0;
      }

      .row:hover {
        background-color: var(--color-surface);
      }

      /* The order, made loud: a numeral, tabular so the column never shifts. */
      .weight {
        flex: none;
        width: 44px;
        color: var(--color-text);
        font-size: 20px;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      /* A concluded case is history: it keeps its line, not the emphasis. */
      .row.is-concluded .weight {
        color: var(--color-text-subtle);
      }

      .body {
        flex: 1;
        min-width: 0;
      }

      .eyebrow {
        margin: 0 0 2px;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      /* One line, clamped: a post's label is a title, never an excerpt of its body. */
      .label {
        margin: 0;
        overflow: hidden;
        color: var(--color-text);
        font-size: 15px;
        font-weight: 600;
        line-height: 1.4;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .row.is-concluded .label {
        font-weight: 400;
      }

      .causes {
        margin: 4px 0 0;
        color: var(--color-text-muted);
        font-size: 12px;
        line-height: 1.5;
        text-wrap: pretty;
      }

      .meta {
        margin: 2px 0 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        line-height: 1.5;
      }

      /* The anchor covers the row, so the tap target is the row and not the words. */
      .row-link {
        color: inherit;
        text-decoration: none;
        outline: none;
      }

      .row-link::after {
        position: absolute;
        inset: 0;
        content: "";
      }

      .row-link:focus-visible::after {
        outline: 2px solid var(--color-accent);
        outline-offset: -2px;
      }

      .skel-row {
        display: flex;
        gap: 12px;
        padding: 14px 0;
        border-bottom: 1px solid var(--color-border);
      }

      .skel-weight {
        flex: none;
        width: 44px;
        height: 24px;
        border-radius: 2px;
        background-color: var(--color-surface);
        animation: skel-soft 1.2s ease-in-out infinite;
      }

      .skel-lines {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 8px;
        padding-top: 2px;
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

      /* The entrance: 8px up, 40ms apart, capped at six rows. */
      .row:nth-child(2) {
        animation-delay: 0ms;
      }

      .row:nth-child(3) {
        animation-delay: 40ms;
      }

      .row:nth-child(4) {
        animation-delay: 80ms;
      }

      .row:nth-child(5) {
        animation-delay: 120ms;
      }

      .row:nth-child(6) {
        animation-delay: 160ms;
      }

      .row:nth-child(n + 7) {
        animation-delay: 200ms;
      }

      @keyframes queue-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      @keyframes skel-soft {
        0%,
        100% {
          opacity: 0.5;
        }
        50% {
          opacity: 1;
        }
      }

      @media (min-width: 640px) {
        .title {
          font-size: 28px;
        }


        .row,
        .skel-row {
          padding: 16px 0;
        }

        .weight,
        .col-weight {
          width: 56px;
        }

        .weight {
          font-size: 26px;
        }

        .label {
          font-size: 16px;
        }

        .causes,
        .meta {
          font-size: 13px;
        }
      }

      @media (min-width: 900px) {
        .toolbar {
          padding-bottom: 10px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .row {
          transition: none;
          animation: none;
        }

        .skel-weight {
          animation: none;
        }
      }
    </style>

    <div class="queue">
      <header class="head">
        <p class="kicker">moderation</p>
        <h1 class="title">Queue</h1>
        @if (preview.value) {
          <p class="preview-chip" title="No model is connected: every verdict below was classified locally from the reported text.">
            Preview mode
          </p>
        }
      </header>

      @if (phase.value === "forbidden") {
        <EmptyState
          message="Only a moderator can open the queue."
          actionLabel="Go home"
          href={href("/")}
        />
      } @else if (phase.value === "loading") {
        <ul class="rows" aria-busy="true" aria-label="Loading cases">
          @for (const cell of [0, 1, 2, 3]; key cell) {
            <li class="skel-row">
              <div class="skel-weight"></div>
              <div class="skel-lines">
                <Skeleton variant="block" height={12} />
                <Skeleton variant="block" height={16} />
                <Skeleton variant="block" height={12} />
              </div>
            </li>
          }
        </ul>
      } @else if (phase.value === "error") {
        <div class="alert" role="alert">
          <p class="alert-text">{failure.value}</p>
          <Button variant="secondary" onClick={boot}>Retry</Button>
        </div>
      } @else {
        <>
          <div class="toolbar">
            <p class="counts">
              <span class="counts-open">{openCount.value} open</span>
              <span>{` · ${concludedCount.value} concluded`}</span>
            </p>
            <div class="filter">
              <Select
                label="Filter"
                name="status"
                value={filter}
                options={FILTERS}
                onChange={chooseFilter}
              />
            </div>
          </div>

          @if (rows.value.length === 0) {
            <EmptyState message={EMPTY_COPY[filter.value]} />
          } @else {
            <ul class="rows" aria-label="Cases">
              <li class="col-head" aria-hidden="true">
                <span class="col-weight">weight</span>
                <span>case</span>
              </li>
              @for (const row of rows.value; key row.id) {
                <li class={row.open ? "row" : "row is-concluded"}>
                  <span class="weight">{row.weight}</span>
                  <div class="body">
                    <p class="eyebrow">{row.kind} · {row.status}</p>
                    <p class="label">
                      <a class="row-link" href={href(`/moderation/${row.id}`)} onClick={openCase(row)}>
                        {row.label}
                      </a>
                    </p>
                    <p class="causes">{row.causes}</p>
                    <p class="meta">
                      <time datetime={row.at}>last report {row.age}</time>
                      @if (row.did !== "") {
                        <span>{` · ${row.did}`}</span>
                      }
                    </p>
                  </div>
                </li>
              }
            </ul>
          }
        </>
      }
    </div>
  </>
}

export default ModerationQueue;
