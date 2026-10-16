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
 *   Slajd (layout.slide)      Name im Menü des Slajds, Hintergrundschichten,
 *                             0084: wie er kommt (transition), wie sein Inhalt
 *                             erscheint (enter), eigene Farben (colors), und ob der
 *                             Baustein über die Slajdy hinweg bleibt (stage)
 * </code>
 *
 * <b>Duldsam wie alles, was als Zeichenkette vom Dienst kommt:</b> ein kaputter
 * Eintrag leert nur sich selbst — ein Slajd ohne lesbare Schichten bekommt den
 * Grund des Themas, nicht eine Fehlermeldung.
 */

import type { Layout } from './layout';
import { motionsJson, readMotions, type MotionUse } from './motion';
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

/*
 * 0107 — DIE LUFT DES ALTBESTANDS VON COGITA (`legacy/pages/cogita/CogitaPage.tsx`,
 * `cogita.css`: `.cogita-home-bg` und was darin liegt) — als Schichten wie die
 * anderen, für jeden Slajd und für das gemeinsame Tuch (`DeckLook.backdrop`).
 * Farben dürfen die Namen des Themas sein (`ground`, `accent`, …): dann gehen
 * sie mit den Farben der Slajdy mit.
 */

/** Ein Schein — ein weicher Lichtfleck (der „bloom" hinter dem Zeichen). */
export interface GlowLayer {
  readonly kind: 'glow';
  readonly speed: number;
  readonly color: string;
  /** Wo seine Mitte liegt, in Prozent. */
  readonly x: number;
  readonly y: number;
  /** Wo er ganz verblasst ist — Prozent des Abstands zur nächsten Kante. */
  readonly size: number;
  readonly opacity: number;
  readonly blend: Blend;
}

/** Abgedunkelte Ecken: zur Mitte hin klar, zu den Ecken dunkler. */
export interface VignetteLayer {
  readonly kind: 'vignette';
  readonly speed: number;
  /** Wie dunkel die Ecken werden (0–1). */
  readonly strength: number;
  /** Ab wo es dunkler wird (Prozent des Wegs zur Ecke). */
  readonly reach: number;
  readonly color: string;
}

/** Dunst: zwei dunkle und ein heller Fleck, stark verwischt, der langsam treibt (`drift`). */
export interface HazeLayer {
  readonly kind: 'haze';
  readonly speed: number;
  readonly color: string;
  readonly depth: string;
  readonly blur: number;
  readonly opacity: number;
  readonly motion: readonly MotionUse[];
}

/** Nici: feine, leuchtende Wellenlinien über dem unteren Rand, mit Staub — jede Schicht faluje für sich (`sway`). */
export interface MeshLayer {
  readonly kind: 'mesh';
  readonly speed: number;
  /** Aus ihm entsteht alles Zufällige — dieselbe Zahl, dasselbe Bild. */
  readonly seed: number;
  /** Wie viele Schichten Fäden übereinander (Altbestand: 4). */
  readonly count: number;
  readonly color: string;
  readonly glow: string;
  /** Wo die Welle liegt — Anteil der Höhe von oben (0.82: über dem unteren Rand). */
  readonly center: number;
  /** Wie hoch die Wellen schlagen (1: wie im Altbestand). */
  readonly amplitude: number;
  readonly opacity: number;
  readonly dust: boolean;
  readonly motion: readonly MotionUse[];
}

/** Fale: breite, verwischte Bänder am unteren Rand mit hellen Säumen — still, oder sie fliessen (`wave`). */
export interface WavesLayer {
  readonly kind: 'waves';
  readonly speed: number;
  readonly seed: number;
  readonly count: number;
  /** Farbton der Säume (Grad im Farbkreis) und wie weit er streut. */
  readonly hue: number;
  readonly spread: number;
  /** Faktor für Deckkraft und Unschärfe (1: wie im Altbestand). */
  readonly opacity: number;
  readonly blur: number;
  readonly motion: readonly MotionUse[];
}

export type Layer = GradientLayer | ImageLayer | BigTextLayer | GlowLayer | VignetteLayer | HazeLayer | MeshLayer | WavesLayer;
export type LayerKind = Layer['kind'];

