# Cogita: generated exercises and the knowledge landscape (design note, 2026-11-03 — built; as-built in COGITA.md §12, IMPLEMENTATION-LOG C17–C19)

Two independent changes. Both read only what schemas, templates, questions and views already declare; no kind
names, field keys or subjects appear in code. Everything runs in the browser and works in offline revisions.

## Task 1 — generated exercises

**One engine, one language.** The drawing expression language (`pages/motion/expr.ts`, used by Animation, `calc`,
`let`, `require`) grows lists, entry records and more functions. The question generator (`questionParams.ts`, now
`generator.ts`) becomes the one generator: questions use it through `params`/`let`/`require`, templates through a new
node `generate` with the same configuration. `random`, `calc`, `aggregate`, `entries`, `distractors` keep working and
use the same engine.

| Piece | Where | Reused |
| --- | --- | --- |
| lists `[a, b]`, `xs[i]`, records `it.field`, list functions, logic, math, text | `expr.ts` | parser, safety limits, `fmt` |
| entry draws, seed, redraws, skip with warning | `generator.ts` | `questionParams.ts` (kept as re-export), `selection.ts` rules |
| template node `generate` | `cardPalette.ts` | ports, `Item`, `entries` pools |
| per-show instance, seed and values in the answer | `cards.ts`, `RevisionRun.tsx`, `learn.ts` | `redrawCard`, `AnswerRecord.params` |
| text normalisation (`spaces`, `scripts`) | `check.ts` `TextRule` | `rule` of form `text` |
| samples in editors, warnings in the import preview | `QuestionFields.tsx`, `TemplateEditor.tsx`, `json.ts` | |

**New JSON keys** (all optional; old documents read as before):

```json
"params": [
  {"name": "s", "random": [20, 500], "step": 10},
  {"name": "cation", "entry": {"kind": "@chem/ion", "where": "it.charge > 0"}},
  {"name": "anion", "entry": {"kind": "@chem/ion", "where": "it.charge < 0 && it.id != cation.id"}},
  {"name": "events", "entries": {"kind": "@hist/event", "count": 4, "rule": {"op": "and", "items": [{"field": "data", "cmp": "filled"}]}}}
],
"let": [{"name": "n", "value": "lcm(cation.charge, -anion.charge)"}, {"name": "first", "value": "sortby(events, it.data)[0].label"}],
"require": ["len(events) == 4"],
"rule": {"spaces": true, "scripts": true}
```

- `entry` draws one entry record, `entries` a list (`count`: that many distinct, else all that match); `kind` is a
  kind reference, `rule` the existing rule syntax, `where` an expression with `it` (later draws may read earlier ones).
- A record has `id`, `label` and one key per field: numbers (quantities: the stored value; `<key>_si` in SI), text,
  choices, dates as sortable numbers `yyyymmdd` (`<key>_text` as written), references as records one level deep.
- Expression additions: list literals `[1, 2]`, indexing `xs[0]`, `it.field`; `len sum min max avg first last take drop
  slice reverse sort sortby shuffle choose pick filter map count any all contains index unique range join concat`;
  `if gcd lcm root log(x, b) sig fact binom isint`; `str sub sup plain upper lower`. `filter/map/sortby/count/any/all`
  take an expression evaluated per item with `it` and `i`. `shuffle/choose/pick` use the instance seed.
- Template node `{"type": "generate", "config": {"params": [...], "let": [...], "require": [...]}}`: one output port per
  declared name; `this` is the record of the card's entry.
- Answers store `seed` and `params` (scalars, entry ids, short lists). The card key stays `template:entry`.
- **History restarts** when the generator definition changes (params, let, require, answers/options formulas, or a
  template graph with chance nodes) — as with "the correct answer changed" today. New instances never restart it.
- If 60 redraws find no valid instance the card is not made; authors see it in the editor, "Do zrobienia" and the
  import preview.

## Task 2 — the knowledge landscape

**A view mode, not a module.** `"mode": "landscape"` beside `table … quilt`, in the page module `view` as
`"mode": "krajobraz"`. `map` stays as it is (a small prerequisite graph in fog); the landscape is its successor for
large bases and shares the data layer (`gauge`, bands, the prerequisite graph).

| Piece | Where | Reused |
| --- | --- | --- |
| heights, closure counts, routes, lock, layout, budget/focus (pure) | `landscape.ts` + `landscape.worker.ts` | `prerequisiteGraph`, `gauge`, bands, `axisMembers`, `structure` |
| drawing (isometric hex amphitheatre), panel, keyboard/list alternative | `LandscapeView.tsx` | entry panel of the quilt, `RevisionRun`, Nowy temat |
| lock as a condition | `knowing.ts` relation `chain` | `filter.when`, bands |
| goal pin | learner progress (sealed, synced) | `Learner.keepPosition` |
| page module | `pages/parts/view.tsx` | `answers`, `rewards` as in `cogita-revision` |

**New JSON keys:**

```json
{"ref": "@world/v-landscape", "name": "Knowledge landscape", "mode": "landscape",
 "steps": [{"type": "source.kind", "config": {"kind": "@world/topic"}}],
 "group": {"by": "axis", "kind": "@world/tag", "via": ["tags"]},
 "landscape": {"budget": 60}}
```

- Condition `{"type": "knowness", "rel": "chain", "band": "known"}`: every already answered card in the transitive
  prerequisite chain sits (≥ 1). Never asked cards do not count. Usable in any view or revision.
- Page module: `{"kind": "view", "config": {"mode": "krajobraz", "answers": "<area>", "rewards": "<reward doc>"}}`.

**Heights** follow the table of the task: −1 known, −(k−0.1)/0.9 due, 0 learnable now, n ≥ 1 = distinct not-learned
learnable entries in the transitive closure (union; a strongly connected component is one step; entries without cards
are transparent). Computed with bitsets over the condensed graph in topological order.

## Compatibility

New keys are optional; missing keys keep today's behaviour. Import never deletes and never touches answers. Formats,
guides and the example course are generated from the same sources (`import-formats.mjs`).
