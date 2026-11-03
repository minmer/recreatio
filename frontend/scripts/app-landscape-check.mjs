/**
 * 2026-11-03 — DER KRAJOBRAZ (`cogita/landscape.ts`), nachgemessen: die Höhen (gemeinsame Voraussetzungen einmal,
 * ein Kreis ein Schritt, Einträge ohne Karten durchsichtig, Verblassen: „do powtórki" bleibt gelernt, unter 0,1 fehlt
 * es wieder), die Sperre (schwache, schon gefragte Karten in der Kette; nie gefragte sperren nicht), der Weg zum Ziel
 * (die Grundlagen zuerst, so viele Schritte wie die Höhe), die Gestalt (deterministisch, stabil, Budget und Bereiche,
 * Fokus mit globalen Höhen, ein Eintrag mit zwei Werten zwischen ihnen, ohne Werte aus der Nähe im Graphen) — und die
 * Beziehung `rel: "chain"` der einen Logik (`knowing.ts`), der Modus `landscape` eines Widoku (`views.ts`). 2026-11-03: das Budget
 * nach Bändern (Ring höchstens, Tal immer, Sammelfelder je Bereich), Reihen (der Ring auf einer Reihe), keine Fläche über
 * einer anderen, die Reihenfolge des Autors, die Mitte, Bereiche aus dem Baum, die Achse über alle Stufen (`depth`).
 *
 *   node scripts/app-landscape-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-landscape-'));
const names = ['landscape', 'knowing', 'logic', 'views', 'prerequisites', 'knowness'];
/* 2026-11-03 — dazu eine Baza im Speicher (derselbe Import wie die App): Zugehörigkeit zu einer Achse über die Stufen. */
const baseEntry = join(workspace, 'base-entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(baseEntry, `
export { memoryBase } from '${app}cogita/memoryBase';
export { axisMembersOf, axisValues, groupsOf, readAxis, readGrouping } from '${app}cogita/selection';
export { landscapeAxis, landscapeInput } from '${app}cogita/landscapeData';
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
const [L, KN, LG, VW, PR, K] = await Promise.all(names.map(load));
const B = await load('base');

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

/* ── 2026-11-03: Budget nach Bändern, Reihen, Flächen, Mitte, Bäume ─────── */

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
/* Die gezeichneten Flächen wie in der Ansicht (`LandscapeView.tsx`): je Feld und der Lernende in (0, 0). */
const facesOf = (layout) => {
  const C = L.LS_SHRINK / Math.sqrt(3);
  const face = (x, y, lift) => [0, 60, 120, 180, 240, 300].map((a) => [x + Math.cos((a * Math.PI) / 180) * C, -y * L.LS_FORE - lift * L.LS_TILE - Math.sin((a * Math.PI) / 180) * C * L.LS_FORE]);
  return [...layout.fields.map((f) => ({ key: f.key, poly: face(f.x, f.y, f.lift) })), { key: 'Ty', poly: face(0, 0, layout.me.lift) }];
};
const overlapsOf = (layout) => {
  const faces = facesOf(layout);
  const out = [];
  for (let i = 0; i < faces.length; i += 1) for (let j = i + 1; j < faces.length; j += 1) if (L.polygonsOverlap(faces[i].poly, faces[j].poly, 1e-6)) out.push(`${faces[i].key}×${faces[j].key}`);
  return out;
};
/* Je Reihe von links nach rechts: die Bereiche in ihrer Reihenfolge (Einzelfelder und Sammelfelder; ohne Mitte und Ränder). */
const rowOrderBreaks = (layout) => {
  const rows = new Map();
  for (const f of layout.fields) {
    if (f.edge || f.area < 0) continue;
    const list = rows.get(f.row) ?? [];
    list.push({ area: f.area, at: Math.atan2(f.y, -f.x), key: f.key });
    rows.set(f.row, list);
  }
  const out = [];
  for (const [row, list] of rows) {
    list.sort((a, b) => a.at - b.at);
    for (let i = 1; i < list.length; i += 1) if (list[i].area < list[i - 1].area) out.push(`row ${row}: ${list[i - 1].key} (area ${list[i - 1].area}) before ${list[i].key} (area ${list[i].area})`);
  }
  return out;
};
/* Wie weit (Zellen) ein Feld ausserhalb des Bogens seines Bereichs steht. */
const drift = (layout) => layout.fields.filter((f) => !f.edge && f.area >= 0).map((f) => {
  const s = layout.sectors[f.area];
  const at = (Math.atan2(f.y, -f.x) * 180) / Math.PI;
  return Math.max(0, s.from - at, at - s.to) / (57.3 / f.row);
});
{
  const { input, k } = bandWorld();
  const run = runLayout(input, k, { budget: 60 }).run.layout;
  const entries = run.fields.filter((f) => f.kind === 'entry');
  const groups = run.fields.filter((f) => f.kind === 'area');
  check('bands: the counts (24 known, 16 due, 136 ring, 200 behind)', run.counts, { known: 24, due: 16, ring: 136, mountain: 200 });
  check('bands: at most the budget stands singly', entries.length <= 60, true);
  check('bands: the ring takes at most its share (½ of 60)', entries.filter((f) => f.band === 'ring').length <= 30, true);
  const ringGroups = groups.filter((f) => f.band === 'ring');
  check('bands: the ring over its share gathers per area („Obszar n · 17 do nauki”)', ringGroups.length > 0 && ringGroups.every((f) => f.ring === f.count && f.count === 17) && new Set(ringGroups.map((f) => f.value)).size === ringGroups.length, true);
  check('bands: every ring topic is single or counted once', entries.filter((f) => f.band === 'ring').length + ringGroups.reduce((s, f) => s + f.count, 0), 136);
  check('bands: due topics stay single while the budget allows (16)', entries.filter((f) => f.band === 'due').length, 16);
  const valleyAreas = new Set(run.fields.filter((f) => f.band === 'known' || f.band === 'due' || f.known > 0).map((f) => f.area));
  check('bands: the valley is visible in every area (singly or one counted field)', [0, 1, 2, 3, 4, 5, 6, 7].every((a) => valleyAreas.has(a)), true);
  check('bands: configurable — ring 20 % → at most 12 ring singles', runLayout(input, k, { budget: 60, bands: { ring: 0.2 } }).run.layout.fields.filter((f) => f.kind === 'entry' && f.band === 'ring').length <= 12, true);
  check('bands: shares above 1 together are scaled down', L.bandShares({ ring: 1, due: 1, known: 0 }), { ring: 0.5, due: 0.5, known: 0 });
  /* Ein Ziel: sein Ring-Schritt steht einzeln, auch wenn sein Bereich gesammelt ist. */
  const goal = runLayout(input, k, { budget: 60, goal: 'm5_3' }).run.layout;
  check('bands: the goal and its ring step stand singly', ['m5_3', 'r5_3'].every((id) => goal.fields.some((f) => f.kind === 'entry' && f.id === id)), true);

  /* Die Gestalt: eine Zelle je Feld, der Ring auf seiner Reihe, nichts überdeckt etwas. */
  const cells = new Set(run.fields.map((f) => `${f.q},${f.r}`));
  check('cells: one field per hex, the learner keeps (0,0)', cells.size === run.fields.length && !cells.has('0,0'), true);
  check('rows: height-0 fields (singles and ring groups) stand on the ring row(s)', run.fields.filter((f) => f.band === 'ring').every((f) => run.rows.ring.includes(f.row)), true);
  check('rows: the valley inside the ring, the mountains outside', run.fields.filter((f) => f.band === 'known' || f.band === 'due').every((f) => f.row < run.ring) && run.fields.filter((f) => f.band === 'mountain').every((f) => f.row > Math.max(...run.rows.ring)), true);
  check('faces: no drawn face overlaps another (incl. the learner and group fields)', overlapsOf(run), []);
  const narrow = runLayout(input, k, { budget: 22, narrow: true }).run.layout;
  check('faces: also on a phone (budget 22, narrow)', [overlapsOf(narrow).length, narrow.fields.filter((f) => f.kind === 'entry').length <= 22], [0, true]);
  const areaOrder = (layout) => layout.fields.filter((f) => f.kind === 'area' && f.band === 'ring').map((f) => Math.atan2(f.y, -f.x));
  const order = areaOrder(run);
  check('rows: ring groups follow the areas left → right', order.every((x, i) => i === 0 || x > order[i - 1]), true);
  check('order: every row goes left → right in area order', rowOrderBreaks(run), []);
  check('order: no field more than one cell outside its area’s arc', drift(run).filter((d) => d > 1).length, 0);
  check('order: also on a phone', [rowOrderBreaks(narrow), drift(narrow).filter((d) => d > 1).length], [[], 0]);
}
{
  /* Ein Bereich läuft über: 30 Ring-Schritte auf dem Weg zum Ziel (die stehen immer einzeln) — mehr, als sein Bogen hält. */
  const values = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
  const spec = { ka: [], kb: [], kc: [] };
  const memberOf = { ka: ['a'], kb: ['b'], kc: ['c'] };
  const k = { ka: 1.2, kb: 1.2, kc: 1.2 };
  for (const a of ['a', 'b', 'c']) {
    const n = a === 'b' ? 30 : 6;
    for (let i = 0; i < n; i += 1) { spec[`r${a}${i}`] = [`k${a}`]; memberOf[`r${a}${i}`] = [a]; }
    /* A und C gross (300 Berge): der Bogen von B wird schmal. */
    for (let i = 0; i < (a === 'b' ? 8 : 300); i += 1) { spec[`m${a}${i}`] = [`r${a}${i % n}`, `r${a}${(i + 1) % n}`]; memberOf[`m${a}${i}`] = [a]; }
  }
  spec.goal = Array.from({ length: 30 }, (_, i) => `rb${i}`);
  memberOf.goal = ['b'];
  const input = { ...graphOf(spec, { values, memberOf }), sorted: true };
  for (const opts of [{ budget: 60 }, { budget: 22, narrow: true }]) {
    const l = runLayout(input, k, { ...opts, goal: 'goal' }).run.layout;
    const tag = opts.narrow === true ? ' (phone)' : '';
    check(`overflow${tag}: every row still goes left → right in area order`, rowOrderBreaks(l), []);
    const route = new Set(l.goal.route);
    check(`overflow${tag}: no ring group holds a ring step of the goal's route`, l.fields.filter((f) => f.kind === 'area' && f.band === 'ring' && (f.ids ?? []).some((id) => route.has(id))).length, 0);
    check(`overflow${tag}: all 30 route steps stand singly — none lost`, l.goal.route.filter((id) => l.fields.some((f) => f.kind === 'entry' && f.id === id)).length, 30);
    check(`overflow${tag}: one field per cell, none on the learner`, new Set(l.fields.map((f) => `${f.q},${f.r}`)).size === l.fields.length && !l.fields.some((f) => f.q === 0 && f.r === 0), true);
    check(`overflow${tag}: no face covers another`, overlapsOf(l), []);
    const sb = l.sectors.find((x) => x.value === 'b');
    check(`overflow${tag}: B really overflows its arc (${Math.round(sb.to - sb.from)}°)`, drift(l).some((d) => d > 1), true);
  }
}
{

  /* Die Reihenfolge des Autors: a, b, c — b und c kommen oft zusammen vor; ohne `sorted` rückt das Gemeinsame zusammen. */
  const values = [{ id: 'a', rank: 0 }, { id: 'b', rank: 1 }, { id: 'c', rank: 2 }];
  const spec = { x1: [], x2: [], x3: [], y1: [], y2: [], z1: [] };
  const memberOf = { x1: ['a', 'c'], x2: ['a', 'c'], x3: ['a', 'c'], y1: ['b'], y2: ['b'], z1: ['c'] };
  const base = graphOf(spec, { values, memberOf });
  const free = runLayout(base).run.layout.sectors.map((s) => s.value);
  const sorted = runLayout({ ...base, sorted: true }).run.layout.sectors.map((s) => s.value);
  check('sort: without an order, co-occurrence makes neighbours (a next to c)', Math.abs(free.indexOf('a') - free.indexOf('c')), 1);
  check('sort: the author’s order (group.sort) stays left → right', sorted, ['a', 'b', 'c']);
}
{
  /* Ohne Wert: in die Mitte beim Lernenden — kein Bereich „bez wartości”. */
  const values = [{ id: 'p', label: 'P' }, { id: 'q', label: 'Q' }];
  const g = graphOf({ root: [], p1: ['root'], p2: ['p1'], q1: ['root'], q2: ['q1'] }, { values, memberOf: { p1: ['p'], p2: ['p'], q1: ['q'], q2: ['q'] } });
  const l = runLayout(g, { root: 1.2 }).run.layout;
  const root = l.fields.find((f) => f.id === 'root');
  check('centre: an entry without a value stands in the middle (90°), in no area', [root?.angle, root?.area], [90, -1]);
  check('centre: no made-up area for it', l.sectors.map((s) => s.value), ['p', 'q']);
}
{
  /* Ohne Gruppierung: die Teilbäume unter dem allgemeinsten Eintrag (einer → hinab, bis er sich teilt), nach ihm benannt. */
  const spec = { R: [], M: ['R'] };
  const sizes = { S1: 3, S2: 5, S3: 7, S4: 9 };
  for (const [s, n] of Object.entries(sizes)) { spec[s] = ['M']; for (let i = 0; i < n; i += 1) spec[`${s}_${i}`] = [i === 0 ? s : `${s}_${i - 1}`]; }
  spec.T = ['S1_0', 'S4_0'];
  const g = graphOf(spec);
  const l = runLayout(g, {}, { budget: 200 }).run.layout;
  check('tree: one root descends to where it splits — areas named after their most general topic', l.sectors.map((s) => s.label), ['S1', 'S2', 'S3', 'S4']);
  check('tree: areas as big as their subtrees (no equal slices)', l.sectors.map((s) => s.count), [5, 6, 8, 11]);
  check('tree: what lies above the areas stands in the middle', ['R', 'M'].map((id) => l.fields.find((f) => f.id === id)?.area), [-1, -1]);
  const t = l.fields.find((f) => f.id === 'T');
  const mid = (label) => { const s = l.sectors.find((x) => x.label === label); return (s.from + s.to) / 2; };
  check('tree: an entry below two subtrees stands between them', t.angle > mid('S1') && t.angle < mid('S4'), true);
  const flat = runLayout(graphOf({ A: [], B: [], C: [] })).run.layout;
  check('tree: no tree at all → one area without a name (never „okolice: …”)', flat.sectors.map((s) => s.label), ['']);
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
