/**
 * 2026-11-04 (Prompt 15) — „KILKA Z KILKU" NACH DER PRÜFUNG UND TITEL MIT VORZEICHEN, nachgemessen
 * (`cogita/choiceMarks.ts`, `cogita/schema.ts` → `tidy`, `cogita/titleSigns.ts`):
 *   - jede Möglichkeit nach der Entscheidung des Lernenden: gewählt+richtig ✓ grün, übersehen bernsteinfarben ohne ✓,
 *     gewählt+falsch ✗ rot, richtig weggelassen neutral; der Satz unter gewählten und übersehenen; Worte pl/de/en;
 *   - die Wertung bleibt (`checkCard` → `checkMany`);
 *   - ein Titel aus der Frage behält jedes Minus: „(0,-3)", „{-2,-1,0,1,2}", „x = -5", „-5 + 3"; leere Stellen
 *     verschwinden weiter („A – , B" → „A – B");
 *   - die einmalige Reparatur findet nur Titel, die nach der alten Regel anders aussahen.
 *
 *   node scripts/app-choice-check.mjs
 */
import { readLang, useLocale } from './i18n-node.mjs';
/* Polnisch für die Vergleiche — Deutsch dazu: eine Baza kann deutsch sprechen. */
(await useLocale('pl')).dicts.de = await readLang('de');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-choice-'));
const names = { marks: 'choiceMarks', schema: 'schema', kinds: 'kinds', signs: 'titleSigns', cards: 'cards' };
await build({
  entryPoints: Object.fromEntries(Object.entries(names).map(([k, n]) => [k, `src/app/cogita/${n}.ts`])),
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [M, S, K, T, C] = await Promise.all(Object.keys(names).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* -- Die vier Zustände ------------------------------------------------------------------------------------------- */
check('richtig + gewählt → hit', M.choiceMark(true, true), 'hit');
check('richtig, nicht gewählt → missed', M.choiceMark(true, false), 'missed');
check('falsch + gewählt → wrong', M.choiceMark(false, true), 'wrong');
check('falsch, nicht gewählt → left', M.choiceMark(false, false), 'left');
check('Zeichen: ✓ nur an gewählten richtigen, ✗ an gewählten falschen', ['hit', 'missed', 'wrong', 'left'].map((m) => M.CHOICE_GLYPH[m]), ['✓', '', '✗', '']);
check('Klassen: grün, bernstein, rot, neutral', ['hit', 'missed', 'wrong', 'left'].map((m) => M.CHOICE_CLASS[m]), [' is-right', ' is-missed', ' is-wrong', ' is-left']);
check('der Satz steht unter gewählten und übersehenen', ['hit', 'missed', 'wrong', 'left'].map(M.choiceSaid), [true, true, true, false]);
check('Worte pl', [M.choiceWords('pl').missed, M.choiceWords('pl').left], ['pominięte — to też prawda', 'słusznie pominięte']);
check('Worte de', [M.choiceWords('de').missed, M.choiceWords('de').left], ['übersehen — auch richtig', 'richtig weggelassen']);
check('Worte en', [M.choiceWords('en').missed, M.choiceWords('en').left], ['missed — this is also true', 'correctly left out']);

/* Eine Karte „Kilka z kilku": 0 und 2 richtig, gewählt 0 und 1 — die Zustände je Möglichkeit, die Wertung wie bisher. */
const card = { key: 'k', answer: { form: 'many', options: ['A', 'B', 'C', 'D'], correct: [0, 2] } };
const given = [0, 1];
check('je Möglichkeit: A hit, B wrong, C missed, D left', card.answer.options.map((_o, i) => M.choiceMark(card.answer.correct.includes(i), given.includes(i))), ['hit', 'wrong', 'missed', 'left']);
const outcome = C.checkCard(card, given);
check('die Wertung bleibt (nicht richtig, teilweise)', [outcome.correct, outcome.correctness > 0 && outcome.correctness < 1], [false, true]);

/* -- Titel mit Vorzeichen ---------------------------------------------------------------------------------------- */
const look = S.lookupOf([K.QUESTION], []);
const q = (id, prompt) => ({ id, kinds: ['question'], data: { form: 'text', prompt } });
const title = (prompt) => S.labelOf(q('x', prompt), look);
check('„(0,-3)" behält sein Minus', title('Punkt (0,-3) leży na osi'), 'Punkt (0,-3) leży na osi');
check('„{-2,-1,0,1,2}" behält alle Minus', title('Zbiór {-2,-1,0,1,2}'), 'Zbiór {-2,-1,0,1,2}');
check('„x = -5" bleibt', title('Rozwiąż: x = -5'), 'Rozwiąż: x = -5');
check('ein Minus am Anfang bleibt', title('-5 + 3 = ?'), '-5 + 3 = ?');
check('Wzór bleibt ohnehin', S.labelOf(q('y', 'Czy $x \\in [0, -1]$?'), look, 0, false, true), 'Czy $x \\in [0, -1]$?');
check('leere Stellen verschwinden weiter', [S.tidy('A – , B'), S.tidy(', – A'), S.tidy('A, ,B'), S.tidy('A —')], ['A – B', 'A', 'A,B', 'A']);
check('die alte Regel verlor das Minus (zum Erkennen)', [T.tidyBefore('Punkt (0,-3)'), T.tidyBefore('{-2,-1,0,1,2}')], ['Punkt (0,3)', '{-2,1,0,1,2}']);

/* -- Die einmalige Reparatur ------------------------------------------------------------------------------------- */
const entities = [q('a', 'Punkt (0,-3)'), q('b', 'Ile to 2 + 2?'), q('c', 'Zbiór {-2,-1,0}'), q('d', 'x = -5')];
const repairs = T.signRepairs(entities, (e) => S.labelOf(e, look));
check('nur Titel, die nach der alten Regel anders aussahen', repairs.map((r) => r.id), ['a', 'c']);
check('alt → neu', repairs.map((r) => [r.before, r.now]), [['Punkt (0,3)', 'Punkt (0,-3)'], ['Zbiór {-2,1,0}', 'Zbiór {-2,-1,0}']]);

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
let refreshed = 0;
const lib = (writes, list) => ({ writes, libraryId: 'L1', entities: () => list, label: (e) => S.labelOf(e, look), store: { copiesStale: () => { refreshed += 1; } } });
check('wer nur liest, repariert nichts', [T.repairTitleSignsOnce(lib(false, entities)), refreshed], [false, 0]);
check('wer schreibt: einmal neu', [T.repairTitleSignsOnce(lib(true, entities)), refreshed], [true, 1]);
check('… und nie wieder', [T.repairTitleSignsOnce(lib(true, entities)), refreshed], [false, 1]);
store.clear();
check('ohne geänderte Titel: nichts neu', [T.repairTitleSignsOnce(lib(true, [q('b', 'Ile to 2 + 2?')])), refreshed], [false, 1]);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
