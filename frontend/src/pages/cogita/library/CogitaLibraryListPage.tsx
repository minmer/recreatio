import { useEffect, useMemo, useState } from 'react';
import {
  getCogitaApproachSpecifications,
  getCogitaInfoCheckcardDependencies,
  getCogitaInfoCheckcards,
  getCogitaInfoCollections,
  getCogitaInfoDetail,
  getCogitaInfoApproachProjection,
  getCogitaItemDependencies,
  getCogitaReviewSummary,
  searchCogitaEntities,
  type CogitaInfoApproachProjection,
  type CogitaInfoApproachSpecification,
  type CogitaEntitySearchResult,
  type CogitaInfoSearchResult,
  type CogitaCardSearchBundle,
  type CogitaItemDependencyBundle,
  type CogitaReviewSummary
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaInfoType, CogitaLibraryMode } from './types';
import { getInfoTypeLabel, getInfoTypeOptions } from './libraryOptions';
import { getInfoSchema, resolveSchemaFieldOptions, type InfoFilterLabelKey } from './infoSchemas';
import { useLocation, useNavigate } from 'react-router-dom';
import { saveInfoSelectionRevisionSeed } from '../../../cogita/revision/scope';
import { saveCollectionDraftFromInfos } from '../../../cogita/collections/draft';

