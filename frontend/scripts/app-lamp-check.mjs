/**
 * LAMPY (2026-10-18) — nachgemessen ohne Telefon, ohne Bluetooth und ohne Dienst.
 *
 *   1. Hex: was jemand einfügt (0x, Leerzeichen, Zeilen, Doppelpunkte) wird eine Form; Fehler mit Grund.
 *   2. AD-Strukturen: die beiden Mitschnitte aus nRF Connect — Kennung 0x0000, 27 Bytes dahinter, und
 *      Android setzt daraus wieder genau die 31 Bytes zusammen; zu gross, kaputt, fremde Typen: gemeldet.
 *   3. Gespeichert: Hülle hin und zurück, ein Dienst im Speicher (Fassungen, 409), dasselbe Sygnał an zwei Geräten.
 *   4. Senden: Erlaubnis verweigert, Bluetooth aus, Fehler im Rückruf, nacheinander statt zugleich,
 *      Stopp, ein kaputtes Paket erreicht das Telefon nie, Zeiten, die Android nicht hielt.
 *   5. Vom Pilot lernen: der Stärkste, Läufe, Muster (ein Paket, ein Kreis, das häufigste), nRF-Mitschnitt.
 *   6. Die Wörter des Telefons (LampPlugin.java) kennt die Seite alle.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-lamp-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}lamps/adv';
export * from '${app}lamps/lampStore';
export * from '${app}lamps/transmit';
export * from '${app}lamps/learn';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: 'https://lamps.test' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;
const realFetch = globalThis.fetch;

const FIRST = '1EFF00000048464B4AE15A2285B8F21CB0424734F03133C519101112131415';
const SECOND = '1EFF00000048464B4AFFC185675ED4FE58606205383D074F85101112131415';

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1. Hex ------------------------------------------------------------------------------------ */

  for (const pasted of [
    FIRST, `0x${FIRST}`, FIRST.toLowerCase(), FIRST.match(/../g).join(' '), FIRST.match(/../g).join(':'),
    `0x${FIRST.slice(0, 20)}\n${FIRST.slice(20)}\r\n`, FIRST.match(/../g).map((b) => `0x${b}`).join(', '), `  ${FIRST.match(/../g).join('-')}  `
  ]) {
    assert.deepEqual(m.normalizeHex(pasted), { hex: FIRST, problem: null }, `pasted: ${JSON.stringify(pasted.slice(0, 30))}`);
  }
  assert.match(m.normalizeHex('').problem, /Wpisz/);
  assert.match(m.normalizeHex('1EFG').problem, /„G"/);
  assert.match(m.normalizeHex('1EF').problem, /Nieparzysta/);
  assert.equal(m.spaced('1EFF00'), '1E FF 00');
  assert.equal(m.idText(0), '0x0000');
  assert.equal(m.idText(0x4c), '0x004C');
  ok('hex: 0x, spaces, line breaks, colons, dashes, per-byte 0x and lower case become one form; bad characters and odd length named');

  /* -- 2. AD-Strukturen ------------------------------------------------------------------------------ */

  for (const captured of [FIRST, SECOND]) {
    const adv = m.parseAdvertising(m.bytesOf(captured));
    assert.deepEqual(adv.problems, [], 'the capture can be sent');
    assert.equal(adv.bytes.length, 31);
    assert.equal(adv.structures.length, 1);
    assert.deepEqual([adv.structures[0].length, adv.structures[0].type], [30, 0xff], '1E FF: length 30, manufacturer specific');
    assert.equal(adv.manufacturer.id, 0x0000, 'manufacturer id 0x0000 (little endian 00 00)');
    assert.equal(adv.manufacturer.data.length, 27, '27 bytes after the id — what addManufacturerData gets');
    assert.equal(m.hexOf(adv.manufacturer.data), captured.slice(8));
    assert.equal(m.asciiOf(adv.manufacturer.data).slice(1, 5), 'HFKJ', 'the HFKJ signature');
    assert.equal(m.hexOf(m.airBytes(adv.manufacturer)), captured, 'Android puts the same 31 bytes in the air');
  }
  assert.equal(m.parseAdvertising(m.bytesOf('05FF4C00AABB')).manufacturer.id, 0x004c, 'the id is little endian');

  const big = m.parseAdvertising(m.bytesOf(`1FFF0000${'AB'.repeat(28)}`));
  assert.match(big.problems[0], /32 bajtów.*najwyżej 31/, 'a 32-byte payload is refused');
  assert.match(m.readFrame(`1FFF0000${'AB'.repeat(28)}`).problem, /najwyżej 31/);
  assert.match(m.parseAdvertising(m.bytesOf('1EFF0000AA')).problems[0], /zapowiada 30 bajtów, a zostało 4/, 'a structure longer than the bytes');
  const flags = m.parseAdvertising(m.bytesOf('020106' + '05FF0000AABB'));
  assert.equal(flags.manufacturer.id, 0);
  assert.match(flags.problems[0], /Flagi \(typ 0x01, bajt 1\).*tylko dane producenta/, 'other AD types are reported, not dropped');
  assert.match(m.parseAdvertising(m.bytesOf('03FF0000' + '03FF0100')).problems[0], /Więcej niż jedna/);
  assert.match(m.parseAdvertising(m.bytesOf('0409414243')).problems[0], /Nazwa pełna/);
  assert.match(m.parseAdvertising(m.bytesOf('02FF00')).problems[0], /dwubajtowym identyfikatorem/);
  assert.match(m.parseAdvertising(m.bytesOf('0000')).problems[0], /Brak danych producenta/);

  /* Ein Mitschnitt des Telefons: Werbung + leere Scan-Antwort, mit Nullen auf 62 Bytes. */
  const phone = FIRST + '00'.repeat(31);
  const padded = m.parseAdvertising(m.bytesOf(phone));
  assert.deepEqual(padded.problems, [], 'zeros after the content are no content');
  assert.equal(padded.padding, 31);
  assert.match(padded.notes[0], /31 bajtów zer/);
  assert.equal(m.significantHex(phone), FIRST, 'the capture without its padding');
  assert.equal(m.significantHex('05FF00000A00' + '0000'), '05FF00000A00', 'a zero inside the data stays');
  assert.match(m.parseAdvertising(m.bytesOf('03FF0000' + '00' + '05')).problems[0], /długość 0/, 'data after the end marker');
  ok('AD structures: both captures → id 0x0000 + 27 bytes → the same 31 bytes again; oversize, truncated, flags, names, two makers refused with a reason; padding dropped');

  /* -- 3. Gespeichert ------------------------------------------------------------------------------- */

  const signal = (label, hex, extra = {}) => ({ id: `s-${label}`, label, note: null, frames: [{ hex, durationMs: 1000, gapMs: 0 }], ...extra });
  const on = signal('Włącz', `0x${FIRST.match(/../g).join(' ')}`);
  const bedroom = { name: '  Lampa w sypialni ', number: ' 3 ', room: '', note: null, protocol: 'ble-adv', signals: [on, signal('Wyłącz', SECOND)] };
  const tidy = m.tidyLamp(bedroom);
  assert.equal(tidy.name, 'Lampa w sypialni');
  assert.equal(tidy.number, '3');
  assert.equal(tidy.room, null);
  assert.equal(tidy.signals[0].frames[0].hex, FIRST, 'the hex is stored in one form');
  assert.deepEqual(m.readLamp(m.sealedJson(bedroom)), tidy, 'the sealed document reads back');
  assert.equal(JSON.parse(m.sealedJson(bedroom)).v, 1, 'versioned');
  assert.deepEqual(m.lampProblems(bedroom), []);
  assert.equal(m.lampTitle(tidy), 'Lampa w sypialni · nr 3');
  assert.match(m.lampProblems({ ...bedroom, name: '', number: null })[0], /nazwę albo numer/);
  assert.match(m.lampProblems({ ...bedroom, signals: [signal('', FIRST)] })[0], /nazwę sygnału/);
  assert.match(m.lampProblems({ ...bedroom, signals: [signal('X', FIRST, { frames: [{ hex: FIRST, durationMs: 50, gapMs: 0 }] })] })[0], /od 100 do 30000 ms/);
  assert.match(m.signalProblem(signal('X', '1EFF00')), /zapowiada/);
  const twoFrames = signal('Ciepłe', FIRST, { frames: [{ hex: FIRST, durationMs: 300, gapMs: 50 }, { hex: 'ZZ', durationMs: 300, gapMs: 0 }] });
  assert.match(m.signalProblem(twoFrames), /^Ramka 2: Niedozwolony znak/);
  const copy = m.copyOf(tidy);
  assert.equal(copy.name, 'Lampa w sypialni (kopia)');
  assert.ok(copy.signals.every((s, i) => s.id !== tidy.signals[i].id), 'a copy gets its own signal ids');
  assert.deepEqual(m.readLamp(JSON.stringify({ v: 1, name: 'x', signals: [{ label: 'a', frames: [{ hex: 'AA', durationMs: '700' }, null] }], extra: true })).signals[0].frames,
    [{ hex: 'AA', durationMs: 700, gapMs: 0 }], 'a foreign or older document is read as far as it goes');

  /* Ein Dienst im Speicher, der wie Phone.Lamps.cs antwortet. */
  const rows = new Map();
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (path === '/workspace/phone/area-1/lamps' && (init.method ?? 'GET') === 'GET') {
      return reply(200, { lamps: [...rows.values()].map(({ lampId, epoch, sealed, version, updatedAt }) => ({ lampId, epoch, sealed, version, updatedAt })) });
    }
    const one = /^\/workspace\/phone\/area-1\/lamp\/([^/]+)$/.exec(path);
    if (one !== null && init.method === 'PUT') {
      const body = JSON.parse(init.body);
      const had = rows.get(one[1]);
      if ((had?.version ?? 0) !== body.version) return reply(409, { error: 'stale', verdict: 'stale', version: had?.version ?? 0 });
      const updatedAt = new Date().toISOString();
      rows.set(one[1], { lampId: one[1], epoch: body.epoch, sealed: body.sealed, version: body.version + 1, updatedAt });
      return reply(200, { lampId: one[1], version: body.version + 1, updatedAt });
    }
    if (one !== null && init.method === 'DELETE') return reply(200, { lampId: one[1], deleted: rows.delete(one[1]) });
    return reply(404, { error: 'Nie ma.' });
  };
  const key = new Uint8Array(32).map((_, i) => i * 7 + 1);
  const ctx = { who: null, ring: null, areaId: 'area-1', keys: new Map([[1, key]]), newest: { epoch: 1, key } };

  const saved = await m.saveLamp(ctx, null, bedroom, 0);
  assert.equal(saved.version, 1);
  assert.ok(!rows.get(saved.id).sealed.includes('sypialni') && !Buffer.from(rows.get(saved.id).sealed, 'base64url').toString('latin1').includes('Lampa'), 'the service holds only a sealed document');
  const living = await m.saveLamp(ctx, null, { ...bedroom, name: 'Salon', number: '1', signals: [on] }, 0);
  const loaded = await m.loadLamps(ctx);
  assert.deepEqual(loaded.map((l) => l.name), ['Salon', 'Lampa w sypialni'], 'read back, by number then name');
  assert.deepEqual(loaded.map((l) => l.signals.some((s) => s.id === on.id)), [true, true], 'the same signal on two devices');
  const again = await m.saveLamp(ctx, saved.id, { ...loaded[1], room: 'Sypialnia' }, loaded[1].version);
  assert.equal(again.version, 2);
  await assert.rejects(m.saveLamp(ctx, saved.id, { ...loaded[1], room: 'stary stan' }, 1), (e) => m.lampSaveProblem(e).includes('w międzyczasie'), 'an old version does not overwrite');
  assert.equal((await m.removeLamp(ctx, living.id)).deleted, true);
  assert.deepEqual((await m.loadLamps(ctx)).map((l) => [l.name, l.room]), [['Lampa w sypialni', 'Sypialnia']]);
  rows.set('broken', { lampId: 'broken', epoch: 1, sealed: 'AAAA', version: 1, updatedAt: '' });
  assert.equal((await m.loadLamps(ctx)).length, 1, 'an envelope that does not open does not stop the rest');
  ok('storage: sealed document round trip, devices saved, read back, changed (stale versions refused), deleted; one signal on two devices');

  /* -- 4. Senden ------------------------------------------------------------------------------------- */

  const READY = { bluetooth: true, le: true, enabled: true, advertiser: true, multiple: true, extended: true, maxLength: 31, permission: 'granted', scanPermission: 'granted', scanner: true, locationNeeded: false, locationOn: true, sdk: 36 };
  const radio = (over = {}) => {
    const r = {
      sends: [], active: 0, most: 0, stopped: 0, asked: 0,
      async support() { return { ...READY, ...(over.support ?? {}) }; },
      async requestPermission() { r.asked++; return { granted: over.grant ?? true }; },
      async send({ frames }) {
        r.sends.push(frames);
        r.active++;
        r.most = Math.max(r.most, r.active);
        try { return await (over.send ?? (async () => { await new Promise((ok) => setTimeout(ok, 20)); return okResult(frames); }))(frames, r); } finally { r.active--; }
      },
      async stop() { r.stopped++; r.onStop?.(); return { stopped: true }; },
      async openSettings() {}
    };
    return r;
  };
  const okResult = (frames, at = 1000) => ({
    code: 'ok', detail: null, startedAt: at, endedAt: at + 1100,
    frames: frames.map((f, i) => ({ index: i, code: 'ok', requestedMs: f.durationMs, startMs: 12, startedAt: at + 12, stoppedAt: at + 12 + f.durationMs, heldMs: f.durationMs }))
  });
  const lamp = { name: 'Lampa w sypialni', number: '3' };

  m.forgetAttempts();
  let r = radio();
  let a = await m.transmit(r, lamp, on);
  assert.equal(a.state, 'sent');
  assert.equal(a.code, 'ok');
  assert.match(a.message, /Czy lampa zareagowała — tego telefon nie wie/, 'sent is not "the lamp did it"');
  assert.deepEqual(r.sends[0], [{ manufacturerId: 0, data: FIRST.slice(8), durationMs: 1000, gapMs: 0 }], 'Android gets the id and the 27 bytes, not the whole 31');
  assert.deepEqual([a.frames[0].hex, a.frames[0].size, a.frames[0].manufacturerId], [FIRST, 31, 0]);
  assert.equal(a.lamp, 'Lampa w sypialni · nr 3');
  assert.equal(m.attemptsNow()[0].id, a.id, 'kept in the history');
  m.markResponded(a.id, true);
  assert.equal(m.attemptsNow()[0].responded, true, 'marked by hand: the lamp reacted');

  r = radio({ support: { permission: 'prompt' }, grant: false });
  a = await m.transmit(r, lamp, on);
  assert.deepEqual([a.code, a.state, r.asked, r.sends.length], ['no-permission', 'failed', 1, 0], 'permission denied: asked once, nothing sent');
  assert.match(a.message, /Urządzenia w pobliżu/);
  r = radio({ support: { permission: 'prompt' }, grant: true });
  assert.equal((await m.transmit(r, lamp, on)).code, 'ok', 'permission granted on asking: sent');
  r = radio({ support: { enabled: false } });
  a = await m.transmit(r, lamp, on);
  assert.deepEqual([a.code, r.sends.length], ['bluetooth-off', 0]);
  assert.equal((await m.transmit(radio({ support: { advertiser: false } }), lamp, on)).code, 'no-advertiser');
  assert.equal((await m.transmit(radio({ support: { bluetooth: false } }), lamp, on)).code, 'no-bluetooth');

  for (const [code, said] of [['data-too-large', /DATA_TOO_LARGE/], ['too-many-advertisers', /TOO_MANY_ADVERTISERS/], ['already-started', /ALREADY_STARTED/],
    ['internal-error', /INTERNAL_ERROR/], ['feature-unsupported', /FEATURE_UNSUPPORTED/], ['no-callback', /3 s/]]) {
    r = radio({ send: async (frames) => ({ code, detail: `AdvertiseCallback.onStartFailure(${code})`, startedAt: 1, endedAt: 2, frames: [{ index: 0, code, requestedMs: frames[0].durationMs, startMs: 5 }] }) });
    a = await m.transmit(r, lamp, on);
    assert.deepEqual([a.state, a.code], ['failed', code], code);
    assert.match(a.message, said);
    assert.match(a.detail, /onStartFailure/, 'what Android said is kept');
  }
  r = radio({ send: async () => { throw new Error('Bridge gone'); } });
  a = await m.transmit(r, lamp, on);
  assert.deepEqual([a.code, a.detail], ['error', 'Bridge gone'], 'a failed call is an attempt, not an exception');

  r = radio();
  a = await m.transmit(r, lamp, signal('Zły', '1EFF00'));
  assert.deepEqual([a.code, r.sends.length], ['bad-frame', 0], 'a broken packet never reaches the phone');
  assert.match(a.message, /zapowiada/);
  assert.equal((await m.transmit(null, lamp, on)).code, 'unavailable', 'in the browser: nothing to send with');

  /* Nacheinander: drei Drücke zugleich, aber nie zwei Werbungen gleichzeitig — in der Reihenfolge der Drücke. */
  r = radio();
  const order = [];
  const presses = ['A', 'B', 'C'].map((label) => m.transmit(r, lamp, signal(label, FIRST)).then((x) => order.push(x.signal)));
  await Promise.all(presses);
  assert.equal(r.most, 1, 'never two at once');
  assert.deepEqual(order, ['A', 'B', 'C'], 'in the order pressed');

  /* Stopp: das Telefon hält, bis gestoppt wird, und meldet „stopped"; der nächste Druck geht danach normal. */
  r = radio({
    send: (frames, self) => new Promise((resolve) => {
      self.onStop = () => resolve({ code: 'stopped', detail: null, startedAt: 1, endedAt: 2, frames: [{ index: 0, code: 'stopped', requestedMs: frames[0].durationMs, startMs: 8, startedAt: 10, stoppedAt: 400, heldMs: 390 }] });
    })
  });
  const long = m.transmit(r, lamp, signal('Długi', FIRST, { frames: [{ hex: FIRST, durationMs: 30_000, gapMs: 0 }] }));
  await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(m.attemptsNow()[0].state, 'sending', 'while it runs, the console says so');
  await m.stopTransmission(r);
  a = await long;
  assert.deepEqual([a.state, a.code, r.stopped], ['stopped', 'stopped', 1], 'stop ends it');
  assert.deepEqual(a.timing, [], 'a stopped frame is not a timing fault');
  r.onStop = undefined;
  assert.equal((await m.transmit(radio(), lamp, on)).state, 'sent', 'after a stop the queue goes on');

  /* Zeiten: was Android wirklich hielt, mit den gewünschten verglichen. */
  const seq = signal('Sekwencja', FIRST, { frames: [{ hex: FIRST, durationMs: 500, gapMs: 100 }, { hex: SECOND, durationMs: 500, gapMs: 0 }] });
  r = radio({ send: async (frames) => ({
    code: 'ok', detail: null, startedAt: 0, endedAt: 2000,
    frames: [
      { index: 0, code: 'ok', requestedMs: 500, startMs: 340, startedAt: 340, stoppedAt: 960, heldMs: 620 },
      { index: 1, code: 'ok', requestedMs: 500, startMs: 30, startedAt: 1200, stoppedAt: 1702, heldMs: 502 }
    ].slice(0, frames.length)
  }) });
  a = await m.transmit(r, lamp, seq);
  assert.equal(r.sends[0].length, 2, 'a sequence goes as frames in order');
  assert.deepEqual(r.sends[0].map((f) => f.gapMs), [100, 0]);
  assert.deepEqual(a.timing, ['Ramka 1: Android potrzebował 340 ms na start.', 'Ramka 1: nadawana 620 ms zamiast 500 ms.', 'Między ramką 1 a 2: 240 ms zamiast 100 ms.'],
    'timing the phone could not keep is reported, not hidden');
  assert.ok(m.attemptsNow().length <= m.HISTORY_MAX);
  ok('sending: permission denied/granted, Bluetooth off, no advertiser, every AdvertiseCallback error with Android\'s words, exceptions, bad frames never sent, three presses one after another, stop, timing deviations');

  /* -- 5. Vom Pilot lernen ---------------------------------------------------------------------------- */

  const pkt = (address, rssi, hex, at) => ({ address, rssi, hex, at, name: null });
  const capture = new m.Capture();
  const t0 = 1_000_000;
  const remote = 'C0:11:22:33:44:55';
  const noise = [];
  for (let i = 0; i < 40; i++) noise.push(pkt('AA:AA:AA:AA:AA:01', -82 + (i % 3), '0201060AFF4C001005031C0D4E1A', t0 + i * 100));
  for (let i = 0; i < 10; i++) noise.push(pkt('AA:AA:AA:AA:AA:02', -95, '03FF0100', t0 + i * 300));
  noise.push(pkt('AA:AA:AA:AA:AA:03', -20, '03FF0200', t0 + 50));
  const press = Array.from({ length: 30 }, (_, i) => pkt(remote, -38 - (i % 4), FIRST, t0 + 500 + i * 30));
  capture.add([...noise, ...press]);
  const sources = capture.sources();
  assert.equal(sources[0].address, remote, 'the strongest (best three averaged) is the remote — one loud packet elsewhere is not enough');
  assert.deepEqual([sources[0].count, sources[0].distinct, sources[0].peakRssi, sources[0].strength], [30, 1, -38, -38]);
  assert.equal(capture.size, 81);
  let runs = m.runsOf(capture.packetsOf(remote));
  let pattern = m.patternOf(runs);
  assert.deepEqual([pattern.kind, pattern.at, pattern.repeats, runs[0].count], ['single', [0], 30, 30], 'one packet repeated: the pattern');
  assert.equal(m.intervalOf(runs[0]), 30);
  assert.deepEqual(m.framesFrom(pattern.runs), [{ hex: FIRST, durationMs: 1000, gapMs: 0 }], 'one packet: sent for the default 1000 ms');

  const cycle = [];
  for (let k = 0; k < 4; k++) for (const [j, hex] of ['03FF0001', '03FF0002', '03FF0003'].entries()) for (let i = 0; i < 5; i++) cycle.push(pkt('B', -40, hex, t0 + k * 900 + j * 300 + i * 50));
  runs = m.runsOf(cycle.reverse());
  pattern = m.patternOf(runs);
  assert.deepEqual([pattern.kind, pattern.at, pattern.repeats], ['cycle', [0, 1, 2], 4], 'A B C A B C …: a cycle of three, four times (order restored by time)');
  assert.deepEqual(m.framesFrom(pattern.runs).map((f) => [f.hex, f.durationMs]), [['03FF0001', 250], ['03FF0002', 250], ['03FF0003', 250]],
    'a sequence: each frame as long as the remote sent it');
  assert.equal(m.patternOf(m.runsOf(['A', 'B', 'A', 'C', 'A', 'B', 'A', 'C'].map((h, i) => pkt('x', -40, `03FF00${h}A`, i)))).runs.length, 4, 'a cycle may repeat a packet inside');

  const rolling = [...Array.from({ length: 8 }, (_, i) => pkt('R', -40, FIRST, i * 30)), ...Array.from({ length: 20 }, (_, i) => pkt('R', -40, SECOND, 2000 + i * 30)), pkt('R', -40, '03FF0000', 4000)];
  runs = m.runsOf(rolling);
  pattern = m.patternOf(runs);
  assert.deepEqual([pattern.kind, pattern.at, pattern.repeats, pattern.runs[0].hex], ['dominant', [1], 20, SECOND], 'no cycle: the most frequent packet, preselected');
  assert.deepEqual(m.patternOf([]), { kind: 'none', runs: [], at: [], repeats: 0 });
  assert.deepEqual(m.framesSeen(rolling).map((f) => f.count), [8, 20, 1]);

  assert.deepEqual(m.packetOf({ address: remote, rssi: -40, hex: FIRST + '00'.repeat(31), at: 5, name: null }), pkt(remote, -40, FIRST, 5), 'what the phone delivers (62 bytes) loses its padding');
  assert.equal(m.packetOf({ address: remote, rssi: -40, hex: '0000', at: 5, name: null }), null);

  const log = [
    '2026-10-18 03:27:06.277, -29 dBm, 0x' + FIRST,
    '2026-10-18 03:27:06.307, -30 dBm, 0x' + FIRST,
    'nRF Connect, 2026-10-18',
    '2026-10-18 03:27:06.337, -29 dBm, 0x' + FIRST,
    '2026-10-18 03:27:09.100, -31 dBm, 0x' + SECOND,
    '2026-10-18 03:27:09.130, -31 dBm, 0x' + SECOND,
    ''
  ].join('\r\n');
  const read = m.parseNrfLog(log);
  assert.equal(read.packets.length, 5);
  assert.equal(read.skipped, 1, 'a line that is not a packet is skipped and counted');
  assert.deepEqual(read.packets[0].rssi, -29);
  assert.equal(read.packets[1].at - read.packets[0].at, 30, 'timestamps with milliseconds');
  runs = m.runsOf(read.packets);
  assert.deepEqual(runs.map((r) => [r.hex, r.count]), [[FIRST, 3], [SECOND, 2]], 'identical consecutive frames grouped, order kept');
  ok('learning: the strongest sender found among noise, runs and patterns (one packet, a cycle, the most frequent), phone padding removed, nRF Connect log read');

  /* -- 6. Die Wörter des Telefons --------------------------------------------------------------------- */

  const plugin = await readFile(join(process.cwd(), 'android/app/src/sms/java/pl/recreatio/app/LampPlugin.java'), 'utf8');
  const words = new Set([...plugin.matchAll(/(?:outcome|scanAnswer|endScan|cancel)\("([a-z-]+)"|put\("code", "([a-z-]+)"\)|return "([a-z-]+)";/g)]
    .map((x) => x[1] ?? x[2] ?? x[3]));
  const known = (w) => w === 'error' || m.codeText(w) !== m.codeText('error') || m.scanText(w) !== m.scanText('error');
  assert.deepEqual([...words].filter((w) => !known(w)), [], 'every word the phone says is explained on the page');
  for (const w of ['data-too-large', 'too-many-advertisers', 'no-callback', 'stopped', 'paused', 'too-frequently', 'timeout', 'location-off']) {
    assert.ok(words.has(w), `the phone says "${w}"`);
  }
  const manifest = await readFile(join(process.cwd(), 'android/app/src/sms/AndroidManifest.xml'), 'utf8');
  assert.match(manifest, /BLUETOOTH_ADVERTISE/);
  assert.match(manifest, /BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation"/);
  const main = await readFile(join(process.cwd(), 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.doesNotMatch(main, /BLUETOOTH/, 'the Play edition asks for no Bluetooth');
  ok('the phone\'s words (LampPlugin.java) are all explained on the page; Bluetooth permissions only in the sms edition');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  globalThis.fetch = realFetch;
  await rm(workspace, { recursive: true, force: true });
}
