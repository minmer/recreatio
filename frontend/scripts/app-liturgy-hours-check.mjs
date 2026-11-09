/**
 * 2026-11-09 — LITURGIA GODZIN: EIN BRZMIENIE, ZWEI ANSICHTEN — die Abnahme im Testbestand.
 *
 * `templates/liturgy/hours-test.json` (erfundene Texte) geht durch den echten Import (`commitImport`) in einen Speicher
 * im Arbeitsspeicher; dann: beide Ansichten von Antiphon (mit Teilung, zwei Verwendungen, gleiches Brzmienie mit anderer
 * Teilung zusammengeführt), Hymnus (Zeilen, Strophen), Psalm (ganz, zwei und drei Teile), Psalm 119 (22 Teile);
 * Laudes, Lesehore, Sext, Komplet und Invitatorium zusammengesetzt; Doxologie angefügt und weggelassen; Schluss des
 * Gebets; Export → Import ändert nichts; Fehler in der Vorschau lesbar; die React-Ansichten gerendert; 1.0 → 2.0.
 *
 *   node scripts/app-liturgy-hours-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

globalThis.BroadcastChannel = undefined;
const dir = await mkdtemp(join(tmpdir(), 'liturgy-hours-'));
let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };

try {
  const root = resolve('src/app').replaceAll('\\', '/');
  const entry = join(dir, 'entry.tsx');
  await writeFile(entry, [
    `export * from '${root}/library/liturgy/liturgyJson';`, `export * from '${root}/library/liturgy/persistence';`, `export * from '${root}/library/liturgy/resources';`,
    `export * from '${root}/library/liturgy/text';`, `export * from '${root}/library/liturgy/compose';`, `export * from '${root}/library/liturgy/defaults';`,
    `export { DEFAULT_CONTEXT } from '${root}/library/liturgy/schema';`, `export { ResourceText, CompositionView } from '${root}/library/liturgy/LiturgyHome';`,
    `export { createElement } from 'react';`, `export { renderToStaticMarkup } from 'react-dom/server';`
  ].join('\n'));
  await build({ entryPoints: [entry], outfile: join(dir, 'check.mjs'), bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', nodePaths: [resolve('node_modules')],
    loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, logLevel: 'error',
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
  const m = await import(pathToFileURL(join(dir, 'check.mjs')).href);

  /* -- Der Testbestand: Import über den echten Weg ------------------------------------------------------ */
  let rows = [], writes = 0;
  const store = { libraryId: '01a00000-0000-7000-8000-000000000001', all: () => rows, own: (id) => rows.find((e) => e.id === id), sync: async () => {},
    saveAll: async (inputs, _p, remove = []) => { writes++; rows = rows.filter((e) => !remove.includes(e.id)); for (const e of inputs) { const at = rows.findIndex((r) => r.id === e.id); const next = { ...e, version: (rows[at]?.version ?? 0) + 1 }; if (at >= 0) rows[at] = next; else rows.push(next); } } };
  const testDoc = JSON.parse(await readFile(new URL('../../templates/liturgy/hours-test.json', import.meta.url), 'utf8'));
  const preview = m.planLiturgyImport(testDoc, m.effectiveEntities([]), []);
  assert.deepEqual(preview.problems, [], 'the test collection plans without problems');
  assert.ok(preview.lines.some((l) => l.includes('Scalono identyczne brzmienie') && l.includes('test.ant.a.copy')), 'the identical antiphon is merged in the preview');
  const saved = await m.commitImport(store, testDoc);
  assert.equal(writes, 1, 'one save');
  const own = m.entitiesOf(rows);
  const all = m.effectiveEntities(own);
  const index = m.indexOf(all);
  const get = (id) => index.get(id);
  ok(`the test collection is imported in one save: ${saved.saved} entities, ${saved.create.length} created`);

  const text = (l) => l.segs.map((s) => `${s.cross ? '✠ ' : ''}${s.text}${s.mark ? ` ${s.mark}` : ''}`).join(' ');
  const textLines = (lines) => lines.filter((l) => l.kind === 'text');

  /* -- Antyfona: ein Brzmienie, Teilung, bezeugte andere Teilung, zwei Verwendungen ------------------- */
  const ant = get('test.ant.a');
  assert.equal(get('test.ant.a.copy'), ant, 'the copy id resolves to the merged antiphon');
  assert.deepEqual(ant.aliases, ['test.ant.a.copy']);
  assert.equal(m.paragraphs(ant.text).join(''), 'Przykładowa antyfona, część przed podziałem, a oto jej część po podziale.', 'continuous view: the wording, no marks');
  assert.equal(text(m.resourceLines(ant)[0]), 'Przykładowa antyfona, część przed podziałem, * a oto jej część po podziale.', 'liturgical view: the division as *');
  assert.equal(text(m.resourceLines(ant, { repeat: true })[0]), 'Przykładowa antyfona, część przed podziałem, / a oto jej część po podziale.', 'on repetition: /');
  assert.equal(text(m.resourceLines(ant, { layout: 'attested-test.ant.a.copy' })[0]), 'Przykładowa antyfona, * część przed podziałem, a oto jej część po podziale.', 'the attested other division of the same wording');
  assert.equal(ant.text.includes('*'), false, 'no mark inside the wording');
  assert.deepEqual(m.usageOf('test.ant.a', all).map((e) => e.id).sort(), ['a.lauds.ps1', 'a.vespers.ps1'], 'two uses point to the one antiphon');
  assert.equal(ant.metadata.merged_from[0].source_citation, 'Tom testowy II', 'the source of the merged copy is kept');
  ok('antiphon: one wording, continuous and liturgical view, its division (* and / on repetition), an attested other division without a second copy, two uses');

  /* -- Hymn: Zeilen und Strophen ------------------------------------------------------------------- */
  const hymn = get('test.hymn');
  const hymnLines = m.resourceLines(hymn);
  assert.equal(textLines(hymnLines).length, 12, 'twelve lines');
  assert.deepEqual(textLines(hymnLines).filter((l) => l.verse !== undefined).map((l) => l.verse), ['1', '2', '3'], 'stanza numbers');
  assert.equal(hymnLines.filter((l) => l.gap === 'stanza').length, 2, 'two stanza breaks');
  assert.equal(m.paragraphs(hymn.text).length, 3, 'continuous view: three paragraphs');
  assert.ok(m.paragraphs(hymn.text)[0].startsWith('Pierwsza linijka hymnu testowego, druga linijka'), 'continuous view: lines run on');
  ok('hymn: lines and stanzas in the liturgical view, flowing paragraphs in the continuous view');

  /* -- Psalm: ganz, zwei Teile, drei Teile; Psalm 119 in 22 Teilen ---------------------------------- */
  const ps = get('test.ps1.text');
  const psLines = textLines(m.resourceLines(ps));
  assert.equal(psLines.length, 13, 'six verses: five of two lines and one of three');
  assert.ok(psLines.some((l) => text(l).endsWith('†')), 'the flex †');
  assert.equal(psLines.filter((l) => l.verse !== undefined).length, 6, 'six verse numbers');
  assert.equal(ps.text.includes('Chwała przykładowa'), false, 'the psalm itself has no doxology');
  const parts = (division) => all.filter((e) => e.entity_type === 'passage_definition' && e.division === division).sort((a, b) => a.order - b.order);
  const versesOf = (p) => [...new Set(m.resolveText(p.id, index).units.map((u) => u.verse))];
  assert.deepEqual(parts('dwie-części').map(versesOf), [[1, 2, 3], [4, 5, 6]], 'two parts');
  assert.deepEqual(parts('trzy-części').map(versesOf), [[1, 2], [3, 4], [5, 6]], 'three parts');
  assert.ok(parts('dwie-części').every((p) => p.on === ps.text_version), 'each division records the text version it was made for');
  const ps119 = parts('ps119-22');
  assert.equal(ps119.length, 22);
  assert.ok(ps119.every((p, k) => versesOf(p).length === 8 && versesOf(p)[0] === k * 8 + 1), 'each of the 22 parts has its 8 verses');
  assert.deepEqual([ps119[0].part, ps119[21].part], ['I (Alef)', 'XXII (Taw)']);
  ok('psalm: whole, in two and in three parts, from one wording; Psalm 119 in 22 parts');

  /* -- Die Horen ----------------------------------------------------------------------------------- */
  const ctx = m.DEFAULT_CONTEXT, day = '2026-11-16';
  const slot = (c, name) => c.slots.find((s) => s.name === name);
  const kinds = (s) => s.parts.map((p) => p.kind);
  const lauds = m.composeOffice(day, 'lauds', ctx, all);
  assert.deepEqual(kinds(slot(lauds, 'psalmody.1')), ['antiphon', 'main', 'doxology', 'antiphon_repeat'], 'antiphon, psalm, doxology, antiphon');
  assert.equal(text(slot(lauds, 'psalmody.1').parts[0].lines[0]).includes('*'), true);
  assert.equal(text(slot(lauds, 'psalmody.1').parts[3].lines[0]).includes('/'), true, 'the repeated antiphon shows /');
  assert.deepEqual([kinds(slot(lauds, 'psalmody.2')), slot(lauds, 'psalmody.2').doxology], [['antiphon', 'main', 'antiphon_repeat'], 'omitted'], 'the canticle attested without doxology');
  assert.deepEqual([slot(lauds, 'psalmody.3').partLabel, slot(lauds, 'psalmody.3').doxology], ['II', 'appended'], 'a part of the psalm, with its doxology');
  assert.deepEqual(kinds(slot(lauds, 'gospel_canticle')), ['antiphon', 'main', 'doxology', 'antiphon_repeat'], 'Benedictus with antiphon and doxology');
  const resp = textLines(slot(lauds, 'responsory').parts[0].lines);
  assert.deepEqual(resp.map((l) => l.role), ['cantor', 'all', 'cantor', 'all', 'cantor', 'all'], 'short responsory: V./R. alternate');
  assert.equal(text(resp[3]), 'a to jej druga część.', 'the repeat is a reference to the second half');
  assert.equal(get('test.resp.short').text.split('Odpowiedź krótka').length, 2, 'the response is written once');
  const preces = textLines(slot(lauds, 'intercessions').parts[0].lines);
  assert.equal(preces.filter((l) => text(l) === 'Wysłuchaj nas, przykładzie.').length, 4, 'the common response after the introduction and each petition');
  assert.equal(get('test.preces').text.includes('Wysłuchaj nas'), false, 'the response is stored once, in its own text');
  const prayer = textLines(slot(lauds, 'prayer').parts[0].lines);
  assert.equal(text(prayer[0]), 'Módlmy się.', 'the introductory formula');
  assert.ok(prayer.some((l) => text(l).includes('Przez długie zakończenie testowe')), 'the long conclusion at Lauds');
  assert.equal(prayer.at(-1).role, 'all', 'Amen is the assembly\'s response');
  const opening = textLines(slot(lauds, 'opening').parts[0].lines);
  assert.ok(opening[0].segs[0].cross && opening.some((l) => text(l).startsWith('Chwała przykładowa')), 'the opening dialogue with the cross and the shared doxology');
  ok('Lauds: antiphon/psalm/doxology/antiphon, canticle without doxology, a psalm part, Benedictus, short responsory, intercessions, prayer with its ending and Amen');

  const readings = m.composeOffice(day, 'readings', ctx, all, { afterInvitatory: false });
  assert.deepEqual(['reading.1', 'responsory.1', 'reading.2', 'responsory.2'].map((n) => slot(readings, n).canonicalResourceId), ['test.reading.1', 'test.resp.1', 'test.reading.2', 'test.resp.2'], 'two readings, two responsories');
  assert.ok(textLines(slot(readings, 'reading.1').parts[0].lines).some((l) => text(l).startsWith('Początek pierwszego czytania')), 'the reading includes its incipit once');
  assert.equal(textLines(m.resourceLines(get('test.reading.1'))).filter((l) => text(l).includes('Początek pierwszego czytania')).length, 1, 'the incipit is not repeated');
  assert.deepEqual(textLines(slot(readings, 'responsory.1').parts[0].lines).map((l) => l.role), ['all', 'cantor', 'all']);
  assert.deepEqual(textLines(slot(readings, 'versicle').parts[0].lines).map((l) => l.role), ['cantor', 'all'], 'versicle and response');
  assert.deepEqual(['psalmody.1', 'psalmody.2', 'psalmody.3'].map((n) => slot(readings, n).partLabel), ['I (Alef)', 'II (Bet)', 'III (Gimel)']);
  ok('Office of Readings: psalms as parts of Psalm 119, versicle, two full readings with their responsories');

  const sext = m.composeOffice(day, 'sext', ctx, all);
  assert.equal(slot(sext, 'prayer').variantId, 'short', 'the short ending at Sext');
  assert.ok(textLines(slot(sext, 'prayer').parts[0].lines).some((l) => text(l).includes('Przez krótkie zakończenie testowe')) && !textLines(slot(sext, 'prayer').parts[0].lines).some((l) => text(l).includes('długie')));
  assert.deepEqual(textLines(slot(sext, 'versicle').parts[0].lines).map((l) => l.role), ['cantor', 'all']);
  ok('Sext: versicle and response, the prayer with its short ending');

  const compline = m.composeOffice(day, 'compline', ctx, all);
  assert.deepEqual([slot(compline, 'gospel_canticle').canonicalResourceId, kinds(slot(compline, 'gospel_canticle'))], ['test.sym.text', ['antiphon', 'main', 'doxology', 'antiphon_repeat']], 'Nunc dimittis with its antiphon');
  assert.equal(slot(compline, 'prayer').variantId, 'compline');
  ok('Compline: the Canticle of Simeon with antiphon and doxology, the Compline ending of the prayer');

  const inv = m.composeOffice(day, 'invitatory', ctx, all);
  assert.deepEqual(kinds(slot(inv, 'invitatory')), ['antiphon', 'main', 'antiphon_repeat', 'main', 'antiphon_repeat', 'main', 'doxology', 'antiphon_repeat'], 'the antiphon after each strophe and after the doxology');
  ok('Invitatory: the antiphon returns after each strophe and after Glory be');

  /* -- Doxologie weggelassen per Zuordnung ---------------------------------------------------------- */
  const noDox = m.composeOffice(day, 'lauds', ctx, all.map((e) => (e.id === 'a.lauds.ps1' ? { ...e, doxology: false } : e)));
  assert.deepEqual([kinds(slot(noDox, 'psalmody.1')), slot(noDox, 'psalmody.1').doxology], [['antiphon', 'main', 'antiphon_repeat'], 'omitted'], 'an assignment can omit it');
  ok('doxology: appended by the slot rule, omitted by the text (doxology: none) or by the assignment');

  /* -- Export → Import ------------------------------------------------------------------------------- */
  const exported = JSON.parse(JSON.stringify(m.exportLiturgy('Test', own)));
  assert.ok(exported.entities.find((e) => e.id === 'test.ps1.text').layout[0].text.startsWith('Werset 1'), 'the export writes divisions as pieces');
  const again = m.planLiturgyImport(exported, all, own);
  assert.deepEqual([again.problems, again.create.length, again.update.length, again.remove.length], [[], 0, 0, 0], 'an exported collection imports again without change');
  assert.equal((await m.commitImport(store, exported)).saved, 0);
  ok('export → import: nothing changes');

  /* -- Fehler, lesbar in der Vorschau --------------------------------------------------------------- */
  const doc = (entities) => ({ format: 'recreatio/liturgy', version: 2, entities });
  const lines = (p) => p.problems.map(m.problemLine);
  const badRange = lines(m.planLiturgyImport(doc([{ entity_type: 'passage_definition', id: 'bad.range', title: 'x', work_id: 'test.ps1', edition_id: 'test.ed', resource_id: 'test.ps1.text', ranges: [{ start_verse: 7, end_verse: 9 }] }]), all, own));
  assert.ok(badRange.some((l) => l.includes('Wersety 7–9: tekst ma wersety 1–6')), badRange.join(' | '));
  const broken = lines(m.planLiturgyImport(doc([{ id: 'a.lauds.ps1', antiphon_ref: 'nie.ma' }]), all, own));
  assert.ok(broken.some((l) => l.startsWith('a.lauds.ps1: ') && l.includes('nie.ma')), broken.join(' | '));
  const unsupported = lines(m.planLiturgyImport(doc([{ id: 'test.ps1.text', performance: [{ say: ['x'] }] }]), all, own));
  assert.ok(unsupported.some((l) => l.includes('Nieobsługiwana struktura wykonania')), unsupported.join(' | '));
  const badStep = lines(m.planLiturgyImport(doc([{ id: 'test.resp.short', performance: [{ say: ['R1'], rubric: 'oba naraz' }] }]), all, own));
  assert.ok(badStep.some((l) => l.includes('krok 1 musi mieć dokładnie jedno')), badStep.join(' | '));
  const mismatch = lines(m.planLiturgyImport(doc([{ id: 'test.ant.c', layout: [{ text: 'Antyfona do trzeciej', end: 'mediant' }, { text: 'części psalmu.' }] }]), all, own));
  assert.ok(mismatch.some((l) => l.includes('„Antyfona do trzeciej” nie pasuje do tekstu w miejscu 0')), mismatch.join(' | '));
  const stale = m.planLiturgyImport(doc([{ id: 'test.ps1.text', text: ps.text.replace('Werset 1 psalmu', 'Wers 1 psalmu') }]), all, own);
  assert.ok(lines(stale).some((l) => l.includes('powstał dla innej wersji tekstu — wyślij go ponownie')), 'a changed wording does not move its division silently');
  assert.ok(lines(stale).some((l) => l.includes('Podział „dwie-części” powstał dla innej wersji')), 'divisions of the text are flagged too');
  ok('preview: a bad range, a broken reference, an unsupported execution structure, a mismatching piece and a stale division are readable messages');

  /* -- Die React-Ansichten -------------------------------------------------------------------------- */
  const html = (el) => m.renderToStaticMarkup(el);
  const plainHtml = html(m.createElement(m.ResourceText, { resource: ant, entities: all, initialView: 'plain' }));
  const litHtml = html(m.createElement(m.ResourceText, { resource: ant, entities: all, initialView: 'liturgical' }));
  assert.ok(plainHtml.includes('data-lit-view="plain"') && !plainHtml.includes('lit-mark') && plainHtml.includes('część przed podziałem, a oto'), 'continuous view rendered');
  assert.ok(litHtml.includes('data-lit-view="liturgical"') && litHtml.includes('<span class="lit-mark"> *</span>'), 'liturgical view rendered with its mark');
  assert.ok(litHtml.includes('test.ant.a.copy'), 'the merged id is shown');
  const laudsHtml = html(m.createElement(m.CompositionView, { composition: lauds, libraryId: 'lib', details: true, view: 'liturgical' }));
  assert.ok(laudsHtml.includes('data-lit-part="antiphon_repeat"') && laudsHtml.includes('lit-role') && laudsHtml.includes('Dołączono „Chwała Ojcu”'), 'Lauds rendered with roles and the doxology decision');
  const laudsPlain = html(m.createElement(m.CompositionView, { composition: lauds, libraryId: 'lib', details: false, view: 'plain' }));
  assert.ok(laudsPlain.includes('data-lit-view="plain"') && !laudsPlain.includes('lit-mark'), 'Lauds in the continuous view');
  ok('React views: a resource and a composed hour, continuous and liturgical');

  /* -- 1.0 → 2.0: gespeichert und in Dokumenten ------------------------------------------------------ */
  const v1 = { format: 'recreatio.liturgy', schema_version: '1.1', mode: 'add', provenance: 'Stary zapis testowy', entities: [
    { schema_version: '1.0', entity_type: 'text_edition', id: 'old.ed', title: 'Stare wydanie', language: 'pl-PL', license: 'Test', permitted_usage: ['private'] },
    { schema_version: '1.0', entity_type: 'canonical_work', id: 'old.ps', title: 'Stary psalm', work_type: 'psalm' },
    { schema_version: '1.0', entity_type: 'text_resource', id: 'old.ps.text', title: 'Psalm', resource_type: 'psalm_fragment', work_id: 'old.ps', edition_id: 'old.ed', language: 'pl-PL',
      structured_content: [{ type: 'paragraph', text: 'Pierwsza połowa wersetu pierwszego, druga połowa pierwszego. Pierwsza połowa drugiego, druga połowa drugiego.' }],
      metadata: { performance_markers: [[{ at: 35, mark: '*' }, { at: 86, mark: '*' }]], printed_prefix_lines: ['Tytuł psalmu', 'Sentencja psalmu'], doxology_needed: true } },
    { schema_version: '1.0', entity_type: 'text_resource', id: 'old.ant', title: 'Antyfona', resource_type: 'antiphon', edition_id: 'old.ed', language: 'pl-PL',
      structured_content: [{ type: 'response', text: 'Słowa antyfony przed pauzą i po niej.' }],
      metadata: { performance_markers: [[{ at: 27, mark: '*' }]], recitation_mark_variants: [{ marks: [{ at: 27, mark: '/' }] }, { marks: [{ at: 15, mark: '*' }] }] } },
    { schema_version: '1.0', entity_type: 'text_resource', id: 'old.resp', title: 'Responsorium krótkie', resource_type: 'responsory', edition_id: 'old.ed', language: 'pl-PL',
      structured_content: [{ type: 'response', speaker: 'P', text: 'Okaż, przykładzie, łaskę swoją.' }, { type: 'response', speaker: 'W', text: 'Okaż, przykładzie, łaskę swoją.' },
        { type: 'response', speaker: 'P', text: 'I daj nam swój przykład.' }, { type: 'response', speaker: 'W', text: 'łaskę swoją.' }],
      metadata: { performance_markers: [[{ at: 19, mark: '*' }], [{ at: 19, mark: '/' }], [], []] } },
    { schema_version: '1.0', entity_type: 'text_resource', id: 'old.refrain', title: 'Refren', resource_type: 'intercession_refrain', edition_id: 'old.ed', language: 'pl-PL', structured_content: [{ type: 'response', text: 'Wysłuchaj, przykładzie.' }] },
    { schema_version: '1.0', entity_type: 'text_resource', id: 'old.preces', title: 'Prośby', resource_type: 'intercessions', edition_id: 'old.ed', language: 'pl-PL',
      structured_content: [{ type: 'paragraph', text: 'Wprowadzenie do próśb, wołajmy: Pierwsza prośba, — drugi człon pierwszej. Druga prośba, — drugi człon drugiej.' }],
      metadata: { refrain_resource_id: 'old.refrain', refrain_after_source_line: [1, 2, 3] } },
    { schema_version: '1.0', entity_type: 'text_resource', id: 'old.prayer', title: 'Modlitwa', resource_type: 'prayer', edition_id: 'old.ed', language: 'pl-PL',
      structured_content: [{ type: 'paragraph', text: 'Treść starej modlitwy. Przez naszego Pana, przykładowe zakończenie. Amen.' }], metadata: { introduction_formula: 'Módlmy się.' } },
    { schema_version: '1.0', entity_type: 'text_resource', id: 'old.reading', title: '1 Czytanie', resource_type: 'reading', edition_id: 'old.ed', language: 'pl-PL',
      structured_content: [{ type: 'paragraph', text: 'Jerozolimy i jej mieszkańców. Dalej czytanie.' }],
      metadata: { source_author_or_book_attribution: ['Początek Księgi przykładowej'], scripture_reference_as_printed: ['1, 1-5'], reading_subtitle_as_printed: ['Tytuł czytania', 'Widzenie przykładowe w sprawie'] } }
  ] };
  const migratedPlan = m.planLiturgyImport(v1, m.effectiveEntities([]), []);
  assert.deepEqual(migratedPlan.problems.map(m.problemLine), []);
  assert.ok(migratedPlan.lines.some((l) => l.includes('Odczytano z wcześniejszego formatu: 7')), migratedPlan.lines.join(' | '));
  const mig = new Map(migratedPlan.create.map((e) => [e.id, e]));
  const oldPs = mig.get('old.ps.text');
  assert.deepEqual([oldPs.resource_type, [...new Set(oldPs.layout.units.map((u) => u.verse))], oldPs.missing.includes('verses_inferred'), oldPs.doxology, oldPs.text.includes('*')], ['psalm', [1, 2], true, 'after', false], 'a psalm fragment: verses inferred from the mediants, flagged, the wording without marks');
  assert.deepEqual(oldPs.notes.map((n) => n.type), ['subtitle', 'sentence']);
  const oldAnt = mig.get('old.ant');
  assert.deepEqual([oldAnt.layout.units.length, oldAnt.layouts.length], [2, 1], 'the * and / variants are one division; the other position is an attested division');
  const oldResp = mig.get('old.resp');
  assert.deepEqual([oldResp.text, oldResp.performance.map((s) => s.say.join('+')), oldResp.performance.map((s) => s.role)], ['Okaż, przykładzie, łaskę swoją.\nI daj nam swój przykład.', ['l1+l2', 'l1+l2', 'l3', 'l2'], ['cantor', 'all', 'cantor', 'all']], 'repeated lines become references; each line is written once');
  const oldPreces = mig.get('old.preces');
  assert.deepEqual([oldPreces.response_ref, oldPreces.text.includes('—'), oldPreces.layout.units.map((u) => u.kind).join(' '), oldPreces.missing ?? []], ['old.refrain', false, 'intro petition petition_response petition petition_response', []], 'intercessions: introduction, petitions, second parts; the dash is no wording; the refrain after each');
  const oldPrayer = mig.get('old.prayer');
  assert.deepEqual([oldPrayer.layout.units.map((u) => u.kind), oldPrayer.intro_formula], [['body', 'conclusion', 'response'], 'Módlmy się.'], 'prayer: body, conclusion, Amen; the formula separate');
  const oldReading = mig.get('old.reading');
  assert.deepEqual([oldReading.origin, oldReading.reference, oldReading.incipit, oldReading.text.startsWith('Widzenie przykładowe w sprawie Jerozolimy'), oldReading.missing], ['Początek Księgi przykładowej', '1, 1-5', { unit: 'incipit' }, true, ['incipit_unverified']], 'reading: origin, reference, the heading line that continues into the text is the incipit');
  /* Gespeichertes 1.0 wird beim Lesen 2.0; ein Import, der es nennt, schreibt es als 2.0. */
  const storedV1 = [{ id: 'row1', kind: 'lit_text', version: 1, data: v1.entities[3] }, { id: 'row0', kind: 'lit_edition', version: 1, data: v1.entities[0] }];
  const read = m.entitiesOf(storedV1);
  assert.deepEqual([read.find((e) => e.id === 'old.ant').schema_version, read.find((e) => e.id === 'old.ant').layout.units.length], ['1.0', 2], 'stored 1.0 is read as 2.0 (and still known as 1.0)');
  const rewrite = m.planLiturgyImport(m.exportLiturgy('x', read), m.effectiveEntities(read), read);
  assert.deepEqual([rewrite.update.length, rewrite.update.every((u) => u.after.schema_version === '2.0')], [2, true], 'export → import writes the stored records as 2.0');
  ok('1.0 → 2.0: blocks, marks at positions, attested divisions, roles and repetitions, intercessions, prayers, readings; stored records read and rewritten');
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
