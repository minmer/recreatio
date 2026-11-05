/**
 * 0137 — „ZARZĄDZANE PRZEZ WSPÓLNOTĘ …" über einem Bereich, den eine Wspólnota angelegt hat und
 * einstellt: mit dem Weg dorthin, wo man ihn ändert. Was hier von Hand geändert wird, kann der nächste
 * Import der Wspólnota überschreiben — das steht dabei.
 */

import { useEffect, useState } from 'react';

import { rich, useT } from '../core/i18n';
import type { Ring } from '../core/keys';
import { viewPath } from '../routes';
import type { Stored } from './communityJson';
import { loadSetup } from './communityStore';

export function ManagedBy({ areaId, ring }: { areaId: string; ring: Ring | null }) {
  const t = useT();
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
      {rich(t(isRoot ? 'communities.managed.root' : 'communities.managed.unit', { name: v.community.name, unit: v.unit.name }), {
        link: (s) => <a className="wk-link" href={href}>{s}</a>
      })}
    </p>
  );
}
