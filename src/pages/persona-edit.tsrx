import { track } from "ripple";
import { DeleteRow } from "../components/DeleteRow.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { PersonaForm } from "../components/PersonaForm.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, navigate, useParams } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Persona } from "../lib/data/types.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/persona/[persona.id]/edit` — the owner's editor (`src/specs/pages/persona/edit.md`).
 *
 * The form is the **same** `PersonaForm` `/persona/create` mounts, preloaded — the spec says so (*Same
 * fields as create, preloaded*), and one component means the gate cannot drift between the two hosts.
 *
 * What this page owns:
 * - **Two refusal states, not three.** *Not found* prints `This persona doesn't exist in your
 *   collection.` and an id belonging to another account renders **the same sentence**: *personas are
 *   not addressed across accounts, so there is no separate "not yours" page and no distinction between
 *   missing and unowned*. That is why there is no `forbidden` phase here, unlike the authored types.
 * - **Delete sits at the foot, after Save and Cancel**, in the shared `DeleteRow` (T-20: one in-place
 *   confirmation, never a dialog). The sentence promises only what the spec names — immediate and
 *   final, no undo and no trash, a session that pinned it keeps its transcript and reads `User` — and
 *   that the default mark moves to the most recently created remaining persona.
 * - **After a delete it lands on the collection** (`/persona`), because the row it was editing is gone.
 * - **Cancel goes to detail** (*Cancel → detail*), not the collection.
 */

type Phase = "loading" | "ready" | "missing" | "error";

export function PersonaEdit() @{
  const repo = resolveRepo();
  const viewer = currentUser();
  const routeParams = useParams();
  const id = routeParams.id ?? "";
  const handle = viewer?.handle ?? "";

  const phase = track<Phase>("loading");
  /** The row, behind a nullable box: nothing reads a nullable inside the template. */
  const found = track<Persona | null>(null);

  function load(): void {
    // Signed out and an unknown id are one state: the spec gives them one sentence.
    if (handle === "") {
      phase.value = "missing";
      return;
    }

    repo.getPersona(id).then(
      (row) => {
        if (!row || row.owner !== handle) {
          phase.value = "missing";
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

  async function remove(): Promise<boolean> {
    const gone = await repo.deletePersona(id).catch(() => false);
    if (gone) navigate("/persona");
    return gone;
  }

  load();

  <div class="edit-page">
    <header class="head">
      <p class="kicker">edit persona</p>
      <p class="lede">
        Saving overwrites this persona in place. A session already running keeps its whole transcript;
        only the name it attributes your side to changes.
      </p>
    </header>

    @if (phase.value === "loading") {
      <div class="skel" aria-busy="true" aria-label="Loading this persona">
        <Skeleton lines={3} />
        <Skeleton lines={4} />
      </div>
    } @else if (phase.value === "missing") {
      <EmptyState
        message="This persona doesn't exist in your collection."
        actionLabel="Back to personas"
        href={href("/persona")}
      />
    } @else if (phase.value === "error") {
      <EmptyState
        message="This persona couldn't be loaded. Try again from your personas."
        actionLabel="Back to personas"
        href={href("/persona")}
      />
    } @else {
      <>
        <PersonaForm
          persona={found.value}
          onSaved={(saved) => navigate(`/persona/${saved.id}`)}
          onCancel={() => navigate(`/persona/${id}`)}
        />

        <DeleteRow
          copy="Deleting is immediate and final — no undo and no trash. If this is your default, the mark moves to your most recently created other persona; a session that uses it keeps its transcript and shows your side as User."
          confirmCopy="Delete this persona? This cannot be undone."
          confirmLabel="Confirm delete"
          onDelete={() => remove()}
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

      .skel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      @media (min-width: 640px) {
        .lede {
          font-size: 15px;
        }
      }
    </style>
  </div>
}

export default PersonaEdit;
