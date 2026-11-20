/**
 * 2026-11-20 — ADAPTIVE ABLÄUFE (`cogita/adaptive.ts`), ohne Browser:
 *   1. rückwärts verträglich: ein Ablauf ohne adaptive Einstellungen geht über „right"/„wrong" genau wie `advance`;
 *   2. jeder neue Ausgang (partial, rightOnRetry, wrong:<tag>, pick:<i>) — und sein Rückfall ohne Weg;
 *   3. retry: Folien, dieselbe Frage noch einmal, beide Versuche im Log (und beide zählen für die Kenntnis), nach dem letzten „wrong";
 *   4. die Kurzformen onWrong (show, byTag, check, then) und onRight.skip, aufgeklappt — gespeichert bleibt die Kurzform;
 *   5. die Bedingungen des Laufs: session (since unit/flowStart/Schritt), lastAnswer, streak — auch in skipWhen und Möglichkeiten;
 *   6. die Fehler-Tags einer Antwort je Art (one, many, match, gap, order) und die Wahl (pick);
 *   7. Ścieżka und Weltkarte: Nachhilfe zählt nie (keine Teile, keine Halte, keine Gabel), nur „N Schritte" / kleine Schleife;
 *   8. Prüfung und Vorschau: Warnungen, Zeilen je Frage; das Beispiel „example-adaptive" importiert ohne Warnung und geht unverändert hinaus;
 *   9. Einsicht für Autoren: nur zusammengezählt.
 *
 *   node scripts/app-adaptive-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-adaptive-'));
const entries = {
  logic: 'src/app/cogita/logic.ts', flow: 'src/app/cogita/flow.ts', ad: 'src/app/cogita/adaptive.ts', running: 'src/app/cogita/runningStory.ts',
  sp: 'src/app/cogita/storyPath.ts', check: 'src/app/cogita/flowCheck.ts', wg: 'src/app/cogita/worldmap/wmGraph.ts', wl: 'src/app/cogita/worldmap/wmLines.ts',
  fx: 'src/app/cogita/worldmap/wmFixtures.ts', mem: 'src/app/cogita/memoryBase.ts', json: 'src/app/cogita/json.ts', kn: 'src/app/cogita/knowness.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [LG, FL, AD, RS, SP, FC, WG, WL, FX, MEM, JS, KN] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* Ein Ablauf aus Schritten und Wegen ([from, out, to]). */
const flowOf = (nodes, edges, extra = {}, opts = {}) => FL.readFlow('F', {
  name: 'F', start: nodes[0][0], ...extra,
  graph: { nodes: nodes.map(([id, type, config = {}], i) => ({ id, type, x: i * 10, y: 0, config })), edges: edges.map(([from, out, to], i) => ({ id: `e${i}`, from, out, to, in: 'in' })) }
}, opts);
const ctxOf = (flow) => ({ facts: (s) => ({ values: s.values, knowness: () => 0, answered: () => null, visited: new Set(s.visited), now: new Date(0), session: FL.sessionOf(s) }), flows: (id) => (id === flow.id ? flow : undefined), members: () => [] });
const start = (flow) => FL.startFlow(flow);
const answer = (flow, state, input) => FL.answerStep(flow, state, input, ctxOf(flow));
const at = (s) => (s.ended ? 'END' : s.step);

