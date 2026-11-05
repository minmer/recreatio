/**
 * 2026-11-04 (Prompt 10) — GEFRAGT WIRD NUR, WAS DER LERNENDE BRAUCHT, nachgemessen (`cogita/flowAsk.ts`, `cogita/flow.ts`,
 * `cogita/revision.ts`, `cogita/storyPath.ts`):
 *   - eine Erzählung überspringt eine gekonnte Frage still (über „dobrze", ohne Antwort), Bilder kommen immer;
 *   - ihr Przegląd endet, sobald alles zugleich gekonnt ist — 10 gekonnte und 1 unbekannte Frage, die unbekannte erst
 *     falsch, dann richtig: genau diese Frage zweimal, dazwischen ein Przerywnik, dann das Ende;
 *   - dieselbe Regel in einer Powtórka (die Bänder): „Zostało N" erreicht 0 genau dann, wenn sie endet;
 *   - die Ścieżka zählt, was wirklich gefragt wird („2 z 5"); alles gekonnt — nur zum Lesen.
 *
 *   node scripts/app-ask-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-ask-'));
const names = { ask: 'flowAsk', flow: 'flow', revision: 'revision', story: 'storyPath', path: 'pathLayout', knowness: 'knowness' };
await build({
  entryPoints: Object.fromEntries(Object.entries(names).map(([k, n]) => [k, `src/app/cogita/${n}.ts`])),
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [A, F, R, SP, P, K] = await Promise.all(Object.keys(names).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 4, 9, 0, 0);
/* Elf Fragen über ein Thema; q1–q10 gekonnt (eine lange richtige Geschichte), q11 nie gefragt. */
const ids = Array.from({ length: 11 }, (_, i) => `q${i + 1}`);
const card = (id) => ({ question: id, direction: '', key: `k-${id}`, entity: id, about: ['temat'], prompt: [{ text: id }], answer: { form: 'truefalse', value: true }, explain: [], fingerprint: 'f', varies: false, requires: [] });
const cards = ids.map(card);
const byId = new Map(cards.map((c) => [c.entity, c]));
const cardOf = (id) => byId.get(id) ?? null;
const history = new Map();
const knownHistory = [-120, -60, -30, -14, -6, -2].map((d) => ({ at: T0 + d * DAY, correctness: 1 }));
for (const id of ids.slice(0, 10)) history.set(`k-${id}`, [...knownHistory]);
const marks = (c) => history.get(c.key) ?? [];
check('the ten are known (band „znane"), the eleventh not', ids.map((id) => A.isKnown(cardOf(id), marks, T0)), [...Array(10).fill(true), false]);

/* ── Der Przegląd einer Erzählung ───────────────────────────────────── */
const node = (id, type, config = {}) => ({ id, type, x: 0, y: 0, config });
const edge = (from, out, to) => ({ id: `${from}>${out}`, from, out, to, in: 'in' });
const nodes = [node('intro', 'show', { of: 'temat', title: 'Wstęp' }), ...ids.map((id) => node(`s-${id}`, 'question', { of: id })),
  node('all', 'condition', { condition: { type: 'and', items: ids.map((id) => ({ type: 'knowness', of: id, band: 'known' })) } }), node('end', 'end')];
const edges = [edge('intro', 'next', 's-q1'), ...ids.flatMap((id, i) => {
  const to = i + 1 < ids.length ? `s-${ids[i + 1]}` : 'all';
  return [edge(`s-${id}`, 'right', to), edge(`s-${id}`, 'wrong', to)];
}), edge('all', 'yes', 'end'), edge('all', 'no', 's-q1')];
const flow = F.readFlow('przeglad', { name: 'Przegląd', start: 'intro', graph: { nodes, edges } });
let now = T0;
const facts = (state) => ({
  values: state.values, visited: new Set(state.visited), now: new Date(now), answered: () => null,
  knowness: (id) => A.flowKnowness(id, cardOf(id), cards.filter((c) => c.about.includes(id)), marks, now)
});
const ctx = { facts, flows: () => undefined, members: () => [], skip: (n) => A.skipStep(n, cardOf, marks, now) };

