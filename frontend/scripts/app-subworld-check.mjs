/**
 * 2026-11-24 — DIE TEILWELT EINER KLASSE (`src/app/cogita/classes/subWorld.ts`, `landscape.only` in `views.ts`), ohne Browser:
 *   1. die Türme: Tags mit Untertags (DAG), einzelne Türme, `withBase` mit allen Voraussetzungen, ohne nur die gewählten;
 *   2. der beschnittene Eingang: nur diese Türme im Modell; ein Ablauf, der einen Turm ausserhalb erreicht, fällt weg;
 *   3. `only` im Widok: gelesen, über Export (`@name`) und Import (Kennungen) unverändert;
 *   4. Klasse ↔ Widok: setClassView legt „<Klasse> — świat" mit `forClass` an, classViewOf findet ihn, „Cały świat" nimmt ihn weg;
 *      die Weltkarte der Baza bleibt die Weltkarte (Klassen-Widoki zählen nicht).
 *
 *   node scripts/app-subworld-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const workspace = await mkdtemp(join(tmpdir(), 'app-subworld-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export { memoryBase } from '${app}cogita/memoryBase';
export { subWorldPlaces, restrictWorldInput, classViewOf, classOnly, setClassView, baseWorldViewOf } from '${app}cogita/classes/subWorld';
export { readView, isClassView } from '${app}cogita/views';
export { exportCourse } from '${app}cogita/json';
export { readWorld } from '${app}cogita/worldmap/wmGraph';
export { worldInputOf, placeKindsOf } from '${app}cogita/worldmap/wmInput';
export { linesOf } from '${app}cogita/worldmap/wmLines';
export { worldTags } from '${app}cogita/worldmap/wmTags';
`);
await build({
  entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', jsx: 'automatic',
  plugins: [{ name: 'no-css', setup(b) { b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'no-css' })); b.onLoad({ filter: /.*/, namespace: 'no-css' }, () => ({ contents: '', loader: 'js' })); } }],
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let passed = 0;
let failed = 0;
const check = async (name, fn) => { try { await fn(); passed += 1; console.log(`ok   ${name}`); } catch (e) { failed += 1; console.log(`FAIL ${name}: ${e.message}`); } };

