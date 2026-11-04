/**
 * 2026-11-04 (Prompt 13, C) — DIE EINE LANDSCHAFT, nachgemessen (`src/app/cogita/worldLayout.ts`, `worldView.ts`) an Graphen in
 * der Gestalt von LAAG, Bosko, einer Kette und Zweigen von acht Gebieten und einer Baza mit 5 000 Themen
 * (`scripts/testGraphs.mjs`):
 *   - jedes Thema genau ein Sechseck, dieselben Plätze bei jedem Rechnen (nur aus der Struktur, nie vom Stand);
 *   - die Themen eines Gebiets bilden (fast immer) eine zusammenhängende Fläche, Teilgebiete Flächen darin;
 *   - 2026-11-04 (Prompt 14): Gebiete liegen Kachel an Kachel — keine Streifen, keine Löcher in der Karte;
 *   - die Stufe nach der Baza (flach: höher), was in den Kacheln steht (nie breiter als der Kreis, nur der Name bei den Namen);
 *   - wie viele Verbindungen benachbarte oder nahe Sechsecke verbinden (berichtet; mindestens die Hälfte nah);
 *   - Namen: nie zwei übereinander, je Gebiet einer, die Zoomstufen fern / näher / nah;
 *   - die Projektion: Schirm → Boden → Schirm ist dasselbe, in jeder Drehung und Neigung; die Stufe ist überall gleich.
 *
 *   node scripts/app-worldmap-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { big, boskoLike, flach7, kette8, laagLike, zweige8 } from './testGraphs.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'app-worldmap-'));
const names = { regions: 'regions', world: 'worldLayout', view: 'worldView' };
await build({
  entryPoints: Object.fromEntries(Object.entries(names).map(([k, n]) => [k, `src/app/cogita/${n}.ts`])),
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [RG, WL, WV] = await Promise.all(Object.keys(names).map(load));

let failed = 0;
let passed = 0;
const truth = (name, ok, detail) => {
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}${detail === undefined ? '' : `\n  ${JSON.stringify(detail).slice(0, 600)}`}`); }
};
const hd = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
const connected = (cells) => {
  if (cells.length === 0) return true;
  const at = new Map(cells.map((c, i) => [`${c.q},${c.r}`, i]));
  const seen = new Set([0]);
  const stack = [0];
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  while (stack.length > 0) { const i = stack.pop(); for (const [dq, dr] of dirs) { const j = at.get(`${cells[i].q + dq},${cells[i].r + dr}`); if (j !== undefined && !seen.has(j)) { seen.add(j); stack.push(j); } } }
  return seen.size === cells.length;
};
const table = [];
for (const [name, g] of [['laagLike', laagLike()], ['boskoLike', boskoLike()], ['kette8', kette8()], ['zweige8', zweige8()], ['flach7', flach7()], ['big(5000)', big(5000)]]) {
  const tg = { graph: g, node: Int32Array.from(g.ids.map((_, i) => i)), topicOf: Int32Array.from(g.ids.map((_, i) => i)) };
  const tree = RG.buildRegions(g);
  const w = WL.worldLayout(tree, tg);
  const again = WL.worldLayout(tree, { ...tg });
  truth(`${name}: every topic on exactly one hexagon (${w.cells.length})`, w.cells.length === g.ids.length && new Set(w.cells.map((c) => `${c.q},${c.r}`)).size === w.cells.length);
  truth(`${name}: the same places every time (structure only)`, JSON.stringify(w.cells) === JSON.stringify(again.cells));
  /* Kein Thema abseits der Karte (keine Insel, keine Reihe am Rand). */
  const placed = new Set(w.cells.map((c) => `${c.q},${c.r}`));
  const alone = w.cells.filter((c) => ![[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].some(([dq, dr]) => placed.has(`${c.q + dq},${c.r + dr}`))).length;
  truth(`${name}: no topic stands apart from the map (${alone})`, alone === 0, alone);
  let whole = 0; let leafWhole = 0; let leaves = 0;
  for (const r of w.regions.values()) { const ok = connected(r.topics.map((t) => w.cells[t])); if (ok) whole += 1; if (r.level === 1) { leaves += 1; if (ok) leafWhole += 1; } }
  const share = whole / Math.max(1, w.regions.size);
  truth(`${name}: regions are contiguous areas (${whole} of ${w.regions.size}, ${Math.round(share * 100)} %)`, share >= (g.ids.length > 1000 ? 0.75 : 0.85), { whole, all: w.regions.size });
  /* Der Streifen Boden zwischen obersten Gebieten: wie viele Paare benachbarter Sechsecke zu verschiedenen obersten Gebieten gehören. */
  const topOf = (t) => w.chain[t]?.[0] ?? null;
  const at = new Map(w.cells.map((c, i) => [`${c.q},${c.r}`, i]));
  let touching = 0; let pairs = 0;
  w.cells.forEach((c, i) => { for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1]]) { const j = at.get(`${c.q + dq},${c.r + dr}`); if (j === undefined) continue; pairs += 1; if (topOf(i) !== topOf(j)) touching += 1; } });
  /* Kachel an Kachel: keine leeren Plätze, die rings von der Karte umschlossen sind. */
  const qs = w.cells.map((c) => c.q); const rs = w.cells.map((c) => c.r);
  const q0 = Math.min(...qs) - 1; const q1 = Math.max(...qs) + 1; const r0 = Math.min(...rs) - 1; const r1 = Math.max(...rs) + 1;
  const outside = new Set([`${q0},${r0}`]);
  const st = [[q0, r0]];
  while (st.length > 0) { const [q, r] = st.pop(); for (const [dq, dr] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) { const a = q + dq; const b = r + dr; const k = `${a},${b}`; if (a < q0 || a > q1 || b < r0 || b > r1 || outside.has(k) || at.has(k)) continue; outside.add(k); st.push([a, b]); } }
  let holes = 0;
  for (let q = q0; q <= q1; q += 1) for (let r = r0; r <= r1; r += 1) { const k = `${q},${r}`; if (!at.has(k) && !outside.has(k)) holes += 1; }
  truth(`${name}: regions touch hexagon to hexagon (${touching} neighbour pairs across top borders), no holes in the map (${holes})`, holes === 0 && (w.top.length < 2 || touching > 0), { holes, touching, pairs });
  let e = 0; let adj = 0; let near = 0;
  g.needs.forEach((list, t) => list.forEach((p) => { e += 1; const d = hd(w.cells[t], w.cells[p]); if (d <= 1) adj += 1; if (d <= 2) near += 1; }));
  truth(`${name}: connections join neighbouring (${Math.round((adj / e) * 100)} %) or nearby ≤ 2 (${Math.round((near / e) * 100)} %) hexagons`, near / e >= 0.5, { adj, near, e });
  if (name === 'big(5000)') truth(`big(5000): the whole layout in ${Math.round(w.ms)} ms (< 2500 ms, in the worker)`, w.ms < 2500, w.ms);
  table.push({ name, topics: g.ids.length, regions: w.regions.size, contiguous: `${Math.round(share * 100)} % (leaves ${leafWhole}/${leaves})`, adjacent: `${Math.round((adj / e) * 100)} %`, near: `${Math.round((near / e) * 100)} %`, ms: Math.round(w.ms) });

  /* Namen nach dem Zoom: fern nur die obersten, näher deren Teilgebiete, nah keine Gebiete. */
  const radius = Math.max(...w.cells.map((c) => Math.hypot(c.x, c.y))) + 2;
  for (const [zoom, s] of [['far', 560 / (2 * radius)], ['middle', 12], ['near', 60]]) {
    const cam = { s, cx: w.cells[0].x, cy: w.cells[0].y, rot: 0, fore: WV.FORE_START };
    const p = WV.projection(cam, 900, 560);
    const list = [];
    for (const r of w.regions.values()) {
      const d = 2 * r.radius * s;
      const parent = r.parent === null ? null : w.regions.get(r.parent);
      const alpha = WV.regionLabelAlpha(d, parent === null || parent === undefined ? null : 2 * parent.radius * s, r.level === 1);
      if (alpha <= 0.02) continue;
      const [x, y] = WV.toScreen(p, r.x, r.y);
      list.push({ key: r.key, text: r.name, x, y, w: Math.min(220, r.name.length * 7 + 16), h: 22, weight: r.topics.length + (parent === null ? 5000 : 0), alpha, level: r.level, top: r.parent === null });
    }
    const placed = WV.placeLabels(list, 900, 560).filter((l) => l.shown);
    let overlap = 0;
    for (let i = 0; i < placed.length; i += 1) for (let j = i + 1; j < placed.length; j += 1) { const a = placed[i]; const b = placed[j]; if (Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h) overlap += 1; }
    const perRegion = new Set(placed.map((l) => l.key)).size === placed.length;
    if (zoom === 'far') truth(`${name} far: only top-level region names (${placed.length}), none overlapping`, placed.every((l) => l.top) && overlap === 0 && perRegion, placed.map((l) => l.text));
    else truth(`${name} ${zoom}: names never overlap, one per region (${placed.length} shown)`, overlap === 0 && perRegion, overlap);
  }
}
/* Die Stufe nach der Baza: flach höher, tief wie bisher; dieselbe für jedes Feld. */
truth('step height per base: 3 levels → higher steps, 25 levels → the deep look (0.1)', WV.stepFor(3) > WV.stepFor(10) && WV.stepFor(10) > WV.STEP - 1e-9 && Math.abs(WV.stepFor(25) - WV.STEP) < 1e-9 && WV.stepFor(1) <= 0.6, [WV.stepFor(1), WV.stepFor(3), WV.stepFor(10), WV.stepFor(25)]);
/* Was in den Kacheln steht: jede Zeile in ihrer Sehne des Kreises, nie gestaucht; bei den Namen nur der Name. */
{
  const measure = (text, size, bold) => text.length * size * (bold ? 0.58 : 0.52);
  let wide = 0; let checked = 0;
  for (const r of [30, 45, 80, 160, 260]) for (const name of ['Ameisen', 'Europas Länder, Hauptstädte und Landschaften', 'Ein sehr langer Name eines Themas mit vielen Wörtern darin']) {
    for (const detail of [null, ['5 Stufen', 'Karten: 1 von 3 gekonnt', 'Öffnet danach: 2 Themen']]) {
      const fit = WV.fitInfo(name, '2 fehlen', detail, r, measure);
      for (const l of fit.lines) { checked += 1; const chord = 2 * Math.sqrt(Math.max(0, r * r - (Math.abs(l.y) + l.size / 2) ** 2)); if (measure(l.text, l.size, l.bold) > chord + 1e-6) wide += 1; }
      if (detail === null && fit.lines.some((l) => !l.bold)) wide += 1;
    }
  }
  truth(`in-hexagon text: ${checked} lines, every one fits its chord of the round area; the name level shows only the name`, wide === 0, wide);
  const deep = WV.deepestS(900, 560, 0.62);
  const tiles = (900 * 560) / (((3 * Math.sqrt(3)) / 2) * (1 / Math.sqrt(3)) ** 2 * deep * deep * 0.62);
  truth(`the deepest zoom holds about ${tiles.toFixed(1)} tiles (2–5)`, tiles >= 2 && tiles <= 5.5, tiles);
}
/* Die Projektion: hin und zurück, in jeder Drehung und Neigung; die Stufe hängt nicht vom Feld ab. */
let worst = 0;
for (const rot of [0, 60, 120, 180, 240, 300, 30]) for (const fore of [WV.FORE_MIN, 0.6, WV.FORE_MAX]) {
  const cam = { s: 23, cx: 3.2, cy: -1.5, rot, fore };
  const p = WV.projection(cam, 800, 600);
  for (const [x, y] of [[0, 0], [5, 2], [-7, 9]]) { const [sx, sy] = WV.toScreen(p, x, y); const [gx, gy] = WV.toGround(cam, 800, 600, sx, sy); worst = Math.max(worst, Math.hypot(gx - x, gy - y)); }
}
truth(`screen → ground → screen is exact in every rotation and tilt (error ${worst.toExponential(1)})`, worst < 1e-9);
{
  const p = WV.projection({ s: 20, cx: 0, cy: 0, rot: 120, fore: 0.6 }, 800, 600);
  const h1 = WV.toScreen(p, 0, 0, 0)[1] - WV.toScreen(p, 0, 0, 5)[1];
  const h2 = WV.toScreen(p, 9, -4, 0)[1] - WV.toScreen(p, 9, -4, 5)[1];
  truth('one step height everywhere (five steps the same on two fields)', Math.abs(h1 - h2) < 1e-9 && h1 > 0, [h1, h2]);
  const top = WV.projection({ s: 20, cx: 0, cy: 0, rot: 0, fore: 1 }, 800, 600);
  truth('seen from above, heights hide nothing (no lift)', top.lift === 0);
}
console.log('\n  base        topics regions  contiguous             adjacent  ≤ 2   ms');
for (const r of table) console.log(`  ${r.name.padEnd(11)} ${String(r.topics).padStart(6)} ${String(r.regions).padStart(7)}  ${r.contiguous.padEnd(22)} ${r.adjacent.padStart(8)} ${r.near.padStart(5)} ${String(r.ms).padStart(5)}`);
await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
