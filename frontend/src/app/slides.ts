/**
 * EINE SEITE ALS SLAJDY (0062) — was ein Slajd ist, und wie die Seite aussieht.
 *
 * <b>Aus dem Altbestand übernommen</b> (`legacy/pages/events/shell/layers.ts`):
 * dieselben drei Hintergrundschichten, dieselbe Bedeutung der Geschwindigkeit,
 * dieselben vier Farben eines Themas. Wer dort ein Ereignis gebaut hat, findet
 * hier dieselben Regler.
 *
 * <code>
 *   Seite (slug.page_mode)    'page' — Bausteine im Raster · 'slides' — je Baustein ein Slajd
 *   Aussehen (page_theme)     hell/dunkel/automatisch, vier Farben, der Titelslajd
 *   Slajd (layout.slide)      Name im Menü des Slajds, Hintergrundschichten
 * </code>
 *
 * <b>Duldsam wie alles, was als Zeichenkette vom Dienst kommt:</b> ein kaputter
 * Eintrag leert nur sich selbst — ein Slajd ohne lesbare Schichten bekommt den
 * Grund des Themas, nicht eine Fehlermeldung.
 */

import type { Layout } from './layout';
import { API } from './session';

/* -- Schichten ---------------------------------------------------------------- */

/**
 * Hintergrund hinter einem Slajd, von hinten nach vorn. `speed` ist der Anteil
 * der Bewegung des Slajds, den die Schicht mitmacht: 0 steht, 1 läuft mit dem
 * Inhalt. Beim grossen Schriftzug ist es die Länge seines Wegs über den
 * Bildschirm (1 = ganze Höhe).
 */
export interface GradientLayer {
  readonly kind: 'gradient';
  readonly speed: number;
  readonly angle: number;
  readonly from: string;
  readonly via: string | null;
  readonly to: string;
}

export interface ImageLayer {
  readonly kind: 'image';
  readonly speed: number;
  /** Eine Adresse — oder `page-image:<id>`, ein Bild dieser Seite (PageImage.cs). */
  readonly url: string;
  readonly opacity: number;
  readonly blend: Blend;
  readonly position: string;
}

export interface BigTextLayer {
  readonly kind: 'bigtext';
  readonly speed: number;
  readonly lines: readonly string[];
  readonly opacity: number;
  readonly color: string | null;
}

export type Layer = GradientLayer | ImageLayer | BigTextLayer;
export type LayerKind = Layer['kind'];

export type Blend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';
export const BLENDS: readonly Blend[] = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];

/** Je weiter hinten, desto langsamer — ausser beim Schriftzug, dort ist es die Weglänge. */
export const DEFAULT_SPEED: Record<LayerKind, number> = { gradient: 0.12, image: 0.34, bigtext: 0.95 };

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Die Schichten aus dem, was gespeichert liegt — was nicht passt, fällt weg. */
export function readLayers(value: unknown): Layer[] {
  if (!Array.isArray(value)) return [];
  const out: Layer[] = [];

  for (const entry of value) {
    const one = record(entry);
    const kind = str(one.kind);

    if (kind === 'gradient') {
      out.push({
        kind, speed: clamp01(num(one.speed, DEFAULT_SPEED.gradient)), angle: num(one.angle, 168),
        from: str(one.from, '#12203a'), via: typeof one.via === 'string' && one.via !== '' ? one.via : null, to: str(one.to, '#060a12')
      });
    } else if (kind === 'image') {
      /* Eine leere Adresse ist eine Schicht, die gerade entsteht — nicht eine kaputte. */
      const blend = str(one.blend, 'normal') as Blend;
      out.push({
        kind, speed: clamp01(num(one.speed, DEFAULT_SPEED.image)), url: str(one.url).trim(),
        opacity: clamp01(num(one.opacity, 0.45)), blend: BLENDS.includes(blend) ? blend : 'normal', position: str(one.position, 'center')
      });
    } else if (kind === 'bigtext') {
      const lines = Array.isArray(one.lines) ? one.lines.filter((l): l is string => typeof l === 'string').slice(0, 3) : [];
      out.push({
        kind, speed: clamp01(num(one.speed, DEFAULT_SPEED.bigtext)), lines,
        opacity: clamp01(num(one.opacity, 0.1)), color: typeof one.color === 'string' && one.color !== '' ? one.color : null
      });
    }
  }

  return out;
}

/** Eine Farbe hin zu Weiss (`amount` > 0) oder Schwarz (< 0) — für einen Verlauf aus dem Grund des Themas. */
export function shade(hex: string, amount: number): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return null;
  const n = Number.parseInt(m[1], 16);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Der Verlauf aus dem Grund des Themas: oben etwas heller, unten dunkler. */
function groundGradient(theme: Theme): { from: string; to: string } {
  const light = theme.mode === 'light';
  const from = shade(theme.ground, light ? 0.55 : 0.07);
  const to = shade(theme.ground, light ? -0.07 : -0.4);
  return from !== null && to !== null ? { from, to } : STARTING_GROUND[theme.mode];
}

/** Eine neue Schicht dieser Art — auf dem Grund des Themas, damit sie nicht gleich gegen ihn arbeitet. */
export function blankLayer(kind: LayerKind, theme: Theme): Layer {
  if (kind === 'image') return { kind, speed: DEFAULT_SPEED.image, url: '', opacity: 0.45, blend: 'normal', position: 'center' };
  if (kind === 'bigtext') return { kind, speed: DEFAULT_SPEED.bigtext, lines: ['NAPIS'], opacity: 0.09, color: null };
  const ground = groundGradient(theme);
  return { kind, speed: DEFAULT_SPEED.gradient, angle: 168, from: ground.from, via: null, to: ground.to };
}

