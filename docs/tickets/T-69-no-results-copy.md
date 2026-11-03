# T-69 — the persona no-match sentence runs two words together

**Where it came from.** T-68's row 51 read the no-match state's rendered text on `/persona` and it
came back as

```
No persona matches that name. Create oneif it is not here yet.
```

`persona-collection.tsrx` writes it as

```tsrx
<p class="no-results" role="status">
  No persona matches that name.{" "}
  <a class="no-results-link" href={href("/persona/create")} onClick={follow("/persona/create")}>Create one</a> if it is not here yet.
</p>
```

so the source has the space — it is the **text node after the element** that loses it. Ripple
trims the leading whitespace of a literal that follows an inline element, so `</a> if` renders
`</a>if`. The `{" "}` before the link survived because it is an explicit expression, not literal
text.

## The ticket

1. **Fix the sentence** — the space has to be an explicit `{" "}`, not a literal:

   ```tsrx
   <a …>Create one</a>{" "}if it is not here yet.
   ```

   Read the other copy on the same page before editing: the sentence is quoted in
   `persona/collection.md` (*No results*) — match it exactly, including which half is the link.

2. **Sweep the class, not the site.** The same shape (a literal starting with a space, directly after
   `</a>`, `</b>`, `</span>`, `</strong>` or any element, inside a text-carrying block) silently
   loses the word break on every page. Grep the pages for `</a> `, `</span> `, `</b> ` followed by a
   letter, and for a `}`-closed expression followed by a literal beginning with a space; fix each
   one with `{" "}`. Cron's shell refuses `bash -c`/`node -e`: write a `.py` under `$TMPDIR`, run it
   with `python3`, and apply edits bottom-up per file so the line numbers stay valid (T-48's shape).
   **A hand sweep is a list; the row is the guard** — the walk clause below is the mechanical check,
   so name in `PROGRESS.md` which sites the sweep touched and which the row proves.

3. **One clause in row 51** (it already reads the sentence, so nothing new is fetched): assert the
   rendered copy has the word break — `noResults` must contain `"Create one if"` **and** must not
   contain `"oneif"`. A `includes(" ")` check proves nothing; name both halves in the failure
   message so a regression reads as the run-together string it is.

## Traps

- **`innerText` vs `textContent`.** Row 51 reads `textContent` collapsed through `\s+` — a real
  space survives that, so the absence above is the DOM's, not the reader's. Do not "fix" the row's
  reader to add a space between adjacent nodes; that would hide the bug the clause exists for.
- **The no-match state is not the empty collection.** `anyPersona` false draws *"You have no
  personas yet…"*; the run-together string is only on the `items.length === 0` branch, which needs a
  query that matches nothing (`?q=zzqx-nothing-matches`). Row 41 leaves **two** personas, so the
  empty branch is not the one this page draws.
- **`.no-results` is the persona page's own class**; the catalogues use `EmptyState` →
  `.empty-copy`. Row 51 already reads both, so a sweep that fixes the catalogues must not change
  which selector the row polls.
- **Red proof:** restore the literal `</a> if it is not here yet.` (bytes as they are today) and the
  clause must fail naming the run-together string. Then put the `{" "}` back and re-run.

## Accept

`./scripts/check.sh` GREEN; walk **51/51** locally and **51/51 `--live`**; the clause proved red by
reverting the fix and naming the message in `PROGRESS.md`; `publish.sh` prints `LIVE` and `curl` is
200. No row count change (row 51 gains a clause — `EXPECTED_ROWS` stays 51).
