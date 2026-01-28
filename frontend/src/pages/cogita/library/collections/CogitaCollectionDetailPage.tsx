import { useEffect, useMemo, useState } from 'react';
import { getCogitaCollection, getCogitaCollectionCards, type CogitaCardSearchResult } from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import { useCogitaLibraryMeta } from '../useCogitaLibraryMeta';
import { CogitaLibrarySidebar } from '../components/CogitaLibrarySidebar';

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
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [collectionName, setCollectionName] = useState(copy.cogita.library.collections.defaultName);
  const [collectionNotes, setCollectionNotes] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [cards, setCards] = useState<CogitaCardSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const cardCountLabel = useMemo(
    () =>
      copy.cogita.library.list.cardCount
        .replace('{shown}', String(cards.length))
        .replace('{total}', String(totalCount || cards.length)),
    [copy, cards.length, totalCount]
  );

  useEffect(() => {
    getCogitaCollection(libraryId, collectionId)
      .then((detail) => {
        setCollectionName(detail.name);
        setCollectionNotes(detail.notes ?? null);
        setTotalCount(detail.itemCount);
      })
      .catch(() => {
        setCollectionName(copy.cogita.library.collections.defaultName);
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
            <p className="cogita-user-kicker">{copy.cogita.library.collections.detailKicker}</p>
            <h1 className="cogita-library-title">{collectionName}</h1>
            <p className="cogita-library-subtitle">{collectionNotes || copy.cogita.library.collections.detailSubtitle}</p>
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
            <a className="cta ghost" href={`${baseHref}/collections/${collectionId}/graph`}>
              {copy.cogita.library.graph.kicker}
            </a>
            <a className="cta" href={`${baseHref}/collections/${collectionId}/revision`}>
              {copy.cogita.library.actions.startRevision}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} collectionId={collectionId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-card-count">
                  <span>{cardCountLabel}</span>
                  <span>{status === 'loading' ? copy.cogita.library.collections.loading : copy.cogita.library.collections.ready}</span>
                </div>

                <div className="cogita-card-list" data-view="list">
                  {cards.length ? (
                    cards.map((card) => (
                      <div key={`${card.cardType}-${card.cardId}`} className="cogita-card-item">
                        <div className="cogita-card-select">
                          <div className="cogita-card-type">
                            {card.cardType === 'vocab'
                              ? copy.cogita.library.list.cardTypeVocab
                              : card.cardType === 'connection'
                              ? copy.cogita.library.list.cardTypeConnection
                              : copy.cogita.library.list.cardTypeInfo}
                          </div>
                          <h3 className="cogita-card-title">{card.label}</h3>
                          <p className="cogita-card-subtitle">{card.description}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{copy.cogita.library.collections.noCards}</p>
                    </div>
                  )}
                </div>

                {nextCursor ? (
                  <div className="cogita-form-actions">
                    <button type="button" className="cta ghost" onClick={handleLoadMore}>
                      {copy.cogita.library.list.loadMore}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="cogita-library-panel">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.collections.detailKicker}</p>
                      <h3 className="cogita-detail-title">{copy.cogita.library.collections.detailFocusTitle}</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    <p>{copy.cogita.library.collections.detailFocusBody}</p>
                  </div>
                  <div className="cogita-form-actions">
                    <a className="cta" href={`${baseHref}/collections/${collectionId}/revision`}>
                      {copy.cogita.library.actions.startRevision}
                    </a>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
