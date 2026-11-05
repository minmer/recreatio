/**
 * 2026-11-05 (Prompt 17) — DAS ABSPIELEN AUF DER KARTE, ohne Leinwand nachgemessen (`cogita/landscapeShown.ts`,
 * `cogita/worldPlay.ts`, `cogita/motionWords.ts`):
 *
 *   1. Packen und Entpacken je Thema (Band, fällig, Ring in Prozent, Höhe) — verlustfrei, auch an den Rändern.
 *   2. Der Unterschied: gelernt, wiederholt, neu lernbar, niedriger, sonst anders, neu auf der Karte; nichts — leer.
 *   3. Neu eroberte Gebiete: nur die obersten; ein schon vorher erobertes zählt nicht.
 *   4. Die Punkte seit dem letzten Zeigen je Feld und der Rest; davor gegebene zählen nicht.
 *   5. Die Zeiten: Reihenfolge Kamera → Säulen → Umrisse → Figuren → Punkte → Gebiete; meist unter 3 s, höchstens etwa
 *      4 s mit einem Gebiet; „ograniczone" nur eine Überblendung, „wyłączone" sofort; der erste Besuch nur das Aufsteigen.
 *   6. Die Welle: Nachbarn kurz danach (höchstens 0,3 s), fern 0,3 s; beim ersten Besuch von der Mitte nach aussen.
 *   7. Speichern: höchstens 16 Stände je Browser, der älteste geht; ohne Speicher kein Fehler.
 *   8. 5 000 Themen: Stand und Unterschied in wenigen Millisekunden, der gespeicherte Stand unter 120 KB.
 *   9. Die Worte der Bewegung in drei Sprachen vollständig.
 *
 *   node scripts/app-playback-check.mjs
 */
import { readLang, useLocale } from './i18n-node.mjs';
/* Polnisch für die Vergleiche — Deutsch dazu: eine Baza kann deutsch sprechen. */
(await useLocale('pl')).dicts.de = await readLang('de');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-playback-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}cogita/landscapeShown';
export * from '${app}cogita/worldPlay';
export { motionWords } from '${app}cogita/motionWords';
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
const R = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* -- 1. Packen ----------------------------------------------------------------------------------------------------- */
{
  const cases = [
    { band: 'known', due: false, share: 1, steps: 0 },
    { band: 'due', due: true, share: 0.97, steps: 0 },
    { band: 'ring', due: false, share: 0.33, steps: 1 },
    { band: 'mountain', due: false, share: 0, steps: 12 },
    { band: null, due: true, share: 0.5, steps: 9999 },
    { band: 'mountain', due: false, share: 0.004, steps: 3 }
  ];
  check('1 packen und entpacken', cases.map((c) => R.unpack(R.pack(c))), [
    { band: 'known', due: false, share: 1, steps: 0 },
    { band: 'due', due: true, share: 0.97, steps: 0 },
    { band: 'ring', due: false, share: 0.33, steps: 1 },
    { band: 'mountain', due: false, share: 0, steps: 12 },
    { band: null, due: true, share: 0.5, steps: 9999 },
    { band: 'mountain', due: false, share: 0, steps: 3 }
  ]);
  check('1 Höhe begrenzt, Unsinn wird 0', [R.unpack(R.pack({ band: 'ring', due: false, share: Number.NaN, steps: 1e9 })).steps, R.unpack(R.pack({ band: 'ring', due: false, share: Number.NaN, steps: 2 })).share], [9999, 0]);
  check('1 Kürzel fest und kurz', [R.shortId('abc') === R.shortId('abc'), R.shortId('abc') !== R.shortId('abd'), R.shortId('0e6f3b52-1c1d-4d3a-9b9a-1f2e3d4c5b6a').length <= 7], [true, true, true]);
}

