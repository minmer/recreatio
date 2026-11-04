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
  entryPoints: { path: 'src/app/cogita/pathLayout.ts', flow: 'src/app/cogita/flowPath.ts', flowcore: 'src/app/cogita/flow.ts', story: 'src/app/cogita/storyPath.ts', check: 'src/app/cogita/flowCheck.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [P, FP, F, SP, FC] = await Promise.all(['path', 'flow', 'flowcore', 'story', 'check'].map(load));

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
check('a step needing three is no choice: no counter on an entry map, still locked until all are learned', [at2.forks.size, at2.state[M.index.get('combine')], P.mergeWords(2, 3)], [0, 'locked', '2 z 3 ścieżek']);
check('"X z Y" counts exactly the drawn nodes, and the same nodes as done', [at2.total, at2.done], [M.nodes.length, twoOf3.length]);
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

/* -- 2026-11-04: die Zeichnung ohne unnötige Kreuzungen ---------------------------------------------------------- */

/* In der Reihenfolge des Autors kreuzen sich die Wege (b1 → d2, b2 → d1); geordnet: keine Kreuzung. */
const crossy = model({ s: [], b1: ['s'], b2: ['s'], d1: ['b2'], d2: ['b1'], top: ['d1', 'd2'] });
check('crossings: a path that can be drawn without crossings has none (rows reordered)', crossy.crossings, 0);
const lattice = { s: [] };
for (let i = 0; i < 4; i += 1) lattice[`a${i}`] = ['s'];
for (let i = 0; i < 4; i += 1) lattice[`b${i}`] = [`a${3 - i}`];
lattice.t = ['b0', 'b1', 'b2', 'b3'];
check('crossings: four branches whose next steps come in the reverse order — still none', model(lattice).crossings, 0);
const long = model({ s: [], a: ['s'], b: ['a'], c: ['b'], skip: ['s'], end: ['c', 'skip'] });
check('a long way gets a point on every level it spans (it runs beside the chain, not through it)', [long.routes[long.edges.findIndex(([p, c]) => long.nodes[p].id === 'skip' && long.nodes[c].id === 'end')].length, long.crossings], [4, 0]);
const skipRoute = long.routes[long.edges.findIndex(([p, c]) => long.nodes[p].id === 's' && long.nodes[c].id === 'skip')];
check('… and its points never sit on a node of the chain', skipRoute.every(([x, L]) => !long.nodes.some((n) => n.level === L && Math.abs(n.x - x) < 0.5 - 1e-9 && n.id !== 's' && n.id !== 'skip')), true);

/* -- 2026-11-04: die Teile einer Erzählung (wie die Opowieści von Bosko) -------------------------------------------- */

/* Wie „Dom w Becchi": Bilder mit ihren Fragen, dann der Przegląd (eine Schleife bis alles sitzt), ein letztes Bild, Ende. */
const bnodes = [];
const bedges = [];
const link = (from, out, to) => bedges.push(edge(from, out, to));
const slides = [['s1', 1], ['s2', 2], ['s3', 0], ['s4', 3]];
let prev = null;
let prevOut = 'next';
const linkPrev = (to) => { if (prev !== null) { if (prevOut === 'answer') { link(prev, 'right', to); link(prev, 'wrong', to); } else link(prev, prevOut, to); } };
for (const [s, qs] of slides) {
  bnodes.push(node(s, 'show', { of: `slide-${s}`, title: `Bild ${s}` }));
  linkPrev(s); prev = s; prevOut = 'next';
  for (let k = 1; k <= qs; k += 1) { const q = `${s}q${k}`; bnodes.push(node(q, 'question', { of: `q-${q}` })); linkPrev(q); prev = q; prevOut = 'answer'; }
}
bnodes.push(node('rv', 'show', { of: 'slide-rv', title: 'Przegląd' }));
linkPrev('rv'); prev = 'rv'; prevOut = 'next';
const asked = ['s1q1', 's2q1', 's2q2', 's4q1', 's4q2', 's4q3'];
asked.forEach((q, i) => {
  bnodes.push(node(`rc${i}`, 'condition', { condition: { type: 'knowness', of: `q-${q}`, band: 'known' } }), node(`rq${i}`, 'question', { of: `q-${q}` }));
  linkPrev(`rc${i}`);
  link(`rc${i}`, 'no', `rq${i}`);
  const next = i + 1 < asked.length ? `rc${i + 1}` : 'rall';
  link(`rc${i}`, 'yes', next); link(`rq${i}`, 'right', next); link(`rq${i}`, 'wrong', next);
  prev = null;
});
bnodes.push(node('rall', 'condition', { condition: { type: 'and', items: [] } }), node('koniec', 'show', { of: 'slide-koniec', title: 'Na koniec' }), node('end', 'end'));
link('rall', 'no', 'rc0'); link('rall', 'yes', 'koniec'); link('koniec', 'next', 'end');
const bosko = F.readFlow('bosko', { name: 'Dom w Becchi', start: 's1', graph: { nodes: bnodes, edges: bedges } });
const qEntries = (n) => (n.type === 'question' ? [`topic-${n.config.of}`] : typeof n.config.of === 'string' ? [n.config.of] : []);
const work = SP.stepWorkOf(qEntries);
const B = SP.storyPath(bosko, work, (id) => id);
const kinds = B.parts.map((p) => `${p.kind}${p.slides > 0 ? `:${p.slides}s` : ''}${p.questions > 0 ? `:${p.questions}q` : ''}`);
check('Bosko story: start, reading and question parts in turn, two slides in a row are one part, the review, the last slide, the end',
  kinds, ['start', 'read:1s', 'learn:1q', 'read:1s', 'learn:2q', 'read:2s', 'learn:3q', 'review:1s:6q', 'read:1s', 'end']);
check('Bosko story: the review part holds the loop and the lone "Przegląd" slide before it; it is named', [B.parts[7].label, B.parts[7].steps.includes('rv'), B.parts[7].steps.includes('rall')], ['Przegląd', true, true]);
check('Bosko story: a question part is named after the slide before it', B.parts[2].label, 'Pytania — Bild s1');
check('Bosko story: one start, one end; a chain upward (start at the bottom, end on top, nothing crosses)', [B.parts.filter((p) => p.kind === 'start').length, B.parts.filter((p) => p.kind === 'end').length, B.model.nodes[0].level, B.model.nodes[B.parts.length - 1].level, B.model.levels, B.model.crossings], [1, 1, 0, 9, 10, 0]);
check('Bosko story: in words — „2 slajdy do przeczytania", „3 pytania do odpowiedzi", the review', [P.partWords(B.model.nodes[5]), P.partWords(B.model.nodes[6]), P.partWords(B.model.nodes[7])],
  ['2 slajdy do przeczytania', '3 pytania do odpowiedzi', 'Przegląd: 6 pytań — powtarzasz, aż wszystkie umiesz (i 1 slajd do przeczytania)']);
const visitedTo = (stop) => { const v = []; for (const n of bnodes) { v.push(n.id); if (n.id === stop) break; } return v; };
const learnedAll = () => ({ learned: true, due: false });
const m1 = SP.storyMarks(B, { visited: visitedTo('s2q1'), step: 's2q1', know: learnedAll });
check('Bosko story: "now" is the part of the current step; what is behind is done, what is ahead locked', [m1.current, m1.state.slice(0, 6)], [4, ['done', 'done', 'done', 'done', 'available', 'locked']]);
check('Bosko story: "X z Y" counts the hexagons drawn (8, not start and end) and the same ones as done', [m1.total, m1.done], [8, 3]);
const m2 = SP.storyMarks(B, { visited: bnodes.map((n) => n.id), ended: true, know: (id) => ({ learned: true, due: id === 'topic-q-s4q2' }) });
check('Bosko story: at the end the review is done only when everything sits (one due: open, marker on its part)', [m2.state[7], m2.state[9], m2.due[6]], ['available', 'done', true]);

/* -- Gabeln: drei Kapitel, eins durch; eine Wahl aus drei ------------------------------------------------------------ */

const SPc = SP.storyPath(story, SP.stepWorkOf(entries), (id) => id);
const hub = SPc.parts.findIndex((p) => p.kind === 'fork');
const merge = SPc.parts.findIndex((p) => p.steps.includes('comb'));
check('chapters: one fork node with three branches; the part after them needs all three', [SPc.parts[hub].fork.mode, SPc.parts[hub].fork.branches.length, SPc.parts[merge].needsAll === true, SPc.model.crossings], ['all', 3, true, 0]);
const mc = SP.storyMarks(SPc, { visited: ['s0', 'hub', 'b1s', 'bEnd'], step: 'hub', chapters: { hub: [1] } });
check('chapters: a fork of three, one done — „ukończono 1 z 3 ścieżek", the merge still locked', [P.forkWords(mc.forks.get(hub)), mc.state[merge], mc.state[hub]], ['ukończono 1 z 3 ścieżek', 'locked', 'available']);
const allDone = SP.storyMarks(SPc, { visited: story.graph.nodes.map((n) => n.id), step: 'comb', chapters: { hub: [0, 1, 2] } });
check('chapters: all three branches done — the fork is drawn done, the merge opens', [allDone.state[hub], allDone.state[merge] !== 'locked', P.forkWords(allDone.forks.get(hub))], ['done', true, 'ukończono 3 z 3 ścieżek']);
const choose = F.readFlow('pick', {
  name: 'Wybór', start: 'intro', graph: {
    nodes: [node('intro', 'show', { of: 'i', title: 'Wstęp' }), node('pick', 'choice', { options: [{ label: 'Droga A' }, { label: 'Droga B' }, { label: 'Droga C', condition: { type: 'value', value: 'klucz', op: 'ge', than: 1 } }] }),
      node('a', 'show', { of: 'a' }), node('a2', 'show', { of: 'a2' }), node('aq', 'question', { of: 'qa' }), node('b', 'question', { of: 'qb' }), node('c', 'show', { of: 'c' }), node('fin', 'show', { of: 'fin' }), node('end', 'end')],
    edges: [edge('intro', 'next', 'pick'), edge('pick', 'o0', 'a'), edge('pick', 'o1', 'b'), edge('pick', 'o2', 'c'), edge('a', 'next', 'a2'), edge('a2', 'next', 'aq'), edge('aq', 'right', 'fin'), edge('aq', 'wrong', 'fin'),
      edge('b', 'right', 'fin'), edge('b', 'wrong', 'fin'), edge('c', 'next', 'fin'), edge('fin', 'next', 'end')]
  }
});
const SPk = SP.storyPath(choose, SP.stepWorkOf((n) => (typeof n.config.of === 'string' ? [n.config.of] : [])), (id) => id);
const fk = SPk.parts.findIndex((p) => p.kind === 'fork');
check('a choice of three: one fork node, three branches by name, „wybierz 1 z 3" before choosing', [SPk.parts[fk].fork.branches.map((b) => b.label), P.forkWords(SP.storyMarks(SPk, { visited: ['intro', 'pick'], step: 'pick' }).forks.get(fk))], [['Droga A', 'Droga B', 'Droga C'], 'wybierz 1 z 3']);
check('a choice: what waits behind each branch (for the choice screen)', SPk.parts[fk].fork.branches.map((b) => P.partWords({ kind: 'read', ...SP.branchWork(SPk, b) })), ['2 slajdy do przeczytania · 1 pytanie do odpowiedzi', '1 pytanie do odpowiedzi', '1 slajd do przeczytania']);
const taken = SP.storyMarks(SPk, { visited: ['intro', 'pick', 'b'], step: 'b' });
check('after the choice: the taken branch is highlighted, the fork counts it, the others stay open', [SPk.model.edges.filter((_, i) => taken.taken[i]).map(([, c]) => SPk.parts[c].steps[0]), P.forkWords(taken.forks.get(fk)), taken.state[SPk.partOfStep.get('a')]], [['b'], 'wybrano 1 z 3', 'available']);
const ctxV = { facts: (s) => ({ values: s.values, knowness: () => 0, answered: () => null, visited: new Set(s.visited), now: new Date(0) }), flows: () => choose, members: () => [] };
let sv = F.advance(choose, F.startFlow(choose), 'next', ctxV);
check('the player stops after the node with three branches: the choice waits for the learner (never picks itself)', [sv.step, sv.ended], ['pick', false]);
check('… two options open, the third locked by its condition (shown locked, with why)', [F.optionsOf(choose.graph.nodes.find((n) => n.id === 'pick'), ctxV.facts(sv)).map((o) => o.exit), choose.graph.nodes.find((n) => n.id === 'pick').config.options.length], [['o0', 'o1'], 3]);
sv = F.advance(choose, sv, 'o1', ctxV);
check('… and goes where the learner chose', sv.step, 'b');

/* -- 2026-11-04: ist die Ścieżka folgerichtig? ---------------------------------------------------------------------- */

const texts = (fl, raw) => FC.flowProblems(fl, (id) => id, raw).map((p) => `${p.level}: ${p.text}`);
check('a sound path: no problems (Bosko-like, chapters, a choice)', [texts(bosko), texts(story), texts(choose)], [[], [], []]);
const dead = F.readFlow('dead', { name: 'x', start: 'a', graph: { nodes: [node('a', 'show', { title: 'Wstęp' }), node('q', 'question', { of: 'q1', title: 'Pytanie 1' }), node('end', 'end'), node('lone', 'show', { title: 'Zgubiony slajd' })],
  edges: [edge('a', 'next', 'q'), edge('q', 'right', 'end')] } });
const deadT = texts(dead);
check('a dead end is flagged by name (the wrong answer leads nowhere)', deadT.some((x) => x.startsWith('warning: Ślepy zaułek: z kroku „Pytanie 1”') && x.includes('„źle”')), true);
check('a second start is flagged by name', deadT.some((x) => x.startsWith('warning: Drugi początek: do kroku „Zgubiony slajd”')), true);
const loop = F.readFlow('loop', { name: 'x', start: 'a', graph: { nodes: [node('a', 'show', { title: 'A' }), node('b', 'show', { title: 'B' }), node('end', 'end')], edges: [edge('a', 'next', 'b'), edge('b', 'next', 'a')] } });
check('a loop without way out: no end (error) — the import refuses it', texts(loop).filter((x) => x.startsWith('error')).length, 1);
const noStart = F.readFlow('ns', { name: 'x', graph: { nodes: [node('a', 'show', { title: 'A' }), node('b', 'show', { title: 'B' }), node('end', 'end')], edges: [edge('a', 'next', 'end'), edge('b', 'next', 'end')] } });
check('no start: "start" missing and two steps without a way to them — error', texts(noStart, {}).some((x) => x.startsWith('error: Nie ma początku')), true);
const oneEntry = F.readFlow('oe', { name: 'x', graph: { nodes: [node('b', 'show', { title: 'B' }), node('a', 'show', { title: 'A' }), node('end', 'end')], edges: [edge('a', 'next', 'b'), edge('b', 'next', 'end')] } });
check('without "start", the one step nothing leads to is the start (not the first in the list)', oneEntry.start, 'a');

/* -- Wie „Wątek: zdrowie księdza Bosko" (t10): nach dem Przegląd eine Wahl, deren Wege zurück zur Wahl führen ------------- */

const tnodes = [node('s1', 'show', { of: 's1', title: 'Noc' }), node('q1', 'question', { of: 'q1' }), node('rv', 'show', { of: 'rv', title: 'Przegląd' }),
  node('rc1', 'condition', { condition: { type: 'knowness', of: 'q1', band: 'known' } }), node('rq1', 'question', { of: 'q1' }), node('rq2', 'question', { of: 'q2' }), node('rall', 'condition', { condition: { type: 'knowness', of: 'q1', band: 'known' } }),
  node('koniec', 'show', { of: 'k', title: 'Na koniec' }), node('rozw', 'show', { of: 'r', title: 'Którędy dalej?' }),
  node('wybor', 'choice', { options: [{ label: 'Droga A: młodość', condition: { type: 'not', items: [{ type: 'flow', flow: 'fa', state: 'done' }] } }, { label: 'Droga B: ostatnie lata' }, { label: 'Kończę i wracam do mapy' }] }),
  node('a_k', 'condition', { condition: { type: 'flow', flow: 'fa', state: 'done' } }), node('a_znane', 'show', { of: 'az', title: 'Wiesz już' }), node('a_sub', 'subflow', { flow: 'fa' }),
  node('b_sub', 'subflow', { flow: 'fb' }), node('end', 'end')];
const tedges = [edge('s1', 'next', 'q1'), edge('q1', 'right', 'rv'), edge('q1', 'wrong', 'rv'), edge('rv', 'next', 'rc1'), edge('rc1', 'no', 'rq1'), edge('rc1', 'yes', 'rall'),
  edge('rq1', 'right', 'rq2'), edge('rq1', 'wrong', 'rq2'), edge('rq2', 'right', 'rall'), edge('rq2', 'wrong', 'rall'), edge('rall', 'no', 'rc1'), edge('rall', 'yes', 'koniec'), edge('koniec', 'next', 'rozw'), edge('rozw', 'next', 'wybor'),
  edge('wybor', 'o0', 'a_k'), edge('a_k', 'yes', 'a_znane'), edge('a_k', 'no', 'a_sub'), edge('a_znane', 'next', 'wybor'), edge('a_sub', 'next', 'wybor'),
  edge('wybor', 'o1', 'b_sub'), edge('b_sub', 'next', 'wybor'), edge('wybor', 'o2', 'end')];
const thread = F.readFlow('t10', { name: 'Wątek', start: 's1', graph: { nodes: tnodes, edges: tedges } });
const TS = SP.storyPath(thread, SP.stepWorkOf((n) => (typeof n.config.of === 'string' ? [n.config.of] : [])), (id) => id);
const tf = TS.parts.findIndex((p) => p.kind === 'fork');
check('a thread story (Bosko t10): the review, „Na koniec" + „Którędy dalej?" as one reading part, then the choice of three roads', [TS.parts.map((p) => p.kind), TS.parts[tf].fork.branches.map((b) => TS.parts[b.to].kind)],
  [['start', 'read', 'learn', 'review', 'read', 'fork', 'read', 'read', 'read', 'end'], ['read', 'read', 'end']]);
check('… its path is sound (every road returns to the choice, „Kończę" ends it): no problems', texts(thread), []);
check('… drawn without crossings', TS.model.crossings, 0);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
