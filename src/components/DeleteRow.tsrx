import { track } from "ripple";
import { Button } from "./Button.tsrx";

/**
 * The destructive row shared by `/persona/[id]` and `/persona/[id]/edit` (T-20's decision, recorded in
 * `docs/DESIGN.md` → *Persona collection and detail*): **one in-place confirm row, never a dialog.**
 *
 * Both hosts must confirm a delete and both must word it the same way, so the row is one component:
 * `persona/detail.md` → *Delete with confirmation* and `edit.md` → *Delete confirmation* are one write
 * (`repo.deletePersona`) and one sentence — that deleting is immediate and final, and that the mark
 * moves to the most recently created remaining persona.
 *
 * It owns only the plumbing (confirm open, one write at a time, the failure line) and calls the
 * caller's `onDelete`, which returns whether the adapter accepted it. The caller navigates on success,
 * because where a delete lands is the page's business (`edit.md`: back to the collection).
 *
 * The styles live in `src/styles.css` (`.delete-row*`) for the T-19 reason: a component's **root**
 * element carries no `tsrx-*` scope class, so a scoped rule written on it would be dropped.
 */
export function DeleteRow({
  copy,
  confirmCopy,
  confirmLabel,
  onDelete,
}: {
  /** The sentence shown before the row opens: what deleting does, in the spec's own terms. */
  copy: string;
  /** The question, once the row is open. */
  confirmCopy: string;
  /** The confirming button's label. */
  confirmLabel: string;
  /** Returns `true` when the adapter deleted the row. */
  onDelete: () => Promise<boolean>;
}) @{
  const confirming = track(false);
  const busy = track(false);
  const failure = track("");

  async function run(): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    failure.value = "";
    const gone = await onDelete().catch(() => false);
    busy.value = false;
    if (!gone) {
      failure.value = "That persona couldn't be deleted. Try again.";
      confirming.value = false;
    }
  }

  <div class="delete-row">
    @if (!confirming.value) {
      <div class="delete-line">
        <p class="delete-copy">{copy}</p>
        <Button variant="danger" onClick={() => (confirming.value = true)}>Delete</Button>
      </div>
    } @else {
      <div class="delete-line is-open">
        <p class="delete-copy">{confirmCopy}</p>
        <div class="delete-actions">
          <Button variant="secondary" onClick={() => (confirming.value = false)}>Cancel</Button>
          <Button variant="danger" onClick={() => run()} disabled={busy}>
            {busy.value ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    }
    @if (failure.value) {
      <p class="delete-alert" role="alert">{failure.value}</p>
    }
  </div>
}

export default DeleteRow;
