/**
 * 2026-11-04 — GEBIETE IN GEBIETEN (`cogita/regions.ts`, Prompt 11 · 9), nachgemessen an Nachbildungen von LAAG
 * (278 Felder), Bosko (63) und einem großen Fach (5000 Themen) aus `scripts/testGraphs.mjs`: jede Ebene ist als Graph
 * der Gruppen kreisfrei, Kreise bleiben beisammen, alle Blätter gleich tief, Gruppen von 5–12, oben 7–20, dieselbe
 * Eingabe gibt dasselbe, Namen aus der Baza oder „Rund um <Mitte>", Schlüssel bleiben über eine Änderung der Baza,
 * Namen und Verschiebungen des Eigentümers bleiben, und es ist schnell genug.
 *
 *   node scripts/app-regions-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { big, boskoLike, laagLike, parallelLike, random } from './testGraphs.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'app-regions-'));
await build({
  entryPoints: { regions: 'src/app/cogita/regions.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error'
});
const { buildRegions } = await import(pathToFileURL(join(workspace, 'regions.js')).href);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)?.slice(0, 600)}\n  want ${JSON.stringify(want)?.slice(0, 600)}`); }
};
const truth = (name, ok, detail) => {
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}${detail === undefined ? '' : `\n  ${JSON.stringify(detail).slice(0, 600)}`}`); }
};

/* -- Werkzeuge ------------------------------------------------------------------------------------------------------- */

/** Das Ergebnis ohne die Zeit, als vergleichbarer Text. */
const plain = (tree) => JSON.stringify({ ...tree, regions: [...tree.regions.entries()], stats: { ...tree.stats, ms: 0 } });

/** Die Voraussetzungen ohne Unsinn (Schleifen, Indizes außerhalb, Doppelte) — wie `regions.ts` sie liest. */
const cleanNeeds = (input) => input.needs.map((ps, t) => [...new Set((ps ?? []).filter((p) => Number.isInteger(p) && p >= 0 && p < input.ids.length && p !== t))]);

/** Starke Zusammenhangskomponenten, unabhängig von `regions.ts` gerechnet (Kosaraju). */
function components(input) {
  const n = input.ids.length;
  const succ = Array.from({ length: n }, () => []);
  const pred = Array.from({ length: n }, () => []);
  cleanNeeds(input).forEach((ps, t) => { for (const p of ps) if (p !== t) { succ[p].push(t); pred[t].push(p); } });
  const seen = new Uint8Array(n);
  const order = [];
  for (let s = 0; s < n; s += 1) {
    if (seen[s]) continue;
    const stack = [[s, 0]];
    seen[s] = 1;
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top[1] < succ[top[0]].length) {
        const w = succ[top[0]][top[1]++];
        if (!seen[w]) { seen[w] = 1; stack.push([w, 0]); }
      } else { order.push(top[0]); stack.pop(); }
    }
  }
  const comp = new Int32Array(n).fill(-1);
  let c = 0;
  for (let i = n - 1; i >= 0; i -= 1) {
    const s = order[i];
    if (comp[s] >= 0) continue;
    const stack = [s];
    comp[s] = c;
    while (stack.length) { const v = stack.pop(); for (const w of pred[v]) if (comp[w] < 0) { comp[w] = c; stack.push(w); } }
    c += 1;
  }
  const groups = Array.from({ length: c }, () => []);
  for (let t = 0; t < n; t += 1) groups[comp[t]].push(t);
  return groups.filter((g) => g.length > 1);
}

/** Je Thema sein Gebiet auf Ebene `level` (1 = unten). */
const keyAtLevel = (tree, input, level) => input.ids.map((id) => tree.assignment[id][tree.levels - level]);

/** Ebenen, deren Graph der Gruppen einen Kreis hat (geprüft mit Kahn). */
function cyclicLevels(tree, input) {
  const bad = [];
  for (let level = 1; level <= tree.levels; level += 1) {
    const key = keyAtLevel(tree, input, level);
    const out = new Map();
    const indeg = new Map();
    for (const k of new Set(key)) { out.set(k, new Set()); indeg.set(k, 0); }
    cleanNeeds(input).forEach((ps, t) => {
      for (const p of ps) {
        const a = key[p];
        const b = key[t];
        if (a === b || out.get(a).has(b)) continue;
        out.get(a).add(b);
        indeg.set(b, indeg.get(b) + 1);
      }
    });
    const queue = [...indeg].filter(([, d]) => d === 0).map(([k]) => k);
    for (let i = 0; i < queue.length; i += 1) for (const b of out.get(queue[i])) { indeg.set(b, indeg.get(b) - 1); if (indeg.get(b) === 0) queue.push(b); }
    if (queue.length < out.size) bad.push(level);
  }
  return bad;
}

