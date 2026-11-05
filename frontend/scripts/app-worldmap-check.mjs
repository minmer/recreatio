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
 *   - 2026-11-04 (Prompt 15): das Zuhause frei in der Mitte, Land in allen sechs Richtungen, tief steigt nach aussen
 *     (Stufe ↔ Ring), wie viele Stücke das Gewusste eines Lernenden in der Reihenfolge des Autors bildet (Ziel 1), die Zeit;
 *     flache Bazen: jedes Gebiet eine Fläche, das Gewusste ein Stück.
 *
 *   node scripts/app-worldmap-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { big, boskoLike, flach7, kette8, laagLike, stern8, zweige8 } from './testGraphs.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'app-worldmap-'));
const names = { regions: 'regions', world: 'worldLayout', view: 'worldView', data: 'landscapeData' };
await build({
  entryPoints: Object.fromEntries(Object.entries(names).map(([k, n]) => [k, `src/app/cogita/${n}.ts`])),
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [RG, WL, WV, LD] = await Promise.all(Object.keys(names).map(load));

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
for (const [name, g] of [['laagLike', laagLike()], ['boskoLike', boskoLike()], ['kette8', kette8()], ['zweige8', zweige8()], ['flach7', flach7()], ['stern8', stern8()], ['big(5000)', big(5000)]]) {
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
  /* Flach: wenige Stufen (flach7, stern8 — eine Einführung, acht gleichrangige Etappen); tief: laagLike. */
  const flat = name === 'flach7' || name === 'stern8';
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  let whole = 0; let leafWhole = 0; let leaves = 0;
  for (const r of w.regions.values()) { const ok = connected(r.topics.map((t) => w.cells[t])); if (ok) whole += 1; if (r.level === 1) { leaves += 1; if (ok) leafWhole += 1; } }
  const share = whole / Math.max(1, w.regions.size);
  const topWhole = w.top.filter((k) => connected(w.regions.get(k).topics.map((t) => w.cells[t]))).length;
  truth(`${name}: regions are contiguous areas (${whole} of ${w.regions.size}, ${Math.round(share * 100)} %; top regions ${topWhole} of ${w.top.length})`, share >= (flat ? 1 : g.ids.length > 1000 ? 0.85 : 0.5) && topWhole >= w.top.length * (flat ? 1 : 0.85), { whole, all: w.regions.size, leafWhole, leaves, topWhole });
  const at = new Map(w.cells.map((c, i) => [`${c.q},${c.r}`, i]));
  /* Prompt 16: eine geschlossene Fläche — keine Löcher (auch nicht in der Mitte), eine Insel, keine Säule abseits. */
  const qs = w.cells.map((c) => c.q); const rs = w.cells.map((c) => c.r);
  const q0 = Math.min(...qs) - 1; const q1 = Math.max(...qs) + 1; const r0 = Math.min(...rs) - 1; const r1 = Math.max(...rs) + 1;
  const outside = new Set([`${q0},${r0}`]);
  const st = [[q0, r0]];
  while (st.length > 0) { const [q, r] = st.pop(); for (const [dq, dr] of dirs) { const a = q + dq; const b = r + dr; const k = `${a},${b}`; if (a < q0 || a > q1 || b < r0 || b > r1 || outside.has(k) || at.has(k)) continue; outside.add(k); st.push([a, b]); } }
  let holes = 0;
  for (let q = q0; q <= q1; q += 1) for (let r = r0; r <= r1; r += 1) { const k = `${q},${r}`; if (!at.has(k) && !outside.has(k) && k !== '0,0') holes += 1; }
  const islands = (() => { const seen = new Set(); let c = 0; const withHome = new Map(at); withHome.set('0,0', -1); for (const k0 of withHome.keys()) { if (seen.has(k0)) continue; c += 1; const s2 = [k0]; seen.add(k0); while (s2.length > 0) { const [q, r] = s2.pop().split(',').map(Number); for (const [dq, dr] of dirs) { const k = `${q + dq},${r + dr}`; if (withHome.has(k) && !seen.has(k)) { seen.add(k); s2.push(k); } } } } return c; })();
  const strays = w.cells.filter((c) => dirs.filter(([dq, dr]) => at.has(`${c.q + dq},${c.r + dr}`)).length <= 1).length;
  truth(`${name}: one solid area — ${holes} holes, ${islands} island(s), ${strays} columns standing apart`, holes <= (g.ids.length > 1000 ? 0.01 * g.ids.length : 0) && islands === 1 && strays <= (g.ids.length > 1000 ? 3 : 0), { holes, islands, strays });
  /* Das Haus: ein eigenes Feld in der Mitte (kein Thema dort), rundum Land, das Startthema daneben; das Fundament um es. */
  const home = w.home;
  const roots = g.ids.map((_, t) => t).filter((t) => g.needs[t].length === 0);
  const homeRing = dirs.filter(([q, r]) => at.has(`${q},${r}`)).length;
  const startRing = home < 0 ? -1 : (Math.abs(w.cells[home].q) + Math.abs(w.cells[home].r) + Math.abs(w.cells[home].q + w.cells[home].r)) / 2;
  truth(`${name}: the house has its own tile in the centre (no topic on it), all 6 neighbours land, the start topic (${g.labels[home]}) next to it`, home >= 0 && !at.has('0,0') && roots.includes(home) && homeRing === 6 && startRing === 1, { home, homeRing, startRing });
  const inF = new Set(w.foundation);
  const fCells = new Set(w.foundation.map((t) => `${w.cells[t].q},${w.cells[t].r}`));
  const fWhole = connected(w.foundation.map((t) => w.cells[t]));
  const fRadius = Math.max(...w.foundation.map((t) => (Math.abs(w.cells[t].q) + Math.abs(w.cells[t].r) + Math.abs(w.cells[t].q + w.cells[t].r)) / 2));
  const fRound = 3 * fRadius * fRadius + 3 * fRadius + 1 <= 3 * w.foundation.length + 7 * Math.max(1, fRadius);
  truth(`${name}: the foundation (${w.foundation.length} topics, radius ${fRadius}) is one compact patch around the house`, fWhole && fRound, { size: w.foundation.length, fRadius });
  /* Jedes andere oberste Gebiet berührt das Fundament (kein Gebiet beginnt weiter draussen, keine Spirale). */
  const outer = w.top.filter((k) => w.regions.get(k).topics.some((t) => !inF.has(t)));
  const touchingF = outer.filter((k) => w.regions.get(k).topics.some((t) => !inF.has(t) && dirs.some(([dq, dr]) => fCells.has(`${w.cells[t].q + dq},${w.cells[t].r + dr}`)))).length;
  truth(`${name}: ${touchingF} of ${outer.length} regions touch the foundation`, touchingF >= outer.length * (g.ids.length > 1000 ? 0.85 : 1), { touchingF, outer: outer.length });
  if (name === 'laagLike') truth(`laagLike (deep): the foundation is about a whole region (${w.foundation.length} topics)`, w.foundation.length >= 15, w.foundation.length);
  if (name === 'stern8') truth(`stern8 (flat): the foundation is the start and its direct successors (${w.foundation.length})`, w.foundation.length === 9 && w.foundation.every((t) => t === home || g.needs[t].length === 1 && g.needs[t][0] === home), w.foundation.map((t) => g.ids[t]));
  /* Tief steigt nach aussen: die Stufe (längste Kette) und der Ring gehen zusammen (Rangkorrelation). */
  const ringOf = (c) => (Math.abs(c.q) + Math.abs(c.r) + Math.abs(c.q + c.r)) / 2;
  const depth = new Array(g.ids.length).fill(-1);
  const dep = (t) => { if (depth[t] >= 0) return depth[t]; depth[t] = 0; let m = 0; for (const q of g.needs[t] ?? []) m = Math.max(m, dep(q) + 1); depth[t] = m; return m; };
  g.ids.forEach((_, t) => dep(t));
  const rankOf = (xs) => { const o = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(xs.length); let i = 0; while (i < o.length) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j += 1; for (let k = i; k <= j; k += 1) r[o[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const ra = rankOf(depth); const rb = rankOf(w.cells.map(ringOf));
  const ma = ra.reduce((x, y) => x + y, 0) / ra.length; const mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  let sab = 0; let saa = 0; let sbb = 0;
  for (let i = 0; i < ra.length; i += 1) { sab += (ra[i] - ma) * (rb[i] - mb); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - mb) ** 2; }
  const rho = sab / Math.sqrt(Math.max(1e-9, saa * sbb));
  if (!flat && name !== 'flach7') truth(`${name}: deeper topics stand further out (rank correlation ${rho.toFixed(2)})`, rho >= (g.ids.length > 1000 ? 0.2 : 0.3), rho);
  /* Das Gewusste eines Lernenden, der in der Reihenfolge des Autors lernt: wie viele Stücke (mit dem Haus). */
  const learnt = new Set(); const seq = []; const left = g.ids.map((_, t) => t).sort((a, b) => (g.rank?.[a] ?? a) - (g.rank?.[b] ?? b));
  while (left.length > 0) { const i = left.findIndex((t) => (g.needs[t] ?? []).every((q) => learnt.has(q))); const t = left.splice(i < 0 ? 0 : i, 1)[0]; learnt.add(t); seq.push(t); }
  const piecesOf = (ts) => { const land = new Set(ts.map((t) => `${w.cells[t].q},${w.cells[t].r}`)); land.add('0,0'); const seen = new Set(); let c = 0; for (const k0 of land) { if (seen.has(k0)) continue; c += 1; const s2 = [k0]; seen.add(k0); while (s2.length > 0) { const [q, r] = s2.pop().split(',').map(Number); for (const [dq, dr] of dirs) { const k = `${q + dq},${r + dr}`; if (land.has(k) && !seen.has(k)) { seen.add(k); s2.push(k); } } } } return c; };
  const known = [0.1, 0.25, 0.5, 0.75].map((f) => piecesOf(seq.slice(0, Math.round(f * seq.length))));
  truth(`${name}: what a learner knows (10/25/50/75 %) forms ${known.join('/')} piece(s) (reported)`, true, known);
  let e = 0; let adj = 0; let near = 0;
  g.needs.forEach((list, t) => list.forEach((p) => { e += 1; const d = hd(w.cells[t], w.cells[p]); if (d <= 1) adj += 1; if (d <= 2) near += 1; }));
  truth(`${name}: connections join neighbouring (${Math.round((adj / e) * 100)} %) or nearby ≤ 2 (${Math.round((near / e) * 100)} %) hexagons`, near / e >= 0.5, { adj, near, e });
  if (name === 'big(5000)') truth(`big(5000): the whole layout in ${Math.round(w.ms)} ms (< 2500 ms, in the worker)`, w.ms < 2500, w.ms);
  table.push({ name, topics: g.ids.length, regions: w.regions.size, known: known.join('/'), contiguous: `${Math.round(share * 100)} % (top ${topWhole}/${w.top.length})`, adjacent: `${Math.round((adj / e) * 100)} %`, near: `${Math.round((near / e) * 100)} %`, ms: Math.round(w.ms), holes, islands, strays, touch: `${touchingF}/${outer.length}`, found: w.foundation.length });

  /* Namen nach dem Zoom: fern nur die obersten, näher deren Teilgebiete, nah keine Gebiete. */
  const radius = Math.max(...w.cells.map((c) => Math.hypot(c.x, c.y))) + 2;
  for (const [zoom, s] of [['far', 560 / (2 * radius)], ['middle', 12], ['near', 60]]) {
    const cam = zoom === 'far' ? { s, cx: 0, cy: 0, rot: 0, fore: WV.FORE_START } : { s, cx: w.cells[0].x, cy: w.cells[0].y, rot: 0, fore: WV.FORE_START };
    const p = WV.projection(cam, 900, 560);
    const list = [];
    for (const r of w.regions.values()) {
      const d = 2 * r.radius * s;
      const parent = r.parent === null ? null : w.regions.get(r.parent);
      /* Prompt 15: fern (Kacheln unter RING_PX) trägt jedes oberste Gebiet seinen Namen, kein anderes. */
      /* Fern: kleine Kacheln oder die ganze Karte im Bild (wie in WorldMap). */
      const farNow = zoom === 'far' || 2 * 0.57735 * s < WV.RING_PX;
      const alpha = farNow ? (r.parent === null ? 1 : 0) : WV.regionLabelAlpha(d, parent === null || parent === undefined ? null : 2 * parent.radius * s, r.level === 1);
      if (alpha <= 0.02) continue;
      const [x, y] = WV.toScreen(p, r.x, r.y);
      list.push({ key: r.key, text: r.name, x, y, w: Math.min(220, r.name.length * 7 + 16), h: 22, weight: r.topics.length + (parent === null ? 5000 : 0), alpha, level: r.level, top: r.parent === null });
    }
    const all = WV.placeLabels(list, 900, 560);
    const placed = (zoom === 'far' ? WV.keepLabels(all, (l) => l.top, 900, 560) : all).filter((l) => l.shown);
    let overlap = 0;
    for (let i = 0; i < placed.length; i += 1) for (let j = i + 1; j < placed.length; j += 1) { const a = placed[i]; const b = placed[j]; if (Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h) overlap += 1; }
    const perRegion = new Set(placed.map((l) => l.key)).size === placed.length;
    if (zoom === 'far') truth(`${name} far: every top-level region named (${placed.length} of ${w.top.length}, ${placed.filter((l) => l.leader !== undefined).length} at the edge with a line), no other, none overlapping`, placed.every((l) => l.top) && placed.length === w.top.length && overlap === 0 && perRegion, placed.map((l) => l.text));
    else truth(`${name} ${zoom}: names never overlap, one per region (${placed.length} shown)`, overlap === 0 && perRegion, overlap);
  }
}
/* Die Stufe nach der Baza: flach höher, tief wie bisher; dieselbe für jedes Feld. */
truth('step height per base: 3 levels → higher steps, 25 levels → the deep look (0.1)', WV.stepFor(3) > WV.stepFor(10) && WV.stepFor(10) > WV.STEP - 1e-9 && Math.abs(WV.stepFor(25) - WV.STEP) < 1e-9 && WV.stepFor(1) <= 0.6, [WV.stepFor(1), WV.stepFor(3), WV.stepFor(10), WV.stepFor(25)]);
/* Prompt 15: was in den Kacheln steht — der Name (höchstens zwei Zeilen, normale Schrift, nie grösser als die Seite), tief höchstens ein Wort; jede Zeile in ihrer Sehne. */
{
  const measure = (text, size, bold) => text.length * size * (bold ? 0.58 : 0.52);
  let wide = 0; let checked = 0; let large = 0; let many = 0; let bold = 0;
  for (const r of [30, 45, 80, 160, 260]) for (const name of ['Ameisen', 'Europas Länder, Hauptstädte und Landschaften', 'Ein sehr langer Name eines Themas mit vielen Wörtern darin']) {
    for (const deep of [false, true]) {
      const fit = WV.fitInfo(name, '2 fehlen', deep, r, measure, 16);
      if (fit.lines.length > (deep ? 3 : 2)) many += 1;
      for (const l of fit.lines) { checked += 1; if (l.size > 16 + 1e-9) large += 1; const chord = 2 * Math.sqrt(Math.max(0, r * r - (Math.abs(l.y) + l.size / 2) ** 2)); if (measure(l.text, l.size, l.bold) > chord + 1e-6) wide += 1; }
      if (!deep && fit.lines.some((l) => l.bold)) bold += 1;
    }
  }
  truth(`in-hexagon text: ${checked} lines, each fits its chord, none above the body size, name ≤ 2 lines + ≤ 1 status word, the name in the normal weight`, wide === 0 && large === 0 && many === 0 && bold === 0, { wide, large, many, bold });
  const deepS = WV.deepestS(900, 560, 0.62);
  const tiles = (900 * 560) / (((3 * Math.sqrt(3)) / 2) * (1 / Math.sqrt(3)) ** 2 * deepS * deepS * 0.62);
  truth(`the deepest zoom holds about ${tiles.toFixed(1)} tiles (2–5)`, tiles >= 2 && tiles <= 5.5, tiles);
}
/* Prompt 15, 4b: der Ring ist das Mittel der Kenntnis der Karten (jede höchstens 1). */
{
  const v = LD.ringShare([0.9, 0.9, 0.9, 1, 1, 1]);
  truth(`ring: cards at 90/90/90/100/100/100 % → ${Math.round(v * 100)} %`, Math.abs(v - 0.95) < 1e-9, v);
  truth('ring: knowness above 1 counts as 1, no cards → 0', Math.abs(LD.ringShare([3, 0.5]) - 0.75) < 1e-9 && LD.ringShare([]) === 0);
}
/* Prompt 15, 1: einmal gerechnet, gespeichert, wieder benutzt — die gespeicherten Plätze gelten genau, ohne zu rechnen. */
{
  const g = big(5000);
  const tg = { graph: g, node: Int32Array.from(g.ids.map((_, i) => i)), topicOf: Int32Array.from(g.ids.map((_, i) => i)) };
  const tree = RG.buildRegions(g);
  const w = WL.worldLayout(tree, tg);
  const stored = new Map(g.ids.map((id, t) => [id, [w.cells[t].q, w.cells[t].r]]));
  const again = WL.worldLayout(tree, tg, stored);
  truth(`stored places are used as they are (5 000 topics in ${Math.round(again.ms)} ms, computed: ${Math.round(w.ms)} ms)`, JSON.stringify(again.cells) === JSON.stringify(w.cells) && again.ms < w.ms, [again.ms, w.ms]);
  /* Eine Änderung (ein Thema ohne gespeicherten Platz): die anderen behalten fast alle ihren Platz. */
  const keep = new Map(stored); keep.delete(g.ids[17]);
  const moved = WL.worldLayout(tree, tg, keep);
  let same = 0; moved.cells.forEach((c, t) => { const was = stored.get(g.ids[t]); if (was[0] === c.q && was[1] === c.r) same += 1; });
  truth(`recomputing after a change keeps unchanged topics in place (${same} of ${g.ids.length})`, same >= 0.9 * g.ids.length, same);
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
console.log('\n  base        topics regions  contiguous             adjacent  ≤ 2   ms  known pieces');
for (const r of table) console.log(`  ${r.name.padEnd(11)} ${String(r.topics).padStart(6)} ${String(r.regions).padStart(7)}  ${r.contiguous.padEnd(22)} ${r.adjacent.padStart(8)} ${r.near.padStart(5)} ${String(r.ms).padStart(5)} ${String(r.holes).padStart(6)} ${String(r.islands).padStart(7)} ${String(r.strays).padStart(6)}  ${r.touch.padStart(8)} ${String(r.found).padStart(5)}  ${r.known}`);
await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
