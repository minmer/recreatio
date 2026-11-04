/**
 * 2026-11-04 (Prompt 15) — EINSTELLBARE ABSTÄNDE DER WIEDERHOLUNGEN (`cogita/spacing.ts`, `knowness.ts` `step`), nachgemessen.
 *
 *   1. Mit der Vorgabe ist jeder Zustand GENAU wie vorher: die alte Funktion (unten eingefroren, Stand vor Prompt 15)
 *      gegen die neue, auf vielen Antwortfolgen (früh, spät, teilweise, falsch-dann-richtig) — Abstand, Termin, Kenntnis.
 *   2. Erster Abstand ein Jahr, × 1000 („Raz i gotowe"): einmal richtig — innerhalb von sechs Monaten nie fällig, „znane";
 *      auch nach falsch, dann richtig. Die Messung (`gaugeFromMarks`) und die Powtórka (`revision.start`) rechnen damit.
 *   3. Was gilt: ohne eigene Einstellung die des Bereichs; die eigene, wenn erlaubt; ein festgelegter Bereich (`locked`)
 *      lässt die eigene nicht gelten.
 *   4. Gespeichert: Ustawienia `spacing` (geprüft, begrenzt), die eigene in den Werten (`~spacing.*`) — eine Erzählung
 *      (`keepValues`) überschreibt sie nicht; der Lernende rechnet mit `learner.spacing`.
 *
 *   node scripts/app-spacing-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-spacing-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}cogita/knowness';
export * from '${app}cogita/spacing';
export { gaugeFromMarks, cardDue, cardKnowness } from '${app}cogita/knowing';
export { readSettings } from '${app}cogita/store';
export { start, answer, readPlan } from '${app}cogita/revision';
export { Learner } from '${app}cogita/learn';
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
const K = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/* -- Die alte Funktion, eingefroren (knowness.ts vor 2026-11-04, Prompt 15) ------------------------------------- */
const OLD = (() => {
  const MIN_INTERVAL = 5 * MIN, GROWTH = 3, PARTIAL = 1 / 3, PARTIAL_FLOOR = DAY, RELEARN = 0.4, CORRECT_FROM = 0.9, WRONG_BELOW = 0.25;
  const clamp01 = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
  const gradeOf = (c) => { const q = clamp01(c); return q >= CORRECT_FROM - 1e-9 ? 'correct' : q < WRONG_BELOW ? 'wrong' : 'partly'; };
  function step(state, mark) {
    const q = clamp01(mark.correctness);
    const grade = gradeOf(q);
    if (state === null) return { at: mark.at, interval: grade === 'correct' ? MIN_INTERVAL * GROWTH : MIN_INTERVAL, elapsed: 0, best: 0, q, lapsed: grade === 'wrong', answers: 1 };
    const elapsed = Math.max(0, mark.at - state.at);
    const answers = state.answers + 1;
    if (grade === 'wrong') return { at: mark.at, interval: MIN_INTERVAL, elapsed, best: state.lapsed ? state.best : state.interval, q, lapsed: true, answers };
    if (grade === 'partly') {
      const interval = Math.max(MIN_INTERVAL, elapsed * PARTIAL, elapsed >= PARTIAL_FLOOR ? PARTIAL_FLOOR : 0);
      return { at: mark.at, interval, elapsed, best: state.best, q, lapsed: state.lapsed, answers };
    }
    const grown = Math.max(MIN_INTERVAL, elapsed * GROWTH);
    const interval = state.lapsed ? Math.max(grown, RELEARN * state.best) : Math.max(grown, state.interval);
    return { at: mark.at, interval, elapsed, best: state.best, q, lapsed: false, answers };
  }
  const stateOf = (marks) => { let s = null; for (const m of marks.filter((x) => Number.isFinite(x.at)).slice().sort((a, b) => a.at - b.at)) s = step(s, m); return s; };
  return { stateOf };
})();

