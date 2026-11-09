/**
 * 2026-11-09 — DIE WELTKARTE: WAS SIE VOM KRAJOBRAZ MITNIMMT (Step-1-Bericht §3), ohne Browser:
 * <code>
 *   Ansichten   Ogólny · Co umiem · Do odkrycia · Do powtórki · Luki — welche Orte farbig bleiben (`wmViews.ts`)
 *   Abspielen   was zuletzt zu sehen war (eine Zahl je Ort), was sich seither änderte, der Zeitplan je Bewegung
 *   Treffen     das Raster der gezeichneten Säulen trifft dieselbe wie die Suche über alle (`wmPick.ts`); verdeckte Namen
 * </code>
 *
 *   node scripts/app-wm-views-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-views-'));
const entries = {
  graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts', state: 'src/app/cogita/worldmap/wmState.ts',
  fx: 'src/app/cogita/worldmap/wmFixtures.ts', views: 'src/app/cogita/worldmap/wmViews.ts', pick: 'src/app/cogita/worldmap/wmPick.ts'
};
await build({ entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) } });
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, S, F, V, P] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const sorted = (s) => (s === null ? null : [...s].sort());

const bx = F.boskoWorld();
const world = G.readWorld(bx.input);
const lines = L.linesOf(world, bx.input.flows);
const cardsOf = (places, k) => Object.fromEntries(places.flatMap((p) => world.places.get(p).cards.map((c) => [c, k])));

/* -- Ansichten ------------------------------------------------------------------------------------------------------------- */
{
  /* Gekonnt: alle Orte ohne Voraussetzung und einer darüber; fällig: ein Teil eines dritten. */
  const roots = [...world.places.values()].filter((p) => p.needs.length === 0).map((p) => p.id);
  const next = [...world.places.values()].find((p) => p.needs.length > 0 && p.needs.every((n) => roots.includes(n)));
  const learnt = [...roots, next.id];
  const half = [...world.places.values()].find((p) => !learnt.includes(p.id) && p.cards.length > 1);
  const knowness = { ...cardsOf(learnt, 3), [half.cards[0]]: 0.5 };
  const st = S.stateOf(world, lines, F.fakeLearner({ knowness }), { levels: 0, knownShare: 1 });
  check('modes: "all" keeps every place in colour', V.litPlaces('all', st, new Set()), null);
  const conq = [...st.places].filter(([, p]) => p.conquered).map(([id]) => id).sort();
  check('modes: "Co umiem" — exactly the conquered places', sorted(V.litPlaces('known', st, new Set())), conq);
  const disc = V.litPlaces('discover', st, new Set());
  const ok = [...disc].every((id) => !st.places.get(id).conquered && [...world.base(id)].every((b) => st.places.get(b).conquered));
  check('modes: "Do odkrycia" — not conquered, everything before conquered (and something is ready)', [ok, disc.size > 0, disc.has(next.id)], [true, true, false]);
  check('modes: "Do powtórki" — the place with a due card (0 levels: every card may be reviewed)', sorted(V.litPlaces('due', st, new Set())), [half.id]);
  check('modes: "Luki" — the gaps the self-check found', sorted(V.litPlaces('gaps', st, new Set([roots[0], 'not-a-place']))), [roots[0]]);
  /* Mit Stufen: fällige Karten eines nicht eroberten Ortes sind keine Wiederholung (`reviewable`). */
  const st3 = S.stateOf(world, lines, F.fakeLearner({ knowness }), { levels: 3, knownShare: 1 });
  check('modes: with 3 levels and no runs, a due card of an unconquered place is no review', V.litPlaces('due', st3, new Set()).size, 0);
  check('modes: dueOf lists the due cards that may be reviewed', V.dueOf(st, half.id), [half.cards[0]]);
}
{
  /* Ein Kreis (die kaputte Welt): die eigene Gruppe zählt nicht als „davor". */
  const bw = G.readWorld(F.brokenWorld());
  const st = S.stateOf(bw, L.linesOf(bw, []), F.fakeLearner({}), { levels: 0, knownShare: 1 });
  const grouped = [...bw.places.values()].filter((p) => p.group !== undefined && bw.places.get(p.id).needs.every((n) => bw.places.get(n).group === p.group));
  check('modes: a cycle without outside prerequisites is ready to learn', grouped.length > 0 && grouped.every((p) => V.readyNow(st, p.id)), true);
}
{
  const kept = new Map();
  globalThis.localStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } };
  V.keepMode('lib:view:me', 'due');
  kept.set('cg-wm2-mode:other', 'nonsense');
  check('modes: kept per view and learner; anything unknown is "all"', [V.keptMode('lib:view:me'), V.keptMode('other'), V.keptMode('none')], ['due', 'all', 'all']);
  delete globalThis.localStorage;
  check('modes: no storage — "all"', V.keptMode('lib:view:me'), 'all');
}

