/**
 * Wie gross die Kachel ist — und was dann hineinpasst.
 *
 * <b>Eine kleinere Kachel ist nicht dieselbe Ansicht, abgeschnitten.</b> Ein
 * halbierter Messplan lügt: wer „7:00, 9:00" liest, kommt um 9 Uhr und weiss
 * nicht, dass es noch 18:00 gibt. Deshalb zeigt jede Grösse etwas ANDERES und
 * nicht weniger vom Gleichen — eine Zeile blosser Uhrzeiten sagt die Wahrheit,
 * eine nach der zweiten Messe abgebrochene Liste nicht.
 *
 * <b>Und eine grössere nicht dieselbe, aufgeblasen.</b> Vorher sahen drei,
 * vier und sechs Spalten gleich aus: derselbe eine Tag, rechts mehr Leere.
 * Jetzt beantwortet jede der zwölf Grössen eine eigene Frage.
 *
 * <code>
 *              schmal (2)        mittel (3)          breit (4)            ganze Breite (6)
 *   Streifen   nächste Messe     Uhrzeiten des Tags  heute und morgen      nächste mit Intention,
 *              und wann          (vorbei: blass)     (Uhrzeiten)           dann die folgenden
 *   Block      nächste mit       der Tag, Messe für  zwei Tage nebenein-   drei Tage nebeneinander,
 *              Intentionen, dann Messe mit Inten-    ander, mit Inten-     mit Intentionen
 *              die Uhrzeiten     tionen; morgen kurz tionen
 *   hoch       drei Tage unter-  vier Tage unter-    sechs Tage, je zwei   die Woche: sieben Tage
 *              einander          einander            nebeneinander         in vier Spalten
 * </code>
 *
 * <b>Alles beginnt JETZT.</b> Wer um 20 Uhr nachsieht, sucht nicht die Messe
 * von 7 Uhr: die nächste ist die, die noch nicht vorbei ist, und ist der Tag
 * vorbei, beginnt die Ansicht beim nächsten. Was heute schon war, steht
 * zugeklappt da („Wcześniej: 7:00") — wer seine Intention von heute früh sucht,
 * findet sie, und wer die nächste Messe sucht, muss nicht an ihr vorbei.
 *
 * <b>Die Form zählt mehr als die Fläche.</b> Vier Felder in einer Zeile und
 * vier im Quadrat sind zwei verschiedene Orte: in die Zeile gehen Uhrzeiten
 * nebeneinander, ins Quadrat Messen untereinander. Deshalb entscheidet zuerst
 * die Höhe.
 *
 * Diese Entscheidung steht getrennt vom Zeichnen, weil sie sich nur so prüfen
 * lässt — eine Kachel mit zwölf Grössen sieht sich niemand zwölfmal an.
 */

import type { PartSize } from './part';

/** Wie die Kachel zeichnet. */
export type MassForm =
  /** Die eine nächste Messe und wann: „dziś 18:00 · za 40 min". */
  | 'next'
  /** Die Uhrzeiten eines Tages (oder zweier) nebeneinander; die vergangenen blass. */
  | 'hours'
  /** Ein breiter Streifen: die nächste Messe MIT Intention, dahinter die folgenden Uhrzeiten. */
  | 'ticker'
  /** Schmal: die nächste Messe hervorgehoben, mit Intentionen; darunter die Uhrzeiten der nächsten Tage. */
  | 'spotlight'
  /** Ein Tag, Messe für Messe mit Intentionen; der folgende in einer Zeile. */
  | 'day'
  /** Mehrere Tage nebeneinander, jeder mit Intentionen. */
  | 'columns'
  /** Mehrere Tage untereinander, jeder mit Intentionen. */
  | 'stack';

export interface MassView {
  readonly form: MassForm;

  /** Wie viele Tage — ab dem Tag der nächsten Messe. */
  readonly days: number;

  /** Wie viele nebeneinander; 1 heisst untereinander. */
  readonly columns: number;

  /** Intentionen: keine, nur die der nächsten Messe, oder alle gezeigten. */
  readonly intentions: 'none' | 'next' | 'all';

  /** Die Beichte dazwischen — wo ein ganzer Tag dasteht, gehört sie dazu. */
  readonly confessions: boolean;
}

const view = (form: MassForm, days: number, columns: number, intentions: MassView['intentions'], confessions: boolean): MassView =>
  ({ form, days, columns, intentions, confessions });

/**
 * Die Ansicht für eine Grösse.
 *
 * @param wanted Wie viele Tage die Kanzlei eingetragen hat — oder `null`:
 *   dann, was in die Grösse passt. Eine Angabe gilt nur, wo Tage gezeigt
 *   werden; der Streifen „nächste Messe" hat keine Tage, die man zählen
 *   könnte. Wer sieben Tage will, bekommt sieben und eine Kachel, die mitwächst,
 *   statt stillschweigend drei.
 */
