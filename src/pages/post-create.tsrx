import { track } from "ripple";
import { Avatar } from "../components/Avatar.tsrx";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Field } from "../components/Field.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { Toggle } from "../components/Toggle.tsrx";
import { href, navigate } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Character, PostAttachment, PostWrite, Session } from "../lib/data/types.ts";
import { initialsOf } from "../lib/format.ts";
import { postWriteSchema } from "../lib/schema.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/post/create` — the composer (`src/specs/pages/post/create.md`).
 *
 * One column, one form, exactly the four things the spec puts in it: the body, the attachment with
 * its picker, the NSFW toggle, Publish / Cancel.
 *
 * - **The body is the only gate** (`postWriteSchema`, parsed here *and* again by `repo.addPost`), so
 *   the inline line and the refusal come from the same rule. Publishing is disabled while the body
 *   is empty or a publish is in flight; the error line is what a failed parse says — never a second
 *   sentence invented in the page.
 * - **Inline image and GIF insertion is not drawn.** There is no uploader and no storage, and the
 *   spec's media rules have no control to fire from, so a button here would be a button that does
 *   nothing. Recorded in `docs/DESIGN.md` → *Composer*: it arrives with the uploader, and until then
 *   `postSchema` has no media field either.
 * - **Only the author's own items are offered** — the picker is `listCharacters()` filtered to the
 *   viewer, and `repo.addPost` refuses a character the viewer does not author, so the picker is not
 *   the only guard (`post/create.md`: *only the author's own content … A lorebook or a preset cannot
 *   be attached*).
 * - **A cut is stamped as text at publish time.** Choosing one of the viewer's own sessions turns its
 *   transcript into `cutMessage`s: the character side always reads the session's character name, the
 *   user side reads the chosen attribution — the persona's name, or `User` when the session has no
 *   persona or the author picks the generic one. The post records the words, not a pointer
 *   (`luaplot-pages.md`: *publishing a cut is a snapshot*).
 * - **Cancel goes back to the thread**, which is where the only **Create** control lives today; the
 *   panel-over-the-thread instance waits for its `Sheet` host.
 */

type AttachKind = "none" | "character" | "cut";
type Attribution = "persona" | "user";

