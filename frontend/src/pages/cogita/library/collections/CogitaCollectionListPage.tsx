import { useEffect, useState } from 'react';
import { getCogitaCollections, type CogitaCollectionSummary } from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import { useCogitaLibraryMeta } from '../useCogitaLibraryMeta';

export function CogitaCollectionListPage({
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
  libraryId
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
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [query, setQuery] = useState('');
  const [collections, setCollections] = useState<CogitaCollectionSummary[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    setStatus('loading');
    const handle = window.setTimeout(() => {
      getCogitaCollections({ libraryId, query: query.trim() || undefined, limit: 30 })
        .then((bundle) => {
          setCollections(bundle.items);
          setTotalCount(bundle.total);
          setNextCursor(bundle.nextCursor ?? null);
          setStatus('ready');
        })
        .catch(() => {
          setCollections([]);
          setTotalCount(0);
          setNextCursor(null);
          setStatus('ready');
        });
    }, 240);
    return () => window.clearTimeout(handle);
  }, [libraryId, query]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setStatus('loading');
    try {
      const bundle = await getCogitaCollections({
        libraryId,
        query: query.trim() || undefined,
        limit: 30,
        cursor: nextCursor
      });
      setCollections((prev) => [...prev, ...bundle.items]);
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
      <section className="cogita-library-dashboard" data-mode="list">
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{copy.cogita.library.collections.listKicker}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.collections.listSubtitle}</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
            <a className="cta ghost" href={baseHref}>
              {copy.cogita.library.actions.libraryOverview}
            </a>
            <a className="cta" href={`${baseHref}/collections/new`}>
              {copy.cogita.library.actions.createCollection}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-library-controls">
                  <div className="cogita-library-search">
                    <p className="cogita-user-kicker">{copy.cogita.library.collections.listKicker}</p>
                    <div className="cogita-search-field">
                      <input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={copy.cogita.library.collections.searchPlaceholder}
                      />
                    </div>
                  </div>
                </div>

                <div className="cogita-card-count">
                  <span>{copy.cogita.library.collections.countLabel
                    .replace('{shown}', String(collections.length))
                    .replace('{total}', String(totalCount || collections.length))}</span>
                  <span>{status === 'loading' ? copy.cogita.library.collections.loading : copy.cogita.library.collections.ready}</span>
                </div>

                <div className="cogita-card-list" data-view="list">
                  {collections.length ? (
                    collections.map((collection) => (
                      <div key={collection.collectionId} className="cogita-card-item">
                        <a className="cogita-card-select" href={`${baseHref}/collections/${collection.collectionId}`}>
                          <div className="cogita-card-type">{copy.cogita.library.collections.collectionLabel}</div>
                          <h3 className="cogita-card-title">{collection.name}</h3>
                          <p className="cogita-card-subtitle">
                            {copy.cogita.library.collections.itemCountLabel.replace('{count}', String(collection.itemCount))} ·{' '}
                            {collection.notes || copy.cogita.library.collections.noNotes}
                          </p>
                        </a>
                      </div>
                    ))
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{copy.cogita.library.collections.emptyTitle}</p>
                      <a className="ghost" href={`${baseHref}/collections/new`}>
                        {copy.cogita.library.collections.emptyAction}
                      </a>
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
                      <p className="cogita-user-kicker">{copy.cogita.library.collections.listKicker}</p>
                      <h3 className="cogita-detail-title">{copy.cogita.library.collections.detailFocusTitle}</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    <p>{copy.cogita.library.collections.detailFocusBody}</p>
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
