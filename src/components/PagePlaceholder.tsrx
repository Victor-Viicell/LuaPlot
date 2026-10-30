/**
 * Route placeholder. Every route in the table renders through the shell before its page
 * exists, so the smoke test can walk the tree and a deep link never dies on a blank screen.
 * Delete a page's use of this the moment the real page lands (tickets T-05 … T-28).
 */
export function PagePlaceholder({
  path,
  title,
  note,
}: {
  path: string;
  title: string;
  note: string;
}) @{
  <>
    <style>
      .ph {
        max-width: 68ch;
        animation: ph-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .ph-path {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-subtle);
      }

      .ph-title {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: -0.01em;
      }

      .ph-note {
        margin: 12px 0 0;
        font-size: 14px;
        line-height: 1.7;
        color: var(--color-text-muted);
      }

      .ph-rule {
        margin: 24px 0 12px;
        border: 0;
        border-top: 1px solid var(--color-border);
      }

      .ph-tag {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
        color: var(--color-text-subtle);
      }

      @media (min-width: 900px) {
        .ph-title {
          font-size: 34px;
        }

        .ph-note {
          font-size: 15px;
        }
      }

      @keyframes ph-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ph {
          animation: none;
        }
      }
    </style>
    <section class="ph" data-route={path}>
      <p class="ph-path">{path}</p>
      <h1 class="ph-title">{title}</h1>
      <p class="ph-note">{note}</p>
      <hr class="ph-rule" />
      <p class="ph-tag">Not built yet. This route resolves through the shell.</p>
    </section>
  </>
}
