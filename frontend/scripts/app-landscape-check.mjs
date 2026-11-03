/**
 * 2026-11-03 — DER KRAJOBRAZ (`cogita/landscape.ts`), nachgemessen: die Höhen (gemeinsame Voraussetzungen einmal,
 * ein Kreis ein Schritt, Einträge ohne Karten durchsichtig, Verblassen: „do powtórki" bleibt gelernt, unter 0,1 fehlt
 * es wieder), die Sperre (schwache, schon gefragte Karten in der Kette; nie gefragte sperren nicht), der Weg zum Ziel
 * (die Grundlagen zuerst, so viele Schritte wie die Höhe), die Gestalt (deterministisch, stabil, Budget und Bereiche,
 * Fokus mit globalen Höhen, ein Eintrag mit zwei Werten zwischen ihnen, ohne Werte aus der Nähe im Graphen) — und die
 * Beziehung `rel: "chain"` der einen Logik (`knowing.ts`), der Modus `landscape` eines Widoku (`views.ts`).
 *
 *   node scripts/app-landscape-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-landscape-'));
const names = ['landscape', 'knowing', 'logic', 'views', 'prerequisites', 'knowness'];
await build({
  entryPoints: Object.fromEntries(names.map((n) => [n, `src/app/cogita/${n}.ts`])),
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error',
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [L, KN, LG, VW, PR, K] = await Promise.all(names.map(load));

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
check('shared prerequisite counted once: D = |{A, B, C}| = 3, not 4', H(diamond).D, 3);
check('diamond with A known: D = 2 (B and C)', H(diamond, { A: 1 }).D, 2);

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

/* ── Gestalt ─────────────────────────────────────────────────────────────── */

