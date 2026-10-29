/**
 * 2026-10-29 — REZERWACJE ALS JSON (`bookings/bookingsJson.ts`), nachgemessen — ohne Dienst, ohne Schlüssel:
 *
 *   1. Die Beschreibung steht ohne Ort (der MCP-Katalog entsteht aus ihr) und erklärt jeden Schlüssel.
 *   2. Jeder Schlüssel der Beispiele und des Exports ist beschrieben; die Beispiele lassen sich ohne ein Wort
 *      importieren (alles neu, der Vater "@dom" wartet auf sein Ding, ein Ding "offered" bekommt einen Kalender).
 *   3. Export → Lesen → Plan eines unveränderten Dokuments plant nichts und behält jede Kennung.
 *   4. Ohne "id" neu, mit "id" an Ort und Stelle (nur, was das Dokument nennt).
 *   5. Was an Reservierungen hängt, wird gesagt: verlegter Termin, weniger Plätze, nicht mehr wählbar,
 *      ein neuer Termin in der Zeit einer Reservierung.
 *   6. Kaputtes warnt statt zu stürzen; nur lesen heisst nur lesen; kein Ring aus Vätern.
 *
 *   node scripts/app-json-bookings-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = await mkdtemp(join(tmpdir(), 'app-json-bookings-'));
await build({
  entryPoints: { bookings: 'src/app/bookings/bookingsJson.ts', tree: 'src/app/core/jsonTree.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
/* Wie in den anderen Prüfungen: ein BroadcastChannel hielte den Lauf am Leben. */
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(out, 'bookings.js')).href);
const tree = await import(pathToFileURL(join(out, 'tree.js')).href);

let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const roundTrip = (doc) => JSON.parse(JSON.stringify(doc));
const has = (list, part) => list.some((line) => line.includes(part));

/* -- Ein Stand wie aus dem Dienst: zwei Bereiche (einer nur zum Lesen), drei Dinge, Termine, Reservierungen. -- */

const AREA = 'a0000000-0000-4000-8000-000000000001';
const READ_ONLY = 'a0000000-0000-4000-8000-000000000002';
const GROUP = 'a0000000-0000-4000-8000-000000000003';
const CAL = 'c0000000-0000-4000-8000-000000000001';
const CAL_OTHER = 'c0000000-0000-4000-8000-000000000002';
const PRIEST = 'b0000000-0000-4000-8000-000000000001';
const HOUSE = 'b0000000-0000-4000-8000-000000000002';
const CHAPEL = 'b0000000-0000-4000-8000-000000000003';
const FOREIGN = 'b0000000-0000-4000-8000-000000000004';
const SERIES = 'd0000000-0000-4000-8000-000000000001';
const SINGLE = 'd0000000-0000-4000-8000-000000000002';
const ME = 'e0000000-0000-4000-8000-000000000001';

const row = (over) => ({
  resourceId: PRIEST, areaId: AREA, parentId: null, calendarId: CAL, name: 'Spotkania z ks. Piotrem', kind: 'person', mode: 'offered',
  byNight: false, checkInMin: 960, checkOutMin: 600, capacity: 3, bufferBefore: 0, bufferAfter: 0, approval: 'none',
  inviteHours: 48, leadDays: 0, perPerson: 1, minPersons: 2, pending: 0, reserveAreaId: null, bookableDefault: true, ...over
});

const draft = (over) => ({
  title: 'Spotkanie', location: 'Kancelaria', notes: '', link: '', linkLabel: '', areaId: AREA, ownerRoleId: ME,
  date: '2026-11-03', time: '17:00', minutes: 40, allDay: false, repeat: 'none', every: 1, weekdays: 0, until: null, count: null,
  calendarId: CAL, bookable: null, capacity: null, reserveAreaId: null, kind: 'appointment', ...over
});

