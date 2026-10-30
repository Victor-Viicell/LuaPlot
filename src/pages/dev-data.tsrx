import { effect, track } from "ripple";
import { Card } from "../components/Card.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href } from "../router.ts";
import { PAGE_SIZE, resolveRepo } from "../lib/data/repo.ts";
import { ratioOf, type Character } from "../lib/data/types.ts";

/**
 * `/dev/data` — the data seam against the real fixtures. Development only.
 *
 * Not a product route: absent from `src/specs/luaplot-pages.md`, absent from the tab bar, and
 * `scripts/spec-routes.mjs` drops `/dev/*` before comparing the router with the spec.
 *
 * It answers four questions without a page that does not exist yet: which adapter answered, what
 * the counts are, what the fixtures are called, and whether a mutation moves the state a page will
 * read. The mutation strip is the only control — it proves the one-vote-per-viewer rule and the
 * derived ratio, which a count alone cannot show.
 */

type Row = {
  id: string;
  label: string;
  note: string;
  path: string;
  flag?: string;
};

type Group = {
  title: string;
  note: string;
  rows: Row[];
};

type Count = {
  label: string;
  value: number;
  note: string;
};

type Snap = {
  adapter: string;
  viewer: string;
  counts: Count[];
  characters: Character[];
  groups: Group[];
};

const repo = resolveRepo();

const pct = (value: number): string => `${Math.round(value * 100)}%`;

const clip = (text: string, limit: number): string =>
  text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;

/** One read of the whole seam, shaped for rendering. No page logic in here. */
async function readAll(): Promise<Snap> {
  const [chars, books, presets, personas, posts, open, done, inbox] = await Promise.all([
    repo.listCharacters(),
    repo.listLorebooks(),
    repo.listPresets(),
    repo.listPersonas(),
    repo.listPosts(),
    repo.listReports({ status: "open" }),
    repo.listReports({ status: "concluded" }),
    repo.listNotifications(),
  ]);

  const handled = [...chars.items, ...books.items, ...presets.items, ...posts.items];
  // The busiest thread, not the first row: newest-first puts a commentless character first and a
  // zero there would read as a broken derivation rather than an empty thread.
  const probe = [...chars.items].sort((a, b) => b.commentCount - a.commentCount)[0];
  const thread = probe ? await repo.listComments(probe.id) : [];

  const groups: Group[] = [
    {
      title: "Lorebooks",
      note: "One fixture is private, so listings hide it: not public and not the viewer's own is absent, exactly as RLS will make it absent. Its detail lookup still answers.",
      rows: books.items.map((book) => ({
        id: book.id,
        label: book.name,
        note: `@${book.author} · ${book.entries.length} entries`,
        path: `/lorebook/${book.id}`,
        flag: book.nsfw ? "NSFW" : undefined,
      })),
    },
    {
      title: "Presets",
      note: "Settings are the flat generation list; model is the only field the spec names.",
      rows: presets.items.map((preset) => ({
        id: preset.id,
        label: preset.name,
        note: `@${preset.author} · ${preset.settings.model}`,
        path: `/preset/${preset.id}`,
        flag: preset.nsfw ? "NSFW" : undefined,
      })),
    },
    {
      title: "Personas",
      note: "Personal: no ratio, no comment count, no bookmark, no NSFW flag.",
      rows: personas.items.map((persona) => ({
        id: persona.id,
        label: persona.name,
        note: persona.tagline,
        path: `/persona/${persona.id}`,
        flag: persona.isDefault ? "default" : undefined,
      })),
    },
    {
      title: "Posts",
      note: "A body plus at most one attachment. No edit route and no kind field.",
      rows: posts.items.map((post) => ({
        id: post.id,
        label: clip(post.body, 68),
        note: `${post.attachment ? post.attachment.kind : "text"} · ${post.commentCount} comments · ${pct(ratioOf(post))}`,
        path: `/post/${post.id}`,
        flag: post.nsfw ? "NSFW" : undefined,
      })),
    },
    {
      title: "Cases",
      note: "Ordered by weight, most-reported first. Only what JEV could not decide is here.",
      rows: [...open.items, ...done.items].map((report) => ({
        id: report.id,
        label: report.target.label,
        note: `${report.weight} reports · jev ${report.jev.verdict} ${pct(report.jev.confidence)}`,
        path: `/moderation/${report.id}`,
        flag: report.status,
      })),
    },
  ];

  return {
    adapter: repo.id,
    viewer: repo.viewer,
    counts: [
      { label: "Characters", value: chars.items.length, note: "1 in a session" },
      { label: "Lorebooks", value: books.items.length, note: "1 private" },
      { label: "Presets", value: presets.items.length, note: "1 flagged" },
      { label: "Personas", value: personas.items.length, note: "1 default" },
      { label: "Posts", value: posts.items.length, note: "1 cut" },
      { label: "Comments", value: handled.reduce((sum, item) => sum + item.commentCount, 0), note: `${thread.length} in the first thread` },
      { label: "Alerts", value: inbox.items.length, note: `${inbox.items.filter((row) => !row.read).length} unread` },
      { label: "Cases", value: open.items.length + done.items.length, note: `${open.items.length} open` },
    ],
    characters: chars.items,
    groups,
  };
}