/* -- 2. Der Unterschied -------------------------------------------------------------------------------------------- */
const T = (id, band, steps = band === 'known' || band === 'due' ? 0 : band === 'ring' ? 1 : 3, share = band === 'known' ? 1 : 0, due = band === 'due') => ({ id, band, steps, share, due });
{
  const before = [T('a', 'ring', 1, 0.2), T('b', 'mountain', 2), T('c', 'mountain', 4), T('d', 'due', 0, 0.9, true), T('e', 'known'), T('f', 'known')];
  const shown = R.shownOf(before, [{ kind: 'goal', id: 'b' }], 1000);
  const after = [T('a', 'known', 0, 1), T('b', 'ring', 1), T('c', 'mountain', 3), T('d', 'known', 0, 1, false), T('e', 'known'), T('f', 'known', 0, 0.99, true), T('g', 'ring', 1)];
  const d = R.diffShown(shown, after);
  check('2 gelernt', d.learned, [0]);
  check('2 wiederholt', d.reviewed, [3]);
  check('2 neu lernbar', d.opened, [1]);
  check('2 niedriger', d.lowered, [2]);
  check('2 sonst anders (fällig geworden)', d.moved, [5]);
  check('2 neu auf der Karte', d.fresh, [6]);
  check('2 etwas ist anders', d.any, true);
  check('2 vorher', [d.before[0].band, d.before[0].share, d.before[3].due, d.before[6]], ['ring', 0.2, true, null]);
  check('2 die Figuren gemerkt', shown.pieces, [[1, 'b']]);
  const same = R.diffShown(R.shownOf(after, [], 2000), after);
  check('2 nichts anders: leer', [same.any, same.learned.length + same.reviewed.length + same.opened.length + same.lowered.length + same.moved.length + same.fresh.length], [false, 0]);
  /* Ein Ring, der sich nur in der dritten Stelle ändert, ist dieselbe Prozentzahl: kein Abspielen. */
  const tiny = R.diffShown(R.shownOf([T('a', 'ring', 1, 0.2)], [], 1), [T('a', 'ring', 1, 0.2031)]);
  check('2 weniger als ein Prozent ist nichts', tiny.any, false);
  const empty = R.diffShown(R.shownOf([], [], 1), [T('a', 'ring')]);
  check('2 eine leere alte Karte: neu, aber kein Unterschied', [empty.fresh, empty.any], [[0], false]);
}

/* -- 3. Eroberte Gebiete ------------------------------------------------------------------------------------------- */
{
  const regions = new Map([
    ['top', { topics: [0, 1, 2, 3], parent: null }],
    ['sub1', { topics: [0, 1], parent: 'top' }],
    ['sub2', { topics: [2, 3], parent: 'top' }],
    ['other', { topics: [4, 5], parent: null }],
    ['old', { topics: [6], parent: null }]
  ]);
  const known = { band: 'known', due: false, share: 1, steps: 0 };
  const ring = { band: 'ring', due: false, share: 0, steps: 1 };
  const before = [ring, known, known, known, ring, ring, known];
  const landAll = () => true;
  check('3 nur das oberste (Teilgebiete darin nicht)', R.newlyConquered(regions, before, landAll).sort(), ['other', 'top']);
  /* Das Teilgebiet und das Gebiet darüber zugleich: nur das obere. */
  check('3 zugleich mit dem Gebiet darüber: nur dieses', R.newlyConquered(regions, [known, known, ring, known, known, known, known], (t) => t !== 4), ['top']);
  /* Ein Teilgebiet, das Gebiet darüber noch nicht (ein Thema dort fehlt noch). */
  check('3 ein Teilgebiet allein', R.newlyConquered(regions, [ring, known, known, ring, known, known, known], (t) => t !== 3), ['sub1']);
  check('3 schon vorher erobert zählt nicht', R.newlyConquered(regions, [known, known, known, known, known, known, known], landAll), []);
  check('3 neu auf der Karte zählt als nicht gekonnt', R.newlyConquered(new Map([['x', { topics: [0], parent: null }]]), [null], landAll), ['x']);
}

