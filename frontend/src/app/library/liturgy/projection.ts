/**
 * Für Leser (Cogita als Quelle, die Abschrift für AI): jeder Eintrag der Liturgia mit seinem errechneten Text und
 * seinen Verweisen. Nur gezeigt, nie als zweite kanonische Abschrift gespeichert.
 */
import type { LibEntry } from '../libraryKinds';
import { KIND } from './names';
import { entitiesOf, indexOf, resolvedWording, resolveText } from './resources';

/** Für Leser das Brzmienie (ein Fragment: die Verse seiner Bereiche) — 1.0-Blöcke werden dabei nicht gezeigt, sondern umgelesen. */
export function projectLiturgyEntries(entries: readonly LibEntry[]): LibEntry[] {
  const index = indexOf(entitiesOf(entries));
  const kinds: readonly string[] = Object.values(KIND);
  return entries.map(e => {
    if (!kinds.includes(e.kind)) return e;
    const resolved = resolveText(String(e.data.id), index);
    const { structured_content: _old, layout: _layout, layouts: _layouts, ...data } = e.data;
    return { ...e, data: { ...data, references: e.data._refs ?? [], ...(resolved ? { text: resolvedWording(resolved) } : {}) } };
  });
}
