import { track } from "ripple";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { Select } from "./Select.tsrx";
import { Skeleton } from "./Skeleton.tsrx";
import { Toggle } from "./Toggle.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Character, Lorebook } from "../lib/data/types.ts";
import {
  LOREBOOK_ALREADY_ATTACHED,
  LOREBOOK_ID_INVALID,
  LOREBOOK_NOT_ATTACHABLE,
  VISIBILITY_OPTIONS,
  characterWriteSchema,
  lorebookIdSchema,
  type Visibility,
} from "../lib/schema.ts";

/**
 * The character form — one component, two hosts (`character/create.md`, and `character/edit.md`,
 * which is *the same form* preloaded).
 *
 * `character: null` is create; a row is edit. Two copies of this form would drift, and the drift
 * would be exactly the gate: one copy normalising a name, the other trusting it. The parse is
 * `characterWriteSchema` here **and** again in `repo.addCharacter` / `repo.updateCharacter`, so the
 * inline error, the submit gate and the stored row are one rule (`docs/ARCHITECTURE.md` →
 * Validation).
 *
 * What this component deliberately does not do:
 * - **It never trims or upper-cases.** A name is collapsed by the schema, the initials are
 *   upper-cased and filled from the name by the schema, and a pasted id is trimmed by
 *   `lorebookIdSchema` — the form only reads the messages that come back.
 * - **It never decides who may attach a lorebook.** **Add by ID** resolves through
 *   `repo.attachableLorebook`, the picker lists `repo.listAttachableLorebooks`, and the adapter
 *   checks the same rule on the write.
 * - **It never drops an unavailable attachment.** An id that no longer resolves stays in the list
 *   marked *unavailable* (`create.md` → States): removing it silently would erase a reference the
 *   author never deleted.
 * - **It draws no uploader.** There is no storage yet, so the avatar is the initials the `Avatar`
 *   primitive already draws; the field is honest about that rather than offering a dead button.
 */

/** One row in the attachment list: an id, its name when it still resolves, and that fact. */
type AttachmentRow = { id: string; name: string; available: boolean };

