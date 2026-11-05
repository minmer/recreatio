/**
 * 2026-11-04 (Prompt 13) — ABSTECHER IN EINE ANDERE ERZÄHLUNG, nachgemessen (`detour.ts`, `runningStory.ts`, `flow.ts`):
 * hinein und an „done" zurück, „skip", ein Pflicht-Abstecher, höchstens 3 ineinander, ein Kreis (abgelehnt, beim Namen),
 * der Przegląd zählt nur eigene Fragen, die Zähler (ausgelassen = durch), „Wróć do …", wieder im Abstecher nach dem
 * Neuladen (aus der Stelle der äusseren Erzählung), „newer wins" für `inside`, und die Reihenfolge von „Co dalej".
 *
 *   node scripts/app-detour-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-detour-'));
const entries = {
  flow: 'src/app/cogita/flow.ts', running: 'src/app/cogita/runningStory.ts', detour: 'src/app/cogita/detour.ts', path: 'src/app/cogita/storyPath.ts',
  learn: 'src/app/cogita/learn.ts', check: 'src/app/cogita/flowCheck.ts', next: 'src/app/cogita/storyNext.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [FL, RS, DT, SP, LN, FC, NX] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* -- Abläufe ---------------------------------------------------------------------------------------------------- */
const node = (id, type, config = {}) => ({ id, type, x: 0, y: 0, config });
let edgeNo = 0;
const edge = (from, out, to) => ({ id: `e${(edgeNo += 1)}`, from, out, to, in: 'in' });
const flowOf = (id, name, nodes, edges, more = {}) => FL.readFlow(id, { name, start: nodes[0].id, graph: { nodes, edges }, ...more });
/** Ein Abstecher mit „done" und „skip" zum selben nächsten Schritt. */
const detourTo = (id, target, to, config = {}) => [node(id, 'detour', { flow: target, ...config }), [edge(id, 'done', to), ...(config.optional === false ? [] : [edge(id, 'skip', to)])]];

const [d1, d1e] = detourTo('d1', 'B', 's2', { label: 'Chcesz wiedzieć więcej: Dom w Becchi' });
const [d2, d2e] = detourTo('d2', 'C', 's3');
const O = flowOf('O', 'Etap 1', [node('s1', 'show', { of: 'x1' }), d1, node('s2', 'show', { of: 'x2' }), d2, node('s3', 'question', { of: 'q-o' }), node('oEnd', 'end')],
  [edge('s1', 'next', 'd1'), ...d1e, edge('s2', 'next', 'd2'), ...d2e, edge('s3', 'right', 'oEnd'), edge('s3', 'wrong', 'oEnd')]);
const B = flowOf('B', 'Dom w Becchi', [node('b1', 'show', { of: 'y1' }), node('b2', 'question', { of: 'q-b' }), node('bEnd', 'end')],
  [edge('b1', 'next', 'b2'), edge('b2', 'right', 'bEnd'), edge('b2', 'wrong', 'bEnd')]);
const C = flowOf('C', 'Szkoła w Chieri', [node('c1', 'show', { of: 'z1' }), node('c2', 'question', { of: 'q-c' }), node('cEnd', 'end')],
  [edge('c1', 'next', 'c2'), edge('c2', 'right', 'cEnd'), edge('c2', 'wrong', 'cEnd')]);
const all = { O, B, C };
const flows = (id) => all[id];
const ctx = {
  facts: (s) => ({ values: s.values, knowness: () => 0, answered: () => null, visited: new Set(s.visited), now: new Date(0), flow: () => undefined }),
  flows, members: () => []
};

/* -- Hinein, zurück an „done", „skip" ----------------------------------------------------------------------------- */
check('a detour step: exits done and skip; required: only done', [FL.exitsOf('detour', {}).map((p) => p.id), FL.exitsOf('detour', { optional: false }).map((p) => p.id), FL.exitsOf('detour', { required: true }).map((p) => p.id)],
  [['done', 'skip'], ['done'], ['done']]);
