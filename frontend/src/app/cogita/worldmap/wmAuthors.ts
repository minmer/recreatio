/**
 * 2026-11-09 — DIE LISTE FÜR AUTOREN (spec §11, Korrektur 7): was an den Daten der Karte schadet, nur für Schreibende. Aus dem
 * Lesen der Welt (`wmGraph.ts`: Kreise, baumelnde Verweise, Teil und Voraussetzung zugleich …), aus den Linien (`wmLines.ts`:
 * Erzählungen ohne Orte, unbekannte Bedingungen, Mitglieder eines Wątek ohne Abstecher, eine Einheit, die die Voraussetzung einer
 * Schwester verlangt, ein später Anfang …), aus der Gestalt (kein Gleis gefunden — rot) und aus den Farbgebieten (benannt nach
 * einem anderen Thema als ihrer Mitte). Rein (ohne React).
 */

import type { RegionTree } from '../regions';
import type { Geometry } from './wmGeometry';
import { ISSUE_CODES, type Lines, type WmIssue, type World } from './wmTypes';

/** Gleise, die A* nicht fand: gerade gezogen, rot in der Liste (spec §11 — der Test der Gleise schlägt dann fehl). */
export function noRouteIssues(g: Pick<Geometry, 'noRoute'> | null): WmIssue[] {
  return (g?.noRoute ?? []).map(([a, b]): WmIssue => ({ code: 'noRoute', level: 'error', ids: [a, b] }));
}

/**
 * FARBGEBIETE MIT DEM NAMEN EINES ANDEREN THEMAS (Bericht §6, „Opowieści — krajobraz": das Gebiet von w0 heisst „Dom w czasie
 * burzy"): ein Gebiet heisst nach seinem mittigsten Thema; ist dieser Name schon vergeben, nimmt `regions.ts` das nächste. Dann
 * trägt das Gebiet den Namen eines Themas, das nicht seine Mitte ist — der Autor gibt ihm besser selbst einen Namen.
 */
export function mislabelledRegions(tree: RegionTree | null, ids: readonly string[]): WmIssue[] {
  if (tree === null) return [];
  const out: WmIssue[] = [];
  const known = new Set(ids);
  for (const r of tree.regions.values()) {
    if (r.named !== 'central' || !r.key.startsWith('r:')) continue;
    const centre = r.key.slice(2).replace(/~\d+$/, '');
    const named = ids[r.central];
    if (named === undefined || named === centre || !known.has(centre)) continue;
    out.push({ code: 'mislabelledRegion', level: 'info', ids: [centre, named], data: { name: r.name } });
  }
  return out;
}

const RANK: Readonly<Record<WmIssue['level'], number>> = { error: 0, warning: 1, info: 2 };

/** Alles zusammen, das Schlimmste zuerst, dann in der Reihenfolge der Arten. */
export function authorIssues(world: Pick<World, 'issues'>, lines: Pick<Lines, 'issues'>, geometry: Pick<Geometry, 'noRoute'> | null, regions: RegionTree | null, ids: readonly string[]): WmIssue[] {
  const all = [...world.issues, ...lines.issues, ...noRouteIssues(geometry), ...mislabelledRegions(regions, ids)];
  return all.sort((a, b) => (RANK[a.level] - RANK[b.level]) || (ISSUE_CODES.indexOf(a.code) - ISSUE_CODES.indexOf(b.code)));
}
