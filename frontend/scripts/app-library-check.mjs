/**
 * 0064 — DIE BIBLIOTHEK, nachgemessen.
 *
 *   1. Jede Art: jedes Feld beschrieben, das Beispiel nur aus Feldern, und
 *      alle Beispiele zusammen lassen sich importieren — Verweise per @schlüssel.
 *   2. Der Zapis: Überschriften, Absätze, Listen, Zitate, eingebettete Zitate,
 *      Verweise mit Stellen, eigene Fussnoten, Links, Escapes.
 *  2d. Stellen der Schrift und das Verzeichnis der Verweise (2026-10-22): Bücher
 *      polnisch, lateinisch, englisch; Bereiche, Listen, Kapitel; Ordnung nach
 *      dem Kanon; wer auf eine Stelle zeigt — über Bibliotheken und Bazy wiedzy.
 *  2c. Ein Leser, nach Art gezeichnet (2026-10-22): Quellen werden Fussnoten,
 *      eigene Einträge Links (auch `[[Wort|@klucz]]`), unlesbare Ziele sagen
 *      nichts; LaTeX, Planzeilen, der Baustein „Tekst" und Cogita ebenso.
 *   3. Die Angaben: Buch, Kapitel, Artikel, Dokument, Pismo Święte, Netz —
 *      voll, „dz. cyt.", „Tamże", Bibliografie.
 *   4. Komentarze und Bereiche (2026-10-22): Bausteine mit echten Verweisen,
 *      Import/Export (Fassung 2, alte Felder → Komentarze), Einbetten mit
 *      Kreisschutz, unlesbare Ziele ohne Titel, die Umstellung (wohin jeder
 *      alte Wert geht, was umziehen muss, damit niemand mehr sieht als vorher).
 *   5. Der Text, gezeichnet: Fussnoten in Reihenfolge, Quellen darunter.
 *   6. Bücher: ISBN, Strichcode (ZXing), Katalog (MARC, ONIX), eigene Nummer,
 *      Zitate eines Buches (Format, Polecenie, Plan, Import, Export).
 *   7. Kazania (2026-10-21): der Plan (Lesen, Nummern, Einfügen), Wygłoszenia
 *      (was gesagt wurde, Zeiten, Links an die Stelle), Aspekte der Themen,
 *      die Zeichnung mit gewähltem Wygłoszenie und den Komentarzen an den
 *      Punkten, LaTeX, das Polecenie, JSON ins offene Formular, das Archiv
 *      (Zeilen, Filter samt Oberthemen, Zahlen — im Browser gerechnet).
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
export * from '${app}library/libraryKinds';
export * from '${app}library/libraryMarkup';
export * from '${app}library/libraryCite';
export * from '${app}library/comment';
export * from '${app}library/libraryMigrate';
export { planLibraryImport, exportLibrary, libraryDescription, LIBRARY_FORMAT, LIBRARY_VERSION } from '${app}library/libraryJson';
export { QuoteFigure, TextArticle } from '${app}library/LibraryText';
export { LibraryLines } from '${app}library/LibraryLines';
export { Markup as CogitaMarkup } from '${app}cogita/ui';
export { plainOf } from '${app}cogita/schema';
export { courseDescription } from '${app}cogita/json';
export * from '${app}library/isbn';
export * from '${app}library/libraryCatalog';
export * from '${app}library/libraryQuotes';
export { decodeGray } from '${app}library/barcode';
export { readAmount, patchFromDoc } from '${app}library/libraryJson';
export * from '${app}library/sermon';
export * from '${app}library/topics';
export * from '${app}library/bible';
export * from '${app}library/refIndex';
export { Relations, PassageBox, PassageList } from '${app}library/LibraryRelations';
export { textToLatex, planToLatex } from '${app}library/libraryLatex';
export { archiveRow, browseLocal, choose, facetKey, PROJECTS } from '${app}library/browse';
export { layoutOf } from '${app}library/archiveLayout';
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
  const cleared = m.planLibraryImport({ entries: [{ id: byKind.work.id, kind: 'work', data: { year: null } }] }, base);
  assert.equal(cleared.drafts[0].data.year, undefined, 'null clears a field');
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

  /* -- 2b. Kennungen im Speicher, Schlüssel im Editor (2026-10-22) ------------------------- */
  {
    const up = (t) => (t === 'a' ? 'ID-A' : t === 'b' ? 'ID-B' : t);
    const text = 'X [@a, s. 3; @b] y ^[n [@a]] [link](https://e.pl) \\[@a] [[Wort|@a]]\n\n![@b, J 1,1]\n\n[@zzz]';
    const mapped = m.mapRefTokens(text, up);
    assert.equal(mapped, 'X [@ID-A, s. 3; @ID-B] y ^[n [@ID-A]] [link](https://e.pl) \\[@a] [[Wort|@ID-A]]\n\n![@ID-B, J 1,1]\n\n[@zzz]', 'only reference tokens change: cites, notes, embeds, base links — escapes and links stay');
    assert.equal(m.mapRefTokens(mapped, (t) => (t === 'ID-A' ? 'a' : t === 'ID-B' ? 'b' : t)), text, 'and back, character for character');

    const W = { id: '11111111-1111-4111-8111-111111111111', kind: 'work', key: 'ratz', data: { workType: 'book', title: 'Jezus' } };
    const W2 = { id: '22222222-2222-4222-8222-222222222222', kind: 'work', key: 'ratz', data: { workType: 'book', title: 'Inny Ratzinger' } };
    const L1 = look([W]);
    assert.equal(m.storedText('Zob. [@ratz, s. 5] i [@nie-ma].', L1), `Zob. [@${W.id}, s. 5] i [@nie-ma].`, 'a key that resolves is stored as the id; an unknown key stays as typed');
    assert.equal(m.shownText(`Zob. [@${W.id}, s. 5].`, L1), 'Zob. [@ratz, s. 5].', 'the editor shows the key');
    /* Dieselbe Taste in zwei Bibliotheken: von hier aus führt „ratz" zu W — für W2 bleibt die Kennung stehen. */
    const both = { get: (id) => [W, W2].find((e) => e.id === id), byKey: (k) => (k === 'ratz' ? W : undefined) };
    assert.equal(m.shownText(`[@${W2.id}] [@${W.id}]`, both), `[@${W2.id}] [@ratz]`, 'an ambiguous key is never shown — the id stays, so the text keeps pointing at the right entry');

    const sermon = { id: 's1', kind: 'text', data: {
      body: 'A [@ratz, s. 1].', plan: [{ id: 'p1', text: 'Punkt [@ratz]' }]
    } };
    const stored = m.storedMarkup('text', sermon.data, L1);
    assert.equal(stored.body, `A [@${W.id}, s. 1].`);
    assert.equal(stored.plan[0].text, `Punkt [@${W.id}]`, 'plan points are text too');
    const comment = { subjects: [{ ref: W.id }], blocks: [{ type: 'paragraph', text: 'Por. [@ratz].' }, { type: 'table', columns: ['A'], rows: [[[{ text: 'zob. [@ratz]' }, { ref: W.id }]]] }] };
    const storedComment = m.storedMarkup('comment', comment, L1);
    assert.equal(storedComment.blocks[0].text, `Por. [@${W.id}].`);
    assert.equal(storedComment.blocks[1].rows[0][0][0].text, `zob. [@${W.id}]`, 'text runs in table cells too');
    assert.deepEqual(storedComment.blocks[1].rows[0][0][1], { ref: W.id }, 'real refs stay refs');
    assert.equal(m.storedMarkup('text', { body: 'bez odwołań' }, L1).body, 'bez odwołań');

    /* Die Taste ändert sich: der gespeicherte Text zeigt weiter auf denselben Eintrag. */
    const renamed = { ...W, key: 'ratzinger-jezus' };
    const html = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: { id: 's1', kind: 'text', data: stored }, look: look([renamed]) }));
    assert.ok(html.includes('Jezus') && !html.includes('brak źródła'), 'a renamed key orphans nothing: the footnote still finds the work');
    assert.deepEqual(m.nextAliases('ratz', 'ratzinger-jezus', []), ['ratz'], 'the old key stays as a second key');
    assert.deepEqual(m.nextAliases('b', 'a', ['a', 'c', 'C']), ['c', 'b'], 'never the new key, each once');

    /* JSON: hinaus mit Schlüsseln, herein wieder Kennungen — und nichts ändert sich. */
    const shelf = [W, { id: 's2', kind: 'text', key: 'kaz', data: { title: 'K', body: `Tekst [@${W.id}, s. 9].` } }];
    const S2 = look(shelf);
    const out = m.exportLibrary('x', shelf, S2);
    const outText = out.entries.find((e) => e.id === 's2');
    assert.equal(outText.data.body, 'Tekst [@ratz, s. 9].', 'the JSON shows keys');
    const back = m.planLibraryImport(out, S2);
    assert.equal(back.unchanged, shelf.length, 'export → import: the keys turn back into the same ids');
    const fresh = m.planLibraryImport({ entries: [{ kind: 'work', key: 'nowe', data: { title: 'Nowe' } }, { kind: 'text', data: { title: 'T', body: 'Cytuję [@nowe] i [@brak].' } }] }, look([]));
    const made = fresh.drafts.find((d) => d.kind === 'text');
    const work = fresh.drafts.find((d) => d.kind === 'work');
    assert.equal(made.data.body, `Cytuję [@${work.id}] i [@brak].`, 'import stores ids for keys of the same document');
    assert.ok(fresh.warnings.some((w) => w.includes('@brak')), 'an unknown key is reported');
    const aliased = m.planLibraryImport({ entries: [{ id: W.id, kind: 'work', key: 'ratz', data: { _aliases: ['stary'] } }] }, L1);
    assert.deepEqual(aliased.drafts[0].data._aliases, ['stary'], 'old keys travel through JSON without a warning');
    assert.equal(aliased.warnings.length, 0);
  }
  ok('ids in markup: only reference tokens are rewritten, stored as ids, shown as keys (ambiguous ones stay ids), a renamed key orphans nothing, JSON round trip');

  /* -- 2c. Ein Leser, nach Art gezeichnet (2026-10-22) -------------------------------------- */
  {
    const W = { id: 'w1', kind: 'work', key: 'ratz', data: { workType: 'book', title: 'Jezus z Nazaretu' } };
    const T = { id: 't1', kind: 'text', key: 'inny', data: { title: 'Chleb życia', date: '2026-08-02' } };
    const C = { id: 'c1', kind: 'comment', key: 'kom', data: { subjects: [{ ref: 'w1' }], blocks: [{ type: 'paragraph', text: 'Uwaga.' }] } };
    const L = { ...look([W, T, C]), readable: () => [W, T, C] };
    const inl = m.parseInline('Zob. [[ten tekst|@inny]] i [[ukryty|@tajny]].');
    assert.deepEqual(inl.filter((i) => i.t === 'ref').map((i) => i.key), ['inny', 'tajny'], '[[Wort|@klucz]] is a reference with its own words');
    assert.deepEqual(m.citedKeys('A [[x|@inny]] [@ratz]'), ['inny', 'ratz'], 'base links count as references (backlinks see them)');
    assert.ok(m.isSource(W) && m.isSource(undefined) && !m.isSource(T) && !m.isSource(C), 'works, quotes, persons are sources; own entries are not; an unreadable target stays a footnote');

    const entry = { id: 's', kind: 'text', data: { title: 'K', body: 'Raz [@ratz, s. 3; @inny]. Dwa [@kom]. Trzy [[ten tekst|@inny]] i [[ukryty|@tajny]].' } };
    const html = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry, look: L }));
    const notes = [...html.matchAll(/<li id="fn-(\d+)">(.*?)<\/li>/g)].map((x) => x[2].replace(/<[^>]+>/g, ''));
    assert.equal(notes.length, 1, 'one footnote: only the work');
    assert.ok(notes[0].includes('Jezus z Nazaretu') && !notes[0].includes('Chleb'), 'the own text is not in the footnote');
    assert.ok(html.includes('(zob. <span class="lib-own-ref">Chleb życia</span>)'), 'an own text cited in a bracket: „(zob. its title)" in the line');
    assert.ok(!html.includes('Zob. komentarz'), 'a comment is never a footnote');
    assert.ok(html.includes('<span class="lib-own-ref">ten tekst</span>'), '[[…|@…]] shows its own words');
    assert.ok(html.includes('<span class="lib-own-ref is-unreadable">ukryty</span>') && !html.includes('tajny'), 'an unreadable target: its words, no link, nothing about the target');
    const linked = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry, look: L, hrefOf: (e) => `#/x/${e.id}` }));
    assert.ok(linked.includes('<a class="lib-own-ref" href="#/x/t1">Chleb życia</a>'), 'in the workspace an own entry links to its editor');

    const latex = m.textToLatex(entry, L);
    assert.ok(latex.includes('(zob. \\emph{Chleb życia})'), 'LaTeX: the own text by its title in the line');
    assert.equal((latex.match(/\\footnote\{/g) ?? []).length, 1, 'LaTeX: one footnote — the work');
    assert.ok(m.pointLine('Punkt [@inny] [@ratz, s. 1]', L).startsWith('Punkt (zob. Chleb życia) (Jezus'), 'a plan line: „(zob. title)", the source in brackets');
    assert.equal(m.wordCount('Zob. [[ten tekst|@inny]].'), 3, 'base links count with their words');
    assert.equal(m.safeHref('//obcy.pl/x'), null, 'no protocol-relative address');
    assert.equal(m.safeHref('/#/rc/o-nas'), '#/rc/o-nas');
    assert.equal(m.safeHref('www.recreatio.pl'), 'https://www.recreatio.pl');

    /* Der Baustein „Tekst" (ohne geöffnete Bibliothek): dieselben Zeilen, Fussnoten unter dem Baustein. */
    const lines = m.renderToStaticMarkup(m.createElement(m.LibraryLines, { library: '', lines: ['## Śródtytuł', 'Tekst **mocny** [@ratz] i ^[uwaga] oraz [[słowo|@inny]].', '> cicho'], prefix: 't-' }));
    assert.ok(lines.includes('<h3 class="wk-card-sub">Śródtytuł</h3>') && lines.includes('wk-card-quiet') && lines.includes('<strong>mocny</strong>'), 'page text: its lines, the one reader inside');
    assert.equal((lines.match(/<li id="t-fn-/g) ?? []).length, 2, 'page text: a source and a note become footnotes under the module');
    assert.ok(lines.includes('słowo') && !lines.includes('@inny') && !lines.includes('ratz'), 'page text: nothing about what it cannot open');

    /* Cogita: derselbe Leser über die Baza wiedzy. */
    const cg = m.renderToStaticMarkup(m.createElement(m.CogitaMarkup, { text: '## Teza\n\nZdanie [@ratz, s. 3] i [[tekst|@inny]].', lib: { markupLook: L } }));
    assert.ok(cg.includes('lib-h') && cg.includes('lib-own-ref') && cg.includes('Jezus z Nazaretu') && cg.includes('Przypisy'), 'Cogita: headings, a source footnote, a link — the same pieces');
    assert.equal(m.plainOf('Księgi [[Samuela|@samuel]] to część Biblii [@bt, J 3,16].'), 'Księgi Samuela to część Biblii.', 'Cogita plain text from the same reader');
    const told = m.libraryDescription();
    assert.ok(told.includes('[[te słowa|@klucz]]') && told.includes('nigdy przypis') && told.includes('[odwołanie niedostępne]'), 'the library description tells an AI: sources are cited, own entries linked');
    assert.ok(m.courseDescription().includes('[[słowo|@wpis]]') && m.courseDescription().includes('staje się przypisem'), 'the Cogita description says the same');
    assert.ok(m.courseDescription().includes('"kinds": ["quote"]') && m.courseDescription().includes('"from": "<identyfikator biblioteki>"'), 'the Cogita description shows templates and revisions over library material (step 5)');
  }
  ok('one reader, drawn by kind: sources are footnotes, own entries are links (also [[words|@key]]), unreadable targets say nothing; LaTeX, plan lines, page text and Cogita alike');

  /* -- 2d. Stellen der Schrift, das Verzeichnis der Verweise (2026-10-22) ------------------------ */
  {
    const book = (name) => m.bookOf(name)?.id;
    assert.deepEqual(['Dz', 'Act', 'Acts', 'Dzieje Apostolskie', 'Actus Apostolorum'].map(book), ['Acts', 'Acts', 'Acts', 'Acts', 'Acts'], 'one book in three languages');
    assert.deepEqual(['1 Kor', 'I Cor', '1Cor', '1 Corinthians', '1 List do Koryntian'].map(book), Array(5).fill('1Cor'), 'numbered books, also Roman and written out');
    assert.deepEqual(['Łk', 'Lc', 'Lk', 'Luke', 'J', 'Jn', 'Io', '1 J', 'Ap', 'Rev', 'Ewangelia według św. Jana', 'List do Rzymian', 'Hi', 'Job'].map(book),
      ['Luke', 'Luke', 'Luke', 'Luke', 'John', 'John', 'John', '1John', 'Rev', 'Rev', 'John', 'Rom', 'Job', 'Job']);
    assert.equal(book('s'), undefined, 'a page is no book');

    const one = (text) => m.parseBible(text).map((x) => [x.book, x.from.c, x.from.v, x.to.c, x.to.v]);
    assert.deepEqual(one('Dz 1,14'), [['Acts', 1, 14, 1, 14]]);
    assert.deepEqual(one('Dz 1:14'), one('Dz 1,14'), 'colon or comma');
    assert.deepEqual(one('Acts 1,14'), one('Dz 1,14'), 'English book, Polish separator');
    assert.deepEqual(one('Dz 1,8.14'), [['Acts', 1, 8, 1, 8], ['Acts', 1, 14, 1, 14]], 'a Polish list');
    assert.deepEqual(one('Acts 1:8,14'), one('Dz 1,8.14'), 'an English list');
    assert.deepEqual(one('Dz 1,14-16'), [['Acts', 1, 14, 1, 16]], 'a range');
    assert.deepEqual(one('Łk 1,26–2,5'), [['Luke', 1, 26, 2, 5]], 'over a chapter');
    assert.deepEqual(one('Ps 23'), [['Ps', 23, null, 23, null]], 'a whole psalm');
    assert.deepEqual(one('Rdz 1-3'), [['Gen', 1, null, 3, null]], 'chapters');
    assert.deepEqual(one('Mt 5,3-12; 6,1; Łk 6,20'), [['Matt', 5, 3, 5, 12], ['Matt', 6, 1, 6, 1], ['Luke', 6, 20, 6, 20]], 'several places, the book carries on');
    assert.deepEqual(one('Ps 51(50),3'), [['Ps', 51, 3, 51, 3]], 'the second numbering of the psalms is dropped');
    assert.deepEqual(one('Ps 22,2a'), [['Ps', 22, 2, 22, 2]], 'part of a verse');
    assert.deepEqual(one('Mk 16,9nn'), [['Mark', 16, 9, 16, null]], '„i następne" to the end of the chapter');
    assert.deepEqual(one('s. 23').concat(one('nr 24'), one('')), [], 'not the Scripture');

    const hit = (a, b) => m.anyOverlap(m.parseBible(a), m.parseBible(b));
    assert.ok(hit('Dz 1,12-14', 'Dz 1:14') && hit('Dz 1', 'Acts 1:14') && !hit('Dz 1,15', 'Dz 1,14') && !hit('Łk 1,14', 'Dz 1,14'), 'overlap: a range, a chapter, not the next verse, not another book');
    const order = ['Dz 1,14', 'Dz 1,8', 'Mt 5,3', 'Rdz 1,1', 'Dz 2,1'].sort((a, b) => m.bibleKey(a).localeCompare(m.bibleKey(b)));
    assert.deepEqual(order, ['Rdz 1,1', 'Mt 5,3', 'Dz 1,8', 'Dz 1,14', 'Dz 2,1'], 'canonical order: the canon, then chapter, then verse');
    assert.deepEqual(['s. 10', 's. 9', 's. 100'].sort((a, b) => m.locatorKey(a, false).localeCompare(m.locatorKey(b, false))), ['s. 9', 's. 10', 's. 100'], 'pages as numbers');
    assert.equal(m.formatBible(m.parseBible('Acts 1:14-16; 2:1')), 'Dz 1,14-16; Dz 2,1');
    assert.equal(m.formatSpan(m.parseBible('Dz 1,14')[0], 'en'), 'Acts 1:14');

    /* Zitate in der Ordnung der Schrift. */
    const BT = { id: '00000000-0000-4000-8000-0000000000b1', kind: 'work', key: 'bt', data: { workType: 'bible', title: 'Biblia Tysiąclecia', siglum: 'BT' } };
    const VG = { id: '00000000-0000-4000-8000-0000000000b2', kind: 'work', key: 'vg', data: { workType: 'bible', title: 'Nova Vulgata', siglum: 'Vg' } };
    const q = (id, locator) => ({ id, kind: 'quote', key: id, data: { text: id, work: [BT.id], locator } });
    const quotes = [q('q14', 'Dz 1,14'), q('q8', 'Dz 1,8'), q('qr', 'Rdz 1,1')];
    const QL = look([BT, ...quotes]);
    assert.deepEqual([...quotes].sort((a, b) => m.quoteOrder(a, QL).localeCompare(m.quoteOrder(b, QL))).map((x) => x.id), ['qr', 'q8', 'q14'], 'quotes of the Bible in canonical order');

    /* Verweise eines Eintrags: Felder, Zapis mit Stelle, Gegenstände, Zellen, Quellen eines unsicheren Wertes, Dokumente. */
    const resolve = (t) => ({ bt: BT.id, kom: 'k1' }[t]);
    const refs = (data) => m.refsOf({ data }, resolve).map((r) => [r.target, r.locator, r.field, r.at ?? '']);
    assert.deepEqual(refs({ text: 'x', work: [BT.id], locator: 'Dz 1,14' }), [[BT.id, 'Dz 1,14', 'work', '']], 'a quote: its work at its place');
    assert.deepEqual(refs({ body: 'A [@bt, Dz 1,14]. B [[słowo|@kom]].', plan: [{ id: 'p1', text: 'Punkt [@bt, Dz 1,8]' }] }),
      [[BT.id, 'Dz 1,14', 'body', ''], ['k1', '', 'body', ''], [BT.id, 'Dz 1,8', 'plan', 'p1']], 'markup with places; a plan point says which point');
    assert.deepEqual(refs({ subjects: [{ ref: BT.id, locator: 'Dz 1,12-14' }], blocks: [{ type: 'table', columns: ['a'], rows: [[[{ text: 'zob.' }, { ref: BT.id, locator: 'Łk 1,35' }]]] }] }),
      [[BT.id, 'Dz 1,12-14', 'subjects', ''], [BT.id, 'Łk 1,35', 'blocks', '']], 'a comment: what it is about, what its cells name');
    assert.deepEqual(refs({ born: { value: '1999', state: 'disputed', source: { work: BT.id, locator: 'Dz 1,14' } }, _kinds: ['00000000-0000-4000-8000-00000000000f'] }),
      [[BT.id, 'Dz 1,14', 'born', '']], 'Cogita: the source of an uncertain value; bookkeeping (_kinds) does not count');
    assert.deepEqual(refs({ name: 'Powtórka', graph: { nodes: [{ id: 'n1', config: { list: ['k1', 'x', BT.id] } }] } }).map((r) => r[0]), [BT.id], 'a document: every id in it');

    /* Das Verzeichnis über zwei Bibliotheken und eine Baza wiedzy — Schlüssel gelten zuerst im eigenen Speicher. */
    const store = (libraryId, entries, books = true) => ({ libraryId, revision: 1, books, all: () => entries, ownByKey: (k) => entries.find((e) => e.key === k) });
    const text = { id: 't1', kind: 'text', key: 'kaz', data: { title: 'Kazanie', body: 'Wstęp [@bt, Dz 1,14].', plan: [{ id: 'p9', text: 'Modlitwa [@bt, Acts 1:14]' }] } };
    const comment = { id: 'c1', kind: 'comment', key: 'kom', data: { subjects: [{ ref: BT.id, locator: 'Dz 1,12-14' }], blocks: [{ type: 'paragraph', text: 'Trwali jednomyślnie.' }] } };
    const far = { id: 'qx', kind: 'quote', key: 'qx', data: { text: 'Inny', work: [BT.id], locator: 'Dz 1,15' } };
    const latin = { id: 'qv', kind: 'quote', key: 'qv', data: { text: 'Hi omnes erant perseverantes', work: [VG.id], locator: 'Act 1,14' } };
    const E1 = '00000000-0000-4000-8000-0000000000e1';
    const E2 = '00000000-0000-4000-8000-0000000000e2';
    const knowledge = { id: E1, kind: 'entity', data: { _kinds: ['knowledge'], text: 'Apostołowie trwali na modlitwie [@bt, Dz 1,14] z [[Maryją|@maryja]].' } };
    const maryja = { id: E2, kind: 'entity', key: 'maryja', data: { _kinds: ['person'], name: 'Maryja' } };
    const revision = { id: 'r1', kind: 'revision', data: { name: 'Dzieje', graph: { nodes: [{ id: 'n', config: { list: [E1, E2] } }] } } };
    const merge = { id: 'm1', kind: 'merge', data: { from: E2, to: E1 } };
    const A = store('lib-a', [BT, ...quotes, text, comment, far]);
    const B = store('lib-b', [VG, latin]);
    const K = store('base-k', [knowledge, maryja, revision, merge], false);
    const index = m.referenceIndex([A, B, K], (s) => s.books);
    assert.deepEqual(index.to(E2).map((h) => h.from.id).sort(), [E1, 'r1'], 'a base entry: a knowledge text links it, a revision uses it — the merge does not count');
    assert.ok(index.to(BT.id).some((h) => h.from.id === E1 && h.ref.locator === 'Dz 1,14'), 'a knowledge base citing a library Bible (key resolved through the libraries)');
    assert.equal(m.referenceIndex([A, B, K], (s) => s.books), index, 'unchanged stores: the same index');

    const found = m.passageHits(index, m.parseBible('Dz 1:14'));
    const who = found.map((f) => [f.hit.from.id, f.hit.ref.field, f.hit.ref.at ?? '', f.work.id === VG.id ? 'Vg' : 'BT']);
    assert.deepEqual(new Set(who.map((w) => w[0])), new Set(['q14', 't1', 'c1', E1, 'qv']), 'Dz 1:14 finds the quote, the sermon (body and plan point), the comment (Dz 1,12-14), the knowledge entry and the Latin quote — not Dz 1,15');
    assert.ok(who.some((w) => w[0] === 't1' && w[1] === 'plan' && w[2] === 'p9'), 'the plan point is named');
    assert.ok(who.some((w) => w[0] === 'qv' && w[3] === 'Vg'), 'in another edition of the Scripture too');
    assert.deepEqual(m.passageHits(index, []), [], 'nothing typed, nothing found');
    assert.ok(m.libraryDescription().includes('Łk 1,26–2,5') && m.libraryDescription().includes('Acts 1:14'), 'the description tells an AI how to write a place in the Scripture');
    /* Die Kästen zeichnen (ohne offene Speicher im Prüfling: nur der Rahmen). */
    const fake = { libraryId: 'lib-a', revision: 1, title: (e) => String(e.data.title ?? e.data.text ?? e.id), get: () => undefined, byKey: () => undefined, readable: () => [], all: () => [], ownByKey: () => undefined };
    const rel = m.renderToStaticMarkup(m.createElement(m.Relations, { store: fake, library: { libraryId: 'lib-a', writes: true }, entry: { ...BT, libraryId: 'lib-a' } }));
    assert.ok(rel.includes('Powiązania') && rel.includes('Sprawdź strony') && rel.includes('Szukaj we wszystkich'), 'the relations box draws');
    const passage = m.renderToStaticMarkup(m.createElement(m.PassageList, { store: fake, spans: m.parseBible('Dz 1:14') }));
    assert.ok(passage.includes('Dz 1,14') && passage.includes('nic tu nie wskazuje'), 'the passage list draws');
  }
  ok('Scripture: books in Polish, Latin and English, ranges, lists, chapters, canonical order; the reference index over libraries and knowledge bases (fields, markup with places, comment subjects and cells, sources of values, documents); a passage found in every edition');

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

  /* -- 4. Komentarze und Bereiche ------------------------------------------------------------- */
  {
    /* Bausteine: duldsam gelesen, ein blosser String ist Text, Verweise sind echte Verweise. */
    const blocks = m.blocksOf({ blocks: [
      'Prosa',
      { type: 'table', columns: ['Łk', 'Dz'], rows: [[[{ ref: 'bt', locator: 'Łk 1,35' }], [{ ref: 'bt', locator: 'Dz 1,8' }]], ['zstąpi na ciebie', 'zstąpi na was']] },
      { type: 'ordered', items: ['najpierw', [{ text: 'potem ' }, { ref: 'q' }]] },
      { type: 'heading', text: 'nie ma takiego bloku' },
      { type: 'paragraph', text: '   ' }
    ] });
    assert.deepEqual(blocks.map((x) => x.type), ['paragraph', 'table', 'ordered'], 'four block types only; empty and unknown blocks fall away');
    assert.deepEqual(blocks[1].rows[1], [[{ text: 'zstąpi na ciebie' }], [{ text: 'zstąpi na was' }]], 'a plain string in a cell is text');
    assert.deepEqual(m.blockRefs(blocks), [{ ref: 'bt', locator: 'Łk 1,35' }, { ref: 'bt', locator: 'Dz 1,8' }, { ref: 'q', locator: '' }]);
    assert.equal(m.blocksOf({ blocks: [{ type: 'paragraph', text: '' }] }, 'blocks', true).length, 1, 'the editor keeps an empty block');
    const c1 = { id: 'c1', kind: 'comment', key: 'paralela', data: { subjects: [{ ref: 'bt', locator: 'Łk 1,35' }, { ref: 'sermon', point: 'p1' }], blocks: blocks.map(m.blockData) } };
    assert.deepEqual(m.pairedWith('bt', 'Dz 1,8', [c1]).map((p) => p.locator), ['Łk 1,35'], 'what Dz 1,8 was set beside, in the same row');
    assert.deepEqual(m.commentsAbout('sermon', [c1], 'p1').map((c) => c.id), ['c1'], 'a comment about a point of a plan');
    assert.deepEqual(m.commentsAbout('sermon', [c1], '').map((c) => c.id), [], '… is not one about the whole text');
    assert.deepEqual(m.fieldRefs(c1).sort(), ['bt', 'q', 'sermon'], 'subjects and cell refs are references (backlinks, reach)');

    /* JSON: Fassung 2, Bausteine mit Verweisen per @schlüssel, Export → Import ändert nichts. */
    const shelf = [
      { id: 'bt', kind: 'work', key: 'bt', data: { workType: 'bible', title: 'Pismo Święte', siglum: 'BT' } },
      { id: 'q', kind: 'quote', key: 'q', data: { text: 'Modlitwa jest rozmową.', work: 'bt', locator: 'J 1,1' } }
    ];
    const S = look(shelf);
    const doc = { format: m.LIBRARY_FORMAT, version: m.LIBRARY_VERSION, entries: [{ kind: 'comment', key: 'nowy', data: {
      subjects: [{ ref: '@bt', locator: 'Łk 1,35' }],
      blocks: [{ type: 'table', columns: ['A', 'B'], rows: [[[{ ref: '@bt', locator: 'Łk 1,35' }], [{ ref: '@q' }, { text: ' i więcej' }]]] }, { type: 'unordered', items: [[{ ref: '@nieznany' }]] }]
    } }] };
    const planned = m.planLibraryImport(doc, S);
    const made = planned.drafts[0];
    assert.equal(made.kind, 'comment');
    assert.deepEqual(made.data.subjects, [{ ref: 'bt', locator: 'Łk 1,35' }], 'subjects resolve @keys');
    assert.deepEqual(made.data.blocks[0].rows[0], [[{ ref: 'bt', locator: 'Łk 1,35' }], [{ ref: 'q' }, { text: ' i więcej' }]], 'refs inside table cells resolve, text runs stay');
    assert.ok(planned.warnings.some((w) => w.includes('nieznany')), 'an unknown ref is reported, not kept as text');
    const stored = [...shelf, { id: made.id, kind: 'comment', key: made.key, data: made.data }];
    const again = m.planLibraryImport(m.exportLibrary('x', stored), look(stored));
    assert.equal(again.unchanged, stored.length, 'export → import keeps block types and references');
    assert.equal(m.exportLibrary('x', stored).version, 2, 'the format version is 2');

    /* Fassung 1: was in description/notes stand (und die Notiz am Punkt), wird ein Komentarz. */
    const old = m.planLibraryImport({ format: m.LIBRARY_FORMAT, version: 1, entries: [
      { kind: 'quote', key: 'q2', data: { text: 'Y', work: '@bt', description: 'Opis.\n\nDrugi akapit.', notes: 'Moja notatka' } },
      { kind: 'text', key: 't2', data: { title: 'T', plan: [{ id: 'p1', text: 'Myśl', note: 'tu pauza' }, { text: 'Bez notatki' }] } }
    ] }, S);
    const quote = old.drafts.find((d) => d.kind === 'quote');
    const text = old.drafts.find((d) => d.kind === 'text');
    const comments = old.drafts.filter((d) => d.kind === 'comment');
    assert.equal(quote.data.description, undefined, 'no description on a quote any more');
    assert.equal(quote.data.notes, undefined);
    assert.equal(text.data.plan[0].note, undefined, 'no note on a point any more');
    assert.equal(comments.length, 3, 'description, notes and the point note became comments');
    assert.deepEqual(comments.map((c) => c.data.subjects[0]).map((s) => [s.ref === quote.id || s.ref === text.id, s.point ?? '']).sort(), [[true, ''], [true, ''], [true, 'p1']]);
    assert.deepEqual(comments.find((c) => c.data.blocks.length === 2).data.blocks.map((x) => x.text), ['Opis.', 'Drugi akapit.'], 'paragraphs stay paragraphs');
    assert.ok(old.warnings.some((w) => w.includes('komentarz')), 'the conversion is said');
    assert.deepEqual(old.drafts.map((d) => d.kind).slice(-3), ['comment', 'comment', 'comment'], 'comments are saved last (after what they name)');

    /* Die Beschreibung für die KI: kein „prywatne", die Regel des Bereichs, ein Beispiel mit Tabelle. */
    const said = m.libraryDescription();
    assert.ok(!said.includes('prywatne — nigdy') && !said.includes('co opublikujesz'), 'no privacy markers, no publishing');
    assert.ok(said.includes('decyduje wyłącznie obszar'), 'the area rule in one line');
    assert.ok(said.includes('"type": "table"') && said.includes('"comment"'), 'a worked comment example with a table');

    /* Gezeichnet: eingebettet, mit Tabelle; ein Kreis wird erkannt; ein unlesbares Ziel bleibt ohne Titel. */
    const ring = [
      ...shelf,
      { id: 'c2', kind: 'comment', key: 'c2', data: { subjects: [{ ref: 'q' }], blocks: [{ type: 'paragraph', text: 'Dwa [@bt, J 1,1].\n\n![@c3]' }, { type: 'table', columns: ['Tu', 'Tam'], rows: [[[{ ref: 'bt', locator: 'Łk 1,35' }], [{ ref: 'tajny' }]]] }] } },
      { id: 'c3', kind: 'comment', key: 'c3', data: { subjects: [{ ref: 'c2' }], blocks: [{ type: 'paragraph', text: 'Trzy.\n\n![@c2]' }] } }
    ];
    const R = { ...look(ring), readable: () => ring };
    const sermon = { id: 's', kind: 'text', data: { title: 'K', body: 'Wstęp [@c2].\n\n![@c2]\n\n![@tajny-klucz]' } };
    const html = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: sermon, look: R }));
    assert.ok(html.includes('<table class="lib-table">') && html.includes('Łk 1,35'), 'an embedded comment brings its table; a Bible ref shows its place');
    assert.ok(html.includes('Trzy.') && html.includes('[komentarz osadza sam siebie]'), 'c2 → c3 → c2: the cycle stops');
    assert.ok(!html.includes('Zob. komentarz') && html.includes('class="lib-own-ref"'), 'a comment cited in the text is a link, never a footnote (2026-10-22)');
    assert.equal((html.match(/\[odwołanie niedostępne\]/g) ?? []).length, 2, 'an unreadable cell ref and an unreadable embed say only that');
    assert.ok(!html.includes('tajny'), '… and nothing about the target, not even its key');
    assert.ok(/J 1,1/.test(html.slice(html.indexOf('Przypisy'))), 'a footnote inside an embedded comment is counted with the text');
    const quoteHtml = m.renderToStaticMarkup(m.createElement(m.QuoteFigure, { entry: ring[1], look: R }));
    assert.ok(quoteHtml.includes('Komentarze (1)'), 'comments about a quote are reachable where it is shown');
    assert.ok(m.textToLatex(sermon, R).includes('\\begin{tabular}'), 'LaTeX: a comment table is a tabular');

    /* Die Umstellung: wohin jeder alte Wert geht, was umzieht. */
    const lib = (id, extra) => ({ libraryId: id, areaId: `a-${id}`, name: id, writes: true, areaPublic: false, areaRuleAt: null, kind: 'books', ...extra });
    const store = (entries) => ({ all: () => entries, own: (id) => entries.find((e) => e.id === id), title: (e) => e.id });
    const E = (id, kind, data, publishedAs = null) => ({ id, kind, data, publishedAs, libraryId: '', version: 1 });
    const pub = { library: lib('pub', { areaPublic: true }), store: store([
      E('qa', 'quote', { text: 'a', description: 'Opis A', notes: 'Prywatne A' }),
      E('qb', 'quote', { text: 'b' }, 'explicit'),
      E('dh', 'delivery', { date: '2026-01-01', hidden: 'yes' })
    ]) };
    const shared = { library: lib('shared'), store: store([
      E('proj', 'project', { title: 'Kazania Maryjne', notes: 'plan' }, 'explicit'),
      E('tx', 'text', { title: 'T', plan: [{ id: 'p1', text: 'A', note: 'pauza' }] })
    ]) };
    const mine = { library: lib('mine', { areaId: 'me' }), store: store([E('pt', 'topic', { name: 'X', notes: 'tylko ja' })]) };
    const done = { library: lib('done', { areaPublic: true, areaRuleAt: '2026-10-22', writes: false }), store: store([E('ok', 'quote', { text: 'c' })]) };
    const tidy = m.planTidy([pub, shared, mine, done], 'me');
    const where = Object.fromEntries(tidy.comments.map((c) => [c.key, c.target]));
    assert.equal(where['qa:description'], 'with-entry', 'a description goes with its entry');
    assert.equal(where['qa:notes'], 'mine', 'a private note goes to the private library');
    assert.equal(where['proj:notes'], 'mine');
    assert.equal(where['tx:plan:p1'], 'mine', 'the note of a point too, with its point');
    assert.equal(where['pt:notes'], 'mine', 'a note already in the private library stays there');
    const moves = Object.fromEntries(tidy.moves.map((x) => [x.entryId, [x.reason, x.target]]));
    assert.deepEqual(moves.qa, ['exposure', 'mine'], 'never published in a public area: would become public → private by default');
    assert.deepEqual(moves.dh, ['exposure', 'mine'], 'a hidden delivery in a public area too');
    assert.equal(moves.qb, undefined, 'published in a public area: nothing changes');
    assert.deepEqual(moves.proj, ['publicity', 'pub'], 'published in a closed area: would disappear → the public library by default');
    assert.ok(tidy.moves.find((x) => x.entryId === 'qa').options.includes(null), '… and either can stay, by choice');
    assert.equal(moves.ok, undefined, 'a library already settled is left alone');
    assert.deepEqual([...tidy.settle].sort(), ['mine', 'pub', 'shared'], 'every library not yet settled is settled at the end');
    assert.deepEqual(tidy.unpublish.get('pub'), ['qb'], 'old public copies are withdrawn');
    assert.deepEqual(m.legacyFields(pub.store.own('dh')), ['hidden']);
    const clean = m.stripped(shared.store.own('tx'));
    assert.deepEqual(clean.plan, [{ id: 'p1', text: 'A' }], 'step 2 removes the note from the point');
    assert.equal(m.stripped(pub.store.own('qa')).description, undefined);
    const ro = m.planTidy([{ ...shared, library: { ...shared.library, writes: false } }], 'me');
    assert.deepEqual([ro.blocked, ro.comments.length, ro.moves.length], [['shared'], 0, 0], 'a library I only read is not touched — it is named');
    const noPrivate = m.planTidy([pub], null);
    assert.equal(noPrivate.comments.find((c) => c.key === 'qa:notes').target, m.PERSONAL, 'without a private library one is made');
  }
  ok('comments: four blocks with real refs, JSON v2 round trip, v1 fields → comments, embed + cycle guard, unreadable refs, the migration plan');

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
    assert.equal(fresh.photo, undefined, 'no photo numbers: the photos stay in the own chat');
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
    assert.equal(saved[1].data.notes, undefined, 'a quote has no notes any more (v1 notes → a comment)');
    assert.deepEqual(saved[2], { kind: 'comment', data: { subjects: [{ ref: saved[1].id }], blocks: [{ type: 'paragraph', text: 'por. Dn 10' }] }, id: 'new-2' }, 'the comment about the quote');
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
    assert.ok(!description.includes('"photo" — '), 'no photo field any more');
    for (const extra of ['page', 'uncertain', 'id']) assert.ok(description.includes(`"${extra}" — `), `quotes description explains ${extra}`);
    const promptMarked = m.quotesPrompt(book, shelf, 'marked');
    assert.ok(promptMarked.includes('ołówkiem') && promptMarked.includes('Wielkość świętego Michała Archanioła') && promptMarked.includes('Modlitwa'), 'the prompt names the book, the pencil and the topics');
    assert.ok(promptMarked.includes(m.QUOTES_FORMAT), 'the format goes along to the own chat');
    const promptWhole = m.quotesPrompt(book, shelf, 'whole');
    assert.ok(promptWhole.includes('cały tekst') && promptWhole.includes(m.QUOTES_FORMAT), 'also when the whole photo is the quote');
    assert.equal(m.QUOTES_TOOL, undefined, 'no AI is called from the app');
    ok('quotes of a book: duplicates, hyphenation, pages, topics by name, import with new topics, export → import, description from the kind, prompt');
  }

  /* -- 7. Kazania: Plan, Wygłoszenia, Aspekte ------------------------------------------------- */
  {
    /* Der Plan, duldsam gelesen: leere Punkte fallen weg, keine Stufe springt um zwei, ohne Kennung eine aus der Stelle. */
    const plan = m.planOf({ plan: [
      { id: 'p1', text: 'Głód', depth: 0 }, { id: 'p2', text: 'Za głęboko', depth: 2 }, { text: '  ' }, { text: 'Bez kennung', depth: 1, kind: 'nonsense' },
      { id: 'p4', text: '![@q]', depth: 2 }, { id: 'p5', text: 'Druga', depth: 0, kind: 'question' }
    ] });
    assert.deepEqual(plan.map((p) => [p.id, p.depth, p.kind]), [['p1', 0, 'thought'], ['p2', 1, 'thought'], ['#4', 1, 'thought'], ['p4', 2, 'quote'], ['p5', 0, 'question']],
      'plan: depth never jumps by two, empty points go, an embed alone is a quote, unknown kinds are thoughts');
    assert.equal(m.planOf({ plan: [{ id: 'a', text: '' }] }, { keepEmpty: true }).length, 1, 'the editor keeps an empty point');
    assert.deepEqual([...m.pointNumbers(plan).values()], ['1', '1.1', '1.2', '1.2.1', '2'], 'numbers as on the pulpit');
    assert.deepEqual(m.pointData({ id: 'x', text: 'T', depth: 0, kind: 'thought', note: '' }), { id: 'x', text: 'T' }, 'defaults are not stored');
    const taken = new Set(['pa']);
    const fresh = m.newPointId((id) => taken.has(id));
    assert.ok(/^p[a-z0-9]{4}$/.test(fresh) && !taken.has(fresh), `a new point id is short and free (${fresh})`);

    const pasted = m.planFromText('1. Głód chleba\n   a) przykład z domu\n   > Ja jestem chlebem życia\n2. Szukam Boga?\n\t- jak?\n2.1. Podpunkt\nI. Rzymska');
    assert.deepEqual(pasted.map((p) => [p.text, p.depth, p.kind]), [
      ['Głód chleba', 0, 'thought'], ['przykład z domu', 1, 'thought'], ['Ja jestem chlebem życia', 1, 'quote'],
      ['Szukam Boga?', 0, 'question'], ['jak?', 1, 'question'], ['Podpunkt', 1, 'thought'], ['Rzymska', 0, 'thought']
    ], 'pasting a plan: numbers, letters, indentation, bullets, > quotes, ? questions, a Roman numeral is a main point');

    /* Zeit und Stelle. */
    assert.deepEqual(['4:30', '1:02:05', '95', 'abc'].map(m.secondsOf), [270, 3725, 95, null]);
    assert.deepEqual([270, 3725, 5].map(m.timeText), ['4:30', '1:02:05', '0:05']);
    assert.equal(m.timeLink('https://www.youtube.com/watch?v=abc', 95), 'https://www.youtube.com/watch?v=abc&t=95s', 'YouTube at the place');
    assert.equal(m.timeLink('https://youtu.be/abc', 95), 'https://youtu.be/abc?t=95s');
    assert.equal(m.timeLink('https://vimeo.com/123', 95), 'https://vimeo.com/123#t=95s');
    assert.equal(m.timeLink('https://example.pl/k/2026-08-02.mp3', 95), 'https://example.pl/k/2026-08-02.mp3#t=95', 'a file by media fragment');
    assert.equal(m.timeLink('https://example.pl/kazanie', 95), null, 'a page has no place');
    assert.deepEqual(['https://x.pl/a.mp3', 'https://x.pl/a.MP4?x=1', 'https://youtu.be/a', 'ftp://x/a.mp3'].map(m.mediaFile), ['audio', 'video', null, null]);

    /* Eine kleine Bibliothek mit Aspekten, einem Kazanie, drei Wygłoszenia und einem Komentarz an einem Punkt. */
    const E = (id, kind, data, key) => ({ id, kind, ...(key === undefined ? {} : { key }), data });
    const entries = [
      ...lib.all(),
      E('t-okres', 'topic', { name: 'Okres liturgiczny', aspect: 'yes', order: 1 }, 'okres'),
      E('t-adwent', 'topic', { name: 'Adwent', parent: 't-okres', order: 1 }, 'adwent'),
      E('t-adwent1', 'topic', { name: 'I Niedziela Adwentu', parent: 't-adwent' }, 'adwent1'),
      E('t-post', 'topic', { name: 'Wielki Post', parent: 't-okres', order: 3 }, 'post'),
      E('t-temat', 'topic', { name: 'Temat', aspect: 'yes', order: 2 }, 'temat'),
      E('t-nadzieja', 'topic', { name: 'Nadzieja', parent: 't-temat' }, 'nadzieja'),
      E('t-rozne', 'topic', { name: 'Różne' }, 'rozne'),
      E('sermon', 'text', {
        textType: 'sermon', title: 'Chleb', date: '2020-01-01', topics: ['t-adwent1', 't-nadzieja'],
        plan: [
          { id: 'p1', text: 'Głód, którego nie nasyci chleb [@bt, J 6,35]', depth: 0 },
          { id: 'p2', text: '![@q]', depth: 1, kind: 'quote' },
          { id: 'p3', text: 'Chleb w domu', depth: 1, kind: 'example' },
          { id: 'p4', text: 'Gdzie szukam?', depth: 0, kind: 'question' },
          { id: 'p5', text: 'Zastosowanie na tydzień', depth: 0, kind: 'application' }
        ],
        body: 'Treść [@jezus, s. 5].'
      }, 'chleb'),
      E('d1', 'delivery', {
        texts: ['sermon'], date: '2026-08-02', occasion: 'XVIII Niedziela zwykła', audio: 'https://example.pl/k/d1.mp3',
        coverage: [{ point: 'p1', state: 'said', at: '0:40' }, { point: 'p2', state: 'short', note: 'Bez całego cytatu' }, { point: 'p3', state: 'skipped' }],
        added: [{ text: 'Zaproszenie na adorację', at: '12:50', after: 'p4' }]
      }),
      E('d2', 'delivery', { texts: ['sermon'], date: '2024-06-01' }),
      E('d3', 'delivery', { texts: ['sermon'], date: '2025-12-01' }),
      E('cp1', 'comment', { subjects: [{ ref: 'sermon', point: 'p1' }], blocks: [{ type: 'paragraph', text: 'Krótko — bez nazwisk' }] })
    ];
    /* Wie der Speicher: wer zeigt worauf (Felder und Zapis). */
    const lookB = (list) => {
      const base = look(list);
      return { ...base, readable: () => list, backlinks: (id) => list.filter((e) => m.fieldRefs(e).includes(id) || m.citedKeys(...m.markupsOf(e)).some((k) => base.byKey(k)?.id === id)) };
    };
    const L = lookB(entries);
    const sermon = L.get('sermon');

    assert.ok(m.markupsOf(sermon).includes('Gdzie szukam?') && m.markupsOf(sermon).length === 6, 'markup of the plan counts as markup');
    assert.deepEqual(m.citedKeys(...m.markupsOf(sermon)), ['bt', 'q', 'jezus'], 'sources of the plan and the body');
    assert.deepEqual(m.deliveriesOf(sermon, L).map((d) => d.id), ['d1', 'd3', 'd2'], 'deliveries newest first — all the reader can read (no "Nie publikuj")');
    assert.equal(m.lastHeld(sermon, L), '2026-08-02');
    const counts = m.coverageCounts(m.planOf(sermon.data), m.coverageOf(L.get('d1').data), m.addedOf(L.get('d1').data));
    assert.deepEqual(counts, { points: 5, said: 1, short: 1, skipped: 1, open: 2, added: 1 });
    assert.equal(m.countsLine(counts), 'powiedziane 1 z 5 · krótko 1 · pominięte 1 · bez oznaczenia 2 · dodane 1');
    assert.equal(m.kindOf('delivery').title(L.get('d1').data, L), 'Chleb · 2026-08-02 · XVIII Niedziela zwykła', 'a delivery is named after its text');

    /* Aspekte: Achsen aus Themen. */
    const tree = m.topicTree(entries.filter((e) => e.kind === 'topic').map(m.topicNode));
    assert.deepEqual(tree.aspects.map((a) => a.name), ['Okres liturgiczny', 'Temat'], 'aspects in their order');
    assert.equal(tree.aspectOf('t-adwent1').id, 't-okres', 'a value belongs to the aspect above it');
    assert.equal(tree.aspectOf('t-rozne'), null);
    assert.deepEqual(tree.flat('t-okres').map((v) => [v.node.name, v.depth]), [['Adwent', 0], ['I Niedziela Adwentu', 1], ['Wielki Post', 0]], 'values in tree order with depth');
    assert.deepEqual(m.facetsOf(tree).map((f) => f.name), ['Okres liturgiczny', 'Temat', 'Inne tematy'], 'facets: the aspects, then loose topics');
    assert.deepEqual(m.facetsOf(m.topicTree([{ id: 'a', name: 'A', parent: null, aspect: false, order: null }])).map((f) => f.name), ['Tematy'], 'without aspects one facet over all topics');

    /* Gezeichnet: der Plan, und auf ihm das gewählte Wygłoszenie. */
    const plain = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: sermon, look: L }));
    assert.ok(plain.includes('lib-plan') && plain.includes('Modlitwa jest rozmową.') && plain.includes('Wygłoszenia (3)'), 'plan with the embedded quote, and the deliveries');
    assert.ok(!plain.includes('lib-mark '), 'no marks while no delivery is chosen');
    const notes = [...plain.matchAll(/<li id="fn-(\d+)">(.*?)<\/li>/g)].map((x) => x[2].replace(/<[^>]+>/g, ''));
    assert.ok(notes[0].startsWith('J 6,35 (BT)') && notes[1].startsWith('J. Ratzinger, Jezus z Nazaretu'), `footnotes count the plan first, then the text (${notes.join(' | ')})`);
    assert.ok(plain.includes('Komentarze (1)') && plain.includes('Krótko — bez nazwisk'), 'a comment about a point stands at its point');
    const marks = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: sermon, look: L, delivery: 'd1' }));
    assert.ok(marks.includes('lib-mark is-said') && marks.includes('lib-mark is-short') && marks.includes('lib-mark is-skipped'), 'the chosen delivery marks the plan');
    assert.ok(marks.includes('▶ 0:40') && marks.includes('Bez całego cytatu'), 'times you can jump to, and what was different');
    const addedAt = marks.indexOf('Zaproszenie na adorację');
    assert.ok(addedAt > marks.indexOf('Gdzie szukam?') && addedAt < marks.indexOf('Zastosowanie na tydzień'), 'what was added stands after its point');

    /* Druck: der Plan im Text, und der Plan allein für die Kanzel. */
    const tex = m.textToLatex(sermon, L);
    assert.ok(tex.includes('\\section*{Plan}') && tex.includes('\\begin{enumerate}') && tex.includes('\\item Głód') && tex.includes('\\footnote{J 6,35 (BT).}'), 'LaTeX: the plan as a numbered list with its footnotes');
    assert.equal((tex.match(/\\begin\{enumerate\}/g) ?? []).length, (tex.match(/\\end\{enumerate\}/g) ?? []).length, 'LaTeX: every list is closed');
    const pulpit = m.planToLatex(sermon, L, { comments: true });
    assert.ok(pulpit.includes('{extarticle}') && pulpit.includes('14pt') && pulpit.includes('Krótko --- bez nazwisk'), 'the pulpit sheet: large, with the comments at the points');
    assert.ok(!m.planToLatex(sermon, L).includes('bez nazwisk'), 'without comments when not asked');

    /* Das Polecenie für den eigenen Chat — und die Antwort ins offene Formular. */
    const prompt = m.deliveryPrompt(L.get('d1'), L);
    assert.ok(prompt.includes('[p1] 1 Głód') && prompt.includes('[p2]') && prompt.includes('Modlitwa jest rozmową.') && prompt.includes('"id": "d1"') && prompt.includes('"coverage"'), 'the delivery prompt carries the plan with ids and the format');
    assert.ok(m.planPrompt(sermon).includes('Treść [@jezus, s. 5].') && m.planPrompt(sermon).includes('"id": "sermon"'), 'the plan prompt carries the text');
    const answer = { format: m.LIBRARY_FORMAT, version: 1, entries: [
      { id: 'd1', kind: 'delivery', data: { coverage: [{ point: 'p4', state: 'Pominięte', at: '9:00' }], summary: 'Nowe' } },
      { kind: 'topic', data: { name: 'x' } }
    ] };
    const patch = m.patchFromDoc(answer, { id: 'd1', kind: 'delivery' }, L);
    assert.deepEqual(Object.keys(patch.patch).sort(), ['coverage', 'summary'], 'only the fields the answer gives');
    assert.deepEqual(patch.patch.coverage, [{ point: 'p4', state: 'skipped', at: '9:00' }], 'a state by its label means its value');
    assert.ok(patch.warnings.some((w) => w.includes('Pozostałe wpisy')), 'other entries are named, not imported');
    assert.ok('error' in m.patchFromDoc({ format: 'recreatio/page' }, { id: 'd1', kind: 'delivery' }, L));

    /* JSON der Bibliothek: Punkte ohne Kennung bekommen eine, Werte beim Namen, Unbekanntes wird gemeldet. */
    const imported = m.planLibraryImport({ entries: [{ kind: 'text', key: 'nowy', data: { plan: [{ text: 'A' }, { text: 'B', depth: '1', kind: 'Przykład' }, 'C', { text: 'D', bogus: 1 }, { id: 'same', text: 'E' }, { id: 'same', text: 'F' }] } }] }, empty);
    const iplan = imported.drafts[0].data.plan;
    assert.equal(iplan.length, 6);
    assert.ok(iplan.every((p) => typeof p.id === 'string' && p.id !== '') && new Set(iplan.map((p) => p.id)).size === 6, 'every point gets a unique id');
    assert.deepEqual([iplan[1].depth, iplan[1].kind, iplan[2].text, iplan[4].id], [1, 'example', 'C', 'same']);
    assert.ok(imported.warnings.some((w) => w.includes('bogus')), 'unknown point fields are reported');
    for (const sub of ['"depth" — Poziom', '"state" — Jak', '"after" — Po punkcie', '"aspect" — Aspekt', '"texts" — Kazanie (tekst)']) assert.ok(description.includes(sub), `description explains ${sub}`);

    /* Das Archiv: Zeilen aus den Texten, Filter je Achse (ein Thema trifft auch, was darunter liegt), Zahlen. */
    const row = m.archiveRow(sermon, L);
    assert.deepEqual([row.title, row.date, row.occasion, row.held, row.recorded, row.topics.length, row.plan.length], ['Chleb', '2026-08-02', 'XVIII Niedziela zwykła', 3, true, 2, 3]);
    const other = { ...row, id: 'x', title: 'Inny', date: '2019-01-01', topics: [{ id: 't-post', name: 'Wielki Post' }], project: null };
    const found = (groups, order = '-sort', matching = null) => m.browseLocal([row, other], tree, { groups, matching, order });
    assert.deepEqual(found([['t-okres']]).rows.map((r) => r.id), ['sermon', 'x'], 'an aspect finds everything under it');
    assert.deepEqual(found([['t-adwent']]).rows.map((r) => r.id), ['sermon'], 'a topic finds its sub-topics');
    assert.deepEqual(found([['t-adwent', 't-post'], ['t-nadzieja']]).rows.map((r) => r.id), ['sermon'], 'OR within a group, AND between groups');
    assert.deepEqual(found([], 'sort').rows.map((r) => r.id), ['x', 'sermon'], 'oldest first');
    assert.deepEqual(found([], '-sort', new Set(['x'])).rows.map((r) => r.id), ['x'], 'search narrows');
    assert.deepEqual([found([]).counts.get('t-okres'), found([]).counts.get('t-adwent'), found([]).counts.get('t-post')], [2, 1, 1], 'counts include the topics above');
    const keyOf = (id) => m.facetKey(id, tree, new Set(['proj']));
    assert.deepEqual([keyOf('t-adwent1'), keyOf('t-nadzieja'), keyOf('t-rozne'), keyOf('proj')], ['t-okres', 't-temat', '', m.PROJECTS]);
    assert.deepEqual(m.choose([], 't-adwent', keyOf, false), ['t-adwent']);
    assert.deepEqual(m.choose(['t-adwent'], 't-post', keyOf, false), ['t-post'], 'one value per aspect: another replaces it');
    assert.deepEqual(m.choose(['t-adwent'], 't-nadzieja', keyOf, false), ['t-adwent', 't-nadzieja'], 'different aspects add up');
    assert.deepEqual(m.choose(['t-adwent', 't-nadzieja'], 't-adwent', keyOf, false), ['t-nadzieja'], 'the same value again removes it');
    assert.deepEqual(m.choose(['t-adwent'], 't-nadzieja', keyOf, true), ['t-nadzieja'], 'an older service takes one filter');
    assert.deepEqual(['Tabela', 'drzewo', 'list', ''].map(m.layoutOf), ['table', 'tree', 'list', 'list']);
    ok('sermons: plan (depth, numbers, paste), times and links, aspects, marks and comments on the plan, LaTeX, prompts, JSON into the form, archive rows, filters and counts');
  }
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
