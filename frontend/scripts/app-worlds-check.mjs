/**
 * 2026-11-05 (Prompt 24) — VERWEISE ZWISCHEN BAZY WIEDZY („Inne światy", `cogita/worlds.ts`, `cogita/worldsImport.ts`):
 *
 *   1. Die Form "@@name:@bleibender/name" (oder "@@name:kennung"): lesen, schreiben, in Daten und im Zapis finden, ersetzen.
 *   2. Namen von Bazy: aus dem Titel, in den Ustawienia ("handle", "worlds"), ohne Doppel; Felder "external" ohne Voraussetzung.
 *   3. Der Zapis: [[Wort|@@historia:@a/b]] ist EIN Verweis mit dem ganzen Zeichen.
 *   4. Ein Abstecher in eine andere Baza: immer freiwillig, nie „gibt es nicht", nie ein Kreis.
 *   5. Import: nimmt "@@…" überall an (nichts blockiert), Hinweis bei einem Feld ohne "external"; Export: dieselbe Form.
 *   6. Prüfung gegen die andere Baza: gefunden, fehlt, unbekannter Name (gesucht und ergänzt), nicht lesbar, kein Ablauf.
 *   7. Löschen: was andere Bazy darauf zeigen lassen.
 *
 *   node scripts/app-worlds-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-worlds-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { crossOf, crossText, crossRefsIn, mapCross, handleFrom, withWorld, resolveCross, refOfTarget, summaryOf, worldOf } from '${app}cogita/worlds';
export { crossUses, crossImportWarnings, crossCheck, withWorlds, incomingIn, incomingText, settingsAfter } from '${app}cogita/worldsImport';
export { readSettings } from '${app}cogita/store';
export { readField } from '${app}cogita/schema';
export { kindDoc } from '${app}cogita/kinds';
export { parseInline } from '${app}library/libraryMarkup';
export { detourOf, detourProblems } from '${app}cogita/detour';
export { readFlow } from '${app}cogita/flow';
export { memoryBase } from '${app}cogita/memoryBase';
export { planImport, importProblems, exportCourse, exportSetup } from '${app}cogita/json';
`);
await build({
  entryPoints: { entry }, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error',
  loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const W = await import(pathToFileURL(join(workspace, 'entry.js')).href);
await rm(workspace, { recursive: true, force: true });

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { passed += 1; return; }
  failed += 1;
  console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
};

/* -- 1. Die Form -------------------------------------------------------------------------------------------------- */
check('1 crossOf named', W.crossOf('@@historia:@historia/rewolucja-1688'), { handle: 'historia', ref: '@historia/rewolucja-1688' });
check('1 crossOf id and case', W.crossOf(' @@Historia:abc123 '), { handle: 'historia', ref: 'abc123' });
check('1 not cross', ['@historia/x', '@@:x', '@@hist oria:x', '@@historia:', 'tekst', 42, null].map((v) => W.crossOf(v)), [null, null, null, null, null, null, null]);
check('1 crossText', W.crossText({ handle: 'historia', ref: '@historia/a' }), '@@historia:@historia/a');
const data = {
  nazwa: 'Prawa Newtona',
  inne: ['@@historia:@historia/rewolucja-1688', { value: '@@historia:@historia/newton', locator: 's. 3' }],
  tekst: 'Zob. [[Rewolucja 1688|@@historia:@historia/rewolucja-1688]] i [[Royal Society|@@nauka:@nauka/rs]].',
  blocks: [{ type: 'p', text: 'x [[Newton|@@historia:@historia/newton]]' }],
  _ref: '@@historia:@ukryte'
};
check('1 crossRefsIn: fields, nested, markup labels, once each, _keys skipped', W.crossRefsIn(data), [
  { handle: 'historia', ref: '@historia/rewolucja-1688', field: 'inne' },
  { handle: 'historia', ref: '@historia/newton', field: 'inne' },
  { handle: 'nauka', ref: '@nauka/rs', label: 'Royal Society', field: 'tekst' }
]);
check('1 mapCross whole value', W.mapCross('@@historia:@a/b', (c) => ({ ...c, handle: 'dzieje' })), '@@dzieje:@a/b');
check('1 mapCross in markup, others kept', W.mapCross('A [[x|@@historia:@a/b]] B [[y|@lokalny/z]]', (c) => ({ ...c, handle: 'dzieje' })), 'A [[x|@@dzieje:@a/b]] B [[y|@lokalny/z]]');