export const LAYER_KINDS: readonly LayerKind[] = ['gradient', 'image', 'bigtext', 'glow', 'vignette', 'haze', 'mesh', 'waves'];

export type Blend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';
export const BLENDS: readonly Blend[] = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];

/** Je weiter hinten, desto langsamer — ausser beim Schriftzug, dort ist es die Weglänge. */
export const DEFAULT_SPEED: Record<LayerKind, number> = {
  gradient: 0.12, image: 0.34, bigtext: 0.95, glow: 0.12, vignette: 0, haze: 0.08, mesh: 0.05, waves: 0.05
};

/** 0107 — die Vorgaben der neuen Schichten: die Werte des Altbestands. */
export const LEGACY_AIR = {
  glow: { color: 'rgba(120, 170, 220, 0.18)', x: 58, y: 42, size: 60, opacity: 1 },
  vignette: { strength: 0.35, reach: 55, color: '#000000' },
  haze: { color: 'rgba(120, 170, 220, 0.08)', depth: 'rgba(30, 60, 100, 0.1)', blur: 60, opacity: 0.35 },
  mesh: { count: 4, color: 'rgba(143, 208, 255, 0.25)', glow: 'rgba(167, 224, 255, 0.35)', center: 0.82, amplitude: 1, opacity: 0.9 },
  waves: { count: 6, hue: 188, spread: 32 }
} as const;

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** 0107 — eine Farbe, wie sie in einer Schicht stehen darf: kurz, ohne Zeichen, die einen Stil beenden. */
const colorOf = (value: unknown, fallback: string): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' || text.length > 60 || /[;{}<>]/.test(text) ? fallback : text;
};

const within = (value: unknown, min: number, max: number, fallback: number): number =>
  Math.min(max, Math.max(min, num(value, fallback)));

/** 0107 — eine Schicht der Luft (Schein, Ecken, Dunst, Nici, Fale) — `null`: keine solche. */
function readAir(kind: string, one: Record<string, unknown>): Layer | null {
  const speed = clamp01(num(one.speed, DEFAULT_SPEED[kind as LayerKind] ?? 0));
  if (kind === 'glow') {
    const blend = str(one.blend, 'normal') as Blend;
    const d = LEGACY_AIR.glow;
    return {
      kind, speed, color: colorOf(one.color, d.color), x: within(one.x, -50, 150, d.x), y: within(one.y, -50, 150, d.y),
      size: within(one.size, 1, 200, d.size), opacity: clamp01(num(one.opacity, d.opacity)), blend: BLENDS.includes(blend) ? blend : 'normal'
    };
  }
  if (kind === 'vignette') {
    const d = LEGACY_AIR.vignette;
    return { kind, speed, strength: clamp01(num(one.strength, d.strength)), reach: within(one.reach, 0, 99, d.reach), color: colorOf(one.color, d.color) };
  }
  if (kind === 'haze') {
    const d = LEGACY_AIR.haze;
    return {
      kind, speed, color: colorOf(one.color, d.color), depth: colorOf(one.depth, d.depth), blur: within(one.blur, 0, 200, d.blur),
      opacity: clamp01(num(one.opacity, d.opacity)), motion: one.motion === undefined ? readMotions({ name: 'drift' }) : readMotions(one.motion)
    };
  }
  if (kind === 'mesh') {
    const d = LEGACY_AIR.mesh;
    return {
      kind, speed, seed: Math.round(within(one.seed, 0, 1_000_000, 7)), count: Math.round(within(one.count, 1, 8, d.count)),
      color: colorOf(one.color, d.color), glow: colorOf(one.glow, d.glow), center: within(one.center, 0, 1, d.center),
      amplitude: within(one.amplitude, 0, 4, d.amplitude), opacity: clamp01(num(one.opacity, d.opacity)), dust: one.dust !== false,
      motion: one.motion === undefined ? readMotions({ name: 'sway' }) : readMotions(one.motion)
    };
  }
  if (kind === 'waves') {
    const d = LEGACY_AIR.waves;
    return {
      kind, speed, seed: Math.round(within(one.seed, 0, 1_000_000, 7)), count: Math.round(within(one.count, 1, 12, d.count)),
      hue: within(one.hue, 0, 360, d.hue), spread: within(one.spread, 0, 360, d.spread),
      opacity: within(one.opacity, 0, 3, 1), blur: within(one.blur, 0, 3, 1), motion: readMotions(one.motion)
    };
  }
  return null;
}

