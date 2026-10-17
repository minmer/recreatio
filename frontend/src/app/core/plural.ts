/**
 * Polnische Mehrzahl: 1 — „zadanie", 2–4 (ausser 12–14) — „zadania", sonst
 * „zadań".
 *
 * 2026-10-17 — aus `ChatKit.tsx` hierher (dort weitergereicht): wer nur diese
 * eine Zeile brauchte, lud die ganze Rozmowa mit — auch jede öffentliche Seite.
 */
export const plural = (n: number, one: string, few: string, many: string): string =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
