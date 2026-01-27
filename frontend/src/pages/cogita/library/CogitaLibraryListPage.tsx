import { useEffect, useMemo, useState } from 'react';
import { searchCogitaCards, type CogitaCardSearchResult } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaInfoType, CogitaLibraryMode } from './types';
import { cardSearchOptions } from './libraryOptions';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';

export function CogitaLibraryListPage({
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
  mode
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
  mode: CogitaLibraryMode;
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [searchType, setSearchType] = useState<CogitaInfoType | 'any' | 'vocab'>('any');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CogitaCardSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [selectedInfo, setSelectedInfo] = useState<CogitaCardSearchResult | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    setSearchStatus('loading');
    const handle = window.setTimeout(() => {
      searchCogitaCards({
        libraryId,
        type: searchType === 'any' ? undefined : searchType,
        query: searchQuery.trim() || undefined,
        limit: 30
      })
        .then((bundle) => {
          setSearchResults(bundle.items);
          setTotalCount(bundle.total);
          setNextCursor(bundle.nextCursor ?? null);
          setSearchStatus('ready');
          setSelectedInfo(bundle.items[0] ?? null);
        })
        .catch(() => {
          setSearchResults([]);
          setTotalCount(0);
          setNextCursor(null);
          setSearchStatus('ready');
        });
    }, 240);

    return () => window.clearTimeout(handle);
  }, [libraryId, searchQuery, searchType]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setSearchStatus('loading');
    try {
      const bundle = await searchCogitaCards({
        libraryId,
        type: searchType === 'any' ? undefined : searchType,
        query: searchQuery.trim() || undefined,
        limit: 30,
        cursor: nextCursor
      });
      setSearchResults((prev) => [...prev, ...bundle.items]);
      setNextCursor(bundle.nextCursor ?? null);
      setTotalCount(bundle.total);
      setSearchStatus('ready');
    } catch {
      setSearchStatus('ready');
    }
  };

  const cardsView = useMemo(() => (mode === 'collection' ? 'grid' : mode === 'list' ? 'list' : 'detail'), [mode]);

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
      <section className="cogita-library-dashboard" data-mode={cardsView}>
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">Library list</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">Browse all encrypted info cards.</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              Back to Cogita
            </a>
            <a className="cta ghost" href={baseHref}>
              Library overview
            </a>
            <a className="cta ghost" href={`${baseHref}/collections`}>
              Collections
            </a>
            <a className="cta" href={`${baseHref}/new`}>
              Add new info
            </a>
          </div>
        </header>

        <div className="cogita-library-modes">
          {(['detail', 'collection', 'list'] as const).map((item) => (
            <a key={item} className="ghost" data-active={mode === item} href={`${baseHref}/${item}`}>
              {item}
            </a>
          ))}
        </div>

        <div className="cogita-library-grid">
          <div className="cogita-library-pane">
            <div className="cogita-library-controls">
              <div className="cogita-library-search">
                <p className="cogita-user-kicker">Search</p>
                <div className="cogita-search-field">
                  <select value={searchType} onChange={(event) => setSearchType(event.target.value as CogitaInfoType | 'any' | 'vocab')}>
                    {cardSearchOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search text, name, or label"
                  />
                </div>
              </div>
            </div>

            <div className="cogita-card-count">
              <span>
                {searchResults.length} of {totalCount || searchResults.length} cards
              </span>
              <span>{searchStatus === 'loading' ? 'Loading...' : 'Ready'}</span>
            </div>

            <div className="cogita-card-list" data-view={mode === 'collection' ? 'grid' : 'list'}>
              {searchResults.length ? (
                searchResults.map((result) => (
                  <button
                    key={result.cardId}
                    type="button"
                    className="cogita-card-item"
                    data-selected={selectedInfo?.cardId === result.cardId}
                    onClick={() => setSelectedInfo(result)}
                  >
                    <div className="cogita-card-type">{result.cardType}</div>
                    <h3 className="cogita-card-title">{result.label}</h3>
                    <p className="cogita-card-subtitle">{result.description}</p>
                  </button>
                ))
              ) : (
                <div className="cogita-card-empty">
                  <p>No matching info found.</p>
                  <a className="ghost" href={`${baseHref}/new`}>
                    Add information
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
                  <p className="cogita-user-kicker">Selected info</p>
                  <h3 className="cogita-detail-title">{selectedInfo?.label ?? 'Pick an info card'}</h3>
                </div>
                <div className="cogita-detail-actions">
                  <a className="ghost" href={`${baseHref}/new`}>
                    Add info
                  </a>
                </div>
              </div>
              {selectedInfo ? (
                <div className="cogita-detail-body">
                  <p>Type: {selectedInfo.cardType}</p>
                  <p>Use the add page to create connections or vocabulary links.</p>
                </div>
              ) : (
                <div className="cogita-card-empty">
                  <p>No info selected yet.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
