import { useEffect, useMemo, useRef, useState } from 'react';
import { getCogitaCollections, type CogitaCollectionSummary } from '../../../../../lib/api';

export function CogitaCollectionSearch({
  libraryId,
  query,
  onQueryChange,
  defaultQuery = '',
  minQueryLength = 0,
  debounceMs = 240,
  limit = 30,
  searchLabel,
  searchPlaceholder,
  searchingLabel,
  readyLabel,
  emptyLabel,
  failedLabel,
  collectionLabel,
  itemCountLabel,
  noNotesLabel,
  countLabelTemplate = '{shown} / {total}',
  showInput = true,
  showCount = true,
  showLoadMore = true,
  showStatusMessages = false,
  hideResultsList = false,
  inputAriaLabel,
  inputClassName,
  resultsOverride,
  emptyActionLabel,
  emptyActionHref,
  buildCollectionHref,
  openActionLabel = 'Open',
  showOpenAction = false,
  loadMoreLabel = 'Load more',
  onStatusChange,
  onResultsChange,
  onCollectionSelect,
  onCollectionOpen
}: {
  libraryId: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  defaultQuery?: string;
  minQueryLength?: number;
  debounceMs?: number;
  limit?: number;
  searchLabel: string;
  searchPlaceholder: string;
  searchingLabel: string;
  readyLabel: string;
  emptyLabel: string;
  failedLabel: string;
  collectionLabel: string;
  itemCountLabel: string;
  noNotesLabel: string;
  countLabelTemplate?: string;
  showInput?: boolean;
  showCount?: boolean;
  showLoadMore?: boolean;
  showStatusMessages?: boolean;
  hideResultsList?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  resultsOverride?: CogitaCollectionSummary[];
  emptyActionLabel?: string;
  emptyActionHref?: string;
  buildCollectionHref?: (item: CogitaCollectionSummary) => string;
  openActionLabel?: string;
  showOpenAction?: boolean;
  loadMoreLabel?: string;
  onStatusChange?: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
  onResultsChange?: (items: CogitaCollectionSummary[]) => void;
  onCollectionSelect?: (item: CogitaCollectionSummary) => void;
  onCollectionOpen?: (item: CogitaCollectionSummary) => void;
}) {
  const [localQuery, setLocalQuery] = useState(defaultQuery);
  const [results, setResults] = useState<CogitaCollectionSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const onResultsChangeRef = useRef(onResultsChange);
  const effectiveQuery = query ?? localQuery;
  const displayResults = resultsOverride ?? results;
  const displayTotal = resultsOverride ? resultsOverride.length : totalCount || displayResults.length;

  useEffect(() => {
    if (query === undefined) setLocalQuery(defaultQuery);
  }, [defaultQuery, query]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  }, [onResultsChange]);

  useEffect(() => {
    const trimmed = effectiveQuery.trim();
    if (trimmed.length < minQueryLength) {
      setResults([]);
      setTotalCount(0);
      setNextCursor(null);
      setStatus('idle');
      setError(null);
      onStatusChangeRef.current?.('idle');
      onResultsChangeRef.current?.([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setStatus('loading');
      setError(null);
      onStatusChangeRef.current?.('loading');
      try {
        const bundle = await getCogitaCollections({
          libraryId,
          query: trimmed || undefined,
          limit
        });
        if (cancelled) return;
        setResults(bundle.items);
        setTotalCount(bundle.total);
        setNextCursor(bundle.nextCursor ?? null);
        setStatus('ready');
        onStatusChangeRef.current?.('ready');
        onResultsChangeRef.current?.(bundle.items);
      } catch {
        if (cancelled) return;
        setResults([]);
        setTotalCount(0);
        setNextCursor(null);
        setStatus('error');
        setError(failedLabel);
        onStatusChangeRef.current?.('error');
        onResultsChangeRef.current?.([]);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [debounceMs, effectiveQuery, failedLabel, libraryId, limit, minQueryLength]);

  const handleQueryChange = (next: string) => {
    if (onQueryChange) {
      onQueryChange(next);
      return;
    }
    setLocalQuery(next);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || resultsOverride) return;
    setStatus('loading');
    setError(null);
    onStatusChangeRef.current?.('loading');
    try {
      const bundle = await getCogitaCollections({
        libraryId,
        query: effectiveQuery.trim() || undefined,
        limit,
        cursor: nextCursor
      });
      const merged = [...results, ...bundle.items];
      setResults(merged);
      setTotalCount(bundle.total);
      setNextCursor(bundle.nextCursor ?? null);
      setStatus('ready');
      onStatusChangeRef.current?.('ready');
      onResultsChangeRef.current?.(merged);
    } catch {
      setStatus('error');
      setError(failedLabel);
      onStatusChangeRef.current?.('error');
    }
  };

  const countLabel = useMemo(
    () => countLabelTemplate.replace('{shown}', String(displayResults.length)).replace('{total}', String(displayTotal)),
    [countLabelTemplate, displayResults.length, displayTotal]
  );

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {showInput ? (
        <div className="cogita-search-field">
          <input
            aria-label={inputAriaLabel ?? searchLabel}
            className={inputClassName}
            value={effectiveQuery}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
          />
        </div>
      ) : null}

      {showCount ? (
        <div className="cogita-card-count">
          <span>{countLabel}</span>
          <span>{status === 'loading' ? searchingLabel : readyLabel}</span>
        </div>
      ) : null}
      {showStatusMessages && status === 'loading' ? <p className="cogita-help">{searchingLabel}</p> : null}
      {showStatusMessages && error ? <p className="cogita-form-error">{error}</p> : null}

      {!hideResultsList ? (
        <div className="cogita-card-list" data-view="list">
          {displayResults.length ? (
            displayResults.map((collection) => {
              const href = buildCollectionHref ? buildCollectionHref(collection) : null;
              return (
                <div key={collection.collectionId} className="cogita-card-item">
                  <div className="cogita-info-result-row">
                    {href && !onCollectionSelect ? (
                      <a className="cogita-info-result-main" href={href}>
                        <div className="cogita-card-type">{collectionLabel}</div>
                        <h3 className="cogita-card-title">{collection.name}</h3>
                        <p className="cogita-card-subtitle">
                          {itemCountLabel.replace('{count}', String(collection.itemCount))} · {collection.notes || noNotesLabel}
                        </p>
                      </a>
                    ) : (
                      <button type="button" className="cogita-info-result-main" onClick={() => onCollectionSelect?.(collection)}>
                        <div className="cogita-card-type">{collectionLabel}</div>
                        <h3 className="cogita-card-title">{collection.name}</h3>
                        <p className="cogita-card-subtitle">
                          {itemCountLabel.replace('{count}', String(collection.itemCount))} · {collection.notes || noNotesLabel}
                        </p>
                      </button>
                    )}
                    {showOpenAction && href ? (
                      <a className="ghost" href={href}>
                        {openActionLabel}
                      </a>
                    ) : showOpenAction && onCollectionOpen ? (
                      <button type="button" className="ghost" onClick={() => onCollectionOpen(collection)}>
                        {openActionLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="cogita-card-empty">
              <p>{status === 'error' ? failedLabel : emptyLabel}</p>
              {emptyActionLabel && emptyActionHref ? (
                <a className="ghost" href={emptyActionHref}>
                  {emptyActionLabel}
                </a>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {showLoadMore && !resultsOverride && nextCursor ? (
        <div className="cogita-form-actions">
          <button type="button" className="cta ghost" onClick={() => void handleLoadMore()}>
            {loadMoreLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
