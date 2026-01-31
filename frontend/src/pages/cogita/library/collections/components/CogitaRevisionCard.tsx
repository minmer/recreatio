import type { KeyboardEvent, MutableRefObject } from 'react';
import type { Copy } from '../../../../../content/types';
import type { CogitaCardSearchResult, CogitaInfoSearchResult } from '../../../../../lib/api';
import { LatexBlock } from '../../../../../components/LatexText';

export function CogitaRevisionCard({
  copy,
  currentCard,
  currentTypeLabel,
  prompt,
  languages,
  answer,
  onAnswerChange,
  computedExpected,
  computedAnswers,
  onComputedAnswerChange,
  answerTemplate,
  outputVariables,
  variableValues,
  computedFieldFeedback,
  feedback,
  canAdvance,
  onCheckAnswer,
  onSkip,
  onLanguageSelect,
  onMarkReviewed,
  onAdvance,
  showCorrectAnswer,
  setShowCorrectAnswer,
  onRevealCorrect,
  expectedAnswer,
  hasExpectedAnswer,
  handleComputedKeyDown,
  answerInputRef,
  computedInputRefs,
  scriptMode,
  setScriptMode
}: {
  copy: Copy;
  currentCard: CogitaCardSearchResult;
  currentTypeLabel: string;
  prompt: string | null;
  languages: CogitaInfoSearchResult[];
  answer: string;
  onAnswerChange: (value: string) => void;
  computedExpected: Array<{ key: string; expected: string }>;
  computedAnswers: Record<string, string>;
  onComputedAnswerChange: (key: string, value: string) => void;
  answerTemplate: string | null;
  outputVariables: Record<string, string> | null;
  variableValues: Record<string, string> | null;
  computedFieldFeedback: Record<string, 'correct' | 'incorrect'>;
  feedback: 'correct' | 'incorrect' | null;
  canAdvance: boolean;
  onCheckAnswer: () => void;
  onSkip: () => void;
  onLanguageSelect: (label: string) => void;
  onMarkReviewed: () => void;
  onAdvance: () => void;
  showCorrectAnswer: boolean;
  setShowCorrectAnswer: (value: (prev: boolean) => boolean) => void;
  onRevealCorrect: () => void;
  expectedAnswer: string | null;
  hasExpectedAnswer: boolean;
  handleComputedKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  answerInputRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  computedInputRefs: MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>;
  scriptMode: 'super' | 'sub' | null;
  setScriptMode: (value: (prev: 'super' | 'sub' | null) => 'super' | 'sub' | null) => void;
}) {
  const renderAnswerTemplate = () => {
    const fallbackTemplate =
      !answerTemplate && computedExpected.length === 2
        ? `The {${computedExpected[0].key}} is of type {${computedExpected[1].key}}`
        : null;
    const template = answerTemplate ?? fallbackTemplate;
    if (!template) return null;
    const expectedByKey = new Map(computedExpected.map((entry) => [entry.key, entry.expected]));
    const tokenSet = new Set<string>();
    const parts: Array<{ type: 'text' | 'input'; value: string }> = [];
    const pattern = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(template)) !== null) {
      const before = template.slice(lastIndex, match.index);
      if (before) parts.push({ type: 'text', value: before });
      const token = match[1]?.trim() ?? '';
      const resolvedKey = token && expectedByKey.has(token)
        ? token
        : token && outputVariables && outputVariables[token]
          ? outputVariables[token]
          : null;
      if (token) tokenSet.add(token);
      if (resolvedKey) tokenSet.add(resolvedKey);
      if (resolvedKey && expectedByKey.has(resolvedKey)) {
        parts.push({ type: 'input', value: resolvedKey });
      } else if (token && variableValues && variableValues[token] !== undefined) {
        parts.push({ type: 'text', value: variableValues[token] });
      } else {
        parts.push({ type: 'text', value: match[0] });
      }
      lastIndex = match.index + match[0].length;
    }
    const rest = template.slice(lastIndex);
    if (rest) parts.push({ type: 'text', value: rest });
    const missing = computedExpected.filter((entry) => !tokenSet.has(entry.key));
    if (missing.length > 0) return null;
    return (
      <div className="cogita-revision-inline-answer">
        {parts.map((part, index) =>
          part.type === 'text' ? (
            <span key={`text-${index}`}>{part.value}</span>
          ) : (
            <input
              key={`input-${part.value}-${index}`}
              ref={(el) => {
                computedInputRefs.current[part.value] = el;
              }}
              value={computedAnswers[part.value] ?? ''}
              onChange={(event) => onComputedAnswerChange(part.value, event.target.value)}
              placeholder={copy.cogita.library.revision.answerPlaceholderComputed}
              data-state={computedFieldFeedback[part.value] ?? (feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined)}
              onKeyDown={handleComputedKeyDown}
              className="cogita-inline-input"
              style={{
                minWidth: `${Math.max(4, (expectedByKey.get(part.value)?.length ?? 6))}ch`
              }}
            />
          )
        )}
      </div>
    );
  };

  return (
    <>
      <div className="cogita-revision-header">
        <span>{currentTypeLabel}</span>
        <strong>{currentCard.description}</strong>
      </div>

      {currentCard.cardType === 'vocab' ? (
        <div className="cogita-revision-body">
          <h2>{prompt}</h2>
          <label className="cogita-field">
            <span>{copy.cogita.library.revision.answerLabel}</span>
            <input
              ref={answerInputRef as MutableRefObject<HTMLInputElement | null>}
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              placeholder={copy.cogita.library.revision.answerPlaceholder}
              data-state={feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                event.stopPropagation();
                if (canAdvance) {
                  onAdvance();
                } else {
                  onCheckAnswer();
                }
              }}
            />
          </label>
          <div className="cogita-form-actions">
            <button
              type="button"
              className="ghost"
              data-active={scriptMode === 'super'}
              onClick={() => setScriptMode((prev) => (prev === 'super' ? null : 'super'))}
            >
              x²
            </button>
            <button
              type="button"
              className="ghost"
              data-active={scriptMode === 'sub'}
              onClick={() => setScriptMode((prev) => (prev === 'sub' ? null : 'sub'))}
            >
              x₂
            </button>
          </div>
          <div className="cogita-form-actions">
            <button type="button" className="cta" onClick={onCheckAnswer}>
              {copy.cogita.library.revision.checkAnswer}
            </button>
            <button type="button" className="ghost" onClick={onSkip}>
              {copy.cogita.library.revision.skip}
            </button>
          </div>
        </div>
      ) : currentCard.cardType === 'info' && currentCard.infoType === 'computed' ? (
        <div className="cogita-revision-body">
          {currentCard.label ? <p className="cogita-revision-hint">{currentCard.label}</p> : null}
          {answerTemplate ? null : <LatexBlock value={prompt ?? ''} mode="auto" />}
          {computedExpected.length > 0 ? (
            (() => {
              const inline = renderAnswerTemplate();
              if (inline) {
                return <div className="cogita-inline-answer-wrap">{inline}</div>;
              }
              return (
                <div className="cogita-form-grid">
                  {computedExpected.map((entry) => (
                    <label key={entry.key} className="cogita-field">
                      <span>{entry.key}</span>
                      <textarea
                        ref={(el) => {
                          computedInputRefs.current[entry.key] = el;
                        }}
                        value={computedAnswers[entry.key] ?? ''}
                        onChange={(event) => onComputedAnswerChange(entry.key, event.target.value)}
                        placeholder={copy.cogita.library.revision.answerPlaceholderComputed}
                        data-state={computedFieldFeedback[entry.key] ?? (feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined)}
                        onKeyDown={handleComputedKeyDown}
                      />
                    </label>
                  ))}
                </div>
              );
            })()
          ) : (
            <div className="cogita-form-grid">
              <label className="cogita-field">
                <span>{copy.cogita.library.revision.answerLabel}</span>
                <textarea
                  ref={answerInputRef as MutableRefObject<HTMLTextAreaElement | null>}
                  value={answer}
                  onChange={(event) => onAnswerChange(event.target.value)}
                  placeholder={copy.cogita.library.revision.answerPlaceholderComputed}
                  data-state={feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (canAdvance) {
                      onAdvance();
                    } else {
                      onCheckAnswer();
                    }
                  }}
                />
              </label>
            </div>
          )}
          <div className="cogita-form-actions">
            <button
              type="button"
              className="ghost"
              data-active={scriptMode === 'super'}
              onClick={() => setScriptMode((prev) => (prev === 'super' ? null : 'super'))}
            >
              x²
            </button>
            <button
              type="button"
              className="ghost"
              data-active={scriptMode === 'sub'}
              onClick={() => setScriptMode((prev) => (prev === 'sub' ? null : 'sub'))}
            >
              x₂
            </button>
          </div>
          <div className="cogita-form-actions">
            <button type="button" className="cta" onClick={onCheckAnswer}>
              {copy.cogita.library.revision.checkAnswer}
            </button>
            <button type="button" className="ghost" onClick={onSkip}>
              {copy.cogita.library.revision.skip}
            </button>
          </div>
        </div>
      ) : currentCard.cardType === 'info' && currentCard.infoType === 'word' ? (
        <div className="cogita-revision-body">
          <h2>{prompt}</h2>
          <p className="cogita-revision-hint">{copy.cogita.library.revision.hintSelectLanguage}</p>
          <div className="cogita-choice-grid">
            {languages.length ? (
              languages.map((lang) => (
                <button key={lang.infoId} type="button" className="ghost" onClick={() => onLanguageSelect(lang.label)}>
                  {lang.label}
                </button>
              ))
            ) : (
              <span className="cogita-revision-hint">{copy.cogita.library.revision.noLanguages}</span>
            )}
          </div>
          <div className="cogita-form-actions">
            <button type="button" className="ghost" onClick={onSkip}>
              {copy.cogita.library.revision.skip}
            </button>
          </div>
        </div>
      ) : (
        <div className="cogita-revision-body">
          <h2>{prompt}</h2>
          <p className="cogita-revision-hint">{copy.cogita.library.revision.hintReview}</p>
          <div className="cogita-form-actions">
            <button type="button" className="cta" onClick={onMarkReviewed}>
              {copy.cogita.library.revision.markDone}
            </button>
            <button type="button" className="ghost" onClick={onSkip}>
              {copy.cogita.library.revision.skip}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className="cogita-revision-feedback" data-state={feedback}>
          {feedback === 'correct' ? copy.cogita.library.revision.correct : copy.cogita.library.revision.tryAgain}
        </div>
      )}

      {feedback === 'incorrect' && hasExpectedAnswer ? (
        <div className="cogita-revision-reveal">
          <button
            type="button"
            className="ghost"
            onClick={() =>
              setShowCorrectAnswer((prev) => {
                const next = !prev;
                if (next) {
                  onRevealCorrect();
                }
                return next;
              })
            }
          >
            {copy.cogita.library.revision.showAnswer}
          </button>
          {showCorrectAnswer ? (
            <div className="cogita-revision-answer">
              <p className="cogita-user-kicker">{copy.cogita.library.revision.correctAnswerLabel}</p>
              {computedExpected.length > 0 ? (
                <div className="cogita-detail-sample-grid">
                  {computedExpected.map((entry) => (
                    <div key={entry.key} className="cogita-detail-sample-item">
                      <span>{entry.key}</span>
                      <span>{entry.expected}</span>
                    </div>
                  ))}
                  {expectedAnswer ? (
                    <div className="cogita-detail-sample-item">
                      <span>{copy.cogita.library.revision.answerSentenceLabel}</span>
                      <span>{expectedAnswer}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p>{expectedAnswer}</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {canAdvance ? (
        <div className="cogita-form-actions">
          <button type="button" className="cta" onClick={onAdvance}>
            {copy.cogita.library.revision.nextQuestion}
          </button>
        </div>
      ) : null}
    </>
  );
}
