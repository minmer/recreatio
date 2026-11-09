/**
 * 2026-11-04 (Prompt 11) — DIE EBENEN DES KRAJOBRAZ, nachgemessen: die Gebiete (`regions.ts`) und die Stufen (`landscape.ts`)
 * an Graphen in der Gestalt von LAAG, Bosko und einer Baza mit 5 000 Themen (`scripts/testGraphs.mjs`):
 *   - die Gebiete stehen: jedes Thema in höchstens einem Gebiet der untersten Ebene, oben 1 oder mehr, schnell genug;
 *   - die Stufen: das Gekonnte und das Fällige im Tal (0), das Lernbare eine Stufe darüber, Berge höher;
 *   - „§4 Relationen und Restklassen" steht höher als „Kongruenz modulo m".
 * 2026-11-09 (Weltkarte, Entscheidung 2) — die alte Lage je Ebene (`layoutLevel`) und die feste Karte (`fixedLayout`) sind
 * entfernt, mit ihren Prüfungen (Karten je Ebene, Sicht in sechs Drehungen, Wege alt gegen neu, kette8/zweige8 als Gestalt).
 * Die Plätze der Landschaft prüft app-worldmap-check (`worldLayout.ts`), die Gebiete im Einzelnen app-regions-check.
 *
 *   node scripts/app-levels-check.mjs
 */
import { readLang, useLocale } from './i18n-node.mjs';
/* Polnisch für die Vergleiche — Deutsch dazu: eine Baza kann deutsch sprechen. */
(await useLocale('pl')).dicts.de = await readLang('de');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { big, boskoLike, kette8, laagLike, zweige8 } from './testGraphs.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'app-levels-'));
const names = { regions: 'regions', land: 'landscape' };
await build({
  entryPoints: Object.fromEntries(Object.entries(names).map(([k, n]) => [k, `src/app/cogita/${n}.ts`])),
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [RG, LS] = await Promise.all(Object.keys(names).map(load));

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

const graphs = [['laagLike', laagLike()], ['boskoLike', boskoLike()], ['kette8', kette8()], ['zweige8', zweige8()], ['big(5000)', big(5000)]];
const table = [];
for (const [name, g] of graphs) {
  const t0 = performance.now();
  const tree = RG.buildRegions(g);
  const t1 = performance.now();
  truth(`${name}: regions stand — ${tree.top.length} at the top, ${tree.levels} level(s)`, tree.top.length >= 1, { top: tree.top.length, levels: tree.levels });
  const leaves = new Set(tree.leafOf.filter((k) => k !== null));
  truth(`${name}: every topic in at most one bottom region, and that region exists`, tree.leafOf.length === g.ids.length && [...leaves].every((k) => tree.regions.has(k)), { leaves: leaves.size });
  if (name === 'big(5000)') truth(`big(5000): regions ${Math.round(t1 - t0)} ms (< 1500 ms)`, t1 - t0 < 1500, { regions: t1 - t0 });

  /* Die Stufen: ein neuer Lernender und einer auf halbem Weg. */
  const order = g.ids.map((_, t) => t);
  const fresh = standOf(g, [], []);
  const halfKnown = order.filter((t) => fresh.steps[t] <= 3);
  const known = halfKnown.filter((_, k) => k % 7 !== 0);
  const due = halfKnown.filter((_, k) => k % 7 === 0);
  const half = standOf(g, known, due);
  let valley = 0;
  for (const stand of [fresh, half]) order.forEach((t) => { const b = stand.band[t]; const s = stand.steps[t]; if ((b === 'known' || b === 'due') && s !== 0) valley += 1; if (b === 'ring' && s !== 1) valley += 1; if (b === 'mountain' && s < 2) valley += 1; });
  truth(`${name}: the known and the due lie in the valley (0), the learnable one step above, mountains higher`, valley === 0, valley);
  truth(`${name}: a known topic is band known, a learned-but-due one band due`, known.every((t) => half.band[t] === 'known') && due.every((t) => half.band[t] === 'due'), null);
  const sizes = tree.stats.sizes.map((s) => { const x = [...s].sort((a, b) => a - b); return `${x[0]}–${x[Math.floor(x.length / 2)]}–${x[x.length - 1]}`; });
  table.push({ name, topics: g.ids.length, levels: tree.levels, top: tree.top.length, sizes: sizes.join(' | '), inside: tree.stats.inside.map((x) => `${Math.round(x * 100)} %`).join(' | '), regionsMs: Math.round(t1 - t0) });

  /* §4 gegen Kongruenz (LAAG). */
  if (name === 'laagLike') {
    const s4 = g.ids.indexOf('laag-s4');
    const kong = g.labels.findIndex((l) => l.startsWith('Kongruenz modulo m'));
    truth('laagLike: "§4 Relationen und Restklassen" has more steps than "Kongruenz modulo m" (new learner)', fresh.steps[s4] > fresh.steps[kong], { s4: fresh.steps[s4], kong: fresh.steps[kong] });
  }
}

console.log('\n  base        topics levels top  group sizes (min–median–max per level)          inside share          regions ms');
for (const r of table) console.log(`  ${r.name.padEnd(11)} ${String(r.topics).padStart(5)} ${String(r.levels).padStart(5)} ${String(r.top).padStart(4)}  ${r.sizes.padEnd(46)} ${r.inside.padEnd(22)} ${String(r.regionsMs).padStart(9)}`);
await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