/** Die Schichten aus dem, was gespeichert liegt — was nicht passt, fällt weg. */
export function readLayers(value: unknown): Layer[] {
  if (!Array.isArray(value)) return [];
  const out: Layer[] = [];

  for (const entry of value) {
    const one = record(entry);
    const kind = str(one.kind);
    const air = readAir(kind, one);
    if (air !== null) { out.push(air); continue; }

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

/**
 * 0107 — EINE SCHICHT, wie sie gespeichert wird und im JSON steht: die
 * Bewegungen knapp (`{ "name": "drift" }`), und ausdrücklich `[]`, wo eine
 * Schicht still stehen soll, die von sich aus treiben würde.
 */
export function layerJson(layer: Layer): Record<string, unknown> {
  if (layer.kind !== 'haze' && layer.kind !== 'mesh' && layer.kind !== 'waves') return { ...layer };
  const motion = motionsJson(layer.motion);
  return { ...layer, motion: motion === undefined ? [] : motion };
}

export const layersJson = (layers: readonly Layer[]): Record<string, unknown>[] => layers.map(layerJson);

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
  /* 0107 — die Luft: mit den Werten des Altbestands, der Schein in der Farbe des Akzents. */
  if (kind === 'glow') return readAir(kind, { color: theme.accent, opacity: 0.35 })!;
  if (kind !== 'gradient') return readAir(kind, {})!;
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
  /**
   * 0085 — DIE FARBEN FÜR DIE NACHT: steht hier etwas, folgt die Seite dem
   * Gerät — hell mit den Farben oben, dunkel mit diesen (wie die Startseite
   * des Altbestands). Fehlt es, gilt immer `mode`.
   */
  readonly night?: Palette | null;
}

/** Die vier Farben ohne den Modus. */
export interface Palette {
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
  /**
   * 0085 — die Szenen einer Präsentation, so wie sie im Aussehen liegen
   * (`presentation.ts` liest sie). Hier nur mitgetragen: wer die Seite als
   * Slajdy speichert, verliert sie nicht.
   */
  readonly show?: unknown;
  /** 0107 — was für die ganze Folge der Slajdy gilt (gemeinsames Tuch, Leiste, Titelslajd, Breite). Fehlt: wie bisher. */
  readonly deck?: DeckLook;
}

/**
 * 0107 — DIE FOLGE ALS GANZES.
 *
 * <code>
 *   backdrop    Schichten hinter ALLEN Slajdy, die stehen bleiben. Sind welche da,
 *               rollen die Slajdy durchsichtig darüber, und ihre eigenen Schichten
 *               liegen ebenfalls im Tuch: sie gehen beim Wechsel fliessend ineinander
 *               über (der Altbestand von Cogita: ein Hintergrund, dessen Farben sich
 *               je Slajd ändern, und Nici, Fale, Dunst darüber).
 *   nav         die Leiste: Namen oben (Vorgabe), Punkte rechts, keine
 *   titleSlide  false: kein Titelslajd, auch wenn die Seite Titel und Vorspann hat
 *               — der erste Baustein ist der erste Bildschirm
 *   width       wie breit die Bühne höchstens ist (rem): Plätze der wandernden
 *               Bausteine und der Aufbau der Slajdy (`layout`) rechnen darin, auf
 *               einem breiten Schirm bleibt das Bild beisammen
 * </code>
 */
export interface DeckLook {
  readonly backdrop: readonly Layer[];
  readonly nav: DeckNav;
  readonly titleSlide: boolean;
  readonly width: number | null;
}

export const DECK_NAVS = ['labels', 'dots', 'none'] as const;
export type DeckNav = (typeof DECK_NAVS)[number];

export const NO_DECK: DeckLook = { backdrop: [], nav: 'labels', titleSlide: true, width: null };

export const deckOf = (look: Look): DeckLook => look.deck ?? NO_DECK;

/** 0107 — die Folge aus dem Gespeicherten (oder dem Dokument) — duldsam. */
export function readDeck(value: unknown): DeckLook {
  const one = record(value);
  const nav = str(one.nav) as DeckNav;
  const width = typeof one.width === 'number' && Number.isFinite(one.width) ? Math.min(240, Math.max(20, one.width)) : null;
  return {
    backdrop: readLayers(one.backdrop),
    nav: DECK_NAVS.includes(nav) ? nav : 'labels',
    titleSlide: one.titleSlide !== false,
    width
  };
}

/** 0107 — die Folge KNAPP: was der Vorgabe entspricht, fehlt; ganz wie bisher — `undefined`. */
export function deckJson(deck: DeckLook): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (deck.backdrop.length > 0) out.backdrop = layersJson(deck.backdrop);
  if (deck.nav !== 'labels') out.nav = deck.nav;
  if (!deck.titleSlide) out.titleSlide = false;
  if (deck.width !== null) out.width = deck.width;
  return Object.keys(out).length === 0 ? undefined : out;
}

