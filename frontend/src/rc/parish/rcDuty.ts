/**
 * Dyżury — kto spowiada, kto celebruje.
 *
 * <b>Nazwisko wpisuje się, a nie wybiera z listy ról.</b> To nie jest
 * uproszczenie, tylko skutek szyfrowania: nazwa roli leży zapieczętowana i
 * otwiera ją KLUCZ TEJ ROLI. Kancelaria trzyma swoje role, nie cudze — lista
 * „wybierz kapłana z parafii" byłaby listą identyfikatorów bez nazwisk.
 *
 * Grafik i tak powstaje przez wpisanie nazwisk. `roleId` dopisuje się wtedy, gdy
 * ktoś naprawdę zwiąże dyżur z rolą — i dopiero wtedy da się kiedyś pokazać
 * kapłanowi „moje dyżury".
 */

import { rcFetch } from '../lib/rcApi';
import type { RcApi } from '../lib/rcApi';
import { rcOccurrenceKey } from '../lib/rcCalendar';

export type RcDuties = RcApi<'DutyRcDutiesResponse'>;
export type RcDuty = RcApi<'DutyDutyView'>;

export const rcDuties = (itemId: string) =>
  rcFetch<RcDuties>(`/calendar-items/${encodeURIComponent(itemId)}/duties`, { withUnlock: true });

/**
 * Wpisać kogoś na dyżur.
 *
 * `occurrenceUtc` puste znaczy: tak jest zawsze w tej serii. Podane — tylko tego
 * dnia, i wtedy ZASTĘPUJE stały grafik, a nie dopisuje się do niego.
 */
export const rcAddDuty = (
  itemId: string,
  body: {
    name: string;
    occurrenceUtc?: string | null;
    sortOrder?: number;
    note?: string;
    isPublic?: boolean;
  }
) =>
  rcFetch<RcApi<'DutyRcDutyAddedResponse'>>(
    `/calendar-items/${encodeURIComponent(itemId)}/duties`,
    {
      body: {
        ...body,
        // Ten sam zapis chwili co wszędzie: bez plusa, którego IIS nie przepuszcza.
        occurrenceUtc: body.occurrenceUtc == null ? null : rcOccurrenceKey(body.occurrenceUtc)
      },
      withUnlock: true
    });

export const rcRemoveDuty = (dutyId: string) =>
  rcFetch<RcApi<'DutyRcDutyRemovedResponse'>>(
    `/duties/${encodeURIComponent(dutyId)}/remove`, { body: {}, withUnlock: true });

/**
 * Kto dyżuruje w tym wystąpieniu.
 *
 * <b>Wyjątek ZASTĘPUJE stały grafik.</b> Kto wpisuje zastępstwo na 24 grudnia,
 * chce, żeby stały dyżurny tego dnia zniknął — a nie stał obok kogoś, kogo nie
 * będzie. Dopisywanie byłoby cichsze i groźniejsze.
 */
export function rcDutyAt(
  duties: readonly RcDuty[], occurrenceUtc: string
): readonly RcDuty[] {
  const key = rcOccurrenceKey(occurrenceUtc);

  const own = duties.filter(
    (d) => d.occurrenceUtc != null && rcOccurrenceKey(d.occurrenceUtc) === key);

  if (own.length > 0) return own;

  return duties.filter((d) => d.occurrenceUtc == null);
}
