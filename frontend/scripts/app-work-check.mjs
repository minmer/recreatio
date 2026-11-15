/**
 * 2026-11-15 — DAS WERK VON OBEN NACH UNTEN, nachgemessen (documentation/WORK.md). Ohne Browser und ohne Dienst:
 * die Szenarien, an denen der Besitzer die Arbeit messen wollte, als Daten im Speicher.
 *
 *   1. Buch: 3 Teile, 12 Kapitel, 60 Abschnitte; Anna als Kind (Kap. 1–4) und als Erwachsene (Kap. 5–12); ein Begriff,
 *      in Kap. 2 eingeführt, in Kap. 3 gebraucht, absichtlich in Kap. 1 zu früh; eine Zusammenfassung am Ende von
 *      Teil I; das Register des Begriffs (eingeführt, gebraucht); der Druck als Buch mit Glossar und Register.
 *   2. Katechese in zwei Dimensionen: 12 Themen × 3 Zielgruppen mit gemeinsamem Kern; Lücken und „nicht nötig";
 *      der Weg „youth" für sich geprüft (ein Begriff nur in der Fassung für Erwachsene); eine Regel nur für Kinder;
 *      der Weg „youth" als eigenes Heft.
 *   3. Ein geteilter Teil: ein Buch, eine Linie bis auf Kapitel 7 (Anfänger / Fortgeschrittene), darin 7.3 noch
 *      einmal nach Blickwinkel; beide Wege lesen den Rest unverändert, die Prüfung folgt jedem Weg.
 *   4. Zyklus: 100 Fünf-Minuten-Kazania aus einer Vorlage, Regeln der Serie; jedes zehnte eine Zusammenfassung;
 *      der Kontext von Kazanie 37 aus der Abschrift (wie `get_work_context` ihn liest).
 *   5. Artikel: Definition vor Gebrauch, Zitate der Bibliothek, Bibliografie, ein Zitat ohne Ziel.
 *   6. Was es schon gab: Schulprogramme (Gliederung → Lekcje, auch aus dem Baum), Zapis-Links mit und ohne Rolle,
 *      eine alte Gliederung als Baum und umgewandelt, das JSON des Skryptorium mit Knoten, Regeln, Vorlagen.
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-work-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * as M from '${app}scriptorium/work/workModel';
export * as K from '${app}scriptorium/work/workKnowledge';
export * as R from '${app}scriptorium/work/workMarks';
export * as C from '${app}scriptorium/work/workChecks';
export * as X from '${app}scriptorium/work/workContext';
export * as T from '${app}scriptorium/work/workTemplates';
export * as B from '${app}scriptorium/work/workBrief';
export * as L from '${app}scriptorium/work/workLatex';
export * as RU from '${app}scriptorium/work/workRules';
export { parseInline, mapRefTokens } from '${app}library/libraryMarkup';
export { lessonsOf } from '${app}areas/school';
export { textToLatex, planToLatex } from '${app}scriptorium/latex';
export { planScriptoriumImport, scriptoriumDescription } from '${app}scriptorium/scriptoriumJson';
export { WRITING_KINDS } from '${app}library/libraryKinds';
export { baseKind } from '${app}cogita/kinds';
`);
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' }, logLevel: 'error'
});
globalThis.BroadcastChannel = undefined;
const { M, K, R, C, X, T, B, L, RU, textToLatex, planToLatex, parseInline, mapRefTokens, lessonsOf, planScriptoriumImport, scriptoriumDescription, WRITING_KINDS, baseKind } = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);

let checks = 0;
const ok = (cond, what) => { assert.ok(cond, what); checks += 1; };
const eq = (a, b, what) => { assert.deepEqual(a, b, what); checks += 1; };

/* -- Werkzeug ------------------------------------------------------------------------------------- */