export function DevData() @{
  const snap = track<Snap | null>(null);
  const log = track("Nothing mutated yet: the ratio below is the one the fixture ships with.");
  const failed = track(false);

  let started = false;

  // `.then(onOk, onFail)` rather than try/catch: a `try` block inside a `.tsrx` statement
  // container crashes the TSRX transform (it reports a bogus parse error at `@{`).
  function load(): Promise<void> {
    return readAll().then(
      (next) => {
        snap.value = next;
      },
      () => {
        failed.value = true;
      },
    );
  }

  effect(() => {
    if (started) return;
    started = true;
    void load();
  });

  async function mutate(direction: "like" | "dislike") {
    const first = snap.value?.characters[0];
    if (!first) return;
    // Read the counts *before* the call: the adapter mutates the row in place, so the snapshot
    // reference would otherwise print the post-vote numbers on both sides of the arrow.
    const before = `${first.likes}/${first.dislikes}`;
    const updated = await repo.vote("character", first.id, direction);
    if (updated && updated.kind === "character") {
      // The adapter returns the updated entity, so the counts cannot lag the vote.
      log.value = `vote ${direction} on ${updated.name}: ${before} became ${updated.likes}/${updated.dislikes}, ratio ${pct(ratioOf(updated))}. A switch replaces the earlier vote.`;
      await load();
    }
  }

  async function bookmark() {
    const first = snap.value?.characters[0];
    if (!first) return;
    const result = await repo.toggleBookmark("character", first.id);
    if (result) {
      log.value = `bookmark on ${first.name}: ${result.bookmarked ? "saved" : "cleared"}, ${first.bookmarks} bookmarks in total.`;
      await load();
    }
  }

  <>

  <style>
    .data {
      display: flex;
      flex-direction: column;
      gap: 28px;
      padding-bottom: 40px;
    }

    .head {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .kicker {
      margin: 0;
      color: var(--color-text-subtle);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .title {
      margin: 0;
      font-size: 26px;
      font-weight: 600;
      letter-spacing: -0.01em;
      line-height: 1.2;
    }

    .lede {
      max-width: 64ch;
      margin: 0;
      color: var(--color-text-muted);
      font-size: 14px;
      line-height: 1.7;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .badge {
      padding: 3px 8px;
      border: 1px solid var(--color-border);
      border-radius: 2px;
      color: var(--color-text-muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .badge b {
      color: var(--color-text);
      font-weight: 600;
    }

    .counts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px;
      border: 1px solid var(--color-border);
      background-color: var(--color-border);
    }

    .count {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px;
      background-color: var(--color-bg);
    }

    .count-value {
      color: var(--color-text);
      font-size: 20px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }

    .count-label {
      color: var(--color-text-subtle);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .count-note {
      color: var(--color-text-subtle);
      font-size: 12px;
      line-height: 1.5;
    }

    .sec {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sec-head {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--color-border);
    }

    .sec-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .sec-note {
      max-width: 72ch;
      margin: 0;
      color: var(--color-text-subtle);
      font-size: 12px;
      line-height: 1.6;
    }

    .cards {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: 1px;
      background-color: var(--color-border);
    }

    .row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 10px 12px;
      background-color: var(--color-bg);
      text-decoration: none;
    }

    .row:hover {
      background-color: var(--color-surface);
    }

    .row-label {
      overflow: hidden;
      min-width: 0;
      color: var(--color-text);
      font-size: 14px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row-note {
      flex: none;
      margin-left: auto;
      color: var(--color-text-subtle);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .log {
      margin: 0;
      color: var(--color-text-subtle);
      font-size: 12px;
      line-height: 1.6;
    }

    @media (min-width: 640px) {
      .counts {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .cards {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (min-width: 1200px) {
      .data {
        gap: 36px;
      }

      .cards {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
  </style>

  <div class="data">
    <header class="head">
      <p class="kicker">dev · data seam</p>
      <h1 class="title">Data</h1>
      <p class="lede">
        Everything a page reads comes through one seam. This is that seam against the fixtures:
        counts, names, and the adapter that answered. Development only.
      </p>
      <div class="badges">
        <span class="badge">adapter <b>{snap.value?.adapter ?? "…"}</b></span>
        <span class="badge">viewer <b>{snap.value?.viewer ?? "…"}</b></span>
        <span class="badge">page <b>{PAGE_SIZE}</b></span>
      </div>
    </header>

    @if (failed.value) {
      <EmptyState
        message="The memory adapter did not answer."
        actionLabel="Retry"
        onAction={() => {
          failed.value = false;
          void load();
        }}
      />
    } @else if (!snap.value) {
      <div class="cards" aria-busy="true">
        <Skeleton variant="lines" lines={3} />
        <Skeleton variant="lines" lines={3} />
      </div>
    } @else {
      <>
      <section class="counts" aria-label="Entity counts">
        @for (const count of snap.value.counts; key count.label) {
          <div class="count">
            <span class="count-value">{count.value}</span>
            <span class="count-label">{count.label}</span>
            <span class="count-note">{count.note}</span>
          </div>
        }
      </section>

      <section class="sec">
        <div class="sec-head">
          <h2 class="sec-title">Characters</h2>
          <p class="sec-note">
            Rendered with the real Card: title, avatar/tagline middle, author beside the derived
            ratio. Nothing here stores a percentage. One character is flagged NSFW and stays
            uncovered until T-08 brings the blur.
          </p>
        </div>
        <div class="cards">
          @for (const character of snap.value.characters; key character.id) {
            <Card
              title={character.name}
              href={href(`/character/${character.id}`)}
              author={character.author}
              authorHref={href(`/user/${character.author}`)}
              ratio={ratioOf(character)}
              tagline={character.tagline}
              tags={character.tags}
              initials={character.avatar.initials}
            />
          }
        </div>
      </section>

      <section class="sec">
        <div class="sec-head">
          <h2 class="sec-title">Mutation</h2>
          <p class="sec-note">
            The adapter owns the vote rules: vote twice the same way, then switch — one count moves
            and the other stays.
          </p>
        </div>
        <div class="tools">
          <button class="btn btn-ghost" type="button" onClick={() => void mutate("like")}>Vote like</button>
          <button class="btn btn-ghost" type="button" onClick={() => void mutate("dislike")}>Vote dislike</button>
          <button class="btn btn-ghost" type="button" onClick={() => void bookmark()}>Toggle bookmark</button>
        </div>
        <p class="log">{log.value}</p>
      </section>

      @for (const group of snap.value.groups; key group.title) {
        <section class="sec">
          <div class="sec-head">
            <h2 class="sec-title">{group.title}</h2>
            <p class="sec-note">{group.note}</p>
          </div>
          <div class="rows">
            @for (const row of group.rows; key row.id) {
              <a class="row" href={href(row.path)}>
                <span class="row-label">{row.label}</span>
                @if (row.flag) {
                  <span class="card-tag">{row.flag}</span>
                }
                <span class="row-note">{row.note}</span>
              </a>
            }
          </div>
        </section>
      }
      </>
    }
  </div>
  </>
}

export default DevData;

