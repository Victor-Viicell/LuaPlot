import { track } from "ripple";
import { Avatar } from "../components/Avatar.tsrx";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { IconArrowUp, IconBack, IconMore } from "../components/Icons.tsrx";
import { PostComposer } from "../components/PostComposer.tsrx";
import { Select } from "../components/Select.tsrx";
import { Sheet } from "../components/Sheet.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, navigate, useParams } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Persona, Session, Turn } from "../lib/data/types.ts";
import { clockTime, initialsOf } from "../lib/format.ts";
import { turnWriteSchema } from "../lib/schema.ts";
import { currentUser } from "../lib/state/session.ts";
import { previewMode, replyTo } from "../lib/llm/chat.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/session/[session.id]` — one conversation (`src/specs/pages/session/detail.md`).
 *
 * The spec fixes only the settings button and leaves *Layout* to be specified, so the choices below
 * are recorded in `docs/DESIGN.md` → *Session*:
 *
 * - **The page is the transcript**, not a dashboard: the character's in-session name and the persona
 *   in use at the top, the settings button at their right, then the turns under the in-session name,
 *   then the composer. There is no session list anywhere — the URL or the character's **Continue** is
 *   the only way in.
 * - **The settings `Sheet` holds exactly two options** — **New session** first, **Delete session**
 *   second, the latter behind a confirmation. Persona switching is its own control beside the
 *   persona line, never a third menu item.
 * - **Copies are a disclosure, closed by default**, so the transcript starts at the top of the page;
 *   the summary row reads `4 copies · 1 edited`. Each copy draws one control per state: a *linked*
 *   copy offers **Update from original** (with confirmation, because it overwrites the session's
 *   edits) and **Restore** only while it is `edited`; an *unlinked* copy offers neither and still
 *   runs.
 * - **One scrollbar.** The shell scrolls the page; the composer sits in flow after the transcript, so
 *   there is no fixed bar for a phone keyboard to cover and no second scroller. From `md` the copies
 *   move to a 300px aside so the page stops being a stretched phone.
 * - **Send appends one user turn** through `repo.appendTurn`, then asks `lib/llm/chat.ts` for a reply
 *   while the transcript draws the character's row as a two-line skeleton (*Awaiting model
 *   response*). The reply comes back through `repo.appendReply`, so a model turn is stored exactly
 *   like a typed one. A configured provider answers through `lib/llm/provider.ts`; with none, the
 *   deterministic mock answers and the dock says **Preview mode** — the page never pretends.
 * - **Not-found and not-a-participant are one state** (the adapter answers `null` for both):
 *   `This session doesn't exist.`
 */

/** One copy, flattened — a discriminated union cannot be narrowed inside a template block. */
type CopyRow = {
  key: string;
  kind: "character" | "lorebook" | "preset";
  kindLabel: string;
  name: string;
  sourceId: string;
  version: number;
  edited: boolean;
  unlinked: boolean;
  detail: string;
};

type Phase = "loading" | "ready" | "error";
type CopyAction = "" | "update" | "restore";

function rowsOf(session: Session): CopyRow[] {
  const rows: CopyRow[] = [
    {
      key: `character:${session.character.sourceId}`,
      kind: "character",
      kindLabel: "Character",
      name: session.character.inSessionName || session.character.name,
      sourceId: session.character.sourceId,
      version: session.character.version,
      edited: session.character.edited,
      unlinked: session.character.unlinked,
      detail: session.character.unlinked
        ? "The original is out of reach. This copy runs on."
        : `From ${session.character.name} · version ${session.character.version}`,
    },
  ];

  for (const book of session.lorebooks) {
    rows.push({
      key: `lorebook:${book.sourceId}`,
      kind: "lorebook",
      kindLabel: "Lorebook",
      name: book.name,
      sourceId: book.sourceId,
      version: book.version,
      edited: book.edited,
      unlinked: book.unlinked,
      detail: book.unlinked
        ? "The original is out of reach. This copy runs on."
        : `${book.entries.length === 1 ? "1 entry" : `${book.entries.length} entries`} · version ${book.version}`,
    });
  }

  rows.push({
    key: `preset:${session.preset.sourceId}`,
    kind: "preset",
    kindLabel: "Preset",
    name: session.preset.name,
    sourceId: session.preset.sourceId,
    version: session.preset.version,
    edited: session.preset.edited,
    unlinked: session.preset.unlinked,
    detail: session.preset.unlinked
      ? "The original is out of reach. This copy runs on."
      : `Model ${session.preset.settings.model} · version ${session.preset.version}`,
  });

  return rows;
}

