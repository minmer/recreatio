/**
 * DER POKAZ VON COGITA ALS SLAJDY (0107) — als Dokument der Seite
 * ("recreatio/page", "mode": "slides"), das sich auf jeder Seite importieren
 * lässt (Panel „JSON" der Seite → Importuj, „Zastąp moduły strony").
 *
 * Alles kommt aus dem Altbestand:
 *   Text      src/legacy/content/pl.ts — cogita.introSlides, wörtlich
 *   Farben    src/legacy/pages/cogita/CogitaPage.tsx — die sieben Themen (bg0, bg1, bg2, bloom, sat);
 *             die Sättigung (`filter: saturate(sat)`) ist hier in die Farben gerechnet
 *   Luft      src/legacy/styles/cogita.css — .cogita-home-bg: Verlauf, Schein, Ecken, Dunst, Nici, Fale
 *   Zeichen   public/cogita/logo/Cogita00…19.png — zwölf Blasen (schweben), sechs Buchstaben und
 *             „REcreatio" (setzen sich nacheinander), cogita-intro.css: .cogita-logo-layer
 *   Plätze    cogita-intro.css: das Zeichen auf Slajd 1 bei 70 %, auf 2–6 bei 16 % (×0,5), auf 7 bei 25 %
 *   Bilder    CogitaIntroSlides.tsx — Mapa wiedzy, Karty, Runda, Postęp, Tarcza (Baustein „animation")
 *   Wechsel   .cogita-intro-slide (480 ms, 12 px, Unschärfe 2 px) → "transition": "dissolve";
 *             cogita-text-delayed (220 ms, auf der Mapa 1000 ms) → "motion": { "name": "rise", … }
 *
 * Ändert sich etwas dort, schreibt dieses Skript das Dokument neu:
 *
 *   node scripts/cogita-home.mjs     → scripts/fixtures/cogita-home.json
 *
 * Das Dokument ist zugleich ein Prüfstein (`app-slides-check.mjs`): es muss
 * sich ohne Warnung importieren lassen und unverändert wieder herauskommen.
 */

import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const src = join(root, 'src').replace(/\\/g, '/');
const workspace = await mkdtemp(join(tmpdir(), 'cogita-home-'));
const entry = join(workspace, 'entry.ts');
await writeFile(entry, `
export { pl } from '${src}/legacy/content/pl';
export { readSlideValue, slideJson, readDeck, deckJson } from '${src}/app/slides';
export { partOf } from '${src}/app/parts/registry';
`);
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'), logLevel: 'error', jsx: 'automatic',
  nodePaths: [join(root, 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }
});
globalThis.BroadcastChannel = undefined;
const { pl, readSlideValue, slideJson, readDeck, deckJson, partOf } = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
await rm(workspace, { recursive: true, force: true });

/* -- Farben: die Sättigung des Altbestands in die Farbe gerechnet ----------------------- */

/** CSS `saturate(s)` — dieselbe Matrix wie im Browser, auf eine Farbe angewandt. */
function saturate([r, g, b], s) {
  const m = [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]
  ];
  return m.map((row) => Math.max(0, Math.min(255, Math.round(row[0] * r + row[1] * g + row[2] * b))));
}
const rgbOf = (hex) => { const n = Number.parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hexOf = ([r, g, b]) => '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
const satHex = (hex, s) => hexOf(saturate(rgbOf(hex), s));
const satRgba = (rgba, s) => {
  const [r, g, b, a] = /rgba\(([^)]+)\)/.exec(rgba)[1].split(',').map((x) => Number(x.trim()));
  const [R, G, B] = saturate([r, g, b], s);
  return `rgba(${R}, ${G}, ${B}, ${a})`;
};

/* -- Die sieben Slajdy (CogitaPage.tsx: introSlides, theme) ------------------------------- */

const THEMES = {
  entry: { bg0: '#06162a', bg1: '#0c2d49', bg2: '#0a1c2f', bloom: 'rgba(120, 170, 220, 0.18)', sat: 1 },
  workspace: { bg0: '#071a2a', bg1: '#0b3b56', bg2: '#081f33', bloom: 'rgba(129, 190, 235, 0.18)', sat: 1.05 },
  library: { bg0: '#071a2f', bg1: '#0c2f4a', bg2: '#081f33', bloom: 'rgba(120, 175, 230, 0.14)', sat: 0.96 },
  live: { bg0: '#07182d', bg1: '#0c2a4a', bg2: '#081f35', bloom: 'rgba(115, 170, 225, 0.15)', sat: 0.98 },
  quiz: { bg0: '#071526', bg1: '#0d2946', bg2: '#081a30', bloom: 'rgba(120, 175, 230, 0.14)', sat: 0.97 },
  protection: { bg0: '#071a2a', bg1: '#0a2742', bg2: '#07192d', bloom: 'rgba(150, 200, 240, 0.16)', sat: 1 },
  register: { bg0: '#081c30', bg1: '#0f3754', bg2: '#0b2239', bloom: 'rgba(160, 210, 245, 0.2)', sat: 1.05 }
};