/** Was am Baum nicht stimmt: Kinder der falschen Art, Blätter verschieden tief, Themen doppelt oder fehlend, Eltern falsch. */
function structureProblems(tree, input) {
  const problems = [];
  const n = input.ids.length;
  const index = new Map(input.ids.map((id, i) => [id, i]));
  if (tree.levels === 0) {
    if (tree.regions.size !== 0) problems.push('regions without levels');
    if (JSON.stringify([...tree.top].sort()) !== JSON.stringify([...input.ids].sort())) problems.push('top is not the topics');
    return problems;
  }
  for (const k of tree.top) { const r = tree.regions.get(k); if (!r || r.level !== tree.levels || r.parent !== null) problems.push(`top ${k} is not a top region`); }
  const seenTopic = new Uint8Array(n);
  for (const [key, r] of tree.regions) {
    if (r.key !== key) problems.push(`${key}: key mismatch`);
    if (r.children.length === 0) problems.push(`${key}: no children`);
    const under = [];
    for (const c of r.children) {
      if (r.level === 1) {
        const t = index.get(c);
        if (t === undefined) { problems.push(`${key}: child ${c} is no topic`); continue; }
        if (seenTopic[t]) problems.push(`${c} in two leaves`);
        seenTopic[t] = 1;
        if (tree.leafOf[t] !== key) problems.push(`${c}: leafOf`);
        under.push(t);
      } else {
        const child = tree.regions.get(c);
        if (!child) { problems.push(`${key}: child ${c} missing`); continue; }
        if (child.level !== r.level - 1) problems.push(`${key}: child ${c} on level ${child.level}`);
        if (child.parent !== key) problems.push(`${c}: parent`);
        under.push(...child.topics);
      }
    }
    if (JSON.stringify([...under].sort((a, b) => a - b)) !== JSON.stringify(r.topics)) problems.push(`${key}: topics ≠ children's topics`);
    if (r.parent !== null && !tree.regions.get(r.parent)?.children.includes(key)) problems.push(`${key}: not among its parent's children`);
  }
  for (let t = 0; t < n; t += 1) {
    if (!seenTopic[t]) problems.push(`${input.ids[t]} in no leaf`);
    const keys = tree.assignment[input.ids[t]];
    if (keys.length !== tree.levels) problems.push(`${input.ids[t]}: depth ${keys.length}`);
    for (let i = 0; i + 1 < keys.length; i += 1) if (tree.regions.get(keys[i + 1])?.parent !== keys[i]) problems.push(`${input.ids[t]}: chain`);
  }
  return problems.slice(0, 10);
}

/** Die Namen der Gebiete über einem Gebiet und neben ihm (dieselben Eltern; oben: die anderen oben). */
function namesAround(tree, r) {
  const out = [];
  for (let p = r.parent; p !== null; p = tree.regions.get(p).parent) out.push(tree.regions.get(p).name);
  for (const s of r.parent === null ? tree.top : tree.regions.get(r.parent).children) if (s !== r.key) out.push(tree.regions.get(s).name);
  return out;
}

/**
 * Je Region die Zahl der Themen darin, die (innen) auf einem Thema aufbauen — die Mitte hat die meisten; heißt das Gebiet
 * nach seiner Mitte, ist es die erste, deren Name darüber und daneben noch frei ist.
 */
function centralProblems(tree, input, sample = Infinity, around = (l) => `Rund um ${l}`) {
  const problems = [];
  const succ = Array.from({ length: input.ids.length }, () => []);
  cleanNeeds(input).forEach((ps, t) => { for (const p of ps) if (p !== t) succ[p].push(t); });
  const rank = input.rank ?? input.ids.map((_, i) => i);
  let done = 0;
  for (const r of tree.regions.values()) {
    if (done >= sample) break;
    done += 1;
    const inside = new Set(r.topics);
    const below = (t) => {
      const seen = new Set([t]);
      const stack = [t];
      while (stack.length) for (const y of succ[stack.pop()]) if (inside.has(y) && !seen.has(y)) { seen.add(y); stack.push(y); }
      return seen.size - 1;
    };
    const count = new Map(r.topics.map((t) => [t, below(t)]));
    const ranked = [...r.topics].sort((p, q) => count.get(q) - count.get(p) || rank[p] - rank[q] || p - q);
    let want = ranked[0];
    if (r.named === 'central') {
      const taken = new Set(namesAround(tree, r).map((s) => s.toLowerCase()));
      want = ranked.find((t) => !taken.has(around(labelOrId(input, t)).toLowerCase())) ?? ranked[0];
    }
    if (want !== r.central) problems.push(`${r.key}: central ${r.central} (${count.get(r.central)}) instead of ${want} (${count.get(want)})`);
  }
  return problems;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length === 0 ? 0 : s[Math.floor((s.length - 1) / 2)]; };
