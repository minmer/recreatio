import { useEffect, useMemo, useState } from 'react';
import { searchCogitaEntities, type CogitaEntitySearchResult, type CogitaInfoSearchResult } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaInfoType, CogitaLibraryMode } from './types';
import { getInfoTypeLabel, getInfoTypeOptions } from './libraryOptions';
import { getInfoSchema, resolveSchemaFieldOptions, type InfoFilterLabelKey } from './infoSchemas';
import { useNavigate } from 'react-router-dom';

type InfoSort = 'relevance' | 'label_asc' | 'label_desc' | 'type_asc' | 'type_desc';
type ResultView = 'details' | 'wide' | 'grid';
type SelectedInfoStackItem = { infoId: string; infoType: string; label: string };

const PAGE_SIZE = 60;
const SEARCH_LIMIT = 500;

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
  const [sortBy, setSortBy] = useState<InfoSort>('relevance');
  const [viewMode, setViewMode] = useState<ResultView>('details');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [rawResults, setRawResults] = useState<CogitaInfoSearchResult[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [focusedInfoId, setFocusedInfoId] = useState<string | null>(null);
  const [selectionStack, setSelectionStack] = useState<Record<string, SelectedInfoStackItem>>(() => loadSelectionStack(libraryId));
  const [typeFilters, setTypeFilters] = useState<Record<string, string>>({});
  const [languages, setLanguages] = useState<CogitaInfoSearchResult[]>([]);

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
    setTypeFilters({});
    setShowAdvancedFilters(false);
  }, [libraryId]);

  useEffect(() => {
    searchCogitaEntities({
      libraryId,
      type: 'language',
      filters: { sourceKind: 'info' },
      limit: 200
    })
      .then((items) => {
        const mapped = items
          .map((item) => ({
            infoId: item.infoId ?? '',
            infoType: item.entityType,
            label: item.title
          }))
          .filter((item) => item.infoId.length > 0);
        setLanguages(mapped);
      })
      .catch(() => setLanguages([]));
  }, [libraryId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(getSelectionStorageKey(libraryId), JSON.stringify(selectionStack));
  }, [libraryId, selectionStack]);

  const schema = useMemo(() => getInfoSchema(searchType === 'any' ? null : searchType), [searchType]);
  const filterLabelByKey = useMemo<Record<InfoFilterLabelKey, string>>(
    () => ({
      language: listCopy.typeFilterLanguage,
      languageA: listCopy.typeFilterLanguageA,
      languageB: listCopy.typeFilterLanguageB,
      originalLanguage: listCopy.typeFilterOriginalLanguage,
      doi: listCopy.typeFilterDoi,
      sourceKind: listCopy.typeFilterSourceKind,
      locator: listCopy.typeFilterLocator,
      quote: listCopy.typeFilterQuote
    }),
    [
      listCopy.typeFilterDoi,
      listCopy.typeFilterLanguage,
      listCopy.typeFilterLanguageA,
      listCopy.typeFilterLanguageB,
      listCopy.typeFilterLocator,
      listCopy.typeFilterOriginalLanguage,
      listCopy.typeFilterQuote,
      listCopy.typeFilterSourceKind
    ]
  );

  const typeFilterConfig = useMemo(
    () =>
      schema.filterFields.map((field) => ({
        ...field,
        label: field.labelKey ? filterLabelByKey[field.labelKey] : field.label ?? field.key,
        options: resolveSchemaFieldOptions(field, { languages })
      })),
    [filterLabelByKey, languages, schema.filterFields]
  );

  const hasActiveTypeFilters = useMemo(
    () => typeFilterConfig.some((field) => (typeFilters[field.key] ?? '').trim().length > 0),
    [typeFilterConfig, typeFilters]
  );

  useEffect(() => {
    setTypeFilters({});
  }, [searchType]);

  useEffect(() => {
    const filterPayload: Record<string, string> = { sourceKind: 'info' };
    if (hasActiveTypeFilters) {
      for (const field of typeFilterConfig) {
        const value = (typeFilters[field.key] ?? '').trim();
        if (!value) continue;
        filterPayload[field.path ?? field.key] = value;
      }
    }

    setSearchStatus('loading');
    const handle = window.setTimeout(() => {
      searchCogitaEntities({
        libraryId,
        type: searchType === 'any' ? undefined : searchType,
        query: searchQuery.trim() || undefined,
        filters: filterPayload,
        limit: SEARCH_LIMIT
      })
        .then((items) => {
          const mapped = items
            .map((item: CogitaEntitySearchResult) => ({
              infoId: item.infoId ?? '',
              infoType: item.entityType,
              label: item.title
            }))
            .filter((item) => item.infoId.length > 0);
          setRawResults(mapped);
          setSearchStatus('ready');
        })
        .catch(() => {
          setRawResults([]);
          setSearchStatus('ready');
        });
    }, 240);

    return () => window.clearTimeout(handle);
  }, [hasActiveTypeFilters, libraryId, searchQuery, searchType, typeFilterConfig, typeFilters]);

  const sortedResults = useMemo(() => {
    const items = rawResults.slice();
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
  }, [copy, rawResults, sortBy]);

  const visibleResults = useMemo(() => sortedResults.slice(0, visibleCount), [sortedResults, visibleCount]);
  const canLoadMore = visibleResults.length < sortedResults.length;
  const selectedIdSet = useMemo(() => new Set(Object.keys(selectionStack)), [selectionStack]);
  const selectedItems = useMemo(() => Object.values(selectionStack), [selectionStack]);
  const selectedByType = useMemo(() => {
    const bucket = new Map<string, number>();
    for (const item of selectedItems) {
      bucket.set(item.infoType, (bucket.get(item.infoType) ?? 0) + 1);
    }
    return Array.from(bucket.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [selectedItems]);

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
            <section className="cogita-library-search-surface">
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
                <span>{listCopy.cardCount.replace('{shown}', String(visibleResults.length)).replace('{total}', String(sortedResults.length))}</span>
                <span>{searchStatus === 'loading' ? listCopy.loading : listCopy.ready}</span>
              </div>

              <div className="cogita-filters-toggle-row">
                <button
                  type="button"
                  className="ghost cogita-filters-toggle"
                  onClick={() => setShowAdvancedFilters((open) => !open)}
                >
                  {showAdvancedFilters ? listCopy.hideFilters : listCopy.showFilters}
                </button>
                <span className="cogita-sidebar-note">{listCopy.filtersOptionalHint}</span>
              </div>
              {showAdvancedFilters && typeFilterConfig.length > 0 ? (
                <section className="cogita-library-filters cogita-library-filters--compact">
                  <div className="cogita-filter-grid">
                    {typeFilterConfig.map((field) => (
                      <label key={`type-filter:${field.key}`} className="cogita-field">
                        <span>{field.label}</span>
                        {field.kind === 'select' ? (
                          <select value={typeFilters[field.key] ?? ''} onChange={(event) => setTypeFilters((prev) => ({ ...prev, [field.key]: event.target.value }))}>
                            <option value="">{copy.cogita.library.filters.clear}</option>
                            {(field.options ?? []).map((option) => (
                              <option key={`${field.key}:${option.value}`} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" value={typeFilters[field.key] ?? ''} onChange={(event) => setTypeFilters((prev) => ({ ...prev, [field.key]: event.target.value }))} />
                        )}
                      </label>
                    ))}
                  </div>
                </section>
              ) : null}

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
                  <button type="button" className="ghost" onClick={() => setSelectionStack({})} disabled={selectedItems.length === 0}>
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

              {selectedItems.length > 0 ? (
                <section className="cogita-selection-stack">
                  <p className="cogita-user-kicker">{listCopy.selectedStackTitle}</p>
                  <p className="cogita-library-hint">{listCopy.selectedStackHint}</p>
                  <div className="cogita-selection-overview">
                    {selectedByType.map(([infoType, count]) => (
                      <span key={`stack:type:${infoType}`} className="cogita-tag-chip">
                        <span>{getInfoTypeLabel(copy, infoType as CogitaInfoType | 'any' | 'vocab')}</span>
                        <span className="cogita-tag-count">{count}</span>
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {effectiveView === 'details' ? (
                <div className="cogita-details-grid" role="table" aria-label={listCopy.searchTitle}>
                  <div className="cogita-details-grid-head" role="row">
                    <span />
                    <span>{listCopy.detailColumnName}</span>
                    <span>{listCopy.detailColumnType}</span>
                    <span>{listCopy.detailColumnId}</span>
                    <span />
                  </div>
                  {visibleResults.length ? (
                    visibleResults.map((result) => {
                      const infoTypeLabel = getInfoTypeLabel(copy, result.infoType as CogitaInfoType | 'any' | 'vocab');
                      const isChecked = selectedIdSet.has(result.infoId);
                      const isFocused = focusedInfoId === result.infoId;
                      return (
                        <div
                          key={result.infoId}
                          className={`cogita-details-row ${isFocused || isChecked ? 'active' : ''}`}
                          role="row"
                          onClick={() => setFocusedInfoId(result.infoId)}
                        >
                          <label className="cogita-info-checkbox">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => toggleSelection(result, event.target.checked)}
                              onClick={(event) => event.stopPropagation()}
                            />
                            <span />
                          </label>
                          <span title={result.label}>{result.label}</span>
                          <span title={infoTypeLabel}>{infoTypeLabel}</span>
                          <span title={result.infoId}>{result.infoId}</span>
                          <button
                            type="button"
                            className="ghost cogita-details-open"
                            onClick={(event) => {
                              event.stopPropagation();
                              openInfo(result.infoId);
                            }}
                            aria-label={listCopy.editInfo}
                          >
                            {'>'}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{listCopy.noMatch}</p>
                    </div>
                  )}
                </div>
              ) : (
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
                            <button type="button" className="cogita-info-result-main" onClick={() => setFocusedInfoId(result.infoId)}>
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
              )}

              {canLoadMore ? (
                <div className="cogita-form-actions">
                  <button type="button" className="cta ghost" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
                    {listCopy.loadMore}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
