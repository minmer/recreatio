import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getCogitaCollection,
  getCogitaCollectionCards,
  searchCogitaInfos,
  type CogitaCardSearchResult,
  type CogitaInfoSearchResult
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';

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
  collectionId,
  onBackToCollection,
  onBackToCollections,
  onBackToOverview,
  onBackToCogita
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
  onBackToCollection: () => void;
  onBackToCollections: () => void;
  onBackToOverview: () => void;
  onBackToCogita: () => void;
}) {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const limit = Math.max(1, Number(params.get('limit') ?? 20));
  const mode = params.get('mode') ?? 'random';
  const check = params.get('check') ?? 'exact';

  const [collectionName, setCollectionName] = useState('Collection');
  const [queue, setQueue] = useState<CogitaCardSearchResult[]>([]);
  const [languages, setLanguages] = useState<CogitaInfoSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [expectedAnswer, setExpectedAnswer] = useState<string | null>(null);

  const currentCard = queue[currentIndex] ?? null;

  useEffect(() => {
    getCogitaCollection(libraryId, collectionId)
      .then((detail) => setCollectionName(detail.name))
      .catch(() => setCollectionName('Collection'));
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
  }, [libraryId, collectionId, limit, mode]);

  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    if (!currentCard) {
      setPrompt(null);
      setExpectedAnswer(null);
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
    } else {
      setPrompt(currentCard.label);
      setExpectedAnswer(null);
    }
  }, [currentCard]);

  const advanceCard = () => {
    setFeedback(null);
    setAnswer('');
    setCurrentIndex((prev) => Math.min(prev + 1, queue.length));
  };

  const handleCheckAnswer = () => {
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
            <p className="cogita-user-kicker">Revision</p>
            <h1 className="cogita-library-title">{collectionName}</h1>
            <p className="cogita-library-subtitle">Mode: {mode} · Check: {check}</p>
          </div>
          <div className="cogita-library-actions">
            <button type="button" className="cta ghost" onClick={onBackToCogita}>
              Back to Cogita
            </button>
            <button type="button" className="cta ghost" onClick={onBackToOverview}>
              Library overview
            </button>
            <button type="button" className="cta ghost" onClick={onBackToCollections}>
              Collections list
            </button>
            <button type="button" className="cta ghost" onClick={onBackToCollection}>
              Collection detail
            </button>
          </div>
        </header>

        <div className="cogita-library-grid">
          <div className="cogita-library-pane">
            <section className="cogita-library-detail">
              <div className="cogita-detail-header">
                <div>
                  <p className="cogita-user-kicker">Progress</p>
                  <h3 className="cogita-detail-title">
                    {queue.length ? `${Math.min(currentIndex + 1, queue.length)} / ${queue.length}` : '0 / 0'}
                  </h3>
                </div>
              </div>
              <div className="cogita-detail-body">
                {status === 'loading' && <p>Loading revision cards...</p>}
                {status === 'error' && <p>Failed to load cards.</p>}
                {status === 'ready' && queue.length === 0 && <p>No cards available for revision.</p>}
              </div>
            </section>
          </div>

          <div className="cogita-library-panel">
            <section className="cogita-revision-card" data-feedback={feedback ?? 'idle'}>
              {currentCard ? (
                <>
                  <div className="cogita-revision-header">
                    <span>{currentCard.cardType === 'vocab' ? 'Vocabulary' : currentCard.infoType ?? 'Info'}</span>
                    <strong>{currentCard.description}</strong>
                  </div>

                  {currentCard.cardType === 'vocab' ? (
                    <div className="cogita-revision-body">
                      <h2>{prompt}</h2>
                      <label className="cogita-field">
                        <span>Your answer</span>
                        <input
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') handleCheckAnswer();
                          }}
                        />
                      </label>
                      <div className="cogita-form-actions">
                        <button type="button" className="cta" onClick={handleCheckAnswer}>
                          Check
                        </button>
                        <button type="button" className="ghost" onClick={advanceCard}>
                          Skip
                        </button>
                      </div>
                    </div>
                  ) : currentCard.cardType === 'info' && currentCard.infoType === 'word' ? (
                    <div className="cogita-revision-body">
                      <h2>{prompt}</h2>
                      <p className="cogita-revision-hint">Select the language for this word.</p>
                      <div className="cogita-choice-grid">
                        {languages.length ? (
                          languages.map((lang) => (
                            <button key={lang.infoId} type="button" className="ghost" onClick={() => handleLanguageSelect(lang.label)}>
                              {lang.label}
                            </button>
                          ))
                        ) : (
                          <span className="cogita-revision-hint">No languages found.</span>
                        )}
                      </div>
                      <div className="cogita-form-actions">
                        <button type="button" className="ghost" onClick={advanceCard}>
                          Skip
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="cogita-revision-body">
                      <h2>{prompt}</h2>
                      <p className="cogita-revision-hint">Review this card and mark as done.</p>
                      <div className="cogita-form-actions">
                        <button type="button" className="cta" onClick={handleMarkReviewed}>
                          Mark reviewed
                        </button>
                        <button type="button" className="ghost" onClick={advanceCard}>
                          Skip
                        </button>
                      </div>
                    </div>
                  )}

                  {feedback && (
                    <div className="cogita-revision-feedback" data-state={feedback}>
                      {feedback === 'correct' ? 'Correct' : 'Try again'}
                    </div>
                  )}
                </>
              ) : (
                <div className="cogita-card-empty">
                  <p>Revision completed. Great job!</p>
                  <div className="cogita-form-actions">
                    <button type="button" className="cta" onClick={onBackToCollection}>
                      Back to collection
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
