/**
 * 2026-11-06 — DER ENTWURF EINER SEITE (Art „page", die Bausteine im Raster): Farben, Schrift, der Titel und sein
 * Band, Breite, wie die Bausteine aussehen. Liegt im Aussehen der Seite (`look.style`, `slideLook.ts`) — versiegelt
 * wie alles dort, ohne eigenes Feld beim Dienst. Im JSON der Seite: `"style"` (`pageStyleText.ts`).
 *
 * <b>Farben gelten für die ganze Seite</b>, auch Kopf und Fuss: `holdPage` (`core/theme.ts`) schreibt sie an die
 * Wurzel, solange die Seite offen ist. Eine Farbfamilie (`scheme`) färbt alles stimmig; eigene Farben gehen darüber.
 * `colors` gelten hell (und immer, wenn `mode` "dark" festlegt), `night` dunkel, wenn die Seite dem Besucher folgt.
 *
 * <b>Alles andere sind Werte `--pg-*`</b>, die `styles/appearance.css` unter `.pg-styled` liest. Fehlt ein Wert,
 * bleibt es wie bisher; eine Seite ohne `style` sieht genau so aus wie vorher.
 */

import { MODES, SCHEMES, schemeVars, type ModeChoice, type PageHold, type SchemeId, type Vars } from '../core/theme';
import { imageUrl } from './slides/slideLook';

export const FONTS = ['system', 'serif', 'humanist', 'rounded', 'slab', 'didone', 'mono', 'hand'] as const;
export type FontId = (typeof FONTS)[number];

/* Nur Schriften, die auf dem Gerät liegen — die Seite lädt nichts nach. i18n-ignore: Namen von Schriften */
const FONT_STACK: Record<FontId, string> = {
  system: 'var(--wk-font)',
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'URW Palladio L', P052, Georgia, serif", // i18n-ignore
  humanist: "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif", // i18n-ignore
  rounded: "ui-rounded, 'Hiragino Maru Gothic ProN', Quicksand, Comfortaa, Manjari, 'Arial Rounded MT', Calibri, sans-serif", // i18n-ignore
  slab: "Rockwell, 'Rockwell Nova', 'Roboto Slab', 'DejaVu Serif', 'Sitka Small', serif", // i18n-ignore
  didone: "Didot, 'Bodoni MT', 'Noto Serif Display', 'URW Palladio L', P052, Sylfaen, serif", // i18n-ignore
  mono: 'var(--wk-mono)',
  hand: "'Segoe Print', 'Bradley Hand', Chilanka, 'Comic Sans MS', casual, cursive" // i18n-ignore
};

export const CARD_LOOKS = ['card', 'flat', 'outline', 'shadow'] as const;
export type CardLook = (typeof CARD_LOOKS)[number];

export const ALIGNS = ['start', 'center', 'end'] as const;
export type Align = (typeof ALIGNS)[number];

export const COLOR_KEYS = ['ground', 'surface', 'ink', 'muted', 'accent', 'line'] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
export type PageColors = Partial<Record<ColorKey, string>>;

export interface TitleStyle {
  /** rem */
  readonly size?: number;
  readonly weight?: number;
  readonly align?: Align;
  readonly upper?: boolean;
  /** em */
  readonly spacing?: number;
  readonly color?: string;
  /** Auch die Überschriften der Bausteine. */
  readonly font?: FontId;
}

/** Das Band hinter Titel und Vorspann. */
export interface BandStyle {
  /** Mindesthöhe in rem; 0 — kein Band. */
  readonly height?: number;
  readonly color?: string;
  /** Mit `to`: ein Verlauf von `color` nach `to`, im Winkel `angle`. */
  readonly to?: string;
  readonly angle?: number;
  /** Eine Adresse oder `page-image:<id>`. */
  readonly image?: string;
  /** Wie stark das Bild abgedunkelt wird (0–0.8), damit die Schrift lesbar bleibt. */
  readonly shade?: number;
  readonly ink?: string;
  /** false — in der Breite des Inhalts, mit Ecken; sonst über die ganze Breite. */
  readonly full?: boolean;
  readonly valign?: Align;
}

export interface ModuleTitleStyle {
  readonly size?: number;
  readonly color?: string;
}

