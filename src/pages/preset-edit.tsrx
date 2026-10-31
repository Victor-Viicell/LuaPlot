import { track } from "ripple";
import { PresetForm } from "../components/PresetForm.tsrx";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, navigate, useParams } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Preset } from "../lib/data/types.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/preset/[preset.id]/edit` — owner-only editor (`src/specs/pages/preset/edit.md`).
 *
 * The form is the **same** `PresetForm` `/preset/create` mounts, preloaded: the spec says so (*Same
 * fields as create, preloaded*), and one component means the gate and the model control cannot
 * drift between the two hosts.
 *
 * What this page owns, and the spec leaves *to be specified* (recorded in `docs/DESIGN.md`):
 * - **Three refusal states, one line each.** *Not found* prints `This preset doesn't exist.`;
 *   *not the owner* is **forbidden**, not a silent redirect — it prints `This preset isn't yours to
 *   edit.` Both offer the catalog. The adapter refuses the write too, so the page check is the state
 *   and not the guard.
 * - **Delete sits at the foot, in its own row after Save and Cancel**, set apart by the 2px
 *   `--color-danger` rule T-17/T-18 established. It confirms in place, never in a second dialog.
 * - **The delete sentence promises only what `edit.md` names.** A preset has no entries, so there is
 *   no entries cascade to state; the spec's consequences are that there is no version history and
 *   that *a running session keeps its own copy* — so the sentence says the thread goes and a session
 *   keeps the copy it started from. It does not claim characters or lorebooks degrade, because a
 *   preset is not attachable that way.
 * - **Cancel goes to detail**, not the catalog (`edit.md` → *Cancel → detail*).
 */

type Phase = "loading" | "ready" | "missing" | "forbidden" | "error";

export function PresetEdit() @{
  const repo = resolveRepo();
  const viewer = currentUser();
  const routeParams = useParams();
  const id = routeParams.id ?? "";
  const handle = viewer?.handle ?? "";

  const phase = track<Phase>("loading");
  /** The row, behind a nullable box: nothing reads a nullable inside the template. */
  const found = track<Preset | null>(null);
  const confirming = track(false);
  const deleting = track(false);
  const deleteError = track("");

  function load(): void {
    if (handle === "") {
      phase.value = "forbidden";
      return;
    }

    repo.getPreset(id).then(
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
    const gone = await repo.deletePreset(id).catch(() => false);
    deleting.value = false;

    if (!gone) {
      deleteError.value = "That preset couldn't be deleted. Try again.";
      confirming.value = false;
      return;
    }

    navigate("/preset/catalog");
  }

  load();

  <div class="edit-page">
    <header class="head">
      <p class="kicker">edit preset</p>
      <p class="lede">
        Saving overwrites this preset in place — there is no version history and no draft. A session
        already running keeps the copy it started from.
      </p>
    </header>

    @if (phase.value === "loading") {
      <div class="skel" aria-busy="true" aria-label="Loading this preset">
        <Skeleton lines={3} />
        <Skeleton lines={4} />
      </div>
    } @else if (phase.value === "missing") {
      <EmptyState
        message="This preset doesn't exist."
        actionLabel="Back to catalog"
        href={href("/preset/catalog")}
      />
    } @else if (phase.value === "forbidden") {
      <EmptyState
        message="This preset isn't yours to edit."
        actionLabel="Back to catalog"
        href={href("/preset/catalog")}
      />
    } @else if (phase.value === "error") {
      <EmptyState
        message="This preset couldn't be loaded. Try again from the catalog."
        actionLabel="Back to catalog"
        href={href("/preset/catalog")}
      />
    } @else {
      <>
        <PresetForm
          preset={found.value}
          onSaved={(saved) => navigate(`/preset/${saved.id}`)}
          onCancel={() => navigate(`/preset/${id}`)}
        />

        <section class="danger-row">
          @if (!confirming.value) {
            <div class="danger-line">
              <p class="danger-copy">
                Deleting is immediate and final. Its comment thread goes with it, and a session
                already running keeps the copy it started from.
              </p>
              <Button variant="danger" onClick={() => (confirming.value = true)}>Delete</Button>
            </div>
          } @else {
            <div class="danger-line is-open">
              <p class="danger-copy">
                Delete this preset and its comment thread? This cannot be undone.
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

export default PresetEdit;
