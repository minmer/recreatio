/**
 * 2026-11-06 — WIE DER ARBEITSPLATZ AUSSIEHT: hell, dunkel oder wie das Gerät, eine Farbfamilie, Kontrast,
 * Schriftgrösse, Ecken. Gewählt je Gerät unter Konto → Wygląd (`account/AppearancePage.tsx`), gespeichert als
 * `recreatio.look` — und schon vor dem ersten Bild angewandt (`index.html` liest denselben Schlüssel).
 *
 * <b>Hell oder dunkel steht an der Wurzel</b> (`<html data-mode="light|dark">`), nicht mehr in einer
 * Medienabfrage: nur so kann man es wählen, und nur so kann eine Seite es für sich festlegen. Jedes Stilblatt
 * fragt `:root[data-mode="dark"]`; jeder Code fragt `isDark()` / `useDark()` statt `matchMedia`.
 *
 * <b>Die Farbfamilien stehen in `ui/schemes.css`</b> (`[data-scheme=…]`): aus einem Farbton gerechnet (oklch),
 * hell und dunkel. Sie gelten an jedem Element, das `data-scheme` trägt — so zeigen die Muster auf der Seite
 * „Wygląd" und die Vorschau im Editor einer Seite ihre Farben, ohne den Arbeitsplatz umzufärben.
 *
 * <b>Eine Seite kann für sich gelten</b> (`holdPage`): ihre Farbfamilie, ihr Modus, eigene Farben (Werte der
 * `--wk-*`), solange sie offen ist. Danach gilt wieder, was der Mensch gewählt hat.
 */

import { useSyncExternalStore } from 'react';

export const MODES = ['auto', 'light', 'dark'] as const;
export type ModeChoice = (typeof MODES)[number];

/** Die Farbfamilien — `sand` ist die bisherige; `own` rechnet aus einem eigenen Farbton. */
export const SCHEMES = ['sand', 'sea', 'teal', 'forest', 'olive', 'ember', 'rose', 'plum', 'violet', 'slate', 'own'] as const;
export type SchemeId = (typeof SCHEMES)[number];

export const CONTRASTS = ['normal', 'more'] as const;
export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export const CORNERS = ['sharp', 'normal', 'round'] as const;

export interface Appearance {
  readonly mode: ModeChoice;
  readonly scheme: SchemeId;
  /** Nur bei `own`: der Farbton (0–360) und wie stark das Grau ihn mitnimmt (0–2). */
  readonly hue: number;
  readonly tint: number;
  readonly contrast: (typeof CONTRASTS)[number];
  readonly text: (typeof TEXT_SIZES)[number];
  readonly corners: (typeof CORNERS)[number];
}

export const DEFAULT_APPEARANCE: Appearance = { mode: 'auto', scheme: 'sand', hue: 210, tint: 1, contrast: 'normal', text: 'md', corners: 'normal' };

const KEY = 'recreatio.look';

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  list.includes(value as T) ? value as T : fallback;

const within = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Duldsam gelesen: was fehlt oder nicht passt, ist die Vorgabe. */
export function readAppearance(value: unknown): Appearance {
  const one = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const d = DEFAULT_APPEARANCE;
  return {
    mode: pick(MODES, one.mode, d.mode),
    scheme: pick(SCHEMES, one.scheme, d.scheme),
    hue: Math.round(within(one.hue, 0, 360, d.hue)),
    tint: within(one.tint, 0, 2, d.tint),
    contrast: pick(CONTRASTS, one.contrast, d.contrast),
    text: pick(TEXT_SIZES, one.text, d.text),
    corners: pick(CORNERS, one.corners, d.corners)
  };
}

let mine: Appearance = DEFAULT_APPEARANCE;

