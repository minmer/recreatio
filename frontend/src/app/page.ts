/**
 * Was unter einer Adresse steht — holen und schreiben.
 *
 * <b>Nichts davon ist versiegelt.</b> Eine öffentliche Seite wird ohne Konto
 * ausgeliefert; hier gibt es keinen Schlüssel und keine Hülle, und das ist der
 * Unterschied zu allem anderen im Arbeitsplatz.
 */

import { call } from './session';

export interface PageContent {
  readonly path: string;

  /** `null` heisst: die Adresse ist übernommen, aber noch nichts geschrieben. */
  readonly title: string | null;
  readonly lead: string | null;
  readonly updatedAt: string | null;
}

/* Jeder Teil für sich kodiert: ein Schrägstrich TRENNT die Teile und darf
   nicht in einem stehen. `encodeURIComponent` über den ganzen Pfad machte
   daraus `%2F` — der Dienst sähe eine Adresse, die es nicht gibt. */
const encodePath = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

export const loadPage = (path: string): Promise<PageContent> =>
  call<PageContent>(`/page/${encodePath(path)}`);

export const savePage = (
  path: string, body: { readonly title: string; readonly lead: string | null }
): Promise<PageContent> =>
  call<PageContent>(`/workspace/page/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
