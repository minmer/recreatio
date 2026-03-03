import type { CogitaCardSearchBundle, CogitaCardSearchResult } from '../../lib/api';
import { getCardKey } from './cards';
import { expandQuoteDirectionCards } from '../../pages/cogita/library/collections/revisionShared';

export type CardLoaderMode = 'random' | 'random-once' | 'levels' | 'temporal';

export type CardPageFetcher = (payload: { limit: number; cursor?: string | null }) => Promise<CogitaCardSearchBundle>;

export async function collectCardsWithSharedLoader(payload: {
  fetchPage: CardPageFetcher;
  mode: CardLoaderMode;
  fetchLimit: number;
  pageSize?: number;
  onProgress?: (state: { current: number; total: number }) => void;
}) {
  const gathered: CogitaCardSearchResult[] = [];
  let cursor: string | null | undefined = null;
  let targetTotal: number | null = null;
  const pageSize = Math.max(1, Math.min(500, payload.pageSize ?? 300));
  const normalizedFetchLimit = Math.max(1, payload.fetchLimit);
  const modeNeedsAll = payload.mode === 'levels' || payload.mode === 'temporal' || payload.mode === 'random-once';

  do {
    const bundle = await payload.fetchPage({ limit: pageSize, cursor });
    gathered.push(...(bundle.items ?? []));
    if (modeNeedsAll && bundle.total) {
      targetTotal = bundle.total;
    }
    payload.onProgress?.({
      current: gathered.length,
      total: targetTotal ?? bundle.total ?? normalizedFetchLimit
    });
    cursor = bundle.nextCursor ?? null;
    if (targetTotal !== null && gathered.length >= targetTotal) break;
    if (!modeNeedsAll && gathered.length >= normalizedFetchLimit) break;
  } while (cursor);

  return gathered;
}

export function normalizeLoadedCards(cards: CogitaCardSearchResult[]) {
  const expanded = expandQuoteDirectionCards(cards);
  const map = new Map<string, CogitaCardSearchResult>();
  expanded.forEach((card) => map.set(getCardKey(card), card));
  return Array.from(map.values());
}

