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
 * `/character/[character.id]` — the read surface (`src/specs/pages/character/detail.md`).
 *
 * Scope, decided in T-10 and extended in T-10B: identity + attached lorebooks + counts and ratio +
 * vote + bookmark + the owner's moderation notice + the settings menu, now holding **Fork**, a
 * wired **New session** and **Report**, and the page's one `btn-primary`: **Start a session /
 * Continue**, driven by `repo.findSessionForCharacter`. **Report** opens T-12's dialog with this
 * character as its target; the dialog is a sibling of the menu, never nested in it, and the entry is
 * absent while signed out (`components/report.md` → States).
 *
 * What this page owns, and what it deliberately does not:
 * - **The visibility rule.** `memory.ts`'s `getCharacter` answers any row by id (the owner and a
 *   moderator open it by id), so the private split lives here: the owner sees the moderation
 *   notice, everyone else sees the unavailable state. That is the one visibility rule the adapter
 *   leaves to the page; the listing half of it (*listings see published rows only*) is the
 *   adapter's, settled in the same commit.
 * - **NSFW is not access control.** `systems/nsfw.md`: *with Show off, a detail route still
 *   resolves* — the chrome (name, author, ratio, counts, actions) stays crisp and the body is
 *   withheld behind the same per-item Reveal a covered card carries. Never a 404, never an empty
 *   render.
 * - **Counts are the adapter's.** A vote returns the updated entity and the page renders what came
 *   back; it never recomputes a count. `repo.myVote` answers the vote in force, so the *Voted*
 *   state survives a remount instead of being a page-local guess that drifts from the adapter.
 * - **The view model is a field per thing the template draws.** A prop expression is evaluated
 *   once and ripple 0.4.7 loses a narrowing across a branch, so nothing here reads a nullable
 *   entity inside the template: every drawn value is its own `track()`, filled at load and updated
 *   from the adapter's answers.
 */

type Phase = "loading" | "ready" | "error";

/** One attached lorebook, resolved or not — an attachment that no longer resolves stays listed. */
type Attachment = { id: string; available: boolean; name: string; tagline: string };

/** One reason on the owner's notice, flattened: no nullable read survives into the template. */
type ReasonRow = { key: string; parts: string; reasons: string; details: string };