export const NO_LOOK: Look = { theme: null, cover: [] };

export function readLook(json: string | null | undefined): Look {
  if (json == null || json.trim() === '') return NO_LOOK;
  try {
    const one = record(JSON.parse(json));
    const mode = str(one.mode);
    const night = readPalette(one.night);
    const theme: Theme | null = mode === 'dark' || mode === 'light'
      ? {
        mode,
        accent: str(one.accent, DEFAULT_THEMES[mode].accent),
        ink: str(one.ink, DEFAULT_THEMES[mode].ink),
        ground: str(one.ground, DEFAULT_THEMES[mode].ground),
        muted: str(one.muted, DEFAULT_THEMES[mode].muted),
        ...(night === null ? {} : { night })
      }
      : null;
    const deck = one.deck === undefined || one.deck === null ? undefined : readDeck(one.deck);
    return {
      theme,
      cover: readLayers(record(one.cover).layers),
      ...(one.show === undefined || one.show === null ? {} : { show: one.show }),
      ...(deck === undefined || deckJson(deck) === undefined ? {} : { deck })
    };
  } catch {
    return NO_LOOK;
  }
}

export function writeLook(look: Look): string | null {
  const show = look.show ?? null;
  const deck = look.deck === undefined ? undefined : deckJson(look.deck);
  if (look.theme === null && look.cover.length === 0 && show === null && deck === undefined) return null;
  const { night, ...theme } = look.theme ?? { mode: 'auto' as const, night: null };
  return JSON.stringify({
    ...theme,
    ...(night == null ? {} : { night }),
    cover: { layers: layersJson(look.cover) },
    ...(show === null ? {} : { show }),
    ...(deck === undefined ? {} : { deck })
  });
}

/** 0085 — vier Farben aus dem Gespeicherten; fehlt eine, gibt es keine Nachtfarben. */
export function readPalette(value: unknown): Palette | null {
  const one = record(value);
  const accent = str(one.accent).trim(), ink = str(one.ink).trim(), ground = str(one.ground).trim(), muted = str(one.muted).trim();
  return accent !== '' && ink !== '' && ground !== '' && muted !== '' ? { accent, ink, ground, muted } : null;
}

/**
 * Das Thema, das gerade gilt — beim automatischen das des Geräts; mit
 * Nachtfarben (0085) auf einem dunklen Gerät diese.
 */
export const resolveTheme = (theme: Theme | null, dark: boolean): Theme =>
  theme === null ? APP_THEMES[dark ? 'dark' : 'light']
  : dark && theme.night != null ? { mode: 'dark', ...theme.night }
  : theme;

/* -- Wie ein Slajd kommt (0084) ------------------------------------------------- */

/**
 * WIE DIESER SLAJD DEN VORIGEN ABLÖST — gerechnet aus der Stelle der Bahn,
 * nicht aus einer Uhr: wer langsam zieht, sieht das Ablösen langsam, wer
 * zurückzieht, sieht es rückwärts (`slideMotion.ts`).
 */
