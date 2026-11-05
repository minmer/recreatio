/**
 * 2026-11-02 — NAGRODY (`cogita/rewards.ts`) UND DER LIVE-WEG ZWISCHEN LERNENDEN (`cogita/learn.ts`), nachgemessen.
 *
 *   1. Punkte je Antwort: gut, halb, falsch, „nowa karta" einmal je Karte; mitgezählte Paare (`lead`) ohne Punkte für
 *      die Antwort, aber als Karten für das Tagesziel und als utrwalone Karten.
 *   2. Utrwalona erst, wenn der Abstand bis zur nächsten Wiederholung mindestens `known.days` Tage ist.
 *   3. Gute Antworten hintereinander: alle N ein Bonus; eine falsche und eine Pause über 30 min fangen neu an.
 *   4. „Szybko" nur gut UND schnell genug.
 *   5. Das Tagesziel in jeder Einheit (Karten, Antworten, Punkte ohne Ziel- und Serienbonus, Minuten mit Deckel), einmal je Tag.
 *   6. Die Serie: Ziel oder irgendeine Antwort, verziehene Tage, der wachsende Bonus mit Deckel, lebt / gefährdet / vorbei.
 *   7. Stufen (kein Ereignis für die erste ab 0), Abzeichen je Mass, Punkte eines Abzeichens bringen weitere.
 *   8. Feste Kennungen: zweimal gerechnet dasselbe; eine neue Antwort → genau die neuen Ereignisse.
 *   9. Nur die Karten eines Ortes (`keys`), zusammengeführte Einträge (`rename`).
 *  10. Die Regel aus dem Dokument: duldsam, begrenzt, sortiert, eindeutige Abzeichen; hin und zurück; welche gilt.
 *  11. Die letzten Tage und die Linie von heute.
 *  12. Zwei Lernende derselben Person in derselben Baza hören einander (nur aufnehmen, nicht senden); andere nicht.
 *
 * 2026-11-05 (Prompt 17) — „Odznaki i poziomy":
 *  13. Arten der Abzeichen (genannt und aus dem Mass), die neuen Masse, `kind` gelesen und geschrieben, die Rahmen der Stufen.
 *  14. Die Abzeichen der Karte mit `extra` und `awarded`: wann, wo in den Ereignissen, Summen, ungemessen, die Lehrerin.
 *  15. `cleanDays`: überfällig gestern beendet die Reihe, die erste Antwort, jetzt überfällig, Zeitumstellung, höchstens 60.
 *  16. Die gemerkten Daten (`withAwards` behält das früheste), `Learner.keepAwards`, `keepValues` lässt sie stehen.
 *
 * 2026-11-05 (Odznaki) — Kategorien mit Stufen aus Stoffen:
 *  17. Die eingebaute Regel: 5 Kategorien × 5 Stufen, Holz → Diamant nach der Schwelle; Stand und nächste Stufe je Kategorie;
 *      `tier` gelesen, begrenzt, geschrieben; Leitern mit einer, sieben Stufen, zwei Massen; `materialsOf`.
 *
 *   node scripts/app-rewards-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-rewards-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}cogita/rewards';
export { Learner, absorb, EMPTY_PROGRESS } from '${app}cogita/learn';
export { dayStart, dayAdd } from '${app}cogita/lessons';
export { step } from '${app}cogita/knowness';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});
globalThis.BroadcastChannel = undefined;
const R = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const MIN = 60_000;
const HOUR = 60 * MIN;
/* Ortszeit — `dayStart` rechnet in ihr; Oktober 2026 enthält die Zeitumstellung (25.10.). */
const at = (d, h = 10, m = 0) => new Date(2026, 9, d, h, m).getTime();
const day = (d) => R.dayStart(at(d));
let seq = 0;
const A = (key, t, correctness, extra = {}) => ({ id: `x${String(seq += 1).padStart(4, '0')}`, key, at: t, correctness, ...extra });
const rules = (patch) => R.readRewards({
  points: { correct: 10, partial: 6, wrong: 1, first: 5, known: 20, fast: 0, combo: 0, goal: 0, streak: 0, ...(patch.points ?? {}) },
  goal: { amount: 1000, unit: 'cards', ...(patch.goal ?? {}) },
  streak: { counts: 'goal', grace: 0, max: 10, ...(patch.streak ?? {}) },
  known: { days: 1, ...(patch.known ?? {}) },
  fast: { seconds: 8, ...(patch.fast ?? {}) },
  combo: { every: 1000, ...(patch.combo ?? {}) },
  levels: patch.levels ?? [],
  badges: patch.badges ?? []
});
const kinds = (s) => s.events.map((e) => `${e.kind}:${e.points}`);
const ofKind = (s, k) => s.events.filter((e) => e.kind === k);
const FAR = at(30, 12);

