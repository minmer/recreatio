/**
 * 2026-11-01 — WOHIN DIE ANTWORTEN GEHEN: dorthin, wo gelernt wird.
 *
 * Eine Baza wiedzy steht in vielen Kursen und auf vielen Seiten (auch ohne Kurs) — jeder Ort hat seine Uczący się
 * und seine Lehrerin. Darum nennt der ORT den Bereich (ein Baustein auf der Seite: „Odpowiedzi uczących się do"),
 * sonst die Powtórka, sonst die Baza (Ustawienia — der Vorgabewert, auch für das Lernen in der Nauka). Die Baza selbst
 * ändert dafür kein Kurs.
 *
 * <code>
 *   der Ort nennt einen Bereich     dorthin — der Dienst nimmt ihn, wenn der Lernende ihn liest oder einen Bereich
 *                                   darüber (dann muss er Przyjęcia haben: die Prowadzący eines Kurses in ihrem
 *                                   eigenen Bereich darin); sonst sagt er „area", und es geht zum Ausweichort
 *   niemand nennt einen             Person: ihr privater Bereich; Platz: der Bereich der Baza
 *   Ausweichort                     Person: ihr privater Bereich (es bleibt bei ihr); Platz: der Bereich der Baza
 * </code>
 *
 * So hängt kein Stapel in der Ablage, den der Dienst nie nimmt (vorher: „czeka na internet" für immer).
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

/** Wohin ein Halter schickt — und wohin, wenn der Dienst den Bereich nicht nimmt (`null`: es gibt nichts anderes). */
export function placeFor(holder: 'role' | 'seat', said: string | null, personal: string | null, baseArea: string): { readonly place: AnswersPlace; readonly fallback: AnswersPlace | null } {
  const rest: AnswersPlace = holder === 'role' && personal !== null ? { areaId: personal, own: true } : { areaId: baseArea, own: false };
  if (said === null) return { place: rest, fallback: null };
  return { place: { areaId: said, own: false }, fallback: rest.areaId.toLowerCase() === said.toLowerCase() ? null : rest };
}