/* -- Was zuletzt zu sehen war, und was sich änderte -------------------------------------------------------------------------- */
{
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let same = 0;
  for (let i = 0; i < 2000; i += 1) {
    const p = { missing: Math.floor(rnd() * 50000), level: Math.floor(rnd() * 6), sat: Math.floor(rnd() * 3), conquered: rnd() < 0.5, dot: Math.floor(rnd() * 4) };
    if (JSON.stringify(V.unpackPlace(V.packPlace(p))) === JSON.stringify(p)) same += 1;
  }
  check('shown: one number per place packs and unpacks (2 000 random places)', same, 2000);
  const at = (o) => ({ missing: 0, level: 0, sat: 0, conquered: false, dot: 0, ...o });
  const was = {
    a: V.packPlace(at({ missing: 40, sat: 1 })), b: V.packPlace(at({ missing: 30, level: 1, sat: 2 })), c: V.packPlace(at({ conquered: true, sat: 2, dot: 3 })),
    d: V.packPlace(at({ missing: 50 })), e: V.packPlace(at({ missing: 20, sat: 1 })), f: V.packPlace(at({ missing: 10 })), g: V.packPlace(at({ missing: 5 }))
  };
  const now = new Map([
    ['a', at({ missing: 0, conquered: true, sat: 2, dot: 1 })], ['b', at({ missing: 30, level: 2, sat: 2 })], ['c', at({ conquered: true, sat: 2, dot: 1 })],
    ['d', at({ missing: 50, sat: 1 })], ['e', at({ missing: 12, sat: 1 })], ['f', at({ missing: 10, dot: 2 })], ['g', at({ missing: 5 })], ['h', at({ missing: 9 })]
  ]);
  const d = V.diffPlaces(was, now, (id) => id);
  check('shown: conquered, levelled, reviewed, opened, lowered, moved, new — each once', [d.conquered, d.levelled, d.reviewed, d.opened, d.lowered, d.moved, d.fresh], [['a'], ['b'], ['c'], ['d'], ['e'], ['f'], ['h']]);
  check('shown: "before" keeps how changed places looked (and nothing for unchanged ones)', [d.before.get('a').missing, d.before.has('g'), d.any], [40, false, true]);
  const quiet = V.diffPlaces({ g: was.g }, new Map([['g', at({ missing: 5 })]]), (id) => id);
  check('shown: nothing changed — nothing to play', quiet.any, false);
  check('shown: new places count only when something was kept before', [V.diffPlaces({}, now, (id) => id).any, V.diffPlaces({ zz: 1 }, now, (id) => id).any], [false, true]);
  const fromState = V.shownOfPlace({ height: 17, level: 2, saturation: 'partly', conquered: false, dot: 'orange' });
  check('shown: a place state packs its height, level, saturation, conquest and dot', fromState, { missing: 17, level: 2, sat: 1, conquered: false, dot: 3 });
}