export function SessionDetail() @{
  const repo = resolveRepo();
  const params = useParams();
  /** `[session.id]` keys the param `id` — never read the pathname for it. */
  const id = params.id ?? "";

  const phase = track<Phase>("loading");
  const failure = track("");
  const missing = track(false);

  /** The identity block. The in-session name is a copy field, so it is read from the copy. */
  const speaker = track("");
  const initials = track("");
  const sourceId = track("");
  const createdAt = track("");
  const presetName = track("");

  const personaId = track("");
  const personaName = track("");
  const turns = track<Turn[]>([]);
  const copies = track<CopyRow[]>([]);

  const draft = track("");
  const sendError = track("");
  const sending = track(false);
  /** True while the mock is answering — the page draws the `Preview mode` chip from it. */
  const preview = track(previewMode());

  const settingsOpen = track(false);
  const confirmDelete = track(false);
  const deleting = track(false);

  const personaOpen = track(false);
  const personas = track<Persona[]>([]);

  const copiesOpen = track(false);
  const confirming = track("");
  const confirmingAction = track<CopyAction>("");
  const busyCopy = track("");

  const publishOpen = track(false);
  const rangeReady = track(false);
  const rangeFrom = track("1");
  const rangeTo = track("1");

  const viewer = currentUser();
  const signedIn = viewer !== null;
  /** The user's side of the transcript: the persona's name, or the generic `User`. */
  const userSide = track(() => personaName.value || "User");
  const denySend = track(() => sending.value || draft.value.trim().length === 0);
  const editedCount = track(() => copies.value.filter((row) => row.edited).length);
  const summary = track(
    () =>
      `${copies.value.length} ${copies.value.length === 1 ? "copy" : "copies"}${
        editedCount.value > 0 ? ` · ${editedCount.value} edited` : ""
      }`,
  );

  /** Both range menus read from the same transcript; `1`-based because a turn is `1.` to a reader. */
  const turnOptions = track(() =>
    turns.value.map((turn, index) => ({
      value: String(index + 1),
      label: `${index + 1} · ${turn.role === "character" ? speaker.value : userSide.value} — ${turn.text.slice(0, 30)}`,
    })),
  );

  const cutTurns = track(() => {
    const from = Number(rangeFrom.value);
    const to = Number(rangeTo.value);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return [] as Turn[];
    const start = Math.max(1, Math.min(from, to));
    const end = Math.min(turns.value.length, Math.max(from, to));
    return turns.value.slice(start - 1, end);
  });
  const cutLabel = track(() => {
    const from = Number(rangeFrom.value);
    const to = Number(rangeTo.value);
    const start = Math.max(1, Math.min(from, to));
    const end = Math.min(turns.value.length, Math.max(from, to));
    const count = Math.max(0, end - start + 1);
    return `Turn ${start} → Turn ${end} · ${count} ${count === 1 ? "message" : "messages"}`;
  });

  let seq = 0;

  /** One writer for the whole row, so the header, the copies and the transcript cannot disagree. */
  function applySession(session: Session): void {
    speaker.value = session.character.inSessionName || session.character.name;
    initials.value = session.character.avatar.initials || initialsOf(session.character.name);
    sourceId.value = session.character.sourceId;
    createdAt.value = session.createdAt;
    presetName.value = session.preset.name;
    personaId.value = session.personaId ?? "";
    turns.value = session.turns;
    copies.value = rowsOf(session);

    if (rangeTo.value === "1" || Number(rangeTo.value) > session.turns.length) {
      rangeTo.value = String(Math.max(1, session.turns.length));
    }

    const currentPersona = session.personaId ?? "";
    if (currentPersona === "") {
      personaName.value = "";
      return;
    }
    repo.getPersona(currentPersona).then(
      (found) => {
        personaName.value = found?.name ?? "";
      },
      () => {
        personaName.value = "";
      },
    );
  }

  function load(): void {
    const mine = ++seq;
    phase.value = "loading";
    failure.value = "";
    missing.value = false;

    repo.getSession(id).then(
      (session) => {
        if (mine !== seq) return;
        if (!session) {
          missing.value = true;
          phase.value = "ready";
          return;
        }
        applySession(session);
        phase.value = "ready";
      },
      () => {
        if (mine !== seq) return;
        phase.value = "error";
        failure.value = "This session could not be loaded.";
      },
    );
  }

  // ---- Send ------------------------------------------------------------------------------------

  async function send(): Promise<void> {
    if (sending.value) return;

    const parsed = turnWriteSchema.safeParse({ text: draft.value });
    if (!parsed.success) {
      sendError.value = parsed.error.issues[0]?.message ?? "";
      return;
    }

    sendError.value = "";
    sending.value = true;
    const next = await repo.appendTurn(id, parsed.data).catch(() => null);

    if (!next) {
      sending.value = false;
      sendError.value = "That message couldn't be sent.";
      return;
    }

    draft.value = "";
    // The field is uncontrolled (a native element + a tracked box stringifies badly), so the box is
    // cleared here rather than by a re-render.
    if (sayBox) {
      sayBox.value = "";
      sayBox.style.height = "auto";
    }
    applySession(next);

    // *Awaiting model response*: `sending` is still true, so the transcript draws the character's row
    // as a skeleton until this resolves. The mock paints a real frame before it answers.
    const reply = await replyTo({
      sessionId: id,
      turns: next.turns,
      message: parsed.data.text,
    }).catch(() => null);

    if (!reply) {
      // *Send failed*: the turn is stored (the transcript is append-only), so this is a line under the
      // composer, never a rollback of what the user said.
      sending.value = false;
      sendError.value = "The model didn't answer. Your message is saved.";
      return;
    }

    // The reply is a write like any other: through the adapter, with its role, id and clock.
    const answered = await repo.appendReply(id, reply.text).catch(() => null);
    sending.value = false;

    if (!answered) {
      sendError.value = "The reply couldn't be saved.";
      return;
    }

    applySession(answered);
  }

  // ---- Session settings ------------------------------------------------------------------------

  async function startNewSession(): Promise<void> {
    settingsOpen.value = false;
    const created = await repo
      .createSession(sourceId.value, personaId.value || undefined)
      .catch(() => null);

    if (!created) {
      toast("That session couldn't be started.");
      return;
    }

    navigate(`/session/${created.id}`);
  }

  async function removeSession(): Promise<void> {
    deleting.value = true;
    const gone = await repo.deleteSession(id).catch(() => false);
    deleting.value = false;

    if (!gone) {
      toast("That session couldn't be deleted.");
      return;
    }

    navigate(sourceId.value === "" ? "/character/catalog" : `/character/${sourceId.value}`);
  }

  // ---- Persona ---------------------------------------------------------------------------------

  function openPersona(): void {
    personaOpen.value = true;
    repo.listPersonas({ page: 1 }).then(
      (listing) => {
        personas.value = listing.items;
      },
      () => {
        personas.value = [];
      },
    );
  }

  async function choosePersona(next: string | null): Promise<void> {
    const updated = await repo.setSessionPersona(id, next).catch(() => null);
    personaOpen.value = false;

    if (!updated) {
      toast("That persona couldn't be attached.");
      return;
    }

    applySession(updated);
    toast(next === null ? "The user's side now reads User." : "Persona switched.");
  }

  // ---- Copies ----------------------------------------------------------------------------------

  function askCopy(row: CopyRow, action: CopyAction): void {
    confirming.value = row.key;
    confirmingAction.value = action;
  }

  function cancelCopy(): void {
    confirming.value = "";
    confirmingAction.value = "";
  }

  async function runCopy(row: CopyRow, action: CopyAction): Promise<void> {
    if (busyCopy.value !== "") return;
    busyCopy.value = row.key;

    const next =
      action === "update"
        ? await repo.updateCopyFromOriginal(id, row.kind, row.sourceId).catch(() => null)
        : await repo.restoreCopy(id, row.kind, row.sourceId).catch(() => null);

    busyCopy.value = "";
    cancelCopy();

    if (!next) {
      toast("That copy couldn't be changed.");
      return;
    }

    applySession(next);
    const after = rowsOf(next).find((entry) => entry.key === row.key);
    if (after?.unlinked) {
      toast("The original is out of reach. The copy still runs.");
      return;
    }
    toast(action === "update" ? "Copy updated from the original." : "Copy restored.");
  }

  // ---- Publish a cut ---------------------------------------------------------------------------

  /** Back out of the conversation: the history entry if there is one, the character otherwise. */
  function leaveSession(): void {
    if (window.history.length > 1) window.history.back();
    else navigate(`/character/${sourceId.value}`);
  }

  /**
   * The composer grows with what is typed and stops at 160px — the field is the modern kind: no
   * visible chrome until it is focused, one line at rest, multi-line when the thought is longer.
   */
  let sayBox: HTMLTextAreaElement | undefined;

  function growSay(): void {
    if (!sayBox) return;
    sayBox.style.height = "auto";
    sayBox.style.height = `${Math.min(sayBox.scrollHeight, 160)}px`;
  }

  /** Enter sends, Shift+Enter starts a line — the one shortcut a chat field is allowed to have. */
  function onSayKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!denySend.value) void send();
  }

  function openPublish(): void {
    rangeFrom.value = "1";
    rangeTo.value = String(Math.max(1, turns.value.length));
    rangeReady.value = false;
    publishOpen.value = true;
  }

  /** A cut with no messages cannot publish (`postAttachmentSchema.messages.min(1)`), so the composer does not open. */
  function beginCut(): void {
    if (cutTurns.value.length === 0) {
      toast("That range has no messages in it.");
      return;
    }
    rangeReady.value = true;
  }

  if (signedIn) load();

  <>
    <style>
      /* A session is its own surface: the shell hides its bar, its tabs and its rail on this route
         (`src/App.tsrx`), and the page fills the viewport — header on top, transcript scrolling in
         the middle, composer docked at the bottom. Minimal by construction: no page title block,
         no cards, one accent (the send button). */
      .session {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }

      /* The header owns the top: back, who you are talking to, settings — and nothing else. */
      .bar {
        display: grid;
        flex: none;
        grid-template-columns: 44px minmax(0, 1fr) 44px;
        align-items: center;
        gap: 2px;
        padding: calc(6px + env(safe-area-inset-top)) 8px 6px;
        border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
        background-color: color-mix(in srgb, var(--color-bg) 84%, transparent);
        backdrop-filter: blur(16px) saturate(1.15);
      }

      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        border-radius: 22px;
        background: transparent;
        color: var(--color-text-muted);
        cursor: pointer;
      }

      .icon-btn:hover,
      .icon-btn:active {
        color: var(--color-text);
        background-color: var(--color-surface);
      }

      .who {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .who-avatar {
        flex: none;
        display: inline-flex;
        border-radius: 2px;
      }

      .who-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .who-name {
        overflow: hidden;
        color: var(--color-text);
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.25;
        text-decoration: none;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* The persona is the one piece of metadata the header keeps, and it is the control: tap it to
         attach or switch one. */
      .who-sub {
        min-height: 16px;
        margin: 0;
        padding: 0;
        border: 0;
        background: none;
        overflow: hidden;
        color: var(--color-text-subtle);
        font: inherit;
        font-size: 11px;
        line-height: 1.3;
        text-align: left;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }

      .who-sub:hover {
        color: var(--color-text-muted);
      }

      .switch:hover {
        color: var(--color-text);
      }

      .gear {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 1px solid transparent;
        border-radius: 2px;
        background: none;
        color: var(--color-text-muted);
        cursor: pointer;
      }

      .gear:hover {
        border-color: var(--color-border);
        color: var(--color-text);
      }

      /* The transcript scrolls; the header and the composer never do. */
      .layout {
        display: grid;
        flex: 1;
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 16px 16px 8px;
      }

      /* A4 on a desktop, the screen on a phone — the same reading column as every other page. */
      .main {
        width: 100%;
        max-width: 794px;
        margin: 0 auto;
      }

      .main {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }

      /* ---- turns ---- */

      .turns {
        display: flex;
        flex-direction: column;
        gap: 18px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .turn {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: 68ch;
      }

      .turn-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }

      .who {
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .when {
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }

      .turn-text {
        margin: 0;
        color: var(--color-text);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
        white-space: pre-wrap;
      }

      /* The user's own turns sit in a panel: the reader's side is the one that is *theirs*. */
      .turn.is-user {
        padding: 12px 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-surface);
      }

      /* *Awaiting model response*: the character's row in the shape of the answer that is coming, so
         the transcript does not jump when the reply lands. No entrance — a skeleton that slides in and
         is then replaced reads as two events. */
      .turn.is-awaiting {
        animation: none;
      }

      .empty-line {
        margin: 0;
        padding: 24px 0;
        color: var(--color-text-subtle);
        font-size: 14px;
        line-height: 1.7;
      }

      /* ---- composer ---- */

      /* Docked, blurred, one field: a rounded pill that grows with the text and a round accent
         button. No label above it, no border box, no second row of buttons. */
      .dock {
        flex: none;
        padding: 8px 16px calc(8px + env(safe-area-inset-bottom) + var(--keyboard-inset, 0px));
        border-top: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
        background-color: color-mix(in srgb, var(--color-bg) 90%, transparent);
        backdrop-filter: blur(16px) saturate(1.15);
      }

      .composer {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        width: 100%;
        max-width: 794px;
        margin: 0 auto;
      }

      .say {
        flex: 1;
        min-width: 0;
        min-height: 44px;
        max-height: 160px;
        padding: 11px 16px;
        border: 1px solid var(--color-border);
        border-radius: 22px;
        background-color: var(--color-bg-elevated);
        color: var(--color-text);
        font: inherit;
        font-size: 15px;
        line-height: 1.45;
        resize: none;
        outline: none;
        overflow-y: auto;
        transition: border-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .say::placeholder {
        color: var(--color-text-subtle);
      }

      .say:focus {
        border-color: var(--color-accent);
      }

      .send {
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        border-radius: 22px;
        background-color: var(--color-accent);
        color: var(--color-bg);
        cursor: pointer;
        transition: opacity 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .send:disabled {
        opacity: 0.4;
        cursor: default;
      }

      .dock-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        max-width: 794px;
        margin: 4px auto 0;
      }

      .cut {
        min-height: 32px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--color-text-subtle);
        font: inherit;
        font-size: 11px;
        letter-spacing: 0.02em;
        cursor: pointer;
      }

      .cut:hover {
        color: var(--color-text-muted);
      }

      /* Not a control, like the thread's filter chip: it states which provider is answering, so it is
         drawn, not operated — a span, never a button, and it never takes focus. */
      .preview-chip {
        padding: 6px 9px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }

      .alert {
        margin: 0;
        color: var(--color-danger);
        font-size: 13px;
        line-height: 1.6;
      }

      /* ---- copies ---- */

      .copies {
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      .copies-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        min-height: 44px;
        padding: 0 14px;
        border: 0;
        background: none;
        color: var(--color-text-muted);
        font: inherit;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .copies-toggle:hover {
        color: var(--color-text);
      }

      .copies-body {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--color-border);
        list-style: none;
      }

      .copy {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 14px;
      }

      .copy + .copy {
        border-top: 1px solid var(--color-border);
      }

      .copy-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px 8px;
      }

      .copy-kind {
        color: var(--color-text-subtle);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .copy-name {
        color: var(--color-text);
        font-size: 13px;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      /* A state is a word, not a badge: three states, three plain readings. */
      .copy-state {
        color: var(--color-text-muted);
        font-size: 11px;
      }

      .copy-state.is-unlinked {
        color: var(--color-text-subtle);
      }

      .copy-detail {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.5;
      }

      .copy-link {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        color: var(--color-text-muted);
        font-size: 12px;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .copy-link:hover {
        color: var(--color-text);
      }

      .copy-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .copy-action {
        min-height: 44px;
        padding: 0 12px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        background: none;
        color: var(--color-text);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }

      .copy-action:hover:not(:disabled) {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .copy-action:disabled {
        color: var(--color-text-subtle);
        cursor: default;
      }

      .copy-confirm {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      /* ---- sheets ---- */

      .menu {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .menu-row {
        display: flex;
        align-items: center;
        min-height: 44px;
        padding: 0 4px;
        border: 0;
        border-top: 1px solid var(--color-border);
        background: none;
        color: var(--color-text);
        font: inherit;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
      }

      .menu-row:first-child {
        border-top: 0;
      }

      .menu-row.is-danger {
        color: var(--color-danger);
      }

      .menu-note {
        margin: 0 0 12px;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.7;
      }

      .menu-actions {
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
        padding-top: 4px;
      }

      .menu-actions > * {
        flex: 1 1 auto;
      }

      .range {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--color-border);
      }

      .range-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .range-cut {
        margin: 0 0 4px;
        color: var(--color-text);
        font-size: 13px;
        line-height: 1.5;
      }

      .skel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      .alert-box {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        padding: 16px 0;
      }

      @media (min-width: 640px) {
        .title {
          font-size: 26px;
        }

        .turn-text {
          font-size: 15px;
        }

        .composer-actions {
          flex-direction: row;
          justify-content: space-between;
        }

        .composer-actions > * {
          flex: 0 0 auto;
          min-width: 140px;
        }

        .menu-actions {
          flex-direction: row;
          justify-content: flex-end;
        }

        .copy-actions {
          justify-content: flex-start;
        }
      }

      @media (min-width: 1200px) {
        /* Two columns from `lg` — the documented breakpoint for a detail page's main + aside
           (`docs/DESIGN.md` → *Layout law*). At `md` the outlet is 720 wide and a 300px aside would
           leave a 324px reading column: a transcript is prose, so it keeps the full outlet there and
           the copies stay the one collapsed row they are on a phone. DOM order is the phone order,
           so the wide layout is a grid placement — not a second tree. */
        .layout {
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 32px;
          align-items: start;
        }

        .main {
          grid-column: 1;
          grid-row: 1;
        }

        .aside {
          grid-column: 2;
          grid-row: 1;
          position: sticky;
          top: 88px;
        }

        .composer-actions > * {
          min-width: 160px;
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .turn {
          animation: rise 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        @keyframes rise {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
      }
    </style>

    <div class="session">
      @if (!signedIn) {
        <EmptyState
          message="Sign in to open a session."
          actionLabel="Sign in"
          href={href("/authentification")}
        />
      } @else if (phase.value === "loading") {
        <div class="skel" aria-busy="true" aria-label="Loading session">
          <Skeleton variant="block" height={44} />
          <Skeleton lines={3} />
          <Skeleton lines={4} />
        </div>
      } @else if (phase.value === "error") {
        <div class="alert-box" role="alert">
          <p class="alert">{failure.value}</p>
          <Button variant="secondary" onClick={load}>Retry</Button>
        </div>
      } @else if (missing.value) {
        <EmptyState
          message="This session doesn't exist."
          actionLabel="Back to the catalog"
          href={href("/character/catalog")}
        />
      } @else {
        <>
          <header class="bar">
            <button class="icon-btn" type="button" aria-label="Back" onClick={leaveSession}>
              <IconBack />
            </button>
            <div class="who">
              <a class="who-avatar" href={href(`/character/${sourceId.value}`)} aria-hidden="true">
                <Avatar initials={initials.value} label={speaker.value} size={32} />
              </a>
              <div class="who-text">
                <a class="who-name" href={href(`/character/${sourceId.value}`)}>{speaker.value}</a>
                <button class="who-sub" type="button" onClick={openPersona}>
                  {`${userSide.value} · ${presetName.value}`}
                </button>
              </div>
            </div>
            <button
              class="icon-btn"
              type="button"
              aria-label="Session settings"
              onClick={() => (settingsOpen.value = true)}
            >
              <IconMore />
            </button>
          </header>

          <div class="layout">
            <aside class="aside">
              <section class="copies">
                <button
                  class="copies-toggle"
                  type="button"
                  aria-expanded={copiesOpen.value ? "true" : "false"}
                  onClick={() => (copiesOpen.value = !copiesOpen.value)}
                >
                  <span>Session copies</span>
                  <span>{summary.value}</span>
                </button>

                @if (copiesOpen.value) {
                  <ul class="copies-body">
                    @for (const row of copies.value; key row.key) {
                      <li class="copy">
                        <div class="copy-head">
                          <span class="copy-kind">{row.kindLabel}</span>
                          <span class="copy-name">{row.name}</span>
                          <span class={row.unlinked ? "copy-state is-unlinked" : "copy-state"}>
                            {row.unlinked ? "unlinked" : row.edited ? "edited" : "untouched"}
                          </span>
                        </div>
                        <p class="copy-detail">{row.detail}</p>

                        @if (!row.unlinked) {
                          <a
                            class="copy-link"
                            href={href(`/${row.kind}/${row.sourceId}`)}
                          >
                            Open the original
                          </a>
                        }

                        @if (!row.unlinked) {
                          @if (confirming.value === row.key) {
                            <div class="copy-confirm">
                              <p class="copy-detail">
                                {confirmingAction.value === "update"
                                  ? "This replaces the copy with the item's current version and discards the session's edits."
                                  : "This puts the copy back and discards the session's edits."}
                              </p>
                              <div class="copy-actions">
                                <button
                                  class="copy-action"
                                  type="button"
                                  disabled={busyCopy.value !== ""}
                                  onClick={() => runCopy(row, confirmingAction.value)}
                                >
                                  {confirmingAction.value === "update" ? "Update copy" : "Restore copy"}
                                </button>
                                <button class="copy-action" type="button" onClick={cancelCopy}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          } @else {
                            <div class="copy-actions">
                              <button
                                class="copy-action"
                                type="button"
                                disabled={busyCopy.value !== ""}
                                onClick={() => askCopy(row, "update")}
                              >
                                Update from original
                              </button>
                              @if (row.edited) {
                                <button
                                  class="copy-action"
                                  type="button"
                                  disabled={busyCopy.value !== ""}
                                  onClick={() => askCopy(row, "restore")}
                                >
                                  Restore
                                </button>
                              }
                            </div>
                          }
                        }
                      </li>
                    }
                  </ul>
                }
              </section>
            </aside>

            <main class="main">
              @if (turns.value.length === 0) {
                <p class="empty-line">
                  Nothing has been said yet. Write the first line and the scene starts here.
                </p>
              } @else {
                <ol class="turns" aria-busy={sending.value ? "true" : "false"}>
                  @for (const turn of turns.value; key turn.id) {
                    <li class={turn.role === "character" ? "turn is-character" : "turn is-user"}>
                      <div class="turn-head">
                        <span class="who">
                          {turn.role === "character" ? speaker.value : userSide.value}
                        </span>
                        <time class="when" datetime={turn.at}>{clockTime(turn.at)}</time>
                      </div>
                      <p class="turn-text">{turn.text}</p>
                    </li>
                  }

                  @if (sending.value) {
                    <li class="turn is-character is-awaiting">
                      <div class="turn-head">
                        <span class="who">{speaker.value}</span>
                      </div>
                      <Skeleton variant="lines" lines={2} lineHeight={14} />
                    </li>
                  }
                </ol>
              }

            </main>
          </div>

          <div class="dock">
            <div class="composer">
              <textarea
                class="say"
                rows={1}
                maxlength={4000}
                placeholder={`Message ${speaker.value}…`}
                aria-label="Message"
                ref={(element) => {
                  sayBox = element;
                }}
                onInput={() => {
                  /* Read the field itself: a native `onInput` hands Ripple an event, and the event's
                     target is not the box we typed into (T-15's trap). The ref is. */
                  draft.value = sayBox?.value ?? "";
                  sendError.value = "";
                  growSay();
                }}
                onKeyDown={onSayKeyDown}
              ></textarea>
              <button
                class="send"
                type="button"
                aria-label={sending.value ? "Sending" : "Send"}
                disabled={denySend.value}
                onClick={send}
              >
                <IconArrowUp />
              </button>
            </div>

            @if (sendError.value !== "") {
              <p class="alert" role="alert">{sendError.value}</p>
            }

            <div class="dock-meta">
              <button class="cut" type="button" onClick={openPublish}>Publish a cut</button>
              @if (preview.value) {
                <span class="preview-chip" title="No model is connected: every reply is written locally from your transcript.">
                  Preview mode
                </span>
              }
            </div>
          </div>
        </>
      }
    </div>

    @if (settingsOpen.value) {
      <Sheet title="Session" onClose={() => (settingsOpen.value = false)}>
        @if (confirmDelete.value) {
          <div>
            <p class="menu-note">
              This removes the transcript and every copy in it. A cut you already published stays,
              because a post is a snapshot of what was said.
            </p>
            <div class="menu-actions">
              <Button variant="secondary" onClick={() => (confirmDelete.value = false)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={deleting} onClick={removeSession}>
                {deleting.value ? "Deleting…" : "Delete session"}
              </Button>
            </div>
          </div>
        } @else {
          <ul class="menu">
            <li>
              <button class="menu-row" type="button" onClick={startNewSession}>
                New Session
              </button>
            </li>
            <li>
              <button
                class="menu-row is-danger"
                type="button"
                onClick={() => (confirmDelete.value = true)}
              >
                Delete session
              </button>
            </li>
          </ul>
        }
      </Sheet>
    }

    @if (personaOpen.value) {
      <Sheet title="Switch persona" onClose={() => (personaOpen.value = false)}>
        <ul class="menu">
          @for (const person of personas.value; key person.id) {
            <li>
              <button
                class="menu-row"
                type="button"
                aria-pressed={personaId.value === person.id ? "true" : "false"}
                onClick={() => choosePersona(person.id)}
              >
                {personaId.value === person.id ? `${person.name} · in use` : person.name}
              </button>
            </li>
          }
          <li>
            <button class="menu-row" type="button" onClick={() => choosePersona(null)}>
              No persona — your side reads User
            </button>
          </li>
        </ul>
        <p class="menu-note">
          The persona is not copied and the switch leaves no mark: the transcript keeps no boundary,
          so the next cut takes the attribution you choose when you publish it.
        </p>
      </Sheet>
    }

    @if (publishOpen.value) {
      <Sheet title="Publish a cut" onClose={() => (publishOpen.value = false)}>
        @if (!rangeReady.value) {
          <div class="range">
            <Select
              label="First turn"
              value={rangeFrom}
              options={turnOptions.value}
              onChange={(value) => (rangeFrom.value = value)}
            />
            <Select
              label="Last turn"
              value={rangeTo}
              options={turnOptions.value}
              onChange={(value) => (rangeTo.value = value)}
            />
            <p class="range-note">
              The cut is the range between these two turns, as it stands in the session. A post is
              public immediately and a cut is a snapshot: later edits here do not reach it.
            </p>
            <Button variant="primary" disabled={cutTurns.value.length === 0} onClick={beginCut}>
              Continue
            </Button>
          </div>
        } @else {
          <div>
            <p class="range-cut">{cutLabel.value}</p>
            <button class="copy-link" type="button" onClick={() => (rangeReady.value = false)}>
              Change the range
            </button>
            <PostComposer
              cut={{
                sessionId: id,
                speakerName: speaker.value,
                personaName: personaName.value,
                turns: cutTurns.value,
                rangeLabel: cutLabel.value,
              }}
              onPublished={(postId) => {
                publishOpen.value = false;
                navigate(`/post/${postId}`);
              }}
              onCancel={() => (publishOpen.value = false)}
            />
          </div>
        }
      </Sheet>
    }
  </>
}

export default SessionDetail;