/*
  Eine kleine Welt: Tags „Homer" ⊃ „Iliada", „Odyseja"; Türme a → b → c (Iliada), d (Odyseja, verlangt a), e (ohne Tag, verlangt c).
  Ein Ablauf führt zu b, einer zu d. Der Widok der Weltkarte zeigt die Teilwelt „Iliada".
*/
const T = (ref, nazwa, extra = {}) => ({ ref, kinds: ['@sw/temat'], data: { nazwa, ...extra } });
const course = {
  format: 'recreatio.cogita.course', version: 1, name: 'Teilwelt',
  kinds: [
    { ref: '@sw/tag', name: 'Tag', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'nad', label: 'Nad', type: 'ref', to: ['@sw/tag'], multi: true, tag: 'up' }] },
    { ref: '@sw/temat', name: 'Temat', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'wymaga', label: 'Wymaga', type: 'ref', to: ['@sw/temat'], multi: true, prerequisite: 'up' }, { key: 'tagi', label: 'Tagi', type: 'ref', to: ['@sw/tag'], multi: true, tag: 'up' }] }
  ],
  entities: [
    { ref: '@sw/tag/homer', kinds: ['@sw/tag'], data: { nazwa: 'Homer' } },
    { ref: '@sw/tag/iliada', kinds: ['@sw/tag'], data: { nazwa: 'Iliada', nad: ['@sw/tag/homer'] } },
    { ref: '@sw/tag/odyseja', kinds: ['@sw/tag'], data: { nazwa: 'Odyseja', nad: ['@sw/tag/homer'] } },
    T('@sw/a', 'A', { tagi: ['@sw/tag/iliada'] }),
    T('@sw/b', 'B', { wymaga: ['@sw/a'], tagi: ['@sw/tag/iliada'] }),
    T('@sw/c', 'C', { wymaga: ['@sw/b'], tagi: ['@sw/tag/iliada'] }),
    T('@sw/d', 'D', { wymaga: ['@sw/a'], tagi: ['@sw/tag/odyseja'] }),
    T('@sw/e', 'E', { wymaga: ['@sw/c'] }),
    ...['a', 'b', 'c', 'd', 'e'].map((x) => ({ ref: `@sw/q/${x}`, kinds: ['question'], data: { form: 'one', prompt: `${x}?`, options: ['T', 'N'], correct: [0], about: [`@sw/${x}`] } }))
  ],
  flows: ['b', 'd'].map((x) => ({
    ref: `@sw/f/${x}`, name: `Do ${x}`, look: 'reading', start: 's',
    graph: { nodes: [{ id: 's', type: 'question', config: { of: `@sw/q/${x}` } }, { id: 'k', type: 'end', config: {} }], edges: [{ id: 'e1', from: 's', out: 'right', to: 'k', in: 'in' }, { id: 'e2', from: 's', out: 'wrong', to: 'k', in: 'in' }] }
  })),
  views: [
    { ref: '@sw/mapa', name: 'Mapa', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@sw/temat' } }], landscape: { style: 'world' } },
    { ref: '@sw/iliada', name: 'Iliada', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@sw/temat' } }], landscape: { style: 'world', only: { tags: ['@sw/tag/iliada'], places: [], withBase: true } } }
  ]
};

try {
  const made = await m.memoryBase(course, { libraryId: 'sw-lib', areaId: 'sw-area' });
  assert.ok(!('error' in made), made.error);
  const lib = made.writer;
  const id = (ref) => lib.byImportRef(ref, 'entity').id;
  const label = (ids) => [...ids].map((x) => lib.label(lib.entity(x))).sort();
  const { cards } = await lib.cards();
  const mapView = lib.docs('view').find((d) => d.data.name === 'Mapa');
  const placeKinds = m.placeKindsOf(m.readView(mapView.data));
  const input = m.worldInputOf(lib, cards, { placeKinds });
  const world = m.readWorld(input);
  const net = m.worldTags(world);
  const only = (o) => ({ tags: [], places: [], withBase: true, ...o });

  await check('1. no "only": the whole world (null)', () => assert.equal(m.subWorldPlaces(world, net, null), null));
  await check('1. a tag gives its towers (Iliada: A, B, C); the parent tag also its subtags (Homer: A–D)', () => {
    assert.deepEqual(label(m.subWorldPlaces(world, net, only({ tags: [id('sw/tag/iliada')] }))), ['A', 'B', 'C']);
    assert.deepEqual(label(m.subWorldPlaces(world, net, only({ tags: [id('sw/tag/homer')] }))), ['A', 'B', 'C', 'D']);
  });
  await check('1. withBase adds every prerequisite (E → C, B, A); without it only the chosen tower', () => {
    assert.deepEqual(label(m.subWorldPlaces(world, net, only({ places: [id('sw/e')] }))), ['A', 'B', 'C', 'E']);
    assert.deepEqual(label(m.subWorldPlaces(world, net, only({ places: [id('sw/e')], withBase: false }))), ['E']);
    assert.deepEqual(label(m.subWorldPlaces(world, net, only({ places: [id('sw/d')], tags: ['nie-ma'] }))), ['A', 'D']);
  });
  await check('2. the cut input: only the chosen towers in the model; the flow to D (outside) is gone, the flow to B stays', () => {
    const allowed = m.subWorldPlaces(world, net, only({ tags: [id('sw/tag/iliada')] }));
    const L = m.linesOf(world, input.flows);
    const cut = m.restrictWorldInput(input, world, L, allowed);
    const w2 = m.readWorld(cut);
    assert.deepEqual(label(w2.places.keys()), ['A', 'B', 'C']);
    assert.deepEqual(cut.flows.map((f) => f.name).sort(), ['Do b']);
    assert.ok(!cut.cards.some((c) => c.about.includes(id('sw/d'))), 'the cards of D are gone');
  });

  const iliada = lib.docs('view').find((d) => d.data.name === 'Iliada');
  await check('3. the view reads "only" (ids after the import)', () => {
    assert.deepEqual(m.readView(iliada.data).landscape.only, { tags: [id('sw/tag/iliada')], places: [], withBase: true });
    assert.equal(m.readView(mapView.data).landscape.only, undefined);
  });
  await check('3. export writes "only" with @names; a second import gives the same ids', async () => {
    const out = m.exportCourse(lib, 'Teilwelt');
    const v = out.views.find((x) => x.name === 'Iliada');
    assert.deepEqual(v.landscape.only.tags, ['@sw/tag/iliada']);
    const again = await m.memoryBase(out, { libraryId: 'sw-lib2', areaId: 'sw-area2' });
    assert.ok(!('error' in again), again.error);
    const v2 = again.writer.docs('view').find((d) => d.data.name === 'Iliada');
    assert.deepEqual(m.readView(v2.data).landscape.only.tags, [again.writer.byImportRef('sw/tag/iliada', 'entity').id]);
  });

  await check('4. a class without its own part sees the world view of the base; the base world view is never a class view', () => {
    assert.equal(m.classViewOf(lib, 'klasa-1'), mapView.id);
    assert.equal(m.baseWorldViewOf(lib), mapView.id);
    assert.equal(m.classOnly(lib, 'klasa-1'), null);
  });
  let classView = null;
  await check('4. setClassView: a view "<class> — świat" with forClass and only; classViewOf finds it; the base keeps its world view', async () => {
    classView = await m.setClassView(lib, { areaId: 'KLASA-1', name: '1a' }, only({ tags: [id('sw/tag/odyseja')] }), '1a — świat');
    const doc = lib.docs('view').find((d) => d.id === classView);
    assert.equal(doc.data.forClass, 'klasa-1');
    assert.equal(doc.data.name, '1a — świat');
    assert.ok(m.isClassView(doc.data));
    assert.equal(m.classViewOf(lib, { areaId: 'klasa-1' }), classView);
    assert.deepEqual(m.classOnly(lib, 'klasa-1').tags, [id('sw/tag/odyseja')]);
    assert.equal(m.baseWorldViewOf(lib), mapView.id);
    assert.equal(m.classViewOf(lib, 'klasa-2'), mapView.id, 'another class still sees the base world');
  });
  await check('4. saving again replaces the same view; "Cały świat" removes it', async () => {
    const again = await m.setClassView(lib, { areaId: 'klasa-1', name: '1a' }, only({ places: [id('sw/c')] }), '1a — świat');
    assert.equal(again, classView);
    assert.equal(lib.docs('view').filter((d) => d.data.forClass === 'klasa-1').length, 1);
    await m.setClassView(lib, { areaId: 'klasa-1', name: '1a' }, null, '1a — świat');
    assert.equal(lib.docs('view').filter((d) => d.data.forClass === 'klasa-1').length, 0);
    assert.equal(m.classViewOf(lib, 'klasa-1'), mapView.id);
  });
} finally {
  await rm(workspace, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
