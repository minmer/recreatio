/**
 * Was die Teile der Rozmowy teilen: ich (Schlüsselbund, Rollen, Namen), die Bereiche, die ich sehe, und ihre Namen.
 */

import { useEffect, useState } from 'react';

import { type AreaRow, areaPath, loadAreas } from '../areas/area';
import type { Ring, SealedRole } from '../core/keys';
import { keysFor } from '../core/ringOf';
import type { Who } from '../core/session';
import { myRoleNames } from '../roles/roleNames';
import type { GraphLike } from './chatAuthor';

/* -- Gemeinsam ----------------------------------------------------------------- */

export interface Me {
  readonly ring: Ring;
  readonly roles: readonly SealedRole[];
  readonly names: ReadonlyMap<string, string>;

  /** 0095 — wer welche Rolle hält: daraus, welche Person durch welche Rolle spricht. */
  readonly graph: GraphLike;
}

/** Schlüsselbund und eigene Rollen — einmal je Ansicht. */
export function useMe(who: Who): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { ring, graph } = await keysFor(who);
        if (ring === null) { if (alive) setMe(null); return; }
        const names = await myRoleNames(who).catch(() => new Map<string, string>());
        const roles = graph.roles.filter((r) => r.kind !== 'account' && ring.has(r.id));
        if (alive) setMe({ ring, roles, names, graph: { roles, edges: graph.edges } });
      } catch {
        if (alive) setMe(null);
      }
    })();
    return () => { alive = false; };
  }, [who]);

  return me;
}

/** Die Bereiche, die ich sehe — für den Weg, in dem ein Bereich liegt. */
export function useAreas(): readonly AreaRow[] {
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  useEffect(() => {
    let alive = true;
    void loadAreas().then((found) => { if (alive) setAreas(found.areas); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return areas;
}

/**
 * Wie ein Chat eines Bereichs heisst: der GANZE Weg — „Parafia › Bierzmowanie
 * › Kandydaci", nicht bloss „Kandydaci", das es zweimal gibt.
 */
export const titleOfArea = (areas: readonly AreaRow[], areaId: string, fallback: string) =>
  areas.some((a) => a.areaId === areaId) ? areaPath(areas, areaId).full : fallback;
