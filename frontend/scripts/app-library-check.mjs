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
 *   6. Bücher: ISBN, Strichcode (ZXing), Katalog (MARC, ONIX), eigene Nummer,
 *      Zitate eines Buches (Format, Polecenie, Plan, Import, Export).
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
export * from '${app}isbn';
export * from '${app}libraryCatalog';
export * from '${app}libraryQuotes';
export { decodeGray } from '${app}barcode';
export { readAmount } from '${app}libraryJson';
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

  /* -- 6. Bücher und ihre Zitate --------------------------------------------------------------- */
  {
    assert.equal(m.isbn13('978-83-63110-45-1'), '9788363110451', 'isbn: hyphens go');
    assert.equal(m.isbn13('9788363110452'), null, 'isbn: a wrong check digit is no isbn');
    assert.equal(m.isbn13('0-8044-2957-X'), '9780804429573', 'isbn: ten digits with X become thirteen');
    assert.equal(m.isbn13('5901234123457'), null, 'isbn: a product EAN is no book');
    assert.deepEqual(m.isbnsIn('978-83-63110-45-1, 978-83-63110-46-8'), ['9788363110451', '9788363110468'], 'isbn: two in one field');
    assert.equal(m.isbnProblem(''), null);
    assert.ok(m.isbnProblem('978-83-63110-45-2')?.includes('kontrolna'), 'isbn: the check digit is named');
    assert.ok(m.isbnProblem('12345')?.includes('10 albo 13'), 'isbn: the length is named');

    /* Ein EAN-13 gezeichnet (Module à 3 px) — ZXing liest ihn zurück. */
    const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    const R = L.map((code) => [...code].map((b) => (b === '1' ? '0' : '1')).join(''));
    const G = R.map((code) => [...code].reverse().join(''));
    const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
    const ean = '9788363110451';
    const d = [...ean].map(Number);
    let bits = '101';
    for (let i = 1; i <= 6; i += 1) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]];
    bits += '01010';
    for (let i = 7; i <= 12; i += 1) bits += R[d[i]];
    bits += '101';
    const quiet = 12;
    const modules = '0'.repeat(quiet) + bits + '0'.repeat(quiet);
    const W = modules.length * 3;
    const H = 60;
    const gray = new Uint8ClampedArray(W * H).fill(255);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (modules[Math.floor(x / 3)] === '1') gray[y * W + x] = 0;
    assert.equal(await m.decodeGray(gray, W, H, false), ean, 'barcode: a drawn EAN-13 reads back');
    assert.equal(await m.decodeGray(gray, W, H, true), ean, 'barcode: also the thorough way');
    assert.equal(await m.decodeGray(new Uint8ClampedArray(W * H).fill(255), W, H, true), null, 'barcode: a blank image is nothing');

    /* Der Katalog: drei Beschreibungen der BN und die Meldung des Verlags. */
    const { readFile } = await import('node:fs/promises');
    const answer = JSON.parse(await readFile(join(process.cwd(), 'scripts/fixtures/catalog-9788363110451.json'), 'utf8'));
    const books = m.booksOf(answer);
    assert.equal(books.length, 4, 'three records of the national library and one of e-ISBN');
    const best = books[0];
    assert.equal(best.source, 'bn');
    assert.equal(best.title, 'Wielkość świętego Michała Archanioła');
    assert.equal(best.subtitle, 'miesięczne nabożeństwo w sprawach trudnych');
    assert.equal(best.year, '2016', 'the fullest description first (the second edition)');
    assert.equal(best.edition, '2', '"Wydanie drugie." is 2');
    assert.equal(best.pageCount, 215);
    assert.equal(best.height, 17);
    assert.equal(best.binding, 'soft', 'the binding of THIS isbn (020 $q)');
    assert.equal(best.place, 'Poznań');
    assert.equal(best.publisher, 'Wydawnictwo Rosemaria');
    assert.equal(best.language, 'pl');
    assert.deepEqual(best.authors, [{ surname: 'Ricci', given: 'Nicola' }, { surname: 'Petino', given: 'Cosimo' }]);
    assert.deepEqual(best.translators, [{ surname: 'Werbowy', given: 'Klaudyna' }]);
    const first2015 = books.find((b) => b.source === 'bn' && b.ref === 'bn:1450038411');
    assert.equal(first2015.originalTitle, 'Grandezze di s. Michele Arcangelo', 'a translation: 240 is the original title');
    assert.equal(first2015.pageCount, 213);
    assert.deepEqual(first2015.translators, [{ surname: 'Werbowy', given: 'Katarzyna' }], '"Tł." is a translator');
    const onix = books.find((b) => b.source === 'e-isbn');
    assert.equal(onix.title, 'Miesiąc ku czci św. Michała Archanioła');
    assert.deepEqual(onix.authors, [{ given: 'Nocola', surname: 'Ricci' }], 'a name as the publisher wrote it');
    assert.equal(onix.year, '2015');
    assert.ok(m.bookLine(best).includes('wyd. 2') && m.bookLine(best).includes('215 s.') && m.bookLine(best).includes('oprawa miękka'));
    assert.equal(m.tidy('Poznań :'), 'Poznań');
    assert.equal(m.tidy('Kowalski, J.'), 'Kowalski, J.', 'an initial keeps its dot');
    assert.equal(m.editionOf('Wyd. 3 popr.'), '3 popr.');
    assert.equal(m.editionOf('Wydanie II.'), '2');
    assert.deepEqual(m.nameOf('Benedykt XVI'), { name: 'Benedykt XVI' }, 'a pope is a name');
    assert.equal(m.fromOpenLibrary({ title: 'Mere Christianity', authors: [{ name: 'C. S. Lewis' }], publish_date: 'March 2001', number_of_pages: 227 }, '9780060652920').pageCount, 227);

    /* In die Bibliothek: Personen einmal, Ausgefülltes bleibt. */
    const ricci = { id: 'p-ricci', kind: 'person', data: { givenNames: 'Nicola', surname: 'Ricci' } };
    const plan = m.planBook(best, [ricci]);
    assert.deepEqual(plan.data.authors[0], 'p-ricci', 'an author already in the library is reused');
    assert.equal(plan.persons.length, 2, 'Petino and Werbowy are new');
    assert.equal(plan.data.workType, 'book');
    assert.equal(plan.data.isbn, '9788363110451');
    assert.equal(plan.data.pageCount, 215);
    const fill = m.planBook(best, [ricci], { workType: 'book', title: 'Mój tytuł', year: '2016', authors: ['p-ricci'] });
    assert.equal(fill.data.title, undefined, 'a filled title is never overwritten');
    assert.equal(fill.data.authors, undefined);
    assert.equal(fill.persons.length, 1, 'only the translator is new');
    assert.ok(fill.filled.includes('liczba stron') && !fill.filled.includes('tytuł'));

    /* Die eigene Nummer. */
    const W1 = (id, n, at) => ({ id, kind: 'work', data: { libraryNumber: n }, updatedAt: at });
    assert.equal(m.nextLibraryNumber([W1('a', 'B-0041', '1'), W1('b', 'B-0042', '2')]), 'B-0043');
    assert.equal(m.nextLibraryNumber([]), '1');
    assert.equal(m.nextLibraryNumber([W1('a', '17', '1'), W1('b', 'K-9', '2')]), 'K-10', 'in the style of the latest');
    assert.deepEqual(m.sameNumber([W1('a', 'B-0042', '1'), W1('b', 'b 0042', '2')], 'B-0042', 'a').map((w) => w.id), ['b']);

    /* Im JSON der Bibliothek: Zahlen mit Einheit, Werte beim Namen, die Zitate eines Buches woanders. */
    assert.equal(m.readAmount('384 s.'), 384);
    assert.equal(m.readAmount('20,5 cm'), 20.5);
    assert.equal(m.readAmount('24 x 17 cm'), null);
    const human = m.planLibraryImport({ entries: [{ kind: 'work', data: { title: 'T', pageCount: '384 s.', height: '20,5 cm', binding: 'Twarda' } }] }, empty);
    assert.deepEqual(human.warnings, []);
    assert.equal(human.drafts[0].data.pageCount, 384);
    assert.equal(human.drafts[0].data.height, 20.5);
    assert.equal(human.drafts[0].data.binding, 'hard', 'a label means its value');
    assert.ok(m.planLibraryImport({ entries: [{ kind: 'work', data: { width: '24 x 17 cm' } }] }, empty).warnings.some((w) => w.includes('nie liczba')));
    assert.ok(m.planLibraryImport({ format: m.QUOTES_FORMAT, quotes: [] }, empty).error.includes('na stronie tej książki'));
    ok('books: isbn, an EAN-13 read by ZXing, catalogue (MARC ×3, ONIX, Open Library), persons reused, own numbers, amounts with units');

    /* Die Zitate eines Buches. */
    const book = { id: 'w-ricci', kind: 'work', key: 'ricci2016', data: { workType: 'book', title: 'Wielkość świętego Michała Archanioła', authors: ['p-ricci'], place: 'Poznań', year: '2016', isbn: '978-83-63110-45-1' } };
    const prayer = { id: 't-modlitwa', kind: 'topic', key: 'modlitwa', data: { name: 'Modlitwa' } };
    const had = { id: 'q-had', kind: 'quote', key: 'ricci2016-1', data: { text: 'Święty Michale Archaniele, broń nas w walce.', work: 'w-ricci', locator: 's. 12' } };
    const shelf = look([ricci, book, prayer, had]);
    const doc = {
      format: m.QUOTES_FORMAT, version: 1, work: { title: 'Wielkość świętego Michała Archanioła' },
      quotes: [
        { text: 'Święty Michale Archaniele,\nbroń nas w walce.', page: '12' },
        { text: 'Kto jak Bóg? Nikt jak Bóg — to imię jest modli-\ntwą.', page: '23-24', topics: ['Modlitwa', 'Aniołowie'], photo: 2, uncertain: true, notes: 'por. Dn 10' },
        { text: '', page: '3' }
      ]
    };
    const qp = m.planQuotes(doc, book, shelf);
    assert.equal(qp.items.length, 2, 'an empty quote is skipped');
    assert.ok(qp.warnings.some((w) => w.includes('bez tekstu')));
    assert.equal(qp.items[0].duplicateOf, 'q-had', 'the same text (other line breaks) is already there');
    assert.equal(qp.items[0].keep, false, '… and is unchecked');
    const fresh = qp.items[1];
    assert.equal(fresh.text, 'Kto jak Bóg? Nikt jak Bóg — to imię jest modlitwą.', 'hyphenation and line breaks are joined');
    assert.equal(fresh.locator, 's. 23–24');
    assert.deepEqual(fresh.topics, [{ id: 't-modlitwa', name: 'Modlitwa' }, { name: 'Aniołowie' }], 'known topics by name, new ones stay names');
    assert.equal(fresh.photo, 2);
    assert.equal(fresh.uncertain, true);
    assert.deepEqual(m.newTopics(qp.items), ['Aniołowie']);
    assert.ok(m.planQuotes({ quotes: [{ text: 'x' }], work: { title: 'Zupełnie inna' } }, book, shelf).warnings.some((w) => w.includes('Zupełnie inna')), 'written for another book: said, not refused');
    assert.ok('error' in m.planQuotes({ format: 'recreatio/page', quotes: [] }, book, shelf));

    const saved = [];
    const fake = async (input) => { const id = input.id ?? `new-${saved.length}`; saved.push({ ...input, id }); return { id }; };
    const result = await m.importQuotes(qp.items, book, shelf, fake, { createTopics: true });
    assert.deepEqual([result.saved, result.topics, result.failed.length], [1, 1, 0], 'one new topic, one quote (the duplicate stays out)');
    assert.deepEqual(saved[0], { kind: 'topic', data: { name: 'Aniołowie' }, id: 'new-0' });
    assert.equal(saved[1].kind, 'quote');
    assert.equal(saved[1].data.work, 'w-ricci', 'every quote belongs to this book');
    assert.deepEqual(saved[1].data.topics, ['t-modlitwa', 'new-0']);
    assert.equal(saved[1].data.notes, 'por. Dn 10');
    assert.equal(saved[1].data.description, undefined, 'empty fields are not written');

    const exported = m.exportQuotes(book, shelf);
    assert.equal(exported.format, m.QUOTES_FORMAT);
    assert.deepEqual(exported.work, { title: 'Wielkość świętego Michała Archanioła', key: 'ricci2016', isbn: '978-83-63110-45-1' });
    const back = m.planQuotes(exported, book, shelf);
    assert.equal(back.items[0].id, 'q-had', 'an exported quote comes back as itself');
    assert.equal(back.items[0].duplicateOf, undefined);
    const resaved = [];
    await m.importQuotes(back.items, book, shelf, async (input) => { resaved.push(input); return { id: input.id }; }, { createTopics: false });
    assert.deepEqual(resaved[0].data, had.data, 'export → import keeps a quote as it was');

    const description = m.quotesDescription(book);
    for (const field of m.kindOf('quote').fields) {
      if (field.key === 'work') assert.ok(!description.includes(`"work" — `), 'the book is not a field of a quote here');
      else assert.ok(description.includes(`"${field.key}" — `), `quotes description explains ${field.key}`);
    }
    for (const extra of ['page', 'uncertain', 'photo', 'id']) assert.ok(description.includes(`"${extra}" — `), `quotes description explains ${extra}`);
    const promptMarked = m.quotesPrompt(book, shelf, 'marked', true);
    assert.ok(promptMarked.includes('ołówkiem') && promptMarked.includes('Wielkość świętego Michała Archanioła') && promptMarked.includes('Modlitwa'), 'the prompt names the book, the pencil and the topics');
    assert.ok(promptMarked.includes(m.QUOTES_FORMAT), 'for another chat the format goes along');
    const promptWhole = m.quotesPrompt(book, shelf, 'whole', false);
    assert.ok(promptWhole.includes('cały tekst') && !promptWhole.includes('"format"'), 'here the tool gives the shape');
    assert.deepEqual(m.QUOTES_TOOL.input_schema.required, ['quotes']);
    ok('quotes of a book: duplicates, hyphenation, pages, topics by name, import with new topics, export → import, description from the kind, prompt');
  }
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
