import { useEffect, useMemo, useState } from 'react';
import {
  getCogitaPublicComputedSample,
  getCogitaPublicRevisionCards,
  getCogitaPublicRevisionInfos,
  getCogitaPublicRevisionShare,
  type CogitaCardSearchResult,
  type CogitaInfoSearchResult,
  type CogitaPublicRevisionShare
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import type { CogitaInfoType } from '../types';
import { getInfoTypeLabel } from '../libraryOptions';
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

export function CogitaRevisionShareRunPage({
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
  shareId
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
  shareId: string;
}) {
  const [shareInfo, setShareInfo] = useState<CogitaPublicRevisionShare | null>(null);
  const [shareStatus, setShareStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [collectionName, setCollectionName] = useState(copy.cogita.library.collections.defaultName);
  const [libraryName, setLibraryName] = useState('Cogita Library');
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
  const [computedValues, setComputedValues] = useState<Record<string, number | string> | null>(null);

  const mode = shareInfo?.mode ?? 'random';
  const check = shareInfo?.check ?? 'exact';
  const limit = shareInfo?.limit ?? 20;
  const modeLabel = useMemo(() => (mode === 'random' ? copy.cogita.library.revision.modeValue : mode), [copy, mode]);
  const checkLabel = useMemo(() => (check === 'exact' ? copy.cogita.library.revision.checkValue : check), [copy, check]);

  const canRenderCards = shareStatus === 'ready';
  const currentCard = canRenderCards ? queue[currentIndex] ?? null : null;
  const currentTypeLabel = useMemo(() => {
    if (!currentCard) return '';
    if (currentCard.cardType === 'vocab') return copy.cogita.library.revision.vocabLabel;
    if (currentCard.infoType) return getInfoTypeLabel(copy, currentCard.infoType as CogitaInfoType);
    return copy.cogita.library.revision.infoLabel;
  }, [copy, currentCard]);

  useEffect(() => {
    if (!shareId) {
      setShareStatus('error');
      return;
    }
    setShareStatus('loading');
    getCogitaPublicRevisionShare({ shareId })
      .then((info) => {
        setShareInfo(info);
        setCollectionName(info.collectionName);
        setLibraryName(info.libraryName);
        setShareStatus('ready');
      })
      .catch(() => {
        setShareStatus('error');
      });
  }, [shareId]);

  useEffect(() => {
    if (!shareId) return;
    getCogitaPublicRevisionInfos({ shareId, type: 'language' })
      .then((results) => setLanguages(results))
      .catch(() => setLanguages([]));
  }, [shareId]);

  useEffect(() => {
    if (!shareId || shareStatus !== 'ready') return;
    let mounted = true;
    const fetchCards = async () => {
      setStatus('loading');
      try {
        const gathered: CogitaCardSearchResult[] = [];
        let cursor: string | null | undefined = null;
        do {
          const bundle = await getCogitaPublicRevisionCards({
            shareId,
            limit: 100,
            cursor
          });
          gathered.push(...bundle.items);
          cursor = bundle.nextCursor ?? null;
          if (gathered.length >= limit) break;
        } while (cursor);

        if (!mounted) return;
        const ordered = mode === 'random' ? shuffle(gathered) : gathered;
        const trimmed = ordered.slice(0, limit);
        setQueue(trimmed);
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
  }, [shareId, limit, mode, shareStatus]);

  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    setComputedExpected([]);
    setComputedAnswers({});
    if (!currentCard) {
      setPrompt(null);
      setExpectedAnswer(null);
      setComputedValues(null);
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
      setPrompt(copy.cogita.library.revision.loadingComputed);
      setExpectedAnswer(null);
      setComputedValues(null);
      setComputedExpected([]);
      setComputedAnswers({});
      let mounted = true;
      getCogitaPublicComputedSample({ shareId, infoId: currentCard.cardId })
        .then((sample) => {
          if (!mounted) return;
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
  }, [currentCard, shareId, copy]);

  const advanceCard = () => {
    setFeedback(null);
    setAnswer('');
    setCurrentIndex((prev) => Math.min(prev + 1, queue.length));
  };

  const handleCheckAnswer = () => {
    if (computedExpected.length > 0) {
      const allCorrect = computedExpected.every(({ key, expected }) => {
        const actual = computedAnswers[key] ?? '';
        return check === 'exact' && normalizeAnswer(actual) === normalizeAnswer(expected);
      });
      if (allCorrect) {
        setFeedback('correct');
        window.setTimeout(() => advanceCard(), 650);
      } else {
        setFeedback('incorrect');
      }
      return;
    }
    if (!expectedAnswer) return;
    const isCorrect = check === 'exact' && normalizeAnswer(answer) === normalizeAnswer(expectedAnswer);
    if (isCorrect) {
      setFeedback('correct');
      window.setTimeout(() => advanceCard(), 650);
    } else {
      setFeedback('incorrect');
    }
  };

  const handleLanguageSelect = (label: string) => {
    if (!expectedAnswer) return;
    const isCorrect = normalizeAnswer(label) === normalizeAnswer(expectedAnswer);
    if (isCorrect) {
      setFeedback('correct');
      window.setTimeout(() => advanceCard(), 650);
    } else {
      setFeedback('incorrect');
    }
  };

  const handleMarkReviewed = () => {
    setFeedback('correct');
    window.setTimeout(() => advanceCard(), 450);
  };

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
      <section className="cogita-library-dashboard" data-mode="detail">
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{copy.cogita.library.revision.shareRunKicker}</p>
            <h1 className="cogita-library-title">{collectionName}</h1>
            <p className="cogita-library-subtitle">{libraryName}</p>
            <p className="cogita-library-subtitle">
              {copy.cogita.library.revision.modeSummary.replace('{mode}', modeLabel).replace('{check}', checkLabel)}
            </p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
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
                    {shareStatus === 'error' && <p>{copy.cogita.library.revision.shareInvalid}</p>}
                    {shareStatus === 'loading' && <p>{copy.cogita.library.revision.shareLoading}</p>}
                    {shareStatus === 'ready' && status === 'loading' && <p>{copy.cogita.library.revision.loading}</p>}
                    {shareStatus === 'ready' && status === 'error' && <p>{copy.cogita.library.revision.error}</p>}
                    {shareStatus === 'ready' && status === 'ready' && queue.length === 0 && <p>{copy.cogita.library.revision.empty}</p>}
                  </div>
                </section>
              </div>

              <div className="cogita-library-panel">
                <section className="cogita-revision-card" data-feedback={feedback ?? 'idle'}>
                  {shareStatus !== 'ready' ? (
                    <div className="cogita-card-empty">
                      <p>
                        {shareStatus === 'loading'
                          ? copy.cogita.library.revision.shareLoading
                          : copy.cogita.library.revision.shareInvalid}
                      </p>
                      <div className="cogita-form-actions">
                        <a className="cta" href="/#/cogita">
                          {copy.cogita.library.actions.backToCogita}
                        </a>
                      </div>
                    </div>
                  ) : currentCard ? (
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
                              value={answer}
                              onChange={(event) => setAnswer(event.target.value)}
                              placeholder={copy.cogita.library.revision.answerPlaceholder}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') handleCheckAnswer();
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
                          <LatexBlock value={prompt ?? ''} />
                          <div className="cogita-form-grid">
                            {computedExpected.length > 0 ? (
                              computedExpected.map((entry) => (
                                <label key={entry.key} className="cogita-field">
                                  <span>{entry.key}</span>
                                  <input
                                    value={computedAnswers[entry.key] ?? ''}
                                    onChange={(event) =>
                                      setComputedAnswers((prev) => ({ ...prev, [entry.key]: event.target.value }))
                                    }
                                    placeholder={copy.cogita.library.revision.answerPlaceholder}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') handleCheckAnswer();
                                    }}
                                  />
                                </label>
                              ))
                            ) : (
                              <label className="cogita-field">
                                <span>{copy.cogita.library.revision.answerLabel}</span>
                                <input
                                  value={answer}
                                  onChange={(event) => setAnswer(event.target.value)}
                                  placeholder={copy.cogita.library.revision.answerPlaceholder}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleCheckAnswer();
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
                    </>
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{copy.cogita.library.revision.completed}</p>
                      <div className="cogita-form-actions">
                        <a className="cta" href="/#/cogita">
                          {copy.cogita.library.actions.backToCogita}
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
