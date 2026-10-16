/**
 * 0109 — WAS EINE ÖFFENTLICHE SEITE ÜBER DIE BÜNDEL WEISS, ohne die Werkzeuge,
 * die sie bauen (`publish.ts`): wie sie heissen, alle veröffentlichten
 * Einträge einer Art, und wie einer heisst. Leicht genug für die Wahl oben auf
 * der Seite (`entitySubject.tsx`), die jede Seite mit Wahl lädt.
 */

import { loadPublished, summaryOf, type PublishedItem, type PublishedQuery } from '../library';
import { kindOf } from '../libraryKinds';

export const REVISION_BUNDLE = 'recreatio.cogita.revision';
export const FLOW_BUNDLE = 'recreatio.cogita.flow';
export const ENTITY_BUNDLE = 'recreatio.cogita.entity';

/** Bis zu `max` veröffentlichte Einträge — der Dienst gibt höchstens 200 auf einmal. */
export async function publishedAll(library: string, query: PublishedQuery, max = 600): Promise<PublishedItem[]> {
  const out: PublishedItem[] = [];
  while (out.length < max) {
    const page = await loadPublished(library, { ...query, take: 200, skip: out.length });
    out.push(...page.items);
    if (page.items.length < 200 || out.length >= page.total) break;
  }
  return out;
}

/** Wie ein veröffentlichter Eintrag heisst — gleich welcher Art. */
export function titleOf(item: PublishedItem): string {
  const s = summaryOf(item);
  for (const key of ['title', 'name', 'text']) {
    const v = s[key];
    if (typeof v === 'string' && v.trim() !== '') return v.length > 90 ? `${v.slice(0, 88)}…` : v;
  }
  return kindOf(item.kind)?.label ?? 'Wpis';
}