/* Der Spieler, wie `FlowPlayer` ihn führt: eine Frage, die eben falsch war und gleich wieder käme — erst ein Przerywnik. */
let state = F.startFlow(flow);
const asked = [];
const counter = [];
let last = null;
let spacerDone = null;
let guard = 0;
while (!state.ended && state.step !== null && guard < 50) {
  guard += 1;
  now += 30_000;
  const n = flow.graph.nodes.find((x) => x.id === state.step);
  if (n.type !== 'question') { asked.push(`[${n.type}]`); state = F.advance(flow, state, 'next', ctx); continue; }
  const c = A.askedCardOf(n, cardOf);
  counter.push(A.questionsLeft(flow, n.id, cardOf, marks, now).left);
  if (last !== null && last.key === c.key && last.wrong && spacerDone !== c.key) {
    const sp = A.pickSpacer(c, A.cardsInFlow(flow, cardOf), cards, marks, now);
    if (sp !== null) { asked.push(`spacer:${sp.entity}`); spacerDone = c.key; continue; }
  }
  /* q11: erst falsch, dann richtig. */
  const right = asked.filter((x) => x === c.entity).length > 0;
  asked.push(c.entity);
  history.set(c.key, [...(history.get(c.key) ?? []), { at: now, correctness: right ? 1 : 0 }]);
  last = { key: c.key, wrong: !right };
  if (right) spacerDone = null;
  state = F.advance(flow, state, right ? 'right' : 'wrong', ctx);
}
check('the story review asks exactly the unknown question twice, one spacer between, and ends', [asked, state.ended], [['[show]', 'q11', 'spacer:q1', 'q11'], true]);
check('… its counter „Zostało N" counts only questions really asked (1, 1, 1)', counter, [1, 1, 1]);
check('… after the run nothing is left to ask', A.questionsLeft(flow, 's-q1', cardOf, marks, now).left, 0);
check('… the spacer changed nothing (q1 kept its own history)', history.get('k-q1').length, knownHistory.length);
check('a known question would be skipped; the slide never', [A.skipStep(nodes[1], cardOf, marks, now), A.skipStep(nodes[0], cardOf, marks, now)], [true, false]);
check('a story whose questions are all known can still be read through: start → the slide → end', (() => {
  let s = F.startFlow(flow);
  const seen = [s.step];
  for (let i = 0; i < 5 && !s.ended; i += 1) { s = F.advance(flow, s, 'next', ctx); if (s.step !== null) seen.push(s.step); }
  return [seen, s.ended];
})(), [['intro', 'end'], true]);

/* ── Die Ścieżka zählt, was wirklich gefragt wird ───────────────────── */
history.set('k-q11', [...knownHistory]);
history.delete('k-q4');
history.delete('k-q9');
const sp = SP.storyPath(flow, SP.stepWorkOf((n) => (typeof n.config.of === 'string' ? [n.config.of] : [])), (id) => id);
const knownStep = (s) => { const n = flow.graph.nodes.find((x) => x.id === s); return n !== undefined && A.skipStep(n, cardOf, marks, now); };
const marksNow = SP.storyMarks(sp, { visited: [], step: null, knownStep });
const qi = sp.parts.findIndex((p) => p.questions > 0);
check('the path: the review part with 11 questions, 2 of them unknown — „2 z 11 pytań"', [sp.parts[qi].kind, sp.parts[qi].questions, marksNow.ask[qi], P.partWords(sp.parts[qi], marksNow.ask[qi])], ['review', 11, 2, 'Przegląd: 2 z 11 pytań — powtarzasz, aż wszystkie umiesz']);
check('… a learning part says it the same way', P.partWords({ kind: 'learn', slides: 0, questions: 5 }, 2), '2 z 5 pytań do odpowiedzi');
for (const id of ['q4', 'q9']) history.set(`k-${id}`, [...knownHistory]);
const allKnown = SP.storyMarks(sp, { visited: [], step: null, knownStep });
check('… all known — the review says so; a learning part is reading only', [allKnown.ask[qi], P.partWords(sp.parts[qi], allKnown.ask[qi]), P.partWords({ kind: 'mixed', slides: 2, questions: 3 }, 0)],
  [0, 'Przegląd — wszystkie pytania już umiesz', '2 slajdy do przeczytania · wszystkie pytania już umiesz — tylko do przeczytania']);

/* ── Dieselbe Regel in einer Powtórka ───────────────────────────────── */
history.delete('k-q11');
const plan = R.readPlan(cards, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true });
let s = R.start({ plan, all: cards, marks: (key) => history.get(key) ?? [], deps: [], now: T0 + DAY, seed: 'ask' });
let t = T0 + DAY;
const runAsked = [];
const left = [];
guard = 0;
/* Das Ende wie in `RevisionRun`: nichts mehr, oder nur noch „na zapas". */
const ended = () => s.current === null || s.why?.reason === 'ahead';
while (!ended() && guard < 40) {
  guard += 1;
  t += 30_000;
  const lp = R.lessonProgress(s, t);
  left.push(lp.total - lp.done);
  const key = s.current;
  const spacer = s.why?.reason === 'spacer';
  const right = spacer || runAsked.includes('k-q11');
  runAsked.push(spacer ? `spacer:${key}` : key);
  s = R.answer(s, right ? 1 : 0, t).session;
}
const lpEnd = R.lessonProgress(s, t + 1);
check('a review (bands) with 10 known and 1 unknown: the unknown twice, a spacer between, then the end', runAsked.map((k) => k.replace(/k-/g, '')), ['q11', 'spacer:q1', 'q11']);
check('… „Zostało N" stays 1 while the question is open and reaches 0 exactly at the end', [left, lpEnd.total - lpEnd.done], [[1, 1, 1], 0]);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed > 0 ? `, ${failed} FAIL` : ''}.`);
if (failed > 0) process.exit(1);
