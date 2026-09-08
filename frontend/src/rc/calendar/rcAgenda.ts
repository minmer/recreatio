/**
 * Der Terminplan: gruppieren, benennen, einordnen — ohne React.
 *
 * <b>Warum das hier steht.</b> Ein Plan, der falsch gruppiert, sieht nicht
 * kaputt aus: er zeigt einen Termin am falschen Tag. Niemand bemerkt es, bis
 * jemand zur falschen Zeit erscheint. Solche Regeln gehoeren in reine
 * Funktionen, die man ohne Browser durchrechnen kann.
 *
 * <b>Der Tag ist ein ORTSTAG, keine UTC-Zeit.</b> Eine Messe um 18:00 in
 * Warschau ist im Sommer 16:00 UTC — nach UTC gruppiert bliebe sie am selben
 * Tag, aber eine Andacht um 00:30 waere UTC schon der Vortag und stuende im
 * Plan einen Tag zu frueh. Es ist derselbe Fehler, den `rcOccurrenceKey` an
 * einer anderen Stelle vermeidet.
 */

import type { RcApi } from '../lib/rcApi';

export type RcAgendaEntry = RcApi<'RcAgendaResponse'>['entries'][number];

export type RcAgendaDay = {
  /** `RRRR-MM-TT` im ORT des Lesers — der Schluessel, nach dem gruppiert wird. */
  readonly day: string;
  readonly entries: readonly RcAgendaEntry[];
};

/**
 * Wie eine Art im Plan heisst.
 *
 * <b>Das Wort steht hier und nicht im Bauteil</b>, weil es an zwei Stellen
 * gebraucht wird — in der Liste und im Filter — und zwei Listen von Woertern
 * laufen auseinander.
 */
export const RC_AGENDA_KINDS: Readonly<Record<string, string>> = {
  appointment: 'Spotkanie',
  task: 'Zadanie',
  mass: 'Msza',
  confession: 'Spowiedź',
  sick_round: 'Odwiedziny chorych',
  event: 'Wydarzenie'
};

export function rcKindLabel(kind: string): string {
  return RC_AGENDA_KINDS[kind] ?? kind;
}

/**
 * Der Ortstag einer Zeit, als `RRRR-MM-TT`.
 *
 * Ueber `sv-SE`, weil dessen Datumsform genau ISO ist — von Hand aus Teilen
 * zusammengesetzt hiesse, die Sommerzeit selbst zu rechnen, und genau da
 * verschiebt sich ein Tag um eine Stunde und damit um einen Tag.
 */
export function rcLocalDay(iso: string, timeZone?: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  try {
    return at.toLocaleDateString('sv-SE', timeZone === undefined ? {} : { timeZone });
  } catch {
    // Eine unbekannte Zeitzone darf den Plan nicht kosten — dann eben die des
    // Browsers, und der Leser sieht seine eigene Zeit.
    return at.toLocaleDateString('sv-SE');
  }
}

/**
 * IST DIE ZEILE VERSIEGELT?
 *
 * <b>Warum das eine Funktion ist und kein Vergleich an Ort und Stelle.</b>
 * Der Dienst schreibt Felder, die nichts enthalten, GAR NICHT (`RcResults`
 * laesst leere Felder weg). Eine lesbare Zeile kommt also ohne `unreadable`
 * an — nicht mit `null`. Wer auf `!== null` prueft, bekommt fuer `undefined`
 * ein Ja und erklaert jede lesbare Zeile fuer versiegelt.
 *
 * Genau das ist passiert: der Plan zeigte „zapieczętowane" in JEDER Zeile,
 * obwohl der Leser alle Schluessel hielt. Es sah aus wie ein Rechteproblem
 * und war eine fehlende Fallunterscheidung — die teuerste Art von Fehler,
 * weil man an der falschen Stelle sucht.
 *
 * Der Vergleich steht deshalb EINMAL hier, gedeckt von einer Pruefung, die
 * das Feld auch wirklich weglaesst.
 */
