/**
 * PREZENTACJA (0085) — was ohne Browser nachzumessen ist.
 *
 *   1. Die Achse: Strecken der Szenen, das Verweilen, welche Szene dran ist.
 *   2. Der Wechsel einer Szene je Art, die Kamera (dieselben Rampen wie die
 *      Startseite des Altbestands), das Wachsen, die Betonung, das Nachgehen.
 *   3. Das Kommen eines Bausteins — auch von ausserhalb des Bildes — und das
 *      Wandern von Platz zu Platz (der Kreis wächst quadratisch).
 *   4. Die Tiefe und die Wortwolke (jedes Mal dieselbe).
 *   5. Das Anordnen: der Ring ist der des Altbestands (ringPoints).
 *   6. Das Modell: duldsam lesen, knapp schreiben, Farben, Verweise.
 *   7. Das JSON: die Startseite des Altbestands (`fixtures/presentation-home.json`)
 *      importiert ohne Warnung und kommt unverändert wieder heraus; das
 *      Beispiel der Beschreibung ebenso.
 *   8. Text: grosse, leise Zeilen, Verweise — und keiner nach `javascript:`.
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-presentation-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}presentationMotion';
export * from '${app}presentation';
export { planImport, exportPage, presentationExample, pageDescription, DEFAULT_IMPORT } from '${app}pageJson';
export { readLook, writeLook, resolveTheme } from '${app}slides';
export { lineKind, RichLine } from '${app}richText';
export { pageModeOf } from '${app}page';
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

  /* -- 1. Die Achse ------------------------------------------------------------------------ */
  {
    /* Die Startseite: Raum (1), drei Szenen (4, 3, 3), die Werke (1), Kontakt (1) — wie FrontPage.tsx: 0, 1…4, 5…7, 8…10, 11, 12. */
    const zones = m.zonesOf([1, 4, 3, 3, 1, 1]);
    assert.deepEqual(zones.map((z) => [z.at, z.to]), [[0, 0], [1, 4], [5, 7], [8, 10], [11, 11], [12, 12]]);
    assert.equal(m.lastOf(zones), 12);
    assert.equal(m.zoneIndexOf(zones, 2.5), 1, 'inside a scene: that scene');
    assert.equal(m.zoneIndexOf(zones, 4.3), 2, 'in the gap: the scene whose start is nearest (as the legacy zoneOf)');
    assert.equal(m.activeScene(zones, 0.4), 0);
    assert.equal(m.activeScene(zones, 0.6), 1, 'past the middle of the change the next one is active');
    assert.equal(m.activeScene(zones, 12), 5);
    assert.ok(close(m.walkOf(3), 3) && close(m.walkOf(3.5), 3.5), 'the walk passes the steps and the middle exactly');
    assert.ok(m.walkOf(3.1) - 3 < 0.1 * 0.2, 'and lingers near a step (WALK_HOLD)');
    assert.equal(m.betweenOf(zones, 2.5), 1, 'half way between two steps of one scene');
    assert.equal(m.betweenOf(zones, 4.5), 0, 'a change between scenes is not „between steps"');
    ok('axis: scenes are stretches with one unit of change between them; the walk lingers at each step');
  }

  /* -- 2. Der Wechsel ----------------------------------------------------------------------- */
  {
    const zones = m.zonesOf([1, 4, 3, 3, 1, 1]);
    const changes = ['fade', 'fly', 'fade', 'fade', 'build', 'build'];
    const keeps = [false, false, false, false, false, true];
    const at = (i, s, reduced = false) => m.sceneState(zones, i, s, changes, reduced, keeps);

    /* Der Flug (0 → 1): der Raum oben, ganz da bis 0,55, dann weg (Altbestand: --pspace). */
    assert.ok(at(0, 0.5).above && at(0, 0.5).flown && close(at(0, 0.5).opacity, 1), 'the space is flown through, above the next');
    assert.ok(close(at(0, 0.775).opacity, 0.5), 'and fades in its last stretch');
    assert.ok(close(at(1, 0.3).opacity, 0.3), 'the next scene comes up beneath (present = s)');
    assert.ok(!at(0, 1).visible, 'gone at the next scene');

    /* Szene zu Szene: Überblenden — genau eine Szene steht an jedem Rastpunkt. */
    assert.ok(close(at(1, 4.25).opacity, 0.75) && close(at(2, 4.25).opacity, 0.25), 'a cross-fade');
    for (const s of [1, 2, 3, 4, 5, 7, 8, 10, 11, 12]) {
      const shown = zones.map((_, i) => at(i, s)).filter((st) => st.visible && st.opacity > 0.999);
      assert.equal(shown.length, 1, `at rest point ${s} exactly one scene stands`);
    }

    /* Złożenie: die Werke sind sofort da (die Viertel kommen selbst), die Szenen davor verblassen. */
    assert.ok(close(at(4, 10.3).opacity, 1) && close(at(3, 10.3).opacity, 0.7), 'build: the scene is there at once, the previous fades');
    /* … und der Kontakt legt sich darauf, während die Werke stehen bleiben (keep). */
    assert.ok(close(at(4, 11.5).opacity, 1) && close(at(5, 11.5).opacity, 1), 'build + keep: the old one stands under the new one');

    /* Die Kamera: dieselben drei Rampen wie --pcam im Stilblatt des Altbestands. */
    const pcam = (s) => 0.545 * Math.min(1, Math.max(0, s / 0.30)) + 0.155 * Math.min(1, Math.max(0, (s - 0.30) / 0.46)) + 0.300 * Math.min(1, Math.max(0, (s - 0.76) / 0.24));
    for (const p of [0, 0.1, 0.3, 0.5, 0.76, 0.9, 1]) assert.ok(close(m.flightCurve(p, true), pcam(p)), `camera at ${p}`);
    assert.ok(close(m.flightCurve(0.5, false), 0.5), 'without lingering: smooth');
    const slow = (m.flightCurve(0.7, true) - m.flightCurve(0.4, true)) / 0.3;
    const fast = (m.flightCurve(0.3, true) - m.flightCurve(0.0, true)) / 0.3;
    assert.ok(slow < fast / 3, 'the middle stretch is slow — the sentence stands alone');

    /* Wachsen über die Lebenszeit (Altbestand: scale(0.8 + 0.28 u), u = (s − c + 1) / n). */
    assert.ok(close(m.growAt({ from: 0.8, to: 1.08 }, zones[1], 0), 0.8));
    assert.ok(close(m.growAt({ from: 0.8, to: 1.08 }, zones[1], 4), 1.08));
    assert.ok(close(m.growAt({ from: 0.8, to: 1.08 }, zones[1], 2), 0.8 + 0.28 * 0.5));

    /* Weniger Bewegung: alles blendet, der Schnitt bleibt. */
    assert.equal(m.calmerChange('fly', true), 'fade');
    assert.equal(m.calmerChange('cut', true), 'cut');
    assert.ok(!at(0, 0.5, true).flown, 'no flight with reduced motion');

    /* Die übrigen Arten an ihrer Kante. */
    const kinds = ['fade', 'cover', 'reveal', 'zoom', 'side', 'cut', 'rise'];
    const zz = m.zonesOf([1, 1]);
    for (const kind of kinds) {
      const a = m.sceneState(zz, 0, 0.5, ['fade', kind]);
      const b = m.sceneState(zz, 1, 0.5, ['fade', kind]);
      assert.ok(a.visible && b.visible, `${kind}: both on screen half way`);
      const done = m.sceneState(zz, 1, 1, ['fade', kind]);
      assert.ok(done.opacity === 1 && done.x === 0 && done.y === 0 && done.scale === 1, `${kind}: the new one stands still at the end`);
    }
    assert.ok(m.sceneState(zz, 0, 0.5, ['fade', 'reveal']).above && m.sceneState(zz, 0, 0.5, ['fade', 'reveal']).y < 0, 'reveal: the old one leaves upwards, on top');
    assert.ok(m.sceneState(zz, 1, 0.5, ['fade', 'cover']).y > 0, 'cover: the new one comes from below');
    ok('changes: the flight, cross-fade, build (with keep), cover, reveal, zoom, side, cut; the legacy camera ramps; growing; calmer on request');
  }

  /* -- Betonung und Nachgehen ----------------------------------------------------------- */
  {
    const zones = m.zonesOf([1, 4]);
    assert.equal(m.emphasisOf(zones[1], 0, m.walkOf(1)), 1, 'at its step: emphasised');
    assert.equal(m.emphasisOf(zones[1], 1, m.walkOf(1)), 0, 'the next one not yet');
    const half = m.walkOf(1.5);
    assert.ok(close(m.emphasisOf(zones[1], 0, half) + m.emphasisOf(zones[1], 1, half), 1), 'the emphases add up to one');
    const ring = m.arrange('ring', 4, false, 0);
    const stepped = ring.map((p, step) => ({ scene: 1, step, x: p.x, y: p.y }));
    const pan = m.panAt(zones, stepped, m.walkOf(1));
    assert.ok(close(pan.x, 50 - ring[0].x) && close(pan.y, 50 - ring[0].y), 'the scene moves its emphasised bubble to the middle');
    const mid = m.panAt(zones, stepped, m.walkOf(1.5));
    assert.ok(close(mid.x, 50 - (ring[0].x + ring[1].x) / 2, 1e-9), 'half way: half way');
    const away = m.yieldOf({ x: 80, y: 52 }, { x: 52, y: 52 });
    assert.ok(close(away.x, m.YIELD) && close(away.y, 0), 'the unemphasised yield outwards from the centre');
    ok('emphasis: a triangle around each step, adding to one; the scene follows the emphasised; the others yield');
  }

  /* -- 3. Kommen und Wandern ----------------------------------------------------------- */
  {
    /* Die Viertel (QUARTERS): links oben fährt von links — 54 % der Breite wie im Altbestand. */
    const quarter = { x: 25, y: 25, w: 50, h: 50 };
    assert.ok(close(m.arriveStyle('from-left', 0, quarter).x, -54), 'out of the picture to the left');
    assert.equal(m.arriveStyle('from-left', 0, quarter).opacity, 1, 'a panel that slides is a thing, not a veil');
    assert.ok(close(m.arriveStyle('from-right', 0, { x: 75, y: 25, w: 50, h: 50 }).x, 54));
    assert.ok(close(m.arriveStyle('from-left', 0.5, quarter).x, -27), 'linearly, like --a');
    assert.ok(close(m.arriveStyle('from-left', 0, { x: 4, y: 30, w: 40, h: null }, false, 'top-left').x, -48), 'from its edge, wherever its point is');
    assert.deepEqual(m.arriveStyle('zoom', 1, quarter), { opacity: 1, x: 0, y: 0, scale: 1 });
    assert.ok(close(m.arriveStyle('zoom', 0.5, quarter).scale, 0.965), 'zoom: 0.93 + 0.07 in');
    assert.equal(m.arriveStyle('grow', 0.25, quarter).scale, 0.25, 'grow: from a point');
    assert.ok(close(m.arriveProgress(0.5, 0.15, 0.4), 0.875), 'delay and span within the change');
    assert.deepEqual(m.arriveStyle('from-left', 0.3, quarter, true), { opacity: 0.3, x: 0, y: 0, scale: 1 }, 'reduced: fades instead');

    /* Der Kreis: dzieje (11) → kontakt (12), Massstab 1 → 26, quadratisch (Altbestand: 1 + 25 porb²). */
    const zones = m.zonesOf([1, 4, 3, 3, 1, 1]);
    const base = { ...m.PLACE, w: 100, max: 15 };
    const places = new Map([[4, base], [5, { ...base, scale: 26 }]]);
    for (const p of [0, 0.25, 0.5, 1]) {
      const j = m.journeyAt(places, zones, 11 + p, 'in', false);
      assert.ok(close(j.place.scale, 1 + 25 * p * p), `the circle at ${p}: ${j.place.scale}`);
    }
    const before = m.journeyAt(places, zones, 10.5, 'in', false);
    assert.ok(before.arriving === 4 && close(before.presence, 0.5), 'it comes with its first scene');
    assert.ok(m.journeyAt(places, zones, 9, 'in', false).presence === 0, 'and is not there before');
    assert.ok(m.journeyAt(places, zones, 9, 'in', true).presence === 1, 'unless it holds');
    const mark = new Map([[4, { ...m.PLACE, x: 50, y: 50 }], [5, { ...m.PLACE, x: 16, y: 18 }]]);
    const half = m.journeyAt(mark, zones, 11.5, 'linear', false).place;
    assert.ok(close(half.x, 33) && close(half.y, 34), 'the sign wanders into the corner (left: 50% − 34% porb)');
    const gap = new Map([[1, { ...m.PLACE, x: 10 }], [3, { ...m.PLACE, x: 90 }]]);
    assert.ok(m.journeyAt(gap, zones, 6, 'linear', false).place.x > 10 && m.journeyAt(gap, zones, 6, 'linear', false).place.x < 90, 'it glides across a scene without its own place');
    assert.equal(m.journeyAt(gap, zones, 9, 'linear', false).place.x, 90, 'and stands on its place');
    const after = m.journeyAt(gap, zones, 10.5, 'linear', false);
    assert.ok(close(after.presence, 0.5), 'after its last place it goes with that scene');
    ok('arrivals: from outside the picture (54 % like the quarters), zoom, grow, delayed; journeys: the circle grows quadratically, the sign glides, gaps are crossed');
  }

  /* -- 4. Tiefe und Wolke ------------------------------------------------------------------ */
  {
    /* Altbestand: far = clamp(0.4, 1 + (ze + 500) / 1800, 1); near = clamp((880 − ze) / 320). */
    const legacy = (ze) => Math.min(1, Math.max(0.4, 1 + (ze + 500) / 1800)) * Math.min(1, Math.max(0, (880 - ze) / 320));
    for (const ze of [-1650, -980, -320, 0, 560, 700, 880, 1000]) assert.ok(close(m.depthFade(ze, 1000), legacy(ze)), `depth at ${ze}`);
    assert.ok(close(m.depthScale(-1000, 1000), 0.5), 'twice as far, half as big');
    const words = { list: ['colligere', 'novatio'], prefix: 'RE', count: 6, seed: 7, color: null };
    const a = m.scatterWords(words), b = m.scatterWords(words);
    assert.deepEqual(a, b, 'the same cloud every time');
    assert.notDeepEqual(a, m.scatterWords({ ...words, seed: 8 }), 'another seed, another cloud');
    assert.deepEqual(a.map((w) => w.word), ['colligere', 'novatio', 'colligere', 'novatio', 'colligere', 'novatio'], 'each word as often as the others');
    assert.ok(a.every((w) => w.z >= m.WORD_FAR && w.z <= m.WORD_NEAR && w.alpha >= 0.35 && w.alpha <= 0.8 && w.size >= 1.5 && w.size <= 6.2));
    ok('depth: the legacy fading before the camera plane and with distance; the word cloud is the same every time');
  }

  /* -- 5. Anordnen --------------------------------------------------------------------- */
  {
    /* ringPoints aus FrontPage.tsx, wörtlich. */
    const ringPoints = (count, scene, portrait) => {
      const [cx, cy] = portrait ? [50, 50] : [52, 52];
      const rx = portrait ? 17 : 27, ry = portrait ? 31 : 24;
      const turn = scene * 0.37 - 0.25;
      return Array.from({ length: count }, (_, i) => {
        const a = 2 * Math.PI * (i / count + turn);
        return [Number((cx + rx * Math.cos(a)).toFixed(2)), Number((cy + ry * Math.sin(a)).toFixed(2))];
      });
    };
    for (const [count, scene] of [[4, 0], [3, 1], [3, 2]]) {
      for (const portrait of [false, true]) {
        const ours = m.arrange('ring', count, portrait, scene).map((p) => [p.x, p.y]);
        assert.deepEqual(ours, ringPoints(count, scene, portrait), `ring ${count}/${scene}/${portrait}`);
      }
    }
    const q = m.arrange('quarters', 4, false);
    assert.deepEqual(q.map((p) => [p.x, p.y]), [[25, 25], [25, 75], [75, 25], [75, 75]], 'quarters: left top, left bottom, right top, right bottom');
    for (const kind of m.ARRANGEMENTS) assert.equal(m.arrange(kind, 5, false).length, 5, `${kind}: a place for each`);
    ok('arranging: the ring is the legacy ring (wide and tall, turned per scene); quarters in the legacy order');
  }

  /* -- 6. Das Modell -------------------------------------------------------------------- */
  {
    const show = m.readShow({
      format: 'nonsense', fonts: 'spectral',
      scenes: [{ key: 'a', label: ' A ', steps: 999, change: 'fly' }, { key: 'a', change: 'warp', duration: -5 }, 'junk']
    });
    assert.equal(show.format, 'screen', 'an unknown format is the screen');
    assert.equal(show.scenes.length, 3);
    assert.equal(show.scenes[0].steps, 50, 'steps are bounded');
    assert.equal(show.scenes[0].duration, 1700, 'a flight takes longer by default');
    assert.notEqual(show.scenes[1].key, 'a', 'two scenes never share a key');
    assert.equal(show.scenes[1].change, 'fade');
    assert.equal(show.scenes[2].key, 'scena-3', 'a scene without a key gets one');
    assert.deepEqual(m.sceneJson(m.readScene({ key: 'x', label: 'X' }, 0)), { key: 'x', label: 'X' }, 'a plain scene is written plainly');
    const piece = m.readPieceValue({ places: { a: { x: 500, w: 0.1, step: 2.4, tall: { y: 10, junk: 1 } }, '': { x: 1 } }, skin: 'bubble', origin: 'nowhere', delay: 3 });
    assert.deepEqual(Object.keys(piece.places), ['a'], 'a place without a scene falls away');
    assert.equal(piece.places.a.x, 200);
    assert.equal(piece.places.a.w, 1);
    assert.equal(piece.places.a.step, 2);
    assert.deepEqual(piece.places.a.tall, { y: 10 });
    assert.equal(piece.origin, 'center');
    assert.equal(piece.delay, 0.95);
    assert.deepEqual(m.readPieceValue(m.pieceJson(piece)), piece, 'written and read: the same');
    assert.deepEqual(m.pieceJson(m.readPieceValue({ places: { a: { x: 10, y: 20, w: 30 } } })), { places: { a: { x: 10, y: 20, w: 30 } } }, 'defaults are left out');
    assert.equal(m.placeFor({ ...m.PLACE, x: 20, tall: { x: 70 } }, true).x, 70, 'tall: its own value');
    assert.equal(m.placeFor({ ...m.PLACE, x: 20, tall: { x: 70 } }, false).x, 20, 'wide: the place');
    assert.equal(m.placeFor({ ...m.PLACE, max: 22, tall: { max: null } }, true).max, null, 'tall may drop the maximum');
    assert.ok(!m.travels(piece) && m.travels({ ...piece, hold: true }) && m.travels({ ...piece, places: { a: m.PLACE, b: m.PLACE } }));
    assert.equal(m.stepsNeeded('a', [piece]), 3, 'a scene gets as many steps as its pieces need');
    assert.equal(m.resolveColor('#ece0c9|#2a2113', false), '#ece0c9');
    assert.equal(m.resolveColor('#ece0c9|#2a2113', true), '#2a2113', 'a pair: light and dark');
    assert.equal(m.resolveColor('accent', false), 'var(--pz-accent)', 'a theme name follows the scene');
    assert.equal(m.resolveColor(null, true), null);
    assert.equal(m.textLink('javascript:alert(1)'), null, 'no script');
    assert.equal(m.textLink('mailto:a@b.pl'), 'mailto:a@b.pl');
    assert.equal(m.textLink('#/rc/o-nas'), '#/rc/o-nas');
    assert.equal(m.textLink('#kontakt'), '#kontakt', 'a scene by its name');
    assert.equal(m.textLink('www.recreatio.pl'), 'https://www.recreatio.pl');
    assert.equal(m.pageModeOf('presentation'), 'presentation');
    assert.equal(m.pageModeOf('show'), 'page', 'an unknown mode is a page');

    /* Das Aussehen trägt die Szenen und die Nachtfarben mit — auch durch die Slajdy hindurch. */
    const look = m.readLook(JSON.stringify({ mode: 'light', accent: '#111111', ink: '#222222', ground: '#333333', muted: '#444444', night: { accent: '#aaaaaa', ink: '#bbbbbb', ground: '#cccccc', muted: '#dddddd' }, cover: { layers: [] }, show: { scenes: [{ key: 's' }] } }));
    assert.equal(look.theme.night.ground, '#cccccc');
    assert.deepEqual(look.show, { scenes: [{ key: 's' }] });
    assert.deepEqual(m.readLook(m.writeLook(look)), look, 'written and read: the same look');
    assert.equal(m.resolveTheme(look.theme, true).ground, '#cccccc', 'a dark device gets the night');
    assert.equal(m.resolveTheme(look.theme, false).ground, '#333333');
    assert.equal(m.readLook(m.writeLook({ theme: null, cover: [], show: { scenes: [] } })).theme, null, 'automatic colours with a show');
    ok('model: tolerant reading, bounded values, compact writing, tall places, colour pairs and theme names, safe links, night colours in the look');
  }

  /* -- 7. Das JSON: die Startseite des Altbestands --------------------------------------- */
  {
    const home = JSON.parse(await readFile(join(process.cwd(), 'scripts/fixtures/presentation-home.json'), 'utf8'));
    const now = { path: 'start', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null };
    const plan = m.planImport(home, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), JSON.stringify(plan));
    assert.deepEqual(plan.warnings, [], 'the homepage imports without a warning');
    assert.equal(plan.mode, 'presentation');
    assert.ok(plan.lines.some((l) => l.includes('Prezentacja: 6 scen')), plan.lines.join(' | '));
    const show = m.readShow(plan.look.show);
    assert.deepEqual(show.scenes.map((sc) => [sc.key, sc.steps, sc.change]), [
      ['start', 1, 'fade'], ['calosc', 4, 'fly'], ['czlowiek', 3, 'fade'], ['dane', 3, 'fade'], ['dzieje', 1, 'build'], ['kontakt', 1, 'build']
    ]);
    assert.equal(show.scenes[0].words.count, 39, 'thirty-nine words in the space');
    assert.equal(plan.parts.length, home.modules.length);
    assert.ok(plan.parts.every((p) => m.readPiece(p.layout).places !== undefined && Object.keys(m.readPiece(p.layout).places).length > 0), 'every module stands somewhere');
    const steps = new Map(show.scenes.map((sc) => [sc.key, m.stepsNeeded(sc.key, plan.parts.map((p) => m.readPiece(p.layout)))]));
    for (const sc of show.scenes) assert.ok(sc.steps >= steps.get(sc.key), `${sc.key}: enough steps for its bubbles`);
    const kinds = new Set(plan.parts.map((p) => p.kind));
    assert.deepEqual([...kinds].sort(), ['image', 'shape', 'text'], 'built from text, image and shape');
    assert.ok(plan.look.theme.night !== undefined, 'light and night colours, like the legacy page');

    const again = m.exportPage({ ...now, title: plan.title, lead: plan.lead ?? '', mode: plan.mode, look: plan.look, parts: plan.parts, logic: null, menu: null });
    assert.deepEqual(again.show, home.show, 'the scenes come out as they went in');
    again.modules.forEach((mod, i) => {
      assert.deepEqual(mod.show, home.modules[i].show, `${home.modules[i].id}: its place comes out as it went in`);
      assert.deepEqual(mod.config, home.modules[i].config, `${home.modules[i].id}: its content too`);
    });
    const back = m.planImport(again, { ...now, mode: plan.mode, look: plan.look, parts: plan.parts }, { ...m.DEFAULT_IMPORT, replace: true });
    assert.deepEqual(back.warnings, []);
    assert.deepEqual(back.parts.map((p) => p.layout.show), plan.parts.map((p) => p.layout.show), 'export → import changes nothing');

    const example = m.planImport(m.presentationExample(), now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in example) && example.warnings.length === 0, `the example of the description imports cleanly: ${JSON.stringify(example.warnings)}`);
    const lost = m.planImport({ ...m.presentationExample(), show: { scenes: [{ key: 'other' }] } }, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(lost.warnings.some((w) => w.includes('scenę, której nie ma')), 'a place on a scene that does not exist is reported');
    const odd = m.planImport({ ...m.presentationExample(), show: { scenes: [{ key: 'start', change: 'warp' }] }, modules: [{ kind: 'text', show: { places: { start: {} }, skin: 'glass' }, config: { title: 'x' } }] }, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(odd.warnings.some((w) => w.includes('warp')) && odd.warnings.some((w) => w.includes('glass')), 'unknown values are reported');

    const doc = m.pageDescription();
    for (const key of ['"show" — ', '"places" — ', '"skin" — ', '"arrive" — ', '"origin" — ', '"max" — ', '"words" — ', '"change" — ', '"keep" — ', '"night"', '"presentation"']) {
      assert.ok(doc.includes(key), `the description explains ${key}`);
    }
    for (const t of m.SCENE_CHANGES) assert.ok(doc.includes(`"${t}"`), `the description names the change ${t}`);
    for (const t of m.ARRIVALS) assert.ok(doc.includes(`"${t}"`), `the description names the arrival ${t}`);
    for (const t of m.TEXT_TYPES) assert.ok(doc.includes(`"${t}"`), `the description names the text type ${t}`);
    ok(`JSON: the legacy homepage (${home.modules.length} modules, 6 scenes) imports without warning and comes out unchanged; the description's example too; every key described`);
  }

  /* -- 8. Text ---------------------------------------------------------------------------- */
  {
    assert.deepEqual(m.lineKind('## Kto'), { kind: 'sub', text: 'Kto' });
    assert.deepEqual(m.lineKind('# [a@b.pl](mailto:a@b.pl)'), { kind: 'lead', text: '[a@b.pl](mailto:a@b.pl)' });
    assert.deepEqual(m.lineKind('> cicho'), { kind: 'quiet', text: 'cicho' });
    assert.equal(m.lineKind('[O nas](#/rc/o-nas) · [Kontakt](#/rc/kontakt)').kind, 'links');
    assert.equal(m.lineKind('Zobacz [stronę](https://x.pl) dziś').kind, 'text');
    assert.equal(m.lineKind('').kind, 'gap');
    const html = (line) => m.renderToStaticMarkup(m.createElement(m.RichLine, { line }));
    assert.ok(html('Zobacz [stronę](https://recreatio.pl) dziś').includes('href="https://recreatio.pl"'), 'a link');
    assert.ok(!html('[klik](javascript:alert(1))').includes('href'), 'no script link');
    assert.ok(html('[O nas](#/rc/o-nas) · [Kontakt](#/rc/kontakt)').includes('wk-card-links'), 'a row of links');
    assert.equal(html(''), '', 'an empty line in a paragraph text is nothing');
    ok('text: large and quiet lines, links (safe), a row of links — on pages and on the stage');
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
