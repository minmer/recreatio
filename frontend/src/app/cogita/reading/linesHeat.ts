/**
 * 2026-11-22 (Homer-Einheit) — DIE WÄRMEKARTE EINER LEKTÜRE-FRAGE: wie viele Schülerinnen und Schüler jede Zeile gewählt haben
 * (`lines`; bei `span` jede Zeile im gewählten Bereich). Nie Namen — nur Zahlen je Zeile. Index 0 = Zeile 1; leer bei
 * anderen Arten.
 */

import type { Card } from '../cardBasics';
import { heatOf, type ReadingSpec } from './readingSpec';

export function linesHeat(card: Card, givens: readonly unknown[]): number[] {
  const a = card.answer;
  if (a.form !== 'lines' && a.form !== 'span') return [];
  return heatOf(a as ReadingSpec, givens);
}

/* Die Ansicht dazu (eine eigene Datei: „LinesHeat.tsx“ neben „linesHeat.ts“ wäre auf Windows derselbe Name). Nur von hier importieren. */
export { LinesHeat } from './LinesHeatView';
