/**
 * LEKCJE NACH LEMMA, nachgemessen (2026-11-01, Spezifikation 2.9 und 2.11).
 *
 * Was eine Powtórka zu einer Lektion macht, ist reine Rechnung: „x z y kart" während des Laufs (der Balken steht
 * genau dann am Ende, wenn der Lauf von selbst endet — auch, wenn Karten auf eine Bedingung warten), das Üben dessen,
 * was nicht sass (Stufen: jede Karte muss richtig sein), die nächste Lektion (`next`: Kennung oder bleibender Name), das
 * Protokoll eines Laufs (erste Antwort, Podpowiedź, aktive Zeit) und das Tagesziel (verschiedene Karten je Tag, Serie,
 * Woche).
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-lemma-lessons-'));
const names = ['lessons', 'revision', 'store'];
await build({
  entryPoints: Object.fromEntries(names.map((n) => [n, `src/app/cogita/${n}.ts`])),
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error',
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [L, R, ST] = await Promise.all(names.map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const truth = (name, ok, detail) => {
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}${detail === undefined ? '' : `\n  ${JSON.stringify(detail)}`}`); }
};

/* ── Die nächste Lektion ─────────────────────────────────────────────── */

const docs = [
  { id: 'r1', data: { name: 'Lekcja 1', next: 'r2' } },
  { id: 'r2', data: { name: 'Lekcja 2', _ref: 'kurs/lekcja-2', next: '@kurs/lekcja-3' } },
  { id: 'r3', data: { name: 'Lekcja 3', _ref: 'kurs/lekcja-3', next: 'kurs/lekcja-4' } },
  { id: 'r4', data: { _ref: '@kurs/lekcja-4', next: 'r4' } },
  { id: 'r5', data: { name: 'Bez następnej' } },
  { id: 'r6', data: { name: 'Zła', next: '@nie-ma' } }
];
check('next: by id', L.nextLesson(docs, 'r1'), { id: 'r2', name: 'Lekcja 2' });
check('next: by lasting name with @', L.nextLesson(docs, 'r2'), { id: 'r3', name: 'Lekcja 3' });
check('next: by lasting name without @ (stored with @)', L.nextLesson(docs, 'r3'), { id: 'r4', name: 'Powtórka' });
check('next: itself is no next lesson', L.nextLesson(docs, 'r4'), null);
check('next: none', L.nextLesson(docs, 'r5'), null);
check('next: missing target', L.nextLesson(docs, 'r6'), null);
check('next: unknown revision', L.nextLesson(docs, 'zzz'), null);

/* ── Das Protokoll eines Laufs ───────────────────────────────────────── */

const T = Date.UTC(2026, 10, 1, 10, 0, 0);
let log = L.logTick(L.EMPTY_LOG, T);
check('log: the first tick only starts the clock', [log.activeMs, log.last], [0, T]);
log = L.logAnswer(log, 'a', { correct: true }, T + 20_000);
log = L.logTick(log, T + 25_000);
log = L.logAnswer(log, 'b', { correct: false }, T + 40_000);
log = L.logTick(log, T + 45_000);
log = L.logAnswer(log, 'c', { correct: true, hints: 1 }, T + 60_000);
log = L.logTick(log, T + 61_000);
log = L.logAnswer(log, 'b', { correct: true }, T + 70_000);
log = L.logTick(log, T + 71_000);
log = L.logAnswer(log, 'c', { correct: false }, T + 90_000);
check('log: answers counted', log.answers, 5);
check('log: first answers (a right, b wrong, c only with a hint)', [...log.first.entries()], [['a', true], ['b', false], ['c', false]]);
check('log: missed in order, wrong beats hint', [...log.missed.entries()], [['b', 'wrong'], ['c', 'wrong']]);
check('log: summary', L.logSummary(log), { cards: 3, firstTry: 1, missed: 2 });
check('log: active time = all spans under the cap', log.activeMs, 90_000);
const idle = L.logAnswer(L.logTick(L.EMPTY_LOG, T), 'a', { correct: true }, T + 60 * 60_000);
check('log: an hour away counts as three minutes', idle.activeMs, L.SPAN_CAP);
const hinted = L.logAnswer(L.logTick(L.EMPTY_LOG, T), 'h', { correct: true, hints: 2 }, T + 1000);
check('log: a hinted right answer is to practise (hint)', [...hinted.missed.entries()], [['h', 'hint']]);
check('duration: seconds', L.durationText(45_000), '45 s');
check('duration: minutes', L.durationText(7 * 60_000 + 10_000), '7 min');
check('duration: hours', L.durationText(65 * 60_000), '1 h 05 min');

