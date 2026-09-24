/**
 * Was unter einer Adresse steht — holen und schreiben.
 *
 * <b>Nichts davon ist versiegelt.</b> Eine öffentliche Seite wird ohne Konto
 * ausgeliefert; hier gibt es keinen Schlüssel und keine Hülle, und das ist der
 * Unterschied zu allem anderen im Arbeitsplatz.
 */

import type { Layout } from './layout';
import { readConfig } from './module';
import { call } from './session';

/**
 * Ein Baustein, so wie er gespeichert liegt.
 *
 * `layout` und `config` sind ZEICHENKETTEN und keine Objekte: der Dienst legt
 * sie ab, ohne sie zu lesen. Ausgepackt werden sie hier — duldsam, damit ein
 * kaputter Eintrag nur sich selbst leert und nicht die Seite.
 */
export interface PagePart {
  readonly id: string;
  readonly kind: string;
  readonly layout: string;
  readonly config: string | null;
}

export interface PageContent {
  readonly path: string;

  /** `null` heisst: die Adresse ist übernommen, aber noch nichts geschrieben. */
  readonly title: string | null;
  readonly lead: string | null;
  readonly updatedAt: string | null;
  readonly parts: readonly PagePart[];
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

/** Ein Baustein, wie ihn der Editor hält: ausgepackt. */
export interface DraftPart {
  readonly id: string;
  readonly kind: string;
  readonly layout: Layout;
  readonly config: Record<string, string>;
}

/**
 * Vom Gespeicherten zum Bearbeitbaren — duldsam.
 *
 * Was hier ankommt, hat den Dienst als Zeichenkette passiert: er liest es nicht
 * und prüft es nicht. Ein kaputter Eintrag darf deshalb nur sich selbst leeren
 * und nicht den Editor — aus Unlesbarem wird ein Baustein ohne Anordnung, und
 * der landet beim nächsten Öffnen oben links statt nirgends.
 */
export function toDraft(part: PagePart): DraftPart {
  let layout: Layout = {};

  try {
    const parsed: unknown = JSON.parse(part.layout);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      layout = parsed as Layout;
    }
  } catch { /* ohne Anordnung */ }

  return { id: part.id, kind: part.kind, layout, config: readConfig(part.config) };
}

/**
 * Die ganze Anordnung auf einmal.
 *
 * Wer zieht, schiebt und löscht, ändert nicht einen Baustein, sondern eine
 * Anordnung — deshalb geht sie als Ganzes hinaus und wird in einer Transaktion
 * ersetzt.
 */
export const saveParts = (path: string, parts: readonly DraftPart[]): Promise<{ parts: number }> =>
  call<{ parts: number }>('/workspace/parts', {
    method: 'PUT',
    body: JSON.stringify({
      path,
      parts: parts.map((part) => ({
        id: part.id,
        kind: part.kind,
        layout: JSON.stringify(part.layout),
        config: JSON.stringify(part.config)
      }))
    })
  });
