import { ActionList } from "./ActionList.tsrx";
import { ConsumablesView } from "./ConsumablesView.tsrx";

export function HealthView() @{
  <>
    <div class="health-view">
      <section class="body-note">
        <span class="body-note-kicker">BODY // SYSTEMIC</span>
        <p>
          Health currently covers the whole body. Targeted body-part and organ
          damage is the next layer; clinics and chems will treat specific
          systems instead of one bar.
        </p>
      </section>

      <ConsumablesView />

      <section class="health-clinic">
        <h2 class="health-section-title">CLINIC WORK</h2>
        <ActionList hereOnly={false} />
      </section>
    </div>

    <style>
      .health-view {
        display: flex;
        flex-direction: column;
        gap: 18px;
        width: 100%;
      }

      .body-note {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 14px;
        border: 1px solid rgba(166, 227, 161, 0.3);
        border-radius: 8px;
        background-color: var(--color-bg-elevated);
      }

      .body-note-kicker {
        font-size: 8px;
        letter-spacing: 0.16em;
        color: var(--ctp-green);
      }

      .body-note p {
        margin: 0;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .health-clinic {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .health-section-title {
        margin: 0;
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.16em;
        color: var(--color-text-subtle);
      }
    </style>
  </>
}
