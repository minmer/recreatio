/**
 * 2026-10-27 — DIE VORSCHAU FÜR ASSISTENTEN, nachgemessen (ohne Browser).
 *
 *   1. Aus einem Dokument wird, was `GET /page/<pfad>` nach dem Import liefern
 *      würde: Titel (nur mit Titel auch der Vorspann), Art, Aussehen, Menü,
 *      Bausteine als gespeicherte Zeichenketten; erbetene Dateien bekommen
 *      Kennungen der Vorschau, überall, wo ihr Platzhalter steht.
 *   2. Die Prüfung der Schlüssel schweigt zu allem, was die Beschreibung kennt:
 *      das Beispiel JEDER Art geht ohne ein Wort durch (sonst liefen Prüfung
 *      und Beschreibung auseinander) — und nennt, was der Import nicht nimmt.
 *   3. Bausteine je Grösse, Folge der Slajdy, Weg einer Präsentation, die Wahl
 *      eines Bausteins (M3, modules[2], Kennung, Art).
 *   4. Die Fixtures der Präsentationen tragen keinen unbekannten Schlüssel.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-preview-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}preview/previewDoc';
export { lintDocument } from '${app}preview/previewLint';
export { PARTS, partOf } from '${app}pages/parts/registry';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

/* Wie in app-chat-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1: das Dokument als Seite nach dem Import --------------------------------------- */
  const doc = {
    format: 'recreatio/page',
    version: 1,
    path: 'zz/rekolekcje',
    title: 'Rekolekcje',
    lead: 'Trzy wieczory.',
    mode: 'page',
    theme: { mode: 'light', accent: '#1f6f50' },
    menu: [{ label: 'Start', target: 'zz/rekolekcje' }],
    images: [{ key: 'plakat', label: 'Plakat', description: 'Pionowy plakat' }],
    modules: [
      { id: 'a', kind: 'text', config: { title: 'O nas', body: ['Raz', 'Dwa'] }, layout: { desktop: { position: { row: 1, col: 1 }, size: { colSpan: 4, rowSpan: 3 } } } },
      { kind: 'image', config: { url: 'page-image:@plakat', alt: 'Plakat' } },
      { kind: 'hero', config: { headline: 'Witaj', subtitle: 'nie ma' } },
      { kind: 'slider', config: {} }
    ]
  };
  const pp = m.planPreview({ doc });
  assert.ok(!('error' in pp), 'the document plans');
  assert.equal(pp.path, 'zz/rekolekcje', 'the path comes from the document');
  assert.equal(pp.content.title, 'Rekolekcje');
  assert.equal(pp.content.lead, 'Trzy wieczory.');
  assert.equal(pp.content.mode, 'page');
  assert.equal(pp.content.parts.length, 3, 'the unknown kind is skipped, like the import does');
  assert.ok(pp.warnings.some((w) => w.includes('slider')), 'and the import warning says so');
  assert.equal(pp.content.menu.items.length, 1);
  assert.equal(pp.content.menu.from, 'zz/rekolekcje');
  assert.equal(JSON.parse(pp.content.theme).accent, '#1f6f50');
  const image = pp.content.parts.find((p) => p.kind === 'image');
  assert.equal(JSON.parse(image.config).url, `page-image:${m.previewFileId(0)}`, 'the placeholder became a preview file id');
  assert.equal(pp.files.get('plakat'), m.previewFileId(0));
  assert.equal(pp.needs.length, 1);
  assert.ok(pp.content.parts.every((p) => typeof p.layout === 'string' && typeof p.config === 'string' && p.moduleId === p.id), 'parts are stored strings; a new place makes its module under its own id');
  assert.equal(pp.content.editable, false);
  assert.equal(pp.content.access.restricted, false);
  assert.equal(pp.content.id, m.PREVIEW_PAGE_ID);

  const untitled = m.planPreview({ doc: { modules: [{ kind: 'text', config: { body: 'x' } }], lead: 'bez tytułu' } });
  assert.equal(untitled.content.title, null, 'without a title nothing of the page text is saved');
  assert.equal(untitled.content.lead, null);
  assert.ok(untitled.notes.some((n) => n.includes('tytułu')), 'and the preview says why');
  assert.equal(untitled.path, m.PREVIEW_PATH);

  assert.ok('error' in m.planPreview({ doc: '{ broken' }), 'broken JSON is an error in words');
  assert.ok('error' in m.planPreview({ doc: { nothing: true } }), 'a document that is no page is an error');
  assert.equal(m.planPreview({ doc: JSON.stringify(doc) }).content.parts.length, 3, 'JSON text works like an object');
  assert.equal(m.cleanPath('#/a//b/ '), 'a/b');

  /* Auf eine bestehende Seite: bekannte Kennungen ändern an Ort und Stelle, neue kommen dazu. */
  const base = { ...pp.content, title: 'Alt', parts: pp.content.parts };
  const again = m.planPreview({ doc: { modules: [{ id: pp.content.parts[0].id, kind: 'text', config: { title: 'Neu', body: 'x' } }, { kind: 'notice', config: { body: 'Uwaga' } }] }, base });
  assert.equal(again.content.parts.length, 4, 'three kept (one changed in place) and one added');
  assert.equal(again.content.parts[0].id, pp.content.parts[0].id);
  assert.equal(JSON.parse(again.content.parts[0].config).title, 'Neu');
  assert.equal(again.content.title, 'Alt', 'a document without a title keeps the title of the page');
  ok('a document becomes the page the service would deliver after the import (title rule, parts, look, menu, files, base page)');

  /* -- 2: die Prüfung der Schlüssel ------------------------------------------------------ */
  for (const def of m.PARTS) {
    const said = m.lintDocument({ format: 'recreatio/page', modules: [{ kind: def.kind, config: def.json.example }] });
    assert.deepEqual(said, [], `${def.kind}: its own example passes without a word — ${JSON.stringify(said)}`);
  }
  const lint = m.lintDocument({
    ...doc,
    colour: 'red',
    theme: { mode: 'light', accent: 'green', glow: 1 },
    show: { scenes: [{ key: 'a', change: 'swoosh' }] },
    modules: [
      { kind: 'text', config: { title: 'A', subtitle: 'x' }, layout: { desktop: { position: { row: 1, col: 5 }, size: { colSpan: 5, rowSpan: 2 } }, watch: {} }, slide: { transition: 'warp' } },
      { kind: 'hero', config: { headline: 'H', subtitle: 'x', actions: [{ label: 'L', href: '#a', colour: 'red' }] } },
      { kind: 'form', config: { title: 'F', needs: 'x' }, colour: 'red' }
    ]
  });
  const has = (path, kind) => lint.some((one) => one.path === path && one.kind === kind);
  assert.ok(has('colour', 'unknown'), 'an unknown page key');
  assert.ok(has('theme.glow', 'unknown') && has('theme.accent', 'changed'), 'theme keys and colours');
  assert.ok(has('show.scenes[0].change', 'dropped'), 'an invalid scene change is dropped (the default takes over)');
  assert.ok(has('modules[0].config.subtitle', 'unknown'), 'an unknown key of a flat part');
  assert.ok(has('modules[0].layout.desktop.size.colSpan', 'changed') && has('modules[0].layout.desktop.size.rowSpan', 'changed'), 'sizes that snap');
  assert.ok(has('modules[0].layout.desktop.position.col', 'changed'), 'a column that does not fit');
  assert.ok(has('modules[0].layout.watch', 'unknown'), 'an unknown screen size');
  assert.ok(has('modules[0].slide.transition', 'dropped'), 'an unknown transition');
  assert.ok(has('modules[1].config.subtitle', 'unknown') && has('modules[1].config.actions[0].colour', 'unknown'), 'unknown keys of an event part, also inside lists');
  assert.ok(!lint.some((one) => one.path === 'modules[1].config.subtitle' && one.kind === 'dropped'), 'unknown is not also reported as dropped');
  assert.ok(has('modules[2].config.needs', 'dropped'), 'a key the module keeps for itself');
  assert.ok(has('modules[2].colour', 'unknown'), 'an unknown key of a module entry');
  ok(`key check: every kind's example passes silently (${m.PARTS.length}); unknown, dropped and changed keys are named with their path`);

  /* -- 3: Grössen, Slajdy, Weg ------------------------------------------------------------ */
  const modules = m.modulesOf(pp);
  assert.equal(modules.length, 3);
  assert.deepEqual([modules[0].n, modules[0].docIndex, modules[0].kind], [1, 0, 'text']);
  assert.deepEqual([modules[0].sizes.desktop.colSpan, modules[0].sizes.tablet.colSpan, modules[0].sizes.mobile.colSpan], [4, 4, 2], 'sizes per screen, snapped like the grid');
  assert.equal(modules[1].docIndex, 1);
  assert.ok(modules.every((one) => one.sizes.desktop.shows !== ''), 'every module says what it shows');
  assert.equal(m.pickModule(pp, 'M2').kind, 'image');
  assert.equal(m.pickModule(pp, 'modules[2]').kind, 'hero');
  assert.equal(m.pickModule(pp, 'hero').kind, 'hero');
  assert.equal(m.pickModule(pp, 2).kind, 'image');
  assert.equal(m.pickModule(pp, 'M9'), null);
  assert.deepEqual(m.sizesFor(2).map((s) => `${s.colSpan}x${s.rowSpan}`), ['2x1', '2x3', '2x5']);
  assert.equal(m.sizesFor(6).length, 12);

  const deck = m.planPreview({ doc: { ...doc, mode: 'slides', modules: [
    { id: 'a', kind: 'text', config: { title: 'A', body: 'x' } },
    { id: 'b', kind: 'image', config: { url: '/x.png', alt: 'x' }, slide: { with: { slide: 'a', side: 'end', share: 40 } } },
    { id: 'c', kind: 'notice', config: { body: 'Uwaga' }, slide: { stage: { frames: { a: { x: 80, y: 20, w: 20 } } } } }
  ] } });
  const slides = m.deckPlanOf(deck);
  assert.deepEqual(slides.slides.map((s) => s.modules.length), [0, 2], 'a title slide, then one slide carrying its companion');
  assert.equal(slides.stage.length, 1, 'the stage module has no slide of its own');

  const home = m.planPreview({ doc: await fixture('presentation-home.json') });
  const show = m.showPlanOf(home);
  assert.deepEqual(show.route, ['start', 'calosc', 'czlowiek', 'dane', 'dzieje', 'kontakt'], 'the route without buttons');
  assert.deepEqual(show.zones.map((z) => z.to - z.at + 1), [1, 4, 3, 3, 1, 1], 'steps per scene');
  assert.equal(show.zones[1].at, 1);
  assert.ok(m.modulesOf(home).filter((one) => one.kind === 'text' && one.title !== '').every((one) => one.visible), 'a titled text is visible on a stage');
  ok('sizes per screen, picking a module, slides with companions and stage, the presentation route and its steps');

  /* -- 4: die Fixtures ----------------------------------------------------------------------- */
  for (const name of ['presentation-home.json', 'cogita-home.json', 'hortus-dei.json', 'physics-lesson.json', 'lab2d-wrzenie.json']) {
    const said = m.lintDocument(await fixture(name)).filter((one) => one.kind === 'unknown');
    assert.deepEqual(said, [], `${name}: no unknown keys — ${JSON.stringify(said.slice(0, 3))}`);
  }
  ok('the fixtures carry no unknown key');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
