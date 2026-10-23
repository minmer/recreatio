/**
 * Wie die Rodzaje hiessen, die es nicht mehr gibt, und wie ein alter Eintrag
 * heisst (2026-10-23) — ohne React, damit Nauka (`cogita/oldInBase.ts`) und
 * die Prüfskripte es lesen können. Die Liste selbst: `OldEntries.tsx`.
 */

import { str, type LibEntry } from './libraryKinds';

/** Jak nazywały się rodzaje, których już nie ma. */
const OLD_KINDS: Readonly<Record<string, string>> = {
  text: 'Tekst', delivery: 'Wygłoszenie', project: 'Projekt', comment: 'Komentarz', topic: 'Temat', knowledge: 'Wiedza', texttype: 'Rodzaj tekstu'
};

export const oldKindLabel = (kind: string): string => OLD_KINDS[kind] ?? kind;

/** Nazwa starego wpisu — z tego, co ma w danych. */
export function oldTitle(entry: LibEntry): string {
  const clip = (value: string) => (value.length > 90 ? `${value.slice(0, 89)}…` : value);
  for (const key of ['title', 'name', 'nazwa', 'text', 'tekst', 'occasion', 'date']) {
    const value = str(entry.data, key).replace(/\s+/g, ' ').trim();
    if (value !== '') return clip(value);
  }
  /* Ein alter Komentarz: der erste Absatz seiner Bausteine. */
  const blocks = Array.isArray(entry.data.blocks) ? entry.data.blocks : [];
  for (const block of blocks) {
    const text = typeof block === 'object' && block !== null && typeof (block as { text?: unknown }).text === 'string' ? (block as { text: string }).text : '';
    const plain = text.replace(/\[@[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    if (plain !== '') return clip(plain);
  }
  return '(bez nazwy)';
}
