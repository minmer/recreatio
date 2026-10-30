/**
 * 2026-10-29 — MOJE DANE ALS JSON ("recreatio/persons", `account/personsJson.ts`), nachgemessen.
 *
 *   1. Jeder Schlüssel des Beispiels ist beschrieben; die Beschreibung ist ohne Zusammenhang aufrufbar (MCP) und
 *      nennt jedes der sieben Felder (`PERSON_FIELDS`, dieselben wie `ck_person_value_field`).
 *   2. Export → Import ändert nichts — auch nicht an Werten, die früher frei getippt wurden.
 *   3. Nur die eigenen Personen, nur nach Kennung: ohne Kennung, mit fremder Kennung — nichts, mit einem Wort.
 *      Eine Person entsteht nie aus einem Dokument.
 *   4. Gelöscht wird nicht: ein leeres Feld ist kein Löschen. Schiefe Werte geben Warnungen, keine Abstürze.
 *   5. Der Plan nennt die Abschriften, die nachgezogen werden; der Lauf geht weiter, wenn ein Feld scheitert.
 *
 *   node scripts/app-json-persons-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-json-persons-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}account/personsJson';
export { PERSON_FIELDS, FIELD_LABEL } from '${app}account/person';
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
  const today = new Date(2026, 9, 29, 12, 0, 0);

  /* -- 1 ---------------------------------------------------------------------------------------- */
  const text = m.personsDescription();
  assert.equal(m.PERSONS_FORMAT, 'recreatio/persons');
  assert.ok(text.startsWith(`# Moje dane jako JSON ("${m.PERSONS_FORMAT}", wersja 1)`), 'a heading with the format id');
  const samples = m.samplesOf(m.PERSONS_JSON);
  assert.ok(samples.length >= 1);
  for (const sample of samples) documented(`sample „${sample.label}”`, sample.doc(), m.PERSONS_KEYS);
  for (const key of Object.keys(m.PERSONS_KEYS)) assert.ok(text.includes(`"${key.split(/[.[\]]+/).filter(Boolean).pop()}" — `), `the description explains "${key}"`);
  assert.deepEqual([...m.PERSON_FIELDS].sort(), ['address', 'born', 'email', 'given_name', 'nickname', 'phone', 'surname'], 'the seven fields of the service');
  for (const field of m.PERSON_FIELDS) assert.ok(text.includes(`"${field}" — `), `the description names ${field}`);
  /* Das Beispiel schliesst den ersten Abschnitt — danach kommt „Jak aplikacja używa tych danych" (2026-10-30). */
  const exampleAt = text.indexOf('Przykład:') + 'Przykład:'.length;
  const exampleEnd = text.indexOf('\n\n#', exampleAt);
  const example = JSON.parse(text.slice(exampleAt, exampleEnd < 0 ? text.length : exampleEnd).trim());
  assert.deepEqual(example, samples[0].doc(), 'the example in the text is the sample');
  assert.ok(text.includes('\n## Jak aplikacja używa tych danych\n'), 'the description says how the app uses the data');
  ok('description: callable without context, every key of the sample described, the seven fields named, how the app uses them');

  /* -- 2 ---------------------------------------------------------------------------------------- */
  const ME = '0190a0a0-0000-7000-8000-0000000000b1';
  const CHILD = '0190a0a0-0000-7000-8000-0000000000b2';
  const persons = [
    {
      roleId: ME, name: 'Anna',
      values: new Map([['given_name', 'Anna'], ['surname', 'Kowalska'], ['phone', '+48 600 100 200'], ['born', '14.05.1987'], ['address', 'ul. Długa 5/3, 31-147 Kraków']]),
      releases: [{ field: 'phone', areaName: 'Parafia św. Józefa' }, { field: 'phone', areaName: 'Schola' }, { field: 'surname', areaName: 'Schola' }]
    },
    { roleId: CHILD, name: null, values: new Map([['given_name', 'Jaś'], ['born', 'wiosna 2015']]), releases: [] }
  ];
  const doc = JSON.parse(JSON.stringify(m.exportPersons(persons)));
  documented('export', doc, m.PERSONS_KEYS);
  assert.deepEqual(doc.persons.map((p) => p.id), [ME, CHILD], 'every person with her id');
  assert.deepEqual(doc.persons[0].shared, { phone: ['Parafia św. Józefa', 'Schola'], surname: ['Schola'] }, 'who got which field — for information');
  assert.equal(doc.persons[1].email, '', 'an empty field is there, empty — to fill in');
  const same = m.planPersons(doc, persons, today);
  assert.ok(!('error' in same));
  assert.deepEqual([same.changes, same.warnings], [[], []], `an export changes nothing — not even a date typed freely long ago: ${same.warnings.join(' | ')}`);
  assert.ok(same.lines.includes('Nic do zmiany.') && same.lines.some((l) => l.startsWith('Bez zmian: 7 pól')), same.lines.join(' | '));
  ok('export → plan: nothing to change, ids kept, legacy free-typed values not flagged');

  /* -- 3 ---------------------------------------------------------------------------------------- */
  doc.persons[0].phone = '+48 601 999 888';
  doc.persons[0].born = '1987-05-14';
  doc.persons[0].email = 'anna@example.pl';
  doc.persons[1].nickname = 'Jasiek';
  doc.persons.push({ given_name: 'Ktoś' }, { id: '0190a0a0-0000-7000-8000-0000000000ff', given_name: 'Obcy' }, { id: ME, phone: '1' });
  const changed = m.planPersons(doc, persons, today);
  assert.deepEqual(changed.changes.map((c) => [c.roleId, c.field, c.value, c.was]), [
    [ME, 'phone', '+48 601 999 888', '+48 600 100 200'],
    [ME, 'born', '1987-05-14', '14.05.1987'],
    [ME, 'email', 'anna@example.pl', null],
    [CHILD, 'nickname', 'Jasiek', null]
  ], 'changes in place, by id; a new value where there was none');
  assert.equal(changed.warnings.length, 3, `without an id, a foreign id, the same person twice — each said: ${changed.warnings.join(' | ')}`);
  assert.ok(changed.warnings[0].includes('nie zakłada osób') && changed.warnings[1].includes('nie jest osoba tego konta') && changed.warnings[2].includes('drugi raz'));
  assert.ok(changed.lines.some((l) => l.startsWith('Zmiana odświeży też kopie udostępnione: Parafia św. Józefa (telefon), Schola (telefon)')), `the copies to refresh are named: ${changed.lines.join(' | ')}`);
  assert.ok(!changed.lines.some((l) => l.includes('(nazwisko)')), 'a field that does not change refreshes nothing');
  ok('only own persons, only by id: no person is created, a foreign id changes nothing; the copies to refresh are named');

  /* -- 4 ---------------------------------------------------------------------------------------- */
  const odd = m.planPersons({
    format: m.PERSONS_FORMAT, version: 3, colour: 'red',
    persons: [{
      id: ME, given_name: '', surname: null, phone: 'zadzwoń', born: '1987-02-30', email: 'anna(at)example', nickname: 'x'.repeat(101),
      address: 'ul. Krótka 1\n00-001 Warszawa', extra: 1
    }, 'nonsense', null]
  }, persons, today);
  assert.ok(!('error' in odd));
  assert.deepEqual(odd.changes.map((c) => [c.field, c.value]), [['address', 'ul. Krótka 1, 00-001 Warszawa']], 'an address on two lines becomes one; nothing else is readable');
  const said = odd.warnings.join(' | ');
  for (const word of ['Wersja 3', '"colour"', '"extra"', 'Imię', 'Nazwisko', 'Telefon', 'Data urodzenia', 'E-mail', 'Przezwisko', 'Osoba 2', 'Osoba 3']) assert.ok(said.includes(word), `said: ${word} — ${said}`);
  assert.ok(odd.warnings.some((w) => w.includes('Imię') && w.includes('nie usuwa')) && odd.warnings.some((w) => w.includes('Nazwisko') && w.includes('nie usuwa')), 'neither "" nor null is a deletion');
  for (const bad of [null, 'x', 7, [], { format: 'recreatio/contacts', persons: [] }, { persons: 'x' }]) assert.ok('error' in m.planPersons(bad, persons, today), `not a document: ${JSON.stringify(bad)}`);
  assert.equal(m.planPersons({ persons: [{ id: ME, born: '2030-01-01' }] }, persons, today).changes.length, 0, 'a birthday in the future is no birthday');
  assert.deepEqual(m.planPersons({ persons: [{ id: CHILD, born: '1.6.2015', phone: 600100200 }] }, persons, today).changes.map((c) => [c.field, c.value]), [['phone', '600100200'], ['born', '2015-06-01']],
    'a Polish date becomes "RRRR-MM-DD"; a number is read as text');
  ok('odd values: warnings, no crash; empty and null never delete; dates, e-mails and phones checked');

  /* -- 5 ---------------------------------------------------------------------------------------- */
  const calls = [];
  const done = await m.applyPersons(changed, async (roleId, field, value) => {
    calls.push([roleId, field, value]);
    if (field === 'email') throw new Error('Nie udało się.');
    return field === 'phone' ? { refreshed: ['Parafia św. Józefa'], couldNot: ['Schola'] } : { refreshed: [], couldNot: [] };
  }, () => undefined);
  assert.equal(calls.length, 4, 'every change through the one sealing path, in order');
  assert.ok(done.lines.includes('Zapisane pola: 3') && done.lines.some((l) => l.includes('Parafia św. Józefa')), done.lines.join(' | '));
  assert.ok(done.warnings.some((w) => w.includes('E-mail')) && done.warnings.some((w) => w.includes('Schola')), `a failure and a copy not refreshed are said: ${done.warnings.join(' | ')}`);
  const sample = m.planPersons(JSON.parse(JSON.stringify(samples[0].doc())), [{ roleId: samples[0].doc().persons[0].id, name: 'Anna', values: new Map(), releases: [] }], today);
  assert.ok(sample.warnings.length === 0 && sample.changes.length === 6, `the sample plans cleanly: ${sample.warnings.join(' | ')}`);
  ok('apply: one call per field, a failure does not stop the rest, copies not refreshed are said; the sample plans cleanly');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