/* ── Das Tagesziel ───────────────────────────────────────────────────── */

check('goal: read a number', L.readDailyGoal(15), 15);
check('goal: read text', L.readDailyGoal('20'), 20);
check('goal: zero is no goal', L.readDailyGoal(0), undefined);
check('goal: at most 500', L.readDailyGoal(9999), 500);
check('goal: words are no goal', L.readDailyGoal('dużo'), undefined);
const noon = (d) => new Date(2026, 10, d, 12, 0, 0).getTime();
const day = (d, keys) => keys.map((key, i) => ({ key, at: noon(d) + i * 1000 }));
const answers = [
  ...day(1, ['a', 'b', 'c']),
  ...day(3, ['a', 'b', 'c', 'a', 'a']),
  ...day(4, ['a', 'b', 'c']),
  ...day(5, ['x', 'y'])
];
const g = L.goalState(answers, 3, noon(5) + 3600_000);
check('goal: today counts different cards', g.today, 2);
check('goal: streak from yesterday while today is not done', g.streak, 2);
check('goal: the week, oldest first', g.week.map((d) => [d.cards, d.met]), [[0, false], [0, false], [3, true], [0, false], [3, true], [3, true], [2, false]]);
const g2 = L.goalState([...answers, ...day(5, ['z'])], 3, noon(5) + 3600_000);
check('goal: today reached — the streak includes today', [g2.today, g2.streak], [3, 3]);
const merged = L.goalState(day(5, ['old', 'new', 'q']), 3, noon(5) + 3600_000, (k) => (k === 'old' ? 'new' : k));
check('goal: merged cards count once', merged.today, 2);
check('settings: dailyGoal read', ST.readSettings({ motivation: 'streaks', dailyGoal: '12' }), { motivation: 'streaks', dailyGoal: 12, tags: [], dependencies: [], offline: [], sources: [], worlds: [] });
check('settings: no goal by default', ST.readSettings({}).dailyGoal, undefined);
check('settings: motivation stays „progress" by default', ST.readSettings({}).motivation, 'progress');

/* ── Der Fortschritt einer Lektion ───────────────────────────────────── */

const card = (key, entity) => ({ question: key, direction: '', key, entity, prompt: [{ text: `Pytanie ${key}` }], answer: { form: 'truefalse', value: true }, explain: [], fingerprint: 'f', varies: false, requires: [] });
const cards = ['a', 'b', 'c', 'd'].map((k) => card(k, `e-${k}`));
const T0 = Date.UTC(2026, 10, 1, 9, 0, 0);
const begin = (plan) => R.start({ plan, all: cards, marks: () => [], deps: [], now: T0, seed: 'lekcja' });
const lesson = R.readPlan(cards, { mode: 'temporal', endWhenDone: true, order: 'given', pick: 'next', stackSize: 2 });
let s = begin(lesson);
check('lesson: nothing done at the start', R.lessonProgress(s, T0), { done: 0, total: 4, held: 0 });
let t = T0;
const order = [];
let guard = 0;
while (s.current !== null && guard < 30) {
  guard += 1;
  t += 20_000;
  order.push(s.current);
  /* „b" ist das erste Mal falsch. */
  const right = !(s.current === 'b' && order.filter((k) => k === 'b').length === 1);
  s = R.answer(s, right ? 1 : 0, t).session;
  const lp = R.lessonProgress(s, t);
  truth(`lesson: after ${order.at(-1)} ${right ? 'right' : 'wrong'} — done ≤ total = 4`, lp.done <= lp.total && lp.total === 4 && lp.held === 0, lp);
}
check('lesson: ends by itself, every card asked, b twice', order.slice().sort(), ['a', 'b', 'b', 'c', 'd']);
check('lesson: at the natural end the bar is full', R.lessonProgress(s, t), { done: 4, total: 4, held: 0 });
/* 2026-11-04 (Prompt 10) — jede Powtórka nach den Bändern zählt „Zostało N": auch eine, die danach „na zapas" übt. */
{ const lp = R.lessonProgress(begin(R.readPlan(cards, { mode: 'temporal', order: 'given', pick: 'next' })), T0); truth('lesson: every temporal run has a counter (Zostało N)', lp !== null && lp.done === 0 && lp.total === 4, lp); }
check('lesson: a fixed sequence keeps its own bar', R.lessonProgress(begin(R.readPlan(cards, { mode: 'once' })), T0), null);
check('lesson: once — progress unchanged', R.progress(begin(R.readPlan(cards, { mode: 'once', order: 'given' }))), { answered: 0, total: 4, done: false });

