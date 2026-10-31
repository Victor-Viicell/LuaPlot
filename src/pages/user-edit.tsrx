import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Field } from "../components/Field.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { Toggle } from "../components/Toggle.tsrx";
import { href, navigate, useParams } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Profile } from "../lib/data/types.ts";
import { handleSchema, profileEditSchema } from "../lib/schema.ts";
import { currentUser, setAccount } from "../lib/state/session.ts";
import { nsfwPreference, onPrefs, setBlurNsfw, setShowNsfw } from "../lib/state/prefs.ts";
import { HANDLE_RULE, readDisplayName, readHandle } from "../lib/validate.ts";

/**
 * `/user/[user.username]/edit` — the signed-in account's own settings
 * (`src/specs/pages/user/edit.md`).
 *
 * **Own account only.** Anyone else has no entry point and the route itself refuses: the page
 * compares the URL's handle with the session's and draws *forbidden*, so a pasted URL cannot edit a
 * stranger. The adapter refuses a second time by editing the account's own row, never the URL's.
 *
 * What the page edits, and the spec's absences that are the rule: display name, avatar initials,
 * bio, username, and the NSFW pair as the account's two real preferences. **No email, no provider,
 * no delete** — identity stays with Supabase and no route removes an account. Saving writes the
 * profile through `profileEditSchema` and the pair through `repo.savePreferences`, then lands on
 * `/user/<handle>`: a changed username moves the URL and leaves no alias, so the old one is
 * not-found rather than a redirect.
 *
 * Layout is the create/edit form pattern T-17/T-19 established (kicker, title, fields, sticky
 * footer actions) and is written down in `docs/DESIGN.md` → *Profile header and edit form (T-23)*.
 */

type Phase = "loading" | "ready" | "forbidden" | "error";

