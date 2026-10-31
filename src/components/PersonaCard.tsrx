import { Button } from "./Button.tsrx";
import { Avatar } from "./Avatar.tsrx";
import { href } from "../router.ts";
import type { Persona } from "../lib/data/types.ts";

/**
 * The persona card — the collection's card, and **not** `Card`.
 *
 * `persona/collection.md` gives a card exactly three things: *the avatar, the name, and the tagline,
 * and the one holding the default says so on the card. No author, no ratio, no comment count: a
 * persona has one possible owner and no engagement.* `Card` is the public catalogue card and ends
 * with a footer carrying precisely the two things this card must never draw — `@author` and the
 * derived ratio — and its `item` prop is the `AuthoredItem` union, which a persona is deliberately
 * not a member of. So this is its own card (recorded in `docs/DESIGN.md` → *Persona collection and
 * detail (T-20)*), sharing the box styles (`.persona-card` in `src/styles.css`) and nothing else.
 *
 * The box lives in the stylesheet, not a scoped `<style>`, for the reason T-19 found: a component's
 * **root** element carries no `tsrx-*` scope class, so a rule written on it here would be dropped.
 *
 * **The default mark is a line, above the name** (the baton's open decision, settled at 360 with two
 * personas, one default): a 2px `--color-accent` rule across the card's top edge plus the word
 * `default` in the same accent. A corner badge would fight the name's ellipsis at 360 and the avatar
 * column at `md`; a line cannot collide with either, and it survives a long name.
 *
 * **`Set as default` is on the card** because `collection.md` → *Actions* lists it there, and it is
 * drawn **disabled** (label *Default persona*) when this persona already holds the mark: the write is
 * idempotent, so a live button would be a no-op dressed as an action.
 */
export function PersonaCard({
  persona,
  onSetDefault,
}: {
  persona: Persona;
  onSetDefault?: (id: string) => void;
}) {
  const path = `/persona/${persona.id}`;

  return (
    <article class={persona.isDefault ? "persona-card is-default" : "persona-card"}>
      @if (persona.isDefault) {
        <p class="persona-card-mark">default</p>
      }

      <div class="persona-card-body">
        <Avatar initials={persona.avatar.initials} size={56} />
        <div class="persona-card-text">
          <a class="persona-card-name" href={href(path)}>{persona.name}</a>
          @if (persona.tagline) {
            <p class="persona-card-tagline">{persona.tagline}</p>
          }
        </div>
      </div>

      <div class="persona-card-foot">
        <Button
          variant="secondary"
          disabled={persona.isDefault}
          onClick={() => onSetDefault?.(persona.id)}
        >
          {persona.isDefault ? "Default persona" : "Set as default"}
        </Button>
        <a class="persona-card-open" href={href(path)}>Open</a>
      </div>
    </article>
  );
}

export default PersonaCard;
