import { LorebookForm } from "../components/LorebookForm.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { href, navigate } from "../router.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/lorebook/create` — the authoring form as a page (`src/specs/pages/lorebook/create.md`).
 *
 * The form is `components/LorebookForm.tsrx` with `lorebook={null}`; `/lorebook/[id]/edit` mounts
 * the same component with a row, so the gate, the keyword split and the entry numbering cannot drift
 * between the two hosts. This page owns only the frame — the kicker, the lede, the signed-out state,
 * and where **Save** and **Cancel** go: Save opens the new lorebook's detail page (*Save → detail*),
 * Cancel goes back to the catalog (*Cancel → catalog*, unlike edit's detail).
 *
 * The spec is explicit that this is its own visit (*the editor is a page of its own, never embedded
 * in character/create*): a character attaches existing lorebooks by ID or from a picker, so
 * authoring one starts here.
 */

export function LorebookCreate() @{
  const viewer = currentUser();
  const signedIn = viewer !== null;

  <div class="create-page">
    <header class="head">
      <p class="kicker">new lorebook</p>
      <p class="lede">
        A lorebook is public the moment it saves — there are no drafts. Its entries are injected
        during a session whenever one of their keywords comes up.
      </p>
    </header>

    @if (!signedIn) {
      <EmptyState
        message="Sign in to create a lorebook."
        actionLabel="Sign in"
        href={href("/authentification")}
      />
    } @else {
      <LorebookForm
        lorebook={null}
        onSaved={(saved) => navigate(`/lorebook/${saved.id}`)}
        onCancel={() => navigate("/lorebook/catalog")}
      />
    }

    <style>
      .create-page {
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

      @media (min-width: 640px) {
        .lede {
          font-size: 15px;
        }
      }
    </style>
  </div>
}

export default LorebookCreate;
