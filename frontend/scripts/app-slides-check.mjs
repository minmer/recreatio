/**
 * SLAJDY (0062, 0084, 0107) — was ohne Browser nachzumessen ist.
 *
 *   1. Die Schichten der Luft: Vorgaben des Altbestands, `motion: []` bleibt still.
 *   2. Der Slajd: Bewegung, Aufbau, Begleiter, neue Kennungen nach dem Import;
 *      der Wechsel „dissolve"; Plätze für hohe Schirme und eine Grenze in rem;
 *      2026-10-25 der Slajd als Blatt (`slideSheets`): Schnitte, Przenikanie nach
 *      der Deckung des neuen, Schichten mit der Bahn, nichts bleibt zurück.
 *   3. Die Folge als Ganzes (deck): lesen, knapp schreiben, im Aussehen der Seite.
 *   4. Ein Dokument mit Slajdy: ein wanderndes Zeichen, ein Bild neben seinem
 *      Text, das Tuch — importiert ohne Warnung, kommt unverändert heraus, und
 *      der Server zeichnet es.
 *
 * Die Wörter der Bewegung, die Zeichnungen und der Pokaz von Cogita (seit 0108
 * eine Präsentation): `app-motion-check.mjs`.
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-slides-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { readSlideValue, slideJson, remapSlide, frameFor, layoutFor } from '${app}pages/slides/slides';
export { readLayers, layerJson, layersJson, readLook, writeLook, readDeck, deckJson, NO_DECK, defaultLayers, resolveTheme } from '${app}pages/slides/slideLook';
export { motionOf, frameAt, backdropAt, deckAt, DISSOLVE, STILL } from '${app}pages/slides/slideMotion';
export { sheetsAt, layerPlace, layerCover } from '${app}pages/slides/slideSheets';
export { seeded, waves, meshMotions, layerBackground, layerPaint } from '${app}pages/presentation/deckLayers';
export { planImport, exportPage, DEFAULT_IMPORT } from '${app}pages/pageJson';
export { pageDescription } from '${app}pages/pageJsonText';
export { PageSlides, deckParts } from '${app}pages/slides/PageSlides';
export { onAccent } from '${app}pages/slides/SlideDeck';
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

  /* -- 1. Die Luft ------------------------------------------------------------------------------- */
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

  /* -- 2. Der Slajd ----------------------------------------------------------------------------- */
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

    /* 2026-10-24 — Przepływ: beide fahren mit der Bahn (nicht festgehalten) und blenden dabei über. */
    const flowIn = m.motionOf(frames, 1, half, 800, ['scroll', 'flow']);
    const flowOut = m.motionOf(frames, 0, half, 800, ['scroll', 'flow']);
    assert.ok(!flowIn.pin && !flowOut.pin, 'flow: both move up with the track');
    assert.ok(close(flowIn.opacity, 0.5) && close(flowOut.opacity, 0.5), 'flow: and cross half way');
    assert.ok(m.motionOf(frames, 1, half, 800, ['scroll', 'flow'], true).pin, 'flow, less motion: a plain fade in place');

    /* Plätze: auf einem hohen Schirm andere, eine Grenze in rem, die mitgleitet. */
    const places = new Map([[0, { x: 70, y: 50, w: 44, scale: 1.08, rotate: 0, opacity: 1, max: 32.5, tall: { x: 30, y: 15, w: 50 } }], [1, { x: 16, y: 50, w: 44, scale: 0.5, rotate: 0, opacity: 0.82, max: 32.5 }]]);
    assert.equal(m.frameAt(places, 0, true).x, 30, 'tall: its own place');
    assert.equal(m.frameAt(places, 0, false).x, 70);
    assert.equal(m.frameAt(places, 0.5, false).max, 32.5, 'the cap travels');
    assert.ok(close(m.frameAt(places, 0.5, false).scale, 0.79), 'half way between ×1.08 and ×0.5');

    /* Das Tuch der Präsentation (Szenen): der jetzige unten, der nächste blendet darüber ein; ohne eigenes blendet der jetzige aus.
       Slajdy nutzen es seit 2026-10-25 nicht mehr — ihre Schichten liegen in ihrem Abschnitt (slideSheets). */
    assert.deepEqual(m.backdropAt([true, true, false, true], 0), [{ index: 0, opacity: 1 }]);
    assert.deepEqual(m.backdropAt([true, true, false, true], 0.5), [{ index: 0, opacity: 1 }, { index: 1, opacity: 0.5 }]);
    assert.deepEqual(m.backdropAt([true, true, false, true], 1.5), [{ index: 1, opacity: 0.5 }], 'the next has none: this one fades');
    assert.deepEqual(m.backdropAt([true, true, false, true], 2.5), [{ index: 3, opacity: 0.5 }], 'from nothing: the next fades in');
    ok('slides: motion, layout (and tall), companions (remapped), dissolve (both at once, 12 px, 2 px), tall places with a cap, the scenes’ backdrop crossfade');
  }

  /* -- 2026-10-25: ein Slajd ist ein Blatt — er nimmt seine Schichten oben mit hinaus (slideSheets) ------------- */
  {
    const vh = 800;
    const F = [{ start: 0, height: 800 }, { start: 800, height: 800 }, { start: 1600, height: 1200 }];
    const at = (p, kinds, cover = [], reduced = false) => m.sheetsAt(F, p, vh, kinds, cover, reduced);
    const KINDS = ['scroll', 'flow', 'fade', 'cover', 'reveal', 'zoom', 'side', 'dissolve'];
    const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
    const topOf = (k, s) => F[k].start - s.pinned + s.motion.lift;

    /* Przewinięcie: beide fahren mit der Bahn, aneinander — nichts zu schneiden. */
    const scroll = at(400, ['scroll', 'scroll', 'scroll']);
    assert.ok(scroll[0].cut === null && scroll[1].cut === null && !scroll[0].motion.pin && !scroll[1].motion.pin, 'scroll: nothing cut, nothing pinned');
    assert.deepEqual([topOf(0, scroll[0]), topOf(1, scroll[1])], [-400, 400], 'scroll: the old above, the new below, touching');

    /* Odsłonięcie: der alte fährt hinauf, der neue steht — von ihm nur, was unter dem alten liegt. */
    const reveal = at(400, ['scroll', 'reveal', 'scroll']);
    assert.ok(reveal[0].motion.above && reveal[1].motion.pin);
    assert.deepEqual(reveal[1].cut, { top: 400, bottom: 0, right: 0 }, 'reveal: uncovered only below the leaving one');
    assert.equal(at(720, ['scroll', 'reveal', 'scroll'])[1].cut.top, 80, 'the uncovered part grows as the old one goes up');
    assert.ok(near(at(0.25, ['scroll', 'reveal', 'scroll'])[1].cut.top, 799.75), 'at the very start only what the old one has uncovered');
    assert.ok(at(0, ['scroll', 'reveal', 'scroll'])[1].cut === null && at(800, ['scroll', 'reveal', 'scroll'])[1].cut === null, 'before and after: nothing cut');

    /* Nakrycie: der neue kommt über den stehenden alten (der kleiner wird) — vom alten nur, was darüber liegt, in seinen Massen. */
    assert.ok(near(at(400, ['scroll', 'cover', 'scroll'])[0].cut.bottom, 400), 'cover: the old one cut where the new one lies');
    const deeper = at(600, ['scroll', 'cover', 'scroll']);
    const visibleEnd = topOf(0, deeper[0]) + 400 + (800 - deeper[0].cut.bottom - 400) * deeper[0].motion.scale;
    assert.ok(near(deeper[0].cut.bottom, 610.6649111257407, 1e-6) && near(visibleEnd, topOf(1, deeper[1]), 1e-6), `cut in the shrunk old one’s own measure — its visible end is the new one’s top (${deeper[0].cut.bottom})`);
    assert.ok(near(at(799.9, ['scroll', 'cover', 'scroll'])[0].cut.bottom, 800, 1e-3), 'just before arriving: all of it covered');
    const tallOld = m.sheetsAt([{ start: 0, height: 1200 }, { start: 1200, height: 800 }], 800, vh, ['scroll', 'cover']);
    assert.ok(tallOld[0].pinned === 400 && near(tallOld[0].cut.bottom, 400), `a tall old one: its last screen, cut under the new one (${JSON.stringify(tallOld[0].cut)})`);

    /* Z boku: der neue von rechts über den alten, der nach links weicht. */
    assert.ok(near(at(400, ['scroll', 'side', 'scroll'])[0].cut.right, 32.5), 'side: the old one shows only left of the new one');

    /* Was sich nur berührt oder überblendet, schneidet nicht. */
    for (const kind of ['scroll', 'flow', 'fade', 'zoom', 'dissolve']) {
      const w = at(400, ['scroll', kind, 'scroll']);
      assert.ok(w[0].cut === null && w[1].cut === null, `${kind}: nothing cut`);
    }

    /* Przenikanie: der alte steht, solange der neue ganz deckt; sonst bleibt von ihm genau 1 − e. */
    const fadeOld = (p, cover) => at(p, ['scroll', 'fade', 'scroll'], cover)[0].motion.opacity;
    assert.deepEqual([fadeOld(400, [1, 1, 1]), fadeOld(400, [])], [1, 1], 'fade over a covering one: the old one stands (0084)');
    assert.ok(near(fadeOld(400, [1, 0, 1]), 0.5) && near(fadeOld(400, [1, 0.45, 1]), 0.5 / 0.775), 'fade over a see-through one: exactly 1 − e of the old one left');
    assert.ok(fadeOld(799.99, [1, 0.45, 1]) < 1e-6 && fadeOld(0.01, [1, 0, 1]) > 0.999999, 'nothing left at the end, all of it at the start');
    assert.ok(near(at(400, ['scroll', 'zoom', 'scroll'], [1, 0, 1])[0].motion.opacity, 0.5), 'zoom: fades anyway');
    /* Weniger Bewegung: alles wird Przenikanie — nichts geschnitten, beide stehen, der alte unter einem durchsichtigen blendet aus. */
    for (const kind of ['reveal', 'cover', 'side']) {
      const w = at(400, ['scroll', kind, 'scroll'], [1, 0, 1], true);
      assert.ok(w[0].cut === null && w[1].cut === null && w[0].motion.pin && w[1].motion.pin && near(w[0].motion.opacity, 0.5), `${kind}, less motion: a fade in place`);
    }

    /* Jeder Wechsel, mit jedem Stapel: angekommen ist vom alten nichts mehr zu sehen — vorwärts, rückwärts, auf einen hohen. */
    /* Zu sehen: mehr als ein halbes Pixel hoch, ein halbes Prozent breit, mit Deckkraft — unter einem überblendenden so weit, wie der es nicht bedeckt. */
    const seen = (k, s, other, cover) => {
      const top = topOf(k, s);
      const shown = Math.min(top + F[k].height - (s.cut?.bottom ?? 0), vh) - Math.max(top + (s.cut?.top ?? 0), 0);
      const wide = Math.min(100, s.motion.shift + 100 - (s.cut?.right ?? 0)) - Math.max(0, s.motion.shift);
      const opacity = s.motion.opacity * (other === undefined ? 1 : 1 - cover * other.motion.opacity);
      return shown > 0.5 && wide > 0.5 && opacity > 0.01;
    };
    for (const kind of KINDS) {
      for (const cover of [[1, 0, 1], [1, 1, 1], [1, 0.45, 1]]) {
        const crossfade = ['fade', 'zoom', 'dissolve'].includes(kind);
        const end = at(799.99, ['scroll', kind, 'scroll'], cover);
        assert.ok(!seen(0, end[0], crossfade ? end[1] : undefined, cover[1]), `${kind} (${cover}): arrived, nothing of the old one`);
        const back = at(0.01, ['scroll', kind, 'scroll'], cover);
        assert.ok(!seen(1, back[1], undefined, 0), `${kind} (${cover}): back on the first, nothing of the second`);
        const tall = at(1599.99, ['scroll', 'scroll', kind], cover);
        assert.ok(!seen(1, tall[1], crossfade ? tall[2] : undefined, cover[2]), `${kind} (${cover}): arrived at a tall one, nothing of the old one`);
        const mid = at(1200, ['scroll', 'scroll', kind], cover);
        assert.ok(seen(1, mid[1], undefined, 0) && seen(2, mid[2], undefined, 0), `${kind} (${cover}): mid-way both are there`);
      }
    }

    /* Die Schichten: auf dem Schirm −Tempo × Weg — ob der Slajd fährt oder steht (nichts friert ein), stetig beim Ankommen. */
    const screen = (k, s, place) => topOf(k, s) + place.top;
    const moving = at(400, ['scroll', 'scroll', 'scroll'])[1];
    const pinnedB = (p) => at(p, ['scroll', 'reveal', 'scroll'])[1];
    const placeAt = (s, p, speed = 0.5, bigtext = false) => m.layerPlace(speed, bigtext, F[1], s.pinned, p, vh);
    assert.equal(screen(1, moving, placeAt(moving, 400)), -200, 'moving: −0.5 × 400 on the screen');
    assert.equal(placeAt(moving, 400).height, 1600, 'taller by its tempo over the whole way');
    assert.deepEqual([screen(1, pinnedB(400), placeAt(pinnedB(400), 400)), screen(1, pinnedB(500), placeAt(pinnedB(500), 500))], [-200, -250], 'pinned: it keeps drifting with the track');
    const rest = at(800, ['scroll', 'reveal', 'scroll'])[1];
    assert.equal(screen(1, rest, placeAt(rest, 800)), -400, 'and arrives where it rests — no jump');
    for (const p of [400, 800, 1200]) {
      const s = at(p, ['scroll', 'scroll', 'scroll'])[1];
      assert.ok(near(placeAt(s, p, 0.34).top, (s.pinned - 800) * (1 - 0.34) - 0.34 * vh), `unpinned: as before 2026-10-25 (${p})`);
    }
    assert.deepEqual(m.layerPlace(0.5, false, F[1], -2000, -2000, vh), m.layerPlace(0.5, false, F[1], -900, -900, vh), 'off the screen: nothing changes');
    const word = placeAt(moving, 400, 0.6, true);
    assert.ok(screen(1, moving, word) === 0 && near(word.shift, 120), 'a big word: its plane stands on the screen, it wanders by its way');
    assert.deepEqual([m.layerPlace(0.5, false, F[2], 1600, 1600, vh, true), m.layerPlace(0.6, true, F[2], 1600, 1600, vh, true)], [{ top: 0, height: 1200, shift: 0 }, { top: 0, height: 800, shift: 0 }], 'less motion: the layer covers its whole slide and goes with it');
    /* Jede Schicht bedeckt, was von ihrem Slajd zu sehen ist — jede Art, jedes Tempo, über die ganze Folge. */
    for (const kind of KINDS) {
      for (let p = 0; p <= 2000; p += 7.3) {
        const sheets = at(p, ['scroll', kind, kind]);
        sheets.forEach((s, k) => {
          const top = topOf(k, s);
          const from = Math.max(s.cut?.top ?? 0, -top);
          const to = Math.min(F[k].height - (s.cut?.bottom ?? 0), vh - top);
          if (to <= from) return;
          for (const speed of [0, 0.05, 0.12, 0.34, 0.5, 1]) {
            const place = m.layerPlace(speed, false, F[k], s.pinned, p, vh);
            assert.ok(place.top <= from + 1e-6 && place.top + place.height >= to - 1e-6, `${kind} @${p} slide ${k} speed ${speed}: the layer covers what shows (${place.top}…${place.top + place.height} vs ${from}…${to})`);
          }
        });
      }
    }

    /* Wie viel ein Stapel deckt. */
    const g = (from, to, via = null) => ({ kind: 'gradient', speed: 0, angle: 0, from, via, to });
    const img = (opacity, blend = 'normal', url = 'x.jpg') => ({ kind: 'image', speed: 0, url, opacity, blend, position: 'center' });
    const glow = { kind: 'glow', speed: 0, color: 'rgba(0,0,0,.2)', x: 50, y: 50, size: 60, opacity: 1, blend: 'normal' };
    const big = { kind: 'bigtext', speed: 0, lines: ['A'], opacity: 1, color: null };
    assert.deepEqual([
      m.layerCover([]), m.layerCover([g('#000000', '#ffffff')]), m.layerCover([g('ground', 'accent', 'ink')]), m.layerCover([g('rgba(0, 0, 0, 1)', '#fff')]),
      m.layerCover([g('transparent', '#fff')]), m.layerCover([g('rgba(0,0,0,0.4)', '#fff')]), m.layerCover([g('#00000080', '#fff')]), m.layerCover([g('hsl(0 0% 0% / 50%)', '#fff')]),
      m.layerCover([img(0.45)]), m.layerCover([img(1)]), m.layerCover([img(1, 'normal', ' ')]), m.layerCover([glow, big, img(0.76, 'multiply')]), m.layerCover([glow, big, img(0.45)])
    ].map((x) => Math.round(x * 1000) / 1000), [0, 1, 1, 1, 0, 0, 0, 0, 0.45, 0.98, 0, 0, 0.45]);
    assert.ok(near(m.layerCover([img(0.45), img(0.5)]), 0.725), 'two photos: 1 − .55 × .5');
    assert.ok(m.layerCover(m.defaultLayers('X', m.resolveTheme(null, true))) === 1 && m.layerCover(m.defaultLayers('X', m.resolveTheme(null, false))) === 1, 'a slide without layers of its own (no cloth) covers');
    ok('slides as sheets (2026-10-25): reveal uncovers below the leaving one, cover and side cut the covered one (also a tall one), fade over a see-through one leaves exactly 1 − e, less motion fades in place; every kind × every stack leaves nothing behind (forward, back, tall); layers drift with the track even while pinned, arrive without a jump, cover what shows; stacks: how much they cover');
  }

  /* -- 3. Die Folge -------------------------------------------------------------------------- */
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

  /* -- 4. Ein Dokument mit Slajdy ---------------------------------------------------------------- */
  {
    const hero = (headline, href) => ({ badge: 'Pokaz', badgeLook: 'kicker', size: 'title', headline, paragraphs: ['Jedna linia.'], actions: [{ label: 'Dalej', href, variant: 'cta' }] });
    const doc = {
      format: 'recreatio/page', version: 1, path: 'pokaz', title: 'Pokaz', lead: null, mode: 'slides',
      theme: { mode: 'dark', accent: '#7ec8ff', ink: '#f4f7fb', ground: '#06162a', muted: '#bcc8d9' },
      cover: [],
      deck: { backdrop: [{ kind: 'vignette', speed: 0, strength: 0.35, reach: 55, color: '#000000' }, { kind: 'mesh', speed: 0, seed: 2026, motion: { name: 'sway' } }], nav: 'dots', titleSlide: false, width: 80 },
      modules: [
        {
          id: 'znak', kind: 'layers', size: { colSpan: 3, rowSpan: 3 },
          slide: { label: 'Znak', layers: [], stage: { frames: { wejscie: { x: 70, y: 50, w: 44, scale: 1.08 }, mapa: { x: 16, y: 50, w: 44, scale: 0.5, opacity: 0.82 } }, bare: true } },
          config: { alt: 'Znak', layers: [{ url: '/cogita/logo/Cogita00.png', motion: { name: 'float', x: 4, y: 6 } }, { url: '/cogita/logo/Cogita12.png', motion: { name: 'assemble', delay: 90 } }] }
        },
        {
          id: 'wejscie', kind: 'hero', size: { colSpan: 6, rowSpan: 3 },
          slide: { label: 'Wejście', layers: [{ kind: 'gradient', speed: 0, angle: 180, from: '#06162a', via: '#0c2d49', to: '#0a1c2f' }], transition: 'dissolve', colors: { ground: '#06162a' } },
          config: hero('Wiedza żyje w rozmowie.', '#mapa')
        },
        {
          id: 'mapa', kind: 'hero', size: { colSpan: 6, rowSpan: 3 },
          slide: { label: 'Mapa', layers: [], transition: 'dissolve', motion: { name: 'rise', delay: 1000 }, layout: { align: 'end', width: 69, tall: { width: 100 } } },
          config: hero('Mapa wiedzy', '#wejscie')
        },
        {
          id: 'mapa-obraz', kind: 'animation', size: { colSpan: 3, rowSpan: 3 },
          slide: { label: 'Mapa — obraz', layers: [], with: { slide: 'mapa', side: 'end', share: 44, tallSide: 'start' } },
          config: { alt: 'Kropka w drodze', size: [200, 120], elements: [{ type: 'circle', x: 20, y: 100, r: 6, fill: 'accent', motion: { name: 'move', path: [[0, 0], [160, -80]], duration: 2400, repeat: 'loop' } }] }
        }
      ]
    };
    const empty = { path: 'zz-probe/pokaz', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null };
    const plan = m.planImport(doc, empty, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), JSON.stringify(plan));
    assert.deepEqual(plan.warnings, [], 'the document imports without a single warning');
    assert.equal(plan.mode, 'slides');
    assert.deepEqual([plan.look.deck.nav, plan.look.deck.titleSlide, plan.look.deck.backdrop.length], ['dots', false, 2]);
    const idOf = new Map(doc.modules.map((one, i) => [one.id, plan.parts[i].id]));
    assert.deepEqual(Object.keys(plan.parts[0].layout.slide.stage.frames).sort(), [idOf.get('wejscie'), idOf.get('mapa')].sort(), 'the sign\'s places follow the new ids');
    assert.equal(plan.parts[3].layout.slide.with.slide, idOf.get('mapa'), 'the picture stays beside its text');

    const { own, stage, beside } = m.deckParts(plan.parts);
    assert.deepEqual([own.length, stage.length, [...beside.values()].flat().length], [2, 1, 1], 'two slides, one sign on the stage, one picture beside its text');

    const now = { ...empty, title: plan.title, mode: plan.mode, look: plan.look, parts: plan.parts };
    const out = JSON.parse(JSON.stringify(m.exportPage(now)));
    assert.deepEqual(out.theme, doc.theme);
    assert.deepEqual(out.deck, m.deckJson(m.readDeck(doc.deck)), 'the deck comes out as it went in');
    const back = new Map([...idOf].map(([a, b]) => [b, a]));
    const swap = (value) => JSON.parse(JSON.stringify(value).replace(/"([0-9a-f-]{36})"/g, (all, id) => (back.has(id) ? `"${back.get(id)}"` : all)));
    out.modules.forEach((one, i) => assert.deepEqual(swap(one.slide), m.slideJson(m.readSlideValue(doc.modules[i].slide)), `${doc.modules[i].id}: slide unchanged`));
    const again = m.planImport(out, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.deepEqual(again.warnings, []);
    assert.deepEqual(again.parts.map((p) => p.layout.slide), plan.parts.map((p) => p.layout.slide), 'export → import changes nothing');

    const words = m.pageDescription();
    for (const key of ['"deck" — ', '"dissolve"', '"flow" (przepływ', '"motion" — ', '"layout" — ', '"with" — ', '"kind": "mesh"', '"kind": "waves"', '"kind": "haze"', '"kind": "glow"', '"kind": "vignette"', '## Ruch', '"tall" — inne wartości']) {
      assert.ok(words.includes(key), `the description explains ${key}`);
    }
    const bad = m.planImport({ ...doc, deck: { ...doc.deck, nav: 'wiggle', backdrop: [{ kind: 'nebula' }] }, modules: [{ kind: 'text', slide: { label: 'x', layers: [], motion: 'shake' }, config: { body: 'x' } }] }, empty, m.DEFAULT_IMPORT);
    assert.ok(bad.warnings.some((w) => w.includes('wiggle')) && bad.warnings.some((w) => w.includes('nebula')) && bad.warnings.some((w) => w.includes('shake')), 'unknown bars, layers and motions are reported');

    /* Der Server kennt keine Layout-Effekte (der Antrieb misst damit) — diese eine Warnung ist hier kein Fehler. */
    const said = console.error;
    console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) said(...args); };
    let html = '';
    let bare = '';
    try {
      html = m.renderToStaticMarkup(m.createElement(m.PageSlides, { parts: plan.parts, look: plan.look, title: plan.title ?? 'Pokaz', lead: null, embedded: true }));
      const plainLook = { ...plan.look, deck: { ...plan.look.deck, backdrop: [] } };
      bare = m.renderToStaticMarkup(m.createElement(m.PageSlides, { parts: plan.parts, look: plainLook, title: plan.title ?? 'Pokaz', lead: null, embedded: true }));
    } finally {
      console.error = said;
    }
    /* 2026-10-25 — ein Slajd ist ein Blatt: seine Schichten in seinem Abschnitt; das Tuch als erstes in der Bahn. */
    const sectionOf = (markup, label) => { const from = markup.indexOf(`aria-label="${label}"`); return markup.slice(from, markup.indexOf('</section>', from)); };
    assert.ok(/<div class="wk-deck-track"[^>]*><div class="wk-deck-backdrop"/.test(html), 'the shared backdrop is drawn — the first thing in the track');
    assert.equal((html.match(/class="wk-deck-layer is-[a-z]+ is-shared/g) ?? []).length, 2, 'with its two layers');
    assert.ok(sectionOf(html, 'Wejście').includes('wk-deck-layer is-gradient'), 'the own gradient lies in its slide');
    assert.ok(!sectionOf(html, 'Mapa').includes('wk-deck-layer'), 'a slide without layers of its own lets the cloth through');
    /* Ohne Tuch (wie immer): kein Tuch; die eigenen Schichten, sonst der Grund und der Name. */
    assert.ok(!bare.includes('wk-deck-backdrop'), 'plain: no cloth');
    assert.ok(sectionOf(bare, 'Wejście').includes('wk-deck-layer is-gradient'), 'plain: the own gradient in its slide');
    assert.ok(sectionOf(bare, 'Mapa').includes('wk-deck-layer is-gradient') && sectionOf(bare, 'Mapa').includes('>MAPA<'), 'plain: a slide without layers gets the ground and its name');
    assert.equal((bare.match(/class="wk-deck-slide/g) ?? []).length, 2);
    assert.ok(html.includes('wk-deck-dots'), 'dots instead of names');
    assert.equal((html.match(/class="wk-deck-slide/g) ?? []).length, 2, 'two slides — no title slide');
    assert.ok(html.includes('wk-deck-row') && html.includes('<svg class="dr"'), 'the drawing beside its text');
    assert.ok(html.includes('wk-layers'), 'the sign of layers');
    assert.ok(html.includes('Wiedza żyje w rozmowie.'), 'the text');
    ok('a slides document: imports without a warning, the sign and the picture follow the new ids, comes out unchanged; the server draws backdrop, dots, slides, the drawing beside its text, the sign');
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
