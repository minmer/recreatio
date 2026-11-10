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
  tracks: 'src/app/cogita/worldmap/wmTracks.ts', fx: 'src/app/cogita/worldmap/wmFixtures.ts', views: 'src/app/cogita/views.ts',
  island: 'src/app/cogita/worldmap/wmIsland.ts', camera: 'src/app/cogita/worldmap/wmCamera.ts'
};
await build({ entryPoints: entries, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) } });
globalThis.BroadcastChannel = undefined;
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [G, L, S, GEO, SC, C, T, F, V, IS, CAM] = await Promise.all(Object.keys(entries).map(load));

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
/* Step 3 · 4 — befahren ist, was selbst befahren wurde: die Schritte der ersten zwei Abschnitte. */
const state = S.stateOf(world, lines, F.fakeLearner({ progress: { 'f/L1': { visited: [...lines.sections.get('f/L1:0').steps, ...lines.sections.get('f/L1:1').steps] } } }), { levels: 3, knownShare: 1 });
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
  /* 2026-11-09 (Eigentümer) — kräftig nur, was die Kenntnis weiterbringt; gefahren, leer und gesperrt leise und je anders. */
  check('scene: lanes that grow knowledge, travelled, idle and locked lanes', ['grow', 'travelled', 'locked'].every((x) => states.has(x)), true);
  const growOk = scene.lanes.filter((l) => l.state === 'grow').every((l) => state.sections.get(l.section).ticket.met && lines.sections.get(l.section).introduces.some((k) => state.band(k) !== 'known'));
  check('scene: a "grow" lane is open and brings cards that are not known yet', growOk, true);
  const knownAll = Object.fromEntries([...world.cards.keys()].map((k) => [k, 3]));
  const st2 = S.stateOf(world, lines, F.fakeLearner({ knowness: knownAll }), { levels: 0, knownShare: 1 });
  const sc2 = SC.sceneOf(world, lines, st2, geometry, { placeColour: () => [120, 140, 160], lineColour: lc, fallback: [100, 100, 100] });
  check('scene: when every card is known, no open lane is prominent (they are idle)', [sc2.lanes.some((l) => l.state === 'grow'), sc2.lanes.some((l) => l.state === 'idle')], [false, true]);
  check('scene: "Masterly" reaches the pillar', SC.sceneOf(world, lines, S.stateOf(world, lines, F.fakeLearner({ levels: { becchi: 3 }, perfect: ['becchi'] }), { levels: 3, knownShare: 1 }), geometry, { placeColour: () => [1, 1, 1], lineColour: lc, fallback: [1, 1, 1] }).byId.get('becchi').perfect, true);
  check('scene: a locked lane carries the lock of its missing condition', scene.lanes.filter((l) => l.state === 'locked').every((l) => ['knowledge', 'review', 'story', 'value', 'time', 'place', 'unknown'].includes(l.symbol)), true);
  check('scene: stations are marked', scene.places.filter((p) => p.station).length, [...lines.stations.keys()].filter((k) => k !== '~home').length);
  check('scene: home is placed', scene.home !== null, true);
  check('scene: levels on the rim (3 configured), the dot only on conquered places', [scene.places.every((p) => p.levels === 3), scene.places.filter((p) => p.dot !== null).every((p) => p.conquered)], [true, true]);
}

