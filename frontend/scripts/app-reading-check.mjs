/**
 * 2026-11-22 (Homer-Einheit, „R · Lektüre mit Aufgaben") — DIE DREI LEKTÜRE-FRAGEN, rein gerechnet, ohne Browser:
 *   1. Bereiche lesen („3-5, 9", „12–15; 30-31", [von, bis]) und wieder schreiben („3–5, 9");
 *   2. die Karte aus den Daten (`questionCard`): lines, label, span — ohne Stelle oder Richtiges keine Karte;
 *   3. prüfen und teils richtig: Zeilen (Treffer − Fehlgriffe), Zuordnung je Zeile, Bereich nach Überlappung;
 *   4. Fehler-Tags je Zeilenbereich (`answerSignals`, für wrong:<tag>);
 *   5. für die Teilnehmer ohne das Richtige (`stripCard`), der Fingerabdruck hängt am Richtigen;
 *   6. die Wärmekarte je Zeile, die Verteilung und die Antwort der Klasse in einer Stunde;
 *   7. der Abschnitt als Zeilen (Blöcke an Zeilenumbrüchen, ohne Überschriften), der Słowniczek (Formen, Werk), die Marke `glossary`;
 *   8. was einer Frage fehlt (Editor, Vorschau des Imports).
 *
 *   node scripts/app-reading-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-reading-'));
const entries = {
  rs: 'src/app/cogita/reading/readingSpec.ts', ri: 'src/app/cogita/reading/readingImport.ts', cards: 'src/app/cogita/cards.ts',
  live: 'src/app/cogita/live.ts', ad: 'src/app/cogita/adaptive.ts', lt: 'src/app/cogita/lesson/lessonTally.ts',
  qt: 'src/app/cogita/questionTypes.ts', schema: 'src/app/cogita/schema.ts', kinds: 'src/app/cogita/kinds.ts'
};
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' }, jsx: 'automatic',
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [RS, RI, CD, LV, AD, LT, QT, SC, KI] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const r2 = (n) => Math.round(n * 100) / 100;
const passage = { work: '@iliada-dmochowski', locator: 'XXII 247-272' };
const entity = (data, id = 'q-read') => ({ id, kinds: ['question'], data: { prompt: 'Zaznacz…', passage, ...data } });

/* -- 1. Bereiche ------------------------------------------------------------------------------------------------------ */
check('ranges: "3-5, 9" → lines', RS.linesOf('3-5, 9'), [3, 4, 5, 9]);
check('ranges: dashes, semicolons, reversed, a list of pairs', [RS.readRanges('12–15; 31-30'), RS.readRanges([[2, 4], '7', 9])], [[[12, 15], [30, 31]], [[2, 4], [7, 7], [9, 9]]]);
check('ranges: rubbish and zero fall away', RS.readRanges('a, 0, -3, 4'), [[4, 4]]);
check('ranges: written back', RS.rangesText([9, 3, 4, 5, 5]), '3–5, 9');

/* -- 2. Die Karte ------------------------------------------------------------------------------------------------------ */
const lines = CD.questionCard(entity({ form: 'lines', lines: '3-5, 9', tags: ['7: confuses-narrator', '4: misses-start', 'nonsense'] }));
const label = CD.questionCard(entity({ form: 'label', roles: ['narrator', 'Hector', 'Achilles'], labels: ['1: Hector', '3-4: achilles', '6: Zeus'] }, 'q-label'));
const span = CD.questionCard(entity({ form: 'span', spans: '12-15; 30-31' }, 'q-span'));
check('card: lines — the passage by work and place, the right lines', [lines.answer.form, lines.answer.passage, lines.answer.correct], ['lines', passage, [3, 4, 5, 9]]);
check('card: label — marked lines, roles found regardless of case, an unknown role falls away', [label.answer.marked, label.answer.correct], [[1, 3, 4], [1, 2, 2]]);
check('card: span — the accepted ranges', span.answer.spans, [[12, 15], [30, 31]]);
check('card: no passage, no right lines, one role — no card', [
  CD.questionCard({ id: 'x', kinds: ['question'], data: { form: 'lines', prompt: '?', lines: '3' } }),
  CD.questionCard(entity({ form: 'lines', lines: '' })),
  CD.questionCard(entity({ form: 'label', roles: ['narrator'], labels: ['1: narrator'] }))
], [null, null, null]);
check('card: passage also as {value, locator} (a ref with place)', CD.questionCard(entity({ form: 'span', spans: '2', passage: { value: 'w1', locator: 'I 1' } })).answer.passage, { work: 'w1', locator: 'I 1' });