/* -- 1. Rückwärts verträglich ------------------------------------------------------------------------------------------ */
{
  const f = flowOf([['q', 'question', { of: 'Q' }], ['a', 'show'], ['b', 'show'], ['z', 'end']], [['q', 'right', 'a'], ['q', 'wrong', 'b'], ['a', 'next', 'z'], ['b', 'next', 'z']]);
  const s = start(f);
  const viaAdvance = [at(FL.advance(f, s, 'right', ctxOf(f))), at(FL.advance(f, s, 'wrong', ctxOf(f)))];
  const viaAnswer = [at(answer(f, s, { score: 1, correct: true })), at(answer(f, s, { score: 0, correct: false })), at(answer(f, s, { score: 0.5, correct: false, tags: ['x'], picks: [2] }))];
  check('compat: a plain question goes right/wrong exactly as advance (tags and picks without edges change nothing)', [viaAdvance, viaAnswer], [['a', 'b'], ['a', 'b', 'b']]);
  check('compat: the card verdict ("correct") counts while the step has no "rightAt"', at(answer(f, s, { score: 0.97, correct: true })), 'a');
  check('compat: exits of a plain question are only right/wrong', FL.exitsOf('question', {}).map((p) => p.id), ['right', 'wrong']);
  const noWrong = flowOf([['q', 'question', { of: 'Q' }], ['a', 'show'], ['z', 'end']], [['q', 'right', 'a'], ['a', 'next', 'z']]);
  check('compat: "wrong" without an edge still ends the flow (as before)', answer(noWrong, start(noWrong), { score: 0 }).ended, true);
  check('compat: readFlow of a flow without shorthand is unchanged (no help steps)', f.graph.nodes.length, 4);
}

/* -- 2. Neue Ausgänge und ihr Rückfall --------------------------------------------------------------------------------- */
{
  const nodes = [['q', 'question', { of: 'Q', partialAt: 0.5, rightAt: 1 }], ['R', 'show'], ['W', 'show'], ['P', 'show'], ['T', 'show', { remedial: true }], ['K', 'show'], ['z', 'end']];
  const all = flowOf(nodes, [['q', 'right', 'R'], ['q', 'wrong', 'W'], ['q', 'partial', 'P'], ['q', 'wrong:lit', 'T'], ['q', 'pick:2', 'K'], ...['R', 'W', 'P', 'T', 'K'].map((x) => [x, 'next', 'z'])]);
  const s = start(all);
  check('exits: partial (≥ partialAt), wrong:<tag>, wrong, right, pick:<i> (checked first)', [
    at(answer(all, s, { score: 0.6 })), at(answer(all, s, { score: 0.2, tags: ['lit'] })), at(answer(all, s, { score: 0.2, tags: ['other'] })), at(answer(all, s, { score: 1 })), at(answer(all, s, { score: 1, picks: [2] })), at(answer(all, s, { score: 1, picks: [1] }))
  ], ['P', 'T', 'W', 'R', 'K', 'R']);
  check('exits: the editor ports come from "partialAt", "tags", "picks" (declared from edges on read)', FL.exitsOf('question', all.graph.nodes[0].config).map((p) => p.id), ['right', 'wrong', 'partial', 'wrong:lit', 'pick:0', 'pick:1', 'pick:2']);
  const fallback = flowOf([['q', 'question', { of: 'Q', partialAt: 0.5 }], ['R', 'show'], ['W', 'show'], ['z', 'end']], [['q', 'right', 'R'], ['q', 'wrong', 'W'], ['R', 'next', 'z'], ['W', 'next', 'z']]);
  check('fallback: partial without an edge is wrong; a tag without an edge is wrong', [at(answer(fallback, start(fallback), { score: 0.7 })), at(answer(fallback, start(fallback), { score: 0, tags: ['lit'] }))], ['W', 'W']);
  const lg = answer(all, s, { score: 0.6, hints: 1, ms: 900, tags: [] }).log;
  check('the answer goes into the run log (score, partial, hints, time, attempt)', lg.map((a) => [a.step, a.score, a.correct, a.partial, a.hints, a.ms, a.attempt]), [['q', 0.6, false, true, 1, 900, 0]]);
}

