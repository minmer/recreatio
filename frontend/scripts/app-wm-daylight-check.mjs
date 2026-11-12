/**
 * 2026-11-12 — DAS LICHT DER WELTKARTE (`worldmap/wmDaylight.ts`): Tageszeit ist die Vorgabe; jede Phase des Tages hat ihre
 * Farben (Nacht dunkel, Mittag hell, Abend warm); der Tag gleitet ohne Sprung (auch über Mitternacht); Schrift bleibt zu jeder
 * Stunde lesbar (auf dem Grund und auf dem Land); hell und dunkel bleiben fest; der Zwischenspeicher-Schlüssel ändert sich nur
 * alle zehn Minuten; Baumschatten fallen von der Sonne weg.
 *
 *   node scripts/app-wm-daylight-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-daylight-'));
await build({ entryPoints: { day: 'src/app/cogita/worldmap/wmDaylight.ts' }, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error' });
const D = await import(pathToFileURL(join(workspace, 'day.js')).href);
await rm(workspace, { recursive: true, force: true });

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const FIELDS = ['floor', 'water', 'sand', 'land', 'tree', 'treeShade', 'treeLight', 'trunk', 'sky', 'tint'];

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); } };
check('the default is the time of day; the choice is kept per device', [D.keptLight(), (D.keepLight('dark'), D.keptLight()), (D.keepLight('day'), D.keptLight())], ['day', 'dark', 'day']);

const at = (h) => D.mapPalette('day', h);
check('each part of the day has its phase', [0, 3, 6.2, 8, 12.5, 15.5, 18.7, 20.2, 23].map((h) => at(h).phase),
  ['night', 'night', 'dawn', 'morning', 'noon', 'afternoon', 'evening', 'dusk', 'night']);
check('night is dark, midday is light, the evening is warmer (more red than blue) than midday', [at(1).dark, at(12.5).dark, lum(at(1).land) < lum(at(12.5).land) * 0.6,
  at(18.7).land[0] - at(18.7).land[2] > at(12.5).land[0] - at(12.5).land[2]], [true, false, true, true]);
check('the morning and the evening look different (not the same picture twice)', dist(at(7.5).land, at(18.7).land) > 8 && dist(at(7.5).sky, at(18.7).sky) > 40, true);

/* Stetig: in fünf Minuten ändert sich keine Farbe sprunghaft (auch über Mitternacht). */
let worst = 0, where = 0;
for (let m = 0; m < 24 * 60; m += 5) {
  const a = at(m / 60), b = at((m + 5) / 60 % 24);
  for (const f of FIELDS) { const d = dist(a[f], b[f]); if (d > worst) { worst = d; where = m / 60; } }
}
check('the day glides: no colour jumps by more than 20 (of 441) within five minutes, midnight included', worst <= 20, true);
if (worst > 20) console.log(`  worst ${worst.toFixed(1)} at ${where.toFixed(2)} h`);

/* Lesbar: die Schrift auf ihrem Grund (Namen, Blasen) und auf dem Land (Namen der Türme haben einen Hof aus dem Grund). */
let low = Infinity, lowAt = 0, lowLand = Infinity;
for (let m = 0; m < 24 * 60; m += 10) {
  const p = at(m / 60);
  const c = D.contrast(p.ink, p.surface);
  if (c < low) { low = c; lowAt = m / 60; }
  lowLand = Math.min(lowLand, D.contrast(p.ink, p.land));
}
let flips = 0;
for (let m = 0; m < 24 * 60; m += 5) if (at(m / 60).dark !== at(((m + 5) / 60) % 24).dark) flips += 1;
check('… only the text and its ground switch, together, exactly once at dawn and once at dusk', flips, 2);
check('the text stays readable at every hour: ink on its ground ≥ 7, on the land ≥ 3', [low >= 7, lowLand >= 3], [true, true]);
if (low < 7) console.log(`  lowest ${low.toFixed(2)} at ${lowAt.toFixed(2)} h`);

check('light and dark stay fixed (whatever the hour) and keep their former colours', [
  D.mapPalette('light', 2).key, D.mapPalette('light', 2).dark, JSON.stringify(D.mapPalette('light', 2).land) === JSON.stringify(D.mapPalette('light', 14).land),
  D.mapPalette('dark', 12).dark, D.mapPalette('dark', 12).tintK
], ['light', false, true, true, 0]);
check('the cache key changes about every ten minutes (not every frame)', [at(10.01).key === at(10.05).key, at(10.0).key === at(10.2).key], [true, false]);
check('tree shadows fall away from the sun: west in the morning sun from the east, east in the evening', [at(8).shadow.dx > 0, at(17.5).shadow.dx < 0], [true, true]);
check('the sun shines from its side by day; at night a fainter moon', [at(8).glow.x < 0.3, at(17.5).glow.x > 0.7, at(1).glow.a < at(12).glow.a], [true, true, true]);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
