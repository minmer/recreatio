import { useEffect, useMemo, useRef, useState } from 'react';
import type { CogitaDependencyGraphSummary } from '../../../../../lib/api';

export function CogitaDependencyGraphSearch({
  items,
  query,
  onQueryChange,
  defaultQuery = '',
  statusFilter,
  onStatusFilterChange,
  defaultStatusFilter = 'all',
  searchLabel,
  searchPlaceholder,
  statusLabel,
  anyStatusLabel,
  activeStatusLabel = 'active',
  inactiveStatusLabel = 'inactive',
  loadState = 'ready',
  loadingLabel,
  errorLabel,
  readyLabel,
  emptyLabel,
  countLabelTemplate = '{shown} / {total}',
  showInput = true,
  inlineInput = true,
  showStatusFilter = true,
  showCount = true,
  hideResultsList = false,
  inputAriaLabel,
  inputClassName,
  emptyActionLabel,
  emptyActionHref,
  onEmptyAction,
  buildGraphHref,
  openActionLabel = 'Open',
  showOpenAction = false,
  selectedGraphId,
  onGraphSelect,
  onGraphOpen,
  onResultsChange
}: {
  items: CogitaDependencyGraphSummary[];
  query?: string;
  onQueryChange?: (query: string) => void;
  defaultQuery?: string;
  statusFilter?: 'all' | 'active' | 'inactive';
  onStatusFilterChange?: (value: 'all' | 'active' | 'inactive') => void;
  defaultStatusFilter?: 'all' | 'active' | 'inactive';
  searchLabel: string;
  searchPlaceholder: string;
  statusLabel: string;
  anyStatusLabel: string;
  activeStatusLabel?: string;
  inactiveStatusLabel?: string;
  loadState?: 'loading' | 'ready' | 'error';
  loadingLabel: string;
  errorLabel?: string;
  readyLabel: string;
  emptyLabel: string;
  countLabelTemplate?: string;
  showInput?: boolean;
  inlineInput?: boolean;
  showStatusFilter?: boolean;
  showCount?: boolean;
  hideResultsList?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onEmptyAction?: () => void;
  buildGraphHref?: (graph: CogitaDependencyGraphSummary) => string;
  openActionLabel?: string;
  showOpenAction?: boolean;
  selectedGraphId?: string | null;
  onGraphSelect?: (graph: CogitaDependencyGraphSummary) => void;
  onGraphOpen?: (graph: CogitaDependencyGraphSummary) => void;
  onResultsChange?: (items: CogitaDependencyGraphSummary[]) => void;
}) {
  const [localQuery, setLocalQuery] = useState(defaultQuery);
  const [localStatusFilter, setLocalStatusFilter] = useState<'all' | 'active' | 'inactive'>(defaultStatusFilter);
  const onResultsChangeRef = useRef(onResultsChange);
  const effectiveQuery = query ?? localQuery;
  const effectiveStatusFilter = statusFilter ?? localStatusFilter;

  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  }, [onResultsChange]);

  const filtered = useMemo(() => {
    const needle = effectiveQuery.trim().toLowerCase();
    return items.filter((graph) => {
      if (effectiveStatusFilter === 'active' && !graph.isActive) return false;
      if (effectiveStatusFilter === 'inactive' && graph.isActive) return false;
      if (!needle) return true;
      return graph.name.toLowerCase().includes(needle) || graph.graphId.toLowerCase().includes(needle);
    });
  }, [effectiveQuery, effectiveStatusFilter, items]);

  useEffect(() => {
    onResultsChangeRef.current?.(filtered);
  }, [filtered]);

  const countLabel = useMemo(
    () => countLabelTemplate.replace('{shown}', String(filtered.length)).replace('{total}', String(items.length)),
    [countLabelTemplate, filtered.length, items.length]
  );
  const statusText = loadState === 'loading' ? loadingLabel : loadState === 'error' ? (errorLabel ?? readyLabel) : readyLabel;
  const resolvedEmptyLabel = loadState === 'error' ? (errorLabel ?? emptyLabel) : emptyLabel;

  const handleQueryChange = (next: string) => {
    if (onQueryChange) {
      onQueryChange(next);
      return;
    }
    setLocalQuery(next);
  };

  const handleStatusFilterChange = (next: 'all' | 'active' | 'inactive') => {
    if (onStatusFilterChange) {
      onStatusFilterChange(next);
      return;
    }
    setLocalStatusFilter(next);
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

      {showStatusFilter ? (
        <label className="cogita-field">
          <span>{statusLabel}</span>
          <select value={effectiveStatusFilter} onChange={(event) => handleStatusFilterChange(event.target.value as 'all' | 'active' | 'inactive')}>
            <option value="all">{anyStatusLabel}</option>
            <option value="active">{activeStatusLabel}</option>
            <option value="inactive">{inactiveStatusLabel}</option>
          </select>
        </label>
      ) : null}

      {showCount ? (
        <div className="cogita-card-count">
          <span>{countLabel}</span>
          <span>{statusText}</span>
        </div>
      ) : null}

      {!hideResultsList ? (
        <div className="cogita-card-list" data-view="list">
          {filtered.length ? (
            filtered.map((graph) => {
              const href = buildGraphHref ? buildGraphHref(graph) : null;
              const isActive = selectedGraphId === graph.graphId;
              return (
                <div key={graph.graphId} className={`cogita-card-item ${isActive ? 'active' : ''}`}>
                  <div className="cogita-info-result-row">
                    {href && !onGraphSelect ? (
                      <a className="cogita-info-result-main" href={href}>
                        <div className="cogita-card-type">{graph.isActive ? activeStatusLabel : inactiveStatusLabel}</div>
                        <h3 className="cogita-card-title">{graph.name}</h3>
                        <p className="cogita-card-subtitle">{graph.nodeCount} nodes</p>
                      </a>
                    ) : (
                      <button type="button" className="cogita-info-result-main" onClick={() => onGraphSelect?.(graph)}>
                        <div className="cogita-card-type">{graph.isActive ? activeStatusLabel : inactiveStatusLabel}</div>
                        <h3 className="cogita-card-title">{graph.name}</h3>
                        <p className="cogita-card-subtitle">{graph.nodeCount} nodes</p>
                      </button>
                    )}
                    {showOpenAction && href ? (
                      <a className="ghost" href={href}>
                        {openActionLabel}
                      </a>
                    ) : showOpenAction && onGraphOpen ? (
                      <button type="button" className="ghost" onClick={() => onGraphOpen(graph)}>
                        {openActionLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="cogita-card-empty">
              <p>{resolvedEmptyLabel}</p>
              {emptyActionLabel && (emptyActionHref || onEmptyAction) ? (
                emptyActionHref ? (
                  <a className="ghost" href={emptyActionHref}>
                    {emptyActionLabel}
                  </a>
                ) : (
                  <button type="button" className="ghost" onClick={onEmptyAction}>
                    {emptyActionLabel}
                  </button>
                )
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
