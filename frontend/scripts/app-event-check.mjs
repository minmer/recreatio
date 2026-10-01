/**
 * Die Bausteine der Ereignisseiten (0063), nachgemessen.
 *
 * Drei Dinge, die falsch sein können, ohne dass es auffällt:
 *
 *   1. Der Weg Gestalt → JSON → Gestalt, den der Editor bei jedem Tastendruck
 *      geht. Im Altbestand verschwand dort einmal ein frisch angelegter, noch
 *      leerer Eintrag — und „Dodaj" sah aus, als täte es nichts.
 *   2. Die Übernahme eines Ereignisses aus dem Altbestand: welche Teile zu
 *      welchen Bausteinen werden, was ausgelassen wird und warum.
 *   3. Das Einlesen eines GPX-Tracks und sein Vereinfachen.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-event-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { PARTS, partOf } from '${app}parts/registry';
export { importLegacy, legacyPages, dictionary } from '${app}SlidesImport';
export { parseGpx, simplifyTrack, trackLengthKm } from '${app}event/gpx';
export { partSize } from '${app}part';
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

/* Node hat keinen DOMParser; der GPX-Leser braucht nur getElementsByTagName — und querySelector für den Fehler. */
const { DOMParser: XmlParser } = await import('@xmldom/xmldom');
globalThis.DOMParser = class {
  parseFromString(text, type) {
    const document = new XmlParser({ onError: () => undefined }).parseFromString(text, type);
    document.querySelector = (name) => document.getElementsByTagName(name)[0] ?? null;
    return document;
  }
};

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  const kinds = ['hero', 'shortinfos', 'plan', 'map', 'costs', 'faq', 'people', 'files', 'gallery'];
  for (const kind of kinds) {
    const def = m.partOf(kind);
    assert.ok(def !== undefined, `${kind} registered`);
    assert.ok(def.Editor !== null, `${kind} brings its own editor`);
    assert.equal(def.hasContent({}), false, `${kind}: empty config has nothing to show`);
    assert.equal(def.hasContent({ json: 'not json at all {' }), false, `${kind}: broken JSON shows nothing, throws nothing`);
    assert.equal(def.hasContent({ json: JSON.stringify(def.example()) }), true, `${kind}: the example has content`);

    /* Gestalt → JSON → Gestalt: ein Beispiel bleibt, was es ist. */
    const once = def.read({ json: JSON.stringify(def.example()) }).config;
    const twice = def.read({ json: JSON.stringify(once) }).config;
    assert.deepEqual(twice, once, `${kind}: round trip is stable`);

    for (const size of [m.partSize({ colSpan: 6, rowSpan: 1 }), m.partSize({ colSpan: 2, rowSpan: 3 }), m.partSize({ colSpan: 6, rowSpan: 5 })]) {
      assert.ok(def.shows({ json: JSON.stringify(def.example()) }, size).length > 0, `${kind}: says what it shows at ${size.colSpan}x${size.rowSpan}`);
    }
  }
  ok('nine event parts: registered, own editor, tolerant reading, stable round trip, a sentence per size');

  /* Ein frisch hinzugefügter, noch leerer Eintrag überlebt das Lesen. */
  const plan = m.partOf('plan');
  const blankRow = plan.read({ json: JSON.stringify({ groups: [{ label: '', caption: null, rows: [{ time: null, title: '', detail: null }] }] }) }).config;
  assert.equal(blankRow.groups.length, 1, 'an empty stage stays in the editor');
  assert.equal(blankRow.groups[0].rows.length, 1, 'an empty row stays in the editor');
  const faq = m.partOf('faq');
  assert.equal(faq.read({ json: JSON.stringify({ items: [{ question: '', answer: '' }] }) }).config.items.length, 1, 'an empty question stays in the editor');
  const costs = m.partOf('costs');
  assert.equal(costs.read({ json: JSON.stringify({ costItems: [{ label: '', suggested: null, actual: null }] }) }).config.costItems.length, 1, 'an unnamed cost stays in the editor');
  ok('a freshly added, still empty entry survives the re-read (the legacy "add does nothing" bug)');

  /* Title and intro sit beside the JSON, flat like every other part. */
  const hero = m.partOf('hero');
  const read = hero.read({ title: 'Start', intro: 'Wstęp', json: '{"headline":"Pielgrzymka"}' });
  assert.equal(read.title, 'Start');
  assert.equal(read.intro, 'Wstęp');
  assert.equal(read.config.headline, 'Pielgrzymka');
  ok('title and intro beside the legacy config');

  /* The map keeps several tracks and lifts an old single track. */
  const map = m.partOf('map');
  const lifted = map.read({ json: JSON.stringify({ points: [], track: [[50, 19], [50.1, 19.1], [50.2, 19.3]] }) }).config;
  assert.equal(lifted.tracks.length, 1, 'legacy single track becomes one of the tracks');
  assert.equal(map.read({ json: JSON.stringify({ points: [{ label: 'X', lat: 99, lon: 0 }] }) }).config.points.length, 0, 'off-world point dropped');
  ok('map: legacy single track lifted, impossible coordinates dropped');

  /* -- Übernahme aus dem Altbestand ------------------------------------------- */
  const doc = {
    title: 'Rowerowa Częstochowa 2026',
    subtitle: 'Dwa dni, 140 km',
    theme: { mode: 'light', accent: '#2f5fb5', ground: '#f4f6fa', ink: '#16202e', muted: '#5a6a80' },
    pages: [
      { kind: 'public', title: 'Start', menuLabel: 'Strona publiczna', parts: [
        { kind: 'title', menuLabel: 'Start', title: null, config: { headline: 'Pielgrzymka', actions: [{ label: 'Zapisz się', href: '#zapisy', variant: 'cta' }] },
          layers: [{ kind: 'bigtext', speed: 0.95, lines: ['CZĘSTOCHOWA'], opacity: 0.09 }] },
        { kind: 'plan', menuLabel: 'Plan', title: 'Plan dnia', intro: 'Wyjazd o świcie.', configJson: JSON.stringify({ groups: [{ label: 'Dzień 1', rows: [{ time: '7:00', title: 'Msza' }] }] }) },
        { kind: 'text', menuLabel: 'O nas', title: 'O wyjeździe', config: { paragraphs: ['Jedziemy razem.'], bullets: ['Kask'], note: 'Uwaga!' } },
        { kind: 'contact', menuLabel: 'Kontakt', config: { organizer: 'Parafia', channels: [{ label: 'Telefon', value: '+48 600 000 000', href: 'tel:+48600000000' }, { label: 'E-mail', value: 'a@b.pl', href: 'mailto:a@b.pl' }] } },
        { kind: 'form', menuLabel: 'Zapisy', config: {} },
        { kind: 'meme', menuLabel: 'Memy', config: {} }
      ] },
      { kind: 'internal', title: 'Uczestnicy', parts: [{ kind: 'faq', config: { items: [{ question: 'Q?', answer: 'A' }] } }] }
    ]
  };
  const pages = m.legacyPages(doc);
  assert.equal(pages.length, 2, 'both pages offered');
  assert.match(pages[1].label, /wewnętrzna/, 'internal page marked');

  const existing = [];
  const done = m.importLegacy(doc, 0, existing);
  assert.deepEqual(done.parts.map((p) => p.kind), ['hero', 'plan', 'text', 'contact'], 'kinds mapped, form and meme left out');
  assert.equal(done.warnings.length, 2, 'two parts skipped, each with a reason');
  assert.match(done.warnings.join(' '), /Formularz/, 'the form says where it went');
  assert.equal(done.parts[0].layout.slide.label, 'Start', 'menu label becomes the slide label');
  assert.equal(done.parts[0].layout.slide.layers[0].kind, 'bigtext', 'layers carried over');
  assert.equal(JSON.parse(done.parts[1].config.json).groups[0].rows[0].title, 'Msza', 'configJson strings read too');
  assert.equal(done.parts[1].config.intro, 'Wyjazd o świcie.', 'intro carried');
  assert.equal(done.parts[2].config.body, 'Jedziemy razem.\n• Kask\nUwaga!', 'text paragraphs, bullets and note');
  assert.equal(done.parts[3].config.phone, '+48 600 000 000', 'contact phone');
  assert.equal(done.parts[3].config.email, 'a@b.pl', 'contact email');
  assert.equal(done.theme.mode, 'light', 'theme read');
  assert.equal(done.title, 'Rowerowa Częstochowa 2026');
  for (const part of done.parts) {
    for (const bp of ['desktop', 'tablet', 'mobile']) assert.ok(part.layout[bp]?.size?.colSpan > 0, `${part.kind}: grid place on ${bp}`);
  }
  const rows = done.parts.map((p) => p.layout.desktop.position.row);
  assert.equal(new Set(rows).size, rows.length, 'imported parts do not overlap in the grid');

  assert.deepEqual(m.importLegacy({ parts: [{ kind: 'faq', config: { items: [] } }] }, 0, []).parts.map((p) => p.kind), ['faq'], 'a bare { parts } document');
  assert.deepEqual(m.importLegacy([{ kind: 'people', config: {} }], 0, []).parts.map((p) => p.kind), ['people'], 'a bare list');
  assert.ok(m.dictionary().includes('"shortinfos"') && m.dictionary().includes('"title"'), 'dictionary lists the kinds, title under its legacy name');
  ok('legacy event import: kinds, skipped parts with reasons, slides, layers, theme, grid places, dictionary');

  /* -- GPX ---------------------------------------------------------------------- */
  const points = Array.from({ length: 5000 }, (_, i) => `<trkpt lat="${(50 + i * 0.0002).toFixed(5)}" lon="${(19 + Math.sin(i / 50) * 0.01).toFixed(5)}"/>`).join('');
  const gpx = `<?xml version="1.0"?><gpx version="1.1"><wpt lat="50.06" lon="19.93"><name>Start</name></wpt><trk><name>Etap 1</name><trkseg>${points}</trkseg></trk></gpx>`;
  const parsed = m.parseGpx(gpx);
  assert.equal(parsed.name, 'Etap 1');
  assert.equal(parsed.waypoints.length, 1);
  assert.ok(parsed.track.length <= 600, `track simplified (${parsed.track.length})`);
  assert.ok(m.trackLengthKm(parsed.track) > 100, 'length kept roughly');
  assert.ok(m.simplifyTrack(parsed.track, 100).length <= 100, 'budget per track honoured');
  ok('gpx: waypoints, name, simplification to the point budget');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
