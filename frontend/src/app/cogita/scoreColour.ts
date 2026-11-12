/**
 * 2026-11-12 (Eigentümer: „Kenntnis oder Richtigkeit einer Antwort in einem Verlauf von Rot über Orange und Gelb zu Grün — an der
 * Farbe sieht man, ob es 20 %, 80 %, 100 % oder 0 % sind") — DIE FARBE EINES ANTEILS, eine Skala für alle Anzeigen:
 * <code>
 *   0 %   rot (Farbton 27)     35 %  orange (55)     65 %  gelb (95)     85 %  gelbgrün (130)     100 % und mehr  grün (150)
 * </code>
 * Zwischen den Stufen stetig (OKLCH-Farbton). Die Zahl steht immer daneben (die Farbe allein sagt es nie).
 * `scoreHue` für CSS (`--score-h`, `.cg-score`), `scoreColour` für Zeichen (Punkte im Diagramm).
 */

const STOPS: readonly (readonly [number, number])[] = [[0, 27], [0.35, 55], [0.65, 95], [0.85, 130], [1, 150]];

/** Der Farbton (OKLCH, Grad) eines Anteils 0…1 (darüber: grün). */
export function scoreHue(share: number): number {
  const v = Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : 0;
  for (let i = 1; i < STOPS.length; i += 1) {
    const [a, ha] = STOPS[i - 1]!, [b, hb] = STOPS[i]!;
    if (v <= b) return ha + ((hb - ha) * (v - a)) / (b - a);
  }
  return STOPS[STOPS.length - 1]![1];
}

/** Eine kräftige Farbe für Zeichen (auf hellem wie dunklem Grund sichtbar). */
export const scoreColour = (share: number): string => `oklch(0.7 0.17 ${scoreHue(share).toFixed(1)})`;

/** Für ein Element mit `.cg-score`: setzt seinen Farbton (ohne style={{…}}). */
export const scoreRef = (share: number) => (el: HTMLElement | SVGElement | null): void => {
  if (el !== null) el.style.setProperty('--score-h', scoreHue(share).toFixed(1));
};
