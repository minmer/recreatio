/**
 * 2026-11-04 (Prompt 15) — WIE WEIT DIE WIEDERHOLUNGEN AUSEINANDERLIEGEN, einstellbar.
 *
 * Der Algorithmus bleibt der von `knowness.ts` (`step`); einstellbar sind seine zwei Werte (`Spacing`):
 * <code>
 *   first    erster Abstand — so lange nach einer richtigen Antwort (auch nach falsch, dann richtig) kommt die Karte
 *            frühestens wieder
 *   growth   Wachstum — um so viel wird jeder nächste Abstand nach einer weiteren richtigen Antwort länger
 * </code>
 * Mit Namen: „Częściej" (5 Minuten, × 2 — seit 2026-11-05), „Standard" (wie bisher), „Lżej" (längere Abstände), „Raz i gotowe" (einmal fragen, praktisch nie wieder:
 * ein Jahr, × 1000); „Zaawansowane" stellt beide genau.
 *
 * <b>Wer stellt es, wo liegt es</b>:
 * <code>
 *   Bereich     wer die Baza schreibt (die Lehrerin des Bereichs, in dem sie liegt): in den Ustawienia der Baza
 *               (Dokument `settings`, Feld `spacing`: {first, growth, locked}) — gilt für alle, die dort lernen;
 *               `locked`: die Lernenden dürfen es nicht ändern
 *   Lernender   in seinen eigenen Werten für diese Baza (Stapel `values`, versiegelt wie seine Antworten, unter den
 *               Schlüsseln `~spacing.first` / `~spacing.growth`) — über Geräte hinweg, ohne neue Art von Stapel
 * </code>
 * Es gilt: das eigene, wenn erlaubt — sonst das des Bereichs — sonst die Vorgabe (`effectiveSpacing`).
 *
 * Gespeichert wird nur die Einstellung, nie ein Termin: Kenntnis und Termine werden aus den Antworten gerechnet
 * (`stateOf`), also gilt eine geänderte Einstellung sofort für alle Karten, und keine Antwort geht verloren.
 */

import { DEFAULT_SPACING, type Spacing } from './knowness';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

export type SpacingPreset = 'often' | 'standard' | 'lighter' | 'once';
/** 2026-11-05 — „Częściej" (5 Min. × 2) davor: kürzere Abstände für wer schnell festigen will (Baustein „Krajobraz"). */
export const SPACING_PRESETS: readonly SpacingPreset[] = ['often', 'standard', 'lighter', 'once'];
export const PRESET_SPACING: Readonly<Record<SpacingPreset, Spacing>> = {
  often: { first: 5 * MINUTE, growth: 2 },
  standard: DEFAULT_SPACING,
  lighter: { first: DAY, growth: 5 },
  once: { first: YEAR, growth: 1000 }
};

/** Die Grenzen: mindestens eine Minute, höchstens hundert Jahre; Wachstum 1 (bleibt gleich) bis eine Million. */
export const FIRST_MIN = MINUTE;
export const FIRST_MAX = 100 * YEAR;
export const GROWTH_MIN = 1;
export const GROWTH_MAX = 1_000_000;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Ein gespeicherter Wert, geprüft und begrenzt — `undefined`: keiner (oder unbrauchbar). */
export function readSpacing(raw: unknown): Spacing | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { first, growth } = raw as Record<string, unknown>;
  if (!finite(first) || !finite(growth)) return undefined;
  return { first: Math.max(FIRST_MIN, Math.min(FIRST_MAX, first)), growth: Math.max(GROWTH_MIN, Math.min(GROWTH_MAX, growth)) };
}

/** Was der Bereich (die Baza) einstellt: die Abstände und ob die Lernenden sie ändern dürfen. */
export interface AreaSpacing extends Spacing {
  readonly locked: boolean;
}

