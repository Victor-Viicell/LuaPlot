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

    return `closed: ${JSON.stringify(closed.summary)} · ${dealt} · unlinked offers ${lorebook.links} links / ${lorebook.actions.length} controls · restored → ${JSON.stringify(restored.summary)}`;
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
 * Read-only: no store write, no CDP override, no probe. Ends on `/post/thread` with no query, and
 * sits after row 38 and before `sign out`, so `sign out` stays the walk's last row.
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

    return `?sort=discussed loads by address with the control on discussed (${shared.cards} cards) · newest writes no param (search "") · press discussed → ?sort=discussed, ${discussed.cards} card(s) re-rendered · press liked → ?sort=liked, ${liked.cards} · Back → ?sort=discussed with the control and the listing (${back.cards}) · Back → "" + newest (${home.cards}) · Load more: ${first.cards} → ${appended.cards} card(s), first page's ${appended.marks} stamp(s) and order kept, search still "" · ${secondHalf} · Back from a loaded page left the thread (${left.cards} card(s) at ?sort=discussed), returning re-read page 1 (${rebound.cards} card(s), 0 stamps, Load more back)`;
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

    try {
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

      return `@${accountHandle} (${JSON.stringify(account.name)}) · a first visit opens blank with the rule as the handle's help line, and Finish enables on the pair only once the settle asked the adapter · "ab" → ${JSON.stringify(HANDLE_RULE_SENTENCE)} with Finish disabled · "Ada" → "Username taken" with Finish disabled · Finish → /user/${ONBOARDING_HANDLE} reads ${JSON.stringify([claimed.name, claimed.handle])}, / reads ${JSON.stringify(shell.sentence)} with Open profile at ${shell.profile} · a second visit restored ${JSON.stringify([resumed.handle, resumed.name])} → Finish back to /user/${accountHandle}, / reads ${JSON.stringify(home.sentence)}`;
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

    return `/user/${STRANGER_HANDLE}/edit stays put and reads "You can't edit this account." with no username field, no Save and Back to your profile at /user/${ownHandle} · the owner's form prefills ${JSON.stringify([form.handle, form.name, before.bio])} with the rule ${JSON.stringify(rule)} as help · @${STRANGER_HANDLE} → ${JSON.stringify("Username taken")} with Save disabled and no help · "ab" → the same rule as the inline error with Save disabled · back to @${ownHandle} → error gone, rule back as help, Save enabled · Cancel → /user/${ownHandle} reads ${JSON.stringify([after.name, after.handle])} unchanged`;
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

    return `a fresh mount reads ${JSON.stringify(full.search)} with ${full.count} card(s) and Newest selected · typing ${JSON.stringify(word)} a character at a time left the URL clean on all ${fast.length} in-window sample(s) and settled to ${JSON.stringify(typed.search)} with ${typed.count} card(s) · a mount from that URL preloads the field and draws the same ${restored.count} · ?q=zzqx-nothing-matches reads ${JSON.stringify(none.empty)} with 0 card(s), no Retry, a Clear filters control · ?sort=ratio reads ${JSON.stringify(rated.sortLabel)} at ${JSON.stringify(rated.search)} with ratios ${JSON.stringify(rated.ratios)} never rising, Newest drops the param (${JSON.stringify(backToNewest.search)}) and Back returns ${JSON.stringify(returnedSort.search)} · ?tags=${tagA} draws ${oneTag.count} card(s) all carrying it, its chip's remove control rewrites the URL to ${JSON.stringify(clearedTags.search)} · ?tags=${tagA},${tagB} draws ${onlyA} ${tagA}-only and ${onlyB} ${tagB}-only card(s) — either, not both — and removing ${tagB} leaves ${JSON.stringify(oneLeft.search)} · at 360 ${folded}`;
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
 *  8. the tab you are already on is a press too: it clears the search and rewrites the URL.
 *
 * Read-only: types, presses tabs, the sort select and Back. No store row, no preference.
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

    return `a fresh ${BOOKMARKS_PATH} writes ${JSON.stringify(opened.search)} (the default tab ${JSON.stringify(opened.type)}, counts ${JSON.stringify(opened.counts)}) · pressing ${JSON.stringify(target.label)} pushed ${JSON.stringify(pressed.search)} and drew ${pressed.count} row(s) of ${JSON.stringify(pressed.grid)} · a mount from ?type=${target.type} draws the same ${JSON.stringify(mounted.titles)} · ?sort=name reads ${JSON.stringify(byName.sortLabel)} at ${JSON.stringify(byName.search)} with the titles ${JSON.stringify(byName.titles)} ascending, and Back returns ${JSON.stringify(backToTab.search)} with ${backToTab.count} row(s) · typing ${JSON.stringify(word)} committed ${JSON.stringify(narrowed.search)} with ${narrowed.count} of ${mounted.count} row(s) and **kept the caret** (activeElement ${narrowed.active}) · a mount from ?type=${target.type} remounted the whole tab (${reopened.count} row(s), field ${JSON.stringify(reopened.field)}) · a sort under the search reads ${JSON.stringify(sortedUnderSearch.search)} and Back returns ${JSON.stringify(backToSearch.search)} with the field holding ${JSON.stringify(backToSearch.field)} · the ${target.label} tab, pressed on itself, cleared the search to ${JSON.stringify(leftByTab.search)} with ${leftByTab.count} row(s) and an empty field`;
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
 * T-67: 50).
 */
const EXPECTED_ROWS = 50;

const passed = rows.filter((r) => r.ok).length;
console.log("");
console.log(`smoke: ${passed}/${rows.length} journeys`);
for (const row of rows) {
  console.log(`${row.ok ? "PASS" : "FAIL"} | ${row.journey} | ${row.ended - row.started}ms | ${row.evidence}`);
}
process.exit(passed === rows.length && rows.length === EXPECTED_ROWS ? 0 : 1);
