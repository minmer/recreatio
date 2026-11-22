/**
 * 2026-11-22 (Part B, class) — DIE STUNDE UND DIE ZADANIA, rein gerechnet (`cogita/lesson/lessonTally.ts`), ohne Browser:
 *   1. die Verteilung einer Frage: je Möglichkeit, die letzte Stimme zählt, die benannten Fehler (tags), der Anteil;
 *   2. die Antwort der Klasse: die häufigste Möglichkeit; getippt richtig nur mit Mehrheit (sonst der häufigste Fehler);
 *   3. der Hinweis für den Leiter (70 % / 30 %, einstellbar, auch in Prozent gegeben);
 *   4. Wahl und Kapitel: die meisten Stimmen, Gleichstand → die erste, geschlossene Möglichkeiten zählen nicht, die Reihenfolge;
 *   5. die Antwort der Klasse führt die Erzählung wie die eines Lernenden (`wrong:<tag>` aus ihrem Fehler, `answerStep`);
 *   6. Zadania: erledigt aus dem Fortschritt (Turm, Erzählung, Wiederholung), nach der Frist „late", die Reihenfolge der Liste;
 *   7. die Einstellungen (config) einer Stunde und einer Zadanie gelesen — Unlesbares fällt weg.
 *
 *   node scripts/app-lesson-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-lesson-'));
const entries = { lt: 'src/app/cogita/lesson/lessonTally.ts', flow: 'src/app/cogita/flow.ts', ad: 'src/app/cogita/adaptive.ts', cards: 'src/app/cogita/cards.ts', ck: 'src/app/cogita/check.ts' };
await build({
  entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [LT, FL, AD, CD, CK] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const card = (answer, extra = {}) => ({ question: 'q1', direction: '', key: 'k1', prompt: [{ text: '?' }], answer, explain: [], fingerprint: 'f1', ...extra });
const one = card({ form: 'one', options: ['3', '4', '5'], correct: 1 });
const data = { options: ['3', '4', '5'], correct: 1, tags: ['zu-wenig', '', 'zu-viel'] };
const vote = (participant, given, at) => ({ participant, given, at });

/* -- 1. Die Verteilung ------------------------------------------------------------------------------------------------ */
{
  const votes = [vote('a', 0, 1), vote('b', 1, 2), vote('c', 2, 3), vote('a', 1, 4), vote('d', 1, 5), vote('e', 0, 6)];
  const t = LT.tallyQuestion(one, votes, data);
  check('tally: the last vote of each participant counts (a changed 0 → 1)', [t.votes, t.correct, t.bars.map((b) => b.count)], [5, 3, [1, 3, 1]]);
  check('tally: the right option is marked, each wrong one carries its named error', t.bars.map((b) => [b.correct, b.tag ?? null]), [[false, 'zu-wenig'], [true, null], [false, 'zu-viel']]);
  check('tally: the errors in the class, most frequent first', t.tags, [{ tag: 'zu-viel', count: 1 }, { tag: 'zu-wenig', count: 1 }]);
  check('tally: share of correct votes', Math.round(t.share * 100), 60);
  check('tally: no votes — no share, no class answer', [LT.tallyQuestion(one, [], data).share, LT.tallyQuestion(one, [], data).answer], [0, null]);
  const tf = LT.tallyQuestion(card({ form: 'truefalse', value: false }), [vote('a', true, 1), vote('b', false, 2), vote('c', false, 3)]);
  check('tally: true/false as two bars', tf.bars.map((b) => [b.key, b.count, b.correct]), [['true', 1, false], ['false', 2, true]]);
  const many = card({ form: 'many', options: ['a', 'b', 'c'], correct: [0, 2] });
  const tm = LT.tallyQuestion(many, [vote('a', [0, 2], 1), vote('b', [0], 2), vote('c', [0, 1], 3)], { options: ['a', 'b', 'c'], correct: [0, 2], tags: ['', 'b-gehort-nicht', ''] });
  check('tally: many — each option counted wherever it was chosen', tm.bars.map((b) => b.count), [3, 1, 1]);
}

