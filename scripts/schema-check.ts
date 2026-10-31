/**
 * `bun run schema:check` — section 5 of `scripts/check.sh`.
 *
 * The gate, not a page, is the guarantee that the shapes in `src/lib/schema.ts` are real:
 *
 * 1. every fixture collection is parsed (`seedSchemas`), with per-collection counts printed — a
 *    fixture that drifts from `src/specs/` fails here instead of on a phone screen;
 * 2. the three negative cases the ticket names must **fail** — a bad handle, an entity missing
 *    `nsfw`, and an unknown extra key. A schema that accepts any of them is worse than no schema,
 *    so this exits non-zero when one passes;
 * 3. the one recursive shape (`commentBranchSchema`, `z.lazy`) is built from the flat comment rows
 *    and parsed, and its emitted type is proven not-`any` at the type level — a schema typed `any`
 *    hides exactly the drift this file exists to catch.
 *
 * Runs under `bun` so it imports the TS schemas with no build step.
 */
import { COMMENTS, seed, CHARACTERS } from "../src/lib/fixtures/index.ts";
import {
  commentBranchIsTyped,
  commentThreadSchema,
  handleSchema,
  isoMessage,
  isoSchema,
  characterSchema,
  REPORT_REASON_MISMATCH,
  REPORT_SOURCE_REQUIRED,
  reportWriteSchema,
  seedSchemas,
  type CommentBranch,
  type SeedCollection,
} from "../src/lib/schema.ts";

/** `bun` provides it; the script is outside the app's tsconfig, so it is declared here. */
declare const process: { exit(code: number): never };

let failures = 0;

function ok(message: string): void {
  console.log(`   ok   ${message}`);
}

function bad(message: string): void {
  failures += 1;
  console.log(`   FAIL ${message}`);
}

/* 1. Every fixture collection parses. */
console.log("== fixtures");
const names = Object.keys(seedSchemas) as SeedCollection[];
const total = names.reduce((sum, name) => {
  const rows = (seed as Record<string, unknown>)[name];
  if (rows === undefined) {
    bad(`seed has no collection "${name}"`);
    return sum;
  }
  const result = seedSchemas[name].safeParse(rows);
  if (!result.success) {
    const issue = result.error.issues[0];
    const [head, ...rest] = issue?.path ?? [];
    bad(
      `${name}: ${typeof head === "number" ? `row ${head} ` : ""}${rest.join(".")} — ${issue?.message}`,
    );
    return sum;
  }
  const count = Array.isArray(rows) ? rows.length : 0;
  console.log(`   ok   ${name} × ${count}`);
  return sum + count;
}, 0);
console.log(`   ${total} rows across ${names.length} collections`);

/* 2. The three negative cases must fail. */
console.log("== negative cases");

const rejectedHandle = handleSchema.safeParse("Avis Bern!");
if (rejectedHandle.success) bad('handleSchema accepted "Avis Bern!"');
else ok(`handleSchema rejected "Avis Bern!" (${rejectedHandle.error.issues[0]?.message})`);

const missingFlag = { ...CHARACTERS[0] } as Record<string, unknown>;
delete missingFlag.nsfw;
const noNsfw = characterSchema.safeParse(missingFlag);
if (noNsfw.success) bad("characterSchema accepted a character with no nsfw flag");
else ok(`characterSchema rejected a character with no nsfw (${noNsfw.error.issues[0]?.message})`);

const extraKey = { ...CHARACTERS[0], ratio: 0.93 };
const unknownKey = characterSchema.safeParse(extraKey);
if (unknownKey.success) bad("characterSchema accepted a stored `ratio`");
else ok(`characterSchema rejected a stored \`ratio\` (${unknownKey.error.issues[0]?.message})`);

/* A calendar is not a shape: the timestamp rule is checked here so it cannot silently loosen. */
for (const value of ["2026-13-01T00:00:00.000Z", "2026-02-30T00:00:00.000Z", "2026-10-01", "2"]) {
  if (isoSchema.safeParse(value).success) bad(`isoSchema accepted "${value}"`);
  else ok(`isoSchema rejected "${value}"`);
}
const realTimestamp = isoSchema.safeParse("2026-10-30T18:04:24.000Z");
if (realTimestamp.success) ok(`isoSchema accepted a real timestamp`);
else bad(`isoSchema rejected a real timestamp (${isoMessage})`);

