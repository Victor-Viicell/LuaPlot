import { track } from "ripple";
import { navigate } from "../router.ts";
import { Button } from "./Button.tsrx";
import { Toggle } from "./Toggle.tsrx";
import {
  nsfwPreference,
  onPrefs,
  setBlurNsfw,
  setShowNsfw,
} from "../lib/state/prefs.ts";
import { currentUser, onSession } from "../lib/state/session.ts";

/**
 * The NSFW preference control, once for every listing that carries one
 * (`src/specs/systems/nsfw.md` → *Where it lives*, *States*).
 *
 * Two drawings, one component, because the signed-out state is not the absence of a control:
 *
 * - **Signed in** — the pair, in the spec's order: `Show NSFW content` then `Blur NSFW content`,
 *   both 44px `Toggle` rows writing straight to `lib/state/prefs.ts`. No page keeps its own copy
 *   of the pair, and no page decides what a toggle does.
 * - **Signed out** — **one** control: `Show NSFW content`, a `secondary` button that goes to
 *   `/authentification`. There is no account to hold Blur, so the pair is not drawn
 *   (`nsfw.md` → States → *Signed out*), and the note says why the action leaves the page.
 *
 * It sits **in place of the pair** rather than beside the filter row (T-25, recorded in
 * `docs/DESIGN.md`): the control has to be findable where it always is, and one button is a smaller
 * thing than two switches without being a second toolbar design.
 *
 * The component owns no state of its own beyond the two mirrors: the store answers, the adapter
 * holds the row, and the page keeps its own mirror only because it has to filter a listing on it.
 * `noun` is the listing's own word (*characters*, *posts*) for the Show hint — the spec's copy is
 * per surface, not generic.
 */
export function NsfwControl({ noun }: { noun: string }) @{
  const signedIn = track(currentUser() !== null);
  const show = track(nsfwPreference().show);
  const blur = track(nsfwPreference().blur);

  onSession((next) => {
    signedIn.value = next !== null;
  });

  onPrefs((next) => {
    show.value = next.show;
    blur.value = next.blur;
  });

  function signInForIt(): void {
    navigate("/authentification");
  }

  <>
    <style>
      /* The signed-out single control: one action and one line saying where it leads. It is the
         same row position the pair occupies, so nothing about the toolbar moves between states. */
      .gate {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      .note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      @media (min-width: 640px) {
        .gate {
          flex-direction: row;
          align-items: center;
          gap: 12px;
        }
      }
    </style>

    @if (signedIn.value) {
      <>
        <Toggle
          label="Show NSFW content"
          pressed={show}
          onToggle={setShowNsfw}
        />
        <Toggle
          label="Blur NSFW content"
          pressed={blur}
          onToggle={setBlurNsfw}
        />
      </>
    } @else {
      <div class="gate">
        <Button variant="secondary" onClick={signInForIt}>Show NSFW content</Button>
        <p class="note">Sign in to keep flagged {noun} in listings.</p>
      </div>
    }
  </>
}
