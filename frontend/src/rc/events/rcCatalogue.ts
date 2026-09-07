/**
 * Sieben und Sortieren im Katalog — ohne React, damit es sich pruefen laesst.
 *
 * <b>Warum das nicht im Bauteil steht.</b> Ein Katalog, der falsch siebt, sieht
 * nicht kaputt aus: er zeigt WENIGER, und niemand merkt, dass die Pilgerfahrt
 * fehlt. Genau solche Regeln gehoeren in reine Funktionen, die man ohne Browser
 * durchrechnen kann.
 *
 * <b>Was der Dienst NICHT tut.</b> Gesiebt wird hier, im Browser. Der Katalog
 * einer Seite umfasst die Veranstaltungen eines Veranstalters — Dutzende, nicht
 * Zehntausende. Das serverseitig zu tun hiesse, fuer jede Tastenanschlag eine
 * Anfrage zu stellen, und die Filter waeren an zwei Stellen gepflegt.
 */

import type { RcApi } from '../lib/rcApi';

export type RcCatalogueEvent = RcApi<'RcEventCollectionViewResponse'>['events'][number];

export type RcCatalogueQuery = {
  /** Freitext ueber Titel, Anriss, Art und Zielgruppe. */
  readonly text: string;
  /** Leer heisst „alle". */
  readonly category: string;
  readonly place: string;
  readonly sort: 'soonest' | 'latest' | 'title';
  /** Nur was noch bevorsteht — gemessen an einem uebergebenen Heute. */
  readonly upcomingOnly: boolean;
};

export const RC_CATALOGUE_ALL: RcCatalogueQuery = {
  text: '', category: '', place: '', sort: 'soonest', upcomingOnly: false
};

/**
 * Die Orte einer Veranstaltung.
 *
 * Kaputtes JSON kostet die Orte, nicht die Zeile: eine Veranstaltung ohne
 * Ortsangabe bleibt im Katalog stehen, eine verschwundene faellt niemandem auf.
 */
export function rcPlacesOf(event: RcCatalogueEvent): string[] {
  const raw = event.placesJson ?? '';
  if (raw.trim() === '') return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((one): one is string => typeof one === 'string').map((one) => one.trim())
        .filter((one) => one !== '')
      : [];
  } catch {
    return [];
  }
}

/** Die Arten, die wirklich vorkommen — der Filter baut sich aus den Daten. */
export function rcCategoriesOf(events: readonly RcCatalogueEvent[]): string[] {
  const seen = new Set<string>();
  for (const event of events) {
    const one = (event.category ?? '').trim();
    if (one !== '') seen.add(one);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'pl'));
}

export function rcPlacesIn(events: readonly RcCatalogueEvent[]): string[] {
  const seen = new Set<string>();
  for (const event of events) for (const one of rcPlacesOf(event)) seen.add(one);
  return [...seen].sort((a, b) => a.localeCompare(b, 'pl'));
}

/**
 * Wann eine Veranstaltung zu Ende ist — fuer „nur was bevorsteht".
 *
 * <b>Das ENDE zaehlt, nicht der Anfang.</b> Eine zweitaegige Fahrt, die gestern
 * begonnen hat, laeuft heute noch; sie aus „Nadchodzące" zu werfen hiesse, sie
 * genau den Leuten zu verbergen, die gerade unterwegs sind.
 *
 * Ohne Datum gilt sie als bevorstehend: „irgendwann" ist keine Vergangenheit.
 */
function endsAt(event: RcCatalogueEvent): number | null {
  const iso = event.endsUtc ?? event.startsUtc ?? null;
  if (iso === null) return null;
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? null : at;
}

function startsAt(event: RcCatalogueEvent): number | null {
  const iso = event.startsUtc ?? event.endsUtc ?? null;
  if (iso === null) return null;
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? null : at;
}

/** Kleinbuchstaben ohne diakritische Zeichen — „Częstochowa" findet „czestochowa". */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    // ł zerlegt sich nicht, also von Hand.
    .replace(/ł/g, 'l');
}

