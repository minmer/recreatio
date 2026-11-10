/**
 * 2026-11-09 — DIE WELTKARTE, TEIL 3: DIE GESTALT (spec §5.3, §5.4, §13), ohne Datenbank, auf allen Testwelten:
 * Pflichtprüfung der Gleise (kein Punkt näher an einer anderen Säule als ihr voller Radius + 8), Zeiten (1 000 Orte < 3 s,
 * 5 000 Orte < 20 s), Stabilität (10 neue Orte verschieben keinen alten), Gleichheit (dieselben Daten, dieselbe Karte),
 * Blöcke, Orte ohne Verbindung, „kein Weg", die Worker ohne `.tsx` und ohne Wörterbücher, die gespeicherte Lage.
 *
 *   node scripts/app-wm-geometry-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-geometry-'));
const entries = {
  graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts', geo: 'src/app/cogita/worldmap/wmGeometry.ts',
  tracks: 'src/app/cogita/worldmap/wmTracks.ts', layout: 'src/app/cogita/worldmap/wmLayout.ts', store: 'src/app/cogita/worldmap/wmStore.ts', fx: 'src/app/cogita/worldmap/wmFixtures.ts',
  scene: 'src/app/cogita/worldmap/wmScene.ts', state: 'src/app/cogita/worldmap/wmState.ts', colors: 'src/app/cogita/worldmap/wmColors.ts'
};
const define = { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) };
await build({ entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' }, define });
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, GEO, T, LAY, ST, F, SC, S, C] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const R = LAY.R;

const shapeOf = (input, opts = {}) => { const w = G.readWorld(input); const ls = L.linesOf(w, input.flows); return { w, ls, gi: GEO.geometryInputOf(w, ls, opts) }; };
const minGap = (g) => {
  const ids = Object.keys(g.nodes);
  let worst = Infinity;
  const cell = 200;
  const grid = new Map();
  for (const id of ids) { const [x, y] = g.positions[id]; const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(id); }
  for (const id of ids) {
    const [x, y] = g.positions[id];
    for (let oy = -1; oy <= 1; oy += 1) for (let ox = -1; ox <= 1; ox += 1) for (const j of grid.get(`${Math.floor(x / cell) + ox},${Math.floor(y / cell) + oy}`) ?? []) {
      if (j <= id) continue;
      /* 2026-11-10 — ein Knoten zwischen Türmen (Gabelung, Tor) darf näher stehen (JUNCTION_GAP); gemessen wird der Rest gegen seinen Abstand. */
      const small = id.startsWith('~j:') || id.startsWith('~g:') || j.startsWith('~j:') || j.startsWith('~g:');
      worst = Math.min(worst, Math.hypot(g.positions[j][0] - x, g.positions[j][1] - y) - g.radii[id] - g.radii[j] - (small ? LAY.JUNCTION_GAP - LAY.GAP : 0));
    }
  }
  return worst;
};