/* -- 2. Die Antwort der Klasse ---------------------------------------------------------------------------------------- */
{
  check('class answer: the most frequent option (here a wrong one)', LT.classAnswer(one, [vote('a', 0, 1), vote('b', 0, 2), vote('c', 1, 3)]), { given: 0, correct: false });
  check('class answer: a tie goes to the answer given first', LT.classAnswer(one, [vote('a', 2, 1), vote('b', 1, 2)]), { given: 2, correct: false });
  const typed = card({ form: 'text', accepted: ['Warszawa'], rule: CK.TEXT_RULE });
  check('class answer: typed — right when most typed a right one', LT.classAnswer(typed, [vote('a', 'Warszawa', 1), vote('b', 'warszawa', 2), vote('c', 'Kraków', 3)]).correct, true);
  check('class answer: typed — without a majority the most frequent wrong answer stands', LT.classAnswer(typed, [vote('a', 'Warszawa', 1), vote('b', 'Kraków', 2), vote('c', 'Kraków', 3), vote('d', 'Gdańsk', 4)]), { given: 'Kraków', correct: false });
  const tt = LT.tallyQuestion(typed, [vote('a', 'Warszawa', 1), vote('b', ' warszawa ', 2), vote('c', 'Kraków', 3)]);
  check('tally: typed answers grouped (case and spaces do not split them)', tt.bars.map((b) => [b.count, b.correct]), [[2, true], [1, false]]);
}

/* -- 3. Der Hinweis ---------------------------------------------------------------------------------------------------- */
{
  check('advice: ≥ 70 % move on, 30–70 % discuss, < 30 % back', [LT.adviceOf(0.8), LT.adviceOf(0.7), LT.adviceOf(0.5), LT.adviceOf(0.3), LT.adviceOf(0.29)], ['move-on', 'move-on', 'discuss', 'discuss', 'back']);
  check('advice: thresholds are adjustable (also given in percent)', [LT.adviceOf(0.75, LT.readThresholds({ high: 80, low: 40 })), LT.readThresholds({ high: 0.5, low: 0.9 })], ['discuss', { high: 0.5, low: 0.5 }]);
  check('advice: unreadable thresholds fall back to 70 / 30', LT.readThresholds('x'), { high: 0.7, low: 0.3 });
}

/* -- 4. Wahl und Kapitel ------------------------------------------------------------------------------------------------- */
{
  const p = LT.tallyPoll(3, [vote('a', 2, 1), vote('b', 0, 2), vote('c', 2, 3), vote('d', 1, 4), vote('a', 0, 5)]);
  check('poll: the most votes win; a tie goes to the first option', [p.counts, p.winner, p.order], [[2, 1, 1], 0, [0, 1, 2]]);
  check('poll: votes outside the options are ignored', LT.tallyPoll(2, [vote('a', 5, 1), vote('b', 'x', 2), vote('c', 1, 3)]).counts, [0, 1]);
  check('poll: closed options (chapters done) never win', LT.tallyPoll(3, [vote('a', 0, 1), vote('b', 0, 2), vote('c', 2, 3)], [1, 2]).winner, 2);
  check('poll: no votes — no winner', LT.tallyPoll(2, []).winner, null);
}

