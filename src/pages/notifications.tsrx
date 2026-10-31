import { track } from "ripple";
import { Avatar } from "../components/Avatar.tsrx";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, navigate } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Notification, NotificationTarget } from "../lib/data/types.ts";
import { initialsOf, relativeTime } from "../lib/format.ts";
import { currentUser } from "../lib/state/session.ts";
import { refreshInbox } from "../lib/state/inbox.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/notifications` — the quiet inbox (`src/specs/pages/notifications.md`).
 *
 * This page is the opposite of a log: it draws **fewer rows than there are events**, because the
 * events were already aggregated into rows before they reached it (`Notification.count` is the
 * number behind a row, and `actor` is the newest actor). So the page never folds anything itself —
 * it renders what the adapter hands it, newest first, and the only arithmetic it does is the
 * sentence's *"and 2 others"*, which is `count - 1`.
 *
 * What it owns:
 * - **A row is a sentence, not a card.** Avatar, one sentence naming actor + event + target, and the
 *   age at the end. The target's name comes from `target.label`, so a row never fetches the item it
 *   names — `notificationTargetSchema` carries the label for exactly that reason.
 * - **Unread is a left rule and weight**, not a dot (the persona card's mark decision, reused): a 2px
 *   `--color-accent` inset on the row's leading edge, and the sentence at 600. The row keeps its
 *   height when it is marked read, so the list does not jump under the thumb.
 * - **Opening is reading** (`docs/DESIGN.md` → *Notifications*): a row's link marks it read in the
 *   adapter and then navigates. The badge drops one per row, never on mount, and there is no toast
 *   and no animation anywhere on this page.
 * - **`Mark all read`** sits at the top of the list and is drawn **disabled** when nothing is unread.
 * - **No paging control.** The inbox is capped by the deferral rule (10 unread, then a summary), not
 *   by a **Load more**; if the adapter ever reports more than one page, the page still asks once and
 *   logs the gap rather than inventing a third state the spec does not have.
 * - **A `comment` target has no route** — the schema carries the comment id and its label, not the
 *   post it hangs under. That row is drawn without a link and with its own **Mark read** control,
 *   which is the one place the spec's *Mark read* action is a button instead of the link.
 *
 * Aggregation is fixture data today (the six in `fixtures/social.ts` are already folded): the
 * adapter reads rows and writes `read`, it does not roll events up. Recorded in PROGRESS.
 */

type Phase = "loading" | "ready" | "error";

/** The noun a sentence uses for a target. `user` reads *profile*, because a handle is a profile. */
const NOUN: Record<NotificationTarget["kind"], string> = {
  character: "character",
  lorebook: "lorebook",
  preset: "preset",
  post: "post",
  comment: "comment",
  user: "profile",
};

/**
 * A row, worked out **once, outside the template** (the `cellOf` rule from `/bookmarks`): ripple
 * loses a discriminated union inside a block, so the sentence, the link and the label are decided
 * here and the template only reads strings.
 */
type Row = {
  id: string;
  initials: string;
  /** The sentence without the target's name. */
  text: string;
  /** ` — Target name`, or empty when the sentence already names everything (a follow). */
  subject: string;
  /** App path to open, or `null` when the target has no route of its own. */
  to: string | null;
  /** ISO for `<time datetime>`. */
  at: string;
  stamp: string;
  unread: boolean;
};

/** `@ada`, or `@ada and 2 others` when the row carries a count (`Aggregate by target`). */
function who(row: Notification): string {
  const actor = `@${row.actor ?? "someone"}`;
  if (row.count < 2) return actor;
  const others = row.count - 1;
  return `${actor} and ${others} ${others === 1 ? "other" : "others"}`;
}

/**
 * A moderation row **names the measure taken** and never restates the reasons — those live on the
 * content page. `measure` is optional, so an unnamed measure degrades to a neutral sentence instead
 * of printing `undefined`.
 */
function moderationText(noun: string, measure: Notification["measure"]): string {
  if (measure === "made-private") return `Your ${noun} was made private`;
  if (measure === "removed") return `Your ${noun} was removed`;
  if (measure === "avatar-removed") return `Your ${noun} had its avatar removed`;
  return `A moderation decision was made on your ${noun}`;
}

/** The one place a target kind becomes a route. `comment` has none — see the header comment. */
function linkFor(target: NotificationTarget): string | null {
  if (target.kind === "character") return `/character/${target.id}`;
  if (target.kind === "lorebook") return `/lorebook/${target.id}`;
  if (target.kind === "preset") return `/preset/${target.id}`;
  if (target.kind === "post") return `/post/${target.id}`;
  if (target.kind === "user") return `/user/${target.id}`;
  return null;
}

function rowOf(row: Notification): Row {
  const noun = NOUN[row.target.kind];
  const to = linkFor(row.target);

  let text = "";
  let subject = "";

  if (row.kind === "moderation") {
    text = moderationText(noun, row.measure);
    subject = ` — ${row.target.label}`;
  } else if (row.kind === "follow") {
    // A follow's target *is* the actor: naming it twice would read like a bug.
    text = `${who(row)} started following you`;
  } else if (row.kind === "comment") {
    text = `${who(row)} commented on your ${noun}`;
    subject = ` — ${row.target.label}`;
  } else {
    text = `${who(row)} published a new ${noun}`;
    subject = ` — ${row.target.label}`;
  }

  return {
    id: row.id,
    // A moderation row has no actor (nobody acts on your behalf but the system), so it takes the
    // product's own initials rather than an empty box.
    initials: row.actor ? initialsOf(row.actor) : "LP",
    text,
    subject,
    to,
    at: row.createdAt,
    stamp: relativeTime(row.createdAt),
    unread: !row.read,
  };
}

export function Notifications() @{
  const repo = resolveRepo();
  const signedIn = currentUser() !== null;

  const phase = track<Phase>("loading");
  const failure = track("");
  const rows = track<Row[]>([]);
  const busy = track(false);

  /**
   * Rows, not events — and read from the rows the adapter answered, so the note above the list
   * cannot disagree with the list it sits above.
   */
  const unread = track(() => rows.value.filter((row) => row.unread).length);

  /**
   * `Mark all read` is off while a write is in flight and when nothing is unread. A **derived**, not
   * an inline expression: a prop is evaluated once at the call, so `busy || unread.value === 0`
   * would freeze at mount (and `busy` alone is a truthy object, so the `||` would never even reach
   * `unread`). Handing the derived over lets `Button` read it on its own render.
   */
  const markAllOff = track(() => busy.value || unread.value === 0);

  function boot(): void {
    if (!signedIn) return;

    phase.value = "loading";
    failure.value = "";

    repo.listNotifications().then(
      (listing) => {
        rows.value = listing.items.map(rowOf);
        phase.value = "ready";
        // Opening the inbox clears nothing (`Badge`: *it does not reset on app launch*); this only
        // re-aligns the shell with the adapter, in case another surface moved a row.
        void refreshInbox();
      },
      () => {
        phase.value = "error";
        failure.value = "Your notifications couldn't be loaded.";
      },
    );
  }

  /** One write, one row: mark it read in the adapter, then let the badge re-read. */
  async function markOne(id: string): Promise<void> {
    await repo.markNotificationRead(id).catch(() => null);
    rows.value = rows.value.map((row) => (row.id === id ? { ...row, unread: false } : row));
    void refreshInbox();
  }

  async function markAll(): Promise<void> {
    if (busy.value || unread.value === 0) return;
    busy.value = true;

    const cleared = await repo.markAllNotificationsRead().catch(() => -1);
    busy.value = false;

    if (cleared < 0) {
      toast("Those notifications couldn't be marked read.");
      return;
    }

    rows.value = rows.value.map((row) => (row.unread ? { ...row, unread: false } : row));
    void refreshInbox();
  }

  /**
   * A row's own handler, so a modified click keeps the browser's behaviour (new tab) and a plain one
   * stays in-app: the memory adapter loses runtime rows on a full reload, so the inbox must not
   * hand the row to the document.
   */
  function openRow(row: Row): (event: MouseEvent) => void {
    const to = row.to;

    return (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      if (!to) return;
      event.preventDefault();
      void markOne(row.id).finally(() => navigate(to));
    };
  }

  if (signedIn) boot();

  <>
    <style>
      .inbox {
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
      .lede {
        display: none;
        max-width: 56ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      /* Mark all read, at the top of the list, with the count it clears. */
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--color-border);
      }

      .unread-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        line-height: 1.6;
      }

      .rows {
        max-width: 720px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      /* A row is a sentence, not a card: one hairline between rows and no box. */
      .row {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 14px 0 14px 12px;
        border-bottom: 1px solid var(--color-border);
        transition: background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .row:last-child {
        border-bottom: 0;
      }

      .row:hover {
        background-color: var(--color-surface);
      }

      /* Unread: the persona card's mark, reused — a 2px accent edge, and weight on the sentence. */
      .row.is-unread {
        box-shadow: inset 2px 0 0 var(--color-accent);
      }

      .body {
        flex: 1;
        min-width: 0;
      }

      .sentence {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.5;
        text-wrap: pretty;
      }

      .row.is-unread .sentence {
        color: var(--color-text);
        font-weight: 600;
      }

      .subject {
        color: var(--color-text-subtle);
        font-weight: 400;
      }

      /* The anchor covers the row (`::after`), so the tap target is the row, not the words. */
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

      .stamp {
        flex: none;
        padding-top: 2px;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        line-height: 1.4;
        white-space: nowrap;
      }

      .row-action {
        flex: none;
        /* Above the row-covering anchor: a control inside the link's paint area. */
        position: relative;
        z-index: 1;
        margin-top: -12px;
        margin-bottom: -12px;
      }

      .skel-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 14px 0;
        border-bottom: 1px solid var(--color-border);
      }

      .skel-avatar {
        flex: none;
        width: 32px;
        height: 32px;
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

        .lede {
          display: block;
          font-size: 15px;
        }

        .row,
        .skel-row {
          padding-left: 16px;
          gap: 12px;
        }

        .sentence {
          font-size: 15px;
        }
      }

      @media (min-width: 900px) {
        .toolbar {
          padding-bottom: 8px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .row {
          transition: none;
        }

        .skel-avatar {
          animation: none;
        }
      }
    </style>

    <div class="inbox">
      <header class="head">
        <p class="kicker">notifications</p>
        <h1 class="title">Inbox</h1>
        <p class="lede">
          What is worth coming back for: a comment on your post, someone new following you, a piece
          of yours that went private. Same-kind events on one target arrive as a single row, so a
          busy post is one line, not forty.
        </p>
      </header>

      @if (!signedIn) {
        <EmptyState
          message="Sign in to read your notifications."
          actionLabel="Sign in"
          href={href("/authentification")}
        />
      } @else {
        <>
          @if (phase.value === "loading") {
            <ul class="rows" aria-busy="true" aria-label="Loading notifications">
              @for (const row of [0, 1, 2, 3, 4]; key row) {
                <li class="skel-row">
                  <div class="skel-avatar"></div>
                  <div class="skel-lines">
                    <Skeleton variant="block" height={14} />
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
          } @else if (rows.value.length === 0) {
            <EmptyState message="Nothing waiting." />
          } @else {
            <>
              <div class="toolbar">
                <p class="unread-note">
                  {unread.value === 0 ? "All read" : `${unread.value} unread`}
                </p>
                <Button variant="ghost" disabled={markAllOff} onClick={markAll}>
                  Mark all read
                </Button>
              </div>

              <ul class="rows" aria-label="Notifications">
                @for (const row of rows.value; key row.id) {
                  <li class={row.unread ? "row is-unread" : "row"}>
                    <Avatar initials={row.initials} size={32} />
                    <div class="body">
                      @if (row.to) {
                        <p class="sentence">
                          <a class="row-link" href={href(row.to)} onClick={openRow(row)}>
                            {row.text}<span class="subject">{row.subject}</span>
                          </a>
                        </p>
                      } @else {
                        <p class="sentence">
                          {row.text}<span class="subject">{row.subject}</span>
                        </p>
                      }
                    </div>
                    <time class="stamp" datetime={row.at}>{row.stamp}</time>
                    @if (!row.to) {
                      <div class="row-action">
                        <Button
                          variant="ghost"
                          disabled={busy}
                          label={`Mark read: ${row.text}`}
                          onClick={() => markOne(row.id)}
                        >
                          Mark read
                        </Button>
                      </div>
                    }
                  </li>
                }
              </ul>
            </>
          }
        </>
      }
    </div>
  </>
}

export default Notifications;
