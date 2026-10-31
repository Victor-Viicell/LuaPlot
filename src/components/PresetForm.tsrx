import { track } from "ripple";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { Select } from "./Select.tsrx";
import { Toggle } from "./Toggle.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Preset } from "../lib/data/types.ts";
import { PRESET_MODELS, presetWriteSchema } from "../lib/schema.ts";

/**
 * The preset form — one component, two hosts (`preset/create.md`, and `preset/edit.md`, which is
 * *the same form* preloaded). `preset: null` is create; a row is edit. The parse is
 * `presetWriteSchema` here **and** again in `repo.addPreset` / `repo.updatePreset`, so the inline
 * error, the submit gate and the stored row are one rule (`docs/ARCHITECTURE.md` → Validation).
 *
 * It is `LorebookForm` minus the entries editor: a preset has no entries, so there is nothing to
 * list, reorder or block-validate. What it adds is the **generation settings** block, which is the
 * thing a preset exists to carry — `preset/create.md` says the form is *the avatar and the NSFW
 * toggle at the top, then the generation settings, then Save and Cancel*, and calls the settings *a
 * flat list of fields, not grouped into sections*.
 *
 * Decisions recorded in `docs/DESIGN.md` → *Preset create and edit (T-19)*:
 * - **Model is a `Select` of `PRESET_MODELS`, not a free-text field.** `create.md` → *Data* says the
 *   model is *chosen by its author from the ones the app offers*, so a text box would let an author
 *   name a model that does not exist. The list lives in `schema.ts` beside `presetSettingsSchema`, so
 *   the options and the fixtures read one list.
 * - **The provider is not a control and not shown as one.** *The provider behind it belongs to the
 *   app: it is never a field and is not shown* — so there is no provider select, and the help line
 *   says so in words rather than drawing a second field.
 * - **The settings sit in their own labelled block**, even though the list is flat: the block's label
 *   is the section header the rest of the frame already uses, and at `lg` the block is the wide
 *   column's second row. Section = a labelled region, not a grouping of the spec's fields.
 */

export function PresetForm({
  preset,
  onSaved,
  onCancel,
}: {
  preset: Preset | null;
  onSaved: (saved: Preset) => void;
  onCancel: () => void;
}) @{
  const repo = resolveRepo();
  const editing = preset !== null;

  const name = track(preset?.name ?? "");
  const description = track(preset?.description ?? "");
  const initials = track(preset?.avatar.initials ?? "");
  const nsfw = track(preset?.nsfw ?? false);
  /** The saved model, or the app's first one — a preset always names a model. */
  const model = track(preset?.settings.model ?? PRESET_MODELS[0]);

  const formError = track("");
  const saving = track(false);

  const denySave = track(() => saving.value || name.value.trim().length === 0);

  const modelOptions = PRESET_MODELS.map((value) => ({ value, label: value }));

  async function save(): Promise<void> {
    if (saving.value) return;

    const parsed = presetWriteSchema.safeParse({
      name: name.value,
      description: description.value,
      nsfw: nsfw.value,
      avatar: { initials: initials.value },
      settings: { model: model.value },
    });

    if (!parsed.success) {
      // One message, from the schema: the preset has no list to attach a per-row error to.
      formError.value = parsed.error.issues[0]?.message ?? "That preset couldn't be saved.";
      return;
    }

    formError.value = "";
    saving.value = true;
    const saved = preset
      ? await repo.updatePreset(preset.id, parsed.data).catch(() => null)
      : await repo.addPreset(parsed.data).catch(() => null);
    saving.value = false;

    if (!saved) {
      // The draft stays exactly as typed: the spec's *Save failed* state.
      formError.value = "That preset couldn't be saved. Try again.";
      return;
    }

    onSaved(saved);
  }

  <form
    class="preset-form"
    onSubmit={(event) => {
      event.preventDefault();
      save();
    }}
  >
    {/* A component's **root** element carries no scope class in Ripple 0.4.7, so a rule written on
        `.preset-form` is dropped by the compiler and the form never becomes a grid (found in T-19;
        `CharacterForm` and `LorebookForm` had the same dead rule). The layout lives on this child. */}
    <div class="layout">
    <section class="section is-identity">
      <p class="section-label">Identity</p>
      <Field
        label="Name"
        value={name}
        maxLength={80}
        placeholder="Long-form, low heat"
        help="Display only — the same name can be used by anyone, any number of times."
        error={formError}
        onInput={(value) => {
          name.value = value;
          formError.value = "";
        }}
      />
    </section>

    <section class="section is-definition">
      <p class="section-label">Description</p>
      <Field
        label="What this preset is for"
        multiline={true}
        rows={4}
        maxLength={4000}
        value={description}
        placeholder="When to reach for it, and what it does to a scene."
        help="Shown on the detail page above the settings. A preset has no tagline."
        onInput={(value) => {
          description.value = value;
          formError.value = "";
        }}
      />
    </section>

    <section class="section is-media">
      <p class="section-label">Image and visibility</p>
      <div class="media-grid">
        <Field
          label="Initials"
          value={initials}
          maxLength={4}
          placeholder="LH"
          help="Two letters drawn on the cover. There is no image uploader yet; empty uses the name's first letters."
          onInput={(value) => {
            initials.value = value;
            formError.value = "";
          }}
        />
        <Toggle
          label="NSFW"
          hint="Flags this preset for the blurred view"
          pressed={nsfw}
          onToggle={(next) => (nsfw.value = next)}
        />
      </div>
    </section>

    <section class="section is-settings">
      <p class="section-label">Generation settings</p>
      <p class="section-note">
        What a session copies when it starts from this preset. Its own copy is the only thing an edit
        cannot reach.
      </p>
      <Select label="Model" name="model" value={model.value} options={modelOptions} onChange={(next) => (model.value = next)} />
      <p class="field-note">
        The provider behind the model belongs to the app: a preset records which model it generates
        with, never where the model runs.
      </p>
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

      .field-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .media-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
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

        .media-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          align-items: end;
          gap: 16px;
        }
      }

      @media (min-width: 900px) {
        /* The same frame as the character and lorebook forms: identity and media in a 320px right
           column, the definition on the left, and the settings as the wide column's second row. */
        .layout {
          grid-template-columns: minmax(0, 1fr) 320px;
          align-items: start;
          column-gap: 40px;
        }

        .section.is-identity {
          grid-column: 2;
          grid-row: 1;
        }

        .section.is-media {
          grid-column: 2;
          grid-row: 2;
        }

        .section.is-definition {
          grid-column: 1;
          grid-row: 1;
        }

        .section.is-settings {
          grid-column: 1;
          grid-row: 2;
          padding-top: 16px;
          border-top: 1px solid var(--color-border);
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

export default PresetForm;