export function rcSealed(entry: RcAgendaEntry): boolean {
  return (entry.unreadable ?? null) !== null;
}

/**
 * Wohin die Zeile fuehrt — oder nirgends.
 *
 * Derselbe Grund wie bei `rcSealed`, dieselbe Falle: ein fehlendes `href`
 * ist `undefined`, und `href !== null` haette einen Verweis gezeigt, der
 * nirgendwohin geht. Ein Knopf, der nichts tut, ist schlimmer als keiner.
 */
export function rcHrefOf(entry: RcAgendaEntry): string | null {
  const href = (entry.href ?? '').trim();
  return href === '' ? null : href;
}

/** Die Uhrzeit, wie sie in der Zeile steht. Ganztaegiges hat keine. */
export function rcTimeOf(entry: RcAgendaEntry, timeZone?: string): string | null {
  if (entry.allDay) return null;

  const at = new Date(entry.startsUtc);
  if (Number.isNaN(at.getTime())) return null;

  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  try {
    return at.toLocaleTimeString('pl-PL', timeZone === undefined ? options : { ...options, timeZone });
  } catch {
    return at.toLocaleTimeString('pl-PL', options);
  }
}

/**
 * Nach Tagen gruppieren, in der Zeit vorwaerts.
 *
 * <b>Leere Tage kommen NICHT vor.</b> Ein Plan ist eine Liste dessen, was
 * ansteht; dreissig leere Ueberschriften dazwischen machen aus vier Terminen
 * eine Suchaufgabe. Wer sehen will, dass ein Tag frei ist, sieht es daran, dass
 * er fehlt.
 */
export function rcGroupByDay(
  entries: readonly RcAgendaEntry[],
  timeZone?: string
): RcAgendaDay[] {
  const days = new Map<string, RcAgendaEntry[]>();

  for (const entry of entries) {
    const day = rcLocalDay(entry.startsUtc, timeZone);
    if (day === '') continue;

    const list = days.get(day);
    if (list === undefined) days.set(day, [entry]);
    else list.push(entry);
  }

  return [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, list]) => ({
      day,
      // Innerhalb des Tages nach Zeit; Ganztaegiges zuerst, weil es den ganzen
      // Tag betrifft und nicht zwischen zwei Uhrzeiten gehoert.
      entries: [...list].sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.startsUtc.localeCompare(b.startsUtc);
      })
    }));
}

/**
 * Sieben nach Art.
 *
 * Eine leere Auswahl heisst ALLES, nicht NICHTS. Andersherum waere der erste
 * Blick auf den Plan ein leerer Plan — und der sieht aus, als sei nichts
 * eingetragen.
 */
export function rcFilterKinds(
  entries: readonly RcAgendaEntry[],
  kinds: ReadonlySet<string>
): RcAgendaEntry[] {
  if (kinds.size === 0) return [...entries];
  return entries.filter((entry) => kinds.has(entry.kind));
}

/** Welche Arten wirklich vorkommen — der Filter baut sich aus den Daten. */
export function rcKindsIn(entries: readonly RcAgendaEntry[]): string[] {
  const seen = new Set<string>();
  for (const entry of entries) seen.add(entry.kind);
  return [...seen].sort((a, b) => rcKindLabel(a).localeCompare(rcKindLabel(b), 'pl'));
}

/**
 * Die Ueberschrift eines Tages — „poniedziałek, 28 sierpnia".
 *
 * Das Jahr steht nur dabei, wenn es NICHT das laufende ist: in einem Plan über
 * vier Wochen ist es überall dasselbe und nimmt der Zeile nur Platz.
 */
export function rcDayLabel(day: string, today: string): string {
  const at = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) return day;

  const sameYear = day.slice(0, 4) === today.slice(0, 4);

  return at.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC'
  });
}
