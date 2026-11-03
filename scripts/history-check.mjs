#!/usr/bin/env node
// No page writes the address bar behind the router's back (T-66).
//
// A page that calls `history.pushState`/`replaceState` itself moves the URL and leaves the router
// believing it is still on the pre-query location: `App.tsrx`'s mounted key never changes, so the
// next navigation to that same route is a silent no-op — press the Catalog tab on a narrowed catalog
// and the address clears while the grid keeps the filter. The seam is `commitQuery()` in
// `src/router.ts`; it writes history *and* moves the mounted key without notifying listeners (which
// is what keeps the caret in a settled search field). This check makes the class impossible to
// reintroduce at the seven call sites `src/pages/*` had.
//
// Rule: `history.pushState` / `history.replaceState` may appear in `src/router.ts` and nowhere else
// under `src/`. Tests and the walk (`scripts/smoke.mjs`) are not scanned — a row that fakes a
// navigation is the row's own business.
//
// No dependency, same shape as scripts/link-check.mjs. Exits 1 with a file:line list per offender.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
/** The one file allowed to touch history. */
const ALLOWED = join("src", "router.ts");
const WRITE = /history\s*\.\s*(push|replace)State\s*\(/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsrx") || path.endsWith(".ts")) out.push(path);
  }
  return out;
}

const files = walk(ROOT);
const offenders = [];
let scanned = 0;
let allowed = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  const isAllowed = file === ALLOWED;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    WRITE.lastIndex = 0;
    let match = WRITE.exec(line);
    while (match) {
      // A comment naming the rule is prose, not a write.
      const before = line.slice(0, match.index).trim();
      const commented = before.startsWith("*") || before.startsWith("//") || before.startsWith("/*");
      if (commented) {
        match = WRITE.exec(line);
        continue;
      }
      scanned += 1;
      if (isAllowed) allowed += 1;
      else offenders.push(`${file}:${index + 1}  ${line.trim().slice(0, 110)}`);
      match = WRITE.exec(line);
    }
  }
}

if (allowed === 0) {
  console.error("  history-check: src/router.ts no longer writes history — did the seam move?");
  process.exit(1);
}
if (offenders.length) {
  console.error(`  ${offenders.length} write(s) behind the router's back — use commitQuery() from src/router.ts:`);
  for (const line of offenders) console.error(`    ${line}`);
  process.exit(1);
}
console.log(`  ${scanned} history write(s), all in src/router.ts`);
