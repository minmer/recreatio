/**
 * 2026-11-22 (Homer) — DIE UNTERRICHTSEINHEIT, rein gerechnet (`cogita/unit/unitModel.ts`) und eingespielt (`units` im Kurs-JSON):
 *   1. lesen: Vorgaben, gemeinsam aus den Modi, unlesbare Items fallen weg, Stunden aus den Etapy;
 *   2. wo die Sitzung steht: Etap, Abschluss nach „Zakończ lekcję", Pause, „Wznów" mit Wiederholung, Plan (umgestellt, ausgelassen,
 *      ergänzt, verlängert), „Wszyscy patrzą na ekran" endet mit dem nächsten Etap;
 *   3. die Konsole: Feststecken (zwei falsche auf dieselbe Frage, Minuten ohne Fortschritt), Hilfe, wartet, Fehler (Vorhersagen nie);
 *   4. Hausaufgaben: genau die offenen Kern-Etapy der gehaltenen Stunden, Flex freiwillig, Abschluss nie; aus den eigenen Werten;
 *   5. „Wznów": Ziel = erster Kern-Etap offen für ≥ 50 %, sonst die neue Stunde; Wiederholung = die Fragen des Tickets mit den meisten Fehlern;
 *   6. Umfrage und offene Frage: die letzte Antwort je Schüler; Bericht je Etap (Median);
 *   7. Import: das Beispiel `example-unit` (Verweise aufgelöst), eine Einheit, die ins Leere zeigt, blockiert.
 *
 *   node scripts/app-unit-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-unit-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export * from '${app}cogita/unit/unitModel';
export { memoryBase } from '${app}cogita/memoryBase';
export { importSession } from '${app}cogita/importReview';
export { unitIssues } from '${app}cogita/json';
`);
await build({
  entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', jsx: 'automatic',
  plugins: [{ name: 'no-css', setup(b) { b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'no-css' })); b.onLoad({ filter: /.*/, namespace: 'no-css' }, () => ({ contents: '', loader: 'js' })); } }],
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const U = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const doc = {
  name: 'Homer', lessons: [{ title: 'Jabłko' }, { title: 'Gniew' }],
  stages: [
    { id: 'L1.0', lesson: 1, title: 'Join', modes: ['P'], minutes: [3, 6], items: [{ poll: 'Kto winny?', options: ['Parys', 'Helena'], id: 'p1' }] },
    { id: 'L1.1', lesson: 1, title: 'Votes', modes: ['V'], minutes: [3, 6], items: [{ questions: ['q1', 'q2'] }] },
    { id: 'L1.2', lesson: 1, title: 'Apple', modes: ['I', 'R'], minutes: [6, 10], items: [{ flow: 'f1' }, { questions: ['q3'] }, { nonsense: true }], bonus: [{ flow: 'f2' }] },
    { id: 'L1.3', lesson: 1, title: 'Helen', modes: ['I'], minutes: [8, 10], items: [{ flow: 'f2' }] },
    { id: 'L1.5', lesson: 1, title: 'Guilty', type: 'flex', modes: ['O'], items: [{ prompt: 'Co dziś?', max: 300 }, { poll: 'Kto winny?', options: ['Parys', 'Helena'], after: 'p1' }] },
    { id: 'L1.9', lesson: 1, title: 'Ticket', type: 'close', modes: ['X'], items: [{ questions: ['q1', 'q2', 'q3'] }] },
    { id: 'L2.1', lesson: 2, title: 'Iliad', modes: ['I'], items: [{ flow: 'f3' }] },
    { id: 'L2.9', lesson: 2, title: 'Ticket 2', type: 'close', items: [{ questions: ['q4'] }] }
  ]
};
const unit = U.readUnit('u1', doc);

