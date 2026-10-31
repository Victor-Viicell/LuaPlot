import { track } from "ripple";
import { LorebookForm } from "../components/LorebookForm.tsrx";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, navigate, useParams } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Lorebook } from "../lib/data/types.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/lorebook/[lorebook.id]/edit` — owner-only editor (`src/specs/pages/lorebook/edit.md`).
 *
 * The form is the **same** `LorebookForm` `/lorebook/create` mounts, preloaded: the spec says so
 * (*the shape of create, preloaded*), and one component means the gate, the keyword split and the
 * entry numbering cannot drift between the two hosts.
 *
 * What this page owns, and the spec leaves *to be specified* (recorded in `docs/DESIGN.md`):
 * - **Three refusal states, one line each.** *Not found* prints `This lorebook doesn't exist.`;
 *   *not the owner* is **forbidden**, not a silent redirect — it prints `This lorebook isn't yours to
 *   edit.` Both offer the catalog. The adapter refuses the write too, so the page check is the state
 *   and not the guard.
 * - **Delete sits at the foot, in its own row after Save and Cancel**, set apart from the save
 *   controls by a rule and a paragraph (`edit.md` → Layout: *set apart from the save controls so the
 *   two are never adjacent*). It confirms in place, as T-17 did, and the sentence states the
 *   consequence once — that characters reading it degrade to an unavailable attachment — without
 *   listing them (`edit.md` → Rules: *it states the consequence once instead*).
 * - **Cancel goes to detail**, not the catalog (`edit.md` → *Cancel → detail*).
 */

type Phase = "loading" | "ready" | "missing" | "forbidden" | "error";

export function LorebookEdit() @{
  const repo = resolveRepo();
  const viewer = currentUser();
  const routeParams = useParams();
  const id = routeParams.id ?? "";
  const handle = viewer?.handle ?? "";

  const phase = track<Phase>("loading");
  /** The row, behind a nullable box: nothing reads a nullable inside the template. */
  const found = track<Lorebook | null>(null);
  const confirming = track(false);
  const deleting = track(false);
  const deleteError = track("");

  function load(): void {
    if (handle === "") {
      phase.value = "forbidden";
      return;
    }

    repo.getLorebook(id).then(
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
    const gone = await repo.deleteLorebook(id).catch(() => false);
    deleting.value = false;

    if (!gone) {
      deleteError.value = "That lorebook couldn't be deleted. Try again.";
      confirming.value = false;
      return;
    }

    navigate("/lorebook/catalog");
  }

  load();

  <div class="edit-page">
    <header class="head">
      <p class="kicker">edit lorebook</p>
      <p class="lede">
        Saving writes the live lorebook: a new session or a fork copies the entries as they now stand,
        while a session already in progress reads its own copy until its owner updates it.
      </p>
    </header>

    @if (phase.value === "loading") {
      <div class="skel" aria-busy="true" aria-label="Loading this lorebook">
        <Skeleton lines={3} />
        <Skeleton lines={6} />
      </div>
    } @else if (phase.value === "missing") {
      <EmptyState
        message="This lorebook doesn't exist."
        actionLabel="Back to catalog"
        href={href("/lorebook/catalog")}
      />
    } @else if (phase.value === "forbidden") {
      <EmptyState
        message="This lorebook isn't yours to edit."
        actionLabel="Back to catalog"
        href={href("/lorebook/catalog")}
      />
    } @else if (phase.value === "error") {
      <EmptyState
        message="This lorebook couldn't be loaded. Try again from the catalog."
        actionLabel="Back to catalog"
        href={href("/lorebook/catalog")}
      />
    } @else {
      <>
        <LorebookForm
          lorebook={found.value}
          onSaved={(saved) => navigate(`/lorebook/${saved.id}`)}
          onCancel={() => navigate(`/lorebook/${id}`)}
        />

        <section class="danger-row">
          @if (!confirming.value) {
            <div class="danger-line">
              <p class="danger-copy">
                Deleting is immediate and final. Its entries and its comment thread go with it.
                Characters that read it keep the attachment, listed as unavailable.
              </p>
              <Button variant="danger" onClick={() => (confirming.value = true)}>Delete</Button>
            </div>
          } @else {
            <div class="danger-line is-open">
              <p class="danger-copy">
                Delete this lorebook, its entries and its comment thread? This cannot be undone.
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

      /* The destructive row is marked by a 2px rule, not by a red box: one panel, one accent. It
         sits below the form, so Save is never beside Delete. */
      .danger-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
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

export default LorebookEdit;
