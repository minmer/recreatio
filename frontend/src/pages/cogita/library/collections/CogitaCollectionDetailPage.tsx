import { useEffect, useState } from 'react';
import { getCogitaCollection, getCogitaCollectionCards, type CogitaCardSearchResult } from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import { useCogitaLibraryMeta } from '../useCogitaLibraryMeta';

export function CogitaCollectionDetailPage({
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
  onBackToCollections,
  onBackToOverview,
  onBackToCogita,
  onStartRevision
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
  onBackToCollections: () => void;
  onBackToOverview: () => void;
  onBackToCogita: () => void;
  onStartRevision: () => void;
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const [collectionName, setCollectionName] = useState('Collection');
  const [collectionNotes, setCollectionNotes] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [cards, setCards] = useState<CogitaCardSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    getCogitaCollection(libraryId, collectionId)
      .then((detail) => {
        setCollectionName(detail.name);
        setCollectionNotes(detail.notes ?? null);
        setTotalCount(detail.itemCount);
      })
      .catch(() => {
        setCollectionName('Collection');
        setCollectionNotes(null);
      });
  }, [libraryId, collectionId]);

  useEffect(() => {
    setStatus('loading');
    getCogitaCollectionCards({ libraryId, collectionId, limit: 40 })
      .then((bundle) => {
        setCards(bundle.items);
        setNextCursor(bundle.nextCursor ?? null);
        setTotalCount(bundle.total);
        setStatus('ready');
      })
      .catch(() => {
        setCards([]);
        setNextCursor(null);
        setStatus('ready');
      });
  }, [libraryId, collectionId]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setStatus('loading');
    try {
      const bundle = await getCogitaCollectionCards({ libraryId, collectionId, limit: 40, cursor: nextCursor });
      setCards((prev) => [...prev, ...bundle.items]);
      setNextCursor(bundle.nextCursor ?? null);
      setTotalCount(bundle.total);
      setStatus('ready');
    } catch {
      setStatus('ready');
    }
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
            <p className="cogita-user-kicker">Collection detail</p>
            <h1 className="cogita-library-title">{collectionName}</h1>
            <p className="cogita-library-subtitle">{collectionNotes || libraryName}</p>
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
            <button type="button" className="cta" onClick={onStartRevision}>
              Start revision
            </button>
          </div>
        </header>

        <div className="cogita-library-grid">
          <div className="cogita-library-pane">
            <div className="cogita-card-count">
              <span>
                {cards.length} of {totalCount || cards.length} cards
              </span>
              <span>{status === 'loading' ? 'Loading...' : 'Ready'}</span>
            </div>

            <div className="cogita-card-list" data-view="list">
              {cards.length ? (
                cards.map((card) => (
                  <div key={`${card.cardType}-${card.cardId}`} className="cogita-card-item">
                    <div className="cogita-card-select">
                      <div className="cogita-card-type">{card.cardType}</div>
                      <h3 className="cogita-card-title">{card.label}</h3>
                      <p className="cogita-card-subtitle">{card.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="cogita-card-empty">
                  <p>No cards stored in this collection yet.</p>
                </div>
              )}
            </div>

            {nextCursor ? (
              <div className="cogita-form-actions">
                <button type="button" className="cta ghost" onClick={handleLoadMore}>
                  Load more
                </button>
              </div>
            ) : null}
          </div>

          <div className="cogita-library-panel">
            <section className="cogita-library-detail">
              <div className="cogita-detail-header">
                <div>
                  <p className="cogita-user-kicker">Revision prep</p>
                  <h3 className="cogita-detail-title">Ready to practice?</h3>
                </div>
              </div>
              <div className="cogita-detail-body">
                <p>Start a revision run when you are ready. Random ordering is enabled by default.</p>
              </div>
              <div className="cogita-form-actions">
                <button type="button" className="cta" onClick={onStartRevision}>
                  Start revision
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
