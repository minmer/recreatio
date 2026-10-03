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
 * <b>Die grossen blättern.</b> Wer wissen will, wann am Donnerstag in zwei
 * Wochen Messe ist, oder welche Intention letzten Sonntag gelesen wurde, soll
 * dafür nicht die Kachel verlassen müssen. Deshalb bekommen die grossen
 * Grössen Werkzeuge (`browse`):
 *
 * <code>
 *   none   Streifen, schmaler Block — ein Blick auf JETZT, nichts zu bedienen
 *   step   mittlerer und breiter Block — vor, zurück, heute, und ein Kalender
 *          für ein beliebiges Datum; gezeigt wird dieselbe Form ab diesem Tag
 *   full   jede hohe Grösse und der Block über die ganze Breite — dazu die
 *          Ansichten Tag und Woche, bei viel Breite auch der Monat; ist die
 *          Kachel breit genug, steht der Kalender daneben statt hinter einem Knopf
 * </code>
 *
 * Diese Entscheidung steht getrennt vom Zeichnen, weil sie sich nur so prüfen
 * lässt — eine Kachel mit zwölf Grössen sieht sich niemand zwölfmal an.
 */

import { addDays, addMonths, firstOfMonth, mondayOf, startOfDay } from './dayMath';
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

  /** Was man bedienen kann: nichts, blättern, oder alle Ansichten. */
  readonly browse: 'none' | 'step' | 'full';

  /** Die Ansichten, zwischen denen man wählt — die erste ist die, mit der die Kachel beginnt. */
  readonly modes: readonly MassMode[];
}

/**
 * Die Ansichten der grossen Kachel.
 *
 * <code>
 *   soon    die Form ihrer Grösse, ab jetzt (oder ab dem gewählten Tag)
 *   day     ein Tag, jede Messe mit ihren Intentionen
 *   week    Montag bis Sonntag
 *   month   das Monatsblatt, in jedem Tag die Uhrzeiten
 * </code>
 */
export type MassMode = 'soon' | 'day' | 'week' | 'month';

const view = (
  form: MassForm, days: number, columns: number, intentions: MassView['intentions'], confessions: boolean,
  browse: MassView['browse'] = 'none', modes: readonly MassMode[] = ['soon']
): MassView => ({ form, days, columns, intentions, confessions, browse, modes });

const ALL: readonly MassMode[] = ['soon', 'day', 'week', 'month'];
const NO_MONTH: readonly MassMode[] = ['soon', 'day', 'week'];

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
      return wanted !== null && wanted > 1
        ? view('stack', days(1), 1, 'all', true, 'step')
        : view('day', 1, 1, 'all', true, 'step');
    }

    /*
     * BREIT und GANZ — die Tage nebeneinander, so viele, wie Spalten lesbar
     * bleiben. Über die ganze Breite ist es die zweitgrösste Kachel: sie
     * bekommt Tag und Woche dazu (ein Monatsblatt in drei Zeilen Höhe wäre
     * ein Guckloch).
     */
    if (width === 'wide') return view('columns', days(2), 2, 'all', true, 'step');
    return view('columns', days(3), 3, 'all', true, 'full', NO_MONTH);
  }

  /*
   * HOCH — das Ganze: mehrere Tage, und über die ganze Breite die Woche. Je
   * breiter, desto weniger bricht eine Intention um, desto mehr Tage passen
   * in dieselbe Höhe: schmal drei, mittel vier, breit sechs in zwei Spalten.
   */
  /*
   * Und jede hohe Kachel hat ALLES zum Blättern — auch die schmale: auf dem
   * Telefon ist sie die grösste, die es gibt. Das Monatsblatt erst ab
   * „breit": sieben Spalten in einer Handbreite trügen keine Uhrzeiten mehr.
   */
  if (width === 'narrow') return view('stack', days(3), 1, 'all', true, 'full', NO_MONTH);
  if (width === 'medium') return view('stack', days(4), 1, 'all', true, 'full', NO_MONTH);
  if (width === 'wide') return view('columns', days(6), 2, 'all', true, 'full', ALL);
  return view('columns', days(7), 4, 'all', true, 'full', ALL);
}

