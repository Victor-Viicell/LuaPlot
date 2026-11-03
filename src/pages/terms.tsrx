import { effect } from "ripple";
import { currentUser } from "../lib/state/session.ts";
import { follow, href } from "../router.ts";
import { TERMS_RULES } from "../lib/schema.ts";

/**
 * `/terms` — the terms of use (`src/specs/pages/terms.md`), the last page of P2 and the only one
 * that is pure copy: no adapter call, no state, no tab. Read-only, no controls beyond links.
 *
 * Three things are load-bearing:
 * - **The copy is the product law, not a draft.** Every rule sentence in the spec survives here;
 *   the only edits are where a paragraph merges into a heading, and a heading shortens a sentence
 *   without changing it. This is the one page where a confident rewrite changes what is enforced.
 * - **The anchors are the schema's** (`TERMS_RULES`). A report reason has to point at the rule it
 *   enforces (`report.md` → *Purpose*), so the ids the page publishes and the links the report
 *   dialog prints come from one table and cannot drift.
 * - **No acceptance affordance.** `Accepting the terms` says finishing `/onboarding` is the
 *   acceptance and no record is kept; an "I accept" button here would invent the record the spec
 *   says does not exist. The only link out is to `/onboarding` and to account settings.
 *
 * Static is the only state: nothing is fetched, so there is no skeleton, no error and no empty
 * state. The decision (prose conventions, h2 for the notes, ids) is recorded in `docs/DESIGN.md`.
 */