const pct = (x) => `${(100 * x).toFixed(1)} %`;
const labelOrId = (G, t) => (typeof G.labels[t] === 'string' && G.labels[t].trim() !== '' ? G.labels[t].trim() : G.ids[t]);

/** Die Baza nach einer Änderung: `remove` (Kennungen) fort, `add` ({ id, label, name, needs, neededBy, after }) dazu. */
function mutate(G, { add, remove }) {
  const gone = new Set(remove);
  const keep = G.ids.map((_, i) => i).filter((i) => !gone.has(G.ids[i]));
  const at = new Map(keep.map((old, i) => [old, i]));
  const ids = keep.map((i) => G.ids[i]);
  const labels = keep.map((i) => G.labels[i]);
  const names = keep.map((i) => [...G.names[i]]);
  const rank = keep.map((i) => G.rank[i]);
  const needs = keep.map((i) => G.needs[i].filter((p) => at.has(p)).map((p) => at.get(p)));
  for (const a of add) {
    const idx = ids.length;
    ids.push(a.id);
    labels.push(a.label);
    names.push([a.name]);
    rank.push(G.rank[G.ids.indexOf(a.after)] + 0.5);
    needs.push(a.needs.map((id) => ids.indexOf(id)));
    for (const d of a.neededBy ?? []) needs[ids.indexOf(d)].push(idx);
  }
  return { ids, labels, needs, rank, names, meta: G.meta };
}

/* -- Kleine Graphen von Hand ---------------------------------------------------------------------------------------- */

const chainOf = (n, name = 'K') => ({
  ids: Array.from({ length: n }, (_, i) => `c${i}`),
  labels: Array.from({ length: n }, (_, i) => `Schritt ${i}`),
  needs: Array.from({ length: n }, (_, i) => (i === 0 ? [] : [i - 1])),
  names: Array.from({ length: n }, () => [name])
});

{
  const small = chainOf(20);
  const T = buildRegions(small);
  check('a base of ≤ 20 topics has no regions: the top shows the topics, in the order of learning', [T.levels, T.regions.size, T.top.length, T.top[0], T.top[19], T.leafOf.every((x) => x === null)], [0, 0, 20, 'c0', 'c19', true]);
  check('… and every topic’s assignment is empty', Object.values(T.assignment).every((k) => k.length === 0), true);
}

