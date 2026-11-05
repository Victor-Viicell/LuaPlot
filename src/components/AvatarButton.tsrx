import { track } from "ripple";
import { Avatar } from "./Avatar.tsrx";
import { AvatarViewer } from "./AvatarViewer.tsrx";

/**
 * AvatarButton: the avatar as a control.
 *
 * The square is the box the card and the profile head already give it; the button only adds the
 * action. It is one component so both surfaces open the same viewer and neither owns a second copy
 * of the zoom state. The avatar itself is decorative here — the button carries the name.
 */
export function AvatarButton({
  initials,
  label,
}: {
  initials: string;
  /** The item's or account's name, used for the button and the dialog. */
  label: string;
}) {
  const open = track(false);

  return (
    <>
      <button
        type="button"
        class="avatar-button"
        aria-label={`View ${label} avatar`}
        aria-haspopup="dialog"
        onClick={() => (open.value = true)}
      >
        <Avatar initials={initials} size="fluid" />
      </button>
      @if (open.value) {
        <AvatarViewer
          initials={initials}
          label={label}
          onClose={() => (open.value = false)}
        />
      }
    </>
  );
}