let r = RS.startRun(O, {}, ctx);
r = RS.stepRun(r, flows, 'next', ctx).run;
check('the detour waits for the learner (it never goes in by itself)', [r.state.flow, r.state.step, r.state.stack.length], ['O', 'd1', 0]);
let step = RS.detourIn(r, flows, ctx, null);
check('„Wejdź": the other story runs, the caller waits on the stack', [step.run.state.flow, step.run.state.step, step.run.state.stack.length, step.run.outer, step.run.root], ['B', 'b1', 1, [['s1', 'd1']], 'O']);
check('… its own visited steps (not the caller\'s)', step.run.state.visited, ['b1']);
check('… the outer story keeps where it waits and what is open (inside)', RS.insideOf(step.run, flows), { step: 'd1', visited: ['s1', 'd1'], inside: [{ flow: 'B', step: 'b1' }] });
const inB = step.run;
step = RS.stepRun(inB, flows, 'next', ctx);
step = RS.stepRun(step.run, flows, 'right', ctx);
check('its end returns to the calling story at the done exit (the next step of the overview)', [step.run.state.flow, step.run.state.step, step.run.state.stack.length, step.run.state.visited], ['O', 's2', 0, ['s1', 'd1', 's2']]);
check('… and the inner story is finished once (the host keeps it as done)', step.finished.map((f) => [f.flow, f.visited]), [['B', ['b1', 'b2', 'bEnd']]]);
check('back in the overview: nothing open any more', RS.insideOf(step.run, flows), null);
r = RS.stepRun(step.run, flows, 'next', ctx).run;
const atD2 = r;
r = RS.stepRun(r, flows, 'skip', ctx).run;
check('„Dalej bez tego": the skip exit goes on', [r.state.flow, r.state.step, r.state.visited.includes('d2')], ['O', 's3', true]);
r = RS.stepRun(r, flows, 'right', ctx).run;
check('the overview ends with the second detour skipped', [r.state.ended, r.state.stack.length], [true, 0]);

/* -- Wróć do … --------------------------------------------------------------------------------------------------- */
const back = RS.backTo(inB, flows, 0);
check('„Wróć do: Etap 1" returns to the detour step, the inner story not finished', [back.state.flow, back.state.step, back.state.stack.length, back.outer.length, back.state.visited], ['O', 'd1', 0, 0, ['s1', 'd1']]);
check('back depths: every caller through detours', [RS.backDepths(inB, flows), RS.backDepths(back, flows)], [[0], []]);
const withKept = RS.detourIn(back, flows, ctx, { step: 'b2', visited: ['b1', 'b2'] });
check('„Wejdź" again: where the learner was in it (its own place)', [withKept.run.state.flow, withKept.run.state.step, withKept.run.state.visited], ['B', 'b2', ['b1', 'b2']]);
const fresh = RS.detourIn(back, flows, ctx, { step: 'b2', visited: ['b1', 'b2'], done: true });
check('„Przypomnij" (already finished): from the start', [fresh.run.state.step, fresh.run.state.visited], ['b1', ['b1']]);

/* -- Pflicht ----------------------------------------------------------------------------------------------------- */
const [dr, dre] = detourTo('dr', 'B', 'r2', { optional: false });
const R = flowOf('R', 'Etap 2', [node('r1', 'show'), dr, node('r2', 'end')], [edge('r1', 'next', 'dr'), ...dre]);
check('a required detour: the end needs it (visited, story not finished)', [DT.requiredOpen(R, ['r1', 'dr', 'r2'], () => false), DT.requiredOpen(R, ['r1', 'dr', 'r2'], (f) => f === 'B'), DT.requiredOpen(O, ['s1', 'd1', 's2', 'd2'], () => false)], [['dr'], [], []]);
check('a required detour is no dead end in the path check (done is a normal exit)', FC.flowProblems(R).map((p) => p.text), []);
check('the overview: done and skip are normal exits (no warnings)', FC.flowProblems(O).map((p) => p.text), []);
const half = flowOf('H', 'Pół', [node('h1', 'detour', { flow: 'B' }), node('h2', 'end')], [edge('h1', 'done', 'h2')]);
check('an optional detour without its skip edge: a dead end, by name', FC.flowProblems(half, () => '').filter((p) => p.step === 'h1').length, 1);

