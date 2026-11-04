/**
 * 2026-11-04 (Prompt 15) — DIE TITEL MIT IHREN VORZEICHEN, EINMAL NEU.
 *
 * Der Titel einer Frage wird nie gespeichert: er ist ihr Muster `{prompt}` (`kinds.ts`), bei jedem Zeigen gefüllt und
 * aufgeräumt (`schema.ts` → `tidy`). Dort ging ein Minus nach einem Komma verloren („(0,-3)" → „(0,3)"). Mit dem neuen
 * `tidy` zeigt jede Ansicht den richtigen Titel sofort — in den Einträgen selbst ist nichts zu ändern, und ein von Hand
 * geschriebener Titel (ein eigenes Feld eines Rodzaju) wird ohnehin nie überschrieben.
 *
 * Gespeichert sind die Titel nur in den ABSCHRIFTEN für AI (`aiAccess/aiSnapshot.ts`, MCP): sie entstehen neu erst beim
 * nächsten Schreiben. Darum einmal je Baza und Browser: öffnet jemand, der dort schreibt, die Baza und hat ein Titel
 * nach der alten Regel anders ausgesehen (`signRepairs`), entsteht ihre Abschrift neu (`copiesStale`, nach der Ruhe).
 */

import type { Entity } from './schema';

/** Die alte Regel (bis 2026-11-04) — nur, um zu erkennen, welcher Titel damals anders aussah. */
export function tidyBefore(text: string): string {
  return text
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .replace(/([(\[])\s+/g, '$1')
    .replace(/([,;:–—-])(\s*[,;:–—-])+/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '')
    .trim();
}

/**
 * Welche Einträge einen erzeugten Titel tragen, der nach der alten Regel anders aussah: `label` ist der Titel nach der
 * neuen Regel; die alte Regel darüber ergibt den alten Titel (sie nimmt nur mehr weg). Gleich — nichts zu tun.
 */
export function signRepairs(entities: readonly Entity[], label: (e: Entity) => string): { id: string; before: string; now: string }[] {
  const out: { id: string; before: string; now: string }[] = [];
  for (const e of entities) {
    const now = label(e);
    const before = tidyBefore(now);
    if (before !== now) out.push({ id: e.id, before, now });
  }
  return out;
}

const DONE = 'cogita:title-signs:2026-11-04:';

/** Einmal je Baza und Browser (nur, wer dort schreibt): die Abschriften neu, wenn ein Titel sein Vorzeichen zurückbekam. */
export function repairTitleSignsOnce(lib: {
  readonly writes: boolean;
  readonly libraryId: string;
  entities(): readonly Entity[];
  label(e: Entity): string;
  readonly store: { copiesStale(): void };
}): boolean {
  if (!lib.writes) return false;
  const entities = lib.entities();
  if (entities.length === 0) return false;
  try {
    if (localStorage.getItem(DONE + lib.libraryId) !== null) return false;
    localStorage.setItem(DONE + lib.libraryId, new Date().toISOString());
  } catch {
    return false;
  }
  if (signRepairs(entities, (e) => lib.label(e)).length === 0) return false;
  lib.store.copiesStale();
  return true;
}
