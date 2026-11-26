/**
 * 2026-11-26 — GRAFIKEN FÜR MEHRERE FOLIEN UND IHR ÜBERGANG (`src/app/cogita/slideGraphics.ts`, `slideTransition.ts`), ohne Browser:
 *   1. eine Grafik und was eine Folie dazutut: "add", "change" (nach "id"), "hide", "set" (vars zusammengeführt);
 *   2. welche Grafik ein Schritt nennt: "@name", { "graphic": … }, sonst wie bisher ein eigenes Bild (JSON, Feld);
 *   3. von Folie zu Folie mit derselben Grafik: Bleibendes ohne Auftritt (Schleifen laufen weiter), Verschobenes gleitet vom alten Ort,
 *      Farbe wechselt weich, Neues blendet sich ein (oder spielt seine eigene Bewegung), Fehlendes blendet sich aus;
 *      eine andere Grafik: das Bild, wie es ist;
 *   4. die Wörter der Übergänge.
 *
 *   node scripts/app-slide-graphics-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-slide-graphics-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export * from '${app}cogita/slideGraphics';
export { drawingOfText } from '${app}cogita/interactive';
`);
await build({
  entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', jsx: 'automatic',
  plugins: [{ name: 'no-css', setup(b) { b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'no-css' })); b.onLoad({ filter: /.*/, namespace: 'no-css' }, () => ({ contents: '', loader: 'js' })); } }],
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
const G = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let passed = 0;
let failed = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const atom = {
  size: [200, 120], vars: { n: 1, m: 2 },
  elements: [
    { id: 'kern', type: 'circle', x: 100, y: 60, r: 12, fill: 'accent', motion: [{ name: 'rise' }, { name: 'breathe' }] },
    { id: 'e1', type: 'circle', x: 140, y: 60, r: 4, fill: 'muted' },
    { type: 'text', x: 100, y: 110, text: 'Atom', size: 10 }
  ]
};
const lookup = (ref) => (ref === '@atom' || ref === 'G1' ? { id: 'G1', drawing: atom } : null);

/* 1. */
const composed = G.composeGraphic(atom, { hide: ['e1'], change: { kern: { fill: 'ok' } }, add: [{ id: 'e2', type: 'circle', x: 60, y: 60, r: 4 }], set: { vars: { n: 3 }, alt: 'Atom z elektronem' } });
check('compose: hidden left out, changed by id, added on top', composed.elements.map((e) => [e.id ?? e.type, e.fill ?? null]), [['kern', 'ok'], ['text', null], ['e2', null]]);
check('… "set": vars merged, the rest replaced; the graphic itself unchanged', [composed.vars, composed.alt, atom.elements.length, atom.elements[0].fill], [{ n: 3, m: 2 }, 'Atom z elektronem', 3, 'accent']);

/* 2. */
const own = () => null;
check('a step names a graphic: "@atom" and { "graphic": "@atom", … }',
  [G.slideGraphicOf('@atom', lookup, own)?.graphic, G.slideGraphicOf({ graphic: '@atom', hide: ['e1'] }, lookup, own)?.raw.elements.length],
  ['G1', 2]);
check('… an unknown graphic in an object: no picture; a name that is no graphic: the own picture (a field of the slide)',
  [G.slideGraphicOf({ graphic: '@brak' }, lookup, own), G.slideGraphicOf('rysunek', lookup, () => JSON.stringify({ elements: [{ type: 'rect', w: 2, h: 2 }] }))?.graphic],
  [null, null]);
check('… an own picture inline (no graphic) stays as it was', G.slideGraphicOf({ elements: [{ type: 'rect', w: 2, h: 2 }] }, lookup, () => JSON.stringify({ elements: [{ type: 'rect', w: 2, h: 2 }] }))?.raw.elements.length, 1);

/* 3. */
const first = G.slideGraphicOf('@atom', lookup, own);
const second = G.slideGraphicOf({ graphic: '@atom', change: { e1: { x: 60, fill: 'ok' } }, hide: [], add: [{ id: 'e3', type: 'circle', x: 100, y: 20, r: 4 }, { id: 'e4', type: 'circle', x: 100, y: 100, r: 4, motion: { name: 'rise' } }] }, lookup, own);
const m = G.morphGraphic(first, second);
const el = (id) => m.elements.find((e) => (e.id ?? e.type) === id);
check('same graphic, next slide: what stays plays no entrance again (its loop goes on)', el('kern').motion.map((x) => x.name), ['breathe']);
check('… an unchanged part without motion gets none', el('text').motion, undefined);
const glide = el('e1').motion;
check('… a moved part glides from the old place (keys: x from +80 to 0) and changes colour softly', [glide[0].name, glide[0].keys[0].x, glide[0].keys[1].x, glide[1]?.name, glide[1]?.from, glide[1]?.to], ['keys', 80, 0, 'color', 'muted', 'ok']);
check('… a new part fades in after the rest settled; a new part with its own motion plays that one',
  [el('e3').motion[0].keys.map((k) => k.opacity), el('e3').motion[0].delay > 0, el('e4').motion.name ?? el('e4').motion[0]?.name], [[0, 1], true, 'rise']);
const third = G.slideGraphicOf({ graphic: '@atom', hide: ['e1'] }, lookup, own);
const gone = G.morphGraphic(first, third).elements;
check('… a part that is gone fades out (on top, then invisible)', [gone[gone.length - 1].id, gone[gone.length - 1].motion[0].keys.map((k) => k.opacity)], ['e1', [1, 0]]);
check('another graphic (or none before): the picture as it is, with its own entrances',
  [G.morphGraphic({ graphic: 'G2', raw: {} }, first) === first.raw, G.morphGraphic(null, first) === first.raw, G.morphGraphic(first, { graphic: null, raw: { elements: [] } }).elements.length], [true, true, 0]);
check('… the morphed picture still draws (the app reads it)', G.drawingOfText(JSON.stringify(m))?.elements.length, 5);
const expr = G.morphGraphic(first, G.slideGraphicOf({ graphic: '@atom', change: { e1: { x: '=40 + n' } } }, lookup, own));
check('… a part whose place is an expression moves by itself (no glide)', expr.elements.find((e) => e.id === 'e1').motion, undefined);

/* 4. */
check('transitions: words and aliases; unknown → nothing', ['fade', 'Slide', 'zoom', 'brak', 'przesunięcie', 'wirbel', ''].map(G.readTransition), ['fade', 'slide', 'zoom', 'none', 'slide', null, null]);

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
