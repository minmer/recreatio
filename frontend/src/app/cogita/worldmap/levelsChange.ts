/**
 * 2026-11-22 (guide-good-world §1.3, I7) — WAS EINE ANDERE EINSTELLUNG DER STUFEN FÜR DIE LERNENDEN HEISST, ohne ihre Daten.
 *
 * Stufen werden nie gespeichert: sie entstehen aus den gespeicherten Durchgängen und der Einstellung, die JETZT gilt (`levelOf`).
 * Darum hat jeder Lernende nach einer Änderung sofort jede Stufe, die einer seiner Durchgänge nach den NEUEN Regeln erreicht — was
 * die neuen Regeln geben, geht nie verloren. Diese Rechnung sagt im Voraus, welche alte Stufe welche neue SICHER gibt: eine Regel
 * „trägt" eine andere, wenn sie mindestens denselben Anteil verlangt und mindestens so streng zählt („first" ⊂ „one" ⊂ „any":
 * wer 95 % beim ersten Versuch hatte, hat auch 90 % mit einer Korrektur). Was keine alte Stufe trägt, kann ein Durchgang trotzdem
 * schon erreicht haben — sicher ist es erst mit dem nächsten.
 *
 * Rein (ohne React); die Worte gibt der Aufrufer (`t`) — der Import (`json.ts`) und die Ustawienia (`WorldLevels.tsx`) sagen
 * dasselbe. Geprüft in `scripts/app-good-world-check.mjs`.
 */

import { RECOMMENDED_LEVELS, readLevelsSetup, type Attempts, type LevelRule, type LevelsSetup } from './wmRuns';

const STRICT: Readonly<Record<Attempts, number>> = { any: 0, one: 1, first: 2 };

/** Gibt ein Durchgang, der Regel `a` erfüllt, sicher auch Regel `b`? */
export const carries = (a: LevelRule, b: LevelRule): boolean => a.pct >= b.pct && STRICT[a.attempts] >= STRICT[b.attempts];

export interface LevelsShape {
  readonly levels: number;
  readonly rules: readonly LevelRule[];
  /** Ab welcher Stufe sich die Pfade öffnen — `null`: erst bei der Eroberung. */
  readonly openAt: number | null;
}

export interface LevelsChange {
  readonly before: LevelsShape;
  readonly after: LevelsShape;
  /** Je neue Stufe (Index 0 = Stufe 1): die niedrigste alte Stufe, die sie sicher gibt — `null`: sicher erst mit einem neuen Durchgang. */
  readonly keeps: readonly (number | null)[];
  /** Wer vorher erobert hatte (die oberste alte Stufe), hat auch die oberste neue. */
  readonly conquestKept: boolean;
  /** Vorher ohne Stufen (erreicht, wenn die Karten gekonnt sind), jetzt mit (Durchgänge). */
  readonly toRuns: boolean;
  /** Vorher mit Stufen, jetzt ohne. */
  readonly toCards: boolean;
}

const shapeOf = (s: LevelsSetup | undefined): LevelsShape =>
  s === undefined ? { levels: 0, rules: [], openAt: null } : { levels: s.levels, rules: s.rules.slice(0, s.levels), openAt: s.levels === 0 ? (s.openAt === 0 ? 0 : null) : s.openAt ?? null };

/** Die Änderung von `before` zu `after` — `null`: dieselben Stufen, Regeln und Öffnung der Pfade. */
export function levelsChange(before: LevelsSetup | undefined, after: LevelsSetup | undefined): LevelsChange | null {
  const a = shapeOf(before);
  const b = shapeOf(after);
  const same = a.levels === b.levels && a.openAt === b.openAt && a.rules.every((r, i) => r.pct === b.rules[i]?.pct && r.attempts === b.rules[i]?.attempts);
  if (same) return null;
  const keeps = b.rules.map((rule) => {
    for (let j = 0; j < a.rules.length; j += 1) if (carries(a.rules[j]!, rule)) return j + 1;
    return null;
  });
  const conquestKept = a.levels > 0 && b.levels > 0 && carries(a.rules[a.levels - 1]!, b.rules[b.levels - 1]!);
  return { before: a, after: b, keeps, conquestKept, toRuns: a.levels === 0 && b.levels > 0, toCards: a.levels > 0 && b.levels === 0 };
}

/** Die Empfehlung als gelesene Einstellung (`RECOMMENDED_LEVELS`). */
export const recommendedLevels = (): LevelsSetup => readLevelsSetup(RECOMMENDED_LEVELS)!;

/** Ist diese Einstellung die Empfehlung (Stufen, Regeln, Öffnung der Pfade)? */
export const isRecommendedLevels = (s: LevelsSetup | undefined): boolean => levelsChange(s, recommendedLevels()) === null;

type Tr = (key: string, params?: Record<string, string | number>) => string;

/** Eine Einstellung in Worten: „2 Stufen (75 % bei beliebig vielen Versuchen, 90 % mit einer Korrektur; Pfade ab Stufe 1)". */
export function levelsWords(s: LevelsShape, t: Tr): string {
  if (s.levels === 0) return t('cogitaData.import.levels.none');
  const rules = s.rules.map((r) => t('cogitaData.import.levels.rule', { pct: r.pct, attempts: t(`cogitaData.import.levels.${r.attempts}`) })).join(', ');
  const open = s.openAt === null ? t('cogitaData.import.levels.openConquered') : s.openAt === 0 ? t('cogitaData.import.levels.openNow') : t('cogitaData.import.levels.openAt', { level: s.openAt });
  return t('cogitaData.import.levels.count', { count: s.levels, rules, open });
}

/** Was die Vorschau sagt: eine Zeile der Änderung und, für die Lernenden, was mit ihren Stufen geschieht. */
export function levelsChangeWords(c: LevelsChange, t: Tr): { readonly line: string; readonly learners: string } {
  const line = t('cogitaData.import.levels.line', { from: levelsWords(c.before, t), to: levelsWords(c.after, t) });
  const parts: string[] = [];
  if (c.toCards) parts.push(t('cogitaData.import.levels.toCards'));
  else if (c.toRuns) parts.push(t('cogitaData.import.levels.toRuns'));
  else {
    parts.push(t('cogitaData.import.levels.computed'));
    c.keeps.forEach((from, i) => {
      const rule = c.after.rules[i]!;
      const what = t('cogitaData.import.levels.rule', { pct: rule.pct, attempts: t(`cogitaData.import.levels.${rule.attempts}`) });
      parts.push(from === null ? t('cogitaData.import.levels.needsRun', { level: i + 1, rule: what }) : t('cogitaData.import.levels.keeps', { level: i + 1, from }));
    });
    parts.push(t(c.conquestKept ? 'cogitaData.import.levels.conquestKept' : 'cogitaData.import.levels.conquestRun'));
  }
  parts.push(t('cogitaData.import.levels.own'));
  return { line, learners: parts.join(' ') };
}
