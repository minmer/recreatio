/**
 * DIE STARTSEITE DES ALTBESTANDS ALS PRÄSENTATION (0085) — als Dokument der
 * Seite ("recreatio/page"), das sich auf jeder Seite importieren lässt.
 *
 * Der Text kommt WÖRTLICH aus dem Altbestand (`src/legacy/public/content/
 * pl.ts`), die Lage der Blasen aus derselben Rechnung wie dort (Ring je
 * Szene, `arrange('ring', …)`), die Masse aus `public.css`. Ändert sich der
 * Text dort, schreibt dieses Skript das Dokument neu:
 *
 *   node scripts/presentation-home.mjs     → scripts/fixtures/presentation-home.json
 *
 * Das Dokument ist zugleich der Prüfstein der Präsentation
 * (`app-presentation-check.mjs`): es muss sich ohne Warnung importieren lassen
 * und unverändert wieder herauskommen.
 */

import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const src = join(root, 'src').replace(/\\/g, '/');
const workspace = await mkdtemp(join(tmpdir(), 'pz-home-'));
const entry = join(workspace, 'entry.ts');
await writeFile(entry, `
export { pl } from '${src}/legacy/public/content/pl';
export { arrange } from '${src}/app/presentationMotion';
export { pieceJson, readPieceValue, readShow, showJson } from '${src}/app/presentation';
`);
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'), logLevel: 'error',
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }
});
/* Der Kanal zwischen Tabs hielte Node am Leben — hier gibt es keine Tabs. */
globalThis.BroadcastChannel = undefined;
const { pl, arrange, pieceJson, readPieceValue, readShow, showJson } = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
await rm(workspace, { recursive: true, force: true });

/* -- Was der Altbestand sagt --------------------------------------------------------- */

const front = pl.front;
const text = (value) => (typeof value === 'string' ? value : '');
const href = (segment) => `#/rc/${segment}`;
const WORK_PAGES = ['osrodek', 'wydarzenia', 'cogita', 'biblioteka'];

/** Die Wörter der Wolke (FrontPage.tsx, WORDS) — der Rest nach dem RE. */
const WORDS = ['colligere', 'novatio', 'conciliatio', 'fectio', 'dintegratio', 'ditus', 'cognitio', 'stitutio', 'generatio', 'paratio', 'latio', 'quies', 'surrectio'];

/* -- Farben (public.css: hell, und dunkel unter prefers-color-scheme) ----------------- */

const ORB = '#14180f|#0b0d08';
const LIGHT_ON_DARK = '#f2f4ef';

/* -- Die Szenen ------------------------------------------------------------------------ */

const sceneKeys = ['calosc', 'czlowiek', 'dane'];
const scenes = [
  {
    key: 'start',
    label: front.screen1.wordmark,
    colors: { ground: ORB, ink: LIGHT_ON_DARK, muted: '#79806f', accent: '#9ed3b4' },
    hint: front.screen1.hint,
    words: { list: WORDS, prefix: 'RE', count: 39, seed: 2026 }
  },
  ...front.scenes.map((scene, i) => ({
    key: sceneKeys[i],
    label: scene.label,
    steps: scene.bubbles.length,
    ...(i === 0 ? { change: 'fly' } : {}),
    grow: { from: 0.8, to: 1.08 },
    thread: 'dots'
  })),
  /* Die Viertel kommen jedes für sich; die Szene selbst blendet nicht (Altbestand: .rc-l3 ohne Deckkraft). */
  { key: 'dzieje', label: front.screen3.title, change: 'build' },
  /* Der Kontakt legt sich über die Viertel, die stehen bleiben, bis der Kreis sie zudeckt. */
  { key: 'kontakt', label: pl.contact.title, change: 'build', keep: true, colors: { ink: LIGHT_ON_DARK, accent: '#9ed3b4', muted: '#8d9585' } }
];

/* -- Die Bausteine ------------------------------------------------------------------- */

const modules = [];

/* Der Raum: das Zeichen näher, der Satz dahinter (FrontPage.tsx: LOGO_Z, SENTENCE_Z, LOGO_Y, SENTENCE_Y). */
modules.push({
  id: 'start-znak', kind: 'image', size: { colSpan: 6, rowSpan: 3 },
  show: { places: { start: { x: 50, y: 37, w: 35, z: -320, tall: { w: 74 } } }, skin: 'plain', arrive: 'none' },
  config: { url: '/logo_inv.svg', alt: front.screen1.wordmark }
});
modules.push({
  id: 'start-zdanie', kind: 'text', size: { colSpan: 6, rowSpan: 3 },
  show: { places: { start: { x: 50, y: 56, w: 36, z: -980, tall: { w: 76 } } }, skin: 'plain', type: 'display', align: 'center', arrive: 'none' },
  config: { title: text(front.screen1.sentence) }
});