export function CharacterDetail() @{
  const repo = resolveRepo();
  const routeParams = useParams();
  const id = routeParams.id ?? "";

  const phase = track<Phase>("loading");
  const failure = track("");
  const missing = track(false);

  const name = track("");
  const inSession = track("");
  const tagline = track("");
  const description = track("");
  const initials = track("");
  const author = track("");
  const likes = track(0);
  const dislikes = track(0);
  const comments = track(0);
  const nsfw = track(false);
  const isPublic = track(true);

  const attachments = track<Attachment[]>([]);
  const bookmarked = track(false);
  const myVote = track<VoteDirection | null>(null);

  /** The owner's moderation notice, already flattened into strings. */
  const hasNotice = track(false);
  const noticeSummary = track("");
  const noticeMeasure = track("");
  const noticeReasons = track<ReasonRow[]>([]);

  const menuOpen = track(false);
  /**
   * The Report dialog (T-12). It is a **sibling** of the settings sheet, never a nested one: opening
   * it closes the menu, so a phone never has two sheets on the z-ladder at once.
   */
  const reportOpen = track(false);
  /** Signed out draws no entry at all (`report.md` → States: *Signed out — no button*). */
  const canReport = track(
    () => phase.value === "ready" && !missing.value && viewerHandle.value !== "",
  );
  const busy = track(false);
  const revealed = track(false);

  /** The session behind the primary control: `""` means none, and the control reads Start. */
  const sessionId = track("");
  /** One live label for the primary control — a prop expression is evaluated once. */
  const primaryLabel = track(() => (sessionId.value ? "Continue" : "Start a session"));
  /** Fork is absent while a row is private: a copy would republish what moderation removed. */
  const canFork = track(() => phase.value === "ready" && !missing.value && isPublic.value);

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

  let seq = 0;

  function load(): void {
    const mine = ++seq;
    phase.value = "loading";
    failure.value = "";
    missing.value = false;
    hasNotice.value = false;
    attachments.value = [];
    revealed.value = false;
    sessionId.value = "";

    Promise.all([
      repo.getCharacter(id),
      repo.isBookmarked("character", id),
      repo.myVote("character", id),
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
        // The in-session name is only worth a line when it is set *and* differs (`detail.md`).
        inSession.value =
          item.inSessionName && item.inSessionName !== item.name ? item.inSessionName : "";
        tagline.value = item.tagline;
        description.value = item.description;
        initials.value = item.avatar.initials;
        author.value = item.author;
        likes.value = item.likes;
        dislikes.value = item.dislikes;
        comments.value = item.commentCount;
        nsfw.value = item.nsfw;
        isPublic.value = item.isPublic;
        phase.value = "ready";

        loadAttachments(item.lorebookIds);
        loadSession(item.id);
        // The owner's notice is this page's rule, not the adapter's: only a private row gets one.
        if (!item.isPublic) loadNotice(item.id);
      },
      () => {
        if (mine !== seq) return;
        phase.value = "error";
        failure.value = "This character could not be loaded.";
      },
    );
  }

  /**
   * References, never copies (`detail.md` → *Attached lorebooks*): each id is resolved through the
   * adapter, and one that answers `null` keeps its row as *unavailable* instead of disappearing.
   */
  function loadAttachments(ids: string[]): void {
    Promise.all(ids.map((ref) => repo.getLorebook(ref))).then(
      (rows) => {
        attachments.value = ids.map((ref, index) => {
          const row = rows[index] ?? null;
          return {
            id: ref,
            available: row !== null,
            name: row?.name ?? "",
            tagline: row?.tagline ?? "",
          };
        });
      },
      () => {
        attachments.value = ids.map((ref) => ({
          id: ref,
          available: false,
          name: "",
          tagline: "",
        }));
      },
    );
  }

  /**
   * **Start a session / Continue.** Only the adapter knows whether one exists, so the page asks
   * `findSessionForCharacter` with the viewer's handle rather than scanning anything of its own —
   * and a signed-out visitor has nothing to continue.
   */
  function loadSession(characterId: string): void {
    const handle = currentUser()?.handle ?? "";
    if (!handle) {
      sessionId.value = "";
      return;
    }

    repo.findSessionForCharacter(characterId, handle).then(
      (session) => {
        sessionId.value = session?.id ?? "";
      },
      () => {
        sessionId.value = "";
      },
    );
  }

  /**
   * The owner's moderation notice: the case, its reasons, and the measure JEV applied.
   *
   * `listReports` is the only report read the adapter has, so the page takes one page of cases and
   * picks its own target. A character has one case per item (`systems/jev.md` → *one case per item,
   * its own reasons kept*), so the first match is the case.
   */
  function loadNotice(targetId: string): void {
    repo.listReports({ status: "all" }).then(
      (listing) => {
        const row =
          listing.items.find(
            (entry) => entry.target.kind === "character" && entry.target.id === targetId,
          ) ?? null;

        if (!row) {
          hasNotice.value = false;
          return;
        }

        const count = row.reasons.length;
        noticeSummary.value = `${count} ${count === 1 ? "report" : "reports"} on this case. It stays out of the catalog while it is private.`;
        noticeMeasure.value =
          row.jev.action === "made-private"
            ? "JEV found the body reproduced another character and made this private. Editing it is the only way to request a review."
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
    const updated = await repo.vote("character", id, direction).catch(() => null);
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

    const next = await repo.toggleBookmark("character", id).catch(() => null);
    if (!next) {
      toast("That bookmark didn't save.");
      return;
    }
    bookmarked.value = next.bookmarked;
    toast(next.bookmarked ? "Saved to your bookmarks." : "Removed from your bookmarks.");
  }

  function openEdit(): void {
    menuOpen.value = false;
    navigate(`/character/${id}/edit`);
  }

  /**
   * **Report** hands the dialog this character's target. The menu closes first — one sheet on the z
   * ladder, and the dialog's own close returns to the page rather than to a menu that is no longer
   * the task.
   */
  function openReport(): void {
    menuOpen.value = false;
    reportOpen.value = true;
  }

  /** The title/author/lorebook links are real anchors; this keeps a plain click in-app. */
  function openLink(event: MouseEvent, path: string): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(path);
  }

  /**
   * The primary control. With a session it opens that conversation — the most recent one, which is
   * what `findSessionForCharacter` answered; without one it starts a session and lands in it.
   * It never starts a second session: that is the settings menu's **New session**.
   */
  async function startOrContinue(): Promise<void> {
    if (!currentUser()) {
      navigate("/authentification");
      return;
    }

    if (sessionId.value) {
      navigate(`/session/${sessionId.value}`);
      return;
    }

    if (busy.value) return;
    busy.value = true;
    const session = await repo.createSession(id).catch(() => null);
    busy.value = false;

    if (!session) {
      toast("That session couldn't start.");
      return;
    }
    sessionId.value = session.id;
    navigate(`/session/${session.id}`);
  }

  /** **New session** (`character/detail.md`): a fresh session, leaving the existing one untouched. */
  async function newSession(): Promise<void> {
    menuOpen.value = false;

    if (!currentUser()) {
      navigate("/authentification");
      return;
    }
    if (busy.value) return;

    busy.value = true;
    const session = await repo.createSession(id).catch(() => null);
    busy.value = false;

    if (!session) {
      toast("That session couldn't start.");
      return;
    }
    sessionId.value = session.id;
    navigate(`/session/${session.id}`);
  }

  /** **Fork**: a new character owned by the viewer, landed on its own detail page. */
  async function fork(): Promise<void> {
    menuOpen.value = false;

    if (!currentUser()) {
      navigate("/authentification");
      return;
    }
    if (busy.value) return;

    busy.value = true;
    const copy = await repo.forkCharacter(id).catch(() => null);
    busy.value = false;

    if (!copy) {
      toast("That copy didn't save.");
      return;
    }
    navigate(`/character/${copy.id}`);
  }

  load();

  <>
    <style>
      .detail {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .head {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--color-border);
      }

      .identity {
        display: flex;
        flex: 1;
        align-items: flex-start;
        gap: 12px;
        min-width: 0;
      }

      .identity-text {
        min-width: 0;
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

      .in-session {
        margin: 6px 0 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.6;
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
         has to scroll a whole description to find Like will not find it. `lg` places the two
         columns explicitly, so the DOM order (main, then aside) is only a reading-order hint. */
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

      /* Four controls at 360 would squeeze every one of them under 44px, so the primary action
         takes its own row first and joins the row from `sm`. A grid wrapper stretches the
         primitive without the page reaching into it. */
      .start {
        display: grid;
        flex: 1 1 100%;
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

      .tagline {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 15px;
        line-height: 1.6;
        text-wrap: pretty;
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

      .attached {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--color-border);
        list-style: none;
      }

      .attached-row {
        padding: 10px 0;
        border-bottom: 1px solid var(--color-border);
      }

      .attached-link {
        display: flex;
        align-items: center;
        min-height: 28px;
        color: var(--color-text);
        font-size: 14px;
        text-decoration: none;
      }

      .attached-link:hover {
        color: var(--color-accent);
        text-decoration: underline;
      }

      .attached-note {
        margin: 2px 0 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.6;
      }

      .attached-missing {
        display: flex;
        align-items: center;
        min-height: 28px;
        color: var(--color-text-subtle);
        font-size: 14px;
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

      /* The comment thread sits under the definition and the lorebooks, at every width: a thread
         is part of the page's reading, not metadata for the aside. */
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

        .vote,
        .save {
          flex: 0 0 auto;
          min-width: 132px;
        }

        .start {
          flex: 0 0 auto;
        }
      }

      /* `lg`: two columns — the definition beside a 320px aside of counts and actions. */
      @media (min-width: 1200px) {
        .cols {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          align-items: start;
          gap: 32px;
        }

        /* The aside is second in the DOM and placed on the right; on a phone it comes first. */
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
        <div class="loading" aria-busy="true" aria-label="Loading character">
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
          message="This character doesn't exist."
          actionLabel="Back to the catalog"
          href={href("/character/catalog")}
        />
      } @else if (unavailable.value) {
        <EmptyState
          message="This character isn't available."
          actionLabel="Back to the catalog"
          href={href("/character/catalog")}
        />
      } @else {
        <>
          <header class="head">
            <div class="identity">
              <Avatar initials={initials.value} size={56} label={name.value} />
              <div class="identity-text">
                <p class="kicker">character</p>
                <h1 class="title">{name.value}</h1>
                @if (inSession.value) {
                  <p class="in-session">{`Called “${inSession.value}” inside a session.`}</p>
                }
              </div>
            </div>
            <button
              class="menu-btn"
              type="button"
              aria-label="Character settings"
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
              <p class="notice-title">This character was made private by moderation.</p>
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
                  @if (tagline.value) {
                    <p class="tagline">{tagline.value}</p>
                  }
                  <p class="prose">{description.value}</p>
                </div>

                @if (covered.value) {
                  <div class="cover">
                    <Button variant="ghost" onClick={() => (revealed.value = true)}>Reveal</Button>
                  </div>
                }
              </div>

              <section class="lorebooks" aria-label="Attached lorebooks">
                <h2 class="section-title">Lorebooks</h2>
                @if (attachments.value.length === 0) {
                  <p class="note">No lorebooks attached.</p>
                } @else {
                  <ul class="attached">
                    @for (const row of attachments.value; key row.id) {
                      <li class="attached-row">
                        @if (row.available) {
                          <>
                            <a
                              class="attached-link"
                              href={href(`/lorebook/${row.id}`)}
                              onClick={(event) => openLink(event, `/lorebook/${row.id}`)}
                            >
                              {row.name}
                            </a>
                            @if (row.tagline.length > 0) {
                              <p class="attached-note">{row.tagline}</p>
                            }
                          </>
                        } @else {
                          <span class="attached-missing">Unavailable attachment</span>
                        }
                      </li>
                    }
                  </ul>
                }
              </section>

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
                {/* The one primary action: `.start` is a grid wrapper so the Button stretches at
                    360 and shrinks to its label from `sm` — a page cannot style a primitive's
                    element (T-09), so the wrapper is what gets placed. */}
                <div class="start">
                  <Button variant="primary" disabled={busy} onClick={startOrContinue}>
                    {primaryLabel.value}
                  </Button>
                </div>
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
      <Sheet title="Character" onClose={() => (menuOpen.value = false)}>
        <div class="menu">
          <button class="menu-item" type="button" onClick={newSession}>New session</button>
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
        </div>
      </Sheet>
    }

    @if (reportOpen.value) {
      <ReportDialog
        target={{ kind: "character", id, label: name.value }}
        onClose={() => (reportOpen.value = false)}
      />
    }
  </>
}

export default CharacterDetail;
