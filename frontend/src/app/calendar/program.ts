/**
 * PROGRAM (0070) — ein Termin mit allem, was darunter hängt.
 *
 * Der Dienst gibt den Baum (`/calendar/program/<termin>`), so weit der Leser
 * ihn sehen darf: angemeldet mit seinen Schlüsseln, sonst was offen ausgehängt
 * ist. Hier wird geöffnet und zum Baum zusammengesetzt.
 */

import { loadPublicKey } from './area';
import { emptyTexts, itemFieldAad, putText, type ItemTexts, type SealedField } from './calendar';
import { areaKeys } from './chat';
import { fromBase64Url, openText } from './crypto';
import { heldAreaKey, heldProofs } from './linkAccess';
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
  /** 0073 — „Więcej informacji" an diesem Punkt. */
  readonly link: string | null;
  readonly linkLabel: string | null;
  readonly start: Date;
  readonly end: Date;
  readonly allDay: boolean;
  readonly cancelled: boolean;
  readonly children: readonly ProgramNode[];
}

/** Mit den Beweisen der Links mit Zugang in diesem Browser (0073): was ihre Rollen lesen, kommt mit. */
export const loadProgram = async (itemId: string): Promise<{
  itemId: string; calendarId: string; calendarTitle: string; timeZone: string; items: readonly ProgramRow[];
}> => {
  const links = await heldProofs().catch(() => []);
  return call(`/calendar/program/${encodeURIComponent(itemId)}${links.length === 0 ? '' : `?links=${encodeURIComponent(links.join(','))}`}`);
};

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
    return found !== null && found.epoch === epoch ? found.key : heldAreaKey(areaId, epoch);
  };

  const opened = new Map<string, ItemTexts>();
  for (const row of rows) {
    const out = emptyTexts();
    for (const f of row.fields) {
      try {
        const key = await keyOf(f.areaId, f.epoch);
        if (key === null) continue;
        putText(out, f.field, await openText(key, itemFieldAad(row.itemId, f.field), fromBase64Url(f.sealed)));
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
      link: o.link,
      linkLabel: o.linkLabel,
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
