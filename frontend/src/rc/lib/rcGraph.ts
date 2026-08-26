/**
 * Cogita im Browser — der Wissensgraph.
 *
 * **Die eine Sache, die dieser Klient anders macht als alle anderen hier: er
 * sucht selbst, wenn der Server es nicht kann.**
 *
 * In einer öffentlichen Bibliothek liegen die Werte im Klartext und der Server
 * durchsucht sie. In einer privaten liegen sie versiegelt — dann kommt
 * `serverSide: false` zurück, und das heisst NICHT „nichts gefunden", sondern
 * „hier kann ich nicht suchen". Wer das verwechselt, meldet eine leere
 * Trefferliste, wo er selbst hätte suchen müssen.
 *
 * Die zweite Form skaliert schlechter: gesucht wird in dem, was ohnehin
 * geladen ist. Das ist der Preis dafür, dass der Betreiber die Notizen nicht
 * lesen kann, und er wird hier bezahlt statt verschwiegen.
 */

import { rcFetch, type RcApi } from './rcApi';

export type RcLibrary = RcApi<'GraphLibrarySummary'>;
export type RcNode = RcApi<'GraphNodeView'>;
export type RcSearchHit = RcApi<'GraphSearchHit'>;

/** §1.1 — Die eingebauten Arten. Erweitert wird über `entity` plus EntityKind. */
export const RC_NODE_KINDS = [
  'text', 'number', 'date', 'boolean', 'media',
  'entity', 'entity_kind', 'edge_kind', 'range',
  'knowledge', 'topic', 'question'
] as const;

/**
 * §1.6 — Der Zustand einer Kante.
 *
 * `unknown` ist eine ANGABE und kein fehlender Wert: „wir wissen es nicht" zu
 * sagen ist etwas anderes, als nichts zu sagen. Genau darin liegt der Gewinn
 * dieses Modells, und die Oberfläche muss beides unterscheidbar zeigen.
 */
export const RC_EDGE_STATES = [
  'known', 'approximate', 'disputed', 'unknown', 'not_applicable', 'pending'
] as const;

export type RcNodeKind = (typeof RC_NODE_KINDS)[number];
export type RcEdgeState = (typeof RC_EDGE_STATES)[number];

// -- Bibliotheken -------------------------------------------------------------

export const rcLibraries = () =>
  rcFetch<RcApi<'RcLibrariesResponse'>>('/libraries', { withUnlock: true });

export const rcCreateLibrary = (areaId: string, slug: string, title: string, isPublic = false) =>
  rcFetch<RcApi<'RcLibraryCreatedResponse'>>('/libraries', {
    body: { areaId, slug, title, isPublic },
    withUnlock: true
  });

// -- Knoten und Kanten --------------------------------------------------------

export const rcNodes = (libraryId: string, kind?: RcNodeKind, limit = 200) => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (kind !== undefined) query.set('kind', kind);
  return rcFetch<RcApi<'RcNodesResponse'>>(
    `/libraries/${libraryId}/nodes?${query}`, { withUnlock: true });
};

export const rcAddNode = (libraryId: string, kind: RcNodeKind, value?: string, kindNodeId?: string) =>
  rcFetch<RcApi<'RcNodeCreatedResponse'>>(`/libraries/${libraryId}/nodes`, {
    body: { kind, value: value ?? null, kindNodeId: kindNodeId ?? null },
    withUnlock: true
  });

export const rcAddEdge = (
  libraryId: string, fromNodeId: string, toNodeId: string, kind: string,
  options: { state?: RcEdgeState; note?: string; sourceNodeId?: string; sortOrder?: number } = {}
) =>
  rcFetch<RcApi<'RcEdgeCreatedResponse'>>(`/libraries/${libraryId}/edges`, {
    body: {
      fromNodeId, toNodeId, kind,
      kindNodeId: null,
      state: options.state ?? 'known',
      note: options.note ?? null,
      sourceNodeId: options.sourceNodeId ?? null,
      sortOrder: options.sortOrder ?? 0
    },
    withUnlock: true
  });

// -- Suche --------------------------------------------------------------------

export interface RcGraphSearch {
  readonly hits: readonly RcSearchHit[];
  /** Wo gesucht wurde. Für die Oberfläche ein Satz, keine Fussnote. */
  readonly where: 'server' | 'browser';
}

/**
 * Suchen — und zwar da, wo es geht.
 *
 * Kommt `serverSide: false`, wird HIER gesucht: über die Knoten, die ohnehin
 * geladen wurden. Der Aufrufer übergibt sie; sie noch einmal zu holen wäre
 * derselbe Verkehr zweimal.
 */
export async function rcSearchGraph(
  libraryId: string,
  needle: string,
  loaded: readonly RcNode[]
): Promise<RcGraphSearch> {
  const answer = await rcFetch<RcApi<'RcGraphSearchResponse'>>(
    `/libraries/${libraryId}/search?q=${encodeURIComponent(needle)}`, { withUnlock: true });

  if (answer.serverSide) return { hits: answer.hits, where: 'server' };

  return { hits: rcSearchLoaded(needle, loaded), where: 'browser' };
}

/**
 * Die Suche im Browser. §5.2 — genaue Treffer zuerst, dann der Rest.
 *
 * Dieselbe Rangfolge wie im Server, damit sich die beiden Wege nicht
 * unterschiedlich anfühlen. Ein Benutzer, der in einer öffentlichen Bibliothek
 * eine andere Reihenfolge bekommt als in einer privaten, hält das für einen
 * Fehler — und hat recht.
 */
export function rcSearchLoaded(needle: string, nodes: readonly RcNode[]): readonly RcSearchHit[] {
  const q = needle.trim().toLowerCase();
  if (q.length === 0) return [];

  const hits: { hit: RcSearchHit; exact: boolean; length: number }[] = [];

  for (const node of nodes) {
    const value = node.value;
    if (value === null || value === undefined) continue;

    const lower = value.toLowerCase();
    if (!lower.includes(q)) continue;

    hits.push({
      hit: { nodeId: node.nodeId, kind: node.kind, value },
      exact: lower === q,
      length: value.length
    });
  }

  hits.sort((a, b) =>
    Number(b.exact) - Number(a.exact) || a.length - b.length || a.hit.value.localeCompare(b.hit.value));

  return hits.slice(0, 50).map((h) => h.hit);
}

/**
 * Ein Knoten, den der Leser nicht öffnen kann — und was die Oberfläche daraus
 * macht.
 *
 * 15.9: er fällt NICHT aus dem Graphen. Ein Loch wäre schlimmer als ein Knoten
 * ohne Beschriftung, denn die Kanten daran zeigten dann ins Leere, und der
 * Leser hielte einen zerrissenen Graphen für den ganzen.
 */
export function rcNodeLabel(node: RcNode, fallback: string): string {
  if (node.unreadable !== null && node.unreadable !== undefined) return fallback;
  if (node.value !== null && node.value !== undefined && node.value.length > 0) return node.value;

  // §1.3 — Eine Entität ohne gefülltes Feld zeigt ihre Art und ein Stück ihrer
  // Kennung. Sie ist ein Verbindungspunkt und noch nichts weiter.
  return `${node.kind} ${node.nodeId.slice(0, 8)}`;
}
