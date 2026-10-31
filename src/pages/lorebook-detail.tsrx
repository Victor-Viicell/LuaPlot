import { track } from "ripple";
import { Avatar } from "../components/Avatar.tsrx";
import { Button } from "../components/Button.tsrx";
import { CommentThread } from "../components/CommentThread.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { IconMore } from "../components/Icons.tsrx";
import { ReportDialog } from "../components/ReportDialog.tsrx";
import { Sheet } from "../components/Sheet.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, navigate, useParams } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import { ratioOf, type User, type VoteDirection } from "../lib/data/types.ts";
import { percent } from "../lib/format.ts";
import { currentUser, onSession } from "../lib/state/session.ts";
import { nsfwPreference, onPrefs } from "../lib/state/prefs.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/lorebook/[lorebook.id]` — the read surface (`src/specs/pages/lorebook/detail.md`).
 *
 * It inherits the character detail page's decisions (`docs/DESIGN.md` → *Character detail*): counts
 * before the definition on a phone, one settings `Sheet` holding Fork / Bookmark / Report / Edit, the
 * owner's moderation notice while private, and the same two refusal states. Its differences:
 * - **The avatar is the cover** (`hero`, 1:1) at the top of the content column — full-bleed at 360,
 *   a fixed 320px column from `sm` — with the name and the menu beside it.
 * - **The entry list is the page**: every entry, in the author's order, keywords visible, no
 *   collapse, no filtering by keyword and no paging. A long list scrolls with the page — no
 *   `max-height` and no inner scroller, because the spec forbids both.
 * - **There is no Start a session here** and no in-session name: a lorebook is read, forked and
 *   commented on. A character is what a session starts from.
 * - **`Request public again`** (`detail.md` → Actions, owner while private) has no write behind it,
 *   so it is drawn **disabled**, exactly as Report was drawn before T-12. It is listed in the baton
 *   as an open ticket rather than wired to a fake success.
 *
 * The visibility rule is still the page's: `repo.getLorebook` answers any row by id (the owner and a
 * moderator open it by id), so the private split lives here — the owner sees the moderation notice,
 * everyone else sees *unavailable*.
 */

type Phase = "loading" | "ready" | "error";

/** One reason on the owner's notice, flattened: no nullable read survives into the template. */
type ReasonRow = { key: string; parts: string; reasons: string; details: string };

/** One entry as the page draws it: its position, its keywords, its body. */
type EntryRow = { key: string; keywords: string[]; content: string };

