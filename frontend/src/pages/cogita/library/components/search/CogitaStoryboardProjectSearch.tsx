import { useEffect, useMemo, useRef, useState } from 'react';
import type { CogitaCreationProject } from '../../../../../lib/api';

export function CogitaStoryboardProjectSearch({
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
  inlineInput = true,
  hideResultsList = false,
  inputAriaLabel,
  inputClassName,
  buildProjectHref,
  openActionLabel = 'Open',
  showOpenAction = false,
  onProjectSelect,
  onProjectOpen,
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
  inlineInput?: boolean;
  hideResultsList?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  buildProjectHref?: (item: CogitaCreationProject) => string;
  openActionLabel?: string;
  showOpenAction?: boolean;
  onProjectSelect?: (item: CogitaCreationProject) => void;
  onProjectOpen?: (item: CogitaCreationProject) => void;
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
        inlineInput ? (
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

      {loading ? <p>{loadingLabel}</p> : null}
      {!loading && loadFailed ? <p>{failedLabel}</p> : null}
      {!loading && !loadFailed && filtered.length === 0 ? <p>{emptyLabel}</p> : null}

      {!hideResultsList ? (
        <div className="cogita-card-list" data-view="list">
          {filtered.map((item) => {
            const href = buildProjectHref ? buildProjectHref(item) : null;
            return (
              <div key={item.projectId} className="cogita-card-item">
                <div className="cogita-info-result-row">
                  {href && !onProjectSelect ? (
                    <a className="cogita-info-result-main" href={href}>
                      <h3 className="cogita-card-title">{item.name}</h3>
                      <p className="cogita-card-subtitle">{item.projectId}</p>
                    </a>
                  ) : (
                    <button type="button" className="cogita-info-result-main" onClick={() => onProjectSelect?.(item)}>
                      <h3 className="cogita-card-title">{item.name}</h3>
                      <p className="cogita-card-subtitle">{item.projectId}</p>
                    </button>
                  )}
                  {showOpenAction && href ? (
                    <a className="ghost" href={href}>
                      {openActionLabel}
                    </a>
                  ) : showOpenAction && onProjectOpen ? (
                    <button type="button" className="ghost" onClick={() => onProjectOpen(item)}>
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