/* -- 3. retry ------------------------------------------------------------------------------------------------------------ */
{
  const f = flowOf([['q', 'question', { of: 'Q', retry: { after: ['S1', 'S2'], max: 1 } }], ['R', 'show'], ['RR', 'show'], ['W', 'show'], ['z', 'end']],
    [['q', 'right', 'R'], ['q', 'rightOnRetry', 'RR'], ['q', 'wrong', 'W'], ['R', 'next', 'z'], ['RR', 'next', 'z'], ['W', 'next', 'z']]);
  const help = f.graph.nodes.filter((n) => n.config.remedial === true).map((n) => [n.id, n.config.of]).sort((x, y) => x[0].localeCompare(y[0]));
  check('retry: the slides become help steps q~r0, q~r1 (remedial), the last leads back to the question', [help, f.graph.edges.find((e) => e.from === 'q~r1')?.to], [[['q~r0', 'S1'], ['q~r1', 'S2']], 'q']);
  let s = start(f);
  s = answer(f, s, { score: 0 });
  const first = [at(s), s.tries.q];
  s = FL.advance(f, s, 'next', ctxOf(f));
  s = FL.advance(f, s, 'next', ctxOf(f));
  const back = at(s);
  const afterRight = answer(f, s, { score: 1 });
  const afterWrong = answer(f, s, { score: 0 });
  check('retry: wrong → slides → the same question; right on retry → "rightOnRetry"; wrong again → "wrong"', [first, back, at(afterRight), at(afterWrong)], [['q~r0', 1], 'q', 'RR', 'W']);
  check('retry: both attempts are in the log (attempt 0 and 1), the try counter is cleared after the last', [afterRight.log.map((a) => [a.correct, a.attempt]), afterRight.tries.q], [[[false, 0], [true, 1]], undefined]);
  check('retry: right on the first try → "right"', at(answer(f, start(f), { score: 1 })), 'R');
  const noRetryEdge = flowOf([['q', 'question', { of: 'Q', retry: { max: 1 } }], ['R', 'show'], ['z', 'end']], [['q', 'right', 'R'], ['R', 'next', 'z']]);
  let n = answer(noRetryEdge, start(noRetryEdge), { score: 0 });
  const again = at(n);
  n = answer(noRetryEdge, n, { score: 1 });
  check('retry without slides: the question again at once; "rightOnRetry" without an edge falls back to "right"; no wrong edge → where right leads', [again, at(n), at(answer(noRetryEdge, answer(noRetryEdge, start(noRetryEdge), { score: 0 }), { score: 0 }))], ['q', 'R', 'R']);
  /* Kenntnis und Plan: beide Antworten zählen (eine falsche, dann eine richtige ist nicht dasselbe wie nur eine richtige). */
  const t0 = Date.UTC(2026, 10, 20);
  const both = KN.knownessOf([{ at: t0, correctness: 0 }, { at: t0 + 60_000, correctness: 1 }], t0 + 120_000);
  const once = KN.knownessOf([{ at: t0 + 60_000, correctness: 1 }], t0 + 120_000);
  check('retry: both attempts count for scheduling and mastery (wrong-then-right ≠ right once)', both !== once, true);
}

