export function LeftSidebar() @{
  <>
    <div class="left-sidebar">
      <div class="left-stage"></div>
    </div>

    <style>
      .left-sidebar {
        width: 400px;
        max-width: 400px;
        height: 100%;
        margin: 0;
        padding: 10px;
      }
      .left-stage {
        position: relative;
        display: flex;
        flex: 1;
        min-height: 0;
        height: 100%;
        width: 100%;
        border: 1px solid var(--color-border);
        border-radius: 9px;
        background-color: var(--color-bg-elevated);
        overflow: hidden;
      }
    </style>
  </>
}
