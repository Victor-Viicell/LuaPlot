#!/usr/bin/env node
// Every in-app anchor must be a push, not a document load (T-46).
//
// A bare `<a href>` discards the running app: the memory adapter re-seeds, half-written form state
// and the walk's own fixture writes vanish, and on Pages the reader sees a white flash. The seam is
// `follow()` in `src/router.ts`; this check makes the class impossible to reintroduce.
//
// Rule: an `<a …>` whose href is dynamic or an internal path must also carry `onClick=`.
// Exception: an href containing `#` stays a real document navigation — `follow()` drops the
// fragment, so `/terms#rule-2` must keep its in-page jump (`docs/ARCHITECTURE.md` → Router).
//
// No dependency, same shape as scripts/spec-routes.mjs. Exits 1 with a file:line list per offender.
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

/** The `<a …>` start tag, with braces/backticks/strings respected so a `>` inside an expression
 * does not end it. Returns the tag text plus the line it starts on. */
function anchors(source) {
  const found = [];
  let i = 0;
  while ((i = source.indexOf("<a", i)) !== -1) {
    const after = source[i + 2];
    if (after && !/[\s>]/.test(after)) {
      i += 2; // `<article`, `<aside`, … — not an anchor
      continue;
    }
    let j = i + 2;
    let depth = 0;
    let tag = "";
    for (; j < source.length; j += 1) {
      const ch = source[j];
      tag += ch;
      if (ch === "{" || ch === "(" || ch === "[") depth += 1;
      else if (ch === "}" || ch === ")" || ch === "]") depth -= 1;
      else if (ch === '"' || ch === "'" || ch === "`") {
        const quote = ch;
        for (j += 1; j < source.length; j += 1) {
          tag += source[j];
          if (source[j] === "\\") {
            j += 1;
            tag += source[j] ?? "";
            continue;
          }
          if (source[j] === quote) break;
        }
      } else if (ch === ">" && depth <= 0) break;
    }
    const line = source.slice(0, i).split("\n").length;
    found.push({ tag, line });
    i = j + 1;
  }
  return found;
}

const offenders = [];
let scanned = 0;

for (const file of walk(ROOT)) {
  const source = readFileSync(file, "utf8");
  if (!source.includes("href")) continue;
  for (const { tag, line } of anchors(source)) {
    const href = tag.match(/\bhref=\{([\s\S]*)\}(?=\s|\/?>)/);
    const literal = tag.match(/\bhref="([^"]*)"/);
    if (!href && !literal) continue;
    const value = href ? href[1] : literal[1];
    // External destinations are documents on purpose; nothing to push.
    if (/^["'`]?(https?:|mailto:|tel:)/.test(value)) continue;
    // `target="_blank"` asks the browser for a new document/tab: `follow()` already hands a
    // modified click back to the browser, and a source link out of the app must not be pushed.
    if (/\btarget=/.test(tag)) continue;
    // A fragment link must stay a real navigation so the browser can scroll to it.
    if (value.includes("#")) continue;
    scanned += 1;
    if (/\bonClick=/.test(tag)) continue;
    offenders.push(`${file}:${line}  ${tag.replace(/\s+/g, " ").trim().slice(0, 110)}`);
  }
}

if (scanned === 0) {
  console.error("  link-check: scanned 0 internal anchors — parser drift, fix the regex");
  process.exit(1);
}
if (offenders.length) {
  console.error(`  ${offenders.length} internal anchor(s) without onClick={follow(…)}:`);
  for (const line of offenders) console.error(`    ${line}`);
  process.exit(1);
}
console.log(`  ${scanned} internal anchors are pushes`);
