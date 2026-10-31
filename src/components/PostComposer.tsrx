import { track } from "ripple";
import { Avatar } from "./Avatar.tsrx";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { Skeleton } from "./Skeleton.tsrx";
import { Toggle } from "./Toggle.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import type {
  Character,
  PostAttachment,
  PostWrite,
  Session,
  Turn,
} from "../lib/data/types.ts";
import { initialsOf } from "../lib/format.ts";
import { postWriteSchema } from "../lib/schema.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * The composer — one form for both hosts (`post/create.md`).
 *
 * `/post/create` mounts it as a page; `/session/[id]` mounts it inside a **`Sheet`** with the cut
 * already attached (T-15). One component, one `postWriteSchema` parse and one `repo.addPost` call,
 * so the gate, the inline error and the adapter's refusal cannot drift into three rulings — the
 * panel instance is not a second composer with its own rules (`docs/DESIGN.md` → *Thread*).
 *
 * - **`cut` locks the attachment.** The picker (the viewer's characters, then their sessions as
 *   cuts) exists only when there is nothing attached yet; a page that opens this with a cut does not
 *   fetch a list it will not draw. The cut's text is stamped here, from `turns`, and the post stores
 *   words — never a pointer (`luaplot-pages.md`: publishing a cut is a snapshot).
 * - **Attribution is the author's choice**, offered only once a cut is attached (`create.md`):
 *   the session's persona name, or the generic `User`. A session with no persona has one option that
 *   reads `User` either way, and the choice is not drawn as a choice then.
 * - **The post's own NSFW toggle decides the flag**, never the character's (`session/detail.md` →
 *   *Publish a cut*).
 * - **Cancel** is the host's: a page navigates, a sheet closes itself.
 */

/** The range a session publishes, already resolved by the page that owns the transcript. */
export type ComposerCut = {
  sessionId: string;
  /** The character's in-session name — stamped on every character turn. */
  speakerName: string;
  /** The session's persona name, or `""` when it has none (the user side then reads `User`). */
  personaName: string;
  /** The chosen turns, oldest first. */
  turns: Turn[];
  /** `first → last`, drawn above the body so the range is visible while writing. */
  rangeLabel: string;
};

type AttachKind = "none" | "character" | "cut";
type Attribution = "persona" | "user";

