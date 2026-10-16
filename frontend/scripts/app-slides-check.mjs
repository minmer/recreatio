/**
 * RUCH I POKAZ COGITA (0107) — was ohne Browser nachzumessen ist.
 *
 *   1. Das Wörterbuch der Bewegungen: jede mit Bildern von 0 bis 1, Regler mit
 *      Vorgaben, Herkunft im Altbestand; Werte aus Reglern (`'x0 - 0.6*x'`);
 *      duldsames Lesen, knappes Schreiben; die Bilder für element.animate().
 *   2. Die Schichten der Luft: Vorgaben des Altbestands, `motion: []` bleibt still.
 *   3. Der Slajd: Bewegung, Aufbau, Begleiter, neue Kennungen nach dem Import;
 *      der Wechsel „dissolve"; Plätze für hohe Schirme und eine Grenze in rem;
 *      das gemeinsame Tuch blendet von Slajd zu Slajd.
 *   4. Die Folge als Ganzes (deck): lesen, knapp schreiben, im Aussehen der Seite.
 *   5. Die Szenen: dieselben Zufallsfolgen wie im Altbestand (Mapa: Samen 11,
 *      Karty: 17), der Wanderer, die Karten, die Runde, der Wykres.
 *   6. Das Dokument (`fixtures/cogita-home.json`): importiert ohne Warnung und
 *      kommt unverändert wieder heraus; Bühne und Begleiter folgen den neuen Kennungen.
 *   7. Es zeichnet sich (Server-Render): die Folge mit allen Slajdy und jede Szene.
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-slides-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}motion';
export { readLayers, layerJson, layersJson, readSlideValue, slideJson, remapSlide, readLook, writeLook, readDeck, deckJson, NO_DECK, frameFor, layoutFor } from '${app}slides';
export { motionOf, frameAt, backdropAt, deckAt, DISSOLVE, STILL } from '${app}slideMotion';
export { learningTree, nextStep, arrive, WALK_START, lcg, cardThrows, stackOrder, roundPlayers, roundOf, progressPoints, progressRange, progressPeers, CARD_GRID, MAP_LEVELS, safePath, ICONS } from '${app}animationScenes';
export { seeded, waves, meshMotions, layerBackground, layerPaint } from '${app}deckLayers';
export { planImport, exportPage, pageDescription, DEFAULT_IMPORT } from '${app}pageJson';
export { partOf } from '${app}parts/registry';
export { SCENE_DEFS, paintOf } from '${app}parts/animation';
export { PageSlides, deckParts } from '${app}PageSlides';
export { onAccent } from '${app}SlideDeck';
export { renderToStaticMarkup } from 'react-dom/server';
export { createElement } from 'react';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

globalThis.BroadcastChannel = undefined;
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1. Das Wörterbuch -------------------------------------------------------------------- */
  {
    assert.ok(m.MOTIONS.length >= 10, 'a real vocabulary');
    assert.equal(new Set(m.MOTION_NAMES).size, m.MOTIONS.length, 'names are unique');
    for (const def of m.MOTIONS) {
      assert.ok(def.frames.length >= 2 && def.frames[0].at === 0 && def.frames.at(-1).at === 1, `${def.name}: frames from 0 to 1`);
      for (let i = 1; i < def.frames.length; i += 1) assert.ok(def.frames[i].at > def.frames[i - 1].at, `${def.name}: frames in order`);
      assert.ok(def.label.length > 2 && def.says.length > 10 && def.duration > 0, `${def.name}: named, said, timed`);
      for (const [key, p] of Object.entries(def.params)) assert.ok(p.min <= p.value && p.value <= p.max, `${def.name}.${key}: default within its range`);
      const frames = m.keyframesOf({ name: def.name, duration: null, delay: null, params: {} });
      assert.equal(frames.length, def.frames.length);
      const keys = JSON.stringify(Object.keys(frames[0]).sort());
      for (const f of frames) assert.equal(JSON.stringify(Object.keys(f).sort()), keys, `${def.name}: every frame names the same properties`);
    }
    assert.ok(m.MOTIONS.filter((d) => d.legacy !== null).length >= 10, 'the legacy motions say where they come from');
    for (const name of ['rise', 'assemble', 'focus', 'draw', 'float', 'breathe', 'glow', 'drift', 'sway', 'wave', 'blink']) assert.ok(m.motionDef(name), `the legacy motion ${name}`);

    assert.equal(m.amount('x0 - 0.6*x', { x0: 1, x: 10 }), -5);
    assert.equal(m.amount('1 + stretch', { stretch: 0.2 }), 1.2);
    assert.equal(m.amount('-shift', { shift: 1 }), -1);
    assert.equal(m.amount('y', {}), 0, 'an unknown knob counts 0');
    assert.equal(m.amount(0.5, {}), 0.5);

    const rise = m.keyframesOf(m.readMotionUse({ name: 'rise', y: 10 }));
    assert.deepEqual(rise, [{ offset: 0, opacity: 0, transform: 'translate(0px, 10px)' }, { offset: 1, opacity: 1, transform: 'translate(0px, 0px)' }], 'cogita-text-delayed: from 10 px below, transparent');
    assert.deepEqual(m.timingOf(m.readMotionUse('rise')), { duration: 520, delay: 220, easing: 'ease', iterations: 1, direction: 'normal', fill: 'both' }, '520 ms after 220 ms, held before and after');
    const float = m.keyframesOf(m.readMotionUse({ name: 'float', x: 6, y: 8 }));
    assert.equal(float[1].transform, 'translate(6px, 8px)', 'cogita-bubble-wave: out to the bubble\'s own vector');
    assert.equal(m.timingOf(m.readMotionUse('float')).iterations, Infinity);
    const sway = m.keyframesOf(m.readMotionUse({ name: 'sway', x: 3, y: 6, stretch: 0.1, x0: 0, y0: 0 }));
    assert.equal(sway[1].transform, 'translate(3%, 6%) scaleY(1.1)', 'cogita-mesh-layer 14 %');
    assert.equal(sway[2].transform, 'translate(-1.8%, 2.4%) scaleY(0.9)', 'cogita-mesh-layer 29 %');
    assert.equal(m.timingOf(m.readMotionUse('drift')).direction, 'alternate', 'cogita-depth goes back and forth');
    const draw = m.keyframesOf(m.readMotionUse('draw'));
    assert.deepEqual(draw.map((f) => f.strokeDashoffset), ['420', '0'], 'cogita-shield-draw: dash 420 → 0');
    assert.equal(m.dashOf(m.readMotionUse('draw')), 420);
    assert.equal(m.keyframesOf(m.readMotionUse({ name: 'focus' }))[0].filter, 'blur(2px)', 'the slide change: blur 2 px');

    assert.equal(m.readMotionUse({ name: 'nonsense' }), null);
    assert.deepEqual(m.readMotions([{ name: 'rise' }, 'float', { name: 'nope' }, 'glow', 'blink']).map((u) => u.name), ['rise', 'float', 'glow'], 'at most three, unknown dropped');
    assert.deepEqual(m.unknownMotions([{ name: 'rise' }, 'wiggle', { name: 'shake' }]), ['wiggle', 'shake']);
    assert.equal(m.readMotionUse({ name: 'float', x: 999 }).params.x, 200, 'knobs are clamped');
    assert.equal(m.readMotionUse({ name: 'rise', delay: -100 }).delay, 0, 'an entrance does not start in the past');
    assert.equal(m.readMotionUse({ name: 'sway', delay: -100000 }).delay, -100000, 'a loop may start in the middle');
    assert.deepEqual(m.motionsJson(m.readMotions({ name: 'rise', delay: 1000 })), { name: 'rise', delay: 1000 }, 'one motion: an object, compact');
    assert.deepEqual(m.motionsJson(m.readMotions(['rise', { name: 'float', x: 2 }])), [{ name: 'rise' }, { name: 'float', x: 2 }], 'several: a list');
    assert.equal(m.motionsJson([]), undefined);
    const said = m.motionDescription();
    for (const def of m.MOTIONS) assert.ok(said.includes(`"${def.name}" — ${def.label}`), `the description names ${def.name}`);
    ok(`motion vocabulary: ${m.MOTIONS.length} motions with frames 0–1, knobs, legacy source; expressions, tolerant reading, compact JSON, WAAPI frames`);
  }

  /* -- 2. Die Luft ------------------------------------------------------------------------------- */
  {
    const air = m.readLayers([{ kind: 'glow' }, { kind: 'vignette' }, { kind: 'haze' }, { kind: 'mesh', seed: 3 }, { kind: 'waves', count: 99 }, { kind: 'nonsense' }]);
    assert.deepEqual(air.map((l) => l.kind), ['glow', 'vignette', 'haze', 'mesh', 'waves'], 'unknown kinds drop out');
    assert.equal(air[0].x, 58, 'the bloom sits at 58 % 42 %');
    assert.equal(air[1].strength, 0.35);
    assert.deepEqual(air[2].motion.map((u) => u.name), ['drift'], 'haze drifts by default');
    assert.deepEqual(air[3].motion.map((u) => u.name), ['sway'], 'the mesh sways by default');
    assert.equal(air[4].count, 12, 'counts are clamped');
    assert.deepEqual(air[4].motion, [], 'waves stand still by default (as in the legacy)');
    const still = m.readLayers([{ kind: 'mesh', motion: [] }])[0];
    assert.deepEqual(still.motion, [], '"motion": [] keeps a mesh still');
    assert.deepEqual(m.layerJson(still).motion, [], 'and is written as []');
    assert.deepEqual(m.readLayers(m.layersJson(air)), air, 'layers round-trip');
    assert.equal(m.readLayers([{ kind: 'glow', color: 'red;}' }])[0].color, 'rgba(120, 170, 220, 0.18)', 'a colour that would end a style is refused');
    assert.equal(m.layerPaint('ground'), 'var(--wk-ground)', 'theme names follow the slides');
    assert.ok(m.layerBackground(air[0]).background.startsWith('radial-gradient(closest-side at 58% 42%'));
    const w1 = m.waves(m.readLayers([{ kind: 'waves', seed: 7 }])[0]);
    const w2 = m.waves(m.readLayers([{ kind: 'waves', seed: 7 }])[0]);
    assert.deepEqual(w1, w2, 'the same seed, the same waves');
    assert.ok(w1.every((w) => w.blur >= 30 && w.blur <= 90 && w.opacity >= 0.18 && w.opacity <= 0.6 && w.bottom <= -45 && w.bottom >= -83), 'the legacy ranges');
    const sheets = m.meshMotions(m.readLayers([{ kind: 'mesh', seed: 5 }])[0]);
    assert.equal(sheets.length, 4);
    assert.ok(sheets.every((s) => s[0].name === 'sway' && s[0].duration >= 180000 && s[0].duration <= 400000), 'every sheet its own 180–400 s');
    ok('air layers: legacy defaults, still means still, round trip, safe colours, seeded waves and mesh sheets');
  }

  /* -- 3. Der Slajd ----------------------------------------------------------------------------- */
  {
    const slide = m.readSlideValue({
      label: 'Mapa', layers: [], transition: 'dissolve', motion: { name: 'rise', delay: 1000 },
      layout: { align: 'end', width: 69, tall: { width: 100 } }
    });
    assert.equal(slide.transition, 'dissolve');
    assert.deepEqual(slide.layout, { align: 'end', valign: 'center', width: 69, tall: { width: 100 } });
    assert.deepEqual(m.layoutFor(slide.layout, true), { align: 'end', valign: 'center', width: 100 }, 'a tall screen takes its own width');
    assert.deepEqual(m.slideJson(slide), { label: 'Mapa', layers: [], transition: 'dissolve', motion: { name: 'rise', delay: 1000 }, layout: { align: 'end', width: 69, tall: { width: 100 } } }, 'compact');
    assert.deepEqual(m.slideJson(m.readSlideValue({ label: 'A', layers: [] })), { label: 'A', layers: [] }, 'an old slide stays as it was');

    const beside = m.readSlideValue({ label: '', layers: [], with: 'mapa' });
    assert.deepEqual(beside.with, { slide: 'mapa', side: 'end', share: 45, tallSide: 'end' }, 'a companion by name alone');
    const moved = m.remapSlide(m.readSlideValue({ label: '', layers: [], with: { slide: 'a', side: 'start', share: 30, tallSide: 'end' } }), new Map([['a', 'z']]));
    assert.equal(moved.with.slide, 'z', 'a companion follows the new id');
    assert.equal(m.readSlideValue({ label: '', layers: [], with: 'a', stage: { frames: {} } }).with, null, 'who wanders stands above all, not beside one');

    /* Der Wechsel des Altbestands: beide zugleich, 12 px, 2 px. */
    const frames = [{ start: 0, height: 800 }, { start: 800, height: 800 }];
    const half = 400;
    const into = m.motionOf(frames, 1, half, 800, ['scroll', 'dissolve']);
    const outof = m.motionOf(frames, 0, half, 800, ['scroll', 'dissolve']);
    assert.ok(into.pin && outof.pin, 'both stand on the screen');
    assert.ok(close(into.opacity, 0.5) && close(outof.opacity, 0.5), 'they cross half way');
    assert.ok(close(into.lift, 6) && close(outof.lift, 6) && close(into.blur, 1) && close(outof.blur, 1), 'the one rises, the other sinks, both blurred');
    assert.equal(m.motionOf(frames, 1, half, 800, ['scroll', 'dissolve'], true).blur, 0, 'less motion: a plain fade');

    /* Plätze: auf einem hohen Schirm andere, eine Grenze in rem, die mitgleitet. */
    const places = new Map([[0, { x: 70, y: 50, w: 44, scale: 1.08, rotate: 0, opacity: 1, max: 32.5, tall: { x: 30, y: 15, w: 50 } }], [1, { x: 16, y: 50, w: 44, scale: 0.5, rotate: 0, opacity: 0.82, max: 32.5 }]]);
    assert.equal(m.frameAt(places, 0, true).x, 30, 'tall: its own place');
    assert.equal(m.frameAt(places, 0, false).x, 70);
    assert.equal(m.frameAt(places, 0.5, false).max, 32.5, 'the cap travels');
    assert.ok(close(m.frameAt(places, 0.5, false).scale, 0.79), 'half way between ×1.08 and ×0.5');

    /* Das Tuch: der jetzige unten, der nächste blendet darüber ein; ohne eigenes blendet der jetzige aus. */
    assert.deepEqual(m.backdropAt([true, true, false, true], 0), [{ index: 0, opacity: 1 }]);
    assert.deepEqual(m.backdropAt([true, true, false, true], 0.5), [{ index: 0, opacity: 1 }, { index: 1, opacity: 0.5 }]);
    assert.deepEqual(m.backdropAt([true, true, false, true], 1.5), [{ index: 1, opacity: 0.5 }], 'the next has none: this one fades');
    assert.deepEqual(m.backdropAt([true, true, false, true], 2.5), [{ index: 3, opacity: 0.5 }], 'from nothing: the next fades in');
    ok('slides: motion, layout (and tall), companions (remapped), dissolve (both at once, 12 px, 2 px), tall places with a cap, the backdrop crossfade');
  }

  /* -- 4. Die Folge -------------------------------------------------------------------------- */
  {
    assert.equal(m.deckJson(m.NO_DECK), undefined, 'nothing set, nothing written');
    const deck = m.readDeck({ backdrop: [{ kind: 'mesh' }], nav: 'dots', titleSlide: false, width: 80 });
    assert.deepEqual(m.deckJson(deck).nav, 'dots');
    assert.equal(m.readDeck({ nav: 'wiggle', width: 5 }).nav, 'labels', 'an unknown bar is the usual one');
    assert.equal(m.readDeck({ width: 5 }).width, 20, 'the stage is at least 20 rem');
    const look = m.readLook(m.writeLook({ theme: null, cover: [], deck }));
    assert.deepEqual(look.deck, deck, 'the deck survives the page look');
    assert.equal(m.writeLook({ theme: null, cover: [], deck: m.NO_DECK }), null, 'an empty deck is no look');
    assert.equal(m.onAccent('#7ec8ff', '#f4f7fb', '#06162a'), '#06162a', 'dark ink on the light Cogita accent');
    assert.equal(m.onAccent('#2f5fb5', '#16202e', '#f4f6fa'), '#ffffff', 'white on a dark accent');
    ok('deck: compact JSON, tolerant reading, kept in the page look; the text on a light accent is dark');
  }

  /* -- 5. Die Szenen ------------------------------------------------------------------------- */
  {
    const tree = m.learningTree(11);
    assert.equal(tree.nodes.length, m.MAP_LEVELS.reduce((a, b) => a + b, 0), 'every level filled');
    assert.ok(tree.nodes.some((n) => n.role === 'goal') && tree.byId.get('root').role === 'root');
    assert.ok(tree.nodes.filter((n) => n.level > 0).every((n) => (tree.parents.get(n.id) ?? []).length >= 1), 'every node above the root stands on something');
    assert.deepEqual(m.learningTree(11).links, tree.links, 'seed 11 — the same tree every time');
    /* Dieselbe Folge wie der Altbestand: (s · 1664525 + 1013904223) mod 2³². */
    let s = 11;
    const legacyRand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    const r = m.lcg(11);
    for (let i = 0; i < 5; i += 1) assert.equal(r(), legacyRand(), 'the legacy generator');
    /* Der Wanderer, wie in der Szene, nur ohne Uhr: er erreicht den ganzen Baum, und wo ihm etwas fehlt, gibt es Fehler. */
    const rand = m.seeded(1);
    let walk = m.WALK_START;
    let next = m.nextStep(tree, walk.at, walk.active, rand);
    let errors = 0;
    for (let i = 0; i < 2000 && next !== null && walk.active.size < tree.nodes.length; i += 1) {
      const done = m.arrive(tree, walk, next, rand);
      if (done.error !== null) {
        errors += 1;
        const target = next;
        assert.ok(done.error.links.every((key) => key.endsWith(`-${target}`)), 'the red links lead to the node');
      }
      walk = done.walk;
      next = done.next;
    }
    assert.equal(walk.active.size, tree.nodes.length, `the explorer reaches the whole tree (${walk.active.size}/${tree.nodes.length})`);
    assert.ok(errors > 0, 'and on the way finds a missing foundation');

    const throws = m.cardThrows(17);
    assert.equal(throws.length, 7);
    assert.ok(throws.every((t) => Math.abs(t.x) <= 120 && Math.abs(t.y) <= 90 && Math.abs(t.rot) <= 12), 'the legacy throw ranges');
    assert.deepEqual(throws.map((t) => t.delay), [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72].map((d) => Math.round(d * 100) / 100), 'a card every 0.12 s');
    const order = m.stackOrder(17, 3);
    assert.equal(new Set(order).size, 4, 'four different cards on the stack');
    assert.deepEqual(m.stackOrder(17, 3), order, 'the same cycle, the same stack');

    const players = m.roundPlayers(5);
    assert.equal(players.length, 6);
    for (let i = 0; i < players.length; i += 1) for (let j = i + 1; j < players.length; j += 1) assert.ok(Math.hypot(players[i].x - players[j].x, players[i].y - players[j].y) >= 12, 'players keep 12 % apart');
    const round = m.roundOf(5, 2);
    assert.ok(round.card >= 0 && round.card < 5 && round.results.length === 6 && round.links.length <= 3);

    const pts = m.progressPoints(3);
    assert.equal(pts.length, 7);
    assert.deepEqual(pts[0], { x: 40, y: 160 });
    assert.deepEqual(pts[6], { x: 260, y: 48 }, 'the line ends where the legacy one did');
    for (let i = 1; i < pts.length; i += 1) assert.ok(pts[i].x > pts[i - 1].x, 'it moves right');
    const range = m.progressRange(3, pts);
    assert.ok(range.upper.every((p, i) => p.y < range.lower[i].y), 'the band has a top and a bottom');
    const peers = m.progressPeers(3, pts, range);
    assert.equal(peers.higher.length, 7);
    assert.equal(m.safePath('M0 0L10 10z'), 'M0 0L10 10z');
    assert.equal(m.safePath('M0 0"/><script>'), null, 'a drawing is only path letters');
    assert.ok(Object.keys(m.ICONS).includes('shield'), 'the shield of the legacy');
    assert.equal(m.paintOf('accent', true), 'var(--wk-accent)');
    assert.equal(m.paintOf('#111|#eee', true), '#eee');
    ok('scenes: legacy generators (map seed 11, cards 17), the explorer climbs, cards stack four, rounds, the progress line and band, safe drawings');
  }

  /* -- 6. Das Dokument ------------------------------------------------------------------------ */
  {
    const fixture = JSON.parse(await readFile(join(process.cwd(), 'scripts/fixtures/cogita-home.json'), 'utf8'));
    const empty = { path: 'zz-probe/cogita', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null };
    const plan = m.planImport(fixture, empty, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), 'the document imports');
    assert.deepEqual(plan.warnings, [], 'without a single warning');
    assert.equal(plan.mode, 'slides');
    assert.equal(plan.look.deck.nav, 'dots');
    assert.equal(plan.look.deck.titleSlide, false);
    assert.equal(plan.look.deck.backdrop.length, 4);
    assert.equal(plan.parts.length, fixture.modules.length);

    const idOf = new Map(fixture.modules.map((one, i) => [one.id, plan.parts[i].id]));
    const logo = plan.parts[0];
    assert.deepEqual(Object.keys(logo.layout.slide.stage.frames).sort(), ['wejscie', 'mapa', 'biblioteka', 'na-zywo', 'postep', 'ochrona', 'dolacz'].map((k) => idOf.get(k)).sort(), 'the logo\'s places follow the new ids');
    const companions = plan.parts.filter((p) => p.kind === 'animation');
    assert.equal(companions.length, 5, 'five pictures');
    for (const one of companions) assert.ok([...idOf.values()].includes(one.layout.slide.with.slide), 'each beside a real slide');

    const { own, stage, beside } = m.deckParts(plan.parts);
    assert.equal(own.length, 7, 'seven slides');
    assert.equal(stage.length, 1, 'one logo on the stage');
    assert.equal([...beside.values()].flat().length, 5, 'five pictures beside their text');

    const now = { ...empty, title: plan.title, mode: plan.mode, look: plan.look, parts: plan.parts };
    const out = JSON.parse(JSON.stringify(m.exportPage(now)));
    assert.deepEqual(out.theme, fixture.theme);
    assert.deepEqual(out.deck, fixture.deck, 'the deck comes out as it went in');
    const back = new Map([...idOf].map(([a, b]) => [b, a]));
    const swap = (value) => JSON.parse(JSON.stringify(value).replace(/"([0-9a-f-]{36})"/g, (all, id) => (back.has(id) ? `"${back.get(id)}"` : all)));
    out.modules.forEach((one, i) => {
      assert.equal(one.kind, fixture.modules[i].kind);
      assert.deepEqual(swap(one.slide), fixture.modules[i].slide, `${fixture.modules[i].id}: slide unchanged`);
      assert.deepEqual(one.config, fixture.modules[i].config, `${fixture.modules[i].id}: content unchanged`);
    });
    const again = m.planImport(out, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.deepEqual(again.warnings, []);
    assert.deepEqual(again.parts.map((p) => p.layout.slide), plan.parts.map((p) => p.layout.slide), 'export → import changes nothing');

    const words = m.pageDescription();
    for (const key of ['"deck" — ', '"dissolve"', '"motion" — ', '"layout" — ', '"with" — ', '"kind": "mesh"', '"kind": "waves"', '"kind": "haze"', '"kind": "glow"', '"kind": "vignette"', '## Ruch', '"tall" — inne wartości']) {
      assert.ok(words.includes(key), `the description explains ${key}`);
    }
    const bad = m.planImport({ ...fixture, deck: { ...fixture.deck, nav: 'wiggle', backdrop: [{ kind: 'nebula' }] }, modules: [{ kind: 'text', slide: { label: 'x', layers: [], motion: 'shake' }, config: { body: 'x' } }] }, empty, m.DEFAULT_IMPORT);
    assert.ok(bad.warnings.some((w) => w.includes('wiggle')) && bad.warnings.some((w) => w.includes('nebula')) && bad.warnings.some((w) => w.includes('shake')), 'unknown bars, layers and motions are reported');
    ok('fixtures/cogita-home.json: imports without a warning, logo places and pictures follow the new ids, comes out unchanged; the description explains every new key');

    /* -- 7. Es zeichnet sich --------------------------------------------------------------- */
    /* Der Server kennt keine Layout-Effekte (der Antrieb misst damit) — diese eine Warnung ist hier kein Fehler. */
    const said = console.error;
    console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) said(...args); };
    let html = '';
    try {
      html = m.renderToStaticMarkup(m.createElement(m.PageSlides, { parts: plan.parts, look: plan.look, title: plan.title ?? 'Cogita', lead: null, embedded: true }));
    } finally {
      console.error = said;
    }
    assert.ok(html.includes('wk-deck-backdrop'), 'the shared backdrop is drawn');
    assert.ok(html.includes('wk-deck-dots'), 'dots instead of names');
    assert.equal((html.match(/class="wk-deck-slide/g) ?? []).length, 7, 'seven slides — no title slide');
    assert.equal((html.match(/class="an an-/g) ?? []).length, 5, 'five pictures');
    assert.ok(html.includes('wk-deck-row'), 'pictures beside their text');
    assert.ok(html.includes('wk-layers'), 'the logo of twenty layers');
    for (const scene of ['map', 'cards', 'round', 'progress', 'draw']) assert.ok(html.includes(`an an-${scene}`), `the ${scene} picture`);
    assert.ok(html.includes('Wiedza żyje w rozmowie.') && html.includes('Zarejestruj się'), 'the legacy texts');
    ok('server render: backdrop, dots, seven slides, five pictures beside their texts, the logo, the texts');
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
