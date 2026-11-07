/**
 * 2026-11-06 — WYGLĄD: der Entwurf einer Seite (`pages/pageStyle.ts`) und die Farbfamilien des Arbeitsplatzes
 * (`core/theme.ts`) — was ohne Browser nachzumessen ist.
 *
 *   1. Der Arbeitsplatz: eine Wahl wird duldsam gelesen, Unsinn wird zur Vorgabe.
 *   2. Der Entwurf: duldsam gelesen (Grenzen, nur #-Farben, nur Bilder ohne Stilzeichen), knapp geschrieben,
 *      übersteht das Aussehen der Seite; was nicht gilt, wird genannt.
 *   3. Die Werte: eigene Farben je Modus, das Band, Schrift auf dem Akzent.
 *   4. Das Dokument der Seite: "style" importiert ohne Warnung, kommt unverändert heraus, null nimmt ihn weg;
 *      die Beschreibung erklärt ihn; der Server zeichnet Band und Hülle.
 */

import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-page-style-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { readAppearance, DEFAULT_APPEARANCE, SCHEMES } from '${app}core/theme';
export { readPageStyle, pageStyleJson, pageStyleDropped, colorVars, layoutVars, pageHold, hasBand, bandBackground, gapOf } from '${app}pages/pageStyle';
export { pageStyleExample } from '${app}pages/pageStyleText';
export { readLook, writeLook } from '${app}pages/slides/slideLook';
export { planImport, exportPage, DEFAULT_IMPORT } from '${app}pages/pageJson';
export { pageDescription } from '${app}pages/pageJsonText';
export { StyledPage, PageHead } from '${app}pages/PageStyleView';
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

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1. Der Arbeitsplatz ----------------------------------------------------------------------- */
  {
    assert.deepEqual(m.readAppearance(null), m.DEFAULT_APPEARANCE, 'nothing chosen — the defaults');
    const odd = m.readAppearance({ mode: 'night', scheme: 'neon', hue: 999, tint: -3, contrast: 'max', text: 'huge', corners: 'blobby' });
    assert.deepEqual(odd, { ...m.DEFAULT_APPEARANCE, hue: 360, tint: 0 }, 'unknown values fall back, numbers are clamped');
    const mine = m.readAppearance({ mode: 'dark', scheme: 'own', hue: 200.4, tint: 1.5, contrast: 'more', text: 'lg', corners: 'round' });
    assert.deepEqual([mine.mode, mine.scheme, mine.hue, mine.tint, mine.contrast, mine.text, mine.corners], ['dark', 'own', 200, 1.5, 'more', 'lg', 'round']);
    assert.ok(m.SCHEMES.includes('sand') && m.SCHEMES.includes('own'), 'the old colours and an own hue');
    ok('workspace: a choice is read tolerantly — unknown values become the defaults, numbers are clamped');
  }

  /* -- 2. Der Entwurf ----------------------------------------------------------------------------- */
  {
    assert.equal(m.readPageStyle(undefined), undefined, 'no style — nothing');
    assert.equal(m.readPageStyle({}), undefined, 'an empty style is no style');
    const style = m.readPageStyle(m.pageStyleExample());
    assert.deepEqual(style, m.pageStyleExample(), 'the example reads back unchanged');
    const odd = m.readPageStyle({
      scheme: 'neon', hue: 40, mode: 'dusk', colors: { ground: 'red', ink: '#123', accent: '#ABCDEF' },
      title: { size: 99, weight: 730, align: 'middle' }, band: { height: -5, image: 'javascript:alert(1)', shade: 3 },
      width: 5, cards: 'glass', corners: 200, gap: 9, font: 'comic', groundImage: 'https://x.org/a.jpg") ; x'
    });
    assert.deepEqual(odd, {
      colors: { ink: '#123', accent: '#abcdef' },
      title: { size: 7, weight: 700 },
      band: { height: 0, shade: 0.8 },
      width: 30, corners: 40, gap: 4
    }, 'limits hold, only #-colours, no image that could end a style, unknown words drop out');
    assert.equal(odd.hue, undefined, 'a hue only with the own family');
    const dropped = m.pageStyleDropped({ scheme: 'neon', title: { size: 3, align: 'middle' }, band: { image: 'javascript:x' }, whatever: 1 });
    assert.deepEqual(dropped.sort(), ['band.image', 'scheme', 'title.align', 'whatever'].sort(), 'what does not hold is named, inside a group by its own name');

    assert.deepEqual(m.pageStyleDropped({ title: { size: 3, upper: false }, band: { color: '#000000', full: true }, scheme: null }), [], 'defaults said out loud are no mistake');
    const look = m.readLook(m.writeLook({ theme: null, cover: [], style }));
    assert.deepEqual(look.style, style, 'the style survives the page look');
    assert.equal(m.writeLook({ theme: null, cover: [], style: undefined }), null, 'no style, no look');
    assert.equal(m.readLook(m.writeLook({ theme: null, cover: [], lang: 'de' })).style, undefined, 'a look without a style stays without');
    ok('page style: read tolerantly (limits, #-colours, safe images), written compactly, kept in the page look; dropped keys are named');
  }

  /* -- 3. Die Werte ------------------------------------------------------------------------------- */
  {
    const vars = m.colorVars({ ground: '#101010', accent: '#ffe066' });
    assert.equal(vars['--wk-ground'], '#101010');
    assert.equal(vars['--wk-on-accent'], '#141414', 'dark text on a light accent');
    assert.equal(m.colorVars({ accent: '#1d3b2f' })['--wk-on-accent'], '#ffffff', 'white on a dark accent');
    assert.ok(vars['--wk-line'].includes('color-mix'), 'lines follow from text and ground');
    assert.equal(m.colorVars(undefined)['--wk-ground'], undefined);

    const night = { scheme: 'sea', colors: { ground: '#fafafa' }, night: { ground: '#050505' } };
    const auto = m.pageHold(night);
    assert.deepEqual([auto.mode, auto.scheme, auto.light['--wk-ground'], auto.dark['--wk-ground']], [undefined, 'sea', '#fafafa', '#050505'], 'following the visitor: day and night colours');
    const dark = m.pageHold({ mode: 'dark', colors: { ground: '#050505' }, night: { ground: '#999999' } });
    assert.deepEqual([dark.mode, dark.light['--wk-ground'], dark.dark['--wk-ground']], ['dark', undefined, '#050505'], 'always dark: the colours are the dark ones, night is not needed');

    assert.equal(m.hasBand({ band: { height: 0, color: '#000000' } }), false, 'height 0 — no band');
    assert.equal(m.hasBand({ band: { color: '#000000' } }), true);
    assert.equal(m.hasBand({ title: { size: 3 } }), false);
    assert.equal(m.bandBackground({ color: '#111111', to: '#222222', angle: 90 }), 'linear-gradient(90deg, #111111, #222222)');
    const withImage = m.bandBackground({ image: 'https://x.org/a.jpg', shade: 0.4, color: '#111111' });
    assert.ok(withImage.startsWith('linear-gradient(rgb(0 0 0 / 0.4)') && withImage.includes('url("https://x.org/a.jpg")') && withImage.endsWith('#111111'), 'shade over picture over colour');
    const layout = m.layoutVars({ title: { size: 4, align: 'center', upper: true }, width: 60, gap: 2, band: { image: '/a.jpg' } });
    assert.deepEqual([layout['--pg-title-size'], layout['--pg-title-align'], layout['--pg-lead-inline'], layout['--pg-title-transform'], layout['--pg-width'], layout['--pg-gap'], layout['--pg-band-ink']],
      ['4rem', 'center', 'auto', 'uppercase', '60rem', '2rem', '#ffffff'], 'title, width, gap; white text on a picture');
    assert.equal(m.gapOf(undefined), 1);
    ok('values: own colours per mode, mixed lines, readable text on the accent, the band (gradient, picture, shade), title and width');
  }

  /* -- 4. Das Dokument ---------------------------------------------------------------------------- */
  {
    const empty = { path: 'zz-probe/wyglad', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null };
    const doc = { format: 'recreatio.page', version: 1, title: 'Las', lead: 'Dom w lesie', mode: 'page', style: m.pageStyleExample(), modules: [{ kind: 'text', config: { title: 'O nas', body: 'Tekst.' } }] };
    const plan = m.planImport(doc, empty, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), JSON.stringify(plan));
    assert.deepEqual(plan.warnings, [], 'the document imports without a warning');
    assert.deepEqual(plan.look.style, m.pageStyleExample(), 'the style lands in the look');
    assert.ok(plan.lines.some((l) => l.startsWith('Projekt strony')), 'the plan says so');

    const now = { ...empty, title: plan.title, lead: plan.lead ?? '', mode: plan.mode ?? 'page', look: plan.look, parts: plan.parts };
    const out = JSON.parse(JSON.stringify(m.exportPage(now)));
    assert.deepEqual(out.style, m.pageStyleExample(), 'export carries it');
    const again = m.planImport(out, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.deepEqual(again.warnings, []);
    assert.equal(again.look, undefined, 'export → import changes nothing');

    const gone = m.planImport({ ...out, style: null }, now, m.DEFAULT_IMPORT);
    assert.equal(gone.look.style, undefined, '"style": null takes it away');
    const { style: _style, ...noStyle } = out;
    const kept = m.planImport({ ...noStyle, theme: { mode: 'dark' } }, now, m.DEFAULT_IMPORT);
    assert.deepEqual(kept.look.style, m.pageStyleExample(), 'changing the theme keeps the style');
    const bad = m.planImport({ ...out, style: { cards: 'glass', title: { align: 'middle' } } }, now, m.DEFAULT_IMPORT);
    assert.ok(bad.warnings.some((w) => w.includes('cards')) && bad.warnings.some((w) => w.includes('title.align')), 'odd values are reported');

    const words = m.pageDescription();
    for (const key of ['"style" — ', '"band": {', '"cards" — ', '"night" — ', '"groundImage" — ']) assert.ok(words.includes(key), `the description explains ${key}`);

    const said = console.error;
    console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) said(...args); };
    let html = '';
    let plain = '';
    try {
      html = m.renderToStaticMarkup(m.createElement(m.StyledPage, { style: plan.look.style }, m.createElement(m.PageHead, { title: 'Las', lead: 'Dom', style: plan.look.style })));
      plain = m.renderToStaticMarkup(m.createElement(m.StyledPage, { style: undefined }, m.createElement(m.PageHead, { title: 'Las', lead: null, style: undefined })));
    } finally {
      console.error = said;
    }
    assert.ok(html.includes('class="pg-styled"') && html.includes('data-cards="shadow"') && html.includes('data-band="full"'), 'the wrapper carries the module look and the band');
    assert.ok(html.includes('<header class="pg-band">') && html.includes('>Las</h1>'), 'the title sits on its band');
    assert.equal(plain, '<h1 class="wk-h1 pg-title">Las</h1>', 'without a style: the title as before, no wrapper');
    ok('a page document: "style" imports without a warning, comes out unchanged, null removes it, a new theme keeps it; described; the server draws band and wrapper');
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
