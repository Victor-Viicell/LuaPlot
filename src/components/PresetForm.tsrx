import { track } from "ripple";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { Select } from "./Select.tsrx";
import { Toggle } from "./Toggle.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Preset } from "../lib/data/types.ts";
import {
  PRESET_MODELS,
  REASONING_EFFORTS,
  presetWriteSchema,
} from "../lib/schema.ts";

/**
 * The preset form — one component, two hosts (`preset/create.md`, and `preset/edit.md`, which is
 * *the same form* preloaded). `preset: null` is create; a row is edit. The parse is
 * `presetWriteSchema` here **and** again in `repo.addPreset` / `repo.updatePreset`, so the inline
 * error, the submit gate and the stored row are one rule (`docs/ARCHITECTURE.md` → Validation).
 *
 * A preset has no entries, so there is nothing to list, reorder or block-validate. What it adds is
 * the **settings** block, which is the thing a preset exists to carry. The fields follow
 * `formstype.ts` → `PresetWrite` and `PresetSettings`: identity, then the prompt structure, then the
 * generation parameters.
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
  const tagline = track(preset?.tagline ?? "");
  const creatorNotes = track(preset?.creatorNotes ?? "");
  const initials = track(preset?.avatar.initials ?? "");
  const nsfw = track(preset?.nsfw ?? false);

  const settings = preset?.settings;
  const preHistoryInstructions = track(settings?.preHistoryInstructions ?? "");
  const postHistoryInstructions = track(
    settings?.postHistoryInstructions ?? "",
  );
  const impersonationPrompt = track(settings?.impersonationPrompt ?? "");
  /** The saved model, or the app's first one — a preset always names a model. */
  const model = track(settings?.model ?? PRESET_MODELS[0]);
  const thinking = track(settings?.thinking?.type ?? "");
  const reasoningEffort = track(settings?.reasoningEffort ?? "high");
  const maxTokens = track(String(settings?.maxTokens ?? 8192));
  const contextSize = track(String(settings?.contextSize ?? 32768));
  const stop = track((settings?.stop ?? []).join("\n"));
  const temperature = track(String(settings?.temperature ?? 1));
  const topP = track(String(settings?.topP ?? 1));

  const formError = track("");
  const saving = track(false);

  const denySave = track(() => saving.value || name.value.trim().length === 0);

  const modelOptions = PRESET_MODELS.map((value) => ({ value, label: value }));

  async function save(): Promise<void> {
    if (saving.value) return;

    const parsed = presetWriteSchema.safeParse({
      name: name.value,
      tagline: tagline.value,
      creatorNotes: creatorNotes.value,
      nsfw: nsfw.value,
      avatar: { initials: initials.value },
      settings: {
        preHistoryInstructions: preHistoryInstructions.value,
        postHistoryInstructions: postHistoryInstructions.value,
        impersonationPrompt: impersonationPrompt.value,
        model: model.value,
        ...(thinking.value === "enabled" || thinking.value === "disabled"
          ? { thinking: { type: thinking.value as "enabled" | "disabled" } }
          : {}),
        reasoningEffort: reasoningEffort.value as
          "none" | "low" | "high" | "max",
        maxTokens: Number(maxTokens.value),
        contextSize: Number(contextSize.value),
        stop: stop.value,
        temperature: Number(temperature.value),
        topP: Number(topP.value),
      },
    });

    if (!parsed.success) {
      // One message, from the schema: the preset has no list to attach a per-row error to.
      formError.value =
        parsed.error.issues[0]?.message ?? "That preset couldn't be saved.";
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
          placeholder="Long answers, dense detail, no summary."
          onInput={(value) => {
            tagline.value = value;
            formError.value = "";
          }}
        />
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
        <Toggle
          label="NSFW"
          pressed={nsfw}
          onToggle={(next) => (nsfw.value = next)}
        />
        <Field
          label="Initials"
          value={initials}
          maxLength={4}
          placeholder="LH"
          help="Stands in for an uploaded image."
          onInput={(value) => {
            initials.value = value;
            formError.value = "";
          }}
        />
      </section>

      <section class="section is-settings">
        <p class="section-label">Prompt structure</p>
        <Field
          label="Pre-history instructions"
          multiline={true}
          rows={4}
          maxLength={8000}
          value={preHistoryInstructions}
          placeholder="Added to the prompt to set the character's behaviour."
          onInput={(value) => {
            preHistoryInstructions.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Post-history instructions"
          multiline={true}
          rows={4}
          maxLength={8000}
          value={postHistoryInstructions}
          placeholder="Added after the chat history. Leave empty to omit."
          onInput={(value) => {
            postHistoryInstructions.value = value;
            formError.value = "";
          }}
        />
        <Field
          label="Impersonation prompt"
          multiline={true}
          rows={3}
          maxLength={4000}
          value={impersonationPrompt}
          placeholder="The prompt Impersonate uses to write the user's next response."
          onInput={(value) => {
            impersonationPrompt.value = value;
            formError.value = "";
          }}
        />

        <p class="section-label">Generation parameters</p>
        <Select
          label="Model"
          name="model"
          value={model}
          options={modelOptions}
          onChange={(next) => (model.value = next)}
        />
        <Select
          label="Thinking mode"
          value={thinking}
          options={[
            { value: "", label: "Follow reasoning effort" },
            { value: "enabled", label: "Enabled" },
            { value: "disabled", label: "Disabled" },
          ]}
          onChange={(next) => (thinking.value = next)}
        />
        <Select
          label="Reasoning effort"
          value={reasoningEffort}
          options={[...REASONING_EFFORTS]}
          onChange={(next) =>
            (reasoningEffort.value = next as "none" | "low" | "high" | "max")
          }
        />
        <div class="settings-grid">
          <Field
            label="Max tokens"
            value={maxTokens}
            placeholder="8192"
            help="1–393216."
            onInput={(value) => (maxTokens.value = value)}
          />
          <Field
            label="Context size"
            value={contextSize}
            placeholder="32768"
            help="Prompt history budget. App-side only."
            onInput={(value) => (contextSize.value = value)}
          />
          <Field
            label="Temperature"
            value={temperature}
            placeholder="1"
            help="0–2. No effect in thinking mode."
            onInput={(value) => (temperature.value = value)}
          />
          <Field
            label="Top P"
            value={topP}
            placeholder="1"
            help="Greater than 0, at most 1."
            onInput={(value) => (topP.value = value)}
          />
        </div>
        <Field
          label="Stop sequences"
          multiline={true}
          rows={3}
          value={stop}
          placeholder="One sequence per line, up to 16."
          help="One per line."
          onInput={(value) => (stop.value = value)}
        />
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

      .field-note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .media-grid,
      .settings-grid {
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
    </style>
  </form>
}

export default PresetForm;
