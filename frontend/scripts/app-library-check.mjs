/**
 * 0064 — DIE BIBLIOTHEK, nachgemessen.
 *
 *   1. Jede Art: jedes Feld beschrieben, das Beispiel nur aus Feldern, und
 *      alle Beispiele zusammen lassen sich importieren — Verweise per @schlüssel.
 *      2026-10-23 (drei Teile): die Bibliothek nimmt nur Quellen; eine Datei mit
 *      Texten, Komentarzen oder Themen wird abgewiesen, mit dem Ort, wohin sie gehört.
 *   2. Der Zapis: Überschriften, Absätze, Listen, Zitate, eingebettete Zitate,
 *      Verweise mit Stellen, eigene Fussnoten, Links, Escapes.
 *  2e. Aussagen (2026-10-22, Schritt 6; 2026-10-23 jeder Rodzaj mit Feld blocks):
 *      Teza = erster Satz (Abkürzungen), Frage, Rolle (Informacja / Interpretacja —
 *      aus den Verweisen, eine Tabelle allein zählt nicht), die Marken.
 *  2g. Alte Kopien einer Baza (2026-10-23 direkt in „Kto czyta"): zurückziehen,
 *      Abschriften nur ohne Verlust heraus, wiederholbar.
 *  2h. Ausgemusterte Bausteine: nicht in der Palette, zeichnen weiter, sagen womit
 *      man sie ersetzt.
 *  2i. Das Skryptorium (2026-10-23): sein Format (Texte, Wygłoszenia, Projekte,
 *      Rodzaje tekstów), die Felder eines Rodzaj tekstu (Ziele beim Namen eines
 *      Rodzaj in Nauka, Werte beim Namen eines Eintrags, belegte Schlüssel),
 *      der Text mit seinen Feldern gezeichnet, die Beschreibung für eine KI.
 *  2d. Stellen der Schrift und das Verzeichnis der Verweise (2026-10-22): Bücher
 *      polnisch, lateinisch, englisch; Bereiche, Listen, Kapitel; Ordnung nach
 *      dem Kanon; wer auf eine Stelle zeigt — über Bibliotheken und Bazy wiedzy.
 *  2c. Ein Leser, nach Art gezeichnet (2026-10-22): Quellen werden Fussnoten,
 *      eigene Einträge Links (auch `[[Wort|@klucz]]`), unlesbare Ziele sagen
 *      nichts; LaTeX, Planzeilen, der Baustein „Tekst" und Cogita ebenso.
 *   3. Die Angaben: Buch, Kapitel, Artikel, Dokument, Pismo Święte, Netz —
 *      voll, „dz. cyt.", „Tamże", Bibliografie.
 *   4. Aussagen in Texten (2026-10-23: Einträge einer Baza, deren Rodzaj ein Feld
 *      blocks hat — der Komentarz aus templates/cogita/komentarz.json): Bausteine mit
 *      echten Verweisen, Einbetten mit Kreisschutz, unlesbare Ziele ohne Titel.
 *   5. Der Text, gezeichnet: Fussnoten in Reihenfolge, Quellen darunter.
 *   6. Bücher: ISBN, Strichcode (ZXing), Katalog (MARC, ONIX), eigene Nummer,
 *      Zitate eines Buches (Format, Polecenie, Plan, Import, Export).
 *   7. Kazania (2026-10-21): der Plan (Lesen, Nummern, Einfügen), Wygłoszenia
 *      (was gesagt wurde, Zeiten, Links an die Stelle), die Achsen des Archivs
 *      aus den Verweisfeldern der Rodzaje tekstów (2026-10-23 statt der Themen),
 *      die Zeichnung mit gewähltem Wygłoszenie (Aussagen stehen nicht mehr an
 *      den Punkten), LaTeX, das Polecenie, JSON ins offene Formular, das Archiv
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
export * from '${app}library/blocks';
export * from '${app}library/statement';
export { planLibraryImport, exportLibrary, libraryDescription, kindsDoc, LIBRARY_FORMAT, LIBRARY_SPEC, LIBRARY_VERSION, MARKUP_DOC } from '${app}library/libraryJson';
export { QuoteFigure } from '${app}library/LibraryText';
export { TextArticle } from '${app}scriptorium/TextArticle';
export { planScriptoriumImport, exportScriptorium, scriptoriumDescription, scriptoriumSpec, SCRIPTORIUM_FORMAT, SCRIPTORIUM_SPEC, SCRIPTORIUM_VERSION } from '${app}scriptorium/scriptoriumJson';
export { typeLines, typeMarks, typeFieldsOf, textTypeOf, typeRefs, CORE_KEYS, TEXT_TYPE_FIELD_TYPES } from '${app}scriptorium/textTypes';
export { LibraryLines } from '${app}library/LibraryLines';
export { Markup as CogitaMarkup } from '${app}cogita/ui';
export { plainOf } from '${app}cogita/schema';
export { courseDescription } from '${app}cogita/json';
export * from '${app}library/isbn';
export * from '${app}library/libraryCatalog';
export * from '${app}library/libraryQuotes';
export { decodeGray } from '${app}library/barcode';
export { readAmount, patchFromDoc } from '${app}library/libraryJson';
export * from '${app}scriptorium/sermon';
export * from '${app}library/bible';
export * from '${app}library/refIndex';
export { Relations, PassageBox, PassageList } from '${app}library/LibraryRelations';
export { StatementMarks } from '${app}library/markupView';
export { hasOldCopies, missingIn, oldCopiesLine, oldCopyOf, withdrawOldCopies, withoutCopy } from '${app}cogita/oldCopies';
export { palette, PARTS } from '${app}pages/parts/registry';
export { textToLatex, planToLatex } from '${app}scriptorium/latex';
export { archiveRow, browseLocal, choose, facetKey, facetsOf, fieldFacet, PROJECTS } from '${app}scriptorium/archive';
export { layoutOf } from '${app}scriptorium/archiveLayout';
export { snapshotDoc, refsOf as snapshotRefs, gzip, SNAPSHOT_VERSION } from '${app}aiAccess/aiSnapshot';
export * as loc from '${app}library/locations';
export * as src from '${app}library/sourceText';
export { SourceBlockView } from '${app}library/SourceBlocks';
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
  for (const def of m.LIBRARY_KINDS) {
    for (const field of def.fields) {
      assert.ok(typeof field.says === 'string' && field.says.length > 3, `${def.kind}.${field.key} is described`);
      assert.ok(description.includes(`"${field.key}" — ${field.label}`), `description explains ${def.kind}.${field.key}`);
      if (field.type === 'ref' || field.type === 'refs') assert.ok(field.to?.every((k) => m.LIBRARY_KINDS.some((x) => x.kind === k)), `${def.kind}.${field.key} points only at sources`);
    }
    for (const key of Object.keys(def.example.data)) assert.ok(def.fields.some((f) => f.key === key), `${def.kind} example uses only fields (${key})`);
    assert.ok(description.includes(`### "${def.kind}" — ${def.label}`), `description lists ${def.kind}`);
  }
  assert.deepEqual(m.LIBRARY_KINDS.map((k) => k.kind), ['work', 'quote', 'person'], 'the library holds sources only');
  assert.ok(description.includes('[@ratzinger2007, s. 23]') && !description.includes('### "text"') && !description.includes('### "comment"') && !description.includes('### "topic"'), 'the description: how one cites the library, and no other kinds');
  const writingDoc = m.kindsDoc(m.WRITING_KINDS);
  for (const def of m.WRITING_KINDS) for (const field of def.fields) assert.ok(writingDoc.includes(`"${field.key}" — ${field.label}`), `the writing kinds are described too (${def.kind}.${field.key})`);

  const exampleDoc = { format: m.LIBRARY_FORMAT, version: m.LIBRARY_VERSION, entries: m.LIBRARY_KINDS.map((def) => ({ kind: def.kind, key: def.example.key, data: def.example.data })) };
  const empty = { get: () => undefined, byKey: () => undefined };
  const planned = m.planLibraryImport(exampleDoc, empty);
  assert.ok(!('error' in planned), 'all examples import');
  assert.deepEqual(planned.warnings, [], 'the examples import without a warning');
  assert.equal(planned.created, m.LIBRARY_KINDS.length);
  const byKind = Object.fromEntries(planned.drafts.map((d) => [d.kind, d]));
  assert.equal(byKind.quote.data.work, byKind.work.id, '@key references resolve to the new ids');
  assert.deepEqual(byKind.work.data.authors, [byKind.person.id]);
  assert.deepEqual(planned.drafts.map((d) => d.kind), ['person', 'work', 'quote'], 'what is named is saved first');
  ok(`${m.LIBRARY_KINDS.length} kinds: every field described, examples import cleanly with @key references`);

  /* 2026-10-23 — nur Quellen: eine Datei mit anderen Arten wird abgewiesen, mit dem Ort, wohin sie gehört. */
  {
    const mixed = m.planLibraryImport({ format: m.LIBRARY_FORMAT, version: 2, entries: [
      { kind: 'work', data: { title: 'A' } }, { kind: 'text', data: { title: 'T' } }, { kind: 'delivery', data: {} }, { kind: 'comment', data: {} }, { kind: 'topic', data: { name: 'X' } }
    ] }, empty);
    assert.ok('error' in mixed, 'an old file with texts, comments and topics is refused as a whole');
    assert.ok(mixed.error.includes('"recreatio/scriptorium"') && mixed.error.includes('Skryptorium'), `texts and deliveries: the Scriptorium is named (${mixed.error})`);
    assert.ok(mixed.error.includes('templates/cogita/komentarz.json'), 'comments: the Cogita template is named');
    assert.ok(mixed.error.includes('tematów już nie ma'), 'topics: said that there are none');
    assert.ok(mixed.error.includes('text (1)') && mixed.error.includes('topic (1)'), 'what is in the file is counted');
    const other = m.planLibraryImport({ format: 'recreatio/scriptorium', entries: [{ kind: 'text', data: {} }] }, empty);
    assert.ok('error' in other && other.error.includes('w Skryptorium'), 'another part\'s format says where it is imported');
    const cogita = m.planLibraryImport({ format: 'recreatio.cogita.base', entries: [{ kind: 'entity', data: {} }] }, empty);
    assert.ok('error' in cogita && cogita.error.includes('w Wiedzy'), 'a Cogita file says where it is imported');
  }
  ok('sources only: a file with texts, deliveries, comments or topics is refused, naming where each belongs; other formats name their part');

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
    const comment = { subjects: [{ ref: W.id }], blocks: [{ type: 'paragraph', text: 'Por. [@ratz].' }] };
    assert.equal(m.storedMarkup('comment', comment, L1), comment, '2026-10-23: a kind the library no longer keeps is stored as it is (comments are entries of a knowledge base)');
    assert.equal(m.storedMarkup('text', { body: 'bez odwołań' }, L1).body, 'bez odwołań');

    /* Die Taste ändert sich: der gespeicherte Text zeigt weiter auf denselben Eintrag. */
    const renamed = { ...W, key: 'ratzinger-jezus' };
    const html = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: { id: 's1', kind: 'text', data: stored }, look: look([renamed]) }));
    assert.ok(html.includes('Jezus') && !html.includes('brak źródła'), 'a renamed key orphans nothing: the footnote still finds the work');
    assert.deepEqual(m.nextAliases('ratz', 'ratzinger-jezus', []), ['ratz'], 'the old key stays as a second key');
    assert.deepEqual(m.nextAliases('b', 'a', ['a', 'c', 'C']), ['c', 'b'], 'never the new key, each once');

    /* JSON: hinaus mit Schlüsseln, herein wieder Kennungen — und nichts ändert sich (Texte: das Format der Schreibarten, 2026-10-23). */
    const WRITING = m.SCRIPTORIUM_SPEC;
    const shelf = [W, { id: 's2', kind: 'text', key: 'kaz', data: { title: 'K', body: `Tekst [@${W.id}, s. 9].` } }];
    const S2 = look(shelf);
    const out = m.exportLibrary('x', shelf, S2, WRITING);
    assert.deepEqual(out.entries.map((e) => e.id), ['s2'], 'a format exports only its own kinds');
    const outText = out.entries.find((e) => e.id === 's2');
    assert.equal(outText.data.body, 'Tekst [@ratz, s. 9].', 'the JSON shows keys');
    const back = m.planLibraryImport(out, S2, WRITING);
    assert.equal(back.unchanged, 1, 'export → import: the keys turn back into the same ids');
    const fresh = m.planLibraryImport({ entries: [{ kind: 'text', key: 'nowy', data: { title: 'N' } }, { kind: 'text', data: { title: 'T', body: 'Cytuję [@ratz], zob. [@nowy] i [@brak].' } }] }, L1, WRITING);
    const made = fresh.drafts.find((d) => d.data.title === 'T');
    const sibling = fresh.drafts.find((d) => d.key === 'nowy');
    assert.equal(made.data.body, `Cytuję [@${W.id}], zob. [@${sibling.id}] i [@brak].`, 'import stores ids: a work of the library, a text of the same document');
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
    /* 2026-10-23 — eine Aussage: ein Eintrag einer Baza, dessen Rodzaj ein Feld blocks hat. */
    const KK = { id: 'kk', kind: 'kind', data: { name: 'Komentarz', label: '{content}', fields: [{ key: 'about', label: 'O czym', type: 'ref', multi: true, locator: true }, { key: 'content', label: 'Treść', type: 'blocks' }] } };
    const C = { id: 'c1', kind: 'entity', key: 'kom', data: { _kinds: ['kk'], about: ['w1'], content: [{ type: 'paragraph', text: 'Uwaga.' }] } };
    const L = { ...look([W, T, C, KK]), readable: () => [W, T, C] };
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
    assert.ok(!html.includes('Zob. komentarz') && html.includes('(zob. <span class="lib-own-ref">Uwaga.</span>)'), 'a statement is never a footnote: a link named by its thesis');
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
    const told = m.MARKUP_DOC;
    assert.ok(told.includes('[[te słowa|@klucz]]') && told.includes('nigdy przypis') && told.includes('[odwołanie niedostępne]'), 'the markup description tells an AI: sources are cited, own entries linked');
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
    assert.deepEqual(refs({ about: [{ value: BT.id, locator: 'Dz 1,12-14' }], content: [{ type: 'table', columns: ['a'], rows: [[[{ text: 'zob.' }, { ref: BT.id, locator: 'Łk 1,35' }]]] }] }),
      [[BT.id, 'Dz 1,12-14', 'about', ''], [BT.id, 'Łk 1,35', 'content', '']], 'a statement (any kind with a blocks field): what it is about, what its cells name');
    assert.deepEqual(refs({ born: { value: '1999', state: 'disputed', source: { work: BT.id, locator: 'Dz 1,14' } }, _kinds: ['00000000-0000-4000-8000-00000000000f'] }),
      [[BT.id, 'Dz 1,14', 'born', '']], 'Cogita: the source of an uncertain value; bookkeeping (_kinds) does not count');
    assert.deepEqual(refs({ name: 'Powtórka', graph: { nodes: [{ id: 'n1', config: { list: ['k1', 'x', BT.id] } }] } }).map((r) => r[0]), [BT.id], 'a document: every id in it');
    assert.deepEqual(refs({ miejsce: { value: BT.id, locator: 'Ps 110' }, inne: { value: 'zwykły tekst', locator: 'x' } }), [[BT.id, 'Ps 110', 'miejsce', '']], 'Schritt 11: a value with a place (a psalm: the Bible at Ps 110) is a reference with a place');

    /* Das Verzeichnis über zwei Bibliotheken und eine Baza wiedzy — Schlüssel gelten zuerst im eigenen Speicher. */
    const store = (libraryId, entries, books = true) => ({ libraryId, revision: 1, books, all: () => entries, ownByKey: (k) => entries.find((e) => e.key === k) });
    const text = { id: 't1', kind: 'text', key: 'kaz', data: { title: 'Kazanie', body: 'Wstęp [@bt, Dz 1,14].', plan: [{ id: 'p9', text: 'Modlitwa [@bt, Acts 1:14]' }] } };
    const comment = { id: 'c1', kind: 'entity', key: 'kom', data: { _kinds: ['kk'], about: [{ value: BT.id, locator: 'Dz 1,12-14' }], content: [{ type: 'paragraph', text: 'Trwali jednomyślnie.' }] } };
    const far = { id: 'qx', kind: 'quote', key: 'qx', data: { text: 'Inny', work: [BT.id], locator: 'Dz 1,15' } };
    const latin = { id: 'qv', kind: 'quote', key: 'qv', data: { text: 'Hi omnes erant perseverantes', work: [VG.id], locator: 'Act 1,14' } };
    const E1 = '00000000-0000-4000-8000-0000000000e1';
    const E2 = '00000000-0000-4000-8000-0000000000e2';
    const knowledge = { id: E1, kind: 'entity', data: { _kinds: ['kk'], content: [{ type: 'paragraph', text: 'Apostołowie trwali na modlitwie [@bt, Dz 1,14] z [[Maryją|@maryja]].' }] } };
    const maryja = { id: E2, kind: 'entity', key: 'maryja', data: { _kinds: ['person'], name: 'Maryja' } };
    const revision = { id: 'r1', kind: 'revision', data: { name: 'Dzieje', graph: { nodes: [{ id: 'n', config: { list: [E1, E2] } }] } } };
    const merge = { id: 'm1', kind: 'merge', data: { from: E2, to: E1 } };
    const E3 = '00000000-0000-4000-8000-0000000000e3';
    const psalmIn = { id: E3, kind: 'entity', data: { _kinds: ['psalm'], miejsce: { value: BT.id, locator: 'Dz 1,13-14' } } };
    const A = store('lib-a', [BT, ...quotes, text, far]);
    const B = store('lib-b', [VG, latin]);
    const K = store('base-k', [comment, knowledge, maryja, revision, merge, psalmIn], false);
    const index = m.referenceIndex([A, B, K], (s) => s.books);
    assert.deepEqual(index.to(E2).map((h) => h.from.id).sort(), [E1, 'r1'], 'a base entry: a statement links it, a revision uses it — the merge does not count');
    assert.ok(index.to(BT.id).some((h) => h.from.id === E1 && h.ref.locator === 'Dz 1,14'), 'a statement in a knowledge base citing a library Bible (key resolved through the libraries)');
    assert.equal(m.referenceIndex([A, B, K], (s) => s.books), index, 'unchanged stores: the same index');

    const found = m.passageHits(index, m.parseBible('Dz 1:14'));
    const who = found.map((f) => [f.hit.from.id, f.hit.ref.field, f.hit.ref.at ?? '', f.work.id === VG.id ? 'Vg' : 'BT']);
    assert.deepEqual(new Set(who.map((w) => w[0])), new Set(['q14', 't1', 'c1', E1, 'qv', E3]), 'Dz 1:14 finds the quote, the sermon (body and plan point), the comment (its "O czym": Dz 1,12-14), the statement citing it, the Latin quote and (Schritt 11) a base entry whose field has the place — not Dz 1,15');
    assert.ok(who.some((w) => w[0] === 't1' && w[1] === 'plan' && w[2] === 'p9'), 'the plan point is named');
    assert.ok(who.some((w) => w[0] === 'qv' && w[3] === 'Vg'), 'in another edition of the Scripture too');
    assert.deepEqual(m.passageHits(index, []), [], 'nothing typed, nothing found');
    assert.ok(m.libraryDescription().includes('Łk 1,26–2,5') && m.libraryDescription().includes('Acts 1:14'), 'the description tells an AI how to write a place in the Scripture');
    assert.deepEqual([m.entryTitle({ id: 'w', kind: 'entity', data: { _kinds: ['x'], tekst: 'house' } }, look([])), m.entryTitle({ id: 'v', kind: 'view', data: { name: 'Psalmy jutrzni' } }, look([]))], ['house', 'Psalmy jutrzni'], 'Schritt 11: a base entry and a view have names in a text');
    assert.ok(m.MARKUP_DOC.includes('![@id-widoku]') && m.MARKUP_DOC.includes('[[house|@id-słowa]]'), 'Schritt 11: the description shows linking a dictionary word and embedding a live view');
    /* Die Kästen zeichnen (ohne offene Speicher im Prüfling: nur der Rahmen). */
    const fake = { libraryId: 'lib-a', revision: 1, title: (e) => String(e.data.title ?? e.data.text ?? e.id), get: () => undefined, byKey: () => undefined, readable: () => [], all: () => [], ownByKey: () => undefined };
    const rel = m.renderToStaticMarkup(m.createElement(m.Relations, { store: fake, library: { libraryId: 'lib-a', writes: true }, entry: { ...BT, libraryId: 'lib-a' } }));
    assert.ok(rel.includes('Powiązania') && rel.includes('Sprawdź strony') && rel.includes('Szukaj we wszystkich'), 'the relations box draws');
    const passage = m.renderToStaticMarkup(m.createElement(m.PassageList, { store: fake, spans: m.parseBible('Dz 1:14') }));
    assert.ok(passage.includes('Dz 1,14') && passage.includes('nic tu nie wskazuje'), 'the passage list draws');
  }
  /* -- 2e. Aussagen (Schritt 6) ---------------------------------------------------------------- */
  {
    assert.equal(m.firstSentence('Św. Jan pisze o miłości. Bóg jest miłością.'), 'Św. Jan pisze o miłości.', 'an abbreviation does not end a sentence');
    assert.equal(m.firstSentence('J. Ratzinger zauważa to (zob. s. 23). Dalej.'), 'J. Ratzinger zauważa to (zob. s. 23).', 'initials and „zob. s." neither');
    assert.equal(m.firstSentence('Np. tak jest, m.in. dlatego. Koniec.'), 'Np. tak jest, m.in. dlatego.');
    assert.equal(m.firstSentence('Czy Duch zstępuje dwa razy? Tak.'), 'Czy Duch zstępuje dwa razy?');
    assert.equal(m.firstSentence('Duch **zstępuje** [@bt, Łk 1,35]. Potem.'), 'Duch zstępuje.', 'markup and citations do not count');
    assert.equal(m.firstSentence('Bez kropki na końcu'), 'Bez kropki na końcu');
    const para = (text) => [{ type: 'paragraph', text }];
    assert.equal(m.thesisOf([{ type: 'table', columns: ['a'], rows: [] }, { type: 'paragraph', text: 'A.' }]), '', 'a statement must begin with a sentence');
    assert.deepEqual([m.thesisProblem(para('Krótko.')), m.thesisProblem(para(`${'x'.repeat(201)}.`)), m.thesisProblem([])], [null, 'long', 'missing']);
    assert.ok(m.isQuestion(para('Dlaczego dwa razy? Bo…')) && !m.isQuestion(para('Dwa razy. Czemu?')), 'a question is a statement whose FIRST sentence asks');
    /* 2026-10-23 — eine Aussage ist ein Eintrag, dessen Rodzaj ein Feld blocks hat (hier der Komentarz der Vorlage). */
    const KK = { id: 'kk', kind: 'kind', data: { name: 'Komentarz', label: '{content}', fields: [{ key: 'about', label: 'O czym', type: 'ref', multi: true, locator: true }, { key: 'content', label: 'Treść', type: 'blocks' }] } };
    const st = (id, content, about) => ({ id, kind: 'entity', key: id, data: { _kinds: ['kk'], content, ...(about === undefined ? {} : { about }) } });
    const BTW = { id: 'bt', kind: 'work', key: 'bt', data: { workType: 'bible', title: 'Biblia' } };
    const RL = look([KK, BTW, st('c9', para('Inna wypowiedź.'))]);
    const role = (content, about) => m.statementRole(st('s', content, about), RL);
    assert.equal(role(para('Łukasz pisze o mocy Najwyższego [@bt, Łk 1,35].')), 'information', 'a source cited: information');
    assert.equal(role(para('Moim zdaniem to ten sam obłok.')), 'interpretation', 'nothing cited: interpretation');
    assert.equal(role(para('Jak w [@c9], tu też [@bt, Dz 1,8].')), 'interpretation', 'built on another statement: interpretation');
    assert.equal(role([{ type: 'paragraph', text: 'Porównanie [@bt].' }, { type: 'table', columns: ['a', 'b'], rows: [] }]), 'information', '2026-10-23: a table alone does not make an interpretation');
    assert.equal(role(para('Tak mówi Pismo.'), [{ value: 'bt', locator: 'Łk 1,35' }]), 'information', 'what it is about counts: a place in the Bible in its "O czym"');
    assert.equal(m.statementOf(BTW, RL), null, 'a source is no statement');
    assert.equal(m.statementOf(st('x', para('A.')), look([])), null, 'nor an entry whose kind this reader cannot see');
    assert.equal(m.blocksMarkup([{ type: 'table', columns: ['Łk', 'Dz'], rows: [[[{ ref: 'bt', locator: 'Łk 1,35' }], [{ ref: 'bt', locator: 'Dz 1,8' }]]] }]), '- [[Łk 1,35|@bt]] — [[Dz 1,8|@bt]]', 'a table row as markup links');

    /* Die Marken: eine Frage, auf die eine andere Aussage zeigt, ist beantwortet. */
    const Q = st('cq', para('Dlaczego Duch zstępuje dwa razy? Szukam.'));
    const A1 = st('ca', para('Bo Kościół rodzi się jak Chrystus.'), ['cq']);
    const marks = (entries) => m.renderToStaticMarkup(m.createElement(m.StatementMarks, { entry: Q, look: { ...look([KK, ...entries]), readable: () => entries }, author: true }));
    assert.ok(marks([Q]).includes('Pytanie otwarte') && marks([Q, A1]).includes('Pytanie — jest odpowiedź'), 'open until another statement points at it (here: through its "O czym")');
    assert.ok(marks([Q]).includes('Interpretacja') && !marks([Q]).includes('Brak tezy'));
    assert.ok(m.courseDescription().includes('"statement.thesis"') && m.courseDescription().includes('"blocks" (treść w blokach)') && !m.courseDescription().includes('"kinds": ["comment"]') && !m.courseDescription().includes('"kinds": ["knowledge"]'), 'the Cogita description shows statements on any kind with a blocks field — no comment or knowledge kinds');
    assert.ok(m.courseDescription().includes('templates/cogita/komentarz.json'), '… and where the ready Komentarz is');
  }
  /* -- 2f. Die Beschreibung von Cogita (Schritt 12): Przebieg aus einer Präsentation, Erzähler, der Schritt „scene". */
  assert.ok(['"presentation": "parafia/droga"', '"narrators"', 'krok "scene"', '"b0"'].every((one) => m.courseDescription().includes(one)), 'the Cogita description shows presentation flows, narrators and the scene step');

  /* -- 2g. Bazy wiedzy: stare publikacje (2026-10-23 direkt in „Kto czyta") ---------------------------- */
  {
    const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
    const [A, B, GONE] = [1, 2, 3].map(U);
    const fake = (entries) => {
      const map = new Map(entries.map((e) => [e.id, e]));
      const store = {
        withdrawn: [], saved: [],
        all: () => [...map.values()], get: (id) => map.get(id),
        withdraw: async (ids) => { store.withdrawn.push(...ids); for (const id of ids) map.set(id, { ...map.get(id), publishedAs: null }); return ids.length; },
        save: async (input) => { const was = map.get(input.id); map.set(input.id, { ...was, ...input }); store.saved.push(input.id); return map.get(input.id); }
      };
      return store;
    };
    const copyOk = { format: 'recreatio.cogita.revision', cards: [{ entity: A, question: A }], explain: { [B]: { label: 'x' } } };
    const copyLost = { format: 'recreatio.cogita.flow', entities: { [GONE]: { label: 'skasowany' } } };
    const base = fake([
      { id: A, kind: 'entity', publishedAs: 'explicit', data: { name: 'Józef', public: copyOk } },
      { id: B, kind: 'entity', publishedAs: null, data: { name: 'Maryja' } },
      { id: 'f1', kind: 'flow', publishedAs: null, data: { name: 'Droga', public: copyLost } }
    ]);
    assert.deepEqual(m.missingIn(copyOk, (id) => id === A || id === B), [], 'everything the copy shows is still there');
    assert.deepEqual(m.missingIn(copyLost, () => false), [GONE], 'the copy shows an entry that is gone');
    assert.deepEqual(m.withoutCopy({ name: 'x', public: {}, more: 1 }), { name: 'x', more: 1 }, 'only the copy leaves the entry');
    assert.ok(m.hasOldCopies(base) && !m.hasOldCopies(fake([{ id: 'c1', kind: 'revision', publishedAs: 'explicit', data: { name: 'x' } }])), 'a base with an old copy inside an entry is not opened before the copies are withdrawn');

    const known = (id) => base.get(id) !== undefined;
    const report = await m.withdrawOldCopies(base, known, null);
    assert.deepEqual([base.withdrawn, base.saved], [[A], [A]], 'the old public version withdrawn, one copy removed');
    assert.equal(m.oldCopyOf(base.get(A)), null, 'the copy is gone from the entry …');
    assert.equal(base.get(A).data.name, 'Józef', '… the entry itself is not');
    assert.ok(m.oldCopyOf(base.get('f1')) !== null, 'a copy that holds the only trace of a deleted entry stays');
    assert.deepEqual(report.kept, [{ id: 'f1', missing: 1 }]);
    const said = m.oldCopiesLine(report);
    assert.ok(said.includes('Wycofane stare kopie publiczne: 1') && said.includes('usunięte kopie we wpisach: 1') && said.includes('Zostało kopii: 1'), said);
    const again = await m.withdrawOldCopies(base, known, null);
    assert.deepEqual([again.withdrawn, again.stripped, again.kept.length], [0, 0, 1], 'run again: only what could not be done is left');
  }
  ok('knowledge bases, old publications: withdrawn, copies out of entries only when nothing is lost, repeatable — without Porządki');

  /* -- 2h. Ausgemusterte Bausteine ------------------------------------------------------------------- */
  {
    const offered = m.palette().map((x) => x.kind);
    assert.ok(!offered.includes('entity-table') && !offered.includes('topic-explorer') && !offered.includes('knowledge-map') && offered.includes('view') && m.PARTS.some((x) => x.kind === 'entity-table'), 'retired modules leave the palette but still render');
    assert.ok(m.PARTS.filter((x) => x.retired !== undefined).every((x) => !x.retired.includes('Porządki') && x.retired.includes('„Widok”')), 'a retired module says what replaces it — and names no tool that is gone');
  }
  ok('page modules: retired ones leave the palette, still render, and say what replaces them');

  /* -- 2i. Das Skryptorium (2026-10-23) ---------------------------------------------------------------- */
  {
    /* Was Nauka weiss: zwei Rodzaje und ihre Einträge (beim Namen). */
    const [KT, KO, EZ, EN, EM] = ['0a', '0b', '0c', '0d', '0e'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
    const KINDS_BY_NAME = { tajemnica: KT, obszar: KO };
    const ENTRIES = { zwiastowanie: [EZ, KT], nawiedzenie: [EN, KT], modlitwa: [EM, KO] };
    const ctx = {
      kindRef: (token) => KINDS_BY_NAME[token.toLowerCase()] ?? ([KT, KO].includes(token) ? token : null),
      entryByName: (name, kinds) => { const hit = ENTRIES[name.toLowerCase()]; return hit !== undefined && (kinds.length === 0 || kinds.includes(hit[1])) ? hit[0] : null; }
    };
    const BT = { id: '00000000-0000-4000-8000-0000000000b1', kind: 'work', key: 'bt', data: { workType: 'bible', title: 'Biblia Tysiąclecia', siglum: 'BT' } };
    const ZW = { id: EZ, kind: 'entity', data: { _kinds: [KT], name: 'Zwiastowanie' } };
    const MOD = { id: EM, kind: 'entity', data: { _kinds: [KO], name: 'Modlitwa' } };

    /* Die Arten und ihre Beispiele: alle zusammen importierbar (Quellen aus der Bibliothek daneben). */
    const told = m.scriptoriumDescription();
    for (const def of m.WRITING_KINDS) {
      for (const field of def.fields) assert.ok(told.includes(`"${field.key}" — ${field.label}`), `the Scriptorium description explains ${def.kind}.${field.key}`);
      assert.ok(told.includes(`### "${def.kind}" — ${def.label}`), `the Scriptorium description lists ${def.kind}`);
    }
    assert.deepEqual(m.WRITING_KINDS.map((k) => k.kind), ['text', 'delivery', 'project', 'texttype']);
    const libraryPart = m.planLibraryImport({ entries: m.LIBRARY_KINDS.map((def) => ({ kind: def.kind, key: def.example.key, data: def.example.data })) }, { get: () => undefined, byKey: () => undefined });
    const sources = libraryPart.drafts.map((d) => ({ id: d.id, kind: d.kind, key: d.key, data: d.data }));
    const examples = { format: m.SCRIPTORIUM_FORMAT, version: m.SCRIPTORIUM_VERSION, entries: m.WRITING_KINDS.map((def) => ({ kind: def.kind, key: def.example.key, data: def.example.data })) };
    const planned = m.planScriptoriumImport(examples, look(sources), ctx);
    assert.ok(!('error' in planned), 'all writing examples import');
    assert.deepEqual(planned.warnings, [], `the writing examples import without a warning (${planned.warnings.join(' | ')})`);
    assert.deepEqual(planned.drafts.map((d) => d.kind), ['texttype', 'project', 'text', 'delivery'], 'text types first, then projects, texts, deliveries');
    const byKind = Object.fromEntries(planned.drafts.map((d) => [d.kind, d]));
    assert.equal(byKind.text.data.textType, byKind.texttype.id, 'a text points at its text type (@key of the same document)');
    assert.equal(byKind.text.data.project, byKind.project.id);
    assert.deepEqual(byKind.texttype.data.fields.map((f) => [f.key, f.type, f.to]), [['tajemnica', 'ref', [KT]], ['obszar', 'ref', [KO]]], 'the fields of a text type: targets by the NAME of a kind in Nauka');
    assert.ok(byKind.text.data.body.includes(sources.find((e) => e.key === 'ratzinger2007').id), 'a text cites the library by id (stored), written as @key');
    ok(`${m.WRITING_KINDS.length} writing kinds: described, examples import with library sources beside them, text types first`);

    /* Ein Rodzaj tekstu und ein Text dieses Rodzaju — Werte beim Namen, Stellen, belegte Schlüssel, falsche Typen. */
    const doc = { format: m.SCRIPTORIUM_FORMAT, version: 1, entries: [
      { kind: 'texttype', key: 'maryjne', data: { name: 'Kazanie maryjne', fields: [
        { key: 'tajemnica', label: 'Tajemnica', type: 'ref', to: ['Tajemnica'] },
        { key: 'obszar', label: 'Obszar', type: 'ref', to: ['Obszar'], multi: true },
        { key: 'fragment', label: 'Fragment', type: 'ref', to: ['work'], locator: true },
        { key: 'ile', label: 'Ilu słuchaczy', type: 'number' },
        { key: 'title', label: 'Tytuł', type: 'line' },
        { key: 'notatka', label: 'Notatka', type: 'markup' },
        { key: 'gdzie', label: 'Gdzie', type: 'ref', to: ['Miejsce'] }
      ] } },
      { kind: 'text', key: 'k1', data: { textType: '@maryjne', title: 'Niech mi się stanie', tajemnica: 'Zwiastowanie', obszar: ['Modlitwa', 'Nieznane'], fragment: { value: '@bt', locator: 'Łk 1,26-38' }, ile: '120 osób', nieznane: 1 } },
      { kind: 'work', data: { title: 'Nie tutaj' } }
    ] };
    const refused = m.planScriptoriumImport(doc, look([BT, ZW, MOD]), ctx);
    assert.ok('error' in refused && refused.error.includes('"recreatio/library"'), 'a source in a Scriptorium file is refused, naming the Library');
    const ok2 = m.planScriptoriumImport({ ...doc, entries: doc.entries.slice(0, 2) }, look([BT, ZW, MOD]), ctx);
    assert.ok(!('error' in ok2));
    const type = ok2.drafts.find((d) => d.kind === 'texttype');
    const text = ok2.drafts.find((d) => d.kind === 'text');
    assert.deepEqual(type.data.fields.map((f) => f.key), ['tajemnica', 'obszar', 'fragment', 'ile', 'gdzie'], 'a core key (title) and a type a text type does not offer (markup) are dropped');
    assert.equal(type.data.fields.find((f) => f.key === 'gdzie').to, undefined, 'a kind Nauka does not have: the limit is dropped, said in a warning');
    assert.ok(ok2.warnings.some((w) => w.includes('„title”') && w.includes('stałych pól')) && ok2.warnings.some((w) => w.includes('„markup”')) && ok2.warnings.some((w) => w.includes('„Miejsce”')), ok2.warnings.join(' | '));
    assert.equal(text.data.tajemnica, EZ, 'a value by the NAME of an entry in Nauka (among the kinds of the field)');
    assert.deepEqual(text.data.obszar, [EM], 'several values; an unknown name is reported and left out');
    assert.ok(ok2.warnings.some((w) => w.includes('Nieznane')), 'the unknown name is said');
    assert.deepEqual(text.data.fragment, { value: BT.id, locator: 'Łk 1,26-38' }, 'a reference with a place: the Bible at Łk 1,26-38');
    assert.equal(text.data.ile, 120, 'a number with a unit is a number');
    assert.ok(text.data.nieznane === undefined && ok2.warnings.some((w) => w.includes('nieznane') && w.includes('nieznane pole')), 'a field the text type does not have is reported');
    ok('text types: fields by the name of a kind in Nauka, core keys and unoffered types refused; a text of the type: values by the name of an entry, places, numbers, unknowns reported; sources refused');

    /* Gezeichnet: der Text mit den Feldern seines Rodzaju; was der Leser nicht lesen kann, fehlt. */
    const typeEntry = { id: type.id, kind: 'texttype', key: 'maryjne', data: type.data };
    const textEntry = { id: text.id, kind: 'text', data: { ...text.data, body: 'Treść [@bt, Łk 1,29].' } };
    const all = [BT, ZW, MOD, typeEntry, textEntry];
    const L = { ...look(all), readable: () => all, title: (e) => String(e.data.name ?? e.data.title ?? e.id) };
    assert.deepEqual(m.typeLines(textEntry.data, L), [{ label: 'Tajemnica', value: 'Zwiastowanie' }, { label: 'Obszar', value: 'Modlitwa' }, { label: 'Fragment', value: 'Biblia Tysiąclecia, Łk 1,26-38' }, { label: 'Ilu słuchaczy', value: '120' }]);
    const html = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: textEntry, look: L }));
    assert.ok(html.includes('Kazanie maryjne') && html.includes('<dt>Tajemnica</dt><dd>Zwiastowanie</dd>'), 'the text shows its type and its fields');
    const hidden = { ...look([BT, typeEntry, textEntry]), readable: () => [BT, typeEntry, textEntry] };
    const html2 = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: textEntry, look: hidden }));
    assert.ok(!html2.includes('Zwiastowanie') && !html2.includes(EZ) && html2.includes('Fragment'), 'an entry of Nauka the reader cannot read: nothing about it, not even its id');
    assert.deepEqual(m.typeRefs(textEntry.data, L).sort(), [BT.id, EM, EZ].sort(), 'what the fields point at (reach, backlinks)');
    assert.ok(m.textToLatex(textEntry, L).includes('Tajemnica: Zwiastowanie'), 'LaTeX: the fields under the title');

    /* JSON hinaus und wieder herein: nichts ändert sich (die Werte der Felder bleiben Kennungen). */
    const shelf = [BT, ZW, MOD, typeEntry, { id: text.id, kind: 'text', key: 'k1', data: text.data }];
    const out = m.exportScriptorium('x', shelf, look(shelf));
    assert.deepEqual([out.format, out.version, out.entries.length], [m.SCRIPTORIUM_FORMAT, 1, 2], 'export: only the kinds of the Scriptorium');
    const back = m.planScriptoriumImport(out, look(shelf), ctx);
    assert.equal(back.unchanged, 2, `export → import changes nothing (${back.warnings.join(' | ')})`);

    /* Die Beschreibung für eine KI. */
    assert.ok(told.includes('"textType": "@kazanie-maryjne"') && told.includes('NAZWĄ') && told.includes('"locator": "Łk 1,26-38"'), 'the description shows a text of a type with values by name and a place');
    assert.ok(told.includes('[[te słowa|@klucz]]') && told.includes('Łk 1,26–2,5'), 'the description carries the markup and the Scripture places');
    assert.ok([...m.CORE_KEYS.keys()].every((k) => told.includes(k)), 'the description names the taken keys');
    assert.ok(!told.includes('### "work"') && !told.includes('### "comment"') && !told.includes('### "topic"'), 'no other kinds');
  }
  ok('the Scriptorium: a text with the fields of its type drawn (unreadable targets say nothing), LaTeX, export → import, the description');

  ok('statements: the thesis is the first sentence (abbreviations, markup), questions, information vs interpretation, the marks');

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

  /* -- 4. Aussagen in Texten und Bereiche (2026-10-23: Einträge einer Baza mit Feld blocks) ------------ */
  {
    /* Bausteine: duldsam gelesen, ein blosser String ist Text, Verweise sind echte Verweise. */
    const blocks = m.blocksIn([
      'Prosa',
      { type: 'table', columns: ['Łk', 'Dz'], rows: [[[{ ref: 'bt', locator: 'Łk 1,35' }], [{ ref: 'bt', locator: 'Dz 1,8' }]], ['zstąpi na ciebie', 'zstąpi na was']] },
      { type: 'ordered', items: ['najpierw', [{ text: 'potem ' }, { ref: 'q' }]] },
      { type: 'heading', text: 'nie ma takiego bloku' },
      { type: 'paragraph', text: '   ' }
    ]);
    assert.deepEqual(blocks.map((x) => x.type), ['paragraph', 'table', 'ordered'], 'four block types only; empty and unknown blocks fall away');
    assert.deepEqual(blocks[1].rows[1], [[{ text: 'zstąpi na ciebie' }], [{ text: 'zstąpi na was' }]], 'a plain string in a cell is text');
    assert.deepEqual(m.blockRefs(blocks), [{ ref: 'bt', locator: 'Łk 1,35' }, { ref: 'bt', locator: 'Dz 1,8' }, { ref: 'q', locator: '' }]);
    assert.equal(m.blocksIn([{ type: 'paragraph', text: '' }], true).length, 1, 'the editor keeps an empty block');
    const KK = { id: 'kk', kind: 'kind', data: { name: 'Komentarz', label: '{content}', fields: [{ key: 'about', label: 'O czym', type: 'ref', multi: true, locator: true }, { key: 'content', label: 'Treść', type: 'blocks' }] } };
    const c1 = { id: 'c1', kind: 'entity', key: 'paralela', data: { _kinds: ['kk'], about: [{ value: 'sermon', locator: '' }], content: blocks.map(m.blockData) } };
    const L4 = look([KK, c1]);
    assert.equal(m.blocksKeyOf(c1, L4), 'content', 'the blocks field is found through the kind of the entry, under any key');
    assert.deepEqual(m.statementTokens(c1, L4).sort(), ['bt', 'q', 'sermon'], 'what a statement points at: its cells, its markup and its reference fields');

    const shelf = [
      { id: 'bt', kind: 'work', key: 'bt', data: { workType: 'bible', title: 'Pismo Święte', siglum: 'BT' } },
      { id: 'q', kind: 'quote', key: 'q', data: { text: 'Modlitwa jest rozmową.', work: 'bt', locator: 'J 1,1' } }
    ];

    /* Die Beschreibung für die KI: kein „prywatne", die Regel des Bereichs. */
    const said = m.libraryDescription();
    assert.ok(!said.includes('prywatne — nigdy') && !said.includes('co opublikujesz'), 'no privacy markers, no publishing');
    assert.ok(said.includes('decyduje wyłącznie obszar'), 'the area rule in one line');

    /* Gezeichnet: eingebettet, mit Tabelle; ein Kreis wird erkannt; ein unlesbares Ziel bleibt ohne Titel. */
    const ring = [
      ...shelf, KK,
      { id: 'c2', kind: 'entity', key: 'c2', data: { _kinds: ['kk'], about: ['q'], content: [{ type: 'paragraph', text: 'Dwa [@bt, J 1,1].\n\n![@c3]' }, { type: 'table', columns: ['Tu', 'Tam'], rows: [[[{ ref: 'bt', locator: 'Łk 1,35' }], [{ ref: 'tajny' }]]] }] } },
      { id: 'c3', kind: 'entity', key: 'c3', data: { _kinds: ['kk'], about: ['c2'], content: [{ type: 'paragraph', text: 'Trzy.\n\n![@c2]' }] } }
    ];
    const R = { ...look(ring), readable: () => ring };
    const sermon = { id: 's', kind: 'text', data: { title: 'K', body: 'Wstęp [@c2].\n\n![@c2]\n\n![@tajny-klucz]' } };
    const html = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: sermon, look: R }));
    assert.ok(html.includes('<table class="lib-table">') && html.includes('Łk 1,35'), 'an embedded statement brings its table; a Bible ref shows its place');
    assert.ok(html.includes('Trzy.') && html.includes('[wypowiedź osadza samą siebie]'), 'c2 → c3 → c2: the cycle stops');
    assert.ok(!html.includes('Zob. komentarz') && html.includes('class="lib-own-ref"'), 'a statement cited in the text is a link, never a footnote (2026-10-22)');
    assert.equal((html.match(/\[odwołanie niedostępne\]/g) ?? []).length, 2, 'an unreadable cell ref and an unreadable embed say only that');
    assert.ok(!html.includes('tajny'), '… and nothing about the target, not even its key');
    assert.ok(/J 1,1/.test(html.slice(html.indexOf('Przypisy'))), 'a footnote inside an embedded statement is counted with the text');
    const quoteHtml = m.renderToStaticMarkup(m.createElement(m.QuoteFigure, { entry: shelf[1], look: R }));
    assert.ok(quoteHtml.includes('Modlitwa jest rozmową.') && !quoteHtml.includes('Komentarze ('), 'a quote is drawn alone — what speaks about it is in its relations (backlinks)');
    assert.ok(m.textToLatex(sermon, R).includes('\\begin{tabular}'), 'LaTeX: a statement table is a tabular');
  }
  ok('statements in texts: four blocks with real refs, found through the kind, embed + cycle guard, unreadable refs');

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

    /* Die Zitate eines Buches (Fassung 3, 2026-10-23: ohne Themen, ohne Komentarz). */
    const book = { id: 'w-ricci', kind: 'work', key: 'ricci2016', data: { workType: 'book', title: 'Wielkość świętego Michała Archanioła', authors: ['p-ricci'], place: 'Poznań', year: '2016', isbn: '978-83-63110-45-1' } };
    const had = { id: 'q-had', kind: 'quote', key: 'ricci2016-1', data: { text: 'Święty Michale Archaniele, broń nas w walce.', work: 'w-ricci', locator: 's. 12' } };
    const shelf = look([ricci, book, had]);
    const doc = {
      format: m.QUOTES_FORMAT, version: 2, work: { title: 'Wielkość świętego Michała Archanioła' },
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
    assert.equal(fresh.topics, undefined, 'a quote has no topics any more');
    assert.ok(fresh.check.includes('por. Dn 10') && fresh.check.includes('nie zostanie zapisane'), 'an old note is shown before saving — and said not to be saved');
    assert.ok(qp.warnings.some((w) => w.includes('„topics”') && w.includes('tematów już nie ma')) && qp.warnings.some((w) => w.includes('„notes”') && w.includes('Wiedzy')), 'old fields are named, with the reason');
    assert.equal(fresh.photo, undefined, 'no photo numbers: the photos stay in the own chat');
    assert.equal(fresh.uncertain, true);
    assert.ok(m.planQuotes({ quotes: [{ text: 'x' }], work: { title: 'Zupełnie inna' } }, book, shelf).warnings.some((w) => w.includes('Zupełnie inna')), 'written for another book: said, not refused');
    assert.ok('error' in m.planQuotes({ format: 'recreatio/page', quotes: [] }, book, shelf));

    const saved = [];
    const fake = async (input) => { const id = input.id ?? `new-${saved.length}`; saved.push({ ...input, id }); return { id }; };
    const result = await m.importQuotes(qp.items, book, shelf, fake);
    assert.deepEqual([result.saved, result.failed.length, saved.length], [1, 0, 1], 'one quote (the duplicate stays out), nothing else saved — no topic, no comment');
    assert.equal(saved[0].kind, 'quote');
    assert.equal(saved[0].data.work, 'w-ricci', 'every quote belongs to this book');
    assert.deepEqual([saved[0].data.topics, saved[0].data.notes, saved[0].data.description, saved[0].data.check], [undefined, undefined, undefined, undefined], 'only the fields of a quote are written');

    const exported = m.exportQuotes(book, shelf);
    assert.deepEqual([exported.format, exported.version], [m.QUOTES_FORMAT, 3]);
    assert.deepEqual(exported.work, { title: 'Wielkość świętego Michała Archanioła', key: 'ricci2016', isbn: '978-83-63110-45-1' });
    assert.deepEqual(Object.keys(exported.quotes[0]).sort(), ['id', 'locator', 'text'], 'an exported quote: its own fields only');
    const back = m.planQuotes(exported, book, shelf);
    assert.equal(back.items[0].id, 'q-had', 'an exported quote comes back as itself');
    assert.equal(back.items[0].duplicateOf, undefined);
    assert.deepEqual(back.warnings, []);
    const resaved = [];
    await m.importQuotes(back.items, book, shelf, async (input) => { resaved.push(input); return { id: input.id }; });
    assert.deepEqual(resaved[0].data, had.data, 'export → import keeps a quote as it was');

    const description = m.quotesDescription(book);
    for (const field of m.kindOf('quote').fields) {
      if (field.key === 'work') assert.ok(!description.includes(`"work" — `), 'the book is not a field of a quote here');
      else assert.ok(description.includes(`"${field.key}" — `), `quotes description explains ${field.key}`);
    }
    assert.ok(!description.includes('"photo" — ') && !description.includes('"topics" — ') && !description.includes('"comment" — '), 'no photo, topics or comment fields');
    for (const extra of ['page', 'uncertain', 'id', 'check']) assert.ok(description.includes(`"${extra}" — `), `quotes description explains ${extra}`);
    const promptMarked = m.quotesPrompt(book, shelf, 'marked');
    assert.ok(promptMarked.includes('ołówkiem') && promptMarked.includes('Wielkość świętego Michała Archanioła') && promptMarked.includes('dopisek'), 'the prompt names the book, the pencil, and where a handwritten note goes');
    assert.ok(promptMarked.includes(m.QUOTES_FORMAT) && !promptMarked.includes('"topics": [') && !promptMarked.includes('krótkie tematy'), 'the format goes along to the own chat — no topics asked for');
    const promptWhole = m.quotesPrompt(book, shelf, 'whole');
    assert.ok(promptWhole.includes('cały tekst') && promptWhole.includes(m.QUOTES_FORMAT), 'also when the whole photo is the quote');
    assert.equal(m.QUOTES_TOOL, undefined, 'no AI is called from the app');
    ok('quotes of a book (v3): duplicates, hyphenation, pages, old topics/notes named and not saved, export → import, description from the kind, prompt');
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

    /* Ein kleines Skryptorium: ein Rodzaj tekstu mit zwei Verweisfeldern (Okres, Temat — Einträge in Nauka), ein Kazanie, drei Wygłoszenia. */
    const E = (id, kind, data, key) => ({ id, kind, ...(key === undefined ? {} : { key }), data });
    const entries = [
      ...lib.all(),
      E('o-adwent1', 'entity', { _kinds: ['k-okres'], name: 'I Niedziela Adwentu' }),
      E('o-post', 'entity', { _kinds: ['k-okres'], name: 'Wielki Post' }),
      E('o-nadzieja', 'entity', { _kinds: ['k-temat'], name: 'Nadzieja' }),
      E('tt-kazanie', 'texttype', { name: 'Kazanie', fields: [{ key: 'okres', label: 'Okres', type: 'ref', to: ['k-okres'] }, { key: 'temat', label: 'Temat', type: 'ref', to: ['k-temat'] }] }, 'kazanie'),
      E('sermon', 'text', {
        textType: 'tt-kazanie', title: 'Chleb', date: '2020-01-01', okres: 'o-adwent1', temat: 'o-nadzieja',
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
      E('d3', 'delivery', { texts: ['sermon'], date: '2025-12-01' })
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

    /* Achsen (2026-10-23): die Verweisfelder des Rodzaj tekstu — keine Themen. */
    assert.deepEqual(m.typeMarks(sermon.data, L).map((x) => [x.key, x.label, x.name]), [['okres', 'Okres', 'I Niedziela Adwentu'], ['temat', 'Temat', 'Nadzieja']], 'a sermon: what the reference fields of its type point at, by name');
    assert.deepEqual(m.typeLines(sermon.data, L).map((x) => `${x.label}: ${x.value}`), ['Okres: I Niedziela Adwentu', 'Temat: Nadzieja'], 'and as lines over the text');

    /* Gezeichnet: der Plan, und auf ihm das gewählte Wygłoszenie. */
    const plain = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: sermon, look: L }));
    assert.ok(plain.includes('lib-plan') && plain.includes('Modlitwa jest rozmową.') && plain.includes('Wygłoszenia (3)'), 'plan with the embedded quote, and the deliveries');
    assert.ok(!plain.includes('lib-mark '), 'no marks while no delivery is chosen');
    const notes = [...plain.matchAll(/<li id="fn-(\d+)">(.*?)<\/li>/g)].map((x) => x[2].replace(/<[^>]+>/g, ''));
    assert.ok(notes[0].startsWith('J 6,35 (BT)') && notes[1].startsWith('J. Ratzinger, Jezus z Nazaretu'), `footnotes count the plan first, then the text (${notes.join(' | ')})`);
    assert.ok(!plain.includes('Komentarze ('), '2026-10-23: no statements at the points — a statement says in its own fields what it is about');
    const marks = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: sermon, look: L, delivery: 'd1' }));
    assert.ok(marks.includes('lib-mark is-said') && marks.includes('lib-mark is-short') && marks.includes('lib-mark is-skipped'), 'the chosen delivery marks the plan');
    assert.ok(marks.includes('▶ 0:40') && marks.includes('Bez całego cytatu'), 'times you can jump to, and what was different');
    const addedAt = marks.indexOf('Zaproszenie na adorację');
    assert.ok(addedAt > marks.indexOf('Gdzie szukam?') && addedAt < marks.indexOf('Zastosowanie na tydzień'), 'what was added stands after its point');

    /* Druck: der Plan im Text, und der Plan allein für die Kanzel. */
    const tex = m.textToLatex(sermon, L);
    assert.ok(tex.includes('\\section*{Plan}') && tex.includes('\\begin{enumerate}') && tex.includes('\\item Głód') && tex.includes('\\footnote{J 6,35 (BT).}'), 'LaTeX: the plan as a numbered list with its footnotes');
    assert.equal((tex.match(/\\begin\{enumerate\}/g) ?? []).length, (tex.match(/\\end\{enumerate\}/g) ?? []).length, 'LaTeX: every list is closed');
    const pulpit = m.planToLatex(sermon, L);
    assert.ok(pulpit.includes('{extarticle}') && pulpit.includes('14pt') && pulpit.includes('Głód'), 'the pulpit sheet: large, the plan alone');

    /* Das Polecenie für den eigenen Chat — und die Antwort ins offene Formular. */
    const prompt = m.deliveryPrompt(L.get('d1'), L);
    assert.ok(prompt.includes('[p1] 1 Głód') && prompt.includes('[p2]') && prompt.includes('Modlitwa jest rozmową.') && prompt.includes('"id": "d1"') && prompt.includes('"coverage"'), 'the delivery prompt carries the plan with ids and the format');
    assert.ok(m.planPrompt(sermon).includes('Treść [@jezus, s. 5].') && m.planPrompt(sermon).includes('"id": "sermon"'), 'the plan prompt carries the text');
    const WRITING = m.SCRIPTORIUM_SPEC;
    const answer = { format: WRITING.format, version: 1, entries: [
      { id: 'd1', kind: 'delivery', data: { coverage: [{ point: 'p4', state: 'Pominięte', at: '9:00' }], summary: 'Nowe' } },
      { kind: 'topic', data: { name: 'x' } }
    ] };
    const patch = m.patchFromDoc(answer, { id: 'd1', kind: 'delivery' }, L, WRITING);
    assert.deepEqual(Object.keys(patch.patch).sort(), ['coverage', 'summary'], 'only the fields the answer gives');
    assert.deepEqual(patch.patch.coverage, [{ point: 'p4', state: 'skipped', at: '9:00' }], 'a state by its label means its value');
    assert.ok(patch.warnings.some((w) => w.includes('Pozostałe wpisy')), 'other entries are named, not imported');
    assert.ok('error' in m.patchFromDoc({ format: 'recreatio/page' }, { id: 'd1', kind: 'delivery' }, L, WRITING));

    /* JSON der Bibliothek: Punkte ohne Kennung bekommen eine, Werte beim Namen, Unbekanntes wird gemeldet. */
    const imported = m.planLibraryImport({ entries: [{ kind: 'text', key: 'nowy', data: { plan: [{ text: 'A' }, { text: 'B', depth: '1', kind: 'Przykład' }, 'C', { text: 'D', bogus: 1 }, { id: 'same', text: 'E' }, { id: 'same', text: 'F' }] } }] }, empty, WRITING);
    const iplan = imported.drafts[0].data.plan;
    assert.equal(iplan.length, 6);
    assert.ok(iplan.every((p) => typeof p.id === 'string' && p.id !== '') && new Set(iplan.map((p) => p.id)).size === 6, 'every point gets a unique id');
    assert.deepEqual([iplan[1].depth, iplan[1].kind, iplan[2].text, iplan[4].id], [1, 'example', 'C', 'same']);
    assert.ok(imported.warnings.some((w) => w.includes('bogus')), 'unknown point fields are reported');
    const writingDoc = m.kindsDoc(m.WRITING_KINDS);
    for (const sub of ['"depth" — Poziom', '"state" — Jak', '"after" — Po punkcie', '"texts" — Kazanie (tekst)']) assert.ok(writingDoc.includes(sub), `description explains ${sub}`);

    /* Das Archiv: Zeilen aus den Texten, Achsen aus den Verweisfeldern der Rodzaje tekstów (2026-10-23), Filter, Zahlen. */
    const row = m.archiveRow(sermon, L);
    assert.deepEqual([row.title, row.date, row.occasion, row.held, row.recorded, row.marks.length, row.plan.length], ['Chleb', '2026-08-02', 'XVIII Niedziela zwykła', 3, true, 2, 3]);
    const other = { ...row, id: 'x', title: 'Inny', date: '2019-01-01', marks: [{ facet: m.fieldFacet('okres'), facetName: 'Okres', id: 'o-post', name: 'Wielki Post' }], project: null };
    const facets = m.facetsOf([row, other], [{ id: 'proj', title: 'Cykl A' }]);
    assert.deepEqual(facets.map((f) => [f.id, f.name, f.values.map((v) => v.name)]), [['@okres', 'Okres', ['I Niedziela Adwentu', 'Wielki Post']], ['@temat', 'Temat', ['Nadzieja']], [m.PROJECTS, 'Cykl', ['Cykl A']]],
      'one axis per reference field of the text types (the same key in several types is one), values by name, then the projects');
    const found = (groups, order = '-sort', matching = null) => m.browseLocal([row, other], { groups, matching, order });
    assert.deepEqual(found([['o-adwent1']]).rows.map((r) => r.id), ['sermon'], 'a value finds the texts that point at it');
    assert.deepEqual(found([['o-adwent1', 'o-post'], ['o-nadzieja']]).rows.map((r) => r.id), ['sermon'], 'OR within a group, AND between groups');
    assert.deepEqual(found([], 'sort').rows.map((r) => r.id), ['x', 'sermon'], 'oldest first');
    assert.deepEqual(found([], '-sort', new Set(['x'])).rows.map((r) => r.id), ['x'], 'search narrows');
    assert.deepEqual([found([]).counts.get('o-adwent1'), found([]).counts.get('o-post'), found([]).counts.get('o-nadzieja')], [1, 1, 1], 'counts per value');
    const keyOf = (id) => m.facetKey(id, facets, new Set(['proj']));
    assert.deepEqual([keyOf('o-adwent1'), keyOf('o-nadzieja'), keyOf('nic'), keyOf('proj')], ['@okres', '@temat', '', m.PROJECTS]);
    assert.deepEqual(m.choose([], 'o-adwent1', keyOf, false), ['o-adwent1']);
    assert.deepEqual(m.choose(['o-adwent1'], 'o-post', keyOf, false), ['o-post'], 'one value per axis: another replaces it');
    assert.deepEqual(m.choose(['o-adwent1'], 'o-nadzieja', keyOf, false), ['o-adwent1', 'o-nadzieja'], 'different axes add up');
    assert.deepEqual(m.choose(['o-adwent1', 'o-nadzieja'], 'o-adwent1', keyOf, false), ['o-nadzieja'], 'the same value again removes it');
    assert.deepEqual(m.choose(['o-adwent1'], 'o-nadzieja', keyOf, true), ['o-nadzieja'], 'an older service takes one filter');
    assert.deepEqual(m.archiveRow({ ...sermon, data: { ...sermon.data, temat: 'o-tajne' } }, L).marks.map((x) => x.id), ['o-adwent1'], 'a target this reader cannot open is no filter value — nothing about it shows');
    assert.deepEqual(['Tabela', 'drzewo', 'list', ''].map(m.layoutOf), ['table', 'tree', 'list', 'list']);
    ok('sermons: plan (depth, numbers, paste), times and links, the text type’s fields as archive axes, marks on the plan, LaTeX, prompts, JSON into the form, archive rows, filters and counts');
  }

  /* -- 2j. Dostęp dla AI (0126): die Abschrift eines Behälters — lesbar, und nur innerhalb des Links ------- */
  {
    const store = (libraryId, entries) => ({ libraryId, areaId: 'area', revision: 1, all: () => entries, get: (id) => entries.find((e) => e.id === id), byKey: (k) => entries.find((e) => e.key === k) });
    const U = (n) => `01a00000-0000-7000-8000-${String(n).padStart(12, '0')}`;
    const person = { id: U(1), kind: 'person', key: 'augustyn', data: { givenNames: 'Aureliusz', surname: 'Augustyn' }, updatedAt: '2026-10-24T10:00:00Z' };
    const work = { id: U(2), kind: 'work', key: 'wyznania', data: { title: 'Wyznania', authors: [U(1)] } };
    const quote = { id: U(3), kind: 'quote', key: 'niespokojne', data: { text: 'Niespokojne jest serce nasze.', work: U(2), locator: 'I,1' } };
    const oldTopic = { id: U(4), kind: 'topic', data: { name: 'Stary temat' } };
    const pojecie = { id: U(10), kind: 'kind', data: { name: 'Pojęcie', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'zrodlo', label: 'Źródło', type: 'ref', to: ['work'], says: 'Skąd to wiemy' }] } };
    const laska = { id: U(11), kind: 'entity', data: { _kinds: [U(10)], nazwa: 'Łaska', zrodlo: U(2) } };
    const view = { id: U(12), kind: 'view', data: { name: 'Widok' } };
    const type = { id: U(20), kind: 'texttype', key: 'kazanie', data: { name: 'Kazanie', fields: [{ key: 'pojecie', label: 'Pojęcie', type: 'ref', to: [U(10)] }] } };
    const sermon = { id: U(21), kind: 'text', key: 'chleb', data: { title: 'O chlebie', textType: U(20), body: `Serce [@${U(3)}, s. 3], obok [@${U(99)}] i [[słowa|@${U(11)}]].`, pojecie: U(11), _aliases: ['stary'] } };
    const parts = [
      { store: store('L', [person, work, quote, oldTopic]), kind: 'books', name: 'Źródła' },
      { store: store('S', [type, sermon]), kind: 'writing', name: 'Kazania' },
      { store: store('K', [pojecie, laska, view]), kind: 'knowledge', name: 'Pojęcia' }
    ];
    const lib = m.snapshotDoc(parts, 'L', '2026-10-24T12:00:00Z');
    assert.deepEqual([lib.v, lib.library, lib.part, lib.name, lib.madeAt], [m.SNAPSHOT_VERSION, 'L', 'books', 'Źródła', '2026-10-24T12:00:00Z']);
    assert.deepEqual(lib.entries.map((e) => [e.kind, e.kindName, e.title, e.key]), [['person', 'Osoba', 'Aureliusz Augustyn', 'augustyn'], ['work', 'Źródło', 'Wyznania', 'wyznania'], ['quote', 'Cytat', 'Niespokojne jest serce nasze.', 'niespokojne']],
      'library: sources only, titles and kind names as the app shows them; an old kind stays under „Stare wpisy", not here');
    assert.deepEqual([lib.entries[0].updatedAt, lib.entries[2].refs], ['2026-10-24T10:00:00Z', [U(2)]], 'when it changed; what it points at');
    assert.deepEqual(lib.kinds.map((k) => k.id), ['work', 'quote', 'person'], 'the kinds in use, with every field described');
    assert.ok(lib.kinds.every((k) => k.fields.every((f) => typeof f.says === 'string' && f.says.length > 3)) && lib.notes.includes('Ps 23') && !lib.notes.includes('## Zapis treści'), 'notes for a library: how it is cited and the places in the Scripture (BIBLE_DOC) — the markup of texts is the Scriptorium’s');

    const scr = m.snapshotDoc(parts, 'S', 'now');
    const text = scr.entries.find((e) => e.id === U(21));
    assert.deepEqual([text.kinds, text.typeName, text.refs], [['text', U(20)], 'Kazanie', [U(20), U(3), U(11)]], 'a text carries its text type as a second kind; refs inside the link (also into a base)');
    assert.equal(text.data.body, `Serce [@niespokojne, s. 3], obok [@${U(99)}] i [[słowa|@${U(11)}]].`, 'markup shows keys where they find the entry again — outside the link a bare id');
    assert.ok(!('_aliases' in text.data), 'internal fields (_…) are left out');
    assert.ok(scr.kinds.some((k) => k.id === U(20) && k.name === 'Kazanie' && k.fields.some((f) => f.key === 'pojecie')) && scr.notes.includes('[@klucz, s. 23]'), 'the text type is a kind; the notes explain the markup (MARKUP_DOC)');

    const base = m.snapshotDoc(parts, 'K', 'now');
    assert.deepEqual(base.entries.map((e) => [e.title, e.kindName, e.refs]), [['Łaska', 'Pojęcie', [U(2)]]], 'a base: its own entries (no views or other tools), labels from Nauka, references resolved');
    assert.deepEqual(base.kinds.map((k) => [k.name, k.fields.map((f) => f.key)]), [['Pojęcie', ['nazwa', 'zrodlo']]], 'its kinds with their fields');
    assert.equal(base.kinds[0].fields[1].says, 'Skąd to wiemy');

    /* The same Scriptorium in a link without the library and the base: nothing of them shows. */
    const alone = m.snapshotDoc([parts[1]], 'S', 'now').entries.find((e) => e.id === U(21));
    assert.deepEqual([alone.refs, alone.data.body.includes('niespokojne')], [[U(20)], false], 'what the link does not hold is never resolved — no title, no key');
    assert.throws(() => m.snapshotDoc([parts[1]], 'L', 'now'), /nie należy/, 'only a collection of the link');
    assert.deepEqual(m.snapshotRefs({ id: 'x', data: { a: { value: U(3) }, b: [{ ref: U(2) }], _c: U(1), d: `[[t|@augustyn]]` } }, { get: (id) => [person, work, quote].find((e) => e.id === id), byKey: (k) => [person, work, quote].find((e) => e.key === k) }),
      [U(3), U(2), U(1)], 'references anywhere in the data: envelopes, cells, markup by key — not in internal fields');
    const packed = await m.gzip('{"v":1}');
    assert.deepEqual([packed[0], packed[1]], [0x1f, 0x8b], 'packed as gzip (the service unpacks with a limit)');
    ok('AI access: a readable snapshot per collection — titles, kinds with field meanings, notes from the app, references only inside the link');
  }

  /* 2j. 2026-10-24 — Miejsca w dziele (`locations.ts`): ein Modell für jede Stelle. */
  {
    const P = m.loc.parsePlace;
    const F = (text, scheme, o) => m.loc.formatPlace(P(text, scheme, o), text);
    const hit = (a, sa, b, sb = sa, oa = {}, ob = {}) => P(a, sa, oa).spans.some((x) => P(b, sb, ob).spans.some((y) => m.loc.overlap(x, y)));
    assert.equal(F('J 21,15-17', 'bible'), 'J 21,15-17', 'Scripture: book, chapter, verses — written back the same');
    assert.equal(P('Mt 5,3-12; 6,1', 'bible').spans.length, 2, 'discontinuous: two pieces');
    assert.ok(hit('Ps 50,3', 'bible', 'Ps 51,3', 'bible', { psalms: 'greek' }) && !hit('Ps 50,3', 'bible', 'Ps 51,3'), 'Psalms: a Vulgate (Greek) number meets the Hebrew one only when the work says so');
    assert.ok(hit('J 21', 'bible', 'J 21,16') && !hit('J 21,15', 'bible', 'J 21,16'), 'a chapter holds its verses; a verse is not the next one');
    assert.ok(hit('nn. 24–26', 'numbered', 'nr 25') && !hit('nr 24', 'numbered', 'nr 25') && P('kan. 915 § 1', 'numbered').spans.length === 1, 'documents: numbers, ranges, a paragraph in a canon');
    assert.equal(F('I-II, q. 90, a. 1, ad 2', 'aquinas'), 'I-II, q. 90, a. 1, ad 2', 'Aquinas: part, question, article, answer to an objection');
    assert.ok(hit('I, q. 2, a. 3', 'aquinas', 'I q. 2 a. 3 co.') && !hit('I, q. 2, a. 3, ad 1', 'aquinas', 'I, q. 2, a. 3, co.'), 'the article holds its corpus; ad 1 is not the corpus');
    assert.ok(hit('4.1–4.116', 'decimal', '4.11') && !hit('4.1–4.116', 'decimal', '4.2') && hit('2.01', 'decimal', '2.0121'), 'Tractatus: decimal levels, ranges, a proposition holds its comments');
    assert.ok(hit('§§ 1–5', 'sections', '§ 3') && P('cz. II, xi', 'sections').spans.length === 1 && !hit('§ 3', 'sections', 'cz. II, iii'), 'Investigations: §§ of part I, the sections of part II apart');
    assert.ok(hit('t. 2, cz. 1, rozdz. 3', 'outline', 'rozdz. 3') && !hit('t. 2, cz. 1, rozdz. 3', 'outline', 'rozdz. 4'), 'an outline: levels may be missing; what both name must meet');
    const both = P('rozdz. 3, s. 45', 'pages');
    assert.ok(m.loc.isStructural(both) && both.pages[0].from === 45 && !m.loc.isStructural(P('s. 23–25', 'pages')), 'structure and page in one place; pages alone belong to this edition only');
    assert.ok(P('s. xii', 'pages').pages[0].from < P('s. 1', 'pages').pages[0].from, 'roman pages (front matter) come before page 1');
    const AQ = { id: 'aq', kind: 'work', key: 'sth', data: { workType: 'book', title: 'Summa theologiae', scheme: 'aquinas' } };
    const aq = (id, locator) => ({ id, kind: 'quote', data: { text: id, work: ['aq'], locator } });
    const aqq = [aq('b', 'I-II, q. 1, a. 1'), aq('a', 'I, q. 2, a. 3'), aq('c', 'I-II, q. 90, a. 1, ad 2'), aq('d', 'I-II, q. 90, a. 1')];
    const AL = look([AQ, ...aqq]);
    assert.deepEqual([...aqq].sort((x, y) => m.quoteOrder(x, AL).localeCompare(m.quoteOrder(y, AL))).map((q) => q.id), ['a', 'b', 'd', 'c'], 'quotes ordered by the scheme of their work (part, question, article, answer)');
    assert.ok(m.kindOf('work').fields.some((f) => f.key === 'scheme' && f.options.length === m.loc.SCHEMES.length) && m.kindOf('work').fields.some((f) => f.key === 'editionOf' && f.type === 'ref'), 'a work says its scheme and of which work it is an edition');
    ok('places in a work: Scripture (both Psalm numberings), documents, Aquinas, Tractatus, Investigations, outlines, pages — structure vs. edition');
  }

  /* 2k. 2026-10-24 — Tekst źródła (`sourceText.ts`): JSON, Prüfung, Teile, Verknüpfung beim Lesen, Datenschutz. */
  {
    const S = m.src;
    const schemeWork = { pages: 'book', bible: 'bible', numbered: 'document' };
    const keys = { pages: 'ratzinger2007', bible: 'bt', numbered: 'dei-verbum', aquinas: 'sth', decimal: 'tractatus', sections: 'dociekania', outline: 'wyznania' };
    for (const [scheme, doc] of Object.entries(S.SOURCE_EXAMPLES)) {
      const work = { id: `w-${scheme}`, kind: 'work', key: keys[scheme], data: { workType: schemeWork[scheme] ?? 'book', title: scheme } };
      const plan = S.planSourceImport(doc, { work });
      assert.ok(!('error' in plan), `example ${scheme} imports: ${plan.error ?? ''}`);
      assert.deepEqual([plan.scheme, plan.warnings], [scheme, []], `example ${scheme}: its scheme, no warnings`);
      assert.ok(plan.summary.located > 0 || scheme === 'pages', `example ${scheme}: blocks carry places`);
      const again = S.planSourceImport(S.exportSourcePart(work, S.readManifest(S.nextManifest(undefined, work.id, plan, 'p')), S.readPart(S.partData('t', work.id, plan))), { work });
      assert.deepEqual(again.blocks, plan.blocks, `example ${scheme}: export → import gives the same blocks`);
    }
    const BT = { id: 'bt1', kind: 'work', key: 'bt', data: { workType: 'bible', title: 'Biblia Tysiąclecia', siglum: 'BT' } };
    assert.match(S.planSourceImport({ format: 'x' }, { work: BT }).error, /recreatio\/source-text/, 'another format is refused');
    assert.match(S.planSourceImport({ ...S.SOURCE_EXAMPLES.bible, work: '@inne' }, { work: BT }).error, /innego dzieła/, 'a text for another work is refused');
    assert.match(S.planSourceImport({ ...S.SOURCE_EXAMPLES.bible, scheme: 'pages' }, { work: { ...BT, data: { ...BT.data, scheme: 'bible' } } }).error, /układ miejsc/, 'a scheme that contradicts the work is refused');
    const warned = S.planSourceImport({ ...S.SOURCE_EXAMPLES.pages, work: '@bt', scheme: undefined, blocks: [{ type: 'page', page: '40' }, { type: 'paragraph', text: 'A {{page 39}} b {{note 9}}' }, { type: 'quiz' }] }, { work: { ...BT, data: { workType: 'book', title: 'K' } } });
    assert.ok(warned.warnings.some((w) => /39 po stronie wyższej/.test(w)) && warned.warnings.some((w) => /\{\{note 9\}\}/.test(w)) && warned.warnings.some((w) => /nieznany typ/.test(w)), 'warnings: pages out of order, a note reference without its note, an unknown block (skipped)');
    assert.deepEqual(S.pieces('a {{page 34 pdf 46}}b{{note 1}} {{? sł}} {{gap}}').map((p) => p.t), ['text', 'page', 'text', 'note', 'text', 'unsure', 'text', 'gap'], 'marks inside the text: page breaks (printed + PDF), notes, uncertain, gaps');
    assert.equal(S.plainOfText('Ala {{page 2}}ma {{? kota}}{{note 1}}.'), 'Ala ma kota.', 'the plain text has no marks (search, quotes)');

    /* Blöcke zu einer Stelle: genau getroffen, ganze Einheit, Seiten; die Kapitelüberschrift nur, wenn nichts Genaueres da ist. */
    const bib = S.SOURCE_EXAMPLES.bible.blocks;
    const find = (blocks, loc, scheme) => S.findBlocks(blocks, m.loc.parsePlace(loc, scheme), scheme);
    assert.deepEqual([find(bib, 'J 21,16', 'bible'), find(bib, 'J 21', 'bible'), find(bib, 'J 20,1', 'bible')], [[3], [0, 1, 2, 3], []], 'a verse: its block; a chapter: all of it; elsewhere: nothing');
    const coarse = [{ type: 'heading', loc: 'J 21', text: 'R' }, { type: 'paragraph', loc: 'J 21,15-17', text: 'a' }, { type: 'paragraph', loc: 'J 21,18', text: 'b' }];
    assert.deepEqual(find(coarse, 'J 21,16', 'bible'), [1], 'a verse inside a paragraph of several verses: that paragraph, not the chapter heading');
    assert.deepEqual(find(S.SOURCE_EXAMPLES.pages.blocks, 's. 34', 'pages'), [2, 3], 'a page: the paragraph that runs onto it and what stands on it');
    assert.deepEqual(find(S.SOURCE_EXAMPLES.aquinas.blocks, 'I, q. 2, a. 3, ad 1', 'aquinas'), [5], 'Aquinas: the answer to the first objection');

    /* Teile: derselbe Schlüssel ersetzt, ein anderer kommt dazu, derselbe Teil zweimal ändert nichts, doppelte Stellen werden gemeldet. */
    const one = S.planSourceImport(S.SOURCE_EXAMPLES.bible, { work: BT });
    const m1 = S.readManifest(S.nextManifest(undefined, BT.id, one, 'p1'));
    const re = S.planSourceImport(S.SOURCE_EXAMPLES.bible, { work: BT, manifest: m1 });
    assert.ok(re.replaces && S.samePart(S.readPart(S.partData('t', BT.id, one)), re), 'the same portion again: it replaces itself and nothing changed (no duplicate)');
    assert.equal(S.readManifest(S.nextManifest(m1, BT.id, re, 'p1')).parts.length, 1, 'still one part');
    const dup = S.planSourceImport({ ...S.SOURCE_EXAMPLES.bible, portion: { key: 'J-bis', label: 'J znowu', order: 44 } }, { work: BT, manifest: m1 });
    assert.deepEqual([dup.replaces, S.overlapsWith(m1, dup)], [false, ['Ewangelia według św. Jana']], 'another key with the same places: added, but flagged as a probable duplicate');
    const mk = S.planSourceImport({ ...S.SOURCE_EXAMPLES.bible, portion: { key: 'Mk', label: 'Marek', order: 41 }, blocks: [{ type: 'paragraph', loc: 'Mk 1,1', text: 'Początek Ewangelii.' }] }, { work: BT, manifest: m1 });
    const m2 = S.readManifest(S.nextManifest(m1, BT.id, mk, 'p2'));
    assert.deepEqual([m2.parts.map((p) => p.key), S.overlapsWith(m1, mk)], [['Mk', 'J'], []], 'another book: added in canonical order, no warning');
    assert.deepEqual([S.placeInManifest(m2, 'J 21,15').part.id, S.placeInManifest(m2, 'Mk 1,1').part.id, S.placeInManifest(m2, 'Rdz 1,1').status], ['p1', 'p2', 'none'], 'a place finds its part from the directory alone');
    const pagesTwice = { work: 'w', scheme: 'pages', edition: {}, parts: [{ id: 'a', key: 'a', label: 'A', order: 1, pages: [10, 20], blocks: 1, words: 1 }, { id: 'b', key: 'b', label: 'B', order: 2, pages: [15, 30], blocks: 1, words: 1 }] };
    assert.deepEqual([S.placeInManifest(pagesTwice, 's. 17').status, S.placeInManifest(pagesTwice, 's. 25').part.id], ['ambiguous', 'b'], 'a page in two parts is ambiguous — said, not guessed');

    /* Aus einer Auswahl: die Stelle. */
    assert.equal(S.selectionLocator(bib, 2, 3, 'bible'), 'J 21,15-16', 'selected verses → their range');
    assert.equal(S.selectionLocator(S.SOURCE_EXAMPLES.pages.blocks, 2, 3, 'pages'), 's. 33–34', 'a selection in a book → its pages in this edition');
    assert.equal(S.searchParts([{ part: m1.parts[0], data: S.readPart(S.partData('t', BT.id, one)) }], 'milujesz')[0].loc, 'J 21,15', 'search ignores diacritics and says where');
    const vgBlocks = [{ type: 'heading', loc: 'J 21', text: 'Caput XXI' }, { type: 'paragraph', loc: 'J 21,15-16', text: 'Cum ergo… diligis me?' }, { type: 'paragraph', loc: 'J 21,17', text: 'Dicit ei tertio' }];
    const aligned = S.alignEditions(bib, vgBlocks, { scheme: 'bible' }, { scheme: 'bible' });
    assert.deepEqual([aligned.rows.map((r) => [r.mine, r.theirs]), aligned.rest], [[[[0, 1], [0]], [[2], [1]], [[3], [2]]], []],
      'two editions side by side: chapter by chapter, a paragraph of two verses next to its first verse, a verse this part lacks after the verse before it');

    /* Beim Lesen verknüpft — und nur, was dieser Leser lesen darf. */
    const text = { id: 'tx1', kind: 'sourcetext', libraryId: 'priv', data: S.nextManifest(undefined, BT.id, one, 'p1') };
    const VG = { id: 'vg1', kind: 'work', key: 'vg', data: { workType: 'bible', title: 'Nova Vulgata', psalms: 'greek', editionOf: ['bt1'] } };
    const quote = { id: 'q1', kind: 'quote', key: 'q1', data: { text: 'Miłujesz', work: ['bt1'], locator: 'J 21,15' } };
    const base = [BT, VG, quote];
    const reader = { ...look(base), readable: () => base, texts: (w) => (w === 'bt1' ? [text] : []) };
    const stranger = { ...look(base), readable: () => base, texts: () => [] };
    assert.deepEqual([S.textPlace(reader, reader.texts, 'bt1', 'J 21,15').status, S.textPlace(stranger, stranger.texts, 'bt1', 'J 21,15')], ['found', null], 'with the text readable: found; without: nothing at all');
    const viaEdition = S.textPlace(reader, reader.texts, 'vg1', 'J 21,16');
    assert.deepEqual([viaEdition.status, viaEdition.edition.id, S.textPlace(reader, reader.texts, 'vg1', 's. 5')], ['found', 'bt1', null], 'another edition: a verse is found in the sister text, a page never');
    const cites = { id: 'c', kind: 'text', data: { title: 'K', body: 'Raz [@bt, J 21,15]. Dwa [@q1].' } };
    const withText = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: cites, look: reader }));
    const without = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: cites, look: stranger }));
    assert.equal((withText.match(/pokaż w tekście/g) ?? []).length, 2, 'both footnotes (a work with a place, a quote with its place) lead into the text');
    assert.ok(!without.includes('pokaż w tekście') && !without.includes('w tekście'), 'a reader who cannot read the text sees no trace of it');
    const amb = { ...reader, texts: () => [{ ...text, data: { work: 'bt1', scheme: 'pages', parts: pagesTwice.parts } }] };
    const ambHtml = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: { id: 'c2', kind: 'text', data: { title: 'K', body: 'X [@bt, s. 17].' } }, look: amb }));
    assert.ok(ambHtml.includes('niejednoznaczne'), 'an ambiguous place is flagged in the footnote');
    const fig = m.renderToStaticMarkup(m.createElement(m.QuoteFigure, { entry: quote, look: reader }));
    assert.ok(fig.includes('pokaż w tekście'), 'a quote leads to its place in the text');
    const block = m.renderToStaticMarkup(m.createElement(m.SourceBlockView, { block: { type: 'paragraph', loc: 'J 21,15', text: 'A {{page 34}}b{{note 1}}' }, index: 0, prefix: 'x-' }));
    assert.ok(block.includes('data-label="s. 34"') && block.includes('data-label="J 21,15"') && !/>s\. 34</.test(block) && !/>J 21,15</.test(block), 'marks are labels (::before), never selectable text — a quote from a selection stays clean');

    /* Wo der Text nicht hingehört: JSON der Bibliothek, Abschrift für AI, Suche. */
    assert.ok(S.HEAVY_KINDS.has('sourcepart') && !m.isLibraryKind('sourcetext') && !m.isLibraryKind('sourcepart'), 'parts are heavy (synced as rows only); neither kind is exported with the library JSON');
    const snap = m.snapshotDoc([{ store: { libraryId: 'L', all: () => [BT, quote, text] }, kind: 'books', name: 'Biblioteka' }], 'L', 'now');
    assert.ok(!snap.entries.some((e) => e.kind === 'sourcetext'), 'the AI snapshot leaves the text directory out');
    const desc = S.sourceTextDescription();
    assert.ok(m.loc.SCHEMES.every((s) => desc.includes(`"${s.id}"`)) && desc.includes('{{page 46 pdf 52}}') && desc.includes('Nie wymyślaj tekstu'), 'the description names every scheme, the marks and the rule: never invent text');
    assert.ok(S.sourceTextPrompt(BT, 'Biblia Tysiąclecia', 'bible').includes('"@bt"'), 'the prompt names the work by its key');
    ok('source texts: JSON with examples for every scheme, checked import in portions (no duplicates), places → blocks, ambiguity said, links made while reading, invisible to readers without access');
  }
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
