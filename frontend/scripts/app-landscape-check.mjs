/**
 * 2026-11-03 — DER KRAJOBRAZ (`cogita/landscape.ts`), nachgemessen: die Höhen (gemeinsame Voraussetzungen einmal,
 * ein Kreis ein Schritt, Einträge ohne Karten durchsichtig, Verblassen: „do powtórki" bleibt gelernt, unter 0,1 fehlt
 * es wieder), die Sperre (schwache, schon gefragte Karten in der Kette; nie gefragte sperren nicht), der Weg zum Ziel
 * (die Grundlagen zuerst, so viele Schritte wie die Höhe), die Stufen (`liftOf`), die Achse über die Stufen, das Lesen
 * der Knoten (`landscapeNest.ts`) — und die Beziehung `rel: "chain"` der einen Logik (`knowing.ts`), der Modus
 * `landscape` eines Widoku (`views.ts`), die Wege und Namen der Zeichnung (`landscapeDraw.ts`).
 * 2026-11-09 (Weltkarte, Entscheidung 2) — die alte feste Karte und ihre Gestalt je Fokus (`fixedLayout`, `layoutOf`,
 * `nestLayout`) sind entfernt, mit ihren Prüfungen: die Plätze legt `worldLayout.ts` (app-worldmap-check).
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

/* ── Stufen: das Tal 0, die Ebene 1, ein Berg nach seinen Schritten (`liftOf`, die Landschaft) ─────────────────────── */
/* 2026-11-09 (Weltkarte, Entscheidung 2) — die alte feste Karte (`fixedLayout`, `layoutOf`) und ihre Prüfungen sind entfernt. */
{
  check('2026-11-04 equal steps: a field 10 steps away stands exactly ten times as high above the learnable level as one 1 step away', (L.liftOf('mountain', 10) - L.liftOf('ring', 0)) / (L.liftOf('mountain', 1) - L.liftOf('ring', 0)), 10);
  check('… no cap: 84 steps stand 84 steps above the learnable level', L.liftOf('mountain', 84) - L.liftOf('ring', 0), 84);
  check('known and due sink to 0, the ring stands one step up', [L.liftOf('known', 3), L.liftOf('due', 3), L.liftOf('ring', 5)], [0, 0, 1]);
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
  check('view: "bands" read and written back', [view.landscape, VW.viewJson(view).landscape], [{ budget: 60, bands: { ring: 0.4 } }, { budget: 60, bands: { ring: 0.4 } }]);
}

/* ── Gross: 10 000 Einträge, 50 000 Kanten (Graph und Höhen; die alte Gestalt je Fokus ist entfernt, 2026-11-09) ── */
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
  known.e1500 = 1.1;
  e.setState(state(input, known));
  const t3 = performance.now();
  console.log(`info 10 000 / ${edges}: graph ${(t1 - t0).toFixed(0)} ms, heights ${(t2 - t1).toFixed(0)} ms, after one answer ${(t3 - t2).toFixed(0)} ms`);
  check('10 000 entries: the graph under 4 s in node', t1 - t0 < 4000, true);
  check('10 000 entries: after one answer (heights) under 1.5 s in node', t3 - t2 < 1500, true);
  check('10 000 entries: the state per node covers every entry', e.stand().band.length, N);
}

/* ── 2026-11-03 — DER VERSCHACHTELTE KRAJOBRAZ (`landscapeNest.ts`): die Knoten lesen, auf dem Beispiel „Świat wiedzy" ── */
/* 2026-11-09 (Weltkarte, Entscheidung 2) — die eigene Lage der Ebenen (`nestLayout`) ist entfernt; gezeichnet wird über `nestAsRegions` (app-levels-check). */
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
  const mathTopics = N.nestSubtree(tree, id('Matematyka'), input.ids);
  check('nest: the subtree of Matematyka holds its 12 topics (all depths)', mathTopics.length, 12);
  check('nest: every topic finds its home node (or none: top level)', input.ids.every((x) => !tree.home.has(x) || tree.nodes.has(tree.home.get(x))), true);
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