/* -- Die Pflichtprüfung und die Zeiten auf allen Testwelten ------------------------------------------------------------- */
const timings = {};
const worlds = [
  ['bosko', F.boskoWorld().input, 3000],
  ['broken', F.brokenWorld(), 3000],
  ['1000 places / 40 stories', F.generatedWorld({ places: 1000, stories: 40, seed: 11 }), 3000],
  ['5000 places', F.generatedWorld({ places: 5000, stories: 150, seed: 11 }), 20000]
];
const made = {};
for (const [name, input, budget] of worlds) {
  const { gi } = shapeOf(input);
  const t0 = performance.now();
  const g = GEO.geometryOf(gi);
  const ms = Math.round(performance.now() - t0);
  timings[name] = { ms, layoutMs: g.stats.layoutMs, tracksMs: g.stats.tracksMs, nodes: Object.keys(g.nodes).length, tracks: g.tracks.length };
  made[name] = { g, gi, input };
  const violations = T.clearance(GEO.obstaclesOf(g), g.tracks, 8);
  check(`${name}: track clearance (no point within full radius + 8 of another pillar)`, violations.slice(0, 3), []);
  /* Step 3 §2.1 — dieselbe Prüfung auf den versetzten Spuren (was wirklich gezeichnet wird), nicht nur auf der Mitte des Gleises. */
  {
    const { w, ls } = shapeOf(input);
    const scene = SC.sceneOf(w, ls, S.stateOf(w, ls, F.fakeLearner({}), { levels: 0, knownShare: 1 }), g, { placeColour: () => [1, 1, 1], lineColour: C.lineColours(ls, 'light'), fallback: [1, 1, 1] });
    const laneTracks = scene.lanes.map((l) => ({ a: g.nodeOf[l.fromId] ?? l.fromId, b: g.nodeOf[l.toId] ?? l.toId, points: l.points }));
    const worst = T.clearance(GEO.obstaclesOf(g), laneTracks, 8);
    check(`Step 3 §2.1 · ${name}: offset lanes keep the clearance too`, worst.slice(0, 3).map((v) => Math.round(v.distance * 10) / 10), []);
  }
  check(`${name}: A* found every track (no straight fallback)`, g.noRoute, []);
  check(`${name}: pillars never touch (rim gap ≥ 2.1 R)`, minGap(g) >= LAY.GAP - 0.01, true);
  check(`${name}: layout and tracks within ${budget} ms (took ${ms} ms: layout ${g.stats.layoutMs}, tracks ${g.stats.tracksMs})`, ms < budget, true);
}
console.log('timings', JSON.stringify(timings));

/* -- Gleichheit: dieselben Daten, dieselbe Karte ------------------------------------------------------------------------- */
{
  const a = made.bosko.g;
  const b = GEO.geometryOf(shapeOf(F.boskoWorld().input).gi);
  check('deterministic: same data, same positions', JSON.stringify(b.positions) === JSON.stringify(a.positions), true);
  check('deterministic: same data, same tracks', JSON.stringify(b.tracks) === JSON.stringify(a.tracks), true);
  check('deterministic: the version names the data', [a.version === b.version, a.version === GEO.geometryVersion({ ...made.bosko.gi, prereqs: [] })], [true, false]);
}

/* -- Stabilität: 10 neue Orte verschieben keinen alten ------------------------------------------------------------------- */
{
  const base = made['1000 places / 40 stories'];
  const old = base.g;
  const extra = F.generatedWorld({ places: 1000, stories: 40, seed: 11 });
  const fb = new F.FlowBuilder('NEW');
  for (let i = 0; i < 10; i += 1) {
    const id = `new${i}`;
    const needs = [`p${100 + i * 37}`, ...(i > 0 ? [`new${i - 1}`] : [])];
    extra.entries.push({ id, kinds: ['topic'], label: `Nowe ${i}`, refs: needs.map((n) => ({ field: 'wymaga', to: n, prerequisite: 'up', structure: 'up' })) });
    extra.entries.push({ id: `s/${id}`, kinds: ['slide'], label: `Slajd ${id}`, refs: [{ field: 'o_czym', to: id }] });
    for (let q = 0; q < 8; q += 1) { extra.cards.push({ key: `q/${id}/${q}`, question: `q/${id}/${q}`, about: [id] }); extra.entries.push({ id: `q/${id}/${q}`, kinds: ['question'], label: 'q', refs: [{ field: 'about', to: id }] }); }
    fb.show(`s/${id}`); fb.ask(`q/${id}/0`);
  }
  fb.end();
  extra.entries.push({ id: 'u/new', kinds: ['unit'], label: 'Nowa', refs: [{ field: 'wymaga', to: 'p100', prerequisite: 'up' }] });
  extra.flows.push(fb.flow('f/new', { name: 'Nowa', unit: 'u/new' }));
  const { gi } = shapeOf(extra, { previous: old.nodes });
  const t0 = performance.now();
  const next = GEO.geometryOf(gi);
  const ms = Math.round(performance.now() - t0);
  const moved = Object.keys(old.nodes).filter((id) => next.nodes[id] === undefined || next.nodes[id][0] !== old.nodes[id][0] || next.nodes[id][1] !== old.nodes[id][1]);
  check('stable: adding 10 places moves no existing place', [moved.length, moved.slice(0, 3)], [0, []]);
  check('stable: the 10 new places are placed (and only they)', [next.placed.filter((id) => id.startsWith('new')).length, next.placed.length], [10, 10]);
  check('stable: … without touching anything', [minGap(next) >= LAY.GAP - 0.01, T.clearance(GEO.obstaclesOf(next), next.tracks, 8).length, next.noRoute.length], [true, 0, 0]);
  timings.insert10 = { ms };
  const full = GEO.geometryOf({ ...gi, mode: 'full' });
  check('re-lay the whole map: the stored layout is ignored', full.placed.length, Object.keys(full.nodes).length);
}

