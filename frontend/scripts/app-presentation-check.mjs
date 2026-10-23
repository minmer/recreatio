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
 *   9. Wege: ein Eingang, mehrere Ausgänge.
 *  10. 2026-10-19 — Klatki am Fortschritt der Szene, Ausschnitt, Maske, Gehen und
 *      Wiederkommen, Knöpfe zu Schritten und auf jeder Szene, der Klang.
 *  11. Hortus Dei (`fixtures/hortus-dei.json`, geschrieben von `hortus-dei.mjs`):
 *      das Szenario des Konzepts importiert ohne Warnung und kommt unverändert heraus.
 *  12. 2026-10-21 — der Przebieg: Werte, Tore (Bedingung, Wert), Fragen mit
 *      „dobrze" / „źle", der Weg durch die Tore mit dem, was der Lernende weiss.
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
export * from '${app}pages/presentation/presentationMotion';
export * from '${app}pages/presentation/presentation';
export { END, LINK, GATE, resolveTarget, nextOf, chainFrom, routeOf, branch, routeTo, reachable, autoMap, targetOptions, withGo, withNext, brokenTarget, goOf, goOptions } from '${app}pages/presentation/showPaths';
export { readStory, storyJson, throughGates, storyChain, beyondOf, outcomeTarget, outcomeKey, isOutcomeKey, startValues, gateTargets, limitsOf, NO_STORY } from '${app}pages/presentation/story';
export { storyToFlow, sceneNode, gateNode } from '${app}pages/presentation/storyFlow';
export { readFlow, startFlow, advance, narratorNow, exitsOf } from '${app}cogita/flow';
export { planImport, exportPage, DEFAULT_IMPORT } from '${app}pages/pageJson';
export { presentationExample, pageDescription } from '${app}pages/pageJsonText';
export { readLook, writeLook, resolveTheme } from '${app}pages/slides/slideLook';
export { lineKind, RichLine } from '${app}ui/richText';
export { pageModeOf } from '${app}pages/page';
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
    for (const key of ['"show" — ', '"places" — ', '"skin" — ', '"arrive" — ', '"origin" — ', '"max" — ', '"words" — ', '"change" — ', '"keep" — ', '"night"', '"presentation"', '"next" — ', '"go" — ', '"links" — ', '"map" — ']) {
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
    /* 2026-10-22 — das Innere liest der eine Leser (libraryMarkup): fett, kursiv; ohne Bibliothek nichts über Verweise. */
    assert.ok(html('**mocno** i *lekko*').includes('<strong>mocno</strong>') && html('**mocno** i *lekko*').includes('<em>lekko</em>'), 'bold and italic');
    const bare = html('Zob. [[ten tekst|@x1]] ^[uwaga] [@y1]');
    assert.ok(bare.includes('ten tekst') && bare.includes('(uwaga)') && bare.includes('[odwołanie niedostępne]') && !bare.includes('x1') && !bare.includes('y1'), 'without a library: the words of a link, a note in brackets, a reference unreadable');
    ok('text: large and quiet lines, links (safe), a row of links — on pages and on the stage');
  }

  /* -- 9. Wege (0089): ein Eingang, mehrere Ausgänge, Wege hinaus ----------------------------- */
  {
    const scene = (key, extra = {}) => m.readScene({ key, label: key.toUpperCase(), ...extra }, 0);
    const show = (scenes, links = []) => ({ ...m.NO_SHOW, scenes, links });
    const piece = (places, go) => ({ ...m.PIECE, places: Object.fromEntries(places.map((k) => [k, m.PLACE])), go });

    /* Ohne Wege: die Liste — wie bisher. */
    const plain = show([scene('a'), scene('b'), scene('c')]);
    assert.deepEqual(m.routeOf(plain), ['a', 'b', 'c'], 'no paths: the list, as before');
    assert.deepEqual(m.nextOf(plain, 'c'), { kind: 'end' });

    /* A → (dalej) B1 → C; A → (Knopf) B2 → C; C → hinaus. */
    const links = [{ id: 'www', label: 'Strona', href: 'https://recreatio.pl' }];
    const net = show([scene('a'), scene('b1', { next: 'c' }), scene('b2'), scene('c', { next: 'link:www' })], links);
    const pieces = [piece(['a'], { a: 'b2' })];
    assert.deepEqual(m.routeOf(net), ['a', 'b1', 'c'], 'the way without a button skips the other branch');
    assert.deepEqual(m.nextOf(net, 'c'), { kind: 'link', link: links[0] }, '„dalej" at the end leads out');
    assert.deepEqual(m.resolveTarget(net, 'nic'), { kind: 'none' }, 'a target that does not exist is nothing');

    /* Der Knopf auf A: der Weg bis A bleibt, ab dort B2 → C. */
    const pressed = m.branch(net, m.routeOf(net), 0, 'b2');
    assert.deepEqual(pressed, { route: ['a', 'b2', 'c'], index: 1 }, 'a button: the way so far, then the new branch');
    /* Zurück auf eine Szene, die schon hinter einem liegt: der Weg bleibt. */
    const loop = m.branch(net, ['a', 'b2', 'c'], 2, 'a');
    assert.deepEqual(loop, { route: ['a', 'b2', 'c'], index: 0 }, 'back to a scene behind: the way stays');
    /* Eine Schleife hört auf, statt endlos zu werden. */
    const circle = show([scene('x'), scene('y', { next: 'x' })]);
    assert.deepEqual(m.routeOf(circle), ['x', 'y'], 'a loop stops where it began');
    assert.deepEqual(m.chainFrom(net, 'b2', new Set(['a'])), ['b2', 'c']);

    /* Der Weg zu einer Szene (ein Vortrag ab dort): über den Knopf. */
    assert.deepEqual(m.routeTo(net, pieces, 'b2'), ['a', 'b2', 'c'], 'the way to a scene goes through the button that leads there');
    assert.deepEqual(m.routeTo(net, [], 'b2'), ['b2', 'c'], 'unreachable: the way starts there');
    assert.deepEqual([...m.reachable(net, pieces)].sort(), ['a', 'b1', 'b2', 'c']);
    assert.deepEqual([...m.reachable(net, [])].sort(), ['a', 'b1', 'c'], 'without the button nobody reaches B2');

    /* Die Karte: jede Szene, jeder Weg hinaus und das Ende haben einen Platz; der Weg ohne Knopf in der ersten Reihe. */
    const map = m.autoMap(net, pieces);
    assert.ok(['a', 'b1', 'b2', 'c', 'link:www', 'end'].every((k) => map[k] !== undefined), 'every node has a place');
    assert.ok(map.a.y === 0 && map.b1.y === 0 && map.c.y === 0 && map.b2.y > 0, 'the main way on top, the branch below');
    assert.deepEqual(m.targetOptions(net).map((o) => o.value), ['a', 'b1', 'b2', 'c', 'link:www', 'end']);

    /* Gespeichert und gelesen: nur, was gilt; ein Weg hinaus nur mit einer Adresse, die ein Verweis sein darf. */
    const read = m.readShow({ scenes: [{ key: 'a', next: 'b' }, { key: 'b' }], links: [{ id: 'ok', label: 'Ok', href: 'www.example.pl' }, { id: 'bad', href: 'javascript:alert(1)' }], map: { a: { x: 10.4, y: 20 } } });
    assert.equal(read.scenes[0].next, 'b');
    assert.equal(read.scenes[1].next, null, 'no exit given: the next in the list');
    assert.deepEqual(read.links, [{ id: 'ok', label: 'Ok', href: 'https://www.example.pl' }], 'a script is no way out');
    assert.deepEqual(read.map, { a: { x: 10, y: 20 } });
    assert.deepEqual(m.readShow(m.showJson(read)), read, 'round trip');
    const p = m.readPieceValue({ places: { a: {} }, go: { a: 'b', '': 'x', b: 5 } });
    assert.deepEqual(p.go, { a: 'b' }, 'a button: scene → target');
    assert.deepEqual(m.pieceJson(p).go, { a: 'b' });
    assert.equal(m.pieceJson(m.readPieceValue({ places: { a: {} } })).go, undefined, 'no button, no key');
    assert.deepEqual(m.withGo(p, 'a', undefined).go, {}, 'the button can go again');
    assert.equal(m.withNext(read.scenes[0], '').next, null);

    /* Import: ein Ausgang ins Nichts wird gesagt. */
    const now = { path: 'zz/x', title: 't', lead: '', mode: 'presentation', look: m.readLook(null, 'presentation'), parts: [], logic: null, menu: null };
    const doc = { ...m.presentationExample(), show: { ...m.presentationExample().show, scenes: [{ key: 'start', next: 'nowhere' }, { key: 'dni' }, { key: 'zapisy' }] } };
    const planned = m.planImport(doc, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(planned.warnings.some((w) => w.includes('do sceny albo linku, których nie ma')), 'an exit into nothing is reported');
    const example = m.readShow(m.presentationExample().show);
    assert.deepEqual(m.routeOf(example), ['start', 'dni', 'zapisy'], 'the example: in order');
    assert.equal(m.nextOf(example, 'zapisy').kind, 'link', 'the example ends with a way out');
    ok('paths: one entrance, many exits — the way without a button, branching keeps the way so far, loops stop, the way to a scene, ways out (safe), JSON and warnings');
  }
  /* -- 10. Klatki, Ausschnitt, Maske, Gehen und Wiederkommen, Knöpfe zu Schritten, Klang (2026-10-19) -- */
  {
    const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
    const placeOf = (raw) => m.readPieceValue({ places: { a: raw } }).places.a;

    /* Klatki: was eine nennt, gilt ab ihr; dazwischen ein Zug in ihrer Kurve; ein Halt; geordnet nach "at". */
    const p = placeOf({ x: 50, y: 50, w: 100, h: 100, frames: [{ at: 0.2 }, { at: 1, x: 30, w: 40, h: 60, ease: 'linear' }, { at: 0.5, opacity: 0.5, ease: 'linear' }] });
    assert.equal(p.frames.length, 3);
    assert.equal(m.placeAt(p, 0.1).x, 50, 'before the first frame: the place itself (a hold)');
    assert.ok(near(m.placeAt(p, 0.35).opacity, 0.75) && m.placeAt(p, 0.35).x === 50, 'half way to the opacity frame: only the opacity moves');
    const mid = m.placeAt(p, 0.75);
    assert.ok(near(mid.x, 40) && near(mid.w, 70) && near(mid.h, 80) && near(mid.opacity, 0.5), 'the next frame starts where the last left off (cumulative)');
    const end = m.placeAt(p, 1);
    assert.deepEqual([end.x, end.w, end.h, end.opacity, end.frames.length], [30, 40, 60, 0.5, 0], 'at the end: everything said so far');
    assert.equal(m.placeAt(p, 0.75).x, m.placeAt(p, 0.75).x, 'the same progress is the same picture (rewinding restores it)');

    /* Klatki an Schritten: Schritt n von 4 ist n/3. */
    const steps = placeOf({ x: 50, frames: [{ step: 1, x: 10, ease: 'linear' }, { step: 3, x: 30, ease: 'linear' }] });
    assert.equal(m.frameAt(steps.frames[0], 4), 1 / 3);
    assert.equal(m.frameAt(steps.frames[0], 1), 0, 'a scene of one step: everything at 0');
    assert.ok(near(m.placeAt(steps, 1 / 3, 4).x, 10) && near(m.placeAt(steps, 2 / 3, 4).x, 20) && near(m.placeAt(steps, 1, 4).x, 30));

    /* Der Fortschritt: das Innere der Szene, ihr Kommen, ihr Gehen. */
    const zone = { at: 4, to: 7 };
    assert.deepEqual([3, 4, 5.5, 7, 9].map((s) => m.progressOf('scene', zone, s)), [0, 0, 0.5, 1, 1]);
    assert.deepEqual([m.progressOf('enter', zone, 3.5), m.progressOf('enter', zone, 3.5, true)], [0.5, 1], 'the first scene is always there');
    assert.deepEqual([m.progressOf('leave', zone, 7.5), m.progressOf('leave', zone, 7.5, false, true)], [0.5, 0], 'the last never leaves');
    assert.equal(m.progressOf('scene', { at: 2, to: 2 }, 2.5), 0, 'one step: progress stands at 0');

    /* „Weniger Bewegung": eine stille Stelle — an Schritten springt sie von Schritt zu Schritt. */
    assert.equal(m.stillOf(p), 1, 'by default the end');
    assert.equal(m.stillOf(placeOf({ by: 'leave', frames: [{ at: 1, x: 1 }] })), 0, 'leaving: the beginning (the scene is still there)');
    assert.equal(m.stillOf(placeOf({ still: 0.25, frames: [{ at: 1, x: 1 }] })), 0.25);
    assert.deepEqual([5.4, 6.6, 4].map((s) => m.stillAt(steps, zone, s)), [1 / 3, 1, 0], 'step frames snap to the step one stands on');
    assert.equal(m.stillAt(p, zone, 5), 1, 'frames by "at": the still place');

    /* Der Ausschnitt: wie CSS ihn kennt, gespeichert als zwei Prozente. */
    assert.deepEqual(['center', 'left top', 'top left', '57% 40%', '30%', 'bottom', 'left left', 'nonsense', '1% 2% 3%', 7].map(m.readCrop),
      ['50% 50%', '0% 0%', '0% 0%', '57% 40%', '30% 50%', '50% 100%', null, null, null, null]);
    assert.equal(m.mixCrop('0% 0%', '100% 50%', 0.5), '50% 25%');
    assert.equal(m.mixCrop(null, '10% 10%', 0.4), null, 'without one: the first until half way');

    /* Die Maske: Kreis, Oval, Rechteck; ohne — mit der, die alles zeigt. */
    const circle = m.readMaskValue({ shape: 'circle', r: 40 });
    assert.equal(m.maskCss(circle), 'circle(40% at 50% 50%)');
    assert.deepEqual(m.maskJson(circle), { shape: 'circle', r: 40 }, 'compact: only what differs');
    assert.equal(m.maskCss(m.readMaskValue({ shape: 'inset', top: 10, round: 1.5 })), 'inset(10% 0% 0% 0% round 1.5rem)');
    assert.equal(m.maskCss(m.readMaskValue({ shape: 'ellipse', rx: 60, ry: 40, x: 30 })), 'ellipse(60% 40% at 30% 50%)');
    assert.equal(m.readMaskValue('none'), null);
    assert.equal(m.readMaskValue({ shape: 'star' }), undefined, 'an unknown shape is no mask');
    assert.ok(near(m.mixMask(null, circle, 0.5).r, (141.5 + 40) / 2), 'from no mask: from the circle that shows everything');
    const oval = m.fullMask(m.readMaskValue({ shape: 'ellipse', x: 30 }));
    assert.ok(near(oval.rx, 99, 0.02) && near(oval.ry, 70.71, 0.02), `the whole oval reaches the far corner: ${JSON.stringify(oval)}`);
    assert.equal(m.maskCss(null), '');

    /* Hochkant: eigener Ausschnitt, eigene Maske, eigene Werte je Klatka. */
    const tallPlace = placeOf({ x: 10, crop: '10% 10%', mask: { shape: 'circle' }, tall: { x: 50, crop: '20% 20%', mask: null }, frames: [{ at: 1, x: 30, tall: { x: 70 } }] });
    const phone = m.placeFor(tallPlace, true);
    assert.deepEqual([phone.x, phone.crop, phone.mask, phone.frames[0].x], [50, '20% 20%', null, 70]);
    assert.deepEqual([m.placeFor(tallPlace, false).crop, m.placeFor(tallPlace, false).frames[0].x], ['10% 10%', 30]);

    /* Gehen und wiederkommen: mit der einen Szene fort, mit der anderen zurück — dazwischen nicht da, und immer in der Ebene der Szene, auf der er ist. */
    const zones = m.zonesOf([2, 1, 1, 2]);
    const two = new Map([[0, m.PLACE], [3, { ...m.PLACE, x: 80 }]]);
    const at = (s, between) => m.journeyAt(two, zones, s, 'linear', false, undefined, between);
    assert.deepEqual([at(1, 'leave').presence, at(1, 'leave').scene], [1, 0]);
    assert.deepEqual([at(1.5, 'leave').presence, at(1.5, 'leave').scene, at(1.5, 'leave').place.x], [0.5, 0, 50], 'leaving with its scene, where it stood');
    assert.equal(at(2.5, 'leave').presence, 0, 'in between: not there');
    assert.deepEqual([at(3.5, 'leave').presence, at(3.5, 'leave').arriving, at(3.5, 'leave').scene, at(3.5, 'leave').place.x], [0.5, 3, 3, 80], 'coming with the other scene, at its place there');
    assert.ok(at(2.5, 'glide').presence === 1 && at(2.5, 'glide').place.x > 50 && at(2.5, 'glide').scene === 0, 'gliding (as before): through the scenes in between');
    const next = new Map([[0, m.PLACE], [1, m.PLACE]]);
    assert.equal(m.journeyAt(next, zones, 1.5, 'linear', false, undefined, 'leave').scene, 1, 'neighbours, going with its scenes: already in the plane of the coming one');
    assert.equal(m.journeyAt(next, zones, 1.5, 'linear', false, undefined, 'glide').scene, 0, 'neighbours, gliding: the plane of its first scene (as before)');

    /* Knöpfe: zum eigenen Schritt, zu einem genannten, auf jeder Szene („*"; die eigene geht vor). */
    const show2 = m.readShow({ scenes: [{ key: 'a', steps: 3 }, { key: 'b' }, { key: 'c' }] });
    assert.deepEqual(m.resolveTarget(show2, 'step'), { kind: 'step', step: null });
    assert.deepEqual(m.resolveTarget(show2, 'step:2'), { kind: 'step', step: 2 });
    assert.deepEqual(m.resolveTarget(show2, 'step:x'), { kind: 'none' });
    const button = m.readPieceValue({ places: { a: {}, b: {} }, go: { '*': 'c', a: 'step' } });
    assert.deepEqual(m.pieceJson(button).go, { '*': 'c', a: 'step' }, 'kept as written');
    assert.deepEqual([m.goOf(show2, button, 'a').kind, m.goOf(show2, button, 'b').kind, m.goOf(show2, button, 'b').key], ['step', 'scene', 'c'], 'its own scene first, then "*"');
    const offered = m.goOptions(show2, 3).map((o) => o.value);
    assert.ok(offered.includes('step') && offered.includes('step:0') && offered.includes('step:2') && !offered.includes('step:3'));
    assert.ok(!m.goOptions(show2, 1).some((o) => o.value.startsWith('step')), 'one step: nothing to step to');

    /* Wandern: zwischen Szenen ohne Platz; geschrieben nur, wenn es nicht gleitet. */
    assert.equal(m.readPieceValue({ places: { a: {} }, between: 'leave' }).between, 'leave');
    assert.equal(m.readPieceValue({ places: { a: {} }, between: 'jump' }).between, 'glide');
    assert.equal(m.pieceJson(m.readPieceValue({ places: { a: {} } })).between, undefined);

    /* Der Klang: eine Adresse, die er sein darf, eine Lautstärke 0–1; je Szene leiser. */
    const sounding = m.readShow({ scenes: [{ key: 'a', volume: 0.3 }, { key: 'b' }], sound: { url: 'https://example.org/a.mp3', label: 'Ogień', volume: 2 } });
    assert.deepEqual(sounding.sound, { url: 'https://example.org/a.mp3', label: 'Ogień', volume: 1 });
    assert.deepEqual([sounding.scenes[0].volume, sounding.scenes[1].volume], [0.3, null]);
    assert.deepEqual(m.readShow(m.showJson(sounding)), sounding, 'round trip');
    assert.equal(m.readShow({ scenes: [{ key: 'a' }], sound: { url: 'javascript:alert(1)' } }).sound, null, 'a script is no sound');
    assert.equal(m.mediaUrl('page-image:01a15629-8c30-764d-88ad-8cfee5e4f6d9'), 'page-image:01a15629-8c30-764d-88ad-8cfee5e4f6d9');
    assert.equal(m.mediaUrl('data:audio/mp3;base64,AAAA'), null);

    /* Ein Platz mit allem: geschrieben und gelesen — dasselbe. */
    const full = m.readPieceValue({
      places: { a: { x: 20, crop: 'left', mask: { shape: 'ellipse', rx: 50 }, by: 'enter', still: 0.5, frames: [{ at: 0.5, crop: '10% 20%', mask: null, ease: 'out', tall: { y: 30 } }, { step: 1, z: -20 }] } },
      between: 'leave', go: { '*': 'step:1' }
    });
    assert.deepEqual(m.readPieceValue(m.pieceJson(full)), full, 'a place with frames, crop, mask, progress and still: round trip');

    /* Import: was nicht passt, wird gesagt. */
    const now = { path: 'zz/x', title: 't', lead: '', mode: 'presentation', look: m.readLook(null, 'presentation'), parts: [], logic: null, menu: null };
    const bad = m.planImport({
      format: 'recreatio/page', version: 1, mode: 'presentation',
      show: { scenes: [{ key: 'a', steps: 2, volume: 'loud' }, { key: 'b' }], sound: { url: 'ftp://x' } },
      modules: [{ kind: 'image', config: { url: '/a.jpg' }, show: { between: 'jump', places: { a: { crop: 'somewhere', mask: { shape: 'star' }, by: 'later', frames: [{ x: 1 }, { at: 1, ease: 'bounce' }] }, b: { frames: 'none' } } } }]
    }, now, { ...m.DEFAULT_IMPORT, replace: true });
    for (const word of ['"crop"', '"mask"', '"by"', 'brak "at"', '"ease"', '"frames" to nie lista', 'between', '"show.sound"', '"volume"']) {
      assert.ok(bad.warnings.some((w) => w.includes(word)), `reported: ${word} — ${JSON.stringify(bad.warnings)}`);
    }

    /* Die Beschreibung erklärt jeden neuen Schlüssel. */
    const doc = m.pageDescription();
    for (const key of ['"crop" — ', '"mask" — ', '"frames" — ', '"by" — ', '"still" — ', '"between" — ', '"sound" — ', '"volume" — ', '"step:2"', '"*"']) {
      assert.ok(doc.includes(key), `the description explains ${key}`);
    }
    ok('frames: cumulative, holds, eases, steps; progress inside, entering, leaving; still places (steps snap); crop, masks (mix from the whole), tall own values; going and coming back (planes); buttons to a step and on every scene; the sound and its volumes; round trips, warnings, description');
  }

  /* -- 11. Hortus Dei: das Szenario des Konzepts als Import (`fixtures/hortus-dei.json`) -------------- */
  {
    const hortus = JSON.parse(await readFile(join(process.cwd(), 'scripts/fixtures/hortus-dei.json'), 'utf8'));
    const now = { path: 'hortusdei', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null };
    const plan = m.planImport(hortus, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), JSON.stringify(plan));
    assert.deepEqual(plan.warnings, [], 'the scenario imports without a warning');
    assert.equal(plan.mode, 'presentation');
    const show = m.readShow(plan.look.show);
    assert.deepEqual(show.scenes.map((sc) => sc.key), ['ogien', 'ogrod', 'rytm', 'las', 'poczatek', 'dom', 'powrot', 'praktycznie'], 'seven moments and the practical part');
    assert.ok(plan.parts.length <= 60 && plan.parts.length >= 30, `within the limit of 60 modules: ${plan.parts.length}`);
    for (const mod of hortus.modules) assert.ok(JSON.stringify(mod.config).length < 64000, `${mod.id}: under 64 000 characters`);

    const pieces = plan.parts.map((p) => m.readPiece(p.layout));
    for (const sc of show.scenes) assert.ok(sc.steps >= m.stepsNeeded(sc.key, pieces), `${sc.key}: enough steps`);
    assert.deepEqual([...m.reachable(show, pieces)].sort(), show.scenes.map((sc) => sc.key).sort(), 'every scene is on a way');
    for (const piece of pieces) for (const target of Object.values(piece.go)) assert.ok(!m.brokenTarget(show, target), `a button leads somewhere: ${target}`);

    /* Die Fotos: jedes heisst nach seiner Datei, und keine ist darin (sie werden im Editor hochgeladen). */
    const photos = hortus.modules.filter((mod) => mod.kind === 'image');
    assert.deepEqual(photos.map((mod) => /(\d{10})\.jpg/.exec(mod.name)?.[1]).sort(),
      ['1000003240', '1000003284', '1000003288', '1000003290', '1000003297', '1000003305', '1000003341', '1000003831'], 'the eight photos of the concept, each named after its file');
    assert.ok(photos.every((mod) => mod.config.url === undefined && mod.config.alt !== ''), 'no file inside, a description for screen readers');

    /* Das Feuer: eröffnet, geht mit seiner Szene, kommt am Ende wieder — hinter den Texten, das Feuer im Ausschnitt. */
    const fire = m.readPieceValue(hortus.modules.find((mod) => mod.id === 'ognisko').show);
    assert.deepEqual(Object.keys(fire.places), ['ogien', 'powrot']);
    assert.ok(fire.between === 'leave' && fire.layer < 0 && fire.places.ogien.crop === '50% 58%' && fire.places.ogien.frames.length > 0, 'the fire frame');
    const fireEnd = m.placeAt(fire.places.ogien, 1, 2);
    assert.ok(fireEnd.w < 50 && fireEnd.mask?.shape === 'inset', 'it shrinks into a rounded frame within the scene');
    /* Die Wahl auf „rytm": Bild und Name führen zum eigenen Schritt; ohne Geste erzählen die Schritte dasselbe. */
    const choices = pieces.filter((piece) => piece.go.rytm === 'step');
    assert.equal(choices.length, 6, 'three photos and three names are buttons');
    assert.ok(choices.every((piece) => piece.places.rytm.step !== null), 'each has its own step');
    /* Die feste Navigation: auf jeder Szene zum Praktischen. */
    const pill = m.readPieceValue(hortus.modules.find((mod) => mod.id === 'kontakt-pigulka').show);
    assert.deepEqual(pill.go, { '*': 'praktycznie' });
    assert.ok(pill.layer >= 10, 'above every scene');

    const again = m.exportPage({ ...now, title: plan.title, lead: plan.lead ?? '', mode: plan.mode, look: plan.look, parts: plan.parts, logic: null, menu: null, names: plan.names });
    assert.deepEqual(again.show, hortus.show, 'the scenes come out as they went in');
    again.modules.forEach((mod, i) => {
      assert.deepEqual(mod.show, hortus.modules[i].show, `${hortus.modules[i].id}: its places come out as they went in`);
      assert.deepEqual(mod.config, hortus.modules[i].config, `${hortus.modules[i].id}: its content too`);
      assert.equal(mod.name, hortus.modules[i].name, `${hortus.modules[i].id}: and its name`);
    });
    ok(`Hortus Dei: ${hortus.modules.length} modules, ${show.scenes.length} scenes — imports without warning, every scene reachable, the fire leaves and returns, choices step, the pill leads to the practical part; comes out unchanged`);
  }

  /* -- 12. Der Przebieg (2026-10-21) ------------------------------------------------------------- */
  {
    const facts = (over = {}) => ({ values: {}, knowness: () => 0, answered: () => null, visited: new Set(), now: new Date('2026-10-21T12:00:00'), ...over });

    /* Duldsam lesen, knapp schreiben. */
    const raw = {
      base: 'kb-1', storage: 'area-1',
      values: [{ id: 'pkt', label: 'Punkty', start: 1, min: 0, max: 10 }, { id: 'pkt' }, { id: 'zła kennung' }],
      gates: [
        { key: 'g1', type: 'condition', when: { type: 'answered', of: 'q1', correct: true }, yes: 'c', no: 'b' },
        { key: 's1', type: 'set', actions: [{ type: 'add', value: 'pkt', by: 2 }, { type: 'go', step: 'x' }], next: 'gate:g2' },
        { key: 'g2', label: 'Dużo punktów?', type: 'condition', when: { type: 'value', value: 'pkt', op: 'ge', than: 3 }, yes: 'd', no: 'b' },
        { key: 'g1', type: 'set' }
      ]
    };
    const story = m.readStory(raw);
    assert.deepEqual(story.values.map((v) => v.id), ['pkt'], 'values: one per id, valid ids only');
    assert.deepEqual(story.gates.map((g) => g.key), ['g1', 's1', 'g2'], 'gates: one per key');
    assert.deepEqual(story.gates[1].actions.map((a) => a.type), ['add'], 'a set gate changes values, it does not jump');
    assert.deepEqual(m.readStory(m.storyJson(story)), story, 'written as read');
    assert.equal(m.readStory(undefined), null, 'no story: a presentation without logic');

    /* Durch die Tore. */
    assert.equal(m.throughGates(story, 'gate:g1', facts()).target, 'b', 'not answered: "nie"');
    assert.equal(m.throughGates(story, 'gate:g1', facts({ answered: (id) => (id === 'q1' ? 1 : null) })).target, 'c', 'answered right: "tak"');
    assert.equal(m.throughGates(story, 'gate:g1', facts({ answered: (id) => (id === 'q1' ? 0 : null) })).target, 'b', 'answered wrong: "nie"');
    const through = m.throughGates(story, 'gate:s1', facts({ values: m.startValues(story, {}) }));
    assert.deepEqual([through.target, through.values.pkt, through.passed.map((g) => g.key)], ['d', 3, ['s1', 'g2']], 'a value set on the way decides the next gate');
    const capped = m.throughGates(story, 'gate:s1', facts({ values: { pkt: 9 } }));
    assert.equal(capped.values.pkt, 10, 'within the value\'s limits');
    const loop = m.readStory({ gates: [{ key: 'o', type: 'set', next: 'gate:o' }] });
    assert.equal(m.throughGates(loop, 'gate:o', facts()).target, null, 'a circle of gates ends nowhere');
    assert.equal(m.throughGates(story, 'c', facts()).target, 'c', 'a scene is no gate');

    /* Der Weg durch die Tore: „dalej" von a geht durch g1. */
    const scenes = ['a', 'b', 'c', 'd'].map((key, i) => ({ key, label: key.toUpperCase(), steps: 1, ...(key === 'a' ? { next: 'gate:g1' } : {}) }));
    const show = m.readShow({ scenes, story: raw });
    assert.deepEqual(m.storyChain(show, show.story, 'a', facts()).map((s) => s.key), ['a', 'b', 'c', 'd'], 'not answered: via B');
    assert.deepEqual(m.storyChain(show, show.story, 'a', facts({ answered: () => 1 })).map((s) => s.key), ['a', 'c', 'd'], 'answered right: straight to C');
    const viaSet = m.readShow({ scenes: scenes.map((sc) => (sc.key === 'a' ? { ...sc, next: 'gate:s1' } : sc)), story: raw });
    const chain = m.storyChain(viaSet, viaSet.story, 'a', facts({ values: m.startValues(viaSet.story, {}) }));
    assert.deepEqual(chain.map((s) => [s.key, s.via.map((g) => g.key)]), [['a', []], ['d', ['s1']]], 'the set gate on the way counts when D is reached');
    assert.deepEqual(m.resolveTarget(show, 'gate:g1'), { kind: 'gate', key: 'g1' }, 'a gate is a target');
    assert.equal(m.resolveTarget(show, 'gate:nope').kind, 'none', 'a gate that is gone is no target');
    assert.ok(m.targetOptions(show).some((o) => o.value === 'gate:g2' && o.label.includes('Dużo punktów?')), 'gates are offered as targets');
    assert.deepEqual([...m.reachable(viaSet, [])].sort(), ['a', 'b', 'c', 'd'], 'reachable over both sides of a condition (C behind B)');

    /* Fragen: dobrze / źle je Szene, am Baustein. */
    const question = m.readPieceValue({ places: { a: { x: 50, y: 50 } }, go: { [m.outcomeKey('a', 'right')]: 'c', [m.outcomeKey('a', 'wrong')]: 'gate:g1' } });
    assert.deepEqual([m.outcomeTarget(question, 'a', 'right'), m.outcomeTarget(question, 'a', 'wrong'), m.outcomeTarget(question, 'b', 'right')], ['c', 'gate:g1', null], 'outcome exits per scene, none elsewhere');
    assert.ok(m.isOutcomeKey('a:right') && !m.isOutcomeKey('a') && !m.isOutcomeKey('*'), 'an outcome exit is no button');
    assert.ok(m.reachable(m.readShow({ scenes: scenes.map((sc) => ({ ...sc, next: sc.key === 'a' ? 'end' : undefined })) }), [question]).has('c'), 'a scene behind an answer is reachable');

    /* Die Seite als JSON trägt den Przebieg unverändert. */
    assert.deepEqual(m.readShow(m.showJson(show)).story, show.story, 'show JSON keeps the story');
    ok('story: values, gates (condition, set), answers right / wrong, the way through the gates with what the learner knows, JSON');

    /* -- 13. Schritt 12: das Storyboard IST ein Ablauf (look `scenes`) — beide Motoren gehen dieselben Szenen. ---------------- */
    const sceneOf = (state) => (state.ended || state.step === null ? 'END' : state.step.startsWith('s:') ? state.step.slice(2) : state.step);
    const asFlow = (sh, pcs) => {
      const made = m.storyToFlow(sh, pcs, 'parafia/opowiesc');
      return m.readFlow('f', { name: 'Opowieść', look: 'scenes', start: made.start, graph: made.graph });
    };
    /* Der Weg „dalej" entlang, im Motor der Abläufe: bis zum Ende oder bis eine Szene wartet (eine Frage). */
    const flowChain = (flow, sh, from, f, waits = new Set()) => {
      const ctx = { facts: (state) => ({ ...f, values: state.values }), flows: () => undefined, members: () => [], limits: m.limitsOf(sh.story) };
      let state = m.startFlow(flow, f.values ?? {}, m.sceneNode(from));
      const out = [];
      for (let guard = 0; guard < 40 && !state.ended && state.step !== null; guard += 1) {
        const key = sceneOf(state);
        if (out.includes(key)) break;
        out.push(key);
        if (waits.has(key)) break;
        state = m.advance(flow, state, 'next', ctx);
      }
      return { keys: out, state, ctx };
    };
    for (const [label, f] of [['not answered', facts()], ['answered right', facts({ answered: () => 1 })]]) {
      const presentation = m.storyChain(show, show.story, 'a', f).map((x) => x.key);
      const flow = flowChain(asFlow(show, []), show, 'a', f).keys;
      assert.deepEqual(flow, presentation, `${label}: the flow engine walks the storyboard to the same scenes`);
    }
    const viaFlow = flowChain(asFlow(viaSet, []), viaSet, 'a', facts({ values: m.startValues(viaSet.story, {}) }));
    assert.deepEqual([viaFlow.keys, viaFlow.state.values.pkt], [['a', 'd'], 3], 'a set gate as a "set" step: the value changes on the way and decides the condition');
    /* Eine Frage auf B: dobrze → D, źle → zurück zu A; ein Knopf auf C führt hinaus (ein Weg). */
    const qPiece = { key: 'p-q', kind: 'question', label: 'Pytanie', piece: m.readPieceValue({ places: { b: { x: 50, y: 50 } }, go: { [m.outcomeKey('b', 'right')]: 'd', [m.outcomeKey('b', 'wrong')]: 'a' } }) };
    const bPiece = { key: 'p-b', kind: 'text', label: 'Do kontaktu', piece: m.readPieceValue({ places: { c: { x: 10, y: 10 } }, go: { c: 'link:kontakt' } }) };
    const withQ = m.readShow({ scenes: scenes.map((sc) => ({ ...sc, next: undefined })), links: [{ id: 'kontakt', label: 'Kontakt', href: '#/kontakt' }] });
    const qFlow = asFlow(withQ, [qPiece, bPiece]);
    const bNode = qFlow.graph.nodes.find((n) => n.id === m.sceneNode('b'));
    assert.deepEqual(m.exitsOf('scene', bNode.config).map((x) => x.id), ['next', 'right', 'wrong'], 'a scene with a question has the outcomes as exits');
    const cNode = qFlow.graph.nodes.find((n) => n.id === m.sceneNode('c'));
    assert.deepEqual([m.exitsOf('scene', cNode.config).map((x) => x.id), cNode.config.buttons[0].target], [['next', 'b0'], 'link:kontakt'], 'a button is an exit to its target');
    assert.deepEqual(flowChain(qFlow, withQ, 'a', facts(), new Set(['b'])).keys, m.storyChain(withQ, { values: [], gates: [], base: '', storage: '' }, 'a', facts(), new Set(), new Set(['b'])).map((x) => x.key), 'a question scene waits in both engines');
    const ctxQ = { facts: () => facts(), flows: () => undefined, members: () => [] };
    const atB = m.startFlow(qFlow, {}, m.sceneNode('b'));
    assert.deepEqual([sceneOf(m.advance(qFlow, atB, 'right', ctxQ)), sceneOf(m.advance(qFlow, atB, 'wrong', ctxQ))], [m.outcomeTarget(qPiece.piece, 'b', 'right'), m.outcomeTarget(qPiece.piece, 'b', 'wrong')], 'answers lead where the question says, in both');
    const out = m.advance(qFlow, m.startFlow(qFlow, {}, m.sceneNode('c')), 'b0', ctxQ);
    assert.ok(out.ended && qFlow.graph.nodes.find((n) => n.id === 'l:kontakt')?.config.link === 'kontakt', 'a way out is an end that keeps its link');
    assert.equal(qFlow.graph.nodes.find((n) => n.id === m.sceneNode('a')).config.page, 'parafia/opowiesc', 'a scene step names its page');

    /* Erzähler nach Werten. */
    const told = m.readFlow('n', { name: 'x', narrators: [{ character: 'piotr', condition: { type: 'value', value: 'przewodnik', op: 'eq', than: 1 } }, { character: 'maria' }, { character: '' }] });
    assert.deepEqual([told.narrators.length, m.narratorNow(told, facts({ values: { przewodnik: 1 } }))?.character, m.narratorNow(told, facts({ values: { przewodnik: 2 } }))?.character], [2, 'piotr', 'maria'], 'the first narrator whose condition holds tells the step');
    assert.equal(m.readFlow('p', { name: 'x', look: 'scenes', presentation: '#/parafia/opowiesc' }).presentation, 'parafia/opowiesc', 'a flow points at its presentation by path');
    ok('one narrative: the storyboard is a flow in look "scenes" — both engines walk the same scenes (gates, values, questions waiting and their outcomes, buttons, ways out); narrators by values');
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
