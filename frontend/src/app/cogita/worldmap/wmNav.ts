/**
 * 2026-11-09 — „PROWADŹ MNIE TUTAJ" IN DER SITZUNG (spec §8, Entscheidung 14): das Ziel und die gewählten Abzweigungen leben nur
 * in dieser Sitzung (nie ein gespeichertes Ziel — „Ustaw jako cel" bleibt, wie es ist). Der Plan selbst (`wmPlan.ts`) wird nach
 * jeder Änderung des Lernstands neu gerechnet; hier steht, was der Fahrplan daraus macht:
 * <code>
 *   erledigt   was aus dem Plan verschwand, weil der Lernende es getan hat (nicht, weil er eine andere Abzweigung wählte)
 *   Fenster    2 erledigte darüber, der jetzige gross, 4 kommende (der Rest durch Blättern)
 *   Karte      die nächsten Fahrten leuchten kräftig, spätere nur blass; ein Wimpel am jetzigen Schritt, eine Fahne am Ziel, ein
 *              Gabelzeichen an Umsteigeorten, an denen man abbiegen kann
 * </code>
 * Rein (ohne React); `scripts/app-wm-interaction-check.mjs` prüft es.
 */

import type { Plan, PlanStep } from './wmPlan';
import { HOME, type Lines } from './wmTypes';

export interface NavSession {
  readonly target: string;
  /** Gewählte Abzweigungen: Ort → Abschnitt. */
  readonly choices: ReadonlyMap<string, string>;
}

/** Ein Schritt beim Namen (derselbe Schritt in zwei Plänen hat denselben Schlüssel). */
export const stepKey = (s: PlanStep): string =>
  s.kind === 'travel' ? `travel:${s.section}` : s.kind === 'run' || s.kind === 'wait' ? `${s.kind}:${s.place}:${s.level}` : `${s.kind}:${s.place}`;

export interface Timetable {
  readonly target: string;
  readonly done: readonly PlanStep[];
  readonly upcoming: readonly PlanStep[];
  /** Karten, die bis zum Ziel fehlen. */
  readonly cards: number;
}

/**
 * DER FAHRPLAN NACH EINEM NEUEN PLAN. `replanned`: der Lernende hat eine Abzweigung gewählt (oder ein anderes Ziel) — was dabei
 * verschwindet, ist nicht erledigt. Sonst ist erledigt, was im alten Plan vor dem Neuen stand und nun fehlt.
 */
export function followPlan(prev: Timetable | null, plan: Plan, replanned = false): Timetable {
  if (prev === null || prev.target !== plan.target) return { target: plan.target, done: [], upcoming: plan.steps, cards: plan.cards };
  if (replanned) return { ...prev, upcoming: plan.steps, cards: plan.cards };
  const now = new Set(plan.steps.map(stepKey));
  const had = new Set(prev.done.map(stepKey));
  const newly = prev.upcoming.filter((s) => !now.has(stepKey(s)) && !had.has(stepKey(s)));
  return { target: plan.target, done: [...prev.done, ...newly], upcoming: plan.steps, cards: plan.cards };
}

/** Wie viele kommende Schritte das Fenster zeigt (der jetzige und 4 danach). */
export const WINDOW_NEXT = 5;

/** Wo ein Schritt beginnt: eine Fahrt am Anfang ihres Abschnitts, alles andere an seinem Ort. */
export function stepPlace(step: PlanStep, lines: Lines): string {
  if (step.kind === 'travel') return lines.sections.get(step.section)?.from ?? HOME;
  return step.place;
}

export interface NavMarks {
  /** Die Fahrten im Fenster (kräftig). */
  readonly next: readonly string[];
  /** Spätere Fahrten (blass). */
  readonly later: readonly string[];
  /** Der Wimpel „Tu zacznij": der Ort des jetzigen Schrittes (oder das Haus). */
  readonly start: string | null;
  /** Die Fahne. */
  readonly target: string;
  /** Umsteigeorte, an denen eine Fahrt eine andere Möglichkeit hat. */
  readonly forks: readonly string[];
}

export function navMarks(tt: Timetable, lines: Lines): NavMarks {
  const next: string[] = [];
  const later: string[] = [];
  const forks = new Set<string>();
  tt.upcoming.forEach((s, i) => {
    if (s.kind !== 'travel') return;
    (i < WINDOW_NEXT ? next : later).push(s.section);
    if (s.alternatives.length > 0) forks.add(lines.sections.get(s.section)?.from ?? HOME);
  });
  const first = tt.upcoming[0];
  return { next, later, start: first === undefined ? null : stepPlace(first, lines), target: tt.target, forks: [...forks] };
}

/* -- In der Sitzung behalten (ein Neuladen; nie im Konto) ---------------------------------------------------------------- */

const navKey = (scope: string) => `cg-wm-nav:${scope}`;

export function keptNav(scope: string): NavSession | null {
  try {
    const raw = window.sessionStorage.getItem(navKey(scope));
    if (raw === null) return null;
    const v = JSON.parse(raw) as { target?: unknown; choices?: unknown };
    if (typeof v.target !== 'string' || v.target === '') return null;
    const choices = new Map<string, string>();
    if (Array.isArray(v.choices)) for (const pair of v.choices) if (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string') choices.set(pair[0], pair[1]);
    return { target: v.target, choices };
  } catch { return null; }
}

export function keepNav(scope: string, nav: NavSession | null): void {
  try {
    if (nav === null) window.sessionStorage.removeItem(navKey(scope));
    else window.sessionStorage.setItem(navKey(scope), JSON.stringify({ target: nav.target, choices: [...nav.choices] }));
  } catch { /* ohne Speicher: nur bis zum Neuladen */ }
}
