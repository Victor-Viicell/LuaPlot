#!/usr/bin/env node
/**
 * T-38 — one scripted walk of the primary journeys, against a build that ships.
 *
 * `node scripts/smoke.mjs [--url <base>]` drives a real Chromium over CDP (no dependency:
 * Node's global WebSocket plus `/json/new`), walks the twenty-eight journeys **in one session** with
 * in-app navigation only, and prints one row per journey of `{journey, started, ended, evidence}`.
 * Exit code 1 when any row fails.
 *
 * Two rules the walk exists to enforce:
 *
 * 1. **Every step asserts on the DOM** — the sentence a page prints, the badge in the tab bar,
 *    the card leaving the grid. A journey that only passes because the memory adapter said so is
 *    not a journey: the adapter is what the pages are supposed to prove.
 * 2. **A hard reload re-seeds the memory adapter**, so the walk never reloads between the steps of
 *    a journey. Where a journey has to jump (a private item has no link path), it pushes the route
 *    the way `router.navigate()` does and dispatches `popstate` — the router's own listener.
 *
 * The server must already be serving the build under test (`bun run preview --port 4321`, or the
 * published site). This script launches its own Chromium and kills it on exit.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = flag("--url", process.env.SMOKE_URL || "http://localhost:4321/").replace(/\/?$/, "/");
const PORT = Number(flag("--port", 9333));
const HEADED = args.includes("--headed");
const TIMEOUT = Number(flag("--timeout", 6000));
const PROFILE = join(
  process.env.SMOKE_PROFILE_DIR || tmpdir(),
  `luaplot-smoke-${process.pid}-${Date.now()}`,
);
/**
 * T-43 — the file the Pick journey hands to the page's `<input type=file>`. The module only reads
 * `file.name`, so a one-pixel PNG is enough; it is a real file on disk, which is the whole point
 * (a synthetic `File` would prove the handler, not the chooser).
 */
const PICK_NAME = "luaplot-pick.png";
const PICK_DIR = join(tmpdir(), `luaplot-smoke-files-${process.pid}-${Date.now()}`);
const PICK_FILE = join(PICK_DIR, PICK_NAME);

const CHROME_CANDIDATES = [
  process.env.SMOKE_CHROME,
  "/usr/sbin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error("smoke: no chromium found (set SMOKE_CHROME to its path)");
  process.exit(2);
}

mkdirSync(PROFILE, { recursive: true });
mkdirSync(PICK_DIR, { recursive: true });
writeFileSync(
  PICK_FILE,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const chrome = spawn(
  chromePath,
  [
    HEADED ? "--headless=new" : "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-extensions",
    "--no-sandbox",
    "--window-size=360,740",
    "about:blank",
  ],
  { stdio: "ignore" },
);
process.on("exit", () => {
  chrome.kill("SIGKILL");
  try {
    rmSync(PROFILE, { recursive: true, force: true });
    rmSync(PICK_DIR, { recursive: true, force: true });
  } catch {}
});
process.on("SIGINT", () => {
  chrome.kill("SIGKILL");
  try {
    rmSync(PICK_DIR, { recursive: true, force: true });
  } catch {}
  process.exit(130);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpJson(path, method = "GET") {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(200);
  }
  throw new Error(`CDP did not answer on :${PORT}`);
}

await cdpJson("/json/version");
const tab = await cdpJson(`/json/new?${encodeURIComponent("about:blank")}`, "PUT");
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  socket.onopen = res;
  socket.onerror = rej;
});

let nextId = 0;
const pending = new Map();
const pageErrors = [];

/**
 * T-43 — buffered CDP events. `Page.fileChooserOpened` can land before the journey asks for it, so
 * a waiter that only listened going forward would lose the very event it was waiting on.
 */
const eventQueue = new Map();
const eventWaiters = new Map();
function waitEvent(method, timeout = 8000) {
  const queued = eventQueue.get(method);
  if (queued && queued.length) return Promise.resolve(queued.shift());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${method} within ${timeout}ms`)), timeout);
    const list = eventWaiters.get(method) ?? [];
    list.push((params) => {
      clearTimeout(timer);
      resolve(params);
    });
    eventWaiters.set(method, list);
  });
}

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params?.exceptionDetails;
    pageErrors.push(d?.exception?.description || d?.text || "page exception");
  }
  if (msg.method && !msg.id) {
    const list = eventWaiters.get(msg.method);
    if (list && list.length) list.shift()(msg.params ?? {});
    else {
      const queued = eventQueue.get(msg.method) ?? [];
      // Only the events someone can wait for are buffered; anything else is noise.
      if (msg.method === "Page.fileChooserOpened") queued.push(msg.params ?? {});
      eventQueue.set(msg.method, queued);
    }
    return;
  }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");

/** Evaluate in the page and return the value; throws what the page threw. */
async function page(fnSource) {
  const res = await send("Runtime.evaluate", {
    expression: fnSource,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails) {
    const detail = res.result.exceptionDetails;
    throw new Error(detail.exception?.description || detail.text || "page error");
  }
  return res.result?.result?.value;
}

const js = (template) => page(`(() => { ${template} })()`);

/** Visible text of the page, whitespace collapsed. */
const text = () => js(`return document.body.innerText.replace(/\\s+/g, " ").trim();`);
const url = () => js(`return location.pathname + location.search;`);

/** The text of the case page's *THE ITEM* section — the panel T-40 proved can lie after an action. */
const itemPanel = () =>
  js(`const h = [...document.querySelectorAll("h2")].find((el) => (el.innerText || "").trim().toLowerCase() === "the item"); if (!h) return ""; const s = h.closest("section"); return s ? s.innerText.replace(/\\s+/g, " ").trim() : "";`);

/** The value of the first field in the mounted form — the edit pages' first row is always the name. */
const formName = () =>
  js(`const el = document.querySelector("form input, form textarea"); return el ? el.value : "";`);

/** Poll a page expression until it is truthy. */
async function waitFor(source, label, timeout = TIMEOUT) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await js(`return (${source});`).catch((e) => `ERR ${e.message}`);
    if (last) return last;
    await sleep(120);
  }
  throw new Error(`timed out waiting for ${label} (last: ${JSON.stringify(last)})`);
}

const waitText = (needle, timeout) =>
  waitFor(`document.body.innerText.includes(${JSON.stringify(needle)})`, `"${needle}"`, timeout);
const waitUrl = (fragment, timeout) =>
  waitFor(`(location.pathname + location.search).includes(${JSON.stringify(fragment)})`, `url ${fragment}`, timeout);

/** Click the first visible control matching `label` (exact, then prefix, then contains). */
async function click(label, { nth = 0, exact = false, scope = "button,a,[role=tab],[role=button]" } = {}) {
  const clicked = await js(`
    const wanted = ${JSON.stringify(label.toLowerCase())};
    const exactOnly = ${exact ? "true" : "false"};
    const all = [...document.querySelectorAll(${JSON.stringify(scope)})].filter((el) => {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return false;
      return true;
    });
    const name = (el) => ((el.getAttribute("aria-label") || el.innerText || "").replace(/\\s+/g, " ").trim()).toLowerCase();
    const passes = exactOnly
      ? [(el) => name(el) === wanted]
      : [
          (el) => name(el) === wanted,
          (el) => name(el).startsWith(wanted),
          (el) => name(el).includes(wanted),
        ];
    for (const test of passes) {
      const hits = all.filter(test);
      if (hits.length > ${nth}) {
        const el = hits[${nth}];
        el.scrollIntoView({ block: "center" });
        el.click();
        return name(el).slice(0, 60) || el.tagName;
      }
    }
    return "";
  `);
  if (!clicked) {
    const seen = await js(`return [...document.querySelectorAll("button,a,[role=button]")].map((e)=>((e.getAttribute("aria-label")||e.innerText||"").replace(/\\s+/g," ").trim()).slice(0,40)).filter(Boolean).join(" | ");`);
    throw new Error(`no control matching "${label}" — on ${await url()} saw: ${seen}`);
  }
  return clicked;
}

/** Click the nth element matching a CSS selector. */
async function clickSelector(selector, nth = 0) {
  const clicked = await js(`
    const els = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getBoundingClientRect().height > 0);
    const el = els[${nth}];
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    el.click();
    return true;
  `);
  if (!clicked) throw new Error(`no element ${selector}[${nth}] on ${await url()}`);
}

/** Press the pointer at a viewport point — the gesture a person makes, not a scripted `.click()`. */
async function mouseClickAt(box) {
  const base = { x: Math.round(box.x), y: Math.round(box.y), button: "left", clickCount: 1 };
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
  await sleep(120);
}

/** Click with real mouse events at the element's centre — the way a person clicks. */
async function realClick(selector, nth = 0) {
  const box = await js(`
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getBoundingClientRect().height > 0)[${nth}];
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  if (!box) throw new Error(`no element ${selector}[${nth}] on ${await url()}`);
  await mouseClickAt(box);
}

/** Try labels in order; the first that exists wins. */
async function clickAny(labels, options = {}) {
  for (const label of labels) {
    try {
      return await click(label, options);
    } catch {}
  }
  throw new Error(`none of ${labels.join(", ")} on ${await url()}`);
}

/** Type into the nth matching field with real key events (the bindings hear them). */
async function type(selector, value, nth = 0) {
  const ok = await js(`
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getBoundingClientRect().height > 0)[${nth}];
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    el.focus();
    return true;
  `);
  if (!ok) throw new Error(`no field ${selector}[${nth}] on ${await url()}`);
  await send("Input.insertText", { text: value });
  await sleep(60);
}

/**
 * Type into the nth matching field with real key events, **replacing** what it held.
 *
 * T-41 needs this where the character step only appended: a form preloaded from a row has a caret
 * wherever Chrome put it after `focus()`, so an append would prove nothing about the edit. The
 * selection is set on the element (not through a keystroke), the text arrives through
 * `Input.insertText` — a real input event the bindings hear — and the value is read back and
 * compared before the step returns, so every use is a two-read proof on its own.
 */
async function retype(selector, value, nth = 0) {
  const ok = await js(`
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getBoundingClientRect().height > 0)[${nth}];
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    el.focus();
    if (typeof el.setSelectionRange === "function" && typeof el.value === "string") {
      el.setSelectionRange(0, el.value.length);
    }
    return true;
  `);
  if (!ok) throw new Error(`no field ${selector}[${nth}] on ${await url()}`);
  await send("Input.insertText", { text: value });
  await sleep(60);
  const read = await js(`
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getBoundingClientRect().height > 0)[${nth}];
    return el ? el.value : "";
  `);
  if (read !== value) throw new Error(`${selector}[${nth}] reads ${JSON.stringify(read)} after typing ${JSON.stringify(value)}`);
  return read;
}

/**
 * Drive a native `<select>` by value plus a real `change` event. Its popup cannot be clicked in
 * headless Chromium, so the value is the honest road — and it is read back, so a control that
 * ignored the choice fails here rather than on the page it was supposed to change.
 */
async function choose(selector, value) {
  const read = await js(`
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    if (el.value !== ${JSON.stringify(value)}) {
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return el.value;
  `);
  if (read === null) throw new Error(`no ${selector} on ${await url()}`);
  if (read !== value) throw new Error(`${selector} reads ${JSON.stringify(read)} after choosing ${JSON.stringify(value)}`);
  await sleep(80);
  return read;
}

/** One row of a preset detail page's *Generation settings* list, read by its term. */
const settingValue = (term) =>
  js(`
    const s = document.querySelector('section[aria-label="Generation settings"]');
    if (!s) return "";
    const row = [...s.querySelectorAll("dt")].find((d) => (d.innerText || "").trim().toLowerCase() === ${JSON.stringify(String(term).toLowerCase())});
    const dd = row && row.parentElement ? row.parentElement.querySelector("dd") : null;
    return dd ? dd.innerText.trim() : "";
  `);

/**
 * T-42 — read a refusal page: its own sentence, its road out, and the form it must not mount.
 *
 * Three facts, because the sentence alone would let the other two rot: an `EmptyState` with no
 * action strands the reader, and a refusal that still mounted the form is a worse defect than a
 * wrong sentence. `catalogPath` is matched as a **suffix** — preview serves `/character/catalog`,
 * Pages serves `/LuaPlot/character/catalog`, and T-41 lost three rows to an `^`-anchored test.
 */
async function refusal(message, catalogPath) {
  await waitText(message, 8000);
  const read = await js(`
    const form = document.querySelector("form");
    const a = [...document.querySelectorAll("a")].find((e) => (e.innerText || "").trim() === "Back to catalog");
    const href = a ? a.getAttribute("href") || "" : "";
    return {
      form: form !== null,
      resolved: href ? new URL(href, location.href).pathname : "",
    };
  `);
  const where = await url();
  if (read.form) throw new Error(`the refusal at ${where} still mounted a <form>`);
  if (!read.resolved) throw new Error(`the refusal at ${where} prints no "Back to catalog" road out`);
  const base = new URL(BASE).pathname;
  if (!read.resolved.startsWith(base)) {
    throw new Error(`the road out ${read.resolved} leaves the served base ${base} (from ${where})`);
  }
  if (!read.resolved.endsWith(catalogPath)) {
    throw new Error(`the road out points at ${read.resolved}, not ${catalogPath} (from ${where})`);
  }
  return `${message} → ${read.resolved}`;
}

/** In-app hop: exactly what `router.navigate()` does — pushState then the router's popstate. */
async function go(path) {
  // Resolve against the served base (`/` in Tauri and preview, `/LuaPlot/` on Pages): a leading
  // slash would drop the base and take the router to a path it has no route for.
  const target = new URL(path.replace(/^\/+/, ""), BASE);
  const next = target.pathname + target.search;
  await js(`
    history.pushState({}, "", ${JSON.stringify(next)});
    dispatchEvent(new PopStateEvent("popstate"));
    return true;
  `);
  await sleep(350);
}

/**
 * Wait for the document to be **exactly** where `path` resolves — `BASE` + `path`, one base deep.
 *
 * `waitUrl()` is a substring match on purpose (it is used for query strings and hash routes), and
 * that is what hid a doubled base on Pages: `/LuaPlot/LuaPlot/authentification` *contains*
 * `/authentification`, so row 1 read green on the preview and only the live walk timed out — on a
 * page that had rendered the app's own not-found screen (T-45).
 */
async function expectPath(path, label, timeout = 8000) {
  const want = new URL(path.replace(/^\/+/, ""), BASE).pathname;
  const deadline = Date.now() + timeout;
  let seen = "";
  while (Date.now() < deadline) {
    seen = await js(`return location.pathname;`);
    if (seen === want) return seen;
    await sleep(120);
  }
  throw new Error(`${label} landed on ${seen}, expected ${want}`);
}

const pressed = (label) =>
  js(`
    const el = [...document.querySelectorAll("button")].find((e) => (e.getAttribute("aria-label") || e.innerText || "").trim().toLowerCase().startsWith(${JSON.stringify(label.toLowerCase())}));
    return el ? el.getAttribute("aria-pressed") : null;
  `);

/* ------------------------------------------------------------------------------------------------
 * T-45 — did the press stay inside the running document?
 *
 * Home's entry control used to be `<a href>` with no `follow()`: pressing it was a **document
 * load**, so the app booted again and the mock re-seeded. Smoke row 1 could not tell the
 * difference — the re-boot *re-seeded the user*, so its assertion passed either way — which is
 * exactly why this needs its own evidence rather than a green row.
 *
 * The proof is document identity, not a URL: `window` is replaced by a load, so a marker set
 * before the press is gone after it, and `performance.timeOrigin` (fixed at document creation)
 * moves. A push keeps both. `performance.getEntriesByType("navigation")[0].type` is not enough on
 * its own — a fresh document loaded from a link also reports `navigate`, never `reload`.
 * ---------------------------------------------------------------------------------------------- */

/** Stamp the current document and return its identity. */
const markDocument = (token) =>
  js(`
    window.__walkMark = ${JSON.stringify(token)};
    return { mark: window.__walkMark, origin: Math.round(performance.timeOrigin) };
  `);

/** Read the document identity back; a different one means the press re-booted the app. */
const documentIdentity = () =>
  js(`
    return {
      mark: window.__walkMark || "",
      origin: Math.round(performance.timeOrigin),
      nav: (performance.getEntriesByType("navigation")[0] || {}).type || "",
    };
  `);

/**
 * Assert the press that just happened was a push. Returns the sentence the row prints as evidence,
 * so a reader sees *how* it was proven rather than a bare "green".
 */
async function expectNoReload(mark, label) {
  const now = await documentIdentity();
  if (now.mark !== mark.mark || now.origin !== mark.origin) {
    throw new Error(
      `${label} re-booted the app: the document went from ${JSON.stringify(mark)} to ${JSON.stringify(now)}`,
    );
  }
  return `document kept ${now.mark} (timeOrigin ${now.origin}, nav ${now.nav})`;
}

/* ------------------------------------------------------------------------------------------------
 * T-43 — `/dev/native`'s five capability rows.
 *
 * The page prints one answer per press (`· last <b>{read}</b>` from `readOut()`) and repeats them
 * newest-first in *Last answers*. The assertions read the **row for that capability**, never the
 * page's text: a page that logged the answer against the wrong capability would otherwise pass.
 * ---------------------------------------------------------------------------------------------- */

/** JS source for the `.cap` element whose `.cap-name` is exactly `name`. */
const capRowSource = (name) =>
  `[...document.querySelectorAll(".cap")].find((r) => { const n = r.querySelector(".cap-name"); return n && (n.innerText || "").trim() === ${JSON.stringify(name)}; })`;

/**
 * Press a capability's button with real mouse events. `pressCap` exists rather than a
 * `click(".cap button", { nth })` because the row's *name* is the identity and the index is not:
 * `CAPABILITIES` can be reordered without silently pressing a different road.
 */
async function pressCap(name) {
  const box = await js(`
    const row = ${capRowSource(name)};
    if (!row) return null;
    const el = row.querySelector("button");
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  if (!box) throw new Error(`no /dev/native capability row named "${name}" on ${await url()}`);
  await mouseClickAt(box);
}

/**
 * Wait for that row's printed answer and require the exact sentence.
 *
 * Polls for the **value**, not for "an answer": the badge row is pressed twice in one journey, and
 * a wait that accepted the first non-empty read would return `ok · (3) title` for the Clear press.
 */
async function expectCap(name, expected, timeout = 8000) {
  const deadline = Date.now() + timeout;
  let seen = "";
  while (Date.now() < deadline) {
    seen = await capAnswer(name).catch(() => "");
    if (seen === expected) return seen;
    await sleep(120);
  }
  throw new Error(`the "${name}" row reads ${JSON.stringify(seen)}, expected ${JSON.stringify(expected)}`);
}

/**
 * Like `expectCap`, for a row whose answer a **browser engine** decides rather than the module.
 *
 * `haptic` is the only one: rung 2 is `navigator.vibrate(pattern) ? done(kind) : unsupported`, so
 * whether the row reads `ok · medium` or `unsupported · this browser has no road` is the engine's
 * answer, not the app's — T-34 measured `false` on this box's Chromium and T-43 measured truthy on
 * the same box, months apart. Pinning either literal would turn a Chromium update into a red walk.
 * What the walk *can* pin is the set of legal verdicts: `failed · a road existed and broke` — or no
 * answer at all — is the defect.
 */
async function expectCapOneOf(name, allowed, timeout = 8000) {
  const deadline = Date.now() + timeout;
  let seen = "";
  while (Date.now() < deadline) {
    seen = await capAnswer(name).catch(() => "");
    if (allowed.includes(seen)) return seen;
    await sleep(120);
  }
  throw new Error(
    `the "${name}" row reads ${JSON.stringify(seen)}, which is none of ${allowed.map((a) => JSON.stringify(a)).join(" / ")}`,
  );
}

/** The `· last …` text of one capability row, or "" until the page prints one. */
function capAnswer(name) {
  return js(`return (() => {
    const row = ${capRowSource(name)};
    if (!row) return "";
    const road = row.querySelector(".cap-road");
    if (!road) return "";
    const flat = (road.innerText || "").replace(/\\s+/g, " ");
    const at = flat.lastIndexOf("· last ");
    return at < 0 ? "" : flat.slice(at + ("· last ").length).trim();
  })();`);
}

/**
 * The chunk boundary, on the wire. `isNative()` is false in a browser, so `@tauri-apps/api/core`
 * must never be requested — and a grep over `dist` cannot prove it: the literal `@tauri-apps`
 * appears in no built file (the chunk is named `core-<hash>.js`), so a grep passes vacuously.
 */
async function noCoreChunk(label) {
  const hits = await js(`
    return performance.getEntriesByType("resource")
      .map((e) => e.name)
      .filter((n) => /(^|\\/)core-[A-Za-z0-9_-]+\\.js/.test(n));
  `);
  const names = Array.isArray(hits) ? hits : [];
  if (names.length) throw new Error(`${label} pulled the Tauri chunk into a browser: ${names.join(", ")}`);
  return "0 core- requests";
}

/** Enter `/dev/native` and wait for its five rows — the shape every T-43 journey starts from. */
async function openNative() {
  await go("/dev/native");
  await waitFor(`document.querySelectorAll(".cap").length === 5`, "/dev/native's five capability rows", 8000);
}

/* ------------------------------------------------------------------------------------------------
 * T-44 — `/dev/state`, `/dev/data`, and the first breakpoint the walk has ever measured.
 *
 * The dev pages print their state with stable class hooks (`.toggle` + `.toggle-label`,
 * `.count` + `.count-label`, `.log`, `.cards .card`), so every assertion reads the *named* row
 * rather than a text position. The breakpoint row is the first one that does not run at 360×740:
 * it overrides the device metrics per width and **must** clear the override in a `finally`, or a
 * throw mid-loop leaves every later row laid out at 1200 and the failures read as layout bugs.
 * ---------------------------------------------------------------------------------------------- */

/** JS source for the `/dev/state` toggle whose `.toggle-label` is exactly `label`. */
const toggleSource = (label) =>
  `[...document.querySelectorAll("button.toggle")].find((e) => { const l = e.querySelector(".toggle-label"); return l && (l.innerText || "").trim() === ${JSON.stringify(label)}; })`;

/** The `aria-pressed` of that toggle — the render, and therefore what a reader sees. */
const toggleState = (label) =>
  js(`const el = ${toggleSource(label)}; return el ? el.getAttribute("aria-pressed") : "";`);

/**
 * Drive a toggle to a known state through the page's own control, then poll the *rendered*
 * `aria-pressed` for the value. The store's emit is a microtask after the press, so a single read
 * right after `click()` can still see the old state — polling for the value is what makes the
 * write proof rather than a race.
 */
async function setToggle(label, want) {
  const target = want ? "true" : "false";
  if ((await toggleState(label)) === target) return target;
  const pressed = await js(`
    const el = ${toggleSource(label)};
    if (!el) return "";
    el.scrollIntoView({ block: "center" });
    el.click();
    return el.getAttribute("aria-pressed");
  `);
  if (!pressed) throw new Error(`no toggle labelled ${JSON.stringify(label)} on ${await url()}`);
  return waitFor(
    `(() => { const el = ${toggleSource(label)}; const v = el ? el.getAttribute("aria-pressed") : ""; return v === ${JSON.stringify(target)} ? v : ""; })()`,
    `the "${label}" toggle to read ${target}`,
    6000,
  );
}

/**
 * One `.count` cell of the dev pages' counts strip, by its `.count-label`.
 *
 * The comparison is case-insensitive on purpose: `.count-label` carries `text-transform: uppercase`,
 * and `innerText` returns the **rendered** text ("SHOW", "LIKES"), not the source ("Show", "Likes").
 * A case-sensitive match finds nothing and reads as a missing cell rather than a casing difference.
 */
const storeCell = (label) =>
  js(`
    const wanted = ${JSON.stringify(label.toLowerCase())};
    const cell = [...document.querySelectorAll(".count")].find((c) => {
      const l = c.querySelector(".count-label");
      return l && (l.innerText || "").trim().toLowerCase() === wanted;
    });
    if (!cell) return "";
    const v = cell.querySelector(".count-value");
    return v ? v.innerText.trim() : "";
  `);

/** How many cards on this listing draw the cover — the only DOM fact the Blur preference has. */
async function coveredCards() {
  await waitFor(`document.querySelector(".card-grid") !== null`, "the card grid", 8000);
  await sleep(200);
  return js(`return document.querySelectorAll(".card.is-covered").length;`);
}

/**
 * Read one breakpoint. `Emulation.setDeviceMetricsOverride` is the only honest way to change the
 * viewport in this session (a CSS `data-theme`-style JS flip would change nothing; a window resize
 * would kill the profile's one browser). `mobile: false` keeps the desktop layout ladder — the
 * walk is measuring `sm`/`md`/`lg`, not a phone emulation.
 */
async function measureAt(width) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 740,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // Two frames for the media queries to settle: the ladder is CSS, and `getComputedStyle` reads
  // the winning rule, not a value that animates in.
  await sleep(260);
  return js(`
    const trackCount = (el) => {
      if (!el) return -1;
      const tracks = getComputedStyle(el).gridTemplateColumns.split(" ").filter((t) => t.trim() !== "");
      return tracks.length;
    };
    const section = (name) => [...document.querySelectorAll(".g-sec")].find((s) => {
      const h = s.querySelector(".g-sec-title");
      return h && (h.innerText || "").trim().toLowerCase() === name;
    });
    const buttonSec = section("button");
    const fieldSec = section("field");
    const heights = buttonSec ? [...buttonSec.querySelectorAll(".btn")].map((b) => b.getBoundingClientRect().height) : [];
    const rail = document.querySelector(".rail");
    const outlet = document.querySelector(".outlet");
    const tabbar = document.querySelector(".tabbar");
    return {
      viewport: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
      minButton: heights.length ? Math.round(Math.min(...heights)) : -1,
      grid: trackCount(document.querySelector(".card-grid")),
      fields: fieldSec ? trackCount(fieldSec.querySelector(".g-grid")) : -1,
      rail: rail ? Math.round(rail.getBoundingClientRect().width) : -1,
      outlet: outlet ? Math.round(outlet.getBoundingClientRect().width) : -1,
      tabbar: tabbar ? getComputedStyle(tabbar).display : "",
    };
  `);
}

/**
 * The ladder the stylesheet actually fixes: 1/2/3/3 card columns, one Field column then two, no
 * bottom bar at `md`, a rail that widens at `lg`.
 *
 * **The grid stops at three, on purpose** (`styles.css`, `.card-grid` @1200): the outlet is one A4
 * page wide (794px), so a fourth column would draw 163px cards with a 54px thumbnail. `DESIGN.md`
 * still claimed "1 / 2 / 3 / 4" until T-44 measured it and found three; the row asserts the
 * stylesheet's decision, and the docs line was corrected in the same commit.
 */
const BREAKPOINTS = [
  { width: 360, grid: 1, fields: 1, rail: 0 },
  { width: 640, grid: 2, fields: 2, rail: 0 },
  { width: 900, grid: 3, fields: 2, rail: 1 },
  { width: 1200, grid: 3, fields: 2, rail: 1 },
];

const rows = [];
const stamp = new Date().toISOString();

/**
 * Run one journey: record the row even when it throws, so the row shape is always whole.
 * `evidence` is the DOM fact the journey proved, not the click it made.
 */
async function journey(name, steps) {
  const started = Date.now();
  try {
    const evidence = await steps();
    rows.push({ journey: name, started, ended: Date.now(), evidence, ok: true });
    console.log(`  ok    ${name} — ${evidence}`);
    return true;
  } catch (error) {
    const last = pageErrors.pop();
    const detail = last ? `${error.message} (page exception: ${String(last).split("\n")[0].slice(0, 140)})` : error.message;
    rows.push({ journey: name, started, ended: Date.now(), evidence: `FAILED: ${detail}`, ok: false });
    console.log(`  FAIL  ${name} — ${detail}`);
    return false;
  }
}

const POST_2 = "/post/90570000-0000-4000-8000-000000000002";
/**
 * The post the walk reports. Chosen because the preview classifier's FNV bucket for its body is an
 * **escalation** (`mock.ts`: bucket 2/3/4 → unsure), which is what makes the report land on a case
 * instead of an immediate verdict — a report on a clean-pass post verifies the item and opens
 * nothing, and the journey would then prove nothing. Post 6 is the seeded removed one; 7 is NSFW.
 */
const POST_REPORTED = "/post/90570000-0000-4000-8000-000000000008";
const OWN_PRIVATE_CHARACTER = "/character/c0a1b2c3-0000-4000-8000-00000000001c";
/**
 * T-41 — the three authored forms that mount the same shape as `/character/[id]/edit` and had never
 * been opened by a session. Row 1 of each fixture type is the one `you` owns; rows 2+ belong to
 * `ada`, `bram` and `mira`, so they are the *forbidden* state and cannot be edited here.
 */
const OWN_LOREBOOK_EDIT = "/lorebook/10eb00c5-0000-4000-8000-000000000001/edit";
const OWN_PRESET_EDIT = "/preset/9e5e7000-0000-4000-8000-000000000001/edit";
const OWN_PERSONA_EDIT = "/persona/9e45014a-0000-4000-8000-000000000001/edit";
/** An id in the persona bucket that no row uses: personas read *missing* where the others forbid. */
const NO_PERSONA_EDIT = "/persona/9e45014a-0000-4000-8000-0000000000ff/edit";
/**
 * T-42 — the refusal states. Row 1 of every authored fixture is `you`; these rows belong to `ada`,
 * so opening their edit route is the **forbidden** arm, and the `…00ff` ids below are dead ids in
 * the **same bucket** (an id from the wrong bucket lands on the app's 404 and would prove nothing).
 * Personas are absent on purpose: a persona has no forbidden arm, and T-41 already walks its
 * `missing` sentence.
 */
const OTHER_CHARACTER_EDIT = "/character/c0a1b2c3-0000-4000-8000-000000000003/edit"; // ada
const OTHER_LOREBOOK_EDIT = "/lorebook/10eb00c5-0000-4000-8000-000000000002/edit"; // "Ashmarket Gazetteer", ada
const OTHER_PRESET_EDIT = "/preset/9e5e7000-0000-4000-8000-000000000002/edit"; // "Long Table", ada
const NO_CHARACTER_EDIT = "/character/c0a1b2c3-0000-4000-8000-0000000000ff/edit";
const NO_LOREBOOK_EDIT = "/lorebook/10eb00c5-0000-4000-8000-0000000000ff/edit";
const NO_PRESET_EDIT = "/preset/9e5e7000-0000-4000-8000-0000000000ff/edit";
const ownPost = `Smoke walk ${stamp.slice(11, 19)}: a body written by the walk itself.`;
const ownComment = `Smoke reply ${stamp.slice(11, 19)}: the comment the walk types.`;
const ownEntry = `Smoke entry ${stamp.slice(11, 19)}: a tide-mark typed into a block that did not exist.`;
const ownTagline = `Blunt, curious, and reading the whole ledger aloud (${stamp.slice(11, 19)}).`;
let newPostPath = "";

console.log(`smoke: ${BASE} @ 360x740`);

// Open the build once. Everything after this is in-app: a reload re-seeds the memory adapter.
await send("Page.navigate", { url: BASE });
await waitText("LuaPlot", 15000);
await sleep(600);

const badge = () =>
  js(`const el = [...document.querySelectorAll("a")].find((e) => /^Alerts/.test((e.getAttribute("aria-label") || e.innerText || "").trim())); return el ? el.getAttribute("aria-label") || el.innerText.trim() : "";`);

let unreadBefore = "";

const results = [];

results.push(
  await journey("sign in from /", async () => {
    await waitText("signed in as", 8000);
    await click("More");
    await click("Sign out");
    await waitText("signed out");
    // T-45 — two facts, because the press used to pass this row by *re-booting*: the control is
    // still a real anchor (an `href` a middle-click, a crawler and a no-JS visit can follow) and
    // pressing it is a **push**, not a document load.
    const entry = await js(`
      const el = document.querySelector(".entry a.btn");
      return el ? { href: el.getAttribute("href") || "", text: (el.innerText || "").trim() } : null;
    `);
    if (!entry) throw new Error("home's entry control is no longer an anchor");
    if (!entry.text.startsWith("Sign in")) throw new Error(`home's entry control reads ${JSON.stringify(entry.text)}, expected "Sign in"`);
    if (!entry.href.endsWith("/authentification")) throw new Error(`home's entry control points at ${entry.href}, not /authentification`);
    const mark = await markDocument("home-sign-in");
    await click("Sign in");
    await expectPath("/authentification", "home's Sign in");
    await waitText("Continue with Google", 8000);
    const kept = await expectNoReload(mark, "home's Sign in");

    /* T-83 — the entry screen's own `sm 640` block, which no row has ever rendered. Row 1 is the
     * only row that mounts `/authentification` and it does so at the session's own ~500px, so
     * `.providers, .nsfw, .status { max-width: 420px }` and the `.screen` `min-height` step
     * (`100dvh - 228px` → `- 240px`) had never run on the app's other entry screen.
     *
     * The ladder presses and types **nothing** — it sits between the push proof and the provider
     * press, so the press still happens at the session's own width and its `cancelled` outcome is
     * unchanged — and every override comes off in one `finally` that asserts `innerWidth` came
     * back (T-78's leak).
     *
     * Trap: nothing here touches `.providers .btn`. The buttons are the `Button` primitive and a
     * scoped rule on a primitive's element is pruned at compile time (T-82), so the box under test
     * is `.providers` — a page-owned element — and the column check reads its children's geometry,
     * not a declared rule. `.status` is read through `role="status"` beside its own box, because
     * the copy changes with the state and the role does not.
     */
    const readGate = () =>
      js(`
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const round = (n) => Math.round(n * 100) / 100;
          return { top: round(r.top), left: round(r.left), right: round(r.right), bottom: round(r.bottom), width: round(r.width), height: round(r.height) };
        };
        const screen = document.querySelector('.screen');
        const ss = screen ? getComputedStyle(screen) : null;
        const outlet = screen ? screen.parentElement : null;
        const os = outlet ? getComputedStyle(outlet) : null;
        const pad = os ? parseFloat(os.paddingLeft) + parseFloat(os.paddingRight) : 0;
        const outletContent = outlet ? Math.round((outlet.getBoundingClientRect().width - pad) * 100) / 100 : null;
        const providers = document.querySelector('.gate .providers');
        const ps = providers ? getComputedStyle(providers) : null;
        const status = document.querySelector('.gate .status');
        const sts = status ? getComputedStyle(status) : null;
        const nsfw = document.querySelector('.gate .nsfw');
        const ns = nsfw ? getComputedStyle(nsfw) : null;
        const rows = providers ? [...providers.children].map(box) : [];
        return {
          path: location.pathname,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          screen: box(screen),
          screenMinHeight: ss ? ss.minHeight : '',
          outlet: box(outlet),
          outletContent: outletContent,
          providers: box(providers),
          providersMaxWidth: ps ? ps.maxWidth : '',
          providersDirection: ps ? ps.flexDirection : '',
          providersGap: ps ? ps.gap : '',
          status: box(status),
          statusMaxWidth: sts ? sts.maxWidth : '',
          statusRole: !!document.querySelector('.gate .status [role="status"]'),
          nsfw: box(nsfw),
          nsfwMaxWidth: ns ? ns.maxWidth : '',
          rows: rows,
        };
      `);

    /** One width of the entry screen: the three capped boxes, their shared left edge, the order. */
    const assertGate = (r, width) => {
      const at = `/authentification at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!String(r.path).endsWith("/authentification")) {
        throw new Error(`${at}: the entry screen was measured on ${JSON.stringify(r.path)}, not /authentification`);
      }
      if (!r.screen || !r.outlet || !r.providers || !r.status || !r.nsfw) {
        throw new Error(
          `${at}: the entry screen is incomplete — screen ${JSON.stringify(r.screen)}, outlet ${JSON.stringify(r.outlet)}, providers ${JSON.stringify(r.providers)}, status ${JSON.stringify(r.status)}, nsfw ${JSON.stringify(r.nsfw)}`,
        );
      }
      if (!r.statusRole) {
        throw new Error(`${at}: the status line carries no role=status inside .status — the row reads the box and the role together, because the copy changes with the state`);
      }
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the entry screen scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }
      // Three providers, stacked: the children's own geometry is the column proof (the box's
      // `flex-direction` says what the block asks for, the tops say what the browser did).
      if (r.rows.length !== 3) {
        throw new Error(`${at}: .providers draws ${r.rows.length} control(s), not the spec's three providers`);
      }
      if (r.providersDirection !== "column") {
        throw new Error(`${at}: .providers computes flex-direction ${JSON.stringify(r.providersDirection)}, not the column the base block declares`);
      }
      for (let i = 1; i < r.rows.length; i++) {
        if (!(r.rows[i].top > r.rows[i - 1].top)) {
          throw new Error(`${at}: provider control ${i} tops at ${r.rows[i].top} and control ${i - 1} at ${r.rows[i - 1].top} — the three providers stack`);
        }
        if (Math.abs(r.rows[i].left - r.rows[0].left) > 1) {
          throw new Error(`${at}: provider control ${i} starts at ${r.rows[i].left} and the first at ${r.rows[0].left} — a column shares its left edge`);
        }
        if (r.rows[i].right > r.providers.right + 1) {
          throw new Error(`${at}: provider control ${i} ends at ${r.rows[i].right} past the .providers box's ${r.providers.right} — the buttons fill the measure, they do not overflow it`);
        }
      }

      if (width === 640 || width === 900) {
        // The cap is only a cap while the outlet is wider: read both numbers and print both.
        if (!(r.outletContent > 421)) {
          throw new Error(`${at}: the outlet's content box is ${r.outletContent} — a 420 cap on a box that narrow measures nothing (the ladder needs a wider column)`);
        }
        const capped = [
          ["providers", r.providers, r.providersMaxWidth],
          ["status", r.status, r.statusMaxWidth],
          ["nsfw", r.nsfw, r.nsfwMaxWidth],
        ];
        for (const [name, measured, maxWidth] of capped) {
          if (Math.abs(measured.width - 420) > 1) {
            throw new Error(`${at}: .${name} measures ${measured.width} in an outlet whose content box is ${r.outletContent} (${r.outlet.width} box) — the sm block caps it at 420`);
          }
          if (maxWidth !== "420px") {
            throw new Error(`${at}: .${name} measures ${measured.width} and computes max-width ${JSON.stringify(maxWidth)}, not the 420px the sm block declares`);
          }
        }
        // The DESIGN comment's own words — "the two left edges agree" — so the measure is one column.
        if (Math.abs(r.providers.left - r.nsfw.left) > 1) {
          throw new Error(`${at}: .providers starts at ${r.providers.left} and .nsfw at ${r.nsfw.left} — the capped boxes share a left edge`);
        }
        if (Math.abs(r.providers.left - r.status.left) > 1) {
          throw new Error(`${at}: .providers starts at ${r.providers.left} and .status at ${r.status.left} — the status line sits in the same measure`);
        }
        // Order, never tops: `.screen` centres its column, so a width change moves every box vertically.
        if (!(r.providers.bottom <= r.status.top + 1)) {
          throw new Error(`${at}: .providers ends at ${r.providers.bottom} and the status line starts at ${r.status.top} — the providers sit above it at every width`);
        }
        if (!(r.status.bottom <= r.nsfw.top + 1)) {
          throw new Error(`${at}: the status line ends at ${r.status.bottom} and the NSFW row starts at ${r.nsfw.top} — the single signed-out control is the last of the three`);
        }
        return;
      }

      // 360: the base block — no cap at all, all three fill the outlet's content box.
      for (const [name, measured, maxWidth] of [
        ["providers", r.providers, r.providersMaxWidth],
        ["status", r.status, r.statusMaxWidth],
        ["nsfw", r.nsfw, r.nsfwMaxWidth],
      ]) {
        if (Math.abs(measured.width - r.outletContent) > 1) {
          throw new Error(`${at}: .${name} measures ${measured.width} in an outlet content box of ${r.outletContent} — below 640 the boxes fill the column (the 420 cap is the sm block's)`);
        }
        if (maxWidth !== "none") {
          throw new Error(`${at}: .${name} still computes max-width ${JSON.stringify(maxWidth)} below the breakpoint — the sm cap has to clear`);
        }
      }
    };

    const gateRestore = await js("return window.innerWidth;");
    const gateMinHeight = {};
    const gateLines = [];
    let gateSeen = "";
    try {
      for (const width of [640, 900, 360]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        const gate = await readGate();
        assertGate(gate, width);
        gateMinHeight[width] = parseFloat(gate.screenMinHeight);
        gateLines.push(
          `${width}px: .providers ${gate.providers.left}→${gate.providers.right} ${gate.providers.width} max-width ${gate.providersMaxWidth} · .status ${gate.status.width} max-width ${gate.statusMaxWidth} · .nsfw ${gate.nsfw.width} max-width ${gate.nsfwMaxWidth} · outlet ${gate.outletContent} content / ${gate.outlet.width} box · .screen min-height ${gate.screenMinHeight}`,
        );
      }
      // The sm block subtracts 12 more from the same chrome sum. Compared, never pinned: the walk's
      // own window height is not the design's, so the *step* is the fact, not the two lengths.
      const step = gateMinHeight[360] - gateMinHeight[640];
      if (!(Number.isFinite(gateMinHeight[360]) && Number.isFinite(gateMinHeight[640]))) {
        throw new Error(`/authentification's .screen min-height reads ${JSON.stringify([gateMinHeight[360], gateMinHeight[640]])} at 360/640 — both have to resolve to a px length`);
      }
      if (Math.abs(step - 12) > 0.5) {
        throw new Error(
          `/authentification: .screen's min-height steps ${step}px from 360 (${gateMinHeight[360]}px) to 640 (${gateMinHeight[640]}px), not the sm block's 12 — the block is 100dvh - 228px then - 240px`,
        );
      }
      gateSeen = gateLines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const gateAfter = await js("return window.innerWidth;");
    if (gateAfter !== gateRestore) {
      throw new Error(`the entry screen's overrides cleared to ${gateAfter}px, but the session runs at ${gateRestore}px — a leaked override would mis-measure every later row`);
    }
    // No `go()` ran inside the ladder: the page is still the entry screen and the same document.
    await expectPath("/authentification", "the entry screen after its width ladder");
    await waitText("Continue with Google", 8000);

    // The provider button is a **stub** (`lib/auth.ts`: no session write until T-30), so the honest
    // assertion is the outcome it really produces — `cancelled`, nobody signed in. This row used to
    // pass because home's entry control is an `<a>` with no `follow()`, so pressing it hard-reloaded
    // the app and the boot re-seeded the mock: it was asserting the seed bug T-33B removed.
    await click("Continue with Google");
    await waitText("sign-in was cancelled", 8000);
    await go("/");
    await waitText("signed out", 8000);
    // The one control that really does write the session in the preview: the menu's own switch.
    await click("More");
    await click("Sign in as @you");
    await waitText("signed in as You", 8000);
    const label = await badge();
    if (!label.startsWith("Alerts")) throw new Error("the tab bar lost its Alerts destination");
    return `the provider button answers cancelled and signs nobody in; the menu's switch signs in as You; the control pushed (${kept}); the sm 640 measure ${gateSeen}`;
  }),
);

/**
 * T-45 — the arm no row had walked: signed in, the same control points at `/user/{handle}`.
 *
 * It is also the only row that presses the entry control while a session exists, so it is what
 * catches a `follow()` bound to the **signed-out** path after the session changed: the target is a
 * `track()`ed value, and a captured string would push `/authentification` here. The owner-only
 * *Edit profile* action is the extra assertion — it proves the session reached the page, not just
 * the path.
 */
results.push(
  await journey("profile from /", async () => {
    await go("/");
    await waitText("signed in as You", 8000);
    const entry = await js(`
      const el = document.querySelector(".entry a.btn");
      return el ? { href: el.getAttribute("href") || "", text: (el.innerText || "").trim() } : null;
    `);
    if (!entry) throw new Error("home's entry control is no longer an anchor");
    if (!entry.text.startsWith("Open profile")) throw new Error(`the signed-in control reads ${JSON.stringify(entry.text)}, expected "Open profile"`);
    if (!/\/user\/you$/.test(entry.href)) throw new Error(`the signed-in control points at ${entry.href}, not /user/you`);
    const mark = await markDocument("home-open-profile");
    await click("Open profile");
    await expectPath("/user/you", "home's Open profile");
    await waitText("Edit profile", 8000);
    const kept = await expectNoReload(mark, "home's Open profile");
    return `Open profile pushes to @you's own profile with the owner actions visible; ${kept}`;
  }),
);

/**
 * T-46 — the app-wide half of T-45's lesson, walked from the page a session actually lands on.
 *
 * *Edit profile* is the only **primary** action left that was a bare `<a href>`: pressing it
 * re-booted the app, so the mock re-seeded and any half-written form state vanished. The assertion
 * is document identity (`expectNoReload`), because `expectPath` alone cannot see a load — a fresh
 * document at the same path reads green (the T-45 failure bank entry).
 */
results.push(
  await journey("press Edit profile on /user/you (a push, not a load)", async () => {
    await go("/user/you");
    await waitText("Edit profile", 8000);
    const link = await js(`
      const el = [...document.querySelectorAll("a")].find((a) => (a.innerText || "").trim() === "Edit profile");
      return el ? { href: el.getAttribute("href") || "" } : null;
    `);
    if (!link) throw new Error("/user/you has no Edit profile action");
    if (!/\/user\/you\/edit$/.test(link.href)) throw new Error(`Edit profile points at ${link.href}`);
    const mark = await markDocument("profile-edit");
    await click("Edit profile");
    await expectPath("/user/you/edit", "Edit profile");
    await waitText("Edit profile", 8000);
    await waitFor(
      `document.querySelector('input[name="displayName"]') !== null`,
      "the account form's Display name field",
      8000,
    );
    const kept = await expectNoReload(mark, "Edit profile");
    return `Edit profile pushes to /user/you/edit and mounts the account form; ${kept}`;
  }),
);

results.push(
  await journey("publish a post from /post/create", async () => {
    await click("Thread");
    await waitUrl("/post/thread");
    await waitText("SORT", 8000);
    await click("Create");
    await waitUrl("/post/create");
    await waitFor(`document.querySelector("textarea") !== null`, "the composer", 8000);
    await type("textarea", ownPost);
    await click("Publish");
    await waitFor(`/\\/post\\/[0-9a-f-]{36}$/.test(location.pathname)`, "the new post's own page", 8000);
    newPostPath = await url();
    await waitText(ownPost);
    return `landed on ${newPostPath} printing the body back`;
  }),
);

results.push(
  await journey("comment on it", async () => {
    await waitFor(`document.querySelector("textarea") !== null`, "the comment composer", 8000);
    await type("textarea", ownComment);
    await click("Post comment");
    await waitText(ownComment, 8000);
    return "the thread prints the comment it just wrote";
  }),
);

results.push(
  await journey("vote on it", async () => {
    const exists = await js(`return [...document.querySelectorAll("button")].some((e) => (e.innerText || "").trim().toLowerCase().startsWith("like"));`);
    if (!exists) throw new Error("the post has no Like control");
    if ((await pressed("Like")) !== "false") throw new Error("Like was already pressed on a brand-new post");
    await click("Like", { exact: false });
    await waitFor(`document.querySelector('button[aria-pressed="true"]') !== null`, "a pressed vote");
    const state = await pressed("Like");
    if (state !== "true") throw new Error(`Like reports aria-pressed=${state} after the click`);
    return "the Like control reports aria-pressed=true";
  }),
);

results.push(
  await journey("save it and unsave it from /bookmarks", async () => {
    await click("Bookmark");
    await waitFor(`[...document.querySelectorAll("button")].some((e) => (e.getAttribute("aria-label") || e.innerText || "").trim().toLowerCase().startsWith("remove bookmark"))`, "the bookmark to read as saved");
    await go("/bookmarks?type=post");
    await waitFor(`document.body.innerText.includes(${JSON.stringify(ownPost.slice(0, 24))})`, "the post card in the Posts tab", 8000);
    await click("Remove bookmark");
    await waitFor(`!document.body.innerText.includes(${JSON.stringify(ownPost.slice(0, 24))})`, "the card to leave the grid", 8000);
    return "the card left the Posts grid after Remove bookmark";
  }),
);

results.push(
  await journey("follow and unfollow a profile", async () => {
    await go("/user/mira");
    await waitFor(`[...document.querySelectorAll("button")].some((e) => ["Follow", "Unfollow"].includes((e.innerText || "").trim()))`, "the follow control", 8000);
    // Seeded state: the fixture account already follows mira, so normalise to "Follow" first —
    // the journey is the pair, not one direction of it.
    if (await js(`return [...document.querySelectorAll("button")].some((e) => (e.innerText || "").trim() === "Unfollow");`)) {
      await click("Unfollow", { exact: true });
    }
    await waitFor(`[...document.querySelectorAll("button")].some((e) => (e.innerText || "").trim() === "Follow")`, "the control to read Follow", 8000);
    await click("Follow", { exact: true });
    await waitFor(`[...document.querySelectorAll("button")].some((e) => (e.innerText || "").trim() === "Unfollow")`, "the control to read Unfollow", 8000);
    await click("Unfollow", { exact: true });
    await waitFor(`[...document.querySelectorAll("button")].some((e) => (e.innerText || "").trim() === "Follow")`, "the control to read Follow again", 8000);
    return "mira's profile control walked Follow → Unfollow → Follow";
  }),
);

results.push(
  await journey("open a character and start a session", async () => {
    await go("/character/c0a1b2c3-0000-4000-8000-000000000002");
    await waitText("Sonic the Hedgehog");
    await click("Start a session");
    await waitFor(`/\\/session\\/[0-9a-f-]{36}$/.test(location.pathname)`, "the session route", 8000);
    await waitFor(`document.querySelector("textarea") !== null`, "the turn composer");
    return `a new session opened at ${await url()} with a turn composer`;
  }),
);

results.push(
  await journey("edit an own character (unlocks Request public again)", async () => {
    await go(OWN_PRIVATE_CHARACTER);
    await waitText("Request public again", 8000);
    const lockedFirst = await js(`const el=[...document.querySelectorAll("button")].find((e)=>(e.innerText||"").trim()==="Request public again"); return el ? el.disabled : null;`);
    if (lockedFirst !== true) throw new Error(`Request public again is enabled before an edit (disabled=${lockedFirst})`);
    await click("Character settings", { exact: true });
    await waitFor(`[...document.querySelectorAll("button,a")].some((e) => (e.innerText || "").trim() === "Edit")`, "the settings menu", 6000);
    await click("Edit", { exact: true });
    await waitUrl("/edit", 8000);
    await waitFor(`document.querySelector("textarea") !== null`, "the edit form", 8000);
    await type("textarea", " Edited by the smoke walk.");
    await click("Save changes");
    await waitFor(`location.pathname.endsWith(${JSON.stringify(OWN_PRIVATE_CHARACTER)})`, "the character page after saving", 8000);
    const unlocked = await js(`const el=[...document.querySelectorAll("button")].find((e)=>(e.innerText||"").trim()==="Request public again"); return el ? !el.disabled : null;`);
    if (unlocked !== true) throw new Error(`Request public again is still locked after saving (${unlocked})`);
    return "the request control went disabled → enabled after Save changes";
  }),
);

results.push(
  await journey("open a second edit form (the fields follow the URL)", async () => {
    // T-40's other half. The report was "a first read sees the previously opened character's name";
    // it does not, because `/character/[id]/edit` mounts `CharacterForm` only inside its *ready*
    // branch — but nothing in the walk proved that, and the hypothesis was written down twice.
    // Two own characters, an in-app hop between their edit routes, and two reads: the assertion is
    // on identity (the name equals the URL's character), never on elapsed time.
    await go("/character/c0a1b2c3-0000-4000-8000-000000000001/edit");
    await waitFor(`document.querySelector("form input") !== null`, "the first edit form", 8000);
    await waitFor(`(() => { const el = document.querySelector("form input"); return el && el.value === "Aurelia of the Tides"; })()`, "the first form to be pre-filled", 6000);

    await go("/character/c0a1b2c3-0000-4000-8000-00000000001c/edit");
    const first = await waitFor(
      `(() => { const el = document.querySelector("form input"); return el && el.value === "Iolande, Second Ledger" ? el.value : ""; })()`,
      "the second form to be pre-filled from its own row",
      6000,
    );
    await sleep(600);
    const second = await formName();
    if (second !== first) throw new Error(`the name field read "${first}" then "${second}"`);
    if (second === "Aurelia of the Tides") throw new Error("the form kept the previous character's name");
    return `both reads on /character/…1c/edit printed "${second}"`;
  }),
);

results.push(
  await journey("edit an own lorebook (a new entry reaches the page)", async () => {
    // T-41. `LorebookForm` has had two hosts since T-18 and no session had ever opened the edit
    // one: the preload and the write were both assumptions. Edit, not create (the baton's choice per
    // form): it proves the preload *and* the write in one step, and the row budget stays honest.
    await go(OWN_LOREBOOK_EDIT);
    await waitFor(`document.querySelector("form input") !== null`, "the lorebook form", 8000);
    const first = await waitFor(
      `(() => { const el = document.querySelector("form input"); return el && el.value === "The Salt Archive" ? el.value : ""; })()`,
      "the form to be pre-filled from its own row",
      6000,
    );
    await sleep(600);
    const second = await formName();
    if (second !== first) throw new Error(`the name field read "${first}" then "${second}"`);

    // The entry list is the only thing on this form the character form does not have, so the write
    // is proven by adding one block — the one road into `repo.updateLorebook` that a name alone
    // cannot walk.
    const keywords = 'input[placeholder="king, court, throne"]';
    const content = 'textarea[placeholder="What is injected into the session when an entry matches."]';
    const blocks = await js(`return document.querySelectorAll(${JSON.stringify(keywords)}).length;`);
    if (blocks !== 4) throw new Error(`The Salt Archive preloaded ${blocks} entry blocks, not 4`);
    await click("Add entry", { exact: true });
    await waitFor(
      `document.querySelectorAll(${JSON.stringify(keywords)}).length === ${blocks + 1}`,
      "the new entry block",
      6000,
    );
    await retype(keywords, "tide-mark", blocks);
    await retype(content, ownEntry, blocks);

    await click("Save changes", { exact: true });
    // **Base-agnostic**, like `go()`: the preview serves `/lorebook/…` and Pages serves
    // `/LuaPlot/lorebook/…`, so an `^/`-anchored test passes locally and fails on the live walk.
    // Found by the first `smoke.sh --live` of this step (T-41) — the reason the live walk exists.
    await waitFor(`/\\/lorebook\\/[0-9a-f-]{36}$/.test(location.pathname)`, "the lorebook's own page after saving", 8000);
    await waitText(ownEntry, 8000);
    await waitText("tide-mark", 8000);
    return `the list grew ${blocks} → ${blocks + 1} and the detail page prints the entry and its keyword`;
  }),
);

results.push(
  await journey("edit an own preset (the settings save, the siblings survive)", async () => {
    // T-41. A preset is the one authored form carrying a `settings` object, so a save that dropped
    // a sibling field is exactly the defect a name-only assertion would miss: the model changes and
    // the description is asserted *unchanged* on the far side of the same write.
    await go(OWN_PRESET_EDIT);
    await waitFor(`document.querySelector("form input") !== null`, "the preset form", 8000);
    await waitFor(
      `(() => { const el = document.querySelector("form input"); return el && el.value === "Quiet Draft"; })()`,
      "the form to be pre-filled from its own row",
      6000,
    );
    // The preload nobody had read: the stored model, before anything is touched.
    const before = await choose("select.select-input", "deepseek-chat");
    await choose("select.select-input", "deepseek-reasoner");

    await click("Save changes", { exact: true });
    await waitFor(`/\\/preset\\/[0-9a-f-]{36}$/.test(location.pathname)`, "the preset's own page after saving", 8000);
    await waitFor(
      `document.querySelector('section[aria-label="Generation settings"]') !== null`,
      "the detail page's settings list",
      8000,
    );
    await waitFor(
      `(() => {
         const s = document.querySelector('section[aria-label="Generation settings"]');
         return s && /deepseek-reasoner/.test(s.innerText) ? s.innerText.replace(/\\s+/g, " ").trim() : "";
       })()`,
      "the detail page to print the model that was chosen",
      8000,
    );
    const model = await settingValue("Model");
    if (model !== "deepseek-reasoner") throw new Error(`the settings row reads "${model}" after the save`);
    const body = await text();
    if (!body.includes("Quiet Draft")) throw new Error("the detail page lost the preset's name");
    if (!/Tuned for scene-setting/.test(body)) throw new Error("a settings-only save dropped the description");
    return `model ${before} → ${model}, and the description survived the same write`;
  }),
);

results.push(
  await journey("edit an own persona (and the state that replaces forbidden)", async () => {
    // T-41. Personas are personal, so this form has **no `forbidden` phase** — an id that is not
    // the viewer's is *missing* — and that is the state difference from the three authored forms
    // worth walking. The write is proven on the detail page and again on the collection card.
    await go(OWN_PERSONA_EDIT);
    await waitFor(`document.querySelector("form input") !== null`, "the persona form", 8000);
    await waitFor(
      `(() => { const el = document.querySelector("form input"); return el && el.value === "Nell"; })()`,
      "the form to be pre-filled from its own row",
      6000,
    );
    await retype('input[placeholder="Blunt, curious, asks the question nobody wants."]', ownTagline);

    await click("Save changes", { exact: true });
    await waitFor(`/\\/persona\\/[0-9a-f-]{36}$/.test(location.pathname)`, "the persona's own page after saving", 8000);
    await waitText(ownTagline, 8000);
    await go("/persona");
    await waitText(ownTagline, 8000);

    // Personas answer one sentence for both "gone" and "not yours"; there is no second refusal.
    await go(NO_PERSONA_EDIT);
    await waitText("This persona doesn't exist in your collection.", 8000);
    return "the tagline reached the detail page and the collection; an unowned id reads \"doesn't exist in your collection\"";
  }),
);

/**
 * T-42 — the six refusals, three journeys of **two hops each** (19 rows, not 22).
 *
 * The baton left the choice open. One row per hop would double the table without adding a fact:
 * each hop is a fresh route with a fresh page mount, so the two assertions inside a journey are
 * already independent evidence, and the second hop's failure message names its own path. A row per
 * *type* keeps the table readable and keeps the sign-out journey last, which matters because a
 * signed-out viewer reads these three pages as `forbidden` too — the signed-out journey must not
 * come first.
 *
 * Every hop asserts three things through `refusal()`: the page's own sentence, that no `<form>`
 * mounted, and that the `Back to catalog` action resolves under the served base to *that type's*
 * catalog. A refusal with no road out is a dead end, and the copy alone would let it rot.
 */
results.push(
  await journey("refuse another author's character (forbidden, then missing)", async () => {
    await go(OTHER_CHARACTER_EDIT);
    const forbidden = await refusal("This character isn't yours to edit.", "/character/catalog");
    await go(NO_CHARACTER_EDIT);
    const missing = await refusal("This character doesn't exist.", "/character/catalog");
    return `ada's row → ${forbidden} | a dead id in the same bucket → ${missing}`;
  }),
);

results.push(
  await journey("refuse another author's lorebook (forbidden, then missing)", async () => {
    await go(OTHER_LOREBOOK_EDIT);
    const forbidden = await refusal("This lorebook isn't yours to edit.", "/lorebook/catalog");
    await go(NO_LOREBOOK_EDIT);
    const missing = await refusal("This lorebook doesn't exist.", "/lorebook/catalog");
    return `Ashmarket Gazetteer → ${forbidden} | a dead id in the same bucket → ${missing}`;
  }),
);

results.push(
  await journey("refuse another author's preset (forbidden, then missing)", async () => {
    await go(OTHER_PRESET_EDIT);
    const forbidden = await refusal("This preset isn't yours to edit.", "/preset/catalog");
    await go(NO_PRESET_EDIT);
    const missing = await refusal("This preset doesn't exist.", "/preset/catalog");
    return `Long Table → ${forbidden} | a dead id in the same bucket → ${missing}`;
  }),
);

results.push(
  await journey("report a post and land on the case", async () => {
    await go(POST_REPORTED);
    await waitFor(`[...document.querySelectorAll("button")].some((e) => (e.innerText || "").trim() === "Report")`, "the post's actions", 8000);
    await click("Report", { exact: true });
    await waitText("What are you reporting?");
    await click("Text");
    await click("Continue");
    await waitText("Why?");
    await click("Copied text");
    await click("Continue");
    await waitText("Where was it copied from?");
    await type('input:not([type="checkbox"]):not([type="radio"])', "https://example.com/the-original");
    await click("Continue");
    await sleep(400);
    await clickAny(["Submit report", "Send report", "Send report to moderation", "Submit", "Report post", "Send"], { exact: true });
    await waitFor(`!document.body.innerText.includes("Submitting")`, "the report write to land", 10000);
    const confirmation = await js(`const d=[...document.querySelectorAll("[role=dialog],.sheet,.dialog")].map((e)=>e.innerText.replace(/\\s+/g," ").trim()).join(" / "); return d.slice(-120);`);
    const afterSubmit = await text();
    await go("/moderation?admin=1");
    await waitText("Queue", 8000);
    await waitFor(`document.body.innerText.includes("open ·")`, "the queue counts", 8000);
    const queueText = await (async () => {
      for (let i = 0; i < 40; i++) {
        const seen = await text();
        if (seen.includes("4 open")) return seen;
        await sleep(200);
      }
      return await text();
    })();
    if (!queueText.includes("4 open")) {
      throw new Error(`queue says: ${queueText.slice(0, 120)} | dialog after submit: ${confirmation || afterSubmit.slice(-120)}`);
    }

    // 1b. The queue at the three widths its own stylesheet draws it for (T-85). `moderation-queue`'s
    //     `sm 640` block is a step a reader can see — the 44px numeral column becomes 56, the numeral
    //     20 → 26, the row `14px 0` → `16px 0`, the title 24 → 28, the label 15 → 16, `.causes`/`.meta`
    //     12 → 13 — and the `md 900` block pads the toolbar to 10px. This row's own mount is the
    //     walk's ~500px, below the breakpoint, so not one declaration of it had ever been rendered.
    //     It runs **after** the mount assertions and **before** the next row presses a verdict, so the
    //     case it concludes is still the one the queue drew; nothing here presses, types or navigates.
    const readQueue = () =>
      js(`
        const round = (n) => Math.round(n * 100) / 100;
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom), width: round(r.width) };
        };
        const all = [...document.querySelectorAll(".row")];
        const first = all.find((row) => row.querySelector(".weight"));
        const cell = first ? (() => {
          const weight = first.querySelector(".weight");
          const label = first.querySelector(".label");
          const causes = first.querySelector(".causes");
          const meta = first.querySelector(".meta");
          const rs = getComputedStyle(first);
          const ws = getComputedStyle(weight);
          return {
            concluded: first.classList.contains("is-concluded"),
            box: box(first),
            weightBox: box(weight),
            weightText: (weight.textContent || "").trim(),
            weightFont: ws.fontSize,
            weightColor: ws.color,
            padTop: rs.paddingTop,
            padBottom: rs.paddingBottom,
            labelFont: label ? getComputedStyle(label).fontSize : "",
            causesFont: causes ? getComputedStyle(causes).fontSize : "",
            metaFont: meta ? getComputedStyle(meta).fontSize : "",
          };
        })() : null;
        const colWeight = document.querySelector(".col-weight");
        const title = document.querySelector(".title");
        const toolbar = document.querySelector(".toolbar");
        return {
          path: location.pathname,
          search: location.search,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          rows: all.length,
          skeletons: document.querySelectorAll(".skel-row").length,
          cell,
          colWeight: box(colWeight),
          colWeightText: colWeight ? (colWeight.textContent || "").trim() : "",
          titleFont: title ? getComputedStyle(title).fontSize : "",
          toolbarPadBottom: toolbar ? getComputedStyle(toolbar).paddingBottom : "",
        };
      `);

    /**
     * The sm block's six members plus the md padding. The header's `.col-weight` and the row's
     * `.weight` are **two elements** one selector list gives the same width (T-83's lesson), so both
     * are measured and each failure names its own; a font-size assertion is only ever taken on the
     * page's own text, never on a `Button` primitive the scoped block cannot reach (T-82).
     */
    const assertQueue = (r, width) => {
      const at = `/moderation at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!r.path.endsWith("/moderation")) {
        throw new Error(`${at}: the queue was measured on ${JSON.stringify(r.path)} — a ladder that navigates proves another page's facts`);
      }
      if (r.skeletons !== 0) {
        throw new Error(`${at}: ${r.skeletons} .skel-row(s) still draw — a skeleton has a .skel-weight, not a .weight numeral, and the sm block is the numeral's`);
      }
      if (!r.cell) {
        throw new Error(`${at}: no drawn .row carries a .weight numeral (${r.rows} row(s)) — the queue drew no case to measure`);
      }
      if (!r.colWeight) {
        throw new Error(`${at}: the queue draws ${r.rows} row(s) and no .col-head .col-weight — the one-time weight/case header is missing`);
      }
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the queue scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }

      const col = r.cell.weightBox.width;
      const head = r.colWeight.width;

      if (width === 360) {
        if (Math.abs(col - 44) > 1) {
          throw new Error(
            `${at}: the row's .weight numeral column measures ${col}px (${r.cell.weightBox.left}→${r.cell.weightBox.right}), not the base block's 44px — the sm block's 56px column is leaking below its breakpoint`,
          );
        }
        if (Math.abs(head - 44) > 1) {
          throw new Error(
            `${at}: the header's .col-weight measures ${head}px (${r.colWeight.left}→${r.colWeight.right}), not the base block's 44px — it is the same selector list as .weight, so the two must not disagree`,
          );
        }
        if (r.cell.weightFont !== "20px") {
          throw new Error(`${at}: the numeral computes ${r.cell.weightFont}, not the base 20px — the sm font step is leaking below 640`);
        }
        if (r.cell.padTop !== "14px" || r.cell.padBottom !== "14px") {
          throw new Error(`${at}: the row's padding computes ${r.cell.padTop}/${r.cell.padBottom}, not the base 14px/14px`);
        }
        if (r.titleFont !== "24px") throw new Error(`${at}: .title computes ${r.titleFont}, not the base 24px`);
        if (r.cell.labelFont !== "15px") throw new Error(`${at}: .label computes ${r.cell.labelFont}, not the base 15px`);
        if (r.cell.causesFont !== "12px" || r.cell.metaFont !== "12px") {
          throw new Error(`${at}: .causes/.meta compute ${r.cell.causesFont}/${r.cell.metaFont}, not the base 12px`);
        }
        if (r.toolbarPadBottom === "10px") {
          throw new Error(`${at}: the toolbar's padding-bottom computes the md 10px below its breakpoint`);
        }
        return;
      }

      // 640 and 900 — the step itself, and (at 900) the md block that must not undo it.
      if (Math.abs(col - 56) > 1) {
        throw new Error(
          `${at}: the row's .weight numeral column measures ${col}px (${r.cell.weightBox.left}→${r.cell.weightBox.right}) around the numeral ${JSON.stringify(r.cell.weightText)}, not the 56px the sm block's \`.weight, .col-weight\` list declares — row ${r.cell.box.left}→${r.cell.box.right}, header column ${head}px`,
        );
      }
      if (Math.abs(head - 56) > 1) {
        throw new Error(
          `${at}: the header's .col-weight measures ${head}px (${r.colWeight.left}→${r.colWeight.right}), not the 56px the sm block's \`.weight, .col-weight\` list declares — the row's numeral column measures ${col}px, so the two members of that list disagree`,
        );
      }
      if (r.cell.weightFont !== "26px") {
        throw new Error(
          `${at}: the numeral's font-size computes ${r.cell.weightFont}, not the 26px the sm block's own \`.weight { font-size }\` rule declares — the column stepped (${col}px) but the numeral did not, and the block gives them in two separate rules`,
        );
      }
      if (r.cell.padTop !== "16px" || r.cell.padBottom !== "16px") {
        throw new Error(`${at}: the row's padding computes ${r.cell.padTop}/${r.cell.padBottom}, not the sm 16px/16px (base is 14px)`);
      }
      if (r.titleFont !== "28px") throw new Error(`${at}: .title computes ${r.titleFont}, not the sm 28px (base is 24px)`);
      if (r.cell.labelFont !== "16px") throw new Error(`${at}: .label computes ${r.cell.labelFont}, not the sm 16px (base is 15px)`);
      if (r.cell.causesFont !== "13px" || r.cell.metaFont !== "13px") {
        throw new Error(`${at}: .causes/.meta compute ${r.cell.causesFont}/${r.cell.metaFont}, not the sm 13px (base is 12px)`);
      }
      if (width === 900 && r.toolbarPadBottom !== "10px") {
        throw new Error(`${at}: the toolbar's padding-bottom computes ${r.toolbarPadBottom}, not the md block's 10px — the only declaration that block makes on this page`);
      }
    };

    const queueRestore = await js("return window.innerWidth;");
    const queueBefore = await readQueue();
    const queueLines = [];
    let queueSeen = "";
    try {
      for (const width of [640, 900, 360]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        await waitFor(`document.querySelector(".row .weight") !== null`, `the queue's first numeral at ${width}px`, 10000);
        const r = await readQueue();
        assertQueue(r, width);
        queueLines.push(
          `${width}px: .row ${r.cell.weightBox.left}→${r.cell.weightBox.right} (.weight ${r.cell.weightBox.width} wide, numeral ${r.cell.weightFont} ${JSON.stringify(r.cell.weightText)}, ${r.cell.weightColor}) · .col-weight ${r.colWeight.width} (${JSON.stringify(r.colWeightText)}) · row padding ${r.cell.padTop}/${r.cell.padBottom} · title ${r.titleFont} · label ${r.cell.labelFont} · causes ${r.cell.causesFont} · meta ${r.cell.metaFont} · toolbar padding-bottom ${r.toolbarPadBottom} · ${r.rows} row(s)`,
        );
      }
      queueSeen = queueLines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const queueAfter = await js("return window.innerWidth;");
    if (queueAfter !== queueRestore) {
      throw new Error(`the queue's overrides cleared to ${queueAfter}px, but the session runs at ${queueRestore}px — a leaked override would mis-measure every later row`);
    }
    const back = await readQueue();
    if (!back.path.endsWith("/moderation") || back.search !== "?admin=1" || back.rows !== queueBefore.rows) {
      throw new Error(
        `the width phase left ${JSON.stringify(back.path + back.search)} with ${back.rows} case(s), not the bare /moderation?admin=1 with ${queueBefore.rows} the mount drew — the ladder navigated, so the verdict row would land on a fresh queue`,
      );
    }
    return `the report closed the dialog and the queue went 3 open → 4 open; the sm step rendered — ${queueSeen}`;
  }),
);

results.push(
  await journey("conclude a case as removed (the item panel follows)", async () => {
    await go("/moderation/4e90047a-0000-4000-8000-000000000002?admin=1");
    await waitText("Case");
    await waitText("Removed");
    // T-40: the panel is evidence, so it has to read what the item *is*. Before the conclusion the
    // post is visible; reading that first is what makes the after-read a fact and not a guess.
    const before = await itemPanel();
    if (!before) throw new Error("the case page draws no THE ITEM panel");
    if (/removed/i.test(before)) throw new Error(`the item panel already read "removed" before any action: ${before}`);
    await type("textarea", "Smoke walk: confirmed the copy claim.");
    await click("Conclude case");
    await waitFor(`document.body.innerText.includes("Concluded")`, "the case to read Concluded", 8000);
    // No reload between the two reads: a reload re-seeds the adapter and would prove nothing.
    const after = await waitFor(
      `(() => { const h = [...document.querySelectorAll("h2")].find((el) => (el.innerText || "").trim().toLowerCase() === "the item"); const s = h && h.closest("section"); const t = s ? s.innerText.replace(/\\s+/g, " ").trim() : ""; return /removed/i.test(t) ? t : ""; })()`,
      "the item panel to print the removal",
      8000,
    );
    if (!/thread went with it/i.test(after)) throw new Error(`the panel says the post is removed but names no consequence: ${after}`);
    return `the panel went "${before.slice(0, 40)}…" → "${after.slice(0, 52)}…" without a reload`;
  }),
);

results.push(
  await journey("read a notification (the badge drops)", async () => {
    await click("Alerts");
    await waitUrl("/notifications");
    await waitFor(`document.querySelectorAll(".row.is-unread").length > 0`, "an unread row", 8000);
    const before = await js(`return document.querySelectorAll(".row.is-unread").length;`);
    unreadBefore = await badge();
    await realClick("li.row.is-unread a", 0);
    // Opening a row navigates away, so the inbox is re-entered to read the count — the adapter keeps
    // the write, which is exactly what the journey is proving.
    await go("/notifications");
    await waitFor(`document.querySelectorAll(".row.is-unread").length === ${before - 1}`, "one row to lose its unread mark", 8000);
    const after = await badge();
    if (after === unreadBefore) throw new Error(`the badge still reads "${after}" after opening a row (${before} unread rows before)`);

    // 1b. The inbox at the three widths its own stylesheet draws it for (T-86). `notifications.tsrx`'s
    //     `sm 640` block is a step a reader can see — the row's `padding-left` 12 → 16, its `gap`
    //     10 → 12, the `.sentence` 14 → 15 and `.title` 24 → 28 — and the `md 900` block pads the
    //     toolbar 4 → 8 (its only declaration on this page). The row's own mount is the walk's ~500px,
    //     below the breakpoint, so no declaration of either block had ever been rendered.
    //
    //     It runs **last**, after the badge re-read, because this row's whole proof is
    //     `unreadBefore → after`: its two controls are real writes, and a width phase before them
    //     would be measuring a list it is about to change. Nothing here presses, types or navigates —
    //     the no-write proof is the row count *and* the unread count, read before and after (the
    //     route carries no query, so the URL cannot prove it).
    const readInbox = () =>
      js(`
        const round = (n) => Math.round(n * 100) / 100;
        const all = [...document.querySelectorAll(".rows .row")];
        const first = all.find((row) => row.querySelector(".sentence"));
        const cell = first ? (() => {
          const sentence = first.querySelector(".sentence");
          const rs = getComputedStyle(first);
          const ss = getComputedStyle(sentence);
          const r = first.getBoundingClientRect();
          return {
            classes: first.className,
            unread: first.classList.contains("is-unread"),
            box: { left: round(r.left), right: round(r.right), width: round(r.width) },
            padLeft: rs.paddingLeft,
            gap: rs.gap,
            sentenceFont: ss.fontSize,
            sentenceWeight: ss.fontWeight,
            sentenceColor: ss.color,
            text: (sentence.textContent || "").trim().slice(0, 56),
          };
        })() : null;
        const title = document.querySelector(".title");
        const toolbar = document.querySelector(".toolbar");
        const skel = document.querySelector(".skel-row");
        return {
          path: location.pathname,
          search: location.search,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          rows: all.length,
          unreadRows: document.querySelectorAll(".rows .row.is-unread").length,
          skeletons: document.querySelectorAll(".skel-row").length,
          skelPadLeft: skel ? getComputedStyle(skel).paddingLeft : "",
          cell,
          titleFont: title ? getComputedStyle(title).fontSize : "",
          toolbarPadBottom: toolbar ? getComputedStyle(toolbar).paddingBottom : "",
        };
      `);

    /**
     * The sm block's four members plus the md padding. Every failure names the element it read —
     * the row (with its own class list) and the sentence are **separate rules of the same block**, so
     * the padding and the font-size are asserted apart and a red proof cannot confuse the two.
     * The unread mark is a `box-shadow` inset, so padding is never inferred from geometry, and
     * `.row.is-unread .sentence` sets a colour and a weight — this reader asserts **font-size only**
     * and keeps the other two as evidence.
     */
    const assertInbox = (r, width) => {
      const at = `/notifications at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!r.path.endsWith("/notifications")) {
        throw new Error(`${at}: the inbox was measured on ${JSON.stringify(r.path)} — a ladder that navigates proves another page's facts`);
      }
      if (r.skeletons !== 0) {
        throw new Error(`${at}: ${r.skeletons} .skel-row(s) still draw — a skeleton carries .skel-lines, not .sentence, and the sm block is the sentence's`);
      }
      if (!r.cell) {
        throw new Error(`${at}: no drawn .rows .row carries a .sentence (${r.rows} row(s)) — the inbox drew no notification to measure`);
      }
      if (!r.toolbarPadBottom) {
        throw new Error(`${at}: the inbox draws no .toolbar — the md block's only declaration on this page has no box to land on`);
      }
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the inbox scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }

      const base = width === 360;
      const want = {
        padLeft: base ? "12px" : "16px",
        gap: base ? "10px" : "12px",
        sentence: base ? "14px" : "15px",
        title: base ? "24px" : "28px",
        toolbar: width === 900 ? "8px" : "4px",
      };

      if (r.cell.padLeft !== want.padLeft) {
        throw new Error(
          `${at}: .row ${JSON.stringify(r.cell.classes)} computes padding-left ${r.cell.padLeft} (row ${r.cell.box.left}→${r.cell.box.right}), not the ${base ? "base 12px" : "sm block's 16px (base is 12px)"} — the sm block's .row list is the only rule that moves it, and the unread mark is an inset box-shadow, never a padding`,
        );
      }
      if (r.cell.gap !== want.gap) {
        throw new Error(
          `${at}: .row ${JSON.stringify(r.cell.classes)} computes gap ${r.cell.gap}, not ${want.gap} (${base ? "base 10px" : "sm 12px, base 10px"}) across the avatar, the sentence and the stamp`,
        );
      }
      if (r.cell.sentenceFont !== want.sentence) {
        throw new Error(
          `${at}: the .sentence inside .row ${JSON.stringify(r.cell.classes)} computes font-size ${r.cell.sentenceFont} (weight ${r.cell.sentenceWeight}), not ${want.sentence} — the row stepped (padding ${r.cell.padLeft}, gap ${r.cell.gap}) but the sentence's own rule did not, and the block gives them in two separate rules`,
        );
      }
      if (r.titleFont !== want.title) {
        throw new Error(`${at}: .title computes ${r.titleFont}, not ${want.title} (${base ? "base" : "sm, base is 24px"})`);
      }
      if (r.toolbarPadBottom !== want.toolbar) {
        throw new Error(
          `${at}: the toolbar's padding-bottom computes ${r.toolbarPadBottom}, not ${want.toolbar} — ${
            width === 900
              ? "the md block's only declaration on this page"
              : "the md block's 8px must not leak below 900, where the base 4px is the law"
          }`,
        );
      }
    };

    const inboxRestore = await js("return window.innerWidth;");
    const inboxBefore = await readInbox();
    const inboxLines = [];
    let inboxSeen = "";
    try {
      for (const width of [640, 900, 360]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        await waitFor(`document.querySelector(".rows .row .sentence") !== null`, `the inbox's first sentence at ${width}px`, 10000);
        const r = await readInbox();
        assertInbox(r, width);
        inboxLines.push(
          `${width}px: .row ${JSON.stringify(r.cell.classes)} padding-left ${r.cell.padLeft} · gap ${r.cell.gap} · .sentence ${r.cell.sentenceFont} ${r.cell.sentenceWeight} ${r.cell.sentenceColor} (${JSON.stringify(r.cell.text)}) · title ${r.titleFont} · toolbar padding-bottom ${r.toolbarPadBottom} · ${r.rows} row(s), ${r.unreadRows} unread`,
        );
      }
      inboxSeen = inboxLines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const inboxAfter = await js("return window.innerWidth;");
    if (inboxAfter !== inboxRestore) {
      throw new Error(`the inbox's overrides cleared to ${inboxAfter}px, but the session runs at ${inboxRestore}px — a leaked override would mis-measure every later row`);
    }
    const back = await readInbox();
    if (back.path !== inboxBefore.path || back.search !== inboxBefore.search || back.rows !== inboxBefore.rows || back.unreadRows !== inboxBefore.unreadRows) {
      throw new Error(
        `the width phase left ${JSON.stringify(back.path + back.search)} with ${back.rows} row(s) and ${back.unreadRows} unread, not the ${inboxBefore.rows} row(s) and ${inboxBefore.unreadRows} unread the mount drew — the ladder navigated or wrote, so this row would be measuring a list it changed`,
      );
    }
    if (back.rows === 0) {
      throw new Error(`the inbox measured 0 rows after the ladder — an empty list satisfies every count above, so the reading proves nothing`);
    }

    return `${before} unread rows → ${before - 1}; the tab bar went "${unreadBefore}" → "${after}"; the sm step rendered — ${inboxSeen}`;
  }),
);

/**
 * T-43 — `/dev/native`, one journey per capability (five rows, not one).
 *
 * A single row that presses all five would prove *something answered*, never *which road ran*: the
 * page's whole argument is that a browser gets a fallback and never a thrown error, and five
 * answers are five different proofs. Every press uses real mouse events — T-34 found a synthetic
 * `.click()` makes `navigator.clipboard.writeText` answer `unsupported`, so a `.click()` here would
 * pass only by not testing the gesture. The chunk boundary is asserted **inside** each journey: the
 * Tauri chunk must never be requested in a browser, which no `dist` grep can show.
 */
results.push(
  await journey("press Vibrate on /dev/native (the engine's own answer, never failed)", async () => {
    await openNative();
    await pressCap("haptic");
    // Both verdicts are the module's own ladder — `navigator.vibrate(pattern) ? done : unsupported`
    // — and which one prints is the engine's call (this box's Chromium 155 answers truthy; T-34
    // recorded false on an earlier one). `failed · a road existed and broke` is the only wrong one.
    const seen = await expectCapOneOf("haptic", [
      "ok · medium",
      "unsupported · this browser has no road",
    ]);
    const chunk = await noCoreChunk("Vibrate");
    return `haptic reads "${seen}" and never "failed"; ${chunk}`;
  }),
);

results.push(
  await journey("press Copy on /dev/native (a real gesture reaches the clipboard)", async () => {
    await openNative();
    await pressCap("copy");
    const seen = await expectCap("copy", "ok · LuaPlot · the native bridge");
    const chunk = await noCoreChunk("Copy");
    return `copy reads "${seen}" through Input.dispatchMouseEvent; ${chunk}`;
  }),
);

results.push(
  await journey("press Share on /dev/native (no share sheet → the copy road)", async () => {
    await openNative();
    await pressCap("shareText");
    // Chromium on Linux has no `navigator.share`, so the ladder falls to `copy()` and the answer
    // names the road it actually took — "shared" here would mean a sheet this box does not have.
    const seen = await expectCap("shareText", "ok · copied");
    const chunk = await noCoreChunk("Share");
    return `shareText reads "${seen}" — the fallback names its own road; ${chunk}`;
  }),
);

results.push(
  await journey("press Pick on /dev/native (a real file reaches the input)", async () => {
    await openNative();
    // The chooser must be intercepted *before* the press: in headless Chromium an unintercepted
    // `<input type=file>` opens a dialog nobody can close, so the press never settles.
    await send("Page.setInterceptFileChooserDialog", { enabled: true });
    await pressCap("pickImage");
    const opened = await waitEvent("Page.fileChooserOpened", 10000);
    let files = opened?.backendNodeId ? { backendNodeId: opened.backendNodeId } : null;
    if (!files) {
      // Older builds omit the node id; the dialog's own input is still the only one on the page.
      const doc = await send("DOM.getDocument", { depth: 1 });
      const found = await send("DOM.querySelector", {
        nodeId: doc.result?.root?.nodeId,
        selector: 'input[type="file"]',
      });
      const nodeId = found.result?.nodeId;
      if (!nodeId) throw new Error("the chooser opened with no node to hand a file to");
      files = { nodeId };
    }
    await send("DOM.setFileInputFiles", { files: [PICK_FILE], ...files });
    const seen = await expectCap("pickImage", `ok · ${PICK_NAME}`);
    const chunk = await noCoreChunk("Pick");
    return `the chooser took ${PICK_NAME} from disk and the row reads "${seen}"; ${chunk}`;
  }),
);

results.push(
  await journey("press Badge 3 then Clear badge on /dev/native (the title follows)", async () => {
    await openNative();
    // Read the title first: the shell titles every non-root route `<Title> — LuaPlot` (App.tsrx),
    // so the badged form is derived from what the page actually carries, not from a literal.
    const before = await js(`return document.title;`);
    if (!before || /^\(\d+\)\s/.test(before)) throw new Error(`/dev/native opened with title ${JSON.stringify(before)}`);

    await pressCap("setBadge");
    const badged = await expectCap("setBadge", "ok · (3) title");
    const whileBadged = await waitFor(
      `document.title === ${JSON.stringify(`(3) ${before}`)} ? document.title : ""`,
      "the tab title to carry the badge",
      6000,
    );

    await realClick(".tools button");
    const cleared = await expectCap("setBadge", "ok · title cleared");
    const after = await waitFor(
      `document.title === ${JSON.stringify(before)} ? document.title : ""`,
      "the title to come back",
      6000,
    );
    const chunk = await noCoreChunk("Badge");
    // Press 3, read, Clear, read — never 3 twice: `setBadge` memoises the unbranded title, so a
    // second 3 would prove nothing about the write.
    return `"${before}" → "${whileBadged}" (${badged}) → "${after}" (${cleared}); ${chunk}`;
  }),
);

/**
 * T-44 — the three dev pages that never had a row, one journey each.
 *
 * `/dev/state` is the store seam: the row flips the NSFW pair **through the page's own control**
 * and then reads the catalog, because the whole argument of a module-scope store is that a page
 * that re-read it into local state would drift. `/dev/data` is a mutation seam, so it is proved by
 * a round trip to a product page, never by the dev page's own log line. `/dev/primitives` is the
 * gallery, and it carries the walk's first breakpoint measurement.
 */

results.push(
  await journey("read the stores on /dev/state (the catalog obeys the same pair)", async () => {
    await go("/dev/state");
    await waitFor(`document.querySelectorAll("button.toggle").length === 2`, "/dev/state's two toggles", 8000);
    const badges = await js(`const b = document.querySelector(".badges"); return b ? b.innerText.replace(/\\s+/g, " ").trim() : "";`);
    if (!/signed in/.test(badges) || !/@you/.test(badges)) throw new Error(`the session badges read ${JSON.stringify(badges)}`);

    // The pair as this session found it — recorded, never assumed. The row restores exactly this,
    // so the rows before it and after it read the catalog the way they were written to.
    const seedShow = (await toggleState("Show NSFW content")) === "true";
    const seedBlur = (await toggleState("Blur NSFW content")) === "true";

    await setToggle("Show NSFW content", true);
    await setToggle("Blur NSFW content", true);
    const on = await storeCell("Show");
    if (on !== "on · blur") throw new Error(`the counts strip reads Show "${on}" after both toggles went on`);

    await go("/character/catalog");
    const coveredOn = await coveredCards();
    if (coveredOn < 1) throw new Error("the catalog drew no cover with Show + Blur on — the listing is not reading the store");

    await go("/dev/state");
    await waitFor(`document.querySelectorAll("button.toggle").length === 2`, "/dev/state's two toggles after the hop", 8000);
    await setToggle("Show NSFW content", seedShow);
    await setToggle("Blur NSFW content", seedBlur);
    const restored = `${await storeCell("Show")}/${await storeCell("Blur")}`;

    await go("/character/catalog");
    const coveredBack = await coveredCards();
    const expectedBack = seedShow && seedBlur ? coveredOn : 0;
    if (coveredBack !== expectedBack) {
      throw new Error(`after restoring Show ${seedShow} / Blur ${seedBlur} the catalog drew ${coveredBack} covers, not ${expectedBack}`);
    }
    return `session "${badges}" · Show+Blur on → ${coveredOn} covered cards · restored to ${restored} → ${coveredBack}`;
  }),
);

results.push(
  await journey("mutate on /dev/data (the write reaches the catalog, one round trip)", async () => {
    await go("/dev/data");
    await waitFor(`document.querySelectorAll(".cards .card").length > 0`, "the dev page's character cards", 10000);
    // The dev page's own counter, and the first character's row. `characters[0]` is the adapter's
    // newest, which is also the catalog's first card under the default sort — that is what makes
    // the second read comparable at all.
    const countsBefore = await storeCell("Characters");
    const first = await js(`
      const card = document.querySelector(".cards .card");
      if (!card) return null;
      const link = card.querySelector("a.card-title");
      const ratio = card.querySelector(".card-ratio");
      return {
        name: link ? link.innerText.trim() : "",
        path: link ? new URL(link.getAttribute("href"), location.href).pathname : "",
        ratio: ratio ? ratio.innerText.trim() : "",
      };
    `);
    if (!first || !first.name || !first.path) throw new Error("/dev/data drew a card with no title link");

    await click("Vote like", { exact: true });
    const log = await waitFor(
      `(() => { const el = document.querySelector(".log"); const t = el ? el.innerText.replace(/\\s+/g, " ").trim() : ""; return /became/.test(t) ? t : ""; })()`,
      "the mutation log to print the vote",
      8000,
    );
    const claim = log.match(/^vote like on (.+?): (\d+)\/(\d+) became (\d+)\/(\d+), ratio (\d+)%\./);
    if (!claim) throw new Error(`the log line reads ${JSON.stringify(log)}`);
    const [, votedName, likesBefore, , likesAfter, , logRatio] = claim;
    if (votedName !== first.name) throw new Error(`the log voted on "${votedName}", the first card is "${first.name}"`);
    if (Number(likesAfter) !== Number(likesBefore) + 1) {
      throw new Error(`the adapter's own answer went ${likesBefore} → ${likesAfter} likes; one vote is one like`);
    }
    // A vote is not an append, so the count strip must not move: captured here for the evidence
    // line, not asserted as a delta — the ticket's warning about a non-idempotent mutation applies
    // to a write that adds a row, and this one is deliberately a toggle-shaped write.
    const countsAfter = await storeCell("Characters");

    // The path the card links to, rebased on the served base (`/LuaPlot/` on Pages).
    const basePath = new URL(BASE).pathname;
    const cardPath = first.path.startsWith(basePath) ? first.path.slice(basePath.length - 1) : first.path;

    await go("/character/catalog");
    await waitFor(`document.querySelectorAll(".card").length > 0`, "the catalog grid", 10000);
    const cardRatio = await waitFor(
      `(() => {
        const card = [...document.querySelectorAll(".card")].find((c) => {
          const a = c.querySelector("a.card-title");
          return a && a.innerText.trim() === ${JSON.stringify(first.name)};
        });
        const r = card ? card.querySelector(".card-ratio") : null;
        return r ? r.innerText.trim() : "";
      })()`,
      `the catalog card for "${first.name}"`,
      10000,
    );
    if (cardRatio !== `${logRatio}%`) {
      throw new Error(`the catalog card reads ${cardRatio}, the adapter answered ${logRatio}% (it read ${first.ratio} before the vote)`);
    }

    await go(cardPath);
    const likesCell = await waitFor(
      `(() => {
        const ul = document.querySelector('ul.counts[aria-label="Engagement"]');
        if (!ul) return -1;
        const cell = [...ul.querySelectorAll("li.count")].find((c) => {
          const l = c.querySelector(".count-label");
          return l && l.innerText.trim().toLowerCase() === "likes";
        });
        const v = cell ? cell.querySelector(".count-value") : null;
        return v ? Number(v.innerText.trim()) : -1;
      })()`,
      "the character's Likes cell",
      8000,
    );
    if (likesCell !== Number(likesAfter)) {
      throw new Error(`the character page reads ${likesCell} likes, the adapter answered ${likesAfter}`);
    }
    return `Characters ${countsBefore} → ${countsAfter} · ${log} · catalog ${first.ratio} → ${cardRatio}, page Likes ${likesCell}`;
  }),
);

results.push(
  await journey("measure /dev/primitives at 360/640/900/1200 (a reflow, not a stretched phone)", async () => {
    await go("/dev/primitives");
    await waitFor(
      `document.querySelector(".card-grid") !== null && document.querySelector(".g-stage") !== null`,
      "the gallery and its card grid",
      10000,
    );
    const restore = await js(`return window.innerWidth;`);
    const seen = [];
    try {
      for (const step of BREAKPOINTS) {
        const m = await measureAt(step.width);
        if (m.viewport !== step.width) {
          throw new Error(`the metrics override asked for ${step.width}px and the page measured ${m.viewport}px`);
        }
        if (m.scroll - m.viewport > 0) {
          throw new Error(`at ${step.width}px the document scrolls horizontally: scrollWidth ${m.scroll} > innerWidth ${m.viewport}`);
        }
        if (m.minButton < 44) {
          throw new Error(`at ${step.width}px a Button is ${m.minButton}px tall, under the 44px floor`);
        }
        if (m.grid !== step.grid) {
          throw new Error(`at ${step.width}px the card grid has ${m.grid} tracks, not ${step.grid}`);
        }
        if (m.fields !== step.fields) {
          throw new Error(`at ${step.width}px the Field gallery has ${m.fields} columns, not ${step.fields}`);
        }
        if (step.rail === 0 ? m.rail !== 0 : m.rail <= 0) {
          throw new Error(`at ${step.width}px the shell's rail measures ${m.rail}px (expected ${step.rail === 0 ? "hidden" : "visible"})`);
        }
        if (step.rail === 0 && m.tabbar === "none") {
          throw new Error(`at ${step.width}px the bottom tab bar is already gone: that is the md layout at a phone width`);
        }
        if (step.rail === 1 && m.tabbar !== "none") {
          throw new Error(`at ${step.width}px the bottom tab bar survives beside the rail: the rail layout is a stretched phone`);
        }
        if (step.width === 1200 && m.outlet >= m.viewport - 200) {
          throw new Error(`at 1200px the reading column is ${m.outlet}px wide in a ${m.viewport}px viewport — the 360 layout, stretched`);
        }
        seen.push(`${step.width}:${m.grid}col/field${m.fields}/rail${m.rail}/btn${m.minButton}/outlet${m.outlet}`);
      }
    } finally {
      // A leaked override is the trap: every later row would run at 1200 and read as a layout bug.
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const back = await js(`return window.innerWidth;`);
    if (back !== restore) throw new Error(`the override cleared to ${back}px, but the session runs at ${restore}px`);
    return `${seen.join(" · ")} — no horizontal scroll at any width`;
  }),
);

results.push(
  await journey("measure the card's touch targets at 360×740 (44px bands, no new scroll)", async () => {
    await go("/character/catalog");
    await waitFor(`document.querySelectorAll(".card a.card-author").length > 0`, "a catalog card's author link", 10000);
    const restore = await js(`return window.innerWidth;`);
    const seen = [];
    try {
      // The phone case is the one the floor exists for; the session runs at 360 already, but the
      // override makes the row honest after any earlier row that moved the viewport.
      await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 1, mobile: false });
      await sleep(260);
      const first = await js(`
        const card = document.querySelector(".card:has(a.card-author)");
        if (!card) return null;
        const box = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
        const author = card.querySelector("a.card-author");
        const foot = card.querySelector(".card-foot");
        const ratio = card.querySelector(".card-ratio");
        return {
          author: box(author),
          foot: box(foot),
          ratio: ratio ? box(ratio) : null,
          footLinks: foot.querySelectorAll("a,button").length,
          ratioLink: ratio ? !!(ratio.querySelector("a") || ratio.closest("a")) : false,
          ratioText: ratio ? ratio.innerText.trim() : "",
          scroll: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        };
      `);
      if (!first) throw new Error("/character/catalog drew no card with an author link");
      if (first.viewport !== 360) throw new Error(`the override asked for 360 and the page measured ${first.viewport}`);
      if (first.author.h < 44) throw new Error(`the card's author link is ${first.author.h}px tall at 360, under the 44px floor`);
      if (first.author.w < 44) throw new Error(`the card's author link is only ${first.author.w}px wide at 360, under the 44px floor`);
      if (first.footLinks !== 1) throw new Error(`the card footer holds ${first.footLinks} interactive children; the author link must be the only one`);
      if (first.ratioLink) throw new Error("the ratio became a target: the percentage is a reading, not a link");
      if (!/%$/.test(first.ratioText)) throw new Error(`the ratio cell reads ${JSON.stringify(first.ratioText)}, not a percentage`);
      if (first.scroll - first.viewport > 0) {
        throw new Error(`the taller card footer introduced a horizontal scroll at 360: scrollWidth ${first.scroll} > ${first.viewport}`);
      }
      seen.push(`catalog author ${first.author.w}×${first.author.h} in a ${first.foot.h}px foot, ratio ${first.ratioText} plain`);

      await go("/post/thread");
      await waitFor(`document.querySelectorAll("a.post-avatar").length > 0`, "a post's avatar link", 10000);
      const post = await js(`
        const link = document.querySelector("a.post-avatar");
        if (!link) return null;
        const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
        const author = document.querySelector("a.post-author");
        const avatar = link.querySelector(".avatar");
        return {
          link: box(link),
          // The drawing must not grow with the box: a 44px avatar is a different card (DESIGN.md).
          drawing: box(avatar),
          author: box(author),
          authorLine: author ? Math.round(author.getBoundingClientRect().height) : -1,
          scroll: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        };
      `);
      if (!post) throw new Error("/post/thread drew no post with an avatar link");
      if (post.link.h < 44 || post.link.w < 44) {
        throw new Error(`the post avatar link is ${post.link.w}×${post.link.h}, under the 44×44 floor`);
      }
      if (!post.drawing || post.drawing.w !== 36) {
        throw new Error(`the avatar drawing measures ${post.drawing ? `${post.drawing.w}×${post.drawing.h}` : "nothing"}, not 36: the box grew, the circle must not`);
      }
      if (post.authorLine < 44) throw new Error(`the post's @handle is ${post.authorLine}px tall, under the 44px floor`);
      if (post.scroll - post.viewport > 0) {
        throw new Error(`the thread scrolls horizontally at 360: scrollWidth ${post.scroll} > ${post.viewport}`);
      }
      seen.push(`thread avatar link ${post.link.w}×${post.link.h} around a ${post.drawing.w}px drawing, @handle ${post.authorLine}px`);
    } finally {
      // Same trap as the breakpoint row: a leaked override poisons every later row.
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const back = await js(`return window.innerWidth;`);
    if (back !== restore) throw new Error(`the override cleared to ${back}px, but the session runs at ${restore}px`);
    return `${seen.join(" · ")} — no horizontal scroll`;
  }),
);

/* ------------------------------------------------------------------------------------------------
 * T-37B/T-37C — the accent's **text** tiers clear AA in every flavour.
 *
 * The accent is a mark colour (fills, strokes, the tab tick, the focus ring) that also carried text:
 * the active nav label, the base `a` rule, and a handful of link hovers. On Latte the mark measures
 * 4.45:1 on `--color-bg-elevated` — 0.05 short — so text moved to `--color-accent-text` (the mark on
 * the dark flavours, 85% of it toward `--ctp-text` on the light ones), and T-37C gave the hover its
 * own tier (`--color-accent-hover-text`: the mark's hover on dark, 40/60 toward `--ctp-text` on
 * light) because lavender is 2.62:1 on a Latte card and 9.81:1 on a Mocha one — it cannot be one
 * value. T-37C also stopped the `md` rail **filling** its active row: the label now sits on the
 * rail's own `--color-bg-elevated`, with the 2px accent bar `lg` already drew as the indicator.
 *
 * Four things make this row honest:
 *  - the flavour is chosen by **media emulation** (`Emulation.setEmulatedMedia`), never by writing
 *    `data-theme`, and the row first refuses to run against a pinned attribute — otherwise the light
 *    pass would prove Mocha against itself;
 *  - the Maths runs **in the page** on the *computed* colours, so the numbers under test are the ones
 *    the reader sees; a host-side table would only re-assert the tokens;
 *  - every hovered pair is measured through `CSS.forcePseudoState`, so the colour under test is the
 *    `:hover` rule's, not the resting one — and each is released before the next measurement;
 *  - a bare `<a>` (no class) is the only element the base rule paints, and no page prints one inside
 *    a card, so the row **installs** one in the first card and removes it in the `finally`. The
 *    cascade and the backplate are the page's; only the text is a probe.
 *
 * The unrounded ratio is asserted (4.49 rounds to 4.5) and printed to two decimals.
 * ---------------------------------------------------------------------------------------------- */

/** sRGB contrast, evaluated in the page: parse the computed `rgb(...)`/`rgba(...)` strings — and
 *  `color(srgb …)`, which is what Chromium reports for a value that came out of `color-mix()`.
 *  Reading that as 0–255 bytes would turn a 4.8:1 pair into a fake 17:1. */
const CONTRAST_FN = `
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const bytes = (rgb) => {
    const s = String(rgb);
    const nums = s.match(/[0-9.]+/g).map(Number);
    // color(srgb 0.49 0.23 0.85) is 0-1; rgb(127, 60, 219) is 0-255.
    return s.indexOf("color(") === 0 ? nums.slice(0, 3).map((n) => n * 255) : nums.slice(0, 3);
  };
  const lum = (rgb) => {
    const m = bytes(rgb);
    return 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]);
  };
  const contrast = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
`;

/** A computed colour as `#rrggbb`, for evidence a human can read (`color(srgb …)` and `rgb(…)`
 *  both arrive here — the walk measures in whichever space Chromium reports). */
const cssHex = (value) => {
  const s = String(value);
  const nums = (s.match(/[0-9.]+/g) || []).map(Number);
  const bytes = s.indexOf("color(") === 0 ? nums.map((n) => n * 255) : nums;
  return "#" + bytes.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
};

results.push(
  await journey("the accent's text tiers clear 4.5:1 in both flavours", async () => {
    await go("/character/catalog");
    await waitFor(`!!document.querySelector(".tabbar .tab.is-active .tab-label")`, "an active tab label", 8000);
    await waitFor(`!!document.querySelector(".card a.card-author")`, "a catalog card's author link", 8000);

    // A pinned attribute makes `prefers-color-scheme` inert (`:root:not([data-theme])`), and the light
    // pass would then measure Mocha. Only /dev/primitives' switch writes it, and no row presses that.
    const pinned = await js(`return document.documentElement.getAttribute("data-theme");`);
    if (pinned) {
      throw new Error(`<html data-theme="${pinned}"> is pinned, so media emulation cannot choose a flavour — reload before measuring`);
    }

    await send("DOM.enable");
    await send("CSS.enable");
    const doc = await send("DOM.getDocument", { depth: 1 });
    const node = async (selector) => {
      const found = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector });
      if (!found.result || !found.result.nodeId) throw new Error(`could not resolve ${selector} to a DOM node`);
      return found.result.nodeId;
    };
    const author = await node(".card a.card-author");

    // The one element the base `a` rule paints is an anchor with no class of its own, and no page
    // prints one inside a card — so install one in the first card. Its colour, its backplate and the
    // `:hover` that `forcePseudoState` applies all come from the real stylesheet; the text is a probe.
    await js(`
      const card = document.querySelector(".card:has(a.card-author)");
      if (!card) return false;
      const probe = document.createElement("a");
      probe.href = "#probe";
      probe.setAttribute("data-walk-probe", "bare-link");
      probe.textContent = "probe";
      card.appendChild(probe);
      return true;
    `);
    const probe = await node('a[data-walk-probe="bare-link"]');

    const read = () => js(`
      const label = document.querySelector(".tabbar .tab.is-active .tab-label");
      const tab = label.closest(".tab");
      const link = document.querySelector(".card a.card-author");
      const card = link.closest(".card");
      const bare = document.querySelector('a[data-walk-probe="bare-link"]');
      // A token pair with no element left on it: T-37C removed the rail's surface fill, and
      // --color-surface is the app's worst backplate — the hover tier exists for it. Resolve it
      // through a throwaway element so the value is the one the browser computed, not a hex here.
      const swatch = document.createElement("div");
      swatch.style.backgroundColor = "var(--color-surface)";
      card.appendChild(swatch);
      const surface = getComputedStyle(swatch).backgroundColor;
      swatch.remove();
      const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
      return {
        text: label.innerText.trim(),
        label: cs(label).color,
        plate: cs(tab.closest(".tabbar")).backgroundColor,
        mark: cs(tab, "::before").backgroundColor,
        author: cs(link).color,
        cardBg: cs(card).backgroundColor,
        bare: cs(bare).color,
        bareBg: cs(bare.parentElement).backgroundColor,
        surface,
        base: getComputedStyle(document.documentElement).getPropertyValue("--ctp-base").trim(),
        scheme: getComputedStyle(document.documentElement).colorScheme,
      };
    `);

    const seen = [];
    const flavours = [
      { scheme: "dark", flavour: "Mocha", base: "#1e1e2e" },
      { scheme: "light", flavour: "Latte", base: "#eff1f5" },
    ];
    try {
      for (const want of flavours) {
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: want.scheme }] });
        await sleep(240);

        const rest = await read();
        // One forced pseudo state at a time: the author link, then the bare link, each released
        // before the next is applied — a hover left on poisons every later measurement in the row.
        await send("CSS.forcePseudoState", { nodeId: author, forcedPseudoClasses: ["hover"] });
        const authorHover = await js(`return getComputedStyle(document.querySelector(".card a.card-author")).color;`);
        await send("CSS.forcePseudoState", { nodeId: author, forcedPseudoClasses: [] });
        await send("CSS.forcePseudoState", { nodeId: probe, forcedPseudoClasses: ["hover"] });
        const bareHover = await js(`return getComputedStyle(document.querySelector('a[data-walk-probe="bare-link"]')).color;`);
        await send("CSS.forcePseudoState", { nodeId: probe, forcedPseudoClasses: [] });

        const ratios = await js(`${CONTRAST_FN}
          const table = ${JSON.stringify({
            tab: ["label", "plate"],
            authorHover: ["authorHover", "cardBg"],
            link: ["bare", "bareBg"],
            linkHover: ["bareHover", "bareBg"],
            linkHoverSurface: ["bareHover", "surface"],
          })};
          const values = {
            label: ${JSON.stringify(rest.label)},
            plate: ${JSON.stringify(rest.plate)},
            authorHover: ${JSON.stringify(authorHover)},
            cardBg: ${JSON.stringify(rest.cardBg)},
            bare: ${JSON.stringify(rest.bare)},
            bareBg: ${JSON.stringify(rest.bareBg)},
            bareHover: ${JSON.stringify(bareHover)},
            surface: ${JSON.stringify(rest.surface)},
          };
          const out = {};
          for (const key of Object.keys(table)) out[key] = contrast(values[table[key][0]], values[table[key][1]]);
          return out;
        `);

        // The flavour actually landed (a green row against the wrong palette would prove nothing).
        if (rest.base.toLowerCase() !== want.base) {
          throw new Error(`the ${want.scheme} emulation landed on --ctp-base ${rest.base}, not ${want.base} (${want.flavour}): the flavour did not switch`);
        }
        if (rest.scheme !== want.scheme) {
          throw new Error(`the ${want.scheme} emulation asserts color-scheme ${rest.scheme}`);
        }
        for (const [key, what] of [
          ["tab", `the active tab label "${rest.text}"`],
          ["authorHover", "a hovered card author"],
          ["link", "a bare link on a card"],
          ["linkHover", "a hovered bare link on a card"],
        ]) {
          if (!(ratios[key] >= 4.5)) {
            throw new Error(`${want.flavour}'s ${what} measures ${ratios[key].toFixed(2)}:1, under AA 4.5`);
          }
        }
        // The mix's whole reason for being 40/60 rather than 85/15: the hover must survive the app's
        // worst backplate, `--color-surface`, where the text tier measures 3.81:1 on Latte.
        if (want.scheme === "light" && !(ratios.linkHoverSurface >= 4.6)) {
          throw new Error(`${want.flavour}'s hovered link measures ${ratios.linkHoverSurface.toFixed(2)}:1 on --color-surface (${rest.surface}), under the 4.6 the hover tier was mixed for`);
        }
        // The text tiers must not be the mark. On the dark flavours they are the same value by
        // design (the mark already reads as text); on light both hovers and the link must sit darker.
        if (want.scheme === "light" && rest.mark === rest.label) {
          throw new Error(`${want.flavour}: the tab tick and the label are the same colour (${rest.mark}) — the text tier did not diverge from the mark`);
        }
        if (want.scheme === "light" && rest.bare === rest.mark) {
          throw new Error(`${want.flavour}: a bare link paints the mark (${rest.bare}) — the base rule skipped the text tier`);
        }
        if (want.scheme === "light" && bareHover === rest.bare) {
          throw new Error(`${want.flavour}: a hovered link is the same colour as a resting one (${rest.bare}) — the hover tier is not attached`);
        }

        // The `md` rail, in the same flavour: its own 84px column, the label on the rail's plate.
        await send("Emulation.setDeviceMetricsOverride", { width: 900, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        const rail = await js(`
          const row = document.querySelector(".rail-item.is-active");
          if (!row) return null;
          const label = row.querySelector(".rail-label");
          const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
          return {
            viewport: window.innerWidth,
            text: label ? label.innerText.trim() : "",
            label: label ? cs(label).color : null,
            rowBg: cs(row).backgroundColor,
            plate: cs(row.closest(".rail")).backgroundColor,
            bar: cs(row, "::before").backgroundColor,
          };
        `);
        await send("Emulation.clearDeviceMetricsOverride");
        await sleep(260);
        if (!rail || !rail.label) throw new Error(`at 900px ${want.flavour} draws no active rail label`);
        if (rail.viewport !== 900) throw new Error(`the override asked for 900px and the rail measured ${rail.viewport}px`);
        if (rail.rowBg !== "rgba(0, 0, 0, 0)") {
          throw new Error(`the md rail's active row paints ${rail.rowBg} behind its label — the fill is back, and on light no accent text clears AA on it`);
        }
        if (rail.bar === "rgba(0, 0, 0, 0)") {
          throw new Error(`the md rail's active row draws no bar (${rail.bar}) — it has no indicator left`);
        }
        const railRatio = await js(`${CONTRAST_FN}
          return contrast(${JSON.stringify(rail.label)}, ${JSON.stringify(rail.plate)});
        `);
        if (!(railRatio >= 4.5)) {
          throw new Error(`${want.flavour}'s active rail label "${rail.text}" measures ${railRatio.toFixed(2)}:1 (${rail.label} on ${rail.plate}), under AA 4.5`);
        }

        seen.push(
          `${want.flavour} ${rest.base} "${rest.text}" tab ${ratios.tab.toFixed(2)}:1 (label ${cssHex(rest.label)}, tick ${cssHex(rest.mark)}), ` +
            `@author hover ${ratios.authorHover.toFixed(2)}:1, bare link ${ratios.link.toFixed(2)}:1 / hover ${ratios.linkHover.toFixed(2)}:1 (${cssHex(bareHover)}${want.scheme === "light" ? `, ${ratios.linkHoverSurface.toFixed(2)}:1 on surface` : ""}), ` +
            `rail "${rail.text}" ${railRatio.toFixed(2)}:1 on ${cssHex(rail.plate)} (bar ${cssHex(rail.bar)}, no fill)`,
        );
      }
    } finally {
      // A leaked media emulation, a leaked viewport override and a stray probe are the same trap:
      // every later row would measure the wrong palette, width or DOM.
      await send("Emulation.setEmulatedMedia", { features: [] });
      await send("Emulation.clearDeviceMetricsOverride");
      await js(`
        const probe = document.querySelector('a[data-walk-probe="bare-link"]');
        if (probe) probe.remove();
        return !!document.querySelector('a[data-walk-probe="bare-link"]');
      `);
      await sleep(240);
    }
    return seen.join(" · ");
  }),
);

/* ------------------------------------------------------------------------------------------------
 * T-36a — `--keyboard-inset` is written by something, and the thing it is written from is the
 * **visual** viewport.
 *
 * The rule this row defends: a phone keyboard shrinks `window.visualViewport`, never
 * `window.innerHeight`, so `lib/viewport.ts` measures `innerHeight - vv.height - vv.offsetTop` and
 * writes it as `--keyboard-inset`, which the session composer's `.dock` already reads in its
 * `padding-bottom`. Before T-36a nothing in `src/` mentioned `visualViewport` at all: the token was
 * read by the one surface that needs it and written by nothing, so the composer stayed under the
 * keyboard on device.
 *
 * The keyboard itself is not reachable headlessly, so the row **shadows** the viewport: it gives the
 * `visualViewport` instance a configurable own `height` (the real one is a read-only accessor on the
 * prototype), dispatches `resize` **on that object** — a `window` resize is not the event the writer
 * listens for — and reads the token and the dock's padding back from computed style. The shadow is
 * deleted in the `finally`: a leaked one would mis-measure every later row in the same run.
 * ---------------------------------------------------------------------------------------------- */
results.push(
  await journey("the keyboard inset lifts the dock from the visual viewport (no wider page)", async () => {
    await go("/character/c0a1b2c3-0000-4000-8000-000000000002");
    await waitText("Sonic the Hedgehog", 8000);
    // Earlier rows already opened a session for this character, so the entry control now reads
    // **Continue**; the pair is clicked in that order so the row works in either state.
    await clickAny(["Continue", "Start a session"]);
    await waitFor(`/\\/session\\/[0-9a-f-]{36}$/.test(location.pathname)`, "the session route", 8000);
    await waitFor(`!!document.querySelector(".dock textarea")`, "the docked composer");

    const metrics = () =>
      js(`
        const dock = document.querySelector(".dock");
        if (!dock) return null;
        const vv = window.visualViewport;
        return {
          token: getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset").trim(),
          pad: Math.round(parseFloat(getComputedStyle(dock).paddingBottom) * 100) / 100,
          inner: window.innerHeight,
          innerWidth: window.innerWidth,
          vvHeight: vv ? vv.height : null,
          offsetTop: vv ? Math.round(vv.offsetTop) : 0,
          scrollWidth: document.documentElement.scrollWidth,
        };
      `);

    // The phone case, taken by the row itself: the session runs at the browser's own window size
    // (the walk launches it, but earlier rows clear their overrides back to that), and a keyboard
    // only exists at a phone width. Cleared in the `finally` — a leaked override poisons every later
    // row exactly as a leaked shadow does.
    const restore = await js(`return window.innerWidth;`);
    let seen = "";
    try {
      await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 1, mobile: false });
      await sleep(260);

      const resting = await metrics();
      if (!resting) throw new Error("the session page drew no .dock");
      if (resting.innerWidth !== 360) throw new Error(`the override asked for 360 and the page measured ${resting.innerWidth}`);
      if (resting.vvHeight === null) {
        throw new Error("this Chromium reports no window.visualViewport, so the token cannot be judged here");
      }
      if (resting.token !== "0px") {
        throw new Error(`--keyboard-inset rests at ${JSON.stringify(resting.token)}, not 0px: the writer is not settled`);
      }
      if (resting.scrollWidth > resting.innerWidth) {
        throw new Error(`the session page already overflows at 360 before any keyboard: scrollWidth ${resting.scrollWidth} > ${resting.innerWidth}`);
      }

      // 320px stands in for a keyboard. `height` is read-only on VisualViewport, so the shadow is an
      // own configurable value on the instance; `read` proves the shadow took before anything is
      // asserted, because a silent no-op would leave the rest of the row measuring the real viewport.
      const shadow = await js(`
        const vv = window.visualViewport;
        const target = Math.max(1, Math.round(window.innerHeight - 320));
        Object.defineProperty(vv, "height", { configurable: true, value: target });
        vv.dispatchEvent(new Event("resize"));
        return { target, read: vv.height };
      `);
      if (shadow.read !== shadow.target) throw new Error("the visualViewport height shadow did not take");

      try {
        const expected = Math.max(0, Math.min(400, Math.round(resting.inner - shadow.target - resting.offsetTop)));
        if (expected !== 320) {
          throw new Error(`the row is mis-set: innerHeight ${resting.inner} − shadow ${shadow.target} − offset ${resting.offsetTop} is ${expected}, not 320`);
        }
        try {
          await waitFor(
            `Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset")) || 0) === ${expected}`,
            `--keyboard-inset to read ${expected}px`,
            2400,
          );
        } catch {
          // A writer that never runs is the bug this row exists for: report the two numbers a reader
          // can act on (the token and the dock's own padding), not just the poll that timed out.
          const now = await metrics();
          throw new Error(`--keyboard-inset stayed ${JSON.stringify(now.token)} and the dock's bottom padding stayed ${now.pad}px under a ${expected}px shadowed viewport — nothing wrote the token`);
        }
        await sleep(120);
        const lifted = await metrics();
        const grew = Math.round((lifted.pad - resting.pad) * 100) / 100;
        if (grew !== expected) {
          throw new Error(`the dock's bottom padding grew ${grew}px under a ${expected}px keyboard (${resting.pad} → ${lifted.pad})`);
        }
        if (lifted.scrollWidth > lifted.innerWidth) {
          throw new Error(`the keyboard widened the document: scrollWidth ${lifted.scrollWidth} > ${lifted.innerWidth} (resting ${resting.scrollWidth})`);
        }
        seen = `--keyboard-inset 0px → ${lifted.token} under a 320px shadowed viewport at 360; dock padding ${resting.pad} → ${lifted.pad}, scrollWidth ${lifted.scrollWidth}/${lifted.innerWidth} — and back`;
      } finally {
        // The shadow and the token are one trap: a leaked `height` would make every later layout
        // reading in this run wrong, and a leaked inset would leave the next page's dock lifted.
        await js(`
          const vv = window.visualViewport;
          if (vv) {
            delete vv.height;
            vv.dispatchEvent(new Event("resize"));
          }
          return true;
        `);
        await waitFor(
          `getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset").trim() === "0px"`,
          "--keyboard-inset to return to 0px",
        );
        const back = await metrics();
        if (Math.round(back.pad) !== Math.round(resting.pad)) {
          throw new Error(`the dock stayed at ${back.pad}px after the keyboard closed, not ${resting.pad}px`);
        }
      }
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const after = await js(`return window.innerWidth;`);
    if (after !== restore) throw new Error(`the override cleared to ${after}px, but the session runs at ${restore}px`);
    return seen;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-49 — the one product law with no row: **sessions read copies, never live items.** Publishing a
 * cut is a snapshot; an author editing a character never reaches a session already running.
 *
 * Session 2 is seeded for exactly this shape: its character copy is `edited` (so **Restore** is
 * offered and the snapshot can move), its lorebook copy is `unlinked` (its original is private, so
 * it offers neither control nor link and still runs), and its preset copy is `untouched`.
 *
 * The disclosure is **closed by default**, which is why the row reads the header first: a selector
 * for `.copy` finds nothing until the toggle is pressed, and skipping straight to it fails looking
 * like a broken page. The summary is a **tracked sentence**, so it is compared whole — the count is
 * 3 (character, one lorebook, preset; the `4 copies · 1 edited` in DESIGN.md is the two-lorebook
 * example) and when the only edited copy goes back the suffix disappears with it: `3 copies`.
 *
 * **Mutating journey.** It presses **Restore copy**, which rewrites session 2's copies in the
 * adapter. Nothing after it reads the copies — it runs after row 32 and before `sign out` — so it
 * restores nothing.
 * ---------------------------------------------------------------------------------------------- */
const SESSION_COPIES = "/session/5e551000-0000-4000-8000-000000000002";

results.push(
  await journey("the session's copies are the snapshot: closed, stated, and restorable", async () => {
    await go(SESSION_COPIES);
    await waitFor(`!!document.querySelector(".copies-toggle")`, "the copies disclosure");

    /** The header's sentence, the disclosure's state, and every copy row as the reader sees it. */
    const panels = () =>
      js(`
        const toggle = document.querySelector(".copies-toggle");
        if (!toggle) return null;
        const spans = [...toggle.querySelectorAll("span")];
        return {
          expanded: toggle.getAttribute("aria-expanded"),
          summary: (spans[spans.length - 1]?.textContent || "").replace(/\\s+/g, " ").trim(),
          body: !!document.querySelector(".copies-body"),
          rows: [...document.querySelectorAll(".copy")].map((row) => ({
            kind: (row.querySelector(".copy-kind")?.textContent || "").trim(),
            name: (row.querySelector(".copy-name")?.textContent || "").trim(),
            state: (row.querySelector(".copy-state")?.textContent || "").trim(),
            links: row.querySelectorAll("a.copy-link").length,
            detail: (row.querySelector(".copy-detail")?.textContent || "").replace(/\\s+/g, " ").trim(),
            actions: [...row.querySelectorAll(".copy-action")].map((b) => (b.textContent || "").trim()),
          })),
        };
      `);

    const closed = await panels();
    if (!closed) throw new Error(`the session page drew no copies disclosure at ${await url()}`);
    if (closed.expanded !== "false") throw new Error(`the disclosure starts aria-expanded=${closed.expanded}`);
    if (closed.body) throw new Error("the copies body is in the DOM before anything was pressed");
    if (closed.summary !== "3 copies · 1 edited") {
      throw new Error(`the closed header reads ${JSON.stringify(closed.summary)}, not "3 copies · 1 edited"`);
    }

    await clickSelector(".copies-toggle");
    await waitFor(`document.querySelectorAll(".copy").length === 3`, "three copy rows");

    const open = await panels();
    if (open.expanded !== "true") throw new Error(`the pressed disclosure reads aria-expanded=${open.expanded}`);

    const rowFor = (kind) => open.rows.find((row) => row.kind === kind) ?? null;
    const character = rowFor("Character");
    const lorebook = rowFor("Lorebook");
    const preset = rowFor("Preset");
    if (!character || !lorebook || !preset) {
      throw new Error(`the copies read ${open.rows.map((r) => r.kind || "(no kind)").join(", ") || "nothing"}`);
    }

    const dealt = `${character.name} ${character.state} / ${lorebook.name} ${lorebook.state} / ${preset.name} ${preset.state}`;
    if (character.state !== "edited") throw new Error(`the character copy reads ${JSON.stringify(character.state)}, not "edited" (${dealt})`);
    if (lorebook.state !== "unlinked") throw new Error(`the lorebook copy reads ${JSON.stringify(lorebook.state)}, not "unlinked" (${dealt})`);
    if (preset.state !== "untouched") throw new Error(`the preset copy reads ${JSON.stringify(preset.state)}, not "untouched" (${dealt})`);

    // The unlinked copy is the point of the state: no link to an original it cannot reach, and no
    // control that would promise to refresh from one — and it still carries its own line of fact.
    if (lorebook.links !== 0) throw new Error(`the unlinked copy draws ${lorebook.links} link(s) to an original`);
    if (lorebook.actions.length !== 0) throw new Error(`the unlinked copy offers ${JSON.stringify(lorebook.actions)}`);
    if (!/out of reach/i.test(lorebook.detail)) throw new Error(`the unlinked copy reads ${JSON.stringify(lorebook.detail)}`);

    // One control per state: only the edited copy can be put back, and every linked copy can pull
    // the original forward (which confirms first, because it overwrites the session's edits).
    if (character.links !== 1) throw new Error(`the edited copy draws ${character.links} links, not 1`);
    if (!character.actions.includes("Update from original")) throw new Error(`the edited copy offers ${JSON.stringify(character.actions)}`);
    if (!character.actions.includes("Restore")) throw new Error(`the edited copy cannot be restored: ${JSON.stringify(character.actions)}`);
    if (preset.actions.length !== 1 || preset.actions[0] !== "Update from original") {
      throw new Error(`the untouched copy offers ${JSON.stringify(preset.actions)}, not just "Update from original"`);
    }

    // Press the row's own **Restore** (the opener, not the confirmation's button of the same stem).
    const armed = await js(`
      const row = [...document.querySelectorAll(".copy")].find((r) => (r.querySelector(".copy-kind")?.textContent || "").trim() === "Character");
      if (!row) return "";
      const button = [...row.querySelectorAll(".copy-actions button")].find((b) => (b.textContent || "").trim() === "Restore");
      if (!button) return "";
      button.scrollIntoView({ block: "center" });
      button.click();
      return (button.textContent || "").trim();
    `);
    if (armed !== "Restore") throw new Error(`no Restore on the edited copy (pressed ${JSON.stringify(armed)})`);

    await waitFor(`!!document.querySelector(".copy-confirm")`, "the restore confirmation");
    const sentence = await js(`return (document.querySelector(".copy-confirm .copy-detail")?.textContent || "").replace(/\\s+/g, " ").trim();`);
    if (sentence !== "This puts the copy back and discards the session's edits.") {
      throw new Error(`the restore confirmation reads ${JSON.stringify(sentence)}`);
    }

    const done = await js(`
      const confirm = document.querySelector(".copy-confirm");
      if (!confirm) return "";
      const button = [...confirm.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Restore copy");
      if (!button) return "";
      button.click();
      return (button.textContent || "").trim();
    `);
    if (done !== "Restore copy") throw new Error(`the confirmation offered no "Restore copy" (pressed ${JSON.stringify(done)})`);

    // Both halves are the proof: the row's own state, and the header's tracked sentence. A button
    // that renders a dialog proves nothing about the snapshot.
    let restored = null;
    try {
      await waitFor(
        `(() => {
          const row = [...document.querySelectorAll(".copy")].find((r) => (r.querySelector(".copy-kind")?.textContent || "").trim() === "Character");
          const state = (row?.querySelector(".copy-state")?.textContent || "").trim();
          const spans = [...document.querySelectorAll(".copies-toggle span")];
          const summary = (spans[spans.length - 1]?.textContent || "").replace(/\\s+/g, " ").trim();
          return state === "untouched" && summary === "3 copies";
        })()`,
        "the character copy to read untouched and the header to drop the edit",
        4000,
      );
      restored = await panels();
    } catch {
      restored = await panels();
      const now = restored?.rows.find((row) => row.kind === "Character");
      throw new Error(
        `after the restore the character copy reads ${JSON.stringify(now?.state)} and the header reads ${JSON.stringify(restored?.summary)}`,
      );
    }

    if (restored.summary !== "3 copies") throw new Error(`the header still reads ${JSON.stringify(restored.summary)}`);

    /* ------------------------------------------------------------------------------------------
     * T-87 — `session-detail`'s transcript has a `sm 640` block of its own, and no row had ever
     * rendered it: this row's `go()` lands at the walk's ~500px, below the breakpoint.
     *
     * The block declared **three** rules that matched no element on the page — `.title` (there is no
     * title block; the bar's `.who-name` is the only heading) and `.composer-actions` twice (the
     * composer is one `.say` field and one `.send` button) — plus the `lg` restatement of its
     * `> *` width. T-87 deleted them: they were compiled into the bundle and inert, so no walk can
     * show a deletion and the proof is the rebuilt CSS plus these unchanged numbers. What remains
     * is what a reader sees: the transcript steps **14 → 15px** and the settings sheet's action
     * pair turns from a `column-reverse` stack into a right-aligned row.
     *
     * It runs **last**, after the Restore copy press, because that press is a write: everything here
     * reads type and layout only. The sheet costs two presses per width and neither writes — the
     * danger row sets `confirmDelete`, *Cancel* clears it, and the confirm's own *Delete session*
     * is never pressed.
     * ------------------------------------------------------------------------------------------ */
    const readStage = () =>
      js(`
        const round = (n) => Math.round(n * 100) / 100;
        const first = document.querySelector(".turns .turn .turn-text");
        const actions = document.querySelector(".copy-actions");
        const box = first ? first.getBoundingClientRect() : null;
        return {
          path: location.pathname,
          search: location.search,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          turns: document.querySelectorAll(".turns .turn").length,
          turnText: first ? (first.textContent || "").trim().slice(0, 48) : "",
          turnFont: first ? getComputedStyle(first).fontSize : "",
          turnWeight: first ? getComputedStyle(first).fontWeight : "",
          turnWidth: box ? round(box.width) : 0,
          titleNodes: document.querySelectorAll(".title").length,
          composerActions: document.querySelectorAll(".composer-actions").length,
          copyJustify: actions ? getComputedStyle(actions).justifyContent : "",
        };
      `);

    /** The settings sheet's action pair: `column-reverse` on a phone, a right-aligned row at `sm`. */
    const readMenuActions = () =>
      js(`
        const menu = document.querySelector(".menu-actions");
        if (!menu) return null;
        const style = getComputedStyle(menu);
        const box = menu.getBoundingClientRect();
        return { flex: style.flexDirection, justify: style.justifyContent, width: Math.round(box.width * 100) / 100 };
      `);

    /**
     * Open the sheet, reveal its action pair (the `confirmDelete` arm), read it and put the sheet
     * away. The close is in a `finally` because a throw with the sheet open would leave a portal
     * over every later row — the sign-out row is next.
     */
    const sheetMenuAt = async (width) => {
      try {
        await clickSelector('.bar [aria-label="Session settings"]');
        await waitFor(`!!document.querySelector(".sheet .sheet-body")`, `the settings sheet at ${width}px`, 6000);
        // The state-only press: the danger *row* arms the confirmation; it writes nothing.
        await clickSelector(".sheet .menu .menu-row.is-danger");
        await waitFor(`!!document.querySelector(".menu-actions")`, `the delete confirmation's action pair at ${width}px`, 4000);
        const menu = await readMenuActions();

        // *Cancel* is the first button of the pair and the only one this row may press.
        const cancelled = await js(`
          const button = [...document.querySelectorAll(".menu-actions button")].find((b) => (b.textContent || "").trim() === "Cancel");
          if (!button) return "";
          button.click();
          return (button.textContent || "").trim();
        `);
        if (cancelled !== "Cancel") throw new Error(`at ${width}px the delete confirmation offered no "Cancel" (pressed ${JSON.stringify(cancelled)})`);
        await waitFor(`document.querySelector(".menu-actions") === null && !!document.querySelector(".sheet .menu")`, `the confirmation to close at ${width}px`, 4000);
        return menu;
      } finally {
        const still = await js(`
          const sheet = document.querySelector(".sheet");
          if (!sheet) return false;
          const close = sheet.querySelector(".sheet-close");
          if (close) close.click();
          return true;
        `);
        if (still) await waitFor(`document.querySelector(".sheet") === null`, `the settings sheet to close at ${width}px`, 6000);
      }
    };

    /** The sm block's one live text rule, plus the frame around it. */
    const assertTranscript = (r, width) => {
      const at = `/session/[id] at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!r.path.includes("/session/")) {
        throw new Error(`${at}: the transcript was measured on ${JSON.stringify(r.path)} — a ladder that navigates proves another page's facts`);
      }
      if (!r.turnFont) {
        throw new Error(`${at}: the transcript drew no .turns .turn .turn-text (${r.turns} turn(s)) — the sm block's only live text rule has no element to land on`);
      }
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the transcript scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }
      const want = width === 360 ? "14px" : "15px";
      if (r.turnFont !== want) {
        throw new Error(
          `${at}: the first .turn-text computes font-size ${r.turnFont} (weight ${r.turnWeight}, ${r.turnWidth}px wide, ${JSON.stringify(r.turnText)}), not ${want} — ${width === 360 ? "the base is the law below 640" : "the sm block's .turn-text is the only rule that steps the transcript"}`,
        );
      }
    };

    /**
     * `.menu-actions` is the one **layout** fact of the block: `column-reverse` on a phone, `row`
     * justified `flex-end` from 640. Without the block the small screen's full-width pair stays a
     * stack on a desktop sheet.
     */
    const assertMenuActions = (menu, width) => {
      const at = `/session/[id] settings sheet at ${width}px`;
      if (!menu) {
        throw new Error(`${at}: the delete confirmation drew no .menu-actions — the block's layout rule has no element`);
      }
      if (width === 360) {
        if (menu.flex !== "column-reverse") {
          throw new Error(`${at}: .menu-actions computes flex-direction ${JSON.stringify(menu.flex)}, not the base column-reverse — the sm block must not leak below 640`);
        }
        return;
      }
      if (menu.flex !== "row") {
        throw new Error(
          `${at}: .menu-actions computes flex-direction ${JSON.stringify(menu.flex)} (${menu.width}px wide), not the sm block's row — the confirmation's two answers are still stacked on a sheet that is a desktop dialog`,
        );
      }
      if (menu.justify !== "flex-end") {
        throw new Error(`${at}: .menu-actions computes justify-content ${JSON.stringify(menu.justify)}, not flex-end — the pair is a row but not a right-aligned one`);
      }
    };

    const stageRestore = await js("return window.innerWidth;");
    const stageBefore = await readStage();
    const stageLines = [];
    let stageSeen = "";
    try {
      for (const width of [640, 900, 360]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        await waitFor(`!!document.querySelector(".turns .turn .turn-text")`, `the transcript's first turn at ${width}px`, 10000);
        const r = await readStage();
        assertTranscript(r, width);
        const menu = await sheetMenuAt(width);
        assertMenuActions(menu, width);
        stageLines.push(
          `${width}px: .turn-text ${r.turnFont} ${r.turnWeight} ${JSON.stringify(r.turnText)} · sheet .menu-actions ${JSON.stringify(menu.flex)} / ${JSON.stringify(menu.justify)} (${menu.width}px) · .copy-actions justify ${r.copyJustify} · .title ${r.titleNodes} / .composer-actions ${r.composerActions} node(s) · ${r.turns} turn(s), scrollWidth ${r.scrollWidth}/${r.innerWidth}`,
        );
      }
      stageSeen = stageLines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const stageAfter = await js("return window.innerWidth;");
    if (stageAfter !== stageRestore) {
      throw new Error(`the transcript's overrides cleared to ${stageAfter}px, but the session runs at ${stageRestore}px — a leaked override would mis-measure every later row`);
    }
    const stageBack = await readStage();
    if (!stageBack.path.includes("/session/") || stageBack.path !== stageBefore.path || stageBack.turns !== stageBefore.turns) {
      throw new Error(
        `the width ladder left ${JSON.stringify(stageBack.path)} with ${stageBack.turns} turn(s), not the ${stageBefore.turns} the mount drew at ${JSON.stringify(stageBefore.path)} — a ladder that navigated proves another page's facts (the session URL carries no query, so the URL alone cannot say it stayed put)`,
      );
    }

    return `closed: ${JSON.stringify(closed.summary)} · ${dealt} · unlinked offers ${lorebook.links} links / ${lorebook.actions.length} controls · restored → ${JSON.stringify(restored.summary)} · the sm 640 block rendered — ${stageSeen}`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-50 — the law about **absences**: *personas are personal (never shared, never moderated, never
 * counted)* (`src/specs/pages/persona/detail.md`: *no engagement row, no report control, and no
 * comment thread … nothing about it is counted*).
 *
 * Every existing gate reads what a page **has** — `link-check.mjs` reads anchors, `tier-check.mjs`
 * reads colours, `spec-routes.mjs` reads routes — so a Report button copied into the persona header
 * from a template would be invisible to all of them. This row counts elements inside the page's own
 * **`.detail`** root (never `document.body`: the shell draws a `More` menu and a tab bar of its own,
 * and row 33's *Copy restored.* toast can still be on screen).
 *
 * The absences alone would also pass on a page that rendered nothing, so the row reads the four
 * controls the spec does require (Start a session, the default pair, Edit) and the name **Nell**
 * first: the fixture is the fact, and a later rename is a red row rather than a silent pass.
 *
 * Then `/persona` is **own-only**: personas are seeded for `you` alone and are absent from profiles,
 * so every card must point at a seeded persona id and there must be exactly one card per cell. The
 * loading state also draws three `.card-cell`s (skeletons), which is why the row waits for
 * `.skel-card` to be gone before counting a single thing.
 *
 * Read-only: nothing here writes, so its position after row 33 and before `sign out` is tidiness —
 * but keep it there, so `sign out` stays the walk's last row.
 * -------------------------------------------------------------------------------------------- */
const OWN_PERSONA = "/persona/9e45014a-0000-4000-8000-000000000001";
const NO_PERSONA = "/persona/9e45014a-0000-4000-8000-0000000000ff";
/** The three personas `you` owns (`lib/fixtures/personas.ts`). A fourth fixture row makes this red. */
const PERSONA_IDS = [1, 2, 3].map((n) => `9e45014a-0000-4000-8000-${String(n).padStart(12, "0")}`);

results.push(
  await journey("a persona carries none of the shared-item chrome", async () => {
    await go(OWN_PERSONA);
    await waitFor(`!!document.querySelector(".detail h1.name")`, "the persona's name", 8000);

    /**
     * The page's own root, read as data. `name()` is the accessible name as close as a walk gets
     * without `Accessibility.getFullAXTree`: `aria-label` first, then the rendered text — the same
     * order the `click()` helper uses, so a control found here is a control a reader could press.
     */
    const page = () =>
      js(`
        const root = document.querySelector(".detail");
        if (!root) return null;
        const name = (el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\\s+/g, " ").trim();
        const controls = [...root.querySelectorAll("button, a")];
        return {
          name: (root.querySelector("h1.name")?.textContent || "").replace(/\\s+/g, " ").trim(),
          labels: controls.map(name),
          report: controls.filter((el) => /report/i.test(name(el))).map(name),
          save: controls.filter((el) => /bookmark|save/i.test(name(el))).map(name),
          counts: [...root.querySelectorAll(".counts, .count, .ratio, .engagement")].length,
          thread: [...root.querySelectorAll(".comments, .comment-thread, .comment")].length,
          forms: root.querySelectorAll("form").length,
        };
      `);

    const own = await page();
    if (!own) throw new Error(`the persona page drew no .detail at ${await url()}`);
    if (own.name !== "Nell") throw new Error(`the page's name reads ${JSON.stringify(own.name)}, not "Nell"`);

    // The page has to be *populated* for an absence to mean anything.
    for (const label of ["Start a session", "Edit"]) {
      if (!own.labels.includes(label)) {
        throw new Error(`the persona page lost its own ${JSON.stringify(label)} control — read ${JSON.stringify(own.labels)}`);
      }
    }

    if (own.report.length !== 0) throw new Error(`the persona page draws a report control: ${JSON.stringify(own.report)}`);
    if (own.save.length !== 0) throw new Error(`the persona page draws a save/bookmark control: ${JSON.stringify(own.save)}`);
    if (own.counts !== 0) throw new Error(`the persona page draws ${own.counts} engagement element(s) (.counts/.count/.ratio/.engagement)`);
    if (own.thread !== 0) throw new Error(`the persona page draws ${own.thread} comment element(s) (.comments/.comment-thread/.comment)`);
    if (own.forms !== 0) throw new Error("the persona detail page mounted a <form>; only /persona/[id]/edit has one");

    // `/persona` is the viewer's own collection, so every card it draws is one of the seeded rows.
    await go("/persona");
    await waitFor(
      `document.querySelectorAll(".skel-card").length === 0 && document.querySelectorAll(".persona-card").length > 0`,
      "the persona collection to leave its skeletons behind",
      8000,
    );
    const collection = await js(`
      const cells = [...document.querySelectorAll(".card-cell")];
      const cards = [...document.querySelectorAll(".persona-card")];
      const links = cards.map((card) => {
        const a = [...card.querySelectorAll("a[href]")].find((el) => /\\/persona\\/[0-9a-f-]{36}$/.test(el.getAttribute("href") || ""));
        return a ? a.getAttribute("href") : "";
      });
      return {
        skeletons: document.querySelectorAll(".skel-card").length,
        cells: cells.length,
        cards: cards.length,
        names: cards.map((card) => (card.querySelector(".persona-card-name")?.textContent || "").trim()),
        links,
      };
    `);

    if (collection.skeletons !== 0) throw new Error(`${collection.skeletons} skeleton card(s) stayed in the grid`);
    if (collection.cells !== collection.cards) {
      throw new Error(`the collection drew ${collection.cells} card cell(s) but ${collection.cards} card(s)`);
    }
    if (collection.links.some((href) => href === "")) {
      throw new Error(`a persona card carries no /persona/<uuid> link: ${JSON.stringify(collection.names)}`);
    }

    // Under the served base ("" locally, "/LuaPlot" on Pages) — a leading-slash href would drop it.
    const basePath = new URL(BASE).pathname.replace(/\/$/, "");
    const ids = collection.links.map((href) => href.split("/persona/")[1]);
    for (const [index, id] of ids.entries()) {
      if (!collection.links[index].startsWith(`${basePath}/persona/`)) {
        throw new Error(`the card for ${collection.names[index]} links to ${collection.links[index]}, outside the served base ${basePath || "/"}`);
      }
      if (!PERSONA_IDS.includes(id)) {
        throw new Error(`the collection draws an id that is not a seeded persona: ${id} (${JSON.stringify(collection.names)})`);
      }
    }
    if (new Set(ids).size !== ids.length) throw new Error(`the collection drew the same persona twice: ${JSON.stringify(ids)}`);

    // Missing and unowned are **one state on purpose** (`getPersona` answers null for both), so this
    // id proves the refusal a stranger's persona sees: the one sentence, and no form to write with.
    await go(NO_PERSONA);
    await waitText("This persona doesn't exist in your collection.", 8000);
    const refusal = await js(`
      const empty = document.querySelector(".detail a[href]");
      return {
        forms: document.querySelectorAll("form").length,
        road: empty ? empty.getAttribute("href") : "",
      };
    `);
    if (refusal.forms !== 0) throw new Error(`the missing state mounted ${refusal.forms} <form>(s)`);
    if (!/\/persona$/.test(refusal.road)) throw new Error(`the missing state's road out points at ${JSON.stringify(refusal.road)}, not /persona`);

    return `Nell: 0 report / 0 save / 0 counts / 0 comment / 0 form in .detail, ${own.labels.length} own controls · collection: ${collection.cards}/${collection.cells} cards, ids ${ids.map((id) => id.slice(-2)).join("/")} under ${basePath || "/"} · unowned → the one sentence, no form, road out ${refusal.road}`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-51 — the law about **precedence**: *IDs carry identity, names never do. Fixed segments
 * (`catalog`, `create`, `thread`) win over `[id]` params* (`docs/CONTRACT.md` →
 * *Product law*, repeated in `src/specs/luaplot-pages.md`).
 *
 * The router gets this from `TABLE`'s sort (fewer params first, then deeper) plus the id predicate
 * (`src/router.ts` → `/^[0-9a-f-]{36}$/i`). No gate can see it: `spec-routes.mjs` proves each
 * route's page module resolves, never **which** route the table picks for a path. A sort that loses
 * its param count, or an id predicate widened to `\w+`, would make `/character/catalog` mount the
 * character *detail* page with `id="catalog"` — the app would read *not found* on a route the spec
 * guarantees, and every gate would stay green.
 *
 * So each fixed segment is walked as a **literal** (no card press: the address is the thing under
 * test) and the mounted page is read by a landmark the detail page cannot draw — four of them, all
 * from the page files, all read as data:
 *   - the page's own root class (`.catalog`, `.create-page`, `.thread`, `.compose-page`; a detail
 *     page's root is `.detail`, so its **absence** is the other half of the assertion);
 *   - its `.kicker` sentence — the string each page writes for itself (`character catalog`,
 *     `new preset`, `thread`, …);
 *   - `document.title` = `<Title> — LuaPlot` (`App.tsrx`); and
 *   - on a create page, a mounted `<form>`. Polled rather than asserted on the first frame (T-40's
 *     lesson: `CharacterForm` draws its form only in its `ready` branch).
 * A root class alone would pass on a page that rendered its shell with nothing in it, and the title
 * alone is a string the code writes twice — hence all four.
 *
 * `CommentThread` also draws a `.thread` root, so `/post/thread`'s `.thread` is only half its
 * landmark: the `.kicker` `thread` and `.detail`'s absence are what make it the thread page.
 *
 * The **control** half runs the other direction: a uuid-shaped path of the same depth must still
 * reach a detail page, because a router that made *every* segment literal would pass every line
 * above and fail this one.
 *
 * `/moderation` has no fixed sibling at depth 2 today (`/moderation/[report.id]` is its only
 * child), so it is absent from the list rather than invented.
 *
 * Read-only, no CDP override (nothing here measures width), and it sits after row 34 and before
 * `sign out` so `sign out` stays the walk's last row.
 * -------------------------------------------------------------------------------------------- */
const FIXED_SEGMENTS = [
  { path: "/character/catalog", root: ".catalog", kicker: "character catalog", title: "Characters" },
  { path: "/character/create", root: ".create-page", kicker: "new character", title: "New character", form: true },
  { path: "/lorebook/catalog", root: ".catalog", kicker: "lorebook catalog", title: "Lorebooks" },
  { path: "/lorebook/create", root: ".create-page", kicker: "new lorebook", title: "New lorebook", form: true },
  { path: "/preset/catalog", root: ".catalog", kicker: "preset catalog", title: "Presets" },
  { path: "/preset/create", root: ".create-page", kicker: "new preset", title: "New preset", form: true },
  { path: "/persona/create", root: ".create-page", kicker: "new persona", title: "New persona", form: true },
  { path: "/post/thread", root: ".thread", kicker: "thread", title: "Thread" },
  { path: "/post/create", root: ".compose-page", kicker: "new post", title: "New post", form: true },
];
/** Sonic is `CHARACTER(2)`, a public row this walk already reads by name twice (rows 6 and 32). */
const CONTROL_CHARACTER = "/character/c0a1b2c3-0000-4000-8000-000000000002";

results.push(
  await journey("a fixed segment wins over an id param", async () => {
    /** What is actually mounted, read as data, so a failure names the page instead of "the page". */
    const mounted = () =>
      js(`
        const clean = (v) => (v || "").replace(/\\s+/g, " ").trim();
        const roots = {};
        for (const sel of [".catalog", ".create-page", ".thread", ".compose-page", ".detail"]) {
          roots[sel] = document.querySelectorAll(sel).length;
        }
        return {
          title: document.title,
          roots,
          kickers: [...document.querySelectorAll(".kicker")].map((el) => clean(el.textContent).toLowerCase()),
          forms: document.querySelectorAll("form").length,
        };
      `);

    /** One sentence with every number a reader needs to see what mounted instead. */
    const describe = (now) =>
      `title ${JSON.stringify(now.title)}, roots ${JSON.stringify(now.roots)}, kickers ${JSON.stringify(now.kickers)}, forms ${now.forms}`;

    const mountedPaths = [];
    for (const segment of FIXED_SEGMENTS) {
      const want = `${segment.title} — LuaPlot`;
      const probe = `document.title === ${JSON.stringify(want)} && document.querySelector(${JSON.stringify(segment.root)}) !== null && document.querySelectorAll(".detail").length === 0 && [...document.querySelectorAll(".kicker")].some((el) => (el.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase() === ${JSON.stringify(segment.kicker)})${segment.form ? ' && document.querySelector("form") !== null' : ""}`;
      await go(segment.path);
      try {
        await waitFor(probe, `${segment.path} to mount its own page`, 8000);
      } catch {
        const now = await mounted();
        throw new Error(
          `${segment.path} did not mount its own page — read ${describe(now)}; wanted title ${JSON.stringify(want)}, root ${segment.root}, kicker ${JSON.stringify(segment.kicker)}${segment.form ? ", a mounted form" : ""}`,
        );
      }
      const now = await mounted();
      // The poll proves all four at once; this restates the one that a shared root could hide.
      if (now.roots[".detail"] !== 0) throw new Error(`${segment.path} drew the detail page's root too: ${describe(now)}`);
      mountedPaths.push(`${segment.path} → ${JSON.stringify(segment.kicker)}`);
    }

    // The control: same depth, a real uuid. The detail route must still win an id-shaped path.
    await go(CONTROL_CHARACTER);
    await waitText("Sonic the Hedgehog", 8000);
    const control = await mounted();
    if (control.roots[".detail"] !== 1) {
      throw new Error(`the control id drew ${control.roots[".detail"]} .detail root(s) — read ${describe(control)}`);
    }
    if (control.roots[".catalog"] !== 0) throw new Error(`the control id mounted a catalog: ${describe(control)}`);
    if (control.title !== "Character — LuaPlot") throw new Error(`the control's title reads ${JSON.stringify(control.title)}, not "Character — LuaPlot"`);

    return `${FIXED_SEGMENTS.length} fixed segments each mount their own page (${mountedPaths.map((line) => line.split(" → ")[0]).join(", ")}) · control ${CONTROL_CHARACTER.slice(-12)} → .detail ×1 + "Sonic the Hedgehog"`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-52 — the law about **where a number lives**: *Engagement is metadata on cards (ratio only) and
 * actions on detail pages (counts live there)* (`docs/CONTRACT.md` → *Product law*;
 * `src/specs/luaplot-pages.md` line 170, restated per page in `character/detail.md` and
 * `preset/detail.md`: *"the detail page is where the counts live, while a card shows only the
 * ratio"*).
 *
 * `Card.tsrx` is handed the whole `AuthoredItem`, so a `likes`/`dislikes` pair is one interpolation
 * away from every card in the app, and its footer draws exactly two things: the author link and
 * `.card-ratio`. Nothing has ever asserted that — `tier-check.mjs` reads colours, `link-check.mjs`
 * reads anchors, row 30 measures a card's **links** and row 31 a token's **contrast**. A page that
 * printed a count itself would be invisible to every gate.
 *
 * So the row reads the engagement surface of **every** card on `/character/catalog` as data:
 * exactly one `.card-ratio`, its text a whole percent, **zero** `.count/.counts/.count-label/
 * .count-value/.comments` inside the card, and the ratio **not a control** — its tag is `SPAN` and
 * `closest("a, button, [role=button]")` is null, so a card's only interactive children are the two
 * links row 30 already measures.
 *
 * The ratio **rounds to whole percent**, so no number is pinned (failure bank: `96% → 96%` after a
 * vote). The assertion is the shape, never a value.
 *
 * The absences would pass on an empty grid, so the row asserts cards > 0 and reads the first card's
 * `.card-title` and `.card-author` first — and it waits for `.skel-card` to be **gone**, because the
 * loading grid draws `.card-cell`s too (T-50's find).
 *
 * The other side of the law: `/character/[id]` must still carry the counts. Sonic is the character
 * rows 6, 32 and 35 already open. The row reads `.counts[aria-label="Engagement"]`, its `.count`
 * labels through **`textContent`** (`.count-label` is uppercased in CSS, so `innerText` reads
 * `LIKES`), asserts each `.count-value` is a number, and asserts the like/dislike `.vote` controls
 * and a `.save` are on that page. It presses nothing — row 8 (`vote on it`) already proves the write.
 *
 * `/post/thread` is **not** an exception, and the row measures the difference instead of assuming
 * one: a post's card is `PostCard.tsrx`, whose footer `thread.md` → *Layout* fixes as *"a header with
 * the poster's profile and the time of posting, the body with its inline images, and a footer with
 * likes, dislikes, and the comment count"*. So a post card must draw two `.post-count` cells and one
 * `.post-comments` link **and no `.card-ratio`** — the ratio law is about the shared-item cards. A
 * later change that "fixes" either card to match the other turns this red.
 *
 * Read-only: no write, no CDP override, no probe left behind. Sits after row 35 and before
 * `sign out`, so `sign out` stays the walk's last row.
 * -------------------------------------------------------------------------------------------- */
const ENGAGEMENT_CHARACTER = CONTROL_CHARACTER;

results.push(
  await journey("engagement is a ratio on a card and counts on the detail page", async () => {
    await go("/character/catalog");
    await waitFor(
      `document.querySelectorAll(".skel-card").length === 0 && document.querySelectorAll(".card .card-ratio").length > 0`,
      "the character catalog to leave its skeletons behind",
      8000,
    );
    // The card re-measures its tags on a ResizeObserver, so the footer is read once the grid settles.
    await sleep(150);

    const grid = await js(`
      const clean = (v) => (v || "").replace(/\\s+/g, " ").trim();
      const cells = [...document.querySelectorAll(".card-cell")];
      const cards = cells.map((cell) => cell.querySelector(".card")).filter(Boolean);
      const surface = cards.map((card) => {
        const ratios = [...card.querySelectorAll(".card-ratio")];
        const ratio = ratios.length === 1 ? ratios[0] : null;
        return {
          title: clean(card.querySelector(".card-title")?.textContent),
          author: clean(card.querySelector(".card-author")?.textContent),
          ratios: ratios.length,
          text: ratio ? clean(ratio.textContent) : "",
          tag: ratio ? ratio.tagName : "",
          control: ratio ? (ratio.closest("a, button, [role=button]") ? "yes" : "no") : "none",
          stray: [...card.querySelectorAll(".count, .counts, .count-label, .count-value, .comments")].map((el) => el.className),
        };
      });
      return {
        skeletons: document.querySelectorAll(".skel-card").length,
        cells: cells.length,
        cards: cards.length,
        ratios: surface.map((one) => one.text),
        bad: surface.filter((one) => one.ratios !== 1 || !/^[0-9]{1,3}%$/.test(one.text) || one.tag !== "SPAN" || one.control !== "no" || one.stray.length > 0),
        unnamed: surface.filter((one) => one.title === "" || one.author === "").map((one) => one.title),
        first: surface[0] || null,
      };
    `);

    if (grid.cards === 0) {
      throw new Error(`the catalog drew ${grid.cells} card cell(s) and ${grid.skeletons} skeleton(s) but no card — an absence over an empty grid proves nothing`);
    }
    if (grid.bad.length > 0) {
      const one = grid.bad[0];
      throw new Error(
        `the card for ${JSON.stringify(one.title)} reads ${one.ratios} ratio(s) as ${JSON.stringify(one.text)} in a ${one.tag || "nothing"}, in a control: ${one.control}, with ${JSON.stringify(one.stray)} inside it — ${grid.bad.length}/${grid.cards} card(s) fail`,
      );
    }
    if (grid.unnamed.length > 0) {
      throw new Error(`the header or footer of ${grid.unnamed.length} card(s) drew no name: ${JSON.stringify(grid.unnamed.slice(0, 3))}`);
    }

    // The counts, on the page that owns them. Labels are read as textContent: innerText would say
    // LIKES (the .count-label rule uppercases), and a case-sensitive match would read as missing.
    await go(ENGAGEMENT_CHARACTER);
    await waitFor(
      `document.querySelector(".detail .counts[aria-label='Engagement']") !== null`,
      "the character detail page's engagement counts",
      8000,
    );
    const detail = await js(`
      const clean = (v) => (v || "").replace(/\\s+/g, " ").trim();
      const list = document.querySelector(".detail .counts[aria-label='Engagement']");
      const cells = list ? [...list.querySelectorAll(".count")] : [];
      return {
        labels: cells.map((el) => clean(el.querySelector(".count-label")?.textContent).toLowerCase()),
        values: cells.map((el) => clean(el.querySelector(".count-value")?.textContent)),
        votes: [...document.querySelectorAll(".detail button.vote")].map((el) => clean(el.textContent).toLowerCase()),
        save: document.querySelectorAll(".detail .save").length,
      };
    `);
    for (const label of ["likes", "dislikes"]) {
      if (!detail.labels.includes(label)) {
        throw new Error(`the detail page's engagement list draws no ${label} cell — it reads ${JSON.stringify(detail.labels)}`);
      }
    }
    if (detail.values.length !== detail.labels.length) {
      throw new Error(`the engagement list draws ${detail.labels.length} label(s) and ${detail.values.length} value(s): ${JSON.stringify(detail.labels)} / ${JSON.stringify(detail.values)}`);
    }
    /**
     * Four cells, and only three of them are counts: `Likes`, `Dislikes` and `Comments` read a whole
     * number, `Ratio` reads the same whole percent a card prints (`character-detail.tsrx` renders
     * `percent(ratioOf(...))` in a `.count-value`). So the shape is asserted **per label** — a blanket
     * "every value is a number" fails on a page that is right, which is exactly what this row's first
     * run did (`["412","61","87%","0"]`).
     */
    const shape = { likes: /^[0-9]+$/, dislikes: /^[0-9]+$/, ratio: /^[0-9]{1,3}%$/, comments: /^[0-9]+$/ };
    const wrong = detail.labels
      .map((label, index) => ({ label, value: detail.values[index] }))
      .filter((one) => !(shape[one.label] || /^[0-9]+$/).test(one.value));
    if (wrong.length > 0) {
      throw new Error(`an engagement cell does not read its own shape: ${JSON.stringify(wrong)} (labels ${JSON.stringify(detail.labels)})`);
    }
    if (!detail.votes.includes("like") || !detail.votes.includes("dislike") || detail.save === 0) {
      throw new Error(`the counts are on the page but the actions are not — .vote reads ${JSON.stringify(detail.votes)}, .save ×${detail.save}`);
    }

    // …and the feed's card is the other component on purpose: thread.md fixes counts in its footer.
    await go("/post/thread");
    await waitFor(
      `document.querySelectorAll(".skel-card").length === 0 && document.querySelectorAll(".post-counts").length > 0`,
      "the thread to draw its post cards",
      8000,
    );
    const feed = await js(`
      const cards = [...document.querySelectorAll(".card.post")];
      return {
        cards: cards.length,
        ratios: cards.filter((card) => card.querySelector(".card-ratio") !== null).length,
        counts: cards.map((card) => card.querySelectorAll(".post-count").length),
        comments: cards.map((card) => card.querySelectorAll(".post-comments").length),
      };
    `);
    if (feed.cards === 0) throw new Error("the thread drew no .card.post — the post half of the law proves nothing on an empty feed");
    if (feed.ratios !== 0) {
      throw new Error(`${feed.ratios}/${feed.cards} post card(s) draw a .card-ratio; a post card's footer is likes, dislikes and the comment count (thread.md → Layout)`);
    }
    if (feed.counts.some((n) => n !== 2) || feed.comments.some((n) => n !== 1)) {
      throw new Error(`post cards draw ${JSON.stringify(feed.counts)} .post-count cell(s) and ${JSON.stringify(feed.comments)} .post-comments link(s); the footer is two counts and one link`);
    }

    return `catalog: ${grid.cards}/${grid.cells} cards, one ratio each (${JSON.stringify(grid.ratios.slice(0, 3))}), 0 counts, ratio a SPAN outside any control · ${ENGAGEMENT_CHARACTER.slice(-6)}: ${JSON.stringify(detail.labels)} = ${JSON.stringify(detail.values)}, votes ${JSON.stringify(detail.votes)} + .save ×${detail.save} · thread: ${feed.cards} post card(s) × 2 counts + 1 comment link, 0 ratio`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-53 — the law about **preference versus permission**: *It is not access control. No route is
 * blocked, no 404, no redirect: a direct link still resolves* and *With Show off, a detail route
 * still resolves. The item draws with its chrome intact and the body withheld behind the same
 * reveal control a blurred item carries; there is no separate notice page and no empty render*
 * (`src/specs/systems/nsfw.md` → *Rules*). That is failure-bank entry 4, and no row had ever
 * opened a detail route with Show off — row 25 proves the *listing* obeys the pair and stops there.
 *
 * The two halves fail independently, so the row proves them separately and names which one moved:
 *
 *   - **Listing.** Both directions, so the absence is a *difference* and not a fact about a
 *     catalogue that never lists the row: with Show on, `/character/catalog` prints *Hollow Saint*
 *     (`CHARACTER(4)`, the only NSFW character that reaches page one); with Show off the same
 *     catalogue draws cards (20, not zero — an absence over an empty grid proves nothing) and none
 *     of them prints that title.
 *   - **Route.** `/character/c0a1b2c3-…-000000000004` is opened **by address**, never by a press:
 *     the law is about a direct link. `.detail` mounts, its `h1.title` reads *Hollow Saint*, the
 *     `.veiled` body carries `is-covered` + `aria-hidden="true"`, a control named **Reveal** is
 *     inside `.detail`, and the `.counts[aria-label="Engagement"]` cells still print their numbers
 *     (*the numbers are never hidden*). Then *Reveal* is pressed and `is-covered` is gone, the name
 *     survives, the control is gone, and Show still reads off — *a reveal is one view, and it
 *     writes nothing to the account*.
 *
 * **This row owns the NSFW pair**, so it records the seed pair from `/dev/state` instead of
 * assuming `true/true`, restores **that**, reads it back, and re-reads the catalogue — a leak makes
 * the *next run's* rows read a flipped account. The restore runs even when a half failed, and a
 * restore failure is reported **with** the body failure rather than masking it.
 *
 * Sits after row 36 and before `sign out`, so `sign out` stays the walk's last row.
 * -------------------------------------------------------------------------------------------- */
const NSFW_CHARACTER = "/character/c0a1b2c3-0000-4000-8000-000000000004";
const NSFW_NAME = "Hollow Saint";

results.push(
  await journey("a viewer's NSFW filter hides a listing, never a route", async () => {
    await go("/dev/state");
    await waitFor(`document.querySelectorAll("button.toggle").length === 2`, "/dev/state's two toggles", 8000);
    // The pair as this session found it — recorded, never assumed (row 25's lesson, and this row
    // owns the pair, so a hard-coded restore would silently flip the account for every later run).
    const seedShow = (await toggleState("Show NSFW content")) === "true";
    const seedBlur = (await toggleState("Blur NSFW content")) === "true";

    /** The catalogue read as data: how many cards, and the title each one prints. */
    const listing = async () => {
      await go("/character/catalog");
      await waitFor(
        `document.querySelectorAll(".skel-card").length === 0 && document.querySelectorAll(".card").length > 0`,
        "the character catalog to leave its skeletons behind",
        8000,
      );
      await sleep(150);
      return js(`
        const cards = [...document.querySelectorAll(".card")];
        return {
          cards: cards.length,
          titles: cards.map((card) => {
            const title = card.querySelector(".card-title");
            return title ? title.textContent.trim() : "";
          }),
        };
      `);
    };

    let flipped = false;
    let listingHalf = "";
    let routeHalf = "";
    let restoreHalf = "";
    let bodyError = null;

    try {
      /**
       * **Both directions.** The seed this walk signs in with has Show off, so an absence alone
       * would be the *only* reading and would pass on a catalogue that never lists the row at all
       * (a private row, a paging change, a fixture edit). Turning Show on first makes the absence
       * below a **difference**: the same card, on the same page, gone for one preference.
       */
      await setToggle("Show NSFW content", true);
      const shown = await listing();
      if (!shown.titles.includes(NSFW_NAME)) {
        throw new Error(
          `the catalogue does not print ${JSON.stringify(NSFW_NAME)} even with Show on — ${shown.cards} card(s), first ${JSON.stringify(shown.titles.slice(0, 3))}; the absence below would prove nothing`,
        );
      }

      await setToggle("Show NSFW content", false);
      flipped = true;

      const hidden = await listing();
      if (hidden.cards === 0) {
        throw new Error("the catalog drew no cards with Show off — the absence proves nothing on an empty listing");
      }
      if (hidden.titles.includes(NSFW_NAME)) {
        throw new Error(
          `the listing still prints ${JSON.stringify(NSFW_NAME)} with Show off — ${hidden.cards} card(s): ${JSON.stringify(hidden.titles.slice(0, 4))}`,
        );
      }
      listingHalf = `${shown.cards} card(s) with Show on incl. ${JSON.stringify(NSFW_NAME)} → ${hidden.cards} with Show off, absent`;

      // By address, no press: a direct link is the thing the spec promises to resolve.
      await go(NSFW_CHARACTER);
      try {
        await waitFor(
          `(() => {
            const h = document.querySelector(".detail h1.title, .detail h1.name, .detail h1");
            return h && h.textContent.trim() === ${JSON.stringify(NSFW_NAME)} ? h.textContent.trim() : "";
          })()`,
          `the detail page's name, ${JSON.stringify(NSFW_NAME)}`,
          8000,
        );
      } catch {
        // A poll timeout is not the proof (T-36a): name the route and what mounted instead.
        const now = await js(`
          const clean = (v) => (v || "").replace(/\\s+/g, " ").trim();
          const roots = {};
          for (const sel of [".detail", ".catalog", ".card-grid", ".alert"]) {
            roots[sel] = document.querySelectorAll(sel).length;
          }
          return {
            title: document.title,
            path: location.pathname,
            roots,
            headings: [...document.querySelectorAll("h1, h2")].map((el) => clean(el.textContent)).slice(0, 4),
            body: clean(document.body.innerText).slice(0, 120),
          };
        `);
        throw new Error(
          `${NSFW_CHARACTER} resolved nothing with Show off — title ${JSON.stringify(now.title)}, path ${now.path}, roots ${JSON.stringify(now.roots)}, headings ${JSON.stringify(now.headings)}, body ${JSON.stringify(now.body)}; nsfw.md → Rules says a detail route always resolves`,
        );
      }

      const covered = await js(`
        const root = document.querySelector(".detail");
        if (!root) return null;
        const clean = (v) => (v || "").replace(/\\s+/g, " ").trim();
        const label = (el) => clean(el.getAttribute("aria-label") || el.textContent);
        const veiled = root.querySelector(".veiled");
        const list = root.querySelector(".counts[aria-label='Engagement']");
        const cells = list ? [...list.querySelectorAll(".count")] : [];
        return {
          name: clean((root.querySelector("h1.title, h1.name, h1") || {}).textContent),
          veiled: veiled !== null,
          covered: veiled ? veiled.classList.contains("is-covered") : null,
          hidden: veiled ? veiled.getAttribute("aria-hidden") : null,
          labels: [...root.querySelectorAll("button, a")].map(label),
          counts: cells.map((cell) => ({
            label: clean((cell.querySelector(".count-label") || {}).textContent).toLowerCase(),
            value: clean((cell.querySelector(".count-value") || {}).textContent),
          })),
        };
      `);
      if (!covered) throw new Error(`no .detail on ${NSFW_CHARACTER} after the name resolved`);
      if (covered.name !== NSFW_NAME) throw new Error(`the detail page's name reads ${JSON.stringify(covered.name)}`);
      if (!covered.veiled) throw new Error("the covered detail page draws no .veiled body to withhold");
      if (covered.covered !== true) {
        throw new Error(`.veiled does not carry is-covered with Show off (classList: ${JSON.stringify(covered.covered)}) — the body is not withheld`);
      }
      if (covered.hidden !== "true") {
        throw new Error(`.veiled reads aria-hidden=${JSON.stringify(covered.hidden)} with Show off; the body must be hidden from a screen reader too`);
      }
      if (!covered.labels.includes("Reveal")) {
        throw new Error(`no control named Reveal inside .detail — it draws ${JSON.stringify(covered.labels.slice(0, 8))}`);
      }
      if (covered.counts.length === 0) throw new Error("the covered detail page draws no engagement cells — the numbers are never hidden");
      const blank = covered.counts.filter((cell) => !/^[0-9]{1,3}%?$/.test(cell.value));
      if (blank.length > 0) {
        throw new Error(`a covered engagement cell reads no number: ${JSON.stringify(blank)} (all ${JSON.stringify(covered.counts)})`);
      }

      await click("Reveal", { exact: true, scope: ".detail button" });
      const revealed = await js(`
        const root = document.querySelector(".detail");
        if (!root) return null;
        const clean = (v) => (v || "").replace(/\\s+/g, " ").trim();
        const veiled = root.querySelector(".veiled");
        return {
          name: clean((root.querySelector("h1.title, h1.name, h1") || {}).textContent),
          covered: veiled ? veiled.classList.contains("is-covered") : null,
          hidden: veiled ? veiled.getAttribute("aria-hidden") : null,
          reveal: [...root.querySelectorAll("button")].filter((el) => clean(el.getAttribute("aria-label") || el.textContent).toLowerCase() === "reveal").length,
        };
      `);
      if (!revealed) throw new Error("the detail page unmounted on Reveal");
      if (revealed.covered !== false) throw new Error(`Reveal left .veiled is-covered=${JSON.stringify(revealed.covered)}`);
      if (revealed.hidden !== "false") throw new Error(`Reveal left .veiled aria-hidden=${JSON.stringify(revealed.hidden)}`);
      if (revealed.reveal !== 0) throw new Error(`Reveal is still on the page ×${revealed.reveal} after it was pressed`);
      if (revealed.name !== NSFW_NAME) throw new Error(`the name changed on Reveal: ${JSON.stringify(revealed.name)}`);

      routeHalf = `.detail + ${JSON.stringify(NSFW_NAME)}, .veiled.is-covered + aria-hidden, Reveal inside .detail, ${covered.counts.length} count cell(s) ${JSON.stringify(covered.counts.map((cell) => cell.value))} → Reveal clears the cover, name survives`;
    } catch (error) {
      bodyError = error;
    }

    try {
      await go("/dev/state");
      await waitFor(`document.querySelectorAll("button.toggle").length === 2`, "/dev/state's two toggles after the route half", 8000);
      // A reveal is a single look and writes nothing to the account (`nsfw.md` → *Rules*).
      if (flipped && (await toggleState("Show NSFW content")) !== "false") {
        throw new Error("Show reads on again after a Reveal — a reveal must not change the preference");
      }
      await setToggle("Show NSFW content", seedShow);
      await setToggle("Blur NSFW content", seedBlur);
      const backShow = (await toggleState("Show NSFW content")) === "true";
      const backBlur = (await toggleState("Blur NSFW content")) === "true";
      if (backShow !== seedShow || backBlur !== seedBlur) {
        throw new Error(
          `the NSFW pair did not come back: Show ${backShow} / Blur ${backBlur}, seed Show ${seedShow} / Blur ${seedBlur} (strip reads ${await storeCell("Show")}/${await storeCell("Blur")})`,
        );
      }
      const back = await listing();
      const listed = back.titles.includes(NSFW_NAME);
      if (listed !== seedShow) {
        throw new Error(
          `after restoring Show ${seedShow} the catalogue ${listed ? "still lists" : "loses"} ${JSON.stringify(NSFW_NAME)} — ${back.cards} card(s), first ${JSON.stringify(back.titles.slice(0, 3))}`,
        );
      }
      restoreHalf = `Show ${backShow} / Blur ${backBlur} · catalogue ${back.cards} card(s), ${JSON.stringify(NSFW_NAME)} ${listed ? "listed" : "absent"}`;
    } catch (error) {
      throw new Error(bodyError ? `${bodyError.message} — and the restore failed: ${error.message}` : error.message);
    }
    if (bodyError) throw bodyError;

    return `Show off: ${listingHalf} · ${NSFW_CHARACTER.slice(-6)} → ${routeHalf} · restored ${restoreHalf}`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-54 — the law that a cover is **structural**: *Blur is structural. The unit keeps its chrome. On
 * a catalog card the top header is the title and the bottom footer is a single row holding the
 * author beside the ratio as a percentage; the bottom line carries no comment count. The blurred
 * area is exactly what sits between them — the avatar, the tagline, and the tags … **The numbers
 * are never hidden** — only the body is covered* (`src/specs/systems/nsfw.md` → *Rules*). Failure
 * bank entry 1. No row had ever looked at a **covered** card: row 36 measures the counts with Blur
 * off, row 25 counts `.card.is-covered` and stops, row 37 covers a *detail* page.
 *
 * Moving `.card-foot` inside `.card-veil` is one indentation and every other gate stays green, so
 * this row reads the split as a **containment** question per covered card: `.card-head` and
 * `.card-foot` exist, `.card-ratio` sits in the footer, and `veil.contains(...)` is false for all
 * three — a sibling guess would pass on a card that drew the footer twice. `.card-veil` must carry
 * `aria-hidden="true"`, a `Reveal` must sit in `.card-cover` (beside the veil inside `.card-middle`,
 * so it needs its own containment check), and **zero** `.card-ratio`/`.card-author`/`.count` may
 * live inside the veil.
 *
 * The second half is the spec's *Revealing one item never reveals the rest*: with ≥1 covered card,
 * press the **first** covered card's Reveal (scoped to `.card.is-covered .card-cover button`, never
 * a page-level `click("Reveal")`, which presses whichever card answers first), then assert the
 * covered count fell by exactly one, the pressed card is no longer `is-covered`, and every other
 * covered title is still there **in the same order**.
 *
 * The thread half repeats the split on `/post/thread`: `.post-head`, `.post-counts` (two
 * `.post-count`) and `.post-comments` outside `.post-veil`, `aria-hidden="true"` on the veil, and
 * no count inside it. Post 7 (`lib/fixtures/posts.ts`) is the only NSFW post; if the thread draws
 * no covered card the row says so instead of passing on an empty set.
 *
 * **This row owns the NSFW pair too.** It records the seed from `/dev/state`, turns Show **and**
 * Blur on (Blur only matters while Show is on — `nsfw.md`), re-reads the pair after the Reveals
 * (a reveal is a look, not a preference), then restores the recorded seed and asserts the listing
 * agrees with it. The restore runs in its own `try` and reports **with** the body failure.
 *
 * Sits after row 37 and before `sign out`, so `sign out` stays the walk's last row.
 * -------------------------------------------------------------------------------------------- */
const COVER_CHARACTER_NAME = "Hollow Saint";
/** The flagged post this row composes for the thread half — row 21 removes the only fixture one. */
const COVER_POST_BODY = "Smoke walk: the flagged post that measures a covered card's split.";

results.push(
  await journey("a cover keeps the chrome and the numbers outside it", async () => {
    await go("/dev/state");
    await waitFor(`document.querySelectorAll("button.toggle").length === 2`, "/dev/state's two toggles", 8000);
    const seedShow = (await toggleState("Show NSFW content")) === "true";
    const seedBlur = (await toggleState("Blur NSFW content")) === "true";

    /**
     * `/character/catalog` read as data: every card's title, the covered cards in DOM order, and
     * each covered card's own containment. The reveal press and the restore both re-read through
     * this, so one definition answers "what is on the page" for the whole row.
     */
    const readCatalog = async () => {
      await go("/character/catalog");
      await waitFor(
        `document.querySelectorAll(".skel-card").length === 0 && document.querySelectorAll(".card").length > 0`,
        "the character catalog to leave its skeletons behind",
        8000,
      );
      // The card re-measures its tags on a ResizeObserver; the footer is read once the grid settles.
      await sleep(150);
      return js(`
        const clean = (v) => (v || "").replace(/\\s+/g, " ").trim();
        const title = (card) => clean((card.querySelector(".card-head .card-title") || card.querySelector(".card-title") || {}).textContent);
        const cards = [...document.querySelectorAll(".card")];
        const covered = cards.filter((card) => card.classList.contains("is-covered"));
        const read = (card) => {
          const veil = card.querySelector(".card-veil");
          const head = card.querySelector(".card-head");
          const name = card.querySelector(".card-head .card-title");
          const foot = card.querySelector(".card-foot");
          const ratio = card.querySelector(".card-ratio");
          const author = card.querySelector(".card-author");
          const cover = card.querySelector(".card-cover");
          return {
            title: title(card),
            head: head !== null,
            titleOutsideVeil: !!name && !!veil && !veil.contains(name),
            foot: foot !== null,
            footOutsideVeil: !!foot && !!veil && !veil.contains(foot),
            ratio: ratio !== null,
            ratioText: ratio ? clean(ratio.textContent) : "",
            ratioInFoot: !!ratio && !!foot && foot.contains(ratio),
            ratioOutsideVeil: !!ratio && !!veil && !veil.contains(ratio),
            authorOutsideVeil: !!author && !!veil && !veil.contains(author),
            veilAria: veil ? veil.getAttribute("aria-hidden") : null,
            veilFilter: veil ? getComputedStyle(veil).filter : "",
            revealInCover: !!cover && cover.querySelector("button") !== null,
            coverOutsideVeil: !!cover && !!veil && !veil.contains(cover),
            insideVeil: [...(veil ? veil.querySelectorAll(".card-ratio, .card-author, .count, .counts, .count-label, .count-value") : [])]
              .map((el) => "." + String(el.className).split(" ").filter(Boolean).join(".")),
          };
        };
        return {
          cards: cards.length,
          titles: cards.map(title),
          covered: covered.map(read),
          coveredTitles: covered.map(title),
        };
      `);
    };

    let bodyError = null;
    let catalogHalf = "";
    let threadHalf = "";
    let restoreHalf = "";

    try {
      // Blur only matters while Show is on, so this row needs the pair — and it owns it.
      await setToggle("Show NSFW content", true);
      await setToggle("Blur NSFW content", true);

      const catalog = await readCatalog();
      if (catalog.covered.length === 0) {
        throw new Error(
          `no .card.is-covered on /character/catalog with Show + Blur on — ${catalog.cards} card(s) drawn (${JSON.stringify(catalog.titles.slice(0, 4))}…); a cover rule read over zero covered cards proves nothing`,
        );
      }
      const broken = catalog.covered.filter(
        (one) =>
          !one.head ||
          !one.title ||
          !one.titleOutsideVeil ||
          !one.foot ||
          !one.footOutsideVeil ||
          !one.ratio ||
          !one.ratioInFoot ||
          !one.ratioOutsideVeil ||
          !one.authorOutsideVeil ||
          one.veilAria !== "true" ||
          !one.revealInCover ||
          !one.coverOutsideVeil ||
          one.insideVeil.length > 0,
      );
      if (broken.length > 0) {
        const one = broken[0];
        throw new Error(
          `the covered card ${JSON.stringify(one.title)} does not keep its chrome outside the veil: head ${one.head} (title outside the veil ${one.titleOutsideVeil}), footer ${one.foot} (outside the veil ${one.footOutsideVeil}), ratio ${one.ratio} (in the footer ${one.ratioInFoot}, outside the veil ${one.ratioOutsideVeil}), author outside the veil ${one.authorOutsideVeil}, veil aria-hidden ${JSON.stringify(one.veilAria)}, Reveal in .card-cover ${one.revealInCover} (outside the veil ${one.coverOutsideVeil}), numbers inside the veil ${JSON.stringify(one.insideVeil)} — ${broken.length}/${catalog.covered.length} covered card(s) fail; nsfw.md → Rules says the numbers are never hidden`,
        );
      }

      // One reveal reveals one item — and only the one that was pressed.
      const beforeTitles = catalog.coveredTitles;
      await click("Reveal", { exact: true, scope: ".card.is-covered .card-cover button" });
      const afterReveal = await js(`
        const clean = (v) => (v || "").replace(/\\s+/g, " ").trim();
        const title = (card) => clean((card.querySelector(".card-head .card-title") || card.querySelector(".card-title") || {}).textContent);
        const cards = [...document.querySelectorAll(".card")];
        const covered = cards.filter((card) => card.classList.contains("is-covered"));
        const pressed = ${JSON.stringify(beforeTitles[0])};
        return {
          total: cards.length,
          covered: covered.length,
          titles: covered.map(title),
          pressedCovered: cards.filter((card) => title(card) === pressed && card.classList.contains("is-covered")).length,
          pressedCards: cards.filter((card) => title(card) === pressed).length,
          pressedReveal: cards.filter((card) => title(card) === pressed).reduce((n, card) => n + card.querySelectorAll(".card-cover button").length, 0),
        };
      `);
      if (afterReveal.covered !== beforeTitles.length - 1) {
        throw new Error(
          `Reveal on one card took the covered count to ${afterReveal.covered}, not ${beforeTitles.length - 1} — before ${JSON.stringify(beforeTitles)}, after ${JSON.stringify(afterReveal.titles)}; one reveal reveals one item, never the rest`,
        );
      }
      if (afterReveal.pressedCards !== 1) {
        throw new Error(`the pressed title ${JSON.stringify(beforeTitles[0])} matches ${afterReveal.pressedCards} card(s) — the reveal assertion needs a unique title`);
      }
      if (afterReveal.pressedCovered !== 0) {
        throw new Error(`the pressed card ${JSON.stringify(beforeTitles[0])} is still is-covered after its own Reveal`);
      }
      if (JSON.stringify(afterReveal.titles) !== JSON.stringify(beforeTitles.slice(1))) {
        throw new Error(
          `Reveal changed the other cards: covered before ${JSON.stringify(beforeTitles)}, after ${JSON.stringify(afterReveal.titles)}`,
        );
      }
      if (afterReveal.pressedReveal !== 0) {
        throw new Error(`the pressed card still draws ${afterReveal.pressedReveal} Reveal control(s) — a revealed card offers none`);
      }
      catalogHalf = `${catalog.covered.length}/${catalog.cards} card(s) covered, chrome + ${JSON.stringify(catalog.covered[0].ratioText)} ratio outside the veil (veil filter ${JSON.stringify(catalog.covered[0].veilFilter)}), 0 numbers inside; Reveal on ${JSON.stringify(beforeTitles[0])} → ${afterReveal.covered} covered, the order kept`;

      // The thread's card is the other component: `thread.md` fixes counts in its footer.
      //
      // **The row seeds its own flagged post.** Case 2 targets post 7 — the only NSFW post in
      // `lib/fixtures/posts.ts` — and row 21 concludes that case as *removed*, which takes post 7
      // off every listing before this row runs (measured: 11 post cards, none `17/6`). So the feed
      // holds no flagged post by now, and a cover rule read over zero covered cards proves nothing.
      // Composing one with the **NSFW** toggle on is `post/create.md`'s own flag control, and
      // `nsfw.md` says the viewer's own flagged post is covered like anyone else's — the seed is
      // also the stricter case.
      await go("/post/create");
      await waitFor(`document.querySelector("textarea") !== null`, "the composer", 8000);
      await type("textarea", COVER_POST_BODY);
      await click("NSFW", { exact: true });
      await waitFor(
        `(() => { const el = [...document.querySelectorAll("button.toggle")].find((e) => ((e.getAttribute("aria-label") || e.innerText || "").trim() === "NSFW")); return el && el.getAttribute("aria-pressed") === "true"; })()`,
        "the composer's NSFW toggle to read true",
        6000,
      );
      await click("Publish", { exact: true });
      await waitText(COVER_POST_BODY, 8000);

      await go("/post/thread");
      await waitFor(
        `document.querySelectorAll(".skel-card").length === 0 && document.querySelectorAll(".post-counts").length > 0`,
        "the thread to draw its post cards",
        8000,
      );
      const thread = await js(`
        const clean = (v) => (v || "").replace(/\\s+/g, " ").trim();
        const cards = [...document.querySelectorAll(".card.post")];
        const covered = cards.filter((card) => card.classList.contains("is-covered"));
        const read = (card) => {
          const veil = card.querySelector(".post-veil");
          const head = card.querySelector(".post-head");
          const foot = card.querySelector(".post-foot");
          const counts = card.querySelector(".post-counts");
          const comments = card.querySelector(".post-comments");
          const cover = card.querySelector(".card-cover");
          return {
            headOutsideVeil: !!head && !!veil && !veil.contains(head),
            foot: foot !== null,
            footOutsideVeil: !!foot && !!veil && !veil.contains(foot),
            countCells: card.querySelectorAll(".post-count").length,
            countsOutsideVeil: !!counts && !!veil && !veil.contains(counts),
            values: [...card.querySelectorAll(".post-count-value")].map((el) => clean(el.textContent)),
            comments: comments !== null,
            commentOutsideVeil: !!comments && !!veil && !veil.contains(comments),
            veilAria: veil ? veil.getAttribute("aria-hidden") : null,
            revealInCover: !!cover && cover.querySelector("button") !== null,
            coverOutsideVeil: !!cover && !!veil && !veil.contains(cover),
            insideVeil: [...(veil ? veil.querySelectorAll(".post-count, .post-counts, .post-count-value, .post-comments") : [])]
              .map((el) => "." + String(el.className).split(" ").filter(Boolean).join(".")),
          };
        };
        return {
          cards: cards.length,
          covered: covered.map(read),
          // When no card is covered this is the evidence that says why: each card's own class
          // string, and the pair the page's own control renders (it mirrors the store).
          classes: cards.map((card) => card.className),
          counts: cards.map((card) => [...card.querySelectorAll(".post-count-value")].map((el) => el.textContent.trim()).join("/")),
          veils: cards.map((card) => {
            const veil = card.querySelector(".post-veil");
            return veil ? veil.getAttribute("aria-hidden") : "no-veil";
          }),
          covers: document.querySelectorAll(".card.post .card-cover").length,
          toggles: [...document.querySelectorAll("button.toggle")].map((el) => [
            (el.querySelector(".toggle-label") || el).textContent.trim(),
            el.getAttribute("aria-pressed"),
          ]),
        };
      `);
      if (thread.cards === 0) throw new Error("the thread drew no .card.post — the post half of the law proves nothing on an empty feed");
      if (thread.covered.length === 0) {
        throw new Error(
          `the thread draws ${thread.cards} post card(s) and none is .is-covered with Show + Blur on — post 7 is the only NSFW post (lib/fixtures/posts.ts); the page's own toggles read ${JSON.stringify(thread.toggles)}, its veils ${JSON.stringify(thread.veils)} with ${thread.covers} cover(s) and its counts ${JSON.stringify(thread.counts)}`,
        );
      }
      const threadBroken = thread.covered.filter(
        (one) =>
          !one.headOutsideVeil ||
          !one.foot ||
          !one.footOutsideVeil ||
          one.countCells !== 2 ||
          !one.countsOutsideVeil ||
          !one.comments ||
          !one.commentOutsideVeil ||
          one.veilAria !== "true" ||
          !one.revealInCover ||
          !one.coverOutsideVeil ||
          one.insideVeil.length > 0,
      );
      if (threadBroken.length > 0) {
        const one = threadBroken[0];
        throw new Error(
          `a covered post card keeps its chrome outside .post-veil: head outside ${one.headOutsideVeil}, footer ${one.foot} (outside the veil ${one.footOutsideVeil}), ${one.countCells} .post-count cell(s) (outside the veil ${one.countsOutsideVeil}) reading ${JSON.stringify(one.values)}, .post-comments ${one.comments} (outside the veil ${one.commentOutsideVeil}), veil aria-hidden ${JSON.stringify(one.veilAria)}, Reveal in .card-cover ${one.revealInCover} (outside the veil ${one.coverOutsideVeil}), numbers inside the veil ${JSON.stringify(one.insideVeil)} — ${threadBroken.length}/${thread.covered.length} covered post card(s) fail`,
        );
      }
      threadHalf = `${thread.covered.length}/${thread.cards} post card(s) covered, two counts ${JSON.stringify(thread.covered[0].values)} + a comment link outside .post-veil, 0 numbers inside`;
    } catch (error) {
      bodyError = error;
    }

    try {
      await go("/dev/state");
      await waitFor(`document.querySelectorAll("button.toggle").length === 2`, "/dev/state's two toggles after the cover halves", 8000);
      // A reveal is a single look and writes nothing to the account (`nsfw.md` → *Rules*): the pair
      // must still be the one this row set, read **before** the restore puts the seed back.
      const heldShow = (await toggleState("Show NSFW content")) === "true";
      const heldBlur = (await toggleState("Blur NSFW content")) === "true";
      if (!heldShow || !heldBlur) {
        throw new Error(`the pair moved under the Reveals: Show ${heldShow} / Blur ${heldBlur} — a reveal must not write the preference`);
      }
      await setToggle("Show NSFW content", seedShow);
      await setToggle("Blur NSFW content", seedBlur);
      const backShow = (await toggleState("Show NSFW content")) === "true";
      const backBlur = (await toggleState("Blur NSFW content")) === "true";
      if (backShow !== seedShow || backBlur !== seedBlur) {
        throw new Error(
          `the NSFW pair did not come back: Show ${backShow} / Blur ${backBlur}, seed Show ${seedShow} / Blur ${seedBlur} (strip reads ${await storeCell("Show")}/${await storeCell("Blur")})`,
        );
      }
      const back = await readCatalog();
      const listed = back.titles.includes(COVER_CHARACTER_NAME);
      if (listed !== seedShow) {
        throw new Error(
          `after restoring Show ${seedShow} the catalogue ${listed ? "still lists" : "loses"} ${JSON.stringify(COVER_CHARACTER_NAME)} — ${back.cards} card(s), first ${JSON.stringify(back.titles.slice(0, 3))}`,
        );
      }
      const coveredBack = back.covered.length > 0;
      if (coveredBack !== (seedShow && seedBlur)) {
        throw new Error(
          `after restoring Show ${seedShow} / Blur ${seedBlur} the catalogue draws ${back.covered.length} covered card(s) — Blur only covers what Show lets through`,
        );
      }
      restoreHalf = `Show ${backShow} / Blur ${backBlur} · ${back.cards} card(s), ${JSON.stringify(COVER_CHARACTER_NAME)} ${listed ? "listed" : "absent"}, ${back.covered.length} covered`;
    } catch (error) {
      throw new Error(bodyError ? `${bodyError.message} — and the restore failed: ${error.message}` : error.message);
    }
    if (bodyError) throw bodyError;

    return `catalog: ${catalogHalf} · thread: ${threadHalf} · restored ${restoreHalf}`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-55 — the law about **where the thread's sort lives**: *Sorting and filtering live in the query
 * string, per the conventions, so a filtered thread is shareable* … *paging stays out of the URL*
 * (`src/specs/pages/post/thread.md` → *URL* / *Layout*). `SHIP-PLAN.md`'s failure bank entry 3 is
 * *"`Load more` state lost on back → paging in component state, filters in URL"*, so the product
 * answer is **sort in the URL, paging in the component**.
 *
 * `post-thread.tsrx` implements exactly that — `writeSort()` pushes `?sort=`, `newest` writes **no**
 * param, `loadMore()` never touches the URL — and no gate could see any of it: `spec-routes.mjs`
 * proves a page module resolves (never *what it read*), and no row had ever read `location.search`
 * on the thread or called `history.back()` (row 4 hops with `go()`, the forward direction only).
 *
 * **The suspicion, settled rather than assumed.** `sort = track(readSort(useQuery()))` is a
 * **one-time read** and `chooseSort()` is the only writer, so a Back that merely repainted the
 * address could leave the listing sorted the old way, with the `Select` — reading the same frozen
 * track — agreeing with the listing and disagreeing with the URL. The row therefore reads **all
 * three**: `location.search`, the control's own value, and the cards. `App.tsrx`'s effect keys on
 * `path + search`, so a real Back remounts the page and the one-time read is honest — this row is
 * what keeps that true.
 *
 * **Order matters.** The shareable half runs *first*, by address; then the two presses. A `go()` to
 * `?sort=discussed` between the presses would leave two entries with the same URL underneath, and
 * the second `history.back()` would land on `?sort=discussed` again — the row would read red on a
 * page that is right. Entries are counted from the `go("/post/thread")` this row makes, not assumed.
 *
 * The refetch is proved by the **nodes**, not the URL: the fetch's `epoch` rides in each row's key,
 * so a new listing remounts every card. Each card is stamped before a gesture and the stamp must be
 * gone after it — an assertion "the address changed" cannot make. A `Select` value read back from
 * `choose()` proves the control, never the page, so it is never the evidence here.
 *
 * The paging half used to be an **absence**: twelve posts were under `PAGE_SIZE` 24, so the feed
 * drew no `.pager-action` and its pager read *End of feed.* **T-57 grows the fixture to 30 rows**
 * (29 listed — post 6 is `removed`), which is 24 on page 1 and 5 on page 2, so this row now
 * **presses the control** it used to only look for: one append, the first page's node identity and
 * order kept, `location.search` still empty, then a `history.back()` that proves paging pushed no
 * entry at all (it leaves the thread instead of returning to a loaded page), and a return that reads
 * the first page again.
 *
 * Read-only: no store write, no probe. **T-80 adds two metrics overrides** (`640×740`, `900×740`) at
 * the very end — after the paging half, where no read follows — reading `.controls` in both
 * directions; they are cleared in one `finally` and `innerWidth` is asserted back. Ends on
 * `/post/thread` with no query, and sits after row 38 and before `sign out`, so `sign out` stays the
 * walk's last row.
 * -------------------------------------------------------------------------------------------- */
const THREAD_PATH = "/post/thread";

results.push(
  await journey("the thread's sort is a URL fact, and Back is the proof", async () => {
    /** One reading of all three: the address, the control, and the listing. */
    const state = () =>
      js(`
        const el = document.querySelector("select.select-input");
        const cards = [...document.querySelectorAll(".card.post")];
        const note = document.querySelector(".pager-note");
        return {
          path: location.pathname,
          search: location.search,
          value: el ? el.value : null,
          cards: cards.length,
          skeletons: document.querySelectorAll(".skel-card").length,
          marks: cards.filter((card) => card.__walkMark !== undefined).length,
          order: cards.map((card) => {
            const link = card.querySelector(".post-time");
            const raw = link ? link.getAttribute("href") || "" : "";
            return raw.split("/").filter(Boolean).pop() || "";
          }),
          pager: document.querySelectorAll(".pager-action").length,
          note: (note ? note.textContent : "").replace(/\\s+/g, " ").trim(),
        };
      `);

    const describe = (now) =>
      `search ${JSON.stringify(now.search)}, sort control ${JSON.stringify(now.value)}, ${now.cards} post card(s), ${now.skeletons} skeleton(s), ${now.marks} still stamped, at ${now.path}`;

    /**
     * Poll for the **exact** `location.search` **and** the control's own value, and fail with all
     * three readings. `waitUrl()` is a substring match — `?sort=discussed` *contains* `?sort=disc`,
     * which is the class of bug that hid a doubled base on Pages (T-45) — and a bare poll timeout
     * names nothing a reader can act on (T-36a).
     */
    async function expectSort(wantSearch, wantValue, label, timeout = 8000) {
      const deadline = Date.now() + timeout;
      let now = await state();
      while (Date.now() < deadline && !(now.search === wantSearch && now.value === wantValue)) {
        await sleep(120);
        now = await state();
      }
      if (now.search !== wantSearch || now.value !== wantValue) {
        throw new Error(
          `${label}: wanted search ${JSON.stringify(wantSearch)} with the control on ${JSON.stringify(wantValue)} — read ${describe(now)}`,
        );
      }
      return now;
    }

    /** Stamp every card, so a listing that was **re-rendered** is visible and a frozen one is not. */
    const stamp = () =>
      js(`
        const cards = [...document.querySelectorAll(".card.post")];
        for (const card of cards) card.__walkMark = "before";
        return cards.length;
      `);

    /** The refetch proof: a skeleton frame, cards whose stamp is gone, or a new order. */
    async function expectRerender(had, label, timeout = 8000) {
      const deadline = Date.now() + timeout;
      let sawSkeleton = false;
      let now = await state();
      while (Date.now() < deadline) {
        if (now.skeletons > 0) sawSkeleton = true;
        if (now.cards > 0 && (now.marks === 0 || JSON.stringify(now.order) !== JSON.stringify(had.order))) {
          return now;
        }
        await sleep(80);
        now = await state();
      }
      throw new Error(
        `${label}: the feed never re-rendered — ${describe(now)}, a loading frame was ${sawSkeleton ? "seen" : "never seen"}`,
      );
    }

    // 1. **Shareable**, by address: the spec's word is about a loaded page, not a pressed control.
    await go(`${THREAD_PATH}?sort=discussed`);
    const shared = await expectSort("?sort=discussed", "discussed", "the thread opened at ?sort=discussed");
    if (shared.cards === 0) {
      throw new Error(
        `?sort=discussed loaded ${shared.cards} post card(s) — a sort read over an empty feed proves nothing (${describe(shared)})`,
      );
    }
    if (!/\/post\/thread$/.test(shared.path)) {
      throw new Error(`?sort=discussed mounted ${shared.path}, not /post/thread`);
    }

    // 2. **`newest` is the absence of the param** — never `?sort=newest`, in either direction.
    await go(THREAD_PATH);
    const newest = await expectSort("", "newest", "the thread at no query");
    if (newest.cards === 0) {
      throw new Error(`/post/thread drew ${newest.cards} post card(s) at no query (${describe(newest)})`);
    }
    if ((await stamp()) === 0) {
      throw new Error(`no post card could be stamped before the sort change (${describe(await state())})`);
    }

    await choose("select.select-input", "discussed"); // T-41: a native select needs a real `change`
    const discussed = await expectSort("?sort=discussed", "discussed", "choosing Most discussed");
    await expectRerender(newest, "choosing Most discussed");

    // 3. A second choice, so the Back below has a real entry to return to.
    const beforeLiked = await state();
    await stamp();
    await choose("select.select-input", "liked");
    const liked = await expectSort("?sort=liked", "liked", "choosing Most liked");
    await expectRerender(beforeLiked, "choosing Most liked");

    // 4. **Back is the proof**: the address, the control *and* the listing must move together.
    const beforeBack = await state();
    await stamp();
    await js(`history.back(); return true;`);
    const back = await expectSort("?sort=discussed", "discussed", "history.back() to ?sort=discussed");
    await expectRerender(beforeBack, "history.back() to ?sort=discussed");

    // …and once more, onto the entry `newest` writes: the address carries **no** param at all.
    const beforeSecondBack = await state();
    await stamp();
    await js(`history.back(); return true;`);
    const home = await expectSort("", "newest", "a second history.back() to no query");
    await expectRerender(beforeSecondBack, "a second history.back()");

    // 5. **Paging stays out of the URL** — and the seed now gives Load more a real second page.
    const first = await state();
    if (first.cards === 0) throw new Error(`the feed is empty at the end of the Back walk (${describe(first)})`);
    if (first.search !== "" || !/\/post\/thread$/.test(first.path)) {
      throw new Error(`the row did not leave the thread at no query (${describe(first)})`);
    }
    if (first.pager === 0) {
      throw new Error(
        `0 .pager-action with ${first.cards} listed card(s) — the seed is under PAGE_SIZE 24, so Load more has nothing to append and the pager reads ${JSON.stringify(first.note)} (lib/fixtures/posts.ts should hold 29 listed posts: 30 rows, one removed)`,
      );
    }
    if (/end of feed/i.test(first.note)) {
      throw new Error(
        `the pager draws a Load more control *and* reads ${JSON.stringify(first.note)} with ${first.cards} card(s) — hasMore and the note disagree`,
      );
    }

    /** The first page's order and node identity, taken before anything is appended. */
    if ((await stamp()) !== first.cards) {
      throw new Error(`no post card could be stamped before Load more (${describe(await state())})`);
    }

    /**
     * `appending` disables the control during the await (`post-thread.tsrx`), so poll for a
     * **not-disabled** one before the press — the same trap T-56 hit on the vote pair.
     */
    async function pressLoadMore(label) {
      const deadline = Date.now() + 8000;
      let armed = false;
      while (Date.now() < deadline) {
        armed = await js(`
          const button = document.querySelector(".pager-action button");
          return button ? !button.disabled : false;
        `);
        if (armed) break;
        await sleep(100);
      }
      if (!armed) {
        throw new Error(`${label}: no enabled .pager-action button — ${describe(await state())}`);
      }
      await clickSelector(".pager-action button");
    }

    /** Wait for the card count to grow: an append extends the listing, it does not swap it. */
    async function expectAppend(before, label, timeout = 10000) {
      const deadline = Date.now() + timeout;
      let now = await state();
      while (Date.now() < deadline && now.cards <= before.cards) {
        await sleep(100);
        now = await state();
      }
      if (now.cards <= before.cards) {
        throw new Error(
          `${label}: pressing Load more appended nothing — ${describe(now)}, from ${before.cards} card(s)`,
        );
      }
      return now;
    }

    await pressLoadMore("pressing Load more");
    const appended = await expectAppend(first, "pressing Load more");
    if (appended.search !== "") {
      throw new Error(
        `Load more wrote ${JSON.stringify(appended.search)} into the address — paging stays out of the URL (thread.md → Layout) and component state owns the page`,
      );
    }
    const keptOrder = appended.order.slice(0, first.order.length);
    if (JSON.stringify(keptOrder) !== JSON.stringify(first.order)) {
      throw new Error(
        `Load more reordered the first page — wanted ${JSON.stringify(first.order.slice(0, 3))}…, read ${JSON.stringify(keptOrder.slice(0, 3))}… (${describe(appended)})`,
      );
    }
    if (appended.marks !== first.cards) {
      throw new Error(
        `Load more remounted the first page: ${appended.marks}/${first.cards} stamped card(s) survived — an append extends the listing, a replace drops every node`,
      );
    }

    /** A second press: whatever the fixture's size makes true, say which. */
    let secondHalf;
    if (appended.pager === 1) {
      await pressLoadMore("a second Load more");
      const rest = await expectAppend(appended, "a second Load more");
      if (rest.pager !== 0 || !/end of feed/i.test(rest.note)) {
        throw new Error(
          `a second Load more left the pager at ${rest.pager} .pager-action reading ${JSON.stringify(rest.note)} with ${rest.cards} card(s) — after the rest of the fixture is appended the pager must end`,
        );
      }
      if (rest.search !== "") {
        throw new Error(`a second Load more wrote ${JSON.stringify(rest.search)} into the address`);
      }
      secondHalf = `a second press appended the rest to ${rest.cards} card(s) and the pager read End of feed`;
    } else {
      if (!/end of feed/i.test(appended.note)) {
        throw new Error(
          `after one append the pager draws no control and reads ${JSON.stringify(appended.note)}, not an end-of-feed note (${describe(appended)})`,
        );
      }
      secondHalf = `page 2 was the whole remainder, so the pager read End of feed at ${appended.cards} card(s) (no second press to make)`;
    }

    // 6. **The loaded page is not a history entry.** Paging pushed nothing, so a Back leaves the
    //    thread rather than returning to it, and coming back re-reads page 1 from scratch.
    const loaded = await state();
    await js(`history.back(); return true;`);
    const left = await expectSort("?sort=discussed", "discussed", "history.back() from a loaded second page");
    if (left.cards >= loaded.cards) {
      throw new Error(
        `history.back() from ${loaded.cards} loaded card(s) landed on ${left.cards} at ${JSON.stringify(left.search)} — paging pushed an entry it must not push, or the Back did not leave the page`,
      );
    }

    await go(THREAD_PATH);
    await expectSort("", "newest", "returning to /post/thread after a loaded page");
    const deadline = Date.now() + 8000;
    let rebound = await state();
    while (Date.now() < deadline && rebound.cards !== first.cards) {
      await sleep(100);
      rebound = await state();
    }
    if (rebound.cards !== first.cards) {
      throw new Error(
        `returning to /post/thread drew ${rebound.cards} card(s), not the first page's ${first.cards} — the loaded second page is component state, so it must not survive a mount (${describe(rebound)})`,
      );
    }
    if (rebound.marks !== 0) {
      throw new Error(`${rebound.marks} stamped card(s) survived a fresh mount of the thread — the listing was not re-read`);
    }
    if (rebound.pager !== 1) {
      throw new Error(
        `the freshly mounted thread draws ${rebound.pager} .pager-action with ${rebound.cards} card(s) — the pager must be back at the first page's Load more, not an end-of-feed note reading ${JSON.stringify(rebound.note)}`,
      );
    }

    /* 7. **The `sm 640` controls and the `640–899` rewrite, read in both directions** (T-80).
     *    `post-thread.tsrx` stacks two media blocks over `.controls`: `sm` makes it
     *    `200px minmax(0, 1fr) auto` with sort / the NSFW pair / Create across one row, and the
     *    `640–899` block lifts the pair onto a second row spanning the width (`grid-column: 1 / -1;
     *    grid-row: 2`) because the comment records four-across squeezing both switches to 115px.
     *    Every earlier row mounts this page at the session's own ~500px, so both blocks were
     *    declarations nothing could go red on. **Nothing is pressed and no `go()` runs** — the
     *    listing is page 1 exactly as step 6 left it, and a remount here would drop the row's state.
     */
    const readControls = () =>
      js(`
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const round = (n) => Math.round(n * 100) / 100;
          return { top: round(r.top), left: round(r.left), right: round(r.right), bottom: round(r.bottom), width: round(r.width), height: round(r.height) };
        };
        const bar = document.querySelector(".thread > .controls");
        const bs = bar ? getComputedStyle(bar) : null;
        const isGrid = !!bs && bs.display.indexOf("grid") >= 0;
        const prefsEl = document.querySelector(".thread > .controls > .prefs");
        const feed = document.querySelector(".thread > .feed");
        const pagerBox = document.querySelector(".pager-action");
        return {
          path: location.pathname,
          search: location.search,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          display: bs ? bs.display : "",
          tracks: isGrid ? bs.gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : [],
          gap: bs ? bs.gap : "",
          controls: box(bar),
          sort: box(document.querySelector(".thread > .controls > .sort")),
          prefs: box(prefsEl),
          create: box(document.querySelector(".thread > .controls > .create")),
          prefsDirection: prefsEl ? getComputedStyle(prefsEl).flexDirection : "",
          feedGap: feed ? getComputedStyle(feed).gap : "",
          cards: document.querySelectorAll(".card.post").length,
          pagerMinWidth: pagerBox ? getComputedStyle(pagerBox).minWidth : "",
        };
      `);

    const assertControls = (r, width) => {
      const at = `${THREAD_PATH} at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(
          `${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`,
        );
      }
      if (!/\/post\/thread$/.test(r.path)) {
        throw new Error(`${at}: the controls were measured on ${JSON.stringify(r.path)}, not the thread`);
      }
      if (r.display.indexOf("grid") < 0) {
        throw new Error(`${at}: .controls computes ${JSON.stringify(r.display)}, not the grid both of its blocks declare`);
      }
      if (!r.controls || !r.sort || !r.prefs || !r.create) {
        throw new Error(
          `${at}: the controls are incomplete — box ${JSON.stringify(r.controls)}, sort ${JSON.stringify(r.sort)}, prefs ${JSON.stringify(r.prefs)}, create ${JSON.stringify(r.create)}`,
        );
      }
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the thread scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }
      if (r.feedGap !== "16px") {
        throw new Error(`${at}: .feed computes gap ${JSON.stringify(r.feedGap)}, not the 16px the sm block gives it (12px is the phone's)`);
      }
      // `.pager-action` draws only while the listing has a next page — read, never asserted into being.
      if (r.pagerMinWidth !== "" && r.pagerMinWidth !== "200px") {
        throw new Error(`${at}: .pager-action computes min-width ${JSON.stringify(r.pagerMinWidth)}, not the 200px the sm block gives it`);
      }

      if (width === 640) {
        // Three tracks, the first the sort's fixed column. Count *and* size: a leftover placement
        // creates an implicit track, so the count alone is not proof (T-77).
        if (r.tracks.length !== 3) {
          throw new Error(
            `${at}: .controls resolves ${r.tracks.length} track(s) ${JSON.stringify(r.tracks)}, not the three the sm block declares (200px | fluid | auto)`,
          );
        }
        if (Math.abs(parseFloat(r.tracks[0]) - 200) > 1) {
          throw new Error(
            `${at}: the controls' first track resolves to ${JSON.stringify(r.tracks[0])}, not the 200px sort column the sm block declares (tracks ${JSON.stringify(r.tracks)})`,
          );
        }
        // Sort and Create share row 1, bottom-aligned by `align-items: end` — the bottoms are the
        // witness, not the tops (T-79).
        if (Math.abs(r.create.bottom - r.sort.bottom) > 2) {
          throw new Error(
            `${at}: .sort ends at ${r.sort.bottom} and .create at ${r.create.bottom} — the range block lifts Create to row 1 (grid-row: 1), so the button sits beside the sort, not beneath it`,
          );
        }
        if (!(r.sort.left < r.create.left - 1)) {
          throw new Error(`${at}: .sort starts at ${r.sort.left} and .create at ${r.create.left} — the sort is the left column and Create ends the row`);
        }
        // The pair across the width on row 2, below both of them.
        if (!(r.prefs.top > r.sort.bottom - 1)) {
          throw new Error(
            `${at}: .prefs sits at top ${r.prefs.top} over the sort's bottom ${r.sort.bottom} — under md the pair takes the row beneath (grid-row: 2), which is the whole point of the 640–899 block`,
          );
        }
        if (!(r.prefs.top > r.create.bottom - 1)) {
          throw new Error(
            `${at}: .prefs sits at top ${r.prefs.top} over Create's bottom ${r.create.bottom} — the squeezed middle column is what the range block exists to undo`,
          );
        }
        if (Math.abs(r.prefs.left - r.controls.left) > 1) {
          throw new Error(
            `${at}: .prefs starts at ${r.prefs.left} in a controls box starting at ${r.controls.left} — the range block puts the pair across the width (grid-column: 1 / -1), not in the middle column it squeezed to 115px`,
          );
        }
        // The band's own box is content-sized (`justify-self: start`, so it does **not** stretch to
        // the controls' right edge); what "across the width" means here is that it starts in column 1
        // and runs on past the 200px sort column, which no column-2 box could do.
        if (!(r.prefs.right > r.sort.right + 1)) {
          throw new Error(
            `${at}: .prefs ends at ${r.prefs.right}, not past the sort column's ${r.sort.right} — the pair spans the grid, not the middle column`,
          );
        }
        if (r.prefsDirection !== "row") {
          throw new Error(`${at}: .prefs computes flex-direction ${JSON.stringify(r.prefsDirection)}, not the row the sm block gives the pair`);
        }
        return;
      }

      // 900 — the range block no longer applies: four tracks from `md`, and the pair back on row 1.
      if (r.tracks.length !== 4) {
        throw new Error(
          `${at}: .controls resolves ${r.tracks.length} track(s) ${JSON.stringify(r.tracks)}, not the four the md block declares (220px | auto | fluid | auto)`,
        );
      }
      if (Math.abs(parseFloat(r.tracks[0]) - 220) > 1) {
        throw new Error(
          `${at}: the controls' first track resolves to ${JSON.stringify(r.tracks[0])}, not the 220px sort column the md block declares (tracks ${JSON.stringify(r.tracks)})`,
        );
      }
      if (!(r.prefs.top < r.create.bottom - 1)) {
        throw new Error(
          `${at}: .prefs sits at top ${r.prefs.top} under Create's bottom ${r.create.bottom} — above 900 the pair is back on row 1, not on a row of its own`,
        );
      }
      if (!(r.sort.left < r.prefs.left - 1)) {
        throw new Error(`${at}: .prefs starts at ${r.prefs.left}, not right of the sort at ${r.sort.left} — the pair takes the column beside the sort`);
      }
      if (!(r.prefs.left < r.create.left - 1)) {
        throw new Error(`${at}: Create starts at ${r.create.left}, not right of the pair at ${r.prefs.left} — the button ends the row`);
      }
    };

    const controlsRestore = await js("return window.innerWidth;");
    const controlsLines = [];
    let controlsSeen = "";
    try {
      // One override per width, low to high. The override is browser-level and this page does not
      // remount on a width change, so every reading asserts `innerWidth` (T-78's rule).
      for (const width of [640, 900]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(300);
        await waitFor(`document.querySelector(".thread > .controls > .prefs") !== null`, `the thread's controls at ${width}px`, 10000);
        const bar = await readControls();
        assertControls(bar, width);
        controlsLines.push(
          `${width}px: .controls ${JSON.stringify(bar.display)} gap ${bar.gap} → ${JSON.stringify(bar.tracks)} (${bar.tracks.length} track(s)) · sort ${bar.sort.left}→${bar.sort.right} top ${bar.sort.top} bottom ${bar.sort.bottom} · prefs ${bar.prefs.left}→${bar.prefs.right} top ${bar.prefs.top} bottom ${bar.prefs.bottom} (${bar.prefsDirection}) · create ${bar.create.left}→${bar.create.right} top ${bar.create.top} bottom ${bar.create.bottom} · .feed gap ${bar.feedGap}, ${bar.cards} card(s)${bar.pagerMinWidth ? `, pager min-width ${bar.pagerMinWidth}` : ", no pager"}`,
        );
      }
      controlsSeen = controlsLines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const controlsAfter = await js("return window.innerWidth;");
    if (controlsAfter !== controlsRestore) {
      throw new Error(
        `the thread's width overrides cleared to ${controlsAfter}px, but the session runs at ${controlsRestore}px — a leaked override would mis-measure every later row`,
      );
    }

    return `?sort=discussed loads by address with the control on discussed (${shared.cards} cards) · newest writes no param (search "") · press discussed → ?sort=discussed, ${discussed.cards} card(s) re-rendered · press liked → ?sort=liked, ${liked.cards} · Back → ?sort=discussed with the control and the listing (${back.cards}) · Back → "" + newest (${home.cards}) · Load more: ${first.cards} → ${appended.cards} card(s), first page's ${appended.marks} stamp(s) and order kept, search still "" · ${secondHalf} · Back from a loaded page left the thread (${left.cards} card(s) at ?sort=discussed), returning re-read page 1 (${rebound.cards} card(s), 0 stamps, Load more back) · the controls at ${controlsSeen}`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-56 — failure bank 5: *"Voting allows multiple votes per viewer"*. The law is one vote per
 * viewer per item, and a switch **replaces** the earlier vote rather than stacking on it
 * (`character/detail.md` → Actions), which `memory.ts` `vote()` owns.
 *
 * Row 8 presses a brand-new post's **Like** and reads its `aria-pressed` — a page-local boolean a
 * doubled count would leave exactly where it was. This row reads the **numbers**: the detail page's
 * Likes/Dislikes cells, which are the adapter's answer (`castVote()` renders what came back and
 * never recomputes), and asserts a **delta** against a seed it read, because the walk's earlier
 * rows have already added rows and no count is pinned anywhere else either. Sonic is the target
 * because rows 6, 32, 35, 36 and 37 open it and **no row has ever voted on it**.
 * ---------------------------------------------------------------------------------------------- */
const VOTE_CHARACTER = "/character/c0a1b2c3-0000-4000-8000-000000000002";

results.push(
  await journey("a repeat vote is not a second vote, and a switch moves one count", async () => {
    /**
     * One reading of the engagement block: the four cells **per label** and both `.vote` controls.
     * `.count-label` is `text-transform: uppercase`, so the label is read from `textContent` and
     * lowercased (T-49), and the **Ratio** cell is a percent (T-52) — nothing here assumes that
     * every value is a number.
     */
    const panel = () =>
      js(`
        const list = document.querySelector('.detail .counts[aria-label="Engagement"]');
        const cells = list ? [...list.querySelectorAll(".count")].map((row) => {
          const label = row.querySelector(".count-label");
          const value = row.querySelector(".count-value");
          return {
            label: (label ? label.textContent : "").trim().toLowerCase(),
            value: (value ? value.textContent : "").trim(),
          };
        }) : [];
        const cell = (name) => {
          const hit = cells.find((row) => row.label === name);
          return hit ? hit.value : null;
        };
        return {
          path: location.pathname,
          labels: cells.map((row) => row.label),
          likes: cell("likes"),
          dislikes: cell("dislikes"),
          ratio: cell("ratio"),
          comments: cell("comments"),
          votes: [...document.querySelectorAll(".detail button.vote")].map((b) => ({
            label: (b.textContent || "").trim(),
            pressed: b.getAttribute("aria-pressed"),
            disabled: b.disabled,
          })),
        };
      `);

    const describe = (now) =>
      now
        ? `Likes ${JSON.stringify(now.likes)}, Dislikes ${JSON.stringify(now.dislikes)}, Ratio ${JSON.stringify(now.ratio)}, Comments ${JSON.stringify(now.comments)}, .vote ${JSON.stringify(now.votes.map((v) => v.label + ":" + v.pressed + (v.disabled ? ":disabled" : "")))} at ${now.path}`
        : "no engagement block on the page";

    /** The shape every reading must hold: three whole counts and one percentage. */
    const shapes = (now) => {
      if (!/^\d+$/.test(now.likes || "")) return `Likes reads ${JSON.stringify(now.likes)}, not a count`;
      if (!/^\d+$/.test(now.dislikes || "")) return `Dislikes reads ${JSON.stringify(now.dislikes)}, not a count`;
      if (!/^\d+%$/.test(now.ratio || "")) return `Ratio reads ${JSON.stringify(now.ratio)}, not a percentage`;
      return "";
    };

    /** Open the detail page and wait for the block *and* both controls before trusting the read. */
    async function open(label) {
      try {
        await waitFor(
          `document.querySelector('.detail .counts[aria-label="Engagement"]') !== null && document.querySelectorAll(".detail button.vote").length === 2`,
          `${label}'s engagement block and both .vote controls`,
          8000,
        );
      } catch (error) {
        throw new Error(`${label}: ${error.message} — read ${describe(await panel())} at ${await url()}`);
      }
      await sleep(120);
      return panel();
    }

    /**
     * Press one `.vote` by its own label, after polling `button.vote:not([disabled])` — `busy`
     * disables **both** during the await (`.tsrx` → `castVote`), and a press dispatched while it
     * is set is swallowed by the attribute, reading "the count never moved" on a page that is right.
     */
    async function press(name) {
      await waitFor(
        `document.querySelectorAll(".detail button.vote").length === 2 && document.querySelector(".detail button.vote:disabled") === null`,
        `the vote controls to clear before pressing ${name}`,
        8000,
      );
      const hit = await js(`
        const el = [...document.querySelectorAll(".detail button.vote")].find((b) => ((b.textContent || "").trim().toLowerCase() === ${JSON.stringify(name.toLowerCase())}));
        if (!el) return "";
        el.scrollIntoView({ block: "center" });
        el.click();
        return (el.textContent || "").trim();
      `);
      if (!hit) {
        const seen = (await panel()).votes.map((v) => v.label).join(" | ");
        throw new Error(`no button.vote reads ${JSON.stringify(name)} — saw ${seen}`);
      }
      return hit;
    }

    /**
     * Poll the settled panel until `check` accepts it (it answers a sentence while the reading is
     * wrong), and fail with that sentence **and** the numbers — a bare poll timeout names nothing
     * a reader can act on (T-36a).
     */
    async function expect(label, check, timeout = 8000) {
      const deadline = Date.now() + timeout;
      let now = await panel();
      let why = "";
      while (Date.now() < deadline) {
        if (now && now.votes.length === 2 && !now.votes.some((v) => v.disabled)) {
          why = check(now) || "";
          if (!why) return now;
        } else {
          why = "the vote controls were still busy";
        }
        await sleep(100);
        now = await panel();
      }
      throw new Error(`${label}: ${why} — read ${describe(now)}`);
    }

    const findVote = (now, name) => now.votes.find((v) => v.label.toLowerCase() === name) || null;

    // 1. The seed: a page nobody has voted on, read as numbers plus a pressed state.
    await go(VOTE_CHARACTER);
    const seed = await open(VOTE_CHARACTER);
    const seedShape = shapes(seed);
    if (seedShape) throw new Error(`the seed read: ${seedShape} (${describe(seed)})`);
    if (seed.labels.length !== 4) {
      throw new Error(`the engagement list drew ${seed.labels.length} cell(s) (${JSON.stringify(seed.labels)}), not the four the detail spec names`);
    }
    const alreadyVoted = seed.votes.filter((v) => v.pressed === "true").map((v) => v.label);
    if (alreadyVoted.length) {
      throw new Error(
        `a vote was already pressed on ${VOTE_CHARACTER} (${JSON.stringify(alreadyVoted)}) — an earlier row now votes on this character, and this row's deltas assume a fresh viewer`,
      );
    }
    const base = { likes: Number(seed.likes), dislikes: Number(seed.dislikes) };

    // 2. **A press is one vote.**
    await press("Like");
    const first = await expect("pressing Like once", (now) => {
      const bad = shapes(now);
      if (bad) return bad;
      if (Number(now.likes) !== base.likes + 1) return `Likes read ${now.likes}, wanted the seed's ${base.likes} + 1`;
      if (Number(now.dislikes) !== base.dislikes) return `Dislikes read ${now.dislikes}, wanted the seed's ${base.dislikes}`;
      const like = findVote(now, "like");
      const dislike = findVote(now, "dislike");
      if (!like || like.pressed !== "true") return `Like reads aria-pressed=${like ? like.pressed : "missing"} after the press`;
      if (!dislike || dislike.pressed !== "false") return `Dislike reads aria-pressed=${dislike ? dislike.pressed : "missing"} after a Like`;
      return "";
    });

    // 3. **A repeat is not a second vote** — the assertion this row exists for, and it must read
    //    the numbers: the pressed state agrees either way.
    await press("Like");
    const repeated = await expect("pressing Like a second time", (now) => {
      const bad = shapes(now);
      if (bad) return bad;
      if (Number(now.likes) !== base.likes + 1) {
        return `a repeated Like moved Likes to ${now.likes}; one vote per viewer means it stays at the seed's ${base.likes} + 1`;
      }
      if (Number(now.dislikes) !== base.dislikes) return `a repeated Like moved Dislikes to ${now.dislikes}, wanted the seed's ${base.dislikes}`;
      return "";
    });
    await sleep(300);
    const settled = await panel();
    if (settled.likes !== repeated.likes || settled.dislikes !== repeated.dislikes) {
      throw new Error(
        `the count was still moving 300ms after the repeat — read Likes/Dislikes ${first.likes}/${first.dislikes} after one press, ${repeated.likes}/${repeated.dislikes} straight after the repeat, ${settled.likes}/${settled.dislikes} 300ms later`,
      );
    }

    // 4. **A switch moves one count and not two**: the Like is replaced, not added to.
    await press("Dislike");
    const switched = await expect("switching to Dislike", (now) => {
      const bad = shapes(now);
      if (bad) return bad;
      if (Number(now.likes) !== base.likes) {
        return `Likes read ${now.likes} after the switch; the Like was replaced, so it must be back at the seed's ${base.likes}`;
      }
      if (Number(now.dislikes) !== base.dislikes + 1) return `Dislikes read ${now.dislikes}, wanted the seed's ${base.dislikes} + 1`;
      const on = now.votes.filter((v) => v.pressed === "true");
      if (on.length !== 1) return `${on.length} .vote controls read pressed (${JSON.stringify(on.map((v) => v.label))}) — exactly one vote can be in force`;
      if (on[0].label.toLowerCase() !== "dislike") return `${JSON.stringify(on[0].label)} is pressed after pressing Dislike`;
      return "";
    });

    // 5. **Voted is the adapter's state, so it survives a remount** (`detail.md` → States): leave
    //    the page entirely and come back through the router; `myVote` is re-read from `repo.myVote`.
    await go("/character/catalog");
    await waitFor(`document.querySelector(".catalog") !== null`, "the catalog on the way out", 8000);
    await go(VOTE_CHARACTER);
    const remounted = await open("the character again after a remount");
    const survived = (() => {
      const bad = shapes(remounted);
      if (bad) return bad;
      if (Number(remounted.likes) !== base.likes) return `Likes read ${remounted.likes} after the remount, wanted ${base.likes}`;
      if (Number(remounted.dislikes) !== base.dislikes + 1) return `Dislikes read ${remounted.dislikes} after the remount, wanted ${base.dislikes + 1}`;
      const dislike = findVote(remounted, "dislike");
      const like = findVote(remounted, "like");
      if (!dislike || dislike.pressed !== "true") return `Dislike reads aria-pressed=${dislike ? dislike.pressed : "missing"} after the remount — the Voted state did not survive it`;
      if (!like || like.pressed !== "false") return `Like reads aria-pressed=${like ? like.pressed : "missing"} after the remount`;
      return "";
    })();
    if (survived) throw new Error(`the switch did not survive a remount: ${survived} (${describe(remounted)})`);

    // 6. Leave **one** vote behind, not two. The spec fixes the pair (no *unvote*), so a viewer who
    //    arrived with no vote cannot be returned to none: the row records the seed and says so.
    await press("Like");
    const restored = await expect("leaving one Like behind", (now) => {
      const bad = shapes(now);
      if (bad) return bad;
      if (Number(now.likes) !== base.likes + 1) return `Likes read ${now.likes}, wanted ${base.likes + 1}`;
      if (Number(now.dislikes) !== base.dislikes) return `Dislikes read ${now.dislikes}, wanted the seed's ${base.dislikes}`;
      const on = now.votes.filter((v) => v.pressed === "true");
      if (on.length !== 1) return `${on.length} .vote controls read pressed (${JSON.stringify(on.map((v) => v.label))})`;
      return "";
    });

    return `seed Likes/Dislikes ${base.likes}/${base.dislikes} at ${VOTE_CHARACTER.slice(-12)} · Like → ${first.likes}/${first.dislikes} · Like again → ${repeated.likes}/${repeated.dislikes}, still ${settled.likes}/${settled.dislikes} after 300ms (a repeat is not a second vote) · Dislike → ${switched.likes}/${switched.dislikes} with one .vote pressed (the Like was replaced) · remount via /character/catalog → ${remounted.likes}/${remounted.dislikes}, Dislike still pressed · left on Like ${restored.likes}/${restored.dislikes} (the spec fixes the pair; a viewer who arrived with no vote cannot be returned to none)`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-58 — failure bank 8: *"Deleting a persona leaves the collection without a default →
 * reassign in one step"*.
 *
 * `persona/collection.md` → *Data* makes it law: *exactly one persona carries [the default] once
 * the collection holds any* and *the collection is never left with personas and no default*;
 * `detail.md` gives **Delete** *with confirmation* and fixes the Not-found sentence.
 * `memory.ts` `deletePersona()` implements the hand-off (the heir is the **newest remaining** row
 * by `createdAt`), but no row had ever pressed Delete on a persona: the collection was only ever
 * *read* (row 34), so a delete that dropped the mark, handed it to two rows or emptied the
 * collection was green in every gate and every row.
 *
 * **The heir is Ash, not The Correspondent.** `lib/fixtures/personas.ts`: Ash is `at(16,…)`,
 * The Correspondent `at(8,…)`, Nell `at(1,…)` — the *second card* is the oldest, so a row that
 * pinned "the first remaining card" would read red on a right page. The row reads the heir's name
 * from the page and names it in the evidence.
 *
 * **Mutating and final.** `deletePersona()` splices the row out of the memory store, so every
 * later row sees two personas. That is why this row is the walk's last but one: nothing after it
 * reads a persona except `sign out` (row 34's collection read sits before it). It also writes no
 * preference and takes no CDP override, so it leaves the session exactly as row 40 did.
 * ---------------------------------------------------------------------------------------------- */
/** The seed's collection: three personas, Nell (`PERSONA(1)`) carrying the mark. */
const PERSONA_SEED_COUNT = 3;
const PERSONA_DEFAULT_NAME = "Nell";
/** The heir: the newest remaining row by `createdAt` — NOT the second card (the oldest). */
const PERSONA_HEIR_NAME = "Ash";

results.push(
  await journey("deleting the default persona hands the mark to exactly one heir", async () => {
    /**
     * One reading of `/persona` as data: every card's name, its mark, its box classes and its own
     * `/persona/<uuid>` link. `textContent`, never `innerText` — the mark is uppercased in CSS
     * (T-49), so the rendered text reads `DEFAULT` on a page that wrote `default`.
     *
     * `.skel-card` is read beside the cards because three skeleton `.card-cell`s look like cards on
     * the first frame (T-50's trap): a mark count taken then is a count of nothing.
     */
    const collection = () =>
      js(`
        const cards = [...document.querySelectorAll(".persona-card")];
        const nameOf = (card) => (card.querySelector(".persona-card-name")?.textContent || "").replace(/\\s+/g, " ").trim();
        return {
          path: location.pathname + location.search,
          skeletons: document.querySelectorAll(".skel-card").length,
          cards: cards.length,
          names: cards.map(nameOf),
          marks: cards.map((card) => (card.querySelector(".persona-card-mark")?.textContent || "").trim().toLowerCase()),
          defaults: cards.filter((card) => card.classList.contains("is-default")).map(nameOf),
          buttons: cards.map((card) => [...card.querySelectorAll("button")].map((b) => (b.textContent || "").trim()).join("/")),
          hrefs: cards.map((card) => {
            const a = card.querySelector(".persona-card-name");
            return a ? a.getAttribute("href") || "" : "";
          }),
        };
      `);

    const describe = (now) =>
      now
        ? `${now.cards} card(s) ${JSON.stringify(now.names)} at ${JSON.stringify(now.path)}, ${now.defaults.length} .is-default ${JSON.stringify(now.defaults)}, mark text ${JSON.stringify(now.marks)}`
        : "no /persona grid on the page";

    // 1. The seed, read before anything is pressed. Exactly one card carries the mark and it is Nell.
    await go("/persona");
    let before = null;
    try {
      await waitFor(
        `document.querySelectorAll(".skel-card").length === 0 && document.querySelectorAll(".persona-card").length > 0`,
        "the persona collection to leave its skeletons",
        8000,
      );
    } catch (error) {
      throw new Error(`${error.message} — read ${describe(await collection())}`);
    }
    before = await collection();

    if (before.cards !== PERSONA_SEED_COUNT) {
      throw new Error(
        `${describe(before)} — the seed holds ${PERSONA_SEED_COUNT} personas, so an earlier row created or deleted one and this row's counts assume the fixture`,
      );
    }
    if (before.defaults.length !== 1) {
      throw new Error(`${describe(before)} — the seed must carry the mark on exactly one card before Delete is pressed`);
    }
    if (before.defaults[0] !== PERSONA_DEFAULT_NAME) {
      throw new Error(`${describe(before)} — the mark is on ${JSON.stringify(before.defaults[0])}, not the seed's default ${JSON.stringify(PERSONA_DEFAULT_NAME)}`);
    }
    if (before.marks.filter((mark) => mark === "default").length !== 1) {
      throw new Error(`${describe(before)} — the one default card carries ${JSON.stringify(before.marks)}, not one \`default\` mark written in textContent`);
    }
    // The stopgap a row might mistake for the mark: the button beside it reads *Default persona*
    // (disabled) on the holder and *Set as default* on the others.
    if (!before.buttons.some((labels) => labels.startsWith("Default persona"))) {
      throw new Error(`${describe(before)} — no card's own control reads "Default persona" (read ${JSON.stringify(before.buttons)})`);
    }

    const seedIndex = before.names.indexOf(PERSONA_DEFAULT_NAME);
    const seedHref = before.hrefs[seedIndex];
    if (!/\/persona\/[0-9a-f-]{36}$/.test(seedHref || "")) {
      throw new Error(`${describe(before)} — the default's card links to ${JSON.stringify(seedHref)}, not a /persona/<uuid>`);
    }
    const deletedId = seedHref.split("/persona/")[1];

    // 2. Open **that card**, not `nth 0`: the row must prove the *default* was opened even if the
    //    grid order ever moves.
    const opened = await js(`
      const card = [...document.querySelectorAll(".persona-card")].find((c) => c.classList.contains("is-default"));
      if (!card) return "";
      const a = card.querySelector(".persona-card-name");
      if (!a) return "";
      a.scrollIntoView({ block: "center" });
      a.click();
      return (a.textContent || "").replace(/\\s+/g, " ").trim();
    `);
    if (opened !== PERSONA_DEFAULT_NAME) {
      throw new Error(`the default card's name link pressed as ${JSON.stringify(opened)} — wanted ${JSON.stringify(PERSONA_DEFAULT_NAME)}`);
    }

    try {
      await waitFor(`!!document.querySelector(".detail h1.name")`, "the persona's own name heading", 8000);
    } catch (error) {
      throw new Error(`${error.message} — at ${await url()}, body reads ${JSON.stringify((await text()).slice(0, 120))}`);
    }

    // The persona page's heading is `h1.name` (a character's is `h1.title`), and the default mark is
    // its own `.mark` line — the row must delete the one that carries it.
    const detail = await js(`
      const clean = (el) => (el?.textContent || "").replace(/\\s+/g, " ").trim();
      return {
        path: location.pathname,
        name: clean(document.querySelector(".detail h1.name")),
        kicker: clean(document.querySelector(".detail .kicker")),
        mark: clean(document.querySelector(".detail .mark")),
      };
    `);
    if (detail.name !== PERSONA_DEFAULT_NAME) {
      throw new Error(`the detail page reads ${JSON.stringify(detail.name)} (${JSON.stringify(detail.kicker)}), not ${JSON.stringify(PERSONA_DEFAULT_NAME)} at ${detail.path}`);
    }
    if (!detail.path.endsWith(`/persona/${deletedId}`)) {
      throw new Error(`the card for ${deletedId} landed on ${detail.path}`);
    }
    if (!detail.mark) {
      throw new Error(`the detail page draws no default mark — this row must delete the one persona that holds it (read ${JSON.stringify(detail)})`);
    }

    // 3. Delete in **two presses**: the opener reads `Delete`, the confirmation's button reads
    //    `Confirm delete`. A `startsWith("Delete")` match would hit the opener on the second press.
    const armed = await js(`
      const row = document.querySelector(".delete-row");
      if (!row) return "";
      const button = [...row.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Delete" && !b.disabled);
      if (!button) return "";
      button.scrollIntoView({ block: "center" });
      button.click();
      return (button.textContent || "").trim();
    `);
    if (armed !== "Delete") {
      const seen = await js(`return [...document.querySelectorAll(".delete-row button")].map((b) => (b.textContent || "").trim()).join(" | ");`);
      throw new Error(`the persona's delete row offers ${JSON.stringify(seen)}, not a "Delete" opener at ${await url()}`);
    }

    await waitFor(`!!document.querySelector(".delete-row .delete-actions")`, "the delete confirmation");
    const confirmSentence = await js(`
      const copy = document.querySelector(".delete-row .delete-actions");
      const line = copy ? copy.parentElement.querySelector(".delete-copy") : null;
      return (line?.textContent || "").replace(/\\s+/g, " ").trim();
    `);
    if (!confirmSentence) {
      throw new Error("the confirmation draws no sentence — Delete with confirmation means a question, not a silent write");
    }

    const confirmed = await js(`
      const box = document.querySelector(".delete-row .delete-actions");
      if (!box) return "";
      const button = [...box.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Confirm delete" && !b.disabled);
      if (!button) return "";
      button.scrollIntoView({ block: "center" });
      button.click();
      return (button.textContent || "").trim();
    `);
    if (confirmed !== "Confirm delete") {
      const seen = await js(`return [...document.querySelectorAll(".delete-row .delete-actions button")].map((b) => (b.textContent || "").trim() + (b.disabled ? ":disabled" : "")).join(" | ");`);
      throw new Error(`the confirmation offers ${JSON.stringify(seen)}, not an enabled "Confirm delete"`);
    }

    // 4. The landing, in ONE reading: the collection, two cards, the deleted name gone, the mark on
    //    exactly one card, and that card is the newest remaining persona.
    const deadline = Date.now() + 8000;
    let after = await collection();
    while (Date.now() < deadline && !(/\/persona$/.test(after.path) && after.cards === PERSONA_SEED_COUNT - 1 && after.skeletons === 0)) {
      await sleep(120);
      after = await collection();
    }

    if (!/\/persona$/.test(after.path)) {
      throw new Error(`the delete landed on ${JSON.stringify(after.path)}, not the collection (${describe(after)})`);
    }
    if (after.cards !== PERSONA_SEED_COUNT - 1) {
      throw new Error(
        `${describe(after)} — a delete removes exactly one card, so ${PERSONA_SEED_COUNT} becomes ${PERSONA_SEED_COUNT - 1}`,
      );
    }
    if (after.names.includes(PERSONA_DEFAULT_NAME)) {
      throw new Error(`${describe(after)} — the deleted persona ${JSON.stringify(PERSONA_DEFAULT_NAME)} is still listed`);
    }
    if (after.defaults.length !== 1) {
      throw new Error(
        `${describe(after)} — the collection was left with ${after.cards} persona(s) and ${after.defaults.length} default(s); a persona delete hands the mark on in the same step and never leaves personas with no default`,
      );
    }
    if (after.marks.filter((mark) => mark === "default").length !== 1) {
      throw new Error(`${describe(after)} — ${after.marks.filter((mark) => mark === "default").length} card(s) carry the \`default\` mark in textContent, not one`);
    }
    if (after.defaults[0] !== PERSONA_HEIR_NAME) {
      throw new Error(
        `${describe(after)} — the mark moved to ${JSON.stringify(after.defaults[0])}, not ${JSON.stringify(PERSONA_HEIR_NAME)}: the heir is the newest remaining persona by createdAt, and the second card is the oldest`,
      );
    }

    // 5. The deleted URL is **Not found**, not a crash and not a blank page: the spec's one
    //    sentence and its road back to the collection.
    await go(`/persona/${deletedId}`);
    let missing = null;
    try {
      await waitText("This persona doesn't exist in your collection.", 8000);
    } catch (error) {
      missing = await js(`
        return {
          path: location.pathname,
          title: document.title,
          head: (document.querySelector(".detail")?.innerText || document.body.innerText || "").slice(0, 120),
        };
      `);
      throw new Error(`the deleted persona's address did not mount the Not found state: ${error.message} — read ${JSON.stringify(missing)} at ${await url()}`);
    }

    missing = await js(`
      const root = document.querySelector(".detail");
      const road = root ? root.querySelector("a[href]") : null;
      return {
        path: location.pathname,
        sentence: (document.body.innerText || "").includes("This persona doesn't exist in your collection."),
        name: !!document.querySelector(".detail h1.name"),
        forms: document.querySelectorAll("form").length,
        road: road ? road.getAttribute("href") : "",
      };
    `);
    if (!missing.path.endsWith(`/persona/${deletedId}`)) {
      throw new Error(`the deleted persona's address reads ${JSON.stringify(missing.path)} in the bar`);
    }
    if (!missing.sentence) throw new Error("the Not found state lost its sentence");
    if (missing.name) throw new Error("the deleted persona still draws its heading — the row survived the delete");
    if (missing.forms !== 0) throw new Error(`the Not found state mounted ${missing.forms} <form>(s)`);
    if (!/\/persona$/.test(missing.road)) {
      throw new Error(`the Not found state's road out points at ${JSON.stringify(missing.road)}, not /persona`);
    }

    return `before: ${before.cards} cards, one .is-default reading ${JSON.stringify(before.defaults[0])} (the seed's default) · opened that card → ${detail.path} with its mark · Delete → ${JSON.stringify(confirmSentence.slice(0, 60))}… → Confirm delete · after: ${after.cards} cards ${JSON.stringify(after.names)}, ${JSON.stringify(PERSONA_DEFAULT_NAME)} gone, the one mark on ${JSON.stringify(after.defaults[0])} (newest remaining; The Correspondent is the oldest and is not the heir) · ${missing.path} → Not found, sentence + road ${missing.road}`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-59 — failure bank 2: *"Session reads live items, so author edits corrupt running chats →
 * copies only"*. `session/detail.md` → **Purpose** is the law twice over: *the character, every
 * lorebook attached to that character, and the preset are snapshotted when the session starts, and
 * the session reads only its own copies from then on*, and *a cut already published is a snapshot
 * no later change in the session touches*.
 *
 * T-15 implemented the copies and row 33 reads session 2's copy *states* — but no row had ever
 * edited a live item and then looked at a session, and no row had ever published a cut. A
 * `getSession()` that joined the character by id, or a cut stamped from the live item, was green in
 * every gate and in all 41 rows.
 *
 * **Session 1, not session 2.** Row 33 pressed **Restore copy** on session 2, so its character copy
 * is `untouched` for the rest of the run; session 1's copies are the ordinary state and its
 * character copy links to the seed's first character. The session id is **read from the page** (the
 * character's own *Continue*), never pinned.
 *
 * **Both names move.** The row edits the character's `name` **and** its in-session name, because
 * the copy row prints `inSessionName || name` — an edit to `name` alone would leave a live-join
 * page reading the same string and the row would pass on the bug it exists to catch.
 *
 * **Mutating and final.** It renames the character twice through `/character/<id>/edit`, which
 * writes the live row (the character catalog, its detail page and every later card now read the new
 * name), and it publishes one post. That is why it is the walk's last but one: nothing after it
 * reads a character except `sign out`.
 * ---------------------------------------------------------------------------------------------- */
const SNAPSHOT_CHARACTER = "/character/c0a1b2c3-0000-4000-8000-000000000001";
/** The seed (`lib/fixtures/characters.ts`, `lib/fixtures/sessions.ts`): the copy is called this. */
const SNAPSHOT_SEED_NAME = "Aurelia of the Tides";
const SNAPSHOT_COPY_NAME = "Aurelia";
/** What the author writes over the live item — a name the copy must never pick up. */
const SNAPSHOT_EDIT_NAME = "Aurelia of the Long Tide";
const SNAPSHOT_EDIT_INSESSION = "Aurelia Rebuilt";
/** The second edit, made *after* the cut went out, so the post's own text is the only witness. */
const SNAPSHOT_SECOND_NAME = "Aurelia of the Second Tide";
const SNAPSHOT_SECOND_INSESSION = "Aurelia Rebuilt Twice";
const ownCut = `Smoke cut ${stamp.slice(11, 19)}: a stretch of the transcript, published as text.`;

results.push(
  await journey("an author's edit never reaches a running session, and a cut stays a snapshot", async () => {
    /** Every copy row as the reader sees it — the same reader row 33 uses, plus the link's target. */
    const readCopies = () =>
      js(`
        const rows = [...document.querySelectorAll(".copy")].map((row) => ({
          kind: (row.querySelector(".copy-kind")?.textContent || "").trim(),
          name: (row.querySelector(".copy-name")?.textContent || "").trim(),
          state: (row.querySelector(".copy-state")?.textContent || "").trim(),
          detail: (row.querySelector(".copy-detail")?.textContent || "").replace(/\\s+/g, " ").trim(),
          links: row.querySelectorAll("a.copy-link").length,
          href: row.querySelector("a.copy-link")?.getAttribute("href") || "",
          actions: [...row.querySelectorAll(".copy-action")].map((b) => (b.textContent || "").trim()),
        }));
        const spans = [...document.querySelectorAll(".copies-toggle span")];
        return {
          path: location.pathname,
          summary: (spans[spans.length - 1]?.textContent || "").replace(/\\s+/g, " ").trim(),
          rows,
        };
      `);

    const characterRow = (panels) => panels?.rows.find((row) => row.kind === "Character") ?? null;
    const describe = (panels, row) =>
      `${panels?.rows.length ?? 0} copy row(s) ${JSON.stringify((panels?.rows ?? []).map((r) => `${r.kind}:${r.name}:${r.state}`))}, character detail ${JSON.stringify(row?.detail)}`;

    /** Open the disclosure (closed by default) and read it — a fresh mount closes it again. */
    const openCopies = async (label) => {
      await waitFor(`!!document.querySelector(".copies-toggle")`, `the copies disclosure (${label})`, 8000);
      await clickSelector(".copies-toggle");
      await waitFor(`document.querySelectorAll(".copy").length > 0`, `the copy rows (${label})`);
      return readCopies();
    };

    // 1. The character and its own session entry — the route's *Continue*, not a pinned id.
    await go(SNAPSHOT_CHARACTER);
    try {
      await waitFor(
        `(document.querySelector(".detail h1.title")?.textContent || "").trim() === ${JSON.stringify(SNAPSHOT_SEED_NAME)}`,
        `the character's heading to read ${JSON.stringify(SNAPSHOT_SEED_NAME)}`,
        8000,
      );
    } catch (error) {
      const head = await js(`return (document.querySelector(".detail h1.title")?.textContent || "").trim();`);
      throw new Error(`${error.message} — read ${JSON.stringify(head)} at ${await url()} (an earlier row renamed this character?)`);
    }

    await clickAny(["Continue", "Start a session"]);
    await waitFor(`/\\/session\\/[0-9a-f-]{36}$/.test(location.pathname)`, "the session route", 8000);
    const sessionPath = await js(`return location.pathname;`);
    /** `location.pathname` carries the served base on Pages — `go()` takes an app path, so keep the id. */
    const sessionId = sessionPath.split("/").filter(Boolean).pop();

    // 2. The copy as the session draws it, and the link back to the item it came from.
    const before = await openCopies("before the edit");
    const copyBefore = characterRow(before);
    if (!copyBefore) throw new Error(`the session at ${sessionPath} drew no Character copy — ${describe(before, null)}`);
    if (copyBefore.name !== SNAPSHOT_COPY_NAME) {
      throw new Error(`the character copy reads ${JSON.stringify(copyBefore.name)}, not the seed's ${JSON.stringify(SNAPSHOT_COPY_NAME)} — ${describe(before, copyBefore)}`);
    }
    if (!/\/character\/[0-9a-f-]{36}$/.test(copyBefore.href || "")) {
      throw new Error(`the copy's link to its original is ${JSON.stringify(copyBefore.href)}, not a /character/<uuid>`);
    }
    if (copyBefore.links !== 1 || !copyBefore.actions.includes("Update from original")) {
      throw new Error(`the linked copy draws ${copyBefore.links} link(s) and offers ${JSON.stringify(copyBefore.actions)} — the original must be reachable before the row edits it`);
    }

    /** The transcript as it stands, so the published cut can be compared against its own source. */
    const transcript = await js(`return [...document.querySelectorAll(".turn-text")].map((el) => (el.textContent || "").trim());`);
    if (transcript.length === 0) throw new Error(`the session at ${sessionPath} draws no .turn-text — a cut needs a transcript`);

    // Walk to the original **through the copy's own link**: that is the route the page offers.
    const walked = await js(`
      const row = [...document.querySelectorAll(".copy")].find((r) => (r.querySelector(".copy-kind")?.textContent || "").trim() === "Character");
      const a = row ? row.querySelector("a.copy-link") : null;
      if (!a) return "";
      a.scrollIntoView({ block: "center" });
      a.click();
      return a.getAttribute("href") || "";
    `);
    if (!walked) throw new Error("the Character copy offered no link to its original to press");
    await waitFor(`!!document.querySelector(".detail h1.title")`, "the original's page", 8000);
    const landed = await js(`return location.pathname;`);
    const characterId = (landed || "").split("/").filter(Boolean).pop();
    if (!/^[0-9a-f-]{36}$/.test(characterId || "")) {
      throw new Error(`the copy's link landed on ${JSON.stringify(landed)}, not a character detail page`);
    }

    // 3. The author edits the **live item**: name and in-session name, through its own edit form.
    await go(`/character/${characterId}/edit`);
    await waitFor(`!!document.querySelector("form input")`, "the character edit form", 8000);
    await retype("form input", SNAPSHOT_EDIT_NAME, 0);
    await retype("form input", SNAPSHOT_EDIT_INSESSION, 1);
    await click("Save changes", { exact: true });
    try {
      await waitFor(
        `(document.querySelector(".detail h1.title")?.textContent || "").trim() === ${JSON.stringify(SNAPSHOT_EDIT_NAME)}`,
        "the detail to read the author's new name",
        8000,
      );
    } catch (error) {
      const head = await js(`
        return {
          path: location.pathname,
          title: (document.querySelector(".detail h1.title")?.textContent || "").trim(),
          inSession: (document.querySelector(".detail .in-session")?.textContent || "").replace(/\\s+/g, " ").trim(),
          alerts: [...document.querySelectorAll("[role=alert]")].map((el) => (el.textContent || "").trim()).filter(Boolean),
        };
      `);
      throw new Error(`${error.message} — the edit did not land: ${JSON.stringify(head)}`);
    }

    const edited = await js(`
      return {
        title: (document.querySelector(".detail h1.title")?.textContent || "").trim(),
        inSession: (document.querySelector(".detail .in-session")?.textContent || "").replace(/\\s+/g, " ").trim(),
      };
    `);
    if (!edited.inSession.includes(SNAPSHOT_EDIT_INSESSION)) {
      throw new Error(`the character page reads ${JSON.stringify(edited.inSession)}, not the new in-session name ${JSON.stringify(SNAPSHOT_EDIT_INSESSION)} — the edit did not reach the live item`);
    }

    // 4. Back to the session, in ONE reading: the copy's name, state, line of fact and controls are
    //    exactly what step 2 read. A page that refreshes the copy on mount flips the state and is the
    //    bug — and a copy whose name followed the author proves the session joined the live row.
    await go(`/session/${sessionId}`);
    const after = await openCopies("after the edit");
    const copyAfter = characterRow(after);
    if (!copyAfter) throw new Error(`the session at ${sessionPath} lost its Character copy — ${describe(after, null)}`);

    if (copyAfter.name !== copyBefore.name) {
      throw new Error(
        `the copy followed the author's edit: the Character copy read ${JSON.stringify(copyBefore.name)} before the live item was renamed and ${JSON.stringify(copyAfter.name)} after (the author wrote ${JSON.stringify(SNAPSHOT_EDIT_INSESSION)}) — ${describe(after, copyAfter)}`,
      );
    }
    if (copyAfter.state !== copyBefore.state) {
      throw new Error(
        `the copy's state moved from ${JSON.stringify(copyBefore.state)} to ${JSON.stringify(copyAfter.state)} — an author's edit is not an "updated from original", and nothing refreshed it — ${describe(after, copyAfter)}`,
      );
    }
    if (copyAfter.detail !== copyBefore.detail) {
      throw new Error(
        `the copy's own line moved from ${JSON.stringify(copyBefore.detail)} to ${JSON.stringify(copyAfter.detail)} — the session re-read the live item on mount`,
      );
    }
    if (copyAfter.actions.join("|") !== copyBefore.actions.join("|") || copyAfter.links !== copyBefore.links) {
      throw new Error(
        `the copy's controls moved to ${JSON.stringify(copyAfter.actions)} (${copyAfter.links} link(s)) from ${JSON.stringify(copyBefore.actions)} (${copyBefore.links} link(s))`,
      );
    }
    if (after.summary !== before.summary) {
      throw new Error(`the disclosure's sentence moved from ${JSON.stringify(before.summary)} to ${JSON.stringify(after.summary)}`);
    }

    // 5. Publish a cut: the dock's quiet text action, the range, then the composer.
    await click("Publish a cut", { exact: true });
    await waitFor(`!!document.querySelector(".range")`, "the cut's range picker", 8000);
    await click("Continue", { exact: true });

    let lockedNote = "";
    try {
      await waitFor(`!!document.querySelector(".compose.is-locked")`, "the composer holding the cut", 8000);
      lockedNote = await js(`return (document.querySelector(".locked-note")?.textContent || "").replace(/\\s+/g, " ").trim();`);
    } catch (error) {
      const seen = await js(`return { path: location.pathname, buttons: [...document.querySelectorAll("button")].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 12) };`);
      throw new Error(`${error.message} — the cut never reached the composer: ${JSON.stringify(seen)}`);
    }
    if (!/published as text, not a link to the session/i.test(lockedNote)) {
      throw new Error(`the composer's cut note reads ${JSON.stringify(lockedNote)}, not the snapshot sentence`);
    }

    await retype('textarea[placeholder^="What happened"]', ownCut, 0);
    await click("Publish", { exact: true });
    await waitFor(`/\\/post\\/[0-9a-f-]{36}$/.test(location.pathname)`, "the published post's own page", 10000);
    const postPath = await js(`return location.pathname;`);
    const postId = postPath.split("/").filter(Boolean).pop();

    /** The post as the reader sees it: its body, and the cut's stamped lines. */
    const readPost = () =>
      js(`
        const clean = (el) => (el?.textContent || "").replace(/\\s+/g, " ").trim();
        return {
          path: location.pathname,
          body: clean(document.querySelector(".post-body")),
          who: [...document.querySelectorAll(".cut-who")].map(clean),
          texts: [...document.querySelectorAll(".cut-text")].map(clean),
          turns: document.querySelectorAll(".cut-turn").length,
          attachLinks: document.querySelectorAll("a.post-attach").length,
          html: (document.querySelector(".card.post") || document.body).innerHTML || "",
        };
      `);

    try {
      await waitFor(`document.querySelectorAll(".cut-turn").length > 0`, "the cut's messages on the post", 10000);
    } catch (error) {
      const now = await readPost().catch(() => null);
      throw new Error(`${error.message} — the post at ${postPath} reads ${JSON.stringify({ body: now?.body, turns: now?.turns })}`);
    }

    const post = await readPost();
    if (post.body !== ownCut) throw new Error(`the post's body reads ${JSON.stringify(post.body)}, not what the composer wrote`);
    if (post.turns !== transcript.length) {
      throw new Error(`the post drew ${post.turns} cut message(s), but the cut was the whole transcript (${transcript.length})`);
    }
    if (post.texts[0] !== transcript[0]) {
      throw new Error(`the cut's first message reads ${JSON.stringify((post.texts[0] || "").slice(0, 80))}, not the transcript's ${JSON.stringify(transcript[0].slice(0, 80))}`);
    }
    if (!(post.who[0] || "").includes(SNAPSHOT_COPY_NAME)) {
      throw new Error(`the cut's first line is stamped ${JSON.stringify(post.who[0])}, not the in-session name ${JSON.stringify(SNAPSHOT_COPY_NAME)}`);
    }
    if (post.html.includes(SNAPSHOT_EDIT_INSESSION)) {
      throw new Error(`the published cut prints the live item's new in-session name ${JSON.stringify(SNAPSHOT_EDIT_INSESSION)} — a cut must carry the copy's own text`);
    }

    // 6. Rename the live character a **second** time, then read the post again: a snapshot does not
    //    move when the item it was cut from does.
    await go(`/character/${characterId}/edit`);
    await waitFor(`!!document.querySelector("form input")`, "the character edit form (second pass)", 8000);
    await retype("form input", SNAPSHOT_SECOND_NAME, 0);
    await retype("form input", SNAPSHOT_SECOND_INSESSION, 1);
    await click("Save changes", { exact: true });
    await waitFor(
      `(document.querySelector(".detail h1.title")?.textContent || "").trim() === ${JSON.stringify(SNAPSHOT_SECOND_NAME)}`,
      "the detail to read the second name",
      8000,
    );

    await go(`/post/${postId}`);
    try {
      await waitFor(`document.querySelectorAll(".cut-turn").length > 0`, "the cut again", 10000);
    } catch (error) {
      throw new Error(`${error.message} — the post at ${postPath} lost its cut after the second edit`);
    }
    const later = await readPost();
    if (later.body !== post.body) {
      throw new Error(`the post's body moved from ${JSON.stringify(post.body)} to ${JSON.stringify(later.body)} after the character was renamed`);
    }
    if (later.who.join("|") !== post.who.join("|") || later.texts.join("|") !== post.texts.join("|")) {
      throw new Error(
        `the cut moved after the second edit: was ${JSON.stringify(post.who[0])} / ${JSON.stringify((post.texts[0] || "").slice(0, 60))}, reads ${JSON.stringify(later.who[0])} / ${JSON.stringify((later.texts[0] || "").slice(0, 60))}`,
      );
    }
    if (later.html.includes(SNAPSHOT_SECOND_NAME) || later.html.includes(SNAPSHOT_SECOND_INSESSION)) {
      throw new Error(`the post prints the live character's newest name (${JSON.stringify(SNAPSHOT_SECOND_INSESSION)}) — the cut is joined to the item, not a snapshot`);
    }

    return `session ${sessionPath} · the Character copy read ${JSON.stringify(copyBefore.name)}/${copyBefore.state} (${JSON.stringify(copyBefore.detail)}) and still reads ${JSON.stringify(copyAfter.name)}/${copyAfter.state} after the author renamed the live item to ${JSON.stringify(SNAPSHOT_EDIT_NAME)} + ${JSON.stringify(SNAPSHOT_EDIT_INSESSION)} · ${lockedNote} · cut → ${postPath}: ${post.turns} message(s), body ${JSON.stringify(post.body)}, first line ${JSON.stringify(post.who[0])} / ${JSON.stringify((post.texts[0] || "").slice(0, 40))}… · renamed twice to ${JSON.stringify(SNAPSHOT_SECOND_NAME)} + ${JSON.stringify(SNAPSHOT_SECOND_INSESSION)}, the post unchanged`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-60 — `session/detail.md` → *Actions* → **Delete session** is a cascade *and* a non-cascade:
 * *"it removes the transcript and the session's copies, while a cut already published stays as it
 * was"*. Three rows read a session (33, 42) and row 42 published a cut, but no row had ever
 * pressed the settings menu's dangerous row — a `deleteSession()` that left the session resolvable,
 * forgot the copies, or cascaded into the post the cut became was green in every gate and in all
 * 42 rows.
 *
 * **Mutating and final.** `deleteSession()` splices the row out of the memory store, so this row is
 * the walk's last but one: nothing after it may want session 1 again (`sign out` does not). The
 * character it belonged to carries **row 42's second rename**, so its name is read from the page,
 * never pinned. The cut is found by its **body** (`ownCut`, the walk's own constant) because
 * `/post/thread?sort=newest`'s first card is that post for every later row.
 * ---------------------------------------------------------------------------------------------- */
const DELETE_CONFIRM_SENTENCE =
  "This removes the transcript and every copy in it. A cut you already published stays, because a post is a snapshot of what was said.";

results.push(
  await journey("deleting a session takes its transcript and copies, and a published cut outlives it", async () => {
    /** A cut as a reader sees it — the body, every line's stamp and text, and how many lines. */
    const readCut = () =>
      js(`
        const clean = (el) => (el?.textContent || "").replace(/\\s+/g, " ").trim();
        return {
          path: location.pathname,
          body: clean(document.querySelector(".post-body")),
          who: [...document.querySelectorAll(".cut-who")].map(clean),
          texts: [...document.querySelectorAll(".cut-text")].map(clean),
          turns: document.querySelectorAll(".cut-turn").length,
        };
      `);

    // 1. Row 42's cut is the thread's newest post — found by its body, never by an id.
    await go("/post/thread?sort=newest");
    await waitFor(
      `document.querySelectorAll(".card.post").length > 0 && document.querySelectorAll(".skel-card").length === 0`,
      "the thread's first page",
      12000,
    );
    const newest = await js(`
      const card = document.querySelector(".card.post");
      if (!card) return null;
      const clean = (el) => (el?.textContent || "").replace(/\\s+/g, " ").trim();
      return {
        body: clean(card.querySelector(".post-body")),
        href: card.querySelector(".post-time")?.getAttribute("href") || "",
        turns: card.querySelectorAll(".cut-turn").length,
      };
    `);
    if (!newest) throw new Error("/post/thread?sort=newest drew no .card.post — there is no card to find the cut in");
    if (newest.body !== ownCut) {
      throw new Error(
        `the thread's newest post reads ${JSON.stringify((newest.body || "").slice(0, 80))}, not the cut row 42 published (${JSON.stringify(ownCut.slice(0, 80))}) — the cut must sort first by its own createdAt`,
      );
    }
    if (newest.turns === 0) {
      throw new Error(`the newest post's card drew no .cut-turn — the post is not the cut row 42 published (${JSON.stringify(newest.body.slice(0, 60))})`);
    }
    const postId = (newest.href || "").split("/").filter(Boolean).pop();
    if (!/^[0-9a-f-]{36}$/.test(postId || "")) {
      throw new Error(`the cut card's permalink is ${JSON.stringify(newest.href)}, not a /post/<uuid>`);
    }
    const postPath = `/post/${postId}`;

    // 2. The cut in full on its own page: the thread card folds after two messages, so the whole
    //    snapshot is read where the reader can see all of it.
    await go(postPath);
    await waitFor(`document.querySelectorAll(".cut-turn").length > 0`, "the cut on its own page", 10000);
    const cutBefore = await readCut();
    if (cutBefore.body !== ownCut) {
      throw new Error(`the cut's own page reads ${JSON.stringify(cutBefore.body.slice(0, 80))}, not what the composer wrote`);
    }

    // 3. The session that published it: the seed character's own **Continue**, no pinned id.
    await go(SNAPSHOT_CHARACTER);
    await waitFor(`!!document.querySelector(".detail h1.title")`, "the character's own page", 8000);
    const character = await js(`
      return {
        name: (document.querySelector(".detail h1.title")?.textContent || "").trim(),
        primary: (document.querySelector(".actions .start button")?.textContent || "").trim(),
      };
    `);
    if (character.primary !== "Continue") {
      throw new Error(
        `the character page reads its primary control as ${JSON.stringify(character.primary)}, not "Continue" — a session must exist before this row deletes one (character ${JSON.stringify(character.name)})`,
      );
    }

    await click("Continue", { exact: true });
    await waitFor(`/\\/session\\/[0-9a-f-]{36}$/.test(location.pathname)`, "the session route", 8000);
    const sessionPath = await js(`return location.pathname;`);
    const sessionId = sessionPath.split("/").filter(Boolean).pop();
    if (!/^[0-9a-f-]{36}$/.test(sessionId || "")) {
      throw new Error(`the Continue landed on ${JSON.stringify(sessionPath)}, not a /session/<uuid>`);
    }

    const before = await js(`
      const clean = (el) => (el?.textContent || "").replace(/\\s+/g, " ").trim();
      const spans = [...document.querySelectorAll(".copies-toggle span")];
      return {
        path: location.pathname,
        turns: document.querySelectorAll(".turn-text").length,
        copies: clean(spans[spans.length - 1]),
      };
    `);
    if (before.turns === 0) throw new Error(`the session at ${sessionPath} draws no .turn-text — there is no transcript to delete`);
    if (before.copies !== "4 copies") {
      throw new Error(
        `the session's copies disclosure reads ${JSON.stringify(before.copies)}, not "4 copies" — this row deletes a session whose copies are the fixture's four and none edited (a re-run after a delete reads a fresh store)`,
      );
    }

    // 4. The settings menu's dangerous row, then the confirmation's own button.
    await click("Session settings", { exact: true });
    await waitFor(`document.querySelectorAll(".menu-row").length > 0`, "the session settings menu", 8000);
    const menu = await js(`return [...document.querySelectorAll(".menu-row")].map((el) => (el.textContent || "").trim());`);
    if (menu.join(" | ") !== "New Session | Delete session") {
      throw new Error(`the settings menu offers ${JSON.stringify(menu)}, not "New Session" and "Delete session" and nothing more`);
    }

    await clickSelector(".menu-row.is-danger");
    await waitFor(`!!document.querySelector(".menu-actions")`, "the delete confirmation", 8000);
    const note = await js(`return (document.querySelector(".menu-note")?.textContent || "").replace(/\\s+/g, " ").trim();`);
    if (note !== DELETE_CONFIRM_SENTENCE) {
      throw new Error(
        `the confirmation reads ${JSON.stringify(note)}, not the sentence that names the transcript, the copies and the kept cut (${JSON.stringify(DELETE_CONFIRM_SENTENCE)})`,
      );
    }

    // The opener carries the same label, so the press that deletes is scoped to `.menu-actions` —
    // an unscoped match would press the opener again and prove the dialog only.
    await click("Delete session", { exact: true, scope: ".menu-actions button" });

    // 5. The landing is the character's page, and its one session is gone: **Start a session**.
    try {
      await expectPath(SNAPSHOT_CHARACTER, "the session's delete", 10000);
    } catch (error) {
      const seen = await js(`return { path: location.pathname, text: document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 140) };`);
      throw new Error(`${error.message} — the delete left the reader at ${JSON.stringify(seen)}`);
    }

    let landed = { path: "", name: "", primary: "" };
    const landingDeadline = Date.now() + 8000;
    for (;;) {
      landed = await js(`
        return {
          path: location.pathname,
          name: (document.querySelector(".detail h1.title")?.textContent || "").trim(),
          primary: (document.querySelector(".actions .start button")?.textContent || "").trim(),
        };
      `);
      if (landed.primary === "Start a session" || Date.now() > landingDeadline) break;
      await sleep(150);
    }
    if (landed.primary !== "Start a session") {
      throw new Error(
        `the session survived the delete: ${landed.path} reads ${JSON.stringify(landed.name)} with its primary control at ${JSON.stringify(landed.primary)}, not "Start a session" — the store still resolves a session for ${sessionId} (${before.turns} turn(s), ${before.copies})`,
      );
    }

    // 6. The route itself: the spec's Not found sentence, no transcript, and its road out.
    await go(`/session/${sessionId}`);
    await waitText("This session doesn't exist.", 8000);
    const missing = await js(`
      const road = [...document.querySelectorAll("a")].find((a) => /catalog/i.test((a.textContent || "")));
      return {
        path: location.pathname,
        text: document.body.innerText.replace(/\\s+/g, " ").trim(),
        road: road ? new URL(road.getAttribute("href") || "", location.href).pathname : "",
        turns: document.querySelectorAll(".turn-text").length,
      };
    `);
    if (!missing.text.includes("This session doesn't exist.")) {
      throw new Error(`/session/${sessionId} after the delete reads ${JSON.stringify(missing.text.slice(0, 120))}`);
    }
    if (missing.turns !== 0) {
      throw new Error(`the deleted session's route still draws ${missing.turns} .turn-text — the transcript survived`);
    }
    if (!/\/character\/catalog$/.test(missing.road)) {
      throw new Error(`the Not found state's road out points at ${JSON.stringify(missing.road)}, not /character/catalog`);
    }

    // 7. The cut did not leave with the session: same body, same lines, same count.
    await go(postPath);
    await waitFor(`document.querySelectorAll(".cut-turn").length > 0`, "the cut after the session was deleted", 10000);
    const cutAfter = await readCut();
    if (cutAfter.turns !== cutBefore.turns) {
      throw new Error(
        `the cut left with the session: ${cutBefore.turns} message(s) before the delete, ${cutAfter.turns} after — a published cut is a snapshot, not a view of the session`,
      );
    }
    if (cutAfter.body !== cutBefore.body) {
      throw new Error(`the cut's body moved from ${JSON.stringify(cutBefore.body)} to ${JSON.stringify(cutAfter.body)} when its session was deleted`);
    }
    if (cutAfter.who.join("|") !== cutBefore.who.join("|") || cutAfter.texts.join("|") !== cutBefore.texts.join("|")) {
      throw new Error(
        `the cut's lines moved with the session: was ${JSON.stringify(cutBefore.who[0])} / ${JSON.stringify((cutBefore.texts[0] || "").slice(0, 50))}, reads ${JSON.stringify(cutAfter.who[0])} / ${JSON.stringify((cutAfter.texts[0] || "").slice(0, 50))}`,
      );
    }

    return `thread newest = the walk's cut (${postId}, ${newest.turns} folded .cut-turn on the card) · session ${sessionPath}: ${before.turns} turn(s), ${before.copies} · settings menu ${JSON.stringify(menu)} · confirmation ${JSON.stringify(note.slice(0, 52))}… → Delete session → ${landed.path} reads ${JSON.stringify(landed.name)} with ${JSON.stringify(landed.primary)} · /session/${sessionId} → Not found ("This session doesn't exist.", road ${missing.road}) · the cut still reads ${cutAfter.turns} message(s), body ${JSON.stringify(cutAfter.body)}`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-61 — `pages/onboarding.md` was law in four places nothing executed: *"Unique across accounts,
 * compared case-insensitively; a handle already taken blocks Finish with Username taken and names no
 * alternative"*, *"Lowercase letters, digits, and underscores, 3–24 characters, lowercased on save"*,
 * *"Only Username and Display name block Finish"* and *"the whole form is written in one save, so an
 * abandoned first run keeps what was typed"*. `/onboarding` was the only route in `src/router.ts`
 * that `scripts/smoke.mjs` never mentioned, so a page that regexed on its own, a gate that enabled
 * on a taken handle, or a draft that was not a write were green in every gate and in all 43 rows.
 *
 * **Mutating.** The form's draft is a real `repo.saveProfile` write ~250ms after a valid pair
 * settles, so every intermediate value this row types is **invalid or taken** and the only free
 * value is the one it claims. It hands the account back at the end — the landing and `/`'s own
 * sentence are both read before it returns — because `sign out` follows it and would not notice.
 * ---------------------------------------------------------------------------------------------- */
const ONBOARDING_HANDLE = "onboarding_walk";
const ONBOARDING_NAME = "Walk Through";
const HANDLE_RULE_SENTENCE = "Lowercase letters, digits and underscores, 3–24 characters.";

results.push(
  await journey("claiming a handle on /onboarding is a gate, a refusal and one draft write", async () => {
    /** The form read once: both fields' value/help/error, the Finish button's own flag, the pair. */
    const readForm = () =>
      js(`
        const input = (name) => document.querySelector('input[name="' + name + '"]');
        const fieldOf = (name) => { const el = input(name); return el ? el.closest(".field") : null; };
        const cell = (name) => ({
          present: !!input(name),
          value: input(name) ? input(name).value : "",
          error: ((fieldOf(name)?.querySelector(".field-error") || {}).textContent || "").trim(),
          help: ((fieldOf(name)?.querySelector(".field-help") || {}).textContent || "").trim(),
        });
        const finish = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Finish");
        return {
          path: location.pathname,
          handle: cell("handle"),
          name: cell("displayName"),
          finish: finish ? finish.disabled : null,
          toggles: [...document.querySelectorAll(".toggle .toggle-label")].map((el) => (el.textContent || "").trim()),
        };
      `);

    /** A poll that always throws with the whole form it last read, never a bare timeout. */
    const until = async (label, check, timeout = 8000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await readForm();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(`${label} — read ${JSON.stringify(last)}`);
    };

    const readHead = () =>
      js(`
        return {
          name: (document.querySelector(".profile-head h1.name")?.textContent || "").trim(),
          handle: (document.querySelector(".profile-head .handle")?.textContent || "").trim(),
          missing: document.body.innerText.includes("This user doesn't exist."),
        };
      `);

    const readShell = () =>
      js(`
        const link = [...document.querySelectorAll("a")].find((a) => (a.innerText || "").trim() === "Open profile");
        return {
          sentence: (document.querySelector(".reading-value")?.textContent || "").trim(),
          profile: link ? link.getAttribute("href") || "" : "",
        };
      `);

    // 1. The account this row borrows, read from the page it will be handed back to.
    await go("/user/you");
    await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the account's profile header", 10000);
    const account = await readHead();
    if (!account.name || !account.handle) {
      throw new Error(`/user/you reads name ${JSON.stringify(account.name)} / handle ${JSON.stringify(account.handle)} — the walk has no account to hand back`);
    }
    const accountHandle = account.handle.replace(/^@/, "");

    // 2. The form: a first visit is a **claim** — both fields are blank (the provider supplied no
    //    name and the account has not claimed a handle), the rule is the help line, and the only
    //    thing between the reader and Finish is the pair.
    await go("/onboarding");
    let form = await until("the onboarding form to mount", (f) => f.handle.present && f.name.present, 12000);
    if (form.handle.value !== "") {
      throw new Error(`the first visit prefills the handle as ${JSON.stringify(form.handle.value)} — the spec's first-run field is a claim, not the account's existing handle`);
    }
    if (form.name.value !== "") {
      throw new Error(`the form prefills the display name as ${JSON.stringify(form.name.value)} — a first visit has no provider name, so it must be blank`);
    }
    if (form.handle.help !== HANDLE_RULE_SENTENCE || form.handle.error !== "") {
      throw new Error(`the handle field reads help ${JSON.stringify(form.handle.help)} / error ${JSON.stringify(form.handle.error)}, not the rule as help and no error`);
    }
    if (form.name.error !== "") {
      throw new Error(`the display name prints ${JSON.stringify(form.name.error)} before anything was typed — an error appears once a field has settled, never on the first frame`);
    }
    if (form.toggles.join(" | ") !== "Show NSFW content | Blur NSFW content") {
      throw new Error(`the preferences read ${JSON.stringify(form.toggles)}, not the Show/Blur pair`);
    }
    if (form.finish !== true) {
      throw new Error(`Finish is enabled with both required fields blank — only the two fields block it, and neither is filled`);
    }

    // 3. A handle the rule rejects: the schema's own sentence, and Finish stays shut.
    await retype('input[name="handle"]', "ab");
    form = await until("the field to print the handle rule", (f) => f.handle.error === HANDLE_RULE_SENTENCE);
    if (form.finish !== true) {
      throw new Error(`Finish stayed enabled on a two-character handle (${JSON.stringify(form.handle.value)}) — the inline error and the gate disagree`);
    }
    if (form.handle.help !== "") {
      throw new Error(`the field prints the rule twice (help ${JSON.stringify(form.handle.help)} beside the error)`);
    }

    // 4. The display name is valid before the handle is: a name alone must not open the gate.
    await retype('input[name="displayName"]', ONBOARDING_NAME);
    form = await until("the display name to settle", (f) => f.name.value === ONBOARDING_NAME && f.name.error === "");
    await sleep(400);
    form = await readForm();
    if (form.finish !== true) {
      throw new Error(`Finish enabled on a display name alone — the handle still reads ${JSON.stringify(form.handle.value)} and only the pair may open the gate`);
    }

    // 5. A handle another account holds, typed **uppercase**: the comparison is case-insensitive
    //    and the save lowercases, so `Ada` must read taken and Finish must stay shut.
    await retype('input[name="handle"]', "Ada");
    form = await until(`the field to print "Username taken"`, (f) => f.handle.error === "Username taken");
    if (form.finish !== true) {
      throw new Error(`Finish stayed enabled on a taken handle — @ada is a fixture handle and ${JSON.stringify(form.handle.value)} must read taken case-insensitively`);
    }
    if (/\b(try|instead|use)\b/i.test(form.handle.error)) {
      throw new Error(`the refusal names an alternative (${JSON.stringify(form.handle.error)}) — the spec says it names none`);
    }

    // 6. The claim: one free handle, one save, and the landing is that handle's own profile.
    await retype('input[name="handle"]', ONBOARDING_HANDLE);
    form = await until("Finish to enable on a free handle", (f) => f.handle.error === "" && f.finish === false);
    await click("Finish", { exact: true });
    try {
      await expectPath(`/user/${ONBOARDING_HANDLE}`, "Finish", 10000);
    } catch (error) {
      const seen = await js(`return { path: location.pathname, text: document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 140) };`);
      throw new Error(`${error.message} — Finish left the reader at ${JSON.stringify(seen)}`);
    }
    await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the claimed handle's profile", 10000);
    const claimed = await readHead();
    if (claimed.missing) {
      throw new Error(`/user/${ONBOARDING_HANDLE} after Finish reads "This user doesn't exist." — the claim wrote the account but not the profile row it addresses`);
    }
    if (claimed.handle !== `@${ONBOARDING_HANDLE}` || claimed.name !== ONBOARDING_NAME) {
      throw new Error(`the claimed profile reads ${JSON.stringify([claimed.name, claimed.handle])}, not ${JSON.stringify([ONBOARDING_NAME, `@${ONBOARDING_HANDLE}`])}`);
    }

    await go("/");
    await waitText("signed in as", 8000);
    const shell = await readShell();
    if (shell.sentence !== `signed in as ${ONBOARDING_NAME}`) {
      throw new Error(`/ reads ${JSON.stringify(shell.sentence)} after the claim, not ${JSON.stringify(`signed in as ${ONBOARDING_NAME}`)} — the account did not move`);
    }
    if (!shell.profile.endsWith(`/user/${ONBOARDING_HANDLE}`)) {
      throw new Error(`the shell's Open profile points at ${JSON.stringify(shell.profile)}, not /user/${ONBOARDING_HANDLE}`);
    }

    // 7. The resume, then the hand-back. A second visit must restore the saved pair, not a blank.
    await go("/onboarding");
    form = await until("the resumed form's fields", (f) => f.handle.present && f.name.present, 12000);
    const resumed = { handle: form.handle.value, name: form.name.value };
    if (resumed.handle !== ONBOARDING_HANDLE || resumed.name !== ONBOARDING_NAME) {
      throw new Error(
        `a resumed first run reads handle ${JSON.stringify(resumed.handle)} / name ${JSON.stringify(resumed.name)}, not the saved pair ${JSON.stringify([ONBOARDING_HANDLE, ONBOARDING_NAME])} — "the entered values are restored" is a write, not a blank form`,
      );
    }

    /* 7b. The setup form's own `sm 640` block (T-82). Four declarations have never been rendered:
     *     `.setup { max-width: 520px }`, `.actions` becoming a row, the `Finish` floor beside the
     *     note, and the note's `30ch` — every earlier mount of this page happened at the session's
     *     own ~500px. The ladder presses **nothing**: the form's draft is a real `saveProfile` write
     *     ~250ms after a settle (T-61), so a retype here would claim the borrowed handle. It runs
     *     inside the restore's `try`, so a throw still reports the account left as
     *     @onboarding_walk, and every override comes off in one `finally` that asserts `innerWidth`
     *     came back (T-78's leak).
     *
     *     The **finding** is `.actions .btn`: a page's scoped `<style>` cannot reach a primitive's
     *     own element (DESIGN.md → Primitives), and the rule did not even survive compilation — the
     *     form now wraps the `Button` in a page-owned `.primary` and sizes *that*, which is the
     *     shape the design already uses for `.search`, `.prefs` and `.pager-action`.
     */
    const readSetup = () =>
      js(`
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const round = (n) => Math.round(n * 100) / 100;
          return { top: round(r.top), left: round(r.left), right: round(r.right), bottom: round(r.bottom), width: round(r.width), height: round(r.height) };
        };
        const setup = document.querySelector(".setup");
        const ss = setup ? getComputedStyle(setup) : null;
        const outlet = setup ? setup.parentElement : null;
        const os = outlet ? getComputedStyle(outlet) : null;
        const pad = os ? parseFloat(os.paddingLeft) + parseFloat(os.paddingRight) : 0;
        const outletContent = outlet ? Math.round((outlet.getBoundingClientRect().width - pad) * 100) / 100 : null;
        const actions = document.querySelector(".setup .actions");
        const as = actions ? getComputedStyle(actions) : null;
        const isGrid = !!as && as.display.indexOf("grid") >= 0;
        const primary = document.querySelector(".setup .actions .primary");
        const ps = primary ? getComputedStyle(primary) : null;
        const btn = document.querySelector(".setup .actions .btn");
        const bs = btn ? getComputedStyle(btn) : null;
        const note = document.querySelector(".setup .actions .note");
        const ns = note ? getComputedStyle(note) : null;
        const input = (name) => document.querySelector('input[name="' + name + '"]');
        return {
          path: location.pathname,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          setupMaxWidth: ss ? ss.maxWidth : "",
          setup: box(setup),
          outlet: box(outlet),
          outletContent: outletContent,
          actions: box(actions),
          actionsDisplay: as ? as.display : "",
          actionsDirection: as ? as.flexDirection : "",
          actionsAlign: as ? as.alignItems : "",
          actionsGap: as ? as.gap : "",
          tracks: isGrid ? as.gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : [],
          primary: box(primary),
          primaryMinWidth: ps ? ps.minWidth : "",
          btn: box(btn),
          btnMinWidth: bs ? bs.minWidth : "",
          note: box(note),
          noteMaxWidth: ns ? ns.maxWidth : "",
          noteGrow: ns ? ns.flexGrow : "",
          noteBasis: ns ? ns.flexBasis : "",
          handle: input("handle") ? input("handle").value : "",
          name: input("displayName") ? input("displayName").value : "",
        };
      `);

    /** One width of the setup form: the measure first (it is the cap), then the action row. */
    const assertSetup = (r, width) => {
      const at = `/onboarding at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!String(r.path).endsWith("/onboarding")) {
        throw new Error(`${at}: the setup form was measured on ${JSON.stringify(r.path)}, not the onboarding page`);
      }
      if (!r.setup || !r.outlet || !r.actions || !r.primary || !r.btn || !r.note) {
        throw new Error(
          `${at}: the setup form is incomplete — setup ${JSON.stringify(r.setup)}, outlet ${JSON.stringify(r.outlet)}, actions ${JSON.stringify(r.actions)}, primary ${JSON.stringify(r.primary)}, button ${JSON.stringify(r.btn)}, note ${JSON.stringify(r.note)}`,
        );
      }
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the onboarding page scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }
      if (r.actionsDisplay.indexOf("flex") < 0) {
        throw new Error(`${at}: .actions computes ${JSON.stringify(r.actionsDisplay)}, not the flex box both blocks declare`);
      }
      if (r.tracks.length !== 0) {
        throw new Error(`${at}: .actions resolves ${JSON.stringify(r.tracks)} on a box that is not a grid — the display and the track list have to agree (T-73)`);
      }
      if (Math.abs(r.btn.width - r.primary.width) > 1) {
        throw new Error(`${at}: the Finish button measures ${r.btn.width} in a .primary wrapper ${r.primary.width} wide — the wrapper is the box the design sizes, so the button fills it`);
      }
      // The note's measure is a resolved px length, never the `ch` string (a computed `max-width`
      // is the used value, but a row that printed `30ch` would prove nothing about the layout).
      const noteCap = parseFloat(r.noteMaxWidth);

      if (width === 640 || width === 900) {
        // The cap: `.setup` keeps a 520 measure inside a wider outlet. The outlet's own width is the
        // *other* half of the fact — read both and say both, because "520" alone could be a filled
        // parent on a narrow window.
        if (Math.abs(r.setup.width - 520) > 1) {
          throw new Error(`${at}: .setup measures ${r.setup.width} in an outlet whose content box is ${r.outletContent} (${r.outlet.width} box) — the sm block caps it at 520`);
        }
        if (r.setupMaxWidth !== "520px") {
          throw new Error(`${at}: .setup measures ${r.setup.width} in a ${r.outletContent} outlet and computes max-width ${JSON.stringify(r.setupMaxWidth)}, not the 520px the sm block declares — a form is not a poster`);
        }
        if (!(r.outletContent > r.setup.width + 1)) {
          throw new Error(`${at}: .setup measures ${r.setup.width} and its outlet's content box ${r.outletContent} — the cap is a cap only while the outlet is wider`);
        }
        // The column→row rewrite: `flex-direction: row; align-items: center; gap: 16px`.
        if (r.actionsDirection !== "row") {
          throw new Error(`${at}: .actions computes flex-direction ${JSON.stringify(r.actionsDirection)}, not the row the sm block declares`);
        }
        if (r.actionsAlign !== "center") {
          throw new Error(`${at}: .actions computes align-items ${JSON.stringify(r.actionsAlign)}, not the centre the sm block declares`);
        }
        if (r.actionsGap !== "16px") {
          throw new Error(`${at}: .actions computes gap ${JSON.stringify(r.actionsGap)}, not the 16px the sm block declares`);
        }
        if (!(r.primary.left < r.note.left)) {
          throw new Error(`${at}: the primary control starts at ${r.primary.left} and the note at ${r.note.left} — the sm row puts the button first`);
        }
        if (!(r.note.left > r.primary.right - 1)) {
          throw new Error(`${at}: the note starts at ${r.note.left} inside a button ending at ${r.primary.right} — the row's gap is what separates them`);
        }
        // The floor: `.btn-block`'s 100% is dead on a flex item, so the 200px is the wrapper's and
        // the button is exactly that wide — the design's "200px minimum from sm".
        if (Math.abs(r.primary.width - 200) > 1) {
          throw new Error(`${at}: .primary measures ${r.primary.width}, not the 200px its floor asks for — a rule on the primitive's own element never reaches it (DESIGN.md → Primitives), so the wrapper is the only box that can hold this floor`);
        }
        if (r.primaryMinWidth !== "200px") {
          throw new Error(`${at}: .primary computes min-width ${JSON.stringify(r.primaryMinWidth)}, not the 200px floor the sm block declares — the Finish control has no minimum`);
        }
        if (r.btnMinWidth === "200px") {
          throw new Error(`${at}: the button's own element computes min-width 200px — that is the primitive's, and the wrapper is where the design's floor lives`);
        }
        if (!(Number.isFinite(noteCap) && noteCap > 0)) {
          throw new Error(`${at}: the note's max-width computes ${JSON.stringify(r.noteMaxWidth)}, not a resolved length — 30ch has to land as px`);
        }
        if (noteCap > r.actions.width) {
          throw new Error(`${at}: the note caps at ${r.noteMaxWidth} inside a ${r.actions.width} row — 30ch cannot exceed the box it sits in`);
        }
        if (r.note.width > noteCap + 1) {
          throw new Error(`${at}: the note measures ${r.note.width} against its own ${r.noteMaxWidth} cap`);
        }
        if (r.note.right > r.actions.right + 1) {
          throw new Error(`${at}: the note ends at ${r.note.right} past the row's ${r.actions.right} — the 30ch cap is what keeps it inside`);
        }
        if (!(r.noteGrow === "1" && r.noteBasis === "auto")) {
          throw new Error(`${at}: the note computes flex-grow ${JSON.stringify(r.noteGrow)} / basis ${JSON.stringify(r.noteBasis)}, not the flex: 1 1 auto the sm block declares`);
        }
        return;
      }

      // 360: the base block — a column, the button above the note, and both at the column's width.
      if (r.actionsDirection !== "column") {
        throw new Error(`${at}: .actions computes flex-direction ${JSON.stringify(r.actionsDirection)}, not the column the base block declares — the sm row is leaking below 640`);
      }
      if (!(r.primary.top < r.note.top)) {
        throw new Error(`${at}: the primary control tops at ${r.primary.top} and the note at ${r.note.top} — below 640 the button sits above the note`);
      }
      if (Math.abs(r.primary.width - r.actions.width) > 1 || Math.abs(r.btn.width - r.actions.width) > 1) {
        throw new Error(
          `${at}: the button measures ${r.btn.width} (wrapper ${r.primary.width}) in a ${r.actions.width} column — the base block stretches Finish to the full width`,
        );
      }
      if (r.primaryMinWidth === "200px") {
        throw new Error(`${at}: .primary still computes min-width 200px below the breakpoint — that is the sm block's, and it has to clear`);
      }
      if (Math.abs(r.setup.width - r.outletContent) > 1) {
        throw new Error(`${at}: .setup measures ${r.setup.width} in an outlet content box of ${r.outletContent} — below 640 the form fills its column (the 520 cap is the sm block's)`);
      }
    };

    try {
      await until("the resumed form's fields before the width ladder", (f) => f.handle.present && f.name.present, 12000);
      const setupRestore = await js("return window.innerWidth;");
      const setupLines = [];
      let setupSeen = "";
      try {
        for (const width of [640, 900, 360]) {
          await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
          await sleep(260);
          const setup = await readSetup();
          assertSetup(setup, width);
          setupLines.push(
            `${width}px: max-width ${setup.setupMaxWidth} · .setup ${setup.setup.width} in an outlet ${setup.outletContent} content / ${setup.outlet.width} box · .actions ${JSON.stringify(setup.actionsDirection)} ${JSON.stringify(setup.actionsAlign)} gap ${setup.actionsGap} (${setup.actions.width}) · .primary ${setup.primary.left}→${setup.primary.right} ${setup.primary.width} min-width ${setup.primaryMinWidth} · .btn ${setup.btn.left}→${setup.btn.right} ${setup.btn.width} · note ${setup.note.left}→${setup.note.right} ${setup.note.width} cap ${setup.noteMaxWidth}`,
          );
        }
        setupSeen = setupLines.join(" · ");
      } finally {
        await send("Emulation.clearDeviceMetricsOverride");
        await sleep(240);
      }
      const setupAfter = await js("return window.innerWidth;");
      if (setupAfter !== setupRestore) {
        throw new Error(`the setup form's overrides cleared to ${setupAfter}px, but the session runs at ${setupRestore}px — a leaked override would mis-measure every later row`);
      }
      // A width change re-lays-out in place and does not remount, so the restored pair surviving the
      // ladder is the evidence that no `go()` ran inside it (and no retype fired the draft write).
      form = await readForm();
      if (form.handle.value !== resumed.handle || form.name.value !== resumed.name) {
        throw new Error(
          `the width ladder left the form reading ${JSON.stringify([form.handle.value, form.name.value])}, not the restored pair ${JSON.stringify([resumed.handle, resumed.name])} — a remount inside the ladder would drop the restored text`,
        );
      }

      await retype('input[name="handle"]', accountHandle);
      await retype('input[name="displayName"]', account.name);
      form = await until(`Finish to enable on @${accountHandle}`, (f) => f.finish === false && f.handle.error === "");
      await click("Finish", { exact: true });
      await expectPath(`/user/${accountHandle}`, "the restore's Finish", 10000);
      await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the borrowed account's profile", 10000);
      const back = await readHead();
      if (back.missing || back.handle !== `@${accountHandle}` || back.name !== account.name) {
        throw new Error(`the restore landed on ${JSON.stringify([back.name, back.handle, back.missing])}, not ${JSON.stringify([account.name, `@${accountHandle}`])}`);
      }
      await go("/");
      await waitText("signed in as", 8000);
      const home = await readShell();
      if (home.sentence !== `signed in as ${account.name}` || !home.profile.endsWith(`/user/${accountHandle}`)) {
        throw new Error(`/ reads ${JSON.stringify([home.sentence, home.profile])} after the restore, not ${JSON.stringify([`signed in as ${account.name}`, `/user/${accountHandle}`])}`);
      }

      return `@${accountHandle} (${JSON.stringify(account.name)}) · a first visit opens blank with the rule as the handle's help line, and Finish enables on the pair only once the settle asked the adapter · "ab" → ${JSON.stringify(HANDLE_RULE_SENTENCE)} with Finish disabled · "Ada" → "Username taken" with Finish disabled · Finish → /user/${ONBOARDING_HANDLE} reads ${JSON.stringify([claimed.name, claimed.handle])}, / reads ${JSON.stringify(shell.sentence)} with Open profile at ${shell.profile} · a second visit restored ${JSON.stringify([resumed.handle, resumed.name])} → Finish back to /user/${accountHandle}, / reads ${JSON.stringify(home.sentence)} · the setup form at ${setupSeen}`;
    } catch (error) {
      throw new Error(
        `${error.message} — the account was left as @${ONBOARDING_HANDLE} (${JSON.stringify(ONBOARDING_NAME)}); the walk's borrowed @${accountHandle} was not handed back`,
      );
    }
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-62 — `pages/user/edit.md` is law in four places nothing had executed: the handle follows
 * onboarding's rules, *"Changing it moves the profile URL and no alias is kept, so a link to the
 * previous handle reports not-found rather than redirecting; the account keeps its content,
 * follows, and bookmarks"*, and the state *Handle changed* — *"the profile loads at the new URL"*.
 * Row 3 mounts the form and stops at the push proof, so `saveProfileEdit()` — the one write that
 * **moves** an account — had never been pressed; a rename that re-created the row (losing the bio
 * and `joinedAt`), left the authored rows behind, or kept the old handle claimed is green in every
 * gate and in all 44 rows.
 *
 * **Mutating.** It renames the walk's account out and back; the four things it compares are read
 * from the page on both sides, never pinned to a fixture value.
 * ---------------------------------------------------------------------------------------------- */
const EDIT_HANDLE = "edit_walk";

results.push(
  await journey("renaming the account on /user/you/edit moves the row, the content and the graph", async () => {
    /** The profile head plus the creations grid — the four things a rename must not lose. */
    const readHead = () =>
      js(`
        const text = (selector) => {
          const el = document.querySelector(selector);
          return el ? (el.textContent || "").replace(/\\s+/g, " ").trim() : "";
        };
        return {
          path: location.pathname,
          present: document.querySelector(".profile-head") !== null,
          name: text(".profile-head h1.name"),
          handle: text(".profile-head .handle"),
          bio: text(".profile-head .bio"),
          figures: text(".profile-head .figures"),
          creations: document.querySelectorAll(".card-grid .card-cell").length,
          missing: document.body.innerText.includes("This user doesn't exist."),
        };
      `);

    /**
     * The form as it mounts. **`/user/you/edit` is not a `<form>`** — a `div.form` of `Field`s — and
     * its username field is named `username`, not `handle` (onboarding's is `handle`), so both names
     * are tried rather than one being assumed.
     */
    const readForm = () =>
      js(`
        const one = (selector) => document.querySelector(selector);
        const handleInput = one('input[name="username"]') || one('input[name="handle"]');
        const fieldOf = (el) => (el ? el.closest(".field") : null);
        const save = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Save");
        return {
          path: location.pathname,
          mounted: handleInput !== null && one('input[name="displayName"]') !== null,
          handle: handleInput ? handleInput.value : "",
          name: one('input[name="displayName"]') ? one('input[name="displayName"]').value : "",
          bio: one('textarea[name="bio"]') ? one('textarea[name="bio"]').value : "",
          handleError: ((fieldOf(handleInput)?.querySelector(".field-error") || {}).textContent || "").trim(),
          save: save ? save.disabled : null,
          failure: [...document.querySelectorAll(".form-failure")].map((el) => (el.textContent || "").trim()).join(" | "),
        };
      `);

    const until = async (label, check, timeout = 8000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await readForm();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(`${label} — read ${JSON.stringify(last)}`);
    };

    const readShell = () =>
      js(`
        const link = [...document.querySelectorAll("a")].find((a) => (a.innerText || "").trim() === "Open profile");
        return {
          sentence: (document.querySelector(".reading-value")?.textContent || "").trim(),
          profile: link ? link.getAttribute("href") || "" : "",
        };
      `);

    const HEAD = 'input[name="username"], input[name="handle"]';

    // 1. The account as it reads today: name, handle, bio, the two figures and the creations count.
    await go("/user/you");
    await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the account's profile header", 10000);
    const before = await readHead();
    if (!before.name || !before.handle || !before.bio) {
      throw new Error(`/user/you reads ${JSON.stringify(before)} — the walk needs a name, a handle and a bio to prove a rename keeps them`);
    }
    const accountHandle = before.handle.replace(/^@/, "");

    // 2. The form prefills from the row, not from a blank: the URL's handle, the row's name and bio.
    await go(`/user/${accountHandle}/edit`);
    let form = await until("the account form to mount", (f) => f.mounted, 12000);
    const prefilled = { handle: form.handle, name: form.name, bio: form.bio };
    if (form.handle !== accountHandle) {
      throw new Error(`the edit form prefills the username as ${JSON.stringify(form.handle)}, not the URL's ${JSON.stringify(accountHandle)}`);
    }
    if (form.name !== before.name) {
      throw new Error(`the edit form prefills the display name as ${JSON.stringify(form.name)}, not the row's ${JSON.stringify(before.name)}`);
    }
    if (form.bio !== before.bio) {
      throw new Error(`the edit form prefills the bio as ${JSON.stringify(form.bio)}, not the row's ${JSON.stringify(before.bio)}`);
    }
    if (form.save !== false) {
      throw new Error(`Save is disabled on a form that prefilled a valid pair (${JSON.stringify(form)}) — nothing has been typed yet`);
    }

    // 3. The rename: one free handle, one Save, and the landing is the new URL's own profile.
    await retype(HEAD, EDIT_HANDLE);
    form = await until("Save to stay open on the free handle", (f) => f.handle === EDIT_HANDLE && f.handleError === "" && f.save === false);
    await click("Save", { exact: true });
    try {
      await expectPath(`/user/${EDIT_HANDLE}`, "Save", 12000);
    } catch (error) {
      const seen = await readForm();
      const body = await js(`return document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 160);`);
      throw new Error(`${error.message} — Save left the reader at ${JSON.stringify(seen)} with the page reading ${JSON.stringify(body)}`);
    }
    await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the renamed profile", 10000);
    const after = await readHead();
    if (after.missing || !after.present) {
      throw new Error(`/user/${EDIT_HANDLE} after Save reads ${JSON.stringify(after)} — the row did not move to the new handle`);
    }
    if (after.name !== before.name) {
      throw new Error(`the renamed profile reads the name ${JSON.stringify(after.name)}, not ${JSON.stringify(before.name)} — a rename moved the handle and dropped the row's identity`);
    }
    if (after.handle !== `@${EDIT_HANDLE}`) {
      throw new Error(`the renamed profile reads the handle ${JSON.stringify(after.handle)}, not @${EDIT_HANDLE}`);
    }
    if (after.bio !== before.bio) {
      throw new Error(`the renamed profile reads the bio ${JSON.stringify(after.bio)}, not ${JSON.stringify(before.bio)} — the row was re-created instead of moved`);
    }
    if (after.figures !== before.figures) {
      throw new Error(`the renamed profile reads the figures ${JSON.stringify(after.figures)}, not ${JSON.stringify(before.figures)} — the rename did not move both sides of the follow graph`);
    }
    if (after.creations !== before.creations) {
      throw new Error(`the renamed profile draws ${after.creations} creation card(s), not ${before.creations} — the authored rows did not follow the handle`);
    }

    // 4. The spec's other half: the previous handle is not-found, and no alias redirects to the new one.
    await go(`/user/${accountHandle}`);
    await waitText("This user doesn't exist.", 10000);
    const old = await readHead();
    if (old.present) {
      throw new Error(`/user/${accountHandle} still renders the profile after the rename — the old handle was not released`);
    }

    // 4b. The account **keeps its content**: the comment it wrote on its own post is signed by the
    //     new handle. A rename that moved the authored rows but not the comments leaves every
    //     comment signed by a handle that now answers not-found.
    const postId = newPostPath.split("/").pop();
    await go(`/post/${postId}`);
    await waitText(ownComment, 10000);
    const signed = await js(`
      const comment = [...document.querySelectorAll("article.comment")].find((el) => (el.textContent || "").includes(${JSON.stringify(ownComment)}));
      return comment ? (comment.querySelector(".row-author")?.textContent || "").trim() : null;
    `);
    if (signed !== `@${EDIT_HANDLE}`) {
      throw new Error(`the comment the account wrote reads ${JSON.stringify(signed)} after the rename, not @${EDIT_HANDLE} — a comment is signed by its author, and the account keeps its content`);
    }

    // 5. The account itself moved: `/` names the same person at the new handle.
    await go("/");
    await waitText("signed in as", 8000);
    const shell = await readShell();
    if (shell.sentence !== `signed in as ${before.name}` || !shell.profile.endsWith(`/user/${EDIT_HANDLE}`)) {
      throw new Error(`/ reads ${JSON.stringify([shell.sentence, shell.profile])} after the rename, not ${JSON.stringify([`signed in as ${before.name}`, `/user/${EDIT_HANDLE}`])} — the session kept the old handle`);
    }

    // 6. The way back, and the whole pair re-read: the walk hands the account over as row 44 does.
    try {
      await go(`/user/${EDIT_HANDLE}/edit`);
      await until("the renamed account's form to mount", (f) => f.mounted, 12000);
      await retype(HEAD, accountHandle);
      form = await until(`Save to stay open on @${accountHandle}`, (f) => f.handle === accountHandle && f.handleError === "" && f.save === false);
      await click("Save", { exact: true });
      await expectPath(`/user/${accountHandle}`, "the restore's Save", 12000);
      await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the restored profile", 10000);
      const back = await readHead();
      if (back.missing || back.handle !== `@${accountHandle}` || back.name !== before.name) {
        throw new Error(`the restore landed on ${JSON.stringify([back.name, back.handle, back.missing])}, not ${JSON.stringify([before.name, `@${accountHandle}`])}`);
      }
      if (back.bio !== before.bio || back.figures !== before.figures || back.creations !== before.creations) {
        throw new Error(`the restore reads ${JSON.stringify([back.bio, back.figures, back.creations])}, not ${JSON.stringify([before.bio, before.figures, before.creations])} — the round trip lost a row`);
      }
      await go("/");
      await waitText("signed in as", 8000);
      const home = await readShell();
      if (home.sentence !== `signed in as ${before.name}` || !home.profile.endsWith(`/user/${accountHandle}`)) {
        throw new Error(`/ reads ${JSON.stringify([home.sentence, home.profile])} after the restore, not ${JSON.stringify([`signed in as ${before.name}`, `/user/${accountHandle}`])}`);
      }

      return `@${accountHandle} → @${EDIT_HANDLE} → @${accountHandle} · the form prefilled ${JSON.stringify([prefilled.handle, prefilled.name, prefilled.bio])} with Save enabled · Save → /user/${EDIT_HANDLE} reads ${JSON.stringify([after.name, after.handle, after.figures, after.creations])} (same name, bio, figures and creations as before) · /user/${accountHandle} reads "This user doesn't exist." with no profile · the account's own comment reads ${JSON.stringify(signed)} · / reads ${JSON.stringify(shell.sentence)} with Open profile at ${shell.profile} · the way back restores ${JSON.stringify([back.handle, back.bio, back.creations])}`;
    } catch (error) {
      throw new Error(
        `${error.message} — the account was left as @${EDIT_HANDLE}; the walk's borrowed @${accountHandle} was not handed back`,
      );
    }
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-63 — `pages/user/edit.md` → *States* names five the page must draw; rows 3 and 45 only ever
 * read **Owner**. **Not the owner → forbidden** (`/user/ada/edit` — a pasted stranger's URL),
 * **Username taken** *on this page* (the walk's only such assertion is onboarding's, row 44) and
 * **Validation error** as its inline form were unwalked, so a page that let a stranger's URL mount
 * the fields, enabled **Save** on a taken handle, or printed onboarding's copy where the schema
 * says otherwise would be green in every gate and in all 45 rows.
 *
 * **Read-only.** It presses **Cancel** and never **Save**, and re-reads `/user/<own>`'s name,
 * handle and bio afterwards, so the account is handed back exactly as it was found.
 * ---------------------------------------------------------------------------------------------- */
const STRANGER_HANDLE = "ada"; // a fixture account (lib/fixtures/profiles.ts) the walk does not hold

results.push(
  await journey("a stranger's edit URL is refused, and the form refuses a taken handle and a malformed one", async () => {
    /** The form as it mounts: prefill, the handle field's error and help, and Save's own flag. */
    const readForm = () =>
      js(`
        const one = (selector) => document.querySelector(selector);
        const handleInput = one('input[name="username"]') || one('input[name="handle"]');
        const fieldOf = (el) => (el ? el.closest(".field") : null);
        const save = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Save");
        return {
          path: location.pathname,
          mounted: handleInput !== null && one('input[name="displayName"]') !== null,
          handle: handleInput ? handleInput.value : "",
          name: one('input[name="displayName"]') ? one('input[name="displayName"]').value : "",
          bio: one('textarea[name="bio"]') ? one('textarea[name="bio"]').value : "",
          error: ((fieldOf(handleInput)?.querySelector(".field-error") || {}).textContent || "").trim(),
          help: ((fieldOf(handleInput)?.querySelector(".field-help") || {}).textContent || "").trim(),
          saveDisabled: save ? save.disabled : null,
        };
      `);

    /** The profile head — the three things a read-only row must hand back untouched. */
    const readProfile = () =>
      js(`
        const text = (selector) => {
          const el = document.querySelector(selector);
          return el ? (el.textContent || "").replace(/\\\\s+/g, " ").trim() : "";
        };
        return {
          path: location.pathname,
          present: document.querySelector(".profile-head") !== null,
          name: text(".profile-head h1.name"),
          handle: text(".profile-head .handle"),
          bio: text(".profile-head .bio"),
          missing: document.body.innerText.includes("This user doesn't exist."),
        };
      `);

    /** A poll that always throws with the whole form it last read, never a bare timeout. */
    const until = async (label, check, timeout = 8000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await readForm();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(`${label} — read ${JSON.stringify(last)}`);
    };

    const HEAD_FIELD = 'input[name="username"], input[name="handle"]';

    // 1. The session's own handle, read from the shell (row 45 hands `@you` back, but never pin it).
    await go("/");
    await waitText("signed in as", 8000);
    const ownHref = await js(`
      const link = [...document.querySelectorAll("a")].find((a) => (a.innerText || "").trim() === "Open profile");
      return link ? link.getAttribute("href") || "" : "";
    `);
    const ownHandle = ownHref.split("/").filter(Boolean).pop() || "";
    if (!ownHandle) throw new Error(`/ draws no Open profile link (read ${JSON.stringify(ownHref)}) — the row cannot know whose account it is borrowing`);

    await go(`/user/${ownHandle}`);
    await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the account's profile header", 10000);
    const before = await readProfile();
    if (!before.present || !before.name || !before.bio || before.handle !== `@${ownHandle}`) {
      throw new Error(`/user/${ownHandle} reads ${JSON.stringify(before)} — the row needs the owner's own name, handle and bio to prove nothing moved`);
    }

    // 2. A stranger's edit URL: the route refuses as a **state** (the URL stays put, no redirect),
    //    draws no form, and its way back is the session's own profile.
    const readStranger = () =>
      js(`
        const one = (selector) => document.querySelector(selector);
        const save = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Save");
        const back = [...document.querySelectorAll("a")].find((a) => (a.innerText || "").trim() === "Back to your profile");
        return {
          path: location.pathname,
          copy: (document.querySelector(".empty-copy")?.textContent || "").trim(),
          username: one('input[name="username"]') !== null,
          displayName: one('input[name="displayName"]') !== null,
          save: save ? save.disabled : null,
          back: back ? back.getAttribute("href") || "" : "",
          missing: document.body.innerText.includes("This user doesn't exist."),
        };
      `);

    /** Poll until the route has *decided* — forbidden, a form, or the not-found sentence — then
     *  assert which. A poll on the copy alone would report a bare timeout on a page that mounted
     *  the wrong thing, which is exactly the failure this state exists to catch. */
    const settle = async (label, check, read, timeout = 10000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await read();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(`${label} — read ${JSON.stringify(last)}`);
    };

    await go(`/user/${STRANGER_HANDLE}/edit`);
    const stranger = await settle(
      `a stranger's edit URL to draw the forbidden state`,
      (s) => s.copy !== "" || s.username || s.displayName || s.missing,
      readStranger,
    );
    if (!stranger.path.endsWith(`/user/${STRANGER_HANDLE}/edit`)) {
      throw new Error(`a stranger's edit URL redirected to ${JSON.stringify(stranger.path)} — the state must stay at /user/${STRANGER_HANDLE}/edit, not move the reader`);
    }
    if (stranger.username || stranger.displayName || stranger.save !== null) {
      throw new Error(`/user/${STRANGER_HANDLE}/edit mounted the account form for a stranger (read ${JSON.stringify(stranger)}) — the gate is the route's, not the entry point's`);
    }
    if (stranger.copy !== "You can't edit this account.") {
      throw new Error(`/user/${STRANGER_HANDLE}/edit reads ${JSON.stringify(stranger.copy)} where the spec's *Not the owner — forbidden* state belongs (read ${JSON.stringify(stranger)}) — a pasted URL must not reach the form`);
    }
    if (!stranger.back.endsWith(`/user/${ownHandle}`)) {
      throw new Error(`the forbidden state's way back points at ${JSON.stringify(stranger.back)}, not the session's own /user/${ownHandle}`);
    }

    // 3. The owner's form, and the two refusals that live on it.
    await go(`/user/${ownHandle}/edit`);
    let form = await until("the account form to mount", (f) => f.mounted, 12000);
    const rule = form.help; // the schema's own sentence, read from the page rather than pinned
    if (!rule) throw new Error(`the username field prints no help line (read ${JSON.stringify(form)}) — the row needs the schema's rule as the page says it`);
    if (form.handle !== ownHandle || form.name !== before.name || form.bio !== before.bio) {
      throw new Error(`the form prefilled ${JSON.stringify([form.handle, form.name, form.bio])}, not ${JSON.stringify([ownHandle, before.name, before.bio])}`);
    }
    if (form.error !== "" || form.saveDisabled !== false) {
      throw new Error(`the form opens with ${JSON.stringify([form.error, form.saveDisabled])} — a prefilled valid pair must read no error and Save enabled`);
    }

    // 3a. A handle the adapter already holds: the spec's copy, verbatim, with Save disabled.
    await retype(HEAD_FIELD, STRANGER_HANDLE);
    form = await until(
      `the page to print "Username taken" for @${STRANGER_HANDLE}`,
      (f) => f.error === "Username taken",
      8000,
    );
    if (form.saveDisabled !== true) {
      throw new Error(`Save stayed enabled on @${STRANGER_HANDLE}, a fixture handle (read ${JSON.stringify(form)}) — a taken username must block the write`);
    }
    if (form.help !== "") {
      throw new Error(`the taken handle prints ${JSON.stringify(form.help)} as help under the error — the field says one thing once`);
    }

    // 3b. A handle the schema refuses: the *same* sentence as its inline error, and the help line
    //     gives way so the rule is not printed twice.
    await retype(HEAD_FIELD, "ab");
    form = await until(`the field to print the handle rule ${JSON.stringify(rule)}`, (f) => f.error === rule, 8000);
    if (form.saveDisabled !== true) {
      throw new Error(`Save stayed enabled on the malformed handle "ab" (read ${JSON.stringify(form)})`);
    }
    if (form.help !== "") {
      throw new Error(`the malformed handle prints the rule twice — error ${JSON.stringify(form.error)} beside help ${JSON.stringify(form.help)}`);
    }

    // 3c. Typing the handle the account already holds asks the adapter nothing (`onHandleInput`
    //     skips `checkHandle` for the URL's handle), so the way back is proven by the three reads.
    await retype(HEAD_FIELD, ownHandle);
    form = await until(
      `the error to clear on @${ownHandle} with the rule back as help`,
      (f) => f.error === "" && f.help === rule && f.saveDisabled === false,
      8000,
    );

    // 4. Cancel is a `navigate()`, and the profile it lands on is the row the form was prefilled from.
    await click("Cancel", { exact: true });
    await expectPath(`/user/${ownHandle}`, "Cancel", 12000);
    await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the profile after Cancel", 10000);
    const after = await readProfile();
    if (after.missing || !after.present) {
      throw new Error(`/user/${ownHandle} after Cancel reads ${JSON.stringify(after)} — Cancel must land on the profile it came from`);
    }
    if (after.name !== before.name || after.handle !== before.handle || after.bio !== before.bio) {
      throw new Error(
        `the profile after Cancel reads ${JSON.stringify([after.name, after.handle, after.bio])}, not ${JSON.stringify([before.name, before.handle, before.bio])} — a read-only row wrote something`,
      );
    }

    // 5. The head at the two widths its own stylesheet draws it for (T-78). `user-profile.tsrx`'s
    //    `sm 640` block turns `.profile-head` from **two** tracks with the action on a second row
    //    into **three** on one row and raises `.name` 22 → 26px. Rows 45–47 all mount this page at
    //    the session's own ~500px — below the breakpoint — so the block was a declaration nothing
    //    could go red on. Both widths are read, because one direction cannot show a breakpoint.
    const readHeadAt = () =>
      js(`
        const rect = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const round = (n) => Math.round(n * 100) / 100;
          return { top: round(r.top), left: round(r.left), right: round(r.right), bottom: round(r.bottom), width: round(r.width) };
        };
        const head = document.querySelector(".profile-head");
        const hs = head ? getComputedStyle(head) : null;
        const isGrid = !!hs && hs.display.indexOf("grid") >= 0;
        const nameEl = document.querySelector(".profile-head h1.name");
        const pager = document.querySelector(".pager");
        const pagerBox = document.querySelector(".pager > div");
        return {
          path: location.pathname,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          headDisplay: hs ? hs.display : "",
          headTracks: isGrid ? hs.gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : [],
          headGap: hs ? hs.gap : "",
          avatar: rect(document.querySelector(".profile-head .head-avatar")),
          who: rect(document.querySelector(".profile-head .who")),
          action: rect(document.querySelector(".profile-head .head-action")),
          name: (nameEl ? nameEl.textContent || "" : "").trim(),
          nameFont: nameEl ? getComputedStyle(nameEl).fontSize : "",
          pagerAlign: pager ? getComputedStyle(pager).alignItems : "",
          pagerMinWidth: pagerBox ? getComputedStyle(pagerBox).minWidth : "",
        };
      `);

    const assertHead = (r, width) => {
      const at = `/user/${ownHandle} at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!r.path.endsWith(`/user/${ownHandle}`)) {
        throw new Error(`${at}: the head was measured on ${JSON.stringify(r.path)}, not the profile Cancel landed on`);
      }
      if (r.headDisplay.indexOf("grid") < 0) {
        throw new Error(`${at}: .profile-head computes ${JSON.stringify(r.headDisplay)}, not the grid both of its blocks declare`);
      }
      if (!r.avatar || !r.who || !r.action) {
        throw new Error(
          `${at}: the head is incomplete — avatar ${JSON.stringify(r.avatar)}, who ${JSON.stringify(r.who)}, action ${JSON.stringify(r.action)}`,
        );
      }
      if (r.name === "") throw new Error(`${at}: the head draws no h1.name, so what measured is a skeleton`);
      // `>` and not `===`: `html` carries `scrollbar-gutter: stable`, so an unoverflowed document
      // reports scrollWidth equal to its client width.
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the profile scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }

      if (width === 640) {
        // The whole `sm` fact: three tracks, and the action on the **same row** as the avatar.
        if (r.headTracks.length !== 3) {
          throw new Error(
            `${at}: .profile-head resolves ${r.headTracks.length} track(s) ${JSON.stringify(r.headTracks)}, not the three the sm block declares (72px | fluid | auto)`,
          );
        }
        // The count alone is not proof: a leftover placement can create an implicit third track, so
        // the track the block declares is sized too (T-77's lesson).
        if (Math.abs(parseFloat(r.headTracks[0]) - 72) > 1) {
          throw new Error(`${at}: the head's first track resolves to ${JSON.stringify(r.headTracks[0])}, not the 72px avatar column the sm block declares (tracks ${JSON.stringify(r.headTracks)})`);
        }
        if (Math.abs(r.avatar.top - r.who.top) > 2) {
          throw new Error(`${at}: the avatar sits at top ${r.avatar.top} and .who at ${r.who.top} — the sm block puts them on one row`);
        }
        if (r.who.left < r.avatar.right - 0.5) {
          throw new Error(`${at}: .who starts at ${r.who.left}, left of the avatar's right edge ${r.avatar.right} — the name column is not beside the disc`);
        }
        if (Math.abs(r.action.top - r.avatar.top) > 2) {
          throw new Error(
            `${at}: .head-action sits at top ${r.action.top} and the avatar at ${r.avatar.top} — the sm block puts the action on the avatar's own row (grid-template-areas "avatar who action"), and the base block drops it to row 2`,
          );
        }
        if (r.nameFont !== "26px") {
          throw new Error(`${at}: .name computes ${JSON.stringify(r.nameFont)}, not the 26px the sm block raises it to from 22px`);
        }
        // `.pager` draws only while the listing has a next page, so it is read when it exists and
        // never asserted into being.
        if (r.pagerMinWidth !== "" && r.pagerMinWidth !== "200px") {
          throw new Error(`${at}: the pager's inner box computes min-width ${JSON.stringify(r.pagerMinWidth)}, not the 200px the sm block gives it`);
        }
        return;
      }

      // The opposite, in the same words: the base block is still the phone's.
      if (r.headTracks.length !== 2) {
        throw new Error(
          `${at}: .profile-head resolves ${r.headTracks.length} track(s) ${JSON.stringify(r.headTracks)}, not the two the base block declares (56px | fluid) — the sm block is leaking below its breakpoint`,
        );
      }
      if (Math.abs(parseFloat(r.headTracks[0]) - 56) > 1) {
        throw new Error(`${at}: the head's first track resolves to ${JSON.stringify(r.headTracks[0])}, not the 56px base column (tracks ${JSON.stringify(r.headTracks)})`);
      }
      if (!(r.action.top > r.avatar.top + 1)) {
        throw new Error(
          `${at}: .head-action sits at top ${r.action.top} with the avatar at ${r.avatar.top} — below 640 the action belongs on its own second row, spanning both columns`,
        );
      }
      if (r.nameFont !== "22px") {
        throw new Error(`${at}: .name computes ${JSON.stringify(r.nameFont)}, not the base 22px`);
      }
    };

    const headRestore = await js("return window.innerWidth;");
    const headLines = [];
    let headSeen = "";
    try {
      // One override per width. The `Emulation` override is browser-level, so it survives nothing
      // but is cheap to re-take; every reading asserts `innerWidth` instead of assuming it held.
      for (const [width, expectTracks] of [
        [640, 3],
        [360, 2],
      ]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        // The override does not remount, so the head is the one Cancel landed on; re-read it and
        // let `assertHead` prove the width rather than trusting the settle.
        await waitFor(`document.querySelector(".profile-head h1.name") !== null`, `the profile head at ${width}px`, 10000);
        const head = await readHeadAt();
        assertHead(head, width);
        headLines.push(
          `${width}px: .profile-head ${JSON.stringify(head.headDisplay)} gap ${head.headGap} → ${JSON.stringify(head.headTracks)} (${expectTracks} tracks), avatar top ${head.avatar.top} · who top ${head.who.top} left ${head.who.left} · action top ${head.action.top}, name ${JSON.stringify(head.name)} at ${head.nameFont}${head.pagerMinWidth ? `, pager min-width ${head.pagerMinWidth} align ${head.pagerAlign}` : ", no pager"}`,
        );
      }
      headSeen = headLines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const headAfter = await js("return window.innerWidth;");
    if (headAfter !== headRestore) {
      throw new Error(`the head's overrides cleared to ${headAfter}px, but the session runs at ${headRestore}px — a leaked override would mis-measure every later row`);
    }

    return `/user/${STRANGER_HANDLE}/edit stays put and reads "You can't edit this account." with no username field, no Save and Back to your profile at /user/${ownHandle} · the owner's form prefills ${JSON.stringify([form.handle, form.name, before.bio])} with the rule ${JSON.stringify(rule)} as help · @${STRANGER_HANDLE} → ${JSON.stringify("Username taken")} with Save disabled and no help · "ab" → the same rule as the inline error with Save disabled · back to @${ownHandle} → error gone, rule back as help, Save enabled · Cancel → /user/${ownHandle} reads ${JSON.stringify([after.name, after.handle])} unchanged · the head at ${headSeen}`;
  }),
);

/* ----------------------------------------------------------------------------------------------
 * T-64 — `pages/user/profile.md` → *Layout* / *Actions* / *URL*: the body is **four tabs in
 * `?tab=`**, the creations tab's filter is `?type=` (read on that tab only), and a follower is the
 * **catalog card with two fields swapped** — the bio in the tagline's slot, followers/following in
 * the footer instead of an author and a ratio.
 *
 * No row has ever pressed a tab: rows 2, 45 and 46 read only `.profile-head`. A tab that renders
 * another tab's body, a `type` that leaks onto the posts tab, a header that remounts on a tab swap
 * and a follower card that grew a `.card-author` and a `.card-ratio` were green in every gate and
 * in all 46 rows.
 *
 * **Read-only.** It presses tabs, the type chips and one card; it writes no store row, touches no
 * preference, and hands the account back exactly as it found it.
 * ---------------------------------------------------------------------------------------------- */
const PROFILE_TABS = ["Creations", "Posts", "Followers", "Following"];
const TAB_SCOPE = ".tabs[role=tablist] [role=tab]";

results.push(
  await journey("the profile's four tabs are a URL fact, and a follower is drawn as a catalog card", async () => {
    /** The head — the five things a tab swap must not disturb. */
    const readHead = () =>
      js(`
        const text = (selector) => {
          const el = document.querySelector(selector);
          return el ? (el.textContent || "").replace(/\\s+/g, " ").trim() : "";
        };
        const tabs = [...document.querySelectorAll(${JSON.stringify(TAB_SCOPE)})];
        return {
          present: document.querySelector(".profile-head") !== null,
          name: text(".profile-head h1.name"),
          handle: text(".profile-head .handle"),
          bio: text(".profile-head .bio"),
          figures: [...document.querySelectorAll(".profile-head .figures .figure")].map((el) =>
            (el.textContent || "").replace(/\\s+/g, " ").trim(),
          ),
          tabs: tabs.map((el) => (el.textContent || "").trim()),
          selected: tabs.filter((el) => el.getAttribute("aria-selected") === "true").map((el) => (el.textContent || "").trim()),
          marked: document.querySelector(".profile-head[data-walk-head='1']") !== null,
        };
      `);

    /** The body the selected tab draws, plus the two URL facts that select it. */
    const readBody = () =>
      js(`
        const params = new URLSearchParams(location.search);
        const cards = [...document.querySelectorAll(".card-cell .card")];
        return {
          search: location.search,
          tab: params.get("tab"),
          type: params.get("type"),
          typeRow: document.querySelector(".type-row") !== null,
          creations: cards.filter((el) => el.querySelector(".card-handle") === null && el.querySelector(".card-author") !== null).length,
          people: cards.filter((el) => el.querySelector(".card-handle") !== null).length,
          posts: document.querySelectorAll(".card.post").length,
          links: [...document.querySelectorAll(".card-cell .card .card-title")].map((a) => a.getAttribute("href") || ""),
          busy: document.querySelector(".profile [aria-busy='true']") !== null,
          empty: (document.querySelector(".empty-copy")?.textContent || "").trim(),
          marked: document.querySelector(".profile-head[data-walk-head='1']") !== null,
        };
      `);

    /** A poll that always throws with the whole body it last read, never a bare timeout. */
    const untilBody = async (label, check, timeout = 12000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await readBody();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(`${label} — read ${JSON.stringify(last)}`);
    };

    /** Mark the mounted header: a push that does not notify the router keeps the page, and a
     *  remount throws the expando away — the one honest proof that the header survived the swap. */
    const markHead = () =>
      js(`const head = document.querySelector(".profile-head"); if (head) head.dataset.walkHead = "1"; return head !== null;`);

    const headSwap = async (label, wantTab, wantCount, wanted) => {
      await click(wanted, { exact: true, scope: TAB_SCOPE });
      const body = await untilBody(`${label} to draw its own body at tab=${wantTab}`, (b) => b.tab === wantTab && !b.busy && wantCount(b), 12000);
      if (!body.marked) {
        throw new Error(
          `${label} threw the header away (read ${JSON.stringify(body)}) — a tab swap writes the URL with pushState, so the page that booted must still be mounted`,
        );
      }
      const head = await readHead();
      if (head.name !== opened.name || head.handle !== opened.handle || head.bio !== opened.bio || head.figures.join("|") !== opened.figures.join("|")) {
        throw new Error(
          `the header reads ${JSON.stringify([head.name, head.handle, head.bio, head.figures])} after the ${label}, not ${JSON.stringify([opened.name, opened.handle, opened.bio, opened.figures])} — a tab swap is the body's, not the header's`,
        );
      }
      if (head.selected.join(",") !== wanted) {
        throw new Error(`the strip marks ${JSON.stringify(head.selected)} selected on the ${label}, not ${JSON.stringify(wanted)}`);
      }
      return { ...body, selected: head.selected };
    };

    // 1. The session's own handle, read from the shell (row 45 hands `@you` back; never pin it).
    await go("/");
    await waitText("signed in as", 8000);
    const ownHref = await js(`
      const link = [...document.querySelectorAll("a")].find((a) => (a.innerText || "").trim() === "Open profile");
      return link ? link.getAttribute("href") || "" : "";
    `);
    const ownHandle = ownHref.split("/").filter(Boolean).pop() || "";
    if (!ownHandle) throw new Error(`/ draws no Open profile link (read ${JSON.stringify(ownHref)}) — the row cannot know whose profile it is walking`);

    await go(`/user/${ownHandle}`);
    await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the account's profile header", 10000);
    const opened = await readHead();
    if (!opened.present || !opened.name || !opened.bio || opened.handle !== `@${ownHandle}`) {
      throw new Error(`/user/${ownHandle} reads ${JSON.stringify(opened)} — the row needs the owner's own name, handle and bio to prove the header survives a tab swap`);
    }
    if (JSON.stringify(opened.tabs) !== JSON.stringify(PROFILE_TABS)) {
      throw new Error(`the tab strip reads ${JSON.stringify(opened.tabs)}, not ${JSON.stringify(PROFILE_TABS)} — the spec's four tabs, in that order`);
    }
    if (opened.figures.length !== 2 || !opened.figures.every((figure) => /^\d+ (followers?|following)$/.test(figure))) {
      throw new Error(`the header's figures read ${JSON.stringify(opened.figures)} — the spec asks for followers and following as plain figures`);
    }

    // The creations tab is the default: its grid, its type row, and `tab=creations` in the URL.
    const created = await untilBody("the creations tab to draw its grid", (b) => b.tab === "creations" && !b.busy && b.creations > 0);
    if (!created.typeRow) {
      throw new Error(`the creations tab draws no type control (read ${JSON.stringify(created)}) — All / Characters / Lorebooks / Presets refines that grid`);
    }
    if (created.type !== null) {
      throw new Error(`/user/${ownHandle} opens with ?type=${created.type} in the URL — All is the absence of a filter, and paging is not in the URL either`);
    }
    if (created.posts !== 0 || created.people !== 0) {
      throw new Error(`the creations tab draws ${created.posts} post card(s) and ${created.people} profile card(s) — one tab, one body`);
    }
    if (!(await markHead())) throw new Error(`/user/${ownHandle} mounted no .profile-head to mark`);

    // 2. Posts: `tab=posts`, the thread card, no type control, and the header still the one that booted.
    const posts = await headSwap("posts tab", "posts", (b) => b.posts > 0, "Posts");
    if (posts.creations !== 0 || posts.people !== 0) {
      throw new Error(`the posts tab still draws ${posts.creations} creation card(s) and ${posts.people} profile card(s) (read ${JSON.stringify(posts)}) — a tab that renders another tab's body`);
    }
    if (posts.typeRow) {
      throw new Error(`the posts tab draws a type control (read ${JSON.stringify(posts)}) — ?type= is read on the creations tab only`);
    }

    // 3. A pasted `?type=` on a post tab changes nothing, and leaves the URL: the filter is the
    //    creations tab's, not the profile's.
    await go(`/user/${ownHandle}?tab=posts&type=preset`);
    const leaked = await untilBody("a post tab asked for ?type=preset to draw a post feed", (b) => b.tab === "posts" && !b.busy && b.posts > 0);
    if (leaked.type !== null) {
      throw new Error(`/user/${ownHandle}?tab=posts&type=preset left type=${JSON.stringify(leaked.type)} in the URL (read ${JSON.stringify(leaked.search)}) — the creations filter must not survive on another tab`);
    }
    if (leaked.typeRow) throw new Error(`a posts tab asked for ?type=preset drew a type control — the filter belongs to the creations grid`);

    // 4. Back to creations, then the type chips: Characters narrows the grid it filters and All
    //    drops `type` from the URL. A fresh mount from step 3 means a fresh mark.
    await click("Creations", { exact: true, scope: TAB_SCOPE });
    const again = await untilBody("the creations tab to come back", (b) => b.tab === "creations" && !b.busy && b.creations > 0);
    if (!again.typeRow) throw new Error(`the creations tab came back without its type control (read ${JSON.stringify(again)})`);
    await markHead();

    await click("Characters", { exact: true, scope: ".type-row button" });
    const chars = await untilBody(
      "the Characters chip to narrow the grid to characters",
      (b) => b.type === "character" && !b.busy && b.links.length > 0 && b.links.every((href) => href.includes("/character/")),
    );
    if (!chars.marked) {
      throw new Error(`the type filter remounted the page (read ${JSON.stringify(chars)}) — a chip rewrites ?type= with pushState, so the mounted header must survive it`);
    }
    if (chars.creations !== chars.links.length) {
      throw new Error(`?type=character draws ${chars.creations} creation card(s) but ${chars.links.length} title link(s) (read ${JSON.stringify(chars)})`);
    }

    await click("All", { exact: true, scope: ".type-row button" });
    const all = await untilBody("the All chip to drop the filter", (b) => b.type === null && !b.busy && b.links.length > chars.links.length);
    if (!all.marked) throw new Error(`the All chip remounted the page (read ${JSON.stringify(all)}) — dropping a filter rewrites ?type= with pushState`);

    // 5. Followers: the catalog card with two fields swapped, and no author and no ratio.
    const followers = await headSwap("followers tab", "followers", (b) => b.people > 0, "Followers");
    if (followers.creations !== 0 || followers.posts !== 0) {
      throw new Error(`the followers tab draws ${followers.creations} creation card(s) and ${followers.posts} post card(s) (read ${JSON.stringify(followers)}) — a tab that renders another tab's body`);
    }
    if (followers.typeRow) throw new Error(`the followers tab draws a type control (read ${JSON.stringify(followers)}) — ?type= is read on the creations tab only`);

    const follower = await js(`
      const card = document.querySelector(".card-cell .card");
      if (!card) return null;
      const one = (selector) => card.querySelector(selector);
      const text = (selector) => {
        const el = one(selector);
        return el ? (el.textContent || "").replace(/\\s+/g, " ").trim() : "";
      };
      return {
        title: text(".card-title"),
        handle: text(".card-handle"),
        tagline: text(".card-tagline"),
        foot: [...card.querySelectorAll(".card-foot > *")].map((el) => (el.textContent || "").replace(/\\s+/g, " ").trim()),
        author: one(".card-author") !== null,
        ratio: one(".card-ratio") !== null,
        cover: one(".card-cover") !== null,
      };
    `);
    if (!follower) throw new Error(`the followers tab draws ${followers.people} .card-cell(s) and no .card to read`);
    if (!follower.title) throw new Error(`the follower card draws the title ${JSON.stringify(follower.title)} — the display name is the card's title`);
    if (!/^@[a-z0-9_]+$/.test(follower.handle)) {
      throw new Error(`the follower card's handle reads ${JSON.stringify(follower.handle)} — the handle sits under the title as @handle`);
    }
    if (!follower.tagline) {
      throw new Error(`the follower card draws no .card-tagline (read ${JSON.stringify(follower)}) — the bio takes the tagline's slot`);
    }
    if (follower.author || follower.ratio) {
      throw new Error(
        `the follower card grew ${JSON.stringify([follower.author ? ".card-author" : null, follower.ratio ? ".card-ratio" : null].filter(Boolean))} (read ${JSON.stringify(follower)}) — a person's card carries followers and following, never an author and a ratio`,
      );
    }
    if (follower.foot.length !== 2 || !/^\d+ followers?$/.test(follower.foot[0]) || !/^\d+ following$/.test(follower.foot[1])) {
      throw new Error(`the follower card's footer reads ${JSON.stringify(follower.foot)}, not followers then following — the two fields the catalog card spends on an author and a ratio`);
    }

    // 6. A card opens that person: the title is their name and the tagline is their bio. Back
    //    remounts (the effect keys on path + search), so assert the search and the body, not the mark.
    const personHandle = follower.handle.replace(/^@/, "");
    await clickSelector(".card-cell .card .card-title");
    await expectPath(`/user/${personHandle}`, "a follower card's title", 12000);
    await waitFor(`document.querySelector(".profile-head h1.name") !== null`, "the follower's profile", 10000);
    const landed = await readHead();
    if (landed.handle !== `@${personHandle}` || landed.name !== follower.title) {
      throw new Error(`the card titled ${JSON.stringify(follower.title)} opened ${JSON.stringify([landed.name, landed.handle])} — a follower card links to that person`);
    }
    if (landed.bio !== follower.tagline) {
      throw new Error(`@${personHandle} reads the bio ${JSON.stringify(landed.bio)} where the card's tagline read ${JSON.stringify(follower.tagline)} — the bio must land in the tagline's slot`);
    }

    await js(`history.back(); return true;`);
    const returned = await untilBody("the followers tab to return on Back", (b) => b.tab === "followers" && !b.busy && b.people === followers.people, 12000);
    if (returned.creations !== 0 || returned.posts !== 0) {
      throw new Error(`Back landed on ${JSON.stringify([returned.tab, returned.creations, returned.posts])} — the tab must come back as the followers list it was`);
    }
    await markHead();

    // 7. Following is the same card, the other edge.
    const following = await headSwap("following tab", "following", (b) => b.people > 0, "Following");
    if (following.creations !== 0 || following.posts !== 0) {
      throw new Error(`the following tab draws ${following.creations} creation card(s) and ${following.posts} post card(s) (read ${JSON.stringify(following)}) — a tab that renders another tab's body`);
    }

    return `@${ownHandle} reads ${JSON.stringify([opened.name, opened.bio, opened.figures])} with the tabs ${JSON.stringify(opened.tabs)} · creations ?tab=creations&type= draws ${created.creations} card(s) with the type row · Posts → ${JSON.stringify(posts.search)} draws ${posts.posts} thread card(s), no type row, the marked header intact · a pasted ?tab=posts&type=preset reads ${JSON.stringify(leaked.search)} with ${leaked.posts} post card(s) · Characters → ${JSON.stringify(chars.search.split("type=")[1])} narrows ${chars.creations} card(s) all /character/ · All → ${JSON.stringify(all.search)} draws ${all.links.length} card(s) · Followers → ${JSON.stringify(followers.search)} draws ${followers.people} card(s) whose first is ${JSON.stringify([follower.title, follower.handle, follower.foot])} with no .card-author and no .card-ratio · its title opens @${personHandle} reading ${JSON.stringify([landed.name, landed.bio])} · Back returns to ${JSON.stringify(returned.search)} with ${returned.people} card(s) · Following → ${JSON.stringify(following.search)} draws ${following.people} card(s)`;
  }),
);

/* ------------------------------------------------------------------------------------------------
 * T-65 — the catalog's search, its tags and its sort are three **URL** facts
 * (`src/specs/pages/character/catalog.md` → URL), and the search is debounced (`CONTRACT.md` →
 * Engineering law). Rows 30 and 36-38 read this grid, the card's footer and the NSFW pair; no row had
 * ever typed into the search, picked a tag, pressed the sort control or opened
 * `?q=…&tags=…&sort=ratio` by address — so a per-keystroke writer, a `q` that dies on reload, a chip
 * that never reaches the adapter and a `sort=ratio` that leaves the control on Newest were all green.
 *
 * Four things make this row honest:
 *  - **the vocabulary comes from the page in front of it** — the first card's own title, two tags on
 *    two different cards — never from `lib/fixtures`;
 *  - **the debounce is proved by reading between keystrokes**, not by sleeping: a per-keystroke writer
 *    leaves `?q=a` behind while the word is still being typed. A sample that arrives later than 250ms
 *    proves nothing, so it is counted and reported instead of asserted (a slow walk is not a bug);
 *  - **the sort is proved by the listing, not by the control**: `?sort=ratio` draws ratios that never
 *    rise, and the row refuses to run if Newest is already ordered that way — otherwise it would pass
 *    on a page that ignored the param;
 *  - `choose()` returns what it read (T-41), so every press here asserts its **consequence**: the URL,
 *    the grid, the chip.
 *
 * Read-only: it types, presses a chip's own remove control, the sort select and one `+N` chip. No
 * store row and no preference is written.
 *
 * Since T-84 the row also reads **the toolbar at 640, 900 and 360** — two media blocks govern that
 * bar (`220px minmax(0, 1fr)` with the sort pinned to column 1 and the switches rewritten into a row;
 * then `640-899` lifting that row across both columns; then `md` putting them side by side), and every
 * earlier row mounted the page at the walk's own ~500px where none of them is live. It is a read,
 * taken **before** the first keystroke so the typing half's field and settle are untouched.
 * ---------------------------------------------------------------------------------------------- */
const CATALOG_PATH = "/character/catalog";

results.push(
  await journey("the catalog's search, tags and sort are three URL facts, and the search settles", async () => {
    /** The whole listing plus the three params that select it — one read, so no two facts drift. */
    const readCatalog = () =>
      js(`
        const params = new URLSearchParams(location.search);
        const text = (el) => (el ? (el.textContent || "").replace(/\\s+/g, " ").trim() : "");
        const cards = [...document.querySelectorAll(".card-cell .card")];
        const select = document.querySelector('select[name="sort"]');
        return {
          search: location.search,
          q: params.get("q"),
          tagsParam: params.get("tags"),
          sortParam: params.get("sort"),
          count: cards.length,
          titles: cards.map((card) => text(card.querySelector(".card-title"))),
          ratios: cards.map((card) => {
            const el = card.querySelector(".card-ratio");
            return el ? Number((text(el) || "").replace("%", "")) : -1;
          }),
          tagSets: cards.map((card) =>
            [...card.querySelectorAll(".card-tags.is-measure .card-tag")].map((el) => text(el)),
          ),
          chips: [...document.querySelectorAll(".tagpicker .tag-chip-text")].map((el) => text(el)),
          field: (document.querySelector('input[name="q"]') || {}).value || "",
          sortValue: select ? select.value : "",
          sortLabel: select && select.selectedOptions[0] ? text(select.selectedOptions[0]) : "",
          busy: document.querySelector(".catalog [aria-busy='true']") !== null,
          empty: text(document.querySelector(".empty-copy")),
          actions: [...document.querySelectorAll(".catalog button, .catalog a.btn")].map((el) => text(el)),
        };
      `);

    /** A poll that always throws with the whole listing it last read, never a bare timeout (T-53). */
    const untilCatalog = async (label, check, timeout = 12000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await readCatalog();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(`${label} — read ${JSON.stringify(last)}`);
    };

    const descending = (values) => values.every((value, index) => index === 0 || value <= values[index - 1]);
    const sameTitles = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    // 1. A fresh mount: no query, no filter, no sort. The toolbar as it ships.
    await go(CATALOG_PATH);
    const full = await untilCatalog("the catalog to draw its first page", (s) => !s.busy && s.count > 0);
    if (full.q !== null || full.tagsParam !== null || full.sortParam !== null) {
      throw new Error(
        `a fresh ${CATALOG_PATH} opens on ${JSON.stringify(full.search)} — the search, the tags and the sort are the reader's, so not one of them starts set`,
      );
    }
    if (full.field !== "") throw new Error(`the search field opens holding ${JSON.stringify(full.field)}, not an empty one`);
    if (full.sortValue !== "newest" || full.sortLabel !== "Newest") {
      throw new Error(`the sort control opens reading ${JSON.stringify([full.sortValue, full.sortLabel])}, not newest / Newest`);
    }
    if (full.ratios.some((ratio) => !Number.isFinite(ratio) || ratio < 0)) {
      throw new Error(`a card's ratio reads ${JSON.stringify(full.ratios)} — the footer's percentage is what the ratio sort is measured by`);
    }

    // 1b. The toolbar at the three widths its own stylesheet draws it for (T-84). `character-catalog`'s
    //     `sm 640` block turns the four stacked rows into `220px minmax(0, 1fr)`, pins the sort to
    //     column 1 and rewrites the bordered `.prefs` column into a 32px row; the `640-899` block then
    //     lifts that row across both columns, and `md 900` gives it column 2 beside the sort. Row 48's
    //     own mount is the walk's ~500px, so not one declaration has ever been rendered. Nothing here
    //     presses or types: it runs before the first keystroke, which is what lets the debounce half
    //     below keep its field, its caret and its 250ms settle untouched.
    const readToolbar = () =>
      js(`
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const round = (n) => Math.round(n * 100) / 100;
          return { top: round(r.top), left: round(r.left), right: round(r.right), bottom: round(r.bottom), width: round(r.width), height: round(r.height) };
        };
        const bar = document.querySelector(".toolbar");
        const bs = bar ? getComputedStyle(bar) : null;
        const isGrid = !!bs && bs.display.indexOf("grid") >= 0;
        const prefs = document.querySelector(".toolbar > .prefs");
        const ps = prefs ? getComputedStyle(prefs) : null;
        const head = document.querySelector(".head");
        const pagerBox = document.querySelector(".pager-action");
        return {
          path: location.pathname,
          search: location.search,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          display: bs ? bs.display : "",
          tracks: isGrid ? bs.gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : [],
          gap: bs ? bs.gap : "",
          alignItems: bs ? bs.alignItems : "",
          toolbar: box(bar),
          field: box(document.querySelector(".toolbar > .search")),
          tags: box(document.querySelector(".toolbar > .tags")),
          sort: box(document.querySelector(".toolbar > .sort")),
          prefs: box(prefs),
          prefsFlex: ps ? ps.flexDirection : "",
          prefsAlign: ps ? ps.alignItems : "",
          prefsGap: ps ? ps.gap : "",
          prefsBorderTop: ps ? ps.borderTopWidth : "",
          headAlign: head ? getComputedStyle(head).alignItems : "",
          pagerMinWidth: pagerBox ? getComputedStyle(pagerBox).minWidth : "",
          cards: document.querySelectorAll(".card-cell .card").length,
        };
      `);

    const assertToolbar = (r, width) => {
      const at = `${CATALOG_PATH} at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!r.path.endsWith(CATALOG_PATH)) {
        throw new Error(`${at}: the toolbar was measured on ${JSON.stringify(r.path)}, not the character catalog`);
      }
      if (r.display.indexOf("grid") < 0) {
        throw new Error(`${at}: .toolbar computes ${JSON.stringify(r.display)}, not the grid all three of its blocks declare`);
      }
      if (!r.toolbar || !r.field || !r.tags || !r.sort || !r.prefs) {
        throw new Error(
          `${at}: the toolbar is incomplete — toolbar ${JSON.stringify(r.toolbar)}, search ${JSON.stringify(r.field)}, tags ${JSON.stringify(r.tags)}, sort ${JSON.stringify(r.sort)}, prefs ${JSON.stringify(r.prefs)}`,
        );
      }
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the catalog scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }

      if (width === 640) {
        // The `sm` fact: a 220px fixed column and a fluid one. The count alone is not proof (a
        // leftover placement creates an implicit track, T-77), so the fixed track is sized too.
        if (r.tracks.length !== 2) {
          throw new Error(
            `${at}: .toolbar resolves ${r.tracks.length} track(s) ${JSON.stringify(r.tracks)}, not the two the sm block declares (220px | minmax(0, 1fr)) — the sort measures ${r.sort.width} wide`,
          );
        }
        if (Math.abs(parseFloat(r.tracks[0]) - 220) > 1) {
          throw new Error(
            `${at}: the toolbar's first track resolves to ${JSON.stringify(r.tracks[0])}, not the 220px sort column the sm block declares (tracks ${JSON.stringify(r.tracks)}, sort ${r.sort.width} wide)`,
          );
        }
        if (Math.abs(r.sort.left - r.toolbar.left) > 1 || Math.abs(r.sort.width - 220) > 1) {
          throw new Error(
            `${at}: .sort draws ${r.sort.left}→${r.sort.right} (${r.sort.width} wide) in a toolbar that starts at ${r.toolbar.left} — the sm block pins it to column 1, the 220px track`,
          );
        }
        if (r.gap !== "12px 24px") {
          throw new Error(`${at}: .toolbar computes gap ${JSON.stringify(r.gap)}, not the sm block's 12px 24px`);
        }
        if (r.prefsFlex !== "row" || r.prefsAlign !== "center" || r.prefsGap !== "32px" || r.prefsBorderTop !== "0px") {
          throw new Error(
            `${at}: .prefs reads flexDirection ${JSON.stringify(r.prefsFlex)}, alignItems ${JSON.stringify(r.prefsAlign)}, gap ${JSON.stringify(r.prefsGap)}, border-top ${JSON.stringify(r.prefsBorderTop)} — the sm block rewrites the bordered column into a 32px row`,
          );
        }
        // `.prefs` spans both columns here because the `640-899` block wins: it starts at the
        // toolbar's own left edge and crosses the fixed column. Its right edge is the area's only if
        // nothing centres it, so "it spans" is the left edge plus the crossing (T-80's honest form).
        if (Math.abs(r.prefs.left - r.toolbar.left) > 1) {
          throw new Error(
            `${at}: .prefs starts at ${r.prefs.left} in a toolbar starting at ${r.toolbar.left} (it measures ${r.prefs.width} of the ${r.toolbar.width} toolbar) — the 640-899 block lifts the pair across both columns (grid-column 1 / -1)`,
          );
        }
        if (!(r.prefs.right > r.sort.right)) {
          throw new Error(
            `${at}: .prefs ends at ${r.prefs.right} inside the sort's ${r.sort.right} — the row spans past the fixed column, not only its own`,
          );
        }
        if (r.headAlign !== "flex-end") {
          throw new Error(`${at}: .head computes align-items ${JSON.stringify(r.headAlign)}, not the flex-end the sm block declares`);
        }
        // `.pager` draws only while the listing has a next page, so a min-width is read when the box
        // exists and never asserted into being (T-78's guarded read).
        if (r.pagerMinWidth !== "" && r.pagerMinWidth !== "200px") {
          throw new Error(`${at}: the pager's action box computes min-width ${JSON.stringify(r.pagerMinWidth)}, not the 200px the sm block gives it`);
        }
        return;
      }

      if (width === 900) {
        if (r.tracks.length !== 2) {
          throw new Error(`${at}: .toolbar resolves ${r.tracks.length} track(s) ${JSON.stringify(r.tracks)}, not the two the md block keeps (220px | minmax(0, 1fr))`);
        }
        if (Math.abs(parseFloat(r.tracks[0]) - 220) > 1) {
          throw new Error(`${at}: the toolbar's first track resolves to ${JSON.stringify(r.tracks[0])}, not 220px (tracks ${JSON.stringify(r.tracks)}, sort ${r.sort.width} wide)`);
        }
        if (Math.abs(r.sort.width - 220) > 1) {
          throw new Error(`${at}: .sort measures ${r.sort.width} wide, not the 220px column it is pinned to (tracks ${JSON.stringify(r.tracks)})`);
        }
        // Column 2 is one column gap right of the fixed track, and it reaches the toolbar's right
        // edge: this is the direction `640-899`'s span is meant to *not* happen in.
        if (Math.abs(r.prefs.left - (r.sort.right + 24)) > 1) {
          throw new Error(
            `${at}: .prefs starts at ${r.prefs.left}, not ${r.sort.right} + 24 (the column gap) — at md the switches take column 2 beside the 220px sort, not a full-width row`,
          );
        }
        if (Math.abs(r.prefs.right - r.toolbar.right) > 1) {
          throw new Error(`${at}: .prefs ends at ${r.prefs.right} in a toolbar ending at ${r.toolbar.right} — the pair fills the fluid column`);
        }
        // `align-items: end` makes the BOTTOMS the row witness: `.sort` is a Select wrapper and the
        // row is content-sized, so their tops differ by design (T-79/T-80).
        if (Math.abs(r.prefs.bottom - r.sort.bottom) > 2) {
          throw new Error(
            `${at}: .sort ends at ${r.sort.bottom} and .prefs at ${r.prefs.bottom} — md puts them on one row (tops ${r.sort.top} / ${r.prefs.top}, align-items end), so the bottoms are the witness`,
          );
        }
        if (r.pagerMinWidth !== "" && r.pagerMinWidth !== "200px") {
          throw new Error(`${at}: the pager's action box computes min-width ${JSON.stringify(r.pagerMinWidth)}, not the 200px the sm block gives it`);
        }
        return;
      }

      // 360 — the base block: one track, all four children the toolbar's full width, and the switches
      // back in the bordered column the sm block replaces.
      if (r.tracks.length !== 1) {
        throw new Error(
          `${at}: .toolbar resolves ${r.tracks.length} track(s) ${JSON.stringify(r.tracks)}, not the one the base block leaves (no grid-template-columns) — the sm block is leaking below its breakpoint`,
        );
      }
      if (Math.abs(r.sort.left - r.toolbar.left) > 1 || Math.abs(r.sort.right - r.toolbar.right) > 1) {
        throw new Error(`${at}: .sort draws ${r.sort.left}→${r.sort.right} in a toolbar ${r.toolbar.left}→${r.toolbar.right} — below 640 the sort is a full-width row of its own`);
      }
      if (Math.abs(r.prefs.left - r.toolbar.left) > 1 || Math.abs(r.prefs.right - r.toolbar.right) > 1) {
        throw new Error(`${at}: .prefs draws ${r.prefs.left}→${r.prefs.right} in a toolbar ${r.toolbar.left}→${r.toolbar.right} — below 640 the switches are a full-width row`);
      }
      if (r.prefsFlex !== "column" || r.prefsBorderTop !== "1px") {
        throw new Error(
          `${at}: .prefs reads flexDirection ${JSON.stringify(r.prefsFlex)} and border-top ${JSON.stringify(r.prefsBorderTop)} — below 640 it is the bordered column of two labels, not the sm row`,
        );
      }
      if (!(r.sort.top > r.tags.bottom - 1) || !(r.prefs.top > r.sort.bottom - 1)) {
        throw new Error(
          `${at}: the rows read search ${r.field.top}→${r.field.bottom}, tags ${r.tags.top}→${r.tags.bottom}, sort ${r.sort.top}→${r.sort.bottom}, prefs ${r.prefs.top}→${r.prefs.bottom} — below 640 the four are stacked in DOM order`,
        );
      }
      if (r.pagerMinWidth === "200px") {
        throw new Error(`${at}: the pager's action box computes min-width 200px below its breakpoint — the sm block's floor is leaking into the phone`);
      }
    };

    const barRestore = await js("return window.innerWidth;");
    const barLines = [];
    let barSeen = "";
    try {
      // One override per width, and the page does not remount on a width change, so every reading
      // asserts `innerWidth` instead of assuming it held (T-77's width-major ladder).
      for (const width of [640, 900, 360]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        await waitFor(`document.querySelector(".toolbar > .prefs") !== null`, `the catalog toolbar at ${width}px`, 10000);
        const bar = await readToolbar();
        assertToolbar(bar, width);
        barLines.push(
          `${width}px: .toolbar ${JSON.stringify(bar.display)} gap ${bar.gap} → ${JSON.stringify(bar.tracks)} (${bar.tracks.length} track(s), align ${bar.alignItems}) · search ${bar.field.top}→${bar.field.bottom} · tags ${bar.tags.top}→${bar.tags.bottom} · sort ${bar.sort.left}→${bar.sort.right} top ${bar.sort.top} bottom ${bar.sort.bottom} · prefs ${bar.prefs.left}→${bar.prefs.right} top ${bar.prefs.top} bottom ${bar.prefs.bottom} (${bar.prefsFlex}, align ${bar.prefsAlign}, gap ${bar.prefsGap}, border-top ${bar.prefsBorderTop}) · head align ${bar.headAlign}${bar.pagerMinWidth ? `, pager min-width ${bar.pagerMinWidth}` : ", no pager"}`,
        );
      }
      barSeen = barLines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const barAfter = await js("return window.innerWidth;");
    if (barAfter !== barRestore) {
      throw new Error(`the toolbar's overrides cleared to ${barAfter}px, but the session runs at ${barRestore}px — a leaked override would mis-measure every later row`);
    }
    // Nothing was pressed and nothing navigated, so the page is still the bare mount it was: the
    // ladder is a measure, not a hop (a `go()` inside it would re-boot the page and the first
    // keystroke's caret proof would silently measure another mount).
    const afterLadder = await readCatalog();
    if (afterLadder.search !== "" || afterLadder.count !== full.count) {
      throw new Error(
        `the width phase left ${JSON.stringify(afterLadder.search)} with ${afterLadder.count} card(s), not the bare ${full.count} the mount drew — a ladder that navigates proves another page's facts`,
      );
    }

    /** The word to type: the longest in the first card's own title, so it is a real search term. */
    const firstTitle = full.titles[0] || "";
    if (!firstTitle) throw new Error(`the catalog's first card draws no title (read ${JSON.stringify(full.titles.slice(0, 3))})`);
    const word =
      firstTitle
        .split(/\s+/)
        .filter((part) => part.replace(/[^A-Za-z0-9]/g, "").length >= 5)
        .sort((a, b) => b.length - a.length)[0] || firstTitle;

    // 2. The debounce. One character at a time, and the URL stays clean until the settle — the sample
    //    is only asserted when the read landed inside the 250ms window it is about.
    const letters = [...word];
    const samples = [];
    for (let i = 1; i <= letters.length; i += 1) {
      const started = Date.now();
      await retype('input[name="q"]', letters.slice(0, i).join(""));
      const search = await js(`return location.search;`);
      samples.push({ typed: letters.slice(0, i).join(""), search, elapsed: Date.now() - started });
    }
    const fast = samples.filter((sample) => sample.elapsed < 250);
    if (fast.length < 3) {
      throw new Error(
        `only ${fast.length} of ${samples.length} keystroke sample(s) landed inside 250ms (read ${JSON.stringify(samples.map((s) => s.elapsed))}) — the row cannot prove the settle at this speed`,
      );
    }
    const early = fast.filter((sample) => sample.search.includes("q="));
    if (early.length > 0) {
      throw new Error(
        `the search wrote the URL ${early.length} time(s) while ${JSON.stringify(word)} was still being typed (read ${JSON.stringify(early.slice(0, 3))}) — a per-keystroke writer, not the 250ms settle`,
      );
    }

    const typed = await untilCatalog(`the settle to write the whole word ${JSON.stringify(word)}`, (s) => s.q === word && !s.busy);
    if (typed.count === 0 || typed.count >= full.count) {
      throw new Error(`?q=${word} draws ${typed.count} card(s) of the ${full.count} the unfiltered catalog draws — the search must narrow the grid and keep the card it names`);
    }
    if (!typed.titles.includes(firstTitle)) {
      throw new Error(`?q=${word} dropped ${JSON.stringify(firstTitle)} (read ${JSON.stringify(typed.titles)}) — the card whose own title the word came from must survive its own search`);
    }

    // 3. The URL is the state: a fresh mount from `?q=` preloads the field and draws the same grid.
    //    T-66 made this half honest: the settle's write is `commitQuery()`, which moves the router's
    //    mounted key to the location it now owns — so a hop to the bare route really does remount
    //    (before that it was a no-op and the only way out was `go("/")`, which row 48 used to need).
    //    The bare hop is asserted rather than assumed: a page that drew the full grid without
    //    remounting would still be showing the narrowed component's state.
    await go(CATALOG_PATH);
    await untilCatalog("the bare catalog to remount after the settle's commit", (s) => s.q === null && !s.busy && s.count === full.count);
    await go(`${CATALOG_PATH}?q=${encodeURIComponent(word)}`);
    const restored = await untilCatalog(`a mount from ?q=${word} to draw the narrowed grid`, (s) => s.q === word && !s.busy && s.count > 0);
    if (restored.field !== word) {
      throw new Error(
        `the search field reads ${JSON.stringify(restored.field)} on a mount from ?q=${JSON.stringify(word)} — the page reads its query at mount, so a shared or reloaded URL restores the view`,
      );
    }
    if (!sameTitles(restored.titles, typed.titles)) {
      throw new Error(`a mount from ?q=${word} draws ${JSON.stringify(restored.titles)}, not the ${JSON.stringify(typed.titles)} the typed query drew — one query, two listings`);
    }

    // 4. No results is a state, not an error: the no-results copy, no card, and a road out that is
    //    Clear — never Retry (that is the failed fetch's).
    await go(`${CATALOG_PATH}?q=zzqx-nothing-matches`);
    const none = await untilCatalog("the no-results state", (s) => s.q === "zzqx-nothing-matches" && !s.busy && s.count === 0 && s.empty !== "");
    if (none.empty === "No characters yet.") {
      throw new Error(`a query nothing matches reads the empty catalog's own sentence (${JSON.stringify(none.empty)}) — the spec has a state for each`);
    }
    if (none.actions.includes("Retry")) throw new Error(`the no-results state offers Retry (read ${JSON.stringify(none.actions)}) — nothing failed, the query simply matched nothing`);
    if (!none.actions.includes("Clear filters")) {
      throw new Error(`the no-results state's road out is missing (read ${JSON.stringify(none.actions)}) — DESIGN.md asks for the query echoed with a Clear`);
    }

    // 5. The sort. `?sort=ratio` keeps the control on Top rated and reorders the listing; Newest
    //    writes no param; Back returns the previous listing *and* its control.
    await go(CATALOG_PATH);
    const newest = await untilCatalog("the default listing to come back", (s) => s.sortParam === null && !s.busy && s.count === full.count);
    if (descending(newest.ratios)) {
      throw new Error(
        `the Newest listing already reads the ratios ${JSON.stringify(newest.ratios)} in descending order — the row could not tell a reorder from a coincidence, so it refuses to run`,
      );
    }

    await choose('select[name="sort"]', "ratio");
    const rated = await untilCatalog(
      "the ratio sort to reach the URL and reorder the grid",
      (s) => s.sortParam === "ratio" && !s.busy && s.count > 0 && descending(s.ratios),
    );
    if (rated.sortLabel !== "Top rated") {
      throw new Error(`?sort=ratio leaves the control reading ${JSON.stringify(rated.sortLabel)}, not Top rated — the select is the state's, not its own`);
    }

    await choose('select[name="sort"]', "newest");
    const backToNewest = await untilCatalog(
      "Newest to drop the param and restore the order",
      (s) => s.sortParam === null && !s.busy && sameTitles(s.titles, newest.titles),
    );
    if (backToNewest.search !== "") {
      throw new Error(`Newest left ${JSON.stringify(backToNewest.search)} in the URL — the default sort is the absence of the param`);
    }

    await js(`history.back(); return true;`);
    const returnedSort = await untilCatalog(
      "Back to return the ratio sort and its listing",
      (s) => s.sortParam === "ratio" && !s.busy && s.sortLabel === "Top rated" && sameTitles(s.titles, rated.titles),
    );

    // 6. Tags. The vocabulary is read off the grid: one tag on the first card, one on a *different*
    //    card that does not carry it — which is what lets the pair below prove either-matching.
    const tagA = (full.tagSets[0] || [])[0] || "";
    const otherIndex = full.tagSets.findIndex((set) => set.length > 0 && !set.includes(tagA));
    const tagB = otherIndex >= 0 ? full.tagSets[otherIndex][0] || "" : "";
    if (!tagA || !tagB || tagA === tagB) {
      throw new Error(
        `the page-1 grid reads the tag sets ${JSON.stringify(full.tagSets)} — the row needs two tags on two different cards, one of them carried without the other`,
      );
    }

    await go(`${CATALOG_PATH}?tags=${encodeURIComponent(tagA)}`);
    const oneTag = await untilCatalog(`?tags=${tagA} to narrow the grid`, (s) => s.tagsParam === tagA && !s.busy && s.count > 0);
    if (JSON.stringify(oneTag.chips) !== JSON.stringify([tagA])) {
      throw new Error(`the tag field reads ${JSON.stringify(oneTag.chips)} on ?tags=${tagA}, not one chip holding it — the field prints what the URL selects`);
    }
    const strays = oneTag.tagSets.filter((set) => !set.includes(tagA)).length;
    if (strays > 0) {
      throw new Error(
        `?tags=${tagA} drew ${strays} of ${oneTag.count} card(s) without it (read ${JSON.stringify(oneTag.tagSets)}) — the filter is on each item's own tags`,
      );
    }

    // A chip's own remove control rewrites the joined param; an empty set drops it entirely.
    await click(`Remove ${tagA}`, { exact: true });
    const clearedTags = await untilCatalog(
      "the chip's remove control to drop the param and restore the listing",
      (s) => s.tagsParam === null && s.chips.length === 0 && !s.busy && s.count === full.count,
    );

    await go(`${CATALOG_PATH}?tags=${encodeURIComponent(tagA)},${encodeURIComponent(tagB)}`);
    const bothTags = await untilCatalog(
      `?tags=${tagA},${tagB} to draw the union`,
      (s) => s.tagsParam === `${tagA},${tagB}` && !s.busy && s.count > 0,
    );
    if (JSON.stringify(bothTags.chips) !== JSON.stringify([tagA, tagB])) {
      throw new Error(`the tag field reads ${JSON.stringify(bothTags.chips)} on a two-tag URL, not both chips in the URL's order`);
    }
    const foreign = bothTags.tagSets.filter((set) => !set.includes(tagA) && !set.includes(tagB)).length;
    if (foreign > 0) {
      throw new Error(`?tags=${tagA},${tagB} drew ${foreign} card(s) carrying neither tag (read ${JSON.stringify(bothTags.tagSets)})`);
    }
    const onlyA = bothTags.tagSets.filter((set) => set.includes(tagA) && !set.includes(tagB)).length;
    const onlyB = bothTags.tagSets.filter((set) => set.includes(tagB) && !set.includes(tagA)).length;
    if (onlyA === 0 || onlyB === 0) {
      throw new Error(
        `?tags=${tagA},${tagB} drew ${onlyA} ${tagA}-only and ${onlyB} ${tagB}-only card(s) — two picks must match either tag, not both`,
      );
    }

    await click(`Remove ${tagB}`, { exact: true });
    const oneLeft = await untilCatalog(
      `removing ${tagB} to leave one chip and one tag in the URL`,
      (s) => s.tagsParam === tagA && s.chips.length === 1 && !s.busy,
    );

    // 7. A card's tags row is one line, and what does not fit opens behind `+N`. The fold needs a
    //    phone card — at the walk's own window every fixture card fits its tags — so this half takes
    //    its own 360×740 override and clears it (T-36a's shape; assert the width came back).
    const restoreWidth = await js(`return window.innerWidth;`);
    let folded = "";
    try {
      await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 1, mobile: false });
      await sleep(260);
      await go(CATALOG_PATH);
      await untilCatalog("the phone-width grid", (s) => s.q === null && s.tagsParam === null && !s.busy && s.count === full.count);

      const chip = await js(`
        const more = document.querySelector(".card-tag.is-more");
        if (!more) return null;
        const card = more.closest(".card");
        return {
          label: (more.textContent || "").trim(),
          hidden: Number((more.getAttribute("aria-label") || "").replace(/[^0-9]/g, "")),
          visible: [...card.querySelectorAll(".card-tags:not(.is-measure) .card-tag")].map((el) => (el.textContent || "").trim()),
          all: [...card.querySelectorAll(".card-tags.is-measure .card-tag")].map((el) => (el.textContent || "").trim()),
          open: document.querySelectorAll(".card-menu").length,
        };
      `);
      if (!chip) throw new Error(`at 360 no card folds a tag behind a +N chip — the tags row is meant to be one line`);
      if (chip.open !== 0) throw new Error(`${chip.open} card tag list(s) were already floating before the press`);
      if (chip.hidden < 1) throw new Error(`the +N chip reads ${JSON.stringify(chip.label)} and claims ${chip.hidden} hidden tag(s)`);

      await clickSelector(".card-tag.is-more");
      const menu = await waitFor(
        `(() => { const el = document.querySelector(".card-menu"); return el ? [...el.querySelectorAll(".card-tag")].map((t) => (t.textContent || "").trim()) : null; })()`,
        "the +N chip's floating list",
        6000,
      );
      if (menu.length !== chip.hidden) {
        throw new Error(`the chip reads ${JSON.stringify(chip.label)} but its list holds ${menu.length} tag(s) — ${chip.hidden} were behind it`);
      }
      const shown = [...chip.visible.filter((tag) => tag !== chip.label), ...menu].sort();
      if (JSON.stringify(shown) !== JSON.stringify([...chip.all].sort())) {
        throw new Error(`the visible row and its list read ${JSON.stringify(shown)}, not the card's own tags ${JSON.stringify([...chip.all])}`);
      }

      await clickSelector(".card-menu-scrim");
      await waitFor(`document.querySelector(".card-menu") === null`, "the floating tag list to close", 6000);
      folded = `${chip.label} opens ${JSON.stringify(menu)} and closes`;
    } finally {
      // A leaked override poisons every later row.
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const widthBack = await js(`return window.innerWidth;`);
    if (widthBack !== restoreWidth) {
      throw new Error(`the override cleared to ${widthBack}px, but the session runs at ${restoreWidth}px`);
    }

    return `a fresh mount reads ${JSON.stringify(full.search)} with ${full.count} card(s) and Newest selected · typing ${JSON.stringify(word)} a character at a time left the URL clean on all ${fast.length} in-window sample(s) and settled to ${JSON.stringify(typed.search)} with ${typed.count} card(s) · a mount from that URL preloads the field and draws the same ${restored.count} · ?q=zzqx-nothing-matches reads ${JSON.stringify(none.empty)} with 0 card(s), no Retry, a Clear filters control · ?sort=ratio reads ${JSON.stringify(rated.sortLabel)} at ${JSON.stringify(rated.search)} with ratios ${JSON.stringify(rated.ratios)} never rising, Newest drops the param (${JSON.stringify(backToNewest.search)}) and Back returns ${JSON.stringify(returnedSort.search)} · ?tags=${tagA} draws ${oneTag.count} card(s) all carrying it, its chip's remove control rewrites the URL to ${JSON.stringify(clearedTags.search)} · ?tags=${tagA},${tagB} draws ${onlyA} ${tagA}-only and ${onlyB} ${tagB}-only card(s) — either, not both — and removing ${tagB} leaves ${JSON.stringify(oneLeft.search)} · at 360 ${folded} · the toolbar at ${barSeen}`;
  }),
);

results.push(
  await journey("a page's own query write reaches the router, so the tab that leaves the narrowed view really leaves it", async () => {
    /** One read of the four things a commit moves: address, field (and its caret), grid, chrome. */
    const read = () =>
      js(`
        const params = new URLSearchParams(location.search);
        const field = document.querySelector('input[name="q"]');
        const active = document.activeElement;
        return {
          search: location.search,
          q: params.get("q"),
          count: document.querySelectorAll(".card-cell .card").length,
          field: field ? field.value : "",
          focused: !!field && active === field,
          active: active ? active.tagName + "." + (active.className || "") : "none",
          busy: document.querySelector(".catalog [aria-busy='true']") !== null,
          crumb: (document.querySelector(".crumb") || {}).textContent || "",
        };
      `);

    /** A poll that throws with the whole read it last saw, never a bare timeout (T-53). */
    const until = async (label, check, timeout = 12000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await read();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(`${label} — read ${JSON.stringify(last)}`);
    };

    // 1. A fresh catalog, and a word taken from its own first card so the search is real.
    await go(CATALOG_PATH);
    const full = await until("the catalog to draw its first page", (s) => !s.busy && s.count > 0 && s.q === null);
    const firstTitle = await js(`const el = document.querySelector(".card-cell .card .card-title"); return el ? el.textContent.trim() : "";`);
    const word =
      firstTitle
        .split(/\s+/)
        .filter((part) => part.replace(/[^A-Za-z0-9]/g, "").length >= 5)
        .sort((a, b) => b.length - a.length)[0] || firstTitle;
    if (!word) throw new Error(`the catalog's first card draws no title — the row has nothing to type`);

    // 2. The commit is silent: the URL carries the word and the **field still has the caret**. A
    //    `navigate()` here would remount the page and hand the reader a new input mid-typing, so
    //    focus is the assertion, not a nicety.
    await retype('input[name="q"]', word);
    const narrowed = await until(`the settle to commit q=${JSON.stringify(word)}`, (s) => s.q === word && !s.busy);
    if (narrowed.count === 0 || narrowed.count >= full.count) {
      throw new Error(`?q=${word} draws ${narrowed.count} card(s) of the ${full.count} the bare catalog draws — the word came from the first card's own title, so it must narrow the grid and keep that card`);
    }
    if (!narrowed.focused) {
      throw new Error(
        `the search field lost the caret the moment it settled (document.activeElement is ${narrowed.active}, the field reads ${JSON.stringify(narrowed.field)}, URL ${JSON.stringify(narrowed.search)}) — a query write that emits remounts the page mid-typing, so the commit has to stay silent`,
      );
    }

    // 3. The switcher's own tab, pressed on the catalog it is already on. This is the bug T-66
    //    fixed: without a mounted key that follows the commit, `navigate(/character/catalog)` asks
    //    for the key the shell already believed it had, nothing reloads, the URL drops the query and
    //    the grid keeps the filter.
    await click("Characters", { exact: true, scope: ".cat-switch a" });
    const leftBySwitch = await until(
      "the Characters tab to leave the narrowed view (search cleared, grid unfiltered)",
      (s) => s.search === "" && s.q === null && !s.busy && s.count === full.count,
    );
    if (leftBySwitch.field !== "") {
      throw new Error(`after the switcher's Characters tab the field still holds ${JSON.stringify(leftBySwitch.field)} — the URL cleared but the page did not remount, so the view and the address disagree`);
    }

    // 4. The bottom bar's Catalog tab in a narrowed state — the second shape of the same press.
    await retype('input[name="q"]', word);
    const reNarrowed = await until(`the second settle to commit q=${JSON.stringify(word)}`, (s) => s.q === word && !s.busy && s.count === narrowed.count);
    await click("Catalog", { exact: true, scope: ".tabbar a" });
    const leftByTab = await until(
      "the bottom bar's Catalog tab to leave the narrowed view",
      (s) => s.search === "" && s.q === null && !s.busy && s.count === full.count,
    );
    if (leftByTab.field !== "") {
      throw new Error(`after the Catalog tab the field still holds ${JSON.stringify(leftByTab.field)} on ${JSON.stringify(leftByTab.search)} — a page's silent query write left the router's mounted key behind`);
    }
    if (!leftByTab.crumb.endsWith(CATALOG_PATH)) {
      throw new Error(`the shell's crumb reads ${JSON.stringify(leftByTab.crumb)} after the tab press, not ${CATALOG_PATH} — the tab landed somewhere else`);
    }

    return `typing ${JSON.stringify(word)} committed ${JSON.stringify(narrowed.search)} with ${narrowed.count} of ${full.count} card(s) and **kept the caret in the field** (activeElement ${narrowed.active}) · the switcher's Characters tab cleared the query, the field and the grid (${leftBySwitch.count} card(s), ${JSON.stringify(leftBySwitch.search)}) · a second settle (${JSON.stringify(reNarrowed.search)}) then the bottom bar's Catalog tab did the same (${leftByTab.count} card(s), ${JSON.stringify(leftByTab.search)}, crumb ${JSON.stringify(leftByTab.crumb.trim())})`;
  }),
);

/* ------------------------------------------------------------------------------------------------
 * T-67 — the saved page's **tabs are the query** (`bookmarks.md` → *URL*: type, search and sort all
 * live in the query string). T-66 changed seven pages' query writes in one commit and walked **one**
 * of them; `/bookmarks` is the only page whose *tab* write is a `push` and whose *search* write is a
 * `replace`, so a regression in its tab press was invisible to all 49 rows.
 *
 * Eight steps, each the shape of the next one's failure:
 *  1. a fresh `/bookmarks` writes its own `?type=` on boot (the default tab is the most recently
 *     saved kind, and the spec's counts are saved rows) — the strip carries four counts;
 *  2. a tab press is a **push** to the page's own route with a different query;
 *  3. `?type=` pasted by address mounts that tab directly (the shareable half);
 *  4. the sort is a `push` and Title A–Z really orders the list by title; Back is the proof;
 *  5. the search commits **silently and keeps the caret** — row 49's clause on this page;
 *  6. a mount from the URL the page wrote **before** the search must remount it: the mounted-key
 *     seam (T-66), and the one clause a missing key move turns red;
 *  7. a sort pressed *under a search* keeps the search, and Back returns it with the field holding
 *     the word (the URL is the state, not the component);
 *  8. the tab you are already on is a press too: it clears the search and rewrites the URL;
 *  9. the toolbar at the two widths its own stylesheet draws it for (T-79): `640×740` is the `sm`
 *     two-column rewrite (search across, sort in its 220px column with the saved count beside it),
 *     `360×740` is the base block (one track, the three children stacked).
 *
 * Read-only: types, presses tabs, the sort select and Back, and measures two widths. No store row,
 * no preference.
 * ---------------------------------------------------------------------------------------------- */
const BOOKMARKS_PATH = "/bookmarks";
/** The four types with the label the strip draws — the spec's own tab order (`bookmarks.md`). */
const SAVED_TABS = [
  { type: "character", label: "Characters" },
  { type: "lorebook", label: "Lorebooks" },
  { type: "preset", label: "Presets" },
  { type: "post", label: "Posts" },
];
const labelOfType = (type) => (SAVED_TABS.find((tab) => tab.type === type) || {}).label || "";

results.push(
  await journey("the saved page's tabs are the query: a push per tab, a silent search, and Back restores both", async () => {
    /** One read of everything these eight steps assert: the URL, the strip, the field, the grid. */
    const read = () =>
      js(`
        const params = new URLSearchParams(location.search);
        const text = (el) => (el ? String(el.textContent || "").trim() : "");
        const labelOf = (el) => {
          const first = el.childNodes[0];
          return String(first && first.nodeType === 3 ? first.textContent : el.textContent || "").trim();
        };
        const tabs = [...document.querySelectorAll(${JSON.stringify(TAB_SCOPE)})];
        const cells = [...document.querySelectorAll(".card-cell")];
        const field = document.querySelector('input[name="q"]');
        const select = document.querySelector('select[name="sort"]');
        const grid = document.querySelector(".card-grid");
        const active = document.activeElement;
        return {
          search: location.search,
          type: params.get("type"),
          q: params.get("q"),
          sort: params.get("sort"),
          labels: tabs.map(labelOf),
          counts: tabs.map((el) => {
            const badge = el.querySelector(".tab-count");
            return badge ? Number(String(badge.textContent || "").trim()) : NaN;
          }),
          selected: tabs.filter((el) => el.getAttribute("aria-selected") === "true").map(labelOf),
          grid: grid ? String(grid.getAttribute("aria-label") || "") : "",
          count: cells.length,
          titles: cells.map((cell) => text(cell.querySelector(".card-title"))),
          skeletons: document.querySelectorAll(".skel-card").length,
          busy: document.querySelector(".bookmarks [aria-busy='true']") !== null,
          field: field ? field.value : "",
          focused: !!field && active === field,
          active: active ? active.tagName + "." + (active.className || "") : "none",
          sortValue: select ? select.value : "",
          sortLabel: select && select.selectedOptions[0] ? text(select.selectedOptions[0]) : "",
          empty: text(document.querySelector(".empty-copy")),
        };
      `);

    /** A poll that always throws with the whole read it last saw, never a bare timeout (T-53). */
    const until = async (label, check, timeout = 12000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await read();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(`${label} — read ${JSON.stringify(last)}`);
    };

    const settled = (s) => !s.busy && s.skeletons === 0;
    const ascending = (values) => values.every((value, i) => i === 0 || values[i - 1].localeCompare(value) <= 0);
    const sameTitles = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    // 1. A fresh mount: the page writes its own `?type=` on boot (it writes `type` unconditionally,
    //    so the bare route is rewritten to the default tab — a fact to read, not to pin) and every
    //    tab carries its saved count.
    await go(BOOKMARKS_PATH);
    const opened = await until(
      "the saved page to draw its default tab",
      (s) => settled(s) && s.labels.length === 4 && (s.count > 0 || s.empty !== ""),
    );
    if (opened.labels.length !== 4 || JSON.stringify(opened.labels) !== JSON.stringify(SAVED_TABS.map((tab) => tab.label))) {
      throw new Error(`the strip reads ${JSON.stringify(opened.labels)}, not ${JSON.stringify(SAVED_TABS.map((tab) => tab.label))} — four tabs, the spec's own order`);
    }
    if (opened.counts.some((n) => !Number.isFinite(n))) {
      throw new Error(`the strip's counts read ${JSON.stringify(opened.counts)} — every tab carries its saved count, even the one you are not on`);
    }
    if (!labelOfType(opened.type)) {
      throw new Error(`a fresh ${BOOKMARKS_PATH} opens reading ${JSON.stringify(opened.search)} — the page writes its own ?type= on boot (writeQuery), so the address names one of the four types`);
    }
    if (opened.selected.length !== 1 || opened.selected[0] !== labelOfType(opened.type)) {
      throw new Error(`the strip marks ${JSON.stringify(opened.selected)} selected on ${JSON.stringify(opened.search)} — the tab and the URL are the same fact`);
    }
    if (opened.field !== "" || opened.q !== null || opened.sort !== null) {
      throw new Error(`a fresh ${BOOKMARKS_PATH} opens with ${JSON.stringify([opened.field, opened.q, opened.sort])} — no search, no sort, an empty field`);
    }
    if (opened.count === 0) {
      throw new Error(`the default tab ${JSON.stringify(opened.type)} draws no saved row (read ${JSON.stringify(opened)}) — the row needs rows to read: the fixture saves three characters, one of them dead`);
    }

    // 2. The tab press: the page's own route with a different query, and a **push**. The target is
    //    the card tab with the most saved rows (a saved post draws `PostCard`, which has no
    //    `.card-title`), so the row never pins which tab this page opens on.
    const target = SAVED_TABS.filter((tab) => tab.type !== "post" && tab.type !== opened.type)
      .map((tab) => ({ ...tab, saved: opened.counts[opened.labels.indexOf(tab.label)] }))
      .sort((a, b) => b.saved - a.saved)[0];
    if (!target || !Number.isFinite(target.saved) || target.saved < 1) {
      throw new Error(`the other card tabs read ${JSON.stringify(opened.counts)} saved row(s) — the row needs a tab with rows to press`);
    }

    await click(target.label, { scope: TAB_SCOPE });
    const pressed = await until(
      `the ${target.label} tab to mount at ?type=${target.type}`,
      (s) => s.type === target.type && settled(s) && s.count > 0 && s.selected[0] === target.label,
    );
    if (pressed.grid !== `Saved ${target.type}s`) {
      throw new Error(`?type=${target.type} draws the grid labelled ${JSON.stringify(pressed.grid)}, not ${JSON.stringify(`Saved ${target.type}s`)} — the tab selects the type's own catalog`);
    }
    if (sameTitles(pressed.titles, opened.titles)) {
      throw new Error(`?type=${target.type} draws the same rows as the ${JSON.stringify(opened.type)} tab (${JSON.stringify(pressed.titles)}) — the tab is the type, and the type is the listing`);
    }
    if (pressed.field !== "" || pressed.q !== null) {
      throw new Error(`the ${target.label} press left ${JSON.stringify([pressed.field, pressed.q])} — a tab press carries no search of its own`);
    }

    // 3. The reverse half: the URL the press wrote, pasted by address, mounts that tab directly.
    await go(`${BOOKMARKS_PATH}?type=${target.type}`);
    const mounted = await until(
      `a mount from ?type=${target.type} to draw that tab`,
      (s) => s.type === target.type && settled(s) && s.field === "" && s.count === pressed.count,
    );
    if (!sameTitles(mounted.titles, pressed.titles)) {
      throw new Error(`a mount from ?type=${target.type} draws ${JSON.stringify(mounted.titles)}, not the ${JSON.stringify(pressed.titles)} the pressed tab drew — one URL, two listings`);
    }
    if (mounted.selected[0] !== target.label) {
      throw new Error(`a mount from ?type=${target.type} marks ${JSON.stringify(mounted.selected)} selected, not ${JSON.stringify(target.label)}`);
    }
    if (mounted.count < 2) {
      throw new Error(`?type=${target.type} draws ${mounted.count} saved row(s) — the sort half needs two to reorder, and the row refuses to prove nothing`);
    }

    // 4. The sort is a `push` and Title A–Z orders by title. It never changes how many rows match.
    await choose('select[name="sort"]', "name");
    const byName = await until(
      "the Title A–Z sort to reach the URL and reorder the list",
      (s) => s.sort === "name" && settled(s) && s.count === mounted.count,
    );
    if (byName.sortLabel !== "Title A–Z") {
      throw new Error(`?sort=name leaves the control reading ${JSON.stringify(byName.sortLabel)} — the select prints the state, it does not own it`);
    }
    if (!ascending(byName.titles)) {
      throw new Error(`?sort=name draws ${JSON.stringify(byName.titles)} — a Title A–Z sort orders the rows by their own title`);
    }

    await js(`history.back(); return true;`);
    const backToTab = await until(
      "Back to return the unsorted tab",
      (s) => s.sort === null && settled(s) && s.count === mounted.count && s.sortValue === "recent" && s.q === null,
    );
    if (!sameTitles(backToTab.titles, mounted.titles)) {
      throw new Error(`Back landed on ${JSON.stringify(backToTab.titles)}, not the ${JSON.stringify(mounted.titles)} the tab drew before the sort — a sort is a history entry, and Back undoes it`);
    }

    // 5. The search is a **replace**, silent, and the caret stays: a `navigate()` here would remount
    //    the page mid-typing and hand the reader a new field (row 49's clause, this page's write).
    const word = mounted.titles[0]
      .split(/\s+/)
      .filter((part) => part.replace(/[^A-Za-z0-9]/g, "").length >= 5)
      .sort((a, b) => b.length - a.length)[0] || mounted.titles[0];
    if (!word) throw new Error(`?type=${target.type} draws a row with no title (read ${JSON.stringify(mounted.titles)})`);

    await retype('input[name="q"]', word);
    const narrowed = await until(`the settle to commit q=${JSON.stringify(word)}`, (s) => s.q === word && settled(s));
    if (narrowed.count === 0 || narrowed.count >= mounted.count) {
      throw new Error(`?q=${word} draws ${narrowed.count} of the ${mounted.count} row(s) the tab draws — the word came from a row's own title, so it must narrow the listing and keep that row`);
    }
    if (narrowed.type !== target.type) {
      throw new Error(`the search moved the tab to ${JSON.stringify(narrowed.type)} (read ${JSON.stringify(narrowed.search)}) — a search narrows the tab it is on`);
    }
    if (!narrowed.focused) {
      throw new Error(
        `the search field lost the caret the moment it settled (document.activeElement is ${narrowed.active}, the field reads ${JSON.stringify(narrowed.field)}, URL ${JSON.stringify(narrowed.search)}) — a query write that emits remounts the page mid-typing, so the commit has to stay silent`,
      );
    }

    // 6. The mounted-key seam. `?type=<x>` is the URL this page itself wrote **before** the search,
    //    so the router must not believe it is still there: without a key that follows the commit,
    //    this navigation is a no-op that rewrites the address and leaves the narrowed DOM behind.
    await go(`${BOOKMARKS_PATH}?type=${target.type}`);
    const reopened = await until(
      `a mount from ?type=${target.type} (the URL the page wrote before the search) to remount the whole tab`,
      (s) => s.type === target.type && settled(s) && s.q === null && s.field === "" && s.count === mounted.count,
    );
    if (!sameTitles(reopened.titles, mounted.titles)) {
      throw new Error(`?type=${target.type} remounts to ${JSON.stringify(reopened.titles)}, not the ${JSON.stringify(mounted.titles)} the tab holds — the URL is the state`);
    }

    // 7. A sort pressed under a search keeps the search (it is a `push`), so Back returns the
    //    **searched** view with the field holding the word — the page reads `?q=` at mount.
    await retype('input[name="q"]', word);
    const again = await until(`the second settle to commit q=${JSON.stringify(word)}`, (s) => s.q === word && settled(s) && s.count === narrowed.count);
    await choose('select[name="sort"]', "name");
    const sortedUnderSearch = await until(
      "the sort to reach the URL without dropping the search",
      (s) => s.sort === "name" && s.q === word && settled(s) && s.count === again.count,
    );
    await js(`history.back(); return true;`);
    const backToSearch = await until(
      `Back to return the searched view with the field holding ${JSON.stringify(word)}`,
      (s) => s.sort === null && s.q === word && settled(s) && s.field === word && s.count === again.count,
    );

    // 8. The tab you are already on is a press too: it means *this tab, unfiltered*, which is the
    //    only road back to the whole tab once a search narrows it. A `push`, through `commitQuery()`.
    await click(target.label, { scope: TAB_SCOPE });
    const leftByTab = await until(
      `the ${target.label} tab, pressed while it is already selected, to clear the search`,
      (s) => s.type === target.type && s.q === null && settled(s) && s.field === "" && s.count === mounted.count,
    );
    if (leftByTab.selected.length !== 1 || leftByTab.selected[0] !== target.label) {
      throw new Error(`after the press the strip marks ${JSON.stringify(leftByTab.selected)} selected, not ${JSON.stringify(target.label)} — the tab that leaves a narrowed view is the tab it is on`);
    }

    // 9. The toolbar at the two widths its stylesheet draws it for (T-79). `bookmarks.tsrx`'s
    //    `sm 640` block rewrites `.toolbar` from one column into `minmax(0, 1fr) 220px`, pins the
    //    search across the top and puts the sort in the fixed column with the saved count beside it
    //    on row 2 — and every earlier row mounts this page at the session's own ~500px, below the
    //    breakpoint, so the three pins were declarations nothing could go red on. Both widths are
    //    read, because one direction cannot show a breakpoint (T-77/T-78).
    const readToolbar = () =>
      js(`
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const round = (n) => Math.round(n * 100) / 100;
          return { top: round(r.top), left: round(r.left), right: round(r.right), bottom: round(r.bottom), width: round(r.width), height: round(r.height) };
        };
        const bar = document.querySelector(".toolbar");
        const bs = bar ? getComputedStyle(bar) : null;
        const isGrid = !!bs && bs.display.indexOf("grid") >= 0;
        const metaEl = document.querySelector(".toolbar > .meta");
        const select = document.querySelector('select[name="sort"]');
        const pagerBox = document.querySelector(".pager > div");
        return {
          path: location.pathname,
          search: location.search,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          display: bs ? bs.display : "",
          tracks: isGrid ? bs.gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : [],
          gap: bs ? bs.gap : "",
          toolbar: box(bar),
          field: box(document.querySelector(".toolbar > .search")),
          sort: box(document.querySelector(".toolbar > .sort")),
          meta: box(metaEl),
          metaAlign: metaEl ? getComputedStyle(metaEl).alignSelf : "",
          saved: metaEl ? String(metaEl.textContent || "").trim() : "",
          sortValue: select ? select.value : "",
          pagerMinWidth: pagerBox ? getComputedStyle(pagerBox).minWidth : "",
        };
      `);

    const assertToolbar = (r, width) => {
      const at = `${BOOKMARKS_PATH} at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!r.path.endsWith(BOOKMARKS_PATH)) {
        throw new Error(`${at}: the toolbar was measured on ${JSON.stringify(r.path)}, not the saved page`);
      }
      if (r.display.indexOf("grid") < 0) {
        throw new Error(`${at}: .toolbar computes ${JSON.stringify(r.display)}, not the grid both of its blocks declare`);
      }
      if (!r.toolbar || !r.field || !r.sort || !r.meta) {
        throw new Error(
          `${at}: the toolbar is incomplete — toolbar ${JSON.stringify(r.toolbar)}, search ${JSON.stringify(r.field)}, sort ${JSON.stringify(r.sort)}, meta ${JSON.stringify(r.meta)}`,
        );
      }
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the saved page scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }

      if (width === 640) {
        // The whole `sm` fact: two tracks, the second the sort's fixed column. The count alone is
        // not proof — a leftover placement creates an implicit track (T-77) — so it is sized too.
        if (r.tracks.length !== 2) {
          throw new Error(
            `${at}: .toolbar resolves ${r.tracks.length} track(s) ${JSON.stringify(r.tracks)}, not the two the sm block declares (fluid | 220px)`,
          );
        }
        if (Math.abs(parseFloat(r.tracks[1]) - 220) > 1) {
          throw new Error(`${at}: the toolbar's second track resolves to ${JSON.stringify(r.tracks[1])}, not the 220px sort column the sm block declares (tracks ${JSON.stringify(r.tracks)})`);
        }
        // The search spans the toolbar, which is the top row.
        if (Math.abs(r.field.left - r.toolbar.left) > 1 || Math.abs(r.field.right - r.toolbar.right) > 1) {
          throw new Error(
            `${at}: .search spans ${r.field.left}→${r.field.right} in a toolbar ${r.toolbar.left}→${r.toolbar.right} — the sm block puts it across both columns (grid-column 1 / -1)`,
          );
        }
        if (!(r.sort.top > r.field.bottom - 1)) {
          throw new Error(`${at}: .sort sits at top ${r.sort.top} above the search's bottom ${r.field.bottom} — the search owns row 1 and the sort row 2`);
        }
        // Beside: the sort and the saved count share row 2, bottom-aligned by `align-items: end`.
        if (Math.abs(r.sort.bottom - r.meta.bottom) > 2) {
          throw new Error(
            `${at}: .sort ends at ${r.sort.bottom} and .meta at ${r.meta.bottom} — the sm block puts them on one row (grid-row: 2), so the saved count sits beside the sort, not under it`,
          );
        }
        if (!(r.meta.left < r.sort.left - 1)) {
          throw new Error(`${at}: .meta starts at ${r.meta.left}, not left of the sort at ${r.sort.left} — the count is the row-2 visitor, the sort the fixed column`);
        }
        if (!(r.sort.left >= r.toolbar.right - 220 - 16 - 1)) {
          throw new Error(
            `${at}: .sort starts at ${r.sort.left} in a toolbar ending at ${r.toolbar.right} — inside the 220px column and its 16px gap, not before it`,
          );
        }
        // `.pager` draws only while the listing has a next page, so a min-width is read when the box
        // exists and never asserted into being.
        if (r.pagerMinWidth !== "" && r.pagerMinWidth !== "200px") {
          throw new Error(`${at}: the pager's inner box computes min-width ${JSON.stringify(r.pagerMinWidth)}, not the 200px the sm block gives it`);
        }
        return;
      }

      // The opposite, in the same words: the base block is still the phone's, one implicit track
      // and the three children stacked in DOM order.
      if (r.tracks.length !== 1) {
        throw new Error(
          `${at}: .toolbar resolves ${r.tracks.length} track(s) ${JSON.stringify(r.tracks)}, not the one the base block leaves (no grid-template-columns) — the sm block is leaking below its breakpoint`,
        );
      }
      if (!(r.sort.top > r.field.bottom - 1)) {
        throw new Error(`${at}: .sort sits at top ${r.sort.top} over the search's bottom ${r.field.bottom} — below 640 the sort takes its own row`);
      }
      if (!(r.meta.top > r.sort.bottom - 1)) {
        throw new Error(`${at}: .meta sits at top ${r.meta.top} over the sort's bottom ${r.sort.bottom} — below 640 the count takes a third row`);
      }
    };

    const barRestore = await js("return window.innerWidth;");
    const barLines = [];
    let barSeen = "";
    try {
      // One override per width. The `Emulation` override is browser-level and this page does not
      // remount on a width change, so every reading asserts `innerWidth` instead of assuming it held.
      for (const width of [640, 360]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        await waitFor(`document.querySelector(".toolbar > .sort") !== null`, `the saved toolbar at ${width}px`, 10000);
        const bar = await readToolbar();
        assertToolbar(bar, width);
        barLines.push(
          `${width}px: .toolbar ${JSON.stringify(bar.display)} gap ${bar.gap} → ${JSON.stringify(bar.tracks)} (${bar.tracks.length} track(s), state ${JSON.stringify(bar.search)}) · search ${bar.field.left}→${bar.field.right} in ${bar.toolbar.left}→${bar.toolbar.right}, bottom ${bar.field.bottom} · sort ${bar.sort.left}→${bar.sort.right} top ${bar.sort.top} bottom ${bar.sort.bottom} · meta ${bar.meta.left}→${bar.meta.right} top ${bar.meta.top} bottom ${bar.meta.bottom} (align ${bar.metaAlign}, ${JSON.stringify(bar.saved)}${bar.pagerMinWidth ? `, pager min-width ${bar.pagerMinWidth}` : ", no pager"})`,
        );
      }
      barSeen = barLines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const barAfter = await js("return window.innerWidth;");
    if (barAfter !== barRestore) {
      throw new Error(`the toolbar's overrides cleared to ${barAfter}px, but the session runs at ${barRestore}px — a leaked override would mis-measure every later row`);
    }

    return `a fresh ${BOOKMARKS_PATH} writes ${JSON.stringify(opened.search)} (the default tab ${JSON.stringify(opened.type)}, counts ${JSON.stringify(opened.counts)}) · pressing ${JSON.stringify(target.label)} pushed ${JSON.stringify(pressed.search)} and drew ${pressed.count} row(s) of ${JSON.stringify(pressed.grid)} · a mount from ?type=${target.type} draws the same ${JSON.stringify(mounted.titles)} · ?sort=name reads ${JSON.stringify(byName.sortLabel)} at ${JSON.stringify(byName.search)} with the titles ${JSON.stringify(byName.titles)} ascending, and Back returns ${JSON.stringify(backToTab.search)} with ${backToTab.count} row(s) · typing ${JSON.stringify(word)} committed ${JSON.stringify(narrowed.search)} with ${narrowed.count} of ${mounted.count} row(s) and **kept the caret** (activeElement ${narrowed.active}) · a mount from ?type=${target.type} remounted the whole tab (${reopened.count} row(s), field ${JSON.stringify(reopened.field)}) · a sort under the search reads ${JSON.stringify(sortedUnderSearch.search)} and Back returns ${JSON.stringify(backToSearch.search)} with the field holding ${JSON.stringify(backToSearch.field)} · the ${target.label} tab, pressed on itself, cleared the search to ${JSON.stringify(leftByTab.search)} with ${leftByTab.count} row(s) and an empty field · the toolbar at ${barSeen}`;
  }),
);

/**
 * The three pages T-66 moved onto `commitQuery()` that no row had ever typed into (T-68).
 *
 * The two catalogues are one toolbar over another entity and write `?q=&tags=&sort=`; `/persona`
 * writes `?q=&sort=` only and draws `.persona-card` rows instead of catalogue cards. Each descriptor
 * carries the **page's own** selectors and labels, so a red names the page it was reading.
 *
 * Since T-81 the row also reads **`/persona`'s `.toolbar` at 640, 900 and 360** — two media blocks
 * govern that box (a two-track `sm` grid with the search across it, then a three-track `lg` one with
 * a fixed 200px sort column), and every earlier row mounted the page at ~500px where neither is
 * live. It is a read: no press, no store row, and every override clears in one `finally`.
 */
const TOOLBAR_PAGES = [
  { path: "/lorebook/catalog", owner: "catalog", grid: "Lorebooks", emptyCatalog: "No lorebooks yet." },
  { path: "/preset/catalog", owner: "catalog", grid: "Presets", emptyCatalog: "No presets yet." },
  { path: "/persona", owner: "personas", grid: "Your personas", emptyCatalog: "" },
];

results.push(
  await journey("the other three toolbars: a search that keeps the caret, a tag that reaches the listing, a sort that names itself", async () => {
    /** One read of everything the three passes assert, whichever of the three pages is mounted. */
    const read = () =>
      js(`
        const params = new URLSearchParams(location.search);
        const text = (el) => (el ? String(el.textContent || "").replace(/\\s+/g, " ").trim() : "");
        const cards = [...document.querySelectorAll(".card-cell .card")];
        const personas = [...document.querySelectorAll(".persona-card")];
        const field = document.querySelector('input[name="q"]');
        const select = document.querySelector('select[name="sort"]');
        const grid = document.querySelector(".card-grid[aria-label]");
        const active = document.activeElement;
        return {
          search: location.search,
          q: params.get("q"),
          tags: params.get("tags"),
          sort: params.get("sort"),
          owner: document.querySelector(".personas-page") ? "personas" : document.querySelector(".catalog") ? "catalog" : "other",
          grid: grid ? String(grid.getAttribute("aria-label") || "") : "",
          count: cards.length,
          titles: cards.map((card) => text(card.querySelector(".card-title"))),
          personas: personas.length,
          names: personas.map((card) => text(card.querySelector(".persona-card-name"))),
          tagSets: cards.map((card) => [...card.querySelectorAll(".card-tags.is-measure .card-tag")].map(text)),
          chips: [...document.querySelectorAll(".tagpicker .tag-chip-text")].map(text),
          field: field ? field.value : "",
          focused: !!field && active === field,
          active: active ? active.tagName + "." + (active.className || "") : "none",
          sortValue: select ? select.value : "",
          sortLabel: select && select.selectedOptions[0] ? text(select.selectedOptions[0]) : "",
          skeletons: document.querySelectorAll(".skel-card").length,
          noResults: text(document.querySelector(".no-results")),
          empty: text(document.querySelector(".empty-copy")),
          actions: [...document.querySelectorAll(".personas-page button, .personas-page a, .empty button, .empty a")].map((el) => text(el)),
        };
      `);

    /** A poll that always names the page it was on and the whole read it last saw (T-53). */
    const until = async (path, label, check, timeout = 12000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await read();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(`${path}: ${label} — read ${JSON.stringify(last)}`);
    };

    /** A page's drawn rows and their count, in whichever shape it draws them. */
    const rowsOf = (page, s) => (page.owner === "personas" ? s.names : s.titles);
    const countOf = (page, s) => (page.owner === "personas" ? s.personas : s.count);

    /** The word to type: the longest in a row's own name, so the row that named it must survive. */
    const longestWord = (label, min) => {
      const parts = String(label)
        .split(/\s+/)
        .filter((part) => part.replace(/[^A-Za-z0-9]/g, "").length >= min);
      return parts.sort((a, b) => b.length - a.length)[0] || String(label);
    };

    /** A fresh mount of one of the three pages: its own toolbar, its own listing, nothing set. */
    const freshPage = async (page) => {
      await go(page.path);
      const state = await until(
        page.path,
        "the page to draw its toolbar and its first rows",
        (s) => s.owner === page.owner && s.skeletons === 0 && countOf(page, s) > 0,
      );
      if (state.grid !== page.grid) {
        throw new Error(
          `${page.path}: the grid is labelled ${JSON.stringify(state.grid)}, not ${JSON.stringify(page.grid)} — the row has to be reading this page's own listing, not a skeleton or another page`,
        );
      }
      if (state.q !== null || state.tags !== null || state.sort !== null) {
        throw new Error(
          `${page.path} opens on ${JSON.stringify(state.search)} — the search, the tags and the sort are the reader's, so not one of them starts set`,
        );
      }
      if (state.field !== "") throw new Error(`${page.path} opens with the search field holding ${JSON.stringify(state.field)}, not an empty one`);
      if (state.sortValue !== "newest" || state.sortLabel !== "Newest") {
        throw new Error(`${page.path}'s sort control opens reading ${JSON.stringify([state.sortValue, state.sortLabel])}, not newest / Newest`);
      }
      return state;
    };

    // 1. The search: one word from a row's own name, committed silently, and the caret stays. The
    //    URL it writes is the state — a mount from it preloads the field and draws the same rows.
    const searchPass = async (page, full) => {
      const first = rowsOf(page, full)[0] || "";
      if (!first) {
        throw new Error(`${page.path}: its first row draws no name (read ${JSON.stringify(rowsOf(page, full))}) — the word has to come from a row that exists`);
      }
      const word = longestWord(first, page.owner === "personas" ? 4 : 5);
      await retype('input[name="q"]', word);
      const narrowed = await until(page.path, `the settle to commit q=${JSON.stringify(word)}`, (s) => s.q === word && s.skeletons === 0);
      const count = countOf(page, narrowed);
      if (count === 0 || count > countOf(page, full)) {
        throw new Error(
          `${page.path}: ?q=${word} draws ${count} of the ${countOf(page, full)} row(s) the page draws unfiltered — the word came from a row's own name, so that row has to survive its own search`,
        );
      }
      if (page.owner !== "personas" && count >= countOf(page, full)) {
        throw new Error(`${page.path}: ?q=${word} draws all ${count} row(s) — the search has to narrow the listing, and this word is on every row`);
      }
      if (!rowsOf(page, narrowed).some((label) => label.includes(word))) {
        throw new Error(
          `${page.path}: ?q=${word} drops ${JSON.stringify(first)} (read ${JSON.stringify(rowsOf(page, narrowed))}) — the row whose own name the word came from must survive its own search`,
        );
      }
      if (!narrowed.focused) {
        throw new Error(
          `${page.path}: the search field lost the caret the moment it settled (document.activeElement is ${narrowed.active}, the field reads ${JSON.stringify(narrowed.field)}, URL ${JSON.stringify(narrowed.search)}) — a query write that emits remounts the page mid-typing, so the commit has to stay silent and go through commitQuery()`,
        );
      }
      await go(`${page.path}?q=${encodeURIComponent(word)}`);
      const restored = await until(
        page.path,
        `a mount from ?q=${word} to preload the field and draw the same rows`,
        (s) => s.q === word && s.field === word && s.skeletons === 0,
      );
      if (JSON.stringify(rowsOf(page, restored)) !== JSON.stringify(rowsOf(page, narrowed))) {
        throw new Error(
          `${page.path}: a mount from ?q=${word} draws ${JSON.stringify(rowsOf(page, restored))}, not the ${JSON.stringify(rowsOf(page, narrowed))} the typed query drew — one query, two listings`,
        );
      }
      return { word, narrowed, restored, count };
    };

    // 2. The tag field. Its vocabulary is the adapter's `listTags` over the entity's own cards, so a
    //    **chip** can only be pressed when a fixture carries a tag — every lorebook and preset
    //    fixture ships `tags: []` (T-68's find), so both branches are written and the empty one is the
    //    state a reader actually has: the menu says so, and the URL→field→adapter road is still walked
    //    (the chip prints, the listing empties, Clear filters restores it).
    const tagPass = async (page, full) => {
      const frequency = new Map();
      for (const set of full.tagSets) for (const tag of set) frequency.set(tag, (frequency.get(tag) || 0) + 1);
      const rarest = frequency.size > 0 ? [...frequency.entries()].sort((a, b) => a[1] - b[1])[0] : null;

      await freshPage(page);
      await clickSelector(".tagpicker-field");
      await waitFor(
        `document.querySelectorAll(".tagpicker-option").length > 0 || document.querySelectorAll(".tagpicker-empty").length > 0`,
        `${page.path}: the tag menu to open`,
        6000,
      );
      const menu = await js(`
        const empty = document.querySelector(".tagpicker-empty");
        return {
          options: [...document.querySelectorAll(".tagpicker-option")].map((o) => (o.textContent || "").trim()),
          empty: empty ? String(empty.textContent || "").trim() : "",
        };
      `);

      if (rarest) {
        const tag = rarest[0];
        const picked = await js(`
          const el = [...document.querySelectorAll(".tagpicker-option")].find((o) => (o.textContent || "").trim() === ${JSON.stringify(tag)});
          if (!el) return false;
          el.scrollIntoView({ block: "center" });
          el.click();
          return true;
        `);
        if (!picked) {
          throw new Error(
            `${page.path}: the tag menu offers ${JSON.stringify(menu.options)} but not ${JSON.stringify(tag)} — the picker's vocabulary is the adapter's listTags, and this tag came off a card the page draws`,
          );
        }
        const tagged = await until(page.path, `the ${JSON.stringify(tag)} chip to reach the URL`, (s) => s.tags === tag && s.skeletons === 0);
        const count = countOf(page, tagged);
        if (JSON.stringify(tagged.chips) !== JSON.stringify([tag])) {
          throw new Error(`${page.path}: the tag field reads ${JSON.stringify(tagged.chips)} on ?tags=${tag}, not one chip holding it — the field prints what the URL selects`);
        }
        if (count === 0 || count > countOf(page, full)) {
          throw new Error(`${page.path}: ?tags=${tag} draws ${count} of the ${countOf(page, full)} row(s) the unfiltered page draws — a tag filter selects rows, it never invents or drops the page`);
        }
        if (rarest[1] < countOf(page, full) && count >= countOf(page, full)) {
          throw new Error(
            `${page.path}: ?tags=${tag} draws all ${count} row(s) although only ${rarest[1]} of them carry it — the chip reached the URL but not the adapter's query`,
          );
        }
        const strays = tagged.tagSets.filter((set) => !set.includes(tag)).length;
        if (strays > 0) {
          throw new Error(`${page.path}: ?tags=${tag} drew ${strays} of ${count} card(s) without it (read ${JSON.stringify(tagged.tagSets)}) — the filter is on each item's own tags`);
        }
        return `the ${JSON.stringify(tag)} chip pushed ${JSON.stringify(tagged.search)} with ${count} card(s), every one carrying it`;
      }

      // No card draws a tag: the menu must say so rather than invent a vocabulary of its own.
      if (menu.options.length > 0) {
        throw new Error(`${page.path}: the picker offers ${JSON.stringify(menu.options)} while no card on the page draws a tag — the vocabulary is listTags over the entity's own tags`);
      }
      if (menu.empty === "") {
        throw new Error(`${page.path}: the tag menu opened with neither an option nor its empty sentence (read ${JSON.stringify(menu)}) — an empty menu is a state, not a blank`);
      }
      const tag = "archive";
      await go(`${page.path}?tags=${tag}`);
      const tagged = await until(page.path, `?tags=${tag} to reach the tag field and the adapter`, (s) => s.tags === tag && s.skeletons === 0);
      if (JSON.stringify(tagged.chips) !== JSON.stringify([tag])) {
        throw new Error(`${page.path}: the tag field reads ${JSON.stringify(tagged.chips)} on ?tags=${tag}, not one chip holding it — the field prints what the URL selects`);
      }
      if (countOf(page, tagged) !== 0) {
        throw new Error(`${page.path}: ?tags=${tag} draws ${countOf(page, tagged)} card(s) although no card on this page carries a tag — the tag reached the field but not the adapter's query`);
      }
      if (tagged.empty === "" || tagged.empty === page.emptyCatalog) {
        throw new Error(
          `${page.path}: ?tags=${tag} reads ${JSON.stringify(tagged.empty)} — a query that matches nothing is the filters' state, not the empty ${JSON.stringify(page.emptyCatalog)} catalogue`,
        );
      }
      await click("Clear filters", { exact: true });
      const cleared = await until(
        page.path,
        "Clear filters to drop the tag and restore the whole listing",
        (s) => s.tags === null && s.chips.length === 0 && s.skeletons === 0 && countOf(page, s) === countOf(page, full),
      );
      return `no fixture carries a tag, so the picker opens its own empty sentence (${JSON.stringify(menu.empty)}); a pasted ?tags=${tag} prints its chip, draws 0 card(s) with ${JSON.stringify(tagged.empty)}, and Clear filters restores ${JSON.stringify(cleared.search)} with ${countOf(page, cleared)} card(s)`;
    };

    // 3. The sort: the page's own vocabulary (`newest` / `ratio` for the two catalogues, `newest` /
    //    `oldest` / `name` for the personas), and the control's **label** is the state's, not its own.
    const sortPass = async (page, value, label) => {
      await freshPage(page);
      await choose('select[name="sort"]', value);
      const sorted = await until(page.path, `?sort=${value} to reach the URL`, (s) => s.sort === value && s.skeletons === 0);
      if (sorted.sortLabel !== label) {
        throw new Error(`${page.path}: ?sort=${value} leaves the control reading ${JSON.stringify(sorted.sortLabel)}, not ${JSON.stringify(label)} — the select prints the state, it does not own it`);
      }
      if (countOf(page, sorted) === 0) {
        throw new Error(`${page.path}: ?sort=${value} draws no row (read ${JSON.stringify(sorted.search)}) — a sort reorders, it does not empty the listing`);
      }
      if (value === "name") {
        const names = rowsOf(page, sorted);
        const ascending = names.every((name, i) => i === 0 || names[i - 1].localeCompare(name) <= 0);
        if (!ascending) throw new Error(`${page.path}: ?sort=name draws ${JSON.stringify(names)} — a Name sort orders the rows by their own name`);
      }
      return sorted;
    };

    // A. `/lorebook/catalog` — the full toolbar, and the page most like row 48's own catalogue.
    const lorebook = TOOLBAR_PAGES[0];
    const lorebookFull = await freshPage(lorebook);
    const lorebookSearch = await searchPass(lorebook, lorebookFull);
    const lorebookTag = await tagPass(lorebook, lorebookFull);
    const lorebookSort = await sortPass(lorebook, "ratio", "Top rated");

    // B. `/preset/catalog` — the same three facts in one short pass. If the two toolbars differ, that
    //    is the point of pressing both.
    const preset = TOOLBAR_PAGES[1];
    const presetFull = await freshPage(preset);
    const presetSearch = await searchPass(preset, presetFull);
    const presetTag = await tagPass(preset, presetFull);
    const presetSort = await sortPass(preset, "ratio", "Top rated");

    // C. `/persona` — `?q=&sort=` only, no tag field and no `.catalog` root; its rows are
    //    `.persona-card`s and its loading state is `.skel-card`s inside `.card-cell`s (T-50's lesson:
    //    an absence count on the first frame reads 3). A search that matches nothing is a *state*
    //    with its own sentence — never the failed fetch's Retry.
    const persona = TOOLBAR_PAGES[2];
    const personaFull = await freshPage(persona);
    const personaSearch = await searchPass(persona, personaFull);
    await go(`${persona.path}?q=zzqx-nothing-matches`);
    const personaNone = await until(
      persona.path,
      "the no-match state for a query nothing matches",
      (s) => s.q === "zzqx-nothing-matches" && s.skeletons === 0 && s.personas === 0 && s.noResults !== "",
    );
    const retry = personaNone.actions.filter((label) => label === "Retry" || label === "Try again");
    if (retry.length > 0) {
      throw new Error(`${persona.path}: the no-match state offers ${JSON.stringify(retry)} — nothing failed, the name simply matched nothing (that is the fetch's state, not the search's)`);
    }
    // The sentence's own word break at the link (T-69). A literal's boundary whitespace is trimmed
    // when its neighbour is an element, so `</a> if` rendered `</a>if` — and `includes(" ")` would
    // pass on that copy, so assert both halves of the words and name the run-together string.
    if (!personaNone.noResults.includes("Create one if") || personaNone.noResults.includes("oneif")) {
      throw new Error(
        `${persona.path}: the no-match sentence reads ${JSON.stringify(personaNone.noResults)} — it runs the words either side of the link together (the DOM drops a literal's leading space after </a>; the source needs an explicit {" "})`,
      );
    }
    const personaSort = await sortPass(persona, "name", "Name");

    // D. `/persona`'s toolbar at the three widths its own stylesheet draws it for (T-81). **Two**
    //    blocks govern this box: `sm 640` rewrites `.toolbar` into a two-track grid with the search
    //    pinned across both (`sort` + `create` auto-place on the line beneath it, `.create .btn`
    //    widening from the base `width: 100%` to `width: auto; min-width: 120px`), and `lg 900`
    //    rewrites the same grid to three tracks with the sort in a **fixed** 200px middle column and
    //    `.search` back in column 1. Every earlier row mounts `/persona` at the session's own ~500px,
    //    below both blocks, so each of those declarations was a rule nothing could go red on. 360 is
    //    read as well: a breakpoint is a pair, and the base is the other half (T-77/T-78).
    //
    //    No press follows: the toolbar draws whatever the listing holds (an earlier clause can leave
    //    this page filtered to nothing), so the width phase reads the bar and nothing else.
    const readBar = () =>
      js(`
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const round = (n) => Math.round(n * 100) / 100;
          return { top: round(r.top), left: round(r.left), right: round(r.right), bottom: round(r.bottom), width: round(r.width), height: round(r.height) };
        };
        const bar = document.querySelector(".toolbar");
        const bs = bar ? getComputedStyle(bar) : null;
        const isGrid = !!bs && bs.display.indexOf("grid") >= 0;
        const btn = document.querySelector(".toolbar > .create .btn");
        const bsBtn = btn ? getComputedStyle(btn) : null;
        return {
          path: location.pathname,
          search: location.search,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          personas: document.querySelectorAll(".persona-card").length,
          display: bs ? bs.display : "",
          tracks: isGrid ? bs.gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : [],
          gap: bs ? bs.gap : "",
          toolbar: box(bar),
          field: box(document.querySelector(".toolbar > .search")),
          sort: box(document.querySelector(".toolbar > .sort")),
          create: box(document.querySelector(".toolbar > .create")),
          btn: box(btn),
          btnWidth: bsBtn ? bsBtn.width : "",
          btnMinWidth: bsBtn ? bsBtn.minWidth : "",
        };
      `);

    /** One width's worth of the one box: the declared tracks, then the placement they produce. */
    const assertBar = (r, width) => {
      const at = `${persona.path} at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!String(r.path).endsWith(persona.path)) {
        throw new Error(`${at}: the toolbar was measured on ${JSON.stringify(r.path)}, not the persona page`);
      }
      if (!r.toolbar || !r.field || !r.sort || !r.create || !r.btn) {
        throw new Error(
          `${at}: the toolbar is incomplete — toolbar ${JSON.stringify(r.toolbar)}, search ${JSON.stringify(r.field)}, sort ${JSON.stringify(r.sort)}, create ${JSON.stringify(r.create)}, button ${JSON.stringify(r.btn)}`,
        );
      }
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the persona page scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }

      if (width === 640) {
        // `sm 640`: two equal `minmax(0, 1fr)` tracks — a *fluid pair*, so neither may be sized
        // against a constant (T-77's rule is to size what the block declares, and this block declares
        // equality); the search spans both, so both edges are the bar's.
        if (r.display.indexOf("grid") < 0) {
          throw new Error(`${at}: .toolbar computes ${JSON.stringify(r.display)}, not the grid the sm block declares`);
        }
        if (r.tracks.length !== 2) {
          throw new Error(`${at}: .toolbar resolves ${r.tracks.length} track(s) ${JSON.stringify(r.tracks)}, not the two the sm block declares (minmax(0, 1fr) twice)`);
        }
        const [first, second] = r.tracks.map((track) => parseFloat(track));
        if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) {
          throw new Error(`${at}: the two tracks resolve to ${JSON.stringify(r.tracks)} — both are fluid, so both have to be a real length`);
        }
        if (Math.abs(first - second) > 1) {
          throw new Error(`${at}: the two tracks resolve to ${JSON.stringify(r.tracks)} — the sm block declares a minmax(0, 1fr) pair, so they are equal`);
        }
        if (Math.abs(r.field.left - r.toolbar.left) > 1 || Math.abs(r.field.right - r.toolbar.right) > 1) {
          throw new Error(
            `${at}: .search spans ${r.field.left}→${r.field.right} in a toolbar ${r.toolbar.left}→${r.toolbar.right} — the sm block pins it across both columns (grid-column 1 / span 2)`,
          );
        }
        if (!(r.sort.top > r.field.bottom - 1) || !(r.create.top > r.field.bottom - 1)) {
          throw new Error(
            `${at}: .sort sits at top ${r.sort.top} and .create at ${r.create.top} over the search's bottom ${r.field.bottom} — the field owns row 1 and the pair the line beneath it`,
          );
        }
        // `align-items: end` makes the bottoms the row witness, not the tops (T-79/T-80).
        if (Math.abs(r.sort.bottom - r.create.bottom) > 2) {
          throw new Error(
            `${at}: .sort ends at ${r.sort.bottom} and .create at ${r.create.bottom} — the sm block puts them on one row under the search, bottom-aligned`,
          );
        }
        if (!(r.sort.left < r.create.left)) {
          throw new Error(`${at}: .sort starts at ${r.sort.left} and .create at ${r.create.left} — the sort takes column 1, the button column 2`);
        }
        // The `<a class="btn">` is what the block widens; `.create` is the grid item it sits in.
        if (r.btnMinWidth !== "120px") {
          throw new Error(`${at}: .create .btn computes min-width ${JSON.stringify(r.btnMinWidth)}, not the 120px the sm block gives it`);
        }
        // `width: auto` on a **block-level** flex container is the fill, not the content (T-81's
        // find): the button keeps whatever column it is in — 283px here — exactly as the base
        // `width: 100%` did, so the 120px floor has nothing to bind against at this width. Record the
        // pair rather than assert a 120px box that a right page does not draw; the floor is proved
        // where it can bind, on the `lg` auto track below.
        if (Math.abs(r.btn.width - r.create.width) > 1) {
          throw new Error(
            `${at}: .create .btn measures ${r.btn.width} in a ${r.create.width} column — the sm block widens the button's floor, not its box, so width auto still fills the column`,
          );
        }
        if (r.btn.width < 119) {
          throw new Error(`${at}: .create .btn measures ${r.btn.width}, under the 120px floor the sm block gives it`);
        }
        return;
      }

      if (width === 900) {
        // `lg 900`: three tracks with the sort in a **fixed** 200px middle column, all three children
        // on one line. `align-items: end` still rules here (no later block resets it), so the shared
        // edge is the bottom.
        if (r.display.indexOf("grid") < 0) {
          throw new Error(`${at}: .toolbar computes ${JSON.stringify(r.display)}, not the grid the lg block rewrites`);
        }
        if (r.tracks.length !== 3) {
          throw new Error(`${at}: .toolbar resolves ${r.tracks.length} track(s) ${JSON.stringify(r.tracks)}, not the three the lg block declares (fluid | 200px | auto)`);
        }
        if (Math.abs(parseFloat(r.tracks[1]) - 200) > 1) {
          throw new Error(`${at}: the middle track resolves to ${JSON.stringify(r.tracks[1])}, not the fixed 200px sort column the lg block declares (tracks ${JSON.stringify(r.tracks)})`);
        }
        if (!(r.field.left < r.sort.left) || !(r.sort.left < r.create.left)) {
          throw new Error(
            `${at}: search ${r.field.left}→${r.field.right}, sort ${r.sort.left}→${r.sort.right}, create ${r.create.left}→${r.create.right} — the lg block puts all three on one line, search first`,
          );
        }
        if (Math.abs(r.field.bottom - r.sort.bottom) > 2 || Math.abs(r.sort.bottom - r.create.bottom) > 2) {
          throw new Error(
            `${at}: the three children end at ${JSON.stringify([r.field.bottom, r.sort.bottom, r.create.bottom])} — one line under align-items: end shares a bottom`,
          );
        }
        // The `auto` third track is sized by the button's own floor, so this is the one width where
        // the sm block's 120px `min-width` actually binds (at 640 the 1fr column dwarfs it).
        if (Math.abs(r.btn.width - 120) > 1) {
          throw new Error(
            `${at}: .create .btn measures ${r.btn.width} in the auto column ${JSON.stringify(r.tracks[2])} — the lg block leaves it content-sized, and the sm block's 120px floor is the content`,
          );
        }
        return;
      }

      // 360: the base block — a `flex-direction: column` stack, no grid at all (a flex container's
      // `gridTemplateColumns` computes to the string `none`, T-73), and the button back at 100%.
      if (r.display !== "flex") {
        throw new Error(`${at}: .toolbar computes ${JSON.stringify(r.display)}, not the flex column the base block declares — a sm or lg grid is leaking below 640`);
      }
      if (r.tracks.length !== 0) {
        throw new Error(`${at}: .toolbar resolves ${JSON.stringify(r.tracks)} on a box that is not a grid — the display and the track list have to agree`);
      }
      if (!(r.field.top < r.sort.top) || !(r.sort.top < r.create.top)) {
        throw new Error(
          `${at}: search tops at ${r.field.top}, sort at ${r.sort.top}, create at ${r.create.top} — below 640 the three children stack in DOM order`,
        );
      }
      if (Math.abs(r.btn.width - r.create.width) > 1) {
        throw new Error(`${at}: .create .btn measures ${r.btn.width} in a ${r.create.width} column — the base block stretches it to width: 100%`);
      }
      if (r.btnMinWidth === "120px") {
        throw new Error(`${at}: .create .btn still computes min-width 120px below the breakpoint — that is the sm block's, and it has to clear`);
      }
    };

    await go(persona.path);
    await waitFor(
      `document.querySelector(".toolbar > .create .btn") !== null && document.querySelectorAll(".skel-card").length === 0`,
      `${persona.path}: the toolbar to draw at the session's own width`,
      12000,
    );
    const barRestore = await js("return window.innerWidth;");
    const barLines = [];
    let barSeen = "";
    try {
      // Width-major, one override per width: `go()` remounts the page, the `Emulation` override is
      // browser-level, and the toolbar re-lays-out in place, so each reading asserts `innerWidth`
      // rather than assuming the override took (the session's own tab is ~500px).
      for (const width of [640, 900, 360]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        const bar = await readBar();
        assertBar(bar, width);
        barLines.push(
          `${width}px: .toolbar ${JSON.stringify(bar.display)} gap ${bar.gap} → ${JSON.stringify(bar.tracks)} (${bar.tracks.length} track(s), ${bar.personas} persona card(s)) · search ${bar.field.left}→${bar.field.right} in ${bar.toolbar.left}→${bar.toolbar.right} top ${bar.field.top} bottom ${bar.field.bottom} · sort ${bar.sort.left}→${bar.sort.right} top ${bar.sort.top} bottom ${bar.sort.bottom} · create ${bar.create.left}→${bar.create.right} top ${bar.create.top} bottom ${bar.create.bottom} · .btn ${bar.btn.left}→${bar.btn.right} width ${bar.btnWidth} min-width ${bar.btnMinWidth}`,
        );
      }
      barSeen = barLines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const barAfter = await js("return window.innerWidth;");
    if (barAfter !== barRestore) {
      throw new Error(`the persona toolbar's overrides cleared to ${barAfter}px, but the session runs at ${barRestore}px — a leaked override would mis-measure every later row`);
    }

    return `${lorebook.path}: a fresh mount reads ${JSON.stringify(lorebookFull.search)} with ${lorebookFull.count} card(s) of ${JSON.stringify(lorebookFull.grid)} and Newest selected · typing ${JSON.stringify(lorebookSearch.word)} committed ${JSON.stringify(lorebookSearch.narrowed.search)} with ${lorebookSearch.count} of ${lorebookFull.count} card(s) and **kept the caret** (activeElement ${lorebookSearch.narrowed.active}), and a mount from that URL preloads the field and draws the same rows · ${lorebookTag} · ?sort=ratio reads ${JSON.stringify(lorebookSort.sortLabel)} at ${JSON.stringify(lorebookSort.search)} · ${preset.path} reads ${JSON.stringify(presetFull.search)} with ${presetFull.count} card(s), typing ${JSON.stringify(presetSearch.word)} committed ${JSON.stringify(presetSearch.narrowed.search)} with ${presetSearch.count} and kept the caret, ${presetTag}, and ?sort=ratio reads ${JSON.stringify(presetSort.sortLabel)} · ${persona.path} reads ${JSON.stringify(personaFull.search)} with ${personaFull.personas} persona card(s), typing ${JSON.stringify(personaSearch.word)} committed ${JSON.stringify(personaSearch.narrowed.search)} with ${personaSearch.count} and kept the caret, ?q=zzqx-nothing-matches reads ${JSON.stringify(personaNone.noResults)} **with its word break** and no Retry, and ?sort=name reads ${JSON.stringify(personaSort.sortLabel)} with ${JSON.stringify(rowsOf(persona, personaSort))} · the persona toolbar at ${barSeen}`;
  }),
);

/* ------------------------------------------------------------------------------------------------
 * T-71 — `/terms` is the one route no row had ever mounted.
 *
 * `src/router.ts` against this file leaves exactly one page: `/terms` appeared nowhere, and it is the
 * page T-69's word-break class broke twice by hand (*Finishingonboardingis the acceptance*,
 * *beside Finish*). Gate section 10 proves the **bundle** has no literal glued to an inline tag; a
 * row proves the **sentence** a reader gets — the compile-time trim is invisible to a static scan of
 * the source, and the copy here is the product's longest prose.
 *
 * Read-only: `/terms` reads no store, writes no preference, takes no override and commits no query.
 * It adds one history entry (the push into `/onboarding`) and gives it back with the Back press.
 *
 * Three traps shape it:
 *  - `/terms` draws no `.detail` wrapper, so the page is keyed on `.kicker` + `h1.title` **and** the
 *    absence of `.detail` — a shared root class is not a landmark (T-51, `CommentThread`'s `.thread`);
 *  - the copy is long, so whitespace is collapsed **in Node**, never inside the page template: a
 *    `\s` written in a `js(…)` template literal is the double-escaping trap that has cost two
 *    sessions already (T-49), and doing it here means the page expression carries no escapes at all;
 *  - `TERMS_RULES`' titles are the product's, not this row's: they are read from the page, and only
 *    their count and distinctness are asserted.
 * ---------------------------------------------------------------------------------------------- */
const TERMS_PATH = "/terms";
/** The five notes, in the page's own order — a deleted or reordered section is a red row. */
const TERMS_SECTION_IDS = [
  "where-the-line-sits",
  "what-the-rules-apply-to",
  "what-the-flag-covers",
  "accepting-the-terms",
  "how-enforcement-works",
];

results.push(
  await journey("/terms mounts the terms copy, and its one link is a push into onboarding", async () => {
    /** Whitespace collapse in Node: the page expression below carries no backslash at all. */
    const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

    const read = () =>
      js(`
        const raw = (el) => (el ? String(el.textContent || "") : "");
        const notes = [...document.querySelectorAll("section.note")];
        const accepting = document.getElementById("accepting-the-terms");
        const para = accepting ? accepting.querySelector("p") : null;
        const link = para ? para.querySelector("a") : null;
        return {
          path: location.pathname + location.search,
          kicker: raw(document.querySelector(".kicker")),
          title: raw(document.querySelector("h1.title")),
          lede: raw(document.querySelector(".lede")),
          detail: !!document.querySelector(".detail"),
          ids: notes.map((section) => section.id),
          noteTitles: notes.map((section) => raw(section.querySelector(".note-title"))),
          rules: [...document.querySelectorAll(".rule-title")].map((el) => raw(el)),
          sentence: raw(para),
          linkText: raw(link),
          linkHref: link ? link.getAttribute("href") : "",
          docTitle: document.title,
        };
      `);

    /** A poll that names the route, the title and the notes it last saw (T-53: a timeout must read). */
    const until = async (label, check, timeout = 12000) => {
      const deadline = Date.now() + timeout;
      let last = null;
      for (;;) {
        last = await read();
        if (check(last)) return last;
        if (Date.now() > deadline) break;
        await sleep(150);
      }
      throw new Error(
        `${label} — at ${JSON.stringify(last.path)} the page read title ${JSON.stringify(clean(last.title))}, kicker ${JSON.stringify(clean(last.kicker))}, notes ${JSON.stringify(last.ids)} (document.title ${JSON.stringify(last.docTitle)})`,
      );
    };

    const onTerms = (state) =>
      state.path.endsWith(TERMS_PATH) &&
      clean(state.title) === "Three prohibitions" &&
      clean(state.kicker).toLowerCase() === "content rules";

    await go(TERMS_PATH);
    const page = await until("the terms page to mount its own heading", onTerms);

    if (page.detail) {
      throw new Error(
        `/terms drew a .detail wrapper — this page is prose, and a row keyed on a shared class passes on another page (T-51)`,
      );
    }
    if (clean(page.lede) === "") {
      throw new Error(`/terms prints no lede — the paragraph under the title is the page's own`);
    }
    // The five sections, in order. A deleted one shortens the list; a reordered one moves it.
    if (JSON.stringify(page.ids) !== JSON.stringify(TERMS_SECTION_IDS)) {
      throw new Error(
        `/terms draws the notes ${JSON.stringify(page.ids)}, not ${JSON.stringify(TERMS_SECTION_IDS)} — every section is mounted, in the page's order`,
      );
    }
    const untitled = page.noteTitles.filter((title) => clean(title) === "");
    if (untitled.length > 0) {
      throw new Error(
        `${untitled.length} of ${page.ids.length} note(s) draw no .note-title (read ${JSON.stringify(page.noteTitles.map(clean))}) — a section without its heading is a blank block`,
      );
    }
    // The three prohibitions. The titles are `TERMS_RULES`' own strings, so they are read, not pinned.
    if (page.rules.length !== 3) {
      throw new Error(`/terms draws ${page.rules.length} .rule-title(s), not the three prohibitions`);
    }
    const ruleTitles = page.rules.map(clean);
    if (ruleTitles.some((title) => title === "") || new Set(ruleTitles).size !== 3) {
      throw new Error(
        `the three rule cards read ${JSON.stringify(ruleTitles)} — every prohibition is named and none is repeated`,
      );
    }

    // The clause this row exists for: the acceptance sentence's words either side of its two inline
    // elements. `textContent` is the honest read (no `text-transform` in this paragraph) and the
    // collapse happened above, so a missing `{" "}` stays glued as *Finishingonboarding* instead of
    // becoming a line break the comparison would forgive.
    const sentence = clean(page.sentence);
    const clauses = ["Finishing onboarding is the acceptance", "beside Finish"];
    const missing = clauses.filter((clause) => !sentence.includes(clause));
    const glued = ["Finishingonboarding", "besideFinish"].filter((glue) => sentence.includes(glue));
    if (missing.length > 0 || glued.length > 0) {
      throw new Error(
        `/terms' accepting-the-terms paragraph reads ${JSON.stringify(sentence)} — ${
          missing.length > 0
            ? `it is missing ${JSON.stringify(missing)}`
            : `it runs the words either side of a tag together (${JSON.stringify(glued)}: the DOM drops a literal's boundary space beside an element, so the source needs an explicit {" "})`
        }`,
      );
    }
    if (clean(page.linkText).toLowerCase() !== "onboarding" || !page.linkHref.endsWith("/onboarding")) {
      throw new Error(
        `the sentence's link reads ${JSON.stringify([clean(page.linkText), page.linkHref])} — it must be the word onboarding pointing at /onboarding`,
      );
    }

    // The press. A URL assertion cannot see a re-boot (T-45), so document identity carries it.
    const mark = await markDocument(`terms ${stamp}`);
    await clickSelector("#accepting-the-terms p a");
    const landing = await waitFor(
      `(() => {
        const title = document.querySelector("h1.title");
        if (!location.pathname.endsWith("/onboarding") || !title) return "";
        const text = String(title.textContent || "").trim();
        return text === "Claim your handle" ? { path: location.pathname + location.search, title: text } : "";
      })()`,
      "the onboarding heading after pressing the sentence's link",
      12000,
    );
    const pushProof = await expectNoReload(mark, "pressing onboarding inside the accepting-the-terms sentence");

    await js(`history.back(); return true;`);
    const back = await until("Back from /onboarding to return to the terms heading", onTerms);
    const backProof = await expectNoReload(mark, "Back to /terms");

    return `/terms reads ${JSON.stringify([clean(page.kicker), clean(page.title)])} with a lede and the notes ${JSON.stringify(page.ids)} · the rule cards are ${JSON.stringify(ruleTitles)} · the accepting sentence reads ${JSON.stringify(sentence.slice(0, 92))}… **with its word breaks** · pressing its link pushed rather than re-booted (${pushProof}) to ${JSON.stringify(landing.title)} at ${JSON.stringify(landing.path)}, and Back returned to ${JSON.stringify(clean(back.title))} (${backProof}) · accepting-the-terms is in the DOM as an id, so a fragment link resolves (the fragment itself is a document load by design)`;
  }),
);

/* ------------------------------------------------------------------------------------------------
 * T-72 — `/terms` is the only page in the app with a page-level desktop composition, and no row has
 * ever rendered it.
 *
 * Row 52 proves the copy at whatever width the session happens to be — the walk's own is 500×653
 * (T-36a). `.contents` is the page's whole answer to *desktop responsive is mandatory, nothing is a
 * stretched phone*: a 200px sticky rail beside a prose column, `lg` only. Nothing has looked at
 * `/terms` above 900px, so a rail that overflows the outlet, a prose column that grows past its
 * measure, or a `display: none` that never turns on is green in `check.sh`, in every other row and
 * on the live walk. Ladder row 30 measures `/dev/primitives`' `.rail` — the **shell's** rail, a
 * different decision behind a different selector.
 *
 * Read-only: `/terms` reads no store, writes no preference, presses nothing and commits no query.
 *
 * Traps, all of them live:
 *  - `go("/terms")` is an app path; `go(await url())` would double the served base (T-59).
 *  - The row takes its **own** `360×740` and `1200×740` overrides, settles two frames, and clears
 *    them in a `finally`; a leaked override poisons the sign-out row after it (T-32) — so the row
 *    asserts `innerWidth` came back rather than trusting the `finally`.
 *  - `gridTemplateColumns` returns the **resolved tracks**, and a flex container answers `none`
 *    there: `split(" ").filter(Boolean)` reads that as the one track it is, which is why the row
 *    prints the display beside the count.
 *  - The rail's labels are `TERMS_RULES`' product strings: the row asserts the **ids**, in the
 *    page's own order, never a label text and never the number eight.
 *  - A fragment is not asserted as "stays in the app": `follow()` drops it on purpose and
 *    `/terms#anchor` is a real document load (`ARCHITECTURE.md` → Router). The id in the DOM is the
 *    honest assertion.
 * ---------------------------------------------------------------------------------------------- */
results.push(
  await journey("/terms hides its contents rail on a phone and sets it beside the prose at 1200", async () => {
    await go(TERMS_PATH);
    await waitFor(
      `String((document.querySelector("h1.title") || {}).textContent || "").trim() === "Three prohibitions" && location.pathname.endsWith("/terms")`,
      "the terms heading before the rail is read",
      12000,
    );

    /**
     * Everything read at one width in one evaluation. The prose widths are the paragraph boxes, not
     * the column's: `.note-body` and `.lede` are what must fit the outlet, and a max-width that
     * outgrows its lane shows up here as a box wider than the container.
     */
    const read = () =>
      js(`
        const box = (el) => (el ? Math.round(el.getBoundingClientRect().width * 100) / 100 : -1);
        const tracks = (el) => (el ? getComputedStyle(el).gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : []);
        const doc = document.querySelector(".doc");
        const contents = document.querySelector(".contents");
        const outlet = document.querySelector(".outlet");
        const lede = document.querySelector(".lede");
        const bodies = [...document.querySelectorAll(".note-body")];
        const links = [...document.querySelectorAll(".contents-link")];
        const targets = [...document.querySelectorAll(".rule[id], .note[id]")];
        const fragment = (a) => {
          const href = a.getAttribute("href") || "";
          const at = href.indexOf("#");
          return at < 0 ? "" : href.slice(at + 1);
        };
        return {
          path: location.pathname + location.search,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          outlet: box(outlet),
          docDisplay: doc ? getComputedStyle(doc).display : "",
          docTracks: tracks(doc),
          contentsDisplay: contents ? getComputedStyle(contents).display : "",
          contentsWidth: box(contents),
          contentsPosition: contents ? getComputedStyle(contents).position : "",
          lede: box(lede),
          bodies: bodies.map(box),
          targetIds: targets.map((el) => el.id),
          links: links.map((a) => ({ text: String(a.textContent || "").trim(), fragment: fragment(a) })),
          orphans: links.map(fragment).filter((id) => id === "" || document.getElementById(id) === null),
        };
      `);

    const restore = await js(`return window.innerWidth;`);
    const widthOf = { phone: 360, desktop: 1200 };
    let seen = "";
    try {
      /* ---------------------------------------------------------------- phone: one column, no rail */
      await send("Emulation.setDeviceMetricsOverride", { width: widthOf.phone, height: 740, deviceScaleFactor: 1, mobile: false });
      await sleep(260); // the media queries settle in two frames; a width read too early is the old box
      const phone = await read();
      if (phone.innerWidth !== widthOf.phone) {
        throw new Error(`the override asked for ${widthOf.phone} and the page measured ${phone.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!phone.path.endsWith(TERMS_PATH)) {
        throw new Error(`the rail row is on ${JSON.stringify(phone.path)}, not ${TERMS_PATH} — something navigated between the mount and the override`);
      }
      if (phone.contentsDisplay !== "none") {
        throw new Error(`at ${widthOf.phone}px .contents computes to ${JSON.stringify(phone.contentsDisplay)} and measures ${phone.contentsWidth}px — the rail is lg-only, and a rail drawn at 360 is a phone showing a desktop page squeezed`);
      }
      if (phone.docTracks.length !== 1) {
        throw new Error(`at ${widthOf.phone}px .doc (display ${JSON.stringify(phone.docDisplay)}) resolves to the tracks ${JSON.stringify(phone.docTracks)}, not one — the phone reads one column of prose`);
      }
      const spill = [
        ["lede", phone.lede],
        ...phone.bodies.map((width, at) => [`.note-body[${at}]`, width]),
      ].filter(([, width]) => width > phone.outlet + 0.5);
      if (spill.length > 0) {
        throw new Error(
          `at ${widthOf.phone}px ${spill.length} paragraph(s) are wider than the ${phone.outlet}px outlet: ${JSON.stringify(spill)} — prose wider than its lane is the horizontal scroll the page must never have`,
        );
      }
      // `>` and not `===`: `html` carries `scrollbar-gutter: stable`, so an unoverflowed document
      // reports scrollWidth equal to its **client** width (360 → 350 on this box). The rule is "no
      // horizontal scroll", which is an inequality — a strict equality reads a right page as red.
      if (phone.scrollWidth > phone.innerWidth) {
        throw new Error(`at ${widthOf.phone}px the document scrolls horizontally: scrollWidth ${phone.scrollWidth} > innerWidth ${phone.innerWidth}`);
      }

      /* ------------------------------------------------- desktop: the rail, the tracks, the fragments */
      await send("Emulation.setDeviceMetricsOverride", { width: widthOf.desktop, height: 740, deviceScaleFactor: 1, mobile: false });
      await sleep(260);
      const desk = await read();
      if (desk.innerWidth !== widthOf.desktop) {
        throw new Error(`the override asked for ${widthOf.desktop} and the page measured ${desk.innerWidth}`);
      }
      if (desk.contentsDisplay !== "flex") {
        throw new Error(
          `at ${widthOf.desktop}px .contents computes to ${JSON.stringify(desk.contentsDisplay)} and measures ${desk.contentsWidth}px — the lg rail never turns on above 1200, so the page is a stretched phone with a hidden nav`,
        );
      }
      if (Math.abs(desk.contentsWidth - 200) > 1) {
        throw new Error(`at ${widthOf.desktop}px the rail measures ${desk.contentsWidth}px, not the 200px track it declares (tracks ${JSON.stringify(desk.docTracks)})`);
      }
      if (desk.docDisplay !== "grid" || desk.docTracks.length !== 2) {
        throw new Error(
          `at ${widthOf.desktop}px .doc (display ${JSON.stringify(desk.docDisplay)}) resolves to the tracks ${JSON.stringify(desk.docTracks)}, not a rail plus a prose column`,
        );
      }
      const measure = parseFloat(desk.docTracks[1]);
      if (!Number.isFinite(measure) || measure > 720.5) {
        throw new Error(
          `the prose column resolves to ${JSON.stringify(desk.docTracks[1])} (tracks ${JSON.stringify(desk.docTracks)}) — the measure rule is minmax(0, 720px), so a column past 720 is prose set wider than a readable line`,
        );
      }

      // The rail lists the page's own headings: read the ids off the DOM, never pin eight anchors.
      const linkIds = desk.links.map((link) => link.fragment);
      if (JSON.stringify(linkIds) !== JSON.stringify(desk.targetIds)) {
        throw new Error(
          `/terms' rail lists ${JSON.stringify(linkIds)} but the page mounts the headings ${JSON.stringify(desk.targetIds)} — every heading gets one entry, in the page's own order (${desk.links.length} link(s))`,
        );
      }
      if (desk.orphans.length > 0) {
        throw new Error(
          `the rail points at ${JSON.stringify(desk.orphans)}, which no element on the page carries — a link to a missing fragment scrolls nowhere`,
        );
      }
      const unlabelled = desk.links.filter((link) => link.text === "");
      if (unlabelled.length > 0) {
        throw new Error(`${unlabelled.length} of ${desk.links.length} rail link(s) print no text — a bare fragment is not a contents entry`);
      }
      if (desk.scrollWidth > desk.innerWidth) {
        throw new Error(`at ${widthOf.desktop}px the document scrolls horizontally: scrollWidth ${desk.scrollWidth} > innerWidth ${desk.innerWidth}`);
      }

      seen = `at ${widthOf.phone}: .contents ${JSON.stringify(phone.contentsDisplay)} (${phone.contentsWidth}px), .doc ${JSON.stringify(phone.docDisplay)} → ${phone.docTracks.length} track, widest paragraph ${Math.max(phone.lede, ...phone.bodies)} inside the ${phone.outlet}px outlet, scrollWidth ${phone.scrollWidth}/${phone.innerWidth} · at ${widthOf.desktop}: .contents ${JSON.stringify(desk.contentsDisplay)} ${desk.contentsWidth}px ${desk.contentsPosition}, .doc ${desk.docDisplay} → ${JSON.stringify(desk.docTracks)} (prose ${measure}px ≤ 720), ${desk.links.length} rail link(s) matching the ${desk.targetIds.length} heading id(s) in order ${JSON.stringify(linkIds)}, every fragment in the DOM, scrollWidth ${desk.scrollWidth}/${desk.innerWidth}`;
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const after = await js(`return window.innerWidth;`);
    if (after !== restore) {
      throw new Error(`the override cleared to ${after}px, but the session runs at ${restore}px — a leaked override would mis-measure every later row`);
    }
    return seen;
  }),
);

/**
 * T-73 — the detail pages' `lg` composition: `.cols` is a column of `.main` + `.aside` on a phone
 * with the aside **visually first** (`order: -1`, the page's own argument: a reader who has to scroll
 * a whole description to find Like will not find it), and a two-column grid from 1200 with a 320px
 * aside **beside** the description. No row had ever rendered either half.
 *
 * The character walk opens the page it has opened since row 6 (Sonic, `…0002`); the name is read
 * off the page (row 42 renames a character and nothing here pins one), and the counts are read for
 * **shape** only — row 40 leaves a Like behind on this character.
 *
 * T-75 extended this row instead of adding a near-copy: after the 1200 read it mounts the **lorebook**
 * and **preset** detail pages, each of which keeps its own `<style>` copy of the same three `lg`
 * rules, and asserts only the facts all three share (two tracks, the second 320px, the aside beside
 * the description on the same row). The page name is in every message, so a red names which copy
 * drifted.
 *
 * T-76 finished the other half of those two copies: the **base** block (`display: flex;
 * flex-direction: column`, `.aside { order: -1 }`) had never been rendered on either page, so
 * deleting `order: -1` from `preset-detail` would have dropped the engagement row below a 60-line
 * description on a phone and walked green. The phone arm is one shared assertion, called for the
 * character page and for both copies, so the three files cannot drift apart unnoticed.
 *
 * T-77 closed the class with the **last unrendered arm**: the `sm 640` block (`.head` rewritten from
 * two tracks to `320px minmax(0, 1fr) auto` with the portrait moved beside the identity, `.title`
 * 26 → 34px, `.prose` 14 → 15px, `.vote`/`.save` `flex: 1 1 auto; min-width: 96px` → `flex: 0 0 auto;
 * min-width: 132px`). The row is now **width-major** — `assertSplit(r, { label, path, width, counts })`
 * answers all three widths and `SPLIT_WIDTHS` drives them — so nine readings cost **three** overrides
 * where the old page-major shape cost four, and a fourth width is one array entry.
 */
const DETAIL_SPLIT_PATH = "/character/c0a1b2c3-0000-4000-8000-000000000002";

/**
 * The other two catalogue detail pages carry **their own copy** of the same three `lg` rules
 * (`grid-template-columns: minmax(0, 1fr) 320px`, `.aside { grid-column: 2; grid-row: 1; order: 0 }`,
 * `.main { grid-column: 1; grid-row: 1 }`), each inside its own `<style>` block — so nothing in the
 * tree makes the three agree and nothing rendered these two. Rows 42/43 own each fixture's `…0001`
 * (the refusal road), so this row opens `…0002`: both are public, `nsfw: false`, authored by `ada`,
 * and no earlier row edits them.
 */
const SPLIT_COPIES = [
  { path: "/lorebook/10eb00c5-0000-4000-8000-000000000002", label: "lorebook" },
  { path: "/preset/9e5e7000-0000-4000-8000-000000000002", label: "preset" },
];

const SPLIT_PAGES = [
  { label: "character", path: DETAIL_SPLIT_PATH, counts: "require" },
  ...SPLIT_COPIES.map((copy) => ({ label: copy.label, path: copy.path, counts: "read" })),
];

/**
 * The ladder these three pages are designed on, walked **width-major**: one browser-level override
 * per width, the three mounts inside it. Page-major would cost nine overrides for nine readings and
 * nine more for a fourth width; width-major costs three and a fourth width slots in as one entry.
 */
const SPLIT_WIDTHS = [360, 640, 1200];

results.push(
  await journey("the catalogue detail pages render their phone, sm and lg arms", async () => {
    /**
     * One reading of the composition at one width — the same reader on all three pages, because the
     * row's whole subject is that three files keep **three private copies** of one rule set. The
     * `sm` half cannot be read off a rectangle (a `min-width` the row never has to fill, a font the
     * page may not draw), so the type and the action sizing are read as **computed strings**.
     */
    const read = () =>
      js(`
        const rect = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const round = (n) => Math.round(n * 100) / 100;
          return { top: round(r.top), left: round(r.left), right: round(r.right), bottom: round(r.bottom), width: round(r.width) };
        };
        const box = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const s = getComputedStyle(el);
          return { minWidth: s.minWidth, flexGrow: s.flexGrow, flexBasis: s.flexBasis };
        };
        const fontOf = (sel) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el).fontSize : "";
        };
        const cols = document.querySelector(".detail .cols");
        const cs = cols ? getComputedStyle(cols) : null;
        const isGrid = !!cs && cs.display.indexOf("grid") >= 0;
        const head = document.querySelector(".detail .head");
        const hs = head ? getComputedStyle(head) : null;
        const headIsGrid = !!hs && hs.display.indexOf("grid") >= 0;
        const counts = document.querySelector('.detail .counts[aria-label="Engagement"]');
        return {
          path: location.pathname,
          title: ((document.querySelector(".detail h1.title") || {}).textContent || "").trim(),
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          colsDisplay: cs ? cs.display : "",
          colsFlow: cs ? (isGrid ? cs.gridTemplateColumns : cs.flexDirection) : "",
          colsTracks: isGrid ? cs.gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : [],
          cols: rect(cols),
          main: rect(document.querySelector(".detail .cols .main")),
          aside: rect(document.querySelector(".detail .cols .aside")),
          outlet: rect(document.querySelector(".outlet")),
          countCells: counts ? counts.querySelectorAll(".count").length : -1,
          headDisplay: hs ? hs.display : "",
          headTracks: headIsGrid ? hs.gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : [],
          portrait: rect(document.querySelector(".detail .head .portrait")),
          identity: rect(document.querySelector(".detail .head .identity-text")),
          titleFont: fontOf(".detail h1.title"),
          proseFont: fontOf(".detail .prose"),
          entryFont: fontOf(".detail .entry-text"),
          vote: box(".detail .vote"),
          save: box(".detail .save"),
          start: box(".detail .start"),
        };
      `);

    const restore = await js("return window.innerWidth;");

    /**
     * Every assertion one mount can answer at one width, with the page's name and the width in each
     * message so a red says **which copy** drifted and **where** it was read.
     *
     * 360 and 640 both keep the **phone** `.cols` (one flex column, the aside lifted above the
     * description by `order: -1`) — the `sm` block rewrites `.head` and the type, never `.cols`, and
     * asserting that is half the point: a page that turned its grid on a breakpoint early would
     * otherwise read as a desktop page one width down. 1200 is the two-track grid.
     */
    const assertSplit = (r, { label, path, width, counts }) => {
      const at = `${label} at ${width}px`;
      if (r.innerWidth !== width) {
        throw new Error(`${at}: the override asked for ${width} and the page measured ${r.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!r.path.endsWith(path)) {
        throw new Error(`${at}: the row is on ${JSON.stringify(r.path)}, not ${path} — something navigated between the mount and the override`);
      }
      if (r.title === "") {
        throw new Error(`${at}: the page prints no .detail h1.title, so the composition measured is a skeleton or the not-found arm`);
      }
      /* ------------------------------------------------- everything all three widths must hold */
      if (!r.main || !r.aside || !r.outlet) {
        throw new Error(`${at}: the composition is incomplete — main ${JSON.stringify(r.main)}, aside ${JSON.stringify(r.aside)}, outlet ${JSON.stringify(r.outlet)}`);
      }
      if (r.main.left < r.outlet.left - 0.5 || r.aside.right > r.outlet.right + 0.5) {
        throw new Error(
          `${at}: the columns spill outside the outlet: main ${r.main.left}–${r.main.right}, aside ${r.aside.left}–${r.aside.right}, outlet ${r.outlet.left}–${r.outlet.right}`,
        );
      }
      if (r.countCells >= 0 && r.countCells !== 4) {
        throw new Error(
          `${at}: the engagement block draws ${r.countCells} .count cell(s), not the four the detail spec fixes (likes / dislikes / ratio / comments)${
            counts === "require" ? "" : " — this page draws the list, so it is not an absence"
          }`,
        );
      }
      if (counts === "require" && r.countCells < 0) {
        throw new Error(`${at}: the engagement block is missing entirely (.counts[aria-label="Engagement"] matched nothing)`);
      }
      // `>` and not `===`: `html` carries `scrollbar-gutter: stable`, so an unoverflowed document
      // reports scrollWidth equal to its **client** width. The rule is "no horizontal scroll".
      if (r.scrollWidth > r.innerWidth) {
        throw new Error(`${at}: the document scrolls horizontally: scrollWidth ${r.scrollWidth} > innerWidth ${r.innerWidth}`);
      }

      if (width === 1200) {
        /* ------------------------------------------------ lg: two tracks, the aside BESIDE main */
        if (r.colsDisplay.indexOf("grid") < 0 || r.colsTracks.length !== 2) {
          throw new Error(
            `${at}: .cols computes to display ${JSON.stringify(r.colsDisplay)} → the tracks ${JSON.stringify(r.colsTracks)} — the lg composition never turns on, so this page is a stretched phone with a 360-wide reading column`,
          );
        }
        const column = parseFloat(r.colsTracks[1]);
        if (!Number.isFinite(column) || Math.abs(column - 320) > 1) {
          throw new Error(`${at}: the second track resolves to ${JSON.stringify(r.colsTracks[1])} (tracks ${JSON.stringify(r.colsTracks)}), not the 320px aside the page declares`);
        }
        if (!(r.aside.left >= r.main.right - 0.5)) {
          throw new Error(
            `${at}: .aside spans ${r.aside.left}–${r.aside.right} and .main ends at ${r.main.right} — the aside is not beside the description, it is under it (grid-column: 2 is the rule that places it)`,
          );
        }
        if (Math.abs(r.aside.top - r.main.top) > 2) {
          throw new Error(`${at}: .aside starts at top ${r.aside.top} and .main at ${r.main.top} — the two columns do not start on the same row (grid-row: 1 for both)`);
        }
        return;
      }

      /* ------------------------------------- 360 and 640: still the phone .cols, aside lifted above */
      if (r.colsDisplay !== "flex" || r.colsFlow !== "column") {
        throw new Error(
          `${at}: .cols computes to display ${JSON.stringify(r.colsDisplay)} flow ${JSON.stringify(r.colsFlow)} — the phone (and its sm neighbour) reads one column of main then aside, not a squeezed grid`,
        );
      }
      if (r.colsTracks.length !== 0) {
        throw new Error(`${at}: .cols (display ${JSON.stringify(r.colsDisplay)}) still resolves to the grid tracks ${JSON.stringify(r.colsTracks)} — it is meant to be a flex column there`);
      }
      if (!(r.aside.top < r.main.top - 1)) {
        throw new Error(
          `${at}: .aside sits at top ${r.aside.top} and .main at top ${r.main.top} — the aside is not above the description, so a reader scrolls the whole prose to find Like (order: -1 is the mobile argument)`,
        );
      }
      if (Math.abs(r.aside.width - r.main.width) > 1) {
        throw new Error(`${at}: .aside measures ${r.aside.width}px and .main ${r.main.width}px — one column means one width, and a mismatched pair is a second track`);
      }

      if (width !== 640) return;

      /* -------------------------------------------------- sm 640: three tracks, the portrait beside */
      if (r.headDisplay.indexOf("grid") < 0 || r.headTracks.length !== 3) {
        throw new Error(
          `${at}: .head computes to display ${JSON.stringify(r.headDisplay)} and the tracks ${JSON.stringify(r.headTracks)} — the sm block's three-track head (320px cover | name | menu) is not in force, so the portrait is still stacked over the name at the one width the ladder puts it beside`,
        );
      }
      const portraitTrack = parseFloat(r.headTracks[0]);
      if (!Number.isFinite(portraitTrack) || Math.abs(portraitTrack - 320) > 1) {
        throw new Error(
          `${at}: the head's first track resolves to ${JSON.stringify(r.headTracks[0])} (tracks ${JSON.stringify(r.headTracks)}), not the 320px cover column the sm block declares`,
        );
      }
      if (Math.abs(r.portrait.top - r.identity.top) > 2) {
        throw new Error(
          `${at}: .portrait starts at top ${r.portrait.top} and the identity at ${r.identity.top} — they are stacked, not side by side (the sm block moves the portrait to column 1 and the name to column 2 of row 1)`,
        );
      }
      if (!(r.identity.left >= r.portrait.right - 0.5)) {
        throw new Error(
          `${at}: the identity starts at left ${r.identity.left} and the portrait ends at ${r.portrait.right} — the name is not to the right of the cover`,
        );
      }
      if (r.titleFont !== "34px") {
        throw new Error(`${at}: h1.title computes to ${JSON.stringify(r.titleFont)}, not the 34px the sm block declares (it is 26px below 640)`);
      }
      if (r.proseFont !== "15px") {
        throw new Error(`${at}: .prose computes to ${JSON.stringify(r.proseFont)}, not the 15px the sm block declares (it is 14px below 640)`);
      }
      // The lorebook's entry text is the one extra line the sm block widens, and only that page has it.
      if (r.entryFont !== "" && r.entryFont !== "15px") {
        throw new Error(`${at}: .entry-text computes to ${JSON.stringify(r.entryFont)}, not the 15px the lorebook's sm block declares`);
      }
      for (const [name, action] of [
        ["vote", r.vote],
        ["save", r.save],
      ]) {
        if (!action) {
          throw new Error(`${at}: the story has no .${name} control on this page, so the sm block's flex sizing measured nothing`);
        }
        if (action.minWidth !== "132px") {
          throw new Error(`${at}: .${name} computes min-width ${JSON.stringify(action.minWidth)}, not the 132px the sm block declares (it is 96px below 640)`);
        }
        if (action.flexGrow !== "0") {
          throw new Error(`${at}: .${name} computes flex-grow ${JSON.stringify(action.flexGrow)}, not the 0 of the sm block's flex: 0 0 auto — a growing pair is the phone's full-width row`);
        }
      }
    };

    const evidence = (label, r, width) => {
      const base = `${label} "${r.title}" at ${width}: .cols ${JSON.stringify(r.colsDisplay)} ${JSON.stringify(r.colsFlow)} → ${JSON.stringify(r.colsTracks)}, aside top ${r.aside.top} vs main ${r.main.top}, both ${r.aside.width}px inside the outlet ${r.outlet.left}–${r.outlet.right}`;
      const counts = r.countCells >= 0 ? `${r.countCells} count cells` : "no .counts block";
      const type = `title ${r.titleFont} / prose ${r.proseFont}${r.entryFont ? ` / entry ${r.entryFont}` : ""}`;
      const actions = `vote ${r.vote ? `${r.vote.minWidth} grow ${r.vote.flexGrow}` : "none"}, save ${r.save ? `${r.save.minWidth} grow ${r.save.flexGrow}` : "none"}`;
      if (width === 640) {
        return `${base} · .head ${JSON.stringify(r.headDisplay)} → ${JSON.stringify(r.headTracks)}, portrait right ${r.portrait.right} ≤ identity left ${r.identity.left}, tops ${r.portrait.top}/${r.identity.top}, ${type}, ${actions}, scrollWidth ${r.scrollWidth}/${r.innerWidth}`;
      }
      return `${base}, ${counts}, ${type}, ${actions}, scrollWidth ${r.scrollWidth}/${r.innerWidth}`;
    };

    let seen = "";
    const lines = [];
    try {
      // Width-major. The override is browser-level and survives `go()`, so it is taken **once per
      // width** and every reading still asserts `innerWidth` — a reading that fell through to the
      // session's own ~500px would measure a page nobody ships.
      for (const width of SPLIT_WIDTHS) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260); // the media queries settle in two frames; a width read too early is the old box
        for (const page of SPLIT_PAGES) {
          await go(page.path);
          await waitFor(
            'document.querySelector(".detail .cols .main") !== null && document.querySelector(".detail .cols .aside") !== null && (document.querySelector(".detail h1.title") || {}).textContent.trim() !== ""',
            `the ${page.label} detail page's .main + .aside composition and its h1.title at ${width}px`,
            12000,
          );
          const reading = await read();
          assertSplit(reading, { label: page.label, path: page.path, width, counts: page.counts });
          lines.push(evidence(page.label, reading, width));
        }
      }
      seen = lines.join(" · ");
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const after = await js("return window.innerWidth;");
    if (after !== restore) {
      throw new Error(`the override cleared to ${after}px, but the session runs at ${restore}px — a leaked override would mis-measure every later row (the sign-out row is next)`);
    }
    return seen;
  }),
);

/**
 * T-74 — `moderation-detail` is the fourth detail page and the only one whose split is a **different
 * composition**: `.cols` is a flex column at 360 and becomes a flex **row at `md 900`** (not 1200),
 * with a `flex: 0 0 340px` aside that is `position: sticky; top: 24px` and — unlike the three
 * catalogue detail pages T-73 walked — **no `order` at all**, so the decision panel deliberately sits
 * *below* the description on a phone. A row that copied row 54's assertions (a grid, the aside above
 * the main, a 320px track) would be red on a right page, which is why this one exists.
 *
 * The case it opens is the one row 20 already concluded (as *removed*), so the aside draws the
 * decision record instead of the *Decide* panel; the **composition** is identical either way and that
 * is all this row measures. `?admin=1` is how a case page mounts for the preview account — row 20's
 * road — and without it the page renders the forbidden arm, which has no `.cols` at all.
 *
 * Read-only: it presses no decision control, writes no store row and no preference, takes its own
 * `900×740` and `1200×740` overrides, clears them in a `finally` and then **asserts** `innerWidth`
 * came back (T-32: a leaked override mis-measures every later row, and the sign-out row is next).
 */
const MODERATION_SPLIT_PATH = "/moderation/4e90047a-0000-4000-8000-000000000002?admin=1";

results.push(
  await journey("/moderation/[id] becomes a 340px sticky decision column beside the case at 900", async () => {
    await go(MODERATION_SPLIT_PATH);
    await waitFor(
      'document.querySelector(".case .cols .main") !== null && document.querySelector(".case .cols .aside") !== null && (document.querySelector(".case h1.title") || {}).textContent !== ""',
      "the case page's .main + .aside composition",
      12000,
    );

    /**
     * One reading of the composition at one width. `colsGrid` is read explicitly because this page
     * is **flex at both ends**: a flex container's `gridTemplateColumns` is `none`, so tracks are
     * only split when the box really is a grid, and the display is printed beside the count.
     */
    const read = () =>
      js(`
        const rect = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const round = (n) => Math.round(n * 100) / 100;
          return { top: round(r.top), left: round(r.left), right: round(r.right), bottom: round(r.bottom), width: round(r.width) };
        };
        const cols = document.querySelector(".case .cols");
        const cs = cols ? getComputedStyle(cols) : null;
        const isGrid = !!cs && cs.display.indexOf("grid") >= 0;
        const aside = document.querySelector(".case .cols .aside");
        const astyle = aside ? getComputedStyle(aside) : null;
        return {
          path: location.pathname + location.search,
          title: ((document.querySelector(".case h1.title") || {}).textContent || "").trim(),
          kicker: ((document.querySelector(".case .kicker") || {}).textContent || "").trim(),
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          colsDisplay: cs ? cs.display : "",
          colsGrid: isGrid,
          colsFlow: cs ? (isGrid ? cs.gridTemplateColumns : cs.flexDirection) : "",
          colsTracks: isGrid ? cs.gridTemplateColumns.split(" ").filter((t) => t.trim() !== "") : [],
          cols: rect(cols),
          main: rect(document.querySelector(".case .cols .main")),
          aside: rect(aside),
          outlet: rect(document.querySelector(".outlet")),
          asidePosition: astyle ? astyle.position : "",
          asideTop: astyle ? astyle.top : "",
        };
      `);

    const restore = await js("return window.innerWidth;");
    const widthOf = { phone: 360, beside: 900, desktop: 1200 };
    let seen = "";
    try {
      /* ------------------------------------------- phone: one column with the panel *below* the case */
      await send("Emulation.setDeviceMetricsOverride", { width: widthOf.phone, height: 740, deviceScaleFactor: 1, mobile: false });
      await sleep(260); // the media queries settle in two frames; a width read too early is the old box
      const phone = await read();
      if (phone.innerWidth !== widthOf.phone) {
        throw new Error(`the override asked for ${widthOf.phone} and the page measured ${phone.innerWidth} — the row refuses to measure a viewport it did not set`);
      }
      if (!phone.path.endsWith("/moderation/4e90047a-0000-4000-8000-000000000002?admin=1")) {
        throw new Error(`the moderation split row is on ${JSON.stringify(phone.path)}, not the case page — something navigated between the mount and the override`);
      }
      if (phone.title === "" || !phone.kicker.toLowerCase().startsWith("case")) {
        throw new Error(
          `at ${widthOf.phone}px the page prints title ${JSON.stringify(phone.title)} and kicker ${JSON.stringify(phone.kicker)} — that is not the mounted ready arm of a case page, so the composition measured is not the one under test`,
        );
      }
      if (phone.colsDisplay !== "flex" || phone.colsFlow !== "column") {
        throw new Error(
          `at ${widthOf.phone}px .cols computes to display ${JSON.stringify(phone.colsDisplay)} flow ${JSON.stringify(phone.colsFlow)} — the phone reads one column of case then panel`,
        );
      }
      if (phone.colsGrid || phone.colsTracks.length !== 0) {
        throw new Error(`at ${widthOf.phone}px .cols (display ${JSON.stringify(phone.colsDisplay)}) resolves to the grid tracks ${JSON.stringify(phone.colsTracks)} — it is a flex column there, never a grid`);
      }
      if (!(phone.aside.top > phone.main.top + 1)) {
        throw new Error(
          `at ${widthOf.phone}px .aside sits at top ${phone.aside.top} and .main at top ${phone.main.top} — the panel is meant to sit BELOW the description here (no order), and a page that lifts it is copying the catalogue detail pages' argument`,
        );
      }
      if (Math.abs(phone.aside.width - phone.main.width) > 1) {
        throw new Error(`at ${widthOf.phone}px .aside measures ${phone.aside.width}px and .main ${phone.main.width}px — one column means one width, and a mismatched pair is a second track`);
      }
      if (phone.main.left < phone.outlet.left - 0.5 || phone.aside.right > phone.outlet.right + 0.5) {
        throw new Error(
          `at ${widthOf.phone}px the columns spill outside the outlet: main ${phone.main.left}–${phone.main.right}, aside ${phone.aside.left}–${phone.aside.right}, outlet ${phone.outlet.left}–${phone.outlet.right}`,
        );
      }
      if (phone.asidePosition !== "static") {
        throw new Error(`at ${widthOf.phone}px .aside computes to position ${JSON.stringify(phone.asidePosition)} — the sticky panel is an md rule, and a 340px sticky box beside a full-width column is the phone showing a desktop page`);
      }
      // `>` and not `===`: `html` carries `scrollbar-gutter: stable`, so an unoverflowed document
      // reports scrollWidth equal to its **client** width. The rule is "no horizontal scroll".
      if (phone.scrollWidth > phone.innerWidth) {
        throw new Error(`at ${widthOf.phone}px the document scrolls horizontally: scrollWidth ${phone.scrollWidth} > innerWidth ${phone.innerWidth}`);
      }

      /* ------------------------------------------------ 900: *this* page's breakpoint, not 1200 */
      const beside = async (at) => {
        await send("Emulation.setDeviceMetricsOverride", { width: at, height: 740, deviceScaleFactor: 1, mobile: false });
        await sleep(260);
        const desk = await read();
        if (desk.innerWidth !== at) {
          throw new Error(`the override asked for ${at} and the page measured ${desk.innerWidth}`);
        }
        if (desk.colsDisplay !== "flex" || desk.colsFlow !== "row") {
          throw new Error(
            `at ${at}px .cols computes to display ${JSON.stringify(desk.colsDisplay)} flow ${JSON.stringify(desk.colsFlow)} — the md composition never turns on, so the case page is a stretched phone with a 340px panel promised and never drawn`,
          );
        }
        if (desk.colsGrid) {
          throw new Error(`at ${at}px .cols computes to display ${JSON.stringify(desk.colsDisplay)} and answers grid tracks ${JSON.stringify(desk.colsTracks)} — this page's aside is flex, not a grid track`);
        }
        if (Math.abs(desk.aside.width - 340) > 1) {
          throw new Error(
            `at ${at}px .aside measures ${desk.aside.width}px, not the 340px the md block fixes (flex: 0 0 340px) — main ${desk.main.width}px, .cols ${desk.cols.width}px`,
          );
        }
        if (!(desk.aside.left >= desk.main.right - 0.5)) {
          throw new Error(
            `at ${at}px .aside spans ${desk.aside.left}–${desk.aside.right} and .main ends at ${desk.main.right} — the panel is not beside the case, it is under it (flex-direction: row is the rule that places it)`,
          );
        }
        if (Math.abs(desk.aside.top - desk.main.top) > 2) {
          throw new Error(`at ${at}px .aside starts at top ${desk.aside.top} and .main at ${desk.main.top} — align-items: flex-start starts both columns on the same row`);
        }
        if (desk.asidePosition !== "sticky") {
          throw new Error(`at ${at}px .aside computes to position ${JSON.stringify(desk.asidePosition)}, not sticky — the panel is meant to follow a long case`);
        }
        if (desk.asideTop !== "24px") {
          throw new Error(`at ${at}px .aside computes top ${JSON.stringify(desk.asideTop)}, not 24px — the sticky offset is the md block's own number`);
        }
        if (desk.main.left < desk.outlet.left - 0.5 || desk.aside.right > desk.outlet.right + 0.5) {
          throw new Error(
            `at ${at}px the columns spill outside the outlet: main ${desk.main.left}–${desk.main.right}, aside ${desk.aside.left}–${desk.aside.right}, outlet ${desk.outlet.left}–${desk.outlet.right}`,
          );
        }
        if (desk.scrollWidth > desk.innerWidth) {
          throw new Error(`at ${at}px the document scrolls horizontally: scrollWidth ${desk.scrollWidth} > innerWidth ${desk.innerWidth}`);
        }
        return desk;
      };

      const nine = await beside(widthOf.beside);
      /* 1200 repeats the same facts — the shell's outlet caps at 794 at every width ≥ 900, so this is
         not independent evidence; it proves the composition does not change again above md. */
      const wide = await beside(widthOf.desktop);

      seen = `${JSON.stringify(nine.title)} (${JSON.stringify(nine.kicker)}) · at ${widthOf.phone}: .cols ${JSON.stringify(phone.colsDisplay)} ${JSON.stringify(phone.colsFlow)} (grid ${phone.colsGrid}, ${phone.colsTracks.length} track(s)), aside below main (tops ${phone.aside.top} > ${phone.main.top}), both ${phone.aside.width}px inside the outlet ${phone.outlet.left}–${phone.outlet.right}, position ${JSON.stringify(phone.asidePosition)}, scrollWidth ${phone.scrollWidth}/${phone.innerWidth} · at ${widthOf.beside}: .cols ${JSON.stringify(nine.colsDisplay)} ${JSON.stringify(nine.colsFlow)} → aside ${nine.aside.width}px beside main right ${nine.main.right} (left ${nine.aside.left}), tops ${nine.aside.top}/${nine.main.top}, ${JSON.stringify(nine.asidePosition)} top ${JSON.stringify(nine.asideTop)}, .cols ${nine.cols.width}px inside the ${nine.outlet.width}px outlet, scrollWidth ${nine.scrollWidth}/${nine.innerWidth} · at ${widthOf.desktop}: the same facts (the shell's outlet caps at 794 at every width ≥ 900, so this is the same measurement one breakpoint up, not independent evidence: .cols ${wide.cols.width}px vs ${nine.cols.width}px, aside ${wide.aside.width}px, ${JSON.stringify(wide.asidePosition)} top ${JSON.stringify(wide.asideTop)}, tops ${wide.aside.top}/${wide.main.top})`;
    } finally {
      await send("Emulation.clearDeviceMetricsOverride");
      await sleep(240);
    }
    const after = await js("return window.innerWidth;");
    if (after !== restore) {
      throw new Error(`the override cleared to ${after}px, but the session runs at ${restore}px — a leaked override would mis-measure every later row (the sign-out row is next)`);
    }
    return seen;
  }),
);

results.push(
  await journey("sign out", async () => {
    await go("/");
    await waitText("signed in as", 8000);
    await click("More", { exact: true });
    await click("Sign out", { exact: true });
    await waitText("signed out", 8000);
    const profileTab = await js(`const el=[...document.querySelectorAll("a")].find((e)=>(e.getAttribute("aria-label")||e.innerText||"").trim()==="Profile"); return el ? el.getAttribute("href") : null;`);
    const root = new URL(BASE).pathname;
    if (profileTab !== root) throw new Error(`the Profile tab still points at ${profileTab}`);
    return `home reads "signed out"; the Profile tab points at ${profileTab}`;
  }),
);

socket.close();
chrome.kill("SIGKILL");

/**
 * The walk's own arithmetic: **every** row has to exist and pass. Keeping the count explicit (rather
 * than `passed === rows.length`) makes a row that silently stopped running a red walk — the failure
 * mode is a `@for`/`journey()` call that got deleted while the run still reads green. Bump it in
 * the commit that adds or removes a row (T-45: 27 → 28, T-46: 28 → 29, T-47: 29 → 30, T-37B: 31,
 * T-36a: 32, T-49: 33, T-50: 34, T-51: 35, T-52: 36, T-53: 37, T-54: 38, T-55: 39, T-56: 40,
 * T-58: 41, T-59: 42, T-60: 43, T-61: 44, T-62: 45, T-63: 46, T-64: 47, T-65: 48, T-66: 49,
 * T-67: 50, T-68: 51, T-71: 52, T-72: 53, T-73: 54, T-74: 55).
 */
const EXPECTED_ROWS = 55;

const passed = rows.filter((r) => r.ok).length;
console.log("");
console.log(`smoke: ${passed}/${rows.length} journeys`);
for (const row of rows) {
  console.log(`${row.ok ? "PASS" : "FAIL"} | ${row.journey} | ${row.ended - row.started}ms | ${row.evidence}`);
}
process.exit(passed === rows.length && rows.length === EXPECTED_ROWS ? 0 : 1);