export function UserEdit() @{
  const repo = resolveRepo();
  const params = useParams();
  const parsedHandle = handleSchema.safeParse(params.username ?? "");
  const urlHandle = parsedHandle.success ? parsedHandle.data : "";

  const viewer = currentUser();
  const myHandle = viewer?.handle ?? "";

  const phase = track<Phase>("loading");
  const failure = track("");
  const busy = track(false);

  const nameDraft = track("");
  const initialsDraft = track("");
  const bioDraft = track("");
  const handleDraft = track("");

  /** An error is shown once the field has settled, never on the first keystroke. */
  const nameSettled = track(false);
  const handleSettled = track(false);
  const verdict = track<{ handle: string; taken: boolean } | null>(null);
  const formFailure = track("");

  const row = track<Profile | null>(null);

  const show = track(nsfwPreference().show);
  const blur = track(nsfwPreference().blur);
  onPrefs((next) => {
    show.value = next.show;
    blur.value = next.blur;
  });

  const handle = track(() => readHandle(handleDraft.value));
  const name = track(() => readDisplayName(nameDraft.value));

  const taken = track(() => {
    const answer = verdict.value;
    return answer !== null && answer.handle === handle.value.handle && answer.taken;
  });

  const handleError = track(() => {
    const reading = handle.value;
    if (reading.problem && handleSettled.value) {
      return reading.problem === "required" ? "A username is required." : HANDLE_RULE;
    }
    // The spec's copy for this state, verbatim (`edit.md` → *States* → *Username taken*).
    if (taken.value) return "Username taken";
    return "";
  });

  const nameError = track(() =>
    nameSettled.value && name.value.problem ? "A display name is required." : "",
  );

  /** The rule is the help line until it is the error; showing both would print it twice. */
  const handleHelp = track(() => (handleError.value ? "" : HANDLE_RULE));

  const canSave = track(
    () =>
      phase.value === "ready" &&
      !busy.value &&
      handle.value.problem === null &&
      name.value.problem === null &&
      !taken.value,
  );
  const blocked = track(() => !canSave.value);

  let timer: ReturnType<typeof setTimeout> | undefined;

  function boot(): void {
    phase.value = "loading";
    failure.value = "";

    if (myHandle === "" || urlHandle === "" || myHandle !== urlHandle) {
      phase.value = "forbidden";
      return;
    }

    Promise.all([repo.getProfile(urlHandle), repo.getPreferences(urlHandle)]).then(
      ([found, prefs]) => {
        if (!found) {
          phase.value = "forbidden";
          return;
        }
        row.value = found;
        nameDraft.value = found.displayName;
        initialsDraft.value = found.avatar.initials;
        bioDraft.value = found.bio;
        handleDraft.value = found.handle;
        show.value = prefs.show;
        blur.value = prefs.blur;
        phase.value = "ready";
      },
      () => {
        phase.value = "error";
        failure.value = "Your account couldn't be loaded.";
      },
    );
  }

  /** Ask the adapter whether the typed handle belongs to somebody else. Asked on a settle and again
   * on Save: a draft answered 250ms ago is not a claim. */
  function checkHandle(value: string): Promise<boolean> {
    return repo.isHandleTaken(value).then(
      (isTaken) => {
        verdict.value = { handle: value, taken: isTaken };
        return isTaken;
      },
      () => {
        verdict.value = null;
        formFailure.value = "That username couldn't be checked. Try again.";
        return true;
      },
    );
  }

  function onHandleInput(next: string): void {
    handleDraft.value = next;
    // A new value invalidates the last answer, so Save cannot lean on a verdict about another word.
    verdict.value = null;
    handleSettled.value = false;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      handleSettled.value = true;
      const reading = readHandle(next);
      if (!reading.problem && reading.handle !== urlHandle) void checkHandle(reading.handle);
    }, 250);
  }

  function onNameInput(next: string): void {
    nameDraft.value = next;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      nameSettled.value = true;
    }, 250);
  }

  /**
   * The avatar is initials only — there is no uploader (`docs/DESIGN.md` → *Avatars*). An empty
   * field falls back to the display name's initials rather than saving a blank avatar the primitive
   * cannot draw; `avatarSchema.initials` is `min(1)` for exactly that reason.
   */
  function initialsOf(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    const derived = parts
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2);
    return (initialsDraft.value.trim() || derived || handle.value.handle.slice(0, 2)).toUpperCase();
  }

  async function save(): Promise<void> {
    if (!canSave.value) return;
    busy.value = true;
    formFailure.value = "";

    const target = handle.value.handle;
    const displayName = name.value.name;
    const bio = bioDraft.value;

    // The page's edge parse: the same schema the adapter re-parses, so inline errors, the Save gate
    // and the stored row cannot disagree.
    const write = profileEditSchema.safeParse({
      handle: target,
      displayName,
      avatar: { initials: initialsOf(displayName) },
      bio,
    });
    if (!write.success) {
      busy.value = false;
      formFailure.value = "Check the fields above and try again.";
      return;
    }

    if (target !== urlHandle && (await checkHandle(target))) {
      busy.value = false;
      handleSettled.value = true;
      return;
    }

    const saved = await repo.saveProfileEdit(write.data).catch(() => null);
    if (!saved) {
      busy.value = false;
      formFailure.value = "Your changes couldn't be saved. Try again.";
      return;
    }

    const prefs = await repo
      .savePreferences(saved.handle, { show: show.value, blur: blur.value })
      .catch(() => null);

    busy.value = false;
    if (!prefs) {
      formFailure.value = "Your preferences couldn't be saved. Try again.";
      return;
    }

    // The account, then the profile at its (possibly new) URL: a rename moves the page and leaves
    // the previous handle not-found, with no redirect offered.
    setAccount({ handle: saved.handle, displayName: saved.displayName });
    setShowNsfw(prefs.show);
    setBlurNsfw(prefs.blur);
    navigate(`/user/${saved.handle}`);
  }

  function cancel(): void {
    navigate(`/user/${urlHandle}`);
  }

  boot();

  <div class="edit">
    <style>
      .edit {
        display: flex;
        flex-direction: column;
        gap: 18px;
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

      .title {
        margin: 0;
        color: var(--color-text);
        font-size: 26px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.15;
      }

      .lede {
        max-width: 56ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      .form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border);
      }

      .pair {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 4px;
      }

      .pair-label {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .form-failure {
        margin: 0;
        color: var(--color-danger);
        font-size: 14px;
        line-height: 1.6;
      }

      /* Sticky on the page's own column, never a floating bar over the shell. */
      .actions {
        position: sticky;
        bottom: calc(72px + env(safe-area-inset-bottom, 0px));
        z-index: 2;
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
        padding: 12px 0;
        background-color: var(--color-bg);
        border-top: 1px solid var(--color-border);
      }

      .slab {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      @media (min-width: 640px) {
        .title {
          font-size: 32px;
        }

        .lede {
          font-size: 15px;
        }

        .actions {
          position: static;
          flex-direction: row;
          justify-content: flex-end;
          padding-top: 16px;
          background-color: transparent;
        }

        .actions > * {
          min-width: 160px;
        }
      }

      @media (min-width: 900px) {
        .form {
          max-width: 560px;
        }
      }
    </style>

    <header class="head">
      <p class="kicker">account</p>
      <h1 class="title">Edit profile</h1>
      <p class="lede">
        What LuaPlot knows about you: a display name, an avatar, a bio and the username your profile
        lives at. Sign-in identity stays with Supabase, so nothing here touches your email provider.
      </p>
    </header>

    @if (phase.value === "loading") {
      <div class="slab" aria-busy="true" aria-label="Loading your account">
        <Skeleton variant="block" height={18} />
        <Skeleton variant="block" height={56} />
      </div>
    } @else if (phase.value === "forbidden") {
      <EmptyState
        message="You can't edit this account."
        actionLabel="Back to your profile"
        href={href(`/user/${myHandle || urlHandle}`)}
      />
    } @else if (phase.value === "error") {
      <div class="slab" role="alert">
        <p class="form-failure">{failure.value}</p>
        <Button variant="secondary" onClick={boot}>Retry</Button>
      </div>
    } @else {
      <div class="form">
        <Field
          label="Display name"
          name="displayName"
          value={nameDraft}
          error={nameError}
          placeholder="How your name reads"
          onInput={onNameInput}
        />

        <Field
          label="Avatar initials"
          name="initials"
          value={initialsDraft}
          maxLength={4}
          help="One or two characters. Uploads arrive later; initials stand in until they do."
          onInput={(next) => (initialsDraft.value = next)}
        />

        <Field
          label="Bio"
          name="bio"
          value={bioDraft}
          multiline
          rows={4}
          placeholder="A line or two about what you write"
          onInput={(next) => (bioDraft.value = next)}
        />

        <Field
          label="Username"
          name="username"
          value={handleDraft}
          error={handleError}
          help={handleHelp}
          onInput={onHandleInput}
        />

        <div class="pair">
          <p class="pair-label">NSFW content</p>
          <Toggle
            label="Show NSFW content"
            hint="Flagged items are listed."
            pressed={show}
            onToggle={(next) => (show.value = next)}
          />
          <Toggle
            label="Blur NSFW content"
            hint="Flagged items are listed behind a cover."
            pressed={blur}
            onToggle={(next) => (blur.value = next)}
          />
        </div>

        @if (formFailure.value) {
          <p class="form-failure" role="alert">{formFailure.value}</p>
        }

        <div class="actions">
          <Button variant="secondary" disabled={busy} onClick={cancel}>Cancel</Button>
          <Button variant="primary" disabled={blocked} onClick={save}>
            {busy.value ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    }
  </div>
}

export default UserEdit;
