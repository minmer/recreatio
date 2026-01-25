import type { CardTypeId, IndexCard, ViewMode } from '../types';

export function CogitaCardList({
  cards,
  selectedCardId,
  activeTags,
  viewMode,
  cardTypeLabel,
  onSelectCard,
  onToggleTag,
  onRemoveCard,
  onClearFilters
}: {
  cards: IndexCard[];
  selectedCardId: string;
  activeTags: string[];
  viewMode: ViewMode;
  cardTypeLabel: (typeId: CardTypeId) => string;
  onSelectCard: (cardId: string) => void;
  onToggleTag: (tag: string) => void;
  onRemoveCard: (cardId: string) => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="cogita-card-list" data-view={viewMode}>
      {cards.length ? (
        cards.map((card) => (
          <div key={card.id} className="cogita-card-item" data-selected={card.id === selectedCardId}>
            <button type="button" className="cogita-card-select" onClick={() => onSelectCard(card.id)}>
              <div className="cogita-card-type">{cardTypeLabel(card.type)}</div>
              <h3 className="cogita-card-title">
                {card.sideA} / {card.sideB}
              </h3>
              <p className="cogita-card-subtitle">
                {card.sideALabel ?? 'Side A'} <span className="cogita-card-divider">|</span> {card.sideBLabel ?? 'Side B'}
              </p>
            </button>
            <div className="cogita-card-tags">
              {card.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="cogita-tag-chip"
                  data-active={activeTags.includes(tag)}
                  onClick={() => onToggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button type="button" className="cogita-card-remove" onClick={() => onRemoveCard(card.id)}>
              Remove
            </button>
          </div>
        ))
      ) : (
        <div className="cogita-card-empty">
          <p>No cards match these filters.</p>
          <button type="button" className="ghost" onClick={onClearFilters}>
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
