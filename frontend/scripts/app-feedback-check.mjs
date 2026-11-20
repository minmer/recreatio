/**
 * 2026-11-20 — RÜCKMELDUNGEN ZU KARTEN, FRAGEN UND FOLIEN (`cogita/feedback.ts`), ohne Browser:
 *   1. gelesen wird duldsam (eine fremde Art, ein fehlendes Ziel: keine Rückmeldung; zu langer Text gekürzt);
 *   2. das Ziel einer Karte: eine Frage (ohne Vorlage) oder eine Karte einer Vorlage; dasselbe Ziel über den Schlüssel der Karte;
 *   3. für die KI: bleibende Namen (`@…`), die Art in Worten, offen vor erledigt, kein Konto, kein Name eines Menschen;
 *   4. nie im JSON des Kurses (Export) — eine Rückmeldung ist kein Bau der Baza.
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-feedback-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `export * as FB from '${app}cogita/feedback';\nexport { DOC_KINDS } from '${app}cogita/kinds';\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }, logLevel: 'error' });
globalThis.BroadcastChannel = undefined;
let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };
try {
  const { FB, DOC_KINDS } = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  assert.ok(DOC_KINDS.includes('feedback'));
  assert.equal(FB.readFeedback('x', { category: 'weird', target: { kind: 'card' } }), null);
  assert.equal(FB.readFeedback('x', { category: 'good' }), null);
  const long = FB.readFeedback('x', { category: 'language', target: { kind: 'slide', entity: 'e1', label: 'A' }, text: 'x'.repeat(5000), at: '2026-11-20T10:00:00Z' });
  assert.equal(long.text.length, FB.FEEDBACK_TEXT_MAX); assert.equal(long.state, 'open'); assert.equal(long.target.kind, 'slide');
  ok('read tolerantly: unknown category or no target is no feedback; long text cut; open by default');

  const question = FB.cardTarget({ key: 'k-q', entity: 'q1', label: 'Kiedy?' });
  const fromTemplate = FB.cardTarget({ key: 'k-t', entity: 'p1', template: 't1', label: 'Jan → 1815' });
  assert.deepEqual(question, { kind: 'question', entity: 'q1', card: 'k-q', label: 'Kiedy?' });
  assert.deepEqual(fromTemplate, { kind: 'card', entity: 'p1', template: 't1', card: 'k-t', label: 'Jan → 1815' });
  assert.ok(FB.sameTarget(question, { kind: 'question', card: 'k-q', label: '' }));
  assert.ok(!FB.sameTarget(question, { kind: 'question', card: 'k-other', label: '' }));
  assert.ok(FB.sameTarget({ kind: 'slide', entity: 's1', label: '' }, { kind: 'slide', entity: 's1', label: 'x' }));
  ok('targets: a question is its own card, a template card names entity + template; the same card by its key, a slide by its entry');

  const docs = [
    { id: 'f1', data: FB.feedbackData({ target: question, category: 'wrong', text: ' Odpowiedź to 1815, nie 1816. ', at: '2026-11-19T10:00:00Z', state: 'open' }) },
    { id: 'f2', data: FB.feedbackData({ target: fromTemplate, category: 'good', text: '', at: '2026-11-20T10:00:00Z', state: 'done' }) },
    { id: 'f3', data: FB.feedbackData({ target: { kind: 'slide', entity: 's1', label: 'Becchi' }, category: 'language', text: 'Literówka', at: '2026-11-20T11:00:00Z', state: 'open' }) }
  ];
  const lib = {
    docs: (k) => (k === 'feedback' ? docs : []),
    entity: (id) => ({ q1: { id: 'q1' }, p1: { id: 'p1' }, s1: { id: 's1' } })[id],
    label: (e) => ({ q1: 'Kiedy urodził się?', p1: 'Jan Bosko', s1: 'Becchi' })[e.id],
    templates: () => [{ id: 't1', name: 'Osoba → rok' }]
  };
  const named = (id) => ({ q1: 'bosko/q1', p1: 'bosko/jan', s1: 'bosko/becchi', t1: 'osoba-rok' })[id] ?? id;
  const ai = FB.feedbackForAi(lib, named);
  assert.deepEqual(ai.map((x) => x.id), ['f3', 'f1', 'f2']);
  assert.deepEqual(ai[1].target, { kind: 'question', entity: '@bosko/q1', entityTitle: 'Kiedy urodził się?', card: 'k-q', shownAs: 'Kiedy?' });
  assert.equal(ai[1].text, 'Odpowiedź to 1815, nie 1816.');
  assert.equal(ai[2].target.template, '@osoba-rok'); assert.equal(ai[2].target.templateName, 'Osoba → rok');
  assert.ok(ai.every((x) => typeof x.means === 'string' && !('by' in x) && !('account' in x)));
  ok('for the AI: lasting names, the category in words, open before done (newest first), no person');
  console.log(`\n${passed} passed, 0 failed`);
} catch (e) {
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
  process.exit(process.exitCode ?? 0);
}
