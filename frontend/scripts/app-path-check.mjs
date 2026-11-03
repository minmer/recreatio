/**
 * 2026-11-03 (F) — DIE ŚCIEŻKA ALS KARTE (`cogita/pathLayout.ts`, `cogita/flowPath.ts`), nachgemessen: Stufen von unten,
 * Gabeln nebeneinander und mittig, Zusammenführungen mittig über ihren Spuren, nie zwei Knoten näher als 1, nur aus der
 * Struktur (der Stand färbt nur), die Stände (gelernt, frei, gesperrt, jetzt dran, zu wiederholen), leuchtende Wege,
 * „2 z 3 ścieżek", die Spur einer Wahl, Einträge ohne Karten durchsichtig, ohne Umwege, Kreise, ohne Reihenfolge eine
 * Kette — und die Erzählung: ihre Einträge, ihre Reihenfolge, wo sie sich gabelt und wieder zusammenkommt, wohin ein
 * Tippen springt.
 *
 *   node scripts/app-path-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-path-'));
await build({
  entryPoints: { path: 'src/app/cogita/pathLayout.ts', flow: 'src/app/cogita/flowPath.ts', flowcore: 'src/app/cogita/flow.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [P, FP, F] = await Promise.all(['path', 'flow', 'flowcore'].map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* Eine Karte aus Namen: { eintrag: [davor] } in der Reihenfolge des Autors. */
const model = (spec, options = {}) => {
  const ids = Object.keys(spec);
  const items = ids.map((id) => ({ id, label: id }));
  const needs = P.effectiveNeeds(ids, (id) => spec[id] ?? options.hidden?.[id] ?? []);
  return P.pathModel(items, needs, options);
};
const pos = (m) => Object.fromEntries(m.nodes.map((n) => [n.id, [n.level, n.x]]));
const tooClose = (m) => {
  const out = [];
  for (let L = 0; L < m.levels; L += 1) {
    const xs = m.nodes.filter((n) => n.level === L).map((n) => n.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) if (xs[i] - xs[i - 1] < 1 - 1e-9) out.push(`level ${L}: ${xs[i - 1]} ${xs[i]}`);
  }
  return out;
};

/* Das Beispiel des Auftrags: ein Anfang, eine Gabel in drei Themen (je eine Kette von 4 Schritten), ein Schritt, der alle drei braucht. */
const course = { start: [] };
for (const b of ['a', 'b', 'c']) for (let i = 1; i <= 4; i += 1) course[`${b}${i}`] = [i === 1 ? 'start' : `${b}${i - 1}`];
course.combine = ['a4', 'b4', 'c4'];
const M = model(course);
check('levels from below: the start 0, each chain step one up, the combining step on top (5)', [M.levels, M.nodes.find((n) => n.id === 'combine').level, M.nodes.find((n) => n.id === 'a3').level], [6, 5, 3]);
check('a fork: the three branches side by side, centred over the start, in the author’s order', ['a1', 'b1', 'c1'].map((id) => pos(M)[id][1]), [-1, 0, 1]);
check('a chain goes straight up', ['a1', 'a2', 'a3', 'a4'].map((id) => pos(M)[id][1]), [-1, -1, -1, -1]);
check('a merge stands centred above its branches', pos(M).combine, [5, 0]);
check('no two nodes on a level closer than 1', tooClose(M), []);
check('the ways: every prerequisite once (13 + 3)', M.edges.length, 15);
check('deterministic: the same data gives the same map', JSON.stringify(model(course)) === JSON.stringify(M), true);
check('a fork of two is centred too (−½, +½)', ['l', 'r'].map((id) => pos(model({ s: [], l: ['s'], r: ['s'] }))[id][1]), [-0.5, 0.5]);
const wide = { root: [] };
for (let i = 0; i < 10; i += 1) wide[`k${i}`] = ['root'];
check('a wide fork: ten children from −4.5 to 4.5, none closer than 1', [pos(model(wide)).k0[1], pos(model(wide)).k9[1], tooClose(model(wide))], [-4.5, 4.5, []]);
const uneven = { s: [], l: ['s'], r: ['s'], l1: ['l'], l2: ['l'], l3: ['l'], m: ['l1', 'r'] };
const U = model(uneven);
check('crowded levels push apart as little as possible (no overlaps, the order kept)', [tooClose(U), pos(U).l1[1] < pos(U).l2[1] && pos(U).l2[1] < pos(U).l3[1]], [[], true]);
check('a merge of uneven branches stands between them', pos(U).m[1] > Math.min(pos(U).l1[1], pos(U).r[1]) - 1e-9 && pos(U).m[1] < Math.max(pos(U).l1[1], pos(U).r[1]) + 1e-9, true);