/* Eine Bedingung: „c" erst, wenn „e-a" sitzt — wartet, gehört so lange nicht zu y; danach kommt sie dazu. */
const gate = { any: [[{ type: 'knowness', of: 'e-a', op: 'ge', than: 1 }]], related: {} };
const gated = R.readPlan(cards, { mode: 'temporal', endWhenDone: true, order: 'given', pick: 'next', stackSize: 4 }, { when: { c: gate } });
let sg = begin(gated);
check('held: waits for a condition — not in y', R.lessonProgress(sg, T0), { done: 0, total: 3, held: 1 });
t = T0;
guard = 0;
const seen = [];
let grown = null;
while (sg.current !== null && guard < 30) {
  guard += 1;
  t += 20_000;
  seen.push(sg.current);
  sg = R.answer(sg, 1, t).session;
  const lp = R.lessonProgress(sg, t);
  if (grown === null && lp.total === 4) grown = { after: seen.slice(), lp };
}
truth('held: released once „a" is known — y grows to 4', grown !== null && grown.after.includes('a') && grown.lp.held === 0, grown);
check('held: the released card is asked too', seen.slice().sort(), ['a', 'b', 'c', 'd']);
check('held: full at the end', R.lessonProgress(sg, t), { done: 4, total: 4, held: 0 });
/* Eine Bedingung, die nie gilt: der Lauf endet trotzdem — der Balken voll, die Karte als wartend genannt. */
const never = { any: [[{ type: 'knowness', of: 'nikt', op: 'ge', than: 1 }]], related: {} };
let sn = begin(R.readPlan(cards, { mode: 'temporal', endWhenDone: true, order: 'given', pick: 'next', stackSize: 4 }, { when: { d: never } }));
t = T0;
guard = 0;
while (sn.current !== null && guard < 30) { guard += 1; t += 20_000; sn = R.answer(sn, 1, t).session; }
check('held forever: the run ends, bar full, one waiting', R.lessonProgress(sn, t), { done: 3, total: 3, held: 1 });
check('held forever: the end screen names it', R.waiting(sn, t).cards, 1);

/* ── Üben, was nicht sass ────────────────────────────────────────────── */

const missed = [cards[1], cards[3]];
const practice = R.practicePlan(missed);
check('practice: levels, two steps, given order, strictly next', [practice.mode, practice.levels, practice.order, practice.pick, practice.stackSize, practice.cards.map((c) => c.key)], ['levels', 2, 'given', 'next', 2, ['b', 'd']]);
let sp = R.start({ plan: practice, all: cards, marks: () => [], deps: [], now: T0, seed: 'cwicz' });
check('practice: all open at the start', R.lessonProgress(sp, T0), { done: 0, total: 2, held: 0 });
t = T0;
const asked = [];
guard = 0;
while (sp.current !== null && guard < 30) {
  guard += 1;
  t += 10_000;
  asked.push(sp.current);
  /* „b": falsch, dann zweimal richtig nötig (nach einem Fehler beginnt sie unten). */
  const right = !(sp.current === 'b' && asked.filter((k) => k === 'b').length === 1);
  sp = R.answer(sp, right ? 1 : 0, t).session;
}
check('practice: b wrong once needs two right answers, d once', asked, ['b', 'd', 'b', 'b']);
check('practice: done at the end', R.lessonProgress(sp, t), { done: 2, total: 2, held: 0 });
/* Was richtig war, aber nur teilweise (eine Podpowiedź: 0,75), bleibt — „richtig" heisst hier ganz richtig. */
let sh = R.start({ plan: R.practicePlan([cards[0]]), all: cards, marks: () => [], deps: [], now: T0, seed: 'h' });
sh = R.answer(sh, 0.75, T0 + 1000).session;
check('practice: a hinted (partial) answer keeps the card', [sh.current, R.lessonProgress(sh, T0 + 1000)], ['a', { done: 0, total: 1, held: 0 }]);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
