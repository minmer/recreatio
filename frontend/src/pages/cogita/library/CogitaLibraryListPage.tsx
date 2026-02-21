import { useEffect, useMemo, useState } from 'react';
import { searchCogitaInfos, type CogitaInfoSearchResult } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaInfoType, CogitaLibraryMode } from './types';
import { getInfoTypeLabel, getInfoTypeOptions } from './libraryOptions';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';
import { useNavigate } from 'react-router-dom';

type InfoSort = 'relevance' | 'label_asc' | 'label_desc' | 'type_asc' | 'type_desc';

const PAGE_SIZE = 60;
const SEARCH_LIMIT = 500;

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
  const navigate = useNavigate();
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const listCopy = copy.cogita.library.list;

  const [searchType, setSearchType] = useState<CogitaInfoType | 'any'>('any');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<InfoSort>('relevance');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [rawResults, setRawResults] = useState<CogitaInfoSearchResult[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedInfoId, setFocusedInfoId] = useState<string | null>(null);

  const infoTypeOptions = useMemo(() => getInfoTypeOptions(copy), [copy]);
  const sortOptions = useMemo(
    () => [
      { value: 'relevance' as const, label: listCopy.sortRelevance },
      { value: 'label_asc' as const, label: listCopy.sortLabelAsc },
      { value: 'label_desc' as const, label: listCopy.sortLabelDesc },
      { value: 'type_asc' as const, label: listCopy.sortTypeAsc },
      { value: 'type_desc' as const, label: listCopy.sortTypeDesc }
    ],
    [listCopy.sortLabelAsc, listCopy.sortLabelDesc, listCopy.sortRelevance, listCopy.sortTypeAsc, listCopy.sortTypeDesc]
  );

  useEffect(() => {
    setSearchStatus('loading');
    const handle = window.setTimeout(() => {
      searchCogitaInfos({
        libraryId,
        type: searchType === 'any' ? undefined : searchType,
        query: searchQuery.trim() || undefined,
        limit: SEARCH_LIMIT
      })
        .then((items) => {
          setRawResults(items);
          setSearchStatus('ready');
        })
        .catch(() => {
          setRawResults([]);
          setSearchStatus('ready');
        });
    }, 240);

    return () => window.clearTimeout(handle);
  }, [libraryId, searchQuery, searchType]);

  const sortedResults = useMemo(() => {
    const items = rawResults.slice();
    const typeLabel = (value: string) => getInfoTypeLabel(copy, value as CogitaInfoType | 'any' | 'vocab');
    if (sortBy === 'relevance') return items;
    if (sortBy === 'label_asc') {
      return items.sort((a, b) => a.label.localeCompare(b.label));
    }
    if (sortBy === 'label_desc') {
      return items.sort((a, b) => b.label.localeCompare(a.label));
    }
    if (sortBy === 'type_asc') {
      return items.sort((a, b) =>
        a.infoType === b.infoType ? a.label.localeCompare(b.label) : typeLabel(a.infoType).localeCompare(typeLabel(b.infoType))
      );
    }
    return items.sort((a, b) =>
      a.infoType === b.infoType ? a.label.localeCompare(b.label) : typeLabel(b.infoType).localeCompare(typeLabel(a.infoType))
    );
  }, [copy, rawResults, sortBy]);

  const visibleResults = useMemo(() => sortedResults.slice(0, visibleCount), [sortedResults, visibleCount]);
  const canLoadMore = visibleResults.length < sortedResults.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    const idSet = new Set(rawResults.map((item) => item.infoId));
    setSelectedIds((prev) => prev.filter((id) => idSet.has(id)));
    setFocusedInfoId((prev) => (prev && idSet.has(prev) ? prev : null));
  }, [rawResults]);

  const toggleSelection = (infoId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(infoId)) return prev;
        return [...prev, infoId];
      }
      return prev.filter((id) => id !== infoId);
    });
  };

  const openInfo = (infoId: string) => {
    navigate(`/cogita/library/${libraryId}/list?infoId=${encodeURIComponent(infoId)}&infoView=overview`, { replace: true });
  };

  const singleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedCountLabel = listCopy.selectionCount.replace('{count}', String(selectedIds.length));

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
      <section className="cogita-library-dashboard" data-mode={mode === 'collection' ? 'grid' : 'list'}>
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{listCopy.kicker}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{listCopy.subtitle}</p>
            <p className="cogita-library-hint">{listCopy.searchOnlyHint}</p>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-library-controls">
                  <div className="cogita-library-search">
                    <p className="cogita-user-kicker">{listCopy.searchTitle}</p>
                    <div className="cogita-search-field">
                      <select
                        aria-label={listCopy.typeLabel}
                        value={searchType}
                        onChange={(event) => setSearchType(event.target.value as CogitaInfoType | 'any')}
                      >
                        {infoTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={listCopy.searchPlaceholder}
                      />
                      <select aria-label={listCopy.sortLabel} value={sortBy} onChange={(event) => setSortBy(event.target.value as InfoSort)}>
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="cogita-card-count">
                  <span>
                    {listCopy.cardCount.replace('{shown}', String(visibleResults.length)).replace('{total}', String(sortedResults.length))}
                  </span>
                  <span>{searchStatus === 'loading' ? listCopy.loading : listCopy.ready}</span>
                </div>

                <div className="cogita-info-selection-bar">
                  <span>{selectedCountLabel}</span>
                  <div className="cogita-info-selection-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setSelectedIds(visibleResults.map((item) => item.infoId))}
                      disabled={visibleResults.length === 0}
                    >
                      {listCopy.selectAllVisible}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setSelectedIds([])}
                      disabled={selectedIds.length === 0}
                    >
                      {listCopy.clearSelection}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => singleSelectedId && openInfo(singleSelectedId)}
                      disabled={!singleSelectedId}
                      title={!singleSelectedId ? listCopy.openSelectedDisabled : undefined}
                    >
                      {listCopy.openSelected}
                    </button>
                  </div>
                </div>

                <div className="cogita-card-list" data-view="list">
                  {visibleResults.length ? (
                    visibleResults.map((result) => {
                      const infoTypeLabel = getInfoTypeLabel(copy, result.infoType as CogitaInfoType | 'any' | 'vocab');
                      const isChecked = selectedSet.has(result.infoId);
                      const isFocused = focusedInfoId === result.infoId;
                      return (
                        <article key={result.infoId} className="cogita-card-item" data-selected={isFocused || isChecked}>
                          <div className="cogita-info-result-row">
                            <label className="cogita-info-checkbox">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(event) => toggleSelection(result.infoId, event.target.checked)}
                              />
                              <span />
                            </label>
                            <button
                              type="button"
                              className="cogita-info-result-main"
                              onClick={() => setFocusedInfoId(result.infoId)}
                            >
                              <div className="cogita-card-type">{infoTypeLabel}</div>
                              <h3 className="cogita-card-title">{result.label}</h3>
                              <p className="cogita-card-subtitle">{result.infoId}</p>
                            </button>
                            <button type="button" className="ghost" onClick={() => openInfo(result.infoId)}>
                              {listCopy.editInfo}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{listCopy.noMatch}</p>
                    </div>
                  )}
                </div>

                {canLoadMore ? (
                  <div className="cogita-form-actions">
                    <button type="button" className="cta ghost" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
                      {listCopy.loadMore}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
