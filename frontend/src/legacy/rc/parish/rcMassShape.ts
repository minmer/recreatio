/**
 * Jak duży jest kafelek — i co się w nim wtedy mieści.
 *
 * <b>Mniejszy kafelek to nie ten sam widok po obcięciu.</b> Plan mszy ucięty w
 * połowie kłamie: ktoś przeczyta „7:00, 9:00" i przyjdzie o 9:00, nie wiedząc,
 * że jest jeszcze 18:00. Dlatego przy każdej wielkości pokazuje się co innego,
 * a nie mniej tego samego — pasek godzin bez intencji mówi prawdę, lista mszy
 * urwana po drugiej nie mówi.
 *
 * <b>Kształt liczy się bardziej niż pole.</b> Cztery pola w jednym wierszu i
 * cztery w kwadracie to dwa różne miejsca: w wiersz idą godziny obok siebie, w
 * kwadrat msze jedna pod drugą. Dlatego decyduje najpierw liczba wierszy.
 *
 * Ta decyzja stoi osobno od rysowania, bo tylko wtedy da się ją sprawdzić —
 * kafelka o dziesięciu wielkościach nie obejrzy się dziesięć razy.
 */

/** Co kafelek pokazuje przy danej wielkości. */
export type RcMassShape =
  /** Jedna najbliższa msza: „dziś 18:00". Dla pasków szerokich na dwa pola. */
  | 'next'
  /** Same godziny dnia obok siebie: „7:00 · 9:00 · 18:00". */
  | 'hours'
  /** Godziny jedna pod drugą, z nazwą — wąski i wysoki kafelek. */
  | 'list'
  /** Msze dnia wraz z intencjami, po jednej linii. */
  | 'today'
  /** Kilka dni pogrupowanych, z intencjami i oznaczeniem zbiorowej. */
  | 'days';

/**
 * Ile mieści się w kafelku o tylu polach.
 *
 * Progi nie są okrągłe dla ozdoby — każdy odpowiada temu, co fizycznie wchodzi
 * w wiersz siatki przy zwykłym kroju pisma.
 */
export function rcMassShape(colSpan: number, rowSpan: number): RcMassShape {
  const cols = Math.max(1, Math.trunc(colSpan));
  const rows = Math.max(1, Math.trunc(rowSpan));

  /*
   * JEDEN WIERSZ — nie ma miejsca na nic pod spodem.
   *
   * Wąski pokazuje najbliższą mszę, bo jedna godzina to jedyne, co się mieści
   * i co jeszcze do czegoś służy. Szerszy pokazuje wszystkie godziny dnia:
   * bez intencji, ale bez luki — a to jest właśnie różnica między skrótem a
   * przemilczeniem.
   */
  if (rows <= 1) return cols <= 2 ? 'next' : 'hours';

  /*
   * WĄSKI I WYSOKI — godziny idą w słupek. Intencja w takiej szerokości łamie
   * się na cztery linie i przestaje być czytelna.
   */
  if (cols <= 2) return 'list';

  /*
   * ŚREDNI — jeden dzień z intencjami. Więcej dni tu nie wejdzie, a dzień
   * urwany w połowie byłby gorszy niż jeden cały.
   */
  if (rows <= 3) return 'today';

  // DUŻY — kilka dni, każdy ze swoimi intencjami.
  return 'days';
}

/**
 * Ile dni pokazać przy tej wielkości.
 *
 * Zwraca 1 wszędzie tam, gdzie i tak mieści się tylko dziś — dzięki temu
 * wywołujący nie musi sam rozstrzygać, co znaczy dana postać.
 */
export function rcMassDays(shape: RcMassShape, rowSpan: number): number {
  if (shape !== 'days') return 1;

  /*
   * Mniej więcej dwa wiersze siatki na dzień: nagłówek i kilka mszy. Sufit na
   * ośmiu, bo dalej kafelek staje się planem miesiąca, a tego szuka się w
   * kalendarzu, nie na stronie głównej.
   */
  return Math.max(2, Math.min(8, Math.floor(Math.max(1, rowSpan) / 2)));
}

/**
 * Czy przy tej postaci widać intencje.
 *
 * Osobno, bo o to samo pyta i kafelek, i strona pełna — a dwa miejsca, które
 * odpowiadają na to samo pytanie osobno, kiedyś odpowiedzą różnie.
 */
export const rcShowsIntentions = (shape: RcMassShape): boolean =>
  shape === 'today' || shape === 'days';
