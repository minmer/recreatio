/**
 * 2026-11-22 (Änderungspaket C2/A5) — DIE TAGS EINER WELT (`cogita/tags.ts`, `worldmap/wmTags.ts`): ein Netz mit Ebenen, in dem ein
 * Untertag mehreren oberen angehört; Ebenen als längster Weg; alle Türme unter einem Tag über alle Ebenen; Kreise geschnitten und
 * beim Import gemeldet; erreichbare Tags; erobert/alle; der Anfangs-Tag grosser Welten; die Tags eines Blocks gelten für seine Teile;
 * der Ausschnitt der Karte (`sceneOf` mit `only`: Türme, Wege zwischen ihnen, Knoten, der Boden der ganzen Welt); die Einstufung auf
 * einen Tag begrenzt; das Feld `"tag": "up"` im Schema; die Tag-Liste für MCP (`tagsForAi`).
 *
 *   node scripts/app-tags-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-tags-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}cogita/tags';
export { worldTags, validSlice, SLICE_FROM } from '${app}cogita/worldmap/wmTags';
export { readWorld } from '${app}cogita/worldmap/wmGraph';
export { linesOf } from '${app}cogita/worldmap/wmLines';
export { stateOf } from '${app}cogita/worldmap/wmState';
export { sceneOf } from '${app}cogita/worldmap/wmScene';
export { geometryOf, geometryInputOf } from '${app}cogita/worldmap/wmGeometry';
export { fakeLearner, generatedWorld } from '${app}cogita/worldmap/wmFixtures';
export { scopeTowers } from '${app}cogita/worldmap/wmPlacement';
export { tagsForAi } from '${app}cogita/worldmap/wmExport';
export { memoryBase } from '${app}cogita/memoryBase';
export { planImport } from '${app}cogita/json';
export { readKind } from '${app}cogita/schema';
`);
await build({ entryPoints: { e: entry }, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) } });
globalThis.BroadcastChannel = undefined;
const M = await import(pathToFileURL(join(workspace, 'e.js')).href);
await rm(workspace, { recursive: true, force: true });

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const sorted = (set) => [...set].sort();

/* -- 1. Das Netz: Wurzeln, mehrere obere Tags, Ebenen, alles darunter -------------------------------------------------------------- */
/*
   mechanika        energia
     |    \\         /
     |   energia-mech (zwei obere)
   kinematyka         |
     |              hustawka-tag? (nein: Türme)
   ruch-jedn (Ebene 2)
*/
const TAG = ['tag'];
const src = [
  { id: 'mechanika', label: 'Mechanika', tags: [], kinds: TAG },
  { id: 'energia', label: 'Energia', tags: [], kinds: TAG },
  { id: 'energia-mech', label: 'Energia mechaniczna', tags: ['mechanika', 'energia'], kinds: TAG },
  { id: 'kinematyka', label: 'Kinematyka', tags: ['mechanika'], kinds: TAG },
  { id: 'ruch-jedn', label: 'Ruch jednostajny', tags: ['kinematyka'], kinds: TAG },
  /* Ein neuer Untertag ohne Türme: niemand zeigt auf ihn, aber er ist ein Eintrag des Rodzaj „Tag". */
  { id: 'gleboki', label: 'Głęboki', tags: ['ruch-jedn', 'energia'], kinds: TAG },
  { id: 'T1', label: 'Huśtawka', tags: ['energia-mech'] },
  { id: 'T2', label: 'Wahadło', tags: ['energia-mech', 'kinematyka'] },
  { id: 'T3', label: 'Pociąg', tags: ['ruch-jedn'] },
  { id: 'T4', label: 'Bateria', tags: ['energia'] },
  { id: 'T5', label: 'Bez tagu', tags: [] }
];
const towers = src.filter((s) => s.id.startsWith('T'));
const net = M.tagNetwork(src, towers);
check('tags = the targets of tag fields and entries of their kinds (a new subtag without towers too); towers are not tags', sorted(net.tags.keys()), ['energia', 'energia-mech', 'gleboki', 'kinematyka', 'mechanika', 'ruch-jedn']);
check('roots: the tags without a parent', [...net.roots].sort(), ['energia', 'mechanika']);
check('a subtag may have two parents', [...net.tags.get('energia-mech').parents].sort(), ['energia', 'mechanika']);
check('levels = the longest way from a root', Object.fromEntries(net.order.map((id) => [id, net.tags.get(id).level])), { energia: 0, mechanika: 0, 'energia-mech': 1, kinematyka: 1, 'ruch-jedn': 2, gleboki: 3 });
check('order: by level, then name', net.order, ['energia', 'mechanika', 'energia-mech', 'kinematyka', 'ruch-jedn', 'gleboki']);
check('children of a parent', [...net.tags.get('mechanika').children].sort(), ['energia-mech', 'kinematyka']);
check('direct towers of a tag', sorted(net.direct('energia-mech')), ['T1', 'T2']);
check('a parent tag shows all towers below it across all levels', sorted(net.below('mechanika')), ['T1', 'T2', 'T3']);
check('… and through every parent of a subtag (energia → energia-mech, gleboki)', sorted(net.below('energia')), ['T1', 'T2', 'T4']);
check('descendants of a tag (DAG, each once)', sorted(net.descendants('mechanika')), ['energia-mech', 'gleboki', 'kinematyka', 'mechanika', 'ruch-jedn']);
check('the tags a tower carries itself', [...net.towerTags('T2')].sort(), ['energia-mech', 'kinematyka']);
check('no cuts without circles', net.cut, []);
check('a world without tag fields: the empty network', M.tagNetwork([{ id: 'a', label: 'a', tags: [] }], [{ id: 'a', tags: [] }]).tags.size, 0);

