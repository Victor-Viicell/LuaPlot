import { Avatar } from "./Avatar.tsrx";

/**
 * Catalogue card *structure* only: title header, avatar/tagline/tags middle,
 * author + ratio footer. The NSFW blur is T-08 — it covers `.card-middle` and
 * leaves the header and the footer (author, ratio) untouched, so the three
 * parts must stay separate elements here.
 *
 * No comment count and no vote counts on a card: engagement on a listing is the
 * ratio as a percentage, and the counts live on the detail page (spec: luaplot-pages.md).
 * The tags row is not rendered while the taxonomy is undecided — an empty `tags`
 * array leaves no row and no placeholder.
 */
export function Card({
  title,
  href,
  author,
  authorHref,
  /** Likes / (likes + dislikes), 0–1. */
  ratio,
  tagline,
  tags,
  initials,
  onOpen,
}: {
  title: string;
  href?: string;
  author: string;
  authorHref?: string;
  ratio: number;
  tagline?: string;
  tags?: string[];
  initials?: string;
  onOpen?: (event: MouseEvent) => void;
}) @{
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const pct = `${Math.round(safe * 100)}%`;
  const mark = initials ?? title.slice(0, 2);
  const hasTags = tags !== undefined && tags.length > 0;

  <article class="card">
    <div class="card-head">
      @if (href) {
        <a class="card-title" href={href} onClick={onOpen}>{title}</a>
      } @else {
        <span class="card-title">{title}</span>
      }
    </div>

    <div class="card-middle">
      <Avatar initials={mark} size={40} />
      <div class="card-body">
        @if (tagline) {
          <p class="card-tagline">{tagline}</p>
        }
        @if (hasTags) {
          <ul class="card-tags">
            @for (const tag of tags ?? []; key tag) {
              <li class="card-tag">{tag}</li>
            }
          </ul>
        }
      </div>
    </div>

    <div class="card-foot">
      @if (authorHref) {
        <a class="card-author" href={authorHref}>{`@${author}`}</a>
      } @else {
        <span class="card-author">{`@${author}`}</span>
      }
      <span class="card-ratio">{pct}</span>
    </div>
  </article>
}
