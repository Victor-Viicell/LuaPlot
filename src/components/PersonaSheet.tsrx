import { track } from "ripple";
import { Avatar } from "./Avatar.tsrx";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { Sheet } from "./Sheet.tsrx";
import { Skeleton } from "./Skeleton.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import { personaWriteSchema } from "../lib/schema.ts";
import { toast } from "../lib/toast.ts";
import type { Persona } from "../lib/data/types.ts";

/**
 * PersonaSheet — personas as a **component**, not a route.
 *
 * The owner's call: listing and editing personas is something the app does in place, from wherever a
 * persona matters, so it is one floating dialog (full screen on a phone, a centred dialog from `md`)
 * and not a page you navigate away from and back to. It is mounted from the session's header and
 * from the profile's owner actions; `/persona/*` still exists for the deep link, and it draws the
 * same rows rather than a second editor.
 *
 * What it owns:
 * - **The list**, the current default marked (`Default`), each row carrying **Edit**.
 * - **The editor**, in place: name, tagline, description, initials — the same fields the create page
 *   had, gated by `personaWriteSchema`, so the dialog cannot write what the adapter would refuse.
 * - **Delete**, behind a confirm step, because a persona is personal and losing one is silent
 *   otherwise.
 * - **`onPick`** — when a caller needs a choice (the session's *Switch persona*), a row selects
 *   instead of only opening. Without it the sheet is pure management.
 */