/* -- 2. Kreise: geschnitten, gemeldet -------------------------------------------------------------------------------------------------- */
const loop = M.tagNetwork([
  { id: 'A', label: 'A', tags: ['B'] }, { id: 'B', label: 'B', tags: ['C'] }, { id: 'C', label: 'C', tags: ['A'] },
  { id: 'S', label: 'S', tags: ['S', 'A'] }, { id: 'X', label: 'X', tags: ['S'] }
], [{ id: 'T', tags: ['C'] }]);
check('a circle A → B → C → A is cut at one edge', loop.cut.filter(([a, b]) => a !== b).length, 1);
check('after the cut every tag has a finite level', [...loop.tags.values()].every((t) => Number.isFinite(t.level) && t.level >= 0), true);
check('a tag above itself is reported too', loop.cut.some(([a, b]) => a === 'S' && b === 'S'), true);
check('the cut network still answers below()', [...loop.below('A')].length >= 0 && loop.roots.length >= 1, true);

/* -- 3. Erreichbar, Zahlen, der Anfangs-Tag ------------------------------------------------------------------------------------------- */
const reach = new Set(['T3']);
const reachable = M.reachableTags(net, (t) => reach.has(t));
check('reachable tags: those with something reachable below (a parent too)', sorted(reachable), ['kinematyka', 'mechanika', 'ruch-jedn']);
const conquered = new Set(['T1']);
check('count: conquered / all towers below', M.tagCount(net, 'mechanika', (t) => conquered.has(t)), { done: 1, total: 3 });
check('count of a leaf tag', M.tagCount(net, 'energia', (t) => conquered.has(t)), { done: 1, total: 3 });
check('start tag of a large world: the reachable root where most is going on', M.startTag(net, M.reachableTags(net, () => true), (t) => t === 'T4', () => false), 'energia');
check('… without started towers: the most available ones', M.startTag(net, M.reachableTags(net, () => true), () => false, (t) => t === 'T3' || t === 'T2'), 'mechanika');
check('… nothing reachable: none', M.startTag(net, new Set(), () => false, () => false), null);
check('the list for MCP: name, parents, level, towers, towers below', M.tagList(net).find((r) => r.id === 'energia-mech'), { id: 'energia-mech', name: 'Energia mechaniczna', parents: ['mechanika', 'energia'], level: 1, towers: 2, towersBelow: 2 });