/* Der Stand färbt nur — die Karte bleibt. */
const know = (learned, due = []) => (id) => ({ learned: learned.includes(id), due: due.includes(id) });
const at0 = P.pathMarks(M, know([]));
check('nothing learned: the start is available and "now", everything else locked', [at0.state[M.index.get('start')], at0.current === M.index.get('start'), at0.state.filter((s) => s === 'locked').length], ['available', true, 13]);
const at1 = P.pathMarks(M, know(['start']));
check('the start learned: the three branches open, its ways light up, "now" is the first of them', [['a1', 'b1', 'c1'].map((id) => at1.state[M.index.get(id)]), M.edges.filter(([p], i) => at1.lit[i] && M.nodes[p].id === 'start').length, M.nodes[at1.current].id], [['available', 'available', 'available'], 3, 'a1']);
const twoOf3 = ['start', 'a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4', 'c1'];
const at2 = P.pathMarks(M, know(twoOf3, ['b2']));
check('at the merge: 2 of 3 paths done, still locked', [at2.merges.get(M.index.get('combine')), at2.state[M.index.get('combine')], P.mergeWords(2, 3)], [{ done: 2, total: 3 }, 'locked', '2 z 3 ścieżek']);
check('due for review: a marker on a learned node (it stays done)', [at2.due[M.index.get('b2')], at2.state[M.index.get('b2')]], [true, 'done']);
check('"now" given by the host (the story) wins over the first open one', M.nodes[P.pathMarks(M, know(twoOf3), 'b3').current].id, 'b3');
check('all three branches through: the combining step opens', P.pathMarks(M, know([...twoOf3, 'c2', 'c3', 'c4'])).state[M.index.get('combine')], 'available');
check('the map never changes with progress', JSON.stringify(pos(M)) === JSON.stringify(pos(model(course))), true);
check('a branch: from b1 up to the merge (not into it)', [...P.branchOf(M, ['b1'])].sort(), ['b1', 'b2', 'b3', 'b4']);

/* Durch Einträge ohne Karten, ohne Umwege, Kreise, ohne Reihenfolge. */
const through = model({ A: [], B: ['X'] }, { hidden: { X: ['A'] } });
check('an entry outside the set is transparent: B needs A through X', through.nodes.find((n) => n.id === 'B').needs.map((v) => through.nodes[v].id), ['A']);
const detour = model({ A: [], B: ['A'], C: ['A', 'B'] });
check('no detours: C needs only B (A is already before B)', detour.nodes.find((n) => n.id === 'C').needs.map((v) => detour.nodes[v].id), ['B']);
const circle = model({ A: ['B'], B: ['A'], C: ['B'] });
check('a circle does not break it: every node placed, one way of the circle kept', [circle.nodes.length, circle.edges.length, tooClose(circle)], [3, 2, []]);
const flat = P.pathModel([{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }, { id: 'z', label: 'z' }], [[], [], []], { chainIfFlat: true });
check('no order at all: a chain in the given order', [flat.source, flat.nodes.map((n) => n.level)], ['chain', [0, 1, 2]]);
check('without chainIfFlat: one row, side by side', P.pathModel([{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }], [[], []]).nodes.map((n) => [n.level, n.x]), [[0, -0.5], [1 - 1, 0.5]]);

/* -- Die Erzählung ------------------------------------------------------------------------------------------------ */