function matchesText(event: RcCatalogueEvent, needle: string): boolean {
  const wanted = fold(needle.trim());
  if (wanted === '') return true;

  const haystack = fold([
    event.title,
    event.summary ?? '',
    event.category ?? '',
    event.audience ?? '',
    ...rcPlacesOf(event)
  ].join(' '));

  // Jedes Wort muss vorkommen, nicht die ganze Zeichenfolge: wer „rower
  // czestochowa" tippt, meint beides und nicht diese Reihenfolge.
  return wanted.split(/\s+/).every((word) => haystack.includes(word));
}

/**
 * Sieben und sortieren.
 *
 * <c>now</c> wird UEBERGEBEN und nicht hier gelesen. Eine Funktion, die selbst
 * auf die Uhr sieht, laesst sich nicht pruefen — und „nur was bevorsteht" ist
 * genau die Regel, bei der ein Fehler unsichtbar bleibt.
 */
export function rcCatalogue(
  events: readonly RcCatalogueEvent[],
  query: RcCatalogueQuery,
  now: number
): RcCatalogueEvent[] {
  const kept = events.filter((event) => {
    if (!matchesText(event, query.text)) return false;

    if (query.category !== '' && (event.category ?? '').trim() !== query.category) return false;

    if (query.place !== '' && !rcPlacesOf(event).includes(query.place)) return false;

    if (query.upcomingOnly) {
      const ends = endsAt(event);
      if (ends !== null && ends < now) return false;
    }

    return true;
  });

  /*
   * Ohne Datum ans ENDE, in beiden Richtungen. Eine Veranstaltung ohne Termin
   * ist nicht „am fruehesten" und nicht „am spaetesten" — sie ist unbestimmt,
   * und Unbestimmtes oben zu zeigen draengte das Konkrete nach unten.
   */
  const byDate = (direction: 1 | -1) => (a: RcCatalogueEvent, b: RcCatalogueEvent) => {
    const x = startsAt(a);
    const y = startsAt(b);
    if (x === null && y === null) return a.title.localeCompare(b.title, 'pl');
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * direction;
  };

  return kept.sort(
    query.sort === 'title'
      ? (a, b) => a.title.localeCompare(b.title, 'pl')
      : byDate(query.sort === 'soonest' ? 1 : -1)
  );
}

/**
 * Der Zeitraum in einer Zeile.
 *
 * `dateLabel` schlaegt die Daten, wenn es gesetzt ist — „Adwent 2026" sagt mehr
 * als zwei Kalendertage, und wer es eintraegt, hat einen Grund dafuer.
 */
export function rcWhen(event: RcCatalogueEvent): string | null {
  const own = (event.dateLabel ?? '').trim();
  if (own !== '') return own;

  const day = (iso: string) => {
    const at = new Date(iso);
    return Number.isNaN(at.getTime()) ? null : at;
  };

  const from = event.startsUtc === null || event.startsUtc === undefined ? null : day(event.startsUtc);
  const to = event.endsUtc === null || event.endsUtc === undefined ? null : day(event.endsUtc);

  if (from === null) return null;

  const full = (d: Date) =>
    d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

  if (to === null) return full(from);

  const sameDay = from.getFullYear() === to.getFullYear()
    && from.getMonth() === to.getMonth()
    && from.getDate() === to.getDate();
  if (sameDay) return full(from);

  // „28–29 sierpnia 2026" — Monat und Jahr stehen einmal, wenn beide gleich sind.
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${from.getDate()}–${full(to)}`;
  }

  if (from.getFullYear() === to.getFullYear()) {
    const short = from.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
    return `${short} – ${full(to)}`;
  }

  return `${full(from)} – ${full(to)}`;
}

/** Die zwei Buchstaben auf einer Kachel ohne Bild. */
export function rcInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter((one) => one !== '');
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
