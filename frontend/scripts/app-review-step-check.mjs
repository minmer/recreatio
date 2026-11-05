/**
 * 2026-11-05 (Prompt 23, D4/D8/D10) — DER PRZEGLĄD IN EINEM SCHRITT, der Block zum Aufklappen und fmtpi, ohne Oberfläche:
 *
 *   1. `review` ist ein Schritt mit den Ausgängen „passed" und „notyet"; seine Einstellung (of, threshold, value, goal) mit Vorgaben.
 *   2. Ein Ablauf mit einem Przegląd und ohne Ziele bekommt das Ziel „Przegląd zdany" (Wartość ≥ 1); „Powtórz przegląd" springt zu ihm.
 *   3. Der Lauf: der Schritt hält an; „passed" setzt die Wartość 1, „notyet" 0, und geht weiter (Ende / zurück).
 *   4. Die Runde: gekonnte Fragen werden nicht gefragt; Ergebnis (gekonnt + richtig) / alle ≥ threshold; ohne Fragen: zdany.
 *   5. Die Ścieżka: der Schritt ist EIN Teil „Przegląd" (statt einer Schleife je Frage); ein von Hand gebauter Przegląd mit
 *      150 Knoten und derselbe Ablauf mit dem Schritt geben dieselben übrigen Teile.
 *   6. Die Prüfung des Ablaufs warnt: ein Przegląd ohne Fragen, ein falscher threshold.
 *   7. `::: details Beweisidee` … `:::` wird ein Block zum Aufklappen (auch ineinander), {"type": "details"} im Feld blocks dazu.
 *   8. fmtpi: 0,75π, π, −π, 2π, 0.
 *
 *   node scripts/app-review-step-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-review-step-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}cogita/flow';
export * from '${app}cogita/reviewRound';
export { storyPath, stepWorkOf } from '${app}cogita/storyPath';
export { flowProblems } from '${app}cogita/flowCheck';
export { parseMarkup } from '${app}library/libraryMarkup';
export { blocksIn, blocksMarkup } from '${app}library/blocks';
export { fmtPi, FUNCTIONS } from '${app}pages/motion/expr';
`);
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }, logLevel: 'error'
});
const M = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
await rm(workspace, { recursive: true, force: true });

let failures = 0;
let passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passes += 1; return; }
  failures += 1;
  console.error(`FAIL ${name}${detail === '' ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
};

const node = (id, type, config = {}) => ({ id, type, x: 0, y: 0, config });
let ei = 0;
const edge = (from, out, to) => ({ id: `e${ei++}`, from, out, to, in: 'in' });

/* Eine Erzählung: drei Folien, drei Fragen, ein Przegląd in einem Schritt. */
const nodes = [node('s1', 'show', { of: 'f1' }), node('q1', 'question', { of: 'qa' }), node('s2', 'show', { of: 'f2' }), node('q2', 'question', { of: 'qb' }), node('q3', 'question', { of: 'qc' }), node('rv', 'review', { of: 'story', threshold: 0.9 }), node('end', 'end')];
const edges = [edge('s1', 'next', 'q1'), edge('q1', 'right', 's2'), edge('q1', 'wrong', 's2'), edge('s2', 'next', 'q2'), edge('q2', 'right', 'q3'), edge('q2', 'wrong', 'q3'), edge('q3', 'right', 'rv'), edge('q3', 'wrong', 'rv'), edge('rv', 'passed', 'end')];
const flow = M.readFlow('flow-1', { _ref: '@kurs/deszcz', name: 'Deszcz', start: 's1', graph: { nodes, edges } });

/* 1. */
check('1: review ist ein Schritt', M.STEP_TYPES.includes('review') && typeof M.STEP_LABEL.review === 'string' && M.STEP_SAYS.review.includes('threshold'));
check('1: Ausgänge passed/notyet', M.exitsOf('review', {}).map((p) => p.id).join() === 'passed,notyet');
const rc = M.reviewOf(flow, nodes[5]);
check('1: Vorgaben', rc.of === 'story' && rc.threshold === 0.9 && rc.value === 'kurs/deszcz.przeglad' && rc.goal === 'Przegląd zdany', rc);
check('1: threshold in Prozent wird ein Anteil', M.reviewOf(flow, node('x', 'review', { threshold: 80 })).threshold === 0.8);
check('1: kein review → null', M.reviewOf(flow, nodes[0]) === null);

