/**
 * 2026-10-29 — MESSEN UND INTENTIONEN ALS JSON (`masses/massesJson.ts`, "recreatio/masses"), nachgemessen —
 * ohne Dienst, ohne Schlüssel, an einem gedachten Kalender einer Pfarrei:
 *
 *   1. Die Beschreibung steht ohne die App: jeder Schlüssel jedes Abschnitts ist erklärt, und jeder Schlüssel
 *      der Beispiele und eines Exports ist beschrieben.
 *   2. Export → Lesen → Plan eines unveränderten Dokuments: keine Änderung, keine Warnung, alle Kennungen bleiben.
 *   3. Eine Intention ohne "id" kommt neu an genau ihre Messe; dieselbe Treść (anders geschrieben) nicht doppelt;
 *      eine ANDERE an einer Messe mit pojedyncza ist ein Konflikt — übergangen, oder mit „dopisz" daneben.
 *   4. „wolna", zbiorowa, verlegen, Reihenfolge, absagen und zurückholen, ein Priester — eine pojedyncza.
 *   5. Messen: neu (mit "@key"), ganz geändert, „ta i następne"; was Intentionen ihre Messe nähme, wird nicht geändert.
 *   6. Unlesbares wird gewarnt statt zu stürzen; ein anderes Format wird abgewiesen.
 *
 *   node scripts/app-json-masses-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = await mkdtemp(join(tmpdir(), 'app-json-masses-'));
await build({
  entryPoints: { masses: 'src/app/masses/massesJson.ts', tree: 'src/app/core/jsonTree.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
/* Wie in den anderen Prüfungen: ein BroadcastChannel des Schlüsselbunds hielte den Lauf am Leben. */
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(out, 'masses.js')).href);
const tree = await import(pathToFileURL(join(out, 'tree.js')).href);

let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Jeder Schlüssel eines Dokuments als Pfad: `masses[].title`, `occurrences[].intentions[].giver`. */
function pathsOf(value, prefix = '', found = new Set()) {
  for (const [key, one] of Object.entries(value)) {
    const path = `${prefix}${key}`;
    found.add(path);
    if (isPlain(one)) pathsOf(one, `${path}.`, found);
    else if (Array.isArray(one)) for (const item of one) if (isPlain(item)) pathsOf(item, `${path}[].`, found);
  }
  return found;
}