/**
 * Wie viele Tage zu holen sind: die gezeigten, und Luft dahinter. Ist heute
 * schon vorbei, beginnt die Ansicht morgen — dann muss morgen schon da sein,
 * und übermorgen für den „dann"-Teil.
 */
export const daysToLoad = (shown: MassView): number => Math.min(33, shown.days + 2);

/** Was die Kachel in dieser Grösse zeigt — ein Satz für den Editor. */
export function massSays(shown: MassView): string {
  const tools = shown.browse === 'step'
    ? ' Strzałki i kalendarz: dowolny dzień.'
    : shown.browse === 'full'
      ? ` Widoki: ${shown.modes.map((m) => MODE_WORD[m].toLowerCase()).join(', ')}; kalendarz do wyboru daty.`
      : '';
  return glanceSays(shown) + tools;
}

/** Wie die Ansichten in der Kachel heissen. */
export const MODE_WORD: Record<MassMode, string> = {
  soon: 'Najbliższe', day: 'Dzień', week: 'Tydzień', month: 'Miesiąc'
};

function glanceSays(shown: MassView): string {
  const days = (n: number) => (n === 1 ? '1 dzień' : `${n} dni`);

  switch (shown.form) {
    case 'next': return 'Najbliższa msza i za ile — w pasku nie zmieści się więcej.';
    case 'hours': return shown.days === 1
      ? 'Godziny mszy dnia; te, które już minęły, przygaszone.'
      : 'Godziny mszy dziś i następnego dnia.';
    case 'ticker': return 'Najbliższa msza z intencją, za nią kolejne godziny.';
    case 'spotlight': return 'Najbliższa msza z intencjami, pod nią godziny na kolejne dni.';
    case 'day': return 'Jeden dzień msza po mszy, z intencjami, spowiedzią i nabożeństwami; następny w jednym wierszu.';
    case 'columns': return `${days(shown.days)} obok siebie (${shown.columns} kolumny), z intencjami, spowiedzią i nabożeństwami.`;
    case 'stack': return `${days(shown.days)} jeden pod drugim, z intencjami, spowiedzią i nabożeństwami.`;
  }
}

/* -- Blättern ---------------------------------------------------------------- */

/**
 * WELCHE TAGE eine Ansicht zeigt — und damit, was zu holen ist. Das Ende ist
 * ausschliesslich.
 *
 * @param anchor Der gewählte Tag — oder `null`: jetzt. In der Ansicht
 *   „soon" heisst `null` wirklich JETZT (die Form beginnt bei der nächsten
 *   Messe, Vergangenes zugeklappt); ein gewählter Tag zeigt seine Tage ganz.
 */
export function rangeOf(mode: MassMode, anchor: Date | null, shown: MassView, now: Date): { from: Date; to: Date } {
  const at = startOfDay(anchor ?? now);

  switch (mode) {
    case 'soon': return { from: at, to: addDays(at, anchor === null ? daysToLoad(shown) : Math.max(1, shown.days)) };
    case 'day': return { from: at, to: addDays(at, 1) };
    case 'week': return { from: mondayOf(at), to: addDays(mondayOf(at), 7) };
    case 'month': {
      const start = mondayOf(firstOfMonth(at));
      return { from: start, to: addDays(start, 42) };
    }
  }
}

/**
 * Ein Schritt vor oder zurück: so weit, wie die Ansicht zeigt — ein Tag,
 * eine Woche, ein Monat, oder so viele Tage, wie die Form ihrer Grösse hat.
 */
export function stepAnchor(mode: MassMode, anchor: Date | null, shown: MassView, now: Date, direction: 1 | -1): Date {
  const at = startOfDay(anchor ?? now);

  switch (mode) {
    case 'soon': return addDays(at, direction * Math.max(1, shown.days));
    case 'day': return addDays(at, direction);
    case 'week': return addDays(at, direction * 7);
    case 'month': return addMonths(at, direction);
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