/* -- 4. Auf der Weltkarte: Tags von Einträgen, von Blöcken, der gültige Weg ----------------------------------------------------------- */
const ref = (field, to, extra = {}) => ({ field, to, ...extra });
const wEntries = [
  { id: 'tg/a', kinds: ['tag'], label: 'Alfa', refs: [] },
  { id: 'tg/b', kinds: ['tag'], label: 'Beta', refs: [] },
  { id: 'tg/ab', kinds: ['tag'], label: 'Alfa-Beta', refs: [ref('nad', 'tg/a', { tag: 'up' }), ref('nad', 'tg/b', { tag: 'up' })] },
  { id: 'blok', kinds: ['blok'], label: 'Blok', refs: [ref('tagi', 'tg/b', { tag: 'up' })] },
  { id: 'P1', kinds: ['temat'], label: 'Jeden', refs: [ref('tagi', 'tg/a', { tag: 'up' })] },
  { id: 'P2', kinds: ['temat'], label: 'Dwa', refs: [ref('wymaga', 'P1', { prerequisite: 'up' }), ref('tagi', 'tg/ab', { tag: 'up' })] },
  { id: 'P3', kinds: ['temat'], label: 'Trzy', refs: [ref('wymaga', 'P2', { prerequisite: 'up' }), ref('czesc', 'blok', { part: 'up' })] },
  { id: 'P4', kinds: ['temat'], label: 'Cztery', refs: [ref('wymaga', 'P1', { prerequisite: 'up' })] }
];
const wCards = [];
for (const p of ['P1', 'P2', 'P3', 'P4']) for (let i = 0; i < 3; i += 1) { const k = `q/${p}/${i}`; wEntries.push({ id: k, kinds: ['question'], label: k, refs: [ref('about', p)] }); wCards.push({ key: k, question: k, about: [p] }); }
const world = M.readWorld({ entries: wEntries, cards: wCards, flows: [], placeKinds: ['temat'] });
const wnet = M.worldTags(world);
check('tag entries are not towers', sorted(world.places.keys()), ['P1', 'P2', 'P3', 'P4']);
check('a tower carries the tags of its block ("part": "up")', [...wnet.towerTags('P3')], ['tg/b']);
check('on the map: below(Alfa) through Alfa-Beta', sorted(wnet.below('tg/a')), ['P1', 'P2']);
check('on the map: below(Beta) = Alfa-Beta + the block', sorted(wnet.below('tg/b')), ['P2', 'P3']);
check('the network is computed once per world', M.worldTags(world) === wnet, true);
check('a kept path stays valid only down the network', [M.validSlice(wnet, ['tg/a', 'tg/ab']), M.validSlice(wnet, ['tg/ab', 'tg/a']), M.validSlice(wnet, ['nie-ma'])], [['tg/a', 'tg/ab'], ['tg/ab'], []]);
check('placement limited to a tag: the towers below it', sorted(M.scopeTowers(world, M.linesOf(world, []), { scope: ['tg/b'], downTo: null })), ['P2', 'P3']);

/* -- 5. Der Ausschnitt der Karte: nur seine Türme, die Wege zwischen ihnen, der Boden der ganzen Welt ---------------------------------- */
const big = M.generatedWorld({ places: 120, stories: 14, seed: 5, cards: [3, 5] });
/* Tags: drei Wurzeln (Drittel der Orte), je zwei Untertags (gerade/ungerade). */
const tagEntries = [];
for (let r = 0; r < 3; r += 1) {
  tagEntries.push({ id: `t${r}`, kinds: ['tag'], label: `Obszar ${r}`, refs: [] });
  for (const half of ['a', 'b']) tagEntries.push({ id: `t${r}${half}`, kinds: ['tag'], label: `Obszar ${r}${half}`, refs: [ref('nad', `t${r}`, { tag: 'up' })] });
}
const bigInput = {
  ...big, placeKinds: ['topic'],
  entries: [...big.entries.map((e) => (/^p\d+$/.test(e.id) ? { ...e, refs: [...e.refs, ref('tagi', `t${Math.min(2, Math.floor(Number(e.id.slice(1)) / 40))}${Number(e.id.slice(1)) % 2 === 0 ? 'a' : 'b'}`, { tag: 'up' })] } : e)), ...tagEntries]
};
const bw = M.readWorld(bigInput);
const bl = M.linesOf(bw, bigInput.flows);
const bs = M.stateOf(bw, bl, M.fakeLearner({}));
const g = M.geometryOf(M.geometryInputOf(bw, bl));
const opts = { placeColour: () => ({ r: 1, g: 1, b: 1 }), lineColour: new Map(), fallback: { r: 0, g: 0, b: 0 } };
const whole = M.sceneOf(bw, bl, bs, g, opts);
const bnet = M.worldTags(bw);
const only = bnet.below('t1');
const part = M.sceneOf(bw, bl, bs, g, { ...opts, only });
check('the whole world: every tower, not sliced', [whole.places.length, whole.sliced], [bw.places.size, false]);
check('a slice: only the towers below the tag are built', [part.places.length, part.sliced, part.places.every((p) => only.has(p.id))], [only.size, true, true]);
const nodeOk = (id) => id === '~home' || only.has(id) || id.startsWith('j') || bl.junctions.has(id);
check('a slice: every way drawn joins kept nodes (towers of the slice, home, junctions)', part.lanes.every((l) => nodeOk(l.fromId) && nodeOk(l.toId)), true);
check('a slice: fewer ways than the whole world, but some', part.lanes.length > 0 && part.lanes.length < whole.lanes.length, true);
check('a slice: the ground (island, trees) is still that of the whole world', part.ground === whole.ground && part.ground.places.length === bw.places.size, true);
check('a slice: the requirement links only between kept towers', part.links.every((l) => nodeOk(l.from) && nodeOk(l.to)), true);
check('a subtag narrows the slice further', bnet.below('t1a').size < only.size && [...bnet.below('t1a')].every((x) => only.has(x)), true);