/*
 * Die Blasen: je Szene im Ring (FrontPage.tsx, ringPoints — hoch ein anderer
 * Ring), eine je Schritt, gestaffelt herein (--in: 0.12 je Blase, über 0.55).
 * Die Breiten sind die der Rollen in public.css: min(x vw, y rem).
 */
const WIDTHS = {
  title: { w: 76, max: 22 },
  body: { w: 84, max: 30, tall: { max: 22 } },
  close: { w: 70, max: 21, tall: { w: 76, max: 18 } },
  note: { w: 40 },
  image: { w: 66, max: 19 }
};
const TYPE = { title: 'title', body: 'body', close: 'close', note: 'note', image: 'body' };

front.scenes.forEach((scene, si) => {
  const n = scene.bubbles.length;
  const wide = arrange('ring', n, false, si);
  const high = arrange('ring', n, true, si);
  scene.bubbles.forEach((bubble, i) => {
    const size = WIDTHS[bubble.kind] ?? { w: 72, max: 20 };
    const config = bubble.kind === 'title' ? { title: bubble.lines[0] }
      : bubble.kind === 'note' ? { body: [bubble.lines[0]] }
      : { body: bubble.lines };
    modules.push({
      id: `${sceneKeys[si]}-${i + 1}`,
      kind: 'text',
      size: { colSpan: bubble.kind === 'body' ? 6 : 3, rowSpan: 3 },
      show: {
        places: {
          [sceneKeys[si]]: {
            x: wide[i].x, y: wide[i].y, w: size.w, ...(size.max === undefined ? {} : { max: size.max }), step: i,
            tall: { x: high[i].x, y: high[i].y, ...(size.tall ?? {}) }
          }
        },
        skin: bubble.kind === 'note' ? 'pill' : 'bubble',
        type: TYPE[bubble.kind] ?? 'body',
        arrive: 'zoom',
        ...(i === 0 ? {} : { delay: Math.round(i * 0.12 * 100) / 100 }),
        span: 0.55
      },
      config
    });
  });
});

/*
 * Die vier Werke: jedes in sein Viertel, von seiner Seite herein, nacheinander
 * (QUARTERS: Vorlauf 0.85 … 0.40 vor dem Zustand der Werke, über 0.4) — links
 * oben, links unten, rechts oben, rechts unten. Das Bild liegt an der Naht in
 * der Mitte; unten steht der Text unten.
 */
const QUARTER = [
  { x: 25, y: 25, from: 'from-left', delay: 0.15, align: 'start', valign: 'start' },
  { x: 25, y: 75, from: 'from-left', delay: 0.3, align: 'start', valign: 'end' },
  { x: 75, y: 25, from: 'from-right', delay: 0.45, align: 'end', valign: 'start' },
  { x: 75, y: 75, from: 'from-right', delay: 0.6, align: 'end', valign: 'end' }
];
const LOOK = [
  { fill: '#ece0c9|#2a2113', media: { url: '/Hortus.jpg', at: '57% 50%' } },
  { fill: '#22402f|#1b3225', ink: '#e8efe6|#dfeade', accent: '#e8efe6|#dfeade', media: { url: '/Events.jpg', at: '50% 42%', side: 'before' } },
  { fill: '#0a1c2f', ink: '#e6ecf3', accent: '#f95e3f', media: { url: '/cogita/logo/Cogita_Plain.svg', at: '78% 52%', fit: 'contain', size: 52, max: 13, opacity: 0.85, fade: false } },
  { fill: '#d0d9d5|#141c19' }
];
front.screen3.works.forEach((work, i) => {
  const q = QUARTER[i];
  modules.push({
    id: `dzieje-${i + 1}`, kind: 'text', size: { colSpan: 3, rowSpan: 3 },
    show: {
      places: { dzieje: { x: q.x, y: q.y, w: 50, h: 50 } },
      skin: 'panel', type: 'heading', ...LOOK[i],
      ...(q.align === 'start' ? {} : { align: q.align }), ...(q.valign === 'start' ? {} : { valign: q.valign }),
      arrive: q.from, delay: q.delay, span: 0.4
    },
    config: { title: work.name, body: [work.body, `[${work.cta}](${href(WORK_PAGES[i])})`] }
  });
});