/**
 * Das Tuch eines Slajds ohne eigene Schichten — und der Anfang, wenn man sie
 * anpasst: ein Verlauf aus dem Grund des Themas und der Name als grosser,
 * blasser Schriftzug (wie im Altbestand).
 */
export function defaultLayers(label: string, theme: Theme): Layer[] {
  const word = label.trim().toUpperCase() || 'SEKCJA';
  const ground = groundGradient(theme);
  return [
    { kind: 'gradient', speed: DEFAULT_SPEED.gradient, angle: 168, from: ground.from, via: null, to: ground.to },
    { kind: 'bigtext', speed: DEFAULT_SPEED.bigtext, lines: [word.slice(0, 40)], opacity: 0.08, color: null }
  ];
}

/** Wo ein Bild liegt: eine Adresse, oder ein Bild dieser Seite beim Dienst. */
export function imageUrl(url: string): string {
  const own = /^page-image:([0-9a-f-]{36})$/i.exec(url.trim());
  return own === null ? url.trim() : `${API}/page-image/${own[1]}`;
}

/* -- Das Thema ------------------------------------------------------------------ */

export type ThemeMode = 'dark' | 'light';

export interface Theme {
  readonly mode: ThemeMode;
  readonly accent: string;
  readonly ink: string;
  readonly ground: string;
  readonly muted: string;
}

/** Die Vorgaben je Modus — wie im Altbestand, damit ein umgezogenes Ereignis gleich aussieht. */
export const DEFAULT_THEMES: Record<ThemeMode, Theme> = {
  dark: { mode: 'dark', accent: '#4c7dd6', ink: '#eef2f8', ground: '#080d15', muted: '#a3b2c9' },
  light: { mode: 'light', accent: '#2f5fb5', ink: '#16202e', ground: '#f4f6fa', muted: '#5a6a80' }
};

/** „Automatisch": die Farben des Arbeitsplatzes, hell oder dunkel wie das Gerät. */
export const APP_THEMES: Record<ThemeMode, Theme> = {
  light: { mode: 'light', accent: '#7a5a2e', ink: '#1a1815', ground: '#f7f5f1', muted: '#5b554c' },
  dark: { mode: 'dark', accent: '#d3a25e', ink: '#f0ebe0', ground: '#16140f', muted: '#b0a695' }
};

const STARTING_GROUND: Record<ThemeMode, { from: string; to: string }> = {
  dark: { from: '#12203a', to: '#060a12' },
  light: { from: '#fbfcfe', to: '#dfe7f2' }
};

/**
 * WIE DIE SEITE AUSSIEHT, wie es gespeichert liegt (`slug.page_theme`).
 *
 * `theme: null` — automatisch: die Farben des Arbeitsplatzes, hell oder dunkel
 * wie das Gerät des Besuchers. `cover` — die Schichten des Titelslajds (Titel
 * und Vorspann der Seite).
 */
export interface Look {
  readonly theme: Theme | null;
  readonly cover: readonly Layer[];
}

export const NO_LOOK: Look = { theme: null, cover: [] };

export function readLook(json: string | null | undefined): Look {
  if (json == null || json.trim() === '') return NO_LOOK;
  try {
    const one = record(JSON.parse(json));
    const mode = str(one.mode);
    const theme: Theme | null = mode === 'dark' || mode === 'light'
      ? {
        mode,
        accent: str(one.accent, DEFAULT_THEMES[mode].accent),
        ink: str(one.ink, DEFAULT_THEMES[mode].ink),
        ground: str(one.ground, DEFAULT_THEMES[mode].ground),
        muted: str(one.muted, DEFAULT_THEMES[mode].muted)
      }
      : null;
    return { theme, cover: readLayers(record(one.cover).layers) };
  } catch {
    return NO_LOOK;
  }
}

export function writeLook(look: Look): string | null {
  if (look.theme === null && look.cover.length === 0) return null;
  return JSON.stringify({ ...(look.theme ?? { mode: 'auto' }), cover: { layers: look.cover } });
}

/** Das Thema, das gerade gilt — beim automatischen das des Geräts. */
export const resolveTheme = (theme: Theme | null, dark: boolean): Theme =>
  theme ?? APP_THEMES[dark ? 'dark' : 'light'];

/* -- Ein Slajd ------------------------------------------------------------------ */

/** Was ein Baustein als Slajd trägt (`layout.slide`). */
export interface SlideLook {
  /** Sein Name im Menü der Slajdy — leer: der Titel des Bausteins, sonst seine Art. */
  readonly label: string;
  readonly layers: readonly Layer[];
}

export function readSlide(layout: Layout): SlideLook {
  const one = record(layout.slide);
  return { label: str(one.label).trim(), layers: readLayers(one.layers) };
}

export const withSlide = (layout: Layout, slide: SlideLook): Layout =>
  ({ ...layout, slide: { label: slide.label, layers: slide.layers } });

/**
 * Wie ein Slajd als Adresse heisst — aus seinem Namen, Buchstabe für Buchstabe
 * wie im Altbestand (`partAnchor`), damit ein Verweis `#zapisy` im Text auf
 * den Slajd „Zapisy" führt.
 */
export const anchorOf = (label: string): string =>
  label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Welcher Slajd in der Adresse steht: `#/<seite>?s=3` — ab 1 gezählt, der erste
 * ohne Zahl. Hinter `?` liest die Weiche nichts mehr (`parsePath`).
 */
export function slideInAddress(hash: string): number | null {
  const at = hash.indexOf('?');
  if (at < 0) return null;
  const n = Number.parseInt(new URLSearchParams(hash.slice(at + 1)).get('s') ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n - 1 : null;
}

export function addressWithSlide(hash: string, index: number): string {
  const base = hash.split('?')[0];
  return index <= 0 ? base : `${base}?s=${index + 1}`;
}
