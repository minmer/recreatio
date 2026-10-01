/**
 * 0064 — DIE BIBLIOTHEK, nachgemessen.
 *
 *   1. Jede Art: jedes Feld beschrieben, das Beispiel nur aus Feldern, und
 *      alle Beispiele zusammen lassen sich importieren — Verweise per @schlüssel.
 *   2. Der Zapis: Überschriften, Absätze, Listen, Zitate, eingebettete Zitate,
 *      Verweise mit Stellen, eigene Fussnoten, Links, Escapes.
 *   3. Die Angaben: Buch, Kapitel, Artikel, Dokument, Pismo Święte, Netz —
 *      voll, „dz. cyt.", „Tamże", Bibliografie.
 *   4. Veröffentlichen: was mitgeht (Text → Zitat → Werk → Autor), dass
 *      Privates nie hinausgeht, was beim Zurückziehen bleibt.
 *   5. Der Text, gezeichnet: Fussnoten in Reihenfolge, Quellen darunter.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-library-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}libraryKinds';
export * from '${app}libraryMarkup';
export * from '${app}libraryCite';
export * from '${app}libraryPublish';
export { planLibraryImport, exportLibrary, libraryDescription, LIBRARY_FORMAT } from '${app}libraryJson';
export { TextArticle, publicLookup } from '${app}LibraryText';
export { renderToStaticMarkup } from 'react-dom/server';
export { createElement } from 'react';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

const look = (entries) => {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const byKey = new Map(entries.filter((e) => e.key).map((e) => [e.key.toLowerCase(), e]));
  return { get: (id) => byId.get(id), byKey: (key) => byKey.get(key.toLowerCase()), all: () => entries };
};

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1. Die Arten ------------------------------------------------------------------- */
  const description = m.libraryDescription();
  for (const def of m.KINDS) {
    for (const field of def.fields) {
      assert.ok(typeof field.says === 'string' && field.says.length > 3, `${def.kind}.${field.key} is described`);
      assert.ok(description.includes(`"${field.key}" — ${field.label}`), `description explains ${def.kind}.${field.key}`);
      if (field.type === 'ref' || field.type === 'refs') assert.ok(field.to?.every((k) => m.kindOf(k)), `${def.kind}.${field.key} points at known kinds`);
    }
    for (const key of Object.keys(def.example.data)) assert.ok(def.fields.some((f) => f.key === key), `${def.kind} example uses only fields (${key})`);
    assert.ok(description.includes(`### "${def.kind}" — ${def.label}`), `description lists ${def.kind}`);
  }
  assert.ok(description.includes('[@klucz, s. 23]'), 'description explains the markup');

  const exampleDoc = { format: m.LIBRARY_FORMAT, version: 1, entries: m.KINDS.map((def) => ({ kind: def.kind, key: def.example.key, data: def.example.data })) };
  const empty = { get: () => undefined, byKey: () => undefined };
  const planned = m.planLibraryImport(exampleDoc, empty);
  assert.ok(!('error' in planned), 'all examples import');
  assert.deepEqual(planned.warnings, [], 'the examples import without a warning');
  assert.equal(planned.created, m.KINDS.length);
  const byKind = Object.fromEntries(planned.drafts.map((d) => [d.kind, d]));
  assert.equal(byKind.quote.data.work, byKind.work.id, '@key references resolve to the new ids');
  assert.deepEqual(byKind.work.data.authors, [byKind.person.id]);
  assert.equal(byKind.project.data.outline[1].text, byKind.text.id, 'the outline of a project resolves too');
  assert.deepEqual(planned.drafts.map((d) => d.kind).slice(0, 3), ['person', 'topic', 'work'], 'what is named is saved first');
  ok(`${m.KINDS.length} kinds: every field described, examples import cleanly with @key references`);

  /* Herein: an Ort und Stelle, nur was gesagt ist. */
  const stored = planned.drafts.map((d) => ({ id: d.id, kind: d.kind, key: d.key, data: d.data }));
  const base = look(stored);
  const again = m.planLibraryImport({ entries: [{ kind: 'work', key: 'ratzinger2007', data: { year: '2008', bogus: 1, workType: 'scroll' } }] }, base);
  assert.equal(again.updated, 1, 'matched by key: updated in place');
  assert.equal(again.drafts[0].id, byKind.work.id);
  assert.equal(again.drafts[0].data.title, 'Jezus z Nazaretu', 'fields not in the document stay');
  assert.equal(again.drafts[0].data.year, '2008');
  assert.ok(again.warnings.some((w) => w.includes('bogus')) && again.warnings.some((w) => w.includes('scroll')), 'unknown fields and values are reported');
  const same = m.planLibraryImport(m.exportLibrary('x', stored), base);
  assert.equal(same.unchanged, stored.length, 'export → import changes nothing');
  assert.equal(same.drafts.length, 0);
  const cleared = m.planLibraryImport({ entries: [{ id: byKind.work.id, kind: 'work', data: { description: null } }] }, base);
  assert.equal(cleared.drafts[0].data.description, undefined, 'null clears a field');
  ok('import: in place by id or key, missing fields stay, null clears, export → import is a no-op');

  /* -- 2. Der Zapis -------------------------------------------------------------------- */
  const blocks = m.parseMarkup('## Głód\nPierwszy *akapit* i **mocno** [@bt, J 6,35; @ratzinger2007].\nDruga linia^[Własny przypis z [@ratzinger2007, s. 3].]\n\n![@ratzinger2007-1]\n\n> Cytat\n> dalej\n\n- jeden\n- dwa\n\n1. a\n2. b\n\n---\n\nLink [tu](https://example.pl) i [zły](javascript:alert(1)) oraz \\*gwiazdka\\* i klucz_z_podkreśleniem.');
  assert.deepEqual(blocks.map((b) => b.t), ['h', 'p', 'embed', 'quote', 'list', 'list', 'hr', 'p']);
  assert.equal(blocks[0].level, 2);
  const p = blocks[1].c;
  assert.ok(p.some((i) => i.t === 'i') && p.some((i) => i.t === 'b') && p.some((i) => i.t === 'br'), 'italic, bold and a line break');
  const cite = p.find((i) => i.t === 'cite');
  assert.deepEqual(cite.items, [{ key: 'bt', locator: 'J 6,35' }, { key: 'ratzinger2007', locator: '' }], 'several sources in one note');
  assert.ok(p.some((i) => i.t === 'note'), 'own footnote');
  assert.deepEqual(blocks[2], { t: 'embed', key: 'ratzinger2007-1', locator: '' });
  assert.equal(blocks[4].ordered, false);
  assert.equal(blocks[5].ordered, true);
  const last = blocks[7].c;
  assert.equal(last.filter((i) => i.t === 'link').length, 1, 'javascript: is not a link');
  assert.ok(last.some((i) => i.t === 'text' && i.v.includes('*gwiazdka*')), 'escapes keep their character');
  assert.ok(last.some((i) => i.t === 'text' && i.v.includes('klucz_z_podkreśleniem')), 'an underscore inside a word is not italic');
  assert.deepEqual(m.citedKeys('A [@bt, J 1,1] b ![@q1] c ^[d [@x]]'), ['bt', 'q1', 'x'], 'keys in text order, also inside notes');
  assert.deepEqual(m.citedKeys('![@q2]\n\nZ [@y]', 'W [@y] [@z]'), ['q2', 'y', 'z'], 'embeds, and each key once over several fields');
  assert.equal(m.wordCount('Ala ma kota [@bt, J 1,1] i **psa**.'), 5);
  assert.equal(m.excerpt('## T\nJeden dwa trzy cztery pięć sześć', 16), 'Jeden dwa trzy…', 'the start of a text skips its headings');
  ok('markup: headings, paragraphs, lists, quotes, embeds, cites with locators, notes, safe links, escapes, words');

  /* -- 3. Die Angaben -------------------------------------------------------------------- */
  const P = (id, given, surname, extra = {}) => ({ id, kind: 'person', key: id, data: { givenNames: given, surname, ...extra } });
  const W = (id, data) => ({ id, kind: 'work', key: id, data });
  const lib = look([
    P('rat', 'Joseph', 'Ratzinger'), P('now', 'Anna Maria', 'Nowak'), P('kow', 'Piotr', 'Kowal'),
    { id: 'fr', kind: 'person', key: 'fr', data: { name: 'Franciszek' } },
    W('jezus', { workType: 'book', title: 'Jezus z Nazaretu', authors: ['rat'], volume: '1', translators: ['kow'], publisher: 'Wydawnictwo M', place: 'Kraków', year: '2007' }),
    W('duch', { workType: 'book', title: 'Duchowość', editors: ['kow'], place: 'Lublin', year: '2010' }),
    W('rozdz', { workType: 'chapter', title: 'Modlitwa', authors: ['now'], container: 'duch', pages: '45–60' }),
    W('communio', { workType: 'periodical', title: 'Communio' }),
    W('art', { workType: 'article', title: 'Tytuł artykułu', authors: ['now'], container: 'communio', volume: '12', year: '2020', issue: '3', pages: '40–52' }),
    W('eg', { workType: 'document', title: 'Evangelii gaudium', subtitle: 'adhortacja apostolska', authors: ['fr'], year: '2013' }),
    W('bt', { workType: 'bible', title: 'Pismo Święte Starego i Nowego Testamentu', siglum: 'BT', edition: '5', place: 'Poznań', year: '2000' }),
    W('web', { workType: 'web', title: 'Strona', url: 'https://example.pl/a', accessed: '2026-10-01' }),
    { id: 'q', kind: 'quote', key: 'q', data: { text: 'Modlitwa jest rozmową.', work: 'jezus', locator: 's. 168' } }
  ]);
  const t = (id, locator, state) => m.segText(m.citeSegs(lib.get(id), locator, lib, state));
  const state = m.newCiteState();
  assert.equal(t('jezus', 's. 23', state), 'J. Ratzinger, Jezus z Nazaretu, t. 1, tłum. P. Kowal, Kraków 2007, s. 23');
  assert.equal(t('jezus', 's. 24', state), 'Tamże, s. 24');
  assert.equal(t('rozdz', 's. 50', state), 'A. M. Nowak, Modlitwa, w: Duchowość, red. P. Kowal, Lublin 2010, s. 50');
  assert.equal(t('jezus', 's. 40', state), 'J. Ratzinger, Jezus z Nazaretu, dz. cyt., s. 40');
  assert.equal(t('art', 's. 45', state), 'A. M. Nowak, Tytuł artykułu, „Communio” 12 (2020), nr 3, s. 45');
  assert.equal(t('eg', '24', state), 'Franciszek, Evangelii gaudium. adhortacja apostolska, 24');
  assert.equal(t('bt', 'J 6,35', state), 'J 6,35 (BT)');
  assert.equal(t('web', '', state), 'Strona, https://example.pl/a, (dostęp: 2026-10-01)');
  assert.equal(t('q', '', state), 'J. Ratzinger, Jezus z Nazaretu, dz. cyt., s. 168', 'a quote names its work at its place');
  assert.equal(m.segText(m.citeSegs(undefined, 's. 1', lib, state)), '[brak źródła], s. 1');
  const bib = m.bibliography(['jezus', 'rozdz', 'bt', 'jezus'].map((id) => lib.get(id)), lib).map((b) => m.segText(b.segs));
  assert.equal(bib.length, 3, 'each work once');
  assert.ok(bib.includes('Ratzinger J., Jezus z Nazaretu, t. 1, tłum. P. Kowal, Wydawnictwo M, Kraków 2007'), bib.join(' | '));
  assert.ok(bib.includes('Pismo Święte Starego i Nowego Testamentu (BT), wyd. 5, Poznań 2000'), bib.join(' | '));
  assert.equal(m.originOf(lib.get('q'), lib), 'J. Ratzinger, Jezus z Nazaretu, s. 168');
  ok('citations: book, chapter, article, document, Bible, web; full, dz. cyt., Tamże; bibliography');

  /* -- 4. Veröffentlichen ---------------------------------------------------------------------- */
  const entries = [
    ...lib.all().map((e) => ({ ...e, publishedAs: null })),
    { id: 'topic', kind: 'topic', key: 'modlitwa', data: { name: 'Modlitwa', notes: 'prywatne' }, publishedAs: null },
    { id: 'proj', kind: 'project', key: 'proj', data: { title: 'Niedziele', status: 'writing', outline: [{ heading: 'Lipiec' }, { text: 'sermon' }, { text: 'draft' }] }, publishedAs: null },
    { id: 'sermon', kind: 'text', key: 'sermon', data: { title: 'Chleb', status: 'final', notes: 'tajne', body: 'Ja jestem [@bt, J 6,35].\n\n![@q]', topics: ['topic'], project: 'proj' }, publishedAs: null },
    { id: 'draft', kind: 'text', key: 'draft', data: { title: 'Szkic', body: 'x', project: 'proj' }, publishedAs: null }
  ];
  const L = look(entries);
  const plan = m.plan(entries, L, { add: ['sermon'] });
  const ids = plan.publish.map((p) => p.id).sort();
  assert.deepEqual(ids, ['bt', 'jezus', 'kow', 'proj', 'q', 'rat', 'sermon', 'topic'].sort(), 'a text takes its quote, work, authors, translator, Bible, topic and project');
  assert.equal(plan.publish.find((p) => p.id === 'sermon').as, 'explicit');
  assert.equal(plan.publish.find((p) => p.id === 'q').as, 'implicit');
  assert.ok(!ids.includes('draft'), 'other texts of the project stay private');
  const sermonPublic = m.publicEntry(L.get('sermon'), 'explicit', L, (id) => ids.includes(id));
  assert.ok(!sermonPublic.json.includes('tajne') && !sermonPublic.json.includes('"status"'), 'private fields never go out');
  const projectPublic = JSON.parse(m.publicEntry(L.get('proj'), 'implicit', L, (id) => ids.includes(id)).json);
  assert.deepEqual(projectPublic.data.outline, [{ heading: 'Lipiec' }, { text: 'sermon' }], 'the outline shows only published texts');
  assert.ok(!JSON.stringify(projectPublic).includes('writing'), 'project status is private');
  const topicPublic = m.publicEntry(L.get('topic'), 'implicit', L, () => true);
  assert.ok(!topicPublic.json.includes('prywatne'));
  assert.deepEqual([...sermonPublic.refs].sort(), ['bt', 'proj', 'q', 'topic'], 'refs: fields and the keys in the text');
  const summary = JSON.parse(sermonPublic.summary);
  assert.equal(summary.title, 'Chleb');
  assert.equal(summary.project.title, 'Niedziele');

  /* Draussen: die Predigt und ein Zitat für die Sammlung. Dann zurückziehen. */
  const published = entries.map((e) => ({ ...e, publishedAs: ids.includes(e.id) ? (e.id === 'sermon' ? 'explicit' : 'implicit') : null }));
  const L2 = look(published);
  const withQuote = m.plan(published, L2, { add: ['q'] });
  assert.deepEqual(withQuote.publish.map((p) => [p.id, p.as]), [['q', 'explicit']], 'an implicit quote becomes explicit — nothing else changes');
  const both = published.map((e) => (e.id === 'q' ? { ...e, publishedAs: 'explicit' } : e));
  const L3 = look(both);
  const dropSermon = m.plan(both, L3, { remove: ['sermon'] });
  assert.deepEqual([...dropSermon.unpublish].sort(), ['bt', 'proj', 'sermon', 'topic'].sort(), 'what only the sermon needed goes with it');
  assert.ok(!dropSermon.unpublish.includes('q') && !dropSermon.unpublish.includes('jezus'), 'the quote stays (explicit), and its work');
  const dropQuote = m.plan(both, L3, { remove: ['q'] });
  assert.deepEqual(dropQuote.unpublish, [], 'a quote the sermon still cites stays public');
  assert.deepEqual(dropQuote.publish.map((p) => [p.id, p.as]), [['q', 'implicit']]);
  assert.deepEqual(m.neededBy('q', both, L3), ['sermon']);
  const renamed = m.plan(both, L3, { refresh: ['rat'] });
  assert.ok(['rat', 'jezus', 'q'].every((id) => renamed.publish.some((p) => p.id === id)), 'a renamed author refreshes the work and the quote that name him');
  ok('publishing: closure, private fields stay home, project outline filtered, unpublish keeps what others need');

  /* -- 5. Der Text, gezeichnet ------------------------------------------------------------------- */
  const sermon = { id: 'sermon', kind: 'text', key: 'sermon', data: {
    title: 'Chleb', date: '2026-08-02', occasion: 'XVIII Niedziela zwykła', readings: 'J 6,24-35',
    body: 'A [@jezus, s. 1]. B [@jezus, s. 2]. C^[Moja uwaga.] D [@bt, J 6,35].\n\n![@q]',
    further: 'Więcej: [@rozdz].'
  } };
  const html = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: sermon, look: lib }));
  const notes = [...html.matchAll(/<li id="fn-(\d+)">(.*?)<\/li>/g)].map((x) => x[2].replace(/<[^>]+>/g, ''));
  assert.equal(notes.length, 5, 'five footnotes over body and further');
  assert.ok(notes[0].startsWith('J. Ratzinger, Jezus z Nazaretu'), notes[0]);
  assert.ok(notes[1].startsWith('Tamże, s. 2'), notes[1]);
  assert.ok(notes[2].startsWith('Moja uwaga.'), notes[2]);
  assert.ok(notes[3].startsWith('J 6,35 (BT)'), notes[3]);
  assert.ok(notes[4].startsWith('A. M. Nowak, Modlitwa'), notes[4]);
  assert.ok(html.includes('Modlitwa jest rozmową.') && html.includes('— J. Ratzinger, Jezus z Nazaretu, s. 168'), 'the embedded quote with its origin');
  assert.ok(html.includes('Dalsze informacje') && html.includes('Źródła') && html.includes('Przypisy'));
  assert.ok(html.includes('2 sierpnia 2026') && html.includes('XVIII Niedziela zwykła'), 'date and occasion');
  const sources = html.slice(html.indexOf('Źródła'));
  assert.equal((sources.match(/<li>/g) ?? []).length, 3, 'three works under Źródła (Jezus, Bible, chapter)');
  ok('a text renders: numbered notes over body and further, Tamże, embedded quote, sources, date');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