/* Ortszeit wie im Browser: „2026-11-03T17:00" → ISO. */
const at = (local) => new Date(local).toISOString();
const claim = (id, item, start, end, over = {}) => ({
  claimId: `f0000000-0000-4000-8000-00000000000${id}`, startsAt: at(start), endsAt: at(end), status: 'confirmed', awaits: null,
  groupId: `f0000000-0000-4000-8000-00000000000${id}`, hosting: false, name: `Osoba ${id}`, roleId: null, createdAt: at('2026-10-20T12:00'),
  itemId: item, occurrenceAt: item === null ? null : at(start), inviteUntil: null, byOffice: false, withLink: true, ...over
});

const state = {
  now: new Date('2026-10-29T12:00'),
  areas: [
    { areaId: AREA, name: 'Parafia św. Józefa', mayWrite: true },
    { areaId: READ_ONLY, name: 'Dekanat', mayWrite: false },
    { areaId: GROUP, name: 'Kandydaci do bierzmowania', mayWrite: true }
  ],
  calendars: [
    { calendarId: CAL, areaId: AREA, title: 'Spotkania z ks. Piotrem' },
    { calendarId: CAL_OTHER, areaId: AREA, title: 'Kancelaria' }
  ],
  resources: [
    {
      row: row({}),
      slots: [
        { itemId: SERIES, draft: draft({ repeat: 'weekly', weekdays: 2, until: '2026-12-15', reserveAreaId: GROUP }) },
        { itemId: SINGLE, draft: draft({ title: 'Spotkanie sobotnie', date: '2026-11-07', time: '10:00', capacity: 5, link: 'https://parafia.example/bierzmowanie', linkLabel: 'Program' }) }
      ],
      claims: [
        claim(1, SERIES, '2026-11-03T17:00', '2026-11-03T17:40', { hosting: true }),
        claim(2, SERIES, '2026-11-03T17:00', '2026-11-03T17:40'),
        claim(3, SINGLE, '2026-11-07T10:00', '2026-11-07T10:40', { status: 'pending', awaits: 'office' })
      ]
    },
    {
      row: row({ resourceId: HOUSE, calendarId: null, name: 'Dom rekolekcyjny', kind: 'house', mode: 'open', byNight: true, capacity: 1, approval: 'office', inviteHours: 0, perPerson: 0, bufferAfter: 120, leadDays: 2 }),
      slots: [],
      claims: [claim(4, null, '2026-11-20T16:00', '2026-11-22T10:00', { status: 'pending', awaits: 'office' })]
    },
    { row: row({ resourceId: CHAPEL, parentId: HOUSE, calendarId: null, name: 'Kaplica', kind: 'room', mode: 'open', capacity: 1, inviteHours: 0, perPerson: 0, bufferBefore: 30, bufferAfter: 30 }), slots: [], claims: [] },
    { row: row({ resourceId: FOREIGN, areaId: READ_ONLY, calendarId: CAL_OTHER, name: 'Sala dekanalna', kind: 'room' }), slots: [], claims: [] }
  ]
};

const plan = (doc, options = {}) => {
  const got = m.planBookingsImport(doc, state, options);
  assert.ok(!('error' in got), `the plan reads the document (${got.error ?? ''})`);
  return got;
};

