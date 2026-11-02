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
 * T-36a: 32, T-49: 33, T-50: 34, T-51: 35, T-52: 36, T-53: 37, T-54: 38, T-55: 39, T-56: 40).
 */
const EXPECTED_ROWS = 40;

const passed = rows.filter((r) => r.ok).length;
console.log("");
console.log(`smoke: ${passed}/${rows.length} journeys`);
for (const row of rows) {
  console.log(`${row.ok ? "PASS" : "FAIL"} | ${row.journey} | ${row.ended - row.started}ms | ${row.evidence}`);
}
process.exit(passed === rows.length && rows.length === EXPECTED_ROWS ? 0 : 1);
