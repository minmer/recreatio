import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCogitaInfoCheckcards,
  searchCogitaEntities,
  searchCogitaInfos,
  type CogitaCardSearchResult,
  type CogitaEntitySearchResult,
  type CogitaInfoSearchResult
} from '../../../../lib/api';

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
  showInfoId = false,
  renderResultMeta,
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
  showInfoId?: boolean;
  renderResultMeta?: (result: CogitaKnowledgeSearchResult) => string;
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
            filters: entityFilters,
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
    entityFilters,
    failedLabel,
    infoType,
    libraryId,
    limit,
    minQueryLength,
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
  const buildMeta = (result: CogitaKnowledgeSearchResult) => {
    if (renderResultMeta) return renderResultMeta(result);
    if (requireLinkedCheckcards) {
      return `${result.info.infoType} · ${result.cards.length} ${resultSuffixLabel}`;
    }
    return showInfoId ? `${result.info.infoType} · ${result.info.infoId}` : result.info.infoType;
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
      {!hideResultsList ? (
        <div className="cogita-info-tree" style={{ maxHeight: 320, overflow: 'auto' }}>
          {displayResults.map((result) => (
            <div key={result.info.infoId} className="cogita-info-tree-row">
              {effectiveSelectionMode !== 'none' ? (
                <label className="cogita-info-checkbox" style={{ marginRight: '0.35rem' }}>
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
                className="ghost cogita-checkcard-row"
                onClick={() => handleResultSelect(result)}
                style={{ flex: 1 }}
              >
                <span>{result.info.label}</span>
                <small>{buildMeta(result)}</small>
              </button>
              {onKnowledgeItemOpen ? (
                <button type="button" className="ghost" onClick={() => handleResultOpen(result)}>
                  {openActionLabel}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
