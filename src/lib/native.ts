/**
 * The native boundary (T-34) — `docs/ARCHITECTURE.md` → *Native boundary*.
 *
 * One module, one capability table. Every function in here answers `nativeResultSchema`
 * (`{ ok: true, value? } | { ok: false, reason }`), never `void | throw`, so a page renders
 * *nothing happened* without a `try` — and **every Tauri import happens inside the `isNative()`
 * branch**, so the browser bundle never loads that chunk.
 *
 * The ladder, per capability:
 *
 * 1. the shell's plugin, if this build registers it — `invoke()` a `plugin:<name>|<command>`;
 * 2. the web API (`navigator.share`, `navigator.clipboard`, `<input type=file>`, `document.title`);
 * 3. `unsupported`.
 *
 * Rung 1 is **inert today**: `src-tauri` registers `opener` and nothing else, so a haptics, badge
 * or clipboard plugin is not compiled in. An unregistered command rejects, and that rejection is
 * read as *absent* rather than *failed* — which is what lets the same module ship before the
 * plugins exist. Installing one is a `Cargo.toml` + `capabilities/default.json` change plus one
 * string in `COMMANDS`; no page and no signature moves.
 *
 * Why `isNative()` reads `window.__TAURI_INTERNALS__` instead of an env flag: `import.meta.env` is
 * baked at build time, so the Pages build would believe whatever the build machine said. The
 * internals object is what the shell actually injects at runtime.
 */
import {
  badgeCountSchema,
  clipboardTextSchema,
  hapticKindSchema,
  nativeResultSchema,
  sharePayloadSchema,
  type HapticKind,
  type NativeResult,
  type NativeUnavailableReason,
  type SharePayload,
} from "./schema.ts";

/* ------------------------------------------------------------------------------------------------
 * Shape helpers
 * ---------------------------------------------------------------------------------------------- */

/** A success. `parse` is correct here: the factory is ours, so a malformed result is a bug. */
function done(value?: string): NativeResult {
  return nativeResultSchema.parse(value === undefined ? { ok: true } : { ok: true, value });
}

/** A miss, with the reason a caller switches on. */
function denied(reason: NativeUnavailableReason): NativeResult {
  return nativeResultSchema.parse({ ok: false, reason });
}

/**
 * The plugin commands this module would call. Names follow Tauri's own convention
 * (`plugin:<plugin-name>|<command>`); none of them is registered by `src-tauri` yet, so `invoke()`
 * rejects and the ladder falls through to the web road. A plugin install is one edit here.
 */
const COMMANDS = {
  haptic: "plugin:haptics|vibrate",
  clipboardWrite: "plugin:clipboard-manager|write_text",
  badge: "plugin:badge|set",
  pickImage: "plugin:dialog|open",
} as const;

/** What each intensity means in milliseconds of vibration, for the web road (always a pattern:
 *  the DOM's `vibrate` is typed as an iterable of durations). */
const HAPTIC_PATTERNS: Record<HapticKind, number[]> = {
  light: [8],
  medium: [16],
  heavy: [28],
  success: [10, 60, 16],
  warning: [20, 70, 20],
  error: [30, 60, 30],
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];
const BADGE_PREFIX = /^\(\d+\)\s+/;

/* ------------------------------------------------------------------------------------------------
 * The shell seam
 * ---------------------------------------------------------------------------------------------- */

/**
 * `true` only inside a Tauri webview. Synchronous on purpose — a capability decides its road
 * before it does anything, and an async check would make every call wait on a chunk it does not
 * need.
 */
