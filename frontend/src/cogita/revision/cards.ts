import type { CogitaCardSearchResult } from '../../lib/api';

export const getCardKey = (card: CogitaCardSearchResult) =>
  `${card.cardType}:${card.cardId}:${card.checkType ?? ''}:${card.direction ?? ''}`;

export const getOutcomeKey = (itemType: string, itemId: string, checkType?: string | null, direction?: string | null) =>
  `${itemType}:${itemId}:${checkType ?? ''}:${direction ?? ''}`;
