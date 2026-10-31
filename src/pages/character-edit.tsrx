import { track } from "ripple";
import { CharacterForm } from "../components/CharacterForm.tsrx";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, navigate, useParams } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Character } from "../lib/data/types.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/character/[character.id]/edit` — owner-only editor (`src/specs/pages/character/edit.md`).
 *
 * The form is the **same** `CharacterForm` `/character/create` mounts, preloaded: the spec says so
 * (*Same form as create, preloaded with current values*), and one component means the gate, the
 * attach rules and the normalisation cannot drift between the two hosts.
 *
 * What this page owns, and the spec leaves *to be specified* (recorded in `docs/DESIGN.md`):
 * - **Three refusal states, one line each.** *Not found* prints `This character doesn't exist.`;
 *   *not the owner* is **forbidden**, not a silent redirect — it prints `This character isn't yours
 *   to edit.` and offers the catalog. The adapter refuses the write too, so the page check is the
 *   state and not the guard.
 * - **Delete is its own row above Save/Cancel**, in-place confirmed (the session settings sheet's
 *   pattern): the row swaps to the sentence plus Cancel / Delete rather than opening a dialog. It is
 *   immediate and final — the spec is explicit that there is no undo, no trash, no grace period — so
 *   the sentence says what goes with it.
 * - **Cancel and Save both go to the detail page** (`edit.md` → *Actions*: Save and Cancel both
 *   point at detail, unlike create's catalog).
 */

type Phase = "loading" | "ready" | "missing" | "forbidden" | "error";

export function CharacterEdit() @{
  const repo = resolveRepo();
  const viewer = currentUser();
  const routeParams = useParams();
  const id = routeParams.id ?? "";
  const handle = viewer?.handle ?? "";

  const phase = track<Phase>("loading");
  /** The row, behind a nullable box: nothing reads a nullable inside the template. */
  const found = track<Character | null>(null);
  const confirming = track(false);
  const deleting = track(false);
  const deleteError = track("");

  function load(): void {
    if (handle === "") {
      phase.value = "forbidden";
      return;
    }

    repo.getCharacter(id).then(
      (row) => {
        if (!row) {
          phase.value = "missing";
          return;
        }
        if (row.author !== handle) {
          phase.value = "forbidden";
          return;
        }
        found.value = row;
        phase.value = "ready";
      },
      () => {
        phase.value = "error";
      },
    );
  }

  async function remove(): Promise<void> {
    if (deleting.value) return;
    deleting.value = true;
    const gone = await repo.deleteCharacter(id).catch(() => false);
    deleting.value = false;

    if (!gone) {
      deleteError.value = "That character couldn't be deleted. Try again.";
      confirming.value = false;
      return;
    }

    navigate("/character/catalog");
  }

  load();

  <div class="edit-page">
    <header class="head">
      <p class="kicker">edit character</p>
      <p class="lede">
        Renaming reaches nothing else: URLs, bookmarks and lorebook attachments carry the ID, and a
        published cut keeps the text it recorded.
      </p>
    </header>

    @if (phase.value === "loading") {
      <div class="skel" aria-busy="true" aria-label="Loading this character">
        <Skeleton lines={3} />
        <Skeleton lines={4} />
      </div>
    } @else if (phase.value === "missing") {
      <EmptyState
        message="This character doesn't exist."
        actionLabel="Back to catalog"
        href={href("/character/catalog")}
      />
    } @else if (phase.value === "forbidden") {
      <EmptyState
        message="This character isn't yours to edit."
        actionLabel="Back to catalog"
        href={href("/character/catalog")}
      />
    } @else if (phase.value === "error") {
      <EmptyState
        message="This character couldn't be loaded. Try again from the catalog."
        actionLabel="Back to catalog"
        href={href("/character/catalog")}
      />
    } @else {
      <>
        <section class="danger-row">
          @if (!confirming.value) {
            <div class="danger-line">
              <p class="danger-copy">
                Deleting is immediate and final. Its comment thread goes with it; the lorebooks it
                attaches stay.
              </p>
              <Button variant="danger" onClick={() => (confirming.value = true)}>Delete</Button>
            </div>
          } @else {
            <div class="danger-line is-open">
              <p class="danger-copy">
                Delete this character and its whole comment thread? This cannot be undone.
              </p>
              <div class="danger-actions">
                <Button variant="secondary" onClick={() => (confirming.value = false)}>Cancel</Button>
                <Button variant="danger" onClick={() => remove()} disabled={deleting}>
                  {deleting.value ? "Deleting…" : "Confirm delete"}
                </Button>
              </div>
            </div>
          }
          @if (deleteError.value) {
            <p class="alert" role="alert">{deleteError.value}</p>
          }
        </section>

        <CharacterForm
          character={found.value}
          onSaved={(saved) => navigate(`/character/${saved.id}`)}
          onCancel={() => navigate(`/character/${id}`)}
        />
      </>
    }

    <style>
      .edit-page {
        display: flex;
        flex-direction: column;
        gap: 24px;
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

      .lede {
        max-width: 58ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      /* The destructive row is marked by a 2px rule, not by a red box: one panel, one accent. */
      .danger-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-left: 12px;
        border-left: 2px solid var(--color-danger);
      }

      .danger-line {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .danger-copy {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .danger-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .alert {
        margin: 0;
        color: var(--color-danger);
        font-size: 13px;
        line-height: 1.6;
      }

      .skel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      @media (min-width: 640px) {
        .lede {
          font-size: 15px;
        }

        .danger-line {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .danger-actions {
          flex-direction: row;
          flex: 0 0 auto;
        }
      }
    </style>
  </div>
}

export default CharacterEdit;
