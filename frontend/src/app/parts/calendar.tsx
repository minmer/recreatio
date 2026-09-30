/**
 * „KALENDARZ" (0058) — die Termine eines oder mehrerer Kalender auf einer Seite.
 *
 * <b>Welche Termine</b>, wählt der Baustein: einen Kalender oder mehrere (die
 * Messen der Pfarrei UND die Sprechstunden des Pfarrers). Jeder Besucher sieht
 * davon, was er sehen darf.
 *
 * <b>Im Vollbild wird er zum ganzen Kalender</b>: Woche, Monat, Liste — und wer
 * die Kalender führt, trägt dort ein und ändert, ohne in den Arbeitsplatz zu wechseln.
 */

import { CalendarPartView } from '../CalendarPart';
import { definePart, text, type RawConfig } from '../part';

interface CalendarConfig {
  readonly title: string;
  readonly calendars: string;
}

const idsOf = (value: string) => value.split(',').map((one) => one.trim()).filter((one) => one !== '');

export const calendarPart = definePart<CalendarConfig>({
  kind: 'calendar',
  label: 'Kalendarz',
  use: 'Terminy wybranych kalendarzy na stronie — w pełnym ekranie osoby, które je prowadzą, mogą też dodawać i zmieniać terminy.',
  box: { colSpan: 4, rowSpan: 5 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Terminy wspólnoty' },
    { key: 'calendars', label: 'Które kalendarze', kind: 'calendars' }
  ],

  read: (raw: RawConfig): CalendarConfig => ({ title: text(raw, 'title'), calendars: text(raw, 'calendars') }),

  hasContent: (config) => idsOf(config.calendars).length > 0,
  missing: (config) => idsOf(config.calendars).length === 0
    ? 'Zaznacz co najmniej jeden kalendarz — bez tego kafelek nie pojawi się na stronie.'
    : null,

  strip: { title: 'Kalendarz', open: 'Otwórz kalendarz' },
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Najbliższy termin w jednym wierszu.'
    : (size.width === 'wide' || size.width === 'full') && size.height === 'tall'
      ? 'Tydzień w siatce godzin z przewijaniem dni; do tego tydzień, miesiąc i lista.'
      : size.height === 'tall'
        ? 'Najbliższe terminy (do 12) i opis, jak działają.'
        : 'Najbliższe terminy (do 5).',

  View: ({ config, ctx }) => <CalendarPartView title={config.title} calendarIds={idsOf(config.calendars)} ctx={ctx} />
});