/* 2. */
check('2: das Ziel „Przegląd zdany" kommt von selbst', flow.goals.length === 1 && flow.goals[0].id === 'przeglad' && flow.goals[0].condition?.type === 'value' && flow.goals[0].condition?.value === 'kurs/deszcz.przeglad', flow.goals);
check('2: „Powtórz przegląd" springt zum Schritt', flow.review === 'rv');
const own = M.readFlow('flow-2', { name: 'Mit Zielen', start: 's1', goals: [{ id: 'g', title: 'Eigenes', condition: { type: 'value', value: 'x', op: 'ge', than: 1 } }], review: 's2', graph: { nodes, edges } });
check('2: eigene Ziele und "review" bleiben', own.goals.length === 1 && own.goals[0].id === 'g' && own.review === 's2');
const named = M.readFlow('flow-3', { name: 'Benannt', start: 's1', graph: { nodes: nodes.map((n) => (n.id === 'rv' ? node('rv', 'review', { goal: 'Durchsicht bestanden', value: 'laag.u12.review' }) : n)), edges } });
check('2: Name des Ziels und Wartość aus dem Schritt', named.goals[0].title === 'Durchsicht bestanden' && named.goals[0].condition.value === 'laag.u12.review');

/* 3. Der Lauf. */
const ctx = { facts: (s) => ({ values: s.values, knowness: () => 0, answered: () => null, visited: new Set(s.visited), now: new Date(), flow: () => undefined }), flows: (id) => (id === flow.id ? flow : undefined), members: () => [] };
let st = M.startFlow(flow);
for (const exit of ['next', 'right', 'next', 'right', 'wrong']) st = M.advance(flow, st, exit, ctx);
check('3: der Lauf hält am Przegląd', st.step === 'rv' && !st.ended, st.step);
const again = M.advance(flow, st, 'notyet', ctx);
check('3: „notyet" ohne Weg setzt 0 und beendet die Erzählung (Przegląd noch nicht bestanden)', again.ended && again.values['kurs/deszcz.przeglad'] === 0 && !M.goalsReached(flow, ctx.facts(again)).includes('przeglad'), again);
const done = M.advance(flow, st, 'passed', ctx);
check('3: „passed" setzt 1 und endet', done.ended && done.values['kurs/deszcz.przeglad'] === 1, done);
check('3: das Ziel ist dann erreicht', M.goalsReached(flow, ctx.facts(done)).includes('przeglad'));

/* 4. Die Runde. */
const cards = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }, { key: 'e' }, { key: 'f' }, { key: 'g' }, { key: 'h' }, { key: 'i' }, { key: 'j' }];
const known = new Set(['a', 'b', 'c', 'd', 'e', 'f']);
const plan = M.reviewPlan(cards, (c) => known.has(c.key));
check('4: gefragt wird nur Ungekonntes', plan.total === 10 && plan.knownBefore === 6 && plan.pending.map((c) => c.key).join('') === 'ghij');
check('4: 3 von 4 richtig → 90 % → zdany', M.reviewResult(plan, 3, 0.9).passed && Math.abs(M.reviewResult(plan, 3, 0.9).share - 0.9) < 1e-9);
check('4: 2 von 4 → 80 % → noch nicht', !M.reviewResult(plan, 2, 0.9).passed);
check('4: ohne Fragen zdany', M.reviewResult(M.reviewPlan([], () => false), 0, 0.9).passed);
const cardOf = (id) => ({ key: `k:${id}`, question: id, entity: id, about: [`t:${id}`] });
check('4: die Karten des Ablaufs, jede einmal', M.reviewCards(flow, rc, cardOf, () => undefined).map((c) => c.key).join() === 'k:qa,k:qb,k:qc');

