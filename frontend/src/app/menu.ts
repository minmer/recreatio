/**
 * DAS MENÜ EINER SEITE (0054) — die Browserseite: wohin ein Eintrag führt,
 * und das Speichern.
 *
 * <code>
 *   abs   ein Pfad im Register — „parish/grzegorzki/oaza"
 *   rel   von der Seite des MENÜS aus — „oaza", „./oaza", „../kontakt"
 *   url   draussen — „https://…", „mailto:…", „tel:…"
 *   none  kein eigenes Ziel, nur das Dach für Untereinträge
 * </code>
 *
 * <b>Relativ zur Seite, die das Menü trägt</b>, nicht zu der, auf der man
 * steht: das Menü gilt auch für alle Seiten darunter, und „oaza" soll dort
 * dasselbe bleiben, statt mit jedem Schritt tiefer zu wandern.
 */

import type { MenuItem } from './page';
import { pagePath } from './routes';
import { call } from './session';

export type { MenuItem };

/**
 * Wohin ein relativer Pfad von `from` aus führt — „.." geht eine Seite
 * hinauf, „." bleibt. Über die Wurzel hinaus geht es nicht.
 */
export function joinPath(from: string, target: string): string {
  const steps = from.split('/').filter((one) => one !== '');
  for (const step of target.split('/').filter((one) => one !== '')) {
    if (step === '.') continue;
    if (step === '..') steps.pop();
    else steps.push(step.toLowerCase());
  }
  return steps.join('/');
}

/** Der Pfad im Register, auf den ein Eintrag zeigt — oder `null` (draussen, oder nur ein Dach). */
export function registryPath(item: MenuItem, from: string): string | null {
  if (item.kind === 'abs') return item.target.replace(/^\/+|\/+$/g, '');
  if (item.kind === 'rel') return joinPath(from, item.target);
  return null;
}

/** Die Adresse, auf die ein Eintrag verweist — `null`, wenn er nur Untereinträge trägt. */
export function hrefOf(item: MenuItem, from: string): string | null {
  if (item.kind === 'url') return item.target;
  const path = registryPath(item, from);
  if (path === null) return null;
  return path === '' ? '#/' : pagePath(path);
}

/** Führt ein Eintrag (oder einer darunter) auf diese Seite? Dann ist er „hier". */
export function leadsTo(item: MenuItem, from: string, here: string): boolean {
  return registryPath(item, from) === here || item.children.some((child) => leadsTo(child, from, here));
}

export const loadMenu = (path: string): Promise<{
  path: string;
  items: readonly MenuItem[] | null;
  inherited: { from: string; items: readonly MenuItem[] } | null;
}> => call(`/workspace/menu?path=${encodeURIComponent(path)}`);

export const saveMenu = (path: string, items: readonly MenuItem[]): Promise<{ items: number }> =>
  call('/workspace/menu', { method: 'POST', body: JSON.stringify({ path, items }) });
