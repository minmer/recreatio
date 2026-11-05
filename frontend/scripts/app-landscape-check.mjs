/**
 * 2026-11-03 — DER KRAJOBRAZ (`cogita/landscape.ts`), nachgemessen: die Höhen (gemeinsame Voraussetzungen einmal,
 * ein Kreis ein Schritt, Einträge ohne Karten durchsichtig, Verblassen: „do powtórki" bleibt gelernt, unter 0,1 fehlt
 * es wieder), die Sperre (schwache, schon gefragte Karten in der Kette; nie gefragte sperren nicht), der Weg zum Ziel
 * (die Grundlagen zuerst, so viele Schritte wie die Höhe), die Gestalt (deterministisch, stabil, Budget und Bereiche,
 * Fokus mit globalen Höhen, ein Eintrag mit zwei Werten zwischen ihnen, ohne Werte aus der Nähe im Graphen) — und die
 * Beziehung `rel: "chain"` der einen Logik (`knowing.ts`), der Modus `landscape` eines Widoku (`views.ts`). 2026-11-03 (E):
 * EINE FESTE KARTE — die Zellen nur aus der Struktur (gleiche Bögen in der Reihenfolge des Autors, der Abstand nach der
 * Tiefe, neue Einträge nehmen freie Zellen), ein Raster Kante an Kante; nur die Höhen ändern sich; das Budget schneidet
 * den Baum (der Ring zuerst, Berge erst, wenn kein Ring verborgen ist; der Rest „+N"); der Zoom ist eine Kamera.
 *
 *   node scripts/app-landscape-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-landscape-'));
const names = ['landscape', 'knowing', 'logic', 'views', 'prerequisites', 'knowness', 'landscapeDraw'];
/* 2026-11-03 — dazu eine Baza im Speicher (derselbe Import wie die App): Zugehörigkeit zu einer Achse über die Stufen. */
const baseEntry = join(workspace, 'base-entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(baseEntry, `
export { memoryBase } from '${app}cogita/memoryBase';
export { axisMembersOf, axisValues, groupsOf, readAxis, readGrouping } from '${app}cogita/selection';
export { landscapeAxis, landscapeInput } from '${app}cogita/landscapeData';
export * as N from '${app}cogita/landscapeNest';
`);
await build({
  entryPoints: { ...Object.fromEntries(names.map((n) => [n, `src/app/cogita/${n}.ts`])), base: baseEntry },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [L, KN, LG, VW, PR, K, D] = await Promise.all(names.map(load));
const B = await load('base');
const N = B.N;

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = typeof want === 'number' && typeof got === 'number' ? Math.abs(got - want) < 1e-6 : JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* Ein kleiner Graph aus Namen: `needs` als { kind: [voraussetzungen] }. */
function graphOf(spec, { cardless = [], values = [], memberOf = {}, view = null } = {}) {
  const ids = Object.keys(spec);
  for (const list of Object.values(spec)) for (const p of list) if (!ids.includes(p)) ids.push(p);
  const at = new Map(ids.map((id, i) => [id, i]));
  const vat = new Map(values.map((v, i) => [v.id, i]));
  return {
    ids, labels: ids,
    needs: ids.map((id) => (spec[id] ?? []).map((p) => at.get(p))),
    learnable: ids.map((id) => !cardless.includes(id)),
    inView: ids.map((id) => view === null || view.includes(id)),
    values: values.map((v, i) => ({ id: v.id, label: v.label ?? v.id, parent: v.parent === undefined ? -1 : vat.get(v.parent), rank: v.rank ?? i })),
    memberOf: ids.map((id) => (memberOf[id] ?? []).map((v) => vat.get(v)))
  };
}
const state = (input, k = {}, weak = []) => ({ knowness: input.ids.map((id) => k[id] ?? 0), weak: input.ids.map((id) => weak.includes(id)) });
const heights = (input, k, weak) => {
  const g = L.buildGraph(input);
  const h = L.heightsOf(g, state(input, k, weak));
  return { g, h, at: (id) => input.ids.indexOf(id) };
};
const H = (input, k = {}, weak = []) => { const { h } = heights(input, k, weak); return Object.fromEntries(input.ids.map((id, i) => [id, Number.isNaN(h.height[i]) ? null : Math.round(h.height[i] * 1e6) / 1e6])); };

/* ── Höhen ─────────────────────────────────────────────────────────────── */

const chain = graphOf({ A: [], B: ['A'], C: ['B'] });
check('chain without progress: the fundamental is the ring (0), then 1, 2', H(chain), { A: 0, B: 1, C: 2 });
check('chain: A known (k = 1.4) → valley −1, B ring, C one step', H(chain, { A: 1.4 }), { A: -1, B: 0, C: 1 });
check('decay: A due (k = 0.55) stays learned → −0.5; B stays on the ring', H(chain, { A: 0.55 }), { A: -0.5, B: 0, C: 1 });
check('decay: A at exactly 0.1 is still learned (height 0, band due)', (() => { const { h } = heights(chain, { A: 0.1 }); return [h.height[0], h.band[0], h.band[1]]; })(), [0, 'due', 'ring']);
check('decay: A below 0.1 counts missing again (B one step behind)', H(chain, { A: 0.09 }), { A: 0, B: 1, C: 2 });

const diamond = graphOf({ A: [], B: ['A'], C: ['A'], D: ['B', 'C'] });
check('2026-11-04 steps = the longest chain of unknown prerequisites: D after A → B (or C) → D is 2 steps (not 3 topics)', H(diamond).D, 2);
check('diamond with A known: D = 1 step (B and C side by side)', H(diamond, { A: 1 }).D, 1);

const transparent = graphOf({ A: [], X: ['A'], Y: ['X'] }, { cardless: ['X'] });
check('an entry without cards is transparent: Y = 1 (A), X has no field', H(transparent), { A: 0, X: null, Y: 1 });

const cycle = graphOf({ R: [], P: ['R', 'Q'], Q: ['P'], S: ['P'] });
check('a cycle is one step: S = R + {P,Q} = 2', H(cycle).S, 2);
check('cycle members do not wait for each other: R known → P and Q on the ring', (() => { const x = H(cycle, { R: 1 }); return [x.P, x.Q, x.S]; })(), [0, 0, 1]);
check('the cycle is reported', L.buildGraph(cycle).cycles.length, 1);
check('half a cycle learned keeps the step open (S still 1)', H(cycle, { R: 1, P: 1 }).S, 1);

/* ── Sperre ─────────────────────────────────────────────────────────────── */

const lockOf = (input, k, weak, id) => { const { h, at } = heights(input, k, weak); return h.locked[at(id)] === 1; };
check('lock: a weak (answered, < 1) card anywhere before a ring entry locks it', lockOf(chain, { A: 1, B: 0.5 }, ['A'], 'C'), true);
check('lock: no weak card in the chain → open', lockOf(chain, { A: 1, B: 0.5 }, [], 'C'), false);
check('lock: never asked cards do not block (B unlearned is the ring itself)', lockOf(chain, { A: 1 }, [], 'B'), false);
check('lock: only the chain counts (a weak neighbour elsewhere does not)', lockOf(graphOf({ A: [], B: ['A'], Z: [] }), { A: 1, Z: 0.5 }, ['Z'], 'B'), false);
check('lock: only ring entries are locked (a mountain is not)', lockOf(chain, {}, ['A'], 'C'), false);

/* ── Weg ─────────────────────────────────────────────────────────────────── */

{
  const { g, h, at } = heights(diamond);
  const r = L.routeOf(g, h, diamond.needs, diamond.labels, at('D'));
  check('route to D: fundamentals first, one step per entry, steps = height', r.steps.map((s) => s.map((v) => diamond.ids[v])), [['A'], ['B'], ['C']]);
  check('route: the next ring step is A', r.next.map((v) => diamond.ids[v]), ['A']);
  check('route: the goal itself is still open', r.goalOpen, true);
  const known = heights(diamond, { A: 1 });
  const r2 = L.routeOf(known.g, known.h, diamond.needs, diamond.labels, known.at('D'));
  check('route after learning A: B and C are both next', r2.next.map((v) => diamond.ids[v]), ['B', 'C']);
  const c = heights(cycle);
  const r3 = L.routeOf(c.g, c.h, cycle.needs, cycle.labels, c.at('S'));
  check('route through a cycle: the cycle is ONE step with both entries', r3.steps.map((s) => s.map((v) => cycle.ids[v])), [['R'], ['P', 'Q']]);
}

/* ── 2026-11-03 (E): EINE FESTE KARTE — nur die Höhen ändern sich ─────────────────────────────────────────── */

/* Eine Welt: drei Fächer (Mathe, Physik, Geschichte) mit Unterwerten; Voraussetzungen innerhalb und zwischen. */
function world(size = 12) {
  const values = [
    { id: 'math', label: 'Matematyka' }, { id: 'alg', label: 'Algebra', parent: 'math' }, { id: 'geo', label: 'Geometria', parent: 'math' },
    { id: 'phys', label: 'Fizyka' }, { id: 'mech', label: 'Mechanika', parent: 'phys' }, { id: 'opt', label: 'Optyka', parent: 'phys' },
    { id: 'hist', label: 'Historia' }, { id: 'ww1', label: 'I wojna', parent: 'hist' }, { id: 'ww2', label: 'II wojna', parent: 'hist' }
  ];
  const spec = {};
  const memberOf = {};
  for (const leaf of ['alg', 'geo', 'mech', 'opt', 'ww1', 'ww2']) {
    for (let i = 0; i < size; i += 1) {
      const id = `${leaf}${i}`;
      spec[id] = i === 0 ? [] : [`${leaf}${i - 1}`];
      memberOf[id] = [leaf];
    }
  }
  /* Mechanik braucht Algebra; die Geschichte der Optik steht in beiden. */
  spec.mech0 = ['alg3'];
  memberOf['opt5'] = ['opt', 'ww2'];
  return { ...graphOf(spec, { values, memberOf }), sorted: true };
}
const W = world();
const runLayout = (input, k = {}, options = {}) => {
  const e = new L.LandscapeEngine();
  e.setInput(input);
  e.setState(state(input, k));
  return { e, run: e.layout(options) };
};
/* Wo jeder Eintrag steht (Zelle) — die Karte. */
const mapOf = (layout, input) => input.ids.map((id, v) => { const i = layout.cellOf[v]; return i < 0 ? `${id}:-` : `${id}:${layout.land[i].q},${layout.land[i].r}`; }).join('|');
const polarOf = (c) => ({ rho: Math.hypot(c.x, c.y), angle: (Math.atan2(c.y, -c.x) * 180) / Math.PI });
{
  const a = runLayout(W, {}, { budget: 40 }).run.layout;
  const b = runLayout(W, {}, { budget: 40 }).run.layout;
  check('deterministic: the same base and progress give the same map and fields', [mapOf(a, W) === mapOf(b, W), JSON.stringify(a.fields) === JSON.stringify(b.fields)], [true, true]);
  /* Die Karte hängt nie vom Fortschritt, Budget, Fokus oder der Breite ab. */
  const known = Object.fromEntries(W.ids.slice(0, 30).map((id) => [id, 1.3]));
  const variants = [
    runLayout(W, known, { budget: 40 }), runLayout(W, {}, { budget: 12 }), runLayout(W, {}, { budget: 200 }),
    runLayout(W, {}, { budget: 40, focus: ['phys'] }), runLayout(W, {}, { budget: 40, focus: ['ww2'] }), runLayout(W, {}, { budget: 40, narrow: true }),
    runLayout(W, {}, { budget: 40, goal: 'mech4' })
  ];
  check('fixed map: progress, budget, focus, width and goal never move a cell', variants.map((x) => mapOf(x.run.layout, W) === mapOf(a, W)), variants.map(() => true));
  /* Ein Raster Kante an Kante: jede Zelle einmal, keine allein, nichts hinter oder auf dem Lernenden. */
  const keys = a.land.map((c) => `${c.q},${c.r}`);
  const set = new Set(keys);
  const lonely = a.land.filter((c) => !L.HEX_DIRS.some(([dq, dr]) => set.has(`${c.q + dq},${c.r + dr}`) || (c.q + dq === 0 && c.r + dr === 0)));
  check('one continuous grid: every cell once, none alone, none on or behind the learner', [set.size === keys.length, lonely.length, set.has('0,0'), a.land.every((c) => c.y >= 0.45)], [true, 0, false, true]);
  check('every entry has its own cell', W.ids.every((_, v) => a.cellOf[v] >= 0) && new Set(W.ids.map((_, v) => a.cellOf[v])).size === W.ids.length, true);
  /* Gleich breite Bereiche, in der Reihenfolge des Autors; jeder Eintrag in seinem Bogen. */
  check('areas: equal sectors in the author’s order (not by size)', a.areas.map((s) => [s.value, Math.round(s.from), Math.round(s.to)]), [['math', 0, 60], ['phys', 60, 120], ['hist', 120, 180]]);
  const outside = [];
  const f0 = new L.LandscapeEngine(); f0.setInput(W); const F = f0.map();
  for (let v = 0; v < W.ids.length; v += 1) {
    const c = a.land[a.cellOf[v]];
    const { rho, angle } = polarOf(c);
    const top = F.dir.top[v];
    const sec = a.areas[top];
    const slack = 28.65 / rho;
    if (F.dir.centre[v] !== 1 && (angle < sec.from - slack || angle > sec.to + slack)) outside.push(W.ids[v]);
  }
  check('every entry stands in its own area’s arc', outside, []);
  /* Der Abstand folgt der Tiefe: im Bereich Stufe für Stufe nach aussen (Bänder, keine Stufe vor der vorigen). */
  const breaks = [];
  for (let top = 0; top < a.areas.length; top += 1) {
    const byDepth = new Map();
    for (let v = 0; v < W.ids.length; v += 1) if (F.dir.top[v] === top) { const d = F.depth[v]; byDepth.set(d, [...(byDepth.get(d) ?? []), polarOf(a.land[a.cellOf[v]]).rho]); }
    const levels = [...byDepth.keys()].sort((x, y) => x - y);
    for (let i = 1; i < levels.length; i += 1) if (Math.max(...byDepth.get(levels[i - 1])) > Math.min(...byDepth.get(levels[i])) + 1e-9) breaks.push(`${a.areas[top].value}: depth ${levels[i - 1]} beyond ${levels[i]}`);
  }
  check('distance follows depth: in every area each level stands outside the one before', breaks, []);
  const rhoOf = (id) => polarOf(a.land[a.cellOf[W.ids.indexOf(id)]]).rho;
  check('the roots of an area stand next to the learner (its first band)', ['alg0', 'geo0', 'opt0', 'ww10', 'ww20'].map((id) => rhoOf(id) < 4), [true, true, true, true, true]);
  check('depth counts across areas: Mechanik needs alg0..alg3, so it starts four levels out (behind opt3)', [F.depth[W.ids.indexOf('mech0')], rhoOf('mech0') > rhoOf('opt3')], [4, true]);
  /* Ein Weg „wymaga" läuft nach aussen: ein Eintrag liegt nahe an seiner Voraussetzung (im Mittel). */
  const gaps = [];
  for (let i = 0; i < a.links.length; i += 2) { const c = a.land[a.cellOf[a.links[i]]]; const p = a.land[a.cellOf[a.links[i + 1]]]; if (F.dir.top[a.links[i]] === F.dir.top[a.links[i + 1]]) gaps.push(L.hexDistance(c.q, c.r, p.q, p.r)); }
  check('a path "wymaga" runs outward close by (mean distance to the prerequisite < 3 cells)', gaps.reduce((s, x) => s + x, 0) / gaps.length < 3, true);
  /* Zwei Werte: die Geschichte der Optik steht am Rand ihres Bereichs zur anderen hin. */
  const ang = (id) => polarOf(a.land[a.cellOf[W.ids.indexOf(id)]]).angle;
  check('an entry with two values stands at the edge towards the other area', ang('opt5') > ang('opt4') - 1e-9 || ang('opt5') > 100, true);

  /* Neue Einträge nehmen freie Zellen: weiter unten schiebt keiner einen anderen. Neue Kennungen kommen zuletzt (wie UUIDv7: nach der Zeit). */
  const grow = (extra, values) => graphOf({ ...Object.fromEntries(W.ids.map((id, v) => [id, W.needs[v].map((p) => W.ids[p])])), ...extra },
    { values: W.values.map((x) => ({ id: x.id, label: x.label, parent: x.parent >= 0 ? W.values[x.parent].id : undefined, rank: x.rank })), memberOf: { ...Object.fromEntries(W.ids.map((id, v) => [id, W.memberOf[v].map((x) => W.values[x].id)])), ...values } });
  const movedIn = (grown) => {
    const g2 = runLayout({ ...grown, sorted: true }, {}, { budget: 40 }).run.layout;
    return W.ids.filter((id, v) => { const i = g2.cellOf[grown.ids.indexOf(id)]; const j = a.cellOf[v]; return `${g2.land[i].q},${g2.land[i].r}` !== `${a.land[j].q},${a.land[j].r}`; });
  };
  check('new entries deeper down take free cells and push nobody', movedIn(grow({ zz1: ['mech11'], zz2: ['geo5'], zz3: ['alg2'] }, { zz1: ['mech'], zz2: ['geo'], zz3: ['alg'] })), []);
  const pushed = movedIn(grow({ zz4: [], ww10: ['zz4'] }, { zz4: ['ww1'] }));
  check('a new root before an area moves only that area (Historia), never another', [pushed.length > 0, pushed.every((id) => id.startsWith('ww'))], [true, true]);

  /* Die Höhen: das Tal versenkt und flach, die Ebene 0, ein Berg nach seinen Schritten — an derselben Stelle. */
  const lifts = runLayout(W, { alg0: 1.2, alg1: 0.5 }, { budget: 200 }).run.layout;
  const liftOf = (id) => lifts.land[lifts.cellOf[W.ids.indexOf(id)]].lift;
  check('heights: known and due sink (flat), the next step is level ground, mountains rise with their steps', [liftOf('alg0'), liftOf('alg1'), liftOf('alg2'), liftOf('alg4') > liftOf('alg3'), liftOf('alg3') > 0], [0, 0, 1, true, true]);
  check('2026-11-04 equal steps: a field 10 steps away stands exactly ten times as high above the learnable level as one 1 step away', (L.liftOf('mountain', 10) - L.liftOf('ring', 0)) / (L.liftOf('mountain', 1) - L.liftOf('ring', 0)), 10);
  check('… no cap: 84 steps stand 84 steps above the learnable level', L.liftOf('mountain', 84) - L.liftOf('ring', 0), 84);
  check('learning lowers a field where it stands', [mapOf(lifts, W) === mapOf(a, W), liftOf('alg0') < a.land[a.cellOf[W.ids.indexOf('alg0')]].lift], [true, true]);
  check('due for review is a marker, the field does not move', [lifts.fields.find((f) => f.id === 'alg1')?.band, lifts.land[lifts.cellOf[W.ids.indexOf('alg1')]].due], ['due', true]);

  /* Zoom: eine Kamera auf dieselbe Karte; die anderen Bereiche am Rand in ihrer Richtung. */
  const physics = runLayout(W, {}, { budget: 60, focus: ['phys'] }).run.layout;
  check('zoom: the sub-values are the sectors, the path is the breadcrumb, the other areas wait at the rim', [physics.sectors.map((s) => s.value), physics.path.map((p) => p.value), physics.outside.map((o) => o.value)], [['mech', 'opt'], ['phys'], ['math', 'hist']]);
  check('zoom: the camera frames the focus (narrower than the whole)', physics.camera.x1 - physics.camera.x0 < a.camera.x1 - a.camera.x0, true);
  check('zoom: only the focus has fields; heights stay global (mech0 waits for alg0..alg3)', [physics.fields.every((f) => (f.kind === 'entry' ? ['mech', 'opt'].some((p) => f.id.startsWith(p)) : true)), physics.fields.find((f) => f.id === 'mech0')?.missing], [true, 4]);
  check('zoom: the outside areas stay in their direction (left areas left of the focus, right areas right)', physics.outside.map((o) => o.angle < 60 ? 'left' : o.angle > 120 ? 'right' : 'mid'), ['left', 'right']);
  const deep = runLayout(W, {}, { budget: 60, focus: ['ww2'] }).run.layout;
  check('zoom at any depth: a leaf value is its own sector', deep.sectors.map((s) => s.value), ['ww2']);
  /* Ein Feld „+N" zoomt in seinen Bereich: dort teilen ihn seine Teilbereiche, und mehr steht einzeln. */
  const small = runLayout(W, {}, { budget: 12 }).run.layout;
  const fold = small.fields.find((f) => f.kind === 'area' && f.value === 'phys');
  const into = runLayout(W, {}, { budget: 12, focus: [fold?.value] }).run.layout;
  check('zoom: a "+N" field opens its area — the same cells, more of them single', [fold !== undefined, into.fields.filter((f) => f.kind === 'entry').length > small.fields.filter((f) => f.kind === 'entry' && f.area === 1).length, mapOf(into, W) === mapOf(a, W)], [true, true, true]);
  check('zoom: inside, every sub-area folds on its own ("+N" per sub-area and band)', into.fields.filter((f) => f.kind === 'area').every((f) => ['mech', 'opt'].includes(f.value) && f.key === `grp:${f.value}:${f.band === 'due' ? 'known' : f.band}` || f.key === `grp:${f.value}:all`), true);
}

/* ── 2026-11-03 (B.1): das Budget schneidet den Baum — der Ring zuerst, Berge erst, wenn kein Ring verborgen ist ── */

/* Acht Bereiche (in der Reihenfolge des Autors), je 3 sitzen, 2 verblassen, 17 auf dem Ring, 25 dahinter. */
function bandWorld() {
  const values = Array.from({ length: 8 }, (_, a) => ({ id: `a${a}`, label: `Obszar ${a + 1}`, rank: a }));
  const spec = {};
  const memberOf = {};
  const k = {};
  for (let a = 0; a < 8; a += 1) {
    const base = [`k${a}_0`, `k${a}_1`, `k${a}_2`];
    for (const id of base) { spec[id] = []; k[id] = 1.2; memberOf[id] = [`a${a}`]; }
    for (let i = 0; i < 2; i += 1) { const id = `d${a}_${i}`; spec[id] = [base[0]]; k[id] = 0.5; memberOf[id] = [`a${a}`]; }
    for (let i = 0; i < 17; i += 1) { const id = `r${a}_${i}`; spec[id] = [base[i % 3]]; memberOf[id] = [`a${a}`]; }
    for (let i = 0; i < 25; i += 1) { const id = `m${a}_${i}`; spec[id] = [`r${a}_${i % 17}`, ...(i > 16 ? [`m${a}_${i - 17}`] : [])]; memberOf[id] = [`a${a}`]; }
  }
  return { input: { ...graphOf(spec, { values, memberOf }), sorted: true }, k };
}
{
  const { input, k } = bandWorld();
  const run = runLayout(input, k, { budget: 60 }).run.layout;
  const singles = run.fields.filter((f) => f.kind === 'entry');
  const groups = run.fields.filter((f) => f.kind === 'area');
  check('budget: the counts (24 known, 16 due, 136 ring, 200 behind)', run.counts, { known: 24, due: 16, ring: 136, mountain: 200 });
  check('budget: at most 60 fields (singles and their "+N" fields)', run.fields.length <= 60, true);
  const seen = new Map();
  for (const f of run.fields) for (const id of f.kind === 'entry' ? [f.id] : f.ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  check('budget: every entry in exactly one field', seen.size === input.ids.length && [...seen.values()].every((x) => x === 1), true);
  check('budget: the ring is not starved — the best 3 of every area stand singly (24 of 60)', [0, 1, 2, 3, 4, 5, 6, 7].map((a) => singles.filter((f) => f.band === 'ring' && f.area === a).length), [3, 3, 3, 3, 3, 3, 3, 3]);
  check('budget: the rest of an area’s ring is ONE "+N" field (○ 14), not the whole area', [0, 1, 2, 3, 4, 5, 6, 7].map((a) => groups.filter((g) => g.area === a && g.band === 'ring').map((g) => g.ring)), Array.from({ length: 8 }, () => [14]));
  check('budget: the mountains of an area are one field (▲ 25), the valley another', groups.filter((g) => g.area === 0).map((g) => [g.band, g.count]), [['known', 3], ['ring', 14], ['mountain', 25]]);
  check('budget: the best first — what unlocks most, then the author’s order (r0_0, r0_1, r0_2)', singles.filter((f) => f.band === 'ring' && f.area === 0).map((f) => f.id), ['r0_0', 'r0_1', 'r0_2']);
  const tiny = runLayout(input, k, { budget: 30 }).run.layout;
  check('budget: when "+N" fields would take over half, an area folds as one (budget 30: 8 fields + 22 singles)', [tiny.fields.filter((f) => f.kind === 'area').length, tiny.fields.filter((f) => f.kind === 'area').every((g) => g.key.endsWith(':all')), tiny.fields.length], [8, true, 30]);
  check('budget: no "+1" — a lone rest stands singly', runLayout(input, k, { budget: 120 }).run.layout.fields.every((f) => f.kind === 'entry' || f.count > 1), true);
  check('budget: mountains never single while a ring topic is hidden', singles.some((f) => f.band === 'mountain') ? groups.every((g) => g.ring === 0) : true, true);
  check('budget: due topics get their share', singles.filter((f) => f.band === 'due').length >= 4, true);
  const valleyAreas = new Set(run.fields.filter((f) => f.band === 'known' || f.band === 'due' || f.known > 0).map((f) => f.area));
  check('budget: the valley is visible in every area (singly or inside a field with its count)', [0, 1, 2, 3, 4, 5, 6, 7].every((a) => valleyAreas.has(a)), true);
  check('budget: unused share passes on — 400 shows everything singly', runLayout(input, k, { budget: 400 }).run.layout.fields.every((f) => f.kind === 'entry'), true);
  const goal = runLayout(input, k, { budget: 30, goal: 'm5_3' }).run.layout;
  check('budget: the goal and its ring step stand singly', ['m5_3', 'r5_3'].every((id) => goal.fields.some((f) => f.kind === 'entry' && f.id === id)), true);
  check('budget: shares above 1 together are scaled down', L.bandShares({ ring: 1, due: 1, known: 0 }), { ring: 0.5, due: 0.5, known: 0 });
  /* B.3 — die Zeichen der Sammelfelder sprechen dieselbe Sprache: Band und Zahl, die Teile zusammen die ganze Zahl. */
  check('B.3: a "+N" field counts by band (ring, due, known, mountains) — together its count', groups.every((g) => g.ring + g.due + g.known + g.mountain === g.count && g.cells.length === g.count), true);
  check('B.3: a mountain-only field is a mountain field with its count', groups.filter((g) => g.ring === 0 && g.due === 0 && g.known === 0).every((g) => g.band === 'mountain' && g.mountain === g.count), true);
  /* D — was das Lernen eines Ring-Eintrags frei macht. */
  const r = runLayout(input, k, { budget: 400 }).run.layout.fields.find((f) => f.id === 'r0_0');
  check('D: "Co dalej" — what learning r0_0 unlocks (m0_0 needs only it; m0_17 also needs m0_0)', r?.unlocks, ['m0_0']);
  /* C — die Wege: Voraussetzungen zwischen Feldern, durch Einträge ohne Karten hindurch. */
  check('C: links between fields (entry, prerequisite)', run.links.length / 2, input.needs.reduce((s, l) => s + l.length, 0));
  /* C — der Ring des Fortschritts: wie viele Karten sitzen. */
  const st = { ...state(input, k), cardsKnown: input.ids.map((id) => (id.startsWith('k') ? 4 : 1)), cardsTotal: input.ids.map(() => 4) };
  const e = new L.LandscapeEngine(); e.setInput(input); e.setState(st);
  const withCards = e.layout({ budget: 60 }).layout;
  check('C: a field with several cards carries its progress (known / total)', [withCards.fields.find((f) => f.id === 'r0_0')?.progress, withCards.fields.find((f) => f.key === 'grp:a0:known')?.progress], [{ known: 1, total: 4 }, { known: 12, total: 12 }]);
}
{
  /* Die Reihenfolge des Autors: a, b, c — b und c kommen oft zusammen vor; ohne `sorted` rückt das Gemeinsame zusammen. */
  const values = [{ id: 'a', rank: 0 }, { id: 'b', rank: 1 }, { id: 'c', rank: 2 }];
  const spec = { x1: [], x2: [], x3: [], y1: [], y2: [], z1: [] };
  const memberOf = { x1: ['a', 'c'], x2: ['a', 'c'], x3: ['a', 'c'], y1: ['b'], y2: ['b'], z1: ['c'] };
  const base = graphOf(spec, { values, memberOf });
  const free = runLayout(base).run.layout.areas.map((s) => s.value);
  const sorted = runLayout({ ...base, sorted: true }).run.layout.areas.map((s) => s.value);
  check('sort: without an order, co-occurrence makes neighbours (a next to c)', Math.abs(free.indexOf('a') - free.indexOf('c')), 1);
  check('sort: the author’s order (group.sort) stays left → right', sorted, ['a', 'b', 'c']);
}
{
  /* Ohne Wert: in die Mitte beim Lernenden — kein Bereich „bez wartości”. */
  const values = [{ id: 'p', label: 'P' }, { id: 'q', label: 'Q' }];
  const g = graphOf({ root: [], p1: ['root'], p2: ['p1'], q1: ['root'], q2: ['q1'] }, { values, memberOf: { p1: ['p'], p2: ['p'], q1: ['q'], q2: ['q'] } });
  const l = runLayout(g, { root: 1.2 }).run.layout;
  const root = l.fields.find((f) => f.id === 'root');
  check('centre: an entry without a value stands next to the learner, in no area', [root?.area, Math.hypot(root.x, root.y) < 2], [-1, true]);
  check('centre: no made-up area for it', l.areas.map((s) => s.value), ['p', 'q']);
}
{
  /* Ohne Gruppierung: die Teilbäume unter dem allgemeinsten Eintrag (einer → hinab, bis er sich teilt), nach ihm benannt. */
  const spec = { R: [], M: ['R'] };
  const sizes = { S1: 3, S2: 5, S3: 7, S4: 9 };
  for (const [s, n] of Object.entries(sizes)) { spec[s] = ['M']; for (let i = 0; i < n; i += 1) spec[`${s}_${i}`] = [i === 0 ? s : `${s}_${i - 1}`]; }
  spec.T = ['S1_0', 'S4_0'];
  const g = graphOf(spec);
  const l = runLayout(g, {}, { budget: 200 }).run.layout;
  check('tree: one root descends to where it splits — areas named after their most general topic', l.areas.map((s) => s.label), ['S1', 'S2', 'S3', 'S4']);
  check('tree: areas count their subtrees (no equal slices of entries)', l.areas.map((s) => s.count), [5, 6, 8, 11]);
  check('tree: what lies above the areas stands in the middle', ['R', 'M'].map((id) => l.fields.find((f) => f.id === id)?.area), [-1, -1]);
  const flat = runLayout(graphOf({ A: [], B: [], C: [] })).run.layout;
  check('tree: no tree at all → one area without a name (never „okolice: …”)', flat.areas.map((s) => s.label), ['']);
}
{
  /* Die Achse über die Stufen (Baza im Speicher, derselbe Import wie die App). */
  const doc = {
    format: 'recreatio.cogita.course', version: 1, name: 'Droga przez etapy',
    kinds: [
      { ref: '@t/obszar', name: 'Obszar', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'nr', label: 'Nr', type: 'number' }] },
      { ref: '@t/temat', name: 'Temat', label: '{nazwa}', fields: [
        { key: 'nazwa', label: 'Nazwa', type: 'line' },
        { key: 'wymaga', label: 'Najpierw', type: 'ref', to: ['@t/temat'], multi: true, prerequisite: 'up', structure: 'up' },
        { key: 'obszar', label: 'Obszar', type: 'ref', to: ['@t/obszar'] }] }
    ],
    entities: [
      { ref: '@t/o2', kinds: ['@t/obszar'], data: { nazwa: 'Drugi', nr: 2 } },
      { ref: '@t/o1', kinds: ['@t/obszar'], data: { nazwa: 'Pierwszy', nr: 1 } },
      { ref: '@t/root', kinds: ['@t/temat'], data: { nazwa: 'Przegląd' } },
      { ref: '@t/e1', kinds: ['@t/temat'], data: { nazwa: 'Etap 1', wymaga: ['@t/root'], obszar: '@t/o1' } },
      { ref: '@t/e2', kinds: ['@t/temat'], data: { nazwa: 'Etap 2', wymaga: ['@t/root', '@t/e1'], obszar: '@t/o2' } },
      { ref: '@t/c1', kinds: ['@t/temat'], data: { nazwa: 'Rozdział 1', wymaga: ['@t/e1'] } },
      { ref: '@t/d1', kinds: ['@t/temat'], data: { nazwa: 'Szczegół 1', wymaga: ['@t/c1'] } },
      { ref: '@t/w', kinds: ['@t/temat'], data: { nazwa: 'Wątek', wymaga: ['@t/c1', '@t/e2'] } }
    ],
    views: [{ ref: '@t/v', name: 'Krajobraz', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@t/temat' } }],
      group: { by: 'axis', kind: '@t/obszar', via: ['obszar'], through: 'wymaga', sort: { field: 'nr' } }, landscape: { budget: 60, bands: { ring: 0.4 } } }]
  };
  const made = await B.memoryBase(doc);
  if ('error' in made) throw new Error(made.error);
  const lib = made.lib;
  const sel = lib.selectContext();
  const byName = (n) => lib.entities().find((e) => lib.label(e) === n);
  const name = (id) => lib.label(lib.entity(id));
  const viewDoc = lib.docs('view').find((v) => v.data.mode === 'landscape');
  const view = VW.readView(viewDoc.data);
  const topics = ['Przegląd', 'Etap 1', 'Etap 2', 'Rozdział 1', 'Szczegół 1', 'Wątek'].map(byName);
  const axis = B.landscapeAxis(sel, view.group, topics);
  check('through: in a landscape a structure-up field goes over all levels (depth "all")', axis.depth, 'all');
  const set = new Set(B.axisValues(sel, axis).map((x) => x.value.id));
  const of = B.axisMembersOf(sel, axis, set);
  const names = (e) => of(e).map(name).sort();
  check('through: a detail two levels below a stage belongs to the stage’s area', names(byName('Szczegół 1')), ['Pierwszy']);
  check('through: an entry with its own value keeps only that one (stage 2 requires stage 1)', names(byName('Etap 2')), ['Drugi']);
  check('through: ancestors in two branches with two values → both (a thread between)', names(byName('Wątek')), ['Drugi', 'Pierwszy']);
  check('through: the root overview has no value', names(byName('Przegląd')), []);
  const old = B.axisMembersOf(sel, view.group, set);
  check('through: elsewhere (no depth) still one step, own and inherited together', [old(byName('Etap 2')).map(name).sort(), old(byName('Szczegół 1')).length], [['Drugi', 'Pierwszy'], 0]);
  const two = B.axisMembersOf(sel, { ...view.group, depth: 2 }, set);
  check('through: depth 2 reaches two levels (own value still wins)', [two(byName('Szczegół 1')).map(name), two(byName('Etap 2')).map(name)], [['Pierwszy'], ['Drugi']]);
  check('through: tree groups keep the old one step (Etap 2 in both groups)', B.groupsOf(sel, [byName('Etap 2').id], view.group).map((g) => g.label).sort(), ['Drugi', 'Pierwszy']);
  check('through: "depth" reads ("all", a number, nothing without through)', [B.readAxis({ kind: 'k', through: 'f', depth: 'all' }).depth, B.readAxis({ kind: 'k', through: 'f', depth: 2 }).depth, B.readAxis({ kind: 'k', depth: 'all' }).depth, B.readAxis({ kind: 'k', through: 'f', depth: 'x' }).depth], ['all', 2, undefined, undefined]);
  const input = B.landscapeInput({ select: sel, deps: lib.dependencies(), label: (e) => lib.label(e) }, topics, view.group, { askable: new Set(topics.map((e) => e.id)) });
  check('input: the author’s order (sort by nr) and the values in it', [input.sorted, input.values.map((v) => v.label)], [true, ['Pierwszy', 'Drugi']]);
  const run = runLayout(input).run.layout;
  check('input: the root overview stands in the middle, no area', run.fields.find((f) => f.id === byName('Przegląd').id)?.area, -1);
  check('view: "bands" read and written back', [view.landscape, VW.viewJson(view).landscape], [{ budget: 60, bands: { ring: 0.4 } }, { budget: 60, bands: { ring: 0.4 } }]);
}

/* ── Gross: 10 000 Einträge, 50 000 Kanten ─────────────────────────────── */
{
  const N = 10000;
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const needs = Array.from({ length: N }, () => []);
  let edges = 0;
  for (let v = 1; v < N && edges < 50000; v += 1) {
    const k = 5;
    for (let j = 0; j < k && edges < 50000; j += 1) { const p = Math.floor(rnd() * v); if (!needs[v].includes(p)) { needs[v].push(p); edges += 1; } }
  }
  const values = Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, label: `Temat ${i}`, parent: i < 8 ? -1 : i % 8, rank: i }));
  const input = { ids: Array.from({ length: N }, (_, i) => `e${i}`), labels: Array.from({ length: N }, (_, i) => `Wpis ${i}`), needs, learnable: Array(N).fill(true), inView: Array(N).fill(true), values, memberOf: Array.from({ length: N }, (_, i) => [8 + (i % 32)]) };
  const known = {};
  for (let i = 0; i < 1500; i += 1) known[`e${i}`] = 1.1;
  const e = new L.LandscapeEngine();
  const t0 = performance.now();
  e.setInput(input);
  const t1 = performance.now();
  e.setState(state(input, known));
  const t2 = performance.now();
  const run = e.layout({ budget: 60 });
  const t3 = performance.now();
  known.e1500 = 1.1;
  e.setState(state(input, known));
  e.layout({ budget: 60 });
  const t4 = performance.now();
  console.log(`info 10 000 / ${edges}: graph ${(t1 - t0).toFixed(0)} ms, heights ${(t2 - t1).toFixed(0)} ms, layout ${(t3 - t2).toFixed(0)} ms, after one answer ${(t4 - t3).toFixed(0)} ms`);
  check('10 000 entries: a picture within the budget (singles and "+N" fields)', run.layout.fields.length <= 60 && run.layout.fields.filter((f) => f.kind === 'entry').length >= 30, true);
  check('10 000 entries: the fixed map (graph + cells) under 4 s in node', t1 - t0 < 4000, true);
  check('10 000 entries: after one answer (heights + layout) under 1.5 s in node', t4 - t3 < 1500, true);
}

/* ── 2026-11-03 — DER VERSCHACHTELTE KRAJOBRAZ (`landscapeNest.ts`) auf dem Beispiel „Świat wiedzy" ────── */
{
  const doc = JSON.parse(readFileSync(join(process.cwd(), '../templates/cogita/przyklad-swiat.json'), 'utf8'));
  const made = await B.memoryBase(doc);
  if ('error' in made) throw new Error(made.error);
  const lib = made.lib;
  const sel = lib.selectContext();
  const viewDoc = lib.docs('view').find((v) => v.data.name === 'Krajobraz pól');
  const view = VW.readView(viewDoc.data);
  check('nest: the view setting reads ("landscape": {"nest": "pole"}) and is written back', [view.landscape?.nest, VW.viewJson(view).landscape?.nest], ['pole', 'pole']);
  const topics = lib.entities().filter((e) => e.kinds.some((k) => lib.kind(k)?.name === 'Temat'));
  /* Knoten zuerst: „Matematyka" ist auch eine Dziedzina. */
  const isNode = (e) => e.kinds.some((k) => lib.kind(k)?.name === 'Pole mapy');
  const byName = (n) => lib.entities().find((e) => lib.label(e) === n && isNode(e)) ?? lib.entities().find((e) => lib.label(e) === n);
  const id = (n) => byName(n).id;
  const input = B.landscapeInput({ select: sel, deps: lib.dependencies(), label: (e) => lib.label(e) }, topics, null, { askable: new Set(topics.map((e) => e.id)) });
  const tree = N.readNest(lib, input.ids, 'pole');
  const order = (a, b) => input.ids.indexOf(a) - input.ids.indexOf(b);
  const at = (n) => input.ids.indexOf(id(n));
  const levelOf = (k, focus, weak = []) => {
    const st = { ...state(input, k, weak), cardsKnown: input.ids.map((x) => ((k[x] ?? 0) >= 1 ? 2 : 0)), cardsTotal: input.ids.map(() => 2) };
    const e = new L.LandscapeEngine(); e.setInput(input); e.setState(st);
    const base = e.layout({ budget: 1_000_000, focus: [] }).layout;
    return N.nestLayout(input, base, st, tree, focus === null ? null : id(focus), order);
  };
  const labels = (lay) => lay.fields.map((f) => `${f.kind === 'area' ? '▣' : '·'}${f.label}`);
  const top = levelOf({}, null);
  check('nest: the overview shows only the top level (three top fields, no topic)', labels(top), ['▣Matematyka', '▣Fizyka', '▣Historia nauki']);
  check('nest: one zoom opens exactly one level (Matematyka → Liczby, Algebra)', labels(levelOf({}, 'Matematyka')), ['▣Liczby', '▣Algebra']);
  check('nest: a level mixes nodes and topics standing there directly (Fizyka)', labels(levelOf({}, 'Fizyka')).sort(), ['·Wielkości i jednostki', '▣Ruch', '▣Siły'].sort());
  const deep = levelOf({}, 'Dziesiętne i procenty');
  check('nest: the 5-level branch — breadcrumbs from the top to the 5th level', deep.path.map((p) => p.label), ['Matematyka', 'Liczby', 'Działania', 'Ułamki', 'Dziesiętne i procenty']);
  check('nest: … and the deepest level holds its topics', labels(deep).sort(), ['·Ułamki dziesiętne', '·Procenty'].sort());
  check('nest: a middle level holds its node and its own topics (Działania)', labels(levelOf({}, 'Działania')).sort(), ['·Dodawanie i odejmowanie', '·Mnożenie i dzielenie', '▣Ułamki'].sort());
  check('nest: the 2-level branch (Fizyka → Ruch) — breadcrumbs', levelOf({}, 'Ruch').path.map((p) => p.label), ['Fizyka', 'Ruch']);
  check('nest: back to the top (no focus) — no breadcrumbs', top.path, []);
  check('nest: no hex without meaning — every cell is a field, every field one cell', [top.land.every((c) => c.field !== null), top.fields.length === top.land.length, levelOf({}, 'Fizyka').land.every((c) => c.field !== null)], [true, true, true]);
  check('nest: every field of the overview opens (a key, a label)', top.fields.every((f) => typeof f.key === 'string' && f.label !== ''), true);
  /* Der Ring einer Gruppe: gewusste / alle Karten im GANZEN Teilbaum. */
  const k1 = { [id('Liczby naturalne')]: 1.4, [id('Dodawanie i odejmowanie')]: 1.4 };
  const math = levelOf(k1, null).fields.find((f) => f.label === 'Matematyka');
  const mathTopics = N.nestSubtree(tree, id('Matematyka'), input.ids);
  check('nest: the subtree of Matematyka holds its 12 topics (all depths)', mathTopics.length, 12);
  check('nest: a group’s ring = known / all cards of its subtree (2 known topics × 2 cards of 12 × 2)', math.progress, { known: 4, total: 24 });
  check('nest: … the same sums one level down (Liczby: 7 topics, 2 known)', levelOf(k1, 'Matematyka').fields.find((f) => f.label === 'Liczby').progress, { known: 4, total: 14 });
  /* Höhe und Band einer Gruppe. */
  check('nest: something ready inside → the group is level (ring, height 0)', [math.band, math.height], ['ring', 0]);
  const hist = top.fields.find((f) => f.label === 'Historia nauki');
  const histLow = Math.min(...N.nestSubtree(tree, id('Historia nauki'), input.ids).map((x) => Math.max(1, Math.round(top.heights[input.ids.indexOf(x)]))));
  check('nest: nothing ready inside → a mountain as high as the nearest thing inside', [hist.band, hist.missing], ['mountain', histLow]);
  check('nest: … and a mountain stands higher than a ring field', hist.lift > top.fields.find((f) => f.label === 'Matematyka').lift, true);
  const all = Object.fromEntries(N.nestSubtree(tree, id('Fizyka'), input.ids).map((x) => [x, 1.4]));
  const phys = levelOf({ ...k1, ...all }, null).fields.find((f) => f.label === 'Fizyka');
  check('nest: everything inside known → the group sinks into the valley', [phys.band, phys.lift === 0], ['known', true]);
  const half = { ...all, [id('Prędkość')]: 0.5 };
  const physDue = levelOf({ ...k1, ...half }, null).fields.find((f) => f.label === 'Fizyka');
  check('nest: learned but one due → deep in the valley with the repeat marker (due > 0)', [physDue.band, physDue.lift === 0, physDue.due], ['due', true, 1]);
  /* Sperre: alles, was darin dran wäre, braucht erst eine Powtórka. */
  const weakK = { [id('Liczby naturalne')]: 0.5 };
  const liczby = levelOf(weakK, 'Liczby', [id('Liczby naturalne')]);
  const dz = liczby.fields.find((f) => f.label === 'Działania');
  check('nest: a group whose ring entries all need a review first is locked', [dz.band, dz.locked, liczby.locked[at('Dodawanie i odejmowanie')]], ['ring', true, 1]);
  check('nest: groups not waiting on a review stay open', levelOf({}, null).fields.every((f) => f.locked === false), true);
  /* Feste Lage: dicht gepackt, unabhängig vom Fortschritt. */
  const pos = (lay) => lay.fields.map((f) => `${f.key}@${f.q},${f.r}`).sort().join('|');
  check('nest: positions are fixed — progress does not move fields', pos(levelOf({}, 'Fizyka')), pos(levelOf({ ...k1, ...half }, 'Fizyka')));
  const slots = N.nestSlots(7);
  check('nest: slots are packed (ring 1 first, no cell twice, upper half)', [slots.slice(0, 3).every((s) => s.ring === 1), new Set(slots.map((s) => `${s.q},${s.r}`)).size, slots.every((s) => s.y >= -1e-9)], [true, 7, true]);
  /* Ohne `nest`: der alte Widok („Krajobraz wiedzy", nach Dziedziny), jetzt ohne Zusammenfassen. */
  const oldView = VW.readView(lib.docs('view').find((v) => v.data.name === 'Krajobraz wiedzy').data);
  const flatInput = B.landscapeInput({ select: sel, deps: lib.dependencies(), label: (e) => lib.label(e) }, topics, B.landscapeAxis(sel, oldView.group, topics), { askable: new Set(topics.map((e) => e.id)) });
  const flat = runLayout(flatInput, {}, { budget: 1_000_000 }).run.layout;
  check('without nest: every topic with cards its own field (nothing merged)', flat.fields.filter((f) => f.kind === 'entry').length, Array.from(flatInput.learnable).filter(Boolean).length);
}

/* ── Die eine Logik: rel "chain" ────────────────────────────────────────── */
{
  const deps = [
    { parent: 'A', child: 'B', kind: 'prerequisite', impact: 0.5 },
    { parent: 'X', child: 'B', kind: 'prerequisite', impact: 0.5 },
    { parent: 'B', child: 'C', kind: 'prerequisite', impact: 0.5 },
    { parent: 'Z', child: 'Q', kind: 'prerequisite', impact: 0.5 }
  ];
  const graph = PR.prerequisiteGraph(deps);
  check('chainNeeds: everything before (also through entries without cards)', KN.chainNeeds(['C'], graph).sort(), ['A', 'B', 'X']);
  const cards = { A: ['#a1', '#a2'], B: ['#b1'], X: [] };
  const answered = new Set(['a1', 'b1']);
  const src = { entity: () => undefined, look: { kind: () => undefined, entity: () => undefined }, graph, askable: () => true, cardsOf: (id) => (cards[id] ?? []).map((k) => k.slice(1)), answered: (k) => answered.has(k) };
  check('rel chain: the ANSWERED cards of the whole chain (a2 never asked does not count)', KN.itemRelated(src, 'C', 'chain').sort(), ['#a1', '#b1']);
  const facts = (k) => ({ values: {}, knowness: (id) => k[id] ?? 0, answered: () => null, visited: new Set(), now: new Date(0), related: (rel) => KN.itemRelated(src, 'C', rel) });
  const cond = LG.readCondition({ type: 'knowness', rel: 'chain', band: 'known' });
  check('lock condition reads', cond, { type: 'knowness', rel: 'chain', band: 'known' });
  check('lock condition: holds when every answered card of the chain sits', LG.holds(cond, facts({ '#a1': 1.5, '#b1': 1.2 })), true);
  check('lock condition: fails while one answered card is due', LG.holds(cond, facts({ '#a1': 1.5, '#b1': 0.6 })), false);
  check('lock condition in words', LG.conditionText(cond).includes('całej drogi'), true);
  check('relation listed for the editor', LG.RELATIONS.includes('chain'), true);
}

/* ── Der Widok ──────────────────────────────────────────────────────────── */
{
  const v = VW.readView({ name: 'Krajobraz', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: 'k' } }], landscape: { budget: 30 } });
  check('view mode landscape reads', [v.mode, v.landscape], ['landscape', { budget: 30 }]);
  check('view JSON keeps it', VW.viewJson(v).landscape, { budget: 30 });
  check('budget clamped (6–400)', VW.readView({ mode: 'landscape', landscape: { budget: 9999 } }).landscape, { budget: 400 });
  check('old views without landscape stay as they were', VW.viewJson(VW.readView({ name: 'T', mode: 'table' })).landscape, undefined);
  check('mode label', VW.LIST_MODE_LABEL.landscape, 'Krajobraz');
}

/* ── 2026-11-03 (Prompt 3): die Wege als EIN Graph auf dem Raster, Zeichen ohne Überdeckung, die Zahlen des Weges ── */
{
  const cells = [];
  for (let q = -3; q <= 3; q += 1) for (let r = -3; r <= 3; r += 1) if (Math.abs(q + r) <= 3) cells.push({ q, r });
  const at = (q, r) => cells.findIndex((c) => c.q === q && c.r === r);
  const dist = (x, y) => (Math.abs(x.q - y.q) + Math.abs(x.r - y.r) + Math.abs(x.q + x.r - y.q - y.r)) / 2;
  const one = () => 1;
  const a = at(0, 0);
  const b = at(3, 0);
  const c = at(3, -1);
  const r1 = D.hexRoutes(cells, [[a, b]], one);
  check('a route between two fields goes from cell to neighbouring cell', r1.paths[0].every((x, i, p) => i === 0 || dist(cells[p[i - 1]], cells[x]) === 1), true);
  check('… as short as the grid allows (3 steps: 4 cells)', r1.paths[0].length, 4);
  check('… each piece once', r1.segments.length, 3);
  const r2 = D.hexRoutes(cells, [[a, b], [a, c]], one);
  check('two edges with a common stretch: no piece twice', new Set(r2.segments.map(([x, y]) => D.segmentKey(x, y))).size, r2.segments.length);
  check('… the second edge takes the stretch already laid (4 pieces, not 6)', r2.segments.length, 4);
  const wall = new Set([at(1, 0), at(2, 0)]);
  const r3 = D.hexRoutes(cells, [[a, b]], (i) => (wall.has(i) ? 6 : 1));
  check('a route goes around foreign fields when that is cheaper', r3.paths[0].some((x) => wall.has(x)), false);
  check('… and still from neighbour to neighbour', r3.paths[0].every((x, i, p) => i === 0 || dist(cells[p[i - 1]], cells[x]) === 1), true);
  check('the same input gives the same routes (deterministic)', JSON.stringify(D.hexRoutes(cells, [[a, b], [a, c]], one)), JSON.stringify(r2));
  check('edges between cells: each pair once, without direction, no self edge, no missing cell', D.cellEdges([[1, 2], [2, 1], [3, 3], [-1, 2], [2, 4]]), [[1, 2], [2, 4]]);
  const box = (x0, y0, w = 10, h = 10) => ({ x0, x1: x0 + w, y0, y1: y0 + h });
  const P = D.placeLabels([{ key: 'low', box: box(0, 0), rank: 5 }, { key: 'high', box: box(5, 5), rank: 1 }, { key: 'free', box: box(40, 0), rank: 9 }], [box(100, 100)]);
  check('labels: the more important stands, the lower one under it goes, a free one stays', [...P.kept].sort(), ['free', 'high']);
  check('labels: nothing stands on what is taken (the learner, his name)', [...D.placeLabels([{ key: 'x', box: box(100, 100), rank: 0 }], [box(105, 105)]).kept], []);
  check('labels: equal importance — the first given stays', [...D.placeLabels([{ key: 'a', box: box(0, 0), rank: 2 }, { key: 'b', box: box(3, 3), rank: 2 }]).kept], ['a']);
  const many = [];
  let seed = 3;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 600; i += 1) many.push({ key: `k${i}`, box: box(rnd() * 800, rnd() * 400, 8 + rnd() * 30, 10), rank: Math.floor(rnd() * 9) });
  const kept = D.placeLabels(many).kept;
  const standing = many.filter((m) => kept.has(m.key));
  let crossing = 0;
  for (let i = 0; i < standing.length; i += 1) for (let j = i + 1; j < standing.length; j += 1) if (D.boxesOverlap(standing[i].box, standing[j].box)) crossing += 1;
  check('labels: of 600 random labels, no two that stand overlap', crossing, 0);
  check('labels: and many stand', standing.length > 100, true);
  check('route numbers: 20 steps — 1, 2, 3 and the goal (21) carry a number, the rest a dot', Array.from({ length: 21 }, (_, i) => (D.numberedStep(i + 1, 20) ? 'n' : '.')).join(''), 'nnn.................n');
  check('route numbers: 3 steps — all four carry a number', [1, 2, 3, 4].map((i) => D.numberedStep(i, 3)), [true, true, true, true]);
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