/* -- Tiefe und Kreis --------------------------------------------------------------------------------------------- */
const chain = {};
for (let i = 1; i <= 5; i += 1) {
  const id = `A${i}`;
  chain[id] = i < 5
    ? flowOf(id, `Poziom ${i}`, [node(`a${i}`, 'detour', { flow: `A${i + 1}` }), node(`a${i}e`, 'end')], [edge(`a${i}`, 'done', `a${i}e`), edge(`a${i}`, 'skip', `a${i}e`)])
    : flowOf(id, 'Poziom 5', [node('a5', 'show'), node('a5e', 'end')], [edge('a5', 'next', 'a5e')]);
}
const cf = (id) => chain[id];
const cctx = { ...ctx, flows: cf };
let deep = RS.startRun(chain.A1, {}, cctx);
const depths = [];
for (let i = 0; i < 4; i += 1) { deep = RS.detourIn(deep, cf, cctx, null).run; depths.push([deep.state.flow, deep.state.stack.length]); }
check('detours inside detours: three levels, the fourth is refused', depths, [['A2', 1], ['A3', 2], ['A4', 3], ['A4', 3]]);
check('… refused as too deep', FL.detourRefused(deep.state, 'A5', cf), 'deep');
check('the import warns about a chain deeper than 3 (by name)', DT.detourProblems(chain.A1, Object.values(chain), (x) => x).map((p) => p.level + ': ' + p.text),
  ['warning: Zagłębienia idą głębiej niż 3 poziomy: „Poziom 1” → „Poziom 2” → „Poziom 3” → „Poziom 4” → „Poziom 5” — najgłębszego odtwarzacz nie zaproponuje.']);
const X = flowOf('X', 'Etap 1', [node('x1', 'detour', { flow: 'Y' }), node('x2', 'end')], [edge('x1', 'done', 'x2'), edge('x1', 'skip', 'x2')]);
const Y = flowOf('Y', 'Dom w Becchi', [node('y1', 'detour', { flow: 'X' }), node('y2', 'end')], [edge('y1', 'done', 'y2'), edge('y1', 'skip', 'y2')]);
check('a cycle A → B → A is found once', DT.detourCycles([X, Y], (x) => x), [['X', 'Y', 'X']]);
check('… and refused with both names', DT.detourProblems(X, [X, Y], (x) => x).filter((p) => p.level === 'error').map((p) => p.text),
  ['Zagłębienia tworzą koło: „Etap 1” → „Dom w Becchi” → „Etap 1” — opowieść nie może przez zagłębienia wrócić do siebie. Usuń jedno z nich.']);
check('a detour into itself is an error; an unknown target a warning', [
  DT.detourProblems(flowOf('S', 'Sam', [node('q', 'detour', { flow: 'S' }), node('e', 'end')], [edge('q', 'done', 'e'), edge('q', 'skip', 'e')]), [], (x) => x).map((p) => p.level),
  DT.detourProblems(flowOf('U', 'U', [node('q', 'detour', { flow: '@nie/ma' }), node('e', 'end')], [edge('q', 'done', 'e'), edge('q', 'skip', 'e')]), [], () => null).map((p) => p.level)
], [['error'], ['warning']]);
const xy = { X, Y };
const xyf = (id) => xy[id];
let cyc = RS.detourIn(RS.startRun(X, {}, { ...ctx, flows: xyf }), xyf, { ...ctx, flows: xyf }, null).run;
check('at runtime a cycle is refused too (in Y the detour back into X stays put)', [cyc.state.flow, FL.detourRefused(cyc.state, 'X', xyf), RS.detourIn(cyc, xyf, { ...ctx, flows: xyf }, null).run.state.flow], ['Y', 'cycle', 'Y']);
check('a subflow cycle alone is no detour cycle; a mixed one is', [
  DT.detourCycles([flowOf('P', 'P', [node('p', 'subflow', { flow: 'Q' })], []), flowOf('Q', 'Q', [node('q', 'subflow', { flow: 'P' })], [])], (x) => x).length,
  DT.detourCycles([flowOf('P', 'P', [node('p', 'subflow', { flow: 'Q' })], []), flowOf('Q', 'Q', [node('q', 'detour', { flow: 'P' })], [])], (x) => x).length
], [0, 1]);

