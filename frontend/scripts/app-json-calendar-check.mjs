/**
 * 2026-10-29 — DIE TERMINE EINES KALENDERS ALS JSON (`calendar/calendarJson.ts`), nachgemessen — ohne Dienst:
 *
 *   1. Die Beschreibung steht ohne App (ein fester Knoten), nennt jeden Schlüssel, und jeder Schlüssel der
 *      Beispiele ist beschrieben.
 *   2. Export → Import eines unveränderten Kalenders: kein Speichern, keine Tage, keine Stellen, keine Warnung —
 *      und jede Kennung bleibt.
 *   3. Ohne "id" entsteht Neues (auch ein Punkt unter einem bestehenden Termin, an der nächsten Stelle);
 *      geänderte Felder werden genannt; eine neue Zeit der Reihe schreibt ihre Tage neu.
 *   4. Tage einer Reihe: absagen, zurückholen, verlegen, Werte des Tages — an ihrem bekannten Namen.
 *   5. Unlesbares wird gewarnt statt zu stürzen; ein anderes Format oder kein Objekt wird abgelehnt.
 *   6. Ein Dokument aus einem anderen Kalender legt nur an; "remove" nimmt mit "id" (und seine Punkte).
 *   7. Die Beispiele lassen sich planen.
 *
 *   node scripts/app-json-calendar-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = await mkdtemp(join(tmpdir(), 'app-json-calendar-'));
await build({
  entryPoints: { calendar: 'src/app/calendar/calendarJson.ts', tree: 'src/app/core/jsonTree.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
/* Wie in den anderen Prüfungen: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(out, 'calendar.js')).href);
const tree = await import(pathToFileURL(join(out, 'tree.js')).href);

let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v));

/* -- Ein Kalender, wie ihn `calendarJsonRun.ts` geöffnet hätte ------------------------------------------- */

const at = (y, mo, d, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s).toISOString();
const sealed = (text) => ({ text, label: null, public: false });
const shown = (text, label) => ({ text, label, public: true });
const item = (over) => ({
  itemId: '', kind: 'appointment', visibilityAreaId: 'area-parafia', title: null, location: null, notes: null, link: null, linkLabel: null,
  unreadable: false, startsAt: '', endsAt: '', allDay: false, repeat: 'none', every: 1, weekdays: null, until: null, count: null,
  parentItemId: null, position: null, schemeId: null, values: new Map(), valuesComplete: true, bookable: null, capacity: null,
  reserveAreaId: null, occurrences: [], ...over
});
const occurrence = (iso, over = {}) => ({ at: iso, startsAt: iso, cancelled: false, moved: false, values: new Map(), valuesComplete: true, ...over });

