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

import { registryPath } from './menuPath';
import { loadPage, pageKeyOf, type MenuItem } from './page';
import { pagePath } from '../routes';
import { call, WorkspaceError } from '../core/session';

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

/*
 * 0121 — DAS MENÜ EINER VERSIEGELTEN SEITE ist eine Hülle unter ihrem
 * Schlüssel. Den kennt dieser Tab, sobald die Seite geladen ist (`pageKeyOf`);
 * sonst wird sie dafür einmal geholt.
 */
async function keyFor(path: string) {
  return pageKeyOf(path) ?? await loadPage(path).then(() => pageKeyOf(path)).catch(() => null);
}

export async function loadMenu(path: string): Promise<MenuState> {
  const state = await call<MenuState>(`/workspace/menu?path=${encodeURIComponent(path)}`);
  if (typeof (state.items as unknown) !== 'string') return state;

  const key = await keyFor(path);
  const seal = await import('./pageSeal');
  const text = key === null ? null : await seal.openPiece(key, seal.sealAad.menu(key.id, key.v), state.items as unknown as string);
  if (text === null) throw new WorkspaceError('Menu tej strony jest zaszyfrowane, a ta przeglądarka nie ma jej klucza.');
  return { ...state, items: seal.readMenuItems(text) };
}

export async function saveMenu(path: string, items: readonly MenuItem[]): Promise<{ items: number }> {
  const send = async (sealed: boolean): Promise<{ items: number }> => {
    const key = sealed ? await keyFor(path) : null;
    if (sealed && key === null) throw new WorkspaceError('Ta strona jest zaszyfrowana, a ta przeglądarka nie ma do niej klucza.');
    if (key === null || items.length === 0) return call('/workspace/menu', { method: 'POST', body: JSON.stringify({ path, items }) });
    const seal = await import('./pageSeal');
    await call('/workspace/menu', {
      method: 'POST',
      body: JSON.stringify({ path, items: [], sealed: await seal.sealPiece(key, seal.sealAad.menu(key.id, key.v), JSON.stringify(items)) })
    });
    return { items: items.length };
  };

  try {
    return await send(pageKeyOf(path) !== null);
  } catch (e) {
    /* Die Seite ist inzwischen anders, als dieser Tab dachte: neu holen und passend schreiben. */
    if (!(e instanceof WorkspaceError) || (e.verdict !== 'sealed' && e.verdict !== 'open')) throw e;
    await loadPage(path).catch(() => undefined);
    return send(e.verdict === 'sealed');
  }
}

/**
 * Das Menü einer anderen Seite hier gelten lassen — leer: den Verweis lösen.
 * (Hiess `useMenuOf` — wie ein React-Haken, und der Prüfer hielt es dafür.)
 */
export const adoptMenuOf = (path: string, from: string): Promise<{ items: number }> =>
  call('/workspace/menu', { method: 'POST', body: JSON.stringify({ path, items: [], uses: from }) });
