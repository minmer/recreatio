import { useEffect, useMemo, useRef, useState } from 'react';
import type { CogitaCreationProject } from '../../../../../lib/api';

export function CogitaStoryboardSearch({
  items,
  query,
  onQueryChange,
  defaultQuery = '',
  searchLabel,
  searchPlaceholder,
  loading,
  loadingLabel,
  loadFailed,
  failedLabel,
  emptyLabel,
  showInput = true,
  hideResultsList = false,
  inputAriaLabel,
  inputClassName,
  buildStoryboardHref,
  openActionLabel = 'Open',
  showOpenAction = false,
  onStoryboardSelect,
  onStoryboardOpen,
  onResultsChange
}: {
  items: CogitaCreationProject[];
  query?: string;
  onQueryChange?: (query: string) => void;
  defaultQuery?: string;
  searchLabel: string;
  searchPlaceholder: string;
  loading: boolean;
  loadingLabel: string;
  loadFailed: boolean;
  failedLabel: string;
  emptyLabel: string;
  showInput?: boolean;
  hideResultsList?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  buildStoryboardHref?: (item: CogitaCreationProject) => string;
  openActionLabel?: string;
  showOpenAction?: boolean;
  onStoryboardSelect?: (item: CogitaCreationProject) => void;
  onStoryboardOpen?: (item: CogitaCreationProject) => void;
  onResultsChange?: (items: CogitaCreationProject[]) => void;
}) {
  const [localQuery, setLocalQuery] = useState(defaultQuery);
  const onResultsChangeRef = useRef(onResultsChange);
  const effectiveQuery = query ?? localQuery;

  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  }, [onResultsChange]);

  const filtered = useMemo(() => {
    const needle = effectiveQuery.trim().toLowerCase();
    return !needle
      ? items
      : items.filter((item) => item.name.toLowerCase().includes(needle) || item.projectId.toLowerCase().includes(needle));
  }, [effectiveQuery, items]);

  useEffect(() => {
    onResultsChangeRef.current?.(filtered);
  }, [filtered]);

  const handleQueryChange = (next: string) => {
    if (onQueryChange) {
      onQueryChange(next);
      return;
    }
    setLocalQuery(next);
  };

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

      {loading ? <p>{loadingLabel}</p> : null}
      {!loading && loadFailed ? <p>{failedLabel}</p> : null}
      {!loading && !loadFailed && filtered.length === 0 ? <p>{emptyLabel}</p> : null}

      {!hideResultsList ? (
        <div className="cogita-card-list" data-view="list">
          {filtered.map((item) => {
            const href = buildStoryboardHref ? buildStoryboardHref(item) : null;
            return (
              <div key={item.projectId} className="cogita-card-item">
                <div className="cogita-info-result-row">
                  {href && !onStoryboardSelect ? (
                    <a className="cogita-info-result-main" href={href}>
                      <h3 className="cogita-card-title">{item.name}</h3>
                      <p className="cogita-card-subtitle">{item.projectId}</p>
                    </a>
                  ) : (
                    <button type="button" className="cogita-info-result-main" onClick={() => onStoryboardSelect?.(item)}>
                      <h3 className="cogita-card-title">{item.name}</h3>
                      <p className="cogita-card-subtitle">{item.projectId}</p>
                    </button>
                  )}
                  {showOpenAction && href ? (
                    <a className="ghost" href={href}>
                      {openActionLabel}
                    </a>
                  ) : showOpenAction && onStoryboardOpen ? (
                    <button type="button" className="ghost" onClick={() => onStoryboardOpen(item)}>
                      {openActionLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