export interface PageStyle {
  readonly mode?: ModeChoice;
  readonly scheme?: SchemeId;
  readonly hue?: number;
  readonly colors?: PageColors;
  readonly night?: PageColors;
  readonly font?: FontId;
  /** Faktor der Schrift (0.85–1.4). */
  readonly text?: number;
  readonly title?: TitleStyle;
  readonly band?: BandStyle;
  /** Höchstens so breit (rem). */
  readonly width?: number;
  readonly cards?: CardLook;
  /** px */
  readonly corners?: number;
  /** Abstand zwischen den Bausteinen (rem). */
  readonly gap?: number;
  readonly moduleTitle?: ModuleTitleStyle;
  /** Ein Bild hinter der ganzen Seite. */
  readonly groundImage?: string;
}

/* -- Lesen (duldsam) ------------------------------------------------------------------------------ */

const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  list.includes(value as T) ? value as T : undefined;

const numIn = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;

/** Eine Farbe: nur `#rgb` / `#rrggbb` — sie landet in einem Stil. */
export const isHex = (value: unknown): value is string => typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
const hex = (value: unknown): string | undefined => (isHex(value) ? value.trim().toLowerCase() : undefined);

/** Ein Bild: eine Adresse (https, /…) oder ein Bild der Seite; nichts, was einen Stil beenden könnte. */
export const isImage = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 2000 && /^(https?:\/\/|\/|page-image:)/i.test(value.trim()) && !/["'()\\\s<>]/.test(value.trim());
const image = (value: unknown): string | undefined => (isImage(value) ? value.trim() : undefined);

/** Ohne die leeren Schlüssel; nichts übrig — `undefined`. */
function compact<T extends object>(value: T): T | undefined {
  const out = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
  return Object.keys(out).length === 0 ? undefined : out;
}

function readColors(value: unknown): PageColors | undefined {
  const one = rec(value);
  return compact(Object.fromEntries(COLOR_KEYS.map((key) => [key, hex(one[key])])) as PageColors);
}

const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

export function readPageStyle(value: unknown): PageStyle | undefined {
  const one = rec(value);
  const title = rec(one.title), band = rec(one.band), moduleTitle = rec(one.moduleTitle);
  const weight = typeof title.weight === 'number' ? WEIGHTS.reduce((a, b) => (Math.abs(b - (title.weight as number)) < Math.abs(a - (title.weight as number)) ? b : a)) : undefined;
  return compact<PageStyle>({
    mode: oneOf(MODES, one.mode),
    scheme: oneOf(SCHEMES, one.scheme),
    hue: one.scheme === 'own' ? numIn(one.hue, 0, 360) : undefined,
    colors: readColors(one.colors),
    night: readColors(one.night),
    font: oneOf(FONTS, one.font),
    text: numIn(one.text, 0.85, 1.4),
    title: compact<TitleStyle>({
      size: numIn(title.size, 1, 7),
      weight,
      align: oneOf(ALIGNS, title.align),
      upper: title.upper === true ? true : undefined,
      spacing: numIn(title.spacing, -0.05, 0.4),
      color: hex(title.color),
      font: oneOf(FONTS, title.font)
    }),
    band: compact<BandStyle>({
      height: numIn(band.height, 0, 48),
      color: hex(band.color),
      to: hex(band.to),
      angle: numIn(band.angle, 0, 360),
      image: image(band.image),
      shade: numIn(band.shade, 0, 0.8),
      ink: hex(band.ink),
      full: band.full === false ? false : undefined,
      valign: oneOf(ALIGNS, band.valign)
    }),
    width: numIn(one.width, 30, 160),
    cards: oneOf(CARD_LOOKS, one.cards),
    corners: numIn(one.corners, 0, 40),
    gap: numIn(one.gap, 0, 4),
    moduleTitle: compact<ModuleTitleStyle>({ size: numIn(moduleTitle.size, 0.7, 3), color: hex(moduleTitle.color) }),
    groundImage: image(one.groundImage)
  });
}

/** Schalter, deren Vorgabe nicht gespeichert wird — wer sie trotzdem nennt, hat nichts falsch gemacht. */
const SAID_DEFAULT: Readonly<Record<string, unknown>> = { 'title.upper': false, 'band.full': true };

/** Was im Dokument stand, aber nicht gilt — für die Warnungen des Imports. */
export function pageStyleDropped(value: unknown): string[] {
  const said = rec(value);
  const kept = rec(JSON.parse(JSON.stringify(readPageStyle(value) ?? {})));
  const out: string[] = [];
  for (const [key, one] of Object.entries(said)) {
    const group = typeof one === 'object' && one !== null && !Array.isArray(one) && Object.keys(one).length > 0;
    if (!group) { if (!(key in kept) && one !== null) out.push(key); continue; }
    /* Eine Gruppe ("title", "band" …): die Schlüssel darin einzeln nennen. */
    const inner = rec(kept[key]);
    for (const [sub, value] of Object.entries(one)) {
      /* Die Vorgabe ausdrücklich gesagt ("upper": false, "full": true) ist gültig — sie wird nur nicht gespeichert. */
      if (sub in inner || SAID_DEFAULT[`${key}.${sub}`] === value || value === null) continue;
      out.push(`${key}.${sub}`);
    }
  }
  return out;
}

/** Für das Speichern: so knapp wie gelesen. */
export const pageStyleJson = (style: PageStyle | undefined): PageStyle | undefined =>
  style === undefined ? undefined : readPageStyle(JSON.parse(JSON.stringify(style)));

/* -- Anwenden ---------------------------------------------------------------------------------- */

/** Weiss oder fast schwarz auf dem Akzent — je nachdem, was man besser liest. */
function onColor(color: string): string {
  const h = color.length === 4 ? color.slice(1).split('').map((c) => c + c).join('') : color.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#141414' : '#ffffff';
}

/** Eigene Farben als Werte `--wk-*`; was sich aus ihnen ergibt (Linien, Flächen), wird gemischt. */
export function colorVars(colors: PageColors | undefined): Vars {
  if (colors === undefined) return {};
  const out: Record<string, string> = {};
  const { ground, surface, ink, muted, accent, line } = colors;
  if (ground !== undefined) {
    out['--wk-ground'] = ground;
    out['--wk-side'] = ground;
    out['--wk-sunk'] = 'color-mix(in oklab, var(--wk-ground) 96%, var(--wk-ink))';
    out['--wk-soft'] = 'color-mix(in oklab, var(--wk-ground) 91%, var(--wk-ink))';
  }
  if (surface !== undefined) out['--wk-surface'] = surface;
  if (ink !== undefined) {
    out['--wk-ink'] = ink;
    out['--wk-ink-2'] = 'color-mix(in oklab, var(--wk-ink) 85%, var(--wk-ground))';
  }
  if (muted !== undefined) out['--wk-muted'] = muted;
  else if (ink !== undefined || ground !== undefined) out['--wk-muted'] = 'color-mix(in oklab, var(--wk-ink) 68%, var(--wk-ground))';
  if (line !== undefined) out['--wk-line'] = line;
  else if (ink !== undefined || ground !== undefined) out['--wk-line'] = 'color-mix(in oklab, var(--wk-ink) 16%, var(--wk-ground))';
  if (line !== undefined || ink !== undefined || ground !== undefined) out['--wk-line-strong'] = 'color-mix(in oklab, var(--wk-line) 70%, var(--wk-ink))';
  if (accent !== undefined) {
    out['--wk-accent'] = accent;
    out['--wk-accent-hover'] = 'color-mix(in oklab, var(--wk-accent) 82%, var(--wk-ink))';
    out['--wk-accent-soft'] = 'color-mix(in oklab, var(--wk-accent) 14%, var(--wk-surface))';
    out['--wk-ring'] = 'color-mix(in srgb, var(--wk-accent) 32%, transparent)';
    out['--wk-on-accent'] = onColor(accent);
  }
  return out;
}

const cssUrl = (url: string): string => `url("${imageUrl(url).replace(/["\\]/g, '')}")`;

/** Der Hintergrund des Bands: Abdunkeln, Bild, Verlauf oder Farbe — von vorn nach hinten. */
export function bandBackground(band: BandStyle | undefined): string | undefined {
  if (band === undefined) return undefined;
  const layers: string[] = [];
  if (band.image !== undefined && (band.shade ?? 0) > 0) layers.push(`linear-gradient(rgb(0 0 0 / ${band.shade}), rgb(0 0 0 / ${band.shade}))`);
  if (band.image !== undefined) layers.push(`${cssUrl(band.image)} center / cover no-repeat`);
  if (band.color !== undefined && band.to !== undefined) layers.push(`linear-gradient(${band.angle ?? 135}deg, ${band.color}, ${band.to})`);
  else if (band.color !== undefined) layers.push(band.color);
  return layers.length === 0 ? undefined : layers.join(', ');
}

/** Hat die Seite ein Band? Eine Höhe, eine Farbe oder ein Bild genügt. */
export const hasBand = (style: PageStyle | undefined): boolean => {
  const band = style?.band;
  if (band === undefined || band.height === 0) return false;
  return band.height !== undefined || band.color !== undefined || band.image !== undefined;
};

/** Alles ausser den Farben — Werte `--pg-*`. */
export function layoutVars(style: PageStyle): Vars {
  const out: Record<string, string> = {};
  const { title, band, moduleTitle } = style;
  if (style.font !== undefined) out['--pg-font'] = FONT_STACK[style.font];
  if (style.text !== undefined) out['--pg-text'] = String(style.text);
  if (title?.font !== undefined) out['--pg-title-font'] = FONT_STACK[title.font];
  if (title?.size !== undefined) out['--pg-title-size'] = `${title.size}rem`;
  if (title?.weight !== undefined) out['--pg-title-weight'] = String(title.weight);
  if (title?.align !== undefined) {
    out['--pg-title-align'] = title.align;
    /* Der Vorspann ist schmaler als die Seite: er steht, wo der Titel steht. */
    out['--pg-lead-inline'] = title.align === 'center' ? 'auto' : title.align === 'end' ? 'auto 0' : '0';
  }
  if (title?.upper === true) out['--pg-title-transform'] = 'uppercase';
  if (title?.spacing !== undefined) out['--pg-title-spacing'] = `${title.spacing}em`;
  if (title?.color !== undefined) out['--pg-title-color'] = title.color;
  if (band?.height !== undefined) out['--pg-band-h'] = `${band.height}rem`;
  const bg = bandBackground(band);
  if (bg !== undefined) out['--pg-band-bg'] = bg;
  if (band?.ink !== undefined) out['--pg-band-ink'] = band.ink;
  else if (band?.image !== undefined) out['--pg-band-ink'] = '#ffffff';
  if (band?.valign !== undefined) out['--pg-band-valign'] = band.valign;
  if (style.width !== undefined) out['--pg-width'] = `${style.width}rem`;
  if (style.corners !== undefined) out['--pg-corners'] = `${style.corners}px`;
  if (style.gap !== undefined) out['--pg-gap'] = `${style.gap}rem`;
  if (moduleTitle?.size !== undefined) out['--pg-module-title-size'] = `${moduleTitle.size}rem`;
  if (moduleTitle?.color !== undefined) out['--pg-module-title-color'] = moduleTitle.color;
  if (style.groundImage !== undefined) out['--pg-ground-image'] = cssUrl(style.groundImage);
  return out;
}

/** Welche eigenen Farben im hellen und im dunklen Modus gelten (Kopf der Datei). */
export function colorsFor(style: PageStyle): { light: PageColors | undefined; dark: PageColors | undefined } {
  if (style.mode === 'dark') return { light: undefined, dark: style.colors };
  if (style.mode === 'light') return { light: style.colors, dark: undefined };
  return { light: style.colors, dark: style.night };
}

/** Was die offene Seite an der Wurzel festlegt (`holdPage`). */
export function pageHold(style: PageStyle): PageHold {
  const { light, dark } = colorsFor(style);
  return {
    ...(style.mode === undefined ? {} : { mode: style.mode }),
    ...(style.scheme === undefined ? {} : { scheme: style.scheme, hue: style.hue }),
    light: colorVars(light),
    dark: colorVars(dark),
    all: layoutVars(style)
  };
}

/** Für ein Element, das die Seite im Kleinen zeigt (Vorschau im Editor): alles als eigener Stil. */
export function scopedVars(style: PageStyle, scheme: SchemeId, hue: number, tint: number, dark: boolean): Vars {
  const { light, dark: night } = colorsFor(style);
  return { ...schemeVars(scheme, style.hue ?? hue, tint), ...colorVars(dark ? night : light), ...layoutVars(style) };
}

/** Der Abstand der Bausteine in rem (Vorgabe 1). */
export const gapOf = (style: PageStyle | undefined): number => style?.gap ?? 1;
