import type { CogitaCardSearchResult } from '../../../../lib/api';
import { buildCheckcardKey } from '../workspace/checkcards/checkcardDisplay';
import { CogitaCheckcardRow } from './CogitaCheckcardRow';

export function CogitaCheckcardList({
  cards,
  onSelect,
  isActive,
  keyForCard
}: {
  cards: CogitaCardSearchResult[];
  onSelect: (card: CogitaCardSearchResult) => void;
  isActive?: (card: CogitaCardSearchResult) => boolean;
  keyForCard?: (card: CogitaCardSearchResult) => string;
}) {
  return (
    <>
      {cards.map((card) => (
        <CogitaCheckcardRow
          key={keyForCard ? keyForCard(card) : buildCheckcardKey(card)}
          card={card}
          active={isActive ? isActive(card) : false}
          onClick={() => onSelect(card)}
        />
      ))}
    </>
  );
}