export function isNative(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type TauriCore = typeof import("@tauri-apps/api/core");

/**
 * `@tauri-apps/api/core`, or `null` in a browser. The import is dynamic and memoised: Vite emits
 * it as its own chunk, and a browser never requests that chunk because `isNative()` is false.
 * `.catch(() => null)` covers a shell too old to carry the module — a missing helper is *absent*,
 * not a crash on the first tap.
 */
let corePromise: Promise<TauriCore | null> | null = null;

function tauriCore(): Promise<TauriCore | null> {
  if (!isNative()) return Promise.resolve(null);
  corePromise ??= import("@tauri-apps/api/core").catch(() => null);
  return corePromise;
}

/**
 * Ask the shell for a plugin command; `null` means *this build cannot*, whatever the cause
 * (no shell, no plugin, a refusal, an older command signature). The caller then takes the web road
 * instead of reporting a failure, so an app that has never been wrapped still works.
 */
async function invokeShell(command: string, args?: Record<string, unknown>): Promise<unknown | null> {
  const core = await tauriCore();
  if (!core) return null;
  try {
    return await core.invoke(command, args);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Capabilities
 * ---------------------------------------------------------------------------------------------- */

/**
 * A tap acknowledgement. Desktop browsers expose no motor: Chrome answers `false`, Safari has no
 * `navigator.vibrate` at all — both are `unsupported`, never a throw.
 */
export async function haptic(kind: HapticKind = "light"): Promise<NativeResult> {
  const shape = hapticKindSchema.safeParse(kind);
  if (!shape.success) return denied("failed");
  const name = shape.data;

  if ((await invokeShell(COMMANDS.haptic, { kind: name })) !== null) return done(name);

  const vibrate = typeof navigator === "undefined" ? undefined : navigator.vibrate;
  if (typeof vibrate !== "function") return denied("unsupported");
  try {
    return navigator.vibrate(HAPTIC_PATTERNS[name]) ? done(name) : denied("unsupported");
  } catch {
    return denied("failed");
  }
}

/**
 * The system share sheet, or the clipboard when there is none.
 *
 * A dismissed sheet rejects with `AbortError` — that is `cancelled`, and a toast would be a bug.
 * Any other rejection (no user gesture, a field the sheet refuses) still leaves the text worth
 * copying, so the chain continues instead of reporting.
 */
export async function shareText(payload: SharePayload): Promise<NativeResult> {
  const shape = sharePayloadSchema.safeParse(payload);
  if (!shape.success) return denied("failed");
  const data = shape.data;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return done("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return denied("cancelled");
    }
  }

  const text = [data.text, data.url].filter(Boolean).join(" ");
  const copied = await copy(text || data.title || "");
  return copied.ok ? done("copied") : denied(copied.reason);
}

/**
 * The clipboard, in three rungs: the shell's plugin, `navigator.clipboard.writeText`, then a
 * hidden textarea and `document.execCommand("copy")`.
 *
 * The last rung is deprecated and stays because the first two are conditional: `clipboard` needs a
 * **user gesture and a secure context**, and a Tauri webview loading a custom scheme is neither
 * guaranteed to be secure nor guaranteed to be inside a gesture the browser accepts. No headless
 * walk can prove that rule, so the module carries it.
 */
export async function copy(text: string): Promise<NativeResult> {
  const shape = clipboardTextSchema.safeParse(text);
  if (!shape.success) return denied("failed");
  const value = shape.data;

  if ((await invokeShell(COMMANDS.clipboardWrite, { text: value })) !== null) return done(value);

  if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(value);
      return done(value);
    } catch {
      // Blocked (no gesture, insecure context, a denied permission): fall to the legacy rung.
    }
  }

  return legacyCopy(value) ? done(value) : denied("unsupported");
}

/** A hidden textarea, a selection, `execCommand("copy")` — the road that still works in a webview. */
function legacyCopy(value: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * Pick one image. No uploader exists yet (T-31 is blocked on the Supabase project), so this
 * returns the file's **name** and nothing is wired to a form in this ticket.
 *
 * The shell's dialog answers a path; the browser answers a `File`. A dismissed picker fires no
 * `change` event on most engines, so the window regaining focus with no file chosen is the only
 * cancel signal — 400ms is long enough for a real `change` to land first.
 */
export async function pickImage(): Promise<NativeResult> {
  const picked = await invokeShell(COMMANDS.pickImage, {
    options: {
      multiple: false,
      directory: false,
      title: "Choose an image",
      filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
    },
  });
  if (typeof picked === "string" && picked.length > 0) {
    return done(picked.split(/[\\/]/).pop() ?? picked);
  }
  if (typeof document === "undefined") return denied("unsupported");
  return pickWithInput();
}

function pickWithInput(): Promise<NativeResult> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.append(input);

    let settled = false;
    function settle(result: NativeResult): void {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onFocus);
      input.remove();
      resolve(result);
    }

    function onFocus(): void {
      window.setTimeout(() => {
        if (settled) return;
        if (!input.files || input.files.length === 0) settle(denied("cancelled"));
      }, 400);
    }

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        settle(file ? done(file.name) : denied("cancelled"));
      },
      { once: true },
    );
    // The spec's own signal, where the engine implements it: `cancel` fires when the chooser is
    // dismissed. The focus probe below stays for the engines that never send it.
    input.addEventListener("cancel", () => settle(denied("cancelled")), { once: true });
    window.addEventListener("focus", onFocus);
    input.click();
  });
}

/**
 * The unread badge. The shell's plugin draws a home-screen badge; a browser has no badge API, so
 * the page title carries `(3) LuaPlot` — which is exactly what a tab strip shows, and the reason
 * the function remembers the unbranded title instead of prefixing twice.
 */
let baseTitle: string | null = null;

export async function setBadge(count: number): Promise<NativeResult> {
  const shape = badgeCountSchema.safeParse(count);
  if (!shape.success) return denied("failed");
  const n = shape.data;

  if ((await invokeShell(COMMANDS.badge, { count: n })) !== null) {
    return done(n === 0 ? "cleared" : String(n));
  }
  if (typeof document === "undefined") return denied("unsupported");

  baseTitle ??= document.title.replace(BADGE_PREFIX, "");
  document.title = n === 0 ? baseTitle : `(${n}) ${baseTitle}`;
  return done(n === 0 ? "title cleared" : `(${n}) title`);
}

/* ------------------------------------------------------------------------------------------------
 * The table
 * ---------------------------------------------------------------------------------------------- */

/**
 * Every capability with the road it takes on a browser — the module's own documentation, in a
 * shape the `/dev/native` harness prints, so the page cannot drift from the implementation.
 */
export const CAPABILITIES = [
  { name: "haptic", native: "plugin:haptics", web: "navigator.vibrate", miss: "unsupported" },
  { name: "shareText", native: "—", web: "navigator.share → copy()", miss: "cancelled on dismissal" },
  { name: "copy", native: "plugin:clipboard-manager", web: "clipboard → execCommand", miss: "unsupported" },
  { name: "pickImage", native: "plugin:dialog", web: "<input type=file>", miss: "cancelled on dismissal" },
  { name: "setBadge", native: "plugin:badge", web: "document.title", miss: "—" },
] as const;
