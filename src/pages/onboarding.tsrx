import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { Field } from "../components/Field.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { Toggle } from "../components/Toggle.tsrx";
import { navigate } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import { currentUser, setAccount } from "../lib/state/session.ts";
import { nsfwPreference, onPrefs, setBlurNsfw, setShowNsfw } from "../lib/state/prefs.ts";
import { HANDLE_RULE, readDisplayName, readHandle } from "../lib/validate.ts";

/**
 * `/onboarding` — first-run setup (`src/specs/pages/onboarding.md`).
 *
 * The spec is the shortest in the repo and it is strict: a handle (claimed here, unique
 * case-insensitively, `[a-z0-9_]` 3–24, lowercased on save), a required display name, and the two
 * NSFW preferences. Nothing else — no avatar, no persona, no bio. The shell's top bar already says
 * *Onboarding*, so this is a **form page**, not the title page `/` and `/authentification` share: a
 * 12px kicker, a 26/34 title, one line of copy, a hairline, then the fields. The decision is
 * recorded in `docs/DESIGN.md` under "Onboarding (decided in T-07)".
 *
 * Four things are load-bearing and each has one owner:
 * - **validity** is `lib/validate.ts`, one pure reading per field, used by the inline error and by
 *   the Finish gate, so the two can never disagree;
 * - **uniqueness** is `repo.isHandleTaken`, asked on a 250ms settle and again on submit. The page
 *   never scans fixtures: a handle lookup is the adapter's rule, exactly like one vote per viewer;
 * - **the NSFW pair** is `lib/state/prefs.ts`, never page-local booleans, so `/dev/state` and every
 *   listing agree with what this screen shows;
 * - **the draft** is `repo.saveProfile`, written on the same settle, so "an abandoned first run
 *   keeps what was typed" is true of the adapter rather than of this component.
 *
 * Deliberate gaps, both recorded in `docs/DESIGN.md`: no redirect for a signed-out visitor (the
 * access matrix is T-30) and no prefill from a provider name (the mock account's name is the
 * literal `You`, which is not a provider label).
 */