/* -- Przegląd, Zähler ---------------------------------------------------------------------------------------------- */
const work = SP.stepWorkOf((n) => (typeof n.config.of === 'string' && n.config.of !== '' ? [n.config.of] : []));
const sp = SP.storyPath(O, work, (id) => id, { flowName: (id) => all[id]?.name ?? null });
const kinds = sp.parts.map((p) => p.kind);
check('on the path a detour is one node of its own kind, named after its story', [kinds, sp.parts.filter((p) => p.kind === 'detour').map((p) => p.label)],
  [['start', 'read', 'detour', 'read', 'detour', 'learn', 'end'], ['Dom w Becchi', 'Szkoła w Chieri']]);
check('the overview counts only its own questions (none of the detours)', [NX.storyWork(sp).questions, SP.askCounts(sp).reduce((a, b) => a + b, 0), sp.parts.filter((p) => p.kind === 'detour').map((p) => p.questionSteps.length)], [1, 1, [0, 0]]);
const RV = flowOf('RV', 'Z przeglądem', [node('v1', 'show'), node('vd', 'detour', { flow: 'B' }), node('vq1', 'question', { of: 'q1' }), node('vq2', 'question', { of: 'q2' }), node('vc', 'condition', { condition: { type: 'value', value: 'n', op: 'ge', than: 2 } }), node('ve', 'end')],
  [edge('v1', 'next', 'vd'), edge('vd', 'done', 'vq1'), edge('vd', 'skip', 'vq1'), edge('vq1', 'right', 'vq2'), edge('vq1', 'wrong', 'vq2'), edge('vq2', 'right', 'vc'), edge('vq2', 'wrong', 'vc'), edge('vc', 'yes', 've'), edge('vc', 'no', 'vd')]);
const spr = SP.storyPath(RV, work, (id) => id);
const review = spr.parts.find((p) => p.kind === 'review');
check('a review loop that runs through a detour: its questions are its own (q1, q2), the detour adds none', [review?.questionSteps, review?.questions], [['vq1', 'vq2'], 2]);
const skippedFn = (visited, current) => (s) => (s === 'd2' && DT.detourState(s, new Set(visited), current, false) === 'skipped');
const endMarks = SP.storyMarks(sp, { visited: ['s1', 'd1', 's2', 'd2', 's3', 'oEnd'], ended: true, skipped: skippedFn(['s1', 'd1', 's2', 'd2', 's3'], null) });
check('counters: a skipped optional detour counts as done (ukończono X z Y)', [endMarks.done, endMarks.total, endMarks.skipped], [5, 5, [false, false, false, false, true, false, false]]);
const midMarks = SP.storyMarks(sp, { visited: ['s1', 'd1', 's2', 'd2', 's3'], step: 's3', skipped: skippedFn(['s1', 'd1', 's2', 'd2', 's3'], 's3') });
check('… also before the end: both detours are behind (one entered, one skipped)', [midMarks.done, midMarks.total, midMarks.state[4], midMarks.skipped?.[4]], [4, 5, 'done', true]);
check('the state of a detour: done (story finished) / skipped / open', [DT.detourState('d2', new Set(['d2']), 's3', true), DT.detourState('d2', new Set(['d2']), 's3', false), DT.detourState('d2', new Set(['d2']), 'd2', false), DT.detourState('d2', new Set(), 's1', false)],
  ['done', 'skipped', 'open', 'open']);