export const TRANSITIONS = ['scroll', 'fade', 'cover', 'reveal', 'zoom', 'side', 'dissolve'] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const TRANSITION_LABEL: Record<Transition, string> = {
  scroll: 'Przewinięcie — wjeżdża od dołu, jak kartka (zwykłe)',
  fade: 'Przenikanie — poprzedni stoi, ten pojawia się na nim',
  cover: 'Nakrycie — ten wjeżdża na poprzedni, który stoi i przygasa',
  reveal: 'Odsłonięcie — poprzedni odjeżdża w górę i odsłania ten',
  zoom: 'Przybliżenie — poprzedni rośnie i znika, ten wyłania się z głębi',
  side: 'Z boku — ten wjeżdża z prawej, poprzedni odsuwa się w lewo',
  /* 0107 — der Wechsel des Altbestands von Cogita (.cogita-intro-slide: 480 ms, 12 px, Unschärfe 2 px). */
  dissolve: 'Rozmycie — poprzedni gaśnie, rozmywa się i opada, ten wyostrza się, unosząc (jak pokaz Cogita)'
};

/** Wie der INHALT eines Slajds erscheint, während er hereinkommt — ebenfalls an der Bahn, nicht an der Uhr. */
export const ENTERS = ['none', 'rise', 'fade', 'zoom', 'left', 'right'] as const;
export type Enter = (typeof ENTERS)[number];

export const ENTER_LABEL: Record<Enter, string> = {
  none: 'Bez efektu',
  rise: 'Wynurza się z dołu',
  fade: 'Rozjaśnia się',
  zoom: 'Przybliża się',
  left: 'Wsuwa się z lewej',
  right: 'Wsuwa się z prawej'
};

/** Eigene Farben eines Slajds — `null` je Farbe: die der Seite. Zwischen zwei Slajdy gehen sie fliessend über. */
export interface SlideColors {
  readonly accent: string | null;
  readonly ink: string | null;
  readonly ground: string | null;
  readonly muted: string | null;
}

export const COLOR_KEYS = ['accent', 'ink', 'ground', 'muted'] as const;

/* -- Was über die Slajdy hinweg bleibt (0084) -------------------------------------- */

/**
 * WO EIN WANDERNDER BAUSTEIN AUF EINEM SLAJD STEHT. `x`, `y` — seine Mitte, in
 * Prozent der Bühne; `w` — seine Breite in Prozent (auf schmalen Schirmen
 * breiter); `scale`, `rotate` (Grad), `opacity` 0–1.
 */
export interface StageFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly scale: number;
  readonly rotate: number;
  readonly opacity: number;
  /** 0107 — höchstens so breit (rem); `null`: nur `w`. Das Zeichen bleibt auf einem grossen Schirm ein Zeichen. */
  readonly max?: number | null;
  /** 0107 — andere Werte auf einem hohen Schirm (Telefon hochkant) — nur, was sich unterscheidet. */
  readonly tall?: TallFrame | null;
}

/** 0107 — ein Platz auf einem hohen Schirm: was dort anders ist. Mit eigener Breite gilt auf dem Telefon genau sie. */
export interface TallFrame {
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly scale?: number;
  readonly rotate?: number;
  readonly opacity?: number;
}

export const STAGE_FRAME: StageFrame = { x: 50, y: 50, w: 30, scale: 1, rotate: 0, opacity: 1 };

/** 0107 — der Platz, der gerade gilt: auf einem hohen Schirm mit seinen eigenen Werten. */
export const frameFor = (frame: StageFrame, tall: boolean): StageFrame =>
  !tall || frame.tall == null ? frame : { ...frame, ...frame.tall };

/** Der Titelslajd, wo ein wandernder Baustein auf ihm steht. */
export const COVER_KEY = 'cover';

/**
 * EIN BAUSTEIN, DER DEN WECHSEL ÜBERLEBT: er bekommt keinen eigenen Slajd,
 * sondern steht über allen und wechselt seinen Platz von einem zum nächsten.
 * `frames` — je Slajd (die Kennung seines Bausteins, oder `cover`) ein Platz;
 * zwischen zwei Plätzen gleitet er, vor dem ersten und nach dem letzten bleibt
 * er stehen. `bare` — ohne Tafel (ein Logo, ein Bild, ein grosser Knopf).
 */
export interface Stage {
  readonly frames: Readonly<Record<string, StageFrame>>;
  readonly bare: boolean;
}

/* -- Ein Slajd ------------------------------------------------------------------ */

/* -- 0107: wie der Inhalt auf dem Slajd steht, und wer neben wem ---------------------- */

export const ALIGNS3 = ['start', 'center', 'end'] as const;
export type Align3 = (typeof ALIGNS3)[number];

