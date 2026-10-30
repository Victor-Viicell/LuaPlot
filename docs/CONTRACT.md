# LuaPlot — session contract

Standing rules for **every** autonomous session on this repo. Read this file first, every time.
The repo is the memory: never rely on chat history.

## The loop (do these in order, no shortcuts)

1. `scripts/agent-lock.sh start <tick-id>` — if it exits non-zero another session holds the tree; stop.
2. Read, in order: `docs/NEXT.md` (the baton — exactly one ticket), `docs/SHIP-PLAN.md` (context + failure bank), `docs/DESIGN.md` (visual law), the spec files the ticket names.
3. Dirty-tree triage: `git status --short`. Uncommitted work from a killed session is either finished in this tick or reverted with `git checkout -- . && git clean -fd`. Never start a ticket on top of someone else's half-edit.
4. Implement **one** ticket from the baton. Two or three if they are genuinely tiny and the gate stays green.
5. Run `scripts/check.sh`. It must print `GREEN`. Red → fix, or revert everything and mark the ticket blocked.
6. `scripts/publish.sh` — builds, publishes to GitHub Pages, and prints the live URL. Verify the URL answers 200.
7. Commit: `<TICKET>: imperative summary`, body = why + what the next session must know.
8. Append to `docs/PROGRESS.md`, rewrite `docs/NEXT.md` for the next ticket, `scripts/agent-lock.sh stop`.
9. Reply with the ≤8-line report (shape below), including the live URL.

## Gates

- `scripts/check.sh` is the only gate. It runs the typecheck, the production build, and the spec/route sanity check. Green or nothing.
- No new dependency unless the ticket names it. If a ticket needs one, add it in the same commit and note it in the baton.
- Never leave the tree broken. A green tree with no progress is a success; a broken tree is a failure.
- Never claim an unverified build. No toolchain → write `UNVERIFIED` in PROGRESS and file a ticket instead of pretending.

## Product law (from `src/specs/`)

- The specs are the source of truth for behaviour. `src/specs/luaplot-pages.md` holds the rules that apply to every page; each page file holds layout/data/actions/states.
- IDs carry identity, names never do. Fixed segments (`catalog`, `create`, `thread`) win over `[id]` params.
- Engagement is metadata on cards (ratio only) and actions on detail pages (counts live there).
- NSFW is a boolean on content + a per-account preference (Show / Blur). It never blocks a route.
- JEV may only change visibility on authored content and remove posts/comments. It never deletes authored content.
- Personas are personal (never shared, never moderated, never counted).
- Sessions read copies, never live items. Publishing a cut is a snapshot.
- No page invents features the specs do not describe. If a spec says "To be specified", any layout choice must be recorded in `docs/DESIGN.md` so it stays consistent.

## Engineering law

- **Mobile first**: every page is designed at 360×740 first, then scaled up. Breakpoints: `sm 640`, `md 900`, `lg 1200`. No horizontal scroll at any width. Tap targets ≥ 44px. Safe-area insets respected.
- **Desktop responsive is mandatory**: at `lg` the shell becomes a sidebar layout; nothing is a stretched phone.
- **Tauri hardware**: mobile-only capabilities go through `src/lib/native.ts` (Tauri plugin APIs, dynamically imported) with a browser fallback. Web builds must never break.
- **Secrets never enter the client bundle.** `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY` are read only by server-side code (`supabase/functions/*`); the static build uses the mock provider.
- Ripple (`.tsrx`) for components; no React, no JSX, no second framework.
- **Zod is the only parser and the only normaliser.** `src/lib/schema.ts` owns every shape; entity
  types are `z.infer` of it, so a shape is declared once. `safeParse` at every UI/transport edge
  (form input, adapter return, JEV/LLM payload), `parse` only for an internal invariant. Trimming,
  lowercasing, collapsing and ISO-string checks happen in the schema, never in a page — and display
  formatting (`percent`, `relativeTime`) stays in `lib/format.ts`. A value that fails is fixed at the
  source (the fixture, the caller, the schema's spec citation), never by widening the schema.
  **Read `docs/ARCHITECTURE.md` → Validation before adding a shape, a form or an LLM call** — it is
  the settled rule, not a proposal, and `bun run schema:check` (gate section 5) enforces it.
- Every async surface renders Loading / Empty / Error / Success. No spinners without a skeleton.
- No per-keystroke network calls; debounce search at 250ms.

## Report shape (≤ 8 lines, exactly this)

```
TICKET T-xx — done | blocked
Changed: <one line>
Verified: check GREEN, build ok, live 200 <url>
Unverified: <what, or "none">
Next: <ticket id + title>
```

## When blocked

Take the next unblocked ticket in the same phase, then stop. Log the blocker at the top of the baton with what a human must do. Never invent a workaround that changes the product.
