/**
 * Tage rechnen — für den Kalender der Messplan-Kachel und alles, was eine
 * Woche oder einen Monat aufschlägt.
 *
 * <b>In Ortszeit und von Mitternacht zu Mitternacht.</b> Wer „Dienstag"
 * wählt, meint den Dienstag, an dem er in die Kirche geht — nicht 24 Stunden
 * ab jetzt. Deshalb wird hier mit Kalendertagen gerechnet (`setDate`), nicht
 * mit Millisekunden: an den zwei Sonntagen im Jahr, an denen die Uhr springt,
 * hätte ein Tag sonst 23 oder 25 Stunden und die Woche verrutschte.
 *
 * <b>Die Woche beginnt am Montag</b>, wie im polnischen Kalender und im
 * Aushang der Pfarrei.
 */

import { appLang, fmtDate, localeOf, t, type Lang } from './i18n';

export const startOfDay = (at: Date): Date => {
  const out = new Date(at);
  out.setHours(0, 0, 0, 0);
  return out;
};

export const addDays = (at: Date, days: number): Date => {
  const out = new Date(at);
  out.setDate(out.getDate() + days);
  return out;
};

export const firstOfMonth = (at: Date): Date => new Date(at.getFullYear(), at.getMonth(), 1);

export const addMonths = (at: Date, months: number): Date => new Date(at.getFullYear(), at.getMonth() + months, 1);

/** Der Montag der Woche, in der dieser Tag liegt. */
export const mondayOf = (at: Date): Date => addDays(startOfDay(at), -((at.getDay() + 6) % 7));

/**
 * Die 42 Tage eines Monatsblatts: vom Montag vor dem Ersten an, sechs Wochen.
 * Immer sechs — ein Blatt, das je nach Monat fünf oder sechs Zeilen hat,
 * springt beim Blättern in der Höhe.
 */
export const monthGrid = (at: Date): readonly Date[] => {
  const start = mondayOf(firstOfMonth(at));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

/** Der Tag als Schlüssel „2026-09-29" — derselbe wie `mass.dayKey` für ein Datum in Ortszeit. */
export const keyOf = (at: Date): string =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

/** Die Gegenrichtung: „2026-09-29" als Mitternacht in Ortszeit. */
export const fromKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const sameDay = (a: Date, b: Date): boolean => keyOf(a) === keyOf(b);

export const sameMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/*
 * 2026-11-05 — Namen von Tagen und Monaten kommen aus `Intl` in der Sprache der Anwendung (oder `lang`);
 * nur die kurzen Köpfe des Monatsblatts stehen in `core.date.weekHead` (`Intl` kürzt polnisch „pon.").
 * Schmale Leerzeichen aus `Intl` werden zu gewöhnlichen — die Prüfungen vergleichen Text.
 */
const plain = (s: string): string => s.replace(/[  ]/g, ' ');

/** „czwartek" — der Name des Tages. */
export const weekdayName = (at: Date, lang?: Lang): string => fmtDate(at, { weekday: 'long' }, lang);

/** „listopada" — der Monat im Genitiv, wie hinter einer Zahl. */
export const monthOfName = (at: Date, lang?: Lang): string =>
  new Intl.DateTimeFormat(localeOf(lang ?? appLang()), { day: 'numeric', month: 'long' }).formatToParts(at).find((p) => p.type === 'month')?.value ?? '';

const HEAD_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Die Köpfe eines Monatsblatts, Montag zuerst — beim Lesen übersetzt. */
export const WEEK_HEADS: readonly string[] = (() => {
  const out: string[] = [];
  HEAD_KEYS.forEach((k, i) => Object.defineProperty(out, i, { get: () => t(`core.date.weekHead.${k}`), enumerable: true }));
  out.length = HEAD_KEYS.length;
  return Object.freeze(out);
})();

/** „wrzesień 2026" — der Monat als Überschrift, im Nominativ. */
export const monthTitle = (at: Date, lang?: Lang): string => fmtDate(at, { month: 'long', year: 'numeric' }, lang);

/** „wtorek, 29 września 2026" — für Vorleseprogramme und Tooltips. */
export const longDate = (at: Date, lang?: Lang): string =>
  fmtDate(at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, lang);

/**
 * Eine Spanne in Worten — „2–4 października 2026", „29 września – 5
 * października 2026". Das Ende ist AUSSCHLIESSLICH, wie bei jeder Spanne hier.
 */
export function rangeTitle(from: Date, toExclusive: Date, lang?: Lang): string {
  const last = addDays(toExclusive, -1);
  const f = new Intl.DateTimeFormat(localeOf(lang ?? appLang()), { day: 'numeric', month: 'long', year: 'numeric' });
  return plain(sameDay(from, last) ? f.format(from) : (f as Intl.DateTimeFormat & { formatRange(a: Date, b: Date): string }).formatRange(from, last));
}