let counter = 0;
const uuid = () => { counter += 1; return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`; };
function world() {
  const entries = [];
  const add = (kind, data, key) => { const e = { id: uuid(), kind, data, ...(key === undefined ? {} : { key }) }; entries.push(e); return e; };
  const look = {
    all: () => entries,
    get: (id) => entries.find((e) => e.id === id),
    byKey: (key) => entries.find((e) => e.key !== undefined && e.key.toLowerCase() === key.replace(/^@/, '').toLowerCase()),
    readable: () => entries
  };
  return { entries, add, look };
}
const ent = (id, label, kind, more = {}) => ({ id, label, kind, kindId: kind, forms: [], forbidden: [], preferred: '', definition: '', usage: '', description: '', requires: [], relations: [], ...more });
/* Mit WORK_TEX_DIR schreibt die Prüfung jedes erzeugte Dokument dorthin (scripts/app-work-tex.mjs übersetzt sie). */
const texOut = [];
const latex = (name, ...args) => { const out = L.workToLatex(...args); texOut.push([name, out]); return out; };
const codes = (findings) => findings.map((f) => f.code);
const words = (n, word = 'słowo') => Array.from({ length: n }, () => word).join(' ');

/* == 1. Buch ===================================================================================== */
{
  const { add, look } = world();
  const project = add('project', { projectType: 'book', title: 'Anna nad rzeką', lang: 'pl', latexClass: 'book',
    levels: [{ name: 'Część', latex: 'part' }, { name: 'Rozdział', latex: 'chapter' }, { name: 'Podrozdział', latex: 'section' }], knowledge: [{ base: 'baza' }] });
  const chapters = [];
  const sections = [];
  let summary;
  for (let p = 1; p <= 3; p += 1) {
    const part = add('node', { project: project.id, title: `Część ${p}`, order: p, role: 'introduction', purpose: 'Całość części.' });
    for (let c = 1; c <= 4; c += 1) {
      const n = (p - 1) * 4 + c;
      const chapter = add('node', { project: project.id, parent: part.id, title: `Rozdział ${n}`, order: c, role: 'new', purpose: `Rozdział ${n}.` });
      chapters[n] = chapter;
      for (let s = 1; s <= 5; s += 1) {
        const isSummary = p === 1 && c === 4 && s === 5;
        const text = add('text', { title: `${n}.${s}`, project: project.id, body: `Akapit rozdziału ${n}.${s}. Anna idzie nad rzekę.` });
        const sec = add('node', { project: project.id, parent: chapter.id, title: isSummary ? 'Podsumowanie części I' : `Sekcja ${n}.${s}`, order: s,
          role: isSummary ? 'summary' : 'example', purpose: 'Krok.', synopsis: 'Myśl.', targetWords: 12, text: text.id });
        sections.push(sec);
        if (isSummary) summary = { sec, text };
        sections[`${n}.${s}`] = { sec, text };
      }
    }
  }
  ok(sections.length === 60, 'Buch: 60 Abschnitte');
  /* Anna wird in 1.1 eingeführt, das Pojęcie „przymierze" in 2.1, gebraucht in 3.2 — absichtlich zu früh in 1.3. */
  const marks = (key, list) => { sections[key].sec.data.marks = list; };
  marks('1.1', [{ entry: 'anna', role: 'intro' }]);
  sections['2.1'].text.data.body = 'Wtedy pierwszy raz pada słowo [[przymierze|@term|intro]]: [[przymierze|@term|def]] to więź, która trwa.';
  sections['3.2'].text.data.body = 'Anna wspomina [[przymierze|@term]].';
  sections['1.3'].text.data.body = 'Zbyt wcześnie: [[przymierze|@term]].';
  /* Podsumowanie części I przypomina tylko to, co było wcześniej. */
  summary.text.data.body = 'Przypomnijmy: [[przymierze|@term|recall]] i [[Annę|@anna|recall]].';
  /* Faza dorosłej Anny użyta w rozdziale 2 — tam obowiązuje dziecko. */
  sections['2.2'].sec.data.marks = [{ entry: 'anna-adult', role: 'use' }];
  const knowledge = K.knowledgeOf([
    ent('anna', 'Anna', 'Osoba'),
    ent('anna-child', 'Anna — dzieciństwo', 'Faza', { phaseOf: 'anna', from: chapters[1].id, until: chapters[4].id, description: 'Dziewczynka znad rzeki.' }),
    ent('anna-adult', 'Anna — dorosła', 'Faza', { phaseOf: 'anna', from: chapters[5].id, until: chapters[12].id, description: 'Nauczycielka w mieście.' }),
    ent('term', 'przymierze', 'Termin', { definition: 'Więź, która trwa mimo zmian.', forbidden: ['umowa'] })
  ]);
  const model = M.readWork(project, look);
  eq(model.roots.length, 3, 'Buch: drei Teile oben');
  eq(M.linear(model, M.pathOf(model)).length, 3 + 12 + 60, 'Buch: alles auf dem einen Weg');
  const occ = R.occurrencesOf(model, look, knowledge);
  const [report] = C.checkWork({ model, look, knowledge, occurrences: occ });
  const early = report.findings.filter((f) => f.code === 'usedBeforeIntro' && f.entity === 'term');
  eq(early.map((f) => f.node), [sections['1.3'].sec.id], 'Buch: der Gebrauch in Kap. 1 wird gefunden — nur er');
  ok(early[0].message.includes('przymierze') && early[0].message.includes('2.1'), 'Buch: der Befund nennt Begriff und Ort der Einführung');
  ok(early[0].why !== '' && early[0].fix !== '', 'Buch: warum und was es behebt');
  ok(!report.findings.some((f) => f.code === 'summaryRecallsUnknown'), 'Buch: die Zusammenfassung nimmt nur Früheres auf');
  ok(!report.findings.some((f) => f.code === 'summaryIntroduces'), 'Buch: die Zusammenfassung bringt nichts Neues');
  ok(report.findings.some((f) => f.code === 'phaseInvalid' && f.node === sections['2.2'].sec.id), 'Buch: die erwachsene Anna in Kap. 2 — Phase gilt nicht');
  ok(!report.findings.some((f) => f.code === 'phaseInvalid' && f.entity === 'anna'), 'Buch: Anna als Kind in Kap. 1–4 — eine Phase gilt');
  /* Eine Zusammenfassung, die Unbekanntes aufnimmt, wird gemeldet. */
  {
    const bad = { ...summary.text, data: { ...summary.text.data, body: 'Przypomnijmy: [[Bóg|@god|recall]].' } };
    const look2 = { ...look, get: (id) => (id === bad.id ? bad : look.get(id)), all: () => look.all().map((e) => (e.id === bad.id ? bad : e)) };
    const sec2 = { ...sections['5.3'].sec, data: { ...sections['5.3'].sec.data, marks: [{ entry: 'god', role: 'intro' }] } };
    const look3 = { ...look2, all: () => look2.all().map((e) => (e.id === sec2.id ? sec2 : e)), get: (id) => (id === sec2.id ? sec2 : look2.get(id)) };
    const m2 = M.readWork(project, look3);
    const [r2] = C.checkWork({ model: m2, look: look3, knowledge: K.knowledgeOf([...knowledge.all(), ent('god', 'Bóg', 'Idea')]) });
    ok(r2.findings.some((f) => f.code === 'summaryRecallsUnknown' && f.entity === 'god'), 'Buch: Zusammenfassung mit Unbekanntem gemeldet');
  }
  /* Das Register des Begriffs: eingeführt und definiert in 2.1, gebraucht in 3.2 (und zu früh in 1.3), aufgenommen in der Zusammenfassung. */
  const reg = report.register.byEntity.get('term');
  eq(reg.roles.intro.map((o) => o.node), [sections['2.1'].sec.id], 'Buch: eingeführt in 2.1');
  eq(reg.roles.def.map((o) => o.node), [sections['2.1'].sec.id], 'Buch: definiert in 2.1');
  ok(reg.roles.use.some((o) => o.node === sections['3.2'].sec.id), 'Buch: gebraucht in 3.2');
  eq(reg.roles.recall.map((o) => o.node), [summary.sec.id], 'Buch: aufgenommen in der Zusammenfassung');
  /* Ein verbotenes Synonym. */
  sections['5.1'].text.data.body = 'To była tylko umowa.';
  sections['5.2'].text.data.body = 'Ale [[przymierze|@term]] trwało.';
  const [report2] = C.checkWork({ model: M.readWork(project, look), look, knowledge });
  ok(report2.findings.some((f) => f.code === 'forbiddenForm' && f.node === sections['5.1'].sec.id), 'Buch: „umowa" statt „przymierze" gefunden');
  /* Der Kontext von 2.3: Anna und das Pojęcie sind eingeführt; die Phase „dzieciństwo" gilt. */
  const ctx = X.contextAt(model, report.register, model.nodes.get(sections['2.3'].sec.id), look, knowledge, [], report.findings);
  ok(ctx.introduced.some((i) => i.entity === 'term' && i.defined), 'Buch: Kontext 2.3 — przymierze eingeführt und definiert');
  ok(ctx.phases.some((p) => p.phase === 'anna-child') && !ctx.phases.some((p) => p.phase === 'anna-adult'), 'Buch: Kontext 2.3 — die Phase des Kindes gilt');
  ok(ctx.previous?.node === sections['2.2'].sec.id && ctx.next?.node === sections['2.4'].sec.id, 'Buch: Kontext 2.3 — davor und danach');
  /* Der Druck. */
  const tex = latex('buch-pl-final', project, look, knowledge, { mode: 'final' });
  ok(tex.includes('\\documentclass[11pt,a4paper,openany]{book}') && tex.includes('[polish]{babel}'), 'Buch: Klasse book, polnisch');
  ok(tex.indexOf('\\part{Część 1}') < tex.indexOf('\\chapter{Rozdział 1}') && tex.indexOf('\\chapter{Rozdział 1}') < tex.indexOf('\\section{Sekcja 1.1}'), 'Buch: part → chapter → section in Reihenfolge');
  ok(tex.includes(`\\label{n:${sections['2.1'].sec.id}}`), 'Buch: feste Etiketten');
  ok(tex.includes('Słowniczek') && tex.includes('\\item[przymierze] Więź, która trwa mimo zmian.') && tex.includes(`\\pageref{n:${sections['2.1'].sec.id}}`), 'Buch: Glossar mit Seite der Einführung');
  ok(tex.includes('Indeks') && /\\item Anna, \\pageref/.test(tex), 'Buch: Register der Personen mit Seiten');
  ok(tex.includes('\\textsc{Podsumowanie}'), 'Buch: Zusammenfassung sichtbar markiert');
  ok(!tex.includes('\\marginpar'), 'Buch: Endfassung ohne Randnotizen');
  const draft = latex('buch-pl-draft', project, look, knowledge, { mode: 'draft' });
  ok(draft.includes('\\marginpar') && draft.includes('\\fbox') && draft.includes('geometry'), 'Buch: Entwurf mit Rahmen und Randnotizen');
  const de = latex('buch-de-final', { ...project, data: { ...project.data, lang: 'de' } }, look, knowledge, { mode: 'final' });
  latex('buch-en-draft', { ...project, data: { ...project.data, lang: 'en' } }, look, knowledge, { mode: 'draft', dimensionTable: true });
  latex('handout-pl-draft', { ...project, data: { ...project.data, latexClass: 'handout' } }, look, knowledge, { mode: 'draft' });
  ok(de.includes('[ngerman]{babel}') && de.includes('Glossar') && de.includes('Register'), 'Buch: Deutsch, wenn das Werk deutsch ist');
  const one = latex('buch-kapitel3', project, look, knowledge, { mode: 'final', node: chapters[3].id });
  ok(one.includes('\\chapter{Rozdział 3}') && !one.includes('Rozdział 4}'), 'Buch: ein Kapitel allein');
  /* Wie weit das Konzept ist. */
  const prog = M.progressOf(model, look);
  eq(prog.map((l) => l.nodes), [3, 12, 60], 'Buch: Knoten je Ebene');
  eq(prog[2].name, 'Podrozdział', 'Buch: Name der Ebene');
}

/* == 2. Katechese: 12 Themen × 3 Zielgruppen ======================================================== */
{
  const { add, look } = world();
  const AUD = [{ key: 'children', name: 'Dzieci' }, { key: 'youth', name: 'Młodzież' }, { key: 'adults', name: 'Dorośli' }];
  const project = add('project', { projectType: 'series', title: 'Katecheza', lang: 'pl', latexClass: 'booklet',
    dimensions: [{ key: 'audience', name: 'Odbiorcy', ordered: 'yes', values: AUD }],
    paths: AUD.map((v) => ({ key: v.key, name: v.name, choose: [{ dimension: 'audience', value: v.key }] })) });
  const topics = [];
  const cell = {};
  for (let i = 1; i <= 12; i += 1) {
    const topic = add('node', { project: project.id, title: `Temat ${i}`, order: i, split: 'audience', role: 'new', purpose: 'Temat.',
      ...(i === 6 ? { skip: [{ value: 'children', note: 'Za trudne dla dzieci.' }] } : {}) });
    topics.push(topic);
    const coreText = add('text', { title: `Rdzeń ${i}`, project: project.id, body: `Wspólny rdzeń tematu ${i}.` });
    cell[`${i}-core`] = add('node', { project: project.id, parent: topic.id, title: `Rdzeń ${i}`, order: 1, text: coreText.id, role: 'new', purpose: 'Rdzeń.' });
    for (const v of AUD) {
      if (i === 5 && v.key === 'youth') continue;
      if (i === 6 && v.key === 'children') continue;
      const text = add('text', { title: `${i} ${v.name}`, project: project.id, body: `Tekst ${i} dla: ${v.name}.` });
      cell[`${i}-${v.key}`] = add('node', { project: project.id, parent: topic.id, title: `${i} — ${v.name}`, order: 2, variant: v.key, text: text.id, role: 'example', status: i < 4 ? 'done' : 'planned' });
    }
  }
  /* Pojęcie „sakrament" wprowadzone tylko w wersji dla dorosłych tematu 3, użyte w wersji dla młodzieży tematu 4. */
  look.get(cell['3-adults'].data.text).data.body = 'Dorośli: [[sakrament|@sakr|intro]] to znak.';
  look.get(cell['4-youth'].data.text).data.body = 'Młodzież: [[sakrament|@sakr]] dzisiaj.';
  look.get(cell['4-adults'].data.text).data.body = 'Dorośli: [[sakrament|@sakr]] dzisiaj.';
  /* Reguła tylko dla dzieci: zdania najwyżej 12 słów; długie zdanie we wspólnym rdzeniu tematu 1. */
  look.get(cell['1-core'].data.text).data.body = `${words(20)}. Krótko.`;
  add('rule', { project: project.id, rule: 'Dla dzieci: zdania najwyżej 12 słów.', why: 'Dzieci gubią wątek.', weight: 'must', dimension: 'audience', value: 'children', check: 'sentenceWords', param: '12' });
  const knowledge = K.knowledgeOf([ent('sakr', 'sakrament', 'Termin', { definition: 'Widzialny znak.' })]);
  const model = M.readWork(project, look);
  const reports = C.checkWork({ model, look, knowledge });
  const by = Object.fromEntries(reports.map((r) => [r.path.key, r]));
  eq(Object.keys(by).sort(), ['adults', 'children', 'youth'], 'Katechese: drei Wege');
  ok(by.youth.findings.some((f) => f.code === 'notIntroducedHere' && f.entity === 'sakr' && f.node === cell['4-youth'].id), 'Katechese: youth gebraucht, nur bei Erwachsenen eingeführt — gemeldet');
  ok(by.youth.findings.find((f) => f.code === 'notIntroducedHere').message.includes('3 — Dorośli'), 'Katechese: der Befund nennt, wo es eingeführt ist');
  ok(!by.adults.findings.some((f) => f.entity === 'sakr' && ['usedBeforeIntro', 'notIntroducedHere', 'neverIntroduced'].includes(f.code)), 'Katechese: für Erwachsene in Ordnung');
  ok(by.children.findings.some((f) => f.code === 'ruleSentence' && f.node === cell['1-core'].id), 'Katechese: Regel für Kinder greift (im Kern, den Kinder lesen)');
  ok(!by.youth.findings.some((f) => f.code === 'ruleSentence') && !by.adults.findings.some((f) => f.code === 'ruleSentence'), 'Katechese: Regel für Kinder nur dort');
  ok(by.youth.findings.some((f) => f.code === 'dimensionGap' && f.node === topics[4].id), 'Katechese: Lücke Temat 5 / youth auf dem Weg youth');
  ok(!by.children.findings.some((f) => f.code === 'dimensionGap' && f.node === topics[5].id), 'Katechese: „nicht nötig" ist keine Lücke');
  /* Die Tabelle. */
  const table = M.dimensionTable(model, { columns: 'audience', level: 0 });
  eq(table.length, 12, 'Katechese: 12 Zeilen');
  ok(table[4].cells.youth.gap && !table[4].cells.children.gap, 'Katechese: Tabelle zeigt die Lücke');
  ok(table[5].cells.children.skipped === 'Za trudne dla dzieci.', 'Katechese: Tabelle zeigt „nicht nötig" mit Notiz');
  eq(table[0].shared.map((n) => n.id), [cell['1-core'].id], 'Katechese: gemeinsamer Kern je Thema');
  eq(table[0].cells.adults.specific.map((n) => n.status), ['done'], 'Katechese: Stand je Zelle');
  /* Der Weg „youth" als eigenes Heft. */
  const tex = latex('katecheza-youth', project, look, knowledge, { mode: 'final', path: 'youth', dimensionTable: true });
  latex('katecheza-children-draft', project, look, knowledge, { mode: 'draft', path: 'children', dimensionTable: true });
  ok(tex.includes('a5paper') && tex.includes('Tekst 1 dla: Młodzież') && !tex.includes('Tekst 1 dla: Dzieci'), 'Katechese: Heft youth nur mit Texten für Jugendliche');
  ok(tex.includes('Wspólny rdzeń tematu 1'), 'Katechese: Heft youth mit dem gemeinsamen Kern');
  ok(tex.includes('Przegląd wersji') && tex.includes('\\textbf{luka}'), 'Katechese: Übersicht der Dimensionen mit Lücke');
  /* Zwei Dimensionen als Tabelle: Zeilen nach einer zweiten Dimension (hier: nur eine — leer). */
  eq(M.dimensionTable(model, { columns: 'audience', rows: 'audience' }), [], 'Katechese: Zeilen und Spalten nicht dieselbe Dimension');
}

/* == 3. Ein geteilter Teil ============================================================================ */
{
  const { add, look } = world();
  const project = add('project', { title: 'Księga', lang: 'en', latexClass: 'book',
    dimensions: [
      { key: 'level', name: 'Level', values: [{ key: 'basic', name: 'Beginners' }, { key: 'advanced', name: 'Advanced' }] },
      { key: 'view', name: 'Viewpoint', values: [{ key: 'biblical', name: 'Biblical' }, { key: 'historical', name: 'Historical' }] }
    ],
    paths: [
      { key: 'b', name: 'Beginners, biblical', choose: [{ dimension: 'level', value: 'basic' }, { dimension: 'view', value: 'biblical' }] },
      { key: 'a', name: 'Advanced, historical', choose: [{ dimension: 'level', value: 'advanced' }, { dimension: 'view', value: 'historical' }] }
    ] });
  const ch = [];
  for (let i = 1; i <= 10; i += 1) ch[i] = add('node', { project: project.id, title: `Chapter ${i}`, order: i, role: 'new', ...(i === 7 ? { split: 'level' } : {}) });
  const s71 = add('node', { project: project.id, parent: ch[7].id, title: '7.1 Shared', order: 1 });
  const s72 = add('node', { project: project.id, parent: ch[7].id, title: '7.2 Shared', order: 2 });
  const s73 = add('node', { project: project.id, parent: ch[7].id, title: '7.3 Split by viewpoint', order: 3, split: 'view' });
  const s73b = add('node', { project: project.id, parent: s73.id, title: '7.3 biblical', order: 1, variant: 'biblical' });
  const s73h = add('node', { project: project.id, parent: s73.id, title: '7.3 historical', order: 2, variant: 'historical' });
  const basic = add('node', { project: project.id, parent: ch[7].id, title: '7.4 For beginners', order: 4, variant: 'basic' });
  const adv = add('node', { project: project.id, parent: ch[7].id, title: '7.4 For advanced', order: 5, variant: 'advanced', marks: [{ entry: 'covenant', role: 'intro' }] });
  ch[8].data.marks = [{ entry: 'covenant', role: 'use' }];
  const model = M.readWork(project, look);
  const titles = (key) => M.linear(model, M.pathOf(model, key)).map((p) => p.node.title);
  const b = titles('b');
  const a = titles('a');
  for (const i of [1, 2, 3, 4, 5, 6, 8, 9, 10]) ok(b.includes(`Chapter ${i}`) && a.includes(`Chapter ${i}`), `Split: Kapitel ${i} auf beiden Wegen`);
  ok(b.includes('7.1 Shared') && a.includes('7.1 Shared') && b.includes('7.3 Split by viewpoint'), 'Split: der gemeinsame Kern auf beiden Wegen');
  ok(b.includes('7.3 biblical') && !b.includes('7.3 historical') && b.includes('7.4 For beginners') && !b.includes('7.4 For advanced'), 'Split: Weg b geht durch basic / biblical');
  ok(a.includes('7.3 historical') && !a.includes('7.3 biblical') && a.includes('7.4 For advanced') && !a.includes('7.4 For beginners'), 'Split: Weg a geht durch advanced / historical');
  eq(M.linear(model, M.pathOf(model, 'a')).find((p) => p.node.id === s73h.id).through, { view: 'historical' }, 'Split: die Werte, für die eine Stelle eigens steht (7.3 liegt im gemeinsamen Kern von Kap. 7)');
  eq(M.linear(model, M.pathOf(model, 'a')).find((p) => p.node.id === adv.id).through, { level: 'advanced' }, 'Split: 7.4 steht eigens für Fortgeschrittene');
  const knowledge = K.knowledgeOf([ent('covenant', 'covenant', 'Term')]);
  const reps = Object.fromEntries(C.checkWork({ model, look, knowledge }).map((r) => [r.path.key, r]));
  ok(reps.b.findings.some((f) => f.code === 'notIntroducedHere' && f.node === ch[8].id), 'Split: Weg b — in Kap. 8 gebraucht, nur für Fortgeschrittene eingeführt');
  ok(!reps.a.findings.some((f) => f.entity === 'covenant' && f.code !== 'introducedNotUsed'), 'Split: Weg a in Ordnung');
  const ctx = X.contextAt(model, reps.b.register, model.nodes.get(s73b.id), look, knowledge, [], []);
  eq(ctx.cells.map((c) => c.node), [s73h.id], 'Split: Nachbarzelle von 7.3 biblical ist 7.3 historical');
  void s71; void s72; void basic; void adv;
  ok(latex('split-en-a', project, look, knowledge, { mode: 'final', path: 'a' }).includes('[english]{babel}'), 'Split: englisches Werk, englischer Satz');
}

/* == 4. Zyklus: 100 Kazania ============================================================================ */
{
  const { add, look, entries } = world();
  const project = add('project', { projectType: 'series', title: 'Kazania na każdy dzień', lang: 'pl', latexClass: 'booklet' });
  const tpl = add('unittemplate', { name: 'Kazanie 5 minut', role: 'new', targetWords: 650, targetMinutes: 5, parts: [
    { id: 'wstep', title: 'Wejście', kind: 'thought', words: 80 }, { id: 'pismo', title: 'Pismo', kind: 'quote', words: 120 },
    { id: 'mysl', title: 'Jedna myśl', kind: 'thought', words: 250 }, { id: 'przyklad', title: 'Przykład', kind: 'example', words: 120 },
    { id: 'zastosowanie', title: 'Zastosowanie', kind: 'application', words: 80 }
  ] });
  const model0 = M.readWork(project, look);
  const made = T.cycleFrom(model0, { template: T.readTemplate(tpl), parent: null, count: 100, title: 'Kazanie {n}', recapEvery: 10, withTexts: true });
  eq(made.filter((m) => m.kind === 'node').length, 100, 'Zyklus: 100 Knoten');
  eq(made.filter((m) => m.kind === 'text').length, 100, 'Zyklus: 100 Texte');
  for (const m of made) entries.push({ id: m.id, kind: m.kind, data: m.data });
  const nodes = made.filter((m) => m.kind === 'node');
  eq(nodes.filter((m) => m.data.role === 'summary').map((m) => m.data.title), ['Kazanie 10', 'Kazanie 20', 'Kazanie 30', 'Kazanie 40', 'Kazanie 50', 'Kazanie 60', 'Kazanie 70', 'Kazanie 80', 'Kazanie 90', 'Kazanie 100'], 'Zyklus: jedes zehnte eine Zusammenfassung');
  eq(look.get(nodes[0].data.text).data.plan.map((p) => p.id), ['tpl-wstep', 'tpl-pismo', 'tpl-mysl', 'tpl-przyklad', 'tpl-zastosowanie'], 'Zyklus: Plan aus der Vorlage');
  /* Jedes Kazanie bringt eine neue Myśl; jede Zusammenfassung nimmt die neun davor auf. */
  const thoughts = [];
  nodes.forEach((n, i) => {
    const text = look.get(n.data.text);
    if (n.data.role === 'summary') {
      text.data.body = `Przypomnienie. ${thoughts.slice(-9).map((t) => `[[myśl|@${t}|recall]]`).join(' ')} ${words(640)}`;
    } else {
      const id = `t${i + 1}`;
      thoughts.push(id);
      text.data.body = `Nowa myśl: [[myśl ${i + 1}|@${id}|intro]]. ${words(645)}`;
    }
  });
  add('rule', { project: project.id, rule: 'Każde kazanie przynosi jedną nową myśl.', why: 'Słuchacz zapamiętuje jedną myśl.', weight: 'must', template: tpl.id, role: 'new', check: 'oneNew' });
  add('rule', { project: project.id, rule: 'Najwyżej 750 słów.', why: 'Pięć minut to pięć minut.', weight: 'must', check: 'maxWords', param: '750' });
  add('rule', { rule: 'Mów do słuchaczy „wy”, nie „oni”.', why: 'Kazanie zwraca się do obecnych.', weight: 'should' });
  const knowledge = K.knowledgeOf(thoughts.map((id) => ent(id, `Myśl ${id}`, 'Idea')));
  const model = M.readWork(project, look);
  const [report] = C.checkWork({ model, look, knowledge });
  ok(!report.findings.some((f) => ['ruleOneNew', 'ruleMaxWords', 'summaryIntroduces', 'summaryRecallsUnknown', 'usedBeforeIntro', 'lengthOff', 'templateMissingParts'].includes(f.code)), `Zyklus: die Serie hält ihre Regeln (${[...new Set(codes(report.findings))].join(', ')})`);
  /* Der Kontext von Kazanie 37 — so, wie get_work_context ihn aus der Abschrift liest. */
  const brief = B.workBrief(project, look, knowledge);
  const path = brief.paths[0];
  const k37 = nodes[36].id;
  const pos = path.order.indexOf(k37);
  const introduced = Object.entries(path.firstIntro).filter(([, node]) => path.order.indexOf(node) < pos).map(([e]) => e);
  eq(introduced.length, 33, 'Zyklus: vor Kazanie 37 sind 33 Myśli eingeführt (36 minus drei Zusammenfassungen)');
  const rules = [...path.rulesEverywhere, ...(path.context[k37]?.rules ?? [])];
  const ruleTexts = rules.map((id) => brief.rules.find((r) => r.id === id).rule);
  ok(ruleTexts.includes('Każde kazanie przynosi jedną nową myśl.') && ruleTexts.includes('Najwyżej 750 słów.') && ruleTexts.includes('Mów do słuchaczy „wy”, nie „oni”.'), 'Zyklus: Regeln der Serie und das eigene Regelbuch gelten an Kazanie 37');
  ok(!(path.context[nodes[39].id]?.rules ?? []).length || !path.rulesEverywhere.includes(brief.rules.find((r) => r.rule.startsWith('Każde')).id), 'Zyklus: die Regel „eine neue Myśl" gilt nicht überall (Zusammenfassungen)');
  eq(path.context[k37]?.deliver, ['t37'], 'Zyklus: Kazanie 37 soll Myśl 37 einführen');
  eq(brief.rules.find((r) => r.rule.startsWith('Mów')).scope, 'rulebook', 'Zyklus: Regel ohne Projekt = eigenes Regelbuch');
  ok(latex('kazania-booklet', project, look, knowledge, { mode: 'final' }).includes('a5paper'), 'Zyklus: Heft mit Kazania auf A5');
  /* Die Vorlage ändert sich: alle Einheiten passen nicht mehr. */
  tpl.data.parts = [...tpl.data.parts, { id: 'modlitwa', title: 'Modlitwa', kind: 'application', words: 30 }];
  const [after] = C.checkWork({ model, look, knowledge });
  eq(after.findings.filter((f) => f.code === 'templateChanged').length, 100, 'Zyklus: geänderte Vorlage an allen 100 gemeldet');
  ok(after.findings.filter((f) => f.code === 'templateMissingParts').length === 100, 'Zyklus: der neue Teil fehlt in allen 100 Plänen');
  const applied = T.applyTemplate(look.get(nodes[0].data.text).data, T.readTemplate(tpl));
  eq(applied.map((p) => p.id), ['tpl-wstep', 'tpl-pismo', 'tpl-mysl', 'tpl-przyklad', 'tpl-zastosowanie', 'tpl-modlitwa'], 'Zyklus: Vorlage anwenden ergänzt nur');
  const json = JSON.stringify(brief);
  ok(json.length < 400000, `Zyklus: die Abschrift bleibt klein (${Math.round(json.length / 1024)} kB)`);
  /* Über eine Dimension: jede Einheit mit Kern und Varianten. */
  const pm = { ...project, data: { ...project.data, dimensions: [{ key: 'audience', name: 'Odbiorcy', values: [{ key: 'kids', name: 'Dzieci' }, { key: 'adults', name: 'Dorośli' }] }] } };
  const split = T.cycleFrom(M.readWork(pm, look), { template: T.readTemplate(tpl), parent: null, count: 3, title: 'Lekcja {n}', splitBy: 'audience', core: true });
  eq(split.filter((m) => m.data.split === 'audience').length, 3, 'Zyklus: geteilt — drei Köpfe');
  eq(split.filter((m) => m.data.variant !== undefined).map((m) => m.data.variant), ['kids', 'adults', 'kids', 'adults', 'kids', 'adults'], 'Zyklus: je Kopf eine Variante je Wert');
}

/* == 5. Artikel ======================================================================================= */
{
  const { add, look } = world();
  const person = add('person', { personType: 'person', givenNames: 'Joseph', surname: 'Ratzinger' });
  add('work', { workType: 'book', title: 'Jezus z Nazaretu', authors: [person.id], year: '2007', place: 'Kraków', publisher: 'WAM' }, 'ratzinger2007');
  const project = add('project', { projectType: 'article', title: 'O łasce', lang: 'pl', latexClass: 'article', citationStyle: 'authorYear' });
  const t1 = add('text', { title: 'Wstęp', project: project.id, body: '[[Łaska|@laska|intro]] — [[łaska|@laska|def]] to dar [@ratzinger2007, s. 23].' });
  const t2 = add('text', { title: 'Rozwinięcie', project: project.id, body: '[[Łaska|@laska]] i [[usprawiedliwienie|@uspr|intro]] [@brak2020].' });
  const t3 = add('text', { title: 'Zakończenie', project: project.id, body: 'Dlatego [[usprawiedliwienie|@uspr]].' });
  add('node', { project: project.id, title: 'Wstęp', order: 1, role: 'introduction', text: t1.id, purpose: 'x' });
  add('node', { project: project.id, title: 'Rozwinięcie', order: 2, role: 'new', text: t2.id, purpose: 'x' });
  add('node', { project: project.id, title: 'Zakończenie', order: 3, role: 'conclusion', text: t3.id, purpose: 'x' });
  add('rule', { project: project.id, rule: 'Każde pojęcie zdefiniowane.', why: 'Artykuł naukowy definiuje, zanim użyje.', weight: 'must', check: 'needsDefinition' });
  const knowledge = K.knowledgeOf([ent('laska', 'łaska', 'Termin', { definition: 'Dar.' }), ent('uspr', 'usprawiedliwienie', 'Termin')]);
  const model = M.readWork(project, look);
  const [report] = C.checkWork({ model, look, knowledge });
  ok(report.findings.some((f) => f.code === 'citationMissing' && f.message.includes('brak2020')), 'Artikel: Zitat ohne Ziel gemeldet');
  ok(!report.findings.some((f) => f.code === 'citationMissing' && f.message.includes('ratzinger2007')), 'Artikel: aufgelöstes Zitat nicht');
  ok(report.findings.some((f) => f.code === 'noDefinition' && f.entity === 'uspr'), 'Artikel: usprawiedliwienie ohne Definition');
  ok(!report.findings.some((f) => f.code === 'noDefinition' && f.entity === 'laska'), 'Artikel: łaska definiert');
  const tex = latex('artikel-pl', project, look, knowledge, { mode: 'final' });
  /* Die alten Drucke eines Textes (Artikel, Plan na ambonę) teilen die Präambel — auch sie werden übersetzt. */
  texOut.push(['tekst-artykul', textToLatex(t1, look)], ['tekst-plan', planToLatex(t1, look)]);
  latex('artikel-de-draft', { ...project, data: { ...project.data, lang: 'de' } }, look, knowledge, { mode: 'draft' });
  ok(tex.includes('{article}') && tex.includes('\\section{Wstęp}'), 'Artikel: Klasse article, Abschnitte');
  ok(tex.includes('(Ratzinger 2007, s. 23)'), 'Artikel: Autor und Jahr im Satz');
  ok(tex.includes('Źródła') && tex.includes('Jezus z Nazaretu'), 'Artikel: Bibliografie aus der Bibliothek');
  /* Ein Zitat gegen den vollen Text. */
  const q = add('quote', { work: look.byKey('ratzinger2007').id, text: 'Prośba o chleb sięga dalej', locator: 's. 183' }, 'q1');
  t3.data.body += '\n\n![@q1]';
  const [r2] = C.checkWork({ model: M.readWork(project, look), look, knowledge, sourcePlain: () => 'Tu stoi: prośba o chleb sięga dalej niż pokarm.' });
  ok(!r2.findings.some((f) => f.code === 'quoteMismatch'), 'Artikel: Zitat stimmt mit dem vollen Text');
  q.data.text = 'Prośba o wino sięga dalej';
  const [r3] = C.checkWork({ model: M.readWork(project, look), look, knowledge, sourcePlain: () => 'Tu stoi: prośba o chleb sięga dalej niż pokarm.' });
  ok(r3.findings.some((f) => f.code === 'quoteMismatch'), 'Artikel: abweichendes Zitat gemeldet');
}

/* == 6. Was es schon gab ============================================================================= */
{
  const { add, look } = world();
  /* Zapis: ein Link mit Rolle, ohne Rolle, umgeschrieben. */
  eq(parseInline('[[Anna|@anna|intro]]')[0], { t: 'ref', key: 'anna', c: [{ t: 'text', v: 'Anna' }], mark: 'intro' }, 'Zapis: Link mit Rolle');
  eq(parseInline('[[Anna|@anna]]')[0], { t: 'ref', key: 'anna', c: [{ t: 'text', v: 'Anna' }] }, 'Zapis: Link ohne Rolle unverändert');
  eq(parseInline('[[Anna|@anna|nie]]').some((i) => i.t === 'ref'), false, 'Zapis: unbekannte Rolle ist kein Link');
  eq(mapRefTokens('[[Anna|@anna|intro]] i [[x|@anna]]', (t) => (t === 'anna' ? 'ID' : t)), '[[Anna|@ID|intro]] i [[x|@ID]]', 'Zapis: Umschreiben behält die Rolle');
  /* Ein altes Schulprogramm mit Gliederung — und nach der Umwandlung in einen Baum. */
  const l1 = add('text', { title: 'Lekcja 1' });
  const l2 = add('text', { title: 'Lekcja 2' });
  const program = add('project', { projectType: 'program', title: 'Religia kl. 4', outline: [{ heading: 'Dział I' }, { text: l1.id }, { text: l2.id }] });
  const before = lessonsOf(program, look).map((l) => [l.heading, l.title, l.number]);
  eq(before, [['Dział I', 'Lekcja 1', 1], ['Dział I', 'Lekcja 2', 2]], 'Schule: Lekcje aus der Gliederung');
  const old = M.readWork(program, look);
  ok(old.fromOutline && old.roots.length === 1 && old.roots[0].children.length === 2, 'Alt: Gliederung als gedachter Baum');
  const converted = M.outlineToNodes(program, look);
  eq(converted.length, 3, 'Alt: drei Knoten aus der Gliederung');
  for (const c of converted) add('node', c.data).id = c.id;
  const lookAfter = { ...look };
  eq(lessonsOf(program, lookAfter).map((l) => [l.heading, l.title, l.number]), before, 'Schule: nach der Umwandlung dieselben Lekcje (aus dem Baum)');
  eq(M.projectOutline(program, look), [{ heading: 'Dział I' }, { text: l1.id }, { text: l2.id }], 'Alt: Gliederung aus dem Baum für alte Leser');
  /* Cogita kennt den Knoten als eingebaute Art (eine Phase zeigt auf ihn). */
  ok(baseKind('node')?.label === '{title}', 'Cogita: Knoten als eingebaute Art');
  ok(WRITING_KINDS.some((k) => k.kind === 'node') && WRITING_KINDS.some((k) => k.kind === 'rule') && WRITING_KINDS.some((k) => k.kind === 'unittemplate'), 'Skryptorium: drei neue Arten');
  ok(scriptoriumDescription().includes('"split"') && scriptoriumDescription().includes('"marks"'), 'JSON: die Beschreibung nennt Knoten mit split und marks');
  /* Ein Werk als JSON: Knoten mit @schlüssel, Marken auf Nauka beim bleibenden Namen. */
  const anna = { id: '11111111-1111-4111-8111-111111111111', kind: 'entity', data: { name: 'Anna', _ref: 'ksiazka/anna' } };
  const doc = { format: 'recreatio/scriptorium', version: 1, entries: [
    { kind: 'project', key: 'ksiazka', data: { title: 'Książka', dimensions: [{ key: 'audience', name: 'Odbiorcy', values: [{ key: 'kids', name: 'Dzieci' }] }] } },
    { kind: 'node', key: 'cz1', data: { project: '@ksiazka', title: 'Część I', order: 1, role: 'introduction' } },
    { kind: 'node', key: 'r1', data: { project: '@ksiazka', parent: '@cz1', title: 'Rozdział 1', order: 1, role: 'new', marks: [{ entry: '@ksiazka/anna', role: 'intro' }] } },
    { kind: 'rule', data: { project: '@ksiazka', rule: 'Krótko.', weight: 'should', check: 'maxWords', param: '500' } },
    { kind: 'unittemplate', key: 'kaz', data: { name: 'Kazanie', parts: [{ id: 'a', title: 'A' }] } }
  ] };
  const plan = planScriptoriumImport(doc, look, { entryRef: (token) => (token.toLowerCase() === 'ksiazka/anna' ? anna : undefined) });
  ok(!('error' in plan), 'JSON: ein Werk lässt sich planen');
  eq(plan.drafts.map((d) => d.kind), ['unittemplate', 'project', 'node', 'node', 'rule'], 'JSON: Reihenfolge des Speicherns');
  const r1 = plan.drafts.find((d) => d.key === 'r1');
  const cz1 = plan.drafts.find((d) => d.key === 'cz1');
  eq(r1.data.parent, cz1.id, 'JSON: parent per @schlüssel');
  eq(r1.data.marks, [{ entry: anna.id, role: 'intro' }], 'JSON: Marke auf Nauka beim bleibenden Namen');
  ok(plan.warnings.length === 0, `JSON: ohne Warnungen (${plan.warnings.join(' | ')})`);
}

if (process.env.WORK_TEX_DIR) for (const [name, text] of texOut) await writeFile(join(process.env.WORK_TEX_DIR, `${name}.tex`), text);
await rm(workspace, { recursive: true, force: true });
console.log(`Das Werk: ${checks} Prüfungen bestanden.`);
