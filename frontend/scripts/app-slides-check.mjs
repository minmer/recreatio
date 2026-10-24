/**
 * SLAJDY (0062, 0084, 0107) — was ohne Browser nachzumessen ist.
 *
 *   1. Die Schichten der Luft: Vorgaben des Altbestands, `motion: []` bleibt still.
 *   2. Der Slajd: Bewegung, Aufbau, Begleiter, neue Kennungen nach dem Import;
 *      der Wechsel „dissolve"; Plätze für hohe Schirme und eine Grenze in rem;
 *      das gemeinsame Tuch blendet von Slajd zu Slajd.
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
export { readLayers, layerJson, layersJson, readLook, writeLook, readDeck, deckJson, NO_DECK } from '${app}pages/slides/slideLook';
export { motionOf, frameAt, backdropAt, deckAt, DISSOLVE, STILL } from '${app}pages/slides/slideMotion';
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

    /* Das Tuch: der jetzige unten, der nächste blendet darüber ein; ohne eigenes blendet der jetzige aus. */
    assert.deepEqual(m.backdropAt([true, true, false, true], 0), [{ index: 0, opacity: 1 }]);
    assert.deepEqual(m.backdropAt([true, true, false, true], 0.5), [{ index: 0, opacity: 1 }, { index: 1, opacity: 0.5 }]);
    assert.deepEqual(m.backdropAt([true, true, false, true], 1.5), [{ index: 1, opacity: 0.5 }], 'the next has none: this one fades');
    assert.deepEqual(m.backdropAt([true, true, false, true], 2.5), [{ index: 3, opacity: 0.5 }], 'from nothing: the next fades in');
    ok('slides: motion, layout (and tall), companions (remapped), dissolve (both at once, 12 px, 2 px), tall places with a cap, the backdrop crossfade');
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
    try {
      html = m.renderToStaticMarkup(m.createElement(m.PageSlides, { parts: plan.parts, look: plan.look, title: plan.title ?? 'Pokaz', lead: null, embedded: true }));
    } finally {
      console.error = said;
    }
    assert.ok(html.includes('wk-deck-backdrop'), 'the shared backdrop is drawn');
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
