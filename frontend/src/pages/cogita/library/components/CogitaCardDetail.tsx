import type { CardTypeId, IndexCard } from '../types';

export function CogitaCardDetail({
  selectedCard,
  activeTags,
  cardTypeLabel,
  directionLabel,
  frontLabel,
  backLabel,
  frontValue,
  backValue,
  isFlipped,
  onSetFlipped,
  onToggleFlip,
  onSwapDirection,
  onRemoveCard,
  onSelectRelative,
  onToggleTag,
  onOpenAddForm
}: {
  selectedCard: IndexCard | null;
  activeTags: string[];
  cardTypeLabel: (typeId: CardTypeId) => string;
  directionLabel: string;
  frontLabel: string;
  backLabel: string;
  frontValue: string;
  backValue: string;
  isFlipped: boolean;
  onSetFlipped: (value: boolean) => void;
  onToggleFlip: () => void;
  onSwapDirection: () => void;
  onRemoveCard: (cardId: string) => void;
  onSelectRelative: (offset: number) => void;
  onToggleTag: (tag: string) => void;
  onOpenAddForm: () => void;
}) {
  return (
    <section
      className="cogita-library-detail"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          onSelectRelative(1);
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          onSelectRelative(-1);
        }
        if (event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          onToggleFlip();
        }
      }}
    >
      <div className="cogita-detail-header">
        <div>
          <p className="cogita-user-kicker">Selected card</p>
          <h3 className="cogita-detail-title">
            {selectedCard ? cardTypeLabel(selectedCard.type) : 'No card selected'}
          </h3>
        </div>
        <div className="cogita-detail-actions">
          <button type="button" className="ghost" onClick={() => onSetFlipped(false)}>
            Show front
          </button>
          <button type="button" className="ghost" onClick={() => onSetFlipped(true)}>
            Show back
          </button>
        </div>
      </div>

      {selectedCard ? (
        <>
          <button type="button" className="cogita-card-preview" data-flipped={isFlipped} onClick={onToggleFlip}>
            <span className="cogita-card-face-label">{isFlipped ? backLabel : frontLabel}</span>
            <span className="cogita-card-face-term">{isFlipped ? backValue : frontValue}</span>
            <span className="cogita-card-face-meta">
              {isFlipped ? 'Back' : 'Front'} | Direction {directionLabel}
            </span>
          </button>

          <div className="cogita-card-meta">
            <div className="cogita-card-tags">
              {selectedCard.tags.map((tag) => (
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
            {selectedCard.note ? <p className="cogita-card-note">{selectedCard.note}</p> : null}
            <div className="cogita-card-meta-row">
              <span>Created: {selectedCard.createdAt}</span>
              {selectedCard.lastReviewed ? <span>Reviewed: {selectedCard.lastReviewed}</span> : null}
            </div>
          </div>

          <div className="cogita-card-controls">
            <button type="button" className="cta ghost" onClick={onToggleFlip}>
              Flip card
            </button>
            <button type="button" className="cta ghost" onClick={onSwapDirection}>
              Swap direction
            </button>
            <button type="button" className="cta ghost" onClick={() => onRemoveCard(selectedCard.id)}>
              Remove
            </button>
          </div>

          <div className="cogita-card-nav">
            <button type="button" className="ghost" onClick={() => onSelectRelative(-1)}>
              Prev
            </button>
            <button type="button" className="ghost" onClick={() => onSelectRelative(1)}>
              Next
            </button>
          </div>
          <p className="cogita-card-hint">Tap the card or press Space to flip. Use arrow keys to move.</p>
        </>
      ) : (
        <div className="cogita-card-empty">
          <p>No cards selected yet. Add one to get started.</p>
          <button type="button" className="ghost" onClick={onOpenAddForm}>
            Create a card
          </button>
        </div>
      )}
    </section>
  );
}
