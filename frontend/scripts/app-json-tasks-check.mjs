/**
 * 2026-10-29 — DIE ZADANIA ALS JSON (`calendar/tasksJson.ts`), nachgemessen:
 *
 *   1. Die Beschreibung steht ohne App (für den MCP-Server) und nennt jeden Schlüssel;
 *      jeder Schlüssel der Beispiele ist beschrieben, die Beispiele lesen sich ohne ein Wort.
 *   2. Export → Import eines unveränderten Dokuments ändert nichts und behält jede Kennung.
 *   3. Mit "id" wird an Ort und Stelle geändert (nur, was dasteht), ohne "id" neu angelegt,
 *      entfernt nur mit "remove": true — und nur, wo ich schreiben darf.
 *   4. Was nicht stimmt, gibt Warnungen, keinen Absturz (auch bei Zufall).
 *
 *   node scripts/app-json-tasks-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = await mkdtemp(join(tmpdir(), 'app-json-tasks-'));
await build({
  entryPoints: { tasks: 'src/app/calendar/tasksJson.ts', tree: 'src/app/core/jsonTree.ts', store: 'src/app/calendar/tasks.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
/* Wie in app-json-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Jeder Schlüssel eines Dokuments als Pfad: `tasks`, `tasks[].lasts.days` — wie in app-json-check. */
function pathsOf(value, prefix = '', found = new Set()) {
  for (const [key, one] of Object.entries(value)) {
    const path = `${prefix}${key}`;
    found.add(path);
    if (isPlain(one)) pathsOf(one, `${path}.`, found);
    else if (Array.isArray(one)) for (const item of one) if (isPlain(item)) pathsOf(item, `${path}[].`, found);
  }
  return found;
}
const top = (path) => path.split(/[.[]/)[0];

/* Lokale Zeit wie im Fenster einer Aufgabe — unabhängig von der Zone, in der die Probe läuft. */
const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();

try {
  const m = await import(pathToFileURL(join(out, 'tasks.js')).href);
  const tree = await import(pathToFileURL(join(out, 'tree.js')).href);
  const store = await import(pathToFileURL(join(out, 'store.js')).href);

  /* -- Die Gruppen und Aufgaben einer Person ---------------------------------------------------- */
  const ME = '0190a0a0-0000-7000-8000-0000000000a0';
  const SCHOLA = '0190a0a0-0000-7000-8000-0000000000a1';
  const RADA = '0190a0a0-0000-7000-8000-0000000000a2';
  const CHAT = '0190a0a0-0000-7000-8000-0000000000a3';
  const SCHOLA2 = '0190a0a0-0000-7000-8000-0000000000a4';
  const groups = [
    { areaId: ME, name: 'Tylko ja', write: true, personal: true },
    { areaId: SCHOLA, name: 'Parafia św. Józefa › Schola', write: true },
    { areaId: RADA, name: 'Parafia św. Józefa › Rada parafialna', write: false },
    { areaId: CHAT, name: 'Schola', write: true, chat: true },
    { areaId: SCHOLA2, name: 'Parafia Najświętszego Serca › Schola', write: true }
  ];
  const id = (n) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
  const row = (over) => ({
    areaId: ME, kind: 'window', windowMinutes: 15, everyMinutes: null, repeatKind: 'none', repeatWeekdays: null, remind: 0, notes: null, ...over
  });
  const tasks = [
    row({ taskId: id(1), title: 'Apel Jasnogórski', startsAt: at(2026, 11, 2, 21), repeatKind: 'daily', remind: 1 }),
    row({ taskId: id(2), title: 'Próba', areaId: SCHOLA, startsAt: at(2026, 11, 5, 19), windowMinutes: 90, repeatKind: 'weekly', repeatWeekdays: 8 | 32, remind: 6, notes: 'Śpiewnik!' }),
    row({ taskId: id(3), title: 'Posprzątać salkę', areaId: SCHOLA, kind: 'period', startsAt: at(2026, 11, 6, 9), windowMinutes: 3 * 1440, everyMinutes: 14 * 1440, remind: 5 }),
    row({ taskId: id(4), title: 'Podlać kwiaty', kind: 'after', startsAt: at(2026, 11, 2, 18), windowMinutes: 0, everyMinutes: 3 * 1440, remind: 1 }),
    row({ taskId: id(5), title: 'Czuwanie', startsAt: at(2026, 11, 7, 23), windowMinutes: 120, notes: 'Przez północ' }),
    row({ taskId: id(6), title: 'Rekolekcje — lektura', startsAt: at(2026, 12, 1, 0), windowMinutes: 15 * 1440 }),
    row({ taskId: id(7), title: 'Protokół', areaId: RADA, startsAt: at(2026, 11, 10, 18), windowMinutes: 60, repeatKind: 'monthly' }),
    row({ taskId: id(8), title: 'Zadanie', areaId: SCHOLA, startsAt: at(2026, 11, 9, 8), locked: true }),
    row({ taskId: id(9), title: 'Odpisać', areaId: CHAT, startsAt: at(2026, 11, 3, 12), windowMinutes: 0, repeatKind: 'yearly' }),
    row({ taskId: id(10), title: 'Kwartalnik', kind: 'period', startsAt: at(2026, 11, 1, 6), windowMinutes: 36 * 60, everyMinutes: 13 * 10080 })
  ];
  const now = new Date(2026, 9, 29, 12, 0);
  const base = { tasks, groups, now };
  const plan = (doc, over = {}) => m.planTasksImport(JSON.parse(JSON.stringify(doc)), { ...base, ...over });

  /* -- 1. Die Beschreibung ---------------------------------------------------------------------- */
  {
    const text = m.tasksDescription();
    assert.equal(text, tree.describe(m.TASKS_JSON), 'the description is the tree');
    assert.ok(text.startsWith(`# Zadania jako JSON ("${m.TASKS_FORMAT}", wersja 1)`), 'it names the format and its version');
    assert.deepEqual(tree.sectionsOf(m.TASKS_JSON).map((s) => s.node.key), ['tasks', 'tasks.usage', 'tasks.task', 'tasks.kinds', 'tasks.groups', 'tasks.example'], 'one section per part, each once');
    /* 2026-10-30 — gleich nach dem ersten Abschnitt: „Jak aplikacja używa tych danych". */
    assert.ok(text.includes('\n## Jak aplikacja używa tych danych\n'), 'the description says how the app uses the data');
    for (const keys of [m.TASKS_DOC_KEYS, m.TASK_KEYS, m.TASK_GROUP_KEYS]) {
      for (const [key, says] of Object.entries(keys)) {
        assert.ok(text.includes(`"${key}" — `), `the description explains "${key}"`);
        assert.ok(typeof says === 'string' && says.trim().length > 3, `"${key}" has a real sentence`);
      }
    }
    for (const unit of Object.keys(m.TASK_SPAN_KEYS)) assert.ok(text.includes(`"${unit}"`), `the description names the unit ${unit}`);
    for (const kind of ['window', 'period', 'after']) assert.ok(text.includes(`"${kind}" — `), `the description explains the kind ${kind}`);
    for (const word of ['none', 'daily', 'weekly', 'monthly', 'yearly', 'start', 'middle', 'end', 'pn', 'śr', 'nd']) assert.ok(text.includes(`"${word}"`), `the description names "${word}"`);
    assert.ok(text.includes('2026-11-02T21:00') && !text.includes('undefined'), 'a fixed example, nothing left open');
    assert.equal(m.tasksDescription(), text, 'the same text every time (ImportFormats.json must not drift)');
    assert.deepEqual(m.REMIND_BITS, store.REMIND, 'the reminder bits are those of tasks.ts');
    ok(`description without app context: ${text.length} characters, ${tree.sectionsOf(m.TASKS_JSON).length} sections, every key and value named`);

    const keys = {
      ...m.TASKS_DOC_KEYS,
      ...Object.fromEntries(Object.entries(m.TASK_GROUP_KEYS).map(([k, v]) => [`groups[].${k}`, v])),
      ...Object.fromEntries(Object.entries(m.TASK_KEYS).map(([k, v]) => [`tasks[].${k}`, v])),
      ...Object.fromEntries(Object.entries(m.TASK_SPAN_KEYS).flatMap(([k, v]) => [[`tasks[].lasts.${k}`, v], [`tasks[].every.${k}`, v]]))
    };
    const example = m.tasksExample();
    const samples = tree.samplesOf(m.TASKS_JSON);
    assert.equal(samples.length, 2, 'two samples to insert');
    for (const [label, doc] of [['example', example], ...samples.map((s) => [s.label, s.doc()])]) {
      for (const path of pathsOf(doc)) assert.ok(keys[path] !== undefined, `${label}: "${path}" is in the example but not described`);
    }
    const tops = new Set([...pathsOf(example)].map(top));
    for (const key of Object.keys(m.TASKS_DOC_KEYS)) assert.ok(tops.has(key), `"${key}" is described and shown in the example`);
    ok('every key of the example and of both samples is described; every document key is in the example');

    /* Die Beispiele lesen sich ohne ein Wort — mit den Gruppen, die sie nennen. */
    const realNow = new Date();
    const withSchola = [{ areaId: ME, name: 'Tylko ja', write: true, personal: true }, { areaId: SCHOLA, name: 'Schola', write: true }];
    for (const sample of samples) {
      const p = m.planTasksImport(sample.doc(), { tasks: [], groups: withSchola, now: realNow });
      assert.ok(!('error' in p) && p.warnings.length === 0, `sample „${sample.label}” plans cleanly: ${p.warnings?.join(' | ') ?? p.error}`);
      assert.equal(p.created, sample.doc().tasks.length, `sample „${sample.label}”: every task is new`);
    }
    const exBase = {
      tasks: [row({ taskId: '0190a0a0-0000-7000-8000-000000000001', title: 'Apel Jasnogórski', startsAt: at(2026, 11, 2, 20, 30), windowMinutes: 15, repeatKind: 'daily', remind: 1 }),
        row({ taskId: '0190a0a0-0000-7000-8000-000000000002', title: 'Stare', startsAt: at(2026, 11, 1, 10) })],
      groups: [{ areaId: ME, name: 'Tylko ja', write: true, personal: true }, { areaId: '0190a0a0-0000-7000-8000-00000000000a', name: 'Parafia św. Józefa › Schola', write: true }],
      now
    };
    const ex = m.planTasksImport(example, exBase);
    assert.ok(!('error' in ex) && ex.warnings.length === 0, `the example plans cleanly: ${ex.warnings?.join(' | ')}`);
    assert.deepEqual([ex.created, ex.updated, ex.removed, ex.unchanged], [3, 1, 1, 0]);
    assert.deepEqual(ex.changes.find((c) => c.action === 'change').what, ['początek (2026-11-02 20:30 → 2026-11-02 21:00)', 'koniec (20:45 → 21:15)']);
    ok('the samples and the example of the description import without a single warning');
  }

  /* -- 2. Export → Import: nichts ändert sich, jede Kennung bleibt ------------------------------- */
  const exported = JSON.parse(JSON.stringify(m.exportTasks(tasks, groups)));
  {
    assert.equal(exported.format, m.TASKS_FORMAT);
    assert.equal(exported.version, 1);
    assert.deepEqual(exported.tasks.map((t) => t.id), tasks.map((t) => t.taskId), 'every task keeps its id, in order');
    assert.deepEqual(exported.groups.map((g) => [g.key, g.id, g.readOnly ?? false]),
      [['schola', SCHOLA, false], ['schola-2', SCHOLA2, false], ['rada-parafialna', RADA, true], ['schola-3', CHAT, false]],
      'the groups I write in (not the chats), then those of the tasks — read-only marked, keys unique');
    const [apel, proba, salka, kwiaty, czuwanie, lektura, protokol, locked, odpisac, kwartal] = exported.tasks;
    assert.deepEqual(apel, { id: id(1), title: 'Apel Jasnogórski', kind: 'window', who: 'me', start: '2026-11-02T21:00', end: '21:15', repeat: 'daily', remind: ['start'], notes: '' });
    assert.deepEqual([proba.who, proba.end, proba.weekdays, proba.remind, proba.notes], ['@schola', '20:30', ['cz', 'so'], ['middle', 'end'], 'Śpiewnik!']);
    assert.deepEqual([salka.lasts, salka.every, salka.remind, 'end' in salka], [{ days: 3 }, { weeks: 2 }, ['start', 'end'], false], 'a period: lasts and every in whole units, no end');
    assert.deepEqual([kwiaty.every, kwiaty.remind, 'lasts' in kwiaty, 'repeat' in kwiaty], [{ days: 3 }, ['start'], false, false], 'after: only every');
    assert.equal(czuwanie.end, '2026-11-08T01:00', 'over midnight: the end with its day');
    assert.equal(lektura.end, '2026-12-16T00:00');
    assert.equal(protokol.who, '@rada-parafialna');
    assert.deepEqual([locked.locked, 'title' in locked, 'notes' in locked], [true, false, false], 'a sealed-shut task: no placeholder title goes out');
    assert.equal(odpisac.who, '@schola-3', 'a chat is listed once a task names it');
    assert.deepEqual(kwartal.lasts, { hours: 36 });
    assert.deepEqual(kwartal.every, { weeks: 13 });

    const same = plan(exported);
    assert.ok(!('error' in same));
    assert.deepEqual([same.changes.length, same.unchanged, same.warnings], [0, tasks.length, []], `an unchanged export changes nothing: ${same.warnings.join(' | ')}`);
    assert.deepEqual(same.lines, [`Nowe: 0 · zmienione: 0 · usunięte: 0 · bez zmian: ${tasks.length}`, 'Nic do zapisania.']);

    const one = JSON.parse(JSON.stringify(m.exportTasks(tasks.filter((t) => t.areaId === SCHOLA), groups)));
    assert.deepEqual(one.tasks.map((t) => t.id), [id(2), id(3), id(8)], 'the export of one group');
    assert.deepEqual(plan(one).warnings, [], 'and it imports without a word');

    /* Ohne „Tylko ja" in den Gruppen (es gibt ihn noch nicht): dieselben Kennungen, dieselbe Ruhe. */
    const bare = m.planTasksImport({ format: m.TASKS_FORMAT, tasks: [] }, { tasks: [], groups: [], now });
    assert.deepEqual([bare.changes.length, bare.warnings.length], [0, 0]);
    ok('export → import of an unchanged document: no change, no warning, every id kept (all kinds, groups, a chat, a sealed-shut task)');
  }

  /* -- 3. An Ort und Stelle, neu, entfernt -------------------------------------------------------- */
  {
    const doc = JSON.parse(JSON.stringify(exported));
    doc.tasks[0].start = '2026-11-02T20:30';
    delete doc.tasks[0].end;
    doc.tasks[0].remind = ['start', 'end'];
    doc.tasks[1].title = 'Próba scholi';
    doc.tasks[1].weekdays = ['cz'];
    delete doc.tasks[1].notes;
    doc.tasks[2] = { id: id(3), every: { weeks: 3 } };
    doc.tasks[3] = { id: id(4), remove: true };
    doc.tasks[4].who = '@schola';
    doc.tasks.push({ title: 'Nowe zadanie', start: '2026-11-10T08:00' });
    doc.tasks.push({ title: 'Kwiaty w kościele', start: '2026-11-04T07:00', every: { days: 2 }, who: 'Parafia św. Józefa › Schola' });
    doc.tasks.push({ title: 'Dyżur', start: '2026-11-03', lasts: { days: 2 } });
    const p = plan(doc);
    assert.ok(!('error' in p));
    assert.deepEqual(p.warnings, [], `a clean change plans without a word: ${p.warnings.join(' | ')}`);
    assert.deepEqual([p.created, p.updated, p.removed, p.unchanged], [3, 4, 1, 5]);
    const byId = new Map(p.changes.filter((c) => c.taskId !== null).map((c) => [c.taskId, c]));
    assert.deepEqual(byId.get(id(1)).what, ['początek (2026-11-02 21:00 → 2026-11-02 20:30)', 'koniec (21:15 → 20:45)', 'przypomnienia (na początku → na początku, pod koniec)']);
    assert.deepEqual([byId.get(id(1)).spec.windowMinutes, byId.get(id(1)).spec.time], [15, '20:30'], 'a moved start without "end" keeps the length of the window');
    const literal = plan({ tasks: [{ id: id(1), start: '2026-11-02T20:30', end: '21:15' }] });
    assert.deepEqual([literal.changes[0].spec.windowMinutes, literal.changes[0].what], [45, ['początek (2026-11-02 21:00 → 2026-11-02 20:30)', 'długość okna (15 min → 45 min)']],
      'a moved start with the old "end": the window the document says, and the plan says it is longer');
    assert.equal(byId.get(id(2)).spec.notes, 'Śpiewnik!', 'a key left out stays as it was');
    assert.equal(byId.get(id(2)).spec.weekdays, 8);
    assert.deepEqual(byId.get(id(3)).what, ['odstęp (co 2 tyg. → co 3 tyg.)'], 'only what the document names changes');
    assert.deepEqual([byId.get(id(3)).spec.windowMinutes, byId.get(id(3)).spec.title, byId.get(id(3)).spec.remind], [3 * 1440, 'Posprzątać salkę', 5]);
    assert.equal(byId.get(id(4)).action, 'remove');
    assert.deepEqual([byId.get(id(5)).spec.areaId, byId.get(id(5)).what], [SCHOLA, ['kto widzi (Tylko ja → Parafia św. Józefa › Schola)']], 'moved to a group');
    const fresh = p.changes.filter((c) => c.action === 'new');
    assert.deepEqual(fresh.map((c) => [c.taskId, c.spec.kind, c.spec.areaId, c.spec.windowMinutes, c.spec.everyMinutes, c.spec.repeat]), [
      [null, 'window', null, 15, null, 'none'],
      [null, 'after', SCHOLA, 0, 2880, 'none'],
      [null, 'period', null, 2880, 14 * 1440, 'none']
    ], 'without id: new — the kind from the keys, the defaults of the task window, "me" when nobody is named');
    assert.deepEqual(p.lines.slice(0, 2), ['Nowe: 3 · zmienione: 4 · usunięte: 1 · bez zmian: 5', 'Zmiana — „Apel Jasnogórski”: początek (2026-11-02 21:00 → 2026-11-02 20:30); koniec (21:15 → 20:45); przypomnienia (na początku → na początku, pod koniec)']);
    assert.ok(p.lines.includes('Usunięcie — „Podlać kwiaty” (do archiwum; historia wykonania zostaje)'));
    assert.ok(p.lines.includes('Nowe — „Nowe zadanie”: 2026-11-10 08:00–08:15, raz · Tylko ja'), p.lines.join(' | '));
    assert.ok(p.lines.includes('Nowe — „Kwiaty w kościele”: co 2 dni od wykonania, pierwszy raz 2026-11-04 07:00 · Parafia św. Józefa › Schola'));
    assert.ok(p.lines.includes('Nowe — „Dyżur”: od 2026-11-03 00:00, 2 dni na wykonanie, co 2 tyg. · Tylko ja'));

    /* Was `saveTask` bekommt — wie aus dem Fenster einer Aufgabe. */
    const draft = m.draftOf(byId.get(id(2)).spec, SCHOLA, 'person-1');
    assert.deepEqual(draft, {
      title: 'Próba scholi', notes: 'Śpiewnik!', areaId: SCHOLA, ownerRoleId: 'person-1', kind: 'window', date: '2026-11-05', time: '19:00',
      windowMinutes: 90, everyMinutes: null, repeat: 'weekly', every: 1, weekdays: 8, until: null, remind: 6, origin: null
    });
    assert.deepEqual(m.draftOf(fresh[1].spec, SCHOLA, 'p').remind, 0);
    ok('with id: changed in place (only the named keys; a moved start keeps its length); without id: new; "remove": true archives; drafts as from the task window');

    /* Die Art wechseln: was fehlt, schlägt das Fenster vor; ein Abstand bleibt zwischen period und after. */
    const k = plan({ tasks: [{ id: id(1), kind: 'period' }, { id: id(3), kind: 'after' }, { id: id(4), kind: 'window', end: '18:30', repeat: 'daily' }] });
    const [toPeriod, toAfter, toWindow] = k.changes;
    assert.deepEqual([toPeriod.spec.windowMinutes, toPeriod.spec.everyMinutes, toPeriod.spec.repeat], [3 * 1440, 14 * 1440, 'none']);
    assert.ok(toPeriod.what[0].startsWith('rodzaj (o określonej porze → przez pewien czas, regularnie)'), toPeriod.what[0]);
    assert.deepEqual([toAfter.spec.windowMinutes, toAfter.spec.everyMinutes, toAfter.spec.remind], [0, 14 * 1440, 1], 'after keeps the interval; remind only at the start');
    assert.deepEqual([toWindow.spec.windowMinutes, toWindow.spec.repeat, toWindow.spec.everyMinutes], [30, 'daily', null]);
    assert.deepEqual(k.warnings, []);
    ok('a changed kind takes the defaults of the task window; the interval stays between period and after');
  }

  /* -- Rechte: lesen ja, ändern nur, wo ich schreibe; Versiegeltes nur entfernen ------------------ */
  {
    const p = plan({ tasks: [
      { id: id(7), title: 'Protokół z rady' },
      { id: id(7), remove: true },
      { title: 'Nowe w radzie', start: '2026-11-12T18:00', who: '@rada' },
      { id: id(1), who: 'Parafia św. Józefa › Rada parafialna' },
      { id: id(8), title: 'Nowy tytuł' },
      { id: id(8), remove: true }
    ], groups: [{ key: 'rada', id: RADA }] });
    const w = p.warnings.join(' | ');
    assert.ok(w.includes('„Protokół z rady”: w grupie „Parafia św. Józefa › Rada parafialna” możesz tylko czytać — zmiany pominięte.'), w);
    assert.ok(w.includes('to samo "id" drugi raz w dokumencie — pominięte'), 'the same id twice: the second is skipped');
    assert.ok(w.includes('„Nowe w radzie”: w grupie „Parafia św. Józefa › Rada parafialna” możesz tylko czytać — pominięte.'));
    assert.ok(w.includes('„Apel Jasnogórski”: w grupie „Parafia św. Józefa › Rada parafialna” możesz tylko czytać — pominięte.'), 'no move into a group I only read');
    assert.ok(w.includes('„Nowy tytuł”: tytułu i notatki tego zadania nie da się tu otworzyć — import go nie zmieni'), 'a sealed-shut task is never rewritten');
    assert.deepEqual(p.changes, [], 'nothing of it is planned');
    const removeLocked = plan({ tasks: [{ id: id(8), remove: true }, { id: id(7), remove: true }] });
    assert.deepEqual(removeLocked.changes.map((c) => [c.action, c.taskId]), [['remove', id(8)]], 'a sealed-shut task can be removed — not one in a group I only read');
    assert.ok(removeLocked.warnings[0].includes('możesz tylko czytać — nie usunięte'));
    ok('read-only groups: exported, never changed, moved into or removed from; a sealed-shut task: only removed');
  }

  /* -- Gruppen und „who" ------------------------------------------------------------------------- */
  {
    const p = plan({ groups: [
      { key: 'a', id: SCHOLA }, { key: 'b', name: 'Schola' }, { key: 'c', name: 'Parafia Najświętszego Serca > Schola' },
      { key: 'd', id: '0190a0a0-0000-7000-8000-0000000000ff', name: 'Rada parafialna' }, { key: 'e', name: 'Nikt' }, { key: 'a', id: RADA }, { key: 'zły klucz' }
    ], tasks: [
      { title: 'A', start: '2026-11-11T10:00', who: '@a' },
      { title: 'B', start: '2026-11-11T10:00', who: '@b' },
      { title: 'C', start: '2026-11-11T10:00', who: '@c' },
      { title: 'D', start: '2026-11-11T10:00', who: '@e' },
      { title: 'E', start: '2026-11-11T10:00', who: '@brak' },
      { title: 'F', start: '2026-11-11T10:00', who: 'Tylko ja' },
      { title: 'G', start: '2026-11-11T10:00', who: ME },
      { title: 'H', start: '2026-11-11T10:00', who: SCHOLA2 },
      { title: 'I', start: '2026-11-11T10:00', who: 'parafia sw. jozefa › schola' },
      { title: 'J', start: '2026-11-11T10:00', who: 5 }
    ] });
    const w = p.warnings.join(' | ');
    assert.deepEqual(p.changes.map((c) => [c.title, c.spec.areaId]), [['A', SCHOLA], ['C', SCHOLA2], ['F', null], ['G', null], ['H', SCHOLA2], ['I', SCHOLA]],
      'by id, by the whole way (any separator), "me", the own area by id, without diacritics');
    for (const part of ['„Schola” pasuje do kilku grup', 'Grupa „d”: identyfikator „0190a0a0-0000-7000-8000-0000000000ff” nieznany — grupa rozpoznana po nazwie', 'Grupa „e”: grupy „Nikt” nie ma wśród Twoich',
      'Grupa „a” drugi raz', 'Grupa 7: "key" to krótka nazwa', 'Zadanie „B”: "who": grupa „@b” nie jest rozpoznana — pominięte', '"who": „@brak” — nie ma takiego klucza w "groups"', 'Zadanie „J”: "who" to "me"']) {
      assert.ok(w.includes(part), `warns: ${part} — ${w}`);
    }
    ok('groups by id or name (whole way first, groups before chats), "@key", "me"; unknown, ambiguous and repeated groups are said and their tasks skipped');
  }

  /* -- 4. Was nicht stimmt: Warnungen, kein Absturz ------------------------------------------------ */
  {
    for (const bad of [null, 5, 'tekst', true]) assert.ok('error' in m.planTasksImport(bad, base), `${JSON.stringify(bad)} is refused with a sentence`);
    assert.ok(m.planTasksImport({ format: 'recreatio/page', tasks: [] }, base).error.includes('recreatio/page'), 'another format is named');
    assert.ok('error' in m.planTasksImport({ format: m.TASKS_FORMAT }, base), 'no list: refused');
    assert.deepEqual(m.planTasksImport([{ title: 'Z tablicy', start: '2026-11-02T10:00' }], base).created, 1, 'a bare list of tasks is read');

    const p = plan({
      format: m.TASKS_FORMAT, version: 2, hobby: 'chór',
      tasks: [
        7, null, 'Podlać kwiaty', [],
        { title: 5, start: '2026-11-02T10:00' },
        { title: 'Bez początku' },
        { title: 'Zły dzień', start: '2026-02-30' },
        { title: 'Zła godzina', start: '2026-11-02T25:00' },
        { title: 'Zły rodzaj', start: '2026-11-02T10:00', kind: 'czasem' },
        { title: 'Złe okno', start: '2026-11-02T10:00', end: 'później' },
        { title: 'Okno wstecz', start: '2026-11-02T10:00', end: '2026-11-01T10:00' },
        { title: 'Okno za długie', start: '2026-11-02T10:00', end: '2028-11-02T10:00' },
        { title: 'Sama liczba', start: '2026-11-02T10:00', lasts: 3 },
        { title: 'Ujemne', start: '2026-11-02T10:00', every: { days: -1 } },
        { title: 'Nieznana jednostka', start: '2026-11-02T10:00', every: { fortnights: 1 } },
        { title: 'Za często', start: '2026-11-02T10:00', kind: 'period', lasts: { days: 5 }, every: { days: 2 } },
        { title: 'Przypomnienia', start: '2026-11-02T10:00', remind: ['soon', 'start'] },
        { title: 'Przypomnienie liczbą', start: '2026-11-02T10:00', remind: 3 },
        { title: 'Po wykonaniu', start: '2026-11-02T10:00', kind: 'after', every: { days: 1 }, remind: ['end', 'start'] },
        { title: 'Dni', start: '2026-11-02T10:00', repeat: 'weekly', weekdays: ['xx', 'pt'] },
        { title: 'Dni bez tygodnia', start: '2026-11-02T10:00', repeat: 'daily', weekdays: ['pt'] },
        { title: 'Często', start: '2026-11-02T10:00', repeat: 'often' },
        { title: 'Klucz okna', start: '2026-11-02T10:00', lasts: { days: 1 }, kind: 'window' },
        { title: 'Notatka', start: '2026-11-02T10:00', notes: 5 },
        { id: 'apel', title: 'Wymyślone id', start: '2026-11-02T10:00' },
        { id: '0190a0a0-0000-7000-8000-0000000000ee', title: 'Cudze id', start: '2026-11-02T10:00' },
        { id: '0190a0a0-0000-7000-8000-0000000000ee', remove: true },
        { id: id(1), remove: 'tak' },
        { title: 'Proto', start: '2026-11-02T10:00', ['__proto__']: 1, constructor: 2 },
        { title: 'x'.repeat(300), start: '2026-11-02T10:00' },
        { title: 'Dawno', start: '2026-01-01T07:00', repeat: 'daily' },
        { title: 'Minęło', start: '2026-10-01T07:00' },
        { title: 'Kwiaty dawno', start: '2026-01-01T07:00', every: { days: 3 } },
        { title: 'Apel Jasnogórski', start: '2026-11-02T21:00' },
        { title: 'Noc', start: '2026-11-02T23:00', end: '01:00' },
        { title: 'Do końca dnia', start: '2026-11-02T10:00', end: '2026-11-02' },
        { title: 'Strefa', start: '2026-11-02T20:00:00Z', every: { days: 1 } },
        { title: 'Co dwa tygodnie', start: '2026-11-02T10:00', end: '11:00', repeat: 'weekly', every: { weeks: 2 } }
      ]
    });
    assert.ok(!('error' in p));
    const w = p.warnings.join(' | ');
    for (const part of [
      '"version": „2” — czytam jak wersję 1', 'Dokument: nieznany klucz "hobby"', 'Zadanie 1: to nie obiekt', 'Zadanie 2: to nie obiekt', 'Zadanie 3: to nie obiekt', 'Zadanie 4: to nie obiekt',
      'Zadanie 5: "title" to niepusty tekst', 'nowe zadanie potrzebuje "title" — pominięte', '„Bez początku”: nowe zadanie potrzebuje "start"',
      '„Zły dzień”: "start" „2026-02-30”', '„Zła godzina”: "start"', '„Zły rodzaj”: "kind" „czasem”', '„Złe okno”: "end" „później”',
      '„Okno wstecz”: "end" „2026-11-01T10:00” — koniec przed początkiem', '„Okno za długie”: "end" „2028-11-02T10:00” — okno dłuższe niż rok',
      '„Sama liczba”: "lasts": sama liczba (3) — podaj jednostkę', '„Ujemne”: "every": "days" to liczba nie mniejsza niż 0', '„Nieznana jednostka”: "every": nieznana jednostka "fortnights"',
      '„Za często”: wraca co 2 dni, a trwa 5 dni', '„Przypomnienia”: "remind": „soon”', '„Przypomnienie liczbą”: "remind" to lista',
      '„Po wykonaniu”: przy "after" przypomina się tylko "start"', '„Dni”: "weekdays": „xx”', '„Dni bez tygodnia”: "weekdays" liczy się tylko z "repeat": "weekly"',
      '„Często”: "repeat" „often”', '„Klucz okna”: "lasts" dotyczy tylko "period"', '„Notatka”: "notes" to tekst',
      '„Wymyślone id”: "id" „apel” to nie identyfikator z eksportu — powstanie jako nowe', '„Cudze id”: nie ma go wśród Twoich zadań — powstanie jako nowe',
      '"remove" działa tylko z "id" zadania, które jest (nie ma go wśród Twoich zadań) — nic do usunięcia', '„Apel Jasnogórski”: "remove" to true albo false — zadanie pominięte',
      '„Proto”: nieznane klucze "__proto__", "constructor" — pominięte', 'tytuł dłuższy niż 200 znaków — skrócony',
      '„Dawno”: zaczyna się w przeszłości (2026-01-01 07:00) — wcześniejsze wystąpienia pokażą się jako przegapione', '„Minęło”: jest w przeszłości (2026-10-01 07:00) — od razu pokaże się jako przegapione',
      '„Apel Jasnogórski”: takie zadanie już jest (ten sam tytuł i początek)',
      '„Co dwa tygodnie”: "every" dotyczy tylko "period" i "after" — pominięte'
    ]) assert.ok(w.includes(part), `warns: ${part}\n   ${w}`);
    assert.ok(!w.includes('„Kwiaty dawno”'), 'an "after" task in the past is simply due — no word');
    assert.ok(!w.includes('„Noc”') && !w.includes('„Do końca dnia”'), 'over midnight and to the end of a day read cleanly');
    const by = new Map(p.changes.map((c) => [c.title, c.spec]));
    assert.deepEqual([by.get('Noc').windowMinutes, by.get('Do końca dnia').windowMinutes], [120, 14 * 60], 'an earlier hour is the next day; a day alone lasts to its end');
    assert.deepEqual([by.get('Zły rodzaj').kind, by.get('Złe okno').windowMinutes, by.get('Okno wstecz').windowMinutes], ['window', 15, 15], 'what cannot be read takes the default and says so');
    assert.deepEqual([by.get('Sama liczba').kind, by.get('Sama liczba').windowMinutes, by.get('Ujemne').everyMinutes], ['period', 3 * 1440, 3 * 1440]);
    assert.deepEqual([by.get('Przypomnienia').remind, by.get('Po wykonaniu').remind, by.get('Dni').weekdays], [1, 1, 16]);
    assert.equal(by.get('x'.repeat(200)).title.length, 200);
    const zoned = new Date('2026-11-02T20:00:00Z');
    assert.deepEqual([by.get('Strefa').date, by.get('Strefa').time, by.get('Strefa').kind],
      [`${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, '0')}-${String(zoned.getDate()).padStart(2, '0')}`, `${String(zoned.getHours()).padStart(2, '0')}:${String(zoned.getMinutes()).padStart(2, '0')}`, 'after'],
      'a time with a zone becomes local time, without a word');
    assert.ok(!w.includes('„Strefa”'));
    assert.deepEqual([by.get('Co dwa tygodnie').kind, by.get('Co dwa tygodnie').repeat, by.get('Co dwa tygodnie').windowMinutes], ['window', 'weekly', 60],
      '"end" and "repeat" make a window even beside an "every" (which is then said to be ignored)');
    for (const title of ['Bez początku', 'Zły dzień', 'Zła godzina', 'Za często']) assert.ok(!by.has(title), `${title} is not planned`);
    assert.ok(by.has('Proto') && by.has('Wymyślone id') && by.has('Cudze id'), 'unknown keys and ids do not stop a task');
    ok(`malformed values: ${p.warnings.length} warnings, every one said, nothing thrown; what can be read is planned, the rest skipped`);

    /* Mehr als erlaubt. */
    const many = plan({ tasks: Array.from({ length: m.MAX_TASKS + 3 }, (_, i) => ({ title: `Zadanie ${i}`, start: '2026-11-20T10:00' })) });
    assert.equal(many.created, m.MAX_TASKS);
    assert.ok(many.warnings[0].includes(`Najwyżej ${m.MAX_TASKS} zadań`) && many.warnings[0].includes('pozostałe 3'));
    ok(`at most ${m.MAX_TASKS} tasks per document; the rest is said`);

    /* Zufall: was auch kommt — ein Plan oder ein Satz, nie ein Absturz. */
    let seed = 20261029;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const KEYS = [...Object.keys(m.TASK_KEYS), ...Object.keys(m.TASK_GROUP_KEYS), 'format', 'tasks', 'groups', 'days', 'weeks', '__proto__', 'x'];
    const value = (depth) => {
      const r = rand();
      if (depth > 3 || r < 0.25) return pick([null, true, false, 0, -1, 3.5, 1e9, '', 'me', '@schola', '2026-11-02T10:00', '21:00', 'weekly', 'period', id(1), SCHOLA, 'pn', 'start', NaN]);
      if (r < 0.5) return Array.from({ length: Math.floor(rand() * 4) }, () => value(depth + 1));
      return Object.fromEntries(Array.from({ length: Math.floor(rand() * 6) }, () => [pick(KEYS), value(depth + 1)]));
    };
    for (let i = 0; i < 3000; i++) {
      const doc = rand() < 0.5 ? value(0) : { format: m.TASKS_FORMAT, groups: value(1), tasks: Array.from({ length: Math.floor(rand() * 5) }, () => value(1)) };
      const result = m.planTasksImport(doc, base);
      assert.ok('error' in result ? typeof result.error === 'string' : Array.isArray(result.lines) && Array.isArray(result.warnings), 'a plan or a sentence');
      if (!('error' in result)) for (const c of result.changes) if (c.spec !== null) {
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.spec.date) && /^\d{2}:\d{2}$/.test(c.spec.time), 'a planned task has a day and an hour');
        assert.ok(c.spec.title.trim() !== '' && c.spec.windowMinutes >= 0 && c.spec.windowMinutes <= m.MAX_SPAN_MINUTES, 'a title and a window within a year');
        if (c.spec.kind !== 'window') assert.ok(c.spec.everyMinutes >= 1 && c.spec.everyMinutes <= m.MAX_SPAN_MINUTES && c.spec.everyMinutes >= (c.spec.kind === 'period' ? c.spec.windowMinutes : 1), 'an interval the service takes');
      }
    }
    ok('3000 random documents: always a plan or a sentence, and whatever is planned is something the service accepts');
  }
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(out, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
