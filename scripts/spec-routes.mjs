#!/usr/bin/env node
// Compares the route table in src/specs/luaplot-pages.md with src/router.ts.
// Fails when a spec route has no entry or an entry has no spec.
import { readFileSync } from "node:fs";

const spec = readFileSync("src/specs/luaplot-pages.md", "utf8");
const router = readFileSync("src/router.ts", "utf8");

// Spec routes live in the first column of the route tables: `| `/path` |`
const specRoutes = new Set();
for (const line of spec.split("\n")) {
  const m = line.match(/^\|\s*`(\/[^`]*)`\s*\|/);
  if (m) specRoutes.add(m[1]);
}

// Router entries look like: { path: "/character/[id]", ... }
// `/dev/*` is a development gallery, not a product route: it must never appear in the
// spec index (`src/specs/luaplot-pages.md` is product law), so drop it before comparing.
const routerRoutes = new Set();
for (const m of router.matchAll(/path:\s*"([^"]+)"/g)) {
  if (m[1].startsWith("/dev/")) continue;
  routerRoutes.add(m[1]);
}

const norm = (r) =>
  r
    .replace(/\[[^\]]+\]/g, ":p") // [character.id] and :id are the same shape
    .replace(/:[A-Za-z][A-Za-z0-9_]*/g, ":p") // ... and so is :username
    .replace(/\/$/, "") || "/";

const specN = new Set([...specRoutes].map(norm));
const routerN = new Set([...routerRoutes].map(norm));
const missing = [...specN].filter((r) => !routerN.has(r));
const extra = [...routerN].filter((r) => !specN.has(r));

if (specRoutes.size === 0) {
  console.error("spec-routes: parsed 0 spec routes — parser drift, fix the regex");
  process.exit(1);
}
if (missing.length) console.error("  missing in router:", missing.join(", "));
if (extra.length) console.error("  not in spec:", extra.join(", "));
if (missing.length || extra.length) process.exit(1);
console.log(`  ${specN.size} routes match the spec`);