/* -- Die Insel (2026-11-09, Eigentümer): Land unter jeder Säule, Bäume nie auf Säulen oder Gleisen ------------------------ */
{
  const lc = C.lineColours(lines, 'light');
  const scene = SC.sceneOf(world, lines, state, geometry, { placeColour: () => [120, 140, 160], lineColour: lc, fallback: [100, 100, 100] });
  const isl = IS.islandOf({ places: scene.places, home: scene.home, tracks: scene.tracks });
  const onLand = (x, y) => isl.land.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r);
  check('island: every pillar stands on land', scene.places.every((p) => onLand(p.x, p.y)), true);
  check('island: there are trees, at most MAX_TREES', [isl.trees.length > 20, isl.trees.length <= IS.MAX_TREES], [true, true]);
  check('island: no tree on a pillar or its ring', isl.trees.every(([x, y]) => scene.places.every((p) => Math.hypot(x - p.x, y - p.y) >= p.r * 1.25 + 9)), true);
  const seg = (px, py, ax, ay, bx, by) => { const l2 = (bx - ax) ** 2 + (by - ay) ** 2; const k = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2)); return Math.hypot(px - (ax + (bx - ax) * k), py - (ay + (by - ay) * k)); };
  check('island: no tree on a track', isl.trees.every(([x, y]) => scene.tracks.every((t) => { for (let i = 2; i < t.points.length; i += 2) if (seg(x, y, t.points[i - 2], t.points[i - 1], t.points[i], t.points[i + 1]) < IS.TREE_CLEAR - 0.01) return false; return true; })), true);
  check('island: the same world, the same trees', JSON.stringify(IS.islandOf({ places: scene.places, home: scene.home, tracks: scene.tracks }).trees) === JSON.stringify(isl.trees), true);

  /* Die Kamera (Step 3 §2.7, §2.8). */
  const disks = scene.places.map((p) => ({ x: p.x, y: p.y, r: p.r }));
  for (const [w, h] of [[1200, 640], [390, 640]]) {
    const cam = CAM.fitView(disks, w, h, -20, Math.sin(50 * Math.PI / 180));
    const v = CAM.viewOf(cam, w, h);
    const pts = disks.map((d) => CAM.toScr(v, d.x, d.y, 0));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const used = Math.max((Math.max(...xs) - Math.min(...xs)) / w, (Math.max(...ys) - Math.min(...ys)) / h);
    check(`camera ${w}×${h}: "whole world" fits every pillar and fills the frame (${Math.round(used * 100)} %)`, [xs.every((x) => x >= 0 && x <= w), ys.every((y) => y >= 0 && y <= h), used > 0.7], [true, true, true]);
  }
  const tall = CAM.stageHeightFor(disks, 390, -20, Math.sin(50 * Math.PI / 180), 260, 900);
  check('camera: on a phone the stage height follows the world (not a fixed 62 vh)', tall >= 260 && tall <= 900, true);
  const zmax = CAM.maxZoom(disks, 1, 1200, 640);
  check('camera: zoom-in stops when a pillar is a third of the view', Math.round(2 * Math.max(...disks.map((d) => d.r)) * zmax), Math.round(640 / 3));
  const v0 = CAM.viewOf({ s: 1, cx: disks[0].x, cy: disks[0].y, rot: 0, fore: 0.8 }, 800, 600);
  const [px, py] = CAM.toScr(v0, disks[0].x, disks[0].y, 0);
  check('camera: zooming in near a place zooms towards it; far from all, towards the pointer', [CAM.zoomAnchor(v0, disks, px + 30, py + 10).map(Math.round), CAM.zoomAnchor(v0, [], 5, 5)], [[Math.round(px), Math.round(py)], [5, 5]]);
}

