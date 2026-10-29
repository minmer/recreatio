/**
 * LAMPY ALS JSON (2026-10-29) — nachgemessen ohne Telefon, ohne Dienst und ohne Schlüssel (`lamps/lampsJson.ts`).
 *
 *   1. Die Beschreibung: ohne App erreichbar (`describe(LAMPS_JSON)`, `lampsDescription()`), jeder Schlüssel mit einem
 *      Satz, jeder Abschnitt einmal, die Beispiele darin — so liest sie auch der Katalog des MCP-Dienstes.
 *   2. Jeder Schlüssel der Beispiele (und eines Exports) ist beschrieben, und jeder beschriebene kommt irgendwo vor.
 *   3. Export → JSON → Plan desselben Stands: nichts zu tun, keine Warnung, jede Kennung bleibt.
 *   4. An Ort und Stelle: nur, was das Dokument nennt; Sygnały in ihrer Reihenfolge (alle genannt) oder angehängt.
 *   5. Ohne "id" (oder mit fremdem): neu, mit frischer Kennung; Timer finden neue Geräte über "@klucz", alte über
 *      Kennung, Namen und die Schlüssel des Exports.
 *   6. "remove" nur mit "id", angesagt in der Liste, mit Warnung für Timer, die etwas verlieren.
 *   7. Kaputtes: Warnungen (oder ein Fehler des ganzen Dokuments) statt Abstürze.
 *   8. Schreiben mit Attrappen: Reihenfolge, was gespeichert ist, kommt zurück; ein Fehler hält an und sagt, wie weit.
 *   9. Die Beispiele zum Einsetzen importieren ohne ein Wort — und der Stand danach exportiert sich wieder ohne Änderung.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-json-lamps-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}lamps/lampsJson';
export { describe, sectionsOf, samplesOf } from '${app}core/jsonTree';
export { readLamp, readTimer, sealedJson, sealedTimerJson, lampOrder, timerOrder } from '${app}lamps/lampStore';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

/* Wie in app-chat-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

const ON = '1EFF00000048464B4AE15A2285B8F21CB0424734F03133C519101112131415';
const OFF = '1EFF00000048464B4AFFC185675ED4FE58606205383D074F85101112131415';
const OTHER = '1EFF00000048464B4A7C3D19A0E2B54F6D21C8830A9E57F1B2101112131415';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id = (n) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* Der Stand, wie `loadLamps` ihn liefert: durch die Hülle hin und zurück. */
  const lamp = (l) => ({ ...m.readLamp(m.sealedJson(l)), id: l.id, version: l.version, updatedAt: '2026-10-20T10:00:00Z' });
  const timer = (t) => ({ ...m.readTimer(m.sealedTimerJson(t)), id: t.id, version: t.version, updatedAt: '2026-10-20T10:00:00Z' });
  const bedroom = lamp({
    id: id(1), version: 3, name: 'Lampa w sypialni', number: '1', room: 'Sypialnia', note: null, protocol: 'ble-adv',
    signals: [
      { id: id(11), label: 'Włącz', note: null, frames: [{ hex: ON, durationMs: 1000, gapMs: 0 }] },
      { id: id(12), label: 'Wyłącz', note: 'drugi przycisk', frames: [{ hex: OFF, durationMs: 800, gapMs: 0 }] }
    ]
  });
  const salon = lamp({
    id: id(2), version: 1, name: 'Lampa w salonie', number: '2', room: null, note: 'HFKJ', protocol: 'ble-adv',
    signals: [
      { id: id(21), label: 'Ciepłe', note: null, frames: [{ hex: OTHER, durationMs: 1000, gapMs: 0 }] },
      { id: id(22), label: 'Noc', note: null, frames: [{ hex: OFF, durationMs: 600, gapMs: 300 }, { hex: OTHER, durationMs: 600, gapMs: 0 }] }
    ]
  });
  const morning = timer({ id: id(31), version: 2, name: 'Rano', minute: 420, days: [1, 2, 3, 4, 5], enabled: true, actions: [{ lampId: id(1), signalId: id(11) }], pace: { pauseMs: 0, limitMs: null } });
  const night = timer({ id: id(32), version: 1, name: '', minute: 1380, days: [], enabled: false, actions: [{ lampId: id(1), signalId: id(12) }, { lampId: id(2), signalId: id(22) }], pace: { pauseMs: 300, limitMs: 1000 } });
  /* Ein Timer, dessen Gerät schon gelöscht ist — so steht er im Telefon, bis jemand ihn ändert. */
  const stale = timer({ id: id(33), version: 1, name: 'Stary', minute: 600, days: [6, 7], enabled: true, actions: [{ lampId: id(9), signalId: id(99) }], pace: { pauseMs: 0, limitMs: null } });
  const now = { lamps: [bedroom, salon].sort(m.lampOrder), timers: [morning, night, stale].sort(m.timerOrder), buttons: { pauseMs: 150, limitMs: null } };
  const plan = (doc, state = now) => {
    const p = m.planLampsImport(doc, state);
    assert.ok(!('error' in p), `plans: ${p.error}`);
    return p;
  };
  const nothing = (p, label) => {
    assert.deepEqual([p.lamps.length, p.timers.length, p.removals.length, p.buttons], [0, 0, 0, null], `${label}: nothing to write`);
    assert.deepEqual(p.warnings, [], `${label}: no warnings`);
    assert.match(p.lines[0], /^Nic się nie zmieni/, `${label}: says so`);
  };

  /* -- 1. Die Beschreibung ---------------------------------------------------------------------------------------- */
  const text = m.describe(m.LAMPS_JSON);
  assert.equal(m.lampsDescription(), text, 'the same text without any context');
  assert.ok(text.startsWith(`# Lampy jako JSON ("${m.LAMPS_FORMAT}", wersja 1)`), 'the root heading names the format');
  assert.equal(m.LAMPS_FORMAT, 'recreatio/lamps');
  const sections = m.sectionsOf(m.LAMPS_JSON).map((s) => s.node.key);
  assert.equal(new Set(sections).size, sections.length, 'every section once');
  assert.deepEqual(sections, ['lamps', 'lamps.lamp', 'lamps.signal', 'lamps.frame', 'lamps.timer', 'lamps.action', 'lamps.pace', 'lamps.example', 'lamps.example-timers', 'lamps.example-change']);
  for (const [level, keys] of Object.entries(m.LAMPS_LEVELS)) {
    for (const [key, says] of Object.entries(keys)) {
      assert.ok(typeof says === 'string' && says.trim().length > 3, `${level || 'document'}.${key}: a real sentence`);
      /* Als eigene, eingerückte Zeile — ein Abschnitt, der mit den Schlüsseln beginnt, verlöre durch das Trimmen ihren Einzug. */
      assert.ok(text.includes(`\n  "${key}" — ${says}\n`), `${level || 'document'}.${key}: a line of its own in the description`);
    }
  }
  for (const word of ['Co robi import', '"remove": true', '"@klucz"', 'Limity', `${m.ROWS_MAX}`, 'Tylko ja', 'Zwróć JEDEN obiekt JSON']) {
    assert.ok(text.includes(word), `the description says ${word}`);
  }
  const samples = m.samplesOf(m.LAMPS_JSON);
  assert.equal(samples.length, 2, 'two samples to insert');
  for (const s of samples) assert.ok(text.includes(JSON.stringify(s.doc(), null, 2)), `the sample „${s.label}” is printed in the description (an AI reads only the text)`);
  ok(`description: reachable without the app (${Math.round(text.length / 1024)} kB), every key with a sentence, every section once, samples printed`);

  /* -- 2. Jeder Schlüssel beschrieben ----------------------------------------------------------------------------- */
  /** Jedes Objekt eines Dokuments mit seinem Ort: `lamps[].signals[]`. */
  const objectsOf = (value, at = '', out = []) => {
    if (Array.isArray(value)) { for (const one of value) objectsOf(one, `${at}[]`, out); return out; }
    if (!isPlain(value)) return out;
    out.push([at, value]);
    for (const [key, one] of Object.entries(value)) objectsOf(one, at === '' ? key : `${at}.${key}`, out);
    return out;
  };
  const seen = new Set();
  const exported = clone(m.exportLamps(now));
  for (const doc of [...samples.map((s) => s.doc()), exported]) {
    for (const [at, object] of objectsOf(doc)) {
      const keys = m.LAMPS_LEVELS[at];
      assert.ok(keys !== undefined, `"${at}" is a described level`);
      for (const key of Object.keys(object)) {
        assert.ok(Object.prototype.hasOwnProperty.call(keys, key), `"${at ? `${at}.` : ''}${key}" is in a document but not described`);
        seen.add(`${at}|${key}`);
      }
    }
  }
  for (const [at, keys] of Object.entries(m.LAMPS_LEVELS)) {
    for (const key of Object.keys(keys)) {
      if (key === 'remove') continue;
      assert.ok(seen.has(`${at}|${key}`), `"${at ? `${at}.` : ''}${key}" is described but in no sample and no export`);
    }
  }
  ok('every key of the samples and of an export is described; every described key (but "remove") occurs');

  /* -- 3. Export → Plan: nichts zu tun ---------------------------------------------------------------------------- */
  assert.equal(exported.format, 'recreatio/lamps');
  assert.equal(exported.version, 1);
  assert.deepEqual(exported.buttons, { pauseMs: 150 });
  assert.deepEqual(exported.lamps.map((l) => [l.id, l.key]), [[id(1), 'lampa-w-sypialni-nr-1'], [id(2), 'lampa-w-salonie-nr-2']], 'in the order of the page, with readable keys');
  const exportedBedroom = exported.lamps.find((l) => l.id === id(1));
  assert.deepEqual(exportedBedroom.signals.map((s) => [s.id, s.key]), [[id(11), 'wlacz'], [id(12), 'wylacz']]);
  const exportedMorning = exported.timers.find((t) => t.id === id(31));
  assert.deepEqual([exportedMorning.time, exportedMorning.days], ['07:00', ['pn', 'wt', 'śr', 'cz', 'pt']]);
  assert.deepEqual(exportedMorning.actions, [{ lamp: '@lampa-w-sypialni-nr-1', signal: '@wlacz' }], 'actions as readable keys');
  assert.deepEqual(exported.timers.find((t) => t.id === id(33)).actions, [{ lamp: id(9), signal: id(99) }], 'an action whose lamp is gone keeps its ids');
  const same = plan(exported);
  nothing(same, 'unchanged export');
  assert.deepEqual(same.unchanged, { lamps: 2, timers: 3 });
  assert.match(same.lines[1], /Bez zmian: 2 urządzenia, 3 timery/);
  /* Auch ohne Schlüssel (nur Kennungen) und in anderer Reihenfolge: nichts zu tun. */
  const bare = clone(exported);
  for (const l of bare.lamps) { delete l.key; for (const s of l.signals) delete s.key; }
  for (const t of bare.timers) t.actions = now.timers.find((x) => x.id === t.id).actions.map((a) => ({ lamp: a.lampId, signal: a.signalId }));
  bare.lamps.reverse();
  bare.timers.reverse();
  nothing(plan(bare), 'ids only, other order');
  ok('export → JSON → plan of the same state: nothing to write, no warning, every id kept (also by ids only, in another order)');

  /* -- 4. An Ort und Stelle --------------------------------------------------------------------------------------- */
  {
    const edited = clone(exported);
    const b = edited.lamps.find((l) => l.id === id(1));
    b.name = 'Lampa przy łóżku';
    b.signals[1].label = 'Zgaś';
    edited.timers.find((t) => t.id === id(31)).time = '06:45';
    edited.buttons.pauseMs = 300;
    const p = plan(edited);
    assert.deepEqual(p.warnings, []);
    assert.equal(p.lamps.length, 1);
    assert.deepEqual([p.lamps[0].id, p.lamps[0].existing.version], [id(1), 3], 'the same lamp, on its version');
    assert.deepEqual(p.lamps[0].data.signals.map((s) => [s.id, s.label]), [[id(11), 'Włącz'], [id(12), 'Zgaś']], 'the same signals, one renamed');
    assert.deepEqual(p.lamps[0].data.signals[1].frames, bedroom.signals[1].frames, 'its frames untouched');
    assert.deepEqual(p.timers.map((t) => [t.id, t.data.minute, t.data.actions]), [[id(31), 405, morning.actions]], 'the timer keeps its actions (the key of the renamed lamp still holds)');
    assert.deepEqual(p.buttons, { pauseMs: 300, limitMs: null });
    assert.ok(p.lines.some((l) => l.includes('Zmienione urządzenie: „Lampa w sypialni · nr 1”') && l.includes('nazwa „Lampa w sypialni” → „Lampa przy łóżku”') && l.includes('zmieniony sygnał „Zgaś”')), p.lines.join(' | '));
    assert.ok(p.lines.some((l) => l.startsWith('Zmieniony timer: 07:00, pn–pt „Rano”') && l.includes('godzina 07:00 → 06:45')), p.lines.join(' | '));
    assert.ok(p.lines.some((l) => l.includes('Tempo przycisków — przerwa: 300 ms (było: 150 ms)')));
    assert.deepEqual(p.unchanged, { lamps: 1, timers: 2 });

    /* Nur, was genannt ist: ein Timer nur mit "id" und "enabled". */
    const partial = plan({ format: 'recreatio/lamps', timers: [{ id: id(32), enabled: true }], lamps: [{ id: id(2), room: 'Salon' }] });
    assert.deepEqual(partial.warnings, []);
    assert.deepEqual(partial.timers[0].data, { ...m.readTimer(m.sealedTimerJson(night)), enabled: true }, 'only "enabled" changes');
    assert.deepEqual(partial.lamps[0].data, { ...m.readLamp(m.sealedJson(salon)), room: 'Salon' }, 'only "room" changes; the signals stay');
    assert.ok(partial.lines.some((l) => l.includes('pomieszczenie — → Salon')));
    assert.ok(partial.lines.some((l) => l.includes('— włączony')));

    /* Sygnały: ein Teil genannt → die alten bleiben vorn, der neue hinten; alle genannt → ihre Reihenfolge. */
    const add = plan({ lamps: [{ id: id(1), signals: [{ label: 'Nocne', frames: [{ hex: OTHER }] }] }] });
    assert.deepEqual(add.lamps[0].data.signals.map((s) => s.label), ['Włącz', 'Wyłącz', 'Nocne'], 'a partial list appends');
    assert.equal(add.lamps[0].data.signals[2].frames[0].durationMs, 1000, 'durationMs defaults to 1000');
    assert.ok(UUID.test(add.lamps[0].data.signals[2].id) && ![id(11), id(12)].includes(add.lamps[0].data.signals[2].id), 'a new signal gets a fresh id');
    const turned = plan({ lamps: [{ id: id(1), signals: [{ id: id(12) }, { label: 'Środek', frames: [{ hex: OTHER, durationMs: '700' }] }, { id: id(11) }] }] });
    assert.deepEqual(turned.lamps[0].data.signals.map((s) => s.label), ['Wyłącz', 'Środek', 'Włącz'], 'a full list sets the order, new ones where they stand');
    assert.equal(turned.lamps[0].data.signals[1].frames[0].durationMs, 700, 'a number as text is read');
    assert.ok(turned.lines[0].includes('kolejność sygnałów') && turned.lines[0].includes('nowy sygnał „Środek”'), turned.lines[0]);
    /* Hex in anderer Schreibweise ist derselbe Sygnał. */
    const spaced = clone(exported);
    spaced.lamps.find((l) => l.id === id(1)).signals[0].frames[0].hex = `0x${ON.toLowerCase().match(/../g).join(' ')}`;
    nothing(plan(spaced), 'hex written another way');
    ok('in place: only the keys given change, on the same ids and versions; signals appended (partial list) or reordered (full list); hex in another spelling is no change');
  }

  /* -- 5. Neu ----------------------------------------------------------------------------------------------------- */
  {
    const added = clone(exported);
    added.lamps.push({ key: 'biurko', name: 'Lampka na biurku', signals: [{ key: 'on', label: 'Włącz', frames: [{ hex: OTHER }] }, { label: 'Pół', frames: [{ hex: ON, durationMs: 500 }] }] });
    added.timers.push({
      name: 'Praca', time: '9:00', days: ['pn', 3, 'PT'],
      actions: [
        { lamp: '@biurko', signal: '@on' },
        { lamp: 'lampa w salonie', signal: 'noc' },
        { lamp: id(1), signal: id(11) },
        { lamp: 'nr 2', signal: '@noc' },
        { lamp: 'Lampka na biurku', signal: 'pol' }
      ]
    });
    const p = plan(added);
    assert.deepEqual(p.warnings, [], p.warnings.join(' | '));
    assert.equal(p.lamps.length, 1);
    const fresh = p.lamps[0];
    assert.equal(fresh.existing, null);
    assert.ok(UUID.test(fresh.id) && ![id(1), id(2)].includes(fresh.id), 'a new lamp gets a fresh id');
    assert.deepEqual([fresh.data.name, fresh.data.number, fresh.data.room, fresh.data.protocol], ['Lampka na biurku', null, null, 'ble-adv']);
    assert.equal(p.timers.length, 1);
    const t = p.timers[0];
    assert.equal(t.existing, null);
    assert.ok(UUID.test(t.id) && !now.timers.some((x) => x.id === t.id), 'a new timer gets a fresh id');
    assert.deepEqual([t.data.minute, t.data.days, t.data.enabled, t.data.pace], [540, [1, 3, 5], true, { pauseMs: 0, limitMs: null }]);
    assert.deepEqual(t.data.actions, [
      { lampId: fresh.id, signalId: fresh.data.signals[0].id },
      { lampId: id(2), signalId: id(22) },
      { lampId: id(1), signalId: id(11) },
      { lampId: id(2), signalId: id(22) },
      { lampId: fresh.id, signalId: fresh.data.signals[1].id }
    ], 'by "@key" of this document, by name (any case, no Polish letters), by id, by number with an export key, by label');
    assert.ok(p.lines.some((l) => l.startsWith('Nowe urządzenie: „Lampka na biurku” — 2 sygnały: Włącz, Pół')), p.lines.join(' | '));
    assert.ok(p.lines.some((l) => l.startsWith('Nowy timer: 09:00, pn, śr, pt „Praca” — Lampka na biurku: Włącz, Lampa w salonie · nr 2: Noc')), p.lines.join(' | '));

    /* Nur Timer, ohne die Geräte im Dokument: die Schlüssel des Exports gelten trotzdem. */
    const keysOnly = plan({ format: 'recreatio/lamps', version: 1, timers: [{ time: '12:00', actions: [{ lamp: '@lampa-w-sypialni-nr-1', signal: '@wylacz' }] }] });
    assert.deepEqual([keysOnly.warnings, keysOnly.timers[0].data.actions], [[], [{ lampId: id(1), signalId: id(12) }]]);

    /* Ein "id" von woanders: neu, mit neuer Kennung — und Verweise darauf folgen ihr. */
    const foreign = plan({ lamps: [{ id: '0190ffff-0000-7000-8000-000000000001', name: 'Z innego konta', signals: [{ id: 'sig-a', label: 'A', frames: [{ hex: ON }] }] }], timers: [{ id: id(1), time: '05:00', actions: [{ lamp: '0190ffff-0000-7000-8000-000000000001', signal: 'sig-a' }] }] });
    const moved = foreign.lamps[0];
    assert.ok(moved.existing === null && moved.id !== '0190ffff-0000-7000-8000-000000000001' && moved.data.signals[0].id !== 'sig-a', 'foreign ids become fresh ones');
    assert.deepEqual(foreign.timers[0].data.actions, [{ lampId: moved.id, signalId: moved.data.signals[0].id }], 'references follow the new ids');
    assert.ok(foreign.timers[0].id !== id(1) && foreign.timers[0].existing === null, 'a timer with the id of a lamp is a new timer');
    assert.ok(foreign.warnings.some((w) => w.includes('nie należy do żadnego urządzenia tutaj')), foreign.warnings.join(' | '));
    assert.ok(foreign.warnings.some((w) => w.includes('należy do urządzenia, nie do timera')), foreign.warnings.join(' | '));

    /* Ohne "id" nie über den Namen zugeordnet — aber ein Zwilling wird gesagt (derselbe Text zweimal, ein Modell ohne Export). */
    /* (Die Aktion über die Kennung: „nr 1" passte jetzt auf zwei Geräte — das alte und seinen Zwilling.) */
    const twice = plan({ lamps: [{ name: 'Lampa w sypialni', number: '1' }], timers: [{ name: 'Rano', time: '07:00', days: ['pn', 'wt', 'śr', 'cz', 'pt'], enabled: false, actions: [{ lamp: id(1), signal: 'Włącz' }] }] });
    assert.equal(twice.lamps[0].existing, null, 'no id, no matching by name: a new lamp');
    assert.equal(twice.timers[0].existing, null, 'and a new timer');
    assert.ok(twice.warnings.some((w) => w.includes('powstanie drugie urządzenie „Lampa w sypialni · nr 1” obok istniejącego')), twice.warnings.join(' | '));
    assert.ok(twice.warnings.some((w) => w.includes('powstanie drugi taki sam timer obok istniejącego (07:00, pn–pt „Rano”)')), twice.warnings.join(' | '));
    const ambiguous = plan({ lamps: [{ name: 'Lampa w sypialni', number: '7' }], timers: [{ time: '08:00', actions: [{ lamp: 'Lampa w sypialni', signal: 'Włącz' }] }] });
    assert.ok(ambiguous.warnings.some((w) => w.includes('pasuje do 2 urządzeń')), 'an ambiguous name is refused with a reason');
    assert.equal(ambiguous.timers.length, 0, 'and the timer with nothing to send is skipped');
    ok('without an id: new with a fresh id; timers reach new lamps by "@key", old ones by id, name, number and export keys; foreign ids become fresh ids and references follow');
  }

  /* -- 6. Löschen ------------------------------------------------------------------------------------------------- */
  {
    const p = plan({ lamps: [{ id: id(2), remove: true }, { id: id(1), signals: [{ id: id(12), remove: true }] }], timers: [{ id: id(33), remove: true }, { remove: true, name: 'x' }] });
    assert.deepEqual(p.removals.map((r) => [r.id, r.kind]), [[id(2), 'lamp'], [id(33), 'timer']]);
    assert.deepEqual(p.lamps.map((l) => [l.id, l.data.signals.map((s) => s.id)]), [[id(1), [id(11)]]], 'a removed signal leaves its lamp');
    assert.ok(p.lines.some((l) => l === 'Usunięte urządzenie: „Lampa w salonie · nr 2” z 2 sygnałami.'), p.lines.join(' | '));
    assert.ok(p.lines.some((l) => l === 'Usunięty timer: 10:00, weekend „Stary”.'), p.lines.join(' | '));
    assert.ok(p.lines.some((l) => l.includes('usunięty sygnał „Wyłącz”')), p.lines.join(' | '));
    assert.ok(p.warnings.some((w) => w.includes('"remove" bez "id"')), 'remove without id: nothing to remove, said');
    const lost = p.warnings.filter((w) => w.includes('timer tej akcji nie wykona'));
    assert.equal(lost.length, 2, `the night timer loses a signal and a lamp: ${lost.join(' | ')}`);
    /* Ein Timer im Dokument, der auf Gelöschtes zeigt: die Aktion fällt weg, mit Grund. */
    const pointing = plan({ lamps: [{ id: id(2), remove: true }], timers: [{ id: id(32), actions: [{ lamp: id(2), signal: id(22) }, { lamp: id(1), signal: id(12) }] }] });
    assert.deepEqual(pointing.timers[0].data.actions, [{ lampId: id(1), signalId: id(12) }]);
    assert.ok(pointing.warnings.some((w) => w.includes('jest w tym dokumencie usuwane')), pointing.warnings.join(' | '));
    assert.ok(!pointing.warnings.some((w) => w.includes('timer tej akcji nie wykona')), 'and no second warning for the same timer');
    ok('"remove": only with an id, listed before the import; a removed signal leaves its lamp; timers that would lose an action are warned about');
  }

  /* -- 7. Kaputtes ------------------------------------------------------------------------------------------------ */
  {
    for (const junk of [null, 42, 'x', [], true, {}, { format: 'recreatio/page', lamps: [] }]) {
      const p = m.planLampsImport(junk, now);
      assert.ok('error' in p && typeof p.error === 'string' && p.error.length > 10, `${JSON.stringify(junk)} → an error, not a crash`);
    }
    const crooked = [
      { lamps: 'x', timers: 5, buttons: 'fast' },
      { lamps: [null, 1, 'x', [], { id: 5, key: 'zły klucz!', name: 'Zigbee', protocol: 'zigbee' }, { name: { a: 1 }, number: 3 }] },
      { lamps: [{ name: 'Psująca', color: 'red', signals: [
        { label: 'Zły hex', frames: [{ hex: 'zz' }] },
        { label: '', frames: [{ hex: ON }] },
        { label: 'Pusty', frames: [] },
        { label: 'Za krótko', frames: [{ hex: ON, durationMs: 50 }] },
        { label: 'Nie lista', frames: 'x' },
        { label: 'Ujemna przerwa', frames: [{ hex: ON, gapMs: -1 }] },
        { label: 'Nie producent', frames: [{ hex: '020106' }] },
        { label: 'Za długi', frames: [{ hex: `${ON}AABB` }] },
        { label: 'Bez hex', frames: [{ durationMs: 100 }] },
        { label: 'Obcy klucz ramki', frames: [{ hex: ON, speed: 3 }] },
        null, 7
      ] }] },
      { timers: [
        null,
        { time: 'xx', actions: [{ lamp: 'Lampa w sypialni', signal: 'Włącz' }] },
        { time: '25:00', actions: [{ lamp: 'Lampa w sypialni', signal: 'Włącz' }] },
        { time: '06:00', actions: [] },
        { name: 'Bez godziny', actions: [{ lamp: 'Lampa w sypialni', signal: 'Włącz' }] },
        { time: '07:00', actions: [{ lamp: '@nope', signal: '@x' }, { lamp: 5 }, 'x', { lamp: 'Lampa w sypialni', signal: 'Nie ma' }] },
        { time: '07:00', days: 'pn', actions: [{ lamp: 'Lampa w sypialni', signal: 'Włącz' }] },
        { time: '07:00', days: ['pn', 'xx', 9], actions: [{ lamp: 'Lampa w sypialni', signal: 'Włącz' }] },
        { time: '07:00', enabled: 'tak', pace: { pauseMs: -5, limitMs: 10, extra: 1 }, color: 'red', actions: [{ lamp: 'Lampa w sypialni', signal: 'Włącz', when: 'now' }] },
        { time: 7, actions: [] },
        { time: '08:00', actions: Array.from({ length: 25 }, () => ({ lamp: 'Lampa w sypialni', signal: 'Włącz' })) },
        { id: id(31), id2: 1, remove: 'yes', time: '07:30' },
        { id: id(31), time: '07:45' }
      ] },
      { version: 2, buttons: { pauseMs: 999999, limitMs: 100 }, extra: true, timers: [] }
    ];
    const all = crooked.map((doc) => plan(doc));
    const warned = all.flatMap((p) => p.warnings).join('\n');
    for (const said of [
      '"lamps" musi być listą', '"timers" musi być listą', '"buttons" to {"pauseMs": …}',
      'Urządzenie 1: to nie jest obiekt', '"id" musi być tekstem', '"key" to litery, cyfry', '"name" musi być tekstem', 'nieznany protokół "zigbee"',
      'nieznany klucz „color”', 'Zły hex', 'Niedozwolony znak', 'Podaj nazwę sygnału', 'Pusty', 'co najmniej jednej ramki',
      'Czas nadawania od 100 do 30000 ms', '"frames" musi być listą', 'Przerwa od 0 do 10000 ms', 'Flagi', 'najwyżej 31',
      'brak pakietu "hex"', 'nieznany klucz „speed”', '"time" to godzina "GG:MM"', 'brak godziny "time"', 'pusta lista "actions"',
      'nie ma urządzenia "@nope"', '"lamp" to "@klucz"', 'akcja to {"lamp"', 'nie ma sygnału „Nie ma”', '"days" to lista',
      'nieznane dni "xx", 9', '"enabled" to true albo false', '"pauseMs" od 0 do 10000 ms — przycięte', '"limitMs" co najmniej 100 ms',
      'nieznany klucz „extra”', 'nieznany klucz „when”', 'najwyżej 20 akcji — 5 dalszych pominiętych', 'nieznany klucz „id2”',
      '"remove" może być tylko true', 'to samo "id" drugi raz', 'Wersja 2', 'Tempo przycisków: "pauseMs" od 0 do 10000 ms', 'nieznany klucz „limitMs”'
    ]) {
      assert.ok(warned.includes(said), `warned: ${said}\n--- got:\n${warned}`);
    }
    /* Was trotzdem geht, geht: die Lampe ohne gute Sygnały, der Timer mit gekapptem Tempo, der erste geänderte Timer. */
    const [, odd, broken, timers] = all;
    assert.deepEqual(odd.lamps.map((l) => [l.data.name, l.data.number]), [['', '3']], 'an unknown protocol skips its lamp; a bad name leaves the number (given as a number)');
    assert.deepEqual(broken.lamps.map((l) => [l.data.name, l.data.signals.map((s) => s.label)]), [['Psująca', ['Obcy klucz ramki']]], 'only the good signal is kept');
    const capped = timers.timers.find((t) => t.data.pace.limitMs !== null);
    assert.deepEqual([capped.data.enabled, capped.data.pace], [true, { pauseMs: 0, limitMs: 100 }]);
    assert.equal(timers.timers.find((t) => t.data.minute === 480).data.actions.length, 20, 'at most 20 actions');
    assert.deepEqual(timers.timers.filter((t) => t.existing !== null).map((t) => [t.id, t.data.minute]), [[id(31), 450]], 'the first entry of a timer counts, the second is skipped');
    ok('broken documents: an error for what is no lamps document at all, a warning (with the reason) for every bad key, value and reference; what is good still goes');
  }

  /* -- 8. Schreiben ----------------------------------------------------------------------------------------------- */
  {
    const p = plan({ buttons: { pauseMs: 500 }, lamps: [{ id: id(2), remove: true }, { id: id(1), room: 'Pokój' }, { name: 'Nowa', signals: [{ label: 'A', frames: [{ hex: ON }] }] }], timers: [{ id: id(31), enabled: false }, { time: '06:00', actions: [{ lamp: 'Nowa', signal: 'A' }] }] });
    const calls = [];
    const stages = [];
    const write = (failOn = null) => ({
      saveLamp: async (lampId, data, version) => { calls.push(['lamp', lampId, version]); if (failOn === 'lamp') throw new Error('409'); return { ...data, id: lampId, version: version + 1, updatedAt: 'now' }; },
      saveTimer: async (timerId, data, version) => { calls.push(['timer', timerId, version]); if (failOn === 'timer') throw new Error('409'); return { ...data, id: timerId, version: version + 1, updatedAt: 'now' }; },
      remove: async (gone) => { calls.push(['remove', gone]); return { deleted: true }; },
      setButtons: (pace) => calls.push(['buttons', pace.pauseMs])
    });
    const done = await m.applyLampsPlan(p, write(), (s) => stages.push(s));
    assert.deepEqual(calls.map((c) => c[0]), ['remove', 'lamp', 'lamp', 'timer', 'timer', 'buttons'], 'removals first (room for new rows), then lamps, timers, the buttons');
    assert.deepEqual(calls.filter((c) => c[0] === 'lamp').map((c) => c[2]), [3, 0], 'an existing lamp on its version, a new one on 0');
    assert.deepEqual(calls.filter((c) => c[0] === 'timer').map((c) => c[2]), [2, 0]);
    assert.equal(done.error, null);
    assert.deepEqual([done.done, done.total, done.lamps.length, done.timers.length, done.removed], [6, 6, 2, 2, [id(2)]]);
    assert.equal(done.timers[1].actions[0].lampId, done.lamps[1].id, 'the new timer points at the new lamp, as saved');
    assert.ok(stages.length === 5 && stages.every((s) => /\(\d+ z 6\)…$/.test(s)), stages.join(' | '));
    calls.length = 0;
    const failed = await m.applyLampsPlan(p, write('timer'), () => undefined);
    assert.ok(failed.error instanceof Error, 'the error comes back');
    assert.deepEqual([failed.done, failed.total, failed.lamps.length, failed.timers.length], [3, 6, 2, 0], 'and how far it got — what was saved is returned');
    assert.deepEqual(calls.map((c) => c[0]), ['remove', 'lamp', 'lamp', 'timer'], 'nothing after the failure');
    ok('writing (with stand-ins): removals, lamps, timers, buttons in this order, on the right versions; a failure stops and says how far it got');
  }

  /* -- 9. Die Beispiele zum Einsetzen ------------------------------------------------------------------------------ */
  {
    const empty = { lamps: [], timers: [], buttons: { pauseMs: 0, limitMs: null } };
    const [full, timersOnly] = samples;
    const first = plan(full.doc(), empty);
    assert.deepEqual(first.warnings, [], first.warnings.join(' | '));
    assert.deepEqual([first.lamps.length, first.timers.length, first.removals.length, first.buttons], [2, 2, 0, null]);
    const saved = (p, state) => {
      const lamps = p.lamps.map((l) => ({ ...l.data, id: l.id, version: 1, updatedAt: 'now' }));
      const timers = p.timers.map((t) => ({ ...t.data, id: t.id, version: 1, updatedAt: 'now' }));
      return { lamps: [...state.lamps, ...lamps].sort(m.lampOrder), timers: [...state.timers, ...timers].sort(m.timerOrder), buttons: state.buttons };
    };
    const after = saved(first, empty);
    for (const t of after.timers) for (const a of t.actions) assert.ok(after.lamps.find((l) => l.id === a.lampId)?.signals.some((s) => s.id === a.signalId), 'every action of the sample reaches a signal');
    const second = plan(timersOnly.doc(), after);
    assert.deepEqual(second.warnings, [], second.warnings.join(' | '));
    assert.equal(second.timers.length, 2, 'the timers-only sample finds its lamps by name');
    const both = saved(second, after);
    nothing(plan(clone(m.exportLamps(both)), both), 'the state made from the samples, exported again');
    ok('samples: the full one imports into an empty account without a word, the timers-only one finds those lamps by name, and the result exports without a change');
  }
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