/* -- 1. Lesen -------------------------------------------------------------------------------------------------------------- */
{
  check('read: stages in order, two lessons', [unit.stages.map((s) => s.id), unit.lessons.length], [['L1.0', 'L1.1', 'L1.2', 'L1.3', 'L1.5', 'L1.9', 'L2.1', 'L2.9'], 2]);
  check('read: led from the modes (P/V without I/R/X), individual otherwise', unit.stages.map((s) => s.led), [true, true, false, false, false, false, false, false]);
  check('read: an unreadable item falls away, bonus kept', [unit.stages[2].items.length, unit.stages[2].bonus.length], [2, 1]);
  check('read: a prompt is at most 80 characters, anonymous by default', [unit.stages[4].items[0].max, unit.stages[4].items[0].anonymous], [80, true]);
  check('read: defaults (type core, settings 2 wrong / 3 min / 50 %)', [unit.stages[0].type, unit.settings], ['core', { stuckWrong: 2, stuckMinutes: 3, resumeShare: 0.5 }]);
  check('read: lessons padded from the stages', U.readUnit('x', { stages: [{ id: 'a', lesson: 3, items: [{ flow: 'f' }] }] }).lessons.length, 3);
}

/* -- 2. Wo die Sitzung steht ----------------------------------------------------------------------------------------------- */
const ev = (kind, body) => ({ kind, ...body });
{
  const lobby = U.unitNow(unit, [], 'lobby');
  check('now: nothing opened — lobby', [lobby.phase, lobby.stage], ['lobby', null]);
  const e1 = [ev('stage', { stage: 'L1.1', lesson: 1, at: 10 }), ev('look', { on: true, at: 11 })];
  const n1 = U.unitNow(unit, e1, 'running');
  check('now: a stage is open, everyone looks at the screen', [n1.phase, n1.stage.id, n1.look], ['lesson', 'L1.1', true]);
  const e2 = [...e1, ev('stage', { stage: 'L1.2', lesson: 1, at: 20 })];
  check('now: the next stage ends the look-at-screen', [U.unitNow(unit, e2, 'running').look, U.unitNow(unit, e2, 'running').reached.size], [false, 2]);
  const e3 = [...e2, ev('end', { lesson: 1, at: 30 }), ev('stage', { stage: 'L1.9', lesson: 1, at: 31 })];
  check('now: „Zakończ lekcję" — the close stage runs', [U.unitNow(unit, e3, 'running').phase, U.unitNow(unit, e3, 'running').stage.id], ['closing', 'L1.9']);
  const e4 = [...e3, ev('pause', { lesson: 1, at: 40 })];
  check('now: after the close — between lessons', [U.unitNow(unit, e4, 'paused').phase, U.unitNow(unit, e4, 'paused').lesson], ['between', 1]);
  const e5 = [...e4, ev('resume', { lesson: 2, recap: ['q2'], at: 50 }), ev('stage', { stage: 'R2', lesson: 2, at: 51 })];
  const n5 = U.unitNow(unit, e5, 'running');
  check('now: „Wznów" — the recap stage is led and holds the recap questions', [n5.phase, n5.lesson, n5.stage.id, n5.stage.led, n5.stage.items[0].questions], ['lesson', 2, 'R2', true, ['q2']]);
  check('now: closed session', U.unitNow(unit, e5, 'finished').phase, 'closed');
  const plan = ev('plan', { order: ['L1.3', 'L1.2'], skipped: ['L1.5'], added: { 'L1.3': [{ kind: 'prompt', prompt: 'x', max: 80, anonymous: true }] }, extend: { 'L1.3': 5 }, at: 5 });
  const np = U.unitNow(unit, [plan], 'running');
  check('plan: reordered, skipped, an item added, extended by 5', [np.stages.map((s) => s.id), np.stages[0].items.length, np.stages[0].minutes], [['L1.3', 'L1.2', 'L1.0', 'L1.1', 'L1.9', 'L2.1', 'L2.9'], 2, [8, 15]]);
  check('next: after L1.1 comes L1.2; the close is never „next"', [U.nextStage(unit.stages, 'L1.1', 1).id, U.nextStage(unit.stages, 'L1.5', 1), U.closeStageOf(unit.stages, 1).id], ['L1.2', null, 'L1.9']);
  check('remaining core after L1.1 (upper bounds 10 + 10)', U.remainingCore(unit.stages, 1, 'L1.1'), 20);
  check('time: inside the range, over it', [U.timeState(unit.stages[2], 7 * 60_000), U.timeState(unit.stages[2], 11 * 60_000), U.timeState(unit.stages[2], 60_000)], ['ok', 'over', 'early']);
}