/** Wie die Slajdy hier heissen (die Kennungen im Dokument; beim Import werden es neue) und im Menü (daraus die Anker). */
const SLIDES = [
  { id: 'wejscie', legacy: 'entry', label: 'Cogita' },
  { id: 'mapa', legacy: 'workspace', label: 'Mapa wiedzy', scene: 'map' },
  { id: 'biblioteka', legacy: 'library', label: 'Biblioteka', scene: 'cards' },
  { id: 'na-zywo', legacy: 'live', label: 'Na żywo', scene: 'round' },
  { id: 'postep', legacy: 'quiz', label: 'Postęp', scene: 'progress' },
  { id: 'ochrona', legacy: 'protection', label: 'Ochrona', scene: 'draw' },
  { id: 'dolacz', legacy: 'register', label: 'Dołącz' }
];

const anchor = (label) => label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Die Farben des Pokaz: Schrift wie `.cogita-intro-text h1` (#f4f7fb), Text rgba(228, 239, 255, .82) auf dem Grund, Akzent wie `.cogita-home .cta`. */
const THEME = { mode: 'dark', accent: '#7ec8ff', ink: '#f4f7fb', ground: '#06162a', muted: '#bcc8d9' };

/** Die Farben der Bilder (cogita-intro.css): hell auf dunklem Blau, grün und rot für gut und schlecht. */
const SCENE_COLORS = { color: '#aae6ff', soft: '#8cc8ff', good: '#78e6aa', bad: '#ff7878' };

/** Wie gross die Bilder im Altbestand waren (rem = px / 16). */
const SCENE_MAX = { map: 27.5, cards: 35, round: 32.5, progress: 35, draw: 11.25 };

/* -- Das gemeinsame Tuch (.cogita-home-bg) ---------------------------------------------------- */

const backdrop = [
  /* radial-gradient(farthest-corner at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.35) 100%) */
  { kind: 'vignette', speed: 0, strength: 0.35, reach: 55, color: '#000000' },
  /* ::before — zwei dunkle Flecken und ein heller Strich, blur(60px), Deckkraft .35, cogita-depth 18 s hin und her */
  { kind: 'haze', speed: 0, color: 'rgba(120, 170, 220, 0.08)', depth: 'rgba(30, 60, 100, 0.1)', blur: 60, opacity: 0.35, motion: { name: 'drift' } },
  /* vier Leinwände mit Fäden und Staub, jede faluje für sich (cogita-mesh-layer, 180–400 s) */
  { kind: 'mesh', speed: 0, seed: 2026, count: 4, color: 'rgba(143, 208, 255, 0.25)', glow: 'rgba(167, 224, 255, 0.35)', center: 0.82, amplitude: 1, opacity: 0.9, dust: true, motion: { name: 'sway' } },
  /* sechs Bänder, verwischt — im Altbestand still („animation: none") */
  { kind: 'waves', speed: 0, seed: 7, count: 6, hue: 188, spread: 32, opacity: 1, blur: 1, motion: [] }
];

/* -- Das Zeichen: zwanzig Ebenen ---------------------------------------------------------------- */

const LOGO = (n) => `/cogita/logo/Cogita${String(n).padStart(2, '0')}.png`;
/** Die Blasen (.cogita-logo-layer.is-bubble:nth-child(n)): Ausschlag und Dauer je Blase. */
const BUBBLES = [[4, 6, 3800], [6, 8, 4200], [-5, 7, 3600], [8, -4, 4600], [-7, 5, 4000], [5, -6, 3400], [-4, 9, 4800], [7, -5, 3900], [-6, 6, 4400], [5, 5, 3700], [-5, -4, 4100], [6, 8, 4200]];
/** Die Buchstaben (nth-child 13–18) und „REcreatio" (19, 20): wann sie sich setzen. */
const LETTERS = [0, 90, 180, 260, 340, 420];
const RECREATIO = [520, 620];
const SHADOW = '0 26px 60px rgba(8, 20, 38, 0.6)';
const TEXT_SHADOW = '0 30px 70px rgba(8, 20, 38, 0.6)';

const logoLayers = [
  ...BUBBLES.map(([x, y, duration], i) => ({ url: LOGO(i), z: 3, shadow: SHADOW, motion: { name: 'float', x, y, duration } })),
  ...LETTERS.map((delay, i) => ({ url: LOGO(12 + i), z: 2, shadow: TEXT_SHADOW, motion: { name: 'assemble', delay } })),
  ...RECREATIO.map((delay, i) => ({ url: LOGO(18 + i), z: 1, motion: { name: 'assemble', delay } }))
];

/**
 * Wo das Zeichen steht (cogita-intro.css, „layout overrides"): auf dem ersten
 * Slajd rechts gross (70 %, ×1,08), auf den mittleren links klein (16 %, ×0,5,
 * Deckkraft .82), auf dem letzten links (25 %, ×0,95). Breite min(44vw, 520px).
 * Hochkant (orientation: portrait): oben, auf den mittleren klein in der Ecke.
 */
const FRAME = { w: 44, max: 32.5, rotate: 0 };
const frames = Object.fromEntries(SLIDES.map((slide, i) => {
  const first = i === 0;
  const last = i === SLIDES.length - 1;
  const frame = first ? { ...FRAME, x: 70, y: 50, scale: 1.08, opacity: 1, tall: { x: 50, y: 20, w: 52, scale: 1.05 } }
    : last ? { ...FRAME, x: 25, y: 50, scale: 0.95, opacity: 1, tall: { x: 50, y: 22, w: 50, scale: 1 } }
    : { ...FRAME, x: 16, y: 50, scale: 0.5, opacity: 0.82, tall: { x: 11, y: 6, w: 44, scale: 0.32, opacity: 0.85 } };
  return [slide.id, frame];
}));

/* -- Die Bausteine ---------------------------------------------------------------------------- */

const copy = new Map(pl.cogita.introSlides.map((one) => [one.id, one]));
const modules = [];

modules.push({
  id: 'logo', kind: 'layers', size: { colSpan: 3, rowSpan: 3 },
  slide: { label: 'Znak Cogita', layers: [], stage: { frames, bare: true } },
  config: { alt: 'Cogita', layers: JSON.stringify(logoLayers) }
});

SLIDES.forEach((slide, i) => {
  const text = copy.get(slide.legacy);
  const theme = THEMES[slide.legacy];
  const first = i === 0;
  const last = i === SLIDES.length - 1;
  const next = SLIDES[i + 1];
  const body = (text.body ?? text.subtitle ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');

  modules.push({
    id: slide.id, kind: 'hero', size: { colSpan: 6, rowSpan: 3 },
    slide: {
      label: slide.label,
      /* Das Thema des Slajds: der Verlauf bg0 → bg1 → bg2 (180°) und der Schein (closest-side at 58% 42%) — im Tuch gehen sie ineinander über. */
      layers: [
        { kind: 'gradient', speed: 0, angle: 180, from: satHex(theme.bg0, theme.sat), via: satHex(theme.bg1, theme.sat), to: satHex(theme.bg2, theme.sat) },
        { kind: 'glow', speed: 0, color: satRgba(theme.bloom, theme.sat), x: 58, y: 42, size: 60, opacity: 1, blend: 'normal' }
      ],
      transition: 'dissolve',
      colors: { ground: satHex(theme.bg0, theme.sat) },
      /* Der Text wartet, bis der Slajd da ist (220 ms; auf der Mapa 1000 ms — erst geht der Wanderer los). Der erste hat keinen Auftritt. */
      ...(first ? {} : { motion: { name: 'rise', delay: i === 1 ? 1000 : 220 } }),
      /* Wo der Text steht: auf dem ersten links (das Zeichen rechts), auf den mittleren in der Mitte mit dem Bild rechts, auf dem letzten rechts. */
      layout: first ? { align: 'start', width: 48, tall: { valign: 'end', width: 100 } }
        : last ? { align: 'end', width: 50, tall: { valign: 'end', width: 100 } }
        : { align: 'end', width: 69, tall: { width: 100 } }
    },
    config: {
      badge: 'Cogita',
      badgeLook: 'kicker',
      size: first ? 'display' : 'title',
      headline: text.title,
      lede: null,
      paragraphs: body,
      actions: last
        ? [{ label: text.cta, href: '#/workspace', variant: 'cta' }, ...(text.secondary ? [{ label: text.secondary, href: `#${anchor(SLIDES[0].label)}`, variant: 'ghost' }] : [])]
        : [{ label: text.cta, href: `#${anchor(next.label)}`, variant: 'cta' }],
      footnote: text.micro ?? null
    }
  });

  if (slide.scene !== undefined) {
    modules.push({
      id: `${slide.id}-obraz`, kind: 'animation', size: { colSpan: 3, rowSpan: 3 },
      /* Das Bild steht neben dem Text auf dessen Slajd — rechts (0.8fr : 1fr im Altbestand), auf dem Telefon darüber. */
      slide: { label: `${slide.label} — obraz`, layers: [], with: { slide: slide.id, side: 'end', share: 44, tallSide: 'start' } },
      config: { scene: slide.scene, ...SCENE_COLORS, max: SCENE_MAX[slide.scene], ...(slide.scene === 'draw' ? { icon: 'shield', glow: 'tak' } : {}) }
    });
  }
});

/* -- Knapp, wie die Seite es selbst schreibt ---------------------------------------------------- */

const canonical = (one) => {
  const def = partOf(one.kind);
  return { ...one, slide: slideJson(readSlideValue(one.slide)), config: def.json.toJson(def.json.fromJson(one.config)) };
};

const doc = {
  format: 'recreatio/page',
  version: 1,
  path: 'cogita',
  title: 'Cogita',
  lead: null,
  mode: 'slides',
  theme: THEME,
  cover: [],
  deck: deckJson(readDeck({ backdrop, nav: 'dots', titleSlide: false, width: 80 })),
  modules: modules.map(canonical)
};

const out = join(root, 'scripts', 'fixtures', 'cogita-home.json');
await writeFile(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`written ${out} — ${SLIDES.length} slides, ${modules.length} modules, ${doc.deck.backdrop.length} shared layers`);
process.exit(0);
