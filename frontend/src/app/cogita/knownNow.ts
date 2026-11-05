/**
 * 2026-11-05 (Prompt 17) — EBEN UTRWALONA: ob die letzte Antwort eine Karte zum ersten Mal „utrwalona" machte — dieselbe
 * Regel wie die Punkte „utrwalona karta" (`rewards.ts`): eine gute Antwort, nach der die nächste Wiederholung mindestens
 * `days` Tage weg ist, nach den Abständen der Vorgabe (die Punkte hängen nie von den eigenen Abständen ab). Davor war sie
 * es nie. Dann zeigt die Karte einmal „Utrwalone" (`rewardBus.ts`).
 */

import { gradeOf, step, type CardState } from './knowness';

const DAY = 86_400_000;

export function freshlyKnown(marks: readonly { readonly at: number; readonly correctness: number }[], days: number): boolean {
  const list = marks.filter((m) => Number.isFinite(m.at)).slice().sort((a, b) => a.at - b.at);
  if (list.length === 0) return false;
  let state: CardState | null = null;
  let before = false;
  for (let i = 0; i < list.length; i += 1) {
    const q = Math.max(0, Math.min(1, list[i]!.correctness));
    state = step(state, { at: list[i]!.at, correctness: q });
    const known = gradeOf(q) === 'correct' && state.interval >= days * DAY;
    if (i < list.length - 1) { if (known) before = true; continue; }
    return known && !before;
  }
  return false;
}
