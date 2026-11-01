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
    return `the provider button answers cancelled and signs nobody in; the menu's switch signs in as You; the control pushed (${kept})`;
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
    return "the report closed the dialog and the queue went 3 open → 4 open";
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
    return `${before} unread rows → ${before - 1}; the tab bar went "${unreadBefore}" → "${after}"`;
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
 * the commit that adds or removes a row (T-45: 27 → 28, T-46: 28 → 29).
 */
const EXPECTED_ROWS = 29;

const passed = rows.filter((r) => r.ok).length;
console.log("");
console.log(`smoke: ${passed}/${rows.length} journeys`);
for (const row of rows) {
  console.log(`${row.ok ? "PASS" : "FAIL"} | ${row.journey} | ${row.ended - row.started}ms | ${row.evidence}`);
}
process.exit(passed === rows.length && rows.length === EXPECTED_ROWS ? 0 : 1);
