import { useEffect, useMemo, useState } from 'react';
import { searchCogitaInfos, type CogitaInfoSearchResult } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaInfoType, CogitaLibraryMode } from './types';
import { getInfoTypeLabel, getInfoTypeOptions } from './libraryOptions';
import { useNavigate } from 'react-router-dom';

type InfoSort = 'relevance' | 'label_asc' | 'label_desc' | 'type_asc' | 'type_desc';
type ResultView = 'details' | 'wide' | 'grid';
type SelectedInfoStackItem = { infoId: string; infoType: string; label: string };

const PAGE_SIZE = 60;
const SEARCH_LIMIT = 500;

const typeConstraintRegistry: Partial<Record<CogitaInfoType, (item: CogitaInfoSearchResult, normalizedValue: string) => boolean>> = {
  computed: (item, normalizedValue) => {
    if (!normalizedValue) return true;
    return item.label.toLowerCase().includes(normalizedValue) || item.label.includes(`{${normalizedValue}}`);
  }
};

function getSelectionStorageKey(libraryId: string) {
  return `cogita.info-selection:${libraryId}`;
}

function loadSelectionStack(libraryId: string): Record<string, SelectedInfoStackItem> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(getSelectionStorageKey(libraryId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, SelectedInfoStackItem>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

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
  const listCopy = copy.cogita.library.list;

  const [searchType, setSearchType] = useState<CogitaInfoType | 'any'>('any');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeConstraint, setTypeConstraint] = useState('');
  const [sortBy, setSortBy] = useState<InfoSort>('relevance');
  const [viewMode, setViewMode] = useState<ResultView>('details');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [rawResults, setRawResults] = useState<CogitaInfoSearchResult[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [focusedInfoId, setFocusedInfoId] = useState<string | null>(null);
  const [selectionStack, setSelectionStack] = useState<Record<string, SelectedInfoStackItem>>(() => loadSelectionStack(libraryId));

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
    setSelectionStack(loadSelectionStack(libraryId));
  }, [libraryId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(getSelectionStorageKey(libraryId), JSON.stringify(selectionStack));
  }, [libraryId, selectionStack]);

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

  const normalizedTypeConstraint = typeConstraint.trim().toLowerCase();
  const constrainedResults = useMemo(() => {
    if (searchType === 'any' || !normalizedTypeConstraint) return rawResults;
    const customMatcher = typeConstraintRegistry[searchType];
    if (customMatcher) {
      return rawResults.filter((item) => customMatcher(item, normalizedTypeConstraint));
    }
    return rawResults.filter((item) => item.label.toLowerCase().includes(normalizedTypeConstraint));
  }, [normalizedTypeConstraint, rawResults, searchType]);

  const sortedResults = useMemo(() => {
    const items = constrainedResults.slice();
    const typeLabel = (value: string) => getInfoTypeLabel(copy, value as CogitaInfoType | 'any' | 'vocab');
    if (sortBy === 'relevance') return items;
    if (sortBy === 'label_asc') return items.sort((a, b) => a.label.localeCompare(b.label));
    if (sortBy === 'label_desc') return items.sort((a, b) => b.label.localeCompare(a.label));
    if (sortBy === 'type_asc') {
      return items.sort((a, b) =>
        a.infoType === b.infoType ? a.label.localeCompare(b.label) : typeLabel(a.infoType).localeCompare(typeLabel(b.infoType))
      );
    }
    return items.sort((a, b) =>
      a.infoType === b.infoType ? a.label.localeCompare(b.label) : typeLabel(b.infoType).localeCompare(typeLabel(a.infoType))
    );
  }, [constrainedResults, copy, sortBy]);

  const visibleResults = useMemo(() => sortedResults.slice(0, visibleCount), [sortedResults, visibleCount]);
  const canLoadMore = visibleResults.length < sortedResults.length;
  const selectedIdSet = useMemo(() => new Set(Object.keys(selectionStack)), [selectionStack]);
  const selectedItems = useMemo(() => Object.values(selectionStack), [selectionStack]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    const idSet = new Set(rawResults.map((item) => item.infoId));
    setFocusedInfoId((prev) => (prev && idSet.has(prev) ? prev : null));
  }, [rawResults]);

  const upsertSelection = (item: CogitaInfoSearchResult) => {
    setSelectionStack((prev) => ({
      ...prev,
      [item.infoId]: {
        infoId: item.infoId,
        infoType: item.infoType,
        label: item.label
      }
    }));
  };

  const removeSelection = (infoId: string) => {
    setSelectionStack((prev) => {
      if (!prev[infoId]) return prev;
      const next = { ...prev };
      delete next[infoId];
      return next;
    });
  };

  const toggleSelection = (item: CogitaInfoSearchResult, checked: boolean) => {
    if (checked) {
      upsertSelection(item);
      return;
    }
    removeSelection(item.infoId);
  };

  const openInfo = (infoId: string) => {
    navigate(`/cogita/library/${libraryId}/list?infoId=${encodeURIComponent(infoId)}&infoView=overview`, { replace: true });
  };

  const singleSelectedId = selectedItems.length === 1 ? selectedItems[0]?.infoId ?? null : null;
  const selectedCountLabel = listCopy.selectionCount.replace('{count}', String(selectedItems.length));

  const effectiveView: ResultView = mode === 'collection' ? 'grid' : mode === 'detail' ? 'wide' : viewMode;

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
      <section className="cogita-library-dashboard" data-mode={effectiveView}>
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <article className="cogita-library-pane cogita-library-pane--full">
              <div className="cogita-library-controls">
                <div className="cogita-library-search">
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
                    {searchType !== 'any' ? (
                      <input
                        type="text"
                        value={typeConstraint}
                        onChange={(event) => setTypeConstraint(event.target.value)}
                        placeholder={`${listCopy.constraintPlaceholder} (${getInfoTypeLabel(copy, searchType)})`}
                        aria-label={listCopy.constraintLabel}
                      />
                    ) : null}
                    <select aria-label={listCopy.sortLabel} value={sortBy} onChange={(event) => setSortBy(event.target.value as InfoSort)}>
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select aria-label={listCopy.viewLabel} value={viewMode} onChange={(event) => setViewMode(event.target.value as ResultView)}>
                      <option value="details">{listCopy.viewDetails}</option>
                      <option value="wide">{listCopy.viewWide}</option>
                      <option value="grid">{listCopy.viewGrid}</option>
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
                    onClick={() => {
                      setSelectionStack((prev) => {
                        const next = { ...prev };
                        for (const item of visibleResults) {
                          next[item.infoId] = { infoId: item.infoId, infoType: item.infoType, label: item.label };
                        }
                        return next;
                      });
                    }}
                    disabled={visibleResults.length === 0}
                  >
                    {listCopy.selectAllVisible}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setSelectionStack({})}
                    disabled={selectedItems.length === 0}
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

              <section className="cogita-selection-stack">
                <p className="cogita-user-kicker">{listCopy.selectedStackTitle}</p>
                <p className="cogita-library-hint">{listCopy.selectedStackHint}</p>
                <div className="cogita-selection-stack-items">
                  {selectedItems.length ? (
                    selectedItems.map((item) => (
                      <div key={`stack:${item.infoId}`} className="cogita-selection-stack-item">
                        <button type="button" className="cogita-tag-chip" onClick={() => openInfo(item.infoId)}>
                          <span>{item.label}</span>
                          <span className="cogita-tag-count">{getInfoTypeLabel(copy, item.infoType as CogitaInfoType | 'any' | 'vocab')}</span>
                        </button>
                        <button
                          type="button"
                          className="ghost cogita-selection-remove"
                          onClick={() => removeSelection(item.infoId)}
                          aria-label={listCopy.removeFromStack}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="cogita-tag-empty">{listCopy.selectedEmpty}</p>
                  )}
                </div>
              </section>

              <div className={`cogita-card-list cogita-card-list--${effectiveView}`} data-view={effectiveView}>
                {visibleResults.length ? (
                  visibleResults.map((result) => {
                    const infoTypeLabel = getInfoTypeLabel(copy, result.infoType as CogitaInfoType | 'any' | 'vocab');
                    const isChecked = selectedIdSet.has(result.infoId);
                    const isFocused = focusedInfoId === result.infoId;
                    return (
                      <article key={result.infoId} className="cogita-card-item" data-selected={isFocused || isChecked}>
                        <div className="cogita-info-result-row">
                          <label className="cogita-info-checkbox">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => toggleSelection(result, event.target.checked)}
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
            </article>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