/* -- 4. Kurzformen ------------------------------------------------------------------------------------------------------- */
{
  const cfg = { of: 'Q', onWrong: { show: ['G1'], byTag: { lit: ['T1', 'T2'] }, check: 'Q2', then: 'continue' }, onRight: { skip: ['BASIC'] } };
  const nodes = [['q', 'question', cfg], ['basic', 'show', { of: 'BASIC' }], ['next', 'show', { of: 'N' }], ['z', 'end']];
  const edges = [['q', 'right', 'basic'], ['basic', 'next', 'next'], ['next', 'next', 'z']];
  const f = flowOf(nodes, edges);
  const authored = flowOf(nodes, edges, {}, { authored: true });
  check('shorthand: authored (editor, export) keeps the shorthand and adds no steps', [authored.graph.nodes.length, authored.graph.nodes[0].config.onWrong.then], [4, 'continue']);
  check('shorthand: expanded — generic chain, one chain per tag, the check question (all remedial)', f.graph.nodes.filter((n) => n.config.remedial === true).map((n) => `${n.type}:${n.config.of}`).sort(), ['question:Q2', 'show:G1', 'show:T1', 'show:T2']);
  let s = answer(f, start(f), { score: 0, tags: ['lit'] });
  const path = [at(s)];
  for (let i = 0; i < 2; i += 1) { s = FL.advance(f, s, 'next', ctxOf(f)); path.push(at(s)); }
  s = answer(f, s, { score: 1 });
  path.push(at(s));
  check('shorthand continue: wrong with a tag → its slides → the check → on (no old wrong edge: where right leads)', path, ['q~t0_0', 'q~t0_1', 'q~wc', 'basic']);
  check('shorthand continue: wrong without a tag → the generic slide', at(answer(f, start(f), { score: 0 })), 'q~w0');
  check('onRight.skip: right → the basic slide is skipped', at(answer(f, start(f), { score: 1 })), 'next');
  const r = flowOf([['q', 'question', { of: 'Q', onWrong: { show: ['G1'], check: 'Q2', then: 'retry', max: 1 } }], ['R', 'show'], ['RR', 'show'], ['z', 'end']], [['q', 'right', 'R'], ['q', 'rightOnRetry', 'RR'], ['R', 'next', 'z'], ['RR', 'next', 'z']]);
  let t = answer(r, start(r), { score: 0 });
  const seq = [at(t)];
  t = FL.advance(r, t, 'next', ctxOf(r)); seq.push(at(t));
  t = answer(r, t, { score: 0 }); seq.push(at(t));
  t = answer(r, t, { score: 1 }); seq.push(at(t));
  check('shorthand retry: slides → check (either answer) → the question again → "rightOnRetry"', seq, ['q~w0', 'q~wc', 'q', 'RR']);
  check('shorthand retry: after the last try "wrong" (no edge: where right leads)', at(answer(r, answer(r, FL.advance(r, answer(r, start(r), { score: 0 }), 'next', ctxOf(r)), { score: 1 }), { score: 0 })), 'R');
}

/* -- 5. Bedingungen des Laufs ----------------------------------------------------------------------------------------------- */
{
  const log = [
    { flow: 'F', step: 'a', score: 0, correct: false, partial: false, tags: ['lit'], hints: 1, ms: 4000, attempt: 0 },
    { flow: 'F', step: 'b', score: 1, correct: true, partial: false, tags: [], hints: 0, ms: 2000, attempt: 0 },
    { flow: 'F', step: 'c', score: 0.5, correct: false, partial: true, tags: [], hints: 2, ms: 9000, attempt: 0 },
    { flow: 'F', step: 'd', score: 0, correct: false, partial: false, tags: ['lit', 'x'], hints: 0, ms: 1000, attempt: 0 }
  ];
  const facts = { values: {}, knowness: () => 0, answered: () => null, visited: new Set(), now: new Date(0), session: FL.sessionOf({ flow: 'F', log, at: { '^F': 1, c: 2 } }) };
  const h = (raw) => LG.holds(LG.readCondition(raw), facts);
  check('session: wrong ≥ 3 (unit) · ≥ 3 since flowStart · ≥ 2 since a step · partial · hintsUsed · right', [
    h({ type: 'session', wrong: { op: 'ge', than: 3 } }), h({ type: 'session', since: 'flowStart', wrong: { op: 'ge', than: 3 } }), h({ type: 'session', since: 'c', wrong: 2 }),
    h({ type: 'session', partial: { op: 'eq', than: 1 } }), h({ type: 'session', hintsUsed: { op: 'ge', than: 3 } }), h({ type: 'session', right: { op: 'ge', than: 2 } })
  ], [true, false, true, true, true, false]);
  check('lastAnswer: correct false · tag · partial · hintsUsed · timeMs', [h({ type: 'lastAnswer', correct: false }), h({ type: 'lastAnswer', tag: 'x' }), h({ type: 'lastAnswer', partial: true }), h({ type: 'lastAnswer', hintsUsed: { op: 'ge', than: 1 } }), h({ type: 'lastAnswer', timeMs: { op: 'lt', than: 2000 } })], [true, true, false, false, true]);
  check('streak: wrong 1 · wrong 2 (partly right is not right) · wrong 3 · right 1', [h({ type: 'streak', wrong: 1 }), h({ type: 'streak', wrong: 2 }), h({ type: 'streak', wrong: 3 }), h({ type: 'streak', right: 1 })], [true, true, false, false]);
  check('no session (outside the player): nothing holds', LG.holds(LG.readCondition({ type: 'session', wrong: 1 }), { ...facts, session: undefined }), false);
  check('the editor form ("measure") reads the same', LG.readCondition(LG.readCondition({ type: 'session', since: 'q1', wrong: { op: 'ge', than: 3 } })), { type: 'session', measure: 'wrong', op: 'ge', than: 3, since: 'q1' });
  check('in words', LG.conditionText(LG.readCondition({ type: 'session', wrong: { op: 'ge', than: 3 } })), 'wrong answers since the start of this run ≥ 3');
  check('usesSession sees it inside gates', [LG.usesSession(LG.readCondition({ type: 'and', items: [{ type: 'value', value: 'v' }, { type: 'streak', right: 2 }] })), LG.usesSession(LG.readCondition({ type: 'value', value: 'v' }))], [true, false]);
  /* In einem Ablauf: Rückblick nach drei Fehlern; skipWhen und eine Möglichkeit mit Bedingung. */
  const f = flowOf([['q1', 'question', { of: 'A' }], ['q2', 'question', { of: 'B' }], ['q3', 'question', { of: 'C' }], ['c', 'condition', { condition: { type: 'session', wrong: { op: 'ge', than: 3 } } }], ['recap', 'show', { of: 'R' }], ['tip', 'show', { of: 'T', skipWhen: { type: 'streak', right: 3 } }], ['z', 'end']],
    [['q1', 'right', 'q2'], ['q1', 'wrong', 'q2'], ['q2', 'right', 'q3'], ['q2', 'wrong', 'q3'], ['q3', 'right', 'c'], ['q3', 'wrong', 'c'], ['c', 'yes', 'recap'], ['c', 'no', 'tip'], ['recap', 'next', 'tip'], ['tip', 'next', 'z']]);
  const run = (scores) => scores.reduce((s, x) => answer(f, s, { score: x }), start(f));
  check('a recap after 3 or more errors; "skipWhen" streak skips the tip after 3 right', [at(run([0, 0, 0])), at(run([1, 0, 0])), at(run([1, 1, 1]))], ['recap', 'tip', 'END']);
}

