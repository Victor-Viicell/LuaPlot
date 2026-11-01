import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { follow, href } from "../router.ts";
import {
  CAPABILITIES,
  copy,
  haptic,
  isNative,
  pickImage,
  setBadge,
  shareText,
} from "../lib/native.ts";
import type { NativeResult } from "../lib/schema.ts";

/**
 * `/dev/native` — the hardware seam, as it answers. Development only.
 *
 * Not a product route: absent from `src/specs/luaplot-pages.md`, absent from the tab bar, and
 * `scripts/spec-routes.mjs` drops `/dev/*` before comparing the router with the spec.
 *
 * Why the page exists at all: `lib/native.ts` is only half-provable from the outside. A browser
 * walk can press these buttons; it cannot tell a *fallback that ran* from a *capability that was
 * never wired*, because both leave the screen unchanged. So each press prints the whole
 * `nativeResultSchema` answer — `{ok,value}` or `{ok,reason}` — and the road table above it is
 * imported from the module, not retyped here, so the page cannot drift from the implementation.
 *
 * What it does **not** prove: the gesture rule. A clipboard write inside a click proves the chain
 * works when a human clicked; it cannot prove what happens without one. That stays in the module's
 * comment, where a reader will find it.
 */

type Entry = {
  id: number;
  capability: string;
  result: NativeResult;
  read: string;
};

/** One sentence a person can act on, from the result the schema already validated. */
function readOut(result: NativeResult): string {
  if (result.ok) return result.value ? `ok · ${result.value}` : "ok";
  if (result.reason === "unsupported") return "unsupported · this browser has no road";
  if (result.reason === "cancelled") return "cancelled · the person said no";
  return "failed · a road existed and broke";
}

let next = 0;