/* -- 4. Punkte seit dem letzten Zeigen --------------------------------------------------------------------------- */
{
  const ev = [
    { at: 900, points: 10, card: 'k1' },
    { at: 1100, points: 10, card: 'k1' },
    { at: 1200, points: 6, card: 'k2' },
    { at: 1300, points: 50 },
    { at: 1400, points: 5, card: 'unknown' },
    { at: 1500, points: 0, card: 'k2' }
  ];
  const map = new Map([['k1', 0], ['k2', 3]]);
  const p = R.pointsSince(ev, 1000, (k) => map.get(k));
  check('4 je Feld, der Rest, die Summe', [[...p.byTopic], p.rest, p.sum], [[[0, 10], [3, 6]], 55, 71]);
  check('4 alle Punkte eines Abspielens', R.playPoints({ points: [{ t: 0, n: 10 }, { t: 3, n: 6 }], rest: 55 }), 71);
}

/* -- 5. Die Zeiten ---------------------------------------------------------------------------------------------- */
{
  const full = R.playTimes({ kind: 'return', motion: 'full', camMove: true, wave: 300, lines: true, pulses: true, walks: true, flights: 5, regions: false });
  check('5 Reihenfolge', [0 < full.cam1, full.cam1 <= full.col0, full.col0 < full.line0, full.line0 < full.walk0, full.walk0 < full.pts0, full.pts0 < full.end], [true, true, true, true, true, true]);
  check('5 unter 3,2 s ohne Gebiet', full.end <= 3200, true);
  const reg = R.playTimes({ kind: 'return', motion: 'full', camMove: true, wave: 300, lines: true, pulses: true, walks: true, flights: 5, regions: true });
  check('5 Gebiet nach den Punkten, höchstens etwa 4 s', [reg.reg0 > reg.pts0, reg.end <= 4100], [true, true]);
  const small = R.playTimes({ kind: 'return', motion: 'full', camMove: false, wave: 0, lines: true, pulses: false, walks: false, flights: 1, regions: false });
  check('5 eine kleine Änderung: unter 2,5 s', small.end <= 2500, true);
  const live = R.playTimes({ kind: 'live', motion: 'full', camMove: false, wave: 0, lines: true, pulses: false, walks: false, flights: 0, regions: false });
  check('5 während des Zeigens: ohne Kamera, kurz', [live.cam1, live.end <= 1500], [0, true]);
  const first = R.playTimes({ kind: 'first', motion: 'full', camMove: false, wave: 450, lines: false, pulses: false, walks: false, flights: 0, regions: false });
  check('5 der erste Besuch: nur das Aufsteigen (unter 1,3 s)', [first.end, first.end === first.col1], [1200, true]);
  const reduced = R.playTimes({ kind: 'return', motion: 'reduced', camMove: true, wave: 300, lines: true, pulses: true, walks: true, flights: 5, regions: true });
  check('5 ograniczone: nur eine Überblendung', [reduced.fade, reduced.end, reduced.cam1, reduced.colMs], [500, 500, 0, 0]);
  const off = R.playTimes({ kind: 'return', motion: 'off', camMove: true, wave: 300, lines: true, pulses: true, walks: true, flights: 5, regions: true });
  check('5 wyłączone: sofort', [off.end, off.fade], [0, 0]);
  const parts = [R.COL_MS, R.RISE_MS, R.LINE_MS, R.SHIMMER_MS, R.PULSE_MS, R.WALK_MS, R.FLY_MS, R.REGION_MS, R.FADE_MS, R.CAM_MS];
  check('5 jeder Teil 300–900 ms', parts.every((x) => x >= 300 && x <= 900), true);
}