/* -- 2. Namen -------------------------------------------------------------------------------------------------------- */
check('2 handleFrom Polish', W.handleFrom('Historia Anglii — Łódź, żółć'), 'historia-anglii-lodz-zolc');
check('2 handleFrom German', W.handleFrom('Größen & Maße'), 'grossen-masse');
check('2 handleFrom empty', W.handleFrom('!!!'), 'baza');
const list = [{ id: 'B', handle: 'historia', name: 'Historia' }];
check('2 withWorld same id and name: no change', W.withWorld(list, { id: 'B', handle: 'historia', name: 'Historia' }), null);
check('2 withWorld renamed', W.withWorld(list, { id: 'B', handle: 'x', name: 'Dzieje' }), [{ id: 'B', handle: 'historia', name: 'Dzieje' }]);
check('2 withWorld handle clash gets a suffix', W.withWorld(list, { id: 'C', handle: 'historia', name: 'Historia 2' }).map((w) => w.handle), ['historia', 'historia-2']);
const st = W.readSettings({ handle: ' @Fizyka ', worlds: [{ id: 'B', handle: 'Historia', name: 'Historia' }, { id: 'C', handle: 'historia' }, { id: '', handle: 'x' }, { id: 'D', handle: 'zła nazwa' }] });
check('2 readSettings handle and worlds (lower case, no doubles, no bad ones)', [st.handle, st.worlds], ['fizyka', [{ id: 'B', handle: 'historia', name: 'Historia' }]]);
check('2 readSettings without', [W.readSettings({}).handle, W.readSettings({}).worlds], [undefined, []]);
const f = W.readField({ key: 'inne', label: 'W innych światach', type: 'ref', multi: true, external: true, prerequisite: 'up', structure: 'up' });
check('2 external ref field: never a prerequisite or structure', [f.external, f.prerequisite, f.structure], [true, undefined, undefined]);
check('2 external only on ref', W.readField({ key: 'a', label: 'A', type: 'line', external: true }).external, undefined);
check('2 kindDoc keeps external', W.kindDoc({ id: 'k', name: 'K', label: '{a}', fields: [f] }).fields[0].external, true);

/* -- 3. Zapis -------------------------------------------------------------------------------------------------------- */
const inl = W.parseInline('Zob. [[Rewolucja|@@historia:@historia/rewolucja-1688]] teraz');
check('3 parseInline: one ref with the whole token', inl.filter((i) => i.t === 'ref').map((i) => [i.key, i.c.map((x) => x.v ?? '').join('')]), [['@@historia:@historia/rewolucja-1688', 'Rewolucja']]);
check('3 parseInline: own refs unchanged', W.parseInline('[[a|@x.y]]').filter((i) => i.t === 'ref').map((i) => i.key), ['x.y']);

/* -- 4. Abstecher ---------------------------------------------------------------------------------------------------- */
const d1 = W.detourOf({ type: 'detour', config: { flow: '@@historia:@historia/f/rewolucja', optional: false } });
check('4 cross detour: always optional', [d1.optional, d1.cross], [true, true]);
check('4 own detour unchanged', W.detourOf({ type: 'detour', config: { flow: '@x/f', optional: false } }), { flow: '@x/f', label: '', optional: false });
const N = (id, type, config = {}) => ({ id, type, x: 0, y: 0, config });
let edgeNo = 0;
const E = (from, out, to) => ({ id: `e${(edgeNo += 1)}`, from, out, to, in: 'in' });
const flowA = W.readFlow('fa', { name: 'Prawa Newtona', start: 'z1', graph: { nodes: [N('z1', 'detour', { flow: '@@historia:@historia/f/rewolucja', optional: false }), N('end', 'end')], edges: [E('z1', 'done', 'end')] } });
const dp = W.detourProblems(flowA, [flowA], () => null);
check('4 detourProblems: no "missing story", no error; a note on optional:false', [dp.map((p) => p.level), dp.some((p) => p.text.includes('zawsze nieobowiązkowe'))], [['warning'], true]);