/* -- Wieder im Abstecher nach dem Neuladen ----------------------------------------------------------------------- */
const kept = { B: { visited: ['b1', 'b2'] } };
const resumed = RS.resumeInside(RS.startRun(O, { at: 'd1', visited: ['s1', 'd1'] }, ctx), [{ flow: 'B', step: 'b2' }], flows, ctx, (id) => kept[id]);
check('resume inside a detour from the saved place of the overview', [resumed.state.flow, resumed.state.step, resumed.state.stack.length, resumed.outer, resumed.state.visited], ['B', 'b2', 1, [['s1', 'd1']], ['b1', 'b2']]);
const after = RS.stepRun(resumed, flows, 'right', ctx);
check('… and its end still returns to the overview at the done exit', [after.run.state.flow, after.run.state.step, after.finished.map((f) => f.flow)], ['O', 's2', ['B']]);
let two = RS.startRun(chain.A1, {}, cctx);
two = RS.detourIn(RS.detourIn(two, cf, cctx, null).run, cf, cctx, null).run;
const saved2 = RS.insideOf(two, cf);
check('two levels: the outer place lists both', saved2, { step: 'a1', visited: ['a1'], inside: [{ flow: 'A2', step: 'a2' }, { flow: 'A3', step: 'a3' }] });
const again2 = RS.resumeInside(RS.startRun(chain.A1, { at: saved2.step, visited: saved2.visited }, cctx), saved2.inside, cf, cctx, () => undefined);
check('… and resumes both levels (with the breadcrumb: two callers)', [again2.state.flow, again2.state.stack.map((x) => x.flow), RS.backDepths(again2, cf)], ['A3', ['A1', 'A2'], [1, 0]]);
const changed = RS.resumeInside(RS.startRun(O, { at: 's2' }, ctx), [{ flow: 'B', step: 'b2' }], flows, ctx, () => undefined);
check('a saved place that no longer fits (the step is no detour into that story): stays in the overview', [changed.state.flow, changed.state.step], ['O', 's2']);

/* -- Die Stelle: inside „newer wins" -------------------------------------------------------------------------------- */
const p1 = { flow: 'O', step: 'd1', visited: ['s1', 'd1'], at: 10, inside: [{ flow: 'B', step: 'b2' }] };
const p2 = { flow: 'O', step: 'd1', visited: ['s1', 'd1'], at: 20 };
const p3 = { flow: 'O', step: 'd1', visited: ['s1', 'd1'], at: 30, inside: [{ flow: 'B', step: 'b1' }], done: undefined };
check('mergePosition: the newer place decides what is open (cleared, or the newer stack)', [LN.mergePosition(p1, p2).inside, LN.mergePosition(p2, p1).inside, LN.mergePosition(p1, p3).inside, LN.mergePosition({ ...p1, done: true }, p2).done],
  [undefined, undefined, [{ flow: 'B', step: 'b1' }], true]);

/* -- „Co dalej" --------------------------------------------------------------------------------------------------- */
check('„Co dalej": the unfinished optional detours first, in the order of the story (each once)', [
  DT.openDetours(O, () => false).map((d) => d.target), DT.openDetours(O, (f) => f === 'B').map((d) => d.target), DT.openDetours(R, () => false).length,
  DT.openDetours(flowOf('D', 'D', [node('a', 'detour', { flow: 'C' }), node('b', 'detour', { flow: 'C' }), node('e', 'end')], [edge('a', 'done', 'b'), edge('a', 'skip', 'b'), edge('b', 'done', 'e'), edge('b', 'skip', 'e')]), () => false).length
], [['B', 'C'], ['C'], 0, 1]);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