/* -- 5. Die Antwort der Klasse führt die Erzählung --------------------------------------------------------------------- */
{
  const f = FL.readFlow('F', {
    name: 'F', start: 'q',
    graph: {
      nodes: [['q', 'question', { of: 'Q' }], ['ok', 'show'], ['more', 'show'], ['less', 'show'], ['z', 'end']].map(([id, type, config = {}], i) => ({ id, type, x: i, y: 0, config })),
      edges: [['q', 'right', 'ok'], ['q', 'wrong:zu-viel', 'more'], ['q', 'wrong', 'less'], ['ok', 'next', 'z'], ['more', 'next', 'z'], ['less', 'next', 'z']].map(([from, out, to], i) => ({ id: `e${i}`, from, out, to, in: 'in' }))
    }
  });
  const ctx = { facts: (s) => ({ values: s.values, knowness: () => 0, answered: () => null, visited: new Set(s.visited), now: new Date(0), session: FL.sessionOf(s) }), flows: () => f, members: () => [] };
  const step = (votes) => {
    const ans = LT.classAnswer(one, votes);
    const outcome = CD.checkCard(one, ans.given);
    const sig = AD.answerSignals(one, data, ans.given, outcome);
    const s = FL.answerStep(f, FL.startFlow(f), { score: outcome.correctness, correct: outcome.correct, tags: sig.tags, picks: sig.picks }, ctx);
    return s.step;
  };
  check('flow: the class answers right — the right way', step([vote('a', 1, 1), vote('b', 1, 2), vote('c', 2, 3)]), 'ok');
  check('flow: the class answers with the named error — its way (wrong:<tag>)', step([vote('a', 2, 1), vote('b', 2, 2), vote('c', 1, 3)]), 'more');
  check('flow: a wrong answer without its own way — the plain wrong way', step([vote('a', 0, 1), vote('b', 0, 2)]), 'less');
}

/* -- 6. Zadania ---------------------------------------------------------------------------------------------------------- */
{
  const facts = {
    conquered: (t) => t === 'T1', flowDone: (f) => f === 'F1', due: (t) => (t === 'T2' ? 2 : 0),
    answeredSince: (t, at) => t === 'T3' && at <= 100
  };
  const st = (kind, id, until = null, at = 50, now = 1000) => LT.assignmentState({ kind, id }, facts, { at, until }, now);
  check('assignment: a tower ticks off when conquered', [st('tower', 'T1'), st('tower', 'T9')], ['done', 'open']);
  check('assignment: a story ticks off when it ended', [st('trail', 'F1'), st('trail', 'F2')], ['done', 'open']);
  check('assignment: a review ticks off when learned since and nothing is due', [st('review', 'T3'), st('review', 'T3', null, 200), st('review', 'T2')], ['done', 'open', 'open']);
  check('assignment: open after the deadline is late; done stays done', [st('tower', 'T9', 900), st('tower', 'T1', 900), st('tower', 'T9', 2000)], ['late', 'done', 'open']);
  const sorted = LT.sortAssignments([{ id: 'a', state: 'done', until: 1 }, { id: 'b', state: 'open', until: 50 }, { id: 'c', state: 'late', until: 10 }, { id: 'd', state: 'open', until: 20 }, { id: 'e', state: 'open', until: null }]);
  check('assignment: late first, then open by deadline, then done', sorted.map((x) => x.id), ['c', 'd', 'b', 'e', 'a']);
}

/* -- 7. Die Einstellungen ---------------------------------------------------------------------------------------------- */
{
  const c = LT.readLessonConfig({ title: 'Ułamki', parts: [{ flow: 'f1' }, { flow: 'f2', start: { step: 's1', exit: 'o1' } }, { flow: '' }, 7], showVotes: 'live', thresholds: { high: 0.8 } });
  check('lesson config: stories in order with their start; broken ones dropped', [c.title, c.parts, c.showVotes, c.thresholds], ['Ułamki', [{ flow: 'f1' }, { flow: 'f2', start: { step: 's1', exit: 'o1' } }], 'live', { high: 0.8, low: 0.3 }]);
  check('lesson config: without a story it is no lesson; an unknown setting means "after"', [LT.readLessonConfig({ parts: [] }), LT.readLessonConfig({ parts: [{ flow: 'x' }], showVotes: 'x' }).showVotes], [null, 'after']);
  check('assignment config: target, name and time read; an unknown kind refused', [LT.readAssignConfig({ title: 'T', target: { kind: 'review', id: 'p1' }, name: 'Wieża', at: 5 }), LT.readAssignConfig({ target: { kind: 'test', id: 'p' } })],
    [{ title: 'T', target: { kind: 'review', id: 'p1' }, name: 'Wieża', at: 5 }, null]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