/* -- 3. Die Konsole -------------------------------------------------------------------------------------------------------- */
const p = (participant, item, what, extra = {}) => ({ participant, stage: 'L1.2', item, what, at: 1000, ...extra });
{
  const s = unit.stages[2];
  const progress = [
    p('a', 'L1.2#0', 'start'), p('a', 'L1.2#0', 'done', { at: 2000 }), p('a', 'L1.2#1', 'done', { at: 3000 }),
    p('b', 'L1.2#0', 'start'), p('b', 'L1.2#0', 'answer', { step: 's1', result: 'wrong', tag: 'myli-boga', at: 1100 }), p('b', 'L1.2#0', 'answer', { step: 's1', result: 'wrong', tag: 'myli-boga', at: 1200 }),
    p('c', 'L1.2#0', 'start', { at: 1000 }),
    p('d', 'L1.2#0', 'start', { at: 1000 }), p('d', 'L1.2#0', 'answer', { step: 's1', result: 'wrong', at: 1100 }), p('d', 'L1.2#0', 'answer', { step: 's1', result: 'right', at: 1200 }), p('d', 'L1.2#0', 'answer', { step: 's2', result: 'wrong', predict: true, tag: 'x', at: 1300 })
  ];
  const rows = U.studentRows(s, ['a', 'b', 'c', 'd', 'e'], progress, [{ participant: 'c', stage: 'L1.2', on: true, at: 1500 }], 1500, unit.settings);
  check('console: done all → waiting; 2 wrong on one question → stuck; help; a right answer resets; nothing → none', rows.map((r) => r.status), ['waiting', 'stuck', 'help', 'working', 'none']);
  const late = U.studentRows(s, ['d'], progress, [], 1300 + 3 * 60_000 + 1, unit.settings);
  check('console: more than 3 minutes without progress → stuck', late[0].status, 'stuck');
  check('console: top errors without predictions', U.topTags(progress, 'L1.2'), [{ tag: 'myli-boga', count: 2 }]);
  check('console: finished by', [...U.finishedBy(s, progress)], ['a']);
}

/* -- 4. Hausaufgaben ------------------------------------------------------------------------------------------------------- */
{
  const done = new Set(['L1.0#0', 'L1.1#0', 'L1.2#0']);
  const hw = U.homeworkOf(unit.stages, 1, done);
  check('homework: unfinished core of lesson 1 in order; flex optional; close never; lesson 2 not yet', [hw.core.map((s) => s.id), hw.flex.map((s) => s.id)], [['L1.2', 'L1.3'], ['L1.5']]);
  const all = new Set(unit.stages.flatMap((s) => s.items.map((_, i) => U.itemKey(s.id, i))));
  check('homework: nothing left', U.homeworkOf(unit.stages, 2, all).core.length, 0);
  const key = U.doneValueKey('0199aaaa-bbbb-7000-8000-000000000001', 'L1.2#1');
  check('homework: done items from the own values (per session)', [...U.doneFromValues({ [key]: 123, [U.doneValueKey('0199aaaa-cccc-7000-8000-000000000001', 'L1.2#0')]: 5, '~placed.x': 1 }, '0199aaaa-bbbb-7000-8000-000000000001')], ['L1.2#1']);
}

