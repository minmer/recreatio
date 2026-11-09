/**
 * Für Leser (Cogita als Quelle, die Abschrift für AI): jeder Eintrag der Liturgia mit seinem errechneten Text und
 * seinen Verweisen. Nur gezeigt, nie als zweite kanonische Abschrift gespeichert.
 */
import type { LibEntry } from '../libraryKinds';
import { KIND } from './names';
import { entitiesOf, indexOf, resolveText } from './resources';

export function projectLiturgyEntries(entries: readonly LibEntry[]): LibEntry[] {
  const index = indexOf(entitiesOf(entries));
  const kinds: readonly string[] = Object.values(KIND);
  return entries.map(e => {
    if (!kinds.includes(e.kind)) return e;
    const resolved = resolveText(String(e.data.id), index);
    return { ...e, data: { ...e.data, references: e.data._refs ?? [], ...(resolved ? { text: resolved.blocks.map(b => `${b.verse === undefined ? '' : `${b.verse}. `}${b.text}`).join('\n') } : {}) } };
  });
}
