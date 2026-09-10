import type { CogitaCoreReveal } from '../../../../../lib/api';

type CoreCharComparison = {
  comparedLength: number;
  mismatchCount: number;
  similarityPct: number;
  mismatchesPreview: Array<{
    index: number;
    expected?: string | null;
    actual?: string | null;
  }>;
};

export function RevisionRuntimeInterrogate({
  cardKey,
  reasonTrace,
  answer,
  onAnswerChange,
  interactionLocked,
  reveal,
  charComparison,
  onOutcome,
  onNext,
  labels
}: {
  cardKey: string | null;
  reasonTrace: string[];
  answer: string;
  onAnswerChange: (next: string) => void;
  interactionLocked: boolean;
  reveal: CogitaCoreReveal | null;
  charComparison: CoreCharComparison | null;
  onOutcome: (outcomeClass: 'correct' | 'wrong' | 'blank_timeout') => void;
  onNext: () => void;
  labels: {
    currentPrompt: string;
    answerLabel: string;
    answerPlaceholder: string;
    correctAction: string;
    wrongAction: string;
    blankTimeoutAction: string;
    revealTitle: string;
    correctAnswerLabel: string;
    participantAnswerLabel: string;
    distributionLabel: string;
    correctLabel: string;
    wrongLabel: string;
    blankLabel: string;
    scoreFactorsLabel: string;
    totalPointsLabel: string;
    nextCardAction: string;
  };
}) {
  if (!cardKey) {
    return null;
  }

  const revealMode = Boolean(reveal);

  return (
    <article className={revealMode ? 'cogita-core-run-reveal' : 'cogita-core-run-card'}>
      <p className="cogita-core-run-kicker">{revealMode ? labels.revealTitle : labels.currentPrompt}</p>
      <h2>{cardKey}</h2>

      {reasonTrace.length > 0 && !revealMode ? (
        <p className="cogita-core-run-trace">{reasonTrace.join(' · ')}</p>
      ) : null}

      {!revealMode ? (
        <>
          <label className="cogita-core-run-label" htmlFor="core-answer">
            {labels.answerLabel}
          </label>
          <textarea
            id="core-answer"
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            disabled={interactionLocked}
            placeholder={labels.answerPlaceholder}
            rows={4}
          />
          <div className="cogita-core-run-outcomes">
            <button type="button" className="ghost" disabled={interactionLocked} onClick={() => onOutcome('correct')}>
              {labels.correctAction}
            </button>
            <button type="button" className="ghost" disabled={interactionLocked} onClick={() => onOutcome('wrong')}>
              {labels.wrongAction}
            </button>
            <button type="button" className="ghost" disabled={interactionLocked} onClick={() => onOutcome('blank_timeout')}>
              {labels.blankTimeoutAction}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            {labels.correctAnswerLabel}: <strong>{reveal.correctAnswer ?? '-'}</strong>
          </p>
          <p>
            {labels.participantAnswerLabel}: <strong>{reveal.participantAnswer ?? '-'}</strong>
          </p>
          {charComparison ? (
            <p>
              Character match: {charComparison.similarityPct.toFixed(2)}% ({charComparison.mismatchCount}/
              {charComparison.comparedLength} mismatches)
            </p>
          ) : null}
          {charComparison && charComparison.mismatchesPreview.length > 0 ? (
            <p className="cogita-core-run-trace">
              Mismatch preview:{' '}
              {charComparison.mismatchesPreview
                .slice(0, 6)
                .map((entry) => `#${entry.index} '${entry.expected ?? '∅'}'→'${entry.actual ?? '∅'}'`)
                .join(' · ')}
            </p>
          ) : null}
          <p>
            {labels.distributionLabel}: {reveal.outcomeDistribution.correctPct.toFixed(1)}% {labels.correctLabel.toLowerCase()} ·{' '}
            {reveal.outcomeDistribution.wrongPct.toFixed(1)}% {labels.wrongLabel.toLowerCase()} ·{' '}
            {reveal.outcomeDistribution.blankTimeoutPct.toFixed(1)}% {labels.blankLabel.toLowerCase()}
          </p>
          {reveal.scoreFactors.length > 0 ? (
            <p>
              {labels.scoreFactorsLabel}:{' '}
              {reveal.scoreFactors
                .map((factor) => `${factor.factor} ${factor.points >= 0 ? '+' : ''}${factor.points}`)
                .join(' · ')}
            </p>
          ) : null}
          <p>
            {labels.totalPointsLabel}: {reveal.totalPoints}
          </p>
          <button type="button" className="ghost" disabled={interactionLocked} onClick={onNext}>
            {labels.nextCardAction}
          </button>
        </>
      )}
    </article>
  );
}