/* -- 5. Import / Export ----------------------------------------------------------------------------------------------- */
const HIST = {
  format: 'recreatio.cogita.course', version: 1, name: 'Historia',
  settings: { handle: 'historia' },
  kinds: [{ ref: '@historia/wydarzenie', name: 'Wydarzenie', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'streszczenie', label: 'Streszczenie', type: 'text' }] }],
  entities: [
    { ref: '@historia/rewolucja-1688', kinds: ['@historia/wydarzenie'], data: { nazwa: 'Chwalebna rewolucja', streszczenie: 'W 1688 roku Wilhelm Orański przejął tron Anglii. Dalej…' } },
    { ref: '@historia/newton', kinds: ['@historia/wydarzenie'], data: { nazwa: 'Newton w parlamencie' } }
  ],
  flows: [{ ref: '@historia/f/rewolucja', name: 'Chwalebna rewolucja', unit: '@historia/rewolucja-1688', start: 's1', graph: { nodes: [N('s1', 'show', { of: '@historia/rewolucja-1688' }), N('end', 'end')], edges: [E('s1', 'next', 'end')] } }]
};
const PHYS = {
  format: 'recreatio.cogita.course', version: 1, name: 'Fizyka',
  settings: { handle: 'fizyka', worlds: [{ id: 'baza-historia', handle: 'historia', name: 'Historia' }] },
  kinds: [{ ref: '@fizyka/temat', name: 'Temat', label: '{nazwa}', fields: [
    { key: 'nazwa', label: 'Nazwa', type: 'line' },
    { key: 'tekst', label: 'Tekst', type: 'text' },
    { key: 'swiaty', label: 'W innych światach', type: 'ref', multi: true, external: true },
    { key: 'wymaga', label: 'Najpierw', type: 'ref', multi: true, prerequisite: 'up' }
  ] }],
  entities: [{ ref: '@fizyka/newton', kinds: ['@fizyka/temat'], data: {
    nazwa: 'Prawa Newtona', tekst: 'Newton żył w czasach [[rewolucji 1688|@@historia:@historia/rewolucja-1688]].',
    swiaty: ['@@historia:@historia/rewolucja-1688', '@@historia:@historia/f/rewolucja'],
    wymaga: ['@@historia:@historia/newton']
  } }],
  flows: [{ ref: '@fizyka/f/newton', name: 'Prawa Newtona', unit: '@fizyka/newton', start: 's1', graph: { nodes: [
    N('s1', 'show', { of: '@fizyka/newton' }),
    N('z1', 'detour', { flow: '@@historia:@historia/f/rewolucja', label: 'Zagłębienie w innym świecie: Historia' }),
    N('end', 'end')
  ], edges: [E('s1', 'next', 'z1'), E('z1', 'done', 'end'), E('z1', 'skip', 'end')] } }]
};
const H = await W.memoryBase(HIST, { libraryId: 'baza-historia', areaId: 'obszar-h' });
const P = await W.memoryBase(PHYS, { libraryId: 'baza-fizyka', areaId: 'obszar-f' });
check('5 both bases import (nothing blocks @@)', ['error' in H ? H.error : 'ok', 'error' in P ? P.error : 'ok'], ['ok', 'ok']);
const pl = P.lib;
const newton = pl.byImportRef('fizyka/newton', 'entity');
check('5 cross values stored as written', [newton.data.swiaty, newton.data.wymaga], [['@@historia:@historia/rewolucja-1688', '@@historia:@historia/f/rewolucja'], ['@@historia:@historia/newton']]);
check('5 warning: @@ in a field without "external"', P.warnings.filter((w) => w.includes('"external": true')).map((w) => w.split(' „@@')[0]), ['Wpis „Prawa Newtona”, pole „Najpierw”: odwołanie do innego świata']);
check('5 no "prowadzi donikąd" for @@', P.warnings.filter((w) => w.includes('@@') && w.includes('donikąd')), []);
check('5 a cross value is never a prerequisite', pl.prerequisites().needs.get(newton.id) ?? [], []);
check('5 settings handle and worlds after import', [pl.settings().handle, pl.settings().worlds], ['fizyka', [{ id: 'baza-historia', handle: 'historia', name: 'Historia' }]]);
const ex = W.exportCourse(pl, 'Fizyka');
const exN = ex.entities.find((e) => e.ref === '@fizyka/newton');
check('5 export keeps @@ in ref fields and markup', [exN.data.swiaty, exN.data.wymaga, exN.data.tekst.includes('[[rewolucji 1688|@@historia:@historia/rewolucja-1688]]')], [['@@historia:@historia/rewolucja-1688', '@@historia:@historia/f/rewolucja'], ['@@historia:@historia/newton'], true]);
check('5 export keeps the cross detour', ex.flows[0].graph.nodes.find((n) => n.id === 'z1').config.flow, '@@historia:@historia/f/rewolucja');
check('5 export field external', ex.kinds[0].fields.find((x) => x.key === 'swiaty').external, true);
const setup = await W.exportSetup(pl, 'Fizyka');
check('5 setup (MCP) settings carry handle and worlds', [setup.course.settings[0].handle, setup.course.settings[0].worlds], ['fizyka', [{ id: 'baza-historia', handle: 'historia', name: 'Historia' }]]);
const again = W.planImport(P.writer, ex);
check('5 re-import of the export: no block', W.importProblems(P.writer, again).blocked, []);

