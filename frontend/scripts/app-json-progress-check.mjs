/**
 * 2026-10-29 — MOJE POSTĘPY ALS JSON ("recreatio/learn-progress", `cogita/progressJson.ts`), nachgemessen.
 *
 *   1. Jeder Schlüssel des Beispiels ist beschrieben; die Beschreibung ist ohne Zusammenhang aufrufbar (MCP).
 *   2. Export → Import fügt nichts hinzu: jede Antwort ist schon da, jede Kennung bleibt.
 *   3. Eine Antwort ohne Kennung ist neu (mit neuer Kennung, Frage und Richtung aus der Karte) — ausser es gibt
 *      schon eine auf dieselbe Karte im selben Augenblick. Ein Dokument einer anderen Baza wird abgelehnt.
 *   4. Schiefe Werte geben gezählte Warnungen, keine Abstürze; Grenzen (Anzahl, Länge, Zeit) halten.
 *   5. Hinein geht es durch den Weg jeder Antwort: `Learner.adopt` → ein versiegelter Stapel für DIESEN Halter —
 *      beim Dienst kommt kein Klartext an, und der Halter öffnet genau die Antworten wieder.
 *
 *   node scripts/app-json-progress-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-json-progress-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}cogita/progressJson';
export { Learner, openOwn, absorb, EMPTY_PROGRESS } from '${app}cogita/learn';
export { newWrapPair } from '${app}core/crypto';
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

const realFetch = globalThis.fetch;

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);
  const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
  const LIB = '0190a0a0-0000-7000-8000-0000000000c1';

  /* -- 1 ---------------------------------------------------------------------------------------- */
  const text = m.learnProgressDescription();
  assert.equal(m.PROGRESS_FORMAT, 'recreatio/learn-progress');
  assert.ok(text.startsWith(`# Moje postępy jako JSON ("${m.PROGRESS_FORMAT}", wersja 1)`), 'a heading with the format id');
  const samples = m.samplesOf(m.PROGRESS_JSON);
  assert.ok(samples.length >= 1);
  for (const sample of samples) documented(`sample „${sample.label}”`, sample.doc(), m.PROGRESS_KEYS);
  for (const key of Object.keys(m.PROGRESS_KEYS)) assert.ok(text.includes(`"${key.split(/[.[\]]+/).filter(Boolean).pop()}" — `), `the description explains "${key}"`);
  const example = JSON.parse(text.slice(text.indexOf('Przykład:') + 'Przykład:'.length).trim());
  assert.deepEqual(example, samples[0].doc(), 'the example in the text is the sample');
  assert.ok(text.includes('nigdy do cudzych'), 'and says that it never writes for someone else');
  ok('description: callable without context, every key of the sample described');

  /* -- 2 ---------------------------------------------------------------------------------------- */
  const answer = (id, key, at, correctness, extra = {}) => {
    const bar = key.indexOf('|');
    return { id, key, question: bar < 0 ? key : key.slice(0, bar), direction: bar < 0 ? '' : key.slice(bar + 1), fingerprint: 'fp1', at, correctness, ...extra };
  };
  const mine = [
    answer('a1', 'daty:e1|a-b', NOW - 3 * 86_400_000, 1, { ms: 5300, given: '1410', via: 'revision:r1' }),
    answer('a2', 'daty:e1|b-a', NOW - 2 * 86_400_000, 0.5),
    answer('a3', 'q:hand', NOW - 86_400_000, 0, { given: 'nie wiem' })
  ];
  const existing = new Map(mine.map((a) => [a.id, a]));
  const cardKeys = new Set(['daty:e1|a-b', 'daty:e1|b-a', 'q:hand']);
  const doc = JSON.parse(JSON.stringify(m.exportProgress({ libraryId: LIB, name: 'Historia', answers: existing.values(), textOf: (key) => (key === 'q:hand' ? 'Kto napisał „Pana Tadeusza”?' : undefined) })));
  documented('export', doc, m.PROGRESS_KEYS);
  assert.deepEqual(doc.answers.map((a) => a.id), ['a1', 'a2', 'a3'], 'every answer with its id, oldest first');
  assert.equal(doc.answers[0].at, new Date(NOW - 3 * 86_400_000).toISOString(), 'the moment as ISO');
  assert.equal(doc.answers[2].text, 'Kto napisał „Pana Tadeusza”?', 'what the card asked, for an analysis');
  const ctx = { libraryId: LIB, existing, cardKeys, now: NOW };
  const same = m.planProgress(doc, ctx);
  assert.ok(!('error' in same));
  assert.deepEqual([same.answers.length, same.warnings], [0, []], `an export adds nothing: ${same.warnings.join(' | ')}`);
  assert.ok(same.lines.some((l) => l.startsWith('Już są w Twoich postępach: 3')) && same.lines.includes('Nic nowego — wszystkie odpowiedzi już są.'), same.lines.join(' | '));
  ok('export → plan: every answer already there, every id kept, nothing new');

  /* -- 3 ---------------------------------------------------------------------------------------- */
  let n = 0;
  const makeId = () => `new-${++n}`;
  const fresh = m.planProgress({
    format: m.PROGRESS_FORMAT, library: { id: LIB, name: 'Historia' },
    answers: [
      { key: 'daty:e1|a-b', at: NOW - 3600_000, correctness: true, ms: 4000.4, given: 'x'.repeat(500) },
      { key: 'daty:e1|a-b', at: new Date(NOW - 3 * 86_400_000).toISOString(), correctness: 1 },
      { id: 'b9', key: 'q:hand', at: NOW - 7200_000, correctness: 0.75, fingerprint: 'fp2', via: 'session:s1' },
      { key: 'gone:x', at: NOW - 60_000, correctness: 0 }
    ]
  }, { ...ctx, makeId });
  assert.deepEqual(fresh.answers.map((a) => [a.id, a.key, a.question, a.direction, a.correctness]), [
    ['new-1', 'daty:e1|a-b', 'daty:e1', 'a-b', 1],
    ['b9', 'q:hand', 'q:hand', '', 0.75],
    ['new-2', 'gone:x', 'gone:x', '', 0]
  ], 'new answers: a fresh id without one, question and direction from the key; the same card at the same moment is the same answer');
  assert.equal(fresh.answers[0].ms, 4000, 'milliseconds rounded');
  assert.equal(fresh.answers[0].given.length, 400, '"given" clipped like every answer');
  assert.ok(fresh.lines.some((l) => l.startsWith('Nowe odpowiedzi: 3')) && fresh.lines.some((l) => l.startsWith('Już są w Twoich postępach: 1')), fresh.lines.join(' | '));
  assert.ok(fresh.warnings.length === 1 && fresh.warnings[0].includes('nie pasuje do żadnej karty'), `an answer to a card that is not here is said: ${fresh.warnings.join(' | ')}`);
  const renamed = m.planProgress({ answers: [{ key: 'gone:x', at: NOW - 60_000, correctness: 0 }] }, { ...ctx, makeId, rename: (key) => key.replace('gone:', 'q:').replace(':x', ':hand') });
  assert.equal(renamed.warnings.length, 0, 'a merged entry: the answer counts at its new card');
  const foreign = m.planProgress({ library: { id: 'another', name: 'Biologia' }, answers: [] }, ctx);
  assert.ok('error' in foreign && foreign.error.includes('Biologia'), 'a document of another base is refused');
  ok('new answers: fresh ids, the same moment not twice, another base refused, merged entries followed');

  /* -- 4 ---------------------------------------------------------------------------------------- */
  for (const bad of [null, 'x', 3, [], { format: 'recreatio.cogita.course' }, { answers: 'x' }]) assert.ok('error' in m.planProgress(bad, ctx), `not a document: ${JSON.stringify(bad)}`);
  const odd = m.planProgress({
    version: 2, who: 'someone-else', library: 'x',
    answers: [
      null, 'x', { at: NOW, correctness: 1 }, { key: 'q:hand', correctness: 1 }, { key: 'q:hand', at: '2019-01-01', correctness: 1 },
      { key: 'q:hand', at: NOW + 7 * 86_400_000, correctness: 1 }, { key: 'q:hand', at: NOW - 10, correctness: 'tak' },
      { key: 'q:hand', at: NOW - 20, correctness: 3, ms: -5, given: 42, via: {}, holder: 'r:obcy' },
      { key: 'q:hand', at: NOW - 30, correctness: 0.5 }, { key: 'q:hand', at: NOW - 30, correctness: 0.5 },
      { id: 'dup', key: 'q:hand', at: NOW - 40, correctness: 1 }, { id: 'dup', key: 'q:hand', at: NOW - 41, correctness: 1 },
      { key: 'k'.repeat(401), at: NOW - 50, correctness: 1 }
    ]
  }, { ...ctx, makeId });
  assert.ok(!('error' in odd), 'odd values plan');
  assert.deepEqual(odd.answers.map((a) => a.correctness), [1, 0.5, 1], 'only the readable answers; correctness clipped to 0–1');
  const said = odd.warnings.join(' | ');
  for (const word of ['Wersja 2', '"who"', '"library" to nie obiekt', 'bez "key"', '"at"', '"correctness" to nie liczba', 'przycięte', '"ms"', '"given"', '"via"', '"holder"', 'drugi raz', 'dłuższy niż']) assert.ok(said.includes(word), `said: ${word} — ${said}`);
  assert.ok(odd.warnings.some((w) => /^2 odpowiedzi \(np\. 1, 2\): to nie obiekt/.test(w)), `odd answers are counted, not repeated: ${said}`);
  const many = m.planProgress({ answers: Array.from({ length: m.MAX_ANSWERS + 3 }, (_, i) => ({ key: 'q:hand', at: NOW - 1000 - i, correctness: 1 })) }, { ...ctx, makeId });
  assert.equal(many.answers.length, m.MAX_ANSWERS, `at most ${m.MAX_ANSWERS} at once`);
  assert.ok(many.warnings.some((w) => w.includes(String(m.MAX_ANSWERS))) && many.lines[0].includes(`${Math.ceil(m.MAX_ANSWERS / m.PER_BATCH)} nowych pakietów`), many.lines.join(' | '));
  ok('odd documents: errors for non-documents, counted warnings for odd answers, no crash; limits of count, length and time hold');

  /* -- 5: durch den Weg jeder Antwort ------------------------------------------------------------- */
  const pair = await m.newWrapPair();
  const holder = { kind: 'role', roleId: 'r-me', wrapPublicKey: pair.publicKey, wrapPrivate: async () => pair.privateKey };
  const learner = new m.Learner(LIB, holder, { areaId: 'area-course', intake: null });
  const posted = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    posted.push({ url: String(url), raw: init.body, body });
    return new Response(JSON.stringify({ stored: body.batches.map((b) => b.batchId) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const stages = [];
  const done = await m.applyProgress(fresh, learner, (s) => stages.push(s));
  assert.equal(posted.length, 1, 'one batch for three answers');
  assert.ok(posted[0].url.endsWith('/workspace/learn/batches'), 'to the own batches of the account');
  const batch = posted[0].body.batches[0];
  assert.deepEqual([batch.libraryId, batch.areaId, batch.holderRoleId, batch.kind], [LIB, 'area-course', 'r-me', 'answers'], 'for this holder, into the course area');
  assert.ok(typeof batch.sealed === 'string' && typeof batch.keyForHolder === 'string' && batch.keyForArea === undefined, 'sealed, with the key for the holder (no intake here)');
  for (const plain of ['daty:e1|a-b', 'session:s1', 'gone:x', '"correctness"']) assert.ok(!posted[0].raw.includes(plain), `nothing in clear text reaches the service: ${plain}`);
  const opened = await m.openOwn(holder, { ...batch, holderSeatId: null, key: batch.keyForHolder, createdAt: '' });
  assert.deepEqual(opened.answers, fresh.answers, 'the holder opens exactly the imported answers');
  assert.deepEqual([...fresh.answers].map((a) => learner.progress.answers.get(a.id)?.key), fresh.answers.map((a) => a.key), 'and they count at once in the own progress');
  assert.deepEqual([done.lines, done.warnings, stages], [['Dopisane odpowiedzi: 3'], [], ['Pieczętowanie pakietu 1 z 1…']]);
  const again = m.planProgress(JSON.parse(JSON.stringify(m.exportProgress({ libraryId: LIB, name: 'Historia', answers: learner.progress.answers.values() }))), { ...ctx, existing: learner.progress.answers });
  assert.equal(again.answers.length, 0, 'exported again and imported again: nothing new');

  /* Ohne Netz: der Stapel wartet (die Ablage dieses Laufs ist leer — kein IndexedDB in node), nichts bricht. */
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  const offline = new m.Learner(LIB, holder, { areaId: 'area-course', intake: null });
  await m.applyProgress(m.planProgress({ answers: [{ key: 'q:hand', at: NOW - 5, correctness: 1 }] }, { ...ctx, makeId }), offline, () => undefined);
  assert.equal(offline.progress.answers.size, 1, 'offline: the answer counts here and waits to go out');

  const chunks = [];
  await m.applyProgress(many, { waiting: 2, adopt: async (list) => { chunks.push(list.length); } }, () => undefined);
  assert.deepEqual(chunks, [...Array(Math.floor(m.MAX_ANSWERS / m.PER_BATCH)).fill(m.PER_BATCH), m.MAX_ANSWERS % m.PER_BATCH].filter((x) => x > 0), `batches of at most ${m.PER_BATCH}`);
  const sample = m.planProgress(JSON.parse(JSON.stringify(samples[0].doc())), { libraryId: samples[0].doc().library.id, existing: new Map(), cardKeys: null, now: NOW, makeId });
  assert.ok(!('error' in sample) && sample.warnings.length === 0 && sample.answers.length === 2, `the sample plans cleanly: ${sample.warnings?.join(' | ')}`);
  ok('apply: through Learner.adopt — one sealed batch per 400 answers for this holder only, no clear text to the service, opened again by the holder; offline it waits; the sample plans cleanly');
} finally {
  globalThis.fetch = realFetch;
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