/* -- Blöcke: die Scheibe in der Lage, die Teile dicht gepackt ------------------------------------------------------------- */
{
  const p3 = LAY.packParts(3, R);
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  check('pack: three parts touch each other', [d(p3.offsets[0], p3.offsets[1]), d(p3.offsets[1], p3.offsets[2])].map((x) => Math.round(x * 100) / 100), [2 * R, 2 * R]);
  check('pack: the disc holds every part', p3.offsets.every(([x, y]) => Math.hypot(x, y) + R <= p3.disc), true);
  const p9 = LAY.packParts(9, R);
  const pairs = [];
  for (let i = 0; i < 9; i += 1) for (let j = i + 1; j < 9; j += 1) pairs.push(d(p9.offsets[i], p9.offsets[j]));
  check('pack: nine parts never overlap, the nearest touch', [Math.min(...pairs) >= 2 * R - 1e-9, Math.round(Math.min(...pairs) * 100) / 100], [true, 2 * R]);
  const g = made.bosko.g;
  const parts = ['s1859a', 's1859b', 's1859c'];
  check('bosko: the block is one node with the disc radius', [g.nodes.s1859 !== undefined, g.radii.s1859 === p3.disc, parts.every((p) => g.nodes[p] === undefined)], [true, true, true]);
  check('bosko: the parts stand on the disc and touch', [parts.every((p) => d(g.positions[p], g.positions.s1859) + R <= g.radii.s1859 + 0.2), Math.round(d(g.positions.s1859a, g.positions.s1859b))], [true, 2 * R]);
  check('bosko: tracks to a part arrive at its block', [g.nodeOf.s1859a, g.tracks.some((t) => t.a === 's1859' || t.b === 's1859')], ['s1859', true]);
}

/* -- Orte ohne Verbindung, „kein Weg" -------------------------------------------------------------------------------------- */
{
  const g = made.broken.g;
  const [lx, ly] = g.positions.lonely;
  const others = Object.keys(g.nodes).filter((id) => id !== 'lonely');
  check('a place without connections stands free at the edge', others.every((id) => Math.hypot(g.positions[id][0] - lx, g.positions[id][1] - ly) >= g.radii[id] + R + LAY.GAP - 0.01), true);
  /* Ein Ort, ganz von Säulen umschlossen. */
  const ring = Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, x: Math.cos((i / 10) * 2 * Math.PI) * 70, y: Math.sin((i / 10) * 2 * Math.PI) * 70, r: R }));
  const res = T.routeTracks([{ id: 'in', x: 0, y: 0, r: R }, { id: 'out', x: 400, y: 0, r: R }, ...ring], [['in', 'out']]);
  check('no route: reported, drawn straight (red in the author list), not counted as clear', [res.noRoute, res.tracks[0].straight], [[['in', 'out']], true]);
  const off = T.offsetPoints([0, 0, 10, 0, 20, 0], 5);
  check('parallel lines: offset perpendicular to the track', off, [0, 5, 10, 5, 20, 5]);
  check('parallel lines: lanes 5 units apart, centred', [T.laneOffset(0, 3), T.laneOffset(1, 3), T.laneOffset(2, 3)], [-5, 0, 5]);
}