/* -- 6. Fehler-Tags einer Antwort ------------------------------------------------------------------------------------------- */
{
  const one = { answer: { form: 'one', options: ['B', 'A', 'C'], correct: 1 } };
  const dOne = { options: ['A', 'B', 'C'], correct: [0], tags: ['', 'mix', 'lit'] };
  check('one: the tag of the chosen wrong option; picks in the order of "options"', [AD.answerSignals(one, dOne, 0, { correctness: 0 }), AD.answerSignals(one, dOne, 1, { correctness: 1 })], [{ tags: ['mix'], picks: [1] }, { tags: [], picks: [0] }]);
  const many = { answer: { form: 'many', options: ['A', 'B', 'C'], correct: [0, 2] } };
  check('many: a wrong tick and a missed right one both carry their tags', AD.answerSignals(many, { options: ['A', 'B', 'C'], correct: [0, 2], tags: ['missA', 'tickB', 'missC'] }, [0, 1], { correctness: 0.3 }), { tags: ['tickB', 'missC'], picks: [0, 1] });
  const match = { answer: { form: 'match', left: ['y', 'x'], right: ['2', '1'], pairs: [[1, 1], [0, 0]] } };
  check('match: the tag of each wrongly joined pair', AD.answerSignals(match, { left: ['x', 'y'], right: ['1', '2'], tags: ['px', 'py'] }, [[1, 0], [0, 0]], { correctness: 0.5 }).tags, ['px']);
  check('gap: the tag of each wrong gap (from the marks)', AD.answerSignals({ answer: { form: 'gap' } }, { tags: ['g1', 'g2', 'g3'] }, ['a', 'b', 'c'], { correctness: 0.3, marks: [true, false, false] }).tags, ['g2', 'g3']);
  check('order: the tag of each wrong position', AD.answerSignals({ answer: { form: 'order', items: ['a', 'b', 'c'] } }, { tags: ['', 'tb', 'tc'] }, ['a', 'c', 'b'], { correctness: 0.3 }).tags, ['tb', 'tc']);
}

