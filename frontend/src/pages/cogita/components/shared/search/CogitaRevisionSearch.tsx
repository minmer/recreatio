import { useEffect, useMemo, useRef, useState } from 'react';
import { getCogitaRevisions, type CogitaRevision } from '../../../../../lib/api';
import { revisionTypes } from '../../../features/revision/registry';
import { getCachedCollections } from '../../cogitaMetaCache';

export function CogitaRevisionSearch({
  libraryId,
  collectionId,
  query,
  onQueryChange,
  defaultQuery = '',
  typeFilter,
  onTypeFilterChange,
  defaultTypeFilter = 'all',
  searchLabel,
  searchPlaceholder,
  modeLabel,
  anyTypeLabel,
  searchingLabel,
  readyLabel,
  emptyLabel,
  failedLabel,
  countLabelTemplate = '{shown} / {total}',
  showInput = true,
  showTypeFilter = true,
  showCount = true,
  showStatusMessages = false,
  hideResultsList = false,
  inputAriaLabel,
  inputClassName,
  revisionTypeOptions,
  collectionNameById,
  resolveRevisionTypeLabel,
  openActionLabel = 'Open',
  showOpenAction = false,
  emptyActionLabel,
  emptyActionHref,
  buildRevisionHref,
  onStatusChange,
  onResultsChange,
  onRevisionSelect,
  onRevisionOpen
}: {
  libraryId: string;
  collectionId?: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  defaultQuery?: string;
  typeFilter?: string;
  onTypeFilterChange?: (value: string) => void;
  defaultTypeFilter?: string;
  searchLabel: string;
  searchPlaceholder: string;
  modeLabel: string;
  anyTypeLabel: string;
  searchingLabel: string;
  readyLabel: string;
  emptyLabel: string;
  failedLabel: string;
  countLabelTemplate?: string;
  showInput?: boolean;
  showTypeFilter?: boolean;
  showCount?: boolean;
  showStatusMessages?: boolean;
  hideResultsList?: boolean;
  inputAriaLabel?: string;
  inputClassName?: string;
  revisionTypeOptions?: string[];
  collectionNameById?: Record<string, string>;
  resolveRevisionTypeLabel: (typeKey: string) => string;
  openActionLabel?: string;
  showOpenAction?: boolean;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  buildRevisionHref?: (item: CogitaRevision) => string;
  onStatusChange?: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
  onResultsChange?: (items: CogitaRevision[]) => void;
  onRevisionSelect?: (item: CogitaRevision) => void;
  onRevisionOpen?: (item: CogitaRevision) => void;
}) {
  const [localQuery, setLocalQuery] = useState(defaultQuery);
  const [localTypeFilter, setLocalTypeFilter] = useState(defaultTypeFilter);
  const [internalCollectionNameById, setInternalCollectionNameById] = useState<Record<string, string>>({});
  const [revisions, setRevisions] = useState<CogitaRevision[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const onResultsChangeRef = useRef(onResultsChange);
  const effectiveQuery = query ?? localQuery;
  const effectiveTypeFilter = typeFilter ?? localTypeFilter;
  const effectiveTypeOptions = revisionTypeOptions ?? revisionTypes.map((type) => type.id);
  const effectiveCollectionNameById = collectionNameById ?? internalCollectionNameById;

  useEffect(() => {
    if (query === undefined) setLocalQuery(defaultQuery);
  }, [defaultQuery, query]);

  useEffect(() => {
    if (typeFilter === undefined) setLocalTypeFilter(defaultTypeFilter);
  }, [defaultTypeFilter, typeFilter]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  }, [onResultsChange]);

  useEffect(() => {
    if (collectionNameById) {
      setInternalCollectionNameById({});
      return;
    }
    getCachedCollections(libraryId)
      .then((items) => {
        const next = items.reduce<Record<string, string>>((acc, item) => {
          acc[item.collectionId] = item.name;
          return acc;
        }, {});
        setInternalCollectionNameById(next);
      })
      .catch(() => setInternalCollectionNameById({}));
  }, [collectionNameById, libraryId]);

  useEffect(() => {
    setStatus('loading');
    setError(null);
    onStatusChangeRef.current?.('loading');
    getCogitaRevisions({ libraryId, collectionId })
      .then((items) => {
        setRevisions(items);
        setStatus('ready');
        onStatusChangeRef.current?.('ready');
      })
      .catch(() => {
        setRevisions([]);
        setStatus('error');
        setError(failedLabel);
        onStatusChangeRef.current?.('error');
      });
  }, [collectionId, failedLabel, libraryId]);

  const filtered = useMemo(() => {
    const needle = effectiveQuery.trim().toLocaleLowerCase();
    const next = revisions.filter((revision) => {
      const typeKey = (revision.revisionType ?? revision.mode ?? 'random').toLowerCase();
      if (effectiveTypeFilter !== 'all' && typeKey !== effectiveTypeFilter) return false;
      if (!needle) return true;
      const collectionLabel = effectiveCollectionNameById[revision.collectionId] ?? '';
      return (
        revision.name.toLocaleLowerCase().includes(needle) ||
        typeKey.includes(needle) ||
        collectionLabel.toLocaleLowerCase().includes(needle)
      );
    });
    return next;
  }, [effectiveCollectionNameById, effectiveQuery, effectiveTypeFilter, revisions]);

  useEffect(() => {
    onResultsChangeRef.current?.(filtered);
  }, [filtered]);

  const handleQueryInputChange = (next: string) => {
    if (onQueryChange) {
      onQueryChange(next);
      return;
    }
    setLocalQuery(next);
  };

  const handleTypeInputChange = (next: string) => {
    if (onTypeFilterChange) {
      onTypeFilterChange(next);
      return;
    }
    setLocalTypeFilter(next);
  };

  const countLabel = useMemo(
    () => countLabelTemplate.replace('{shown}', String(filtered.length)).replace('{total}', String(revisions.length)),
    [countLabelTemplate, filtered.length, revisions.length]
  );

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

      {showTypeFilter ? (
        <label className="cogita-field">
          <span>{modeLabel}</span>
          <select value={effectiveTypeFilter} onChange={(event) => handleTypeInputChange(event.target.value)}>
            <option value="all">{anyTypeLabel}</option>
            {effectiveTypeOptions.map((typeKey) => (
              <option key={`revision-type:${typeKey}`} value={typeKey}>
                {resolveRevisionTypeLabel(typeKey)}
              </option>
            ))}
          </select>
        </label>
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
          {filtered.length ? (
            filtered.map((revision) => {
              const typeKey = (revision.revisionType ?? revision.mode ?? 'random').toLowerCase();
              const href = buildRevisionHref ? buildRevisionHref(revision) : null;
              const collectionLabel = effectiveCollectionNameById[revision.collectionId] ?? revision.collectionId;
              return (
                <div key={revision.revisionId} className="cogita-card-item">
                  <div className="cogita-info-result-row">
                    {href && !onRevisionSelect ? (
                      <a className="cogita-info-result-main" href={href}>
                        <div className="cogita-card-type">{resolveRevisionTypeLabel(typeKey)}</div>
                        <h3 className="cogita-card-title">{revision.name}</h3>
                        <p className="cogita-card-subtitle">{collectionLabel}</p>
                      </a>
                    ) : (
                      <button type="button" className="cogita-info-result-main" onClick={() => onRevisionSelect?.(revision)}>
                        <div className="cogita-card-type">{resolveRevisionTypeLabel(typeKey)}</div>
                        <h3 className="cogita-card-title">{revision.name}</h3>
                        <p className="cogita-card-subtitle">{collectionLabel}</p>
                      </button>
                    )}
                    {showOpenAction && href ? (
                      <a className="ghost" href={href}>
                        {openActionLabel}
                      </a>
                    ) : showOpenAction && onRevisionOpen ? (
                      <button type="button" className="ghost" onClick={() => onRevisionOpen(revision)}>
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
    </div>
  );
}