/* -- 1. Mit der Vorgabe genau wie vorher ------------------------------------------------------------------------- */
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const GAPS = [10_000, MIN, 3 * MIN, 4.9 * MIN, 5 * MIN, 7 * MIN, 15 * MIN, HOUR, 5 * HOUR, DAY, 3 * DAY, 20 * DAY, 90 * DAY, 400 * DAY];
const QS = [0, 0.1, 0.24, 0.25, 0.5, 0.89, 0.9, 0.95, 1];
const histories = [];
for (let h = 0; h < 600; h += 1) {
  const n = 1 + Math.floor(rnd() * 12);
  let t = Date.UTC(2026, 0, 1) + Math.floor(rnd() * DAY);
  const marks = [];
  for (let i = 0; i < n; i += 1) {
    marks.push({ at: t, correctness: QS[Math.floor(rnd() * QS.length)] });
    t += GAPS[Math.floor(rnd() * GAPS.length)];
  }
  histories.push(marks);
}
/* Dazu die typischen Folgen: falsch, gleich (früh) richtig; falsch, nach 5 Min. richtig; viele richtige. */
const t0 = Date.UTC(2026, 2, 1);
histories.push([{ at: t0, correctness: 0 }, { at: t0 + MIN, correctness: 1 }]);
histories.push([{ at: t0, correctness: 1 }, { at: t0 + DAY, correctness: 0 }, { at: t0 + DAY + 2 * MIN, correctness: 1 }]);
histories.push([{ at: t0, correctness: 0 }, { at: t0 + 5 * MIN, correctness: 1 }, { at: t0 + HOUR, correctness: 1 }]);
histories.push(Array.from({ length: 10 }, (_, i) => ({ at: t0 + i * i * DAY, correctness: 1 })));

let same = 0;
let firstDiff = null;
for (const marks of histories) {
  const want = OLD.stateOf(marks);
  const got = K.stateOf(marks);
  const gotExplicit = K.stateOf(marks, K.DEFAULT_SPACING);
  const ok = JSON.stringify(got) === JSON.stringify(want) && JSON.stringify(gotExplicit) === JSON.stringify(want);
  if (ok) same += 1; else if (firstDiff === null) firstDiff = { marks, want, got };
}
check(`Vorgabe: ${histories.length} Antwortfolgen — Zustand genau wie vorher`, firstDiff === null ? same : firstDiff, histories.length);
let dueSame = 0;
for (const marks of histories) {
  const want = OLD.stateOf(marks);
  const wantDue = want === null ? null : want.at + want.interval;
  if (K.dueAt(marks) === wantDue && K.dueAt(marks, K.PRESET_SPACING.standard) === wantDue) dueSame += 1;
}
check('Vorgabe: Termine genau wie vorher (auch mit „Standard")', dueSame, histories.length);
let knowSame = 0;
for (const marks of histories) {
  const last = marks[marks.length - 1].at;
  const want = OLD.stateOf(marks);
  const ok = [0, MIN, HOUR, DAY, 30 * DAY].every((dt) => K.knownessOf(marks, last + dt) === K.knownessAt(want, last + dt));
  if (ok) knowSame += 1;
}
check('Vorgabe: Kenntnis zu jedem Zeitpunkt genau wie vorher', knowSame, histories.length);
check('Vorgabe = Standard = 15 Min. × 3', [K.DEFAULT_SPACING.first, K.DEFAULT_SPACING.growth, K.presetOf(K.DEFAULT_SPACING)], [15 * MIN, 3, 'standard']);

