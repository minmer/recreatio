import { useEffect, useMemo, useState } from 'react';
import { ApiError, deleteCogitaCollection, getCogitaCollection, getCogitaCollectionCards, type CogitaCardSearchResult } from '../../../../../lib/api';
import { useNavigate } from 'react-router-dom';
import { getCardKey } from '../../../features/revision/cards';
import { CogitaShell } from '../../../CogitaShell';
import { CogitaStatisticsPanel } from '../../runtime/revision/primitives/RevisionStatistics';
import type { Copy } from '../../../../../content/types';
import type { RouteKey } from '../../../../../types/navigation';

export function CogitaCollectionOverview({
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
  const navigate = useNavigate();
  const baseHref = `/#/cogita/workspace/libraries/${libraryId}`;
  const [totalCount, setTotalCount] = useState(0);
  const [cards, setCards] = useState<CogitaCardSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
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
        setTotalCount(detail.itemCount);
      })
      .catch(() => {});
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

  const handleDeleteCollection = async () => {
    if (!window.confirm(copy.cogita.library.collections.deleteConfirm)) return;
    setDeleteStatus(null);
    try {
      await deleteCogitaCollection({ libraryId, collectionId });
      navigate(`/cogita/workspace/libraries/${libraryId}/collections`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.message) {
        try {
          const parsed = JSON.parse(error.message) as { error?: string };
          setDeleteStatus(parsed.error ?? copy.cogita.library.collections.deleteFail);
          return;
        } catch {
          setDeleteStatus(error.message);
          return;
        }
      }
      setDeleteStatus(copy.cogita.library.collections.deleteFail);
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
        <div className="cogita-library-layout">
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
                      <div key={getCardKey(card)} className="cogita-card-item">
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
                    <a className="cta" href={`${baseHref}/revisions`}>
                      {copy.cogita.library.actions.startRevision}
                    </a>
                    <button type="button" className="ghost" onClick={() => void handleDeleteCollection()}>
                      Delete
                    </button>
                  </div>
                  {deleteStatus ? <p className="cogita-form-error">{deleteStatus}</p> : null}
                </section>
                <CogitaStatisticsPanel
                  libraryId={libraryId}
                  scopeType="collection"
                  scopeId={collectionId}
                  title="Collection statistics"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