export function CharacterForm({
  character,
  onSaved,
  onCancel,
}: {
  character: Character | null;
  onSaved: (saved: Character) => void;
  onCancel: () => void;
}) @{
  const repo = resolveRepo();
  const editing = character !== null;

  const name = track(character?.name ?? "");
  const initials = track(character?.avatar.initials ?? "");
  const tagline = track(character?.tagline ?? "");
  const inSessionName = track(character?.inSessionName ?? "");
  const creatorNotes = track(character?.creatorNotes ?? "");
  const tags = track((character?.tags ?? []).join(", "));
  const visibility = track<Visibility>(
    character?.visibility ??
      (character?.isPublic === false ? "private" : "public"),
  );
  const nsfw = track(character?.nsfw ?? false);
  const anonymous = track(character?.anonymous ?? false);
  const description = track(character?.description ?? "");
  const firstMessage = track(character?.initialMessage ?? "");
  const scenario = track(character?.scenario ?? "");
  const exampleDialogs = track(character?.exampleDialogs ?? "");
  const alternateGreetings = track(
    (character?.alternateGreetings ?? []).join("\n"),
  );
  const ids = track<string[]>([...(character?.lorebookIds ?? [])]);

  const idInput = track("");
  const attachError = track("");
  const formError = track("");
  const saving = track(false);

  /** Names of the attached lorebooks that still resolve — the map the list draws. */
  const names = track<Record<string, string>>({});
  /** The picker's list: own lorebooks plus the ones booked from other authors. */
  const picker = track<Lorebook[]>([]);
  const loading = track(true);
  const loadFailure = track("");

  const rows = track<AttachmentRow[]>(() =>
    ids.value.map((id) => {
      const found = names.value[id];
      return { id, name: found ?? "", available: found !== undefined };
    }),
  );

  /** Already-attached books are not offered again; the by-ID control refuses them instead. */
  const chooseOptions = track<{ value: string; label: string }[]>(() => [
    { value: "", label: "Choose a lorebook" },
    ...picker.value
      .filter((book) => !ids.value.includes(book.id))
      .map((book) => ({ value: book.id, label: book.name })),
  ]);

  const denySave = track(() => saving.value || name.value.trim().length === 0);

  function remember(book: Lorebook): void {
    names.value = { ...names.value, [book.id]: book.name };
  }

  function resolveNames(list: string[]): void {
    if (list.length === 0) return;
    Promise.all(list.map((id) => repo.getLorebook(id))).then(
      (found) => {
        for (const book of found) if (book) remember(book);
      },
      () => {
        // A failed resolution is the *unavailable* row, not a page error: the list still draws.
      },
    );
  }

  function load(): void {
    resolveNames(ids.value);
    repo.listAttachableLorebooks().then(
      (books) => {
        picker.value = books;
        loading.value = false;
      },
      () => {
        loading.value = false;
        loadFailure.value =
          "The lorebook list could not be loaded. Add one by ID, or retry.";
      },
    );
  }

  async function addById(): Promise<void> {
    const parsed = lorebookIdSchema.safeParse(idInput.value);
    if (!parsed.success) {
      attachError.value =
        parsed.error.issues[0]?.message ?? LOREBOOK_ID_INVALID;
      return;
    }

    const id = parsed.data;
    if (ids.value.includes(id)) {
      attachError.value = LOREBOOK_ALREADY_ATTACHED;
      return;
    }

    attachError.value = "";
    const book = await repo.attachableLorebook(id).catch(() => null);
    if (!book) {
      attachError.value = LOREBOOK_NOT_ATTACHABLE;
      return;
    }

    ids.value = [...ids.value, book.id];
    remember(book);
    idInput.value = "";
  }

  function pick(value: string): void {
    if (value === "") return;
    const book = picker.value.find((row) => row.id === value) ?? null;
    if (!book || ids.value.includes(book.id)) return;
    ids.value = [...ids.value, book.id];
    remember(book);
    attachError.value = "";
  }

  function remove(id: string): void {
    ids.value = ids.value.filter((row) => row !== id);
    attachError.value = "";
  }

  async function save(): Promise<void> {
    if (saving.value) return;

    const parsed = characterWriteSchema.safeParse({
      name: name.value,
      avatar: { initials: initials.value },
      tagline: tagline.value,
      inSessionName: inSessionName.value,
      creatorNotes: creatorNotes.value,
      tags: tags.value,
      visibility: visibility.value,
      nsfw: nsfw.value,
      anonymous: anonymous.value,
      description: description.value,
      firstMessage: firstMessage.value,
      scenario: scenario.value,
      exampleDialogs: exampleDialogs.value,
      alternateGreetings: alternateGreetings.value,
      lorebookIds: ids.value,
    });
    if (!parsed.success) {
      formError.value =
        parsed.error.issues[0]?.message ?? "That character couldn't be saved.";
      return;
    }

    formError.value = "";
    saving.value = true;
    const saved = character
      ? await repo.updateCharacter(character.id, parsed.data).catch(() => null)
      : await repo.addCharacter(parsed.data).catch(() => null);
    saving.value = false;

    if (!saved) {
      // The draft stays exactly as typed: the spec's *Save failed* state.
      formError.value = "That character couldn't be saved. Try again.";
      return;
    }

    onSaved(saved);
  }

  load();

  <form
    class="character-form"
    onSubmit={(event) => {
      event.preventDefault();
      save();
    }}
  >
    {/* The root element carries no scope class in Ripple 0.4.7, so a rule on `.character-form` is
        dropped and the form never becomes a grid (found in T-19). The layout lives on this child. */}
    <div class="layout">
      <section class="section is-identity">
        <p class="section-label">Identity</p>
        <Field
          label="Name"
          value={name}
          maxLength={80}
          placeholder="Sonic the Hedgehog"
          error={formError}
          onInput={(value) => {
            name.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Initials"
          value={initials}
          maxLength={4}
          placeholder="SO"
          help="Stands in for an uploaded image."
          onInput={(value) => {
            initials.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Tagline"
          value={tagline}
          maxLength={140}
          placeholder="Runs first, apologises at speed."
          onInput={(value) => {
            tagline.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="In-session name"
          value={inSessionName}
          maxLength={40}
          placeholder="Sonic"
          help="Falls back to the name when left empty."
          onInput={(value) => {
            inSessionName.value = value;
            formError.value = "";
          }}
        />
      </section>

      <section class="section is-meta">
        <p class="section-label">Publishing</p>
        <Field
          label="Creator notes"
          multiline={true}
          rows={4}
          maxLength={4000}
          value={creatorNotes}
          placeholder="Notes for readers of the detail page. Never part of the prompt."
          onInput={(value) => {
            creatorNotes.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Tags"
          value={tags}
          placeholder="sea, harbor, ritual"
          help="Comma-separated."
          onInput={(value) => {
            tags.value = value;
            formError.value = "";
          }}
        />
        <Select
          label="Visibility"
          value={visibility}
          options={[...VISIBILITY_OPTIONS]}
          onChange={(next) => (visibility.value = next as Visibility)}
        />
        <div class="toggles">
          <Toggle
            label="NSFW"
            pressed={nsfw}
            onToggle={(next) => (nsfw.value = next)}
          />
          <Toggle
            label="Publish anonymously"
            pressed={anonymous}
            onToggle={(next) => (anonymous.value = next)}
          />
        </div>
      </section>

      <section class="section is-definition">
        <p class="section-label">Description and opening</p>
        <Field
          label="Description / personality"
          multiline={true}
          rows={8}
          maxLength={4000}
          value={description}
          placeholder="Who they are, how they speak, what they want."
          onInput={(value) => {
            description.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="First message"
          multiline={true}
          rows={5}
          maxLength={4000}
          value={firstMessage}
          placeholder="The character's opening line."
          onInput={(value) => {
            firstMessage.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Scenario"
          multiline={true}
          rows={4}
          maxLength={4000}
          value={scenario}
          placeholder="Where the scene starts and what is at stake."
          onInput={(value) => {
            scenario.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Example dialogs"
          multiline={true}
          rows={6}
          maxLength={8000}
          value={exampleDialogs}
          placeholder="How they answer, in their own voice."
          onInput={(value) => {
            exampleDialogs.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Alternate greetings"
          multiline={true}
          rows={4}
          maxLength={8000}
          value={alternateGreetings}
          placeholder="One greeting per line."
          help="One opening per line; the first message stays the default."
          onInput={(value) => {
            alternateGreetings.value = value;
            formError.value = "";
          }}
        />
      </section>

      <section class="section is-attach">
        <p class="section-label">Attached lorebooks</p>

        <div class="attach-add">
          <Field
            label="Lorebook ID"
            value={idInput}
            placeholder="Paste an ID"
            error={attachError}
            onInput={(value) => {
              idInput.value = value;
              attachError.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => addById()}>
            Add by ID
          </Button>
        </div>

        @if (loading.value) {
          <div
            class="skel"
            aria-busy="true"
            aria-label="Loading your lorebooks"
          >
            <Skeleton lines={2} />
            <Skeleton lines={2} />
          </div>
        } @else {
          <>
            @if (loadFailure.value) {
              <p class="alert" role="alert">
                {loadFailure.value}
              </p>
            } @else if (chooseOptions.value.length > 1) {
              <Select
                label="Pick lorebook"
                value={""}
                options={chooseOptions.value}
                onChange={pick}
              />
            }

            @if (rows.value.length === 0) {
              <p class="empty-note">
                No lorebooks attached. A character can be saved with none.
              </p>
            } @else {
              <ul class="attach-list">
                @for (const row of rows.value; key row.id) {
                  <li class="attach-row">
                    <span class="attach-text">
                      <span class="attach-name">
                        {row.available ? row.name : row.id}
                      </span>
                      @if (!row.available) {
                        <span class="attach-unavailable">
                          unavailable — the lorebook is gone or private
                        </span>
                      }
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => remove(row.id)}
                      label="Remove"
                    >{`Remove`}</Button>
                  </li>
                }
              </ul>
            }
          </>
        }
      </section>

      <div class="foot">
        @if (formError.value) {
          <p class="alert" role="alert">
            {formError.value}
          </p>
        }
        <div class="buttons">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={denySave}>
            {saving.value ? "Saving…" : editing ? "Save changes" : "Save"}
          </Button>
        </div>
      </div>
    </div>

    <style>
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 24px;
      }

      .section {
        display: flex;
        flex-direction: column;
        gap: 12px;
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

      .media-grid,
      .toggles {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .attach-add {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* A native field is 44px; the button under it is the same width, so tapping Add is one column. */
      .attach-add > :last-child {
        align-self: stretch;
      }

      .attach-list {
        display: flex;
        flex-direction: column;
        gap: 1px;
        margin: 0;
        padding: 0;
        list-style: none;
        border: 1px solid var(--color-border);
        border-radius: 2px;
      }

      .attach-row {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        min-height: 44px;
        padding: 6px 4px 6px 12px;
        background-color: var(--color-bg-elevated);
      }

      .attach-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .attach-name {
        overflow: hidden;
        color: var(--color-text);
        font-size: 13px;
        line-height: 1.4;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .attach-unavailable {
        color: var(--color-text-subtle);
        font-size: 11px;
        line-height: 1.4;
      }

      .empty-note {
        margin: 0;
        padding: 8px 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.6;
      }

      .alert {
        margin: 0;
        color: var(--color-danger);
        font-size: 13px;
        line-height: 1.6;
      }

      .skel {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .foot {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border);
      }

      .buttons {
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
      }

      .buttons > * {
        flex: 1 1 auto;
      }
    </style>
  </form>
}

export default CharacterForm;
