import { track } from "ripple";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Persona } from "../lib/data/types.ts";
import { personaWriteSchema } from "../lib/schema.ts";

/**
 * The persona form — one component, two hosts (`persona/create.md`, and `persona/edit.md`, which is
 * *the same form* preloaded). `persona: null` is create; a row is edit.
 *
 * It is `PresetForm` **minus the settings block and the NSFW toggle, plus a tagline field**, because
 * a persona is *a smaller, distinct model rather than a character with sharing removed*
 * (`persona/create.md` → *Data*). What the spec orders is the order here: *the name and tagline, then
 * the description and personality, then the avatar*.
 *
 * Decisions recorded in `docs/DESIGN.md` → *Persona create and edit (T-20)*:
 * - **The tagline is a real field, never a `""` the adapter invents.** A persona has one (the
 *   collection card draws it), unlike a character, lorebook or preset whose forms leave it empty.
 * - **No NSFW toggle, no tags, no lorebook picker, no preset picker.** *Absent by design* lists
 *   exactly those, and the session settles the character's attachments and preset when it starts.
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
  const tagline = track(persona?.tagline ?? "");
  const description = track(persona?.description ?? "");
  const initials = track(persona?.avatar.initials ?? "");

  const formError = track("");
  const saving = track(false);

  /** The draft as the schema sees it; `denySave` and `save` read one rule. */
  const write = () => ({
    name: name.value,
    tagline: tagline.value,
    description: description.value,
    avatar: { initials: initials.value },
  });

  const denySave = track(() => saving.value || !personaWriteSchema.safeParse(write()).success);

  async function save(): Promise<void> {
    if (saving.value) return;

    const parsed = personaWriteSchema.safeParse(write());
    if (!parsed.success) {
      formError.value = parsed.error.issues[0]?.message ?? "That persona couldn't be saved.";
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
          help="Display only — two personas may carry the same name, because the id is the identity."
          error={formError}
          onInput={(value) => {
            name.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Tagline"
          value={tagline}
          maxLength={140}
          placeholder="Blunt, curious, asks the question nobody wants."
          help="The one line the collection card carries under the name."
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
          help="Read-only on the persona's page. A persona has no comment thread, so nothing discusses it."
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
          help="Two letters drawn on the square. There is no image uploader yet; empty uses the name's first letters."
          onInput={(value) => {
            initials.value = value;
            formError.value = "";
          }}
        />
      </section>

      <div class="foot">
        @if (formError.value) {
          <p class="alert" role="alert">{formError.value}</p>
        }
        <div class="buttons">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
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

      @media (min-width: 640px) {
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
        /* The character/lorebook/preset frame: the picture and the identity in a 320px right column,
           the definition down the left, and the foot across both. */
        .layout {
          grid-template-columns: minmax(0, 1fr) 320px;
          align-items: start;
          column-gap: 40px;
        }

        .section.is-definition {
          grid-column: 1;
          grid-row: 1;
        }

        .section.is-identity {
          grid-column: 2;
          grid-row: 1;
        }

        .section.is-media {
          grid-column: 2;
          grid-row: 2;
        }

        .foot {
          grid-column: 1 / span 2;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }

        .foot .alert {
          order: -1;
        }
      }
    </style>
  </form>
}

export default PersonaForm;