/* -- 6. Prüfung gegen die andere Baza --------------------------------------------------------------------------------- */
check('6 resolveCross entry (summary = first sentence)', W.resolveCross(H.lib, '@historia/rewolucja-1688'), { kind: 'entry', id: H.lib.byImportRef('historia/rewolucja-1688', 'entity').id, title: 'Chwalebna rewolucja', summary: 'W 1688 roku Wilhelm Orański przejął tron Anglii.' });
check('6 resolveCross flow with its unit', (({ kind, title, summary }) => [kind, title, summary])(W.resolveCross(H.lib, '@historia/f/rewolucja')), ['flow', 'Chwalebna rewolucja', 'W 1688 roku Wilhelm Orański przejął tron Anglii.']);
check('6 resolveCross missing', W.resolveCross(H.lib, '@historia/nie-ma'), null);
check('6 refOfTarget: lasting name', W.refOfTarget(H.lib, H.lib.byImportRef('historia/newton', 'entity').id), '@historia/newton');
const uses = W.crossUses(pl, { kinds: [], entities: pl.entities().map((e) => ({ id: e.id, kinds: e.kinds, data: e.data })), docs: pl.docs('flow').map((d) => ({ id: d.id, kind: 'flow', data: d.data })) });
check('6 crossUses: fields, markup, detour', uses.map((u) => [u.ref.ref, u.external ?? null, u.detour ?? null]), [
  ['@historia/rewolucja-1688', null, null], ['@historia/rewolucja-1688', true, null], ['@historia/f/rewolucja', true, null], ['@historia/newton', false, null], ['@historia/f/rewolucja', null, true]
]);
const opener = (map, handles = {}) => ({ open: async (id) => map[id] ?? null, find: async (h) => (handles[h] === undefined ? null : { world: { id: handles[h], handle: h, name: 'Historia' }, lib: map[handles[h]] }) });
const known = { own: 'fizyka', worlds: pl.settings().worlds };
const ok = await W.crossCheck(uses, known, opener({ 'baza-historia': H.lib }));
check('6 all found: no warning', [ok.warnings, ok.add, ok.checked], [[], [], 5]);
const miss = await W.crossCheck([{ ref: { handle: 'historia', ref: '@historia/nie-ma' }, where: 'Wpis „X”, pole „Y”' }, { ref: { handle: 'historia', ref: '@historia/newton' }, where: 'Przebieg „P”, zagłębienie „z”', detour: true }], known, opener({ 'baza-historia': H.lib }));
check('6 missing target and a detour to a non-story', miss.warnings.map((w) => w.split(' — ')[0]), ['Wpis „X”, pole „Y”: „@@historia:@historia/nie-ma”', 'Przebieg „P”, zagłębienie „z”: „@@historia:@historia/newton” w świecie „Historia” to nie opowieść']);
const unread = await W.crossCheck(uses, known, opener({}));
check('6 unreadable world: one warning, nothing blocks', unread.warnings.map((w) => w.slice(0, 40)), ['Świat „Historia” (@@historia): nie możes']);
const found = await W.crossCheck(uses, { own: 'fizyka', worlds: [] }, opener({ 'baza-historia': H.lib }, { historia: 'baza-historia' }));
check('6 unknown handle found among readable bases: added', [found.add, found.warnings[0].split(' — ')[0]], [[{ id: 'baza-historia', handle: 'historia', name: 'Historia' }], 'Dodano świat „Historia” (@@historia) do Ustawień tej bazy']);
const lost = await W.crossCheck(uses, { own: 'fizyka', worlds: [] }, opener({}));
check('6 unknown handle not found', [lost.add, lost.warnings.length, lost.warnings[0].startsWith('Nieznany świat „@@historia”')], [[], 1, true]);
const self = await W.crossCheck([{ ref: { handle: 'fizyka', ref: '@x' }, where: 'W' }], known, opener({}));
check('6 own handle', self.warnings[0].startsWith('„@@fizyka:…” to ta sama baza'), true);
const planNoSettings = { docs: [] };
const patched = W.withWorlds({ settingsEntry: () => ({ id: 'set1', data: { tags: ['a'] } }) }, planNoSettings, [{ id: 'baza-historia', handle: 'historia', name: 'Historia' }]);
check('6 withWorlds: the settings doc (kept data) in the same save', patched.docs.map((d) => [d.id, d.kind, d.data.tags, d.data.worlds, d.isNew]), [['set1', 'settings', ['a'], [{ id: 'baza-historia', handle: 'historia', name: 'Historia' }], false]]);
const patched2 = W.withWorlds({ settingsEntry: () => undefined }, { docs: [{ id: 's', kind: 'settings', data: { worlds: [{ id: 'baza-historia', handle: 'historia', name: 'Historia' }] }, isNew: true }] }, [{ id: 'baza-historia', handle: 'h', name: 'Historia' }]);
check('6 withWorlds: no double', patched2.docs[0].data.worlds.length, 1);
check('6 settingsAfter prefers the document', W.settingsAfter({ settingsEntry: () => ({ data: { handle: 'stara' } }) }, { docs: [{ kind: 'settings', data: { handle: 'nowa' } }] }).handle, 'nowa');

/* -- 7. Löschen ------------------------------------------------------------------------------------------------------ */
const goneId = H.lib.byImportRef('historia/rewolucja-1688', 'entity').id;
const inc = W.incomingIn(pl, 'Fizyka', H.lib, new Set([goneId]));
check('7 incoming links from another base', inc, [{ base: 'Fizyka', from: 'Prawa Newtona', target: 'Chwalebna rewolucja' }]);
const flowId = H.lib.byImportRef('historia/f/rewolucja', 'flow').id;
check('7 incoming to a story (field + detour)', W.incomingIn(pl, 'Fizyka', H.lib, new Set([flowId])).map((x) => x.from), ['Prawa Newtona', 'Przebieg „Prawa Newtona”']);
check('7 a base that does not know the target: nothing', W.incomingIn(H.lib, 'Historia', pl, new Set([newton.id])), []);
check('7 incomingText', W.incomingText(inc), 'Linki z innych światów: Fizyka — Prawa Newtona → Chwalebna rewolucja — tam staną się zerwane (pokażą się w ich „Do zrobienia”, uczący się ich nie zobaczą).');

console.log(`app-worlds-check: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
