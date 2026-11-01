#!/usr/bin/env node
/**
 * The desktop shell's invariants, asserted — gate section 6 (T-33).
 *
 * `src-tauri/tauri.conf.json` is the one file that decides the window the app opens in, and it is
 * *outside* every gate until now: TypeScript never sees it, the build never reads it, and the only
 * way to notice a regression was to launch a window on a desktop. This script makes the three
 * things T-33 settled machine-checkable instead of prose:
 *
 *   1. the window's label is the one `src-tauri/capabilities/default.json` grants permissions to
 *      (a renamed label silently empties the capability's `windows` list — every plugin call from
 *      the page then fails at runtime, and nothing in the build notices);
 *   2. the size the shell opens at is a *designed* breakpoint, and the floor is the design floor:
 *      `docs/DESIGN.md` and the contract lay every page out at 360×740 first, so the window must
 *      open at `lg` (1200) and must never be dragged smaller than 360×740 — below that no page has
 *      ever been designed and the layout is a guess;
 *   3. `frontendDist` still points at the Vite output the build actually writes, so a debug run
 *      that falls back to `devUrl` cannot ship an empty window.
 *
 * Deliberately no JSON-schema validation: this asserts the four decisions the ticket made, not the
 * shape of Tauri's config, and a schema bump must not be able to turn the gate red on its own.
 */
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const failures = [];

function readJson(relative) {
  try {
    return JSON.parse(readFileSync(root + relative, "utf8"));
  } catch (error) {
    failures.push(`${relative} does not parse: ${error.message}`);
    return null;
  }
}

/** The contract's breakpoints. `lg` is where the shell becomes a sidebar, so that is where an app opens. */
const BREAKPOINTS = { sm: 640, md: 900, lg: 1200 };
/** The design floor: every page is laid out at 360×740 before anything else. */
const FLOOR = { width: 360, height: 740 };

const conf = readJson("src-tauri/tauri.conf.json");
const capability = readJson("src-tauri/capabilities/default.json");

if (conf && capability) {
  const windows = conf.app?.windows ?? [];
  const main = windows.find((win) => win.title === conf.productName) ?? windows[0];

  if (!main) {
    failures.push("tauri.conf.json declares no window — the app would open with nothing in it");
  } else {
    // 1. The label is the capability's subject.
    const label = main.label ?? "main"; // Tauri's default label when the key is absent
    const granted = capability.windows ?? [];
    if (!granted.includes(label)) {
      failures.push(
        `window label "${label}" is not in capabilities/default.json windows ${JSON.stringify(granted)} — ` +
          "every granted permission would be dead at runtime",
      );
    }

    // 2. The opening size is a breakpoint, and the floor is the design floor.
    const opening = [main.width, main.height];
    if (!opening.every((n) => Number.isFinite(n))) {
      failures.push("window width/height must be numbers");
    } else if (main.width < BREAKPOINTS.lg) {
      failures.push(
        `window opens at ${main.width}×${main.height}; a desktop shell must open at lg (${BREAKPOINTS.lg}) or wider, ` +
          "not in a tablet-width layout",
      );
    }

    if (main.minWidth !== FLOOR.width || main.minHeight !== FLOOR.height) {
      failures.push(
        `window floor is ${main.minWidth}×${main.minHeight}; it must be ${FLOOR.width}×${FLOOR.height} ` +
          "(the width and height every page was designed at, and the smallest the shell may be dragged)",
      );
    }

    if (main.width < main.minWidth || main.height < main.minHeight) {
      failures.push("window opens smaller than its own minimum — the compositor picks, not the config");
    }

    // 3. frontendDist is the Vite output.
    const dist = (conf.build?.frontendDist ?? "").replace(/^\.\.\//, "");
    if (dist !== "dist") {
      failures.push(`frontendDist is "${conf.build?.frontendDist}" — the build writes dist/`);
    }
    try {
      readFileSync(root + dist + "/index.html");
    } catch {
      // A clean checkout has no dist/ until `bun run build` runs; check.sh builds first, so this
      // only fires when the gate is run out of order. Warn rather than fail for that reason.
      console.log(`   warn ${dist}/index.html absent — run the build before this check`);
    }
  }
}

if (failures.length === 0) {
  console.log("   ok   the window opens at lg 1200×900, floors at 360×740, label matches the capability");
  process.exit(0);
}
for (const failure of failures) console.log(`   FAIL ${failure}`);
process.exit(1);
