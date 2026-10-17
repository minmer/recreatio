/**
 * WO DAS TELEFON SEINE SACHEN ABLEGT — im eigenen Bereich („Tylko ja"), unter
 * dessen Schlüssel: Kontakte, das Archiv der SMS, Bilder aus MMS. Den Bereich
 * gibt es meistens schon (Kalender, Notatki); fehlt er, entsteht er hier.
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

/** Den eigenen Bereich öffnen — einmal je Karte und Konto. */
export function openPhone(who: Who): Promise<PhoneCtx> {
  let found = opened.get(who.accountId);
  if (found === undefined) {
    found = (async () => {
      const { ring, graph } = await keysFor(who);
      if (ring === null) throw new WorkspaceError('Klucz jest zamknięty — odblokuj go hasłem.', LOCKED);
      const person = selfOf(graph);
      if (person === null) throw new WorkspaceError('Konto nie prowadzi jeszcze żadnej osoby.', LOCKED);
      const areaId = await ensurePrivateArea(ring, person, (await loadAreas()).areas);
      const keys = await areaKeys(ring, areaId, true);
      const newest = newestKey(keys);
      if (newest === null) throw new WorkspaceError('Nie masz klucza własnego obszaru.', LOCKED);
      return { who, ring, areaId, keys, newest };
    })();
    opened.set(who.accountId, found);
    found.catch(() => opened.delete(who.accountId));
  }
  return found;
}

/** Bei der Abmeldung oder wenn sich die Schlüssel ändern. */
export function forgetPhone(): void {
  opened.clear();
}