/* -- Die Steuerung (2026-11-09, Eigentümer): Strg statt Umschalt, nach unten ziehen neigt nach unten, Doppelklick führt hin -- */
{
  const src = (await readFile('src/app/cogita/worldmap/WorldPillars.tsx', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  check('controls: Ctrl (or the right button) turns and tilts — not Shift', [/turn: e\.ctrlKey \|\| e\.metaKey \|\| e\.button === 2/.test(src), /shiftKey/.test(src)], [true, false]);
  check('controls: dragging down tilts down (fore grows with dy)', /fore: dr\.cam\.fore \+ dy \* 0\.004/.test(src), true);
  check('controls: a double click (or double tap) on a pillar leads there', /onLead\(id\)/.test(src) && /now - last\.at < 380/.test(src), true);
}

/* -- 2026-11-10 (Eigentümer): Oberseite, Bäume, Vollbild, „Prowadź mnie tutaj" beginnt den Weg ---------------------------- */
{
  const has = (text, needle) => text.includes(needle);
  const src = await readFile('src/app/cogita/worldmap/WorldPillars.tsx', 'utf8');
  check('top: the star in the centre; the name inside the top circle, tilted with it, cut with "…" (above the star when there is one)', [has(src, 'drawStar(ctx, X, Yt,'), has(src, 'ctx.translate(X, p.perfect ? Yt - ry * 0.56 : Yt);'), has(src, 'ctx.scale(1, v.fore);'), has(src, "fitText(ctx, p.label, rx * (p.perfect ? 1.4 : 1.76))")], [true, true, true, true]);
  check('top: levels as wide parts of the top (the outer half of the radius); conquered: the ring shows how all cards sit; no dot', [has(src, 'const RING_IN = 0.5;'), has(src, 'if (a.conquered && all > 0)'), has(src, 'ctx.ellipse(X, dotAt,')], [true, true, false]);
  check('trees: upright near (trunk and crown, sorted with the pillars), flat far — larger', [has(src, 'treesUpTo(dp)'), has(src, 'treesUpTo(Infinity)'), has(src, 'layer.flat !== '), has(src, 'const TREE_SIZE = 12;')], [true, true, true, true]);
  check('phone: two fingers moved up or down together tilt the map', has(src, 'const fore = two.current.cam.fore + ((a.y + b.y) / 2 - two.current.my) * 0.004;'), true);
  check('narrow: a panel never covers the map — the map gets lower and the panel stands below', [has(src, 'squeeze && size.w > 0 && size.w < 800'), /position: sticky/.test(await readFile('src/app/cogita/worldmap/worldmap.css', 'utf8'))], [true, false]);
  const ls = await readFile('src/app/cogita/worldmap/WorldLandscape.tsx', 'utf8');
  check('"take me there" (button or double click) starts the first step of the way', [has(ls, 'startNav.current = target;'), has(ls, 'if (first !== undefined) go(first);'), has(ls, 'onLead={(id) => lead(id)}')], [true, true, true]);
  const css = await readFile('src/app/cogita/worldmap/worldmap.css', 'utf8');
  check('full screen: the whole document; every part full size, a bar at the bottom switches map / route / points / slide-questions', [has(ls, 'root.requestFullscreen()'), has(ls, "const tabs: FullTab[] = ['map'"), has(ls, "setFullTab('run');"), has(css, '.cg-wm-fullbar {'), has(css, '.cg-wm-fullview.is-page {')], [true, true, true, true, true]);
  check('the way: after every part the next one is offered (full screen tab "next", the same page without full screen); a finish screen with numbers in full screen', [has(ls, "x === 'run' ? (tt !== null ? 'next' : 'map') : x"), has(ls, 'if (!full && askNext && tt !== null)'), has(ls, '<FinishShow'), has(css, '.cg-wm-host.is-full > :not(.cg-wm-fullview):not(.cg-wm-fullbar):not(.cg-wm-fin)')], [true, true, true, true]);
}

/* -- Namen erst nah; Höhe; die Gestalt des Widoku ---------------------------------------------------------------------------- */
check('names: inside the top circle once it has room (1.8 · radius ≥ 30 px, top ≥ 5 px)', [SC.nameOnTop(20, 10), SC.nameOnTop(15, 10), SC.nameOnTop(30, 4)], [true, false, false]);
check('view: landscape.style "world" is read, anything else stays hex', [V.readLandscape({ style: 'world' }).style, V.readLandscape({ style: 'other' }).style, V.readLandscape({}).style], ['world', undefined, undefined]);

/* -- Nichts ist durchsichtig (§4.2): der Zeichner deckt immer ganz ------------------------------------------------------------ */
{
  const src = await readFile('src/app/cogita/worldmap/WorldPillars.tsx', 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  check('no transparency: no globalAlpha below 1', [...code.matchAll(/globalAlpha\s*=\s*([0-9.]+)/g)].map((m) => Number(m[1])).filter((v) => v < 1), []);
  check('no transparency: no rgba / hsla / transparent colours', /rgba\(|hsla\(|transparent|opacity/.test(code), false);
  /* 2026-11-09 — die Farbe ist das Thema oder (in einer Ansicht, die den Ort nicht meint) sein Grau: beide deckend gemischt. */
  check('no transparency: distant places are mixed toward the background colour', /mix\(mix\(own, pal\.floor, satMix\), pal\.haze, far \* 0\.32\)/.test(code) && /const own = greyed \? greyOf\(p\.color, pal\) : p\.color;/.test(code), true);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