const CAL = '0190c000-0000-7000-8000-00000000ca1e';
const ID = (n) => `0190c000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const [A, B, C, D, E, F, G, H, I, J] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ID);
const OUTSIDE = '0190c000-0000-7000-8000-0000000000ff';

const MSZA = {
  name: 'Msza', kind: 'mass', lists: [],
  fields: [
    { key: 'celebrans', label: 'Celebrans', type: 'text', public: true },
    { key: 'kolor', label: 'Kolor szat', type: 'colour', level: 'day' },
    { key: 'uwagi', label: 'Uwagi', type: 'longtext' }
  ]
};
const ZAPISY = { name: 'Zapisy', kind: 'appointment', lists: [], fields: [{ key: 'grupa', label: 'Grupa', type: 'choice', required: true, options: [{ value: 'm', label: 'młodzież' }, { value: 'd', label: 'dorośli' }] }] };

const info = { calendarId: CAL, title: 'Parafia', itemKind: 'appointment', booking: true, personal: false, visibilityAreaId: 'area-parafia', durationMinutes: 60 };

/* Msza w poniedziałki i środy w listopadzie: 4.11 odwołana, 9.11 przeniesiona, 11.11 z kolorem. */
const mondaysWednesdays = [2, 4, 9, 11, 16, 18, 23, 25, 30].map((d) => {
  const iso = at(2026, 11, d, 18, 0);
  /* Wie `calendarJsonRun.ts` ihn lädt: die Werte eines abgesagten Tages kennt der Plan nicht. */
  if (d === 4) return occurrence(iso, { cancelled: true, valuesComplete: false });
  if (d === 9) return occurrence(iso, { moved: true, startsAt: at(2026, 11, 9, 19, 30) });
  if (d === 11) return occurrence(iso, { values: new Map([['kolor', sealed('biały')]]) });
  return occurrence(iso);
});

const state = {
  calendar: info,
  schemes: [{ id: 'scheme-msza', def: MSZA }, { id: 'scheme-zapisy', def: ZAPISY }],
  spans: [{ from: '2026-11-01', to: '2026-11-30' }],
  items: [
    item({ itemId: A, title: 'Próba scholi', startsAt: at(2026, 11, 5, 19), endsAt: at(2026, 11, 5, 20, 30), location: 'Salka', notes: 'Nuty: kolędy',
      link: 'https://example.org/nuty', linkLabel: 'Nuty online', bookable: true, capacity: 12 }),
    item({ itemId: B, kind: 'mass', title: 'Msza wieczorna', schemeId: 'scheme-msza', startsAt: at(2026, 11, 2, 18), endsAt: at(2026, 11, 2, 19),
      repeat: 'weekly', weekdays: 1 | 4, until: at(2027, 6, 30, 23, 59, 59), values: new Map([['celebrans', shown('ks. Jan', 'Celebrans')]]),
      occurrences: mondaysWednesdays }),
    item({ itemId: C, title: 'Święta', allDay: true, startsAt: at(2026, 12, 24), endsAt: at(2026, 12, 27) }),
    item({ itemId: D, title: 'Rekolekcje', startsAt: at(2026, 12, 6, 17), endsAt: at(2026, 12, 6, 21), location: 'Kościół' }),
    item({ itemId: E, title: 'Nauka', parentItemId: D, position: 1, startsAt: at(2026, 12, 6, 17), endsAt: at(2026, 12, 6, 18) }),
    item({ itemId: F, kind: 'mass', title: 'Msza', parentItemId: D, position: 2, startsAt: at(2026, 12, 6, 18), endsAt: at(2026, 12, 6, 19) }),
    item({ itemId: G, title: 'Adoracja', startsAt: at(2026, 11, 1, 20), endsAt: at(2026, 11, 1, 21), repeat: 'daily', until: at(2036, 11, 1, 23, 59, 59) }),
    item({ itemId: H, title: 'Kurs przedmałżeński', startsAt: at(2026, 11, 3, 18), endsAt: at(2026, 11, 3, 19, 30), repeat: 'weekly', weekdays: 2, count: 10 }),
    item({ itemId: I, title: 'Dyżur', parentItemId: OUTSIDE, startsAt: at(2026, 11, 20, 10), endsAt: at(2026, 11, 20, 12) }),
    item({ itemId: J, title: null, unreadable: true, startsAt: at(2026, 11, 21, 10), endsAt: at(2026, 11, 21, 11) })
  ]
};

const byId = (list, id) => {
  for (const one of list) {
    if (one.id === id) return one;
    const inner = Array.isArray(one.points) ? byId(one.points, id) : undefined;
    if (inner !== undefined) return inner;
  }
  return undefined;
};
const planned = (plan, id) => plan.items.find((one) => one.itemId === id);

try {
  /* -- 1: die Beschreibung --------------------------------------------------------------------------- */
  const text = tree.describe(m.CALENDAR_JSON);
  assert.ok(text.startsWith('# Terminy kalendarza ("recreatio/calendar")'), 'the description names the format');
  /* 2026-10-30 — gleich nach dem ersten Abschnitt: „Jak aplikacja używa tych danych". */
  assert.ok(text.includes('\n## Jak aplikacja używa tych danych\n'), 'the description says how the app uses the data');
  for (const node of ['## Termin ("appointments[]", "points[]")', '### Dzień serii ("occurrences[]")', '## Pole ("fields[]")']) {
    assert.ok(text.includes(node), `the tree carries ${node}`);
  }
  const maps = { doc: m.DOC_KEYS, calendar: m.CALENDAR_KEYS, range: m.RANGE_KEYS, schemes: m.SCHEMES_KEYS, appointment: m.APPOINTMENT_KEYS, occurrence: m.OCCURRENCE_KEYS };
  for (const [name, keys] of Object.entries(maps)) {
    for (const [key, says] of Object.entries(keys)) {
      assert.ok(text.includes(`"${key}" — ${says}`), `${name}: "${key}" is in the description`);
      assert.ok(says.trim().length > 3, `${name}: "${key}" has a real sentence`);
    }
  }
  const samples = tree.samplesOf(m.CALENDAR_JSON);
  assert.equal(samples.length, 3, 'three samples to insert');

  /* Jeder Schlüssel eines Beispiels ist beschrieben — "values" trägt Schlüssel der Felder (frei). */
  const next = { doc: { calendar: 'calendar', range: 'range', schemes: 'schemes', appointments: 'appointment' }, schemes: { fields: 'field' }, appointment: { points: 'appointment', occurrences: 'occurrence' } };
  const seen = new Set();
  const documented = (value, ctx, where) => {
    for (const [key, one] of Object.entries(value)) {
      seen.add(`${ctx}.${key}`);
      if (ctx === 'field') assert.ok(text.includes(`"${key}" — `), `${where}.${key}: a field key is described`);
      else assert.ok(key in maps[ctx], `${where}.${key} is in a sample but not described`);
      const sub = next[ctx]?.[key];
      if (sub === undefined) continue;
      for (const child of Array.isArray(one) ? one : [one]) if (isPlain(child)) documented(child, sub, `${where}.${key}`);
    }
  };
  for (const sample of samples) documented(sample.doc(), 'doc', sample.label);
  const exportedNow = m.exportCalendar(state).doc;
  documented(exportedNow, 'doc', 'export');
  for (const key of Object.keys(m.APPOINTMENT_KEYS)) assert.ok(seen.has(`appointment.${key}`) || ['remove', 'id'].includes(key), `"${key}" shows in a sample or an export`);
  ok(`the description stands alone, names every key (${Object.values(maps).reduce((n, k) => n + Object.keys(k).length, 0)}), and every key of the samples and of an export is described`);

  /* -- 2: Export → Import ohne Änderung --------------------------------------------------------------- */
  const exported = m.exportCalendar(state);
  assert.deepEqual(exported.warnings.length, 1, 'the export says what it could not open');
  assert.ok(exported.warnings[0].includes('zaszyfrowana'), exported.warnings[0]);
  const doc = copy(exported.doc);
  assert.equal(doc.format, 'recreatio/calendar');
  assert.equal(doc.calendar.id, CAL);
  assert.deepEqual(doc.range, { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(doc.schemes.map((s) => s.name), ['Msza', 'Zapisy']);
  assert.deepEqual(byId(doc.appointments, D).points.map((p) => p.id), [E, F], 'points stand under their whole, in their order');
  assert.equal(doc.appointments.some((a) => a.id === E), false, 'a point is not repeated at the top');
  assert.equal(byId(doc.appointments, I).parent, OUTSIDE, 'a point whose whole is elsewhere names it');
  const b = byId(doc.appointments, B);
  assert.deepEqual({ start: b.start, end: b.end, repeat: b.repeat, weekdays: b.weekdays, until: b.until, scheme: b.scheme, values: b.values },
    { start: '2026-11-02T18:00', end: '19:00', repeat: 'weekly', weekdays: ['pn', 'śr'], until: '2027-06-30', scheme: 'Msza', values: { celebrans: 'ks. Jan' } });
  assert.deepEqual(b.occurrences, [
    { date: '2026-11-04', cancelled: true },
    { date: '2026-11-09', start: '2026-11-09T19:30' },
    { date: '2026-11-11', values: { kolor: 'biały' } }
  ], 'only the days that differ, by their date');
  assert.equal(byId(doc.appointments, G).until, undefined, '„bez końca" writes no until');
  assert.equal(byId(doc.appointments, H).count, 10);
  assert.deepEqual([byId(doc.appointments, C).start, byId(doc.appointments, C).end], ['2026-12-24', '2026-12-26'], 'all day: the last day, inclusive');
  assert.equal(byId(doc.appointments, J).title, undefined, 'what does not open is not invented');

  const same = m.planCalendar(doc, state);
  assert.ok(!('error' in same), 'the export imports');
  assert.deepEqual(same.warnings, [], 'no warnings on a round trip');
  assert.deepEqual(same.lines, ['Bez zmian — terminy w kalendarzu są takie jak w dokumencie.']);
  assert.deepEqual(same.removals, []);
  assert.deepEqual(same.items.map((one) => one.itemId).sort(), state.items.map((one) => one.itemId).sort(), 'every id is kept');
  for (const one of same.items) {
    assert.equal(one.save, null, `${one.label}: nothing to save`);
    assert.equal(one.program, false, `${one.label}: stays where it is`);
    assert.deepEqual(one.occurrences, [], `${one.label}: no day changes`);
  }
  assert.deepEqual(same.counts, { created: 0, changed: 0, unchanged: 10, removed: 0, days: 0, skipped: 0 });
  assert.deepEqual(m.planCalendar(copy(doc), state).lines, same.lines, 'and a second time the same');
  ok('export → import of an unchanged calendar plans nothing, warns nothing and keeps every id (series, days, program, all-day, endless, count)');

  /* -- 3: ändern, ergänzen, eine neue Zeit der Reihe ---------------------------------------------------- */
  const changed = copy(doc);
  byId(changed.appointments, A).location = 'Duża sala';
  byId(changed.appointments, B).start = '2026-11-02T18:30';
  byId(changed.appointments, B).values = { celebrans: 'ks. Piotr' };
  byId(changed.appointments, D).points.push({ title: 'Agapa', start: '21:00', end: '22:00' });
  changed.appointments.push({ title: 'Opłatek', start: '2026-12-20T16:00', end: '18:00', location: 'Salka', scheme: null });
  /* Nur, was sich ändert: "id" und "every". */
  changed.appointments = changed.appointments.filter((one) => one.id !== H);
  changed.appointments.push({ id: H, every: 2 });
  const plan = m.planCalendar(changed, state);
  assert.ok(!('error' in plan));
  const a = planned(plan, A);
  assert.deepEqual(a.changes, ['miejsce']);
  assert.equal(a.save.location, 'Duża sala');
  assert.equal(a.save.title, 'Próba scholi', 'what the document does not change stays');
  assert.equal(a.save.bookable, true);
  assert.equal(a.retimed, false);
  const bb = planned(plan, B);
  assert.deepEqual(bb.changes, ['czas', 'wartości']);
  assert.equal(bb.retimed, true);
  assert.deepEqual(bb.save.values, [{ key: 'celebrans', text: 'ks. Piotr', publicLabel: 'Celebrans' }], 'an open value goes out with its label');
  assert.equal(bb.save.schemeId, undefined, 'an unchanged scheme is not rewritten');
  assert.deepEqual(bb.occurrences.map((op) => [op.day, op.at, op.cancel ?? null, op.moveTo !== undefined, op.values?.length ?? 0]), [
    ['2026-11-04', null, true, false, 0], ['2026-11-09', null, null, true, 0], ['2026-11-11', null, null, false, 1]
  ], 'a new time of the series writes its days again (the service drops them), found by their date');
  assert.ok(plan.warnings.some((w) => w.includes('zmiana czasu serii')), 'and says so');
  const agapa = plan.items.find((one) => one.label === 'Agapa');
  assert.equal(agapa.itemId, null, 'without id: new');
  assert.deepEqual(agapa.parent, { ref: planned(plan, D).ref }, 'under the whole it stands in');
  assert.equal(agapa.position, 3, 'at the next place');
  assert.deepEqual([agapa.save.date, agapa.save.time, agapa.save.minutes], ['2026-12-06', '21:00', 60], '„21:00" on the day of its whole');
  assert.equal(agapa.save.schemeId, null, 'a new point gets the universal scheme (as „+ punkt" in the editor)');
  assert.equal(planned(plan, E).program, false, 'the other points keep their places');
  assert.ok(plan.items.findIndex((one) => one === agapa) > plan.items.findIndex((one) => one.itemId === D), 'the whole is written before its point');
  const oplatek = plan.items.find((one) => one.label === 'Opłatek');
  assert.equal(oplatek.itemId, null);
  assert.equal(oplatek.parent, undefined);
  assert.equal(oplatek.save.kind, 'appointment', 'without kind: the kind of the calendar');
  assert.equal(oplatek.save.schemeId, null, '"scheme": null — the universal one');
  const h = planned(plan, H);
  assert.deepEqual([h.changes, h.save.every, h.save.count, h.save.title], [['powtarzanie'], 2, 10, 'Kurs przedmałżeński'], 'a partial entry changes only what it says');
  assert.ok(plan.lines.some((line) => line.startsWith('Nowy: „Agapa” — 2026-12-06 21:00 · punkt programu „Rekolekcje”')), plan.lines.join(' | '));
  assert.ok(plan.lines.includes('Zmiana: „Próba scholi” — miejsce'));
  assert.ok(plan.lines.some((line) => line.startsWith('Dni serii „Msza wieczorna”: odwołane 1, przeniesione 1, wartości dnia 1')), plan.lines.join(' | '));
  assert.equal(plan.lines.at(-1), 'Razem: nowe 2, zmienione 3, usunięte 0, bez zmian 7, dni serii 3.');
  ok('without id new (a point under an existing whole at the next place), with id changed in place (only what is said), a new series time rewrites its days');

  /*
   * Ohne "scheme" das eine Schema seiner Art (hier „Zapisy" für Treffen) — und dessen Pflichtfeld: ohne Wert
   * fällt der neue Termin, mit Wert (auch beim Namen der Wahl) geht er.
   */
  const required = m.planCalendar({ appointments: [
    { title: 'Bez grupy', start: '2026-11-07T10:00' },
    { title: 'Z grupą', start: '2026-11-07T11:00', values: { grupa: 'młodzież' } },
    { title: 'Jawnie', scheme: 'Zapisy', start: '2026-11-07T12:00', values: { grupa: 'd' } }
  ] }, state);
  assert.ok(required.warnings.some((w) => w.includes('Bez grupy') && w.includes('„Grupa”')), required.warnings.join(' | '));
  assert.deepEqual(required.items.map((one) => [one.label, one.save.schemeId, one.save.values]), [
    ['Z grupą', 'scheme-zapisy', [{ key: 'grupa', text: 'm' }]], ['Jawnie', 'scheme-zapisy', [{ key: 'grupa', text: 'd' }]]
  ]);
  ok('without "scheme" the one scheme of its kind; a required field without a value skips a new entry; a choice is read by value or label');

  /* -- 4: die Tage einer Reihe -------------------------------------------------------------------------- */
  const daysDoc = copy(doc);
  byId(daysDoc.appointments, B).occurrences = [
    { date: '2026-11-04', cancelled: false },
    { date: '2026-11-16', cancelled: true },
    { date: '2026-11-18', start: '20:00' },
    { date: '2026-11-23', values: { kolor: 'Fioletowy' } },
    { date: '2026-11-05', cancelled: true },
    { date: '2026-12-02', cancelled: true }
  ];
  const daysPlan = m.planCalendar(daysDoc, state);
  const ops = planned(daysPlan, B).occurrences;
  assert.equal(planned(daysPlan, B).save, null, 'the series itself stays');
  const opAt = (day) => ops.find((op) => op.day === day);
  assert.deepEqual([opAt('2026-11-04').restore, opAt('2026-11-04').at], [true, at(2026, 11, 4, 18)], 'cancelled: false takes a cancellation back');
  assert.deepEqual([opAt('2026-11-16').cancel, opAt('2026-11-16').at], [true, at(2026, 11, 16, 18)]);
  assert.equal(opAt('2026-11-18').moveTo, at(2026, 11, 18, 20), '„20:00" on that day');
  assert.deepEqual(opAt('2026-11-23').values, [{ key: 'kolor', text: 'fioletowy' }], 'a colour by its word');
  assert.equal(opAt('2026-11-05'), undefined, 'a Thursday is no day of this series');
  assert.ok(daysPlan.warnings.some((w) => w.includes('2026-11-05') && w.includes('nie jest dniem tej serii')), daysPlan.warnings.join(' | '));
  assert.deepEqual([opAt('2026-12-02').cancel, opAt('2026-12-02').at], [true, null], 'a day beyond the loaded days is found when writing');
  assert.equal(opAt('2026-11-09'), undefined, 'a day the document leaves out stays as it is');
  ok('days of a series: cancel, take back, move, day values — at their known name; a day that is not one of the series is refused');

  /* -- 5: Unlesbares ------------------------------------------------------------------------------------ */
  assert.ok('error' in m.planCalendar([], state), 'a list is no document');
  assert.ok('error' in m.planCalendar('tekst', state));
  assert.ok('error' in m.planCalendar({ format: 'recreatio/page', appointments: [] }, state), 'another format is refused');
  assert.ok('error' in m.planCalendar({ format: 'recreatio/calendar' }, state), 'no appointments, no plan');
  /* Ohne „Zapisy" (sein Pflichtfeld nähme hier jedem neuen Treffen den Platz). */
  const plain = { ...state, schemes: [{ id: 'scheme-msza', def: MSZA }] };
  const bad = m.planCalendar({
    format: 'recreatio/calendar', version: 2, odd: true, calendar: 'Parafia',
    appointments: [
      7,
      { id: 'nie-ma-takiego', title: 'Zgubiony' },
      { title: 'Bez startu' },
      { title: 'Zły start', start: 'jutro o 18' },
      {
        title: 'Śmieci', start: '2026-11-05T19:00', end: '18:00', repeat: 'czasem', weekdays: 'pn', every: 0, until: '30.06.2027', count: 'dużo',
        values: 5, occurrences: 'x', bookable: 'tak', capacity: -3, kind: 'party', link: 'javascript:alert(1)', hobby: 'chór', scheme: 'Nieznany',
        allDay: 'tak', points: 'nie lista'
      },
      { title: 'Godzina bez dnia', start: '18:00' },
      { title: 'Kółko A', key: 'a', parent: '@b', start: '2026-11-05T19:00' },
      { title: 'Kółko B', key: 'b', parent: '@a', start: '2026-11-05T19:00' },
      { title: 'Zły klucz', key: 'zły klucz!', parent: '@nikt', start: '2026-11-06T10:00' },
      { kind: 'mass', start: '2026-11-08T10:00', occurrences: [{ date: '2026-11-09', cancelled: true }, { date: 'jutro' }, 3] },
      { id: J, location: 'Nowe miejsce' },
      { id: B, values: { kolor: 'zielony', nieznane: 'x', celebrans: { a: 1 } }, occurrences: [
        { date: '2026-11-16', values: { celebrans: 'x', kolor: 'tęczowy' }, start: 'później' },
        { date: '2026-11-04', cancelled: true, values: { kolor: 'zielony' } }
      ] },
      { title: 'Bez tytułu?', remove: true }
    ]
  }, plain);
  assert.ok(!('error' in bad), 'garbage is planned around, not refused');
  const w = bad.warnings.join(' | ');
  for (const part of [
    'Nieznany klucz "odd"', '"version": 2', '"calendar" to obiekt', 'appointments[0]: to nie obiekt', 'nie ma terminu o tym "id"', 'termin bez "start"',
    '"start" to "RRRR-MM-DDTGG:MM"', '"end" nie jest po "start"', '"repeat" to', '"weekdays" tylko przy', '"every" to liczba', '"until" to ostatni dzień', '"count" to liczba',
    '"values" to obiekt', '"occurrences" to lista', '"bookable" to true', '"capacity" to liczba', '"kind" to', '"link" zaczyna się', 'nieznany klucz "hobby"',
    'schematu „Nieznany” nie ma', '"allDay" to true albo false', '"points" to lista', 'tworzy krąg', '"key" to krótka nazwa', '"parent" @nikt',
    'termin nie powtarza się', '"date" to dzień serii', 'occurrences[2]: to nie obiekt', 'zaszyfrowana kluczem, którego nie masz',
    '„kolor” to pole jednego dnia', 'nie ma pola „nieznane”', 'wartość pola „Celebrans” to tekst', '„celebrans” to pole całego terminu', '„tęczowy” nie ma na liście',
    'wartości odwołanego dnia zostają',
    '"remove" działa tylko z "id"'
  ]) assert.ok(w.includes(part), `warns: ${part} — ${w}`);
  assert.deepEqual(bad.items.filter((one) => one.itemId === null).map((one) => one.label).sort(), ['Kółko A', 'Kółko B', 'Msza', 'Zły klucz', 'Śmieci'].sort(),
    'what can be read is still planned (a time without a day cannot)');
  const smieci = bad.items.find((one) => one.label === 'Śmieci');
  assert.deepEqual([smieci.save.kind, smieci.save.repeat, smieci.save.link, smieci.save.minutes, smieci.save.bookable], ['appointment', 'none', '', 60, null]);
  assert.equal(bad.items.find((one) => one.label === 'Kółko B').parent?.ref, bad.items.find((one) => one.label === 'Kółko A').ref, 'one side of a circle stays');
  assert.equal(planned(bad, J).save, null, 'a term with fields that do not open is not overwritten');
  assert.equal(planned(bad, B).save, null, 'unreadable values change nothing');
  assert.deepEqual(planned(bad, B).occurrences, [], 'nor the values of a cancelled day (they are not loaded)');
  ok('unreadable values, keys and days are warned about and skipped; another format or a non-object is refused');

  /* -- 6: ein anderer Kalender; entfernen ----------------------------------------------------------------- */
  const foreign = m.planCalendar({ ...copy(doc), calendar: { id: 'inny-kalendarz', title: 'Inny' } }, state);
  assert.equal(foreign.foreign, true);
  assert.ok(foreign.warnings[0].startsWith('Dokument z innego kalendarza („Inny”)'), foreign.warnings[0]);
  assert.ok(foreign.items.every((one) => one.itemId === null), 'a copy: everything is new');
  assert.equal(foreign.items.find((one) => one.label === 'Nauka').parent.ref, foreign.items.find((one) => one.label === 'Rekolekcje').ref, 'points under their new whole');
  assert.equal(foreign.items.find((one) => one.label === 'Dyżur').parent, undefined, 'an id of the other calendar is no parent here');
  assert.deepEqual(foreign.removals, []);
  assert.equal(foreign.counts.created, 9, 'the one without a readable title is skipped');

  const removal = m.planCalendar({ format: 'recreatio/calendar', appointments: [
    { id: A, remove: true }, { id: D, remove: true, points: [{ id: E, title: 'Nauka' }] }, { id: F, location: 'Kaplica' }, { title: 'Agapa', parent: D, start: '21:00' }
  ] }, state);
  assert.deepEqual(removal.removals.map((r) => [r.itemId, r.label, r.points]), [[A, 'Próba scholi', 0], [D, 'Rekolekcje', 2]]);
  assert.equal(removal.warnings.filter((x) => x.includes('stoi pod usuwanym terminem')).length, 3, `nested, staying under it, or named by id — ${removal.warnings.join(' | ')}`);
  assert.deepEqual(removal.items, [], 'nothing else is written');
  assert.ok(removal.lines.includes('Usunięcie: „Rekolekcje” — cały termin razem z punktami programu (2)'), removal.lines.join(' | '));
  ok('a document of another calendar only adds (points under their copies); "remove" takes the whole with its points');

  /* -- 7: die Beispiele und was ein Dokument braucht -------------------------------------------------------- */
  const empty = { calendar: { ...info, booking: false }, items: [], schemes: [], spans: [] };
  for (const sample of samples.slice(0, 2)) {
    const p = m.planCalendar(sample.doc(), empty);
    assert.ok(!('error' in p), sample.label);
    assert.deepEqual(p.warnings, [], `${sample.label}: imports into any calendar without a warning`);
    assert.ok(p.counts.created >= 3, `${sample.label}: creates`);
  }
  const lessons = m.planCalendar(samples[0].doc(), empty);
  const math = lessons.items.find((one) => one.label === 'Matematyka');
  assert.deepEqual([math.save.repeat, math.save.weekdays, math.save.until], ['weekly', 1 | 4, '2027-06-25']);
  assert.deepEqual(math.occurrences.map((op) => [op.day, op.cancel ?? false, op.moveTo !== undefined]), [['2026-11-11', true, false], ['2026-11-16', false, true]]);
  const religion = lessons.items.find((one) => one.label === 'Religia');
  assert.deepEqual([religion.save.count, religion.save.until], [34, null]);
  const masses = m.planCalendar(samples[2].doc(), { ...empty, calendar: info, schemes: [{ id: 'scheme-msza', def: MSZA }] });
  assert.deepEqual(masses.warnings, [], 'the masses sample fits a calendar with that scheme and bookings');
  assert.ok(m.planCalendar(samples[2].doc(), empty).warnings.some((x) => x.includes('schematu „Msza” nie ma')), 'and says what is missing elsewhere');

  const needs = m.docNeeds(doc, CAL);
  for (const id of [A, B, D, E, OUTSIDE]) assert.ok(needs.ids.includes(id.toLowerCase()), `needs ${id}`);
  assert.ok(needs.from <= '2026-11-01' && needs.to >= '2026-12-24', `searched where they stand: ${needs.from} … ${needs.to}`);
  assert.deepEqual(m.docNeeds(samples[0].doc(), CAL), { ids: [], from: null, to: null }, 'a document without ids needs no appointment');
  assert.deepEqual(m.docNeeds({ ...doc, calendar: { id: 'inny' } }, CAL).ids, [], 'nor does a copy from another calendar');
  ok('the samples plan cleanly (lessons with cancelled and moved days, a program over @key, masses with a scheme); a document says what it needs');
} finally {
  await rm(out, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