export function massView(size: PartSize, wanted: number | null = null): MassView {
  const { width, height } = size;

  if (height === 'strip') {
    /*
     * EINE ZEILE. Schmal passt genau eine Uhrzeit, die noch zu etwas taugt:
     * die nächste. Breiter alle des Tages — ohne Intentionen, aber ohne
     * Lücke; noch breiter zwei Tage; über die ganze Breite ist Platz für die
     * Intention der nächsten Messe, denn nach ihr fragt, wer eine gegeben hat.
     */
    if (width === 'narrow') return view('next', 1, 1, 'none', false);
    if (width === 'medium') return view('hours', 1, 1, 'none', false);
    if (width === 'wide') return view('hours', 2, 1, 'none', false);
    return view('ticker', 2, 1, 'next', false);
  }

  const days = (fits: number) => (wanted !== null && wanted > 0 ? Math.min(wanted, 31) : fits);

  if (height === 'block') {
    /*
     * SCHMAL — eine Intention bricht hier auf zwei, drei Zeilen. Also nur die
     * der nächsten Messe, groß; die übrigen Messen als Uhrzeiten darunter.
     */
    if (width === 'narrow') return view('spotlight', 3, 1, 'next', false);

    /* MITTEL — ein ganzer Tag. Wer mehr Tage eingetragen hat, bekommt sie untereinander. */
    if (width === 'medium') {
      return wanted !== null && wanted > 1 ? view('stack', days(1), 1, 'all', true) : view('day', 1, 1, 'all', true);
    }

    /* BREIT und GANZ — die Tage nebeneinander, so viele, wie Spalten lesbar bleiben. */
    if (width === 'wide') return view('columns', days(2), 2, 'all', true);
    return view('columns', days(3), 3, 'all', true);
  }

  /*
   * HOCH — das Ganze: mehrere Tage, und über die ganze Breite die Woche. Je
   * breiter, desto weniger bricht eine Intention um, desto mehr Tage passen
   * in dieselbe Höhe: schmal drei, mittel vier, breit sechs in zwei Spalten.
   */
  if (width === 'narrow') return view('stack', days(3), 1, 'all', true);
  if (width === 'medium') return view('stack', days(4), 1, 'all', true);
  if (width === 'wide') return view('columns', days(6), 2, 'all', true);
  return view('columns', days(7), 4, 'all', true);
}

/**
 * Wie viele Tage zu holen sind: die gezeigten, und Luft dahinter. Ist heute
 * schon vorbei, beginnt die Ansicht morgen — dann muss morgen schon da sein,
 * und übermorgen für den „dann"-Teil.
 */
export const daysToLoad = (shown: MassView): number => Math.min(33, shown.days + 2);

/** Was die Kachel in dieser Grösse zeigt — ein Satz für den Editor. */
export function massSays(shown: MassView): string {
  const days = (n: number) => (n === 1 ? '1 dzień' : `${n} dni`);

  switch (shown.form) {
    case 'next': return 'Najbliższa msza i za ile — w pasku nie zmieści się więcej.';
    case 'hours': return shown.days === 1
      ? 'Godziny mszy dnia; te, które już minęły, przygaszone.'
      : 'Godziny mszy dziś i następnego dnia.';
    case 'ticker': return 'Najbliższa msza z intencją, za nią kolejne godziny.';
    case 'spotlight': return 'Najbliższa msza z intencjami, pod nią godziny na kolejne dni.';
    case 'day': return 'Jeden dzień msza po mszy, z intencjami i spowiedzią; następny w jednym wierszu.';
    case 'columns': return `${days(shown.days)} obok siebie (${shown.columns} kolumny), z intencjami i spowiedzią.`;
    case 'stack': return `${days(shown.days)} jeden pod drugim, z intencjami i spowiedzią.`;
  }
}

/* -- Jetzt ------------------------------------------------------------------ */

/** Was eine Messe für die Frage „wann" braucht. */
export interface Timed {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: string;
}

const ms = (iso: string) => new Date(iso).getTime();

/** Noch nicht vorbei — und nicht abgesagt. Eine laufende Messe zählt: man kommt noch dazu. */
export const isAhead = (one: Timed, now: Date): boolean =>
  one.status !== 'cancelled' && ms(one.endsAt) > now.getTime();

/** Die nächste Messe, die noch nicht vorbei ist — oder `null`. */
export function nextOf<T extends Timed>(masses: readonly T[], now: Date): T | null {
  return masses.find((one) => isAhead(one, now)) ?? null;
}

/**
 * WANN, von jetzt aus: „trwa", „za 25 min", „za ok. 3 godz." — oder `null`,
 * wenn es länger dauert als ein halber Tag; dann sagt der Tag genug.
 */
export function soon(one: Timed, now: Date): string | null {
  const start = ms(one.startsAt);
  const end = ms(one.endsAt);
  const at = now.getTime();

  if (start <= at && at < end) return 'trwa';

  const minutes = Math.round((start - at) / 60_000);
  if (minutes < 0) return null;
  if (minutes < 1) return 'za chwilę';
  if (minutes < 60) return `za ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours <= 12) return `za ok. ${hours} godz.`;
  return null;
}
