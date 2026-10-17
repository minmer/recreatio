/**
 * WO DAS TELEFON SEINE SACHEN ABLEGT — unter dem Schlüssel eines Bereichs.
 * Kontakte im eigenen („Tylko ja"; den gibt es meistens schon — fehlt er,
 * entsteht er hier), das Archiv der SMS im Bereich der Rolle, der es gehört
 * (`archiveSettings.ts`, `openArea`).
 */

import { areaKeys, newestKey } from '../chat/chat';
import { loadAreas } from '../areas/area';
import { ensurePrivateArea } from '../calendar/agenda';
import type { Ring } from '../core/keys';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { selfOf } from '../roles/roles';

export interface PhoneCtx {
  readonly who: Who;
  readonly ring: Ring;
  readonly areaId: string;
  /** Alle Epochen des Bereichs, die ich halte — zum Öffnen. */
  readonly keys: ReadonlyMap<number, Uint8Array>;
  /** Die jüngste — zum Versiegeln. */
  readonly newest: { readonly epoch: number; readonly key: Uint8Array };
}

const opened = new Map<string, Promise<PhoneCtx>>();

/** Der Schlüssel ist zu (die Karte fragt nach dem Passwort) — `verdict` sagt es, damit der Läufer nicht wiederholt. */
export const LOCKED = 'locked';

/** Einmal je Karte, Konto und Bereich — ein Fehlschlag wird nicht gemerkt. */
function remember(key: string, make: () => Promise<PhoneCtx>): Promise<PhoneCtx> {
  let found = opened.get(key);
  if (found === undefined) {
    found = make();
    opened.set(key, found);
    found.catch(() => opened.delete(key));
  }
  return found;
}

async function ringOf(who: Who) {
  const { ring, graph } = await keysFor(who);
  if (ring === null) throw new WorkspaceError('Klucz jest zamknięty — odblokuj go hasłem.', LOCKED);
  return { ring, graph };
}

async function contextOf(who: Who, ring: Ring, areaId: string): Promise<PhoneCtx> {
  const keys = await areaKeys(ring, areaId, true);
  const newest = newestKey(keys);
  if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru.', LOCKED);
  return { who, ring, areaId, keys, newest };
}

/** Den eigenen Bereich öffnen (die Kontakte). */
export function openPhone(who: Who): Promise<PhoneCtx> {
  return remember(`${who.accountId}:own`, async () => {
    const { ring, graph } = await ringOf(who);
    const person = selfOf(graph);
    if (person === null) throw new WorkspaceError('Konto nie prowadzi jeszcze żadnej osoby.', LOCKED);
    const areaId = await ensurePrivateArea(ring, person, (await loadAreas()).areas);
    return contextOf(who, ring, areaId);
  });
}

/** Einen bestimmten Bereich öffnen (ein Archiv der SMS). */
export function openArea(who: Who, areaId: string): Promise<PhoneCtx> {
  return remember(`${who.accountId}:${areaId}`, async () => {
    const { ring } = await ringOf(who);
    return contextOf(who, ring, areaId);
  });
}

/** Bei der Abmeldung oder wenn sich die Schlüssel ändern. */
export function forgetPhone(): void {
  opened.clear();
}
