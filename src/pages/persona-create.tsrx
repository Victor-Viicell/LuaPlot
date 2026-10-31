import { PersonaForm } from "../components/PersonaForm.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { href, navigate } from "../router.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/persona/create` — the authoring form as a page (`src/specs/pages/persona/create.md`).
 *
 * The form is `components/PersonaForm.tsrx` with `persona={null}`; `/persona/[id]/edit` mounts the same
 * component with a row, so the gate and the avatar rule cannot drift between the two hosts. This page
 * owns only the frame, the signed-out state, and where **Save** and **Cancel** go: Save opens the new
 * persona's detail page (*Save → detail*), Cancel goes back to the collection (*Cancel → collection*).
 *
 * *Save on your first persona makes it the default* — the adapter does that in the same write
 * (`repo.addPersona`), so this page never promotes anything and the new row arrives already marked.
 */

export function PersonaCreate() @{
  const viewer = currentUser();
  const signedIn = viewer !== null;

  <div class="create-page">
    <header class="head">
      <p class="kicker">new persona</p>
      <p class="lede">
        A persona is the side you speak from, not a character someone else can start a session with. It
        is never published and never moderated, so there is nothing here to make public.
      </p>
    </header>

    @if (!signedIn) {
      <EmptyState
        message="Sign in to create a persona."
        actionLabel="Sign in"
        href={href("/authentification")}
      />
    } @else {
      <PersonaForm
        persona={null}
        onSaved={(saved) => navigate(`/persona/${saved.id}`)}
        onCancel={() => navigate("/persona")}
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

export default PersonaCreate;
