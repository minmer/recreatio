import type { CogitaCardSearchResult } from '../../../../../lib/api';

export function buildCheckcardKey(card: Pick<CogitaCardSearchResult, 'cardId' | 'checkType' | 'direction'>) {
  return [card.cardId, card.checkType ?? '', card.direction ?? ''].join('|');
}

export function formatCheckTarget(card: Pick<CogitaCardSearchResult, 'checkType' | 'direction'>) {
  const raw = card.checkType ?? 'info';
  const main = raw.startsWith('question-') ? `question / ${raw.slice('question-'.length)}` : raw;
  return card.direction ? `${main} / ${card.direction}` : main;
}
