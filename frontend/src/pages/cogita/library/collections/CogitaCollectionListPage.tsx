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
            <p className="cogita-user-kicker">Collections</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">Curated stacks of index cards for revision.</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              Back to Cogita
            </a>
            <a className="cta ghost" href={baseHref}>
              Library overview
            </a>
            <a className="cta" href={`${baseHref}/collections/new`}>
              Create collection
            </a>
          </div>
        </header>

        <div className="cogita-library-grid">
          <div className="cogita-library-pane">
            <div className="cogita-library-controls">
              <div className="cogita-library-search">
                <p className="cogita-user-kicker">Search collections</p>
                <div className="cogita-search-field">
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search collection name"
                  />
                </div>
              </div>
            </div>

            <div className="cogita-card-count">
              <span>
                {collections.length} of {totalCount || collections.length} collections
              </span>
              <span>{status === 'loading' ? 'Loading...' : 'Ready'}</span>
            </div>

            <div className="cogita-card-list" data-view="list">
              {collections.length ? (
                collections.map((collection) => (
                  <div key={collection.collectionId} className="cogita-card-item">
                    <a className="cogita-card-select" href={`${baseHref}/collections/${collection.collectionId}`}>
                      <div className="cogita-card-type">Collection</div>
                      <h3 className="cogita-card-title">{collection.name}</h3>
                      <p className="cogita-card-subtitle">
                        {collection.itemCount} cards · {collection.notes || 'No notes yet'}
                      </p>
                    </a>
                  </div>
                ))
              ) : (
                <div className="cogita-card-empty">
                  <p>No collections yet.</p>
                  <a className="ghost" href={`${baseHref}/collections/new`}>
                    Create the first collection
                  </a>
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
                  <p className="cogita-user-kicker">Collections focus</p>
                  <h3 className="cogita-detail-title">Prepare revision sets</h3>
                </div>
              </div>
              <div className="cogita-detail-body">
                <p>Create collections from words, translations, or any info cards.</p>
                <p>Collections can include other collections for layered revision paths.</p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
