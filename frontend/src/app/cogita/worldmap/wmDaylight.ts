/**
 * 2026-11-12 (Eigentümer: „neben hell und dunkel eine Färbung nach der Tageszeit — anders am Morgen, am Mittag, am Abend, in
 * der Nacht, mit Verläufen; sie ist die Vorgabe") — DAS LICHT DER WELTKARTE, rein:
 * <code>
 *   'day'    (Vorgabe) die Uhr des Geräts färbt die Karte: Nacht (dunkel, blau) → Morgendämmerung (rosa) → Morgen (frisch) →
 *            Mittag (klar, kaum Tönung) → Nachmittag (warm) → goldene Stunde (orange) → Abenddämmerung (violett) → Nacht.
 *            Zwischen den Stationen (KEYS) gleitet alles stetig (kein Sprung); die Karte holt das Licht alle paar Minuten neu.
 *   'light'  immer hell, 'dark' immer dunkel (wie bisher, unabhängig von der App)
 * </code>
 * Was sich mit der Zeit ändert: die Farben des Geländes (Wasser, Strand, Land, Bäume), eine Tönung der Türme, ein Verlauf über
 * dem Wasser (oben der Himmel), ein Schein der Sonne (oder des Mondes) von ihrer Seite und die Richtung der Baumschatten.
 * Lesbar bleibt es immer: Schrift (`ink`) und Grund (`surface`) wechseln gemeinsam bei halber Dunkelheit — nie Grau auf Grau.
 * Die Wahl gilt je Gerät (`cg-wm-light`), wie „Animacje".
 */

import { mix, type Rgb } from './wmColors';

export type MapLight = 'day' | 'light' | 'dark';
export const MAP_LIGHTS: readonly MapLight[] = ['day', 'light', 'dark'];
export type DayPhase = 'night' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'dusk';

export interface MapPalette {
  readonly floor: Rgb;
  readonly floorDeep: Rgb;
  readonly surface: Rgb;
  readonly ink: Rgb;
  readonly haze: Rgb;
  readonly lit: Rgb;
  readonly casing: Rgb;
  readonly goal: Rgb;
  readonly dark: boolean;
  readonly water: Rgb;
  readonly sand: Rgb;
  readonly land: Rgb;
  readonly tree: Rgb;
  readonly treeShade: Rgb;
  readonly treeLight: Rgb;
  readonly trunk: Rgb;
  readonly star: Rgb;
  /** Oben über dem Wasser (der Himmel spiegelt sich): der Verlauf geht von `sky` (oben) zu `water` (unten). */
  readonly sky: Rgb;
  /** Der Schein der Sonne oder des Mondes: wo (0 links … 1 rechts), Farbe, Stärke 0…1. */
  readonly glow: { readonly x: number; readonly colour: Rgb; readonly a: number };
  /** Die Türme: so viel zur Tönung hin (Abendrot, Nachtblau). */
  readonly tint: Rgb;
  readonly tintK: number;
  /** Die Schatten der Bäume: Versatz in Baumgrössen (die Sonne steht gegenüber). */
  readonly shadow: { readonly dx: number; readonly dy: number };
  readonly phase: DayPhase | null;
  /** Für Zwischenspeicher: ändert sich, sobald sich die Farben merklich ändern (je Licht, in Zehn-Minuten-Schritten). */
  readonly key: string;
}

/** Die zwei Grundfarbsätze (wie die App: base.css, landscape.css). */
const BASE = {
  light: { surface: [255, 255, 255] as Rgb, floor: [243, 240, 234] as Rgb, ink: [26, 24, 21] as Rgb, lit: [176, 120, 0] as Rgb, goal: [47, 127, 208] as Rgb },
  dark: { surface: [31, 28, 22] as Rgb, floor: [29, 26, 21] as Rgb, ink: [240, 235, 224] as Rgb, lit: [242, 183, 5] as Rgb, goal: [106, 174, 255] as Rgb }
};

