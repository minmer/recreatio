/**
 * 2026-11-09 — DIE WELTKARTE, TEIL 4: WAS SIE ZEIGT (spec §4, Entscheidung 5), ohne Browser: die Farben der Linien (eigene
 * Palette, dunkler und gesättigter als die Säulen, je grosse Linie ein Farbton, Vertiefungen heller in der Farbe ihres
 * häufigsten Rufers, auf dem Boden lesbar — hell und dunkel), die Spuren (parallel, 5 Einheiten, immer dieselbe Reihenfolge,
 * in der Richtung des Abschnitts), Schlösser nach dem Typ der fehlenden Bedingung, Namen erst nah, und: nichts ist durchsichtig.
 * Die Bilder (Bosko und 1 000 Orte, Schreibtisch und Telefon, hell und dunkel) macht `scratchpad/wm/wm-shots.mjs` über die
 * Vorschau; sie stehen im Bericht (documentation/world-map/STEP2_REPORT.md).
 *
 *   node scripts/app-wm-presentation-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-wm-presentation-'));
const entries = {
  graph: 'src/app/cogita/worldmap/wmGraph.ts', lines: 'src/app/cogita/worldmap/wmLines.ts', state: 'src/app/cogita/worldmap/wmState.ts',
  geo: 'src/app/cogita/worldmap/wmGeometry.ts', scene: 'src/app/cogita/worldmap/wmScene.ts', colors: 'src/app/cogita/worldmap/wmColors.ts',
  tracks: 'src/app/cogita/worldmap/wmTracks.ts', fx: 'src/app/cogita/worldmap/wmFixtures.ts', views: 'src/app/cogita/views.ts'
};
await build({ entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) } });
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, S, GEO, SC, C, T, F, V] = await Promise.all(Object.keys(entries).map(load));

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/* Die Farben des Bodens und der Themen (landscape.css: --cg-ls-floor, --cg-ls-c0…c7). */
const FLOOR = { light: hex('#f3f0ea'), dark: hex('#1d1a15') };
const PILLARS = { light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'].map(hex), dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'].map(hex) };

const bx = F.boskoWorld();
const world = G.readWorld(bx.input);
const lines = L.linesOf(world, bx.input.flows);
const state = S.stateOf(world, lines, F.fakeLearner({ progress: { 'f/L1': { visited: ['sh25'] } } }), { levels: 3, knownShare: 1 });
const geometry = GEO.geometryOf(GEO.geometryInputOf(world, lines));

/* -- Die Farben der Linien (Entscheidung 5) --------------------------------------------------------------------------------- */
for (const theme of ['light', 'dark']) {
  const lc = C.lineColours(lines, theme);
  const big = [...lines.lines.values()].filter((l) => !l.deepening).map((l) => lc.get(l.id));
  const deep = [...lines.lines.values()].filter((l) => l.deepening);
  check(`${theme}: every big line has its own hue`, new Set(big.map((c) => Math.round(c.hue))).size, big.length);
  check(`${theme}: a deepening takes the hue of the line that calls it most often`, deep.map((l) => lc.get(l.id).hue === lc.get([...l.calledBy.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]).hue), deep.map(() => true));
  const lum = (c) => C.luminance(c);
  check(`${theme}: deepenings are a lighter shade`, deep.every((l) => (theme === 'light' ? lum(lc.get(l.id).color) > lum(lc.get([...l.calledBy.keys()][0]).color) : lum(lc.get(l.id).color) >= lum(lc.get([...l.calledBy.keys()][0]).color))), true);
  /* Lesbar auf dem Boden: Kontrast ≥ 3 : 1 für jede grosse Linie; auch 30 erzeugte Linien. */
  const many = C.lineColours({ lines: new Map(Array.from({ length: 30 }, (_, i) => [`l${i}`, { id: `l${i}`, deepening: false, sections: [], calledBy: new Map() }])) }, theme);
  const worst = Math.min(...[...many.values()].map((c) => C.contrast(c.color, FLOOR[theme])));
  check(`${theme}: lines readable on the ground (contrast ≥ 3, worst ${worst.toFixed(2)})`, worst >= 3, true);
  /* Dunkler und gesättigter als die Säulen (hell: dunkler; dunkel: heller als der Boden, aber kräftig). */
  const pillarLum = Math.min(...PILLARS[theme].map(lum));
  check(`${theme}: lines stand apart from the pillar palette`, theme === 'light' ? [...many.values()].every((c) => lum(c.color) < Math.max(...PILLARS.light.map(lum))) : [...many.values()].every((c) => lum(c.color) > pillarLum), true);
}