/* -- 5. „Wznów" ----------------------------------------------------------------------------------------------------------- */
{
  const share = { 'L1.0': 0, 'L1.1': 0.2, 'L1.2': 0.6, 'L1.3': 0.9 };
  check('resume: first core stage open for ≥ 50 %', U.resumeTarget(unit.stages, 2, (s) => share[s.id] ?? 0, 0.5).id, 'L1.2');
  check('resume: everything done — the new lesson\'s first stage', U.resumeTarget(unit.stages, 2, () => 0, 0.5).id, 'L2.1');
  const t = (participant, step, result) => ({ participant, stage: 'L1.9', item: 'L1.9#0', what: 'answer', step, result, at: 1 });
  const ticket = [t('a', 'q1', 'right'), t('b', 'q1', 'right'), t('a', 'q2', 'wrong'), t('b', 'q2', 'wrong'), t('a', 'q3', 'wrong'), t('b', 'q3', 'right'), t('c', 'q9', 'wrong')];
  check('recap: the ticket questions with the most errors, at most 2 (not outside the ticket)', U.recapQuestions(unit.stages[5], ticket), ['q2', 'q3']);
  check('recap: no ticket — no recap', U.recapQuestions(null, ticket), []);
}

/* -- 6. Umfrage, offene Frage, Bericht --------------------------------------------------------------------------------------- */
{
  const a = (participant, choice, at) => ({ participant, stage: 'L1.5', item: 'L1.5#1', choice, at });
  check('poll: the last answer of each student counts', U.pollCounts([a('x', 0, 1), a('y', 1, 2), a('x', 1, 3)], 'L1.5', 'L1.5#1', 2), { counts: [0, 2], votes: 2 });
  const prog = [p('a', 'L1.2#0', 'start', { at: 0 }), p('a', 'L1.2#0', 'done', { at: 60_000 }), p('a', 'L1.2#1', 'done', { at: 120_000 }), p('b', 'L1.2#0', 'start', { at: 0 }), p('b', 'L1.2#0', 'done', { at: 240_000 }), p('b', 'L1.2#1', 'done', { at: 360_000 })];
  const r = U.stageReport(unit.stages[2], ['a', 'b', 'c'], prog);
  check('report: finished, median time, who still has it', [r.finished, r.total, r.medianMinutes, r.open], [2, 3, 4, ['c']]);
}

/* -- 7. Import ------------------------------------------------------------------------------------------------------------- */
{
  const example = JSON.parse(await readFile('../templates/cogita/przyklad-jednostka.json', 'utf8'));
  const made = await U.memoryBase(example, { libraryId: 'unit-check', areaId: 'unit-area' });
  check('import: the example imports without errors', 'error' in made ? made.error : 'ok', 'ok');
  if (!('error' in made)) {
    const lib = made.writer;
    const docs = lib.docs('unit');
    check('import: one unit doc', docs.length, 1);
    const u = U.readUnit(docs[0].id, docs[0].data);
    const flow = lib.docs('flow')[0]?.id;
    const q = u.stages.find((s) => s.id === 'L1.9').items[0].questions;
    check('import: refs resolved — the flow and the questions are ids of this base', [u.stages[1].items[0].flow === flow, q.every((x) => lib.entity(x) !== undefined)], [true, true]);
    check('import: the stages and the before/after poll kept', [u.stages.length, u.stages.find((s) => s.id === 'L1.3').items[0].after], [7, 'przed']);
    const broken = { format: 'recreatio.cogita.course', version: 1, name: 'x', units: [{ ref: '@x/u', name: 'Zła', stages: [{ id: 'A', items: [{ flow: '@nie/ma' }] }, { id: 'A', items: [{ questions: ['nie-ma'] }] }] }] };
    const s = U.importSession(lib, broken);
    const plan = s.decide({ accepted: new Set(s.changes().map((c) => c.id)), edited: new Map() }).plan;
    const issues = U.unitIssues(lib, plan.docs, plan.entities);
    check('import: a unit pointing nowhere is an error (blocks), twice the same stage id too', [issues.filter((i) => i.error).length >= 2, issues.some((i) => /twice/.test(i.text))], [true, true]);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
