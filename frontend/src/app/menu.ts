/**
 * DAS MENÜ EINER SEITE (0054, 0056) — die Browserseite: wohin ein Eintrag
 * führt, und das Speichern.
 *
 * <code>
 *   abs   ein Pfad im Register — „parish/grzegorzki/oaza"
 *   rel   von der Seite des MENÜS aus — „oaza", „./oaza", „../kontakt"
 *   url   draussen — „https://…", „mailto:…", „tel:…"
 *   none  kein eigenes Ziel, nur das Dach für Untereinträge
 * </code>
 *
 * <b>Relativ zur Seite, die das Menü trägt</b>, nicht zu der, auf der man
 * steht: das Menü gilt auch für alle Seiten darunter — und seit 0056 für jede
 * Seite, die es sich holt. „oaza" soll überall dasselbe bleiben, statt mit
 * jedem Ort mitzuwandern.
 *
 * <b>Das Rechnen mit Pfaden steht in `menuPath.ts`</b> und wird dort gemessen;
 * hier bleibt, was den Dienst und das Adressfeld des Browsers braucht.
 */

import { hereIn, joinPath, registryPath, under, type Spot } from './menuPath';
import type { MenuItem } from './page';
import { pagePath } from './routes';
import { call } from './session';

export type { MenuItem, Spot };
export { hereIn, joinPath, registryPath, under };

/** Die Adresse, auf die ein Eintrag verweist — `null`, wenn er nur Untereinträge trägt. */
export function hrefOf(item: MenuItem, from: string): string | null {
  if (item.kind === 'url') return item.target;
  const path = registryPath(item, from);
  if (path === null) return null;
  return path === '' ? '#/' : pagePath(path);
}

/**
 * Was der Editor über das Menü einer Seite wissen muss.
 *
 * <code>
 *   items      ihr EIGENES Menü — oder nichts
 *   uses       das Menü, das sie sich von einer anderen Seite holt (0056);
 *              `items` darin fehlt, wenn jene inzwischen keines mehr hat
 *   inherited  was ohne beides von oben gälte
 *   usable     die Seiten mit eigenem Menü, die dieses Konto führt
 * </code>
 */
export interface MenuState {
  readonly path: string;
  readonly items: readonly MenuItem[] | null;
  readonly uses: { readonly from: string; readonly items: readonly MenuItem[] | null } | null;
  readonly inherited: { readonly from: string; readonly items: readonly MenuItem[] } | null;
  readonly usable: readonly { readonly path: string; readonly items: number }[];
}

export const loadMenu = (path: string): Promise<MenuState> =>
  call(`/workspace/menu?path=${encodeURIComponent(path)}`);

export const saveMenu = (path: string, items: readonly MenuItem[]): Promise<{ items: number }> =>
  call('/workspace/menu', { method: 'POST', body: JSON.stringify({ path, items }) });

/** Das Menü einer anderen Seite hier gelten lassen — leer: den Verweis lösen. */
export const useMenuOf = (path: string, from: string): Promise<{ items: number }> =>
  call('/workspace/menu', { method: 'POST', body: JSON.stringify({ path, items: [], uses: from }) });