export function PostComposer({
  cut = null,
  onPublished,
  onCancel,
}: {
  cut?: ComposerCut | null;
  onPublished: (postId: string) => void;
  onCancel: () => void;
}) @{
  const repo = resolveRepo();
  const viewer = currentUser();
  const signedIn = viewer !== null;

  /** A cut is attached before the composer exists, so the picker is not fetched nor drawn. */
  const locked = cut !== null;
  const cutSpeaker = cut?.speakerName ?? "";
  const cutPersona = cut?.personaName ?? "";
  const cutTurns = cut?.turns ?? [];
  const rangeLabel = cut?.rangeLabel ?? "";

  const draft = track("");
  const nsfw = track(false);
  const formError = track("");
  const publishing = track(false);

  const attachKind = track<AttachKind>("none");
  const attachId = track("");
  const attribution = track<Attribution>(cutPersona !== "" ? "persona" : "user");

  /** The picker's two lists, loaded together — page mode only. */
  const loading = track(!locked);
  const loadFailure = track("");
  const mine = track<Character[]>([]);
  const sessions = track<Session[]>([]);
  /** Persona names by id, so the attribution choice can name the persona it would print. */
  const personas = track<Record<string, string>>({});

  const denyPublish = track(() => publishing.value || draft.value.trim().length === 0);

  /** The session currently chosen as the cut's source, or `null` (page mode). */
  const chosenSession = track(() => {
    if (locked || attachKind.value !== "cut" || attachId.value === "") return null;
    return sessions.value.find((row) => row.id === attachId.value) ?? null;
  });

  /** The name the user's own side would be stamped with. */
  const personaName = track(() => {
    if (locked) return cutPersona;
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

  /** The cut a set of turns publishes, stamped with the attribution in force right now. */
  function stamp(speaker: string, turns: Turn[]): PostAttachment {
    const userSide =
      attribution.value === "persona" && personaName.value !== "" ? personaName.value : "User";

    return {
      kind: "cut",
      messages: turns.map((turn) => ({
        speaker: turn.role,
        attribution: turn.role === "character" ? speaker : userSide,
        text: turn.text,
      })),
    };
  }

  function attachmentNow(): PostAttachment | null {
    if (locked) {
      if (cutTurns.length === 0) return null;
      return stamp(cutSpeaker, cutTurns);
    }

    if (attachKind.value === "character" && attachId.value !== "") {
      return { kind: "character", characterId: attachId.value };
    }

    const session = chosenSession.value;
    if (attachKind.value === "cut" && session) {
      if (session.turns.length === 0) return null;
      return stamp(session.character.inSessionName || session.character.name, session.turns);
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

    onPublished(created.id);
  }

  if (signedIn && !locked) load();

  <>
    <style>
      .compose {
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

      /* The locked cut: the range the reader is about to publish, as a bordered row. */
      .locked {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      .locked-range {
        margin: 0;
        color: var(--color-text);
        font-size: 13px;
        line-height: 1.4;
      }

      .locked-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.5;
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
        .buttons {
          flex-direction: row;
          justify-content: flex-end;
        }

        .buttons > * {
          flex: 0 0 auto;
          min-width: 140px;
        }

        .attach-group {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 16px;
        }
      }

      @media (min-width: 900px) {
        /* The body gets the reading column; the picker sits beside it. A composer that stayed one
           328px column at 1440 would be a stretched phone. A cut-locked composer keeps one column:
           inside a sheet there is no second column to fill. */
        .compose:not(.is-locked) {
          grid-template-columns: minmax(0, 1fr) 340px;
          column-gap: 32px;
        }

        .compose:not(.is-locked) .section.is-body,
        .compose:not(.is-locked) .foot {
          grid-column: 1;
        }

        .compose:not(.is-locked) .section.is-attach {
          grid-column: 2;
          grid-row: 1 / span 3;
        }

        .foot {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }

        .alert {
          order: -1;
        }
      }
    </style>

    @if (!signedIn) {
      <p class="alert" role="alert">Sign in to publish a post.</p>
    } @else {
      <form
        class={locked ? "compose is-locked" : "compose"}
        onSubmit={(event) => {
          event.preventDefault();
          publish();
        }}
      >
        <section class="section is-body">
          <Field
            label="Body"
            multiline={true}
            rows={locked ? 5 : 8}
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

          @if (locked) {
            <div class="locked">
              <p class="locked-range">{rangeLabel}</p>
              <p class="locked-note">
                {`${cutTurns.length} ${cutTurns.length === 1 ? "message" : "messages"} · published as text, not a link to the session`}
              </p>
            </div>
          } @else if (loading.value) {
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
                    You have no characters or sessions to attach yet. This will be a plain text post.
                  </p>
                }
              </div>
            </>
          }
        </section>

        @if (locked || attachKind.value === "cut") {
          <section class="section is-attribution">
            <p class="section-label">Your side is attributed as</p>
            <div class="choices">
              @if (personaName.value !== "") {
                <label class="choice">
                  <input
                    type="radio"
                    name="attribution"
                    checked={attribution.value === "persona"}
                    onChange={() => (attribution.value = "persona")}
                  />
                  <span class="choice-text">
                    <span class="choice-name">{personaName.value}</span>
                    <span class="choice-note">
                      The persona's name, written into the post now
                    </span>
                  </span>
                </label>
              }
              <label class="choice">
                <input
                  type="radio"
                  name="attribution"
                  checked={attribution.value === "user" || personaName.value === ""}
                  onChange={() => (attribution.value = "user")}
                />
                <span class="choice-text">
                  <span class="choice-name">User</span>
                  <span class="choice-note">
                    {personaName.value === ""
                      ? "No persona on this session, so your side reads User"
                      : "A generic reader, never your account"}
                  </span>
                </span>
              </label>
            </div>
            <p class="section-note">
              The word is stamped at publish time: a later persona rename does not change it.
            </p>
          </section>
        }

        <div class="foot">
          <div class="toggle-row">
            <Toggle
              label="NSFW"
              hint="Flags this post for the blurred view"
              pressed={nsfw}
              onToggle={(next) => (nsfw.value = next)}
            />
          </div>
          <div class="buttons">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={denyPublish}>
              {publishing.value ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>
      </form>
    }
  </>
}

export default PostComposer;