export function LorebookDetail() @{
  const repo = resolveRepo();
  const routeParams = useParams();
  const id = routeParams.id ?? "";

  const phase = track<Phase>("loading");
  const failure = track("");
  const missing = track(false);

  const name = track("");
  const description = track("");
  const initials = track("");
  const author = track("");
  const likes = track(0);
  const dislikes = track(0);
  const comments = track(0);
  const nsfw = track(false);
  const isPublic = track(true);
  const entries = track<EntryRow[]>([]);

  const bookmarked = track(false);
  const myVote = track<VoteDirection | null>(null);

  /** The owner's moderation notice, already flattened into strings. */
  const hasNotice = track(false);
  const noticeSummary = track("");
  const noticeMeasure = track("");
  const noticeReasons = track<ReasonRow[]>([]);

  const menuOpen = track(false);
  /** The Report dialog is a **sibling** of the settings sheet, never a nested one. */
  const reportOpen = track(false);
  const busy = track(false);
  const revealed = track(false);

  /** Session and the NSFW pair are plain stores; these are the signals this render reads. */
  const viewer = track<User | null>(currentUser());
  const show = track(nsfwPreference().show);
  onSession((next) => {
    viewer.value = next;
  });
  onPrefs((next) => {
    show.value = next.show;
  });

  /** The handle the comment thread writes as — live, so a sign-out empties the composer. */
  const viewerHandle = track(() => viewer.value?.handle ?? "");

  const owner = track(
    () => viewer.value !== null && author.value !== "" && author.value === viewer.value.handle,
  );
  /** The chrome stays crisp; only the body is withheld (`nsfw.md` → *the numbers are never hidden*). */
  const covered = track(() => nsfw.value && !show.value && !revealed.value);
  const unavailable = track(
    () => phase.value === "ready" && !missing.value && !isPublic.value && !owner.value,
  );
  /** Signed out draws no Report entry at all (`report.md` → States). */
  const canReport = track(() => phase.value === "ready" && !missing.value && viewerHandle.value !== "");
  /** Fork is absent while a row is private: a copy would republish what moderation removed. */
  const canFork = track(() => phase.value === "ready" && !missing.value && isPublic.value);

  let seq = 0;

  function load(): void {
    const mine = ++seq;
    phase.value = "loading";
    failure.value = "";
    missing.value = false;
    hasNotice.value = false;
    entries.value = [];
    revealed.value = false;

    Promise.all([
      repo.getLorebook(id),
      repo.isBookmarked("lorebook", id),
      repo.myVote("lorebook", id),
    ]).then(
      ([item, saved, vote]) => {
        if (mine !== seq) return;

        bookmarked.value = saved;
        myVote.value = vote;

        if (!item) {
          missing.value = true;
          phase.value = "ready";
          return;
        }

        name.value = item.name;
        description.value = item.description;
        initials.value = item.avatar.initials;
        author.value = item.author;
        likes.value = item.likes;
        dislikes.value = item.dislikes;
        comments.value = item.commentCount;
        nsfw.value = item.nsfw;
        isPublic.value = item.isPublic;
        // The author's order is the reading order; the adapter stored it that way.
        entries.value = item.entries.map((entry) => ({
          key: entry.id,
          keywords: entry.keywords,
          content: entry.content,
        }));
        phase.value = "ready";

        // The owner's notice is this page's rule, not the adapter's: only a private row gets one.
        if (!item.isPublic) loadNotice(item.id);
      },
      () => {
        if (mine !== seq) return;
        phase.value = "error";
        failure.value = "This lorebook could not be loaded.";
      },
    );
  }

  /**
   * The owner's moderation notice: the case, its reasons, and the measure JEV applied.
   * A lorebook has one case per item, so the first match is the case.
   */
  function loadNotice(targetId: string): void {
    repo.listReports({ status: "all" }).then(
      (listing) => {
        const row =
          listing.items.find(
            (entry) => entry.target.kind === "lorebook" && entry.target.id === targetId,
          ) ?? null;

        if (!row) {
          hasNotice.value = false;
          return;
        }

        const count = row.reasons.length;
        noticeSummary.value = `${count} ${count === 1 ? "report" : "reports"} on this case. It stays out of the catalog while it is private.`;
        noticeMeasure.value =
          row.jev.action === "made-private"
            ? "JEV found this lorebook reproduced another author's work and made it private. Editing it is the only way to request a review."
            : "JEV has not concluded this case yet, so it stays private until it does.";
        noticeReasons.value = row.reasons.map((entry, index) => ({
          key: `${index}-${entry.at}`,
          parts: entry.parts.join(" + "),
          reasons: entry.reasons.join(" + "),
          details: entry.details ?? "",
        }));
        hasNotice.value = true;
      },
      () => {
        hasNotice.value = false;
      },
    );
  }

  /** One vote per viewer, and a switch replaces the previous one — the adapter owns that rule. */
  async function castVote(direction: VoteDirection): Promise<void> {
    if (!currentUser()) {
      navigate("/authentification");
      return;
    }
    if (busy.value) return;

    busy.value = true;
    const updated = await repo.vote("lorebook", id, direction).catch(() => null);
    busy.value = false;

    if (!updated) {
      toast("That vote didn't save.");
      return;
    }

    likes.value = updated.likes;
    dislikes.value = updated.dislikes;
    myVote.value = direction;
  }

  async function toggleBookmark(): Promise<void> {
    menuOpen.value = false;

    if (!currentUser()) {
      navigate("/authentification");
      return;
    }

    const next = await repo.toggleBookmark("lorebook", id).catch(() => null);
    if (!next) {
      toast("That bookmark didn't save.");
      return;
    }
    bookmarked.value = next.bookmarked;
    toast(next.bookmarked ? "Saved to your bookmarks." : "Removed from your bookmarks.");
  }

  function openEdit(): void {
    menuOpen.value = false;
    navigate(`/lorebook/${id}/edit`);
  }

  function openReport(): void {
    menuOpen.value = false;
    reportOpen.value = true;
  }

  /** The title/author links are real anchors; this keeps a plain click in-app. */
  function openLink(event: MouseEvent, path: string): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(path);
  }

  /** **Fork**: a new lorebook owned by the viewer, every entry copied as it stands. */
  async function fork(): Promise<void> {
    menuOpen.value = false;

    if (!currentUser()) {
      navigate("/authentification");
      return;
    }
    if (busy.value) return;

    busy.value = true;
    const copy = await repo.forkLorebook(id).catch(() => null);
    busy.value = false;

    if (!copy) {
      toast("That copy didn't save.");
      return;
    }
    navigate(`/lorebook/${copy.id}`);
  }

  load();

  <>
    <style>
      .detail {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      /* The head is a grid: the cover owns the first row, **full width of the content column and
         square** (1:1); the name sits under it and the menu beside the name. From `sm` the cover
         becomes a fixed 320px column with the name and the button to its right. */
      .head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--color-border);
      }

      .portrait {
        grid-column: 1 / -1;
        width: 100%;
      }

      .menu-btn {
        grid-column: 2;
        grid-row: 2;
      }

      /* Base placement comes **before** the media block: both selectors have the same specificity, so
         a base rule declared after the query would win at every width and keep the name under the
         cover on desktop. */
      .identity-text {
        grid-column: 1;
        grid-row: 2;
        min-width: 0;
      }

      @media (min-width: 640px) {
        .head {
          grid-template-columns: 320px minmax(0, 1fr) auto;
          align-items: start;
          gap: 20px;
        }

        .portrait {
          grid-column: 1;
          grid-row: 1;
        }

        .identity-text {
          grid-column: 2;
          grid-row: 1;
          align-self: end;
        }

        .menu-btn {
          grid-column: 3;
          grid-row: 1;
        }
      }

      .kicker {
        margin: 0 0 4px;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.15;
        text-wrap: balance;
      }

      /* The page's own 44px settings target — a second menu that is not the shell's overflow. */
      .menu-btn {
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        margin: -10px -10px 0 0;
        padding: 0;
        border: 1px solid transparent;
        border-radius: 2px;
        background: transparent;
        color: var(--color-text-muted);
        cursor: pointer;
      }

      .menu-btn:hover {
        border-color: var(--color-border-strong);
        color: var(--color-text);
      }

      .byline {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: -8px 0 0;
        font-size: 13px;
      }

      .byline a {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        color: var(--color-text-muted);
        text-decoration: none;
      }

      .byline a:hover {
        color: var(--color-text);
        text-decoration: underline;
      }

      /* Mobile: one column, and the engagement row comes **before** the definition — a reader who
         has to scroll every entry to find Like will not find it. `lg` places the two columns
         explicitly, so the DOM order (main, then aside) is only a reading-order hint. */
      .cols {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .aside {
        order: -1;
      }

      /* Counts: four cells in one row at 360 — likes, dislikes, ratio, comments. */
      .counts {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1px;
        margin: 0;
        padding: 0;
        border: 1px solid var(--color-border);
        background-color: var(--color-border);
        list-style: none;
      }

      .count {
        padding: 10px 8px;
        background-color: var(--color-bg-elevated);
      }

      .count-label {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .count-value {
        margin: 2px 0 0;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.4;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .vote,
      .save {
        display: inline-flex;
        flex: 1 1 auto;
        align-items: center;
        justify-content: center;
        min-width: 96px;
        min-height: 44px;
        padding: 0 14px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        background-color: var(--color-surface);
        color: var(--color-text);
        font-family: var(--font-body);
        font-size: 14px;
        cursor: pointer;
        transition:
          border-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
          color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .vote:hover:not(:disabled),
      .save:hover:not(:disabled) {
        border-color: var(--color-accent);
      }

      .vote[aria-pressed="true"],
      .save[aria-pressed="true"] {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .vote:disabled,
      .save:disabled {
        color: var(--color-text-subtle);
        cursor: default;
      }

      /* The stage: the body is blurred, and the scrim with its Reveal is a sibling of the filter. */
      .stage {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .veiled {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .veiled.is-covered {
        filter: blur(6px);
        user-select: none;
      }

      .cover {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding-top: 8px;
        background-color: color-mix(in srgb, var(--color-bg) 55%, transparent);
      }

      .prose {
        max-width: 68ch;
        margin: 0;
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      .section-title {
        margin: 0 0 8px;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      /* The entry list: one block per entry, a rule between them, **no inner scroller**. A long list
         scrolls with the page (`detail.md` → *Long entry list*), so nothing here caps its height. */
      .entries {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--color-border);
        list-style: none;
      }

      .entry {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px 0 16px;
        border-bottom: 1px solid var(--color-border);
      }

      .keywords {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .keyword {
        padding: 2px 8px;
        border: 1px solid var(--color-border);
        border-radius: 2px;
        color: var(--color-text-muted);
        font-size: 12px;
        line-height: 1.6;
      }

      .entry-text {
        margin: 0;
        color: var(--color-text);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
        white-space: pre-wrap;
      }

      .note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.6;
      }

      /* Moderation notice — owner only, while private. Danger marks the measure, not decoration. */
      .notice {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border: 1px solid var(--color-border);
        border-left: 2px solid var(--color-danger);
        border-radius: 2px;
        background-color: var(--color-bg-elevated);
      }

      .notice-title {
        margin: 0;
        color: var(--color-danger);
        font-size: 13px;
        font-weight: 600;
        line-height: 1.5;
      }

      .notice-body {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.7;
      }

      .reasons {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .reason {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .reason-tag {
        flex: none;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      /* The settings menu: plain 44px rows inside the sheet. */
      .menu {
        display: flex;
        flex-direction: column;
        border-top: 1px solid var(--color-border);
      }

      .menu-item {
        display: flex;
        align-items: center;
        min-height: 44px;
        padding: 0 2px;
        border: 0;
        border-bottom: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text);
        font-family: var(--font-body);
        font-size: 14px;
        text-align: left;
        cursor: pointer;
      }

      .menu-item:hover:not(:disabled) {
        color: var(--color-accent);
      }

      .menu-item:disabled {
        color: var(--color-text-subtle);
        cursor: default;
      }

      /* A control with no write behind it says so, instead of pretending to work. */
      .menu-note {
        margin: 2px 0 0;
        color: var(--color-text-subtle);
        font-size: 11px;
        line-height: 1.4;
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

      .loading {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* The comment thread sits under the entry list, at every width: a thread is part of the
         page's reading, not metadata for the aside. */
      .comments {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 28px;
      }

      @media (min-width: 640px) {
        .title {
          font-size: 34px;
        }

        .prose {
          font-size: 15px;
        }

        .entry-text {
          font-size: 15px;
        }

        .vote,
        .save {
          flex: 0 0 auto;
          min-width: 132px;
        }
      }

      /* `lg`: two columns — the description and entries beside a 320px aside of counts and actions. */
      @media (min-width: 1200px) {
        .cols {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          align-items: start;
          gap: 32px;
        }

        .aside {
          order: 0;
          grid-column: 2;
          grid-row: 1;
        }

        .main {
          grid-column: 1;
          grid-row: 1;
        }
      }
    </style>

    <div class="detail">
      @if (phase.value === "loading") {
        <div class="loading" aria-busy="true" aria-label="Loading lorebook">
          <Skeleton variant="block" height={34} />
          <Skeleton variant="block" height={64} />
          <Skeleton variant="block" height={140} />
          <Skeleton variant="block" height={14} />
        </div>
      } @else if (phase.value === "error") {
        <div class="alert" role="alert">
          <p class="alert-text">{failure.value}</p>
          <Button variant="secondary" onClick={load}>Retry</Button>
        </div>
      } @else if (missing.value) {
        <EmptyState
          message="This lorebook doesn't exist."
          actionLabel="Back to the catalog"
          href={href("/lorebook/catalog")}
        />
      } @else if (unavailable.value) {
        <EmptyState
          message="This lorebook isn't available."
          actionLabel="Back to the catalog"
          href={href("/lorebook/catalog")}
        />
      } @else {
        <>
          <header class="head">
            <div class="portrait">
              <Avatar initials={initials.value} size="hero" label={name.value} />
            </div>
            <div class="identity-text">
              <p class="kicker">lorebook</p>
              <h1 class="title">{name.value}</h1>
            </div>
            <button
              class="menu-btn"
              type="button"
              aria-label="Lorebook settings"
              aria-haspopup="dialog"
              aria-expanded={menuOpen.value ? "true" : "false"}
              onClick={() => (menuOpen.value = true)}
            >
              <IconMore />
            </button>
          </header>

          <p class="byline">
            <a
              href={href(`/user/${author.value}`)}
              onClick={(event) => openLink(event, `/user/${author.value}`)}
            >
              {`@${author.value}`}
            </a>
          </p>

          @if (hasNotice.value) {
            <section class="notice" aria-label="Moderation notice">
              <p class="notice-title">This lorebook was made private by moderation.</p>
              <p class="notice-body">{noticeSummary.value}</p>
              <ul class="reasons">
                @for (const row of noticeReasons.value; key row.key) {
                  <li class="reason">
                    <span class="reason-tag">{row.parts}</span>
                    <span>{row.reasons}</span>
                    @if (row.details.length > 0) {
                      <span>{`— ${row.details}`}</span>
                    }
                  </li>
                }
              </ul>
              <p class="notice-body">{noticeMeasure.value}</p>
            </section>
          }

          <div class="cols">
            <div class="main">
              <div class="stage">
                <div
                  class={covered.value ? "veiled is-covered" : "veiled"}
                  aria-hidden={covered.value ? "true" : "false"}
                >
                  @if (description.value.length > 0) {
                    <p class="prose">{description.value}</p>
                  }

                  <section class="entries-section" aria-label="Entries">
                    <h2 class="section-title">Entries</h2>
                    @if (entries.value.length === 0) {
                      <p class="note">This lorebook has no entries yet.</p>
                    } @else {
                      <ul class="entries">
                        @for (const row of entries.value; key row.key) {
                          <li class="entry">
                            <ul class="keywords" aria-label="Keywords">
                              @for (const word of row.keywords; key word) {
                                <li class="keyword">{word}</li>
                              }
                            </ul>
                            <p class="entry-text">{row.content}</p>
                          </li>
                        }
                      </ul>
                    }
                  </section>
                </div>

                @if (covered.value) {
                  <div class="cover">
                    <Button variant="ghost" onClick={() => (revealed.value = true)}>Reveal</Button>
                  </div>
                }
              </div>

              <section class="comments" aria-label="Comments">
                <h2 class="section-title">Comments</h2>
                <CommentThread
                  itemId={id}
                  viewer={viewerHandle}
                  onCount={(count) => (comments.value = count)}
                />
              </section>
            </div>

            <aside class="aside">
              <ul class="counts" aria-label="Engagement">
                <li class="count">
                  <p class="count-label">Likes</p>
                  <p class="count-value">{likes.value}</p>
                </li>
                <li class="count">
                  <p class="count-label">Dislikes</p>
                  <p class="count-value">{dislikes.value}</p>
                </li>
                <li class="count">
                  <p class="count-label">Ratio</p>
                  <p class="count-value">
                    {percent(ratioOf({ likes: likes.value, dislikes: dislikes.value }))}
                  </p>
                </li>
                <li class="count">
                  <p class="count-label">Comments</p>
                  <p class="count-value">{comments.value}</p>
                </li>
              </ul>

              <div class="actions">
                <button
                  class="vote"
                  type="button"
                  aria-pressed={myVote.value === "like" ? "true" : "false"}
                  disabled={busy.value}
                  onClick={() => castVote("like")}
                >
                  Like
                </button>
                <button
                  class="vote"
                  type="button"
                  aria-pressed={myVote.value === "dislike" ? "true" : "false"}
                  disabled={busy.value}
                  onClick={() => castVote("dislike")}
                >
                  Dislike
                </button>
                <button
                  class="save"
                  type="button"
                  aria-pressed={bookmarked.value ? "true" : "false"}
                  onClick={toggleBookmark}
                >
                  {bookmarked.value ? "Remove bookmark" : "Bookmark"}
                </button>
              </div>
            </aside>
          </div>
        </>
      }
    </div>

    @if (menuOpen.value) {
      <Sheet title="Lorebook" onClose={() => (menuOpen.value = false)}>
        <div class="menu">
          <button class="menu-item" type="button" onClick={toggleBookmark}>
            {bookmarked.value ? "Remove bookmark" : "Bookmark"}
          </button>
          @if (canFork.value) {
            <button class="menu-item" type="button" onClick={fork}>Fork</button>
          }
          @if (canReport.value) {
            <button class="menu-item" type="button" onClick={openReport}>Report</button>
          }
          @if (owner.value) {
            <button class="menu-item" type="button" onClick={openEdit}>Edit</button>
          }
          @if (owner.value && !isPublic.value) {
            <>
              {/* `detail.md` → Actions has no write behind this yet: it is drawn disabled, never
                  wired to a fake success. */}
              <button class="menu-item" type="button" disabled>
                Request public again
              </button>
              <p class="menu-note">Not available yet — editing the lorebook is the path that exists.</p>
            </>
          }
        </div>
      </Sheet>
    }

    @if (reportOpen.value) {
      <ReportDialog
        target={{ kind: "lorebook", id, label: name.value }}
        onClose={() => (reportOpen.value = false)}
      />
    }
  </>
}

export default LorebookDetail;
