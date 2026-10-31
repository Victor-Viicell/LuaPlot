import { track } from "ripple";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { Toggle } from "./Toggle.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Lorebook } from "../lib/data/types.ts";
import { lorebookWriteSchema } from "../lib/schema.ts";

/**
 * The lorebook form — one component, two hosts (`lorebook/create.md`, and `lorebook/edit.md`, which
 * is *the same form* preloaded). `lorebook: null` is create; a row is edit. The parse is
 * `lorebookWriteSchema` here **and** again in `repo.addLorebook` / `repo.updateLorebook`, so the
 * inline error, the submit gate and the stored row are one rule (`docs/ARCHITECTURE.md` →
 * Validation).
 *
 * Decisions recorded in `docs/DESIGN.md` → *Lorebook create and edit (T-18)*:
 * - **One comma-separated keywords field per entry**, not the tag chip list: an entry's keywords are
 *   a vocabulary of its own, not the item's tags, and at 360 a chip input inside a block inside a
 *   list is three nested controls deep.
 * - **Add entry appends below the list**, because the list reads in the author's order and a new
 *   block at the top would push the first entry down on every add.
 * - **A block never collapses in the form**: every field of every entry stays editable, but a block
 *   carries its own Up / Down / Remove on one 44px row, so reordering is two taps rather than a
 *   phone drag.
 *
 * What it deliberately does not do: it never splits, trims or numbers anything. Keywords and content
 * are normalised by the schema, and the entry ids are the adapter's (`numberEntries`), so the form
 * cannot invent a label that collides with another.
 */

/** One block in the editor. `key` is the render key only — it never reaches the write. */
type EntryBlock = { key: number; keywords: string; content: string };

let nextKey = 0;

