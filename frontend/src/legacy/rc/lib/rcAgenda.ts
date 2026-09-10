/**
 * Der Terminplan — ein Fenster, alle Quellen.
 *
 * <b>Warum EIN Aufruf und nicht einer je Kalender.</b> Der Browser wuesste sonst
 * erst nach der Antwort, welche Kalender es gibt, und muesste dann je Kalender
 * fragen — bei acht Bereichen neun Rundreisen, bevor die erste Zeile steht. Und
 * die Veranstaltungen kaemen aus einer zehnten.
 *
 * <b>Das Fenster ist Pflicht, nicht Bequemlichkeit.</b> Eine taegliche Messe hat
 * unendlich viele Vorkommen; „alles" ist hier keine Frage, die sich beantworten
 * laesst. Der Dienst begrenzt auf ein Jahr.
 */

import { rcFetch, type RcApi } from './rcApi';

export type RcAgendaView = RcApi<'RcAgendaResponse'>;

export const rcAgenda = (fromUtc: string, toUtc: string) =>
  rcFetch<RcAgendaView>(
    `/agenda?from=${encodeURIComponent(fromUtc)}&to=${encodeURIComponent(toUtc)}`,
    { withUnlock: true });