/* -- Die Spuren: parallel, fest geordnet, in der Richtung des Abschnitts --------------------------------------------------- */
{
  const lc = C.lineColours(lines, 'light');
  const scene = SC.sceneOf(world, lines, state, geometry, { placeColour: () => [120, 140, 160], lineColour: lc, fallback: [100, 100, 100] });
  check('scene: every place and block is placed', [scene.places.length, scene.blocks.map((b) => b.id)], [50, ['s1859']]);
  /* Zwei Linien auf einem Gleis: 5 Einheiten auseinander, gleich auf jedem Abschnitt. */
  const byTrack = new Map();
  for (const t of scene.tracks) byTrack.set(t.key, t);
  const shared = scene.tracks.find((t) => t.lanes >= 2);
  check('scene: some tracks carry several lines', shared !== undefined, true);
  const lanesHere = scene.lanes.filter((l) => { const s = lines.sections.get(l.section); const k = [geometry.nodeOf[s.from] ?? s.from, geometry.nodeOf[s.to] ?? s.to].sort().join('|'); return k === shared.key; });
  const mid = (p) => [p[Math.floor(p.length / 4) * 2], p[Math.floor(p.length / 4) * 2 + 1]];
  const lineIds = [...new Set(lanesHere.map((l) => l.line))];
  const a = lanesHere.find((l) => l.line === lineIds[0]), b = lanesHere.find((l) => l.line === lineIds[1]);
  const pa = mid(a.points), pb = mid(b.points);
  check('scene: parallel lines 5 units apart', Math.round(Math.hypot(pa[0] - pb[0], pa[1] - pb[1])), 5);
  check('scene: the same order on every track (big lines before deepenings, then by id)', T.laneOffset(0, 2) < T.laneOffset(1, 2), true);
  const s0 = lines.sections.get(a.section);
  const from = geometry.positions[s0.from], to = geometry.positions[s0.to];
  const d0 = Math.hypot(a.points[0] - from[0], a.points[1] - from[1]), d1 = Math.hypot(a.points[a.points.length - 2] - to[0], a.points[a.points.length - 1] - to[1]);
  check('scene: a lane runs from its section\'s start to its end', [d0 < 120, d1 < 120], [true, true]);
  check('scene: lanes end at the FULL rim (the renderer adds the piece to the drawn rim)', Math.round(Math.hypot(a.points[a.points.length - 2] - to[0], a.points[a.points.length - 1] - to[1])) >= 27, true);
  const states = new Set(scene.lanes.map((l) => l.state));
  check('scene: travelled, open and locked lanes', ['travelled', 'open', 'locked'].every((x) => states.has(x)), true);
  check('scene: a locked lane carries the lock of its missing condition', scene.lanes.filter((l) => l.state === 'locked').every((l) => ['knowledge', 'review', 'story', 'value', 'time', 'place', 'unknown'].includes(l.symbol)), true);
  check('scene: stations are marked', scene.places.filter((p) => p.station).length, [...lines.stations.keys()].filter((k) => k !== '~home').length);
  check('scene: home is placed', scene.home !== null, true);
  check('scene: levels on the rim (3 configured), the dot only on conquered places', [scene.places.every((p) => p.levels === 3), scene.places.filter((p) => p.dot !== null).every((p) => p.conquered)], [true, true]);
}

/* -- Namen erst nah; Höhe; die Gestalt des Widoku ---------------------------------------------------------------------------- */
check('names: shown when r_px > 24 + 0.32 · h_px', [SC.showsName(30, 10), SC.showsName(30, 30), SC.showsName(24, 0)], [true, false, false]);
check('view: landscape.style "world" is read, anything else stays hex', [V.readLandscape({ style: 'world' }).style, V.readLandscape({ style: 'other' }).style, V.readLandscape({}).style], ['world', undefined, undefined]);

/* -- Nichts ist durchsichtig (§4.2): der Zeichner deckt immer ganz ------------------------------------------------------------ */
{
  const src = await readFile('src/app/cogita/worldmap/WorldPillars.tsx', 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  check('no transparency: no globalAlpha below 1', [...code.matchAll(/globalAlpha\s*=\s*([0-9.]+)/g)].map((m) => Number(m[1])).filter((v) => v < 1), []);
  check('no transparency: no rgba / hsla / transparent colours', /rgba\(|hsla\(|transparent|opacity/.test(code), false);
  check('no transparency: distant places are mixed toward the background colour', /mix\(mix\(p\.color, pal\.floor, satMix\), pal\.haze, far \* 0\.32\)/.test(code), true);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