/* 5. Die Ścieżka. */
const work = M.stepWorkOf((n) => (typeof n.config.of === 'string' ? [n.config.of] : []));
const sp = M.storyPath(flow, work, (id) => id);
const reviewParts = sp.parts.filter((p) => p.kind === 'review');
check('5: der Schritt ist EIN Teil „Przegląd"', reviewParts.length === 1 && reviewParts[0].steps.includes('rv'), sp.parts.map((p) => `${p.kind}:${p.steps.join('+')}`));
/* Von Hand: 50 Fragen, je drei Knoten (Frage, +1, weiter) — 150 Knoten Przegląd. */
const hand = [node('s1', 'show', { of: 'f1' }), node('p0', 'set', { actions: [{ type: 'set', value: 'h.przeglad', to: 0 }] })];
const handEdges = [edge('s1', 'next', 'p0')];
let prev = 'p0';
for (let i = 0; i < 50; i += 1) {
  hand.push(node(`h${i}`, 'question', { of: `q${i}` }), node(`h${i}ok`, 'set', { actions: [{ type: 'add', value: 'h.przeglad', by: 1 }] }), node(`h${i}n`, 'condition', { condition: { type: 'value', value: 'h.przeglad', op: 'ge', than: 0 } }));
  handEdges.push(edge(prev, prev.endsWith('n') ? 'yes' : 'next', `h${i}`), edge(`h${i}`, 'right', `h${i}ok`), edge(`h${i}`, 'wrong', `h${i}n`), edge(`h${i}ok`, 'next', `h${i}n`));
  if (prev.endsWith('n')) handEdges.push(edge(prev, 'no', `h${i}`));
  prev = `h${i}n`;
}
hand.push(node('pz', 'condition', { condition: { type: 'value', value: 'h.przeglad', op: 'ge', than: 45 } }), node('end', 'end'));
handEdges.push(edge(prev, 'yes', 'pz'), edge(prev, 'no', 'pz'), edge('pz', 'yes', 'end'), edge('pz', 'no', 'p0'));
const handFlow = M.readFlow('hand', { name: 'Hand', start: 's1', review: 'p0', graph: { nodes: hand, edges: handEdges } });
const native = M.readFlow('native', { name: 'Native', start: 's1', graph: { nodes: [node('s1', 'show', { of: 'f1' }), node('rv', 'review', { of: 'story' }), node('end', 'end')], edges: [edge('s1', 'next', 'rv'), edge('rv', 'passed', 'end')] } });
const spHand = M.storyPath(handFlow, work, (id) => id);
const spNative = M.storyPath(native, work, (id) => id);
const countReviewNodes = (f) => f.graph.nodes.filter((n) => n.id !== 's1' && n.id !== 'end').length;
check('5: von Hand 150+ Knoten Przegląd, mit dem Schritt einer', countReviewNodes(handFlow) >= 150 && countReviewNodes(native) === 1, [countReviewNodes(handFlow), countReviewNodes(native)]);
check('5: beide Ścieżki: Anfang, Lesen, Przegląd, Ende', spHand.parts.map((p) => p.kind).join() === spNative.parts.map((p) => p.kind).join() && spNative.parts.map((p) => p.kind).join() === 'start,read,review,end', [spHand.parts.map((p) => p.kind), spNative.parts.map((p) => p.kind)]);

/* 6. Die Prüfung. */
const noAsk = M.readFlow('na', { name: 'Ohne', start: 's1', graph: { nodes: [node('s1', 'show', {}), node('rv', 'review', { threshold: 'viel' }), node('end', 'end')], edges: [edge('s1', 'next', 'rv'), edge('rv', 'passed', 'end'), edge('rv', 'notyet', 'end')] } });
const probs = M.flowProblems(noAsk).map((p) => p.text);
check('6: Przegląd ohne Fragen', probs.some((t) => t.includes('nie ma czego sprawdzać')), probs);
check('6: falscher threshold', probs.some((t) => t.includes('"threshold"')), probs);
check('6: eine richtige Erzählung ohne Warnung zum Przegląd', !M.flowProblems(flow).some((p) => p.text.includes('Przegląd')), M.flowProblems(flow));

/* 7. Der Block zum Aufklappen. */
const md = M.parseMarkup('Vorher.\n\n::: details Beweisidee\nErster Satz $x^2$.\n\n::: details Innen\nTief.\n:::\nDanach innen.\n:::\n\nNachher.');
check('7: drei Blöcke, der mittlere zum Aufklappen', md.length === 3 && md[1].t === 'details' && md[0].t === 'p' && md[2].t === 'p', md.map((b) => b.t));
check('7: Überschrift und Inhalt (auch ineinander)', md[1].summary.map((x) => x.v ?? '').join('') === 'Beweisidee' && md[1].c.some((b) => b.t === 'details') && md[1].c.some((b) => b.t === 'p'), md[1]);
const blocks = M.blocksIn([{ type: 'paragraph', text: 'A' }, { type: 'details', summary: 'Beweisidee', text: 'Weil $a=b$.' }]);
check('7: {"type": "details"} im Feld blocks', blocks.length === 2 && blocks[1].type === 'paragraph' && blocks[1].text.startsWith('::: details Beweisidee') && M.parseMarkup(M.blocksMarkup(blocks)).some((b) => b.t === 'details'), blocks);
check('7: ohne Ende bis zum Schluss', M.parseMarkup('::: details Offen\nText').some((b) => b.t === 'details'));

/* 8. fmtpi. */
check('8: fmtpi', M.fmtPi(0.75 * Math.PI) === '0,75π' && M.fmtPi(Math.PI) === 'π' && M.fmtPi(-Math.PI) === '−π' && M.fmtPi(2 * Math.PI) === '2π' && M.fmtPi(0) === '0' && M.fmtPi(Math.PI / 3, 3) === '0,333π', [M.fmtPi(0.75 * Math.PI), M.fmtPi(Math.PI / 3, 3)]);
check('8: fmtpi ist eine Funktion der Rysunki', typeof M.FUNCTIONS.fmtpi?.run === 'function' && M.FUNCTIONS.fmtpi.run(2.35619449) === '0,75π');

if (failures > 0) { console.error(`app-review-step-check: ${failures} failed, ${passes} passed`); process.exit(1); }
console.log(`app-review-step-check: ${passes} checks passed`);