function load(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? DEFAULT_APPEARANCE : readAppearance(JSON.parse(raw));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export const appearance = (): Appearance => mine;

export function setAppearance(next: Appearance): void {
  mine = readAppearance(next);
  try {
    if (JSON.stringify(mine) === JSON.stringify(DEFAULT_APPEARANCE)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(mine));
  } catch {
    // Ohne Speicher gilt es eben nur bis zum Neuladen.
  }
  apply();
}

/* -- Eine Seite, die für sich gilt -------------------------------------------------------------- */

/** Werte von Stileigenschaften (`--wk-ground` …), an die Wurzel geschrieben. */
export type Vars = Readonly<Record<string, string>>;

export interface PageHold {
  readonly mode?: ModeChoice;
  readonly scheme?: SchemeId;
  readonly hue?: number;
  readonly tint?: number;
  /** Eigene Werte im hellen, im dunklen Modus, und in beiden. */
  readonly light?: Vars;
  readonly dark?: Vars;
  readonly all?: Vars;
}

let hold: { readonly id: number; readonly page: PageHold } | null = null;
let holds = 0;

/** Die Seite gilt, bis das Zurückgegebene gerufen wird (beim Schliessen der Seite). */
export function holdPage(page: PageHold): () => void {
  const id = ++holds;
  hold = { id, page };
  apply();
  return () => {
    if (hold?.id !== id) return;
    hold = null;
    apply();
  };
}

/* -- Anwenden ------------------------------------------------------------------------------------ */

const media = (): MediaQueryList | null =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia('(prefers-color-scheme: dark)');

let dark = false;
let written: readonly string[] = [];
const listeners = new Set<() => void>();

/** Die Werte, die eine Wahl als Stil an ein Element schreibt — für die Wurzel und für Muster. */
export function schemeVars(scheme: SchemeId, hue: number, tint: number): Vars {
  return scheme === 'own' ? { '--sch-h': String(hue), '--sch-ah': String(hue), '--sch-n': String(tint) } : {};
}

function apply(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const page = hold?.page ?? {};
  const mode = page.mode ?? mine.mode;
  dark = mode === 'dark' || (mode === 'auto' && media()?.matches === true);

  root.dataset.mode = dark ? 'dark' : 'light';
  const scheme = page.scheme ?? mine.scheme;
  root.dataset.scheme = scheme;
  root.dataset.contrast = mine.contrast;
  root.dataset.text = mine.text;
  root.dataset.corners = mine.corners;

  const own = page.scheme !== undefined ? schemeVars(scheme, page.hue ?? mine.hue, page.tint ?? mine.tint) : schemeVars(scheme, mine.hue, mine.tint);
  const vars: Record<string, string> = { ...own, ...page.all, ...(dark ? page.dark : page.light) };
  for (const name of written) if (!(name in vars)) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  written = Object.keys(vars);

  /* Die Leiste des Telefons in der Farbe des Grundes (`index.html` sagt Weiss). */
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta !== null) {
    const ground = getComputedStyle(root).getPropertyValue('--wk-ground').trim();
    if (ground !== '') meta.content = ground;
  }

  for (const one of listeners) one();
}

let started = false;

/** Einmal je Fenster: die Wahl lesen, anwenden, dem Gerät folgen. */
export function startTheme(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  mine = load();
  apply();
  media()?.addEventListener('change', apply);
  /* Eine andere Karte hat gewählt: hier auch. */
  window.addEventListener('storage', (e) => { if (e.key === KEY) { mine = load(); apply(); } });
}

/** Ist gerade dunkel — gewählt, vom Gerät, oder von der offenen Seite? */
export const isDark = (): boolean => {
  if (!started) return media()?.matches === true;
  return dark;
};

/** Bei jeder Änderung (Modus, Farben, eine Seite öffnet oder schliesst). */
export function onTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const serverDark = () => false;

/** Hell oder dunkel, und es bleibt dabei, wenn es wechselt. */
export const useDark = (): boolean => useSyncExternalStore(onTheme, isDark, serverDark);

let version = 0;
onTheme(() => { version++; });

/** Ändert sich bei jeder Änderung des Aussehens — für Ansichten, die Farben aus dem Stil lesen. */
export const useThemeVersion = (): number => useSyncExternalStore(onTheme, () => version, () => 0);
