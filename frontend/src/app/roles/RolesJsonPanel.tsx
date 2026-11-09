/**
 * 2026-10-29 — DAS JSON-FACH DER ROLLEN (`rolesJson.ts`): Role → „Więcej" → „Import i eksport (JSON)".
 *
 * Der Stand (Graph, Bund, geöffnete Namen) kommt vom Graphen; dazu einmal die Bereiche je Rolle
 * (`loadRoleReach`) — nur zur Auskunft im Export, und um die Rollen der Links zu erkennen. Geht das nicht,
 * bleibt der Rest: Linkrollen dann am Namen. Erst geladen, wenn der Dialog aufgeht (`later` in `RoleGraph`).
 */

import { useEffect, useMemo, useState } from 'react';

import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { JsonPanel } from '../ui/JsonPanel';
import { Loading } from '../ui/Loading';
import { useT } from '../core/i18n';
import { loadRoleReach, type RoleReach } from './commonRole';
import type { RoleGraphData } from './roles';
import { applyRolesImport, exportRoles, liveRolesOps, planRolesImport, ROLES_JSON, rolesStateOf } from './rolesJson';

export function RolesJsonPanel({ ring, graph, names, onImported }: {
  ring: Ring;
  graph: RoleGraphData;
  names: ReadonlyMap<string, string>;
  /** Nach dem Import — auch einem halben: der Graph lädt neu, der Bund wird neu gelaufen. */
  onImported: () => Promise<void>;
}) {
  /** `undefined` — noch nicht gefragt; `null` — der Dienst gab nichts (dann ohne Bereiche). */
  const t = useT();
  const [reach, setReach] = useState<readonly RoleReach[] | null | undefined>(undefined);

  /* Nach einem Import neu gefragt — der alte Stand bleibt stehen, bis der neue da ist (das Ergebnis des Imports bleibt sichtbar). */
  useEffect(() => {
    let alive = true;
    loadRoleReach().then((r) => { if (alive) setReach(r.roles); }, () => { if (alive) setReach((was) => was ?? null); });
    return () => { alive = false; };
  }, [graph]);

  const state = useMemo(() => (reach === undefined ? null : rolesStateOf(graph, ring, names, reach)), [graph, ring, names, reach]);

  if (state === null) return <Loading lines={2} />;

  return (
    <JsonPanel
      open
      summary={t('roles.json.panel.summary')}
      lead={t('roles.json.panel.lead')}
      fileName={`role-${new Date().toISOString().slice(0, 10)}.json`}
      exportDoc={() => exportRoles(state)}
      format={ROLES_JSON}
      preview={(doc) => {
        const plan = planRolesImport(doc, state);
        return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
      }}
      importLabel={t('roles.json.panel.import')}
      note={t('roles.json.panel.note')}
      onImport={async (doc, stage) => {
        const plan = planRolesImport(doc, state);
        if ('error' in plan) throw new WorkspaceError(plan.error);
        try {
          return await applyRolesImport(plan, liveRolesOps(ring, graph), stage);
        } finally {
          stage(t('roles.json.panel.refreshing'));
          await onImported();
        }
      }}
    />
  );
}

export default RolesJsonPanel;