/* -- 2. Ein Jahr, × 1000 ---------------------------------------------------------------------------------------------- */
const ONCE = { first: 365 * DAY, growth: 1000 };
check('„Raz i gotowe" ist ein Jahr × 1000', [K.PRESET_SPACING.once.first, K.PRESET_SPACING.once.growth, K.presetOf(ONCE)], [365 * DAY, 1000, 'once']);
const once = [{ at: t0, correctness: 1 }];
const SIX = 183 * DAY;
check('einmal richtig: erst nach einem Jahr fällig', K.dueAt(once, ONCE) - t0, 365 * DAY);
let neverDue = true;
for (let dt = 0; dt <= SIX; dt += DAY) {
  if (K.levelOf(once, t0 + dt, ONCE) !== 'known' || K.dueAt(once, ONCE) <= t0 + dt) neverDue = false;
}
check('einmal richtig: sechs Monate lang jeden Tag „znane", nie fällig', neverDue, true);
check('mit der Vorgabe dagegen nach 15 Min. fällig', K.dueAt(once) - t0, 15 * MIN);
const relearn = [{ at: t0, correctness: 0 }, { at: t0 + 5 * MIN, correctness: 1 }];
check('falsch, dann (nach 5 Min.) richtig: auch ein Jahr', K.dueAt(relearn, ONCE) - (t0 + 5 * MIN), 365 * DAY);
const twice = [{ at: t0, correctness: 1 }, { at: t0 + 366 * DAY, correctness: 1 }];
check('zweimal richtig: dann 1000 × der vergangene Abstand', K.dueAt(twice, ONCE) - (t0 + 366 * DAY), 366 * DAY * 1000);
check('falsch bleibt falsch: zurück auf 5 Min.', K.dueAt([{ at: t0, correctness: 1 }, { at: t0 + DAY, correctness: 0 }], ONCE) - (t0 + DAY), 5 * MIN);
const lighter = K.PRESET_SPACING.lighter;
check('„Lżej": längere Abstände als Standard', [K.dueAt(once, lighter) - t0 > K.dueAt(once) - t0, lighter.growth > K.DEFAULT_SPACING.growth], [true, true]);

/* Die Messung: Termine und „known" je Karte mit der Einstellung. */
const card = (key) => ({ question: key, direction: '', key, template: 't', prompt: [], answer: { form: 'flash', back: [] }, explain: [], fingerprint: '', varies: false, requires: [], entity: `e-${key}` });
const cards = [card('a'), card('b')];
const marksOf = (key) => (key === 'a' ? once : []);
const later = t0 + SIX;
const gOnce = K.gaugeFromMarks(cards, marksOf, [], later, undefined, ONCE);
const gStd = K.gaugeFromMarks(cards, marksOf, [], later);
check('Messung: mit „Raz i gotowe" nach 6 Monaten nicht fällig, Kenntnis ≥ 1', [K.cardDue(gOnce, 'a') > later, K.cardKnowness(gOnce, 'a') >= 1], [true, true]);
check('Messung: mit der Vorgabe nach 6 Monaten längst fällig', [K.cardDue(gStd, 'a') <= later, K.cardKnowness(gStd, 'a') < 1], [true, true]);

/* Die Powtórka: jeder Schritt im Lauf rechnet mit der Einstellung. */
const plan = K.readPlan(cards, { mode: 'temporal', stackSize: 5 });
const runWith = (spacing) => {
  const s = K.start({ plan, all: cards, marks: () => [], deps: [], now: t0, seed: 'x', ...(spacing === undefined ? {} : { spacing }) });
  const key = s.current;
  const out = K.answer(s, 1, t0 + 10_000);
  const st = out.session.states.get(key);
  return st === undefined ? null : st.interval;
};
check('Powtórka: eine richtige Antwort im Lauf — Abstand nach der Einstellung', [runWith(undefined), runWith(ONCE)], [15 * MIN, 365 * DAY]);

