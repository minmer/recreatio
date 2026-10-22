/**
 * Welche Seite eine eigene Domain zeigt.
 *
 * <b>Der Browser kennt seinen Ort, nicht seine Bedeutung.</b> Wer die
 * Oberfläche unter cogita.pl lädt, weiss nur, dass er unter cogita.pl ist —
 * welche Adresse auf recreatio.pl dort gemeint ist, steht im Register. Also
 * fragt er danach.
 *
 * Die Antwort hat dieselbe Form wie die einer gewöhnlichen Seite: derselbe
 * Titel, derselbe Vorspann, dieselben Bausteine. Ein Alias wird dabei schon im
 * Dienst verfolgt — hier gibt es keinen zweiten Weg zum selben Inhalt.
 */

import { openLoadedPage, type PageContent } from './page';
import { call } from '../core/session';

/** 0121 — eine versiegelte Seite wird auch hier geöffnet, wie unter recreatio.pl. */
export const loadSite = async (host: string, path = '', seats: readonly string[] = [], links: readonly string[] = []): Promise<PageContent> =>
  openLoadedPage(await call<PageContent>(
    `/site?host=${encodeURIComponent(host)}`
    + (path === '' ? '' : `&path=${encodeURIComponent(path)}`)
    + (seats.length === 0 ? '' : `&seats=${encodeURIComponent(seats.join(','))}`)
    + (links.length === 0 ? '' : `&links=${encodeURIComponent(links.join(','))}`)
  ));
