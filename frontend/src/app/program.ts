/**
 * PROGRAM (0070) — ein Termin mit allem, was darunter hängt.
 *
 * Der Dienst gibt den Baum (`/calendar/program/<termin>`), so weit der Leser
 * ihn sehen darf: angemeldet mit seinen Schlüsseln, sonst was offen ausgehängt
 * ist. Hier wird geöffnet und zum Baum zusammengesetzt.
 */

import { loadPublicKey } from './area';
import type { SealedField } from './calendar';
import { areaKeys } from './chat';
import { aad, Field, fromBase64Url, openText } from './crypto';
import type { Ring } from './keys';
import { call } from './session';

export interface ProgramRow {
  readonly itemId: string;
  readonly parentItemId: string | null;
  readonly position: number | null;
  readonly depth: number;
  readonly kind: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly allDay: boolean;
  readonly status: string;
  readonly repeatKind: string;
  readonly titlePublic: string | null;
  readonly visibilityAreaId: string;
  readonly fields: readonly SealedField[];
}

export interface ProgramNode {
  readonly itemId: string;
  readonly title: string;
  readonly location: string | null;
  readonly notes: string | null;
  readonly start: Date;
  readonly end: Date;
  readonly allDay: boolean;
  readonly cancelled: boolean;
  readonly children: readonly ProgramNode[];
}

export const loadProgram = (itemId: string): Promise<{
  itemId: string; calendarId: string; calendarTitle: string; timeZone: string; items: readonly ProgramRow[];
}> => call(`/calendar/program/${encodeURIComponent(itemId)}`);

const fieldAad = (itemId: string, field: string) =>
  aad('calendar', 'item', itemId,
    field === 'title' ? Field.CalendarEventTitle : field === 'location' ? Field.CalendarEventLocation : Field.CalendarItemNotes, 1);

/** Die Reihenfolge unter einem Ganzen: erst die Stelle, sonst die Zeit. */
export const byPlace = (a: { position: number | null; startsAt: string }, b: { position: number | null; startsAt: string }) =>
  ((a.position ?? 1e9) - (b.position ?? 1e9)) || a.startsAt.localeCompare(b.startsAt);

/**
 * Den Baum öffnen. `ring`: angemeldet — dann mit den eigenen Schlüsseln;
 * sonst die offen ausgehängten (eine Epoche je Bereich).
 */
export async function openProgram(rows: readonly ProgramRow[], ring: Ring | null): Promise<ProgramNode | null> {
  const publicKeys = new Map<string, Promise<{ epoch: number; key: Uint8Array } | null>>();
  const keyOf = async (areaId: string, epoch: number): Promise<Uint8Array | null> => {
    if (ring !== null) {
      const mine = (await areaKeys(ring, areaId).catch(() => new Map<number, Uint8Array>())).get(epoch);
      if (mine !== undefined) return mine;
    }
    if (!publicKeys.has(areaId)) {
      publicKeys.set(areaId, loadPublicKey(areaId).then((k) => ({ epoch: k.epoch, key: fromBase64Url(k.key) })).catch(() => null));
    }
    const found = await publicKeys.get(areaId)!;
    return found !== null && found.epoch === epoch ? found.key : null;
  };

  const opened = new Map<string, { title: string | null; location: string | null; notes: string | null }>();
  for (const row of rows) {
    const out = { title: null as string | null, location: null as string | null, notes: null as string | null };
    for (const f of row.fields) {
      try {
        const key = await keyOf(f.areaId, f.epoch);
        if (key === null) continue;
        const text = await openText(key, fieldAad(row.itemId, f.field), fromBase64Url(f.sealed));
        if (f.field === 'title') out.title = text;
        else if (f.field === 'location') out.location = text;
        else if (f.field === 'notes') out.notes = text;
      } catch {
        // Nicht für diesen Leser — dann der offene Titel oder „Punkt".
      }
    }
    opened.set(row.itemId, out);
  }

  const build = (row: ProgramRow): ProgramNode => {
    const o = opened.get(row.itemId)!;
    return {
      itemId: row.itemId,
      title: o.title ?? row.titlePublic ?? (row.depth === 0 ? 'Wydarzenie' : 'Punkt programu'),
      location: o.location,
      notes: o.notes,
      start: new Date(row.startsAt),
      end: new Date(row.endsAt),
      allDay: row.allDay,
      cancelled: row.status === 'cancelled',
      children: rows.filter((r) => r.parentItemId === row.itemId).sort(byPlace).map(build)
    };
  };

  const root = rows.find((r) => r.depth === 0);
  return root === undefined ? null : build(root);
}

/** Wie viele Punkte darunter — alle Ebenen. */
export const countParts = (node: ProgramNode): number =>
  node.children.reduce((sum, child) => sum + 1 + countParts(child), 0);
