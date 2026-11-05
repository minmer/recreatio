/**
 * 0137 — „ZARZĄDZANE PRZEZ WSPÓLNOTĘ …" über einem Bereich, den eine Wspólnota angelegt hat und
 * einstellt: mit dem Weg dorthin, wo man ihn ändert. Was hier von Hand geändert wird, kann der nächste
 * Import der Wspólnota überschreiben — das steht dabei.
 */

import { useEffect, useState } from 'react';

import type { Ring } from '../core/keys';
import { viewPath } from '../routes';
import type { Stored } from './communityJson';
import { loadSetup } from './communityStore';

export function ManagedBy({ areaId, ring }: { areaId: string; ring: Ring | null }) {
  const [stored, setStored] = useState<Stored | null>(null);
  useEffect(() => {
    let alive = true;
    void loadSetup(ring, areaId).then((r) => { if (alive) setStored(r.stored); }, () => undefined);
    return () => { alive = false; };
  }, [areaId, ring]);
  if (stored === null) return null;
  const v = stored.view;
  const root = v.community.areaId;
  const isRoot = stored.kind === 'community';
  const href = viewPath('wspolnoty', root, ...(isRoot ? [] : ['jednostka', v.unit.key]));
  return (
    <p className="wk-cm-managed" data-managed-by={root}>
      {isRoot ? 'Wspólnota' : 'Zarządzane przez wspólnotę'} <a className="wk-link" href={href}>„{v.community.name}”</a>
      {isRoot ? ' — jednostki, pozycje, osoby i ustawienia' : ` · jednostka „${v.unit.name}”`}.
      {' Ręczne zmiany ról, stron i rozmów tutaj następny zapis wspólnoty może nadpisać.'}
    </p>
  );
}