const node = (id, type, config = {}) => ({ id, type, x: 0, y: 0, config });
const edge = (from, out, to) => ({ id: `${from}>${out}`, from, out, to, in: 'in' });
const story = F.readFlow('story', {
  name: 'Którędy dalej?', start: 's0',
  graph: {
    nodes: [
      node('s0', 'show', { of: 'start' }), node('hub', 'chapters', { chapters: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] }),
      node('a1s', 'show', { of: 'a1' }), node('a2s', 'question', { of: 'qa2' }), node('aEnd', 'chapterEnd'),
      node('b1s', 'show', { of: 'b1' }), node('bEnd', 'chapterEnd'),
      node('c1s', 'show', { of: 'c1' }), node('cEnd', 'chapterEnd'),
      node('comb', 'show', { of: 'combine' }), node('end', 'end')
    ],
    edges: [
      edge('s0', 'next', 'hub'), edge('hub', 'c0', 'a1s'), edge('hub', 'c1', 'b1s'), edge('hub', 'c2', 'c1s'), edge('hub', 'done', 'comb'),
      edge('a1s', 'next', 'a2s'), edge('a2s', 'right', 'aEnd'), edge('a2s', 'wrong', 'a1s'), edge('b1s', 'next', 'bEnd'), edge('c1s', 'next', 'cEnd'), edge('comb', 'next', 'end')
    ]
  }
});
/* Eine Frage zählt für das, worüber sie ist (qa2 → a2). */
const entries = (n) => (n.type === 'question' ? (n.config.of === 'qa2' ? ['a2'] : []) : typeof n.config.of === 'string' ? [n.config.of] : []);
const fp = FP.flowPath(story, entries, (id) => id.toUpperCase());
check('story: its entries in reading order (each path in turn, what comes after all of them last)', fp.items.map((i) => i.id), ['start', 'a1', 'a2', 'b1', 'c1', 'combine']);
check('story: a way back (a wrong answer repeats a1) is no step forward', fp.storyNeeds[0].length + fp.storyNeeds[1].length, 1);
check('story: a question counts for what it is about (a2 at step a2s)', [fp.stepOf.get('a2'), fp.entriesAt.get('a2s')], ['a2s', ['a2']]);
const sn = Object.fromEntries(fp.items.map((it, v) => [it.id, fp.storyNeeds[v].map((p) => fp.items[p].id).sort()]));
check('story: its own order — the chapters fork after the start, each chapter end leads to what comes after all chapters', [sn.a1, sn.b1, sn.c1, sn.a2, sn.combine], [['start'], ['start'], ['start'], ['a1'], ['a2', 'b1', 'c1']]);
check('story: per chapter the first entries behind it (to light its branch)', [...fp.exits.get('hub')].map(([k, v]) => [k, v]), [['c0', ['a1']], ['c1', ['b1']], ['c2', ['c1']]]);
check('story: a step inside a chapter knows its chapter (a jump enters it properly)', fp.chapterOf.get('a2s'), { hub: 'hub', exit: 'c0' });
const SM = FP.flowPathModel(fp, () => []);
check('story map without a learning order: the story’s order (fork of 3, merge on top)', [SM.source, pos(SM).combine[0], ['a1', 'b1', 'c1'].map((id) => pos(SM)[id][1]), tooClose(SM)], ['story', 3, [-1, 0, 1], []]);
const learning = { combine: ['a2', 'b1', 'c1'], a2: ['a1'], a1: ['start'], b1: ['start'], c1: ['start'] };
check('story map with a learning order: the learning order decides', FP.flowPathModel(fp, (id) => learning[id] ?? []).source, 'learning');
check('story: "now" is the entry of the current step (else the last shown)', [FP.flowCurrent(fp, { step: 'a2s', visited: ['s0', 'hub', 'a1s', 'a2s'] }), FP.flowCurrent(fp, { step: 'hub', visited: ['s0', 'hub', 'b1s', 'bEnd', 'hub'] })], ['a2', 'b1']);
check('story: what it has shown (an entry without cards counts as done once shown)', [...FP.flowShown(fp, ['s0', 'hub', 'b1s'])].sort(), ['b1', 'start']);
/* Die Erzählung selbst: Kapitel führen zurück, bis alle durch sind — dann der Schritt, der alles braucht. */
const ctx = { facts: (s) => ({ values: s.values, knowness: () => 0, answered: () => null, visited: new Set(s.visited), now: new Date(0) }), flows: () => story, members: () => [] };
let st = F.startFlow(story);
st = F.advance(story, st, 'next', ctx);
check('story: at the fork all three paths are offered', F.chaptersLeft(story.graph.nodes.find((n) => n.id === 'hub'), st).map((c) => c.exit), ['c0', 'c1', 'c2']);
st = F.advance(story, st, 'c1', ctx);
st = F.advance(story, st, 'next', ctx);
check('story: after one path it leads back to the paths still open', [st.step, F.chaptersLeft(story.graph.nodes.find((n) => n.id === 'hub'), st).map((c) => c.exit)], ['hub', ['c0', 'c2']]);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
