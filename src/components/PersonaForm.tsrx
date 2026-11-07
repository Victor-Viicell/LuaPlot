import { track } from "ripple";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { Select } from "./Select.tsrx";
import { Skeleton } from "./Skeleton.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Lorebook, Persona } from "../lib/data/types.ts";
import { personaWriteSchema } from "../lib/schema.ts";

/**
 * The persona form — one component, two hosts (`persona/create.md`, and `persona/edit.md`, which is
 * *the same form* preloaded). `persona: null` is create; a row is edit.
 *
 * A persona is *a smaller, distinct model rather than a character with sharing removed*, so the form
 * is the persona write and nothing else. The fields follow `formstype.ts` → `PersonaWrite`: name,
 * in-chat name, tagline, description, avatar, then the attached lorebooks.
 *
 * Decisions recorded in `docs/DESIGN.md` → *Persona create and edit (T-20)*:
 * - **The tagline is a real field, never a `""` the adapter invents.** A persona has one, and the
 *   collection card draws it.
 * - **No NSFW toggle, no tags, no preset picker.** *Absent by design* lists exactly those, and the
 *   session settles the character's preset when it starts. Lorebooks are attached here because a
 *   persona carries its own list.
 * - **The avatar is initials only**, filled from the name when left empty — the schema does that, the
 *   page never upper-cases a label itself.
 * - **Save is disabled while the write fails its schema**, not while a page-local rule says so: the
 *   derived gate runs the same `personaWriteSchema` the adapter parses with, so the button and the
 *   inline error cannot disagree.
 */

export function PersonaForm({
  persona,
  onSaved,
  onCancel,
}: {
  persona: Persona | null;
  onSaved: (saved: Persona) => void;
  onCancel: () => void;
}) @{
  const repo = resolveRepo();
  const editing = persona !== null;

  const name = track(persona?.name ?? "");
  const inSessionName = track(persona?.inSessionName ?? "");
  const tagline = track(persona?.tagline ?? "");
  const description = track(persona?.description ?? "");
  const initials = track(persona?.avatar.initials ?? "");
  const ids = track<string[]>([...(persona?.lorebookIds ?? [])]);

  const picker = track<Lorebook[]>([]);
  const loading = track(true);
  const loadFailure = track("");
  const formError = track("");
  const saving = track(false);

  const chooseOptions = track(() => [
    { value: "", label: "Choose a lorebook" },
    ...picker.value
      .filter((book) => !ids.value.includes(book.id))
      .map((book) => ({ value: book.id, label: book.name })),
  ]);

  function load(): void {
    repo.listAttachableLorebooks().then(
      (books) => {
        picker.value = books;
        loading.value = false;
      },
      () => {
        loading.value = false;
        loadFailure.value = "The lorebook list could not be loaded.";
      },
    );
  }

  function attach(id: string): void {
    if (id === "" || ids.value.includes(id)) return;
    ids.value = [...ids.value, id];
    formError.value = "";
  }

  function detach(id: string): void {
    ids.value = ids.value.filter((row) => row !== id);
  }

  function lorebookName(id: string): string {
    return picker.value.find((book) => book.id === id)?.name ?? id;
  }

  /** The draft as the schema sees it; `denySave` and `save` read one rule. */
  const write = () => ({
    name: name.value,
    inSessionName: inSessionName.value,
    tagline: tagline.value,
    description: description.value,
    avatar: { initials: initials.value },
    lorebookIds: ids.value,
  });

  const denySave = track(
    () => saving.value || !personaWriteSchema.safeParse(write()).success,
  );

  load();

  async function save(): Promise<void> {
    if (saving.value) return;

    const parsed = personaWriteSchema.safeParse(write());
    if (!parsed.success) {
      formError.value =
        parsed.error.issues[0]?.message ?? "That persona couldn't be saved.";
      return;
    }

    formError.value = "";
    saving.value = true;
    const saved = persona
      ? await repo.updatePersona(persona.id, parsed.data).catch(() => null)
      : await repo.addPersona(parsed.data).catch(() => null);
    saving.value = false;

    if (!saved) {
      // The draft stays exactly as typed: the spec's *Save failed* state.
      formError.value = "That persona couldn't be saved. Try again.";
      return;
    }

    onSaved(saved);
  }

  <form
    class="persona-form"
    onSubmit={(event) => {
      event.preventDefault();
      save();
    }}
  >
    {/* A component's **root** element carries no scope class in Ripple 0.4.7, so a rule written on
        `.persona-form` is dropped by the compiler. The layout lives on this child (T-19). */}
    <div class="layout">
      <section class="section is-identity">
        <p class="section-label">Identity</p>
        <Field
          label="Name"
          value={name}
          maxLength={80}
          placeholder="Nell"
          error={formError}
          onInput={(value) => {
            name.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="In-chat name"
          value={inSessionName}
          maxLength={40}
          placeholder="Nell"
          help="Falls back to the name when left empty."
          onInput={(value) => {
            inSessionName.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Tagline"
          value={tagline}
          maxLength={140}
          placeholder="Blunt, curious, asks the question nobody wants."
          onInput={(value) => {
            tagline.value = value;
            formError.value = "";
          }}
        />
      </section>

      <section class="section is-definition">
        <p class="section-label">Description and personality</p>
        <Field
          label="Who this persona is"
          multiline={true}
          rows={8}
          maxLength={4000}
          value={description}
          placeholder="How they talk, what they notice, what they would rather not say."
          onInput={(value) => {
            description.value = value;
            formError.value = "";
          }}
        />
      </section>

      <section class="section is-media">
        <p class="section-label">Avatar</p>
        <Field
          label="Initials"
          value={initials}
          maxLength={4}
          placeholder="NL"
          help="Stands in for an uploaded image."
          onInput={(value) => {
            initials.value = value;
            formError.value = "";
          }}
        />
      </section>

      <section class="section is-attach">
        <p class="section-label">Lorebooks</p>
        @if (loading.value) {
          <div
            class="skel"
            aria-busy="true"
            aria-label="Loading your lorebooks"
          >
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
                onChange={attach}
              />
            }
            @if (ids.value.length === 0) {
              <p class="empty-note">
                No lorebooks attached. A persona can be saved with none.
              </p>
            } @else {
              <ul class="attach-list">
                @for (const id of ids.value; key id) {
                  <li class="attach-row">
                    <span class="attach-name">{lorebookName(id)}</span>
                    <Button variant="ghost" onClick={() => detach(id)}>
                      {"Remove"}
                    </Button>
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
        gap: 16px;
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

      .alert {
        margin: 0;
        color: var(--color-danger);
        font-size: 13px;
        line-height: 1.6;
      }

      .empty-note {
        margin: 0;
        padding: 8px 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.6;
      }

      .skel {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .attach-list {
        display: flex;
        flex-direction: column;
        gap: 1px;
        margin: 0;
        padding: 0;
        border: 1px solid var(--color-border);
        border-radius: 2px;
        list-style: none;
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

      .attach-name {
        overflow: hidden;
        color: var(--color-text);
        font-size: 13px;
        line-height: 1.4;
        text-overflow: ellipsis;
        white-space: nowrap;
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

export default PersonaForm;
