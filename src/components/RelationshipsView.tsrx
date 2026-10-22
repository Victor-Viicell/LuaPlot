import { initials, relationshipTone } from "../game/format";
import { GameContext } from "../game/store";

export function RelationshipsView() @{
  const game = GameContext.get();

  <>
    <div class="relationships">
      <div class="relationships-toolbar">
        <p class="relationships-note">
          Everyone in this city wants something. Keep the useful ones close.
        </p>
        <button class="meet-button" onClick={() => game.meetNpc()}>
          MEET SOMEONE <span class="meet-cost">4H · −20 EN</span>
        </button>
      </div>

      <div class="npc-list">
        @for (const npc of game.npcs) {
          <article class="npc-card">
            <div class="npc-head">
              <span class="npc-avatar">{initials(npc.name)}</span>
              <div class="npc-identity">
                <h3>{npc.name}</h3>
                <p>
                  {npc.role} · {npc.district} · {npc.trait}
                </p>
              </div>
              <span class={"npc-score " + relationshipTone(npc.relationship)}>
                {npc.relationship}%
              </span>
            </div>

            <div class="npc-meter">
              <span
                class="npc-meter-fill"
                style={{ width: npc.relationship + "%" }}
              ></span>
            </div>

            <p class="npc-line">“{npc.lastLine}”</p>

            <div class="npc-actions">
              <button
                class="npc-action"
                onClick={() => game.interactNpc(npc, "message")}
              >
                MESSAGE
                <span>15M</span>
              </button>
              <button
                class="npc-action"
                onClick={() => game.interactNpc(npc, "hangout")}
              >
                HANG OUT <span>3H · ¥80</span>
              </button>
              <button
                class="npc-action"
                onClick={() => game.interactNpc(npc, "gift")}
              >
                GIFT <span>1H · ¥300</span>
              </button>
              <button
                class="npc-action"
                disabled={npc.relationship < 40}
                title={
                  npc.relationship < 40
                    ? "Needs 40% relationship"
                    : "Ask them out"
                }
                onClick={() => game.interactNpc(npc, "date")}
              >
                DATE <span>4H · ¥150</span>
              </button>
            </div>
          </article>
        }
        @if (game.npcs.length === 0) {
          <p class="npc-empty">
            No contacts yet. Stay in the city long enough and someone will find
            you.
          </p>
        }
      </div>
    </div>

    <style>
      .relationships {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .relationships-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-bg-elevated);
      }

      .relationships-note {
        margin: 0;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .meet-button {
        flex-shrink: 0;
        padding: 8px 12px;
        border: 1px solid var(--ctp-red);
        border-radius: 6px;
        background-color: transparent;
        color: var(--ctp-red);
        font-size: 9px;
        letter-spacing: 0.12em;
        cursor: pointer;
      }

      .meet-button:hover {
        background-color: var(--ctp-red);
        color: var(--ctp-crust);
      }

      .meet-cost {
        opacity: 0.7;
        margin-left: 4px;
      }

      .npc-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 10px;
      }

      .npc-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-surface);
      }

      .npc-head {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .npc-avatar {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        flex-shrink: 0;
        border: 1px solid var(--color-border-strong);
        border-radius: 6px;
        background-color: var(--color-bg-sunken);
        color: var(--ctp-pink);
        font-size: 11px;
      }

      .npc-identity {
        flex: 1;
        min-width: 0;
      }

      .npc-identity h3 {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
        color: var(--color-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .npc-identity p {
        margin: 2px 0 0;
        font-size: 9px;
        color: var(--color-text-subtle);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .npc-score {
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-muted);
      }

      .npc-score.cold {
        color: var(--ctp-red);
      }

      .npc-score.acquainted {
        color: var(--ctp-yellow);
      }

      .npc-score.friendly {
        color: var(--ctp-sky);
      }

      .npc-score.close,
      .npc-score.ride-or-die {
        color: var(--ctp-green);
      }

      .npc-meter {
        height: 3px;
        border-radius: 999px;
        background-color: var(--color-bg-sunken);
        overflow: hidden;
      }

      .npc-meter-fill {
        display: block;
        height: 100%;
        background-color: var(--ctp-pink);
      }

      .npc-line {
        margin: 0;
        font-size: 10px;
        font-style: italic;
        line-height: 1.5;
        color: var(--color-text-muted);
        min-height: 30px;
      }

      .npc-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 5px;
      }

      .npc-action {
        min-width: 0;
        padding: 6px 8px;
        border: 1px solid var(--color-border);
        border-radius: 5px;
        background-color: var(--color-bg-sunken);
        color: var(--color-text-muted);
        font-size: 8px;
        letter-spacing: 0.08em;
        cursor: pointer;
      }

      .npc-action:hover:not(:disabled) {
        border-color: var(--ctp-pink);
        color: var(--ctp-pink);
      }

      .npc-action span {
        opacity: 0.6;
        margin-left: 2px;
      }

      .npc-empty {
        grid-column: 1 / -1;
        margin: 0;
        padding: 24px;
        border: 1px dashed var(--color-border-strong);
        border-radius: 8px;
        font-size: 11px;
        color: var(--color-text-subtle);
        text-align: center;
      }
    </style>
  </>
}
