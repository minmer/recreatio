/**
 * „STARE WPISY" W NAUCE (2026-10-23) — was diese Version in einer Baza nicht
 * mehr kennt: Einträge der früheren eingebauten Rodzaje „Wiedza" (`knowledge`,
 * auch ein Eintrag ganz ohne Rodzaj), „Komentarz" (`comment`) und (Schritt 5)
 * „Temat" (`topic`), und Änderungen dieser eingebauten Rodzaje (ein Dokument
 * `kind` mit `builtin`, z. B. die „Pola nauki" eines Themas).
 * Liste und Löschen sind die der Bibliothek (`library/OldEntries.tsx`).
 *
 * Nur diese benannten Rodzaje: ein Eintrag, dessen Rodzaj aus einer Quelle
 * kommt, die dieses Konto gerade nicht liest, ist nicht alt.
 */

import type { Entry } from '../library/libraryStore';
import { oldKindLabel } from '../library/oldKinds';
import { ENTITY, entityOf, LEGACY_KNOWLEDGE } from './kinds';

/** Die Rodzaje, die es in Nauka nicht mehr gibt. */
export const RETIRED_KINDS: ReadonlySet<string> = new Set([LEGACY_KNOWLEDGE, 'comment', 'topic']);

/** Ist dieser Eintrag der Baza alt? `kindOf`: der Rodzaj, wie die Baza ihn heute kennt. */
export function isOldInBase(entry: Entry, kindOf: (id: string) => unknown): boolean {
  if (entry.kind === 'kind') return typeof entry.data.builtin === 'string' && RETIRED_KINDS.has(entry.data.builtin);
  if (entry.kind !== ENTITY) return false;
  const kinds = entityOf(entry)?.kinds ?? [];
  return kinds.length > 0 && kinds.every((k) => RETIRED_KINDS.has(k) && kindOf(k) === undefined);
}

/** Wie der alte Eintrag in der Liste heisst. */
export function oldInBaseLabel(entry: Entry): string {
  if (entry.kind === 'kind') return `Rodzaj (zmiana wbudowanego): ${oldKindLabel(String(entry.data.builtin))}`;
  return (entityOf(entry)?.kinds ?? []).map(oldKindLabel).join(', ');
}