try {
  /* -- 1. Die Beschreibung ohne Ort. -------------------------------------------------------------------- */
  const text = tree.describe(m.BOOKINGS_JSON);
  assert.equal(m.bookingsDescription(), text, 'bookingsDescription() is the tree, described');
  assert.ok(text.startsWith(`# Rezerwacje jako JSON ("${m.BOOKINGS_FORMAT}", wersja 1)`), 'the root names the format');
  const KEYS = { top: m.TOP_KEYS, resource: m.RESOURCE_KEYS, slot: m.SLOT_KEYS, claim: m.CLAIM_KEYS };
  for (const [what, keys] of Object.entries(KEYS)) {
    for (const [key, says] of Object.entries(keys)) {
      assert.ok(text.includes(`"${key}" — ${says}`), `${what}: the description explains "${key}"`);
      assert.ok(says.trim().length > 3, `${what}: "${key}" has a real sentence`);
    }
  }
  assert.equal(m.BOOKINGS_FORMAT, 'recreatio/bookings');
  assert.ok(tree.samplesOf(m.BOOKINGS_JSON).length >= 2, 'at least two samples to insert');
  ok(`the description stands without context and explains every key (${Object.values(KEYS).reduce((n, k) => n + Object.keys(k).length, 0)} keys)`);

  /* -- 2. Jeder Schlüssel der Beispiele und des Exports ist beschrieben. ------------------------------- */
  const documented = (label, doc) => {
    for (const key of Object.keys(doc)) assert.ok(m.TOP_KEYS[key] !== undefined, `${label}: top key "${key}" is described`);
    for (const r of doc.resources) {
      assert.ok(isPlain(r));
      for (const key of Object.keys(r)) assert.ok(m.RESOURCE_KEYS[key] !== undefined, `${label}: resource key "${key}" is described`);
      for (const s of r.slots ?? []) for (const key of Object.keys(s)) assert.ok(m.SLOT_KEYS[key] !== undefined, `${label}: slot key "${key}" is described`);
      for (const c of r.claims ?? []) for (const key of Object.keys(c)) assert.ok(m.CLAIM_KEYS[key] !== undefined, `${label}: claim key "${key}" is described`);
    }
  };
  for (const sample of tree.samplesOf(m.BOOKINGS_JSON)) documented(sample.label, sample.doc());
  const exported = roundTrip(m.exportBookings(state));
  documented('export', exported);
  ok('every key of the samples and of the export is described');

  const priest = plan(m.priestSample(), { areaId: AREA });
  assert.deepEqual(priest.warnings, [], 'the priest sample imports without a word');
  assert.equal(priest.resources.length, 1);
  const [p] = priest.resources;
  assert.equal(p.resourceId, null, 'new resource');
  assert.equal(p.newCalendar, 'Spotkania z ks. Piotrem', 'an offered resource without calendar gets its own');
  assert.deepEqual(p.slots.map((s) => s.itemId), [null, null], 'both slots are new');
  assert.equal(p.slots[0].fields.weekdays, 2, 'weekly on Tuesday (bit 1)');
  assert.equal(p.slots[0].fields.until, '2026-12-15');
  assert.equal(p.slots[0].fields.minutes, 40, '"end": "17:40" — forty minutes');
  assert.equal(p.slots[1].fields.capacity, 5);
  assert.equal(p.change.capacity, 3);
  assert.equal(p.change.inviteHours, 48);
  assert.equal(priest.changes, 4, 'resource, calendar, two slots');
  assert.ok(has(priest.lines, 'Nowy zasób „Spotkania z ks. Piotrem”') && has(priest.lines, 'Nowy kalendarz') && has(priest.lines, 'co tydzień (wt) do 2026-12-15'));

  const house = plan(m.houseSample(), { areaId: AREA });
  assert.deepEqual(house.warnings, [], 'the house sample imports without a word');
  assert.deepEqual(house.resources.map((r) => [r.name, r.parentLater]), [['Dom rekolekcyjny św. Józefa', null], ['Kaplica domu', 0]], '"parent": "@dom" waits for the house');
  assert.equal(house.resources[0].change.checkInMin, 960);
  assert.equal(house.resources[0].newCalendar, null, 'open resources need no calendar');

  const noArea = plan(m.priestSample());
  assert.equal(noArea.changes, 0, 'without an area nothing new is made');
  assert.ok(has(noArea.warnings, 'bez obszaru'), 'and it says so');
  assert.equal(m.newWithoutArea(m.priestSample()), 1, 'the import asks for the area of one new resource');
  assert.equal(m.newWithoutArea(exported), 0, 'an export names its areas');
  ok('the samples import without a word: new resources, own calendar, "@dom" as a later parent; no area — nothing made');

  /* -- 3. Unverändert: nichts geplant, jede Kennung bleibt. ------------------------------------------- */
  assert.equal(exported.format, 'recreatio/bookings');
  assert.deepEqual(exported.resources.map((r) => r.id), [PRIEST, HOUSE, CHAPEL, FOREIGN], 'every resource carries its id');
  assert.deepEqual(exported.resources[0].slots.map((s) => s.id), [SERIES, SINGLE], 'every slot carries its id');
  assert.deepEqual(exported.resources[0].slots[0], {
    id: SERIES, title: 'Spotkanie', start: '2026-11-03T17:00', end: '17:40', repeat: 'weekly', weekdays: ['wt'], until: '2026-12-15',
    location: 'Kancelaria', capacity: null, bookable: null, reserveArea: GROUP
  }, 'a weekly slot, as the format describes it');
  assert.equal(exported.resources[1].checkIn, '16:00', 'by night: arrival and departure as clock times');
  assert.equal(exported.resources[2].parent, HOUSE);
  assert.equal(exported.resources[0].claims.length, 3, 'the office sees who holds what');
  assert.equal(exported.resources[0].claims[0].name, 'Osoba 1');
  assert.equal(exported.resources[0].claims[0].slot, SERIES);
  const same = plan(exported);
  assert.deepEqual([same.changes, same.resources.length, same.warnings], [0, 0, []], 'an unchanged export plans nothing');
  assert.equal(same.lines[0], 'Bez zmian — wszystko jest już tak, jak w dokumencie.');
  assert.ok(has(same.lines, 'Rezerwacje w dokumencie: 4 — tylko do wglądu'), 'claims are named as read-only');
  const one = roundTrip(m.exportBookings(state, CHAPEL));
  assert.deepEqual(one.resources.map((r) => r.id), [CHAPEL], 'on its page: only this resource');
  assert.equal(plan(one).changes, 0);
  const bare = roundTrip(exported.resources[0]);
  assert.equal(plan(bare).changes, 0, 'one resource without the envelope reads too');
  ok('export → read → plan: nothing changes, every id is kept (also one resource alone)');

  /* -- 4. Ohne "id" neu, mit "id" an Ort und Stelle. --------------------------------------------------- */
  const edited = roundTrip(exported);
  edited.resources[0].capacity = 4;
  edited.resources[0].slots[1].title = 'Spotkanie w sobotę';
  edited.resources[0].slots.push({ title: 'Spotkanie dodatkowe', start: '2026-11-14T11:00', end: '11:40' });
  delete edited.resources[0].slots[0].location;
  edited.resources.push({ name: 'Sala Jana Pawła II', kind: 'room', mode: 'open', capacity: 2 });
  const changed = plan(edited, { areaId: AREA });
  const [priestPlan, salaPlan] = changed.resources;
  assert.equal(priestPlan.resourceId, PRIEST, 'with id: changed in place');
  assert.deepEqual(priestPlan.change, { capacity: 4 }, 'only what the document changes');
  assert.deepEqual(priestPlan.slots.map((s) => s.itemId), [SINGLE, null], 'the renamed slot in place, the new one new; the series without "location" stays');
  assert.equal(priestPlan.slots[0].fields.title, 'Spotkanie w sobotę');
  assert.equal(priestPlan.slots[0].fields.link, 'https://parafia.example/bierzmowanie', 'what the document does not change stays');
  assert.equal(priestPlan.slots[0].base.ownerRoleId, ME, 'the stored slot is the base of the change');
  assert.equal(priestPlan.slots[1].fields.date, '2026-11-14');
  assert.equal(salaPlan.resourceId, null, 'without id: new');
  assert.equal(salaPlan.areaId, AREA, 'a new resource without "area" goes where the import says');
  assert.equal(changed.changes, 4, 'resource, slot, new slot, new resource');
  assert.ok(has(changed.lines, 'Zmiana zasobu „Spotkania z ks. Piotrem”: osób na termin: 3 → 4'));
  assert.ok(has(changed.lines, 'Zmiana terminu „Spotkanie w sobotę”'));
  assert.ok(has(changed.lines, 'Nowy termin „Spotkanie dodatkowe”'));
  assert.ok(has(changed.lines, 'Bez zmian: 3 zasoby, 1 termin.'), 'the rest is counted as unchanged');
  ok('with id: changed in place (only named keys, the rest kept); without id: new');

  /* -- 5. Was an Reservierungen hängt. ---------------------------------------------------------------- */
  const moving = roundTrip(exported);
  moving.resources[0].slots[0].start = '2026-11-03T18:00';
  moving.resources[0].slots[0].end = '18:40';
  moving.resources[0].slots[1].start = '2026-11-07T11:00';
  moving.resources[0].slots[1].capacity = null;
  moving.resources[0].capacity = 1;
  const moved = plan(moving);
  assert.ok(has(moved.warnings, 'seria „Spotkanie” zmienia czas — rezerwacje na niej (2, dni: 1) przejdą'), 'a moved series names its claims');
  assert.ok(has(moved.warnings, 'termin „Spotkanie sobotnie” (2026-11-07 (so) 10:00–10:40) zmienia czas — rezerwacje na nim (1) przejdą razem z nim na 2026-11-07 (so) 11:00–11:40'), 'a moved single slot too');
  assert.ok(has(moved.warnings, 'zajęte 2 z 3, po imporcie miejsc 1'), 'fewer places than taken');
  assert.equal(moved.changes, 3, 'the warnings do not stop the plan');
  const closing = roundTrip(exported);
  closing.resources[0].slots[0].bookable = false;
  assert.ok(has(plan(closing).warnings, 'termin „Spotkanie” przestaje być do wyboru — rezerwacje na nim (2) zostają'));
  const overlapping = roundTrip(exported);
  overlapping.resources[0].slots.push({ title: 'Nakładka', start: '2026-11-07T10:20', end: '11:00' });
  assert.ok(has(plan(overlapping).warnings, 'Nowy termin „Nakładka” (zasób „Spotkania z ks. Piotrem”, 2026-11-07 (so) 10:20–11:00) nakłada się na rezerwację'));
  const stricter = roundTrip(exported);
  stricter.resources[1].bufferAfter = 240;
  assert.ok(has(plan(stricter).warnings, 'nowe zasady — rezerwacje na przyszłość (1) zostają'), 'open: stricter rules beside a standing claim');
  ok('claims are named: moved slot (single and series), fewer places, not bookable, a new slot over a claim, stricter open rules');

  /* -- 6. Kaputtes warnt; nur lesen; Väter ohne Ring. ------------------------------------------------- */
  assert.ok('error' in m.planBookingsImport('nonsense', state), 'a string is no document');
  assert.ok('error' in m.planBookingsImport({ format: 'recreatio/page', resources: [] }, state), 'another format is refused');
  assert.ok('error' in m.planBookingsImport({ format: 'recreatio/bookings', resources: 'x' }, state));
  const broken = plan({
    format: 'recreatio/bookings', version: 2, extra: true,
    resources: [
      'x',
      { id: 'dom', name: 'Zły id' },
      { id: 'b0000000-0000-4000-8000-0000000000ff', name: 'Nieznany' },
      { id: PRIEST, kind: 'castle', capacity: 'many', approval: 'maybe', byNight: true, perPerson: -1, inviteHours: 9999, odd: 1, slots: [
        'y',
        { id: 'd0000000-0000-4000-8000-0000000000ff', title: 'Nieznany termin' },
        { title: 'Bez startu' },
        { title: 'Zły start', start: 'jutro' },
        { title: 'Zły koniec', start: '2026-11-20T10:00', end: '09:00', repeat: 'weekly', weekdays: ['xx', 'pt'], every: 0, until: 'kiedyś', capacity: 0, bookable: 'tak', reserveArea: 'nikt', foo: 1 }
      ] },
      { id: FOREIGN, name: 'Sala dekanalna — nowa nazwa' },
      { key: 'a', name: 'A', mode: 'open', parent: '@b' },
      { key: 'b', name: 'B', mode: 'open', parent: '@a' },
      { name: 'Bez obszaru', area: 'Nie ma takiego', mode: 'open', calendar: CAL }
    ]
  }, { areaId: AREA });
  for (const part of [
    'Nieznany klucz "extra"', 'Wersja 2', 'Zasób 1: to nie jest obiekt', 'Zasób 2 („Zły id”): "id" to identyfikator z eksportu',
    'nie ma zasobu o tym "id"', '"kind" to "person"', '"capacity" to liczba całkowita', '"approval" to "none"',
    '"byNight" dotyczy tylko trybu "open"', '"perPerson" to liczba całkowita', '"inviteHours" to liczba całkowita', 'nieznany klucz "odd"',
    'termin 1: to nie jest obiekt', 'nie ma takiego terminu w kalendarzu zasobu', 'nowy termin potrzebuje "start"', '"start" to "RRRR-MM-DDTGG:MM"',
    '"end" nie jest po "start"', 'dzień „xx”', '"every" to liczba 1–52', '"until" to "RRRR-MM-DD"', '"capacity" to liczba 1–10000',
    '"bookable" to true, false albo null', '"reserveArea" to identyfikator obszaru', 'nieznany klucz "foo"',
    'ten zasób możesz tylko czytać', 'zamknąłby koło', 'nie ma obszaru „Nie ma takiego”', '"calendar" dotyczy tylko trybu "offered"'
  ]) assert.ok(has(broken.warnings, part), `warned: ${part}`);
  const brokenSlot = broken.resources.find((r) => r.resourceId === PRIEST)?.slots.find((s) => s.label === 'Zły koniec');
  assert.ok(brokenSlot !== undefined, 'the broken slot is still planned with what could be read');
  assert.equal(brokenSlot.fields.minutes, 60, 'an end before the start: one hour');
  assert.equal(brokenSlot.fields.weekdays, 16, 'only "pt" was a day');
  assert.ok(!broken.resources.some((r) => r.resourceId === FOREIGN), 'read-only: not planned');
  const ring = broken.resources.filter((r) => r.name === 'A' || r.name === 'B');
  assert.equal(ring.length, 2, 'both new resources are still made');
  assert.equal(ring.filter((r) => r.parentLater !== null).length, 1, 'one of them keeps its parent, the ring is cut');

  /* Ein Termin mit einem Feld, das hier nicht aufging: unverändert still, geändert gewarnt und nicht angefasst. */
  const LOCKED = 'd0000000-0000-4000-8000-000000000003';
  const lockedState = {
    ...state,
    resources: [
      { ...state.resources[0], slots: [...state.resources[0].slots, { itemId: LOCKED, draft: draft({ title: '', date: '2026-11-10' }), readable: false }] },
      ...state.resources.slice(1)
    ]
  };
  const lockedExport = roundTrip(m.exportBookings(lockedState, PRIEST));
  const quiet = m.planBookingsImport(lockedExport, lockedState);
  assert.deepEqual([quiet.changes, quiet.warnings], [0, []], 'an unreadable slot left alone says nothing');
  lockedExport.resources[0].slots[2].location = 'Salka';
  const guarded = m.planBookingsImport(lockedExport, lockedState);
  assert.equal(guarded.changes, 0, 'an unreadable slot is not re-sealed');
  assert.ok(has(guarded.warnings, 'nie każde zapieczętowane pole tego terminu da się otworzyć'));
  ok(`broken documents warn instead of crashing (${broken.warnings.length} warnings); read-only stays untouched; no ring of parents; unreadable slots are not re-sealed`);

  console.log(`\n${passed} checks passed.`);
} finally {
  await rm(out, { recursive: true, force: true });
}
