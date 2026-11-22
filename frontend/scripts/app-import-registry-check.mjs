/**
 * 2026-11-22 (A1, A3) — EINE PRÜFUNG FÜR JEDEN IMPORT (`src/app/importCheck/`) und GLEICHE MELDUNGEN ZUSAMMEN
 * (`core/messageGroups.ts`).
 *
 *   - jedes Format des Registers bekommt ein gutes Dokument (die Beispiele aus seiner Beschreibung, `templates/`) und ein
 *     kaputtes (kein JSON) — das gute geht durch, das kaputte ist genau ein Fehler; jedes Format aus `list_import_formats`
 *     (ausser Leitfäden) hat einen Adapter;
 *   - die Baza wiedzy aus ihrer Abschrift behält ihre Kennungen (Rodzaje, Einträge, Dokumente) — davon hängt ab, dass ein
 *     Dokument einen Eintrag an seiner Kennung trifft (die Stellen von `planImport`);
 *   - gegen die Baza: Änderung, Löschung, Verweis ins Leere — alle Fehler auf einmal;
 *   - die Gruppen: Duplikate und nur im Namen verschiedene Meldungen, die Reihenfolge, Einzelne bleiben ganz;
 *   - das Bündel des Dienstes (`backend/Api/Library/ImportCheck.js`) ist aktuell und läuft ohne Browser und ohne Node
 *     (ein nackter V8-Kontext, wie Jint).
 *
 *   node scripts/app-import-registry-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const workspace = await mkdtemp(join(tmpdir(), 'app-import-registry-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export { checkImport, CHECKERS, CHECK_FORMATS } from '${app}importCheck/registry';
export { restoreBase } from '${app}importCheck/knowledge';
export { groupMessages, messagePattern } from '${app}core/messageGroups';
export { samplesOf } from '${app}core/jsonTree';
export { CALENDAR_JSON } from '${app}calendar/calendarJson';
export { SCHEME_JSON, PLAN_JSON } from '${app}calendar/schemeJson';
export { TASKS_JSON } from '${app}calendar/tasksJson';
export { MASSES_JSON } from '${app}masses/massesJson';
export { BOOKINGS_JSON } from '${app}bookings/bookingsJson';
export { CHAT_JSON } from '${app}chat/chatJson';
export { CONTACTS_JSON } from '${app}phone/contactsJson';
export { ROLES_JSON } from '${app}roles/rolesJson';
export { LAMPS_JSON } from '${app}lamps/lampsJson';
export { PERSONS_JSON } from '${app}account/personsJson';
export { ADDRESSES_JSON } from '${app}pages/addressesJson';
export { VIEW_JSON } from '${app}workspace/viewJson';
export { PROGRESS_JSON } from '${app}cogita/progressJson';
export { LITURGY_JSON } from '${app}library/liturgy/liturgyJson';
export { AREA_JSON } from '${app}areas/areaJsonText';
export { EXAMPLES as COMMUNITY_EXAMPLES } from '${app}communities/communityExamples';
`);
await build({
  entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', jsx: 'automatic',
  plugins: [{ name: 'no-css', setup(b) { b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'no-css' })); b.onLoad({ filter: /.*/, namespace: 'no-css' }, () => ({ contents: '', loader: 'js' })); } }],
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let passed = 0;
const ok = (name) => { passed += 1; console.log(`ok   ${name}`); };
const template = async (name) => JSON.parse(await readFile(`../templates/${name}`, 'utf8'));
const sample = (tree, n = 0) => m.samplesOf(tree)[n]?.doc();