export function Terms() @{
  /** The NSFW preference lives in account settings, whose route needs the viewer's own handle. */
  const me = currentUser();
  const settingsPath = me === null ? "" : `/user/${me.handle}/edit`;

  /**
   * The desktop contents rail is the page's own headings, in the page's order — the prohibitions
   * first (their titles come from `TERMS_RULES`, the same table the anchors do), then the notes.
   * Nothing else is listed: a terms page has no control, so nothing but a jump could go here.
   */
  const contents = [
    { id: TERMS_RULES.copied.anchor, label: TERMS_RULES.copied.title },
    { id: TERMS_RULES.unmarked.anchor, label: TERMS_RULES.unmarked.title },
    { id: TERMS_RULES.illegal.anchor, label: TERMS_RULES.illegal.title },
    { id: "where-the-line-sits", label: "Where the line sits" },
    { id: "what-the-rules-apply-to", label: "What the rules apply to" },
    { id: "what-the-flag-covers", label: "What the flag covers" },
    { id: "accepting-the-terms", label: "Accepting the terms" },
    { id: "how-enforcement-works", label: "How enforcement works" },
  ];

  /**
   * A hash in the URL means somebody linked to one rule — the report dialog does, and so does the
   * contents rail. The shell renders the page after the browser has given up on the fragment, so the
   * jump is made once the document exists; `scroll-margin-top` on the targets keeps the heading
   * clear of the sticky bar.
   */
  effect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (id === "") return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  });

  <>
    <style>
      /* Mobile and `sm`/`md`: one column of prose. At `lg` the dense reading column gets a contents
         rail on its left, so the desktop width is used for navigation instead of being a stretched
         phone — and the prose stays at its measure while the rules keep their hairlines. */
      .doc {
        display: flex;
        flex-direction: column;
        gap: 32px;
        padding-bottom: 8px;
      }

      .contents {
        display: none;
      }

      .body {
        display: flex;
        flex-direction: column;
        gap: 32px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        color: var(--color-text);
        font-size: 26px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      .lede {
        max-width: 52ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      /* The three prohibitions: one list, a hairline between items, the numeral hung in a gutter
         from `md` so the rules read as a numbered instrument and the notes below as prose. */
      .rules {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .rule {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
        padding: 18px 0;
        border-top: 1px solid var(--color-border);
        scroll-margin-top: calc(72px + env(safe-area-inset-top));
      }

      .rule-no {
        margin: 0;
        color: var(--color-accent-text);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        letter-spacing: 0.12em;
        line-height: 1.4;
      }

      .rule-title {
        margin: 0;
        color: var(--color-text);
        font-size: 18px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.3;
      }

      .rule-body {
        max-width: 68ch;
        margin: 0;
        color: var(--color-text);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      .rule-body + .rule-body {
        margin-top: 2px;
      }

      .notes {
        display: flex;
        flex-direction: column;
        gap: 28px;
      }

      .note {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-top: 20px;
        border-top: 1px solid var(--color-border);
        scroll-margin-top: calc(72px + env(safe-area-inset-top));
      }

      .note-title {
        margin: 0;
        color: var(--color-text);
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.35;
      }

      .note-body {
        max-width: 68ch;
        margin: 0;
        color: var(--color-text);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      /* A link inside a paragraph is a footnote, not a button: underlined, never accent-only. */
      .note-body a,
      .rule-body a {
        text-decoration: underline;
        text-decoration-color: var(--color-border-strong);
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
      }

      .note-body a:hover,
      .rule-body a:hover {
        text-decoration-color: currentColor;
      }

      @media (min-width: 640px) {
        .doc {
          gap: 40px;
        }

        .title {
          font-size: 34px;
        }

        .lede {
          font-size: 15px;
        }
      }

      @media (min-width: 900px) {
        .rule {
          grid-template-columns: 36px 1fr;
          column-gap: 16px;
        }

        .rule-no {
          grid-column: 1;
          grid-row: 1 / span 2;
          padding-top: 4px;
        }

        .rule-title,
        .rule-body {
          grid-column: 2;
        }

        .rule-body,
        .note-body {
          font-size: 15px;
        }
      }

      @media (min-width: 1200px) {
        .doc {
          display: grid;
          grid-template-columns: 200px minmax(0, 720px);
          column-gap: 56px;
          align-items: start;
        }

        .contents {
          position: sticky;
          top: calc(72px + env(safe-area-inset-top));
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 20px;
          border-right: 1px solid var(--color-border);
        }

        .contents-label {
          margin: 0;
          color: var(--color-text-subtle);
          font-size: 12px;
          letter-spacing: 0.12em;
          line-height: 1.4;
          text-transform: uppercase;
        }

        .contents-list {
          display: flex;
          flex-direction: column;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .contents-link {
          display: block;
          min-height: 32px;
          padding: 6px 0;
          color: var(--color-text-muted);
          font-size: 13px;
          line-height: 1.5;
          text-decoration: none;
        }

        .contents-link:hover {
          color: var(--color-text);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      }
    </style>

    <article class="doc">
      <nav class="contents" aria-label="On this page">
        <p class="contents-label">on this page</p>
        <ul class="contents-list">
          @for (const entry of contents; key entry.id) {
            <li>
              <a class="contents-link" href={href(`/terms#${entry.id}`)}>{entry.label}</a>
            </li>
          }
        </ul>
      </nav>

      <div class="body">
      <header class="head">
        <p class="kicker">content rules</p>
        <h1 class="title">Three prohibitions</h1>
        <p class="lede">
          The rules content has to follow. Deliberately short — three prohibitions, not a legal
          document. Every report reason maps back to one of them.
        </p>
      </header>

      <section aria-label="The rules">
        <ol class="rules">
          <li class="rule" id={TERMS_RULES.copied.anchor}>
            <p class="rule-no" aria-hidden="true">01</p>
            <h2 class="rule-title">{TERMS_RULES.copied.title}</h2>
            <p class="rule-body">Posting another user's content as your own.</p>
          </li>

          <li class="rule" id={TERMS_RULES.unmarked.anchor}>
            <p class="rule-no" aria-hidden="true">02</p>
            <h2 class="rule-title">{TERMS_RULES.unmarked.title}</h2>
            <p class="rule-body">
              NSFW images and text must be flagged as NSFW. NSFW content that carries no flag breaks
              the terms.
            </p>
            <p class="rule-body">
              This applies to an avatar on otherwise safe content too: the flag is what keeps the
              image away from people who filtered NSFW out.
            </p>
          </li>

          <li class="rule" id={TERMS_RULES.illegal.anchor}>
            <p class="rule-no" aria-hidden="true">03</p>
            <h2 class="rule-title">{TERMS_RULES.illegal.title}</h2>
            <p class="rule-body">
              Including realistic sexual depictions of minors, real personal information, death
              threats, messages of violence, and degrading a real person.
            </p>
          </li>
        </ol>
      </section>

      <div class="notes">
        <section class="note" id="where-the-line-sits">
          <h2 class="note-title">Where the line sits</h2>
          <p class="note-body">
            Stylized or drawn depictions, including loli and shota, are not treated as literal CSAM
            under these terms. They are still NSFW and must be flagged as such. Realism is the
            dividing line: a photorealistic or convincingly realistic AI-generated sexual depiction
            of a minor is illegal content, and it escalates immediately instead of waiting in the
            ordinary review queue. There is no written test for it: JEV judges the asset, and a
            moderator makes the call when the case escalates.
          </p>
        </section>

        <section class="note" id="what-the-rules-apply-to">
          <h2 class="note-title">What the rules apply to</h2>
          <p class="note-body">
            They are enforced against visual assets — avatars, images, and GIFs — and against text.
            Text on posts and comments is judged for all three rules; text on a character, lorebook,
            or preset is judged for the NSFW flag and for copying, and for nothing else. A
            character, lorebook, or preset avatar can still break any of the three. Copy claims
            about an image are always checked by a person, because a model cannot compare pictures
            precisely enough.
          </p>
          <p class="note-body">
            {`The flag is what makes the viewer's own `}
            @if (settingsPath !== "") {
              <><a href={href(settingsPath)} onClick={follow(settingsPath)}>NSFW preference</a></>
            } @else {
              <><span>NSFW preference</span></>
            }
            {` possible: with Show off flagged content stays out of listings, and with Blur on it is listed but covered. An accurate flag is therefore part of the rule, not a courtesy.`}
          </p>
        </section>

        <section class="note" id="what-the-flag-covers">
          <h2 class="note-title">What the flag covers</h2>
          <p class="note-body">
            One flag per item, covering everything the item shows. A character, lorebook, or preset
            whose avatar is NSFW carries the flag even when its text is safe, and every image inside
            a post falls under that post's own flag. There is no per-image and no per-avatar flag,
            so one unflagged image makes the item an unflagged NSFW item rather than a partially
            flagged one.
          </p>
        </section>

        <section class="note" id="accepting-the-terms">
          <h2 class="note-title">Accepting the terms</h2>
          <p class="note-body">
            Finishing{" "}<a href={href("/onboarding")} onClick={follow("/onboarding")}>onboarding</a>{" "}is the acceptance: that page
            states, beside{" "}<strong>Finish</strong>, that continuing accepts these terms, and links
            here. No separate acceptance record is kept and there is no version to accept, so a
            change to the rules is never re-asked — the text as it stands is what applies to
            everything published from then on.
          </p>
        </section>

        <section class="note" id="how-enforcement-works">
          <h2 class="note-title">How enforcement works</h2>
          <p class="note-body">
            Only you can delete the content you authored. When a rule is broken, the practical
            consequence is visibility: JEV can make characters, lorebooks, and presets private, and
            a moderator can remove an avatar when concluding a case in which the avatar itself is
            the serious violation. Posts and comments cannot be made private: they are removed as
            soon as JEV is certain a rule is broken, while a case it is unsure about stays public
            until a moderator decides.
          </p>
          <p class="note-body">
            When content is made private you can still open it and see the report, the reasons, and
            the measures taken. Once every reason is fixed, you may request publication again, and
            JEV reviews the content before it goes public. The request is made on the content's own
            page, where the reasons are listed; this page states only that fixing every reason
            opens it, and leaves the steps there. These rules govern public content; what happens
            inside a private session is the user's own business.
          </p>
        </section>
      </div>
      </div>
    </article>
  </>
}

export default Terms;
