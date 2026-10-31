import { CharacterForm } from "../components/CharacterForm.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { href, navigate } from "../router.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/character/create` — the authoring form as a page (`src/specs/pages/character/create.md`).
 *
 * The form is `components/CharacterForm.tsrx` with `character={null}`; `/character/[id]/edit` mounts
 * the same component with a row, so the gate and the normalisation cannot drift between the two
 * hosts. This page owns only the frame — the kicker, the lede, the signed-out state, and where
 * **Save** and **Cancel** go: Save opens the new character's detail page (*Save → detail*), Cancel
 * goes back to the catalog.
 */

export function CharacterCreate() @{
  const viewer = currentUser();
  const signedIn = viewer !== null;

  <div class="create-page">
    <header class="head">
      <p class="kicker">new character</p>
    </header>

    @if (!signedIn) {
      <EmptyState
        message="Sign in to create a character."
        actionLabel="Sign in"
        href={href("/authentification")}
      />
    } @else {
      <CharacterForm
        character={null}
        onSaved={(saved) => navigate(`/character/${saved.id}`)}
        onCancel={() => navigate("/character/catalog")}
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


      @media (min-width: 640px) {
      }
    </style>
  </div>
}

export default CharacterCreate;