/* -- 3. Prüfen ----------------------------------------------------------------------------------------------------- */
const out = (o) => [o.correct, r2(o.correctness), o.answered];
check('lines: exactly the right ones (any order) — right', out(CD.checkCard(lines, [9, 5, 4, 3])), [true, 1, true]);
check('lines: 3 of 4, nothing wrong — 0.75', out(CD.checkCard(lines, [3, 4, 5])), [false, 0.75, true]);
check('lines: 4 right + 2 wrong — (4 − 2) / 4', out(CD.checkCard(lines, [3, 4, 5, 9, 1, 2])), [false, 0.5, true]);
check('lines: more wrong than right — never below 0', out(CD.checkCard(lines, [1, 2, 3])), [false, 0, true]);
check('lines: nothing chosen — not answered', out(CD.checkCard(lines, [])), [false, 0, false]);
check('lines: marks per chosen line (sorted)', CD.checkCard(lines, [9, 1]).marks, [false, true]);
check('label: all right', out(CD.checkCard(label, [1, 2, 2])), [true, 1, true]);
check('label: 2 of 3 — partly, marks per line', [out(CD.checkCard(label, [1, 0, 2])), CD.checkCard(label, [1, 0, 2]).marks], [[false, 0.67, true], [true, false, true]]);
check('label: none chosen — not answered', out(CD.checkCard(label, [-1, -1, -1])), [false, 0, false]);
check('span: exactly an accepted range (reversed too) — right', [out(CD.checkCard(span, [12, 15])), out(CD.checkCard(span, [31, 30]))], [[true, 1, true], [true, 1, true]]);
check('span: overlap 3 of 6 lines — 0.5', out(CD.checkCard(span, [13, 17])), [false, 0.5, true]);
check('span: no overlap — 0; nothing — not answered', [out(CD.checkCard(span, [1, 3])), out(CD.checkCard(span, null))], [[false, 0, true], [false, 0, false]]);

/* -- 4. Fehler-Tags ------------------------------------------------------------------------------------------------- */
const sig = (card, data, given) => AD.answerSignals(card, data, given, CD.checkCard(card, given)).tags;
check('tags: a wrongly chosen line and a missed one carry the tag of their range', sig(lines, { tags: ['7: confuses-narrator', '4: misses-start'] }, [3, 5, 7, 9]), ['confuses-narrator', 'misses-start']);
check('tags: right answer — no tag', sig(lines, { tags: ['7: confuses-narrator'] }, [3, 4, 5, 9]), []);
check('tags: label — the wrongly labelled line', sig(label, { tags: ['3-4: hector-not-achilles'] }, [1, 1, 2]), ['hector-not-achilles']);
check('tags: span — a wrong range touching a tagged range; a right one none', [sig(span, { tags: ['16-18: too-long'] }, [12, 17]), sig(span, { tags: ['12-15: x'] }, [12, 15])], [['too-long'], []]);
check('tags: rows without lines fall away', RS.readLineTags(['7: a', 'b', { lines: '2-3', tag: 'c' }]).map((x) => [[...x.lines], x.tag]), [[[7], 'a'], [[2, 3], 'c']]);

/* -- 5. Ohne das Richtige ------------------------------------------------------------------------------------------- */
const sl = LV.stripCard(lines);
const sb = LV.stripCard(label);
const ss = LV.stripCard(span);
check('strip: passage stays, right lines go', [sl.answer.passage, sl.answer.correct, sl.fingerprint], [passage, [], '']);
check('strip: label keeps marked lines and roles, not the right roles', [sb.answer.marked, sb.answer.roles, sb.answer.correct], [[1, 3, 4], ['narrator', 'Hector', 'Achilles'], []]);
check('strip: span keeps no range', ss.answer.spans, []);
check('fingerprint: changes with the right lines, not with the order they are written', [
  CD.questionCard(entity({ form: 'lines', lines: '9, 3-5' })).fingerprint === lines.fingerprint,
  CD.questionCard(entity({ form: 'lines', lines: '3-5' })).fingerprint === lines.fingerprint
], [true, false]);
check('texts: the right answer and the given one, short', [
  RS.readingAnswerText(lines.answer, { line: 'lines' }), RS.readingAnswerText(label.answer, { line: '' }), RS.readingAnswerText(span.answer, { line: '' }),
  RS.readingGivenText(lines.answer, [9, 3, 4]), RS.readingGivenText(label.answer, [1, -1, 2]), RS.readingGivenText(span.answer, [15, 12])
], ['lines 3–5, 9', '1 Hector · 3–4 Achilles', '12–15 / 30–31', '3–4, 9', '1 Hector · 3 — · 4 Achilles', '12–15']);

/* -- 6. Wärmekarte, Verteilung, Antwort der Klasse ------------------------------------------------------------------ */
check('heat: per line how many chose it (index 0 = line 1)', RS.heatOf(lines.answer, [[3, 4], [4], [4, 9], 'rubbish']), [0, 0, 1, 3, 0, 0, 0, 0, 1]);
check('heat: span — every line in the chosen range', RS.heatOf(span.answer, [[2, 3], [3, 4]]), [0, 1, 2, 1]);
check('heat: label — no heat map', RS.heatOf(label.answer, [[1, 2, 2]]), []);
const vote = (participant, given, at) => ({ participant, given, at });
const tally = LT.tallyQuestion(lines, [vote('a', [3, 4, 5, 9], 1), vote('b', [9, 5, 4, 3], 2), vote('c', [3], 3)], { tags: ['7: confuses-narrator'] });
check('tally: the same lines in another order are the same answer, named as lines', tally.bars.map((b) => [b.label, b.count, b.correct]), [['3–5, 9', 2, true], ['3', 1, false]]);
check('class answer: the majority marked the right lines', LT.classAnswer(lines, [vote('a', [3, 4, 5, 9], 1), vote('b', [9, 5, 4, 3], 2), vote('c', [3], 3)]), { given: [3, 4, 5, 9], correct: true });
const lab = LT.classAnswer(label, [vote('a', [2, 1, 1], 1), vote('b', [1, 2, 2], 2), vote('c', [2, 1, 1], 3)]);
check('class answer: label keeps the order of the roles (not sorted) — the most frequent mistake', lab, { given: [2, 1, 1], correct: false });

