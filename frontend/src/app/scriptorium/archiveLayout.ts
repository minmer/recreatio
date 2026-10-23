/**
 * WIE DAS ARCHIV AUSSIEHT (2026-10-21) — Lista, Tabela, Drzewo. Ohne einen
 * einzigen Import: die Beschreibung des Bausteins (`parts/writings.tsx`) liest
 * es, und die steht auf jeder Seite — das Archiv selbst lädt erst, wenn es
 * gezeigt wird.
 */

export type Layout = 'list' | 'table' | 'tree';

export const LAYOUTS: readonly { readonly value: Layout; readonly label: string }[] = [
  { value: 'list', label: 'Lista' },
  { value: 'table', label: 'Tabela' },
  { value: 'tree', label: 'Drzewo' }
];

/** Ein Wort aus der Einstellung oder der Adresse — polnisch oder englisch; sonst die Liste. */
export function layoutOf(word: string | null | undefined): Layout {
  const w = (word ?? '').trim().toLowerCase();
  if (w === 'tabela' || w === 'table') return 'table';
  if (w === 'drzewo' || w === 'tree' || w === 'drzewko') return 'tree';
  return 'list';
}

/** Wie das Layout in der Adresse steht — polnisch, wie die Einstellung. */
export const layoutWord = (layout: Layout): string => (layout === 'table' ? 'tabela' : layout === 'tree' ? 'drzewo' : 'lista');
