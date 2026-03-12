import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCogitaInfoCheckcards,
  searchCogitaEntities,
  searchCogitaInfos,
  type CogitaCardSearchResult,
  type CogitaEntitySearchResult,
  type CogitaInfoSearchResult
} from '../../../../../lib/api';

export type CogitaKnowledgeSearchResult = {
  info: CogitaInfoSearchResult;
  cards: CogitaCardSearchResult[];
};

export function CogitaKnowledgeSearch({
  libraryId,
  infoType,
  query,
  onQueryChange,
  minQueryLength = 2,
  debounceMs = 220,
  limit = 48,
  defaultEntityFilters,
  entityFilters,
  useEntitySearch = false,
  searchLabel,
  searchPlaceholder,
  searchingLabel,
  emptyLabel,
  failedLabel,
  resultSuffixLabel,
  requireLinkedCheckcards = false,
  showInput = true,
  inlineInput = false,
  inputAriaLabel,
  inputClassName,
  hideResultsList = false,
  resultsOverride,
  allowSelection = false,
  allowMultiSelect = false,
  selectedIds,
  onSelectionChange,
  onKnowledgeItemToggleSelection,
  onKnowledgeItemSelect,
  onKnowledgeItemOpen,
  openActionLabel = 'Open',
  displayMode,
  defaultDisplayMode = 'details',
  detailColumnNameLabel = 'Name',
  detailColumnTypeLabel = 'Type',
  detailColumnIdLabel = 'ID',
  renderTypeLabel,
  showStatusMessages = true,
  disabled = false,
  onStatusChange,
  onResultsChange
}: {
  libraryId: string;
  infoType?: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  minQueryLength?: number;
  debounceMs?: number;
  limit?: number;
  defaultEntityFilters?: Record<string, string>;
  entityFilters?: Record<string, string>;
  useEntitySearch?: boolean;
  searchLabel: string;
  searchPlaceholder: string;
  searchingLabel: string;
  emptyLabel: string;
  failedLabel: string;
  resultSuffixLabel: string;
  requireLinkedCheckcards?: boolean;
  showInput?: boolean;
  inlineInput?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  hideResultsList?: boolean;
  resultsOverride?: CogitaKnowledgeSearchResult[];
  allowSelection?: boolean;
  allowMultiSelect?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onKnowledgeItemToggleSelection?: (result: CogitaKnowledgeSearchResult, checked: boolean) => void;
  onKnowledgeItemSelect?: (result: CogitaKnowledgeSearchResult) => void;
  onKnowledgeItemOpen?: (result: CogitaKnowledgeSearchResult) => void;
  openActionLabel?: string;
  displayMode?: 'details' | 'wide' | 'grid';
  defaultDisplayMode?: 'details' | 'wide' | 'grid';
  detailColumnNameLabel?: string;
  detailColumnTypeLabel?: string;
  detailColumnIdLabel?: string;
  renderTypeLabel?: (result: CogitaKnowledgeSearchResult) => string;
  showStatusMessages?: boolean;
  disabled?: boolean;
  onStatusChange?: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
  onResultsChange?: (results: CogitaKnowledgeSearchResult[]) => void;
}) {
  const [localQuery, setLocalQuery] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<CogitaKnowledgeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardsCacheRef = useRef(new Map<string, CogitaCardSearchResult[]>());
  const onStatusChangeRef = useRef(onStatusChange);
  const onResultsChangeRef = useRef(onResultsChange);
  const effectiveQuery = query ?? localQuery;
  const effectiveDisplayMode = displayMode ?? defaultDisplayMode;
  const mergedEntityFilters = useMemo(() => ({ ...(defaultEntityFilters ?? {}), ...(entityFilters ?? {}) }), [defaultEntityFilters, entityFilters]);
  const displayResults = resultsOverride ?? results;
  const effectiveSelectionMode = useMemo<'none' | 'single' | 'multiple'>(() => {
    if (!allowSelection) return 'none';
    return allowMultiSelect ? 'multiple' : 'single';
  }, [allowMultiSelect, allowSelection]);
  const selectedSet = useMemo(
    () => new Set(selectedIds ?? localSelectedIds),
    [localSelectedIds, selectedIds]
  );

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  }, [onResultsChange]);

  useEffect(() => {
    if (disabled) {
      setLoading(false);
      setError(null);
      onStatusChangeRef.current?.('idle');
      return;
    }

    const trimmed = effectiveQuery.trim();
    if (trimmed.length < minQueryLength) {
      setResults([]);
      setLoading(false);
      setError(null);
      onResultsChangeRef.current?.([]);
      onStatusChangeRef.current?.('idle');
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      onStatusChangeRef.current?.('loading');
      try {
        let found: CogitaInfoSearchResult[] = [];
        if (useEntitySearch) {
          const entities = await searchCogitaEntities({
            libraryId,
            type: infoType && infoType !== 'any' ? infoType : undefined,
            query: trimmed || undefined,
            filters: mergedEntityFilters,
            limit
          });
          found = entities
            .map((item: CogitaEntitySearchResult) => ({
              infoId: item.infoId ?? '',
              infoType: item.entityType,
              label: item.title
            }))
            .filter((item) => item.infoId.length > 0);
        } else {
          found = await searchCogitaInfos({
            libraryId,
            type: infoType && infoType !== 'any' ? infoType : undefined,
            query: trimmed,
            limit
          });
        }

        if (!requireLinkedCheckcards) {
          if (cancelled) return;
          const simpleResults = found.map((info) => ({ info, cards: [] }));
          setResults(simpleResults);
          onResultsChangeRef.current?.(simpleResults);
          onStatusChangeRef.current?.('ready');
          return;
        }

        const enriched = await Promise.all(
          found.map(async (info) => {
            const cached = cardsCacheRef.current.get(info.infoId);
            if (cached) {
              return cached.length > 0 ? { info, cards: cached } : null;
            }
            try {
              const bundle = await getCogitaInfoCheckcards({ libraryId, infoId: info.infoId });
              cardsCacheRef.current.set(info.infoId, bundle.items);
              return bundle.items.length > 0 ? { info, cards: bundle.items } : null;
            } catch {
              cardsCacheRef.current.set(info.infoId, []);
              return null;
            }
          })
        );

        if (cancelled) return;
        const filtered = enriched.filter((item): item is CogitaKnowledgeSearchResult => Boolean(item));
        setResults(filtered);
        onResultsChangeRef.current?.(filtered);
        onStatusChangeRef.current?.('ready');
      } catch {
        if (cancelled) return;
        setError(failedLabel);
        onResultsChangeRef.current?.([]);
        onStatusChangeRef.current?.('error');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    debounceMs,
    disabled,
    effectiveQuery,
    failedLabel,
    infoType,
    libraryId,
    limit,
    minQueryLength,
    mergedEntityFilters,
    requireLinkedCheckcards,
    useEntitySearch
  ]);

  const handleQueryChange = (next: string) => {
    if (onQueryChange) {
      onQueryChange(next);
      return;
    }
    setLocalQuery(next);
  };
  const compactInline = showInput && inlineInput && hideResultsList && !showStatusMessages;
  const handleSelectionToggle = (result: CogitaKnowledgeSearchResult, checked: boolean) => {
    if (effectiveSelectionMode === 'none') return;
    const infoId = result.info.infoId;
    const currentIds = selectedIds ?? localSelectedIds;
    let nextIds: string[];
    if (effectiveSelectionMode === 'single') {
      nextIds = checked ? [infoId] : [];
    } else if (checked) {
      nextIds = currentIds.includes(infoId) ? currentIds : [...currentIds, infoId];
    } else {
      nextIds = currentIds.filter((item) => item !== infoId);
    }
    if (!selectedIds) {
      setLocalSelectedIds(nextIds);
    }
    onSelectionChange?.(nextIds);
    onKnowledgeItemToggleSelection?.(result, checked);
  };
  const handleResultSelect = (result: CogitaKnowledgeSearchResult) => {
    onKnowledgeItemSelect?.(result);
  };
  const handleResultOpen = (result: CogitaKnowledgeSearchResult) => {
    onKnowledgeItemOpen?.(result);
  };
  const resolveTypeLabel = (result: CogitaKnowledgeSearchResult) => {
    if (renderTypeLabel) return renderTypeLabel(result);
    if (requireLinkedCheckcards) return `${result.info.infoType} · ${result.cards.length} ${resultSuffixLabel}`;
    return result.info.infoType;
  };

  const renderResults = () => {
    if (displayResults.length === 0) {
      return (
        <div className="cogita-card-empty">
          <p>{emptyLabel}</p>
        </div>
      );
    }

    if (effectiveDisplayMode === 'details') {
      return (
        <div className="cogita-details-grid" role="table" aria-label={searchLabel}>
          <div className="cogita-details-grid-head" role="row">
            <span />
            <span>{detailColumnNameLabel}</span>
            <span>{detailColumnTypeLabel}</span>
            <span>{detailColumnIdLabel}</span>
            <span />
          </div>
          {displayResults.map((result) => (
            <div
              key={result.info.infoId}
              className={`cogita-details-row ${selectedSet.has(result.info.infoId) ? 'active' : ''}`}
              role="row"
              onClick={() => handleResultSelect(result)}
            >
              {effectiveSelectionMode !== 'none' ? (
                <label className="cogita-info-checkbox">
                  <input
                    type={effectiveSelectionMode === 'single' ? 'radio' : 'checkbox'}
                    checked={selectedSet.has(result.info.infoId)}
                    onChange={(event) => handleSelectionToggle(result, event.target.checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span />
                </label>
              ) : (
                <span />
              )}
              <span title={result.info.label}>{result.info.label}</span>
              <span title={resolveTypeLabel(result)}>{resolveTypeLabel(result)}</span>
              <span title={result.info.infoId}>{result.info.infoId}</span>
              {onKnowledgeItemOpen ? (
                <button
                  type="button"
                  className="ghost cogita-details-open"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleResultOpen(result);
                  }}
                  aria-label={openActionLabel}
                >
                  {'>'}
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={`cogita-card-list cogita-card-list--${effectiveDisplayMode}`} data-view={effectiveDisplayMode}>
        {displayResults.map((result) => (
          <article key={result.info.infoId} className="cogita-card-item" data-selected={selectedSet.has(result.info.infoId)}>
            <div className="cogita-info-result-row">
            {effectiveSelectionMode !== 'none' ? (
              <label className="cogita-info-checkbox">
                <input
                  type={effectiveSelectionMode === 'single' ? 'radio' : 'checkbox'}
                  checked={selectedSet.has(result.info.infoId)}
                  onChange={(event) => handleSelectionToggle(result, event.target.checked)}
                />
                <span />
              </label>
            ) : null}
            <button
              type="button"
              className="cogita-info-result-main"
              onClick={() => handleResultSelect(result)}
            >
              <div className="cogita-card-type">{resolveTypeLabel(result)}</div>
              <h3 className="cogita-card-title">{result.info.label}</h3>
              <p className="cogita-card-subtitle">{result.info.infoId}</p>
            </button>
            {onKnowledgeItemOpen ? (
              <button type="button" className="ghost" onClick={() => handleResultOpen(result)}>
                {openActionLabel}
              </button>
            ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  };

  return (
    <div style={compactInline ? undefined : { display: 'grid', gap: '0.6rem' }}>
      {showInput ? (
        inlineInput ? (
          <input
            aria-label={inputAriaLabel ?? searchLabel}
            className={inputClassName}
            value={effectiveQuery}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
          />
        ) : (
          <label className="cogita-field full">
            <span>{searchLabel}</span>
            <input
              value={effectiveQuery}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          </label>
        )
      ) : null}
      {showStatusMessages && loading ? <p className="cogita-help">{searchingLabel}</p> : null}
      {showStatusMessages && error ? <p className="cogita-form-error">{error}</p> : null}
      {showStatusMessages && !loading && effectiveQuery.trim().length >= minQueryLength && displayResults.length === 0 ? (
        <p className="cogita-help">{emptyLabel}</p>
      ) : null}
      {!hideResultsList ? renderResults() : null}
    </div>
  );
}