/* -- Worker: keine .tsx, keine Wörterbücher (Korrektur 6) -------------------------------------------------------------------- */
for (const entry of ['src/app/cogita/worldmap/wmGeometry.worker.ts', 'src/app/cogita/landscape.worker.ts']) {
  const r = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'browser', write: false, metafile: true, logLevel: 'silent', loader: { '.css': 'empty' }, define });
  const inputs = Object.keys(r.metafile.inputs);
  check(`${entry.split('/').pop()}: imports no .tsx and no i18n`, inputs.filter((i) => i.endsWith('.tsx') || /core[\\/]i18n|landscapeWords/.test(i)), []);
}

/* -- Die gespeicherte Lage (Entscheidung 11) --------------------------------------------------------------------------------- */
{
  const g = made.bosko.g;
  const saved = [];
  const lib = (writes, docs = []) => ({ writes, docs: (k) => (k === 'worldmap' ? docs : []), saveDoc: async (kind, data, id) => { saved.push({ kind, id, data }); return { id: id ?? 'doc-1', data }; } });
  check('stored layout: a learner never writes', [await ST.keepLayout(lib(false), g), saved.length], [false, 0]);
  check('stored layout: a writer writes the new layout', [await ST.keepLayout(lib(true), g), saved[0]?.kind, Object.keys(saved[0]?.data.positions ?? {}).length], [true, 'worldmap', Object.keys(g.nodes).length]);
  const stored = ST.storedLayout(lib(true, [{ id: 'doc-1', data: saved[0].data }]));
  check('stored layout: read back', [stored?.id, stored?.positions.s1859?.[0] === g.nodes.s1859[0]], ['doc-1', true]);
  check('stored layout: unchanged → nothing written', await ST.keepLayout(lib(true, [{ id: 'doc-1', data: saved[0].data }]), g), false);
  check('stored layout: another version of the computation is ignored', ST.storedLayout(lib(true, [{ id: 'x', data: { ...saved[0].data, params: 'old' } }])), null);
  const back = GEO.geometryOf(shapeOf(F.boskoWorld().input, { previous: stored.positions }).gi);
  check('stored layout: a learner computes the same map from it', JSON.stringify(back.nodes) === JSON.stringify(g.nodes), true);

  /* Step 3 · 8 — „Ułóż całą mapę od nowa" gilt für eine Rechnung: gelegt und gespeichert → wieder von der gespeicherten Lage. */
  if (typeof ST.layoutPass !== 'function') check('Step 3 · 8: one layout pass (full on request, then from the stored layout)', 'layoutPass missing', 'present');
  else {
    const docs = [];
    const lib2 = { writes: true, docs: (k) => (k === 'worldmap' ? docs : []), saveDoc: async (kind, data, id) => { docs.splice(0, docs.length, { id: id ?? 'doc-2', data }); return { id: id ?? 'doc-2', data }; } };
    const asked = [];
    const compute = async (previous, full) => { asked.push([previous === undefined ? 'none' : 'stored', full]); return g; };
    const p1 = await ST.layoutPass(lib2, { full: true, save: true }, compute);
    const done1 = await p1.saved;
    const p2 = await ST.layoutPass(lib2, { full: false, save: true }, compute);
    check('Step 3 · 8: a full pass ignores the stored layout and, once saved, fulfils the request; the next pass starts from the stored layout', [asked, done1, await p2.saved], [[['none', true], ['stored', false]], true, false]);
    const failing = { ...lib2, docs: () => [], saveDoc: async () => { throw new Error('offline'); } };
    check('Step 3 · 8: a full pass whose save fails keeps the request', await (await ST.layoutPass(failing, { full: true, save: true }, compute)).saved, false);
  }
  const { readFile } = await import('node:fs/promises');
  const src = await readFile('src/app/cogita/worldmap/WorldLandscape.tsx', 'utf8');
  check('Step 3 · 8: the map resets the request once the pass is laid and saved', /layoutPass\(/.test(src) && /setRelay\(\(r\) => \(r === asked \? 0 : r\)\)/.test(src), true);
}

console.log(`\ntimings ${JSON.stringify(timings)}`);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
