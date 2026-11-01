#!/usr/bin/env node
// The accent is a MARK colour; it may never paint text (T-48).
//
// T-37B/T-37C gave accent *text* its own tokens because the raw mark misses WCAG AA on the light
// flavours: `--color-accent-text` for text, `--color-accent-hover-text` for a text hover. What held
// that invariant was a list in `docs/DESIGN.md` — and smoke row 31, which can only visit the pages it
// names. A single `color: var(--color-accent)` in `src/styles.css` or in any `.tsrx` `<style>` block
// reopens the defect with every row still green. This is the static guard (same argument as
// `scripts/link-check.mjs` for bare anchors).
//
// Rule (docs/DESIGN.md → Contrast, settled): a declaration whose property is exactly `color` may not
// take `var(--color-accent)` or `var(--color-accent-hover)`. Text uses `--color-accent-text`; a text
// hover uses `--color-accent-hover-text`. The exemption is `--color-accent-contrast` on an accent
// **fill** (the primary button's label) — that token is a fill's foreground, and the token test below
// matches the mark token exactly, so it passes on its own.
//
// CSS lives in two places: `src/styles.css`, and the `<style>` blocks of every `.tsrx` (the rail, the
// tab bar and half the shell are in there). A line-based grep misses both the multi-line blocks and
// the `.tsrx` half, so this walks braces like `link-check.mjs` walks tags.
//
// No dependency, node stdlib only. Usage:
//   node scripts/tier-check.mjs            # scan the repo
//   node scripts/tier-check.mjs a.css b.tsrx   # scan specific files (how the red proof runs)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsrx")) out.push(path);
  }
  return out;
}

/** Replace every character outside `keep(ranges)` with a space, newlines kept. Length and line
 * numbers survive, so an offset in the mask is an offset in the source. */
function mask(source, ranges) {
  const chars = source.split("");
  const out = chars.map((c) => (c === "\n" ? "\n" : " "));
  for (const [start, end] of ranges) {
    for (let i = start; i < end; i += 1) out[i] = chars[i];
  }
  return out.join("");
}

/** The CSS regions of a file: the whole `.css`, or the inside of each `<style>…</style>` of a
 * `.tsrx`. Nothing else in a `.tsrx` is CSS — a `color:` inside a TS string or a style object never
 * reaches a stylesheet, and scanning it would flag code that paints nothing. */
function cssRegions(file, source) {
  if (file.endsWith(".css")) return { css: source, blocks: 1 };
  const ranges = [];
  const tag = /<style\b[^>]*>/g;
  let open;
  while ((open = tag.exec(source))) {
    const body = open.index + open[0].length;
    const close = source.indexOf("</style>", body);
    if (close === -1) break;
    ranges.push([body, close]);
    tag.lastIndex = close;
  }
  return { css: mask(source, ranges), blocks: ranges.length };
}

/** Comments are prose, and the prose names the token. Blank them, keep the lines. */
function blankComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

const MARK = /--color-accent(-hover)?(?![\w-])/;

function lineStarts(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) if (source[i] === "\n") starts.push(i + 1);
  return starts;
}

function lineAt(starts, pos) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Split a declaration at its FIRST colon. `background-color:` and `border-color:` end in `color:`
 * but their property is not `color`; a substring test flags every fill on a correct tree. */
function declaration(text) {
  const colon = text.indexOf(":");
  if (colon === -1) return null;
  return { prop: text.slice(0, colon).trim(), value: text.slice(colon + 1).trim() };
}

/** Walk blocks from `{` to a depth-counted `}`, so wrapping selector lists (`a.post-author:hover,`)
 * and `@media` nesting are read as the CSS they are. Returns every offending declaration. */
function scan(css, file) {
  const starts = lineStarts(css);
  const offenders = [];
  const stack = []; // { prelude, at }
  let chunk = "";
  let chunkStart = 0;
  let inspected = 0;
  let marks = 0;

  const check = (text, at) => {
    const decl = declaration(text);
    if (!decl) return;
    inspected += 1;
    if (!MARK.test(decl.value)) return;
    marks += 1;
    // A custom property is not a declaration: `--color-accent: var(--ctp-mauve)` defines the token,
    // it paints nothing. Its property starts with `--`, so it never equals `color`.
    if (decl.prop !== "color") return;
    // The innermost block wins when it is a rule; skip `@media`/`@supports` wrappers outward.
    const selector = [...stack].reverse().find((b) => !b.at)?.prelude ?? "(inline)";
    offenders.push({
      line: lineAt(starts, at + text.indexOf(":")),
      selector,
      token: decl.value.match(MARK)[0],
    });
  };

  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      for (; j < css.length; j += 1) {
        if (css[j] === "\\") j += 1;
        else if (css[j] === quote) break;
      }
      chunk += css.slice(i, j + 1);
      i = j;
      continue;
    }
    if (ch === "{") {
      stack.push({ prelude: chunk.replace(/\s+/g, " ").trim(), at: chunk.trim().startsWith("@") });
      chunk = "";
      chunkStart = i + 1;
      continue;
    }
    if (ch === "}") {
      if (chunk.trim()) check(chunk, chunkStart);
      chunk = "";
      stack.pop();
      chunkStart = i + 1;
      continue;
    }
    if (ch === ";" && stack.length) {
      check(chunk, chunkStart);
      chunk = "";
      chunkStart = i + 1;
      continue;
    }
    chunk += ch;
  }
  return { offenders: offenders.map((o) => ({ ...o, file })), inspected, marks };
}

const fromArgs = process.argv.length > 2;
const targets = fromArgs ? process.argv.slice(2) : [join(ROOT, "styles.css"), ...walk(ROOT)];

let inspected = 0;
let marks = 0;
let blocks = 0;
const offenders = [];
for (const file of targets) {
  const source = readFileSync(file, "utf8");
  const { css, blocks: n } = cssRegions(file, source);
  if (!n) continue;
  blocks += n;
  const result = scan(blankComments(css), file);
  inspected += result.inspected;
  marks += result.marks;
  offenders.push(...result.offenders);
}

// Drift guards. A parser that silently finds nothing is green forever: the repo scan must at least
// see the mark somewhere, and any scan must read declarations at all. (A single file passed as an
// argument may legitimately use no accent, so only the repo scan demands a hit.)
if (inspected === 0 || (!fromArgs && marks === 0)) {
  console.error(
    `  tier-check: scanned ${blocks} stylesheet region(s) and found ${inspected} declaration(s), ${marks} of them accent — parser drift, fix the walk`,
  );
  process.exit(1);
}
if (offenders.length) {
  console.error(`  ${offenders.length} declaration(s) paint text with the mark colour:`);
  for (const o of offenders) {
    console.error(`    ${o.file}:${o.line} — ${o.selector} paints text with ${o.token}`);
  }
  console.error("    text takes --color-accent-text; a text hover takes --color-accent-hover-text");
  process.exit(1);
}
console.log(`  ${inspected} declarations across ${blocks} stylesheet region(s); no text takes the mark`);