/* -- 6. Die Welle ----------------------------------------------------------------------------------------------- */
{
  /* Eine Reihe von Feldern (q = 0…5, r = 0): Nachbarn je Schritt später, fern 0,3 s. */
  const cells = [0, 1, 2, 3, 4, 5, 6, 7].map((q) => ({ q, r: 0, x: q, y: 0 }));
  const d = R.waveDelays(cells, 'return', [0], [1, 2, 3, 7]);
  check('6 Nachbarn kurz danach, weiter weg später, fern höchstens 0,3 s', [d[1], d[2], d[3], d[7], d[0]], [120, 180, 240, 300, 0]);
  const f = R.waveDelays(cells, 'first', [], []);
  check('6 erster Besuch: von der Mitte nach aussen (bis 0,45 s)', [f[0], Math.round(f[7])], [0, 450]);
}

/* -- 7. Speichern ----------------------------------------------------------------------------------------------- */
{
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); }
  };
  for (let i = 0; i < 20; i += 1) R.keepShown(R.shownKey('lib', 'v', `h${i}`), R.shownOf([T('a', 'ring')], [], i));
  const kept = [...store.keys()].filter((k) => k.startsWith('cg-ls-shown:'));
  check('7 höchstens 16, die ältesten gehen', [kept.length, store.has(R.shownKey('lib', 'v', 'h0')), store.has(R.shownKey('lib', 'v', 'h19'))], [16, false, true]);
  check('7 gelesen wie gespeichert', R.readShown(R.shownKey('lib', 'v', 'h19'))?.at, 19);
  store.set(R.shownKey('lib', 'v', 'bad'), '{"v":2}');
  check('7 Fremdes ist kein Stand', R.readShown(R.shownKey('lib', 'v', 'bad')), null);
  globalThis.localStorage = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
  let threw = false;
  try { R.keepShown('x', R.shownOf([], [], 1)); check('7 ohne Speicher: nichts gelesen', R.readShown('x'), null); } catch { threw = true; }
  check('7 ohne Speicher kein Fehler', threw, false);
}

/* -- 8. 5 000 Themen ------------------------------------------------------------------------------------------- */
{
  const big = [];
  for (let i = 0; i < 5000; i += 1) big.push(T(`0e6f3b52-1c1d-4d3a-9b9a-${String(i).padStart(12, '0')}`, i % 4 === 0 ? 'known' : i % 4 === 1 ? 'ring' : 'mountain', i % 4 === 0 ? 0 : i % 4 === 1 ? 1 : 2 + (i % 9), (i % 100) / 100));
  const t0 = performance.now();
  const shown = R.shownOf(big, [], 1);
  const json = JSON.stringify(shown);
  const after = big.map((t, i) => (i % 50 === 1 ? { ...t, band: 'known', steps: 0, share: 1 } : t));
  const d = R.diffShown(JSON.parse(json), after);
  const ms = performance.now() - t0;
  check('8 Stand und Unterschied schnell (unter 80 ms)', ms < 80, true);
  check('8 gespeichert unter 120 KB', json.length < 120_000, true);
  check('8 gelernt erkannt', d.learned.length, 100);
  console.log(`     5 000 Themen: ${ms.toFixed(1)} ms, ${(json.length / 1024).toFixed(0)} KB`);
}

/* -- 9. Worte ---------------------------------------------------------------------------------------------------- */
{
  const keys = (w) => Object.entries(w).filter(([, v]) => typeof v === 'string').map(([k]) => k).sort();
  const pl = R.motionWords('pl'); const de = R.motionWords('de'); const en = R.motionWords('en');
  check('9 dieselben Worte in drei Sprachen', [keys(de).join(), keys(en).join()], [keys(pl).join(), keys(pl).join()]);
  check('9 „Pokaż zmiany", „Obszar zdobyty"', [pl.replay, pl.region('Galilea'), de.replay, en.points(5)], ['Pokaż zmiany', 'Obszar zdobyty: Galilea', 'Änderungen zeigen', '+5 pts']);
  check('9 keine leeren Worte', [pl, de, en].every((w) => Object.values(w).every((v) => typeof v !== 'string' || v.trim() !== '')), true);
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