/* -- 7. Ścieżka, Prüfung, Weltkarte ------------------------------------------------------------------------------------------ */
{
  const nodes = [['s', 'show', { of: 'S' }], ['q', 'question', { of: 'Q', onWrong: { show: ['H1', 'H2'], check: 'Q2', then: 'retry' } }], ['t', 'show', { of: 'T' }], ['q2', 'question', { of: 'Q3' }], ['help', 'show', { of: 'H3' }], ['z', 'end']];
  const edges = [['s', 'next', 'q'], ['q', 'right', 't'], ['q', 'rightOnRetry', 't'], ['t', 'next', 'q2'], ['q2', 'right', 'z'], ['q2', 'wrong', 'z'], ['q2', 'wrong:lit', 'help'], ['help', 'next', 'z']];
  const f = flowOf(nodes, edges);
  const sp = SP.storyPath(f, SP.stepWorkOf(() => []), (x) => x);
  const steps = sp.parts.flatMap((p) => p.steps);
  check('path: help steps are in no part', steps.filter((x) => x.includes('~') || x === 'help'), []);
  check('path: slides and questions count only the main path', [sp.parts.reduce((n, p) => n + p.slides, 0), sp.parts.reduce((n, p) => n + p.questions, 0)], [2, 2]);
  check('path: the parts carry "N help steps" (2 slides + check on q, 1 slide on q2)', sp.parts.map((p) => p.remedial ?? 0).filter((n) => n > 0).sort(), [1, 3]);
  check('path: no fork from answer exits; the model carries the help count', [sp.parts.some((p) => p.fork !== undefined), sp.model.nodes.some((n) => (n.remedial ?? 0) > 0)], [false, true]);
  check('check: no dead ends for adaptive outputs without edges', FC.flowProblems(f).map((p) => p.text), []);
  const authored = flowOf(nodes, edges, {}, { authored: true });
  const probs = AD.adaptiveProblems(authored.graph, f.graph, { tagsOf: (q) => (q === 'Q3' ? ['other'] : []), topicsOf: (q) => (q === 'Q' ? ['TOPIC'] : []), linksOf: (e) => (e === 'H1' ? ['TOPIC'] : []) });
  check('warnings: an edge to a tag the question lacks, a tag without an edge, a help slide off topic', probs.map((p) => `${p.key}:${p.step}:${p.params.tag ?? p.params.slide ?? ''}`).sort(), ['edgeNoTag:q2:lit', 'offTopic:q:H2', 'tagNoEdge:q2:other']);
  const loop = flowOf([['q', 'question', { of: 'Q' }], ['h', 'show', { remedial: true }], ['h2', 'show', { remedial: true }], ['z', 'end']], [['q', 'right', 'z'], ['q', 'wrong', 'h'], ['h', 'next', 'h2'], ['h2', 'next', 'h']]);
  check('warnings: help without a way back; retry max > 2', [AD.adaptiveProblems(loop.graph, loop.graph, { tagsOf: () => null, topicsOf: () => [], linksOf: () => [] }).map((p) => p.key), AD.adaptiveProblems(flowOf([['q', 'question', { retry: { max: 3 } }]], []).graph, flowOf([['q', 'question', { retry: { max: 3 } }]], []).graph, { tagsOf: () => null, topicsOf: () => [], linksOf: () => [] }).map((p) => p.key)], [['noExit', 'noExit'], ['retryMax']]);
  check('summary for the import preview', AD.branchSummaries(authored.graph).map((s) => [s.step, s.tags, s.remediation?.then ?? null]), [['q', [], 'retry'], ['q2', ['lit'], null]]);

  /* Die Weltkarte: dieselbe Linie mit und ohne Nachhilfe — dieselben Halte und Abschnitte, nur die Schleife am Turm. */
  const bx = FX.boskoWorld();
  const world = WG.readWorld(bx.input);
  const [pa, pb] = world.order.slice(0, 2);
  const lineWith = (help) => {
    const b = new FX.FlowBuilder('A');
    b.show(`s/${pa}`);
    const q = b.ask(world.places.get(pa).cards[0]);
    b.show(`s/${pb}`); b.end();
    if (help) { const n = b.nodes.find((x) => x.id === q); n.config = { ...n.config, onWrong: { show: [`s/${pb}`, `s/${pa}`], then: 'continue' } }; }
    return WL.linesOf(world, [b.flow('f/a', { name: 'A', unit: 'u/L1' })]);
  };
  const plain = lineWith(false);
  const helped = lineWith(true);
  const shape = (ls) => [...ls.sections.values()].map((s) => `${s.from}>${s.to}:${s.steps.length}`).sort();
  check('world map: help adds no section, stop or step', [shape(helped), [...helped.stations.keys()].sort()], [shape(plain), [...plain.stations.keys()].sort()]);
  check('world map: the help counts at the tower of its question (a small loop there)', [helped.remedial?.get(pa) ?? 0, plain.remedial?.get(pa) ?? 0], [2, 0]);
  const sess = new FX.FlowBuilder('B');
  sess.show(`s/${pa}`);
  sess.gate({ type: 'session', wrong: { op: 'ge', than: 3 } });
  sess.show(`s/${pb}`); sess.end();
  const gl = WL.linesOf(world, [sess.flow('f/b', { name: 'B', unit: 'u/L1' })]);
  check('world map: a condition on the run is no gate (no ticket)', [...gl.sections.values()].flatMap((s) => s.ticket).filter((x) => x.source === 'gate').length, 0);
}

