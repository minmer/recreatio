/**
 * Die Dringlichkeitskurve, nachgemessen.
 *
 * Sie ist reine Arithmetik und darum genau die Art Fehler, die niemand meldet:
 * eine Liste, die in fast der richtigen Reihenfolge steht, sieht richtig aus.
 * Hier steht, was die Kurve tun soll — flach am Anfang, 1 am Ende, und danach
 * ohne Obergrenze weiter, im Mass des eigenen Fensters.
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-urgency-'));
await build({
  entryPoints: ['src/app/urgency.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error'
});

const u = await import(pathToFileURL(join(workspace, 'urgency.js')).href);

let failed = 0;
const near = (a, b) => Math.abs(a - b) < 0.0001;
const check = (name, got, want) => {
  const ok = typeof want === 'number' ? near(got, want) : JSON.stringify(got) === JSON.stringify(want);
  if (ok) console.log(`ok   ${name}`);
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const truth = (name, passed) => {
  if (passed) console.log(`ok   ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); }
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const start = Date.parse('2026-10-01T09:00:00Z');
const end = start + 4 * HOUR;

// ── Im Fenster: gleichmässig von 0 auf 1 ───────────────────────────────────
check('before it begins there is no urgency', u.urgency(start, end, start - HOUR), 0);
check('at the beginning it is still nothing', u.urgency(start, end, start), 0);
check('a quarter through the window', u.urgency(start, end, start + HOUR), 0.25);
check('halfway through the window', u.urgency(start, end, start + 2 * HOUR), 0.5);
check('at the end it is due', u.urgency(start, end, end), u.DUE);

// Gleichmässig heisst: gleiche Zeit, gleicher Zuwachs, wo immer im Fenster.
const first = u.urgency(start, end, start + HOUR) - u.urgency(start, end, start);
const later = u.urgency(start, end, start + 3 * HOUR) - u.urgency(start, end, start + 2 * HOUR);
truth('growth inside the window is even', near(first, later));

// ── Danach: linear weiter, ohne Obergrenze ─────────────────────────────────
// Das Mass ist das eigene Fenster: ein ganzer Punkt, wenn es noch einmal so
// lange her ist, wie das Fenster gedauert hat (hier vier Stunden).
check('one window late is one whole point past due', u.urgency(start, end, end + 4 * HOUR), u.DUE + 1);
check('two windows late is two', u.urgency(start, end, end + 8 * HOUR), u.DUE + 2);
check('half a window late is half a point', u.urgency(start, end, end + 2 * HOUR), u.DUE + 0.5);
truth('there is no ceiling', u.urgency(start, end, end + 400 * HOUR) > 40);

/*
   Das Kurze überholt das Lange — darum geht es.

   Eine Viertelstunde, die verpasst wurde, ist im Augenblick des Verpassens
   noch nicht das Lauteste: die Monatsaufgabe, die seit drei Tagen aussteht,
   steht darüber. Aber sie überholt schnell, denn eine Stunde sind vier ihrer
   Fenster — und wer fünfzehn Minuten ansetzt, meint genau diese fünfzehn.
*/
const quick = (late) => u.urgency(start, start + 15 * MIN, start + 15 * MIN + late);
const slow = (late) => u.urgency(start, start + 30 * DAY, start + 30 * DAY + late);
truth('just missed, the short task does not yet shout', quick(0) < slow(3 * DAY));
truth('a quarter hour late, it has overtaken the month-long one', quick(15 * MIN) > slow(3 * DAY));
truth('and the month-long one only shouts after a month', slow(30 * DAY) > slow(3 * DAY) && near(slow(30 * DAY), u.DUE + 1));

// ── Entartete Fenster ──────────────────────────────────────────────────────
check('a window with no duration is due at its moment', u.urgency(start, start, start), u.DUE);
// Ohne Dauer zählt die kleinste Spanne, die die Liste kennt: eine Minute.
truth('and grows from there, a point a minute', u.urgency(start, start, start + MIN) === u.DUE + 1);
truth('a moment missed is the loudest thing there is',
  u.urgency(start, start, start + HOUR) > u.urgency(start, start + 15 * MIN, start + 15 * MIN + HOUR));
check('an end before the start is treated as the start', u.urgency(start, start - HOUR, start), u.DUE);

// ── Worte ──────────────────────────────────────────────────────────────────
check('early on it can wait', u.levelOf(0.1), 'later');
check('halfway it is coming up', u.levelOf(0.5), 'soon');
check('near the end it is due', u.levelOf(0.8), 'due');
check('past the end it is late', u.levelOf(u.DUE + 0.2), 'late');
check('a whole window past, it is overdue', u.levelOf(u.DUE + 1), 'overdue');

check('windows late: none while there is still time', u.spansLate(0.9), 0);
check('windows late: counted from due', u.spansLate(u.DUE + 1.5), 1.5);

// Die Ordnung, auf die sich die Liste verlässt.
const order = [
  ['not started', u.urgency(start, end, start - DAY)],
  ['just begun', u.urgency(start, end, start + MIN)],
  ['halfway', u.urgency(start, end, start + 2 * HOUR)],
  ['just due', u.urgency(start, end, end)],
  ['a window late', u.urgency(start, end, end + 4 * HOUR)],
  ['ten windows late', u.urgency(start, end, end + 40 * HOUR)]
].map(([, value]) => value);
truth('the list sorts in the order a person would expect',
  order.every((value, index) => index === 0 || value >= order[index - 1]));

await rm(workspace, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
