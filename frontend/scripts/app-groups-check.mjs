/**
 * 2026-11-24 — GRUPPENARBEIT IN EINER EINHEIT (`src/app/cogita/unit/groupsModel.ts`, Felder `work`/`groupSize` in `unitModel.ts`),
 * ohne Browser: Gruppen bilden (Grössen, Samen, Nachzügler, umsetzen), die Einigung (denkt nach / uneinig / einig / geschlossen,
 * Mehrheit), die Ansicht der Gruppen, die Zählung, die Verteilung, das Lesen und Prüfen der Etapy.
 *
 *   node scripts/app-groups-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const workspace = await mkdtemp(join(tmpdir(), 'app-groups-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export * as G from '${app}cogita/unit/groupsModel';
export * as U from '${app}cogita/unit/unitModel';
`);
await build({ entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error' });
const { G, U } = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let passed = 0;
let failed = 0;
const check = (name, fn) => { try { fn(); passed += 1; console.log(`ok   ${name}`); } catch (e) { failed += 1; console.log(`FAIL ${name}: ${e.message}`); } };
const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const ans = (participant, q, given, at, item = 'S#0') => ({ participant, stage: 'S', item, q, given, label: String(given), at });

try {
  check('grouping: 7 students, size 3 → 3 groups of 3/2/2, everyone exactly once', () => {
    const g = G.formGroups(ids, 3, 'seed');
    assert.deepEqual(g.map((x) => x.length).sort(), [2, 2, 3]);
    assert.deepEqual(g.flat().sort(), ids);
  });
  check('grouping: the same seed gives the same groups, another seed mixes differently', () => {
    assert.deepEqual(G.formGroups(ids, 2, 'x'), G.formGroups([...ids].reverse(), 2, 'x'));
    const seeds = ['s1', 's2', 's3', 's4'].map((s) => JSON.stringify(G.formGroups(ids, 2, s)));
    assert.ok(new Set(seeds).size > 1);
  });
  check('grouping: size is clamped to 2–6, nobody alone when avoidable, one student = one group', () => {
    assert.equal(G.clampGroupSize(9), 6); assert.equal(G.clampGroupSize(1), 2); assert.equal(G.clampGroupSize('x'), 3);
    assert.ok(G.formGroups(['a', 'b', 'c', 'd', 'e'], 4, 's').every((x) => x.length >= 2));
    assert.deepEqual(G.formGroups(['a'], 3, 's'), [['a']]);
    assert.deepEqual(G.formGroups([], 3, 's'), []);
  });
  check('late joiners go to the smallest group; when all are full, a new group', () => {
    const g = [['a', 'b', 'c'], ['d', 'e']];
    assert.deepEqual(G.withLate(g, ['a', 'b', 'c', 'd', 'e', 'f'], 3), [['a', 'b', 'c'], ['d', 'e', 'f']]);
    assert.deepEqual(G.withLate([['a', 'b'], ['c', 'd']], ['a', 'b', 'c', 'd', 'x'], 2), [['a', 'b'], ['c', 'd'], ['x']]);
    assert.deepEqual(G.withLate(g, ['a'], 3), g, 'nobody is removed, nothing changes');
  });
  check('moving a student: to another group, to a new group; an emptied group disappears', () => {
    assert.deepEqual(G.moveMember([['a', 'b'], ['c']], 'c', 0), [['a', 'b', 'c']]);
    assert.deepEqual(G.moveMember([['a', 'b'], ['c', 'd']], 'a', 2), [['b'], ['c', 'd'], ['a']]);
    assert.equal(G.groupOf([['a'], ['b', 'c']], 'c'), 1);
  });
  check('initials: first and last name, without the class in brackets', () => {
    assert.equal(G.initialsOf('Anna Nowak (Klasa 1a)'), 'AN');
    assert.equal(G.initialsOf('Bartek'), 'BA');
    assert.equal(G.initialsOf(''), '?');
  });
  check('the same answer: order of a multiple choice and spaces/case of a text do not matter', () => {
    assert.equal(G.answerKey([2, 0]), G.answerKey([0, 2]));
    assert.equal(G.answerKey(' Rzym '), G.answerKey('rzym'));
    assert.notEqual(G.answerKey(1), G.answerKey(2));
  });
  check('agreement: thinking until all answered; disagree when they differ; agreed when all the same', () => {
    const m = ['a', 'b', 'c'];
    assert.equal(G.groupQuestion(m, [ans('a', 'q', 1, 1)]).status, 'thinking');
    assert.equal(G.groupQuestion(m, [ans('a', 'q', 1, 1), ans('b', 'q', 2, 2), ans('c', 'q', 1, 3)]).status, 'disagree');
    const ok = G.groupQuestion(m, [ans('a', 'q', 1, 1), ans('b', 'q', 2, 2), ans('c', 'q', 1, 3), ans('b', 'q', 1, 4)]);
    assert.deepEqual([ok.status, ok.given, ok.answers.b], ['agreed', 1, '1'], 'the latest answer of each member counts (b changed its mind)');
    assert.equal(G.groupQuestion(m, [ans('a', 'q', 1, 1), ans('x', 'q', 1, 1)]).answers.x, undefined, 'answers of others do not count');
  });
  check('the teacher closes: the majority is the group answer (tie: the first given)', () => {
    const m = ['a', 'b', 'c'];
    const c = G.groupQuestion(m, [ans('a', 'q', 2, 1), ans('b', 'q', 1, 2), ans('c', 'q', 1, 3)], true);
    assert.deepEqual([c.status, c.given], ['closed', 1]);
    assert.equal(G.groupQuestion(['a', 'b'], [ans('a', 'q', 2, 1), ans('b', 'q', 1, 2)], true).given, 2);
  });
  const groups = [['a', 'b'], ['c', 'd']];
  const answers = [ans('a', 'q1', 1, 1), ans('b', 'q1', 1, 2), ans('c', 'q1', 0, 3), ans('d', 'q1', 2, 4), ans('a', 'q2', 0, 5)];
  const views = G.groupViews(groups, ['q1', 'q2'], answers, [], 'S#0', (p) => p.toUpperCase(), (q, given) => given === 1);
  check('group views: per group its members (initials), per question the status, the group answer and right/wrong', () => {
    assert.deepEqual(views[0].members, [{ p: 'a', ini: 'A' }, { p: 'b', ini: 'B' }]);
    assert.deepEqual([views[0].qs.q1.status, views[0].qs.q1.label, views[0].qs.q1.correct], ['agreed', '1', true]);
    assert.deepEqual([views[1].qs.q1.status, views[1].qs.q1.correct], ['disagree', undefined]);
    assert.equal(views[0].qs.q2.status, 'thinking');
    assert.equal(views[1].qs.q2, undefined, 'a question nobody in the group touched is left out');
  });
  check('tally: answered / agreed / correct and where the group is now', () => {
    assert.deepEqual(G.groupTally(views[0], ['q1', 'q2']), { answered: 2, agreed: 1, correct: 1, status: 'thinking', q: 'q2' });
    assert.deepEqual(G.groupTally(views[1], ['q1', 'q2']), { answered: 1, agreed: 0, correct: 0, status: 'disagree', q: 'q1' });
  });
  check('distribution of the group answers; a closed question counts with its majority', () => {
    const closed = G.groupViews(groups, ['q1'], answers, [{ stage: 'S', item: 'S#0', q: 'q1', group: 2, at: 9 }], 'S#0', (p) => p, (q, g) => g === 1);
    assert.equal(closed[1].qs.q1.status, 'closed');
    const d = G.groupDistribution(closed, 'q1');
    assert.equal(d.reduce((n, x) => n + x.count, 0), 2);
    assert.equal(d.find((x) => x.label === '1')?.correct, true);
  });
  check('group answers are read only from `prompt` events that carry `group`', () => {
    const read = G.groupAnswersOf([{ participant: 'a', stage: 'S', item: 'S#0', group: { q: 'q1', given: 1, label: 'A' }, at: 1 }, { participant: 'a', stage: 'S', item: 'S#1', text: 'hej', at: 2 }, null]);
    assert.equal(read.length, 1);
    assert.equal(read[0].label, 'A');
  });
  check('a unit stage: work + groupSize (groups → on the phones, never led); defaults derived as before', () => {
    const u = U.readUnit('u', { name: 'U', stages: [
      { id: 'A', modes: ['V'], items: [{ questions: ['q'] }] },
      { id: 'B', modes: ['I'], work: 'groups', groupSize: 9, items: [{ questions: ['q'] }] },
      { id: 'C', modes: ['V'], work: 'alone', items: [{ questions: ['q'] }] }
    ] });
    assert.deepEqual(u.stages.map((s) => [s.id, s.work, s.led, s.groupSize]), [['A', 'together', true, 3], ['B', 'groups', false, 6], ['C', 'alone', false, 3]]);
    assert.equal(U.recapStage(2, ['q'], 'R').work, 'together');
  });
  check('import problems: group work without questions, group size outside 2–6, unknown way of working (warnings)', () => {
    const p = U.unitProblems({ name: 'U', stages: [
      { id: 'A', work: 'groups', groupSize: 8, items: [{ prompt: 'x' }] },
      { id: 'B', work: 'pairs', items: [{ questions: ['q'] }] }
    ] }, { flow: () => true, question: () => true });
    const keys = p.map((x) => x.key);
    assert.ok(keys.includes('groupsNoQuestions') && keys.includes('groupSize') && keys.includes('workUnknown'));
    assert.ok(p.filter((x) => ['groupsNoQuestions', 'groupSize', 'workUnknown'].includes(x.key)).every((x) => !x.error));
  });
} finally {
  await rm(workspace, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