/* -- 8. Das Beispiel: Import, Vorschau, Export ------------------------------------------------------------------------------- */
{
  const doc = JSON.parse(await readFile('../templates/cogita/przyklad-adaptacyjny.json', 'utf8'));
  const base = await MEM.memoryBase(doc, { libraryId: 'adaptiv' });
  if ('error' in base) throw new Error(base.error);
  check('example: imports without warnings', base.warnings, []);
  const plan = JS.planImport(base.writer, doc);
  check('example: the preview lists each branching question', plan.lines.filter((l) => l.startsWith('Flow “')).length, 2);
  const out = JS.exportCourse(base.lib, 'x');
  const flowOut = out.flows[0];
  const sonda = flowOut.graph.nodes.find((n) => n.id === 'sonda');
  check('example: export keeps the shorthand with lasting names, adds no help steps', [flowOut.graph.nodes.length, sonda.config.onWrong.then, sonda.config.onWrong.check, sonda.config.onRight.skip], [9, 'retry', '@adapt/q/latwe', ['@adapt/s/podstawy']]);
  const played = FL.readFlow('x', base.lib.docs('flow')[0].data);
  check('example: played expanded (help steps for the shorthand)', played.graph.nodes.filter((n) => n.config.remedial === true).length, 6);
}

/* -- 9. Einsicht, nur zusammengezählt ---------------------------------------------------------------------------------------- */
{
  const a = [
    { at: 1, correctness: 0, via: 'F', branch: 'F|q|retry', tags: ['lit'] }, { at: 2, correctness: 1, via: 'F', branch: 'F|q|rightOnRetry' }, { at: 3, correctness: 1, via: 'F' }
  ];
  const b = [{ at: 1, correctness: 0, via: 'F', branch: 'F|q|retry', tags: ['lit', 'mix'] }, { at: 2, correctness: 0, via: 'F', branch: 'F|q|wrong' }];
  const ins = AD.branchInsight([a, b]);
  check('insight: per branch taken / next check right; per tag occurrences (no learner in the result)', [ins.branches.map((x) => [x.exit, x.taken, x.checked, x.right]), ins.tags], [[['retry', 2, 2, 1], ['rightOnRetry', 1, 1, 1], ['wrong', 1, 0, 0]], [{ tag: 'lit', count: 2 }, { tag: 'mix', count: 1 }]]);
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
