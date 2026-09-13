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

import type { PageContent } from './page';
import { call } from './session';

export const loadSite = (host: string, path = ''): Promise<PageContent> =>
  call<PageContent>(
    `/site?host=${encodeURIComponent(host)}`
    + (path === '' ? '' : `&path=${encodeURIComponent(path)}`)
  );