/* -- 6. Das Schema und der Import: "tag": "up", Kreise gemeldet; die Liste für MCP ------------------------------------------------- */
const kind = M.readKind('k', { name: 'Temat', label: '{name}', fields: [{ key: 'tagi', label: 'Tagi', type: 'ref', multi: true, tag: 'up' }, { key: 'zle', label: 'x', type: 'line', tag: 'up' }, { key: 'dol', label: 'y', type: 'ref', tag: 'down' }] });
check('schema: "tag": "up" on a reference field is kept; elsewhere or "down" dropped', kind.fields.map((f) => f.tag ?? null), ['up', null, null]);
const course = {
  format: 'recreatio.cogita.course', version: 1, name: 'Tagi',
  kinds: [
    { ref: '@k/tag', name: 'Tag', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }, { key: 'nad', label: 'Należy do', type: 'ref', multi: true, tag: 'up' }] },
    { ref: '@k/temat', name: 'Temat', label: '{name}', fields: [{ key: 'name', label: 'Nazwa', type: 'line' }, { key: 'tagi', label: 'Tagi', type: 'ref', multi: true, tag: 'up' }] }
  ],
  entities: [
    { ref: '@tag/mech', kinds: ['@k/tag'], data: { name: 'Mechanika' } },
    { ref: '@tag/en', kinds: ['@k/tag'], data: { name: 'Energia' } },
    { ref: '@tag/em', kinds: ['@k/tag'], data: { name: 'Energia mechaniczna', nad: ['@tag/mech', '@tag/en'] } },
    { ref: '@t/hustawka', kinds: ['@k/temat'], data: { name: 'Huśtawka', tagi: ['@tag/em'] } },
    { ref: '@t/bateria', kinds: ['@k/temat'], data: { name: 'Bateria', tagi: ['@tag/en'] } },
    { ref: '@q/1', kinds: ['question'], data: { form: 'one', prompt: 'Dlaczego huśtawka?', options: ['a', 'b'], correct: [0], about: ['@t/hustawka'] } },
    { ref: '@q/2', kinds: ['question'], data: { form: 'one', prompt: 'Co w baterii?', options: ['a', 'b'], correct: [0], about: ['@t/bateria'] } }
  ],
  views: [{ ref: '@v/mapa', name: 'Mapa', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@k/temat' } }], landscape: { style: 'world' } }]
};
const made = await M.memoryBase(course);
if ('error' in made) throw new Error(made.error);
const rows = M.tagsForAi(made.lib, (await made.lib.cards()).cards);
check('MCP tag list: lasting names, parents, levels, towers below', rows.map((r) => [r.ref, r.parents, r.level, r.towers, r.towersBelow]),
  [['@tag/en', [], 0, 1, 2], ['@tag/mech', [], 0, 0, 1], ['@tag/em', ['@tag/mech', '@tag/en'], 1, 1, 1]]);
const circle = M.planImport(made.writer, { format: 'recreatio.cogita.entities', version: 1, entities: [{ ref: '@tag/mech', kinds: ['@k/tag'], data: { name: 'Mechanika', nad: ['@tag/em'] } }] });
check('import: a circle in the tag network is reported', 'error' in circle ? circle.error : circle.warnings.some((w) => /tag/i.test(w) && w.includes('Mechanika')), true);
const fine = M.planImport(made.writer, course);
check('import: a clean network has no tag warning', 'error' in fine ? fine.error : fine.warnings.filter((w) => /koło w sieci tagów/.test(w)), []);
check('SLICE_FROM: large worlds open on a tag', M.SLICE_FROM > 100, true);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