/* -- Der Zeitplan ---------------------------------------------------------------------------------------------------------- */
{
  const pos = new Map([['c', [0, 0]], ['near', [100, 0]], ['far', [900, 0]], ['x', [500, 500]]]);
  const where = (id) => pos.get(id);
  const base = { id: 1, before: new Map(), conquered: [], levelled: [], reviewed: [], opened: [], lowered: [], moved: [], fresh: [], points: new Map(), rest: 0 };
  const ret = { ...base, kind: 'return', conquered: ['c'], lowered: ['near', 'far'], points: new Map([['c', 12]]) };
  check('schedule: "wyłączone" — nothing moves, the end is now', V.scheduleOf(ret, 'off', where, [0, 0]).end, 0);
  const red = V.scheduleOf(ret, 'reduced', where, [0, 0]);
  check('schedule: "ograniczone" — only a short glow (500 ms), no column moves', [red.end, red.fade, red.colMs], [500, 500, 0]);
  const full = V.scheduleOf(ret, 'full', where, [0, 0]);
  check('schedule: the wave — neighbours start after the conquered place, the nearer first, at most 300 ms', [full.delay.get('near') < full.delay.get('far'), full.delay.get('near') >= 120, full.delay.get('far') <= 300], [true, true, true]);
  check('schedule: levels and the conquest ring light up before the columns end, the points rise after them, all under 3 s', [full.flash0 < full.colMs, full.pts0 >= full.colMs - 100, full.end >= full.pts0 + 900, full.end <= 3000], [true, true, true, true]);
  const first = V.scheduleOf({ ...base, kind: 'first', fresh: ['c', 'near', 'far', 'x'] }, 'full', where, [0, 0]);
  const delays = ['c', 'near', 'x', 'far'].map((id) => first.delay.get(id));
  check('schedule: the first visit — columns rise from the middle outwards (≤ 450 ms later), 750 ms each', [delays.every((x, i) => i === 0 || x >= delays[i - 1]), Math.max(...delays) <= 450, first.colMs, first.end], [true, true, 750, 1200]);
  const live = V.scheduleOf({ ...ret, kind: 'live', points: new Map() }, 'full', where, [0, 0]);
  check('schedule: while the map is seen (live) — no points, so it ends with the columns and the glow', live.end < full.end, true);
}

/* -- Treffen und verdeckte Namen -------------------------------------------------------------------------------------------- */
{
  let seed = 5;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const list = [];
  for (let i = 0; i < 2000; i += 1) {
    const rx = 3 + rnd() * 30;
    const bottom = rnd() * 900;
    list.push({ id: `p${i}`, x: rnd() * 1400, bottom, top: bottom - rnd() * 120, rx, ry: rx * 0.6 });
  }
  const linear = (x, y) => { for (let i = list.length - 1; i >= 0; i -= 1) if (P.onPillar(list[i], x, y)) return list[i].id; return null; };
  const grid = P.pickGrid(list);
  let agree = 0;
  let hits = 0;
  const N = 20000;
  const pts = Array.from({ length: N }, () => [rnd() * 1400, rnd() * 900]);
  const t0 = performance.now();
  for (const [x, y] of pts) linear(x, y);
  const t1 = performance.now();
  for (const [x, y] of pts) P.pickAt(grid, x, y);
  const t2 = performance.now();
  for (const [x, y] of pts) { const a = linear(x, y); if (a === P.pickAt(grid, x, y)) agree += 1; if (a !== null) hits += 1; }
  console.log(`info 2 000 pillars, 20 000 points: linear ${(t1 - t0).toFixed(1)} ms, grid ${(t2 - t1).toFixed(1)} ms (${hits} hits)`);
  check('pick: the grid finds the same front-most pillar as a search over all (20 000 points, 2 000 pillars)', [agree, hits > 1000], [N, true]);
  check('pick: faster than the search over all', t2 - t1 < t1 - t0, true);
  /* Ein Name über der hinteren Säule; eine nähere, höhere Säule davor deckt ihn. */
  const back = { id: 'back', x: 100, top: 200, bottom: 260, rx: 20, ry: 10 };
  const front = { id: 'front', x: 105, top: 120, bottom: 300, rx: 40, ry: 20 };
  const g2 = P.pickGrid([back, front]);
  check('names: a name behind a nearer pillar is hidden; the nearer pillar’s own name is not', [P.nameCovered(g2, 0, 100, 181, 60), P.nameCovered(g2, 1, 105, 91, 60)], [true, false]);
  const g3 = P.pickGrid([back, { ...front, x: 300 }]);
  check('names: nothing in front — the name stays', P.nameCovered(g3, 0, 100, 181, 60), false);
  check('pick: after a given pillar only nearer ones count', [P.pickAt(g2, 105, 250), P.pickAt(g2, 105, 250, 1)], ['front', null]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