/* Der Titel steht dort, wo die vier Viertel zusammenstossen (über und unter der Mitte). */
modules.push({
  id: 'dzieje-tytul', kind: 'text', size: { colSpan: 6, rowSpan: 1 },
  show: { places: { dzieje: { x: 50, y: 48, w: 60 } }, skin: 'plain', type: 'heading', align: 'center', origin: 'bottom', arrive: 'fade', span: 1 },
  config: { title: front.screen3.title }
});
modules.push({
  id: 'dzieje-etapy', kind: 'text', size: { colSpan: 6, rowSpan: 1 },
  show: { places: { dzieje: { x: 50, y: 53, w: 60 } }, skin: 'plain', type: 'note', align: 'center', origin: 'top', arrive: 'fade', span: 1 },
  config: { body: [front.screen3.stages] }
});

/*
 * Der Kreis: steht in der Mitte der vier Viertel und wächst zum Grund des
 * letzten Bildes (15rem, ×26, quadratisch) — dieselbe Fläche von Anfang bis
 * Ende. Und das Zeichen geht mit: aus dem Kreis in die obere linke Ecke.
 */
modules.push({
  id: 'kolo', kind: 'shape', size: { colSpan: 2, rowSpan: 2 },
  show: {
    places: { dzieje: { x: 50, y: 50, w: 100, max: 15 }, kontakt: { x: 50, y: 50, w: 100, max: 15, scale: 26 } },
    skin: 'plain', arrive: 'grow', span: 1, ease: 'in'
  },
  config: { shape: 'circle', fill: ORB }
});
modules.push({
  id: 'znak', kind: 'image', size: { colSpan: 2, rowSpan: 2 },
  show: {
    places: { dzieje: { x: 50, y: 50, w: 100, max: 9 }, kontakt: { x: 16, y: 18, w: 100, max: 16 } },
    skin: 'plain', arrive: 'fade', span: 1, ease: 'linear', layer: 1
  },
  config: { url: '/logo_inv.svg', alt: front.screen1.wordmark }
});

/* Das letzte Bild: die Anschrift unter dem Zeichen, das oben links gelandet ist. */
const address = text(pl.contact.address).split('\n').map((line) => line.trim()).filter((line) => line !== '');
modules.push({
  id: 'kontakt', kind: 'text', size: { colSpan: 3, rowSpan: 3 },
  show: {
    places: { kontakt: { x: 4.4, y: 34, w: 84, max: 34, tall: { x: 5, y: 26, w: 90, max: null } } },
    skin: 'plain', type: 'kicker', origin: 'top-left', arrive: 'fade', delay: 0.45, span: 0.55
  },
  config: {
    title: pl.contact.title,
    body: [
      `# [${pl.contact.email}](mailto:${pl.contact.email})`,
      text(pl.contact.people),
      ...address,
      `> ${front.screen1.wordmark}: ${text(pl.manifest.opening.inFormation)}`,
      `[${pl.nav['o-nas']}](${href('o-nas')}) · [${pl.nav.przejrzystosc}](${href('przejrzystosc')}) · [${pl.nav.kontakt}](${href('kontakt')})`
    ].filter((line) => line.trim() !== '')
  }
});

const doc = {
  format: 'recreatio/page',
  version: 1,
  path: 'start',
  title: front.screen1.wordmark,
  lead: null,
  mode: 'presentation',
  theme: {
    mode: 'light', accent: '#2f5d46', ink: '#171a16', ground: '#f7f8f5', muted: '#7c8479',
    night: { accent: '#8fc4a8', ink: '#eceee8', ground: '#141713', muted: '#838b7e' }
  },
  cover: [],
  /* So, wie die Seite es selbst schreibt: knapp — was der Vorgabe entspricht, fehlt. */
  show: showJson(readShow({ format: 'screen', fonts: 'spectral', nav: 'none', scenes })),
  modules: modules.map((one) => ({ ...one, show: pieceJson(readPieceValue(one.show)) }))
};

const out = join(root, 'scripts', 'fixtures', 'presentation-home.json');
await writeFile(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`written ${out} — ${scenes.length} scenes, ${modules.length} modules`);
process.exit(0);
