import type { AreaRow } from '../areas/area';

/**
 * 2026-11-08 — WELCHER BEREICH ÜBER DEM DER ANTWORTENDEN STEHEN KANN: einer, den ich leite (nicht der eigene, kein
 * privater, kein Gespräch, nichts darunter). Er gibt nur den Verantwortlichen (0129) — wer antwortet, bleibt.
 */
export function askParents(areas: readonly AreaRow[], replyArea: string | null): AreaRow[] {
  const byId = new Map(areas.map((a) => [a.areaId, a]));
  return areas.filter((area) => {
    if (area.myLevel !== 'admin' || area.personal === true || area.ownChat != null) return false;
    const seen = new Set<string>();
    let at: string | null = area.areaId;
    while (at !== null) {
      if (at === replyArea || seen.has(at)) return false;
      seen.add(at);
      at = byId.get(at)?.parentAreaId ?? null;
    }
    return true;
  });
}

/** Ein Modul auf mehreren Seiten: vorgeschlagen wird nur, worin alle seine Seiten übereinstimmen — sonst nichts. */
export function suggestedAskParent(choices: readonly AreaRow[], pageAreas: readonly (string | null | undefined)[]): string {
  const ids = [...new Set(pageAreas.filter((id): id is string => id != null))];
  return pageAreas.every((id) => id != null) && ids.length === 1 && choices.some((a) => a.areaId === ids[0]) ? ids[0] : '';
}