/* Eine Welt: drei Fächer (Mathe, Physik, Geschichte) mit Unterwerten; Voraussetzungen innerhalb und zwischen. */
function world(size = 12) {
  const values = [
    { id: 'math', label: 'Matematyka' }, { id: 'alg', label: 'Algebra', parent: 'math' }, { id: 'geo', label: 'Geometria', parent: 'math' },
    { id: 'phys', label: 'Fizyka' }, { id: 'mech', label: 'Mechanika', parent: 'phys' }, { id: 'opt', label: 'Optyka', parent: 'phys' },
    { id: 'hist', label: 'Historia' }, { id: 'ww1', label: 'I wojna', parent: 'hist' }, { id: 'ww2', label: 'II wojna', parent: 'hist' }
  ];
  const spec = {};
  const memberOf = {};
  const leaves = ['alg', 'geo', 'mech', 'opt', 'ww1', 'ww2'];
  for (const leaf of leaves) {
    for (let i = 0; i < size; i += 1) {
      const id = `${leaf}${i}`;
      spec[id] = i === 0 ? [] : [`${leaf}${i - 1}`];
      memberOf[id] = [leaf];
    }
  }
  /* Mechanik braucht Algebra; die Geschichte der Optik steht in beiden. */
  spec.mech0 = ['alg3'];
  memberOf['opt5'] = ['opt', 'ww2'];
  return graphOf(spec, { values, memberOf });
}
const W = world();
const runLayout = (input, k = {}, options = {}) => {
  const e = new L.LandscapeEngine();
  e.setInput(input);
  e.setState(state(input, k));
  return { e, run: e.layout(options) };
};
const sig = (layout) => layout.fields.map((f) => `${f.key}@${f.q},${f.r}:${f.height}`).join('|');
{
  const a = runLayout(W, {}, { budget: 40 }).run.layout;
  const b = runLayout(W, {}, { budget: 40 }).run.layout;
  check('layout is deterministic (same base, same progress → same picture)', sig(a) === sig(b), true);
  check('budget: at most 40 single fields', a.fields.filter((f) => f.kind === 'entry').length, 40);
  check('budget: the rest gathers in areas', a.fields.filter((f) => f.kind === 'area').reduce((s, f) => s + f.count, 0), W.ids.length - 40);
  check('budget: every ring entry is shown singly first', a.fields.filter((f) => f.kind === 'entry' && f.band === 'ring').length, a.counts.ring);
  const cells = new Set(a.fields.map((f) => `${f.q},${f.r}`));
  check('no two fields share a hex', cells.size, a.fields.length);
  check('nothing behind or on the learner', a.fields.every((f) => f.y > 0.4), true);
  check('three subjects divide the semicircle', a.sectors.map((s) => s.value), ['math', 'phys', 'hist']);
  const ring = a.fields.filter((f) => f.kind === 'entry' && f.band === 'ring').map((f) => Math.hypot(f.x, f.y));
  const mountains = a.fields.filter((f) => f.kind === 'entry' && f.band === 'mountain').map((f) => Math.hypot(f.x, f.y));
  check('mountains stand behind the ring', Math.min(...mountains) > Math.min(...ring), true);
  const angleOf = (id) => a.fields.find((f) => f.id === id)?.angle;
  const alg = angleOf('alg0');
  check('Algebra lies left of Mechanik, Mechanik left of the history (sector order)', alg < angleOf('mech0') && angleOf('mech0') < angleOf('ww10'), true);

  /* Stabilität: ein Eintrag gelernt — was darauf aufbaut, rückt näher, der Rest bleibt meist stehen. */
  const learnt = runLayout(W, { alg0: 1.2 }, { budget: 40 }).run.layout;
  const before = new Map(a.fields.filter((f) => f.kind === 'entry').map((f) => [f.key, `${f.q},${f.r}`]));
  const moved = learnt.fields.filter((f) => f.kind === 'entry' && before.has(f.key) && before.get(f.key) !== `${f.q},${f.r}`).length;
  check('stable: learning one entry moves few fields (< 40 %)', moved < 0.4 * before.size, true);
  const alg1 = (l) => l.fields.find((f) => f.id === 'alg1');
  check('what builds on the learnt entry comes closer (alg1: mountain → ring)', [alg1(a)?.band, alg1(learnt)?.band, Math.hypot(alg1(learnt).x, alg1(learnt).y) < Math.hypot(alg1(a).x, alg1(a).y)], ['mountain', 'ring', true]);

  /* Fokus: Physik — ihre Unterwerte teilen den Halbkreis; die Höhen bleiben global (Mechanik wartet auf Algebra). */
  const physics = runLayout(W, {}, { budget: 60, focus: ['phys'] }).run.layout;
  check('focus Physik: its sub-values are the sectors', physics.sectors.map((s) => s.value), ['mech', 'opt']);
  check('focus keeps heights global: mech0 waits for alg0..alg3 (4 steps)', physics.fields.find((f) => f.id === 'mech0')?.height, 4);
  check('focus: outside areas stand at the edges', physics.fields.filter((f) => f.edge).map((f) => f.value).sort(), ['hist', 'math']);
  check('focus path for the breadcrumbs', physics.path.map((p) => p.value), ['phys']);
  const deep = runLayout(W, {}, { budget: 60, focus: ['ww2'] }).run.layout;
  check('focus at any depth: II wojna (a leaf) is its own sector; I wojna waits at the edge', [deep.sectors.map((s) => s.value), deep.fields.filter((f) => f.edge).map((f) => f.value).sort()], [['ww2'], ['math', 'phys', 'ww1']]);
  const mixed = runLayout(W, {}, { budget: 60, focus: ['phys', 'hist'] }).run.layout;
  check('mixed focus: Physik + Historia spread their sub-values together', mixed.sectors.map((s) => s.value).sort(), ['mech', 'opt', 'ww1', 'ww2']);

  /* Zwei Werte: die Geschichte der Optik steht zwischen Optyka und II wojna. */
  const both = runLayout(W, {}, { budget: 200 }).run.layout;
  const ang = (id) => both.fields.find((f) => f.id === id).angle;
  check('an entry with two values sits between their areas', ang('opt5') > ang('opt0') && ang('opt5') < ang('ww20'), true);

  /* Ziel: der Weg markiert, auch in Bereichen. */
  const goal = runLayout(W, {}, { budget: 12, goal: 'mech2' }).run.layout;
  check('goal: steps = height of the goal (alg0..3, mech0, mech1 = 6)', goal.goal?.steps, 6);
  check('goal: the next ring step is alg0', goal.goal?.next, ['alg0']);
  check('goal: route steps inside areas are counted', goal.fields.filter((f) => f.kind === 'area').reduce((s, f) => s + f.route, 0) + goal.fields.filter((f) => f.kind === 'entry' && f.route === 1).length, 6);
}
{
  /* Ohne Werte: Winkel aus der Nähe im Graphen; ohne Voraussetzungen: alles auf dem Ring. */
  const flat = graphOf({ A: [], B: ['A'], C: ['B'], X: [], Y: ['X'] });
  const l = runLayout(flat).run.layout;
  const angle = (id) => l.fields.find((f) => f.id === id).angle;
  check('no grouping: neighbours in the graph are neighbours in the arc', Math.abs(angle('A') - angle('B')) < Math.abs(angle('A') - angle('Y')), true);
  const none = graphOf({ A: [], B: [], C: [] });
  const n = runLayout(none).run.layout;
  check('no prerequisites: everything not learned is on the ring', n.fields.every((f) => f.band === 'ring'), true);
  check('no prerequisites: the view says so', n.notes.some((t) => t.includes('kolejności nauki')), true);
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
  check('10 000 entries: a picture within the budget', run.layout.fields.filter((f) => f.kind === 'entry').length, 60);
  check('10 000 entries: after one answer (heights + layout) under 1.5 s in node', t4 - t3 < 1500, true);
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

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