{
  const C = chainOf(40);
  const T = buildRegions(C);
  const runs = [...T.regions.values()].filter((r) => r.level === 1).map((r) => r.topics);
  const contiguous = runs.every((ts) => ts[ts.length - 1] - ts[0] === ts.length - 1);
  check('a chain of 40: one level, the top in 7–20', [T.levels, T.top.length >= 7 && T.top.length <= 20], [1, true]);
  truth('… each region is a piece of the chain (contiguous), so only the cuts cross', contiguous && T.stats.inside[0] >= (39 - (runs.length - 1)) / 39 - 1e-9, runs);
  check('… the children of a region follow the chain', [...T.regions.values()][0].children, runs[0].map((t) => `c${t}`).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
  const leaves = [...T.regions.values()].filter((r) => r.level === 1);
  check('… the chain’s one name „K" goes to one region only; the others are named after their first step (all others inside depend on it)',
    [leaves.filter((r) => r.name === 'K' && r.named === 'base').length, leaves.filter((r) => r.named === 'central').every((r) => r.name === `Rund um Schritt ${r.topics[0]}`)], [1, true]);
}

{
  /* Ein Kreis (c10 → … → c13 → c10) mitten in einer Kette: ein Atom, nie geteilt. */
  const C = chainOf(60);
  C.needs[10] = [9, 13];
  const T = buildRegions(C);
  check('a cycle inside a chain stays in one region', new Set([10, 11, 12, 13].map((t) => T.leafOf[t])).size, 1);
  check('… and every level stays acyclic', cyclicLevels(T, C), []);
}

{
  /* 30 Themen ohne Kanten, zwei Namen: Gruppen nach Namen und Reihenfolge des Autors. */
  const n = 30;
  const G = {
    ids: Array.from({ length: n }, (_, i) => `x${i}`),
    labels: Array.from({ length: n }, (_, i) => `Thema ${i}`),
    needs: Array.from({ length: n }, () => []),
    names: Array.from({ length: n }, (_, i) => [i < 15 ? 'Teil A' : 'Teil B'])
  };
  const T = buildRegions(G);
  const leaves = [...T.regions.values()].filter((r) => r.level === 1);
  check('topics without edges: grouped by their names, never mixed', leaves.every((r) => new Set(r.topics.map((t) => t < 15)).size === 1), true);
  check('… in pieces of the author’s order', leaves.every((r) => r.topics[r.topics.length - 1] - r.topics[0] === r.topics.length - 1), true);
  check('… the top in 7–20, no region with one child', [T.top.length >= 7 && T.top.length <= 20, leaves.every((r) => r.children.length >= 2)], [true, true]);
}

{
  /* Drei Abschnitte von je 11 Themen mit Eintrag: Namen der Baza, je Ebene jeder nur einmal. */
  const ids = [];
  const labels = [];
  const needs = [];
  const names = [];
  for (const [s, title] of ['§1 Anfang', '§2 Mitte', '§3 Ende'].entries()) {
    const entry = ids.length;
    ids.push(`e${s}`); labels.push(title); needs.push([]); names.push([title]);
    for (let j = 0; j < 11; j += 1) {
      const idx = ids.length;
      ids.push(`t${s}-${j}`); labels.push(`Thema ${s + 1}.${j + 1}`); names.push([title]);
      needs.push(j === 0 ? (s === 0 ? [] : [entry - 1]) : [idx - 1]);
    }
    needs[entry].push(ids.length - 1);
  }
  const T = buildRegions({ ids, labels, needs, names });
  const level1 = [...T.regions.values()].filter((r) => r.level === 1);
  const base = level1.filter((r) => r.named === 'base').map((r) => r.name).sort();
  check('sections: every section name is used by exactly one region of a level', base, ['§1 Anfang', '§2 Mitte', '§3 Ende']);
  check('… the region with the section entry wins its name', level1.filter((r) => r.named === 'base').every((r) => r.topics.some((t) => labels[t] === r.name)), true);
  check('… the others are named after their central topic', level1.filter((r) => r.named === 'central').every((r) => r.name === `Rund um ${labels[r.central]}`), true);
  const pl = buildRegions({ ids, labels, needs, names }, { around: (l) => `Wokół: ${l}` });
  check('… in another language (`around`)', [...pl.regions.values()].filter((r) => r.named === 'central').every((r) => r.name.startsWith('Wokół: ')), true);
}

/* -- Die drei Graphen --------------------------------------------------------------------------------------------- */

const graphs = [
  ['laagLike', laagLike(), 50],
  ['boskoLike', boskoLike(), 50],
  ['big(5000)', big(5000), 1500],
  /* Dasselbe Fach dichter verbunden (~2,5 Kanten je Thema): die obere Grenze, für die es schnell sein muss. */
  ['big dense', big(5000, 5000, 0.6), 1500],
  /* Wie die Bosko-Kopie auf LocalDB: Abschnitte aus vielen kurzen Ketten nebeneinander — schwer für die Größen. */
  ['parallelLike', parallelLike(), 50]
];
const table = [];

for (const [name, G, limit] of graphs) {
  const n = G.ids.length;
  const t1 = Date.now();
  const cold = buildRegions(G);
  const coldMs = Date.now() - t1;
  const runs = [];
  let warm = cold;
  for (let i = 0; i < 3; i += 1) { warm = buildRegions(G); runs.push(warm.stats.ms); }
  const T = warm;
  const ms = Math.min(...runs);

  check(`${name}: the same input gives the same result (twice, and after warming up)`, plain(cold) === plain(T), true);
  check(`${name}: the same base with its own assignment as \`previous\` gives exactly the same tree`, plain(buildRegions(G, { previous: T.assignment })) === plain(T), true);
  check(`${name}: the result survives structured cloning (Worker)`, plain(structuredClone(T)) === plain(T), true);
  check(`${name}: the hierarchy is sound (kinds of children, equal depth, every topic in one leaf, parents)`, structureProblems(T, G), []);
  check(`${name}: every level’s group graph is acyclic`, cyclicLevels(T, G), []);
  const cycles = components(G);
  check(`${name}: cycles (${cycles.length}) are never split`, cycles.filter((c) => new Set(c.map((t) => T.leafOf[t])).size > 1).length, 0);
  check(`${name}: the top has 7–20 regions`, T.top.length >= 7 && T.top.length <= 20 ? 'ok' : T.top.length, 'ok');
  check(`${name}: every topic depends on… — the central topic of each region has the most descendants inside`, centralProblems(T, G, n > 1000 ? 200 : Infinity), []);

  const outliers = [];
  const ones = [];
  T.stats.sizes.forEach((sizes, i) => {
    const [lo, hi] = T.stats.bounds[i];
    sizes.forEach((s) => { if (s < lo || s > hi) outliers.push(`L${i + 1}:${s}∉[${lo},${hi}]`); });
  });
  for (const r of T.regions.values()) if (r.children.length === 1) ones.push(r.key);
  const groups = T.stats.sizes.reduce((s, x) => s + x.length, 0);
  truth(`${name}: group sizes within their bounds — outliers rare (${outliers.length} of ${groups}${outliers.length ? `: ${outliers.slice(0, 12).join(' ')}` : ''})`, outliers.length <= Math.max(1, Math.floor(groups * 0.08)), outliers);
  check(`${name}: no region with a single child`, ones, []);
  truth(`${name}: in time (${ms.toFixed(1)} ms warm, ${coldMs} ms cold; limit ${limit} ms)`, ms < limit && coldMs < limit * 3, { ms, coldMs });

  /* Namen: aus der Baza (die Hälfte der Themen teilt ihn, je Ebene einmal) oder „Rund um <Mitte>" — nie zweimal auf einem
     Weg von oben (Brotkrumen) und nie zweimal nebeneinander. */
  const names = new Map();
  const badNames = [];
  const repeats = [];
  for (const r of T.regions.values()) {
    const plainName = `Rund um ${labelOrId(G, r.central)}`;
    if (r.named === 'central' && r.name !== plainName && !/^ (d+)$/.test(r.name.slice(plainName.length))) badNames.push(r.key);
    if (namesAround(T, r).some((x) => x.toLowerCase() === r.name.toLowerCase())) repeats.push(`${r.key} „${r.name}"`);
    if (r.named === 'base') {
      const share = r.topics.filter((t) => G.names[t].includes(r.name) || G.labels[t] === r.name).length / r.topics.length;
      if (share < 0.5) badNames.push(`${r.key} share ${share}`);
      const k = `${r.level}|${r.name}`;
      if (names.has(k)) badNames.push(`${r.name} twice on level ${r.level}`);
      names.set(k, r.key);
    }
  }
  check(`${name}: names are a base name (≥ half of the topics, once per level) or „Rund um <central>"`, badNames.slice(0, 8), []);
  check(`${name}: no region carries the name of a region above it or beside it`, repeats.slice(0, 8), []);

  const row = { name, n, edges: T.stats.edges, cycles: T.stats.cycles, levels: T.levels, top: T.top.length, ms, coldMs, per: [] };
  T.stats.sizes.forEach((sizes, i) => row.per.push({ level: i + 1, groups: sizes.length, min: Math.min(...sizes), med: median(sizes), max: Math.max(...sizes), bounds: T.stats.bounds[i], inside: T.stats.inside[i], base: [...T.regions.values()].filter((r) => r.level === i + 1 && r.named === 'base').length }));
  table.push(row);
  graphs.find((g) => g[0] === name).push(T);
}

/* -- Viele kurze Ketten nebeneinander: keine winzigen Gruppen ------------------------------------------------------------ */

{
  const [, G, , T] = graphs[4];
  const leaves = [...T.regions.values()].filter((r) => r.level === 1);
  const tiny = leaves.filter((r) => r.children.length < 5).map((r) => r.children.length);
  check(`parallelLike: ${G.meta.sections.reduce((s, x) => s + x.chains.length, 0)} short chains side by side — no leaf region under 5 topics`, tiny, []);
  /* Mischt ein Blatt Abschnitte, dann über Kanten (eine Kette beginnt im vorigen Abschnitt): das entscheidet die Struktur,
     nicht der Name. Stücke ohne Kante zum Rest (Reste) aber gehören zum Abschnitt eines anderen Stücks im Blatt. */
  const needs = cleanNeeds(G);
  let pieces = 0;
  const strays = [];
  for (const r of leaves) {
    const inside = new Set(r.topics);
    const piece = new Map();
    for (const t of r.topics) {
      if (piece.has(t)) continue;
      const id = pieces++;
      const stack = [t];
      piece.set(t, id);
      while (stack.length) {
        const x = stack.pop();
        const near = [...needs[x], ...r.topics.filter((y) => needs[y].includes(x))];
        for (const y of near) if (inside.has(y) && !piece.has(y)) { piece.set(y, id); stack.push(y); }
      }
    }
    const ids = [...new Set(piece.values())];
    if (ids.length < 2) continue;
    for (const id of ids) {
      const mine = new Set(r.topics.filter((t) => piece.get(t) === id).map((t) => G.names[t][0]));
      const others = new Set(r.topics.filter((t) => piece.get(t) !== id).map((t) => G.names[t][0]));
      if (![...mine].some((x) => others.has(x))) strays.push(r.key);
    }
  }
  truth(`parallelLike: … pieces joined without an edge share a section with the rest of their leaf (${strays.length} strays of ${leaves.length} leaves)`, strays.length <= Math.ceil(leaves.length * 0.1), strays);
}

/* -- LAAG: die Abschnitte heißen wie in der Baza ------------------------------------------------------------------------ */

{
  const [, G, , T] = graphs[0];
  const sections = G.meta.sections.map((s) => s.label);
  const level1 = [...T.regions.values()].filter((r) => r.level === 1);
  const all = [...T.regions.values()];
  const highest = sections.map((s) => all.filter((r) => r.name === s && r.named === 'base').sort((a, b) => b.level - a.level)[0]);
  check('laagLike: each section (§1–§8) names a region — the highest that is mostly that section, never one below it again', [highest.filter((r) => r !== undefined).length, all.filter((r) => r.named === 'base' && namesAround(T, r).includes(r.name)).length], [8, 0]);
  const entryRegions = G.meta.sections.filter((s, i) => highest[i]?.topics.includes(s.entry)).length;
  truth(`laagLike: … mostly the region holding the section entry (${entryRegions} of 8)`, entryRegions >= 6);
  const mixed = level1.filter((r) => new Set(r.topics.map((t) => G.names[t][0])).size > 1).length;
  truth(`laagLike: level-1 regions rarely cross a section (${mixed} of ${level1.length}) — the structure follows the edges`, mixed <= Math.ceil(level1.length * 0.25));
  const top = T.top.map((k) => T.regions.get(k).name);
  console.log(`     top: ${top.join(' | ')}`);
}

/* -- Bestand: nach einer Änderung der Baza bleiben Schlüssel, Namen und Verschiebungen ------------------------------------- */

function stability(name, G, T, change) {
  const G2 = mutate(G, change);
  const untouched = [...T.regions.values()].filter((r) => r.level === 1 && !r.topics.some((t) => change.remove.includes(G.ids[t]) || change.add.some((a) => a.after === G.ids[t] || a.needs.includes(G.ids[t]))));
  const named = untouched[Math.floor(untouched.length / 2)].key;
  const T2 = buildRegions(G2, { previous: T.assignment, overrides: { names: { [named]: 'Mein Gebiet' } } });
  const old = [...T.regions.keys()];
  const kept = old.filter((k) => T2.regions.has(k)).length / old.length;
  const reused = [...T2.regions.keys()].filter((k) => T.regions.has(k)).length / T2.regions.size;
  truth(`${name}: +${change.add.length} topics −${change.remove.length}: ${pct(kept)} of the regions keep their key (${pct(reused)} of the new ones are old) — at least 85 %`, kept >= 0.85, { kept, reused });
  check(`${name}: … an owner name on a matched region survives`, [T2.regions.get(named)?.name, T2.regions.get(named)?.named], ['Mein Gebiet', 'owner']);
  check(`${name}: … still acyclic, still sound`, [cyclicLevels(T2, G2), structureProblems(T2, G2)], [[], []]);
  const again = buildRegions(G2, { previous: T2.assignment });
  check(`${name}: … recomputing the changed base again keeps every key`, [...again.regions.keys()].sort(), [...T2.regions.keys()].sort());
  return T2;
}

{
  const [, G, , T] = graphs[0];
  const s4 = G.meta.sections[3];
  const s5 = G.meta.sections[4];
  stability('laagLike', G, T, {
    add: [
      { id: 'laag-new-1', label: 'Rechnen mit Restklassen (Beispiel 4.40)', name: s4.label, needs: [G.ids[s4.chains[0][1]]], after: G.ids[s4.chains[0][1]] },
      { id: 'laag-new-2', label: 'Potenzen modulo m (Aufgabe 4.41)', name: s4.label, needs: ['laag-new-1'], after: G.ids[s4.chains[0][1]] },
      { id: 'laag-new-3', label: 'Notation (Bemerkung 7.50)', name: G.meta.sections[6].label, needs: [], after: G.ids[G.meta.sections[6].members[3]] }
    ],
    remove: [G.ids[s5.chains[0][2]], G.ids[G.meta.isolated[1]]]
  });
}

{
  const [, G, , T] = graphs[2];
  const a = G.meta.areaOf;
  const inArea = (ai) => G.ids.map((_, i) => i).filter((i) => a[i] === ai && G.needs[i].length > 0);
  const x = inArea(12);
  const y = inArea(31);
  stability('big(5000)', G, T, {
    add: [
      { id: 'big-new-1', label: 'Neu 1', name: G.meta.areas[12].name, needs: [G.ids[x[5]]], after: G.ids[x[5]] },
      { id: 'big-new-2', label: 'Neu 2', name: G.meta.areas[12].name, needs: ['big-new-1', G.ids[x[6]]], after: G.ids[x[6]] },
      { id: 'big-new-3', label: 'Neu 3', name: G.meta.areas[31].name, needs: [G.ids[y[9]]], neededBy: [G.ids[y[12]]], after: G.ids[y[9]] }
    ],
    remove: [G.ids[x[20]], G.ids[y[40]]]
  });
}

{
  const [, G, , T] = graphs[1];
  const last = G.meta.stages[7];
  stability('boskoLike', G, T, {
    add: [
      { id: 'bosko-new-1', label: 'Sen o różach', name: 'etap 4', needs: [G.ids[G.meta.stages[3][2]]], after: G.ids[G.meta.stages[3][2]] },
      { id: 'bosko-new-2', label: 'Wizyta u papieża', name: 'etap 5', needs: [G.ids[G.meta.stages[4][3]]], after: G.ids[G.meta.stages[4][3]] },
      { id: 'bosko-new-3', label: 'Pamiątki', name: 'etap 8', needs: [G.ids[last[2]]], after: G.ids[last[2]] }
    ],
    remove: [G.ids[G.meta.stages[2][5]], G.ids[G.meta.stages[6][6]]]
  });
}

/* Zufällige kleine Änderungen (+3 −2, jeweils mit Kanten): wie viele Schlüssel bleiben — und bei einer großen (±10 %). */
function randomChange(G, R, addN, removeN) {
  const n = G.ids.length;
  const gone = new Set();
  while (gone.size < removeN) gone.add(G.ids[R.int(0, n - 1)]);
  const add = [];
  for (let a = 0; a < addN; a += 1) {
    let anchor;
    do anchor = G.ids[R.int(0, n - 1)]; while (gone.has(anchor));
    const needs = [anchor];
    const other = G.ids[R.int(0, n - 1)];
    if (R() < 0.5 && !gone.has(other) && G.rank[G.ids.indexOf(other)] < G.rank[G.ids.indexOf(anchor)]) needs.push(other);
    add.push({ id: `rnd-${a}`, label: `Neu ${a}`, name: G.names[G.ids.indexOf(anchor)][0] ?? 'neu', needs, after: anchor });
  }
  return mutate(G, { add, remove: [...gone] });
}
for (const [name, G, , T] of graphs.slice(0, 3)) {
  const R = random(4711);
  const kept = [];
  for (let trial = 0; trial < 10; trial += 1) {
    const T2 = buildRegions(randomChange(G, R, 3, 2), { previous: T.assignment });
    kept.push([...T.regions.keys()].filter((k) => T2.regions.has(k)).length / T.regions.size);
  }
  const tenth = Math.max(1, Math.round(G.ids.length / 10));
  const T3 = buildRegions(randomChange(G, R, tenth, tenth), { previous: T.assignment });
  const large = [...T.regions.keys()].filter((k) => T3.regions.has(k)).length / T.regions.size;
  truth(`${name}: 10 random changes (+3 −2): at least ${pct(Math.min(...kept))} of the keys stay (mean ${pct(kept.reduce((s, x) => s + x, 0) / kept.length)}); after ±10 %: ${pct(large)}`, Math.min(...kept) >= 0.85, kept);
}

/* -- Verschiebungen des Eigentümers ------------------------------------------------------------------------------------------ */

{
  const [, G, , T] = graphs[0];
  const lone = G.meta.isolated[0];
  const from = T.leafOf[lone];
  const leaves = [...T.regions.values()].filter((r) => r.level === 1);
  const to = leaves.find((r) => r.key !== from && T.regions.get(r.parent) !== T.regions.get(T.regions.get(from).parent)).key;
  /* Ein Schritt mitten in einer Kette, dessen Vorgänger und Nachfolger im selben Gebiet liegen: woanders hin entstünde ein Kreis. */
  const chain = G.meta.sections.flatMap((s) => s.chains).find((c) => c.length >= 5 && T.leafOf[c[1]] === T.leafOf[c[2]] && T.leafOf[c[2]] === T.leafOf[c[3]]);
  const mid = chain[2];
  const elsewhere = leaves.find((r) => r.key !== T.leafOf[mid]).key;
  const moves = { [G.ids[lone]]: to, [G.ids[mid]]: elsewhere, 'no-such-topic': to, [G.ids[chain[0]]]: 'r:nowhere' };
  const M = buildRegions(G, { previous: T.assignment, overrides: { moves } });
  check('owner moves: a topic without edges goes where the owner put it', [M.leafOf[lone], M.stats.moved], [to, 1]);
  check('… a move that would make a path leave a region and come back is ignored, with why', M.stats.ignored.filter((x) => x.startsWith(G.ids[mid])).map((x) => x.replace(/level \d+/, 'level k')), [`${G.ids[mid]}: would create a cycle (level k)`]);
  check('… unknown topics and regions are reported', M.stats.ignored.length, 3);
  check('… the moved base is still sound and acyclic on every level', [structureProblems(M, G), cyclicLevels(M, G)], [[], []]);
  check('… the region left behind and the one gained count right', [M.regions.get(to).topics.includes(lone), M.regions.get(from)?.topics.includes(lone) ?? false], [true, false]);
  const G2 = mutate(G, { add: [{ id: 'laag-extra', label: 'Zusatz (Aufgabe 8.60)', name: G.meta.sections[7].label, needs: [G.ids[G.meta.sections[7].members[0]]], after: G.ids[G.meta.sections[7].members[0]] }], remove: [] });
  const M2 = buildRegions(G2, { previous: M.assignment, overrides: { moves } });
  check('… and the move survives recomputing a changed base', M2.leafOf[G2.ids.indexOf(G.ids[lone])], to);
}

/* -- Namen des Eigentümers, eigene Grenzen, unsaubere Eingaben ------------------------------------------------------------------ */

{
  const [, G, , T] = graphs[0];
  const top = T.top[3];
  const leaf = [...T.regions.values()].find((r) => r.level === 1 && r.named === 'base').key;
  const N = buildRegions(G, { overrides: { names: { [top]: '  Zahlen und Teilbarkeit ', [leaf]: 'Restklassen', 'r:unknown': 'x', [T.top[4]]: '   ' } } });
  check('owner names win (trimmed) on any level and mark the region', [N.regions.get(top).name, N.regions.get(top).named, N.regions.get(leaf).name, N.regions.get(leaf).named], ['Zahlen und Teilbarkeit', 'owner', 'Restklassen', 'owner']);
  check('… an empty owner name is no name, an unknown key changes nothing', [N.regions.get(T.top[4]).named !== 'owner', plain({ ...N, regions: new Map([...N.regions].filter(([k]) => k !== top && k !== leaf)) }) === plain({ ...T, regions: new Map([...T.regions].filter(([k]) => k !== top && k !== leaf)) })], [true, true]);
  const leafName = T.regions.get(leaf).name;
  const others = [...N.regions.values()].filter((r) => r.level === 1 && r.name === leafName);
  check('… a base name the owner’s region gave up stays unused (each name once per level, the owner’s region keeps it out)', others.length, 0);
}

{
  const G = big(1200, 12);
  const T = buildRegions(G, { min: 3, max: 6, topMin: 4, topMax: 9 });
  const out = T.stats.sizes.flatMap((s, i) => s.filter((x) => x < T.stats.bounds[i][0] || x > T.stats.bounds[i][1]));
  check('own bounds (3–6, top 4–9): every level within them, the top within 4–9', [T.stats.bounds[0], out.length <= Math.ceil(T.stats.sizes.flat().length * 0.05), T.top.length >= 4 && T.top.length <= 9, cyclicLevels(T, G)], [[3, 6], true, true, []]);
}

{
  /* Doppelte Kanten, Schleifen, Indizes außerhalb, keine Namen, keine Beschriftung, eine zerbrochene vorige Rechnung. */
  const n = 45;
  const G = {
    ids: Array.from({ length: n }, (_, i) => `u${i}`),
    labels: Array.from({ length: n }, (_, i) => (i % 7 === 0 ? '' : `U ${i}`)),
    needs: Array.from({ length: n }, (_, i) => (i === 0 ? [0, -1, 99, NaN] : [i - 1, i - 1, i, 1.5]))
  };
  const T = buildRegions(G, { previous: { u1: 'nope', u2: [null, 7], u3: [], u4: ['r:u0', 'r:u0'] } });
  check('messy input: duplicates, loops and bad indices are ignored', [T.stats.edges, T.stats.cycles, cyclicLevels(T, G), structureProblems(T, G)], [44, 0, [], []]);
  check('… a topic without a label is named by its id', [...T.regions.values()].filter((r) => r.named === 'central' && labelOrId(G, r.central) !== r.name.replace(/^Rund um /, '')).length, 0);
}

/* -- Die Tabelle ---------------------------------------------------------------------------------------------------------------- */

console.log('\n  graph        topics  edges  cycles  levels  top   ms (warm/cold)');
for (const r of table) {
  console.log(`  ${r.name.padEnd(12)} ${String(r.n).padStart(6)} ${String(r.edges).padStart(6)} ${String(r.cycles).padStart(7)} ${String(r.levels).padStart(7)} ${String(r.top).padStart(4)}   ${r.ms.toFixed(1)} / ${r.coldMs}`);
  for (const p of r.per) {
    console.log(`      L${p.level}: ${String(p.groups).padStart(4)} groups, sizes min/med/max ${p.min}/${p.med}/${p.max} (bounds ${p.bounds[0]}–${p.bounds[1]}), inside ${pct(p.inside)}, base-named ${p.base}`);
  }
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