/** Ein fester Farbsatz (hell oder dunkel) — die Formeln von früher. */
function solid(dark: boolean): Omit<MapPalette, 'sky' | 'glow' | 'tint' | 'tintK' | 'shadow' | 'phase' | 'key'> {
  const b = dark ? BASE.dark : BASE.light;
  const { surface, floor, ink } = b;
  return {
    floor, surface, ink, dark, lit: b.lit, goal: b.goal,
    floorDeep: mix(floor, ink, dark ? 0.16 : 0.1),
    haze: mix(surface, floor, 0.5),
    casing: mix(floor, ink, dark ? 0.24 : 0.14),
    water: dark ? mix(surface, [40, 78, 110], 0.55) : mix(surface, [150, 196, 222], 0.6),
    sand: dark ? mix(floor, [92, 80, 56], 0.55) : mix(floor, [236, 220, 178], 0.7),
    land: dark ? mix(floor, [44, 64, 40], 0.45) : mix(floor, [204, 222, 178], 0.45),
    tree: dark ? [62, 104, 62] : [110, 158, 96],
    treeShade: dark ? [34, 58, 36] : [76, 116, 70],
    treeLight: dark ? [92, 140, 88] : [150, 196, 128],
    trunk: dark ? [74, 56, 38] : [124, 92, 60],
    star: dark ? [244, 196, 64] : [214, 158, 20]
  };
}

/** Eine Station des Tages: Stunde, Dunkelheit 0…1, Tönung und ihre Stärke, der Himmel über dem Wasser. */
interface Key { readonly h: number; readonly d: number; readonly tint: Rgb; readonly k: number; readonly sky: Rgb; readonly phase: DayPhase }
export const KEYS: readonly Key[] = [
  { h: 0, d: 1, tint: [36, 52, 110], k: 0.22, sky: [14, 22, 48], phase: 'night' },
  { h: 4.5, d: 1, tint: [48, 52, 112], k: 0.22, sky: [22, 26, 60], phase: 'night' },
  { h: 5.25, d: 0.85, tint: [86, 66, 128], k: 0.22, sky: [60, 52, 100], phase: 'dawn' },
  { h: 6.25, d: 0.45, tint: [236, 150, 150], k: 0.2, sky: [240, 172, 162], phase: 'dawn' },
  { h: 7.5, d: 0, tint: [255, 214, 170], k: 0.12, sky: [216, 232, 250], phase: 'morning' },
  { h: 10, d: 0, tint: [225, 238, 255], k: 0.05, sky: [200, 226, 250], phase: 'morning' },
  { h: 13, d: 0, tint: [255, 255, 240], k: 0.02, sky: [190, 222, 250], phase: 'noon' },
  { h: 16, d: 0, tint: [255, 226, 170], k: 0.08, sky: [206, 224, 244], phase: 'afternoon' },
  { h: 18.5, d: 0.1, tint: [255, 170, 90], k: 0.2, sky: [255, 196, 140], phase: 'evening' },
  { h: 20, d: 0.55, tint: [140, 90, 170], k: 0.24, sky: [120, 90, 150], phase: 'dusk' },
  { h: 21.5, d: 1, tint: [36, 52, 110], k: 0.22, sky: [14, 22, 48], phase: 'night' }
];

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

/** Die Stunde (0…24) einer Zeit, nach der Uhr des Geräts. */
export const hourOf = (d: Date): number => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

/** Das Licht um `hour` (0…24): zwischen zwei Stationen stetig gleitend, über Mitternacht im Kreis. */
export function skyAt(hour: number): { d: number; tint: Rgb; k: number; sky: Rgb; phase: DayPhase } {
  const h = ((hour % 24) + 24) % 24;
  let i = KEYS.length - 1;
  for (let j = 0; j < KEYS.length; j += 1) if (KEYS[j].h <= h) i = j;
  const a = KEYS[i];
  const b = KEYS[(i + 1) % KEYS.length];
  const span = (b.h <= a.h ? b.h + 24 : b.h) - a.h;
  /* Gerade zwischen den Stationen (gleichmässig — der schnellste Wechsel, die Dämmerung, verteilt sich auf ihre ganze Zeit). */
  const u = span <= 0 ? 0 : (h - a.h) / span;
  return { d: lerp(a.d, b.d, u), tint: mix(a.tint, b.tint, u), k: lerp(a.k, b.k, u), sky: mix(a.sky, b.sky, u), phase: u < 0.5 ? a.phase : b.phase };
}

