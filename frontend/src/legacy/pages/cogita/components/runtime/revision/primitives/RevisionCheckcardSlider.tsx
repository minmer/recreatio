import { useEffect, useState } from 'react';
import { REVISION_PRIMITIVE_DEFAULT_LABELS } from './RevisionProgress';

export type RevisionCheckcardSlideStatus =
  | 'queued'
  | 'active'
  | 'revealed'
  | 'correct'
  | 'wrong'
  | 'blank'
  | 'seen';

export type RevisionCheckcardSlide = {
  cardKey: string;
  label?: string | null;
  status?: RevisionCheckcardSlideStatus;
  points?: number | null;
};

export type RevisionSliderLabels = {
  previousAction?: string;
  nextAction?: string;
  noCardsLabel?: string;
};

export function RevisionCheckcardSlider({
  cards,
  activeCardKey,
  title,
  labels,
  windowSize = 6,
  onSelect
}: {
  cards: RevisionCheckcardSlide[];
  activeCardKey?: string | null;
  title?: string;
  labels?: RevisionSliderLabels;
  windowSize?: number;
  onSelect?: (cardKey: string) => void;
}) {
  const resolvedLabels = {
    previousAction: labels?.previousAction ?? REVISION_PRIMITIVE_DEFAULT_LABELS.previousAction,
    nextAction: labels?.nextAction ?? REVISION_PRIMITIVE_DEFAULT_LABELS.nextAction,
    noCardsLabel: labels?.noCardsLabel ?? REVISION_PRIMITIVE_DEFAULT_LABELS.noCardsLabel
  };

  const safeWindowSize = Math.max(1, windowSize);
  const [startIndex, setStartIndex] = useState(0);
  const maxStart = Math.max(0, cards.length - safeWindowSize);

  useEffect(() => {
    setStartIndex((current) => Math.min(current, maxStart));
  }, [maxStart]);

  useEffect(() => {
    if (!activeCardKey) return;
    const index = cards.findIndex((card) => card.cardKey === activeCardKey);
    if (index < 0) return;
    if (index < startIndex) {
      setStartIndex(index);
      return;
    }
    if (index >= startIndex + safeWindowSize) {
      setStartIndex(Math.min(maxStart, index - safeWindowSize + 1));
    }
  }, [activeCardKey, cards, maxStart, safeWindowSize, startIndex]);

  const visibleCards = cards.slice(startIndex, startIndex + safeWindowSize);

  return (
    <article className="cogita-core-run-card">
      <div className="cogita-core-run-slider-head">
        <p className="cogita-core-run-kicker">{title ?? REVISION_PRIMITIVE_DEFAULT_LABELS.sliderTitle}</p>
        {cards.length > safeWindowSize ? (
          <div className="cogita-core-run-slider-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setStartIndex((value) => Math.max(0, value - safeWindowSize))}
              disabled={startIndex <= 0}
            >
              {resolvedLabels.previousAction}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setStartIndex((value) => Math.min(maxStart, value + safeWindowSize))}
              disabled={startIndex >= maxStart}
            >
              {resolvedLabels.nextAction}
            </button>
          </div>
        ) : null}
      </div>

      {cards.length === 0 ? (
        <p>{resolvedLabels.noCardsLabel}</p>
      ) : (
        <div className="cogita-core-run-slider-list">
          {visibleCards.map((card) => {
            const isActive = activeCardKey === card.cardKey;
            return (
              <button
                key={card.cardKey}
                type="button"
                className="ghost cogita-core-run-slider-item"
                data-active={isActive ? 'true' : undefined}
                data-status={card.status ?? 'seen'}
                onClick={() => onSelect?.(card.cardKey)}
              >
                <span>{card.label ?? card.cardKey}</span>
                {typeof card.points === 'number' ? <small>{card.points >= 0 ? `+${card.points}` : card.points}</small> : null}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
