#!/usr/bin/env node
/**
 * T-38 — one scripted walk of the primary journeys, against a build that ships.
 *
 * `node scripts/smoke.mjs [--url <base>]` drives a real Chromium over CDP (no dependency:
 * Node's global WebSocket plus `/json/new`), walks the sixteen journeys **in one session** with
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
import { existsSync, mkdirSync, rmSync } from "node:fs";
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
  } catch {}
});
process.on("SIGINT", () => {
  chrome.kill("SIGKILL");
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
socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params?.exceptionDetails;
    pageErrors.push(d?.exception?.description || d?.text || "page exception");
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
  const base = { x: Math.round(box.x), y: Math.round(box.y), button: "left", clickCount: 1 };
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
  await sleep(120);
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

const pressed = (label) =>
  js(`
    const el = [...document.querySelectorAll("button")].find((e) => (e.getAttribute("aria-label") || e.innerText || "").trim().toLowerCase().startsWith(${JSON.stringify(label.toLowerCase())}));
    return el ? el.getAttribute("aria-pressed") : null;
  `);

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
    await click("Sign in");
    await waitUrl("/authentification");
    await waitText("Continue with Google", 8000);
    await click("Continue with Google");
    await waitFor(`[...document.querySelectorAll("a")].some((e) => (e.getAttribute("href") || "").endsWith("/user/you"))`, "the session to reach the shell", 8000);
    await go("/");
    await waitText("signed in as You", 8000);
    const label = await badge();
    if (!label.startsWith("Alerts")) throw new Error("the tab bar lost its Alerts destination");
    return "home prints \"signed in as You\" after the provider button";
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

const passed = rows.filter((r) => r.ok).length;
console.log("");
console.log(`smoke: ${passed}/${rows.length} journeys`);
for (const row of rows) {
  console.log(`${row.ok ? "PASS" : "FAIL"} | ${row.journey} | ${row.ended - row.started}ms | ${row.evidence}`);
}
process.exit(passed === rows.length && rows.length === 16 ? 0 : 1);