try {
  /* ── 1. Punkte je Antwort ─────────────────────────────────────────────────── */
  {
    const r = rules({});
    const a1 = A('q1', at(20, 10), 1);
    const a2 = A('q1', at(20, 10, 1), 0.5);
    const a3 = A('q2', at(20, 10, 2), 0);
    const a4 = A('q3', at(20, 10, 2), 1, { lead: a3.id });
    const s = R.rewardState([a4, a2, a1, a3], r, at(20, 12));
    check('1 events: good +10 and new card +5, half round(6×0.5), wrong +1 and new card; the evidence pair earns nothing for itself', kinds(s), ['answer:10', 'first:5', 'answer:3', 'answer:1', 'first:5']);
    check('1 total and running totals', [s.total, s.events.map((e) => e.total)], [24, [10, 15, 18, 19, 24]]);
    check('1 answer event carries its correctness and card', [s.events[2].value, s.events[2].card, s.events[2].id], [0.5, 'q1', `a:${a2.id}`]);
    check('1 the evidence pair counts as a card of the day, not as an answer', [s.today.cards, s.today.answers, s.today.correct, s.measures.cards, s.measures.answers], [3, 3, 1, 3, 3]);
    const g = R.rewardState([a1, a3, a4], rules({ goal: { amount: 3, unit: 'cards' }, points: { goal: 50 } }), at(20, 12));
    const goal = ofKind(g, 'goal');
    check('1 a goal in cards is met by the evidence pair (at its time)', [goal.length, goal[0]?.at, goal[0]?.id, goal[0]?.points, g.goalNow, g.today.met], [1, a4.at, `g:${day(20)}`, 50, 3, true]);
    /* Ein Paar, das nur mitgezählt wird, wird trotzdem utrwalona. */
    const e1 = A('pair', at(20, 8), 1, { lead: 'other-1' });
    const e2 = A('pair', at(20, 17), 1, { lead: 'other-2' });
    const k = R.rewardState([e1, e2], rules({}), at(20, 18));
    check('1 evidence pairs alone: no answer/first points, but the card becomes known', kinds(k), ['known:20']);
    const later = R.rewardState([e1, A('pair', at(20, 17, 30), 1)], rules({}), at(20, 18));
    check('1 a card first seen as an evidence pair gets no „nowa karta" when asked directly', ofKind(later, 'first').length, 0);
  }

  /* ── 2. Utrwalona ─────────────────────────────────────────────────────────── */
  {
    const r = rules({});
    const one = A('k', at(21, 8), 1);
    check('2 one right answer is not yet known (interval 15 min)', [ofKind(R.rewardState([one], r, at(21, 9)), 'known').length, R.step(null, { at: one.at, correctness: 1 }).interval], [0, 15 * MIN]);
    const soon = A('k', at(21, 9), 1);
    check('2 right again after 1 h: interval 3 h — not known', ofKind(R.rewardState([one, soon], r, at(21, 10)), 'known').length, 0);
    const nine = A('k', at(21, 17), 1);
    const s = R.rewardState([one, nine], r, at(21, 18));
    const known = ofKind(s, 'known');
    check('2 right again after 9 h: interval 27 h ≥ 1 day → known, once, at that answer', [known.length, known[0]?.id, known[0]?.at, known[0]?.points, s.measures.known], [1, 'k:k', nine.at, 20, 1]);
    const again = R.rewardState([one, nine, A('k', at(23, 10), 1), A('k', at(24, 10), 0), A('k', at(28, 10), 1)], r, at(28, 12));
    check('2 the known bonus comes only once per card, even after a lapse', ofKind(again, 'known').length, 1);
    const wrong = R.rewardState([one, A('k', at(21, 17), 0.5)], r, at(21, 18));
    check('2 a partial answer never makes a card known', ofKind(wrong, 'known').length, 0);
    check('2 two days needed: 27 h is not enough', ofKind(R.rewardState([one, nine], rules({ known: { days: 2 } }), at(21, 18)), 'known').length, 0);
  }

  /* ── 3. Gute Antworten hintereinander ─────────────────────────────────────── */
  {
    const r = rules({ combo: { every: 3 }, points: { combo: 15, first: 0 } });
    const t = (i) => at(22, 10, i);
    const list = [1, 1, 1, 1, 1, 1, 0, 1, 1, 1].map((c, i) => A(`c${i}`, t(i), c));
    const s = R.rewardState(list, r, t(10));
    const combos = ofKind(s, 'combo');
    check('3 combo every 3: after 3, after 6, then reset by the wrong one and again after 3', [combos.map((e) => e.value), combos.map((e) => e.id)], [[3, 6, 3], [`c:${list[2].id}`, `c:${list[5].id}`, `c:${list[9].id}`]]);
    check('3 combo points and the best run as a measure; combo now', [combos.map((e) => e.points), s.measures.combo, s.combo], [[15, 15, 15], 6, 3]);
    const gap = [A('g0', at(22, 14, 0), 1), A('g1', at(22, 14, 1), 1), A('g2', at(22, 14, 32), 1), A('g3', at(22, 14, 33), 1), A('g4', at(22, 14, 34), 1)];
    const p = R.rewardState(gap, r, at(22, 14, 35));
    check('3 a pause over 30 min starts a new run (no combo at the 3rd, combo at the 5th)', ofKind(p, 'combo').map((e) => e.id), [`c:${gap[4].id}`]);
    check('3 combo now is 0 after a pause over 30 min', R.rewardState(gap, r, at(22, 15, 10)).combo, 0);
    check('3 evidence pairs do not count for the run', ofKind(R.rewardState([A('e0', t(0), 1), A('e1', t(1), 1, { lead: 'x' }), A('e2', t(2), 1)], r, t(3)), 'combo').length, 0);
  }

  /* ── 4. Szybko ──────────────────────────────────────────────────────────────── */
  {
    const r = rules({ points: { fast: 4, first: 0 }, fast: { seconds: 8 } });
    const fast = A('f1', at(23, 9), 1, { ms: 5000 });
    const edge = A('f2', at(23, 9, 1), 1, { ms: 8000 });
    const slow = A('f3', at(23, 9, 2), 1, { ms: 9000 });
    const wrongFast = A('f4', at(23, 9, 3), 0, { ms: 1000 });
    const none = A('f5', at(23, 9, 4), 1);
    const half = A('f6', at(23, 9, 5), 0.5, { ms: 1000 });
    const s = R.rewardState([fast, edge, slow, wrongFast, none, half], r, at(23, 10));
    check('4 fast only for right answers within the limit (8 s counts)', ofKind(s, 'fast').map((e) => e.id), [`s:${fast.id}`, `s:${edge.id}`]);
    check('4 no fast events when the points are 0', ofKind(R.rewardState([fast], rules({}), at(23, 10)), 'fast').length, 0);
  }

  /* ── 5. Das Tagesziel ──────────────────────────────────────────────────────── */
  {
    const ans = R.rewardState([A('u1', at(24, 9), 1), A('u1', at(24, 9, 1), 0), A('u2', at(24, 9, 2), 1, { lead: 'z' }), A('u3', at(24, 9, 3), 1)],
      rules({ goal: { amount: 3, unit: 'answers' }, points: { goal: 7 } }), at(24, 12));
    const g = ofKind(ans, 'goal');
    check('5 answers: the 3rd own answer meets it (evidence not counted)', [g.length, g[0]?.at, g[0]?.points, g[0]?.value, ans.goalNow], [1, at(24, 9, 3), 7, 3, 3]);

    const pr = rules({ goal: { amount: 15, unit: 'points' }, points: { first: 0, goal: 50, streak: 7 }, streak: { counts: 'any' } });
    const p1 = A('p1', at(24, 10), 1);
    const p2 = A('p2', at(24, 10, 1), 1);
    const ps = R.rewardState([p1, p2], pr, at(24, 12));
    check('5 points: goal and streak bonuses do not count towards it — met at the 2nd answer', ofKind(ps, 'goal').map((e) => e.at), [p2.at]);
    check('5 points: the day keeps only answer points; the total has all', [ps.today.points, ps.goalNow, ps.total], [20, 20, 20 + 7 + 50]);

    const mr = rules({ goal: { amount: 10, unit: 'minutes' }, points: { goal: 1 } });
    const m1 = A('m1', at(24, 11), 1, { ms: 4 * MIN });
    const m2 = A('m2', at(24, 11, 10), 1, { ms: 10 * MIN });
    const m3 = A('m3', at(24, 11, 11), 1, { ms: MIN });
    check('5 minutes: one answer counts at most 5 min — not met after 4+10', ofKind(R.rewardState([m1, m2], mr, at(24, 12)), 'goal').length, 0);
    const ms = R.rewardState([m1, m2, m3], mr, at(24, 12));
    check('5 minutes: met with 4+5+1', [ofKind(ms, 'goal').map((e) => e.at), ms.today.minutes, ms.goalNow], [[m3.at], 10, 10]);

    const cr = rules({ goal: { amount: 2, unit: 'cards' }, points: { goal: 5 } });
    const two = [A('c1', at(24, 9), 1), A('c2', at(24, 9, 1), 1), A('c3', at(24, 9, 2), 1), A('c1', at(25, 9), 1), A('c1', at(25, 9, 1), 1), A('c2', at(25, 9, 2), 1)];
    const cs = R.rewardState(two, cr, at(25, 12));
    check('5 cards: once per day, with the day in its id; the same card twice is one card', ofKind(cs, 'goal').map((e) => [e.id, e.at]), [[`g:${day(24)}`, at(24, 9, 1)], [`g:${day(25)}`, at(25, 9, 2)]]);
    check('5 goals as a measure; days met', [cs.measures.goals, [...cs.days.values()].map((d) => d.met)], [2, [true, true]]);
  }

  /* ── 6. Die Serie ──────────────────────────────────────────────────────────── */
  {
    const r = rules({ streak: { counts: 'any', grace: 0, max: 3 }, points: { streak: 5, correct: 0, partial: 0, wrong: 0, first: 0, known: 0 } });
    /* 24.–27.10.: über die Zeitumstellung am 25.10. hinweg. */
    const days4 = [24, 25, 26, 27].map((d) => A('s', at(d, 9), 1));
    const s = R.rewardState(days4, r, at(27, 12));
    const st = ofKind(s, 'streak');
    check('6 any answer makes a day: 1,2,3,4 — bonus 5×min(n,3), ids per day (across the DST change)', [st.map((e) => e.value), st.map((e) => e.points), st.map((e) => e.id)], [[1, 2, 3, 4], [5, 10, 15, 15], [24, 25, 26, 27].map((d) => `d:${day(d)}`)]);
    check('6 today counted: alive, not at risk', [s.streak, s.streakToday, s.atRisk, s.best], [4, true, false, 4]);
    const next = R.rewardState(days4, r, at(28, 12));
    check('6 next day before learning: still alive, at risk', [next.streak, next.streakToday, next.atRisk, next.best], [4, false, true, 4]);
    const gone = R.rewardState(days4, r, at(29, 12));
    check('6 two days later, grace 0: gone (best stays)', [gone.streak, gone.atRisk, gone.best, gone.measures.streak], [0, false, 4, 0]);
    const gap = [A('s', at(24, 9), 1), A('s', at(26, 9), 1)];
    check('6 a missed day breaks it with grace 0', ofKind(R.rewardState(gap, r, at(26, 12)), 'streak').map((e) => e.value), [1, 1]);
    const r1 = rules({ streak: { counts: 'any', grace: 1, max: 3 }, points: { streak: 5 } });
    const g1 = R.rewardState(gap, r1, at(26, 12));
    check('6 grace 1 forgives one missed day (it does not count itself)', [ofKind(g1, 'streak').map((e) => e.value), g1.streak], [[1, 2], 2]);
    check('6 grace 1: alive two days after the last day, gone after three', [R.rewardState(gap, r1, at(28, 12)).streak, R.rewardState(gap, r1, at(29, 12)).streak], [2, 0]);
    const rg = rules({ streak: { counts: 'goal' }, goal: { amount: 2, unit: 'answers' }, points: { streak: 3 } });
    const goalDays = [A('a', at(24, 9), 1), A('b', at(25, 9), 1), A('c', at(25, 9, 5), 1), A('d', at(26, 9), 1), A('e', at(26, 9, 5), 0)];
    const sg = R.rewardState(goalDays, rg, at(26, 12));
    check('6 counts goal: a day without the goal is no day of the streak; it counts at the answer that meets it', ofKind(sg, 'streak').map((e) => [e.value, e.at]), [[1, at(25, 9, 5)], [2, at(26, 9, 5)]]);
    check('6 counts goal: counted days', [...sg.days.values()].map((d) => d.counted), [false, true, true]);
    const notYet = R.rewardState(goalDays.slice(0, 4), rg, at(26, 12));
    check('6 counts goal: today begun but not met — at risk', [notYet.streak, notYet.streakToday, notYet.atRisk], [1, false, true]);
  }

  /* ── 7. Stufen und Abzeichen ──────────────────────────────────────────────────── */
  {
    const levels = [{ at: 0, name: 'A' }, { at: 20, name: 'B' }, { at: 50, name: 'C' }];
    const r = rules({ levels, points: { first: 0, wrong: 0, partial: 0 } });
    const list = [0, 1, 2, 3, 4].map((i) => A(`l${i}`, at(26, 15, i), 1));
    const s = R.rewardState(list, r, at(26, 16));
    const lv = ofKind(s, 'level');
    check('7 level events only above the first: B at the 2nd answer, C at the 5th', [lv.map((e) => e.id), lv.map((e) => e.value), lv.map((e) => e.at)], [['l:1', 'l:2'], [2, 3], [list[1].at, list[4].at]]);
    check('7 the level now', [s.level.index, s.level.name, s.level.next, s.level.share, s.measures.level], [2, 'C', null, 1, 3]);
    check('7 levelAt between levels', R.levelAt(levels, 35), { index: 1, name: 'B', at: 20, next: { at: 50, name: 'C' }, share: 0.5 });
    check('7 levelAt without levels / below the first', [R.levelAt([], 100), R.levelAt([{ at: 10, name: 'X' }], 4)], [
      { index: -1, name: null, at: 0, next: null, share: 1 },
      { index: -1, name: null, at: 0, next: { at: 10, name: 'X' }, share: 0.4 }
    ]);

    const chain = rules({
      levels, points: { first: 0 },
      badges: [
        { id: 'pierwsza', name: 'Pierwsza', measure: 'answers', atLeast: 1, points: 15 },
        { id: 'poziom-2', name: 'Poziom 2', measure: 'level', atLeast: 2 }
      ]
    });
    const c = R.rewardState([A('b1', at(26, 18), 1)], chain, at(26, 19));
    check('7 a badge with points brings a level, the level brings the next badge (settle loop)', c.events.map((e) => e.id.replace(/x\d+/, '_')), ['a:_', 'b:pierwsza', 'l:1', 'b:poziom-2']);
    check('7 badge list: both earned, at the answer', c.badges.map((x) => [x.badge.id, x.at !== null]), [['pierwsza', true], ['poziom-2', true]]);

    const many = rules({
      points: { first: 0, known: 0, combo: 0, goal: 0, streak: 0, wrong: 0 },
      combo: { every: 1000 }, goal: { amount: 2, unit: 'answers' }, streak: { counts: 'any' },
      badges: [
        { id: 'pkt', name: 'Pkt', measure: 'points', atLeast: 30 },
        { id: 'combo', name: 'Combo', measure: 'combo', atLeast: 3 },
        { id: 'known', name: 'Known', measure: 'known', atLeast: 1 },
        { id: 'goals', name: 'Goals', measure: 'goals', atLeast: 2 },
        { id: 'streak', name: 'Streak', measure: 'streak', atLeast: 2 },
        { id: 'cards', name: 'Cards', measure: 'cards', atLeast: 3 },
        { id: 'never', name: 'Never', measure: 'best', atLeast: 9 }
      ]
    });
    const m = [A('m1', at(25, 8), 1), A('m2', at(25, 8, 1), 1), A('m3', at(25, 8, 2), 1), A('m1', at(25, 18), 1), A('m4', at(26, 8), 0), A('m4', at(26, 8, 1), 0)];
    const ms = R.rewardState(m, many, at(26, 9));
    const when = Object.fromEntries(ms.badges.map((x) => [x.badge.id, x.at]));
    check('7 badges by measure: points, combo, known, goals, streak, cards — each at the answer that reached it', when, {
      pkt: m[2].at, combo: m[2].at, known: m[3].at, goals: m[5].at, streak: m[4].at, cards: m[2].at, never: null
    });
    check('7 an unearned badge reports its current value', ms.badges.find((x) => x.badge.id === 'never').value, 2);
  }

  /* ── 8. Feste Kennungen ───────────────────────────────────────────────────────── */
  {
    const r = R.DEFAULT_REWARDS;
    const list = [A('i1', at(27, 9), 1, { ms: 3000 }), A('i2', at(27, 9, 1), 1), A('i1', at(27, 18), 1), A('i3', at(28, 9), 0.6)];
    const one = R.rewardState(list, r, at(28, 12));
    const two = R.rewardState([...list].reverse(), r, at(28, 12));
    check('8 same answers in any order → the same events', two.events, one.events);
    check('8 ids are unique', new Set(one.events.map((e) => e.id)).size, one.events.length);
    const known = new Set(one.events.map((e) => e.id));
    check('8 nothing new without a new answer', R.freshEvents(known, R.rewardState(list, r, at(28, 13))).length, 0);
    const extra = A('i4', at(28, 12, 30), 1);
    const more = R.rewardState([...list, extra], r, at(28, 13));
    const fresh = R.freshEvents(known, more);
    check('8 one new answer → exactly its events (answer, new card)', fresh.map((e) => e.id), [`a:${extra.id}`, `f:${extra.id}`]);
    check('8 the old events keep their ids and totals', more.events.slice(0, one.events.length), one.events);
  }

  /* ── 9. Nur diese Karten, zusammengeführte Einträge ──────────────────────────── */
  {
    const r = rules({});
    const list = [A('q1', at(28, 9), 1), A('q2', at(28, 9, 1), 1), A('q-old', at(28, 9, 2), 1)];
    const only = R.rewardState(list, r, at(28, 12), { keys: new Set(['q1']) });
    check('9 keys: only the answers on these cards', [only.total, only.measures.answers, only.events.map((e) => e.card)], [15, 1, ['q1', 'q1']]);
    const rename = (k) => (k === 'q-old' ? 'q1' : k);
    const merged = R.rewardState(list, r, at(28, 12), { rename });
    check('9 rename: a merged card is one card — „nowa karta" once', [ofKind(merged, 'first').length, merged.measures.cards], [2, 2]);
    const both = R.rewardState(list, r, at(28, 12), { rename, keys: new Set(['q1']) });
    check('9 keys are matched after renaming', [both.measures.answers, ofKind(both, 'first').length], [2, 1]);
  }

  /* ── 10. Die Regel aus dem Dokument ──────────────────────────────────────────── */
  {
    check('10 junk → the default rule', [R.readRewards(null), R.readRewards('x'), R.readRewards([1])].map((x) => JSON.stringify(x)), Array(3).fill(JSON.stringify(R.DEFAULT_REWARDS)));
    const odd = R.readRewards({
      name: '  Moje  ',
      points: { correct: 99999, partial: -5, wrong: 'abc', first: '7', known: 2.6 },
      known: { days: 0 }, fast: { seconds: 9999 }, combo: { every: 1 },
      goal: { amount: 0, unit: 'bogus' }, streak: { counts: 'x', grace: 10, max: 0 }
    });
    check('10 numbers clamped, strings read, unknown values default', [odd.name, odd.points.correct, odd.points.partial, odd.points.wrong, odd.points.first, odd.points.known, odd.points.goal], ['Moje', 10000, 0, 1, 7, 3, 50]);
    check('10 limits of the parts', [odd.known.days, odd.fast.seconds, odd.combo.every, odd.goal, odd.streak], [0.01, 600, 2, { amount: 1, unit: 'cards' }, { counts: 'goal', grace: 6, max: 1 }]);
    const lv = R.readRewards({ levels: [{ at: 50, name: 'C' }, { at: 0, name: 'A' }, { at: 50, name: 'C2' }, { name: '' }, 'x', { at: 20, name: 'B' }] });
    check('10 levels sorted, without empty names, one per threshold', lv.levels, [{ at: 0, name: 'A' }, { at: 20, name: 'B' }, { at: 50, name: 'C' }]);
    check('10 levels: an empty list stays empty (no levels)', R.readRewards({ levels: [] }).levels, []);
    const bd = R.readRewards({
      badges: [
        { name: 'Złoty Łoś!', measure: 'points', atLeast: 5 },
        { name: 'Złoty Łoś!', measure: 'points', atLeast: 6 },
        { name: 'X', measure: 'nope' },
        { name: '', measure: 'points' },
        { id: 'own id', name: 'Y', measure: 'streak', atLeast: 0, icon: 'unknown', points: -3, says: ' Hej ' }
      ]
    });
    check('10 badges: ids slugged and unique, unknown measures and nameless dropped, values clamped', bd.badges, [
      { id: 'zloty-los', name: 'Złoty Łoś!', icon: 'star', measure: 'points', atLeast: 5, points: 0 },
      { id: 'zloty-los-2', name: 'Złoty Łoś!', icon: 'star', measure: 'points', atLeast: 6, points: 0 },
      { id: 'own-id', name: 'Y', icon: 'star', measure: 'streak', atLeast: 1, points: 0, says: 'Hej' }
    ]);
    const roundTrip = (x) => JSON.stringify(R.readRewards(R.rewardsData(x)));
    check('10 data → read round-trips (default, odd, badges)', [R.DEFAULT_REWARDS, odd, bd, lv].map(roundTrip), [R.DEFAULT_REWARDS, odd, bd, lv].map((x) => JSON.stringify(x)));
    check('10 every preset round-trips and is already a read rule', R.REWARD_PRESETS.map((p) => roundTrip(p.rules) === JSON.stringify(p.rules) && JSON.stringify(R.readRewards(p.rules)) === JSON.stringify(p.rules)), R.REWARD_PRESETS.map(() => true));
    check('10 presets have distinct ids', new Set(R.REWARD_PRESETS.map((p) => p.id)).size, R.REWARD_PRESETS.length);
    check('10 describeRewards says the goal', R.describeRewards(R.DEFAULT_REWARDS).includes('cel dnia: 20 różnych kart'), true);

    const docs = [{ id: 'd1', data: { name: 'One' } }, { id: 'd2', data: { name: 'Two' } }];
    const pick = (chosen, settings) => { const r = R.rewardsFor(docs, chosen, settings); return [r.id, r.rules.name]; };
    check('10 rewardsFor: chosen > settings > first doc', [pick('d2', 'd1'), pick('missing', 'd2'), pick('', null), pick(undefined, undefined), pick('missing', 'gone')],
      [['d2', 'Two'], ['d2', 'Two'], ['d1', 'One'], ['d1', 'One'], ['d1', 'One']]);
    const none = R.rewardsFor([], 'd1', 'd2');
    check('10 rewardsFor without docs: the built-in rule', [none.id, none.rules === R.DEFAULT_REWARDS], [null, true]);
  }

  /* ── 11. Die letzten Tage, die Linie von heute ─────────────────────────────────── */
  {
    const r = rules({});
    const list = [A('t1', at(25, 9), 1), A('t1', at(27, 9), 1), A('t2', at(27, 10), 1), A('t3', at(27, 11), 0)];
    const s = R.rewardState(list, r, at(27, 12));
    const last = R.lastDays(s, at(27, 12), 7);
    check('11 lastDays: 7 days, oldest first, today last, zero days filled', [last.length, last[6].day, last[0].day, last.map((d) => d.answers)], [7, day(27), day(21), [0, 0, 0, 0, 1, 0, 3]]);
    check('11 a zero day is complete', last[5], { day: day(26), points: 0, answers: 0, correct: 0, cards: 0, minutes: 0, met: false, counted: false });
    const line = R.todayLine(s, at(27, 12));
    check('11 todayLine: only today, events at the same time are one point (t1 again after 2 days: +10 and utrwalona +20)', line, [
      { at: at(27, 9), total: 30, points: 30 },
      { at: at(27, 10), total: 45, points: 15 },
      { at: at(27, 11), total: 51, points: 6 }
    ]);
    check('11 todayLine skips zero events', R.todayLine(R.rewardState([A('z', at(27, 9), 0)], rules({ points: { wrong: 0, first: 0 } }), at(27, 12)), at(27, 12)), []);
    check('11 eventText says what happened', [
      R.eventText({ id: 'x', kind: 'streak', at: 0, points: 0, total: 0, value: 5 }, r),
      R.eventText({ id: 'x', kind: 'answer', at: 0, points: 0, total: 0, value: 1 }, r),
      R.eventText({ id: 'x', kind: 'level', at: 0, points: 0, total: 0, value: 2 }, R.DEFAULT_REWARDS)
    ], ['seria: 5. dzień z rzędu', 'dobra odpowiedź', 'nowy poziom: Uczeń']);
  }

  /* ── 12. Zwei Lernende derselben Person hören einander ─────────────────────────── */
  {
    const card = (key) => ({ key, question: key, direction: '', fingerprint: `fp-${key}` });
    const a = new R.Learner('LIB', { kind: 'local', id: 'h1' }, null);
    const b = new R.Learner('LIB', { kind: 'local', id: 'h1' }, null);
    const other = new R.Learner('LIB', { kind: 'local', id: 'h2' }, null);
    const elsewhere = new R.Learner('LIB-2', { kind: 'local', id: 'h1' }, null);
    let heardB = 0;
    let heardOther = 0;
    const offA = a.subscribe(() => undefined);
    const offB = b.subscribe(() => { heardB += 1; });
    const offO = other.subscribe(() => { heardOther += 1; });
    const offE = elsewhere.subscribe(() => undefined);
    /* Eigene Zeiten (eine Sekunde auseinander): drei Antworten in derselben Millisekunde hätte die Rechnung nach ihren (zufälligen) Kennungen geordnet. */
    const t0 = Date.now();
    const { answer } = a.record(card('q1'), 1, { ms: 1200 }, t0);
    check('12 b hears a at once (same person, same base) and its listener fires', [b.progress.answers.get(answer.id)?.key, heardB > 0], ['q1', true]);
    check('12 b only takes it in — nothing to send from b', [b.fresh.length, a.fresh.length], [0, 1]);
    check('12 another person and another base do not hear it', [other.progress.answers.size, heardOther, elsewhere.progress.answers.size], [0, 0, 0]);
    check('12 b got the snapshot too (its knowness sees the answer)', b.marks('q1', 'fp-q1').length, 1);
    const before = heardB;
    b.hear([answer], []);
    check('12 hearing an answer it already has changes nothing', heardB, before);
    const { answer: back } = b.record(card('q2'), 0.5, {}, t0 + 1000);
    check('12 and the other way round', a.progress.answers.has(back.id), true);
    offB();
    const { answer: late } = a.record(card('q3'), 1, {}, t0 + 2000);
    check('12 after unsubscribing, b no longer hears', b.progress.answers.has(late.id), false);
    const { answer: led } = a.record(card('q4'), 1, { lead: answer.id }, t0 + 2500);
    check('12 lead is kept on the record', a.progress.answers.get(led.id)?.lead, answer.id);
    const absorbed = R.absorb(R.EMPTY_PROGRESS, { kind: 'answers', answers: [JSON.parse(JSON.stringify(led)), { ...JSON.parse(JSON.stringify(answer)), lead: '' }] });
    check('12 lead survives absorb/readAnswer (an empty lead is dropped)', [absorbed.answers.get(led.id)?.lead, 'lead' in absorbed.answers.get(answer.id)], [answer.id, false]);
    const fromLearner = R.rewardState(a.progress.answers.values(), rules({}), t0 + 5000);
    check('12 rewards read a learner\'s answers directly (q4 came with q1: no points of its own)', ofKind(fromLearner, 'answer').map((e) => e.card), ['q1', 'q2', 'q3']);
    offA(); offO(); offE();
  }

  /* ── 13. Arten der Abzeichen, die neuen Masse, die Rahmen ────────────────────────── */
  {
    /* 2026-11-05 (Odznaki) — fünf Kategorien zu fünf Stufen. */
    const want = {
      'trzy-dni': 'consistency', tydzien: 'consistency', 'dwa-tygodnie': 'consistency', miesiac: 'consistency', 'sto-dni': 'consistency',
      'piec-z-rzedu': 'accuracy', celny: 'accuracy', 'dwadziescia-piec-z-rzedu': 'accuracy', 'piecdziesiat-z-rzedu': 'accuracy', 'sto-z-rzedu': 'accuracy',
      'pierwsza-utrwalona': 'volume', 'utrwalone-25': 'volume', 'utrwalone-100': 'volume', 'utrwalone-500': 'volume', 'utrwalone-2000': 'volume',
      'pierwszy-cel': 'goals', 'cel-piec': 'goals', 'cele-20': 'goals', 'cele-50': 'goals', 'cele-150': 'goals',
      'mapa-10': 'exploration', 'cwierc-mapy': 'exploration', 'pol-mapy': 'exploration', 'trzy-czwarte-mapy': 'exploration', 'cala-mapa': 'exploration'
    };
    check('13 every default badge names its kind', Object.fromEntries(R.DEFAULT_REWARDS.badges.map((x) => [x.id, x.kind])), want);
    check('13 badgeKindOf of every default badge', Object.fromEntries(R.DEFAULT_REWARDS.badges.map((x) => [x.id, R.badgeKindOf(x)])), want);
    check('13 derived from the measure alone, the defaults keep their kinds', R.DEFAULT_REWARDS.badges.map((x) => R.badgeKindOf({ measure: x.measure, atLeast: x.atLeast })), R.DEFAULT_REWARDS.badges.map((x) => x.kind));
    const derive = [['answers', 1], ['answers', 10], ['answers', 11], ['known', 1], ['known', 2], ['cards', 1], ['cards', 50], ['points', 5], ['streak', 3], ['best', 9], ['days', 1],
      ['correct', 1], ['combo', 5], ['goals', 1], ['level', 3], ['regions', 1], ['map', 50], ['clean', 7]];
    /* 2026-11-05 (Odznaki) — nur aus dem Mass (eine Leiter bleibt eine Kategorie); „start" nur, wenn genannt. */
    check('13 derived kinds from the measure alone: counts are volume; streak/best/days, correct/combo, goals/level, the map', derive.map(([measure, atLeast]) => R.badgeKindOf({ measure, atLeast })), [
      'volume', 'volume', 'volume', 'volume', 'volume', 'volume', 'volume', 'volume', 'consistency', 'consistency', 'consistency',
      'accuracy', 'accuracy', 'goals', 'goals', 'exploration', 'exploration', 'exploration'
    ]);
    check('13 start only when named', R.badgeKindOf({ measure: 'answers', atLeast: 1, kind: 'start' }), 'start');
    check('13 an explicit kind wins over the measure', R.badgeKindOf({ measure: 'points', atLeast: 5, kind: 'exploration' }), 'exploration');
    check('13 the five map steps of the defaults', R.DEFAULT_REWARDS.badges.filter((x) => R.isExtraMeasure(x.measure)).map((x) => [x.id, x.measure, x.atLeast, x.points]), [
      ['mapa-10', 'map', 10, 0], ['cwierc-mapy', 'map', 25, 0], ['pol-mapy', 'map', 50, 0], ['trzy-czwarte-mapy', 'map', 75, 0], ['cala-mapa', 'map', 100, 0]
    ]);
    check('13 the new measures are measures with labels', ['regions', 'map', 'clean'].map((m) => R.REWARD_MEASURES.includes(m) && typeof R.MEASURE_LABEL[m] === 'string' && R.MEASURE_LABEL[m] !== ''), [true, true, true]);
    const k = R.readRewards({ badges: [
      { name: 'A', measure: 'map', atLeast: 50, kind: 'exploration' },
      { name: 'B', measure: 'points', atLeast: 5, kind: 'nope' },
      { name: 'C', measure: 'clean', atLeast: 3, kind: ' consistency ' },
      { name: 'D', measure: 'regions', atLeast: 2 }
    ] });
    check('13 readRewards reads the new measures and kind (unknown kinds dropped)', k.badges.map((x) => [x.id, x.measure, x.kind ?? null, R.badgeKindOf(x)]), [
      ['a', 'map', 'exploration', 'exploration'], ['b', 'points', null, 'volume'], ['c', 'clean', 'consistency', 'consistency'], ['d', 'regions', null, 'exploration']
    ]);
    check('13 rewardsData writes kind: the rule reads back unchanged', JSON.stringify(R.readRewards(R.rewardsData(k))), JSON.stringify(k));
    check('13 frames of the 8 default levels', R.DEFAULT_REWARDS.levels.map((_, i, all) => R.levelFrame(i, all.length)), [0, 1, 1, 2, 2, 3, 3, 4]);
    check('13 frames with few levels', [[0, 1], [1, 2], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4]].map(([i, n]) => R.levelFrame(i, n)), [0, 1, 1, 4, 1, 2, 4]);
  }

  /* ── 14. Die Abzeichen der Karte: extra und awarded ──────────────────────────────── */
  {
    /* 2026-11-05 (Odznaki) — die vier Abzeichen der Karte von vorher (alle drei Masse), hinter den übrigen eingebauten. */
    const r = R.readRewards({ ...R.rewardsData(R.DEFAULT_REWARDS), badges: [
      ...R.DEFAULT_REWARDS.badges.filter((x) => !R.isExtraMeasure(x.measure)),
      { id: 'pierwszy-obszar', name: 'Pierwszy obszar zdobyty', icon: 'rocket', measure: 'regions', atLeast: 1, points: 0, kind: 'exploration' },
      { id: 'pol-mapy', name: 'Pół mapy', icon: 'target', measure: 'map', atLeast: 50, points: 0, kind: 'exploration' },
      { id: 'cala-mapa', name: 'Cała mapa', icon: 'crown', measure: 'map', atLeast: 100, points: 0, kind: 'exploration' },
      { id: 'czysty-tydzien', name: 'Tydzień bez zaległości', icon: 'check', measure: 'clean', atLeast: 7, points: 0, kind: 'exploration' }
    ] });
    const list = [A('e1', at(10, 9), 1), A('e2', at(10, 9, 5), 1), A('e1', at(11, 9), 1)];
    const now = at(11, 12);
    const map4 = (s) => s.badges.filter((x) => R.isExtraMeasure(x.badge.measure)).map((x) => [x.badge.id, x.at, x.value, x.measured]);
    const plain = R.rewardState(list, r, now);
    check('14 without map measures: not earned, not measured, value 0 (other badges measured)', [map4(plain), plain.badges.filter((x) => !R.isExtraMeasure(x.badge.measure)).every((x) => x.measured)], [[
      ['pierwszy-obszar', null, 0, false], ['pol-mapy', null, 0, false], ['cala-mapa', null, 0, false], ['czysty-tydzien', null, 0, false]
    ], true]);
    check('14 without map measures: no map badge among the events', plain.events.some((e) => e.kind === 'badge' && ['pierwszy-obszar', 'pol-mapy', 'cala-mapa', 'czysty-tydzien'].includes(e.badge)), false);
    const ext = R.rewardState(list, r, now, { extra: { regions: 1, map: 60, clean: 3 } });
    check('14 with map measures: reached ones earned now, the others measured with their value', map4(ext), [
      ['pierwszy-obszar', now, 1, true], ['pol-mapy', now, 60, true], ['cala-mapa', null, 60, true], ['czysty-tydzien', null, 3, true]
    ]);
    check('14 the measures carry the map values', [ext.measures.regions, ext.measures.map, ext.measures.clean, plain.measures.map], [1, 60, 3, 0]);
    check('14 the map badges come last (now), in the order of the rule; everything before is unchanged', [ext.events.slice(-2).map((e) => [e.id, e.at, e.total]), JSON.stringify(ext.events.slice(0, -2)) === JSON.stringify(plain.events), ext.total],
      [[['b:pierwszy-obszar', now, plain.total], ['b:pol-mapy', now, plain.total]], true, plain.total]);
    const t = at(10, 9, 2);
    const kept = R.rewardState(list, r, now, { extra: { regions: 1, map: 60 }, awarded: { 'pierwszy-obszar': t } });
    const ids = kept.events.map((e) => e.id);
    const pos = ids.indexOf('b:pierwszy-obszar');
    check('14 a stored date puts the badge at that time, between the answers', [pos > ids.indexOf(`a:${list[0].id}`), pos < ids.indexOf(`a:${list[1].id}`), kept.events[pos]?.at, kept.badges.find((x) => x.badge.id === 'pierwszy-obszar').at], [true, true, t, t]);
    check('14 events stay in time order and the totals add up', [kept.events.every((e, i, all) => i === 0 || all[i - 1].at <= e.at), kept.events.every((e, i, all) => e.total === (i === 0 ? 0 : all[i - 1].total) + e.points), kept.total === kept.events[kept.events.length - 1].total], [true, true, true]);
    check('14 a measure missing from extra is not measured (value 0)', [kept.badges.find((x) => x.badge.id === 'czysty-tydzien').measured, kept.badges.find((x) => x.badge.id === 'czysty-tydzien').value, kept.badges.find((x) => x.badge.id === 'pol-mapy').measured], [false, 0, true]);
    /* 2026-11-05 (Odznaki) — und eine gemerkte höhere Schwelle schliesst die niedrigere desselben Masses ein (zur selben Zeit). */
    check('14 a stored date counts without the measure (the teacher) and implies the lower threshold of its measure', map4(R.rewardState(list, r, now, { awarded: { 'cala-mapa': at(11, 10) } })), [
      ['pierwszy-obszar', null, 0, false], ['pol-mapy', at(11, 10), 0, false], ['cala-mapa', at(11, 10), 0, false], ['czysty-tydzien', null, 0, false]
    ]);
    check('14 a lower stored date stays when it is earlier than the higher one', R.rewardState(list, r, now, { awarded: { 'pol-mapy': at(10, 8), 'cala-mapa': at(11, 10) } }).badges.find((x) => x.badge.id === 'pol-mapy').at, at(10, 8));
    check('14 a higher threshold is not implied by a lower one', R.rewardState(list, r, now, { awarded: { 'pol-mapy': at(10, 8) } }).badges.find((x) => x.badge.id === 'cala-mapa').at, null);
    check('14 a stored date stays, even when the measure fell below the threshold', R.rewardState(list, r, now, { extra: { map: 40 }, awarded: { 'pol-mapy': at(10, 20) } }).badges.find((x) => x.badge.id === 'pol-mapy').at, at(10, 20));
    const odd = R.rewardState(list, r, now, { extra: { map: Number.NaN, regions: 'x' }, awarded: { 'cala-mapa': at(12, 9), 'pol-mapy': Number.POSITIVE_INFINITY } });
    check('14 junk: non-numbers are not measured, a date after now is now, an endless date is none (the higher one still implies it, at now)', [map4(odd), odd.events.every((e) => e.at <= now)], [[
      ['pierwszy-obszar', null, 0, false], ['pol-mapy', now, 0, false], ['cala-mapa', now, 0, false], ['czysty-tydzien', null, 0, false]
    ], true]);

    /* Ein Abzeichen der Karte mit Punkten: seine Punkte zu seiner Zeit, die Stufe und ein Abzeichen der Punkte danach. */
    const pr = rules({
      levels: [{ at: 0, name: 'A' }, { at: 100, name: 'B' }], points: { first: 0 },
      badges: [{ id: 'mapa', name: 'Mapa', measure: 'map', atLeast: 50, points: 100 }, { id: 'pkt', name: 'Pkt', measure: 'points', atLeast: 110 }]
    });
    const two = [A('p1', at(12, 9), 1), A('p2', at(12, 11), 1)];
    const pt = R.rewardState(two, pr, at(12, 12), { extra: { map: 50 }, awarded: { mapa: at(12, 10) } });
    check('14 a map badge with points: its points at its time, then the level and a points badge at the same time', pt.events.map((e) => [e.id.replace(/x\d+/, '_'), e.at, e.points, e.total]), [
      ['a:_', at(12, 9), 10, 10], ['b:mapa', at(12, 10), 100, 110], ['l:1', at(12, 10), 0, 110], ['b:pkt', at(12, 10), 0, 110], ['a:_', at(12, 11), 10, 120]
    ]);
    check('14 the total and the level follow', [pt.total, pt.level.name, pt.badges.map((x) => x.at)], [120, 'B', [at(12, 10), at(12, 10)]]);
    check('14 the day keeps only answer points (badge points are not the daily goal)', [...pt.days.values()].map((d) => d.points), [20]);
    const same = R.rewardState(two, pr, at(12, 11), { extra: { map: 50 }, awarded: { mapa: at(12, 11) } });
    check('14 the same time as an answer: after it', same.events.map((e) => e.id.replace(/x\d+/, '_')), ['a:_', 'a:_', 'b:mapa', 'l:1', 'b:pkt']);
    const before = R.rewardState(two, pr, at(12, 12), { awarded: { mapa: at(12, 8) } });
    check('14 a date before the first answer: first', before.events.map((e) => e.id.replace(/x\d+/, '_')).slice(0, 3), ['b:mapa', 'l:1', 'a:_']);
    check('14 fixed ids: a stored badge is not new again', R.freshEvents(new Set(pt.events.map((e) => e.id)), R.rewardState(two, pr, at(12, 13), { extra: { map: 50 }, awarded: { mapa: at(12, 10) } })).length, 0);

    check('14 freshAwards: reached and not yet stored, with the given time', R.freshAwards(r, { regions: 2, map: 100, clean: 0 }, { 'pol-mapy': 5 }, now), { 'pierwszy-obszar': now, 'cala-mapa': now });
    check('14 freshAwards: nothing without measures, nothing already stored', [R.freshAwards(r, undefined, {}, now), R.freshAwards(r, { map: 100 }, { 'pol-mapy': 1, 'cala-mapa': 2 }, now), R.freshAwards(r, { clean: 7 }, undefined, now)], [{}, {}, { 'czysty-tydzien': now }]);
  }

  /* ── 17. Kategorien und Stufen aus Stoffen (2026-11-05, Odznaki) ─────────────────── */
  {
    const empty = R.badgeCategories(R.rewardState([], R.DEFAULT_REWARDS, at(12, 12)).badges);
    check('17 the defaults: five categories of five steps each, in the order of the kinds, nothing yet', empty.map((c) => [c.kind, c.ladders.length, c.total, c.earned, c.top]), [
      ['consistency', 1, 5, 0, null], ['accuracy', 1, 5, 0, null], ['volume', 1, 5, 0, null], ['goals', 1, 5, 0, null], ['exploration', 1, 5, 0, null]
    ]);
    check('17 every ladder runs wood to diamond by its thresholds', empty.map((c) => c.ladders[0].steps.map((x) => [x.badge.atLeast, x.material])), [
      [[3, 0], [7, 1], [14, 2], [30, 3], [100, 4]], [[5, 0], [10, 1], [25, 2], [50, 3], [100, 4]], [[1, 0], [25, 1], [100, 2], [500, 3], [2000, 4]],
      [[1, 0], [5, 1], [20, 2], [50, 3], [150, 4]], [[10, 0], [25, 1], [50, 2], [75, 3], [100, 4]]
    ]);
    check('17 25 unique ids; the ids whose threshold stayed are kept (stored map dates still count)', [new Set(R.DEFAULT_REWARDS.badges.map((x) => x.id)).size,
      ['trzy-dni', 'tydzien', 'miesiac', 'celny', 'pierwsza-utrwalona', 'cel-piec', 'pol-mapy', 'cala-mapa'].every((id) => R.DEFAULT_REWARDS.badges.some((x) => x.id === id))], [25, true]);
    check('17 without map measures the next map step is not measured (share 0)', [empty[4].next.badge.id, empty[4].next.measured, empty[4].share], ['mapa-10', false, 0]);
    /* Sechs gute hintereinander (5 z rzędu: Holz), eine Karte nach 9 Stunden wieder (utrwalona: Holz), 30 % der Karte (Holz, Bronze). */
    const list = [0, 1, 2, 3, 4, 5].map((i) => A(`m${i}`, at(13, 9, i), 1)).concat([A('m0', at(13, 18), 1)]);
    const st = R.rewardState(list, R.DEFAULT_REWARDS, at(13, 19), { extra: { map: 30 } });
    const cats = R.badgeCategories(st.badges);
    check('17 per category: earned, top material, the next step, its material, value and share', cats.map((c) => [c.kind, c.earned, c.top, c.next?.badge.id ?? null, c.next?.material ?? null, c.next?.value ?? null, +c.share.toFixed(2)]), [
      ['consistency', 0, null, 'trzy-dni', 0, 0, 0], ['accuracy', 1, 0, 'celny', 1, 6, 0.6], ['volume', 1, 0, 'utrwalone-25', 1, 1, 0.04],
      ['goals', 0, null, 'pierwszy-cel', 0, 0, 0], ['exploration', 2, 1, 'pol-mapy', 2, 30, 0.6]
    ]);
    const all = R.badgeCategories(R.rewardState([], R.DEFAULT_REWARDS, at(13, 19), { extra: { map: 100 } }).badges)[4];
    check('17 all steps reached: diamond, no next step, share 1', [all.earned, all.top, all.next, all.share], [5, 4, null, 1]);

    const tiers = R.readRewards({ badges: [
      { id: 'a', name: 'A', measure: 'streak', atLeast: 3, tier: 5 },
      { id: 'b', name: 'B', measure: 'streak', atLeast: 7 },
      { id: 'c', name: 'C', measure: 'streak', atLeast: 9, tier: 0 },
      { id: 'd', name: 'D', measure: 'streak', atLeast: 11, tier: 6 },
      { id: 'e', name: 'E', measure: 'streak', atLeast: 13, tier: 2.5 },
      { id: 'f', name: 'F', measure: 'streak', atLeast: 15, tier: '3' }
    ] });
    check('17 tier read: whole numbers 1-5 only (a string number too)', tiers.badges.map((x) => x.tier ?? null), [5, null, null, null, null, 3]);
    check('17 tier written and read back unchanged', JSON.stringify(R.readRewards(R.rewardsData(tiers))), JSON.stringify(tiers));
    const tm = R.materialsOf(tiers.badges);
    check('17 a named tier sets the material; the others by rank (from the fifth on diamond)', ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => tm.get(id)), [4, 1, 2, 3, 4, 2]);
    const mixed = R.readRewards({ badges: [
      { id: 'x1', name: 'X1', measure: 'correct', atLeast: 100 },
      { id: 'one', name: 'Eins', measure: 'answers', atLeast: 1, kind: 'start' },
      { id: 'x2', name: 'X2', measure: 'combo', atLeast: 5 },
      { id: 'x0', name: 'X0', measure: 'correct', atLeast: 10 },
      { id: 'p1', name: 'P1', measure: 'points', atLeast: 1 }, { id: 'p2', name: 'P2', measure: 'points', atLeast: 2 }, { id: 'p3', name: 'P3', measure: 'points', atLeast: 3 },
      { id: 'p4', name: 'P4', measure: 'points', atLeast: 4 }, { id: 'p5', name: 'P5', measure: 'points', atLeast: 5 }, { id: 'p6', name: 'P6', measure: 'points', atLeast: 6 }, { id: 'p7', name: 'P7', measure: 'points', atLeast: 7 }
    ] });
    const mc = R.badgeCategories(R.rewardState([], mixed, at(13, 19)).badges);
    check('17 owner rules: categories present only, start first; two measures in one kind are two ladders; one badge is one wood step; seven steps end in diamond', mc.map((c) => [c.kind, c.ladders.map((l) => [l.measure, l.steps.map((x) => [x.badge.id, x.material])])]), [
      ['start', [['answers', [['one', 0]]]]],
      ['accuracy', [['correct', [['x0', 0], ['x1', 1]]], ['combo', [['x2', 0]]]]],
      ['volume', [['points', [['p1', 0], ['p2', 1], ['p3', 2], ['p4', 3], ['p5', 4], ['p6', 4], ['p7', 4]]]]]
    ]);
    check('17 materialsOf on the defaults', ['trzy-dni', 'tydzien', 'celny', 'utrwalone-2000', 'cala-mapa'].map((id) => R.materialsOf(R.DEFAULT_REWARDS.badges).get(id)), [0, 1, 1, 4, 4]);
    check('17 the materials and the frames of the levels are one scale', [R.BADGE_MATERIALS.length, R.levelFrame(0, 8), R.levelFrame(7, 8)], [5, 0, 4]);
  }

  /* ── 15. cleanDays ─────────────────────────────────────────────────────────────── */
  {
    const DAYMS = 24 * HOUR;
    const sp = { first: 3 * DAYMS, growth: 3 };
    const cd = (byKey, now, spacing = sp) => R.cleanDays([...byKey.keys()].map((key) => ({ key })), (key) => byKey.get(key) ?? [], now, spacing);
    const right = (t) => ({ at: t, correctness: 1 });
    const wrong = (t) => ({ at: t, correctness: 0 });
    check('15 no answers: 0', [cd(new Map(), at(22, 12)), R.cleanDays([{ key: 'x' }], () => [], at(22, 12))], [0, 0]);
    const a = new Map([['A', [right(at(20, 10))]]]);
    check('15 nothing overdue since the first answer: today, yesterday and the day of the first answer (not before)', cd(a, at(22, 12)), 3);
    check('15 the first answer today: today counts', cd(new Map([['A', [right(at(22, 11))]]]), at(22, 12)), 1);
    const b = new Map([...a, ['B', [wrong(at(21, 8)), right(at(22, 9))]]]);
    check('15 a card overdue at the end of yesterday stops the count (today is clean)', cd(b, at(22, 12)), 1);
    check('15 a day later the run grows; the overdue day still ends it', cd(b, at(23, 9)), 2);
    check('15 a card overdue now: 0', [cd(b, at(23, 11)), cd(new Map([['C', [wrong(at(22, 8))]]]), at(22, 12))], [0, 0]);
    check('15 the default spacing: right 20 minutes ago is overdue (15 min), 10 minutes ago not', [
      R.cleanDays([{ key: 'F' }], () => [right(at(22, 11, 40))], at(22, 12)), R.cleanDays([{ key: 'F' }], () => [right(at(22, 11, 50))], at(22, 12))
    ], [0, 1]);
    check('15 across the change of time (25.10.): 24.–27.', cd(new Map([['D', [right(at(24, 10))]]]), at(27, 12), { first: 5 * DAYMS, growth: 3 }), 4);
    check('15 answers after now do not count', cd(new Map([['G', [right(at(20, 10)), wrong(at(22, 13))]]]), at(22, 12)), 3);
    check('15 at most 60 days', R.cleanDays([{ key: 'E' }], () => [right(new Date(2026, 5, 1, 10).getTime())], at(30, 12), { first: 365 * DAYMS, growth: 3 }), R.CLEAN_DAYS_MAX);
    check('15 marks in any order', cd(new Map([['B', [right(at(22, 9)), wrong(at(21, 8))]], ['A', [right(at(20, 10))]]]), at(22, 12)), 1);
  }

  /* ── 16. Die gemerkten Daten, Learner.keepAwards ──────────────────────────────────── */
  {
    check('16 withAwards adds new dates and keeps the earliest of a stored one, other values stay', R.withAwards({ '~award.a': 100, x: 1 }, { a: 200, b: 50 }), { '~award.a': 100, x: 1, '~award.b': 50 });
    check('16 an earlier date wins', R.withAwards({ '~award.a': 100 }, { a: 40 }), { '~award.a': 40 });
    check('16 junk is ignored', R.withAwards({}, { a: Number.NaN, '': 5, b: 'x' }), {});
    check('16 awardsOf reads them back (nothing else)', [R.awardsOf({ '~award.a': 100, '~award.b': 50, '~spacing.first': 9, x: 1, '~award.': 3 }), R.awardsOf(undefined)], [{ a: 100, b: 50 }, {}]);
    check('16 the prefix belongs to the app (~)', R.AWARD_PREFIX.startsWith('~'), true);
    const l = new R.Learner('LIB-AW', { kind: 'local', id: 'aw' }, null);
    let heard = 0;
    const off = l.subscribe(() => { heard += 1; });
    await l.keepAwards({ 'pol-mapy': 1000 });
    const once = heard;
    await l.keepAwards({ 'pol-mapy': 2000 });
    check('16 keepAwards stores the date; a later one changes nothing and tells no one', [l.progress.values['~award.pol-mapy'], once > 0, heard], [1000, true, once]);
    await l.keepAwards({ 'pol-mapy': 500, 'cala-mapa': 3000 });
    check('16 keepAwards takes an earlier date and new ones', R.awardsOf(l.progress.values), { 'pol-mapy': 500, 'cala-mapa': 3000 });
    await l.keepValues({ story: 3 });
    check('16 keepValues of a story keeps the dates (values of the app)', [R.awardsOf(l.progress.values), l.progress.values.story], [{ 'pol-mapy': 500, 'cala-mapa': 3000 }, 3]);
    const s = R.rewardState([], R.DEFAULT_REWARDS, at(12, 12), { awarded: R.awardsOf(l.progress.values) });
    /* 2026-11-05 (Odznaki) — die neuen unteren Stufen der Karte zur Zeit der gemerkten höheren. */
    check('16 the stored dates are the badges of the map (the lower steps implied)', s.badges.filter((x) => x.at !== null).map((x) => [x.badge.id, x.at]), [['mapa-10', 500], ['cwierc-mapy', 500], ['pol-mapy', 500], ['trzy-czwarte-mapy', 3000], ['cala-mapa', 3000]]);
    off();
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\n${failed} of ${failed + passed} checks FAILED.`);
  process.exit(1);
}
console.log(`\n${passed} checks pass.`);
process.exit(0);