/**
 * WO DER INHALT EINES SLAJDS STEHT. Ohne Angabe: in der Mitte, so breit wie
 * ein Text gut zu lesen ist (wie bisher). Sonst: links, mittig oder rechts in
 * der Bühne (`DeckLook.width`), `width` Prozent davon breit, oben, mittig oder
 * unten — und auf einem hohen Schirm (`tall`) anders, etwa unten über die ganze
 * Breite, damit oben das Zeichen Platz hat.
 */
export interface SlideLayout {
  readonly align: Align3;
  readonly valign: Align3;
  readonly width: number | null;
  readonly tall: { readonly align?: Align3; readonly valign?: Align3; readonly width?: number | null } | null;
}

/** Was gerade gilt: auf einem hohen Schirm mit seinen eigenen Werten. */
export const layoutFor = (layout: SlideLayout, tall: boolean): { align: Align3; valign: Align3; width: number | null } =>
  !tall || layout.tall === null ? layout : {
    align: layout.tall.align ?? layout.align,
    valign: layout.tall.valign ?? layout.valign,
    width: layout.tall.width === undefined ? layout.width : layout.tall.width
  };

/**
 * EIN BAUSTEIN NEBEN EINEM ANDEREN: er hat keinen eigenen Slajd, sondern steht
 * auf dem Slajd von `slide` — daneben (`side`: vor oder nach ihm), `share`
 * Prozent der Reihe breit; auf einem hohen Schirm darüber oder darunter
 * (`tallSide`). Das Bild neben dem Text, die Animacja neben dem Hasło.
 */
export interface SlideCompanion {
  readonly slide: string;
  readonly side: 'start' | 'end';
  readonly share: number;
  readonly tallSide: 'start' | 'end';
}

const align3 = (value: unknown, fallback: Align3): Align3 => (ALIGNS3.includes(value as Align3) ? value as Align3 : fallback);

function readLayout(value: unknown): SlideLayout | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const one = record(value);
  const widthOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(10, v)) : null);
  const t = typeof one.tall === 'object' && one.tall !== null ? record(one.tall) : null;
  const tall = t === null ? null : {
    ...(t.align === undefined ? {} : { align: align3(t.align, 'center') }),
    ...(t.valign === undefined ? {} : { valign: align3(t.valign, 'center') }),
    ...(t.width === undefined ? {} : { width: widthOf(t.width) })
  };
  return {
    align: align3(one.align, 'center'),
    valign: align3(one.valign, 'center'),
    width: widthOf(one.width),
    tall: tall === null || Object.keys(tall).length === 0 ? null : tall
  };
}

function layoutJson(layout: SlideLayout): Record<string, unknown> {
  return {
    ...(layout.align === 'center' ? {} : { align: layout.align }),
    ...(layout.valign === 'center' ? {} : { valign: layout.valign }),
    ...(layout.width === null ? {} : { width: layout.width }),
    ...(layout.tall === null ? {} : { tall: layout.tall })
  };
}

function readCompanion(value: unknown): SlideCompanion | null {
  const one = typeof value === 'string' ? { slide: value } : record(value);
  const slide = typeof one.slide === 'string' ? one.slide.trim().slice(0, 64) : '';
  if (slide === '') return null;
  const side = one.side === 'start' ? 'start' : 'end';
  return {
    slide,
    side,
    share: Math.round(within(one.share, 10, 90, 45)),
    tallSide: one.tallSide === 'start' || one.tallSide === 'end' ? one.tallSide : side
  };
}

function companionJson(c: SlideCompanion): Record<string, unknown> {
  return { slide: c.slide, side: c.side, share: c.share, ...(c.tallSide === c.side ? {} : { tallSide: c.tallSide }) };
}

/* -- Ein Slajd ------------------------------------------------------------------ */

