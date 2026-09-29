/**
 * WER ICH BIN, für die persönlichen Teile (Kalender, Aufgaben): der offene
 * Schlüsselbund, meine Personen und Rollen mit ihren Namen, und die Person,
 * in deren Namen ich eintrage.
 *
 * <b>Die Person, nicht das Konto.</b> Das Konto hält nur Personen und bekommt
 * nichts (0040); ein privater Termin gehört der ersten Person — der, die man
 * beim Anlegen des Kontos bekommen hat.
 */

import { useEffect, useState } from 'react';

import type { Ring, SealedRole } from './keys';
import { keysFor } from './ringOf';
import { myRoleNames } from './roleNames';
import type { Who } from './session';

export interface Me {
  readonly ring: Ring;
  /** Alles, was ich halte — ausser dem Konto selbst. */
  readonly roles: readonly SealedRole[];
  readonly person: SealedRole;
  readonly names: ReadonlyMap<string, string>;
}

/** `undefined`: wird geholt. `null`: der Schlüssel ist zu (die Karte fragt nach dem Passwort) oder es gibt keine Person. */
export function useMe(who: Who): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { ring, graph } = await keysFor(who);
        if (ring === null) { if (alive) setMe(null); return; }
        const roles = graph.roles.filter((r) => r.kind !== 'account' && ring.has(r.id));
        const person = roles.find((r) => r.kind === 'person') ?? null;
        if (person === null) { if (alive) setMe(null); return; }
        const names = await myRoleNames(who).catch(() => new Map<string, string>());
        if (alive) setMe({ ring, roles, person, names });
      } catch {
        if (alive) setMe(null);
      }
    })();
    return () => { alive = false; };
  }, [who]);

  return me;
}