/** Die Sonne: 6–20 Uhr über dem Horizont (x von links nach rechts), sonst der Mond (von rechts nach links). */
export function sunAt(hour: number): { x: number; alt: number; moon: boolean } {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 6 && h <= 20) { const u = (h - 6) / 14; return { x: u, alt: Math.sin(Math.PI * u), moon: false }; }
  const u = ((h < 6 ? h + 24 : h) - 20) / 10;
  return { x: 1 - u, alt: Math.sin(Math.PI * u), moon: true };
}

/** Die Farben der Karte für ein Licht und eine Stunde (nur 'day' fragt die Stunde). */
export function mapPalette(light: MapLight, hour: number): MapPalette {
  if (light !== 'day') {
    const s = solid(light === 'dark');
    return { ...s, sky: mix(s.water, s.surface, light === 'dark' ? 0.15 : 0.35), glow: { x: 0.5, colour: s.surface, a: 0 }, tint: s.floor, tintK: 0, shadow: { dx: 0.35, dy: 0.3 }, phase: null, key: light };
  }
  const sk = skyAt(hour);
  const L = solid(false), D = solid(true);
  const d = sk.d;
  /* Das Gelände gleitet zwischen hell und dunkel und nimmt die Tönung an. */
  const scene = (f: (p: ReturnType<typeof solid>) => Rgb, k = sk.k): Rgb => mix(mix(f(L), f(D), d), sk.tint, k);
  /*
    Schrift, Grund und Leuchtfarben wechseln gemeinsam (lesbar), leicht getönt — nach dem Land, auf dem sie stehen: dunkle
    Schrift, solange sie dort deutlicher ist als helle (so wechselt das Paar genau einmal am Morgen und einmal am Abend).
  */
  const land0 = scene((p) => p.land);
  const night = contrast(D.ink, land0) > contrast(L.ink, land0);
  const ui = night ? D : L;
  const sun = sunAt(hour);
  const glowColour: Rgb = sun.moon ? [214, 222, 255] : mix([255, 244, 214], sk.tint, 0.6);
  const len = sun.moon ? 0.25 : 0.2 + 0.5 * (1 - sun.alt);
  return {
    surface: mix(ui.surface, sk.tint, sk.k * 0.25), ink: ui.ink, lit: ui.lit, goal: ui.goal, star: ui.star, dark: night,
    floor: scene((p) => p.floor), floorDeep: scene((p) => p.floorDeep), haze: scene((p) => p.haze), casing: scene((p) => p.casing, sk.k * 0.6),
    /* Das Wasser behält seinen Ton (Blau gegen Orange gäbe Grau); die Farbe des Himmels kommt mit dem Verlauf von oben. */
    water: scene((p) => p.water, sk.k * 0.35), sand: scene((p) => p.sand), land: scene((p) => p.land),
    tree: scene((p) => p.tree, sk.k * 0.7), treeShade: scene((p) => p.treeShade, sk.k * 0.7), treeLight: scene((p) => p.treeLight, sk.k * 0.9), trunk: scene((p) => p.trunk, sk.k * 0.5),
    sky: sk.sky,
    glow: { x: sun.x, colour: glowColour, a: (sun.moon ? 0.16 : 0.3) * sun.alt + (sk.phase === 'evening' || sk.phase === 'dawn' ? 0.12 : 0) },
    tint: mix(sk.tint, [16, 22, 44], 0.4 * d), tintK: Math.min(0.32, sk.k * 0.8 + d * 0.18),
    shadow: { dx: (0.5 - sun.x) * 2 * len + 0.05, dy: 0.18 + 0.15 * sun.alt },
    phase: sk.phase,
    key: `day:${Math.round(hour * 6) % 144}`
  };
}

/** Die Wahl je Gerät (Vorgabe: Tageszeit). */
const KEEP = 'cg-wm-light';
export function keptLight(): MapLight {
  try { const v = localStorage.getItem(KEEP); return v === 'light' || v === 'dark' || v === 'day' ? v : 'day'; } catch { return 'day'; }
}
export function keepLight(l: MapLight): void {
  try { localStorage.setItem(KEEP, l); } catch { /* ohne Speicher: nur diesmal */ }
}

/** WCAG-Kontrast zweier Farben (für die Prüfung: Schrift auf Grund bleibt lesbar). */
export function contrast(a: Rgb, b: Rgb): number {
  const lum = (c: Rgb) => { const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
