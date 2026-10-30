/**
 * 2026-10-29 — DER WIDOK ALS JSON ("recreatio/workspace-view", `workspace/viewJson.ts`), nachgemessen.
 *
 *   1. Jeder Schlüssel des Beispiels ist beschrieben; die Beschreibung ist ohne Zusammenhang aufrufbar (MCP) und
 *      nennt jede Art von „Czeka na Ciebie" — auch eine, die später dazukommt (sie wird aus `ALERT_KINDS` erzeugt).
 *   2. Export → Import ändert nichts.
 *   3. Was das Dokument nennt, steht oben in seiner Reihenfolge; was es nicht nennt, behält Ein/Aus und folgt in
 *      der bisherigen Reihenfolge — und das Ergebnis liest `readAlerts` unverändert zurück.
 *   4. Schiefe Werte geben Warnungen, keine Abstürze.
 *
 *   node scripts/app-json-view-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-json-view-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}workspace/viewJson';
export { ALERT_KINDS, DEFAULT_ALERTS, readAlerts, alertsJson, toggleAlert, moveAlert } from '${app}workspace/alerts';
export { describe, samplesOf } from '${app}core/jsonTree';
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

const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function pathsOf(value, prefix = '', out = new Set()) {
  for (const [key, one] of Object.entries(value)) {
    const path = `${prefix}${key}`;
    out.add(path);
    if (isPlain(one)) pathsOf(one, `${path}.`, out);
    else if (Array.isArray(one)) for (const item of one) if (isPlain(item)) pathsOf(item, `${path}[].`, out);
  }
  return out;
}

const top = (path) => path.split(/[.[]/)[0];

function documented(label, example, keys) {
  const paths = pathsOf(example);
  for (const path of paths) assert.ok(keys[path] !== undefined, `${label}: "${path}" is in the example but not described`);
  const tops = new Set([...paths].map(top));
  for (const key of Object.keys(keys)) assert.ok(tops.has(top(key)), `${label}: "${key}" is described but not in the example`);
  for (const [key, says] of Object.entries(keys)) assert.ok(typeof says === 'string' && says.trim().length > 3, `${label}: "${key}" has a real sentence`);
}

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1 ---------------------------------------------------------------------------------------- */
  const text = m.workspaceViewDescription();
  assert.equal(m.VIEW_FORMAT, 'recreatio/workspace-view');
  assert.ok(text.startsWith(`# Widok — powiadomienia jako JSON ("${m.VIEW_FORMAT}", wersja 1)`), 'a heading with the format id');
  const samples = m.samplesOf(m.VIEW_JSON);
  assert.ok(samples.length >= 1);
  for (const sample of samples) documented(`sample „${sample.label}”`, sample.doc(), m.VIEW_KEYS);
  for (const key of Object.keys(m.VIEW_KEYS)) assert.ok(text.includes(`"${key.split(/[.[\]]+/).filter(Boolean).pop()}" — `), `the description explains "${key}"`);
  for (const kind of m.ALERT_KINDS) assert.ok(text.includes(`"${kind.kind}" — ${kind.label}`), `the description names the kind ${kind.kind}`);
  assert.ok(text.includes('stały'), 'and says that the layout is fixed');
  /* Das Beispiel schliesst den ersten Abschnitt — danach kommt „Jak aplikacja używa tych danych" (2026-10-30). */
  const exampleAt = text.indexOf('Przykład');
  const exampleEnd = text.indexOf('\n\n#', exampleAt);
  const example = JSON.parse(text.slice(exampleAt, exampleEnd < 0 ? text.length : exampleEnd).replace(/^[^\n]*\n/, ''));
  assert.deepEqual(example, samples[0].doc(), 'the example in the text is the sample');
  assert.ok(text.includes('\n## Jak aplikacja używa tych danych\n'), 'the description says how the app uses the data');
  ok(`description: callable without context, every key described, all ${m.ALERT_KINDS.length} kinds named, the fixed layout said, how the app uses it`);

  /* -- 2 ---------------------------------------------------------------------------------------- */
  const mine = m.toggleAlert(m.moveAlert(m.moveAlert(m.DEFAULT_ALERTS, 'chats', -1), 'links', -1), 'today', false);
  const doc = JSON.parse(JSON.stringify(m.exportView(mine)));
  documented('export', doc, m.VIEW_KEYS);
  assert.deepEqual(doc.alerts.map((a) => a.kind), mine.order, 'every kind, in the own order');
  const same = m.planView(doc, mine);
  assert.ok(!('error' in same));
  assert.deepEqual([same.changed, same.warnings, same.next], [false, [], mine], 'an export changes nothing');
  ok('export → plan: no change, no warning, the same order and the same kinds off');

  /* -- 3 ---------------------------------------------------------------------------------------- */
  const partial = m.planView({ format: m.VIEW_FORMAT, alerts: [{ kind: 'records', on: true }, 'bookings', { kind: 'forms', on: false }] }, m.DEFAULT_ALERTS);
  const order = m.DEFAULT_ALERTS.order;
  assert.deepEqual(partial.next.order.slice(0, 3), ['records', 'bookings', 'forms'], 'named kinds first, in the order of the document');
  const rest = partial.next.order.slice(3);
  assert.deepEqual(rest, order.filter((k) => !['records', 'bookings', 'forms'].includes(k)), 'the others keep their order behind them');
  assert.deepEqual(partial.next.off, ['forms'], 'only what "on": false says goes off');
  assert.equal(partial.changed, true);
  assert.ok(partial.lines.some((l) => l.startsWith('Nowa kolejność:')) && partial.lines.some((l) => l.startsWith('Wyłączy:')), partial.lines.join(' | '));
  assert.deepEqual(m.readAlerts(m.alertsJson(partial.next)), partial.next, 'what is saved reads back the same');
  /* „steps" nach oben: nur sie — was bisher hinter ihr stand, wandert nicht mit. */
  const topOnly = m.planView({ alerts: ['steps'] }, mine);
  assert.deepEqual(topOnly.next.order, ['steps', ...mine.order.filter((k) => k !== 'steps')], 'one kind to the top, the rest as it was');
  assert.deepEqual(topOnly.next.off, mine.off, 'nothing named with "on", nothing switched');
  assert.ok(topOnly.lines.some((l) => l.startsWith('Brak w dokumencie')), topOnly.lines.join(' | '));
  const dropped = m.planView({ alerts: JSON.parse(JSON.stringify(m.exportView(mine))).alerts.filter((a) => a.kind !== 'learn') }, mine);
  assert.deepEqual(dropped.next.order, [...mine.order.filter((k) => k !== 'learn'), 'learn'], 'a kind left out of a full list follows the named ones');
  const on = m.planView({ alerts: [{ kind: 'today', on: true }] }, mine);
  assert.deepEqual([on.next.off, on.lines.some((l) => l.startsWith('Włączy:'))], [[], true], 'switched back on');
  ok('in place: named kinds on top in the document\'s order, the rest after them as they were, with their own on/off; saved settings read back the same');

  /* -- 4 ---------------------------------------------------------------------------------------- */
  for (const bad of [null, 'x', 1, []]) assert.ok('error' in m.planView(bad, mine), `not a document: ${JSON.stringify(bad)}`);
  assert.ok('error' in m.planView({ format: 'recreatio.view' }, mine), 'the old builder format is another format');
  assert.ok('error' in m.planView({ alerts: 'forms' }, mine), 'alerts must be a list');
  const nothing = m.planView({ format: m.VIEW_FORMAT }, mine);
  assert.deepEqual([nothing.changed, nothing.next], [false, mine], 'no "alerts": nothing');
  const odd = m.planView({ version: 2, parts: [], alerts: ['forms', 'forms', 'bogus', 7, null, { kind: 'chats', on: 'yes', colour: 'red' }] }, mine);
  assert.ok(!('error' in odd));
  assert.ok(odd.warnings.length === 8, `each odd thing is said (version, parts, repeated, unknown kind, two non-entries, unknown key, bad "on"): ${odd.warnings.join(' | ')}`);
  assert.ok(odd.warnings.some((w) => w.includes('stały')), 'parts: the layout is fixed');
  assert.deepEqual(odd.next.off, mine.off, 'a bad "on" switches nothing');
  const sample = m.planView(JSON.parse(JSON.stringify(samples[0].doc())), m.DEFAULT_ALERTS);
  assert.ok(!('error' in sample) && sample.warnings.length === 0 && sample.changed, `the sample plans cleanly: ${sample.warnings?.join(' | ')}`);
  ok('odd documents: errors for non-documents, warnings for unknown and repeated kinds and odd values, no crash; the sample plans cleanly');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