/** Was ein Baustein als Slajd trägt (`layout.slide`). */
export interface SlideLook {
  /** Sein Name im Menü der Slajdy — leer: der Titel des Bausteins, sonst seine Art. */
  readonly label: string;
  readonly layers: readonly Layer[];
  /** 0084 — wie er den vorigen ablöst (Vorgabe: `scroll`, wie bisher). */
  readonly transition: Transition;
  /** 0084 — wie sein Inhalt erscheint (Vorgabe: `none`, wie bisher). */
  readonly enter: Enter;
  readonly colors: SlideColors | null;
  /** 0084 — nicht `null`: der Baustein wandert über die Slajdy, statt selbst einer zu sein. */
  readonly stage: Stage | null;
  /** 0107 — seine Bewegungen (`motion.ts`): ein Auftritt, wenn sein Slajd erreicht ist, und/oder eine Schleife. */
  readonly motion: readonly MotionUse[];
  /** 0107 — wo der Inhalt seines Slajds steht. `null`: in der Mitte, wie bisher. */
  readonly layout: SlideLayout | null;
  /** 0107 — nicht `null`: er steht neben einem anderen Baustein auf dessen Slajd. */
  readonly with: SlideCompanion | null;
}

const between = (value: unknown, min: number, max: number, fallback: number): number =>
  Math.min(max, Math.max(min, num(value, fallback)));

function readTallFrame(value: unknown): TallFrame | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const one = record(value);
  const out: { -readonly [K in keyof TallFrame]: TallFrame[K] } = {};
  if (typeof one.x === 'number') out.x = between(one.x, -50, 150, STAGE_FRAME.x);
  if (typeof one.y === 'number') out.y = between(one.y, -50, 150, STAGE_FRAME.y);
  if (typeof one.w === 'number') out.w = between(one.w, 4, 100, STAGE_FRAME.w);
  if (typeof one.scale === 'number') out.scale = between(one.scale, 0.1, 4, STAGE_FRAME.scale);
  if (typeof one.rotate === 'number') out.rotate = between(one.rotate, -360, 360, STAGE_FRAME.rotate);
  if (typeof one.opacity === 'number') out.opacity = between(one.opacity, 0, 1, STAGE_FRAME.opacity);
  return Object.keys(out).length === 0 ? null : out;
}

function readFrame(value: unknown): StageFrame | null {
  if (typeof value !== 'object' || value === null) return null;
  const one = record(value);
  const max = typeof one.max === 'number' && Number.isFinite(one.max) ? between(one.max, 1, 200, 30) : null;
  const tall = readTallFrame(one.tall);
  return {
    x: between(one.x, -50, 150, STAGE_FRAME.x),
    y: between(one.y, -50, 150, STAGE_FRAME.y),
    w: between(one.w, 4, 100, STAGE_FRAME.w),
    scale: between(one.scale, 0.1, 4, STAGE_FRAME.scale),
    rotate: between(one.rotate, -360, 360, STAGE_FRAME.rotate),
    opacity: between(one.opacity, 0, 1, STAGE_FRAME.opacity),
    ...(max === null ? {} : { max }),
    ...(tall === null ? {} : { tall })
  };
}

const colorOrNull = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** Ein Slajd aus dem, was gespeichert liegt (oder in einem Dokument steht) — duldsam. */
export function readSlideValue(value: unknown): SlideLook {
  const one = record(value);
  const transition = str(one.transition) as Transition;
  const enter = str(one.enter) as Enter;

  const c = record(one.colors);
  const colors: SlideColors = { accent: colorOrNull(c.accent), ink: colorOrNull(c.ink), ground: colorOrNull(c.ground), muted: colorOrNull(c.muted) };

  let stage: Stage | null = null;
  if (typeof one.stage === 'object' && one.stage !== null) {
    const raw = record(record(one.stage).frames);
    const frames: Record<string, StageFrame> = {};
    for (const [key, frame] of Object.entries(raw)) {
      const read = readFrame(frame);
      if (read !== null && key.trim() !== '') frames[key.trim()] = read;
    }
    stage = { frames, bare: record(one.stage).bare === true };
  }

  return {
    label: str(one.label).trim(),
    layers: readLayers(one.layers),
    transition: TRANSITIONS.includes(transition) ? transition : 'scroll',
    enter: ENTERS.includes(enter) ? enter : 'none',
    colors: COLOR_KEYS.some((k) => colors[k] !== null) ? colors : null,
    stage,
    motion: readMotions(one.motion),
    layout: readLayout(one.layout),
    /* Wer wandert, steht über allen — nicht neben einem. */
    with: stage === null ? readCompanion(one.with) : null
  };
}

export const readSlide = (layout: Layout): SlideLook => readSlideValue(layout.slide);

