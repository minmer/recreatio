import { useEffect, useMemo, useRef, useState } from 'react';
import type { CogitaLiveRevisionSessionListItem } from '../../../../../lib/api';

export function CogitaLiveSessionSearch({
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
  searchingLabel,
  readyLabel,
  errorLabel,
  loadState,
  emptyLabel,
  countLabelTemplate = '{shown} / {total}',
  showInput = true,
  showStatusFilter = true,
  showCount = true,
  hideResultsList = false,
  inputAriaLabel,
  inputClassName,
  statusOptions,
  buildSessionHref,
  openActionLabel = 'Open',
  showOpenAction = false,
  participantsLabel = 'Participants',
  onSessionSelect,
  onSessionOpen,
  onResultsChange
}: {
  items: CogitaLiveRevisionSessionListItem[];
  query?: string;
  onQueryChange?: (query: string) => void;
  defaultQuery?: string;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  defaultStatusFilter?: string;
  searchLabel: string;
  searchPlaceholder: string;
  statusLabel: string;
  anyStatusLabel: string;
  searchingLabel: string;
  readyLabel: string;
  errorLabel: string;
  loadState: 'loading' | 'ready' | 'error';
  emptyLabel: string;
  countLabelTemplate?: string;
  showInput?: boolean;
  showStatusFilter?: boolean;
  showCount?: boolean;
  hideResultsList?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  statusOptions?: string[];
  buildSessionHref?: (item: CogitaLiveRevisionSessionListItem) => string;
  openActionLabel?: string;
  showOpenAction?: boolean;
  participantsLabel?: string;
  onSessionSelect?: (item: CogitaLiveRevisionSessionListItem) => void;
  onSessionOpen?: (item: CogitaLiveRevisionSessionListItem) => void;
  onResultsChange?: (items: CogitaLiveRevisionSessionListItem[]) => void;
}) {
  const [localQuery, setLocalQuery] = useState(defaultQuery);
  const [localStatusFilter, setLocalStatusFilter] = useState(defaultStatusFilter);
  const onResultsChangeRef = useRef(onResultsChange);
  const effectiveQuery = query ?? localQuery;
  const effectiveStatusFilter = statusFilter ?? localStatusFilter;

  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  }, [onResultsChange]);

  const availableStatusOptions = useMemo(() => {
    if (statusOptions && statusOptions.length > 0) return statusOptions;
    const values = new Set<string>();
    items.forEach((item) => values.add(item.status));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items, statusOptions]);

  const filtered = useMemo(() => {
    const needle = effectiveQuery.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (effectiveStatusFilter !== 'all' && item.status !== effectiveStatusFilter) return false;
      if (!needle) return true;
      const haystack = `${item.title ?? ''} ${item.sessionId} ${item.status}`.toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [effectiveQuery, effectiveStatusFilter, items]);

  useEffect(() => {
    onResultsChangeRef.current?.(filtered);
  }, [filtered]);

  const countLabel = useMemo(
    () => countLabelTemplate.replace('{shown}', String(filtered.length)).replace('{total}', String(items.length)),
    [countLabelTemplate, filtered.length, items.length]
  );
  const statusText = loadState === 'loading' ? searchingLabel : loadState === 'error' ? errorLabel : readyLabel;

  const handleQueryInputChange = (next: string) => {
    if (onQueryChange) {
      onQueryChange(next);
      return;
    }
    setLocalQuery(next);
  };

  const handleStatusInputChange = (next: string) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(next);
      return;
    }
    setLocalStatusFilter(next);
  };

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {showInput ? (
        <div className="cogita-search-field">
          <input
            aria-label={inputAriaLabel ?? searchLabel}
            className={inputClassName}
            value={effectiveQuery}
            onChange={(event) => handleQueryInputChange(event.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
          />
        </div>
      ) : null}

      {showStatusFilter ? (
        <label className="cogita-field">
          <span>{statusLabel}</span>
          <select value={effectiveStatusFilter} onChange={(event) => handleStatusInputChange(event.target.value)}>
            <option value="all">{anyStatusLabel}</option>
            {availableStatusOptions.map((value) => (
              <option key={`status:${value}`} value={value}>
                {value}
              </option>
            ))}
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
            filtered.map((item) => {
              const href = buildSessionHref ? buildSessionHref(item) : null;
              const title = item.title || item.sessionId;
              return (
                <div key={item.sessionId} className="cogita-card-item">
                  <div className="cogita-info-result-row">
                    {href && !onSessionSelect ? (
                      <a className="cogita-info-result-main" href={href}>
                        <div className="cogita-card-type">{item.status}</div>
                        <h3 className="cogita-card-title">{title}</h3>
                        <p className="cogita-card-subtitle">{participantsLabel}: {item.participantCount}</p>
                      </a>
                    ) : (
                      <button type="button" className="cogita-info-result-main" onClick={() => onSessionSelect?.(item)}>
                        <div className="cogita-card-type">{item.status}</div>
                        <h3 className="cogita-card-title">{title}</h3>
                        <p className="cogita-card-subtitle">{participantsLabel}: {item.participantCount}</p>
                      </button>
                    )}
                    {showOpenAction && href ? (
                      <a className="ghost" href={href}>
                        {openActionLabel}
                      </a>
                    ) : showOpenAction && onSessionOpen ? (
                      <button type="button" className="ghost" onClick={() => onSessionOpen(item)}>
                        {openActionLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="cogita-card-empty">
              <p>{emptyLabel}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
