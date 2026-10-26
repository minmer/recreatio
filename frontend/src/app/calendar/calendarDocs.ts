/**
 * 2026-10-26 — Die Schemata und Pläne eines Kalenders, einmal geholt und
 * geöffnet, solange niemand sie ändert (`forgetDocs` nach dem Speichern).
 */

import { useEffect, useState } from 'react';

import type { Ring } from '../core/keys';
import { openDocs, type OpenedDoc, type PlanDef, type SchemeDef } from './scheme';

export interface CalendarDocs {
  readonly schemes: readonly OpenedDoc<SchemeDef>[];
  readonly plans: readonly OpenedDoc<PlanDef>[];
}

const NONE: CalendarDocs = { schemes: [], plans: [] };
const cache = new Map<string, Promise<CalendarDocs>>();
const listeners = new Set<() => void>();

export function docsOf(ring: Ring, calendarId: string): Promise<CalendarDocs> {
  let found = cache.get(calendarId);
  if (found === undefined) {
    found = openDocs(ring, calendarId).catch(() => NONE);
    cache.set(calendarId, found);
  }
  return found;
}

/** Nach dem Speichern oder Löschen: neu holen — auch in offenen Ansichten. */
export function forgetDocs(calendarId: string): void {
  cache.delete(calendarId);
  for (const one of [...listeners]) one();
}

/** Die Schemata und Pläne eines Kalenders — `null`, solange sie kommen; ohne Kalender leer. */
export function useCalendarDocs(ring: Ring, calendarId: string | null | undefined): CalendarDocs | null {
  const [found, setFound] = useState<{ id: string; docs: CalendarDocs } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const again = () => setTick((n) => n + 1);
    listeners.add(again);
    return () => { listeners.delete(again); };
  }, []);

  useEffect(() => {
    if (calendarId == null || calendarId === '' || calendarId === 'private') return undefined;
    let live = true;
    void docsOf(ring, calendarId).then((docs) => { if (live) setFound({ id: calendarId, docs }); });
    return () => { live = false; };
  }, [ring, calendarId, tick]);

  if (calendarId == null || calendarId === '' || calendarId === 'private') return NONE;
  return found?.id === calendarId ? found.docs : null;
}