export function LorebookForm({
  lorebook,
  onSaved,
  onCancel,
}: {
  lorebook: Lorebook | null;
  onSaved: (saved: Lorebook) => void;
  onCancel: () => void;
}) @{
  const repo = resolveRepo();
  const editing = lorebook !== null;

  const name = track(lorebook?.name ?? "");
  const description = track(lorebook?.description ?? "");
  const initials = track(lorebook?.avatar.initials ?? "");
  const nsfw = track(lorebook?.nsfw ?? false);

  /** The preloaded blocks, built once: a `track(() => …)` initialiser would make the list read-only. */
  const initialEntries: EntryBlock[] = (lorebook?.entries ?? []).map((entry) => {
    nextKey += 1;
    return { key: nextKey, keywords: entry.keywords.join(", "), content: entry.content };
  });
  const entries = track<EntryBlock[]>(initialEntries);

  /** One message per block, keyed by the block's key — set from the schema's issue paths. */
  const rowErrors = track<Record<number, string>>({});
  const formError = track("");
  const saving = track(false);

  const denySave = track(() => saving.value || name.value.trim().length === 0);
  const entryCount = track(() => entries.value.length);

  function addEntry(): void {
    nextKey += 1;
    entries.value = [...entries.value, { key: nextKey, keywords: "", content: "" }];
    formError.value = "";
  }

  function removeEntry(key: number): void {
    entries.value = entries.value.filter((row) => row.key !== key);
    formError.value = "";
  }

  /** Up is `-1`, down is `+1`. The list is the author's order and nothing else sorts it. */
  function moveEntry(index: number, step: -1 | 1): void {
    const to = index + step;
    if (to < 0 || to >= entries.value.length) return;
    const next = [...entries.value];
    const carried = next[index];
    next[index] = next[to];
    next[to] = carried;
    entries.value = next;
  }

  function patch(key: number, field: "keywords" | "content", value: string): void {
    entries.value = entries.value.map((row) =>
      row.key === key ? { ...row, [field]: value } : row,
    );
    if (rowErrors.value[key]) {
      const next = { ...rowErrors.value };
      delete next[key];
      rowErrors.value = next;
    }
    formError.value = "";
  }

  async function save(): Promise<void> {
    if (saving.value) return;

    const parsed = lorebookWriteSchema.safeParse({
      name: name.value,
      description: description.value,
      nsfw: nsfw.value,
      avatar: { initials: initials.value },
      entries: entries.value.map((row) => ({ keywords: row.keywords, content: row.content })),
    });

    if (!parsed.success) {
      // The schema names the block: `entries.2.keywords` becomes an error under that block, so the
      // form does not need a second opinion about which row is wrong.
      const perRow: Record<number, string> = {};
      let first = "";
      for (const issue of parsed.error.issues) {
        const index = issue.path[0] === "entries" ? issue.path[1] : undefined;
        if (typeof index === "number" && entries.value[index]) {
          const key = entries.value[index].key;
          perRow[key] ??= issue.message;
        } else {
          first ||= issue.message;
        }
      }
      rowErrors.value = perRow;
      formError.value = Object.keys(perRow).length > 0 ? "" : first || "That lorebook couldn't be saved.";
      // A block's error message is a prop of `Field`, so the block has to re-render for the line to
      // appear: reassigning the list is what tells the `@for` its rows changed.
      entries.value = [...entries.value];
      return;
    }

    rowErrors.value = {};
    formError.value = "";
    saving.value = true;
    const saved = lorebook
      ? await repo.updateLorebook(lorebook.id, parsed.data).catch(() => null)
      : await repo.addLorebook(parsed.data).catch(() => null);
    saving.value = false;

    if (!saved) {
      // The draft stays exactly as typed: the spec's *Save failed* state.
      formError.value = "That lorebook couldn't be saved. Try again.";
      return;
    }

    onSaved(saved);
  }

  <form
    class="lorebook-form"
    onSubmit={(event) => {
      event.preventDefault();
      save();
    }}
  >
    <section class="section is-identity">
      <p class="section-label">Identity</p>
      <Field
        label="Name"
        value={name}
        maxLength={80}
        placeholder="The Hollow Court"
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
        label="What this lorebook holds"
        multiline={true}
        rows={5}
        maxLength={4000}
        value={description}
        placeholder="The world it describes, and when it applies."
        help="Shown on the detail page above the entries. A lorebook has no tagline."
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
          placeholder="HC"
          help="Two letters drawn on the cover. There is no image uploader yet; empty uses the name's first letters."
          onInput={(value) => {
            initials.value = value;
            formError.value = "";
          }}
        />
        <Toggle
          label="NSFW"
          hint="Flags this lorebook for the blurred view"
          pressed={nsfw}
          onToggle={(next) => (nsfw.value = next)}
        />
      </div>
    </section>

    <section class="section is-entries">
      <div class="entries-head">
        <p class="section-label">Entries</p>
        <p class="entries-count">
          {entryCount.value === 1 ? "1 entry" : `${entryCount.value} entries`}
        </p>
      </div>
      <p class="section-note">
        Each entry is injected when one of its keywords comes up. Order is reading order only —
        matching never depends on it.
      </p>

      @if (entries.value.length === 0) {
        <p class="empty-note">No entries yet. A lorebook can be saved with none.</p>
      } @else {
        <ul class="entry-list">
          @for (const row of entries.value; key row.key) {
            <li class="entry">
              <div class="entry-head">
                <p class="entry-index">
                  {`Entry ${entries.value.findIndex((each) => each.key === row.key) + 1}`}
                </p>
                <div class="entry-controls">
                  <Button
                    variant="ghost"
                    label={`Move entry up`}
                    disabled={entries.value.findIndex((each) => each.key === row.key) === 0}
                    onClick={() => moveEntry(entries.value.findIndex((each) => each.key === row.key), -1)}
                  >
                    {`Up`}
                  </Button>
                  <Button
                    variant="ghost"
                    label={`Move entry down`}
                    disabled={entries.value.findIndex((each) => each.key === row.key) === entries.value.length - 1}
                    onClick={() => moveEntry(entries.value.findIndex((each) => each.key === row.key), 1)}
                  >
                    {`Down`}
                  </Button>
                  <Button variant="ghost" onClick={() => removeEntry(row.key)}>{`Remove`}</Button>
                </div>
              </div>

              <Field
                label="Keywords"
                value={row.keywords}
                placeholder="king, court, throne"
                help="Separated by commas. At least one."
                error={rowErrors.value[row.key] ?? ""}
                onInput={(value) => patch(row.key, "keywords", value)}
              />
              <Field
                label="Content"
                multiline={true}
                rows={4}
                value={row.content}
                placeholder="What is injected into the session when an entry matches."
                onInput={(value) => patch(row.key, "content", value)}
              />
              {/* The schema's sentence for this block. It is read here, in the template, so it
                  updates the moment `rowErrors` does — a `Field.error` prop would be evaluated once
                  and never refresh. */}
              @if (rowErrors.value[row.key]) {
                <p class="row-error" role="alert">{rowErrors.value[row.key]}</p>
              }
            </li>
          }
        </ul>
      }

      <div class="add-row">
        <Button variant="secondary" block onClick={addEntry}>Add entry</Button>
      </div>
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

    <style>
      .lorebook-form {
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

      .entries-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      .entries-count {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.4;
      }

      .media-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* One block, one rule: the entries are a list of records, not cards. */
      .entry-list {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--color-border);
        list-style: none;
      }

      .entry {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px 0 16px;
        border-bottom: 1px solid var(--color-border);
      }

      .entry-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .entry-index {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      /* Three 44px controls on one row at 360: 132px of 328 leaves the label breathing room. */
      .entry-controls {
        display: flex;
        gap: 2px;
      }

      .add-row {
        display: grid;
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

      .row-error {
        margin: 0;
        color: var(--color-danger);
        font-size: 12px;
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

        .add-row {
          display: flex;
        }
      }

      @media (min-width: 900px) {
        /* The entries are the form, so they take the wide column; identity and media sit beside. */
        .lorebook-form {
          grid-template-columns: minmax(0, 1fr) 320px;
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
          grid-row: 1 / span 2;
        }

        .section.is-entries {
          grid-column: 1 / span 2;
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

export default LorebookForm;
