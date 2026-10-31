/**
 * 2026-11-01 — WOHIN DIE ANTWORTEN GEHEN: dorthin, wo gelernt wird.
 *
 * Eine Baza wiedzy steht in vielen Kursen und auf vielen Seiten (auch ohne Kurs) — jeder Ort hat seine Uczący się
 * und seine Lehrerin. Darum nennt der ORT den Bereich (ein Baustein auf der Seite: „Odpowiedzi uczących się do"),
 * sonst die Powtórka, sonst die Baza (Ustawienia — der Vorgabewert, auch für das Lernen in der Nauka). Die Baza selbst
 * ändert dafür kein Kurs.
 *
 * <code>
 *   der Ort nennt einen Bereich     Person: dorthin, wenn sie ihn liest — sonst bleibt es bei ihr (privat);
 *                                   Platz: dorthin (der Dienst nimmt nur den eigenen Bereich und die seiner Rollen)
 *   niemand nennt einen             Person: ihr privater Bereich; Platz: der Bereich der Baza
 * </code>
 *
 * Eine Person, die den genannten Bereich nicht liest, schickte sonst Stapel, die der Dienst mit 403 abweist — sie
 * hingen für immer in der Ablage, und „czeka na internet" wäre falsch. Wer ihn liest, gehört dazu (ein Kurs gibt
 * seinen Uczący się die Rolle, die ihn liest).
 */

/** Der erste genannte Bereich — der Ort zuerst, dann die Powtórka, dann die Baza. `null`: keiner nennt einen. */
export function answersArea(...said: readonly unknown[]): string | null {
  for (const one of said) if (typeof one === 'string' && one.trim() !== '') return one.trim();
  return null;
}

export interface AnswersPlace {
  readonly areaId: string;
  /** Der eigene private Bereich: dort liest niemand sonst. */
  readonly own: boolean;
}

/**
 * Wohin ein Halter schickt. `reads`: ob die Person den Bereich liest (`null`: unbekannt, etwa ohne Netz — dann wie
 * gesagt; der Stapel wartet höchstens in der Ablage). `personal`: ihr privater Bereich, wenn bekannt.
 */
export function placeFor(holder: 'role' | 'seat', said: string | null, reads: ((areaId: string) => boolean) | null, personal: string | null, baseArea: string): AnswersPlace {
  if (holder === 'seat') return { areaId: said ?? baseArea, own: false };
  if (said !== null && (reads === null || reads(said))) return { areaId: said, own: false };
  return personal !== null ? { areaId: personal, own: true } : { areaId: baseArea, own: false };
}
