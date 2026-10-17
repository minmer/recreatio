/**
 * SZUKAJ (0094) — ein Feld für den ganzen Arbeitsplatz: Teile, Widoki,
 * Bereiche, Formulare und Bausteine, Seiten, Rozmowy.
 *
 * <b>Ohne Polnisch tippen zu müssen.</b> „zgloszenia" findet „Zgłoszenia",
 * „koleda" die „Kolęda": verglichen wird ohne Zeichen über und durch den
 * Buchstaben (`fold`). Jedes getippte Wort muss vorkommen; was mit dem
 * Getippten BEGINNT, steht vor dem, was es nur enthält.
 *
 * Rechnet nur — was es gibt, sammelt `SearchPalette.tsx`.
 */

export interface SearchEntry {
  /** Eindeutig über alle Arten (`area:…`, `page:…`). */
  readonly id: string;
  readonly label: string;
  /** Was es ist — „Obszar", „Formularz", „Strona" … */
  readonly kind: string;
  readonly href: string;
  /** Wird mit durchsucht, steht klein daneben (der Bereich eines Formulars). */
  readonly hint?: string;
}

/** Klein, ohne diakritische Zeichen, ł → l. */
export const fold = (text: string): string => text.toLocaleLowerCase('pl-PL')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

/** Wie gut ein Eintrag passt — kleiner ist besser, `null`: gar nicht. */
export function scoreOf(words: readonly string[], entry: SearchEntry): number | null {
  const label = fold(entry.label);
  const all = `${label} ${fold(entry.hint ?? '')} ${fold(entry.kind)}`;
  if (!words.every((w) => all.includes(w))) return null;
  const whole = words.join(' ');
  if (label.startsWith(whole)) return 0;
  if (label.split(/[^\p{L}\p{N}]+/u).some((part) => part.startsWith(words[0]))) return 1;
  if (words.every((w) => label.includes(w))) return 2;
  return 3;
}

/** Die Treffer, die besten zuerst; bei Gleichstand bleibt die Reihenfolge der Quelle. */
export function searchHits(query: string, entries: readonly SearchEntry[], max = 40): SearchEntry[] {
  const words = fold(query).split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return [];
  return entries
    .map((entry, at) => ({ entry, at, score: scoreOf(words, entry) }))
    .filter((one): one is { entry: SearchEntry; at: number; score: number } => one.score !== null)
    .sort((a, b) => a.score - b.score || a.at - b.at)
    .slice(0, max)
    .map((one) => one.entry);
}
