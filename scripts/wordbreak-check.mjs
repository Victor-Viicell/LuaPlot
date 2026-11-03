#!/usr/bin/env node
// Every literal beside an inline element keeps its word break (T-70).
//
// T-69 fixed seven sites where a sentence read "Create oneif it is not here yet." — Ripple trims a
// **literal's boundary whitespace when its neighbour is an element**, in both directions, so
// `</a> if` compiles to `</a>if` and `Finishing <a>` to `Finishing<a>`. An explicit `{" "}` is a text
// piece of its own and survives. Only `/persona` had a row that would notice the bug coming back;
// every other site (`/terms`, `/onboarding`, `/persona/<id>`, `/user/<handle>`, the four `/dev/*`
// pages) was found by hand with a grep over the built bundle.
//
// That is the same argument `scripts/tier-check.mjs` answers for the accent tier and
// `scripts/link-check.mjs` answers for bare anchors: a hand sweep is a list, the gate is the guard.
// The mechanism is pure text over a file `scripts/check.sh` already builds, so it costs nothing at
// gate time and covers pages no journey visits.
//
// **Scan `dist/assets/*.js`, never `src`.** Whether a site loses its break is decided by the
// compiler's bucketing: the same source shape compiles to a piece array (space gone) or to a static
// HTML string (space kept, and fine). A source grep flags both and proves neither — that is T-69's
// own find, and the reason this check reads the build.
//
// Zero matches is green. Each hit prints ~60 chars either side of the glue so a red names the copy.
// The fix is always `{" "}` in the `.tsrx` — never a wider pattern here.
//
// No dependency, node stdlib only. Usage:
//   node scripts/wordbreak-check.mjs                  # scan dist/assets/*.js
//   node scripts/wordbreak-check.mjs $TMPDIR/x.js     # scan specific files (how the red proof runs)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = join("dist", "assets");

// The inline set. Block-level tags are excluded on purpose: whitespace beside a `div`, `p`, `li` or
// `ul` carries no word break, so a literal glued to one renders correctly and must stay green.
// `class=` matches too — the bundle writes `<code class=tsrx-…>`.
const INLINE = "a|b|span|strong|em|code|i|small";

// A letter/digit/close-paren/dot glued to an inline element's OPENING tag (`[ >]` demands the tag's
// own shape, so minified `a<b` comparisons — and class= — do not match)…
const OPENING = new RegExp(`[\\p{L}\\p{N}.)]<(${INLINE})[ >]`, "gu");
// …and its mirror: the closing tag glued to the following word.
const CLOSING = new RegExp(`</(${INLINE})>[\\p{L}]`, "gu");
// Every inline tag, for the drift guard: a scan that sees none has a broken pattern, not a clean tree.
const ANY_INLINE = new RegExp(`</?(?:${INLINE})[ >]`, "g");

/** `…60 chars either side…` of the glue, newlines folded so the message stays one line. */
function excerpt(source, at, len) {
  const before = at > 60 ? `…${source.slice(at - 60, at)}` : source.slice(0, at);
  const after =
    at + len + 60 < source.length ? `${source.slice(at + len, at + len + 60)}…` : source.slice(at + len);
  return `${before}${source.slice(at, at + len)}${after}`.replace(/\s+/g, " ");
}

const fromArgs = process.argv.length > 2;
let targets;
if (fromArgs) {
  targets = process.argv.slice(2);
} else {
  targets = readdirSync(DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(DIR, name))
    .sort();
}

let files = 0;
let bytes = 0;
let inline = 0;
const offenders = [];

for (const file of targets) {
  let source;
  try {
    statSync(file);
    source = readFileSync(file, "utf8");
  } catch {
    console.error(`  wordbreak-check: cannot read ${file}`);
    process.exit(1);
  }
  files += 1;
  bytes += source.length;
  inline += (source.match(ANY_INLINE) ?? []).length;
  for (const [what, pattern] of [
    ["an opening tag", OPENING],
    ["a closing tag", CLOSING],
  ]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      offenders.push({ file, at: match.index, what, match: match[0] });
    }
  }
}

const kb = Math.round(bytes / 1024);

// Drift guards. A parser that silently finds nothing is green forever, so the repo scan must read
// inline tags at all — and every asset it reads must be non-trivial. A single file passed as an
// argument may legitimately contain no inline markup, the same exemption tier-check makes.
if (files === 0) {
  console.error(`  wordbreak-check: no assets under ${DIR} — run the build first`);
  process.exit(1);
}
if (!fromArgs && inline === 0) {
  console.error(
    `  wordbreak-check: scanned ${files} asset(s), ${kb} KB and found no inline tag at all — parser drift, fix the walk`,
  );
  process.exit(1);
}

if (offenders.length) {
  console.error(`  ${offenders.length} literal(s) are glued to an inline element:`);
  for (const o of offenders) {
    const source = readFileSync(o.file, "utf8");
    console.error(`    ${o.file} (${o.what}): ${excerpt(source, o.at, o.match.length)}`);
  }
  console.error('    write {" "} in the .tsrx — an explicit space is a text piece of its own and survives');
  process.exit(1);
}

console.log(
  `  ${files} asset(s), ${kb} KB, ${inline} inline tag(s); no literal is glued to an inline element`,
);