export function DevNative() @{
  const shell = isNative();
  const log = track<Entry[]>([]);
  const title = track(typeof document === "undefined" ? "" : document.title);
  const busy = track("");

  /** Every press lands here, so the log cannot disagree with what the page reported. */
  function record(capability: string, result: NativeResult) {
    next += 1;
    log.value = [{ id: next, capability, result, read: readOut(result) }, ...log.value].slice(0, 6);
    title.value = document.title;
    busy.value = "";
  }

  async function run(capability: string, call: () => Promise<NativeResult>) {
    busy.value = capability;
    const result = await call();
    record(capability, result);
  }

  function latest(capability: string): Entry | undefined {
    return log.value.find((entry) => entry.capability === capability);
  }

  <>
    <style>
      {`
      .native {
        display: flex;
        flex-direction: column;
        gap: 28px;
        padding-bottom: 40px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--color-border);
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.2;
      }

      .lede {
        max-width: 74ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }

      .badge {
        padding: 4px 9px;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        color: var(--color-text-muted);
        font-size: 11px;
        letter-spacing: 0.06em;
      }

      .badge b {
        color: var(--color-text);
        font-weight: 600;
      }

      .sec {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .sec-head {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--color-border);
      }

      .sec-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .sec-note {
        max-width: 72ch;
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .caps {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background-color: var(--color-border);
      }

      .cap {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 12px;
        padding: 12px;
        background-color: var(--color-bg);
      }

      .cap-name {
        font-family: var(--font-mono);
        font-size: 13px;
        font-weight: 600;
      }

      .cap-road {
        grid-column: 1;
        color: var(--color-text-subtle);
        font-size: 11px;
        line-height: 1.6;
      }

      .cap-road code {
        color: var(--color-text-muted);
        font-family: var(--font-mono);
        font-size: 11px;
      }

      .cap-action {
        grid-column: 2;
        grid-row: 1 / span 2;
        align-self: center;
      }

      .cap-miss {
        color: var(--color-warning, var(--color-text-muted));
      }

      .log {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background-color: var(--color-border);
      }

      .entry {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        background-color: var(--color-bg);
      }

      .entry-head {
        display: flex;
        gap: 8px;
        align-items: baseline;
      }

      .entry-name {
        font-family: var(--font-mono);
        font-size: 12px;
        font-weight: 600;
      }

      .entry-verdict {
        margin-left: auto;
        color: var(--color-text-subtle);
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .entry-verdict[data-ok="true"] {
        color: var(--color-success, var(--color-accent));
      }

      .entry-read {
        color: var(--color-text-muted);
        font-size: 12px;
        line-height: 1.6;
        word-break: break-word;
      }

      .empty {
        padding: 16px 12px;
        background-color: var(--color-bg);
        color: var(--color-text-subtle);
        font-size: 12px;
      }

      .note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .tools {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .link {
        color: var(--color-text-muted);
        text-decoration: underline;
      }

      @media (min-width: 900px) {
        .cap {
          grid-template-columns: 200px minmax(0, 1fr) auto;
          align-items: center;
          padding: 14px 16px;
        }

        .cap-road {
          grid-column: 2;
        }

        .cap-action {
          grid-row: 1;
        }
      }

      @media (min-width: 1200px) {
        .native {
          gap: 36px;
        }
      }
      `}
    </style>

    <div class="native">
      <header class="head">
        <p class="kicker">dev · hardware</p>
        <h1 class="title">Native bridge</h1>
        <p class="lede">
          Five capabilities, one typed answer each. Every call returns
          <code>{"{ ok }"}</code> or <code>{"{ ok: false, reason }"}</code>, so a page never needs a
          <code>try</code> to render “nothing happened”. In this build the shell registers no
          haptics, badge or clipboard plugin, so the browser road answers and the plugin rung stays
          inert.
        </p>
        <div class="badges">
          <span class="badge">shell <b>{shell ? "tauri" : "browser"}</b></span>
          <span class="badge">chunk <b>{shell ? "loaded" : "never requested"}</b></span>
          <span class="badge">title <b>{title.value || "—"}</b></span>
        </div>
      </header>

      <section class="sec">
        <div class="sec-head">
          <h2 class="sec-title">Capabilities</h2>
          <p class="sec-note">
            The road column is imported from <code>lib/native.ts</code>, not retyped: if the module
            changes its ladder, this page changes with it. A shell-only rung that this build does
            not compile in is named — and falling through it is the point, not a failure.
          </p>
        </div>

        <div class="caps">
          @for (const cap of CAPABILITIES; key cap.name) {
            <div class="cap">
              <span class="cap-name">{cap.name}</span>
              <span class="cap-road">
                shell <code>{cap.native}</code> · web <code>{cap.web}</code>
                @if (latest(cap.name)) {
                  <span> · last <b>{latest(cap.name)!.read}</b></span>
                }
              </span>
              <span class="cap-action">
                @if (cap.name === "haptic") {
                  <Button
                    variant="secondary"
                    disabled={busy.value === "haptic"}
                    onClick={() => run("haptic", () => haptic("medium"))}
                  >
                    {"Vibrate"}
                  </Button>
                } @else if (cap.name === "shareText") {
                  <Button
                    variant="secondary"
                    disabled={busy.value === "shareText"}
                    onClick={() =>
                      run("shareText", () =>
                        shareText({
                          title: "LuaPlot",
                          text: "A character worth reading.",
                          url: `${location.origin}${href("/character/catalog")}`,
                        }),
                      )}
                  >
                    {"Share"}
                  </Button>
                } @else if (cap.name === "copy") {
                  <Button
                    variant="secondary"
                    disabled={busy.value === "copy"}
                    onClick={() => run("copy", () => copy("LuaPlot · the native bridge"))}
                  >
                    {"Copy"}
                  </Button>
                } @else if (cap.name === "pickImage") {
                  <Button
                    variant="secondary"
                    disabled={busy.value === "pickImage"}
                    onClick={() => run("pickImage", () => pickImage())}
                  >
                    {"Pick"}
                  </Button>
                } @else {
                  <Button
                    variant="secondary"
                    disabled={busy.value === "setBadge"}
                    onClick={() => run("setBadge", () => setBadge(3))}
                  >
                    {"Badge 3"}
                  </Button>
                }
              </span>
            </div>
          }
        </div>

        <p class="note">
          Cancel a share or dismiss the picker on purpose: the answer must read
          <b> cancelled</b>, never <b>failed</b> — a toast on dismissal is a bug. Badge writes the
          title, so the tab strip shows what the shell would have badged; press it again with 0 to
          see the title come back, which is why the module remembers the unbranded one.
        </p>
        <div class="tools">
          <Button variant="secondary" onClick={() => run("setBadge", () => setBadge(0))}>
            {"Clear badge"}
          </Button>
        </div>
      </section>

      <section class="sec">
        <div class="sec-head">
          <h2 class="sec-title">Last answers</h2>
          <p class="sec-note">
            Newest first, six deep. The shape shown is the parsed result — the module already ran it
            through <code>nativeResultSchema</code>, so nothing here can print a reason the schema
            does not allow.
          </p>
        </div>
        @if (log.value.length === 0) {
          <p class="empty">{"No calls yet. Every button above answers in place."}</p>
        } @else {
          <div class="log">
            @for (const entry of log.value; key entry.id) {
              <div class="entry">
                <div class="entry-head">
                  <span class="entry-name">{entry.capability}</span>
                  <span class="entry-verdict" data-ok={String(entry.result.ok)}>
                    {entry.result.ok ? "ok" : entry.result.reason}
                  </span>
                </div>
                <span class="entry-read">{entry.read}</span>
              </div>
            }
          </div>
        }
      </section>

      <section class="sec">
        <div class="sec-head">
          <h2 class="sec-title">Elsewhere</h2>
          <p class="sec-note">The other dev seams; none of them is in the spec index.</p>
        </div>
        <p class="note">
          <a class="link" href={href("/dev/data")} onClick={follow("/dev/data")}>/dev/data</a> · fixtures and mutations ·
          <a class="link" href={href("/dev/state")} onClick={follow("/dev/state")}>/dev/state</a> · session and NSFW pair ·
          <a class="link" href={href("/dev/primitives")} onClick={follow("/dev/primitives")}>/dev/primitives</a> · primitives at four
          widths
        </p>
      </section>
    </div>
  </>
}

export default DevNative;
