/**
 * Wie der Termin-Dialog Uhrzeiten, Menschen und ihre Aufgabe nennt.
 */

import type { Duty } from './calendar';

export const time = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/**
 * 0079 — WIE „wer da sein muss" heisst, nach der Art: wer die Messe feiert,
 * wer Beichte hört, wer das Nabożeństwo leitet. Und mit welcher Pflicht ein
 * neuer Name hineinkommt.
 */
export const peopleWord = (kind: string): string =>
  kind === 'mass' ? 'Kto odprawia' : kind === 'confession' ? 'Kto spowiada' : kind === 'devotion' ? 'Kto prowadzi' : 'Kto musi być';

export const dutyOf = (kind: string): Duty => (kind === 'mass' ? 'celebrant' : kind === 'devotion' ? 'lead' : 'present');