/**
 * Ein Slajd, wie er gespeichert wird und im JSON steht — KNAPP: was der
 * Vorgabe entspricht, fehlt. Ein Slajd ohne die Neuerungen von 0084 sieht
 * genauso aus wie vorher.
 */
export function slideJson(slide: SlideLook): Record<string, unknown> {
  const colors = slide.colors === null ? null
    : Object.fromEntries(COLOR_KEYS.filter((k) => slide.colors![k] !== null).map((k) => [k, slide.colors![k]]));
  const motion = motionsJson(slide.motion);
  const layout = slide.layout === null ? null : layoutJson(slide.layout);
  return {
    label: slide.label,
    layers: layersJson(slide.layers),
    ...(slide.transition === 'scroll' ? {} : { transition: slide.transition }),
    ...(slide.enter === 'none' ? {} : { enter: slide.enter }),
    ...(colors === null || Object.keys(colors).length === 0 ? {} : { colors }),
    ...(slide.stage === null ? {} : { stage: { frames: slide.stage.frames, ...(slide.stage.bare ? { bare: true } : {}) } }),
    ...(motion === undefined ? {} : { motion }),
    ...(layout === null || Object.keys(layout).length === 0 ? {} : { layout }),
    ...(slide.with === null ? {} : { with: companionJson(slide.with) })
  };
}

export const withSlide = (layout: Layout, slide: SlideLook): Layout => ({ ...layout, slide: slideJson(slide) });

/**
 * Die Kennungen, auf die ein Slajd zeigt — die Plätze eines wandernden
 * Bausteins (0084) und der Baustein, neben dem er steht (0107) —, nach einem
 * Import die neuen.
 */
export function remapSlide(slide: SlideLook, ids: ReadonlyMap<string, string>): SlideLook {
  let out = slide;
  if (slide.stage !== null) {
    const frames: Record<string, StageFrame> = {};
    for (const [key, frame] of Object.entries(slide.stage.frames)) frames[ids.get(key) ?? key] = frame;
    out = { ...out, stage: { ...slide.stage, frames } };
  }
  if (slide.with !== null) out = { ...out, with: { ...slide.with, slide: ids.get(slide.with.slide) ?? slide.with.slide } };
  return out;
}

/** Der alte Name (0084) — dieselbe Rechnung. */
export const remapStage = remapSlide;

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
  const plain = withoutAnchor(hash);
  const at = plain.indexOf('?');
  if (at < 0) return null;
  const n = Number.parseInt(new URLSearchParams(plain.slice(at + 1)).get('s') ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n - 1 : null;
}

/**
 * 0086 — DER ANKER IN DER ADRESSE: `#/<seite>#zapisy` (oder `…?s=2#zapisy`) —
 * der Teil hinter der zweiten Raute, kleingeschrieben; leer, wenn keiner da ist.
 * So führt ein Link (etwa der nach dem Absenden) auf einen Slajd nach seinem Namen.
 */
export function anchorInAddress(hash: string): string {
  const first = hash.indexOf('#');
  const second = first < 0 ? -1 : hash.indexOf('#', first + 1);
  if (second < 0) return '';
  try { return decodeURIComponent(hash.slice(second + 1)).trim().toLowerCase(); } catch { return hash.slice(second + 1).trim().toLowerCase(); }
}

/** Die Adresse ohne ihren Anker. */
const withoutAnchor = (hash: string): string => {
  const first = hash.indexOf('#');
  const second = first < 0 ? -1 : hash.indexOf('#', first + 1);
  return second < 0 ? hash : hash.slice(0, second);
};

/** Welcher Slajd zu einem Anker gehört — nach seinem Namen (`anchorOf`) oder der Kennung seines Bausteins. */
export function slideByAnchor(slides: readonly { readonly id?: string; readonly label: string }[], anchor: string): number | null {
  if (anchor === '') return null;
  const at = slides.findIndex((one) => anchorOf(one.label) === anchor || (one.id !== undefined && one.id.toLowerCase() === anchor));
  return at < 0 ? null : at;
}

export function addressWithSlide(hash: string, index: number): string {
  const base = withoutAnchor(hash).split('?')[0];
  return index <= 0 ? base : `${base}?s=${index + 1}`;
}
