import { track } from "ripple";
import { Avatar } from "../components/Avatar.tsrx";
import { Button } from "../components/Button.tsrx";
import { DeleteRow } from "../components/DeleteRow.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Sheet } from "../components/Sheet.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, navigate, useParams } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Character, Persona } from "../lib/data/types.ts";
import { currentUser } from "../lib/state/session.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/persona/[persona.id]` — personal detail for one of the viewer's personas
 * (`src/specs/pages/persona/detail.md`).
 *
 * It is the **only** item page with none of the shared chrome: *no engagement row, no report control,
 * no comment thread, no owner notice, no `Sheet` menu* — a persona is never shared, so nothing about it
 * is counted, reported or discussed. What it has instead is the smallest honest header: avatar, name,
 * tagline, the default mark, and four actions (**Set as default**, **Start a session**, **Edit**,
 * **Delete**), with the description read-only beneath.
 *
 * Decisions recorded in `docs/DESIGN.md` → *Persona collection and detail (T-20)*:
 * - **One refusal sentence for missing and unowned.** `getPersona` already answers `null` for another
 *   account's row, so the page has a single *not found* state: `This persona doesn't exist in your
 *   collection.`
 * - **`Start a session` asks for a character first**, in a `Sheet` picker of the viewer's own
 *   characters — the spec's order (*asks for a character first, which brings that character's
 *   lorebooks and preset*). A character the viewer already has a session with is **reopened with this
 *   persona attached** (Continue), never duplicated; the preset is not asked for, because it travels
 *   with the character.
 * - **`Set as default` is drawn disabled when this persona holds the mark** (label *Default
 *   persona*), as `Request public again` is — the write is idempotent and a live button would be a
 *   no-op dressed as an action.
 * - **Delete confirms in place** through the shared `DeleteRow`, directly under the header, because
 *   `detail.md` lists it among the header's actions; it is not a second dialog.
 */

type Phase = "loading" | "ready" | "missing" | "error";

export function PersonaDetail() @{
  const repo = resolveRepo();
  const routeParams = useParams();
  const id = routeParams.id ?? "";
  const viewer = currentUser();
  const handle = viewer?.handle ?? "";

  const phase = track<Phase>("loading");
  const row = track<Persona | null>(null);
  const busy = track(false);
  const pickerOpen = track(false);
  /** `Set as default` is dead while a write is in flight and when the mark is already here. */
  const denyDefault = track(() => busy.value || (row.value?.isDefault ?? false));
  /** The picker's rows: the viewer's own characters, by name. */
  const choices = track<Character[]>([]);
  const picking = track(false);

  function load(): void {
    if (handle === "") {
      phase.value = "missing";
      return;
    }

    repo.getPersona(id).then(
      (found) => {
        if (!found || found.owner !== handle) {
          phase.value = "missing";
          return;
        }
        row.value = found;
        phase.value = "ready";
      },
      () => {
        phase.value = "error";
      },
    );
  }

  async function setDefault(): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    const next = await repo.setDefaultPersona(id).catch(() => null);
    busy.value = false;

    if (!next) {
      toast("That persona couldn't become the default.");
      return;
    }
    row.value = next;
  }

  /**
   * The character picker. Only the viewer's own characters are offered: a session is started from a
   * character whose preset the adapter can copy, and offering somebody else's private row would fail
   * after the click. The list is unpaged — it is a list to choose from, not a catalog.
   */
  function openPicker(): void {
    if (pickerOpen.value) return;
    pickerOpen.value = true;

    repo.listCharacters({ page: 1, sort: "name" }).then(
      (listing) => (choices.value = listing.items.filter((entry) => entry.author === handle)),
      () => (choices.value = []),
    );
  }

  /**
   * **Start a session with this persona.** An existing session with that character is reopened with
   * this persona attached (*the persona is then in use for the user's side*), so a second session is
   * never started by accident; otherwise a new one is created with the persona in the same write.
   */
  async function choose(characterId: string): Promise<void> {
    if (picking.value) return;
    picking.value = true;

    const existing = await repo.findSessionForCharacter(characterId, handle).catch(() => null);
    let sessionId = "";
    if (existing) {
      await repo.setSessionPersona(existing.id, id).catch(() => null);
      sessionId = existing.id;
    } else {
      const started = await repo.createSession(characterId, id).catch(() => null);
      sessionId = started?.id ?? "";
    }

    picking.value = false;
    pickerOpen.value = false;

    if (sessionId === "") {
      toast("That session couldn't start. The character may have no preset to copy.");
      return;
    }
    navigate(`/session/${sessionId}`);
  }

  async function remove(): Promise<boolean> {
    const gone = await repo.deletePersona(id).catch(() => false);
    if (gone) navigate("/persona");
    return gone;
  }

  load();

  <div class="page">
    <div class="detail">
      @if (phase.value === "loading") {
        <div class="loading" aria-busy="true" aria-label="Loading this persona">
          <Skeleton variant="block" height={120} />
          <Skeleton variant="block" height={64} />
          <Skeleton lines={4} />
        </div>
      } @else if (phase.value === "missing") {
        <EmptyState
          message="This persona doesn't exist in your collection."
          actionLabel="Back to personas"
          href={href("/persona")}
        />
      } @else if (phase.value === "error") {
        <div class="alert" role="alert">
          <p class="alert-text">This persona couldn't be loaded.</p>
          <a class="btn btn-secondary" href={href("/persona")}>Back to personas</a>
        </div>
      } @else {
        <>
        <header class="head">
          <div class="portrait">
            <Avatar initials={row.value?.avatar.initials ?? ""} label={row.value?.name} size="hero" />
          </div>

          <div class="identity">
            <p class="kicker">persona</p>
            <h1 class="name">{row.value?.name}</h1>
            @if (row.value?.tagline) {
              <p class="tagline">{row.value?.tagline}</p>
            }
            @if (row.value?.isDefault) {
              <p class="mark">Default persona — used when you do not pick one</p>
            }
          </div>

          <div class="actions">
            <Button variant="primary" onClick={() => openPicker()}>Start a session</Button>
            <Button
              variant="secondary"
              disabled={denyDefault}
              onClick={() => setDefault()}
            >
              {row.value?.isDefault ? "Default persona" : "Set as default"}
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/persona/${id}/edit`)}>Edit</Button>
          </div>

          <div class="delete-slot">
            <DeleteRow
              copy="Deleting is immediate and final — no undo and no trash. If this is your default, the mark moves to your most recently created other persona; a session that uses it keeps its transcript and shows your side as User."
              confirmCopy="Delete this persona? This cannot be undone."
              confirmLabel="Confirm delete"
              onDelete={() => remove()}
            />
          </div>
        </header>

        <section class="definition">
          <p class="section-label">Description and personality</p>
          @if (row.value?.description) {
            <p class="prose">{row.value?.description}</p>
          } @else {
            <p class="prose is-empty">No description yet. Edit this persona to add one.</p>
          }
        </section>
        </>
      }
    </div>

    @if (pickerOpen.value) {
      <Sheet title="Choose a character" onClose={() => (pickerOpen.value = false)}>
        <div class="picker">
          <p class="picker-note">
            This persona is your side of the session. The character brings its lorebooks and preset,
            and a session you already have with it is reopened instead of started again.
          </p>

          @if (choices.value.length === 0) {
            <p class="picker-note">
              You have not authored a character yet.{" "}
              <a class="picker-link" href={href("/character/create")}>Create one</a> to start a session.
            </p>
          } @else {
            <ul class="picker-list">
              @for (const entry of choices.value; key entry.id) {
                <li>
                  <button class="picker-row" type="button" disabled={picking.value} onClick={() => choose(entry.id)}>
                    <Avatar initials={entry.avatar.initials} size={40} />
                    <span class="picker-name">{entry.name}</span>
                    <span class="picker-go">{picking.value ? "Opening…" : "Start"}</span>
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      </Sheet>
    }

    <style>
      .detail {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .loading {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .alert {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .alert-text {
        margin: 0;
        color: var(--color-danger);
        font-size: 14px;
      }

      /* Base placement first, the media query after it: same specificity, so a base rule declared
         after the query would win at every width (the T-10 trap). */
      .head {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--color-border);
      }

      .portrait {
        width: 100%;
        max-width: 320px;
      }

      .identity {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .name {
        margin: 0;
        color: var(--color-text);
        font-size: 26px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.15;
      }

      .tagline {
        max-width: 52ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 15px;
        line-height: 1.6;
        text-wrap: pretty;
      }

      .mark {
        margin: 4px 0 0;
        color: var(--color-accent);
        font-size: 11px;
        letter-spacing: 0.1em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .actions > * {
        flex: 1 1 auto;
      }

      .definition {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .section-label {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .prose {
        max-width: 68ch;
        margin: 0;
        color: var(--color-text);
        font-size: 15px;
        line-height: 1.75;
        white-space: pre-line;
        text-wrap: pretty;
      }

      .prose.is-empty {
        color: var(--color-text-subtle);
      }

      .picker {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .picker-note {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .picker-link {
        color: var(--color-accent);
      }

      .picker-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .picker-row {
        display: flex;
        gap: 12px;
        align-items: center;
        width: 100%;
        min-height: 56px;
        padding: 8px 12px;
        border: 1px solid var(--color-border);
        border-radius: 2px;
        background-color: transparent;
        color: var(--color-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .picker-row:hover {
        background-color: var(--color-surface-hover);
      }

      .picker-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        font-size: 14px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .picker-go {
        flex: none;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      @media (min-width: 640px) {
        .actions {
          flex-direction: row;
          flex-wrap: wrap;
        }

        .actions > * {
          flex: 0 0 auto;
          min-width: 160px;
        }
      }

      @media (min-width: 900px) {
        /* The item-page frame: a 320px cover column, the identity beside it, actions on the right. */
        .head {
          grid-template-columns: 320px minmax(0, 1fr) auto;
          align-items: start;
          column-gap: 32px;
        }

        .portrait {
          grid-column: 1;
          grid-row: 1;
        }

        .identity {
          grid-column: 2;
          grid-row: 1;
          align-self: end;
        }

        .actions {
          grid-column: 3;
          grid-row: 1;
          flex-direction: column;
          align-self: start;
        }

        .actions > * {
          min-width: 180px;
        }

        .head .delete-slot {
          grid-column: 1 / -1;
          grid-row: 2;
        }
      }
    </style>
  </div>
}

export default PersonaDetail;
