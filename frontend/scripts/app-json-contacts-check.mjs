/**
 * 2026-10-29 — KONTAKTE ALS JSON (`phone/contactsJson.ts`), nachgemessen: jeder Schlüssel ist beschrieben, ein
 * unveränderter Export ändert nichts, mit "id" wird in place geändert, ohne "id" ergänzt oder angelegt, Unlesbares
 * wird gewarnt statt zu stürzen.
 *
 *   node scripts/app-json-contacts-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = await mkdtemp(join(tmpdir(), 'app-json-contacts-'));
await build({
  entryPoints: { contacts: 'src/app/phone/contactsJson.ts', tree: 'src/app/core/jsonTree.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error',
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(out, 'contacts.js')).href);
const tree = await import(pathToFileURL(join(out, 'tree.js')).href);

let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };

try {
  const text = tree.describe(m.CONTACTS_JSON);
  const sample = m.CONTACTS_JSON.samples()[0].doc();
  const sampleKeys = new Set(sample.contacts.flatMap((c) => Object.keys(c)));
  for (const key of sampleKeys) assert.ok(m.CONTACT_JSON_KEYS.includes(key), `sample key ${key} is described`);
  for (const key of m.CONTACT_JSON_KEYS) assert.ok(text.includes(`"${key}" — `), `the description explains ${key}`);
  assert.ok(text.includes('\n## Jak aplikacja używa tych danych\n'), 'the description says how the app uses the data');
  ok(`every key is described (${m.CONTACT_JSON_KEYS.length}), the description stands without context and says how the app uses the contacts`);

  const existing = [
    { id: 'c1', version: 3, updatedAt: '', name: 'Anna Kowalska', given: 'Anna', family: 'Kowalska', org: null, title: null, phones: [{ number: '+48 600 100 200', label: 'komórka' }], emails: [], note: null, birthday: null, groups: ['Schola'], source: { kind: 'phone', key: 'raw:1' } },
    { id: 'c2', version: 1, updatedAt: '', name: 'ks. Marek Nowak', given: null, family: null, org: 'Parafia', title: null, phones: [{ number: '+48 22 123 45 67', label: null }], emails: [], note: null, birthday: null, groups: [], source: null }
  ];
  const exported = JSON.parse(JSON.stringify(m.exportContactsJson(existing)));
  const same = m.planContactsJson(exported, existing);
  assert.deepEqual([same.work.length, same.warnings.length, same.lines[0]], [0, 0, 'Bez zmian — wszystko jest już w kontaktach.']);
  ok('export → import of an unchanged document changes nothing');

  exported.contacts[0].note = 'alt w scholi';
  exported.contacts.push({ name: 'ks. Marek Nowak', phones: ['+48 22 123 45 67', '+48 501 000 111'] });
  exported.contacts.push({ given: 'Jan', family: 'Zieliński', emails: ['jan@example.pl'] });
  const plan = m.planContactsJson(exported, existing);
  const byId = new Map(plan.work.map((w) => [w.id, w]));
  assert.equal(byId.get('c1').data.note, 'alt w scholi');
  assert.equal(byId.get('c1').version, 3, 'the version of the change is the stored one');
  assert.deepEqual(byId.get('c1').data.groups, ['Schola'], 'what the document does not change stays');
  assert.equal(byId.get('c1').data.source?.key, 'raw:1', 'the phone key stays with the contact');
  assert.equal(byId.get('c2').data.phones.length, 2, 'without id: found by name and a common number, completed');
  const fresh = plan.work.filter((w) => w.id === null);
  assert.deepEqual(fresh.map((w) => w.data.name), ['Jan Zieliński'], 'without id and not found: new, named from given + family');
  assert.deepEqual(plan.lines, ['Zmiana: „Anna Kowalska”', 'Uzupełniony: „ks. Marek Nowak”', 'Nowy: „Jan Zieliński”', 'Bez zmian: 1.']);
  ok('with id: changed in place (only the named fields); without id: completed or new; the plan says each');

  const bad = m.planContactsJson({ format: 'recreatio/contacts', version: 1, odd: 1, contacts: [
    { name: 'X', phones: 'nie lista', birthday: '14.05.1987', hobby: 'chór' }, 7, { note: 'bez nazwy' }, { id: 'nie-ma', name: 'Ktoś' }
  ] }, existing);
  assert.ok(!('error' in bad));
  const w = bad.warnings.join(' | ');
  for (const part of ['Nieznany klucz "odd"', '"phones" to nie lista', 'RRRR-MM-DD', 'nieznany klucz "hobby"', 'Kontakt 2: to nie obiekt', 'bez "name"', 'nie ma kontaktu o tym "id"']) assert.ok(w.includes(part), `warns: ${part} — ${w}`);
  assert.deepEqual(bad.work.filter((x) => x.id === null).map((x) => x.data.name).sort(), ['Ktoś', 'X']);
  assert.ok('error' in m.planContactsJson({ format: 'recreatio/page', contacts: [] }, existing));
  assert.ok('error' in m.planContactsJson([], existing));
  ok('unreadable values are warned about and skipped; another format or a non-object is refused');
} finally {
  await rm(out, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
