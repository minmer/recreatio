import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  createCogitaReviewEvent,
  getCogitaCollection,
  getCogitaCollectionCards,
  getCogitaComputedSample,
  getCogitaReviewSummary,
  searchCogitaInfos,
  type CogitaCardSearchResult,
  type CogitaComputedSample,
  type CogitaInfoSearchResult
} from '../../../../lib/api';
import { toBase64 } from '../../../../lib/crypto';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import type { CogitaInfoType } from '../types';
import { getInfoTypeLabel } from '../libraryOptions';
import { CogitaLibrarySidebar } from '../components/CogitaLibrarySidebar';
import { LatexBlock } from '../../../../components/LatexText';

const normalizeAnswer = (value: string) => value.trim().toLowerCase();

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export function CogitaRevisionRunPage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  libraryId,
  collectionId
}: {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  libraryId: string;
  collectionId: string;
}) {
  const location = useLocation();
  const baseHref = `/#/cogita/library/${libraryId}`;
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const limit = Math.max(1, Number(params.get('limit') ?? 20));
  const mode = params.get('mode') ?? 'random';
  const check = params.get('check') ?? 'exact';
  const reviewer = params.get('reviewer');
  const modeLabel = useMemo(() => (mode === 'random' ? copy.cogita.library.revision.modeValue : mode), [copy, mode]);
  const checkLabel = useMemo(() => (check === 'exact' ? copy.cogita.library.revision.checkValue : check), [copy, check]);

  const [collectionName, setCollectionName] = useState(copy.cogita.library.collections.defaultName);
  const [queue, setQueue] = useState<CogitaCardSearchResult[]>([]);
  const [languages, setLanguages] = useState<CogitaInfoSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [expectedAnswer, setExpectedAnswer] = useState<string | null>(null);
  const [computedExpected, setComputedExpected] = useState<Array<{ key: string; expected: string }>>([]);
  const [computedAnswers, setComputedAnswers] = useState<Record<string, string>>({});
  const [computedFieldFeedback, setComputedFieldFeedback] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [computedValues, setComputedValues] = useState<Record<string, number | string> | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<{ score: number; total: number; correct: number; lastReviewedUtc?: string | null } | null>(null);
  const answerInputRef = useRef<HTMLInputElement | null>(null);
  const computedInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [canAdvance, setCanAdvance] = useState(false);

  const currentCard = queue[currentIndex] ?? null;
  const currentTypeLabel = useMemo(() => {
    if (!currentCard) return '';
    if (currentCard.cardType === 'vocab') return copy.cogita.library.revision.vocabLabel;
    if (currentCard.infoType) return getInfoTypeLabel(copy, currentCard.infoType as CogitaInfoType);
    return copy.cogita.library.revision.infoLabel;
  }, [copy, currentCard]);

  useEffect(() => {
    getCogitaCollection(libraryId, collectionId)
      .then((detail) => setCollectionName(detail.name))
      .catch(() => setCollectionName(copy.cogita.library.collections.defaultName));
  }, [libraryId, collectionId]);

  useEffect(() => {
    searchCogitaInfos({ libraryId, type: 'language' })
      .then((results) => setLanguages(results))
      .catch(() => setLanguages([]));
  }, [libraryId]);

  useEffect(() => {
    let mounted = true;
    const fetchCards = async () => {
      setStatus('loading');
      try {
        const gathered: CogitaCardSearchResult[] = [];
        let cursor: string | null | undefined = null;
        do {
          const bundle = await getCogitaCollectionCards({
            libraryId,
            collectionId,
            limit: 100,
            cursor
          });
          gathered.push(...bundle.items);
          cursor = bundle.nextCursor ?? null;
          if (gathered.length >= limit) break;
        } while (cursor);

        if (!mounted) return;
        const ordered = mode === 'random' ? shuffle(gathered) : gathered;
        let expanded: CogitaCardSearchResult[] = [];
        if (ordered.length > 0 && limit > ordered.length) {
          while (expanded.length < limit) {
            const remaining = limit - expanded.length;
            const nextBatch = mode === 'random' ? shuffle(ordered) : ordered;
            expanded = expanded.concat(nextBatch.slice(0, remaining));
          }
        } else {
          expanded = ordered.slice(0, limit);
        }
        setQueue(expanded);
        setCurrentIndex(0);
        setStatus('ready');
      } catch {
        if (mounted) setStatus('error');
      }
    };

    fetchCards();
    return () => {
      mounted = false;
    };
  }, [libraryId, collectionId, limit, mode]);

  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    setComputedExpected([]);
    setComputedAnswers({});
    setComputedFieldFeedback({});
    setShowCorrectAnswer(false);
    setCanAdvance(false);
    if (!currentCard) {
      setPrompt(null);
      setExpectedAnswer(null);
      setComputedValues(null);
      setReviewSummary(null);
      return;
    }

    if (currentCard.cardType === 'vocab') {
      const parts = currentCard.label.split('↔').map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const pickFirst = Math.random() >= 0.5;
        const promptValue = pickFirst ? parts[0] : parts[1];
        const expected = pickFirst ? parts[1] : parts[0];
        setPrompt(promptValue);
        setExpectedAnswer(expected);
      } else {
        setPrompt(currentCard.label);
        setExpectedAnswer(null);
      }
    } else if (currentCard.cardType === 'info' && currentCard.infoType === 'word') {
      setPrompt(currentCard.label);
      const match = currentCard.description?.startsWith('Language: ')
        ? currentCard.description.replace('Language: ', '')
        : null;
      setExpectedAnswer(match);
      setComputedValues(null);
    } else if (currentCard.cardType === 'info' && currentCard.infoType === 'computed') {
      const applySample = (sample: CogitaComputedSample) => {
        setPrompt(sample.prompt);
        const expectedEntries = sample.expectedAnswers
          ? Object.entries(sample.expectedAnswers).map(([key, value]) => ({ key, expected: value }))
          : [];
        if (expectedEntries.length > 0) {
          setComputedExpected(expectedEntries);
          setComputedAnswers(
            expectedEntries.reduce<Record<string, string>>((acc, entry) => {
              acc[entry.key] = '';
              return acc;
            }, {})
          );
          setExpectedAnswer(null);
        } else {
          setExpectedAnswer(sample.expectedAnswer || null);
        }
        setComputedValues(sample.values ?? null);
      };

      setPrompt(copy.cogita.library.revision.loadingComputed);
      setExpectedAnswer(null);
      setComputedValues(null);
      setComputedExpected([]);
      setComputedAnswers({});
      let mounted = true;
      getCogitaComputedSample({ libraryId, infoId: currentCard.cardId })
        .then((sample) => {
          if (!mounted) return;
          applySample(sample);
        })
        .catch(() => {
          if (!mounted) return;
          setPrompt(currentCard.label);
          setExpectedAnswer(null);
        });
      return () => {
        mounted = false;
      };
    } else {
      setPrompt(currentCard.label);
      setExpectedAnswer(null);
      setComputedValues(null);
    }
  }, [currentCard]);


  useEffect(() => {
    if (!currentCard) return;
    const focusInput = () => {
      if (currentCard.cardType === 'info' && currentCard.infoType === 'computed') {
        if (computedExpected.length > 0) {
          const firstEmpty = computedExpected.find((entry) => !(computedAnswers[entry.key] ?? '').trim());
          const key = firstEmpty?.key ?? computedExpected[0]?.key;
          if (key && computedInputRefs.current[key]) {
            computedInputRefs.current[key]?.focus();
            return;
          }
        }
        answerInputRef.current?.focus();
        return;
      }
      if (currentCard.cardType === 'vocab') {
        answerInputRef.current?.focus();
      }
    };
    const handle = window.setTimeout(focusInput, 40);
    return () => window.clearTimeout(handle);
  }, [currentCard, computedExpected, computedAnswers]);

  useEffect(() => {
    if (!canAdvance) return;
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      advanceCard();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canAdvance]);

  useEffect(() => {
    if (!currentCard) {
      setReviewSummary(null);
      return;
    }
    getCogitaReviewSummary({
      libraryId,
      itemType: currentCard.cardType === 'info' ? 'info' : 'connection',
      itemId: currentCard.cardId,
      personRoleId: reviewer
    })
      .then((summary) => {
        setReviewSummary({
          score: summary.score,
          total: summary.totalReviews,
          correct: summary.correctReviews,
          lastReviewedUtc: summary.lastReviewedUtc ?? null
        });
      })
      .catch(() => setReviewSummary(null));
  }, [libraryId, currentCard, reviewer]);

  const advanceCard = () => {
    setFeedback(null);
    setAnswer('');
    setShowCorrectAnswer(false);
    setComputedFieldFeedback({});
    setCanAdvance(false);
    setCurrentIndex((prev) => Math.min(prev + 1, queue.length));
  };

  const buildMask = (expected: string, answerValue: string) => {
    const expectedChars = expected.split('');
    const answerChars = answerValue.split('');
    const buffer = new Uint8Array(expectedChars.length);
    expectedChars.forEach((char, index) => {
      const match = answerChars[index] ?? '';
      buffer[index] = char.toLowerCase() === match.toLowerCase() ? 1 : 0;
    });
    return buffer;
  };

  const submitReview = (options: {
    correct: boolean;
    direction: string | null;
    expected?: string | null;
    answer?: string;
    expectedMap?: Record<string, string>;
    answerMap?: Record<string, string>;
  }) => {
    if (!currentCard) return;
    const expectedValue = options.expected ?? null;
    const answerValue = options.answer ?? '';
    let maskValue = expectedValue ?? '';
    let maskAnswer = answerValue;
    if (!expectedValue && options.expectedMap && options.answerMap) {
      const keys = Object.keys(options.expectedMap).sort((a, b) => a.localeCompare(b));
      maskValue = keys.map((key) => options.expectedMap?.[key] ?? '').join('|');
      maskAnswer = keys.map((key) => options.answerMap?.[key] ?? '').join('|');
    }
    const mask = maskValue ? buildMask(maskValue, maskAnswer) : new Uint8Array();
    const payload = {
      direction: options.direction,
      prompt: prompt ?? '',
      expected: expectedValue,
      answer: answerValue,
      expectedAnswers: options.expectedMap ?? null,
      answers: options.answerMap ?? null,
      correct: options.correct,
      maskBase64: mask.length ? toBase64(mask) : null,
      values: computedValues ?? null
    };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    void createCogitaReviewEvent({
      libraryId,
      itemType: currentCard.cardType === 'info' ? 'info' : 'connection',
      itemId: currentCard.cardId,
      direction: options.direction,
      payloadBase64: toBase64(payloadBytes),
      personRoleId: reviewer
    });
  };

  const handleCheckAnswer = () => {
    if (computedExpected.length > 0) {
      const fieldFeedback = computedExpected.reduce<Record<string, 'correct' | 'incorrect'>>((acc, entry) => {
        const actual = computedAnswers[entry.key] ?? '';
        acc[entry.key] = normalizeAnswer(actual) === normalizeAnswer(entry.expected) ? 'correct' : 'incorrect';
        return acc;
      }, {});
      const allCorrect = computedExpected.every(({ key, expected }) => {
        const actual = computedAnswers[key] ?? '';
        return check === 'exact' && normalizeAnswer(actual) === normalizeAnswer(expected);
      });
      if (allCorrect) {
        setFeedback('correct');
        setComputedFieldFeedback(fieldFeedback);
        setCanAdvance(true);
        submitReview({
          correct: true,
          direction: prompt ? `${prompt} -> computed` : 'computed',
          expectedMap: computedExpected.reduce<Record<string, string>>((acc, entry) => {
            acc[entry.key] = entry.expected;
            return acc;
          }, {}),
          answerMap: computedAnswers
        });
      } else {
        setFeedback('incorrect');
        setComputedFieldFeedback(fieldFeedback);
        setCanAdvance(false);
        window.setTimeout(() => {
          const first = computedExpected[0]?.key;
          if (first && computedInputRefs.current[first]) {
            computedInputRefs.current[first]?.focus();
          }
        }, 40);
        submitReview({
          correct: false,
          direction: prompt ? `${prompt} -> computed` : 'computed',
          expectedMap: computedExpected.reduce<Record<string, string>>((acc, entry) => {
            acc[entry.key] = entry.expected;
            return acc;
          }, {}),
          answerMap: computedAnswers
        });
      }
      return;
    }
    if (!expectedAnswer) return;
    const isCorrect = check === 'exact' && normalizeAnswer(answer) === normalizeAnswer(expectedAnswer);
    if (isCorrect) {
      setFeedback('correct');
      setComputedFieldFeedback({});
      setCanAdvance(true);
      submitReview({
        correct: true,
        direction: prompt ? `${prompt} -> ${expectedAnswer}` : null,
        expected: expectedAnswer,
        answer
      });
    } else {
      setFeedback('incorrect');
      setComputedFieldFeedback({});
      setCanAdvance(false);
      window.setTimeout(() => answerInputRef.current?.focus(), 40);
      submitReview({
        correct: false,
        direction: prompt ? `${prompt} -> ${expectedAnswer}` : null,
        expected: expectedAnswer,
        answer
      });
    }
  };

  const handleLanguageSelect = (label: string) => {
    if (!expectedAnswer) return;
    const isCorrect = normalizeAnswer(label) === normalizeAnswer(expectedAnswer);
    if (isCorrect) {
      setFeedback('correct');
      setComputedFieldFeedback({});
      setCanAdvance(true);
      submitReview({ correct: true, direction: `word->language`, expected: expectedAnswer, answer: label });
    } else {
      setFeedback('incorrect');
      setComputedFieldFeedback({});
      setCanAdvance(false);
      submitReview({ correct: false, direction: `word->language`, expected: expectedAnswer, answer: label });
    }
  };

  const handleMarkReviewed = () => {
    setFeedback('correct');
    setCanAdvance(true);
    if (expectedAnswer) {
      submitReview({ correct: true, direction: 'manual', expected: expectedAnswer, answer });
    }
  };

  const handleComputedKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (canAdvance) {
      advanceCard();
      return;
    }
    const emptyEntry = computedExpected.find((entry) => !(computedAnswers[entry.key] ?? '').trim());
    if (emptyEntry) {
      computedInputRefs.current[emptyEntry.key]?.focus();
      return;
    }
    handleCheckAnswer();
  };

  const revealPolicy = copy.cogita.library.revision.revealModeAfterIncorrect;
  const hasExpectedAnswer = computedExpected.length > 0 || !!expectedAnswer;

  return (
    <CogitaShell
      copy={copy}
      authLabel={authLabel}
      showProfileMenu={showProfileMenu}
      onProfileNavigate={onProfileNavigate}
      onToggleSecureMode={onToggleSecureMode}
      onLogout={onLogout}
      secureMode={secureMode}
      onNavigate={onNavigate}
      language={language}
      onLanguageChange={onLanguageChange}
    >
      <section className="cogita-library-dashboard cogita-revision-run" data-mode="detail">
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{copy.cogita.library.revision.runKicker}</p>
            <h1 className="cogita-library-title">{collectionName}</h1>
            <p className="cogita-library-subtitle">
              {copy.cogita.library.revision.modeSummary.replace('{mode}', modeLabel).replace('{check}', checkLabel)}
            </p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
            <a className="cta ghost" href={baseHref}>
              {copy.cogita.library.actions.libraryOverview}
            </a>
            <a className="cta ghost" href={`${baseHref}/collections`}>
              {copy.cogita.library.actions.collections}
            </a>
            <a className="cta ghost" href={`${baseHref}/collections/${collectionId}`}>
              {copy.cogita.library.actions.collectionDetail}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} collectionId={collectionId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane cogita-revision-stats">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.progressTitle}</p>
                      <h3 className="cogita-detail-title">
                        {queue.length ? `${Math.min(currentIndex + 1, queue.length)} / ${queue.length}` : '0 / 0'}
                      </h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    {status === 'loading' && <p>{copy.cogita.library.revision.loading}</p>}
                    {status === 'error' && <p>{copy.cogita.library.revision.error}</p>}
                    {status === 'ready' && queue.length === 0 && <p>{copy.cogita.library.revision.empty}</p>}
                    <p>
                      <strong>{copy.cogita.library.revision.revealModeLabel}</strong> {revealPolicy}
                    </p>
                  </div>
                </section>
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.knownessTitle}</p>
                      <h3 className="cogita-detail-title">
                        {reviewSummary ? `${reviewSummary.score.toFixed(1)} / 100` : copy.cogita.library.revision.knownessEmpty}
                      </h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    {reviewSummary ? (
                      <>
                        <p>
                          {copy.cogita.library.revision.knownessStats
                            .replace('{correct}', String(reviewSummary.correct))
                            .replace('{total}', String(reviewSummary.total))}
                        </p>
                        {reviewSummary.lastReviewedUtc && (
                          <p>
                            {copy.cogita.library.revision.knownessLast.replace(
                              '{date}',
                              new Date(reviewSummary.lastReviewedUtc).toLocaleString()
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <p>{copy.cogita.library.revision.knownessHint}</p>
                    )}
                  </div>
                </section>
              </div>

              <div className="cogita-library-panel">
            <section className="cogita-revision-card" data-feedback={feedback ?? 'idle'}>
              {currentCard ? (
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
                          ref={answerInputRef}
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                          placeholder={copy.cogita.library.revision.answerPlaceholder}
                          data-state={feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            event.stopPropagation();
                            if (canAdvance) {
                              advanceCard();
                            } else {
                              handleCheckAnswer();
                            }
                          }}
                        />
                      </label>
                      <div className="cogita-form-actions">
                        <button type="button" className="cta" onClick={handleCheckAnswer}>
                          {copy.cogita.library.revision.checkAnswer}
                        </button>
                        <button type="button" className="ghost" onClick={advanceCard}>
                          {copy.cogita.library.revision.skip}
                        </button>
                      </div>
                    </div>
                  ) : currentCard.cardType === 'info' && currentCard.infoType === 'computed' ? (
                    <div className="cogita-revision-body">
                      {currentCard.label ? <p className="cogita-revision-hint">{currentCard.label}</p> : null}
                      <LatexBlock value={prompt ?? ''} mode="auto" />
                      <div className="cogita-form-grid">
                        {computedExpected.length > 0 ? (
                          computedExpected.map((entry) => (
                            <label key={entry.key} className="cogita-field">
                              <span>{entry.key}</span>
                              <input
                                ref={(el) => {
                                  computedInputRefs.current[entry.key] = el;
                                }}
                                value={computedAnswers[entry.key] ?? ''}
                                onChange={(event) =>
                                  setComputedAnswers((prev) => ({ ...prev, [entry.key]: event.target.value }))
                                }
                                placeholder={copy.cogita.library.revision.answerPlaceholderComputed}
                                data-state={computedFieldFeedback[entry.key] ?? (feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined)}
                                onKeyDown={handleComputedKeyDown}
                              />
                            </label>
                          ))
                        ) : (
                          <label className="cogita-field">
                            <span>{copy.cogita.library.revision.answerLabel}</span>
                            <input
                              ref={answerInputRef}
                              value={answer}
                              onChange={(event) => setAnswer(event.target.value)}
                              placeholder={copy.cogita.library.revision.answerPlaceholderComputed}
                              data-state={feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                event.stopPropagation();
                                if (canAdvance) {
                                  advanceCard();
                                } else {
                                  handleCheckAnswer();
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                      <div className="cogita-form-actions">
                        <button type="button" className="cta" onClick={handleCheckAnswer}>
                          {copy.cogita.library.revision.checkAnswer}
                        </button>
                        <button type="button" className="ghost" onClick={advanceCard}>
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
                            <button key={lang.infoId} type="button" className="ghost" onClick={() => handleLanguageSelect(lang.label)}>
                              {lang.label}
                            </button>
                          ))
                        ) : (
                          <span className="cogita-revision-hint">{copy.cogita.library.revision.noLanguages}</span>
                        )}
                      </div>
                      <div className="cogita-form-actions">
                        <button type="button" className="ghost" onClick={advanceCard}>
                          {copy.cogita.library.revision.skip}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="cogita-revision-body">
                      <h2>{prompt}</h2>
                      <p className="cogita-revision-hint">{copy.cogita.library.revision.hintReview}</p>
                      <div className="cogita-form-actions">
                        <button type="button" className="cta" onClick={handleMarkReviewed}>
                          {copy.cogita.library.revision.markDone}
                        </button>
                        <button type="button" className="ghost" onClick={advanceCard}>
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
                      <button type="button" className="ghost" onClick={() => setShowCorrectAnswer((prev) => !prev)}>
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
                            </div>
                          ) : (
                            <p>{expectedAnswer}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="cogita-card-empty">
                  <p>{copy.cogita.library.revision.completed}</p>
                  <div className="cogita-form-actions">
                    <a className="cta" href={`${baseHref}/collections/${collectionId}`}>
                      {copy.cogita.library.actions.collectionDetail}
                    </a>
                  </div>
                </div>
              )}
            </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
