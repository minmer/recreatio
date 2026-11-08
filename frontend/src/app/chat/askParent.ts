import type { AreaRow } from '../areas/area';

/** A reply area has its own readers; its parent supplies the data controller, not chat membership. */
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

/** Reused modules may belong to several pages: suggest a parent only when those pages agree. */
export function suggestedAskParent(choices: readonly AreaRow[], pageAreas: readonly (string | null | undefined)[]): string {
  const ids = [...new Set(pageAreas.filter((id): id is string => id != null))];
  return pageAreas.every((id) => id != null) && ids.length === 1 && choices.some((a) => a.areaId === ids[0]) ? ids[0] : '';
}