export function readAreaSpacing(raw: unknown): AreaSpacing | undefined {
  const sp = readSpacing(raw);
  return sp === undefined ? undefined : { ...sp, locked: (raw as Record<string, unknown>).locked === true };
}

/* -- Die eigene Einstellung des Lernenden, in seinen Werten -------------------------------------------- */

export const OWN_FIRST = '~spacing.first';
export const OWN_GROWTH = '~spacing.growth';
/** Werte mit diesem Zeichen gehören der Anwendung, nicht einer Erzählung (`Learner.keepValues` lässt sie stehen). */
export const OWN_PREFIX = '~';

export const ownSpacing = (values: Readonly<Record<string, number>> | undefined): Spacing | undefined =>
  values === undefined || values[OWN_FIRST] === undefined ? undefined : readSpacing({ first: values[OWN_FIRST], growth: values[OWN_GROWTH] });

/** Die Werte mit (oder, `null`, ohne) eigener Einstellung. */
export function withOwnSpacing(values: Readonly<Record<string, number>>, sp: Spacing | null): Record<string, number> {
  const { [OWN_FIRST]: _f, [OWN_GROWTH]: _g, ...rest } = values;
  return sp === null ? rest : { ...rest, [OWN_FIRST]: sp.first, [OWN_GROWTH]: sp.growth };
}

/* -- Was gilt ------------------------------------------------------------------------------------------ */

export interface EffectiveSpacing {
  readonly spacing: Spacing;
  /** Woher: die eigene, die des Bereichs, die Vorgabe. */
  readonly from: 'own' | 'area' | 'default';
  /** Darf der Lernende es ändern? */
  readonly changeable: boolean;
}

/** DAS EIGENE, WENN ERLAUBT — SONST DAS DES BEREICHS — SONST DIE VORGABE. */
export function effectiveSpacing(area: AreaSpacing | undefined, own: Spacing | undefined): EffectiveSpacing {
  if (area?.locked === true) return { spacing: { first: area.first, growth: area.growth }, from: 'area', changeable: false };
  if (own !== undefined) return { spacing: own, from: 'own', changeable: true };
  if (area !== undefined) return { spacing: { first: area.first, growth: area.growth }, from: 'area', changeable: true };
  return { spacing: DEFAULT_SPACING, from: 'default', changeable: true };
}

/** Was eine Baza und ein Lernender brauchen, um zu wissen, was gilt. */
export interface SpacingLib { settings(): { readonly spacing?: AreaSpacing } }
export interface SpacingLearner { readonly progress: { readonly values: Readonly<Record<string, number>> } }

export const effectiveFor = (lib: SpacingLib | null | undefined, learner: SpacingLearner | null | undefined): EffectiveSpacing =>
  effectiveSpacing(lib?.settings().spacing, ownSpacing(learner?.progress.values));

/** Die Abstände, die für diesen Lernenden in dieser Baza gelten — für jede Rechnung der Kenntnis. */
export const spacingFor = (lib: SpacingLib | null | undefined, learner: SpacingLearner | null | undefined): Spacing => effectiveFor(lib, learner).spacing;

/** Welcher Name passt genau — `null`: eigene Werte („Zaawansowane"). */
export function presetOf(sp: Spacing): SpacingPreset | null {
  for (const p of SPACING_PRESETS) {
    const v = PRESET_SPACING[p];
    if (Math.abs(v.first - sp.first) < 1 && Math.abs(v.growth - sp.growth) < 1e-9) return p;
  }
  return null;
}

/* -- Zeit in Worten (für „Zaawansowane") --------------------------------------------------------------- */

export type SpacingUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
export const SPACING_UNITS: readonly SpacingUnit[] = ['minute', 'hour', 'day', 'week', 'month', 'year'];
export const UNIT_MS: Readonly<Record<SpacingUnit, number>> = { minute: MINUTE, hour: HOUR, day: DAY, week: 7 * DAY, month: 30 * DAY, year: YEAR };

