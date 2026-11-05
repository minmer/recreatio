/**
 * Wie der Termin-Dialog Uhrzeiten, Menschen und ihre Aufgabe nennt.
 */

import type { Duty } from './calendar';
import { appLang, localeOf, t } from '../core/i18n';

export const time = (at: Date) => at.toLocaleTimeString(localeOf(appLang()), { hour: '2-digit', minute: '2-digit' });

/**
 * 0079 — WIE „wer da sein muss" heisst, nach der Art: wer die Messe feiert,
 * wer Beichte hört, wer das Nabożeństwo leitet. Und mit welcher Pflicht ein
 * neuer Name hineinkommt.
 */
export const peopleWord = (kind: string): string =>
  t(kind === 'mass' ? 'calendarApp.peopleWord.mass' : kind === 'confession' ? 'calendarApp.peopleWord.confession' : kind === 'devotion' ? 'calendarApp.peopleWord.devotion' : 'calendarApp.peopleWord.other');

export const dutyOf = (kind: string): Duty => (kind === 'mass' ? 'celebrant' : kind === 'devotion' ? 'lead' : 'present');
