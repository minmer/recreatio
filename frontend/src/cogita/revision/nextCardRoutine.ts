import { getNextCardSelection } from './nextCard';

type ModeId = 'random' | 'random-once' | 'levels' | 'temporal';

export function selectNextCardIndexByMode(payload: {
  mode: string;
  currentIndex: number;
  cardKeys: string[];
  askedCardKeys?: string[] | null;
  knownessByCardKey?: Record<string, number> | null;
}): number | null {
  const mode = (payload.mode || 'random').toLowerCase() as ModeId;
  if (mode === 'levels' || mode === 'temporal') {
    const asked = new Set((payload.askedCardKeys ?? []).map((key) => String(key)));
    const candidates = payload.cardKeys
      .map((cardKey, index) => ({ index, cardKey }))
      .filter((entry) => !asked.has(entry.cardKey));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const left = Number(payload.knownessByCardKey?.[a.cardKey] ?? 0);
      const right = Number(payload.knownessByCardKey?.[b.cardKey] ?? 0);
      if (left !== right) return left - right;
      return a.index - b.index;
    });
    return candidates[0]?.index ?? null;
  }

  const fallbackQueue = payload.cardKeys.map((cardKey) => cardKey);
  const next = getNextCardSelection(fallbackQueue, payload.currentIndex);
  if (!next.hasNext) return null;
  return next.nextIndex;
}
