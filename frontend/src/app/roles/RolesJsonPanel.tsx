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
      summary="Role jako JSON"
      lead={<>Osoby, role i grupy tego konta: kto kogo trzyma i na jakim stopniu, z nazwami — do kopii, do poprawy ręcznie albo przez AI. Wpis z „id” zmienia istniejącą rolę (nazwę, rodzaj rola/grupa, kto jeszcze ją trzyma), wpis bez „id” zakłada nową rolę albo grupę. Niczego się nie usuwa.</>}
      fileName={`role-${new Date().toISOString().slice(0, 10)}.json`}
      exportDoc={() => exportRoles(state)}
      format={ROLES_JSON}
      preview={(doc) => {
        const plan = planRolesImport(doc, state);
        return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
      }}
      importLabel="Importuj role"
      note="Każda nowa rola to kilka sekund liczenia kluczy w tej przeglądarce — nie zamykaj karty, póki import trwa."
      onImport={async (doc, stage) => {
        const plan = planRolesImport(doc, state);
        if ('error' in plan) throw new WorkspaceError(plan.error);
        try {
          return await applyRolesImport(plan, liveRolesOps(ring, graph), stage);
        } finally {
          stage('Odświeżanie ról…');
          await onImported();
        }
      }}
    />
  );
}

export default RolesJsonPanel;
