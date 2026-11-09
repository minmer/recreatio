/**
 * 2026-11-09 — DIE GESPEICHERTE LAGE DER WELTKARTE (Entscheidung 11): ein Dokument `worldmap` je Baza mit der Lage jedes
 * Knotens (Ort, Block, Haus). Schreibende legen es selbst ab, sobald eine neue Lage gerechnet ist (neue Orte eingefügt) —
 * und auf „Ułóż mapę od nowa". Lernende schreiben nie: sie rechnen aus der gespeicherten Lage und fügen Neues ein,
 * deterministisch, also bei allen gleich. Nie im JSON eines Kurses (spec §9.7: keine Lage in Importen).
 */

import type { CogitaLibrary } from '../store';
import { GEOMETRY_PARAMS, type Geometry } from './wmGeometry';

export interface StoredLayout {
  readonly id: string;
  readonly params: string;
  readonly positions: Readonly<Record<string, readonly [number, number]>>;
  readonly at: number;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Die gespeicherte Lage dieser Baza — nur aus derselben Fassung der Rechnung (`GEOMETRY_PARAMS`). */
export function storedLayout(lib: Pick<CogitaLibrary, 'docs'>): StoredLayout | null {
  const doc = lib.docs('worldmap')[0];
  if (doc === undefined) return null;
  const d = doc.data;
  if (d.params !== GEOMETRY_PARAMS || typeof d.positions !== 'object' || d.positions === null) return null;
  const positions: Record<string, readonly [number, number]> = {};
  for (const [id, p] of Object.entries(d.positions as Record<string, unknown>)) {
    if (Array.isArray(p) && p.length === 2 && finite(p[0]) && finite(p[1])) positions[id] = [p[0], p[1]];
  }
  return { id: doc.id, params: GEOMETRY_PARAMS, positions, at: finite(d.at) ? d.at : 0 };
}

/** Hat sich die Lage der Knoten gegenüber der gespeicherten geändert (neue, verschobene oder entfallene)? */
export function layoutChanged(stored: StoredLayout | null, g: Pick<Geometry, 'nodes'>): boolean {
  if (stored === null) return Object.keys(g.nodes).length > 0;
  const now = Object.keys(g.nodes);
  if (now.length !== Object.keys(stored.positions).length) return true;
  for (const id of now) {
    const a = stored.positions[id];
    const b = g.nodes[id];
    if (a === undefined || Math.abs(a[0] - b[0]) > 0.05 || Math.abs(a[1] - b[1]) > 0.05) return true;
  }
  return false;
}

/** Das Dokument einer Lage. */
export const layoutDoc = (g: Pick<Geometry, 'nodes'>, at = Date.now()): Record<string, unknown> => ({
  name: 'worldmap', params: GEOMETRY_PARAMS, at,
  positions: Object.fromEntries(Object.keys(g.nodes).sort().map((id) => [id, [g.nodes[id][0], g.nodes[id][1]]]))
});

/** Ablegen, wenn jemand schreiben darf und sich etwas änderte; sonst nichts. `true`: abgelegt. */
export async function keepLayout(lib: Pick<CogitaLibrary, 'docs' | 'writes' | 'saveDoc'>, g: Pick<Geometry, 'nodes'>): Promise<boolean> {
  if (!lib.writes) return false;
  const stored = storedLayout(lib);
  if (!layoutChanged(stored, g)) return false;
  await lib.saveDoc('worldmap', layoutDoc(g), stored?.id ?? lib.docs('worldmap')[0]?.id);
  return true;
}

/**
 * Step 3 · 8 — EINE RECHNUNG DER GESTALT. Ohne `full`: von der gespeicherten Lage aus. Mit `full` („Ułóż całą mapę od nowa"):
 * die ganze Karte neu. Die Gestalt kommt sofort; `saved` sagt danach, ob ein Wunsch nach Neulage erfüllt ist (gelegt UND
 * gespeichert) — dann geht jede spätere Rechnung wieder von der gespeicherten Lage aus. Scheitert das Speichern, bleibt er.
 */
export async function layoutPass(
  lib: Pick<CogitaLibrary, 'docs' | 'writes' | 'saveDoc'>,
  opts: { readonly full: boolean; readonly save: boolean },
  compute: (previous: StoredLayout['positions'] | undefined, full: boolean) => Promise<Geometry>
): Promise<{ readonly geometry: Geometry; readonly saved: Promise<boolean> }> {
  const previous = opts.full ? undefined : storedLayout(lib)?.positions;
  const geometry = await compute(previous, opts.full);
  const saved = (opts.save ? keepLayout(lib, geometry).then(() => true, () => false) : Promise.resolve(true)).then((ok) => opts.full && ok);
  return { geometry, saved };
}
