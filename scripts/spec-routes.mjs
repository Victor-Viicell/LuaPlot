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
const routerRoutes = new Set();
for (const m of router.matchAll(/path:\s*"([^"]+)"/g)) routerRoutes.add(m[1]);

const norm = (r) =>
  r
    .replace(/\[[^\]]+\]/g, ":p") // [character.id] and :id are the same shape
    .replace(/\/$/, "") || "/";

const specN = new Set(specRoutes);
const routerN = new Set([...routerRoutes].map((r) => r.replace(/:[A-Za-z]+/g, ":p")));
const missing = [...specN].map(norm).filter((r) => !routerN.has(norm(r)));
const extra = [...routerRoutes].map(norm).filter((r) => !new Set([...specN].map(norm)).has(r));

if (specN.size === 0) {
  console.error("spec-routes: parsed 0 spec routes — parser drift, fix the regex");
  process.exit(1);
}
if (missing.length) console.error("  missing in router:", missing.join(", "));
if (extra.length) console.error("  not in spec:", extra.join(", "));
if (missing.length || extra.length) process.exit(1);
console.log(`  ${specN.size} routes match the spec`);
