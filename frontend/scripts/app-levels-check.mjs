/**
 * 2026-11-04 (Prompt 11) — DIE EBENEN DES KRAJOBRAZ, nachgemessen (`src/app/cogita/levelMap.ts` auf den Gebieten von
 * `regions.ts`, an Graphen in der Gestalt von LAAG, Bosko und einer Baza mit 5 000 Themen — `scripts/testGraphs.mjs`):
 *   - jede Karte zeigt nur Gebiete oder nur Themen, höchstens 20, jedes auf seinem Platz; weiter aussen nur, was tiefer
 *     in der Kette steht;
 *   - EIN Schritt je Ansicht, in allen sechs Drehungen: jede wichtige Fläche mindestens zur Hälfte zu sehen, mehr Stufen
 *     nie niedriger, das Gekonnte im Tal, das Lernbare eine Stufe darüber, nie flacher als die kleinste lesbare Stufe;
 *   - „§4 Relationen und Restklassen" steht höher als „Kongruenz modulo m";
 *   - Wege: Länge (Sechsecke) und Richtungswechsel je Weg — die alte flache Karte gegen die neue Lage; der Weg zu „§4"
 *     läuft nach aussen, ohne Zickzack.
 *
 *   node scripts/app-levels-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { big, boskoLike, laagLike } from './testGraphs.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'app-levels-'));
const names = { regions: 'regions', level: 'levelMap', land: 'landscape' };
await build({
  entryPoints: Object.fromEntries(Object.entries(names).map(([k, n]) => [k, `src/app/cogita/${n}.ts`])),
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [RG, LV, LS] = await Promise.all(Object.keys(names).map(load));

let failed = 0;
let passed = 0;
const truth = (name, ok, detail) => {
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}${detail === undefined ? '' : `\n  ${JSON.stringify(detail).slice(0, 600)}`}`); }
};

/** Die Eingabe des Motors aus einem Themengraphen (alles lernbar, alles im Widok, Abschnitte als Werte). */
function lsInput(g) {
  const values = [];
  const at = new Map();
  const memberOf = g.ids.map((_, t) => {
    const s = g.names[t]?.[0];
    if (s === undefined) return [];
    if (!at.has(s)) { at.set(s, values.length); values.push({ id: `v:${values.length}`, label: s, parent: -1, rank: values.length }); }
    return [at.get(s)];
  });
  return { ids: g.ids, labels: g.labels, needs: g.needs, learnable: g.ids.map(() => true), inView: g.ids.map(() => true), values, memberOf, sorted: true };
}

/** Der Stand eines Lernenden: `known` gekonnt, `due` gelernt, aber fällig; Stufen je Thema (liftOf). */
function standOf(g, known, due) {
  const input = lsInput(g);
  const graph = LS.buildGraph(input);
  const knowness = new Float64Array(g.ids.length);
  for (const t of known) knowness[t] = 1.2;
  for (const t of due) knowness[t] = 0.5;
  const h = LS.heightsOf(graph, { knowness, weak: new Uint8Array(g.ids.length) });
  const steps = g.ids.map((_, t) => LS.liftOf(h.band[t], h.missing[t]));
  return { band: h.band, steps, locked: h.locked };
}

/** Die Felder einer Ebene, wie die Ansicht sie rechnet: ein Gebiet steht so hoch wie das Nächste darin, im Tal, wenn alles sitzt. */
function fieldsOf(layout, stand) {
  return layout.items.map((it, i) => {
    let learned = 0; let ready = 0; let min = Infinity;
    for (const t of it.topics) {
      const b = stand.band[t];
      if (b === 'known' || b === 'due') { learned += 1; continue; }
      if (b === 'ring') ready += 1;
      min = Math.min(min, stand.steps[t]);
    }
    const steps = learned === it.topics.length ? 0 : min;
    return { key: it.key, x: layout.place[i].x, y: layout.place[i].y, steps, important: ready > 0 || steps <= 1 };
  });
}

function eachMap(tree, tg, fn) {
  const cache = new Map();
  const layoutOf = (open) => {
    const k = open ?? '';
    if (cache.has(k)) return cache.get(k);
    const items = LV.levelItems(tree, open, tg);
    const made = LV.layoutLevel(items, tg, tree, open, LV.gateAnglesFor(tree, open, layoutOf));
    cache.set(k, made);
    return made;
  };
  const opens = [null, ...tree.regions.keys()];
  for (const open of opens) fn(open, layoutOf(open));
  return layoutOf;
}