export function PostCreate() @{
  const repo = resolveRepo();

  const viewer = currentUser();
  const signedIn = viewer !== null;

  const draft = track("");
  const nsfw = track(false);
  const formError = track("");
  const publishing = track(false);

  const attachKind = track<AttachKind>("none");
  const attachId = track("");
  const attribution = track<Attribution>("persona");

  /** The picker's two lists, loaded together. */
  const loading = track(true);
  const loadFailure = track("");
  const mine = track<Character[]>([]);
  const sessions = track<Session[]>([]);
  /** Persona names by id, so the attribution choice can name the persona it would print. */
  const personas = track<Record<string, string>>({});

  const denyPublish = track(() => publishing.value || draft.value.trim().length === 0);

  /** The session currently chosen as the cut's source, or `null`. */
  const chosenSession = track(() => {
    if (attachKind.value !== "cut" || attachId.value === "") return null;
    return sessions.value.find((row) => row.id === attachId.value) ?? null;
  });
  const personaName = track(() => {
    const session = chosenSession.value;
    if (!session?.personaId) return "";
    return personas.value[session.personaId] ?? "";
  });

  function load(): void {
    loading.value = true;
    loadFailure.value = "";

    Promise.all([repo.listCharacters({ page: 1 }), repo.listMySessions()]).then(
      ([listing, ownSessions]) => {
        const handle = viewer?.handle ?? "";
        mine.value = listing.items.filter((row) => row.author === handle);
        sessions.value = ownSessions;

        const wanted = [
          ...new Set(ownSessions.map((row) => row.personaId).filter((id): id is string => !!id)),
        ];
        Promise.all(wanted.map((id) => repo.getPersona(id))).then(
          (found) => {
            const next: Record<string, string> = {};
            for (const person of found) if (person) next[person.id] = person.name;
            personas.value = next;
            loading.value = false;
          },
          () => {
            loading.value = false;
          },
        );
      },
      () => {
        loading.value = false;
        loadFailure.value = "The picker could not be loaded. Publish without an attachment, or retry.";
      },
    );
  }

  /** The cut the chosen session would publish: its whole transcript, stamped with the attribution. */
  function cutOf(session: Session): PostAttachment {
    const speakerName = session.character.inSessionName || session.character.name;
    const userSide =
      attribution.value === "persona" && personaName.value !== "" ? personaName.value : "User";

    return {
      kind: "cut",
      messages: session.turns.map((turn) => ({
        speaker: turn.role,
        attribution: turn.role === "character" ? speakerName : userSide,
        text: turn.text,
      })),
    };
  }

  function attachmentNow(): PostAttachment | null {
    if (attachKind.value === "character" && attachId.value !== "") {
      return { kind: "character", characterId: attachId.value };
    }
    const session = chosenSession.value;
    if (attachKind.value === "cut" && session) {
      const cut = cutOf(session);
      // A session with no turns has nothing to publish; the schema says a cut needs one message.
      if (cut.kind === "cut" && cut.messages.length === 0) return null;
      return cut;
    }
    return null;
  }

  function chooseKind(next: AttachKind): void {
    attachKind.value = next;
    if (next !== "cut") attribution.value = "persona";
    if (next === "none") attachId.value = "";
    formError.value = "";
  }

  async function publish(): Promise<void> {
    if (publishing.value || !signedIn) return;

    const write: PostWrite = {
      body: draft.value,
      nsfw: nsfw.value,
      attachment: attachmentNow(),
    };

    const parsed = postWriteSchema.safeParse(write);
    if (!parsed.success) {
      formError.value = parsed.error.issues[0]?.message ?? "That post couldn't be published.";
      return;
    }

    formError.value = "";
    publishing.value = true;
    const created = await repo.addPost(parsed.data).catch(() => null);
    publishing.value = false;

    if (!created) {
      // The draft stays exactly as it is: the spec's *Publish failed* state.
      formError.value = "That post couldn't be published. Try again.";
      return;
    }

    navigate(`/post/${created.id}`);
  }

  function cancel(): void {
    navigate("/post/thread");
  }

  if (signedIn) load();

  <>
    <style>
      .compose {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 2px;
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
        max-width: 52ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      .form {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
      }

      /* A section is a hairline label and its control, never a boxed card inside a card. */
      .section {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
      }

      .section-label {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .section-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .choices {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      /* A native radio in a 44px row: the Toggle primitive is the two NSFW preferences, not this. */
      .choice {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 44px;
        padding: 0 10px;
        border: 1px solid transparent;
        border-radius: 2px;
        cursor: pointer;
      }

      .choice:hover {
        border-color: var(--color-border);
        background-color: var(--color-surface);
      }

      .choice input {
        width: 16px;
        height: 16px;
        margin: 0;
        accent-color: var(--color-accent);
      }

      .choice-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .choice-name {
        overflow: hidden;
        color: var(--color-text);
        font-size: 13px;
        line-height: 1.3;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .choice-note {
        color: var(--color-text-subtle);
        font-size: 11px;
        line-height: 1.3;
      }

      .empty-note {
        margin: 0;
        padding: 12px 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.6;
      }

      .foot {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border);
      }

      .alert {
        margin: 0;
        color: var(--color-danger);
        font-size: 13px;
        line-height: 1.6;
      }

      .buttons {
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
      }

      .buttons > * {
        flex: 1 1 auto;
      }

      .skel {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      @media (min-width: 640px) {
        .lede {
          font-size: 15px;
        }

        .buttons {
          flex-direction: row;
          justify-content: flex-end;
        }

        .buttons > * {
          flex: 0 0 auto;
          min-width: 140px;
        }
      }

      @media (min-width: 900px) {
        /* The body gets the reading column; the attachment and its picker sit beside it. A composer
           that stayed one 328px column at 1440 would be a stretched phone. */
        .form {
          grid-template-columns: minmax(0, 1fr) 340px;
          column-gap: 32px;
        }

        .section.is-body,
        .foot {
          grid-column: 1;
        }

        .section.is-attach {
          grid-column: 2;
          grid-row: 1 / span 2;
        }

        .foot {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }

        .alert {
          order: -1;
        }

        .toggle-row {
          order: 0;
        }
      }
    </style>

    <div class="compose">
      <header class="head">
        <p class="kicker">new post</p>
        <p class="lede">
          A post is written once. Correcting it means deleting it and publishing again — publishing
          makes it public immediately.
        </p>
      </header>

      @if (!signedIn) {
        <EmptyState
          message="Sign in to publish a post."
          actionLabel="Sign in"
          href={href("/authentification")}
        />
      } @else {
        <form
          class="form"
          onSubmit={(event) => {
            event.preventDefault();
            publish();
          }}
        >
          <section class="section is-body">
            <Field
              label="Body"
              multiline={true}
              rows={8}
              maxLength={4000}
              value={draft}
              error={formError}
              placeholder="What happened, what you changed, what you would do differently."
              onInput={(value) => {
                draft.value = value;
                formError.value = "";
              }}
            />
          </section>

          <section class="section is-attach">
            <p class="section-label">Attachment</p>

            @if (loading.value) {
              <div class="skel" aria-busy="true" aria-label="Loading your characters">
                <Skeleton lines={2} />
                <Skeleton lines={2} />
              </div>
            } @else {
              <>
                @if (loadFailure.value) {
                  <p class="alert" role="alert">{loadFailure.value}</p>
                }

                <p class="section-note">
                  At most one, and only your own: one of your characters, or a cut from one of your
                  sessions.
                </p>

                <div class="choices">
                  <label class="choice">
                    <input
                      type="radio"
                      name="attachment"
                      checked={attachKind.value === "none"}
                      onChange={() => chooseKind("none")}
                    />
                    <span class="choice-text">
                      <span class="choice-name">No attachment</span>
                      <span class="choice-note">A plain text post</span>
                    </span>
                  </label>

                  @for (const person of mine.value; key person.id) {
                    <label class="choice">
                      <input
                        type="radio"
                        name="attachment"
                        checked={attachKind.value === "character" && attachId.value === person.id}
                        onChange={() => {
                          chooseKind("character");
                          attachId.value = person.id;
                        }}
                      />
                      <Avatar initials={person.avatar.initials || initialsOf(person.name)} size={28} />
                      <span class="choice-text">
                        <span class="choice-name">{person.name}</span>
                        <span class="choice-note">Character</span>
                      </span>
                    </label>
                  }

                  @for (const session of sessions.value; key session.id) {
                    <label class="choice">
                      <input
                        type="radio"
                        name="attachment"
                        checked={attachKind.value === "cut" && attachId.value === session.id}
                        onChange={() => {
                          chooseKind("cut");
                          attachId.value = session.id;
                        }}
                      />
                      <Avatar
                        initials={session.character.avatar.initials || initialsOf(session.character.name)}
                        size={28}
                      />
                      <span class="choice-text">
                        <span class="choice-name">
                          {`Cut · ${session.character.inSessionName || session.character.name}`}
                        </span>
                        <span class="choice-note">
                          {session.turns.length === 1 ? "1 message" : `${session.turns.length} messages`}
                        </span>
                      </span>
                    </label>
                  }

                  @if (mine.value.length === 0 && sessions.value.length === 0) {
                    <p class="empty-note">
                      You have no characters or sessions to attach yet. This will be a plain text
                      post.
                    </p>
                  }
                </div>

                @if (attachKind.value === "cut") {
                  <>
                    <p class="section-label">Your side is attributed as</p>
                    <div class="choices">
                      <label class="choice">
                        <input
                          type="radio"
                          name="attribution"
                          checked={attribution.value === "persona"}
                          onChange={() => (attribution.value = "persona")}
                        />
                        <span class="choice-text">
                          <span class="choice-name">
                            {personaName.value !== "" ? personaName.value : "Persona name"}
                          </span>
                          <span class="choice-note">
                            {personaName.value !== ""
                              ? "The persona's name, written into the post now"
                              : "No persona on this session, so it reads User"}
                          </span>
                        </span>
                      </label>
                      <label class="choice">
                        <input
                          type="radio"
                          name="attribution"
                          checked={attribution.value === "user"}
                          onChange={() => (attribution.value = "user")}
                        />
                        <span class="choice-text">
                          <span class="choice-name">User</span>
                          <span class="choice-note">A generic reader, never your account</span>
                        </span>
                      </label>
                    </div>
                    <p class="section-note">
                      The word is stamped at publish time: a later persona rename does not change it.
                    </p>
                  </>
                }
              </>
            }
          </section>

          <div class="foot">
            <div class="toggle-row">
              <Toggle label="NSFW" hint="Flags this post for the blurred view" pressed={nsfw} onToggle={(next) => (nsfw.value = next)} />
            </div>
            <div class="buttons">
              <Button variant="secondary" onClick={cancel}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={denyPublish}>
                {publishing.value ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </div>
        </form>
      }
    </div>
  </>
}

export default PostCreate;