export function PersonaSheet({
  onClose,
  onPick,
  picked = "",
}: {
  onClose: () => void;
  /** Selection mode: the row chooses this persona for the caller. */
  onPick?: (id: string | null) => void;
  /** The persona already in use, marked and not offered twice. */
  picked?: string;
}) @{
  const repo = resolveRepo();

  const phase = track<"loading" | "ready" | "error">("loading");
  const rows = track<Persona[]>([]);

  /** `""` = the list, `"new"` = a blank editor, otherwise the id being edited. */
  const editing = track("");
  const name = track("");
  const inSessionName = track("");
  const tagline = track("");
  const description = track("");
  const initials = track("");
  const lorebookIds = track<string[]>([]);
  const error = track("");
  const busy = track(false);
  const confirmingDelete = track(false);

  const isEditor = track(() => editing.value !== "");
  const editorTitle = track(() =>
    editing.value === "new" ? "New persona" : "Edit persona",
  );
  const canSave = track(() => !busy.value && name.value.trim().length > 0);

  function load(): void {
    phase.value = "loading";
    repo.listPersonas({ page: 1 }).then(
      (listing) => {
        rows.value = listing.items;
        phase.value = "ready";
      },
      () => {
        phase.value = "error";
      },
    );
  }

  load();

  function reset(): void {
    name.value = "";
    inSessionName.value = "";
    tagline.value = "";
    description.value = "";
    initials.value = "";
    lorebookIds.value = [];
    error.value = "";
    confirmingDelete.value = false;
  }

  function startNew(): void {
    reset();
    editing.value = "new";
  }

  function startEdit(persona: Persona): void {
    reset();
    editing.value = persona.id;
    name.value = persona.name;
    inSessionName.value = persona.inSessionName ?? "";
    tagline.value = persona.tagline;
    description.value = persona.description;
    initials.value = persona.avatar.initials;
    lorebookIds.value = [...(persona.lorebookIds ?? [])];
  }

  function backToList(): void {
    reset();
    editing.value = "";
  }

  async function save(): Promise<void> {
    if (busy.value) return;

    const parsed = personaWriteSchema.safeParse({
      name: name.value,
      inSessionName: inSessionName.value,
      tagline: tagline.value,
      description: description.value,
      avatar: { initials: initials.value },
      lorebookIds: lorebookIds.value,
    });

    if (!parsed.success) {
      error.value =
        parsed.error.issues[0]?.message ?? "That persona couldn't be saved.";
      return;
    }

    busy.value = true;
    const saved =
      editing.value === "new"
        ? await repo.addPersona(parsed.data).catch(() => null)
        : await repo
            .updatePersona(editing.value, parsed.data)
            .catch(() => null);
    busy.value = false;

    if (!saved) {
      error.value = "That persona couldn't be saved.";
      return;
    }

    toast(editing.value === "new" ? "Persona created." : "Persona saved.");
    backToList();
    load();
  }

  async function remove(): Promise<void> {
    if (busy.value || editing.value === "" || editing.value === "new") return;

    busy.value = true;
    const gone = await repo.deletePersona(editing.value).catch(() => false);
    busy.value = false;

    if (!gone) {
      error.value = "That persona couldn't be deleted.";
      return;
    }

    toast("Persona deleted.");
    backToList();
    load();
  }

  <>
    <Sheet title="Personas" onClose={onClose} full={true}>
      @if (isEditor.value) {
        <>
          <p class="psub">{editorTitle.value}</p>

          <Field
            label="Name"
            value={name}
            placeholder="What this side of the conversation is called"
            error={error}
            onInput={(value) => {
              name.value = value;
              error.value = "";
            }}
          />

          <Field
            label="Tagline"
            value={tagline}
            placeholder="One line, shown on the card"
            onInput={(value) => {
              tagline.value = value;
              error.value = "";
            }}
          />

          <Field
            label="Description"
            multiline={true}
            rows={4}
            value={description}
            onInput={(value) => {
              description.value = value;
              error.value = "";
            }}
          />

          <Field
            label="Initials"
            value={initials}
            maxLength={2}
            placeholder="Two letters"
            onInput={(value) => {
              initials.value = value;
              error.value = "";
            }}
          />

          @if (confirmingDelete.value) {
            <p class="pnote">
              Delete this persona? Sessions using it keep their own name for
              your side.
            </p>
          }

          <div class="pacts">
            @if (editing.value !== "new") {
              @if (confirmingDelete.value) {
                <Button variant="danger" disabled={busy} onClick={remove}>
                  {busy.value ? "Deleting…" : "Delete persona"}
                </Button>
              } @else {
                <Button
                  variant="secondary"
                  onClick={() => (confirmingDelete.value = true)}
                >
                  Delete
                </Button>
              }
            }
            <Button variant="secondary" onClick={backToList}>
              Back
            </Button>
            <Button variant="primary" disabled={!canSave.value} onClick={save}>
              {busy.value ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      } @else {
        <>
          @if (phase.value === "loading") {
            <div
              class="pslab"
              aria-busy="true"
              aria-label="Loading your personas"
            >
              <Skeleton lines={3} />
            </div>
          } @else if (phase.value === "error") {
            <div class="perror" role="alert">
              <p>Your personas could not be loaded.</p>
              <Button variant="secondary" onClick={load}>
                Retry
              </Button>
            </div>
          } @else {
            <>
              @if (rows.value.length === 0) {
                <p class="pnote">No personas yet.</p>
              } @else {
                <ul class="plist">
                  @for (const persona of rows.value; key persona.id) {
                    <li class="prow">
                      <Avatar
                        initials={persona.avatar.initials}
                        size={40}
                        label={`${persona.name} avatar`}
                      />
                      <div class="pwho">
                        <span class="pname">
                          {persona.name}
                          @if (persona.isDefault) {
                            <span class="pmark">Default</span>
                          }
                          @if (picked !== "" && picked === persona.id) {
                            <span class="pmark is-on">In use</span>
                          }
                        </span>
                        @if (persona.tagline) {
                          <span class="pmeta">{persona.tagline}</span>
                        }
                      </div>
                      <div class="prow-actions">
                        @if (onPick) {
                          <button
                            class="puse"
                            type="button"
                            onClick={() => onPick(persona.id)}
                          >
                            Use
                          </button>
                        }
                        <button
                          class="pedit"
                          type="button"
                          onClick={() => startEdit(persona)}
                        >
                          Edit
                        </button>
                      </div>
                    </li>
                  }
                </ul>
              }

              @if (onPick) {
                <button
                  class="pnone"
                  type="button"
                  onClick={() => onPick(null)}
                >
                  No persona — your side reads User
                </button>
              }

              <div class="pacts">
                <Button variant="primary" onClick={startNew}>
                  New persona
                </Button>
              </div>
            </>
          }
        </>
      }
    </Sheet>

    <style>
      .psub {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .plist {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .prow {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--color-border);
      }

      .pwho {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .pname {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--color-text);
        font-size: 14px;
        font-weight: 600;
      }

      .pmark {
        padding: 1px 6px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        color: var(--color-text-subtle);
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .pmark.is-on {
        border-color: var(--color-accent);
        color: var(--color-accent-text);
      }

      .pmeta {
        overflow: hidden;
        color: var(--color-text-subtle);
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .prow-actions {
        display: flex;
        flex: none;
        align-items: center;
        gap: 4px;
      }

      .puse,
      .pedit,
      .pnone {
        min-height: 44px;
        padding: 0 10px;
        border: 0;
        background: none;
        color: var(--color-text-muted);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }

      .puse {
        color: var(--color-accent-text);
        font-weight: 600;
      }

      .pedit:hover,
      .pnone:hover {
        color: var(--color-text);
      }

      .pnone {
        align-self: flex-start;
        padding: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .pacts {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }

      .pnote {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.6;
      }

      .perror {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        color: var(--color-danger);
        font-size: 14px;
      }

      .pslab {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
    </style>
  </>
}

export default PersonaSheet;