type InfoSort = 'relevance' | 'label_asc' | 'label_desc' | 'type_asc' | 'type_desc';
type ResultView = 'details' | 'wide' | 'grid';
type SelectedInfoStackItem = { infoId: string; infoType: string; label: string };
type InfoDetailState = { infoId: string; infoType: string; payload: unknown; links?: Record<string, string | string[] | null> | null };

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
  const location = useLocation();
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
  const [referenceSources, setReferenceSources] = useState<CogitaInfoSearchResult[]>([]);
  const [selectedInfoDetail, setSelectedInfoDetail] = useState<InfoDetailState | null>(null);
  const [selectedInfoReviewSummary, setSelectedInfoReviewSummary] = useState<CogitaReviewSummary | null>(null);
  const [dependenciesBundle, setDependenciesBundle] = useState<CogitaItemDependencyBundle | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [approachSpecs, setApproachSpecs] = useState<CogitaInfoApproachSpecification[]>([]);
  const [selectedApproachKey, setSelectedApproachKey] = useState<string>('');
  const [approachProjection, setApproachProjection] = useState<CogitaInfoApproachProjection | null>(null);
  const [approachStatus, setApproachStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [infoCheckcards, setInfoCheckcards] = useState<CogitaCardSearchBundle | null>(null);
  const [infoCheckcardDependencies, setInfoCheckcardDependencies] = useState<CogitaItemDependencyBundle | null>(null);
  const [checkcardsStatus, setCheckcardsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [infoCollections, setInfoCollections] = useState<Array<{ collectionId: string; name: string; notes?: string | null; itemCount: number }>>([]);
  const [infoCollectionsStatus, setInfoCollectionsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

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
    getCogitaItemDependencies({ libraryId })
      .then((bundle) => setDependenciesBundle(bundle))
      .catch(() => setDependenciesBundle({ items: [] }));
  }, [libraryId]);

  useEffect(() => {
    getCogitaApproachSpecifications({ libraryId })
      .then((specs) => setApproachSpecs(specs))
      .catch(() => setApproachSpecs([]));
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
    searchCogitaEntities({
      libraryId,
      type: 'source',
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
        setReferenceSources(mapped);
      })
      .catch(() => setReferenceSources([]));
  }, [libraryId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(getSelectionStorageKey(libraryId), JSON.stringify(selectionStack));
  }, [libraryId, selectionStack]);

  const schema = useMemo(() => getInfoSchema(searchType === 'any' ? null : searchType), [searchType]);
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pathSegments = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname]);
  const infoPathIndex = pathSegments.findIndex((segment) => segment === 'infos');
  const selectedInfoIdFromPath = infoPathIndex >= 0 ? (pathSegments[infoPathIndex + 1] ?? '').trim() || null : null;
  const selectedInfoPathTail = infoPathIndex >= 0 ? ((pathSegments[infoPathIndex + 2] ?? '').trim()) : '';
  const selectedInfoViewFromPath = infoPathIndex >= 0 ? (selectedInfoPathTail === 'checkcards' ? 'cards' : selectedInfoPathTail === 'collections' ? 'collections' : 'overview') : '';
  const selectedInfoIdFromRoute = selectedInfoIdFromPath ?? ((queryParams.get('infoId') ?? '').trim() || null);
  const selectedInfoView = selectedInfoIdFromPath ? selectedInfoViewFromPath : (queryParams.get('infoView') ?? 'overview').trim();
  const isInfoOverviewRoute = selectedInfoView === 'overview' && Boolean(selectedInfoIdFromRoute);
  const isInfoCollectionsRoute = selectedInfoView === 'collections' && Boolean(selectedInfoIdFromRoute);
  const filterLabelByKey = useMemo<Record<InfoFilterLabelKey, string>>(
    () => ({
      language: listCopy.typeFilterLanguage,
      languageA: listCopy.typeFilterLanguageA,
      languageB: listCopy.typeFilterLanguageB,
      originalLanguage: listCopy.typeFilterOriginalLanguage,
      doi: listCopy.typeFilterDoi,
      sourceKind: listCopy.typeFilterSourceKind,
      locator: listCopy.typeFilterLocator,
      citationText: listCopy.typeFilterCitationText
    }),
    [
      listCopy.typeFilterDoi,
      listCopy.typeFilterLanguage,
      listCopy.typeFilterLanguageA,
      listCopy.typeFilterLanguageB,
      listCopy.typeFilterLocator,
      listCopy.typeFilterOriginalLanguage,
      listCopy.typeFilterCitationText,
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
    const referenceId = (typeFilters.__referenceId ?? '').trim();
    if (referenceId) {
      filterPayload['link.references'] = referenceId;
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

  useEffect(() => {
    if (!selectedInfoIdFromRoute || (selectedInfoView !== 'overview' && selectedInfoView !== 'collections')) {
      setSelectedInfoDetail(null);
      setSelectedInfoReviewSummary(null);
      setOverviewStatus('idle');
      return;
    }
    let cancelled = false;
    setOverviewStatus('loading');
    Promise.all([
      getCogitaInfoDetail({ libraryId, infoId: selectedInfoIdFromRoute }),
      getCogitaReviewSummary({ libraryId, itemType: 'info', itemId: selectedInfoIdFromRoute }).catch(() => null)
    ])
      .then(([detail, summary]) => {
        if (cancelled) return;
        setSelectedInfoDetail(detail);
        setSelectedInfoReviewSummary(summary);
        setOverviewStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedInfoDetail(null);
        setSelectedInfoReviewSummary(null);
        setOverviewStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId, selectedInfoIdFromRoute, selectedInfoView]);

  useEffect(() => {
    if (!selectedInfoIdFromRoute || selectedInfoView !== 'collections') {
      setInfoCollections([]);
      setInfoCollectionsStatus('idle');
      return;
    }
    let cancelled = false;
    setInfoCollectionsStatus('loading');
    getCogitaInfoCollections({ libraryId, infoId: selectedInfoIdFromRoute })
      .then((items) => {
        if (cancelled) return;
        setInfoCollections(items);
        setInfoCollectionsStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setInfoCollections([]);
        setInfoCollectionsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId, selectedInfoIdFromRoute, selectedInfoView]);

  useEffect(() => {
    if (!selectedInfoIdFromRoute || selectedInfoView !== 'overview') {
      setInfoCheckcards(null);
      setInfoCheckcardDependencies(null);
      setCheckcardsStatus('idle');
      return;
    }
    let cancelled = false;
    setCheckcardsStatus('loading');
    Promise.all([
      getCogitaInfoCheckcards({ libraryId, infoId: selectedInfoIdFromRoute }),
      getCogitaInfoCheckcardDependencies({ libraryId, infoId: selectedInfoIdFromRoute })
    ])
      .then(([cards, deps]) => {
        if (cancelled) return;
        setInfoCheckcards(cards);
        setInfoCheckcardDependencies(deps);
        setCheckcardsStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setInfoCheckcards(null);
        setInfoCheckcardDependencies(null);
        setCheckcardsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId, selectedInfoIdFromRoute, selectedInfoView]);

  const availableApproaches = useMemo(
    () =>
      selectedInfoDetail
        ? approachSpecs.filter((spec) => spec.sourceInfoTypes.some((type) => type.toLowerCase() === selectedInfoDetail.infoType.toLowerCase()))
        : [],
    [approachSpecs, selectedInfoDetail]
  );

  useEffect(() => {
    if (!selectedInfoDetail) {
      setSelectedApproachKey('');
      return;
    }

    setSelectedApproachKey((prev) => {
      if (prev && availableApproaches.some((item) => item.approachKey === prev)) return prev;
      return availableApproaches[0]?.approachKey ?? '';
    });
  }, [availableApproaches, selectedInfoDetail]);

  useEffect(() => {
    if (!selectedInfoDetail || !selectedApproachKey) {
      setApproachProjection(null);
      setApproachStatus('idle');
      return;
    }

    let cancelled = false;
    setApproachStatus('loading');
    getCogitaInfoApproachProjection({
      libraryId,
      infoId: selectedInfoDetail.infoId,
      approachKey: selectedApproachKey
    })
      .then((response) => {
        if (cancelled) return;
        setApproachProjection(response);
        setApproachStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setApproachProjection(null);
        setApproachStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [libraryId, selectedApproachKey, selectedInfoDetail]);

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
  const linkedCheckingCardsCount = useMemo(() => {
    if (!selectedInfoIdFromRoute || !dependenciesBundle) return 0;
    const keys = new Set<string>();
    for (const item of dependenciesBundle.items) {
      if (item.childItemType !== 'info' || item.childItemId !== selectedInfoIdFromRoute) continue;
      keys.add(
        [
          item.parentItemType,
          item.parentItemId,
          item.parentCheckType ?? '',
          item.parentDirection ?? ''
        ].join('|')
      );
    }
    return keys.size;
  }, [dependenciesBundle, selectedInfoIdFromRoute]);

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
    navigate(`/cogita/library/${libraryId}/infos/${encodeURIComponent(infoId)}`, { replace: true });
  };

  const closeInfoOverview = () => {
    navigate(`/cogita/library/${libraryId}/list`, { replace: true });
  };

  const editSelectedInfo = () => {
    if (!selectedInfoIdFromRoute) return;
    navigate(`/cogita/library/${libraryId}/edit/${encodeURIComponent(selectedInfoIdFromRoute)}`, { replace: true });
  };

  const startRevisionFromSelectedInfos = () => {
    const seedId = saveInfoSelectionRevisionSeed(
      libraryId,
      selectedItems.map((item) => item.infoId)
    );
    if (!seedId) return;
    navigate(
      `/cogita/library/${libraryId}/revision/run?libraryTarget=revisions&scope=info-selection&seed=${encodeURIComponent(seedId)}`
    );
  };
  const startCollectionFromSelectedInfos = () => {
    const seedId = saveCollectionDraftFromInfos(
      libraryId,
      selectedItems.map((item) => item.infoId)
    );
    if (!seedId) return;
    navigate(`/cogita/library/${libraryId}/collections/new?draft=${encodeURIComponent(seedId)}&draftType=info-selection`);
  };

  const singleSelectedId = selectedItems.length === 1 ? selectedItems[0]?.infoId ?? null : null;
  const selectedCountLabel = listCopy.selectionCount.replace('{count}', String(selectedItems.length));

  const effectiveView: ResultView = mode === 'collection' ? 'grid' : mode === 'detail' ? 'wide' : viewMode;
  const infoOverviewCopy = getInfoOverviewCopy(language);
  const selectedInfoKnownnessPercent = selectedInfoReviewSummary
    ? Math.max(0, Math.min(100, Math.round((selectedInfoReviewSummary.score ?? 0) * 100)))
    : 0;
  const knownnessDevelopmentLabel = selectedInfoReviewSummary
    ? describeKnownnessDevelopment(selectedInfoReviewSummary, infoOverviewCopy)
    : infoOverviewCopy.noKnownnessData;

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
            {isInfoOverviewRoute ? (
              <section className="cogita-library-search-surface">
                <section className="cogita-info-overview">
                  <div className="cogita-info-overview-head">
                    <div>
                      <p className="cogita-user-kicker">{infoOverviewCopy.kicker}</p>
                      <h2 className="cogita-card-title">
                        {selectedInfoDetail ? resolveInfoTitle(selectedInfoDetail.payload, selectedInfoDetail.infoType, selectedInfoDetail.infoId) : infoOverviewCopy.loading}
                      </h2>
                      {selectedInfoDetail ? (
                        <p className="cogita-card-subtitle">
                          {getInfoTypeLabel(copy, selectedInfoDetail.infoType as CogitaInfoType | 'any' | 'vocab')} · {selectedInfoDetail.infoId}
                        </p>
                      ) : null}
                    </div>
                    <div className="cogita-info-overview-actions">
                      <button type="button" className="ghost" onClick={closeInfoOverview}>
                        {infoOverviewCopy.backToSearch}
                      </button>
                      <button type="button" className="cta" onClick={editSelectedInfo} disabled={!selectedInfoIdFromRoute || overviewStatus !== 'ready'}>
                        {listCopy.editInfo}
                      </button>
                    </div>
                  </div>

                  {overviewStatus === 'loading' ? (
                    <div className="cogita-card-empty">
                      <p>{infoOverviewCopy.loading}</p>
                    </div>
                  ) : overviewStatus === 'error' ? (
                    <div className="cogita-card-empty">
                      <p>{infoOverviewCopy.loadError}</p>
                    </div>
                  ) : selectedInfoDetail ? (
                    <>
                      <div className="cogita-info-overview-metrics">
                        <article className="cogita-info-metric-card">
                          <p className="cogita-user-kicker">{infoOverviewCopy.knownness}</p>
                          <div className="cogita-info-metric-value">{selectedInfoKnownnessPercent}%</div>
                          <div className="cogita-info-progress" aria-hidden="true">
                            <span style={{ width: `${selectedInfoKnownnessPercent}%` }} />
                          </div>
                          <p className="cogita-library-hint">{knownnessDevelopmentLabel}</p>
                        </article>
                        <article className="cogita-info-metric-card">
                          <p className="cogita-user-kicker">{infoOverviewCopy.reviews}</p>
                          <div className="cogita-info-metric-value">{selectedInfoReviewSummary?.totalReviews ?? 0}</div>
                          <p className="cogita-library-hint">
                            {infoOverviewCopy.correct
                              .replace('{correct}', String(selectedInfoReviewSummary?.correctReviews ?? 0))
                              .replace('{total}', String(selectedInfoReviewSummary?.totalReviews ?? 0))}
                          </p>
                          <p className="cogita-library-hint">
                            {selectedInfoReviewSummary?.lastReviewedUtc
                              ? `${infoOverviewCopy.lastReview}: ${formatDateTime(selectedInfoReviewSummary.lastReviewedUtc, language)}`
                              : infoOverviewCopy.noLastReview}
                          </p>
                        </article>
                        <article className="cogita-info-metric-card">
                          <p className="cogita-user-kicker">{infoOverviewCopy.linkedCards}</p>
                          <div className="cogita-info-metric-value">{linkedCheckingCardsCount}</div>
                          <p className="cogita-library-hint">{infoOverviewCopy.linkedCardsHint}</p>
                        </article>
                      </div>

                      <div className="cogita-info-overview-panels">
                        <section className="cogita-info-overview-panel">
                          <h3>{infoOverviewCopy.checkcards}</h3>
                          {checkcardsStatus === 'loading' ? (
                            <p className="cogita-library-hint">{infoOverviewCopy.loadingCheckcards}</p>
                          ) : checkcardsStatus === 'error' ? (
                            <p className="cogita-library-hint">{infoOverviewCopy.loadCheckcardsError}</p>
                          ) : (
                            <div className="cogita-info-tree">
                              <div className="cogita-info-tree-row">
                                <div className="cogita-info-tree-key">{infoOverviewCopy.checkcardCount}</div>
                                <div className="cogita-info-tree-value">{infoCheckcards?.items.length ?? 0}</div>
                              </div>
                              <div className="cogita-info-tree-row">
                                <div className="cogita-info-tree-key">{infoOverviewCopy.dependencyCount}</div>
                                <div className="cogita-info-tree-value">{infoCheckcardDependencies?.items.length ?? 0}</div>
                              </div>
                            </div>
                          )}
                        </section>
                        {availableApproaches.length > 0 ? (
                          <section className="cogita-info-overview-panel">
                            <div className="cogita-info-approach-header">
                              <h3>{infoOverviewCopy.approach}</h3>
                              <select
                                value={selectedApproachKey}
                                onChange={(event) => setSelectedApproachKey(event.target.value)}
                                aria-label={infoOverviewCopy.approach}
                              >
                                {availableApproaches.map((item) => (
                                  <option key={item.approachKey} value={item.approachKey}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {approachStatus === 'loading' ? (
                              <p className="cogita-library-hint">{infoOverviewCopy.loadingApproach}</p>
                            ) : approachStatus === 'error' ? (
                              <p className="cogita-library-hint">{infoOverviewCopy.loadApproachError}</p>
                            ) : approachProjection ? (
                              <InfoValueTree value={approachProjection.projection} emptyLabel={infoOverviewCopy.empty} />
                            ) : (
                              <p className="cogita-library-hint">{infoOverviewCopy.noApproachData}</p>
                            )}
                          </section>
                        ) : null}
                        <section className="cogita-info-overview-panel">
                          <h3>{infoOverviewCopy.payload}</h3>
                          <InfoValueTree value={selectedInfoDetail.payload} emptyLabel={infoOverviewCopy.empty} />
                        </section>
                        <section className="cogita-info-overview-panel">
                          <h3>{infoOverviewCopy.links}</h3>
                          <InfoLinksView links={selectedInfoDetail.links} emptyLabel={infoOverviewCopy.noLinks} />
                        </section>
                      </div>
                    </>
                  ) : null}
                </section>
              </section>
            ) : null}
            {isInfoCollectionsRoute ? (
              <section className="cogita-library-search-surface">
                <section className="cogita-info-overview">
                  <div className="cogita-info-overview-head">
                    <div>
                      <p className="cogita-user-kicker">Informacja</p>
                      <h2 className="cogita-card-title">{selectedInfoDetail ? resolveInfoTitle(selectedInfoDetail.payload, selectedInfoDetail.infoType, selectedInfoDetail.infoId) : (selectedInfoIdFromRoute ?? '')}</h2>
                      <p className="cogita-card-subtitle">Collections using this info</p>
                    </div>
                    <div className="cogita-info-overview-actions">
                      <button type="button" className="ghost" onClick={closeInfoOverview}>Back to search</button>
                    </div>
                  </div>
                  {infoCollectionsStatus === 'loading' ? <div className="cogita-card-empty"><p>Loading collections...</p></div> : null}
                  {infoCollectionsStatus === 'error' ? <div className="cogita-card-empty"><p>Failed to load collections.</p></div> : null}
                  {infoCollectionsStatus === 'ready' && infoCollections.length === 0 ? (
                    <div className="cogita-card-empty"><p>This info is not used in any collection yet.</p></div>
                  ) : null}
                  {infoCollectionsStatus === 'ready' && infoCollections.length > 0 ? (
                    <div className="cogita-card-list" data-view="list">
                      {infoCollections.map((collection) => (
                        <article key={collection.collectionId} className="cogita-card-item">
                          <a className="cogita-card-select" href={`/#/cogita/library/${libraryId}/collections/${collection.collectionId}?libraryTarget=collections`}>
                            <div className="cogita-card-type">Collection</div>
                            <h3 className="cogita-card-title">{collection.name}</h3>
                            <p className="cogita-card-subtitle">{collection.itemCount} items</p>
                          </a>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              </section>
            ) : null}

            {!isInfoOverviewRoute && !isInfoCollectionsRoute ? (
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
              {showAdvancedFilters ? (
                <section className="cogita-library-filters cogita-library-filters--compact">
                  <div className="cogita-filter-grid">
                    <label className="cogita-field">
                      <span>{listCopy.typeLabel}</span>
                      <select value={searchType} onChange={(event) => setSearchType(event.target.value as CogitaInfoType | 'any')}>
                        {infoTypeOptions.map((option) => (
                          <option key={`advanced-type:${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="cogita-field">
                      <span>Reference</span>
                      <select
                        value={typeFilters.__referenceId ?? ''}
                        onChange={(event) => setTypeFilters((prev) => ({ ...prev, __referenceId: event.target.value }))}
                      >
                        <option value="">{copy.cogita.library.filters.clear}</option>
                        {referenceSources.map((source) => (
                          <option key={`reference:${source.infoId}`} value={source.infoId}>
                            {source.label}
                          </option>
                        ))}
                      </select>
                    </label>
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
                  <div className="cogita-form-actions">
                    <button type="button" className="cta" onClick={startRevisionFromSelectedInfos} disabled={selectedItems.length === 0}>
                      Start revision
                    </button>
                    <button type="button" className="ghost" onClick={startCollectionFromSelectedInfos} disabled={selectedItems.length === 0}>
                      Create collection from selection
                    </button>
                  </div>
                </section>
              ) : null}
            </section>
            ) : null}
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}

function resolveInfoTitle(payload: unknown, infoType: string, fallbackId: string) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const candidateKeys = ['title', 'name', 'label', 'value', 'text', 'quote', 'term'];
    for (const key of candidateKeys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return `${infoType} · ${fallbackId}`;
}

function formatCheckcardLabel(card: {
  cardType: string;
  checkType?: string | null;
  direction?: string | null;
  infoType?: string | null;
}) {
  const parts = [card.cardType];
  if (card.infoType) parts.push(card.infoType);
  if (card.checkType) parts.push(card.checkType);
  if (card.direction) parts.push(card.direction);
  return parts.join(' · ');
}

function formatDateTime(value: string, language: 'pl' | 'en' | 'de') {
  try {
    const locale = language === 'pl' ? 'pl-PL' : language === 'de' ? 'de-DE' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getInfoOverviewCopy(language: 'pl' | 'en' | 'de') {
  if (language === 'pl') {
    return {
      kicker: 'Informacja',
      backToSearch: 'Wróć do wyszukiwania',
      loading: 'Ładowanie informacji...',
      loadError: 'Nie udało się wczytać informacji.',
      knownness: 'Znajomość',
      reviews: 'Sprawdzenia',
      correct: 'Poprawne: {correct} / {total}',
      lastReview: 'Ostatnie sprawdzenie',
      noLastReview: 'Brak sprawdzeń',
      linkedCards: 'Powiązane karty',
      linkedCardsHint: 'Karty sprawdzające zależne od tej informacji',
      payload: 'Treść informacji',
      links: 'Powiązania',
      empty: 'Brak danych',
      noLinks: 'Brak powiązań',
      checkcards: 'Karty sprawdzające',
      loadingCheckcards: 'Ładowanie kart sprawdzających...',
      loadCheckcardsError: 'Nie udało się wczytać kart sprawdzających.',
      noCheckcards: 'Brak kart sprawdzających.',
      checkcardCount: 'Liczba kart',
      dependencyCount: 'Zależności (efektywne)',
      approach: 'Podejście',
      loadingApproach: 'Ładowanie widoku...',
      loadApproachError: 'Nie udało się wczytać widoku.',
      noApproachData: 'Brak danych widoku.',
      noKnownnessData: 'Brak danych o znajomości',
      developmentStart: 'Początek nauki',
      developmentGrowing: 'Rozwój w toku',
      developmentStable: 'Utrwalona wiedza',
      developmentStrong: 'Bardzo dobra znajomość'
    } as const;
  }
  if (language === 'de') {
    return {
      kicker: 'Information',
      backToSearch: 'Zur Suche',
      loading: 'Information wird geladen...',
      loadError: 'Information konnte nicht geladen werden.',
      knownness: 'Kenntnisstand',
      reviews: 'Abfragen',
      correct: 'Richtig: {correct} / {total}',
      lastReview: 'Letzte Abfrage',
      noLastReview: 'Noch keine Abfragen',
      linkedCards: 'Verknüpfte Karten',
      linkedCardsHint: 'Prüfkarten, die von dieser Information abhängen',
      payload: 'Inhalt',
      links: 'Verknüpfungen',
      empty: 'Keine Daten',
      noLinks: 'Keine Verknüpfungen',
      checkcards: 'Prüfkarten',
      loadingCheckcards: 'Prüfkarten werden geladen...',
      loadCheckcardsError: 'Prüfkarten konnten nicht geladen werden.',
      noCheckcards: 'Keine Prüfkarten.',
      checkcardCount: 'Anzahl Karten',
      dependencyCount: 'Abhängigkeiten (effektiv)',
      approach: 'Ansicht',
      loadingApproach: 'Ansicht wird geladen...',
      loadApproachError: 'Ansicht konnte nicht geladen werden.',
      noApproachData: 'Keine Ansichtsdaten.',
      noKnownnessData: 'Keine Kenntnisdaten',
      developmentStart: 'Lernbeginn',
      developmentGrowing: 'Aufbauphase',
      developmentStable: 'Stabil',
      developmentStrong: 'Sehr sicher'
    } as const;
  }
  return {
    kicker: 'Info',
    backToSearch: 'Back to search',
    loading: 'Loading info...',
    loadError: 'Failed to load info.',
    knownness: 'Knownness',
    reviews: 'Reviews',
    correct: 'Correct: {correct} / {total}',
    lastReview: 'Last review',
    noLastReview: 'No reviews yet',
    linkedCards: 'Linked checking cards',
    linkedCardsHint: 'Checking cards depending on this info',
    payload: 'Information',
    links: 'Links',
    empty: 'No data',
    noLinks: 'No links',
    checkcards: 'Checkcards',
    loadingCheckcards: 'Loading checkcards...',
    loadCheckcardsError: 'Failed to load checkcards.',
    noCheckcards: 'No checkcards.',
    checkcardCount: 'Checkcard count',
    dependencyCount: 'Dependencies (effective)',
    approach: 'Approach',
    loadingApproach: 'Loading view...',
    loadApproachError: 'Failed to load view.',
    noApproachData: 'No view data.',
    noKnownnessData: 'No knownness data',
    developmentStart: 'Just started',
    developmentGrowing: 'In progress',
    developmentStable: 'Stable',
    developmentStrong: 'Strong'
  } as const;
}

function describeKnownnessDevelopment(
  summary: CogitaReviewSummary,
  copy: ReturnType<typeof getInfoOverviewCopy>
) {
  if (summary.totalReviews <= 0) return copy.noKnownnessData;
  if (summary.totalReviews < 3 || summary.score < 0.35) return copy.developmentStart;
  if (summary.totalReviews < 8 || summary.score < 0.65) return copy.developmentGrowing;
  if (summary.score < 0.85) return copy.developmentStable;
  return copy.developmentStrong;
}

function InfoLinksView({
  links,
  emptyLabel
}: {
  links?: Record<string, string | string[] | null> | null;
  emptyLabel: string;
}) {
  if (!links || Object.keys(links).length === 0) {
    return <p className="cogita-library-hint">{emptyLabel}</p>;
  }
  return (
    <div className="cogita-info-tree">
      {Object.entries(links).map(([key, value]) => (
        <div key={key} className="cogita-info-tree-row">
          <div className="cogita-info-tree-key">{key}</div>
          <div className="cogita-info-tree-value">
            {Array.isArray(value) ? (
              value.length ? (
                <div className="cogita-selection-overview">
                  {value.map((entry) => (
                    <span key={`${key}:${entry}`} className="cogita-tag-chip">
                      {entry}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="cogita-library-hint">[]</span>
              )
            ) : value ? (
              <span className="cogita-tag-chip">{value}</span>
            ) : (
              <span className="cogita-library-hint">null</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoValueTree({ value, emptyLabel }: { value: unknown; emptyLabel: string }) {
  if (value == null) return <p className="cogita-library-hint">{emptyLabel}</p>;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <div className="cogita-info-tree-value">{String(value)}</div>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="cogita-library-hint">[]</p>;
    return (
      <div className="cogita-info-tree">
        {value.map((entry, index) => (
          <div key={index} className="cogita-info-tree-row">
            <div className="cogita-info-tree-key">{index + 1}</div>
            <div className="cogita-info-tree-value">
              <InfoValueTree value={entry} emptyLabel={emptyLabel} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <p className="cogita-library-hint">{emptyLabel}</p>;
    return (
      <div className="cogita-info-tree">
        {entries.map(([key, entry]) => (
          <div key={key} className="cogita-info-tree-row">
            <div className="cogita-info-tree-key">{key}</div>
            <div className="cogita-info-tree-value">
              <InfoValueTree value={entry} emptyLabel={emptyLabel} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <div className="cogita-info-tree-value">{String(value)}</div>;
}