/* T-12: a copy claim with no source must be refused, a reason that fits none of the chosen
   surfaces must be too, and the mixed write the dialog produces — image **and** text, two reasons —
   must be accepted. Both stops take sets, so the fixtures are arrays; the message matters, not just
   the refusal, because an empty array would fail these same asserts for the wrong reason. */
const reportTarget = { kind: "character" as const, id: CHARACTERS[0].id, label: CHARACTERS[0].name };

const sourcelessCopy = reportWriteSchema.safeParse({
  target: reportTarget,
  parts: ["text"],
  reasons: ["copied-text"],
});
if (sourcelessCopy.success) bad("reportWriteSchema accepted a copied-text report with no source");
else if (sourcelessCopy.error.issues[0]?.message !== REPORT_SOURCE_REQUIRED) {
  bad(`reportWriteSchema refused a sourceless copy claim for the wrong reason (${sourcelessCopy.error.issues[0]?.message})`);
} else ok("reportWriteSchema rejected a copy claim with no source");

const mismatchedPart = reportWriteSchema.safeParse({
  target: reportTarget,
  parts: ["avatar"],
  reasons: ["copied-text"],
});
if (mismatchedPart.success) bad("reportWriteSchema accepted copied-text on the avatar surface");
else if (mismatchedPart.error.issues[0]?.message !== REPORT_REASON_MISMATCH) {
  bad(`reportWriteSchema refused a mismatched reason for the wrong reason (${mismatchedPart.error.issues[0]?.message})`);
} else ok("reportWriteSchema rejected a reason that fits no chosen surface");

const mixed = reportWriteSchema.safeParse({
  target: reportTarget,
  parts: ["avatar", "text"],
  reasons: ["missing-nsfw", "copied-text"],
  source: CHARACTERS[1].id,
});
if (mixed.success) ok("reportWriteSchema accepted image + text with two reasons");
else bad(`reportWriteSchema refused a mixed report (${mixed.error.issues[0]?.message})`);

/* 3. The recursive shape: built from the flat rows, parsed through the lazy schema. */
console.log("== recursive shape");

/** `parentId` → replies, the tree a comment thread page renders. */
function buildTree(rows: typeof COMMENTS): CommentBranch[] {
  const byParent = new Map<string | null, typeof COMMENTS>();
  for (const row of rows) {
    const bucket = byParent.get(row.parentId) ?? [];
    bucket.push(row);
    byParent.set(row.parentId, bucket);
  }
  const branch = (row: (typeof COMMENTS)[number]): CommentBranch => ({
    comment: row,
    replies: (byParent.get(row.id) ?? []).map(branch),
  });
  return (byParent.get(null) ?? []).map(branch);
}

const tree = buildTree(COMMENTS);
const parsedTree = commentThreadSchema.safeParse(tree);
const deepest = (nodes: CommentBranch[]): number =>
  nodes.reduce((depth, node) => Math.max(depth, 1 + deepest(node.replies)), 0);
const counted = (nodes: CommentBranch[]): number =>
  nodes.reduce((sum, node) => sum + 1 + counted(node.replies), 0);

if (parsedTree.success) {
  ok(
    `${counted(tree)} comments in ${tree.length} roots, depth ${deepest(tree)}, type ${commentBranchIsTyped ? "not any" : "any"}`,
  );
} else {
  const issue = parsedTree.error.issues[0];
  bad(`commentBranchSchema rejected the thread — ${issue?.path.join(".")}: ${issue?.message}`);
}
if (counted(tree) !== COMMENTS.length) bad("the comment tree lost rows");
else ok(`every one of ${COMMENTS.length} comment rows is in the tree`);

if (failures > 0) {
  console.log(`SCHEMA RED — ${failures} failing`);
  process.exit(1);
}
console.log("SCHEMA GREEN");
