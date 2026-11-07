import { track } from "ripple";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { Select } from "./Select.tsrx";
import { Sheet } from "./Sheet.tsrx";
import { Toggle } from "./Toggle.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import type { Lorebook } from "../lib/data/types.ts";
import {
  ENTRY_CONTENT_REQUIRED,
  ENTRY_KEYWORD_REQUIRED,
  VISIBILITY_OPTIONS,
  lorebookWriteSchema,
  splitKeywords,
  type Visibility,
} from "../lib/schema.ts";

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
 * The entry block follows `formstype.ts` → `LorebookEntryWrite`: keywords, secondary keywords,
 * content, then the firing switches and counters (enabled, insertion order, case sensitivity,
 * priority, selective logic, constant, probability).
 *
 * What it deliberately does not do: it never splits, trims or numbers anything. Keywords are
 * normalised by the schema, and the entry ids are the adapter's (`numberEntries`), so the form
 * cannot invent a label that collides with another.
 */

/** One block in the editor. `key` is the render key only — it never reaches the write. */
type EntryBlock = {
  key: number;
  /** The name the list shows; empty falls back to the first keyword. */
  title: string;
  keywords: string;
  secondaryKeywords: string;
  content: string;
  enabled: boolean;
  insertionOrder: number;
  caseSensitive: boolean;
  priority: number;
  selective: boolean;
  selectiveLogic: "AND" | "NOT";
  constant: boolean;
  probability: number;
};

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
  const initials = track(lorebook?.avatar.initials ?? "");
  const tagline = track(lorebook?.tagline ?? "");
  const creatorNotes = track(lorebook?.creatorNotes ?? "");
  const visibility = track<Visibility>(
    lorebook?.visibility ??
      (lorebook?.isPublic === false ? "private" : "public"),
  );
  const nsfw = track(lorebook?.nsfw ?? false);
  const anonymous = track(lorebook?.anonymous ?? false);
  const tags = track((lorebook?.tags ?? []).join(", "));

  /** The preloaded blocks, built once: a `track(() => …)` initialiser would make the list read-only. */
  const initialEntries: EntryBlock[] = (lorebook?.entries ?? []).map(
    (entry) => {
      nextKey += 1;
      return {
        key: nextKey,
        title: entry.title ?? "",
        keywords: entry.keywords.join(", "),
        secondaryKeywords: (entry.secondaryKeywords ?? []).join(", "),
        content: entry.content,
        enabled: entry.enabled ?? true,
        insertionOrder: entry.insertionOrder ?? 100,
        caseSensitive: entry.caseSensitive ?? false,
        priority: entry.priority ?? 10,
        selective: entry.selective ?? false,
        selectiveLogic: entry.selectiveLogic ?? "AND",
        constant: entry.constant ?? false,
        probability: entry.probability ?? 100,
      };
    },
  );
  const entries = track<EntryBlock[]>(initialEntries);

  /** One message per block, keyed by the block's key — set from the schema's issue paths. */
  const rowErrors = track<Record<number, string>>({});
  const formError = track("");
  const saving = track(false);

  const denySave = track(() => saving.value || name.value.trim().length === 0);
  const entryCount = track(() => entries.value.length);

  /**
   * The entry editor is a **dialog**, not an inline block (owner's call): the list shows names only,
   * so a lorebook with thirty entries is a list of thirty lines rather than thirty open forms. The
   * open entry is copied into these drafts, edited there, and written back on Save — Cancel throws
   * the copy away, which an inline block could never do.
   */
  const editingKey = track<number | "">("");
  const draftTitle = track("");
  const draftKeywords = track("");
  const draftSecondary = track("");
  const draftContent = track("");
  const draftEnabled = track(true);
  const draftCaseSensitive = track(false);
  const draftSelective = track(false);
  const draftConstant = track(false);
  const draftLogic = track<"AND" | "NOT">("AND");
  const draftOrder = track("100");
  const draftPriority = track("10");
  const draftProbability = track("100");
  const draftError = track("");

  /** What the list calls an entry: its name, else its first keyword, else a placeholder. */
  function nameOf(row: EntryBlock): string {
    const title = row.title.trim();
    if (title !== "") return title;
    const first = row.keywords.split(",")[0]?.trim() ?? "";
    return first !== "" ? first : "Untitled entry";
  }

  function openEntry(key: number): void {
    const row = entries.value.find((each) => each.key === key);
    if (!row) return;
    draftTitle.value = row.title;
    draftKeywords.value = row.keywords;
    draftSecondary.value = row.secondaryKeywords;
    draftContent.value = row.content;
    draftEnabled.value = row.enabled;
    draftCaseSensitive.value = row.caseSensitive;
    draftSelective.value = row.selective;
    draftConstant.value = row.constant;
    draftLogic.value = row.selectiveLogic;
    draftOrder.value = String(row.insertionOrder);
    draftPriority.value = String(row.priority);
    draftProbability.value = String(row.probability);
    draftError.value = rowErrors.value[key] ?? "";
    editingKey.value = key;
  }

  function closeEntry(): void {
    editingKey.value = "";
    draftError.value = "";
  }

  /** Write the draft back. Keywords and content are the two things an entry cannot do without. */
  function saveEntry(): void {
    const key = editingKey.value;
    if (key === "") return;

    if (splitKeywords(draftKeywords.value).length === 0) {
      draftError.value = ENTRY_KEYWORD_REQUIRED;
      return;
    }
    if (draftContent.value.trim() === "") {
      draftError.value = ENTRY_CONTENT_REQUIRED;
      return;
    }

    entries.value = entries.value.map((row) =>
      row.key === key
        ? {
            ...row,
            title: draftTitle.value,
            keywords: draftKeywords.value,
            secondaryKeywords: draftSecondary.value,
            content: draftContent.value,
            enabled: draftEnabled.value,
            caseSensitive: draftCaseSensitive.value,
            selective: draftSelective.value,
            constant: draftConstant.value,
            selectiveLogic: draftLogic.value,
            insertionOrder: Number(draftOrder.value) || 0,
            priority: Number(draftPriority.value) || 0,
            probability: Math.max(0, Math.min(100, Number(draftProbability.value) || 0)),
          }
        : row,
    );

    const next = { ...rowErrors.value };
    delete next[key];
    rowErrors.value = next;
    closeEntry();
  }

  function addEntry(): void {
    nextKey += 1;
    entries.value = [
      ...entries.value,
      {
        key: nextKey,
        title: "",
        keywords: "",
        secondaryKeywords: "",
        content: "",
        enabled: true,
        insertionOrder: 100,
        caseSensitive: false,
        priority: 10,
        selective: false,
        selectiveLogic: "AND",
        constant: false,
        probability: 100,
      },
    ];
    formError.value = "";
    // A new entry is empty: open it straight away so the author names it and writes it instead of
    // hunting for the row that just appeared at the bottom of the list.
    openEntry(nextKey);
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

  async function save(): Promise<void> {
    if (saving.value) return;

    const parsed = lorebookWriteSchema.safeParse({
      name: name.value,
      avatar: { initials: initials.value },
      tagline: tagline.value,
      creatorNotes: creatorNotes.value,
      visibility: visibility.value,
      nsfw: nsfw.value,
      anonymous: anonymous.value,
      tags: tags.value,
      entries: entries.value.map((row) => ({
        title: row.title,
        keywords: row.keywords,
        secondaryKeywords: row.secondaryKeywords,
        content: row.content,
        enabled: row.enabled,
        insertionOrder: row.insertionOrder,
        caseSensitive: row.caseSensitive,
        priority: row.priority,
        selective: row.selective,
        selectiveLogic: row.selectiveLogic,
        constant: row.constant,
        probability: row.probability,
      })),
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
      const badKeys = Object.keys(perRow).map(Number);
      // An entry's message lives in its dialog now, so a closed dialog would swallow the refusal and
      // the form would look dead. Say it on the form *and* open the first offending entry.
      formError.value =
        badKeys.length > 0
          ? "One entry needs attention — it is open for you."
          : first || "That lorebook couldn't be saved.";
      entries.value = [...entries.value];
      if (badKeys.length > 0 && editingKey.value !== badKeys[0]) openEntry(badKeys[0]);
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
    {/* The root element carries no scope class in Ripple 0.4.7, so a rule on `.lorebook-form` is
        dropped and the form never becomes a grid (found in T-19). The layout lives on this child. */}
    <div class="layout">
      <section class="section is-identity">
        <p class="section-label">Identity</p>
        <Field
          label="Name"
          value={name}
          maxLength={80}
          placeholder="The Hollow Court"
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
          placeholder="HC"
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
          placeholder="Records kept below the tideline, in salt and wax."
          onInput={(value) => {
            tagline.value = value;
            formError.value = "";
          }}
        />
      </section>

      <section class="section is-media">
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
        <Field
          label="Tags"
          value={tags}
          placeholder="harbor, debt"
          help="Comma-separated."
          onInput={(value) => {
            tags.value = value;
            formError.value = "";
          }}
        />
      </section>

      <section class="section is-entries">
        <div class="entries-head">
          <p class="section-label">Entries</p>
          <p class="entries-count">
            {entryCount.value === 1 ? "1 entry" : `${entryCount.value} entries`}
          </p>
        </div>

        @if (entries.value.length === 0) {
          <p class="empty-note">
            No entries yet. A lorebook can be saved with none.
          </p>
        } @else {
          <ul class="entry-list">
            @for (const row of entries.value; key row.key) {
              <li class="entry">
                <p class="entry-name">{nameOf(row)}</p>

                <div class="entry-actions">
                  <Button variant="secondary" onClick={() => openEntry(row.key)}>
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={entries.value.findIndex((each) => each.key === row.key) === 0}
                    onClick={() =>
                      moveEntry(
                        entries.value.findIndex((each) => each.key === row.key),
                        -1,
                      )
                    }
                  >
                    Up
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={
                      entries.value.findIndex((each) => each.key === row.key) ===
                      entries.value.length - 1
                    }
                    onClick={() =>
                      moveEntry(
                        entries.value.findIndex((each) => each.key === row.key),
                        1,
                      )
                    }
                  >
                    Down
                  </Button>
                </div>
              </li>
            }
          </ul>
        }

        <div class="add-row">
          <Button variant="secondary" block onClick={addEntry}>
            Add entry
          </Button>
        </div>
      </section>

      @if (editingKey.value !== "") {
        <Sheet title="Entry" onClose={closeEntry} full={true}>
          <Field
            label="Name"
            value={draftTitle}
            placeholder="The line this entry is listed by"
            onInput={(value) => {
              draftTitle.value = value;
              draftError.value = "";
            }}
          />

          <Field
            label="Keywords"
            value={draftKeywords}
            placeholder="king, court, throne"
            help="Comma-separated."
            error={draftError}
            onInput={(value) => {
              draftKeywords.value = value;
              draftError.value = "";
            }}
          />

          <Field
            label="Secondary keywords"
            value={draftSecondary}
            placeholder="oath, crown"
            help="Comma-separated. Used when selective matching is on."
            onInput={(value) => {
              draftSecondary.value = value;
              draftError.value = "";
            }}
          />

          <Field
            label="Content"
            multiline={true}
            rows={6}
            value={draftContent}
            placeholder="What is injected into the session when an entry matches."
            onInput={(value) => {
              draftContent.value = value;
              draftError.value = "";
            }}
          />

          <div class="entry-switches">
            <Toggle label="Enabled" pressed={draftEnabled} onToggle={(next) => (draftEnabled.value = next)} />
            <Toggle
              label="Case sensitive"
              pressed={draftCaseSensitive}
              onToggle={(next) => (draftCaseSensitive.value = next)}
            />
            <Toggle label="Selective" pressed={draftSelective} onToggle={(next) => (draftSelective.value = next)} />
            <Toggle label="Constant" pressed={draftConstant} onToggle={(next) => (draftConstant.value = next)} />
          </div>

          <div class="entry-grid">
            <Field
              label="Insertion order"
              type="text"
              value={draftOrder}
              onInput={(value) => (draftOrder.value = value)}
            />
            <Field
              label="Priority"
              type="text"
              value={draftPriority}
              onInput={(value) => (draftPriority.value = value)}
            />
            <Field
              label="Probability (%)"
              type="text"
              value={draftProbability}
              onInput={(value) => (draftProbability.value = value)}
            />
            <Select
              label="Selective logic"
              value={draftLogic}
              options={[
                { value: "AND", label: "AND" },
                { value: "NOT", label: "NOT" },
              ]}
              onChange={(next) => (draftLogic.value = next === "NOT" ? "NOT" : "AND")}
            />
          </div>

          @if (draftError.value !== "") {
            <p class="row-error" role="alert">{draftError.value}</p>
          }

          <div class="entry-dialog-actions">
            <Button
              variant="secondary"
              onClick={() => {
                if (editingKey.value === "") return;
                removeEntry(editingKey.value);
                closeEntry();
              }}
            >
              Remove entry
            </Button>
            <Button variant="secondary" onClick={closeEntry}>Cancel</Button>
            <Button variant="primary" onClick={saveEntry}>Save entry</Button>
          </div>
        </Sheet>
      }

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

      .entries-head {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      .entries-count {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.4;
      }

      .media-grid,
      .toggles {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .entry-switches,
      .entry-grid {
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

      /* One entry, one line: the name across the row, then Edit · Up · Down spread evenly over the
         full width. Everything else about the entry lives behind **Edit**. */
      .entry {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px 0;
        border-bottom: 1px solid var(--color-border);
      }

      .entry-name {
        margin: 0;
        overflow: hidden;
        color: var(--color-text);
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .entry-actions,
      .entry-dialog-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
      }

      .entry-dialog-actions {
        padding-top: 4px;
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
    </style>
  </form>
}

export default LorebookForm;