/* -- Ein gedachter Kalender: Werktags 7:00, täglich 18:00, Różaniec 17:30 ------------------------------ */
const id = (n) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const CAL = id(1), CAL2 = id(2), CAL_RO = id(3);
const A = id(11), B = id(12), C = id(13);
const R_JAN = id(21), R_MAREK = id(22), R_ANNA = id(23);
const I1 = id(31), I2 = id(32), I3 = id(33), I4 = id(34), I5 = id(35);
const iso = (day, time) => {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi).toISOString();
};
const occ = (itemId, kind, day, time, intentions = [], extra = {}) => ({
  itemId, calendarId: CAL, kind, occurrenceAt: iso(day, time), date: day, time, addressDate: day,
  status: 'planned', skipped: false, moved: false, people: [], intentions, ...extra
});
const intention = (iid, ordinal, text, extra = {}) => ({ id: iid, ordinal, text, kind: 'single', status: 'accepted', celebrant: null, giver: '', offering: '', ...extra });
const people = [{ roleId: R_JAN, name: 'ks. Jan Kowalski' }, { roleId: R_MAREK, name: 'ks. Marek Nowak' }, { roleId: R_ANNA, name: 'Anna Wiśniewska' }];
const JAN = [{ roleId: R_JAN, duty: 'celebrant' }];
const series = () => new Map([
  [A, { itemId: A, calendarId: CAL, kind: 'mass', title: 'Msza św.', date: '2026-09-01', time: '07:00', minutes: 45, repeat: 'weekly', every: 1, weekdays: 63, until: null, place: 'kościół parafialny', people: JAN, editable: true }],
  [B, { itemId: B, calendarId: CAL, kind: 'mass', title: '', date: '2026-09-01', time: '18:00', minutes: 45, repeat: 'daily', every: 1, weekdays: 0, until: '2026-12-31', place: '', people: [], editable: true }],
  [C, { itemId: C, calendarId: CAL, kind: 'devotion', title: 'Różaniec', date: '2026-10-01', time: '17:30', minutes: 30, repeat: 'daily', every: 1, weekdays: 0, until: '2026-11-30', place: '', people: [{ roleId: R_ANNA, duty: 'lead' }], editable: true }]
]);
const occurrences = () => [
  occ(A, 'mass', '2026-11-02', '07:00', [intention(I1, 0, 'Za śp. Jana Kowalskiego w 1. rocznicę śmierci', { giver: 'rodzina', offering: '50 zł' })], { people: JAN }),
  occ(C, 'devotion', '2026-11-02', '17:30', [], { people: [{ roleId: R_ANNA, duty: 'lead' }] }),
  occ(B, 'mass', '2026-11-02', '18:00', [intention(I2, 0, 'Za zmarłych polecanych w wypominkach', { kind: 'collective' }), intention(I3, 1, 'Za śp. Stanisława Wójcika', { kind: 'collective' })]),
  occ(A, 'mass', '2026-11-03', '07:00', [], { people: JAN }),
  occ(C, 'devotion', '2026-11-03', '17:30', [], { people: [{ roleId: R_ANNA, duty: 'lead' }] }),
  occ(B, 'mass', '2026-11-03', '18:00', [intention(I4, 0, 'O zdrowie i Boże błogosławieństwo dla Zofii w 80. rocznicę urodzin', { celebrant: R_MAREK })], { people: [{ roleId: R_MAREK, duty: 'celebrant' }] }),
  occ(A, 'mass', '2026-11-04', '07:00', [intention(I5, 0, 'Dziękczynna za 25 lat małżeństwa Ewy i Piotra', { status: 'celebrated' })], { people: JAN }),
  occ(C, 'devotion', '2026-11-04', '17:30', [], { people: [{ roleId: R_ANNA, duty: 'lead' }] }),
  occ(B, 'mass', '2026-11-04', '18:00', [], { status: 'cancelled', skipped: true })
];
const stateWith = (extra = {}) => ({
  calendars: [
    { calendarId: CAL, title: 'Parafia św. Józefa', areaName: 'Parafia św. Józefa', mayWrite: true, durationMinutes: 45 },
    { calendarId: CAL2, title: 'Kaplica', areaName: 'Kaplica cmentarna', mayWrite: true },
    { calendarId: CAL_RO, title: 'Dekanat', areaName: 'Dekanat', mayWrite: false }
  ],
  chosen: CAL, loaded: [CAL, CAL2], from: '2026-11-01', to: '2026-11-30',
  series: series(), occurrences: occurrences(),
  people: new Map([[CAL, people], [CAL2, people]]),
  today: '2026-10-29',
  ...extra
});
const plan = (doc, state = stateWith(), options) => {
  const read = m.readMassesDocument(doc);
  assert.ok(!('error' in read), `the document reads: ${read.error}`);
  const planned = m.planMasses(read.doc, state, options);
  assert.ok(!('error' in planned), `the document plans: ${planned.error}`);
  return { ...planned, warnings: [...read.warnings, ...planned.warnings] };
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const at = (doc, date, time) => doc.occurrences.find((o) => o.date === date && o.time === time);

try {
  /* -- 1. Die Beschreibung ---------------------------------------------------------------------------- */
  const text = m.massesDescription();
  assert.ok(typeof text === 'string' && text.includes('"recreatio/masses"'), 'the description is there without any app context');
  const sections = new Map(tree.sectionsOf(m.MASSES_JSON).map((s) => [s.node.key, s.node.text()]));
  const explained = [['masses', m.MASSES_TOP_KEYS], ['masses.mass', m.MASS_KEYS], ['masses.occurrence', m.OCCURRENCE_KEYS], ['masses.intention', m.INTENTION_KEYS]];
  for (const [key, keys] of explained) {
    for (const [name, says] of Object.entries(keys)) {
      assert.ok(sections.get(key).includes(`"${name}" — `), `section ${key} explains "${name}"`);
      assert.ok(typeof says === 'string' && says.trim().length > 3, `"${name}" has a real sentence`);
    }
  }
  const paths = m.massesKeyPaths();
  const samples = tree.samplesOf(m.MASSES_JSON);
  assert.equal(samples.length, 2, 'two whole samples to insert');
  const seen = new Set();
  for (const sample of samples) {
    for (const path of pathsOf(sample.doc())) { assert.ok(paths[path] !== undefined, `sample „${sample.label}”: "${path}" is described`); seen.add(path); }
  }
  for (const part of ['wolna', 'msza zbiorowa', '"free": true', '"collective": true', 'księgi intencji', 'konflikt', '[?]']) assert.ok(text.toLowerCase().includes(part.toLowerCase()), `the description speaks of ${part}`);
  ok(`description: ${sections.size} sections, ${Object.keys(paths).length} keys explained, every key of both samples described`);

  /* -- 2. Export → Plan: nichts zu tun ----------------------------------------------------------------- */
  const state = stateWith();
  const exported = clone(m.exportMasses(state, CAL, '2026-11-02', '2026-11-04'));
  for (const path of pathsOf(exported)) { assert.ok(paths[path] !== undefined, `export: "${path}" is described`); seen.add(path); }
  assert.equal(exported.format, 'recreatio/masses');
  assert.equal(exported.calendar, CAL);
  assert.deepEqual(exported.masses.map((x) => x.id), [A, B, C], 'masses first, by hour; then the devotion');
  assert.deepEqual(exported.masses[0], { id: A, kind: 'mass', title: 'Msza św.', date: '2026-09-01', time: '07:00', minutes: 45, repeat: 'weekly', weekdays: ['pn', 'wt', 'śr', 'cz', 'pt', 'so'], place: 'kościół parafialny', celebrants: ['ks. Jan Kowalski'] }, 'a series without end: no "until"');
  assert.equal(exported.masses[1].until, '2026-12-31');
  assert.deepEqual(exported.masses[2].celebrants, ['Anna Wiśniewska'], 'who leads the devotion');
  assert.equal(exported.occurrences.length, 6, 'only masses stand day by day');
  assert.deepEqual(at(exported, '2026-11-02', '07:00').intentions, [{ id: I1, text: 'Za śp. Jana Kowalskiego w 1. rocznicę śmierci', giver: 'rodzina', offering: '50 zł' }]);
  assert.equal(at(exported, '2026-11-02', '18:00').collective, true, 'a collective mass says so once');
  assert.ok(at(exported, '2026-11-02', '18:00').intentions.every((i) => i.kind === undefined));
  assert.equal(at(exported, '2026-11-03', '07:00').free, true, 'a mass without an intention is „wolna”');
  assert.deepEqual(at(exported, '2026-11-03', '18:00').celebrants, ['ks. Marek Nowak'], 'a day with its own celebrant says so');
  assert.equal(at(exported, '2026-11-03', '18:00').intentions[0].celebrant, 'ks. Marek Nowak');
  assert.equal(at(exported, '2026-11-04', '07:00').intentions[0].status, 'celebrated');
  assert.deepEqual([at(exported, '2026-11-04', '18:00').cancelled, at(exported, '2026-11-04', '18:00').free], [true, undefined], 'a cancelled day is not „wolna”');
  const same = plan(exported, state);
  assert.deepEqual(same.warnings, [], `no warnings on a round trip: ${same.warnings.join(' | ')}`);
  assert.equal(same.empty, true, `nothing to do: ${same.lines.join(' | ')}`);
  assert.deepEqual([same.creates.length, same.updates.length, same.occurrences.length, same.conflicts], [0, 0, 0, 0]);
  assert.ok(same.lines.some((l) => l.startsWith('Bez zmian')), 'and says so');
  ok('export → read → plan of an unchanged document: no change, no warning, every id stays');

  /* -- 3. Neu, dieselbe, Konflikt ---------------------------------------------------------------------- */
  {
    const doc = clone(exported);
    const free = at(doc, '2026-11-03', '07:00');
    delete free.free;
    free.intentions = ['Za śp. Henryka Lisa', { text: 'O zdrowie dla Marka', giver: 'żona', offering: '100 zł', celebrant: 'Kowalski' }];
    const p = plan(doc);
    assert.equal(p.occurrences.length, 1);
    const slot = p.occurrences[0];
    assert.deepEqual([slot.mass, slot.date, slot.occurrenceAt], [{ existing: A }, '2026-11-03', iso('2026-11-03', '07:00')], 'the mass of that day, by its address');
    assert.deepEqual(slot.adds.map((a) => [a.text, a.kind, a.giver, a.offering, a.celebrant, a.ordinal]), [
      ['Za śp. Henryka Lisa', 'single', '', '', null, null],
      ['O zdrowie dla Marka', 'single', 'żona', '100 zł', R_JAN, null]
    ], 'two new ones, appended, the second with gift and celebrant (the surname alone finds him)');
    assert.ok(p.lines.some((l) => l.startsWith('wt 3.11 7:00 — nowa „Za śp. Henryka Lisa”; nowa „O zdrowie dla Marka” (ofiarodawca, ofiara, odprawia ks. Jan Kowalski)')), p.lines.join(' | '));
    assert.ok(p.warnings.some((w) => w.includes('2 intencje pojedyncze')), 'two singles: two priests');
    assert.ok(p.lines.some((l) => l.startsWith('Intencje: nowe 2, zmienione 0, przeniesione 0, bez zmian 5; msze wolne: 0')), p.lines.join(' | '));
  }
  {
    const twice = plan({ format: 'recreatio/masses', version: 1, occurrences: [{ date: '2026-11-02', time: '7:00', intentions: ['za sp. Jana Kowalskiego w 1 rocznice smierci'] }] });
    assert.deepEqual([twice.empty, twice.warnings], [true, []], 'the same text, spelled otherwise, is the same intention');
    const conflict = { format: 'recreatio/masses', occurrences: [{ date: '2026-11-02', time: '07:00', intentions: ['Za śp. Marię Nowak'] }] };
    const skipped = plan(conflict);
    assert.deepEqual([skipped.conflicts, skipped.occurrences.length], [1, 0], 'a different one at a mass with a single: nothing added');
    assert.ok(skipped.warnings.some((w) => w.includes('ma już intencję „Za śp. Jana Kowalskiego') && w.includes('„Za śp. Marię Nowak”') && w.includes('dopisz obok')), skipped.warnings.join(' | '));
    const added = plan(conflict, stateWith(), { conflicts: 'add' });
    assert.deepEqual(added.occurrences[0].adds.map((a) => a.text), ['Za śp. Marię Nowak'], 'or beside it, when chosen');
    assert.ok(added.warnings.some((w) => w.includes('dopisane obok')) && added.warnings.some((w) => w.includes('potrzeba 2 kapłanów')));
    const collective = plan({ occurrences: [{ date: '2026-11-02', time: '18:00', collective: true, intentions: ['Za zmarłych polecanych w wypominkach', 'Za śp. Ireny Kos'] }] });
    assert.deepEqual([collective.conflicts, collective.occurrences[0].adds.map((a) => a.kind)], [0, ['collective']], 'collective beside collective is no conflict');
    assert.ok(collective.warnings.some((w) => w.includes('Za śp. Stanisława Wójcika') && w.includes('zostają')), 'what the document leaves out stays — and it is said');
  }
  ok('a new intention goes to exactly its mass; the same text is not doubled; a different one at a single is a conflict (skip or add)');

  /* -- 4. Wolna, zbiorowa, verlegen, Reihenfolge, absagen, ein Priester -------------------------------- */
  {
    const freeDoc = plan({ occurrences: [{ date: '2026-11-02', time: '18:00', free: true }] });
    assert.ok(freeDoc.empty && freeDoc.warnings.some((w) => w.includes('w dokumencie wolna') && w.includes('zostaje')), 'free in the book, an intention in the calendar: said, nothing removed');
    assert.equal(m.readMassesDocument({ occurrences: [{ date: '2026-11-03', time: '07:00', intentions: ['WOLNA'] }] }).doc.occurrences[0].free, true, '„wolna” as a text is a free slot');
    const coll = plan({ occurrences: [{ date: '2026-11-03', time: '07:00', collective: true, intentions: ['Za parafian', { text: 'Za dobrodziejów', kind: 'single' }] }] });
    assert.deepEqual(coll.occurrences[0].adds.map((a) => a.kind), ['collective', 'single'], 'collective for all without their own kind');

    const moving = clone(exported);
    const from = at(moving, '2026-11-02', '07:00');
    const to = at(moving, '2026-11-03', '07:00');
    delete to.free;
    to.intentions = from.intentions;
    from.intentions = [];
    const moved = plan(moving);
    assert.deepEqual(moved.occurrences.map((s) => [s.date, s.changes]), [['2026-11-03', [{ id: I1, move: true }]]], 'an intention under another mass is moved there');
    assert.ok(moved.lines.some((l) => l.includes('przeniesiona tu (z pn 2.11 7:00)')) && moved.warnings.length === 0, moved.warnings.join(' | '));

    const reorder = clone(exported);
    at(reorder, '2026-11-02', '18:00').intentions.reverse();
    const re = plan(reorder);
    assert.deepEqual(re.occurrences[0].changes.map((c) => [c.id, c.ordinal]), [[I3, 0], [I2, 1]], 'the order of reading follows the document');
    assert.ok(re.lines.some((l) => l.includes('nowa kolejność czytania')));

    const days = clone(exported);
    at(days, '2026-11-04', '18:00').cancelled = false;
    at(days, '2026-11-03', '07:00').cancelled = true;
    at(days, '2026-11-02', '07:00').cancelled = true;
    const dayPlan = plan(days);
    const byDate = new Map(dayPlan.occurrences.map((s) => [`${s.date} ${s.label}`, s]));
    assert.equal(byDate.get('2026-11-04 śr 4.11 18:00')?.restore, true, 'a cancelled day comes back');
    assert.equal(byDate.get('2026-11-03 wt 3.11 7:00')?.cancel, true, 'a free day is cancelled');
    assert.equal(byDate.has('2026-11-02 pn 2.11 7:00'), false, 'a day with an intention is not');
    assert.ok(dayPlan.warnings.some((w) => w.startsWith('pn 2.11 7:00: nie odwołuję')));
    const intoCancelled = plan({ occurrences: [{ date: '2026-11-04', time: '18:00', intentions: ['Za śp. Ewę'] }] });
    assert.ok(intoCancelled.empty && intoCancelled.warnings.some((w) => w.includes('msza jest odwołana')), 'a cancelled mass takes no intention');

    const priest = clone(exported);
    at(priest, '2026-11-03', '18:00').intentions.push({ text: 'Za śp. Henryka Lisa', celebrant: 'ks. Marek Nowak' });
    const pp = plan(priest);
    assert.equal(pp.occurrences[0].adds[0].celebrant, null, 'one priest, one single intention per mass');
    assert.ok(pp.warnings.some((w) => w.includes('ks. Marek Nowak ma już pojedynczą intencję')), pp.warnings.join(' | '));

    const unknownId = plan({ occurrences: [{ date: '2026-11-03', time: '07:00', intentions: [{ id: id(99), text: 'Za śp. Józefa' }] }] });
    assert.ok(unknownId.occurrences[0].adds.length === 1 && unknownId.warnings.some((w) => w.includes('nie znam intencji')), 'an unknown id: new, with a word');

    const changed = clone(exported);
    Object.assign(at(changed, '2026-11-02', '07:00').intentions[0], { text: 'Za śp. Jana Kowalskiego (1. rocznica)', offering: '', status: 'cancelled' });
    const ch = plan(changed);
    assert.deepEqual(ch.occurrences[0].changes, [{ id: I1, text: 'Za śp. Jana Kowalskiego (1. rocznica)', status: 'cancelled', offering: '' }], 'only what changed, by id');
  }
  ok('„wolna”, collective, moving, the order of reading, cancel and restore one day, one priest per single, unknown ids, changes in place');

  /* -- 5. Messen: neu, geändert, ta i następne --------------------------------------------------------- */
  {
    const empty = stateWith({ series: new Map(), occurrences: [] });
    const sample = plan(m.seriesSample(), empty);
    assert.deepEqual(sample.warnings, [], `the series sample plans without a word: ${sample.warnings.join(' | ')}`);
    assert.equal(sample.creates.length, 4);
    assert.deepEqual(sample.creates.map((c) => [c.def.kind, c.def.time, c.def.repeat, c.def.weekdays, c.def.until]), [
      ['mass', '07:00', 'weekly', 63, '2027-06-30'], ['mass', '10:00', 'weekly', 64, null], ['devotion', '17:30', 'daily', 0, '2026-11-30'], ['confession', '17:00', 'weekly', 16, '2026-12-31']
    ]);
    assert.deepEqual(sample.creates[0].people, JAN);
    assert.deepEqual(sample.creates[3].people, [{ roleId: R_MAREK, duty: 'present' }], 'who hears confession is „present”');
    assert.deepEqual(sample.occurrences.map((s) => [s.mass, s.date, s.adds.length, s.cancel]), [
      [{ fresh: 0 }, '2026-11-02', 1, false], [{ fresh: 0 }, '2026-11-11', 0, true], [{ fresh: 1 }, '2026-11-08', 2, false]
    ], 'intentions at the new series by "@key"; a day of it cancelled');
    assert.deepEqual(sample.occurrences[1].people, [{ roleId: R_MAREK, duty: 'celebrant' }], 'and another celebrant that day');
    assert.ok(sample.lines.some((l) => l === 'Nowy: Msza św. — co tydzień (pn, wt, śr, cz, pt, so) 7:00, od 2.11.2026 do 30.6.2027; odprawia: ks. Jan Kowalski.'), sample.lines.join(' | '));

    const book = plan(m.bookSample(), stateWith({ occurrences: occurrences().map((o) => ({ ...o, intentions: [], status: 'planned', skipped: false })) }));
    assert.deepEqual(book.warnings.length, 1, `the book sample: only the two-priests note — ${book.warnings.join(' | ')}`);
    assert.ok(book.warnings[0].includes('potrzeba 2 kapłanów'));
    assert.equal(book.occurrences.reduce((n, s) => n + s.adds.length, 0), 7, 'seven intentions on four masses');

    const twin = plan({ masses: [{ date: '2026-11-02', time: '07:00', repeat: 'weekly', weekdays: ['pn'] }] });
    assert.ok(twin.warnings.some((w) => w.includes('jest już Msza św. o 7:00')), 'a new mass at the hour of an existing one: said');

    const upd = clone(exported);
    upd.masses[0].place = 'kaplica';
    upd.masses[1].time = '17:00';
    upd.masses[1].changeFrom = '2026-11-03';
    const up = plan(upd);
    assert.deepEqual(up.warnings, [], up.warnings.join(' | '));
    assert.deepEqual(up.updates.map((u) => [u.itemId, u.change]), [[A, { place: 'kaplica' }]], 'the whole series: only the place');
    assert.deepEqual(up.creates.map((c) => [c.handover, c.def.date, c.def.time, c.def.repeat, c.def.until]), [[{ itemId: B, from: '2026-11-03' }, '2026-11-03', '17:00', 'daily', '2026-12-31']], 'from a day: a new series takes over (ta i następne)');
    assert.ok(up.lines.some((l) => l.startsWith('Zmiana od 3.11.2026 (ta i następne): Msza — codziennie 18:00: godzina 18:00 → 17:00')), up.lines.join(' | '));

    const lose = clone(exported);
    lose.masses[0].weekdays = ['nd'];
    const lost = plan(lose);
    assert.equal(lost.updates.length, 0, 'a change that would take their mass from intentions is not made');
    assert.ok(lost.warnings.some((w) => w.includes('nie byłyby w planie') && w.includes('pn 2.11 7:00')));

    const timeAndDay = plan({ masses: [{ id: B, time: '19:00' }], occurrences: [{ date: '2026-11-03', time: '19:00', intentions: ['O zdrowie i Boże błogosławieństwo dla Zofii w 80. rocznicę urodzin', 'Za śp. Zenona'] }] });
    assert.deepEqual(timeAndDay.occurrences.map((s) => [s.mass, s.date, s.adds.map((a) => a.text)]), [[{ existing: B }, '2026-11-03', ['Za śp. Zenona']]], 'by day and the NEW hour of a changed series');
    assert.deepEqual(timeAndDay.updates.map((u) => u.change), [{ time: '19:00' }]);
  }
  ok('masses: new with "@key", the whole series changed in place, „ta i następne” from a day, no change that loses intentions');

  /* -- 6. Unlesbares, andere Formate, Grenzen ------------------------------------------------------------ */
  {
    const bad = m.readMassesDocument({
      format: 'recreatio/masses', version: 2, odd: true, from: 'jutro',
      masses: [5, { date: '2026-13-01', time: '25:00', kind: 'party', repeat: 'often', weekdays: ['xx'], minutes: 2, every: 0, hobby: 1, celebrants: 7 }],
      occurrences: [{ date: 'jutro' }, { date: '2026-11-02', time: '07:00', free: 'yes', intentions: [7, '', { text: '' }, { text: 'A', kind: 'big', status: 'maybe', giver: {}, extra: 1 }] }, 'x']
    });
    assert.ok(!('error' in bad));
    const w = bad.warnings.join(' | ');
    for (const part of ['"version": 2', 'nieznany klucz "odd"', '"from" to', 'Msza 1: to nie obiekt', '"date" to "RRRR-MM-DD"', '"time" to "GG:MM"', '"kind" to "mass"', '"repeat" to', 'dzień „xx”', '"minutes" to', '"every" to', 'nieznany klucz "hobby"', '"celebrants" to lista', 'Pozycja 1', '"free" to true albo false', 'intencja to tekst albo obiekt', 'pusta intencja', 'bez "text"', '"kind" to "single"', '"status" to', '"giver" to nie tekst', 'nieznany klucz "extra"', 'Pozycja 3: to nie obiekt']) {
      assert.ok(w.includes(part), `warns: ${part} — ${w}`);
    }
    const planned = m.planMasses(bad.doc, stateWith());
    assert.ok(!('error' in planned) && planned.warnings.some((x) => x.includes('nowy wpis potrzebuje "date" i "time"')), 'and plans without crashing');
    const misses = plan({ occurrences: [
      { date: '2026-11-03', time: '07:30', intentions: ['X'] }, { date: '2026-11-03', time: '17:30', intentions: ['Y'] },
      { mass: '@nikt', date: '2026-11-03', intentions: ['Z'] }, { mass: id(98), date: '2026-11-03' }, { date: '2026-11-03', intentions: ['T'] },
      { date: '2026-11-03', time: '07:00', calendar: 'Dekanat', intentions: ['U'] }
    ] });
    const mw = misses.warnings.join(' | ');
    for (const part of ['nie ma mszy o 7:30 (są: 7:00, 18:00)', 'jest nabożeństwo, nie msza', 'nie ma wpisu "@nikt"', 'nie znam mszy o "mass"', 'bez "mass" potrzebna jest "time"', 'możesz tylko czytać']) assert.ok(mw.includes(part), `says: ${part} — ${mw}`);
    assert.ok(misses.empty);
    const persons = plan({ masses: [{ id: A, celebrants: ['ks. Proboszcz'] }] });
    assert.ok(persons.updates.length === 0 && persons.warnings.some((x) => x.includes('„ks. Proboszcz” — nie znam takiej osoby')), 'an unknown person changes nothing, with a word');

    for (const doc of [{ format: 'recreatio/page', modules: [] }, [], 'x', { format: 'recreatio/masses' }]) assert.ok('error' in m.readMassesDocument(doc), `refused: ${JSON.stringify(doc)}`);
    assert.ok('error' in m.planMasses(m.readMassesDocument({ calendar: 'Nieznana parafia', occurrences: [] }).doc, stateWith()), 'an unknown calendar is refused');
    assert.ok('error' in m.planMasses(m.readMassesDocument({ calendar: CAL_RO, occurrences: [] }).doc, stateWith()), 'a calendar I only read is refused');
    assert.equal(m.planMasses(m.readMassesDocument({ calendar: 'kaplica cmentarna', occurrences: [] }).doc, stateWith()).calendarId, CAL2, 'a calendar by its name');

    const needs = m.needsOf(m.readMassesDocument(m.bookSample()).doc, stateWith().calendars, CAL, '2026-10-29');
    assert.deepEqual(needs, { calendars: [CAL], from: '2026-11-02', to: '2026-11-04' }, 'what the document needs loaded');
    assert.ok('error' in m.needsOf(m.readMassesDocument({ occurrences: [{ date: '2026-01-01', time: '07:00' }, { date: '2027-06-01', time: '07:00' }] }).doc, stateWith().calendars, CAL, '2026-10-29'), 'more than a year is refused');
  }
  ok('unreadable values: a warning each, no crash; misses said with what is there; other formats, unknown and read-only calendars refused');

  /* -- 7. Rechnen: Reihen und Menschen ----------------------------------------------------------------- */
  {
    const has = (def, day) => m.seriesHas({ until: null, every: 1, weekdays: 0, ...def }, day);
    assert.deepEqual(['2026-02-27', '2026-02-28', '2026-03-31', '2026-04-30'].map((d) => has({ date: '2026-01-31', repeat: 'monthly' }, d)), [false, true, true, true], 'monthly on the 31st: the last day where there is none');
    assert.deepEqual(['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11', '2026-11-16'].map((d) => has({ date: '2026-11-02', repeat: 'weekly', weekdays: 5, every: 2 }, d)), [true, true, false, false, true], 'every second week, Monday and Wednesday');
    assert.deepEqual(['2026-11-04', '2026-11-05'].map((d) => has({ date: '2026-11-01', repeat: 'daily', every: 3 }, d)), [true, false]);
    assert.deepEqual([has({ date: '2026-11-01', repeat: 'none' }, '2026-11-01'), has({ date: '2026-11-01', repeat: 'none' }, '2026-11-02'), has({ date: '2026-11-01', repeat: 'daily', until: '2026-11-03' }, '2026-11-04')], [true, false, false]);
    assert.deepEqual(m.findPerson('Kowalski', people, new Set()), { roleId: R_JAN });
    assert.deepEqual(m.findPerson('Jan Kowalski', people, new Set()), { roleId: R_JAN }, 'without „ks.”');
    assert.deepEqual(m.findPerson(R_MAREK.toUpperCase(), people, new Set()), { roleId: R_MAREK }, 'by id');
    assert.ok('problem' in m.findPerson('ks. Proboszcz', people, new Set()));
    assert.ok('problem' in m.findPerson(id(77), people, new Set()) && 'roleId' in m.findPerson(id(77), people, new Set([id(77)])), 'an id must be of the group — or pinned already');
    assert.equal(m.personOut(R_MAREK, people), 'ks. Marek Nowak');
    assert.equal(m.personOut(R_JAN, [...people, { roleId: id(78), name: 'ks. Jan Kowalski' }]), R_JAN, 'two of one name: the id');
    assert.equal(m.untilOf('2026-11-01', '2036-11-01'), null, 'ten years ahead is „without end”');
  }
  ok('series days as the service counts them (monthly clamp, every n weeks), persons by name, surname or id');

  /* -- 8. Der Auftrag für die eigene KI ------------------------------------------------------------------ */
  {
    const prompt = m.massesPrompt(exported);
    assert.ok(prompt.includes(m.massesDescription().trim()) && prompt.includes(`"mass": "${A}"`) && prompt.includes('[?]'), 'the prompt carries the description and the export');
  }
  ok('the prompt for the own AI: task, description, export');

  /* -- 9. Ein ganzer Monat — und dieselbe Messe zweimal im Dokument ------------------------------------- */
  {
    const SUNDAY = { '08:00': id(14), '10:00': id(15), '12:00': id(16) };
    const month = [];
    let n = 100;
    for (let d = 1; d <= 30; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`;
      const sunday = new Date(2026, 10, d).getDay() === 0;
      const times = sunday ? [...Object.entries(SUNDAY), ['18:00', B]] : [['07:00', A], ['18:00', B]];
      for (const [time, item] of times) {
        const list = Array.from({ length: (d + time.length) % 4 }, (_, k) => intention(id(n++), k, `Za śp. Parafianina ${d}/${time}/${k}`, { kind: k > 1 ? 'collective' : 'single', giver: k === 0 ? 'rodzina' : '' }));
        month.push(occ(item, 'mass', day, time, list.some((i) => i.kind === 'collective') ? list.map((i) => ({ ...i, kind: 'collective' })) : list.slice(0, 1)));
      }
    }
    const sundays = Object.entries(SUNDAY).map(([time, item]) => [item, { itemId: item, calendarId: CAL, kind: 'mass', title: 'Msza niedzielna', date: '2026-09-06', time, minutes: 60, repeat: 'weekly', every: 1, weekdays: 64, until: null, place: '', people: [], editable: true }]);
    const big = stateWith({ occurrences: month, series: new Map([...series(), ...sundays]) });
    const doc = clone(m.exportMasses(big, CAL, '2026-11-01', '2026-11-30'));
    const started = Date.now();
    const again = plan(doc, big);
    const took = Date.now() - started;
    assert.deepEqual([again.empty, again.warnings.length], [true, 0], `a whole month round-trips: ${again.warnings.slice(0, 3).join(' | ')}`);
    assert.ok(took < 2000, `and quickly (${took} ms)`);
    assert.equal(doc.occurrences.length, month.length);

    const twice = plan({ occurrences: [
      { date: '2026-11-03', time: '07:00', intentions: ['Za śp. Ewę'] },
      { date: '2026-11-03', mass: A, intentions: ['Za śp. Adama'] }
    ] });
    assert.deepEqual(twice.occurrences.map((s) => s.adds.map((a) => a.text)), [['Za śp. Ewę', 'Za śp. Adama']], 'one mass named twice: one entry, both intentions');
    assert.ok(twice.warnings.some((w) => w.includes('drugi raz — połączone')));
  }
  ok('a whole month (with Sundays) round-trips quickly; one mass named twice is merged, with a word');

  const unseen = Object.keys(paths).filter((p) => !seen.has(p));
  console.log(`     (keys in no sample or export, described for completeness: ${unseen.join(', ') || 'none'})`);
} finally {
  await rm(out, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