const graphs = [['laagLike', laagLike()], ['boskoLike', boskoLike()], ['big(5000)', big(5000)]];
const table = [];
for (const [name, g] of graphs) {
  const tg = { graph: g, node: Int32Array.from(g.ids.map((_, i) => i)), topicOf: Int32Array.from(g.ids.map((_, i) => i)) };
  const t0 = performance.now();
  const tree = RG.buildRegions(g);
  const t1 = performance.now();
  let maps = 0; let mixed = 0; let crowded = 0; let overlap = 0; let outward = 0; let maxItems = 0;
  /* Kanten in einem Kreis (zwei Themen brauchen einander) haben keine Richtung — sie zählen nicht. */
  const comp = LS.buildGraph(lsInput(g)).comp;
  const sameCycle = (layout, a, b) => layout.items[a].kind === 'topic' && layout.items[b].kind === 'topic' && comp[layout.items[a].topics[0]] === comp[layout.items[b].topics[0]];
  const layoutOf = eachMap(tree, tg, (open, layout) => {
    maps += 1;
    maxItems = Math.max(maxItems, layout.items.length);
    if (new Set(layout.items.map((it) => it.kind)).size > 1) mixed += 1;
    if (layout.items.length > 20) crowded += 1;
    if (new Set(layout.place.map((p) => `${p.q},${p.r}`)).size !== layout.place.length) overlap += 1;
    for (const [a, b] of layout.edges) if (layout.place[a].ring > layout.place[b].ring && !sameCycle(layout, a, b)) outward += 1;
  });
  const t2 = performance.now();
  truth(`${name}: ${maps} maps — none mixes regions and topics`, mixed === 0, mixed);
  truth(`${name}: every map shows at most 20 fields (most ${maxItems})`, crowded === 0, crowded);
  truth(`${name}: every field on its own hex`, overlap === 0, overlap);
  truth(`${name}: a prerequisite never stands further out than what builds on it (rings by depth)`, outward === 0, outward);
  if (name === 'big(5000)') truth(`big(5000): regions ${Math.round(t1 - t0)} ms, all ${maps} level layouts ${Math.round(t2 - t1)} ms (< 1500 ms together)`, t2 - t0 < 1500, { regions: t1 - t0, layouts: t2 - t1 });

  /* Höhen und Sicht: ein neuer Lernender und einer auf halbem Weg, in allen sechs Drehungen. */
  const order = g.ids.map((_, t) => t);
  const fresh = standOf(g, [], []);
  const halfKnown = order.filter((t) => fresh.steps[t] <= 3);
  const half = standOf(g, halfKnown.filter((_, k) => k % 7 !== 0), halfKnown.filter((_, k) => k % 7 === 0));
  let views = 0; let hidden = 0; let notMono = 0; let valley = 0; let tooFlat = 0; let anyHidden = 0; let cutViews = 0; let tilted = 0;
  let sample = 0;
  for (const stand of [fresh, half]) {
    eachMap(tree, tg, (open, layout) => {
      /* Die grosse Baza: jede zehnte Karte (und die oberste) — fest, nicht gewürfelt. */
      sample += 1;
      if (name === 'big(5000)' && open !== null && sample % 10 !== 0) return;
      const base = fieldsOf(layout, stand);
      const cx = base.reduce((s, f) => s + f.x, 0) / Math.max(1, base.length);
      const cy = base.reduce((s, f) => s + f.y, 0) / Math.max(1, base.length);
      for (let k = 0; k < 6; k += 1) {
        const fields = LV.rotated(base, k, cx, cy);
        /* Wie die Ansicht: 6 px je Schritt bei „Ganze Karte" in einem Behälter von 900 × 560 px. */
        const xs = fields.map((f) => f.x);
        const ys = fields.map((f) => f.y);
        const footprint = Math.max(8, Math.min(876 / (Math.max(...xs) - Math.min(...xs) + 2 * LV.HEX_CORNER), 536 / ((Math.max(...ys) - Math.min(...ys)) * 0.52 + 1)));
        const minStep = 6 / footprint;
        const v = LV.viewScale(fields, { minStep, maxStep: 0.3 });
        views += 1;
        if (v.step < minStep - 1e-9) tooFlat += 1;
        if (v.cut.some(Boolean)) cutViews += 1;
        if (v.fore > 0.52 + 1e-9) tilted += 1;
        fields.forEach((f, i) => {
          if (f.important && v.visible[i] < 0.5 - 1e-9) hidden += 1;
          if (v.visible[i] < 0.5 - 1e-9) anyHidden += 1;
          if (f.steps === 0 && v.drawn[i] !== 0) valley += 1;
          if (f.steps === 1 && !v.cut[i] && v.drawn[i] !== 1) valley += 1;
        });
        for (let a = 0; a < fields.length; a += 1) for (let b = 0; b < fields.length; b += 1) {
          if (v.cut[a] || v.cut[b]) continue;
          if (fields[a].steps > fields[b].steps && v.drawn[a] * v.step < v.drawn[b] * v.step - 1e-9) notMono += 1;
        }
      }
    });
  }
  truth(`${name}: ${views} views (2 learners × 6 rotations) — every learnable, due or chosen field at least half visible`, hidden === 0, hidden);
  truth(`${name}: every field at least half visible (tilt first, then shorten columns in front — never flatter)`, anyHidden === 0, anyHidden);
  truth(`${name}: one step for all — more steps never drawn lower (shortened columns are marked)`, notMono === 0, notMono);
  truth(`${name}: in every rotation the known lie in the valley (0) and the learnable one step above`, valley === 0, valley);
  truth(`${name}: never flatter than the smallest readable step (6 px at normal zoom)`, tooFlat === 0, tooFlat);
  const sizes = tree.stats.sizes.map((s) => { const x = [...s].sort((a, b) => a - b); return `${x[0]}–${x[Math.floor(x.length / 2)]}–${x[x.length - 1]}`; });
  table.push({ name, topics: g.ids.length, levels: tree.levels, top: tree.top.length, sizes: sizes.join(' | '), inside: tree.stats.inside.map((x) => `${Math.round(x * 100)} %`).join(' | '), regionsMs: Math.round(t1 - t0), layoutsMs: Math.round(t2 - t1), lessThanHalfVisible: anyHidden, views: `${views} views: ${tilted} tilted more from above, ${cutViews} with a shortened column` });

  /* §4 gegen Kongruenz (LAAG). */
  if (name === 'laagLike') {
    const s4 = g.ids.indexOf('laag-s4');
    const kong = g.labels.findIndex((l) => l.startsWith('Kongruenz modulo m'));
    truth('laagLike: "§4 Relationen und Restklassen" has more steps than "Kongruenz modulo m" (new learner)', fresh.steps[s4] > fresh.steps[kong], { s4: fresh.steps[s4], kong: fresh.steps[kong] });
    const leaf4 = tree.leafOf[s4];
    const leafK = tree.leafOf[kong];
    if (leaf4 === leafK && leaf4 !== null) {
      const layout = layoutOf(leaf4);
      const base = fieldsOf(layout, fresh);
      const a = layout.items.findIndex((it) => it.key === g.ids[s4]);
      const b = layout.items.findIndex((it) => it.key === g.ids[kong]);
      let ok = true;
      for (let k = 0; k < 6; k += 1) {
        const v = LV.viewScale(LV.rotated(base, k), { minStep: 0.05, maxStep: 0.3 });
        if (!(v.drawn[a] * v.step > v.drawn[b] * v.step)) ok = false;
      }
      truth('laagLike: on their map "§4" stands higher than "Kongruenz" in all six rotations', ok);
    } else console.log(`note §4 and Kongruenz lie in different regions (${leaf4} / ${leafK}) — compared by their steps`);
  }

  /* Wege: die alte flache Karte gegen die neue Lage (alle Themen auf einer Ebene) — und je Gebiet. */
  if (name !== 'big(5000)') {
    const input = lsInput(g);
    const graph = LS.buildGraph(input);
    const fixed = LS.fixedLayout(input, graph);
    const oldAt = (t) => { const i = fixed.cellOf[t]; return i < 0 ? null : fixed.cells[i]; };
    const flatItems = g.ids.map((id, t) => ({ key: id, kind: 'topic', label: g.labels[t], topics: [t], rank: t, group: g.names[t]?.[0] ?? '' }));
    const flat = LV.layoutLevel(flatItems, tg, null, null);
    const newAt = (t) => flat.place[t] ?? null;
    const chainOf = (t) => { const out = LS.chainOf(g.needs, t); return [...out.sort((a, b) => graph.rank[graph.comp[a]] - graph.rank[graph.comp[b]] || a - b), t]; };
    const goals = order.filter((t) => fresh.steps[t] >= 4).slice(0, 80);
    const routes = goals.map(chainOf);
    const before = LV.routeMetrics(oldAt, routes);
    /* Die neue Reihenfolge: Gebiet für Gebiet, nach Tiefe und Winkel (`routeOrder`) — auf der flachen neuen Karte nach ihr selbst. */
    const flatTree = null;
    const flatOf = () => flat;
    const after = LV.routeMetrics(newAt, routes.map((r) => LV.routeOrder(flatTree, tg, flatOf, r)));
    /* Je Gebiet: die Wege, soweit sie in einem Gebiet laufen, auf seiner Karte. */
    const leafRoutes = [];
    const leafAt = new Map();
    for (const r of tree.regions.values()) {
      if (r.level !== 1) continue;
      const layout = layoutOf(r.key);
      layout.items.forEach((it, i) => leafAt.set(it.topics[0], layout.place[i]));
    }
    for (const route0 of routes) {
      const route = LV.routeOrder(tree, tg, layoutOf, route0);
      let run = [];
      for (const t of route) {
        if (run.length > 0 && tree.leafOf[run[0]] !== tree.leafOf[t]) { if (run.length > 1) leafRoutes.push(run); run = []; }
        run.push(t);
      }
      if (run.length > 1) leafRoutes.push(run);
    }
    const inLeaf = LV.routeMetrics((t) => leafAt.get(t) ?? null, leafRoutes);
    table[table.length - 1].routes = `old flat ${before.length.toFixed(1)} hex / ${before.turns.toFixed(1)} turns → new flat ${after.length.toFixed(1)} / ${after.turns.toFixed(1)} · in regions ${inLeaf.length.toFixed(1)} / ${inLeaf.turns.toFixed(1)} (${routes.length} routes)`;
    truth(`${name}: routes on the new layout are not longer than on the old flat map (${before.length.toFixed(1)} → ${after.length.toFixed(1)} hexes)`, after.length <= before.length + 1e-9, { before, after });
    truth(`${name}: routes turn less often (${before.turns.toFixed(2)} → ${after.turns.toFixed(2)} per route)`, after.turns <= before.turns + 1e-9, { before, after });
    if (name === 'laagLike') {
      /* Der Weg zu §4 auf jeder Ebene: von Ring zu Ring nach aussen (nie zurück nach innen). */
      const s4 = g.ids.indexOf('laag-s4');
      const route = LV.routeOrder(tree, tg, layoutOf, chainOf(s4));
      let inward = 0;
      const check = (open) => {
        const layout = layoutOf(open);
        const owner = new Map();
        layout.items.forEach((it, i) => { for (const t of it.topics) owner.set(t, i); });
        const seq = [];
        for (const t of route) { const i = owner.get(t); if (i !== undefined && seq[seq.length - 1] !== i) seq.push(i); }
        for (let k = 1; k < seq.length; k += 1) if (layout.place[seq[k]].ring < layout.place[seq[k - 1]].ring) inward += 1;
      };
      check(null);
      for (const r of tree.regions.values()) check(r.key);
      truth('laagLike: the route to "§4" runs outward on every map (never back towards the centre)', inward === 0, inward);
    }
  }
}

console.log('\n  base        topics levels top  group sizes (min–median–max per level)          inside share          regions ms  layouts ms');
for (const r of table) console.log(`  ${r.name.padEnd(11)} ${String(r.topics).padStart(5)} ${String(r.levels).padStart(5)} ${String(r.top).padStart(4)}  ${r.sizes.padEnd(46)} ${r.inside.padEnd(22)} ${String(r.regionsMs).padStart(9)} ${String(r.layoutsMs).padStart(11)}${r.routes === undefined ? '' : `\n              routes: ${r.routes}`}\n              ${r.views}`);
await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
