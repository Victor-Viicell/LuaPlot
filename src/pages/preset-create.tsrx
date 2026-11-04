import { PresetForm } from "../components/PresetForm.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { navigate } from "../router.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/preset/create` — the authoring form as a page (`src/specs/pages/preset/create.md`).
 *
 * The form is `components/PresetForm.tsrx` with `preset={null}`; `/preset/[id]/edit` mounts the same
 * component with a row, so the gate and the model control cannot drift between the two hosts. This
 * page owns only the frame — the kicker, the lede, the signed-out state, and where **Save** and
 * **Cancel** go: Save opens the new preset's detail page (*Save → detail*), Cancel goes back to the
 * catalog (*Cancel → catalog*).
 *
 * *Duplicate* is deliberately absent: `create.md` → *Actions* says this page always starts blank, and
 * a copy of another preset is made from its detail page's **Fork / copy**, which puts it in the
 * author's account and opens it in edit. A Duplicate button here would be a second, weaker fork.
 */

export function PresetCreate() @{
  const viewer = currentUser();
  const signedIn = viewer !== null;

  <div class="create-page">
    <header class="head">
      <p class="kicker">new preset</p>
    </header>

    @if (!signedIn) {
      <EmptyState
        message="Sign in to create a preset."
        actionLabel="Sign in"
        to="/authentification"
      />
    } @else {
      <PresetForm
        preset={null}
        onSaved={(saved) => navigate(`/preset/${saved.id}`)}
        onCancel={() => navigate("/discover/presets")}
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

export default PresetCreate;