/** Die grösste Einheit, in der der Abstand eine ganze Zahl ist (sonst die grösste, in der er mindestens 1 ist). */
export function unitOf(ms: number): { readonly amount: number; readonly unit: SpacingUnit } {
  for (const unit of [...SPACING_UNITS].reverse()) {
    const n = ms / UNIT_MS[unit];
    if (n >= 1 && Math.abs(n - Math.round(n)) < 1e-9) return { amount: Math.round(n), unit };
  }
  for (const unit of [...SPACING_UNITS].reverse()) if (ms / UNIT_MS[unit] >= 1) return { amount: Math.round((ms / UNIT_MS[unit]) * 100) / 100, unit };
  return { amount: Math.round((ms / MINUTE) * 100) / 100, unit: 'minute' };
}

/* -- 2026-11-05: wie viele Karten auf einmal (der Stapel einer Wiederholung) ----------------------------------- */

/**
 * DER STAPEL: so viele Karten sind in einer Wiederholung zugleich „in der Hand" (`revision.ts`, `plan.stackSize`). Eine
 * falsch beantwortete bleibt darin und kommt wieder; eine richtig beantwortete geht — erst dann rückt EINE neue nach.
 * Bei 50 fälligen und 15 im Stapel arbeitet man also an 15, nicht an allen 50 zugleich.
 * <code>
 *   Bereich     Ustawienia der Baza, Feld `stack`: {size, locked}
 *   Lernender   eigene Werte, Schlüssel `~stack` (wie `~spacing.*`)
 * </code>
 * Es gilt: das eigene, wenn erlaubt — sonst das des Bereichs — sonst `DEFAULT_STACK` (wie bisher: 20).
 */
export const DEFAULT_STACK = 20;
export const STACK_MIN = 3;
export const STACK_MAX = 100;
export const STACK_PRESETS: readonly number[] = [10, 15, 20, 30];
export const OWN_STACK = '~stack';

const clampStack = (n: number): number => Math.max(STACK_MIN, Math.min(STACK_MAX, Math.round(n)));

export interface AreaStack { readonly size: number; readonly locked: boolean }

export function readAreaStack(raw: unknown): AreaStack | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { size, locked } = raw as Record<string, unknown>;
  return finite(size) ? { size: clampStack(size), locked: locked === true } : undefined;
}

export const ownStack = (values: Readonly<Record<string, number>> | undefined): number | undefined =>
  values === undefined || !finite(values[OWN_STACK]) ? undefined : clampStack(values[OWN_STACK]);

/** Die Werte mit (oder, `null`, ohne) eigener Grösse des Stapels. */
export function withOwnStack(values: Readonly<Record<string, number>>, size: number | null): Record<string, number> {
  const { [OWN_STACK]: _s, ...rest } = values;
  return size === null ? rest : { ...rest, [OWN_STACK]: clampStack(size) };
}

export interface EffectiveStack { readonly size: number; readonly from: 'own' | 'area' | 'default'; readonly changeable: boolean }

export function effectiveStack(area: AreaStack | undefined, own: number | undefined): EffectiveStack {
  if (area?.locked === true) return { size: area.size, from: 'area', changeable: false };
  if (own !== undefined) return { size: own, from: 'own', changeable: true };
  if (area !== undefined) return { size: area.size, from: 'area', changeable: true };
  return { size: DEFAULT_STACK, from: 'default', changeable: true };
}

export interface StackLib { settings(): { readonly stack?: AreaStack } }

export const effectiveStackFor = (lib: StackLib | null | undefined, learner: SpacingLearner | null | undefined): EffectiveStack =>
  effectiveStack(lib?.settings().stack, ownStack(learner?.progress.values));

/** Wie viele Karten dieser Lernende in dieser Baza zugleich wiederholt. */
export const stackFor = (lib: StackLib | null | undefined, learner: SpacingLearner | null | undefined): number => effectiveStackFor(lib, learner).size;