/* -- 7. Abschnitt, Słowniczek, Marke ------------------------------------------------------------------------------- */
const blocks = [
  { type: 'heading', text: 'Księga XXII' },
  { type: 'paragraph', loc: 'XXII 247', text: 'Rzekł, a Hektor srożył{{note 3}} się\nI biegł {{page 46}}ku bramie' },
  { type: 'note', text: 'przypis' },
  { type: 'quote', text: 'tuszył, że ujdzie\n\n' },
  { type: 'list', items: ['jeden', 'dwa'] }
];
check('passage: blocks split at line breaks, without heading/note, markup dropped', RS.passageLinesOf(blocks, [0, 1, 2, 3, 4]), ['Rzekł, a Hektor srożył się', 'I biegł ku bramie', 'tuszył, że ujdzie', 'jeden', 'dwa']);
const g1 = RS.glossaryEntry('g1', { word: 'srożyć', forms: 'srożył, srożą', meaning: 'gniewać się' });
const g2 = RS.glossaryEntry('g2', { word: 'tuszyć', forms: ['tuszył'], meaning: 'mieć nadzieję', work: 'w-iliada' });
check('glossary: an entry needs word and meaning', [RS.glossaryEntry('x', { word: 'a' }), g1.words], [null, ['srożyć', 'srożył', 'srożą']]);
const pieces = (line, work) => RS.glossaryPieces(line, [g1, g2], work).map((p) => (p.entry === undefined ? p.text : `[${p.text}=${p.entry.id}]`)).join('');
check('glossary: forms underlined, case-insensitive', pieces('Hektor Srożył się', 'w-iliada'), 'Hektor [Srożył=g1] się');
check('glossary: an entry for one work only there', [pieces('tuszył, że ujdzie', 'w-iliada'), pieces('tuszył, że ujdzie', 'w-odyseja')], ['[tuszył=g2], że ujdzie', 'tuszył, że ujdzie']);
const kind = SC.readKind('k-gloss', { name: 'Słówko', fields: [
  { key: 'slowo', label: 'Słowo', type: 'line', glossary: 'word' }, { key: 'formy', label: 'Formy', type: 'list', glossary: 'forms' },
  { key: 'znaczenie', label: 'Znaczenie', type: 'text', glossary: 'meaning' }, { key: 'dzielo', label: 'Dzieło', type: 'ref', glossary: 'work' },
  { key: 'zle', label: 'Źle', type: 'ref', glossary: 'word' }
] });
check('flag: glossary read per field (work only on a ref, word never on one)', kind.fields.map((f) => f.glossary ?? null), ['word', 'forms', 'meaning', 'work', null]);
check('flag: the kind document keeps it (export)', KI.kindDoc(kind).fields.map((f) => f.glossary ?? null), ['word', 'forms', 'meaning', 'work', null]);

/* -- 8. Was fehlt ------------------------------------------------------------------------------------------------- */
check('problems: editor — no passage, no lines', QT.questionProblems({ form: 'lines', prompt: '?' }).length, 2);
check('problems: editor — a complete question has none', [QT.questionProblems({ form: 'span', prompt: '?', passage, spans: '3' }), QT.questionProblems({ form: 'label', prompt: '?', passage, roles: ['a', 'b'], labels: ['1: a'] })], [[], []]);
const warn = RI.readingImportWarnings({ entities: [
  { id: 'a', kinds: ['question'], data: { form: 'label', prompt: 'Kto mówi?', passage, roles: ['narrator', 'Hektor'], labels: ['1: Hektor', '2: Zeus'], tags: ['x'] } },
  { id: 'b', kinds: ['question'], data: { form: 'lines', prompt: 'Gut', passage, lines: '3' } },
  { id: 'c', kinds: ['question'], data: { form: 'one', prompt: 'Andere' } }
] });
check('import: unknown role and a tag row without lines are named, a good question and other forms are quiet', [warn.length, warn[0].includes('Kto mówi?'), /1 row/.test(warn[0]), /name no lines/.test(warn[0])], [1, true, true, true]);
check('question types: the three forms in the group "read" with their fields', QT.QUESTION_TYPES.filter((x) => x.group === 'read').map((x) => [x.form, x.fields]), [['lines', ['passage', 'lines', 'tags']], ['label', ['passage', 'roles', 'labels', 'tags']], ['span', ['passage', 'spans', 'tags']]]);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
