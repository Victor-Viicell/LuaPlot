import { track } from "ripple";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { IconArrowDown, IconArrowUp, IconTrash } from "./Icons.tsrx";
import { Sheet } from "./Sheet.tsrx";
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

  /** The pick dialog: its search text and whether it is open. */
  const pickerOpen = track(false);
  const pickQuery = track("");
  const pickFiltered = track<Lorebook[]>(() => {
    const needle = pickQuery.value.trim().toLowerCase();
    return picker.value.filter(
      (book) =>
        needle === "" ||
        book.name.toLowerCase().includes(needle) ||
        (book.tagline ?? "").toLowerCase().includes(needle),
    );
  });

  /** The attached row whose removal is waiting for confirmation; empty when no dialog is open. */
  const confirmingRemove = track("");

  /** Per-row stamp: a move bumps it so the row remounts with fresh Up/Down state. */
  const stamps = track<Record<string, number>>({});

  const rows = track(() =>
    ids.value.map((id) => ({ id, stamp: stamps.value[id] ?? 0 })),
  );

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

  function attachBook(book: Lorebook): void {
    if (ids.value.includes(book.id)) return;
    ids.value = [...ids.value, book.id];
    formError.value = "";
    closePicker();
  }

  function openPicker(): void {
    pickQuery.value = "";
    pickerOpen.value = true;
  }

  function closePicker(): void {
    pickerOpen.value = false;
    pickQuery.value = "";
  }

  function detach(id: string): void {
    ids.value = ids.value.filter((row) => row !== id);
    confirmingRemove.value = "";
    formError.value = "";
  }

  /** Up is `-1`, down is `+1`. The list is the author's order and nothing else sorts it. */
  function moveAttached(index: number, step: -1 | 1): void {
    const to = index + step;
    if (index < 0 || to < 0 || to >= ids.value.length) return;
    const next = [...ids.value];
    const carried = next[index];
    next[index] = next[to];
    next[to] = carried;
    ids.value = next;
    const bump = { ...stamps.value };
    bump[carried] = (bump[carried] ?? 0) + 1;
    bump[next[index]] = (bump[next[index]] ?? 0) + 1;
    stamps.value = bump;
    formError.value = "";
  }

  /** What the confirmation dialog calls the row about to be removed. */
  function removeName(): string {
    return lorebookName(confirmingRemove.value);
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
            } @else if (picker.value.length > 0) {
              <Button variant="secondary" block onClick={openPicker}>
                Pick lorebook
              </Button>
            }
            @if (ids.value.length === 0) {
              <p class="empty-note">
                No lorebooks attached. A persona can be saved with none.
              </p>
            } @else {
              <ul class="attach-list">
                @for (const row of rows.value; key row.id + ":" + row.stamp) {
                  <li class="attach-row">
                    <span class="attach-name">{lorebookName(row.id)}</span>
                    <div class="attach-actions">
                      <Button
                        variant="secondary"
                        label="Remove {lorebookName(row.id)}"
                        onClick={() => (confirmingRemove.value = row.id)}
                      >
                        <IconTrash />
                      </Button>
                      <Button
                        variant="secondary"
                        label="Move up"
                        disabled={ids.value.findIndex((id) => id === row.id) === 0}
                        onClick={() =>
                          moveAttached(ids.value.findIndex((id) => id === row.id), -1)
                        }
                      >
                        <IconArrowUp />
                      </Button>
                      <Button
                        variant="secondary"
                        label="Move down"
                        disabled={
                          ids.value.findIndex((id) => id === row.id) ===
                          ids.value.length - 1
                        }
                        onClick={() =>
                          moveAttached(ids.value.findIndex((id) => id === row.id), 1)
                        }
                      >
                        <IconArrowDown />
                      </Button>
                    </div>
                  </li>
                }
              </ul>
            }
          </>
        }
      </section>

      @if (pickerOpen.value) {
        <Sheet title="Pick lorebook" onClose={closePicker}>
          <Field
            label="Search"
            type="search"
            value={pickQuery}
            placeholder="Search lorebooks"
            onInput={(value) => (pickQuery.value = value)}
          />

          @if (pickFiltered.value.length === 0) {
            <p class="empty-note">
              {picker.value.length === 0
                ? "You have no lorebooks to attach yet."
                : `No lorebook matches “${pickQuery.value.trim()}”.`}
            </p>
          } @else {
            <ul class="pick-list" aria-label="Lorebooks">
              @for (const book of pickFiltered.value; key book.id) {
                <li>
                  <button
                    class={
                      ids.value.includes(book.id) ? "pick-row is-attached" : "pick-row"
                    }
                    type="button"
                    disabled={ids.value.includes(book.id)}
                    onClick={() => attachBook(book)}
                  >
                    <span class="pick-name">{book.name}</span>
                    @if (book.tagline) {
                      <span class="pick-tagline">{book.tagline}</span>
                    }
                    @if (ids.value.includes(book.id)) {
                      <span class="pick-flag">Attached</span>
                    }
                  </button>
                </li>
              }
            </ul>
          }
        </Sheet>
      }

      @if (confirmingRemove.value !== "") {
        <Sheet
          title="Remove lorebook"
          onClose={() => (confirmingRemove.value = "")}
        >
          <p class="entry-delete-note">
            Remove “{removeName()}” from this persona? The change is kept when you save.
          </p>
          <div class="confirm-actions">
            <Button
              variant="secondary"
              onClick={() => (confirmingRemove.value = "")}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const id = confirmingRemove.value;
                if (id === "") return;
                detach(id);
              }}
            >
              Remove lorebook
            </Button>
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
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--color-border);
        list-style: none;
      }

      .attach-row {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        padding: 12px 0;
        border-bottom: 1px solid var(--color-border);
      }

      .attach-name {
        overflow: hidden;
        color: var(--color-text);
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .attach-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
      }

      .pick-list {
        display: flex;
        flex-direction: column;
        margin: 12px 0 0;
        padding: 0;
        border-top: 1px solid var(--color-border);
        list-style: none;
      }

      .pick-row {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        width: 100%;
        min-height: 44px;
        padding: 10px 0;
        border: 0;
        border-bottom: 1px solid var(--color-border);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .pick-row:hover:not(:disabled) {
        background-color: var(--color-surface);
      }

      .pick-row:disabled {
        cursor: default;
        opacity: 0.6;
      }

      .pick-name {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
      }

      .pick-tagline {
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.5;
      }

      .pick-flag {
        color: var(--color-text-subtle);
        font-size: 11px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .entry-delete-note {
        margin: 0 0 12px;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.6;
      }

      .confirm-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
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