export function Onboarding() @{
  const repo = resolveRepo();

  /** One union for the page, so a half-loaded form is not a set of booleans that disagree. */
  const phase = track<"loading" | "ready" | "failed">("loading");

  const handleDraft = track("");
  const nameDraft = track("");
  /** An error is shown once a field has settled, never on the first keystroke. */
  const handleSettled = track(false);
  const nameSettled = track(false);
  /** The adapter's last answer, and which handle it was about: an answer is never reused. */
  const verdict = track<{ handle: string; taken: boolean } | null>(null);
  const busy = track(false);
  const failure = track("");

  /**
   * The NSFW pair rides the real store: this page reads it and writes through `setShowNsfw` /
   * `setBlurNsfw`, so there is one answer for the account and not a second one in this file.
   */
  const show = track(nsfwPreference().show);
  const blur = track(nsfwPreference().blur);

  onPrefs((next) => {
    show.value = next.show;
    blur.value = next.blur;
  });

  const handle = track(() => readHandle(handleDraft.value));
  const name = track(() => readDisplayName(nameDraft.value));

  /** Taken means taken *for this value*: a stale answer must never disable Finish. */
  const taken = track(() => {
    const answer = verdict.value;
    return answer !== null && answer.handle === handle.value.handle && answer.taken;
  });

  /** The current value has been asked about, so Finish may trust it. */
  const checked = track(() => verdict.value?.handle === handle.value.handle);

  const canFinish = track(
    () =>
      phase.value === "ready" &&
      !busy.value &&
      handle.value.problem === null &&
      name.value.problem === null &&
      checked.value &&
      !taken.value,
  );

  /**
   * The disabled flag must be the **derived**, not `!canFinish`: a prop expression is evaluated
   * once at the call, so `!derived` is a constant `false` and Finish would never enable (the trap
   * T-06 hit on the provider buttons).
   */
  const blocked = track(() => !canFinish.value);

  const handleError = track(() => {
    const reading = handle.value;
    if (reading.problem && handleSettled.value) {
      return reading.problem === "required" ? "A handle is required." : HANDLE_RULE;
    }
    // The spec's copy, verbatim and naming no alternative.
    if (taken.value) return "Username taken";
    return "";
  });

  /** The rule is the help line until it is the error; showing both would print it twice. */
  const handleHelp = track(() => (handleError.value ? "" : HANDLE_RULE));

  const nameError = track(() =>
    nameSettled.value && name.value.problem ? "A display name is required." : "",
  );

  /** Ask the adapter. An unanswered question blocks: it never passes by default. */
  function checkHandle(value: string): Promise<boolean> {
    return repo.isHandleTaken(value).then(
      (isTaken) => {
        verdict.value = { handle: value, taken: isTaken };
        return isTaken;
      },
      () => {
        verdict.value = null;
        failure.value = "Your handle could not be checked. Try again.";
        return true;
      },
    );
  }

  /**
   * The draft write. A 250ms settle, one `saveProfile` plus the preference pair, and only for a
   * value that could actually be finished: writing a two-character handle as the account's profile
   * would let a draft defeat the uniqueness check it is exempt from.
   */
  function persistDraft() {
    if (phase.value !== "ready" || busy.value) return;
    const reading = handle.value;
    const displayName = name.value.name;
    if (reading.problem || !displayName) return;

    const target = reading.handle;
    void checkHandle(target).then((isTaken) => {
      if (isTaken) return;
      return repo.saveProfile({ handle: target, displayName }).then((saved) =>
        repo.savePreferences(saved.handle, { show: show.value, blur: blur.value }).then(() => saved),
      );
    }, noop);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  function settle(field: "handle" | "name") {
    failure.value = "";
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (field === "handle") handleSettled.value = true;
      else nameSettled.value = true;
      persistDraft();
    }, 250);
  }

  function onHandleInput(next: string) {
    handleDraft.value = next;
    // A new value invalidates the last answer, so Finish cannot lean on a verdict about "an".
    verdict.value = null;
    settle("handle");
  }

  function onNameInput(next: string) {
    nameDraft.value = next;
    settle("name");
  }

  /**
   * Finish: the same write as the draft, then the account, then entry content. The check is
   * repeated here because a draft answered 250ms ago is not a claim; a taken handle keeps Finish
   * where it was instead of writing a handle two accounts would share.
   */
  function finish() {
    if (!canFinish.value) return;
    busy.value = true;
    failure.value = "";
    const target = handle.value.handle;
    const displayName = name.value.name;

    repo
      .isHandleTaken(target)
      .then((isTaken) => {
        verdict.value = { handle: target, taken: isTaken };
        if (isTaken) return null;
        return repo.saveProfile({ handle: target, displayName });
      })
      .then((saved) => {
        if (!saved) return null;
        return repo
          .savePreferences(saved.handle, { show: show.value, blur: blur.value })
          .then(() => saved);
      })
      .then(
        (saved) => {
          busy.value = false;
          if (!saved) return;
          // The account, before the route: `/user/<handle>` and the profile tab read the session,
          // and a saved display name that never reaches it would read `You` everywhere.
          setAccount({ handle: saved.handle, displayName: saved.displayName });
          navigate(`/user/${saved.handle}`);
        },
        () => {
          busy.value = false;
          failure.value = "Your account could not be saved. Try again.";
        },
      );
  }

  /** Read the draft back. `null` is the spec's first visit, not a failure. */
  function load() {
    phase.value = "loading";
    failure.value = "";
    repo.currentProfile().then(
      (saved) => {
        if (saved) {
          handleDraft.value = saved.handle;
          nameDraft.value = saved.displayName;
          handleSettled.value = true;
          nameSettled.value = true;
        }
        // Prefilled from the provider's name when there is one. The mock account ships the literal
        // `You`, which is not a provider label, so only a saved draft prefills here; T-30 replaces
        // this with `currentUser()?.displayName` once a provider actually returns one.
        const account = saved ? saved.handle : currentUser()?.handle;
        if (!account) {
          phase.value = "ready";
          return;
        }
        return repo.getPreferences(account).then(
          (prefs) => {
            // Through the store, so the pair this page shows is the pair every listing will use.
            setShowNsfw(prefs.show);
            setBlurNsfw(prefs.blur);
            phase.value = "ready";
            if (saved) void checkHandle(saved.handle);
          },
          () => {
            phase.value = "ready";
          },
        );
      },
      () => {
        phase.value = "failed";
      },
    );
  }

  load();

  <>
    <style>
      .setup {
        display: flex;
        flex-direction: column;
        gap: 28px;
        padding-bottom: 8px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 10px;
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
        line-height: 1.2;
      }

      .lede {
        max-width: 52ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      /* The hairline is the same gesture as home's entry rule: the reading ends, the form begins. */
      .form {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border);
      }

      .fields {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      /* A second rule, not a box: the preferences are a different kind of answer from the two
         required fields, and the space between them is the only thing that says so. */
      .group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border);
      }

      .group-label {
        margin: 0 0 4px;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.3;
        text-transform: uppercase;
      }

      .failure {
        margin: 0;
        color: var(--color-danger);
        font-size: 13px;
        line-height: 1.5;
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
        text-wrap: pretty;
      }

      /* One orchestrated entrance: four items, 40ms apart. */
      .kicker {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .title {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) 40ms both;
      }

      .lede {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) 80ms both;
      }

      .form {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both;
      }

      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      @keyframes fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @media (min-width: 640px) {
        /* A form is not a poster: the fields keep a 520 measure rather than filling a 640 outlet. */
        .setup {
          max-width: 520px;
        }

        .actions {
          flex-direction: row;
          align-items: center;
          gap: 16px;
        }

        .actions .btn {
          width: auto;
          min-width: 200px;
        }

        .actions .note {
          flex: 1 1 auto;
          max-width: 30ch;
        }
      }

      @media (min-width: 900px) {
        .setup {
          gap: 32px;
        }
      }

      @media (min-width: 1200px) {
        /* Same centred measure as `/` and `/authentification`: the entry sequence shares one column. */
        .setup {
          max-width: 560px;
          margin: 0 auto;
        }

        .title {
          font-size: 34px;
        }

        .lede {
          font-size: 15px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .kicker,
        .title,
        .lede,
        .form {
          animation-name: fade;
          animation-duration: 120ms;
          animation-delay: 0ms;
        }
      }
    </style>

    <div class="setup">
      <header class="head">
        <p class="kicker">first run</p>
        <h1 class="title">Claim your handle</h1>
        <p class="lede">
          Two fields and two preferences. The handle is the only URL this account has; the name is
          what everyone reads.
        </p>
      </header>

      @if (phase.value === "loading") {
        <div class="form" aria-busy="true">
          <Skeleton variant="lines" lines={3} lineHeight={44} />
        </div>
      } @else if (phase.value === "failed") {
        <div class="form">
          <p class="failure" role="alert">The setup form could not be loaded.</p>
          <div class="actions">
            <Button variant="secondary" onClick={load}>Try again</Button>
          </div>
        </div>
      } @else {
        <form
          class="form"
          onSubmit={(event) => {
            event.preventDefault();
            finish();
          }}
        >
          <div class="fields">
            <Field
              label="Username"
              name="handle"
              value={handleDraft}
              help={handleHelp}
              error={handleError}
              placeholder="your_handle"
              onInput={onHandleInput}
            />
            <Field
              label="Display name"
              name="displayName"
              value={nameDraft}
              help="Shown on your profile and beside everything you publish."
              error={nameError}
              placeholder="Your name"
              onInput={onNameInput}
            />
          </div>

          <div class="group">
            <p class="group-label">NSFW content</p>
            <Toggle
              label="Show NSFW content"
              hint="Keeps flagged items in every listing."
              pressed={show}
              onToggle={(next) => setShowNsfw(next)}
            />
            <Toggle
              label="Blur NSFW content"
              hint="Keeps them listed but covered until revealed."
              pressed={blur}
              onToggle={(next) => setBlurNsfw(next)}
            />
          </div>

          @if (failure.value) {
            <p class="failure" role="alert">{failure.value}</p>
          }

          <div class="actions">
            <Button variant="primary" type="submit" block disabled={blocked}>
              {busy.value ? "Saving…" : "Finish"}
            </Button>
            <p class="note">
              Both preferences can be changed later in account settings. Only the handle and the
              name are required.
            </p>
          </div>
        </form>
      }
    </div>
  </>
}

/** A rejected draft write is silent: the next settle tries again, and Finish reports its own. */
function noop(): void {}

export default Onboarding;
