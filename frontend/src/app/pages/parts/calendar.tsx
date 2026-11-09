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

import { t } from '../../core/i18n';
import { text, type RawConfig } from '../part';
import { field, texts, textPart } from './partTexts';
import { later } from '../../ui/later';

/* 2026-10-17 — die Ansicht erst, wenn sie gezeigt wird (`ui/later`): eine Seite ohne diesen Baustein lädt sie nicht. */
const CalendarPartView = later(() => import('../../calendar/CalendarPart').then((m) => m.CalendarPartView));

interface CalendarConfig {
  readonly title: string;
  readonly calendars: string;
}

const idsOf = (value: string) => value.split(',').map((one) => one.trim()).filter((one) => one !== '');

export const calendarPart = textPart<CalendarConfig>(texts({ label: 'moduleData.calendar.label', use: 'moduleData.calendar.use' }), {
  kind: 'calendar',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: texts({ title: 'moduleData.calendar.exTitle', calendars: 'moduleData.calendar.exCalendars' }),
  box: { colSpan: 4, rowSpan: 5 },

  fields: [
    field({ key: 'title', kind: 'line' }, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleData.calendar.titleHint' })),
    field({ key: 'calendars', kind: 'calendars' }, texts({ label: 'moduleData.calendar.which' }))
  ],

  read: (raw: RawConfig): CalendarConfig => ({ title: text(raw, 'title'), calendars: text(raw, 'calendars') }),

  hasContent: (config) => idsOf(config.calendars).length > 0,
  missing: (config) => idsOf(config.calendars).length === 0
    ? t('moduleData.calendar.missing')
    : null,

  strip: texts({ title: 'moduleData.calendar.label', open: 'moduleData.calendar.open' }),
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? t('moduleData.calendar.showsStrip')
    : (size.width === 'wide' || size.width === 'full') && size.height === 'tall'
      ? t('moduleData.calendar.showsWideTall')
      : size.height === 'tall'
        ? t('moduleData.calendar.showsTall')
        : t('moduleData.calendar.showsBlock'),

  View: ({ config, ctx }) => <CalendarPartView title={config.title} calendarIds={idsOf(config.calendars)} ctx={ctx} />
});
