import { heatMeter, initials, relationshipTone } from "../game/format";
import { GameContext } from "../game/store";

const STREET_TIPS = [
  "Rent is due every year. Plan for it.",
  "A contact who never hears from you becomes a stranger.",
  "Chrome looks good until the bill for it comes due.",
  "Cheap stims borrow energy from a body that keeps receipts.",
  "Satiety drops with every hour. Carry food or pay clinic prices.",
  "Heat fades slowly. Bribes fade it faster.",
];

function heatAdvice(wanted: number): string {
  if (wanted >= 5) {
    return "Burn notice. The city wants you.";
  }
  if (wanted >= 3) {
    return "Hunted. Lay low or bribe someone.";
  }
  if (wanted >= 1) {
    return "A few eyes on you. Keep moving.";
  }
  return "Clean. Nobody is looking.";
}

export function RightSidebar() @{
  const game = GameContext.get();

  <>
    <div class="right-sidebar">
      <div class="inner-panel network">
        <header class="network-header">
          <h2 class="block-title">NETWORK</h2>
          <span class="network-count">{game.npcs.length} CONTACTS</span>
        </header>

        <div class="contacts">
          @for (const npc of game.npcs) {
            <button
              class="contact"
              title={npc.lastLine}
              onClick={() => game.setInterface("relationships")}
            >
              <span class="contact-avatar">{initials(npc.name)}</span>
              <span class="contact-body">
                <span class="contact-top">
                  <span class="contact-name">{npc.name}</span>
                  <span
                    class={
                      "contact-score " + relationshipTone(npc.relationship)
                    }
                  >
                    {npc.relationship}
                  </span>
                </span>
                <span class="contact-meta">
                  {npc.role} · {npc.district}
                </span>
                <span class="mini-meter">
                  <span
                    class="mini-meter-fill"
                    style={{ width: npc.relationship + "%" }}
                  ></span>
                </span>
              </span>
            </button>
          }
          @if (game.npcs.length === 0) {
            <p class="contacts-empty">
              No signal. Meet someone in the Social interface.
            </p>
          }
        </div>

        <section class="heat-block">
          <h2 class="block-title">HEAT</h2>
          <div class="heat-meter">{heatMeter(game.player.wanted)}</div>
          <p class="heat-advice">{heatAdvice(game.player.wanted)}</p>
        </section>

        <section class="tip-block">
          <h2 class="block-title">STREET WIRE</h2>
          <p class="street-tip">
            {STREET_TIPS[game.player.age % STREET_TIPS.length]}
          </p>
        </section>
      </div>
    </div>

    <style>
      .right-sidebar {
        width: 400px;
        max-width: 400px;
        height: 100%;
        margin: 0;
        padding: 10px;
      }

      .network {
        display: flex;
        flex-direction: column;
        gap: 14px;
        height: 100%;
        padding: 20px;
        border: 1px solid var(--color-border);
        border-radius: 10px;
        overflow: hidden;
      }

      .network-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--color-border);
      }

      .block-title {
        margin: 0;
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.18em;
        color: var(--color-text-subtle);
      }

      .network-count {
        font-size: 8px;
        letter-spacing: 0.1em;
        color: var(--color-text-subtle);
      }

      .contacts {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-right: 2px;
      }

      .contact {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px 10px;
        border: 1px solid transparent;
        border-radius: 7px;
        background-color: var(--color-surface);
        color: var(--color-text);
        text-align: left;
        cursor: pointer;
        transition:
          border-color 140ms ease,
          background-color 140ms ease;
      }

      .contact:hover {
        border-color: var(--color-border-strong);
        background-color: var(--color-surface-hover);
      }

      .contact-avatar {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        flex-shrink: 0;
        border: 1px solid var(--color-border-strong);
        border-radius: 6px;
        font-size: 10px;
        color: var(--ctp-pink);
        background-color: var(--color-bg-sunken);
      }

      .contact-body {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex: 1;
        min-width: 0;
      }

      .contact-top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }

      .contact-name {
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .contact-score {
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-subtle);
      }

      .contact-score.cold {
        color: var(--ctp-red);
      }

      .contact-score.acquainted {
        color: var(--ctp-yellow);
      }

      .contact-score.friendly {
        color: var(--ctp-sky);
      }

      .contact-score.close,
      .contact-score.ride-or-die {
        color: var(--ctp-green);
      }

      .contact-meta {
        font-size: 9px;
        color: var(--color-text-subtle);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mini-meter {
        display: block;
        height: 2px;
        border-radius: 999px;
        background-color: var(--color-bg-sunken);
        overflow: hidden;
      }

      .mini-meter-fill {
        display: block;
        height: 100%;
        background-color: var(--ctp-pink);
      }

      .contacts-empty {
        margin: 0;
        font-size: 10px;
        color: var(--color-text-subtle);
      }

      .heat-block,
      .tip-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 14px;
        border-top: 1px solid var(--color-border);
      }

      .heat-meter {
        font-size: 16px;
        letter-spacing: 0.2em;
        color: var(--ctp-red);
      }

      .heat-advice,
      .street-tip {
        margin: 0;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .street-tip {
        color: var(--ctp-yellow);
      }
    </style>
  </>
}
