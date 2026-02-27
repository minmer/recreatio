import { useEffect, useMemo } from 'react';
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
  quoteContext,
  quotePlaceholder,
  onCheckAnswer,
  onSkip,
  onLanguageSelect,
  onMarkReviewed,
  onAdvance,
  showCorrectAnswer,
  setShowCorrectAnswer,
  onRevealCorrect,
  answerMask,
  expectedAnswer,
  hasExpectedAnswer,
  handleComputedKeyDown,
  answerInputRef,
  computedInputRefs,
  scriptMode,
  setScriptMode,
  matchPairs,
  matchLeftOrder,
  matchRightOrder,
  matchSelection,
  matchActiveLeft,
  matchActiveRight,
  matchFeedback,
  onMatchLeftSelect,
  onMatchRightSelect,
  disableCheckAnswer = false,
  hideSkipAction = false,
  allowRevealBeforeCheck = false,
  autoRevealAfterAnswer = false,
  disableCheckAfterAnswer = false
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
  quoteContext?: {
    title: string;
    before: string;
    after: string;
    total: number;
    completed: number;
  } | null;
  quotePlaceholder?: string | null;
  onCheckAnswer: () => void;
  onSkip: () => void;
  onLanguageSelect: (label: string) => void;
  onMarkReviewed: () => void;
  onAdvance: () => void;
  showCorrectAnswer: boolean;
  setShowCorrectAnswer: (value: (prev: boolean) => boolean) => void;
  onRevealCorrect: () => void;
  answerMask?: Uint8Array | null;
  expectedAnswer: string | null;
  hasExpectedAnswer: boolean;
  handleComputedKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  answerInputRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  computedInputRefs: MutableRefObject<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>;
  scriptMode: 'super' | 'sub' | null;
  setScriptMode: (value: (prev: 'super' | 'sub' | null) => 'super' | 'sub' | null) => void;
  matchPairs?: Array<{
    leftId: string;
    rightId: string;
    leftLabel: string;
    rightLabel: string;
  }>;
  matchLeftOrder?: string[];
  matchRightOrder?: string[];
  matchSelection?: Record<string, string>;
  matchActiveLeft?: string | null;
  matchActiveRight?: string | null;
  matchFeedback?: Record<string, 'correct' | 'incorrect'>;
  onMatchLeftSelect?: (leftId: string) => void;
  onMatchRightSelect?: (rightId: string) => void;
  disableCheckAnswer?: boolean;
  hideSkipAction?: boolean;
  allowRevealBeforeCheck?: boolean;
  autoRevealAfterAnswer?: boolean;
  disableCheckAfterAnswer?: boolean;
}) {
  const inlineTemplate = useMemo(() => {
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
    let firstInputKey: string | null = null;
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
        if (!firstInputKey) firstInputKey = resolvedKey;
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
    return { parts, expectedByKey, firstInputKey };
  }, [answerTemplate, computedExpected, outputVariables, variableValues]);

  const renderAnswerTemplate = () => {
    if (!inlineTemplate) return null;
    const { parts, expectedByKey, firstInputKey } = inlineTemplate;
    return (
      <div className="cogita-revision-inline-answer">
        {parts.map((part, index) =>
          part.type === 'text' ? (
            <span key={`text-${index}`} className="cogita-inline-text">
              {part.value}
            </span>
          ) : (
            <input
              key={`input-${part.value}-${index}`}
              ref={(el) => {
                computedInputRefs.current[part.value] = el;
              }}
              autoFocus={part.value === firstInputKey}
              value={computedAnswers[part.value] ?? ''}
              onChange={(event) => onComputedAnswerChange(part.value, event.target.value)}
              placeholder={copy.cogita.library.revision.answerPlaceholderComputed}
              data-state={computedFieldFeedback[part.value] ?? (feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined)}
              onKeyDown={(event) => handleScriptToggleKeyDown(event) || handleComputedKeyDown(event)}
              className="cogita-inline-input"
              style={{
                minWidth: '5rem',
                width: `${Math.max(6, (computedAnswers[part.value]?.length ?? 0), (expectedByKey.get(part.value)?.length ?? 6))}ch`
              }}
            />
          )
        )}
      </div>
    );
  };

  const matchPairsByLeft = useMemo(() => {
    const map = new Map<string, { leftId: string; rightId: string; leftLabel: string; rightLabel: string }>();
    (matchPairs ?? []).forEach((pair) => map.set(pair.leftId, pair));
    return map;
  }, [matchPairs]);

  const matchPairsByRight = useMemo(() => {
    const map = new Map<string, { leftId: string; rightId: string; leftLabel: string; rightLabel: string }>();
    (matchPairs ?? []).forEach((pair) => map.set(pair.rightId, pair));
    return map;
  }, [matchPairs]);

  useEffect(() => {
    if (currentCard.cardType !== 'info' || currentCard.infoType !== 'computed') return;
    if (computedExpected.length === 0) return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    const targetKey = inlineTemplate?.firstInputKey ?? computedExpected[0]?.key;
    if (!targetKey) return;
    const focusTarget = computedInputRefs.current[targetKey];
    if (!focusTarget) return;
    const handle = requestAnimationFrame(() => {
      focusTarget.focus();
    });
    return () => cancelAnimationFrame(handle);
  }, [currentCard, computedExpected, inlineTemplate]);

  const showScriptToggles = (() => {
    const expectedText = [
      expectedAnswer ?? '',
      ...computedExpected.map((entry) => entry.expected ?? '')
    ].join('');
    const inputText = [answer, ...Object.values(computedAnswers)].join('');
    const text = `${expectedText}${inputText}`;
    return /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]/.test(text);
  })();

  const handleScriptToggleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.ctrlKey && (event.key === '^' || event.key === '6')) {
      event.preventDefault();
      setScriptMode((prev) => (prev === 'super' ? null : 'super'));
      return true;
    }
    if (event.ctrlKey && (event.key === '_' || event.key === '-')) {
      event.preventDefault();
      setScriptMode((prev) => (prev === 'sub' ? null : 'sub'));
      return true;
    }
    return false;
  };

  const renderMaskedAnswer = () => {
    if (!expectedAnswer || !answerMask) return expectedAnswer ?? '';
    const chars = expectedAnswer.split('');
    const maskValues = Array.from(answerMask);
    const avg =
      maskValues.length > 0
        ? maskValues.reduce((sum, value) => sum + value, 0) / maskValues.length
        : 127;
    return chars.map((char, index) => {
      const value = maskValues[index] ?? avg;
      const normalized = Math.max(0, Math.min(255, Math.round(value)));
      let r = 255;
      let g = 0;
      if (normalized <= 127) {
        g = Math.round((normalized / 127) * 255);
      } else {
        g = 255;
        r = Math.round(255 * (1 - (normalized - 127) / 128));
      }
      return (
        <span key={`mask-${index}`} style={{ color: `rgb(${r}, ${g}, 0)` }}>
          {char}
        </span>
      );
    });
  };

  const headerDetail =
    currentCard.cardType === 'info' && currentCard.infoType === 'citation'
      ? quoteContext?.title || currentCard.label
      : currentCard.description;

  const effectiveShowCorrectAnswer = showCorrectAnswer || (autoRevealAfterAnswer && feedback !== null);
  const checkDisabled = disableCheckAnswer || (disableCheckAfterAnswer && (feedback !== null || effectiveShowCorrectAnswer));
  const canRenderReveal =
    hasExpectedAnswer && (allowRevealBeforeCheck || feedback === 'incorrect' || effectiveShowCorrectAnswer);

  return (
    <>
      <div className="cogita-revision-header">
        {currentTypeLabel ? <span>{currentTypeLabel}</span> : null}
        <strong>{headerDetail}</strong>
      </div>

      {currentCard.cardType === 'vocab' && currentCard.checkType === 'translation-match' && matchPairs ? (
        <div className="cogita-revision-body">
          {prompt ? <h2>{prompt}</h2> : null}
          <div className="cogita-revision-match">
            <div className="cogita-revision-match-column">
              {(matchLeftOrder ?? []).map((leftId) => {
                const pair = matchPairsByLeft.get(leftId);
                if (!pair) return null;
                const selectedRight = matchSelection?.[leftId] ?? null;
                const feedbackState = matchFeedback?.[leftId] ?? null;
                const isActive = matchActiveLeft === leftId;
                return (
                  <button
                    key={leftId}
                    type="button"
                    className="cogita-revision-match-item"
                    data-active={isActive}
                    data-state={feedbackState ?? undefined}
                    data-locked={selectedRight ? 'true' : undefined}
                    onClick={() => onMatchLeftSelect?.(leftId)}
                  >
                    <span>{pair.leftLabel}</span>
                    {selectedRight && showCorrectAnswer ? <em>✓</em> : null}
                  </button>
                );
              })}
            </div>
            <div className="cogita-revision-match-column">
              {(matchRightOrder ?? []).map((rightId) => {
                const pair = matchPairsByRight.get(rightId);
                if (!pair) return null;
                const isSelected = Object.values(matchSelection ?? {}).includes(rightId);
                const isActive = matchActiveRight === rightId;
                return (
                  <button
                    key={rightId}
                    type="button"
                    className="cogita-revision-match-item"
                    data-active={isSelected || isActive}
                    data-locked={isSelected ? 'true' : undefined}
                    onClick={() => onMatchRightSelect?.(rightId)}
                  >
                    <span>{pair.rightLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="cogita-form-actions">
            <button
              type="button"
              className="cta"
              onClick={onCheckAnswer}
              disabled={currentCard.checkType === 'translation-match' || checkDisabled}
            >
              {copy.cogita.library.revision.checkAnswer}
            </button>
            {!hideSkipAction ? (
              <button type="button" className="ghost" onClick={onSkip}>
                {copy.cogita.library.revision.skip}
              </button>
            ) : null}
          </div>
        </div>
      ) : currentCard.cardType === 'vocab' ? (
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
                  if (checkDisabled) return;
                  onCheckAnswer();
                }
              }}
            />
          </label>
          {showScriptToggles ? (
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
          ) : null}
          <div className="cogita-form-actions">
            <button type="button" className="cta" onClick={onCheckAnswer} disabled={checkDisabled}>
              {copy.cogita.library.revision.checkAnswer}
            </button>
            {!hideSkipAction ? (
              <button type="button" className="ghost" onClick={onSkip}>
                {copy.cogita.library.revision.skip}
              </button>
            ) : null}
          </div>
        </div>
      ) : currentCard.cardType === 'info' && currentCard.infoType === 'question' ? (
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
                  if (checkDisabled) return;
                  onCheckAnswer();
                }
              }}
            />
          </label>
          <div className="cogita-form-actions">
            <button type="button" className="cta" onClick={onCheckAnswer} disabled={checkDisabled}>
              {copy.cogita.library.revision.checkAnswer}
            </button>
            {!hideSkipAction ? (
              <button type="button" className="ghost" onClick={onSkip}>
                {copy.cogita.library.revision.skip}
              </button>
            ) : null}
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
                  {computedExpected.map((entry, index) => (
                    <label key={entry.key} className="cogita-field">
                      <span>{entry.key}</span>
                      <textarea
                        ref={(el) => {
                          computedInputRefs.current[entry.key] = el;
                        }}
                        autoFocus={index === 0}
                        value={computedAnswers[entry.key] ?? ''}
                        onChange={(event) => onComputedAnswerChange(entry.key, event.target.value)}
                        placeholder={copy.cogita.library.revision.answerPlaceholderComputed}
                        data-state={computedFieldFeedback[entry.key] ?? (feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined)}
                        onKeyDown={(event) => handleScriptToggleKeyDown(event) || handleComputedKeyDown(event)}
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
                    if (handleScriptToggleKeyDown(event)) return;
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (canAdvance) {
                      onAdvance();
                    } else {
                      if (checkDisabled) return;
                      onCheckAnswer();
                    }
                  }}
                />
              </label>
            </div>
          )}
          {showScriptToggles ? (
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
          ) : null}
          <div className="cogita-form-actions">
            <button type="button" className="cta" onClick={onCheckAnswer} disabled={checkDisabled}>
              {copy.cogita.library.revision.checkAnswer}
            </button>
            {!hideSkipAction ? (
              <button type="button" className="ghost" onClick={onSkip}>
                {copy.cogita.library.revision.skip}
              </button>
            ) : null}
          </div>
        </div>
      ) : currentCard.cardType === 'info' && currentCard.infoType === 'citation' && quoteContext ? (
        <div className="cogita-revision-body">
          <div className="cogita-quote-block">
            <p className="cogita-revision-hint">
              {copy.cogita.library.revision.quoteProgress
                .replace('{done}', String(quoteContext.completed))
                .replace('{total}', String(quoteContext.total))}
            </p>
            <p className="cogita-quote-text">{quoteContext.before}</p>
            <label className="cogita-field">
              <span>{copy.cogita.library.revision.answerLabel}</span>
              <input
                ref={answerInputRef as MutableRefObject<HTMLInputElement | null>}
                value={answer}
                onChange={(event) => onAnswerChange(event.target.value)}
                placeholder={quotePlaceholder ?? copy.cogita.library.revision.quoteMissingPlaceholder}
                data-state={feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (canAdvance) {
                    onAdvance();
                  } else {
                    if (checkDisabled) return;
                    onCheckAnswer();
                  }
                }}
              />
            </label>
            <p className="cogita-quote-text">{quoteContext.after}</p>
          </div>
          <div className="cogita-form-actions">
            <button type="button" className="cta" onClick={onCheckAnswer} disabled={checkDisabled}>
              {copy.cogita.library.revision.checkAnswer}
            </button>
            {!hideSkipAction ? (
              <button type="button" className="ghost" onClick={onSkip}>
                {copy.cogita.library.revision.skip}
              </button>
            ) : null}
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

      {canRenderReveal ? (
        <div className="cogita-revision-reveal">
          {!effectiveShowCorrectAnswer ? (
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
          ) : null}
          {effectiveShowCorrectAnswer ? (
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
                <p>{answerMask ? renderMaskedAnswer() : expectedAnswer}</p>
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