/* -- 3. Was gilt -------------------------------------------------------------------------------------------------- */
const AREA = { first: DAY, growth: 5, locked: false };
const OWN = { first: 365 * DAY, growth: 1000 };
const eff = (area, own) => { const e = K.effectiveSpacing(area, own); return [e.spacing.first, e.spacing.growth, e.from, e.changeable]; };
check('nichts eingestellt: die Vorgabe', eff(undefined, undefined), [15 * MIN, 3, 'default', true]);
check('nur der Bereich: gilt für den Lernenden ohne eigene', eff(AREA, undefined), [DAY, 5, 'area', true]);
check('eigene, erlaubt: die eigene', eff(AREA, OWN), [365 * DAY, 1000, 'own', true]);
check('eigene ohne Bereich: die eigene', eff(undefined, OWN), [365 * DAY, 1000, 'own', true]);
check('Bereich festgelegt: die eigene gilt NICHT, ändern geht nicht', eff({ ...AREA, locked: true }, OWN), [DAY, 5, 'area', false]);
const lib = (spacing) => ({ settings: () => K.readSettings({ spacing }) });
const learnerWith = (values) => ({ progress: { values } });
check('spacingFor: Bereich aus den Ustawienia, ohne eigene', K.spacingFor(lib(AREA), learnerWith({})), { first: DAY, growth: 5 });
check('spacingFor: eigene aus den Werten', K.spacingFor(lib(AREA), learnerWith(K.withOwnSpacing({ x: 1 }, OWN))), OWN);
check('spacingFor: festgelegt — die eigene zählt nicht', K.spacingFor(lib({ ...AREA, locked: true }), learnerWith(K.withOwnSpacing({}, OWN))), { first: DAY, growth: 5 });
const gArea = K.gaugeFromMarks(cards, marksOf, [], t0 + 20 * MIN, undefined, K.spacingFor(lib({ ...AREA, locked: true }), learnerWith(K.withOwnSpacing({}, { first: MIN, growth: 1 }))));
check('festgelegt: die Messung rechnet mit dem Bereich (ein Tag), nicht mit der eigenen (1 Min.)', K.cardDue(gArea, 'a') - t0, DAY);

/* -- 4. Gespeichert ------------------------------------------------------------------------------------------------ */
check('Ustawienia: spacing gelesen', K.readSettings({ spacing: { first: DAY, growth: 5, locked: true } }).spacing, { first: DAY, growth: 5, locked: true });
check('Ustawienia: begrenzt (min. 1 Min., Wachstum ≥ 1)', K.readSettings({ spacing: { first: 5, growth: 0.2 } }).spacing, { first: MIN, growth: 1, locked: false });
check('Ustawienia: Unbrauchbares fällt weg', [K.readSettings({ spacing: { first: 'x', growth: 2 } }).spacing, K.readSettings({}).spacing], [undefined, undefined]);
check('Werte: hin und zurück', K.ownSpacing(K.withOwnSpacing({ a: 2 }, OWN)), OWN);
check('Werte: entfernt — nur die übrigen bleiben', K.withOwnSpacing(K.withOwnSpacing({ a: 2 }, OWN), null), { a: 2 });

const L = new K.Learner('lib-1', { kind: 'local', id: 'probe' }, null);
await L.keepSpacing(OWN).catch(() => undefined);
check('Learner.keepSpacing: in den Werten', K.ownSpacing(L.progress.values), OWN);
check('Learner.spacing: die eigene', L.spacing, OWN);
await L.keepValues({ punkte: 3, [K.OWN_FIRST]: 5 * MIN, [K.OWN_GROWTH]: 2 }).catch(() => undefined);
check('Learner.keepValues (eine Erzählung): die eigenen Abstände bleiben', [L.progress.values.punkte, K.ownSpacing(L.progress.values)], [3, OWN]);
L.areaSpacing = { first: DAY, growth: 5, locked: true };
check('Learner.spacing: festgelegter Bereich gewinnt', L.spacing, { first: DAY, growth: 5 });
L.areaSpacing = { first: DAY, growth: 5, locked: false };
await L.keepSpacing(null).catch(() => undefined);
check('Learner.spacing: ohne eigene — der Bereich', [L.spacing, L.progress.values.punkte], [{ first: DAY, growth: 5 }, 3]);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} ok, ${failed} failed`);
if (failed > 0) process.exit(1);