try {
  /* -- 1. Die Gruppen ----------------------------------------------------------------------------------------------- */
  const groups = m.groupMessages([
    'Wpis „A” używa koloru (.rot).', 'Drugi komunikat.', 'Wpis „B” używa koloru (.rot).', 'Drugi komunikat.', 'Wpis @kurs/c używa koloru (.rot).',
    'Wpis „A” używa koloru (.rot).', 'Pole 0199aaaa-0000-7000-8000-000000000001 puste.', 'Pole 0199aaaa-0000-7000-8000-000000000002 puste.', ''
  ]);
  assert.deepEqual(groups.map((g) => [g.count, g.examples.length]), [[3, 2], [2, 1], [1, 1], [2, 2]]);
  assert.equal(groups[0].text, 'Wpis „…” używa koloru (.rot).');
  assert.equal(groups[1].text, 'Drugi komunikat.', 'a duplicate keeps its whole text');
  assert.equal(groups[2].text, 'Wpis @kurs/c używa koloru (.rot).', 'a single message stays whole (a lasting name is not merged with a quoted one)');
  assert.equal(m.messagePattern('Zakres "od" i "do" w „Etap 1”'), 'Zakres "…" i "…" w „…”');
  assert.equal(m.messagePattern('appointments[12]: termin bez "title" — pominięty (3 razy).'), 'appointments[…]: termin bez "…" — pominięty (3 razy).', 'a position in a list is masked, other numbers stay');
  ok('messages: duplicates and messages differing only by quoted names, @names or ids are one group, in first-seen order; a single one stays whole');

  /* -- 2. Jedes Format hat einen Adapter -------------------------------------------------------------------------------- */
  const listed = JSON.parse(await readFile('../backend/Api/Library/ImportFormats.json', 'utf8')).formats.map((f) => f.id)
    .filter((id) => !id.startsWith('guide-') && !id.startsWith('example-') && !id.startsWith('scheme-'));
  const missing = listed.filter((id) => m.CHECKERS[id] === undefined);
  assert.deepEqual(missing, [], `formats without a check adapter: ${missing.join(', ')}`);
  ok(`every import format of list_import_formats has a check adapter (${listed.length})`);

  /* -- 3. Ein gutes und ein kaputtes Dokument je Format ---------------------------------------------------------------- */
  const good = {
    'knowledge-base': await template('cogita/przyklad-atom.json'),
    'knowledge-forms': { format: 'recreatio.cogita.course', version: 1, forms: (await template('cogita/pytania.json')).forms },
    'learn-progress': sample(m.PROGRESS_JSON) ?? { format: 'recreatio/learn-progress', version: 1, answers: [] },
    page: await template('cogita/przyklad-swiat-strona.json'),
    form: { kind: 'form', config: { title: 'Zapisy' }, questions: [{ label: 'Imię', kind: 'line' }] },
    area: sample(m.AREA_JSON),
    community: m.COMMUNITY_EXAMPLES[0].doc(),
    addresses: sample(m.ADDRESSES_JSON),
    library: { format: 'recreatio/library', version: 1, entries: [{ kinds: ['work'], data: { title: 'Jezus z Nazaretu' } }] },
    'work-with-text': { format: 'recreatio/source-text', version: 1, work: { kinds: ['work'], key: 'dzielo2026', data: { title: 'Dzieło' } }, portion: { key: 'r1', label: 'Rozdział 1' }, blocks: [{ type: 'paragraph', text: 'Tekst rozdziału.' }] },
    'source-text': { format: 'recreatio/source-text', version: 1, work: '@dzielo2026', portion: { key: 'r1', label: 'Rozdział 1' }, blocks: [{ type: 'paragraph', text: 'Tekst rozdziału.' }] },
    quotes: { format: 'recreatio/quotes', version: 1, quotes: [{ text: 'Cytat.', page: 12 }] },
    liturgy: await template('liturgy/complete-example.json'),
    scriptorium: { format: 'recreatio/scriptorium', version: 1, entries: [{ kinds: ['text'], data: { title: 'Kazanie' } }] },
    'text-plan': { format: 'recreatio/scriptorium', version: 1, entries: [{ kinds: ['text'], data: { title: 'Kazanie' } }] },
    calendar: sample(m.CALENDAR_JSON),
    'calendar-scheme': sample(m.SCHEME_JSON),
    'calendar-plan': sample(m.PLAN_JSON),
    tasks: sample(m.TASKS_JSON),
    masses: sample(m.MASSES_JSON),
    bookings: sample(m.BOOKINGS_JSON),
    registry: { format: 'recreatio/registry', version: 1, addresses: [{ address: 'ul. Długa 5/3, 31-147 Kraków', household: { family: 'Kowalscy', people: [{ name: 'Jan Kowalski' }] } }] },
    'form-entries': { format: 'recreatio/entries', version: 1, entries: [{ answers: { 'Imię': 'Jan' } }] },
    contacts: sample(m.CONTACTS_JSON),
    roles: sample(m.ROLES_JSON),
    chat: sample(m.CHAT_JSON),
    lamps: sample(m.LAMPS_JSON),
    persons: sample(m.PERSONS_JSON),
    'workspace-view': sample(m.VIEW_JSON)
  };
  const ran = [];
  for (const format of m.CHECK_FORMATS) {
    const bad = await m.checkImport(format, '{ "to nie jest": JSON');
    assert.equal(bad.ok, false, `${format}: broken JSON is not ok`);
    assert.equal(bad.groups.filter((g) => g.level === 'error').length, 1, `${format}: broken JSON is one error`);
    const doc = good[format];
    if (doc === null || doc === undefined) continue;
    const r = await m.checkImport(format, doc);
    assert.equal(r.format, format);
    assert.ok(r.ok, `${format}: its sample should go through — ${r.messages.filter((x) => x.level === 'error').map((x) => x.text).join(' | ')}`);
    assert.ok(r.changes.length > 0 || r.note !== undefined, `${format}: says what it would do or what it checked against`);
    ran.push(format);
  }
  ok(`every adapter: broken JSON is exactly one error; samples go through (${ran.length} of ${m.CHECK_FORMATS.length}: ${ran.join(', ')})`);
  const asText = await m.checkImport('knowledge-base', JSON.stringify(good['knowledge-base']));
  assert.ok(asText.ok && asText.changes[0] === (await m.checkImport('knowledge-base', good['knowledge-base'])).changes[0]);
  const unknown = await m.checkImport('zzz', {});
  assert.ok(!unknown.ok && unknown.messages[0].text.includes('knowledge-base') && unknown.messages[0].text.includes('calendar'));
  assert.equal((await m.checkImport('scheme-fakty', await template('cogita/fakty.json'))).format, 'knowledge-base', 'a scheme is checked as a knowledge base');
  assert.equal((await m.checkImport('example-story-page', await template('cogita/przyklad-opowiesc-strona.json'))).format, 'page');
  ok('a document as JSON text is the same as the value; an unknown format names the known ones; schemes and examples are checked as their format');

  /* -- 4. Die Baza aus ihrer Abschrift, mit ihren Kennungen ---------------------------------------------------------- */
  const KIND = '0199aaaa-0000-7000-8000-000000000001';
  const VIEW = '0199aaaa-0000-7000-8000-0000000000a1';
  const kindDoc = { ref: '@kurs/temat', name: 'Temat nauki', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'wymaga', label: 'Najpierw', type: 'ref', multi: true, to: ['@kurs/temat'], structure: 'up', prerequisite: 'up' }] };
  const entry = (n, extra = {}) => ({ id: `0199aaaa-0000-7000-8000-00000000001${n}`, kind: KIND, kinds: [KIND], ...(n < 3 ? { ref: `kurs/etap-${n}` } : {}), data: { nazwa: `Etap ${n}`, ...extra } });
  const snapshot = {
    library: 'baza', name: 'Kurs', kinds: [{ id: KIND, name: 'Temat nauki' }],
    entries: [entry(1), entry(2, { wymaga: ['0199aaaa-0000-7000-8000-000000000011'] }), entry(3)],
    setup: { course: { format: 'recreatio.cogita.course', version: 1, name: 'Kurs', kinds: [kindDoc],
      views: [{ ref: `@${VIEW}`, name: 'Lista', mode: 'list', steps: [{ type: 'source.kind', config: { kind: '@kurs/temat' } }] }, { ref: '@kurs/mapa', name: 'Mapa', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@kurs/temat' } }] }] } }
  };
  const restored = await m.restoreBase(snapshot);
  assert.equal(restored.missing, 0, 'every kind and document got its id back');
  assert.ok(restored.lib.kind(KIND) !== undefined, 'the kind keeps its id');
  assert.ok(restored.lib.entity('0199aaaa-0000-7000-8000-000000000012') !== undefined && restored.lib.docs('view').some((d) => d.id === VIEW), 'entries and documents keep their ids');
  assert.equal(restored.lib.byImportRef('kurs/etap-1', 'entity')?.id, '0199aaaa-0000-7000-8000-000000000011', 'a lasting name finds its entry');
  assert.deepEqual(restored.lib.entity('0199aaaa-0000-7000-8000-000000000012').data.wymaga, ['0199aaaa-0000-7000-8000-000000000011']);
  ok('the base is rebuilt from its AI snapshot with its own ids (kinds, entries, documents) and lasting names (the slots of planImport still match)');

  const change = await m.checkImport('knowledge-base', { format: 'recreatio.cogita.course', version: 1, entities: [
    { ref: '@kurs/etap-1', data: { nazwa: 'Etap pierwszy' } },
    { ref: '@0199aaaa-0000-7000-8000-000000000013', remove: true },
    { ref: '@kurs/etap-4', kinds: ['@kurs/temat'], data: { nazwa: 'Etap 4', wymaga: ['@kurs/etap-2', '0199aaaa-0000-7000-8000-0000000000ff'] } }
  ], views: [{ ref: `@${VIEW}`, name: 'Lista tematów', mode: 'list', steps: [{ type: 'source.kind', config: { kind: '@kurs/temat' } }] }] }, { base: snapshot });
  assert.ok(change.changes.some((l) => l.includes('Etap 1') && l.includes('Etap pierwszy')), change.changes.join(' | '));
  assert.ok(change.changes.some((l) => l.includes('Lista tematów')), 'a view changed at its id is a change, not a new view');
  assert.deepEqual(change.removals.length, 1);
  assert.ok(change.removals[0].includes('Etap 3'));
  assert.equal(change.ok, false, 'a reference into nothing blocks');
  assert.ok(change.messages.some((x) => x.level === 'error' && x.text.includes('0000000000ff')));
  assert.ok(change.note.includes('Kurs'));
  ok('against the base: a change by lasting name and of a view by id, a removal by name, a reference into nothing blocks — all at once');

  /* -- 5. Das Bündel des Dienstes ------------------------------------------------------------------------------------- */
  const { bundle } = await import(pathToFileURL(join(process.cwd(), 'scripts/import-check-bundle.mjs')).href);
  const fresh = await bundle();
  const had = (await readFile('../backend/Api/Library/ImportCheck.js', 'utf8')).replace(/\r\n/g, '\n');
  assert.ok(had === fresh.js, 'backend/Api/Library/ImportCheck.js is older than the app — node scripts/import-check-bundle.mjs (the API build does it when Node is there)');
  const ctx = vm.createContext({});
  vm.runInContext('delete globalThis.Intl;', ctx);
  vm.runInContext(fresh.js, ctx);
  const locales = JSON.parse(fresh.locales);
  const viaBundle = JSON.parse(await ctx.recreatioImportCheck(JSON.stringify({ format: 'knowledge-base', lang: 'pl', document: good['knowledge-base'] }), JSON.stringify({ pl: locales.pl, en: locales.en })));
  assert.equal(viaBundle.ok, true);
  assert.deepEqual(viaBundle.changes, (await m.checkImport('knowledge-base', good['knowledge-base'])).changes, 'the bundle says what the app says');
  const five = { format: 'recreatio.cogita.course', version: 1, entities: [1, 2, 3, 4, 5].map((n) => ({ ref: `@q${n}`, kinds: ['question'], data: { form: 'text', prompt: `Pytanie ${n}?`, answers: ['tak'] } })) };
  const plural = JSON.parse(await ctx.recreatioImportCheck(JSON.stringify({ format: 'knowledge-base', lang: 'pl', document: five }), JSON.stringify({ pl: locales.pl, en: locales.en })));
  assert.match(plural.changes[0], /5 wpisów/, `Polish plurals without Intl (the bundle brings its own rules): ${plural.changes[0]}`);
  ok(`the server bundle is up to date and runs in a bare JavaScript context (${Math.round(fresh.js.length / 1024)} kB, texts ${Math.round(fresh.locales.length / 1024)} kB)`);

  /* -- 6. 2026-11-22 (I12) — check_import sagt für JEDES Format dasselbe wie die Vorschau der App ------------------------------ */
  const same = [];
  for (const format of ran) {
    const doc = good[format];
    const app = await m.checkImport(format, doc);
    const server = JSON.parse(await ctx.recreatioImportCheck(JSON.stringify({ format, lang: 'pl', document: doc }), JSON.stringify({ pl: locales.pl, en: locales.en })));
    assert.deepEqual([server.ok, server.changes, server.removals, server.messages], [app.ok, app.changes, app.removals, app.messages], `${format}: the server's check differs from the app's preview`);
    same.push(format);
  }
  ok(`check_import (the server bundle) returns exactly the app preview's changes, removals, errors and warnings for a document of every format (${same.length}: ${same.join(', ')})`);

  /* Eine Uwaga erledigen (I6): gegen die Abschrift MIT ihren Uwagi — eine bekannte Kennung wird erledigt, eine unbekannte warnt. */
  const fbSnap = { ...snapshot, setup: { ...snapshot.setup, feedback: [{ id: '0199aaaa-0000-7000-8000-0000000000f1', state: 'open', category: 'wrong', target: { kind: 'entry', entity: '@kurs/etap-1', shownAs: 'Etap 1' }, text: 'Zły opis.', at: '2026-11-21T10:00:00Z' }] } };
  const fbCheck = await m.checkImport('knowledge-base', { format: 'recreatio.cogita.course', version: 1, feedback: [{ id: '0199aaaa-0000-7000-8000-0000000000f1', state: 'done', note: 'Opis poprawiony.' }, { id: 'nie-ma', state: 'done' }] }, { base: fbSnap });
  assert.ok(fbCheck.ok && fbCheck.changes.some((l) => l.includes('Opis poprawiony.')), fbCheck.changes.join(' | '));
  assert.ok(fbCheck.messages.some((x) => x.level === 'warning' && x.text.includes('nie-ma')));
  assert.ok(!fbCheck.messages.some((x) => x.text.includes('odznaczone') || x.text.includes('unticked')), 'resolutions are accepted by default — not counted as unticked changes');
  ok('a document that resolves feedback is checked against the snapshot WITH its feedback: the known id is listed with its note, an unknown one is a warning');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
console.log(`\n${passed} passed, 0 failed`);
