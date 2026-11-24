/**
 * MODUS „WER DIE BAZA SCHREIBT" (`writes`): unter der Karte die Hinweise zur Karte (`wmAuthors.ts`, AuthorList) und was an den Wegen
 * zu einer Frage nicht stimmt (Prompt 25, `pathProblems` — auch ein Schritt, der nicht auf dieser Karte liegt); bei den Reglern
 * „Lage neu" (Entscheidung 11: die ganze Lage neu, sonst bleiben alte Orte stehen). Für Lesende ist er aus.
 */

import { useMemo } from 'react';

import type { T } from '../../../core/i18n';
import type { Flow } from '../../flow';
import type { RegionTree } from '../../regions';
import type { CogitaLibrary } from '../../store';
import type { MapMode } from '../mapMode';
import { authorIssues } from '../wmAuthors';
import type { Geometry } from '../wmGeometry';
import { pathProblems, type QPath } from '../wmPaths';
import type { Lines, World } from '../wmTypes';
import { AuthorList } from '../WorldPanels';

type Tr = T;

export function useAuthorMode(input: {
  readonly writes: boolean;
  readonly lib: CogitaLibrary;
  readonly world: World;
  readonly lines: Lines;
  readonly geometry: Geometry | null;
  readonly regions: RegionTree | null;
  readonly paths: readonly QPath[];
  readonly pathById: ReadonlyMap<string, QPath>;
  readonly flowById: ReadonlyMap<string, Flow>;
  readonly findFlow: (id: string) => Flow | undefined;
  readonly nameOf: (id: string) => string;
  readonly relayout: () => void;
  readonly t: Tr;
}): MapMode {
  const { writes, lib, world, lines, geometry, regions, paths, pathById, flowById, findFlow, nameOf, relayout, t } = input;
  const issues = useMemo(() => (writes ? authorIssues(world, lines, geometry, regions, world.order) : []), [writes, world, lines, geometry, regions]);
  const pathIssues = useMemo(() => (!writes ? [] : paths.flatMap((p) => pathProblems(p, lib.docs('qpath').find((e) => e.id === p.id)?.data ?? {}, {
    entity: (id) => lib.entity(id) !== undefined,
    flowSteps: (id) => { const f = flowById.get(id) ?? findFlow(id); return f === undefined ? undefined : new Set(f.graph.nodes.map((n) => n.id)); },
    path: (id) => pathById.get(id),
    onMap: { place: (id) => world.places.has(id), flow: (id) => lines.lines.has(id) || [...lines.sections.values()].some((x) => x.line === id) }
  }))), [writes, paths, lib, lib.revision, flowById, pathById, world, lines]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!writes) return { id: 'author', active: false };
  return {
    id: 'author',
    active: true,
    tools: <button type="button" className="wk-link-btn" onClick={relayout} data-world-relay="">{t('cogitaWorld.map.relay')}</button>,
    below: (
      <>
        <AuthorList issues={issues} nameOf={nameOf} t={t} />
        {pathIssues.length > 0 && (
          <ul className="cg-wm-qissues" data-world-path-issues={pathIssues.length}>
            {pathIssues.map((p, i) => <li key={i}>{t('cogitaData.import.pathIssue', { name: pathById.get(p.path)?.title || p.path, text: t(`cogitaData.import.${p.key}`, p.params) })}</li>)}
          </ul>
        )}
      </>
    )
  };
}
