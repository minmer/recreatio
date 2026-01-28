import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { createCogitaInfo, searchCogitaInfos } from '../../../../lib/api';
import type { CogitaInfoOption, CogitaInfoType } from '../types';

type InfoSearchSelectCommonProps = {
  libraryId: string;
  infoType: CogitaInfoType;
  label: string;
  placeholder?: string;
  helperText?: string;
  searchFailedText?: string;
  createFailedText?: string;
  createLabel?: string;
  savingLabel?: string;
  loadMoreLabel?: string;
  inputRef?: Ref<HTMLInputElement>;
  autoAdvance?: boolean;
  onCommit?: () => void;
};

type InfoSearchSelectSingleProps = InfoSearchSelectCommonProps & {
  multiple?: false;
  value: CogitaInfoOption | null;
  onChange: (value: CogitaInfoOption | null) => void;
  values?: never;
  onChangeMultiple?: never;
};

type InfoSearchSelectMultiProps = InfoSearchSelectCommonProps & {
  multiple: true;
  values: CogitaInfoOption[];
  onChangeMultiple: (values: CogitaInfoOption[]) => void;
  value?: never;
  onChange?: never;
};

type InfoSearchSelectProps = InfoSearchSelectSingleProps | InfoSearchSelectMultiProps;

const MAX_RESULTS = 5;
const MAX_RESULTS_PER_REQUEST = 50;
const EMPTY_OPTIONS: CogitaInfoOption[] = [];

export function InfoSearchSelect({
  libraryId,
  infoType,
  label,
  placeholder,
  value,
  onChange,
  values,
  onChangeMultiple,
  helperText,
  searchFailedText,
  createFailedText,
  createLabel,
  savingLabel,
  loadMoreLabel,
  inputRef,
  autoAdvance,
  onCommit,
  multiple
}: InfoSearchSelectProps) {
  const selectedValues = multiple ? values ?? EMPTY_OPTIONS : EMPTY_OPTIONS;
  const [query, setQuery] = useState(multiple ? '' : value?.label ?? '');
  const [results, setResults] = useState<CogitaInfoOption[]>([]);
  const [visibleCount, setVisibleCount] = useState(MAX_RESULTS);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequest = useRef(0);

  const showCreate = useMemo(() => {
    if (multiple) {
      return query.trim().length > 0;
    }
    return query.trim().length > 0 && !value;
  }, [query, value, multiple]);

  useEffect(() => {
    if (!multiple) {
      setQuery(value?.label ?? '');
    }
  }, [value, multiple]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      setVisibleCount(MAX_RESULTS);
      setHighlightedIndex(-1);
      return;
    }

    const requestId = window.setTimeout(async () => {
      const currentRequest = Date.now();
      lastRequest.current = currentRequest;
      setIsLoading(true);
      setError(null);
      try {
        const matches = await searchCogitaInfos({ libraryId, type: infoType, query: trimmed });
        if (lastRequest.current !== currentRequest) return;
        const mapped = matches.slice(0, MAX_RESULTS_PER_REQUEST).map((match) => ({
            id: match.infoId,
            label: match.label,
            infoType: match.infoType as CogitaInfoType
        }));
        if (multiple && selectedValues.length > 0) {
          const selectedIds = new Set(selectedValues.map((item) => item.id));
          setResults(mapped.filter((item) => !selectedIds.has(item.id)));
        } else {
          setResults(mapped);
        }
        setVisibleCount(MAX_RESULTS);
        setHighlightedIndex(-1);
        setIsOpen(true);
      } catch {
        if (lastRequest.current !== currentRequest) return;
        setError(searchFailedText ?? 'Search failed.');
      } finally {
        if (lastRequest.current === currentRequest) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(requestId);
  }, [libraryId, infoType, query, selectedValues]);

  const handleSelect = (option: CogitaInfoOption) => {
    if (multiple) {
      const next = selectedValues.some((item) => item.id === option.id)
        ? selectedValues
        : [...selectedValues, option];
      onChangeMultiple?.(next);
      setQuery('');
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }
    onChange?.(option);
    setQuery(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (autoAdvance) {
      onCommit?.();
    }
  };

  const handleCreate = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    try {
      const created = await createCogitaInfo({
        libraryId,
        infoType,
        payload: { label: trimmed }
      });
      const createdOption = { id: created.infoId, label: trimmed, infoType: created.infoType as CogitaInfoType };
      if (multiple) {
        onChangeMultiple?.([...selectedValues, createdOption]);
        setQuery('');
        setIsOpen(false);
        setHighlightedIndex(-1);
        return;
      }
      onChange?.(createdOption);
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (autoAdvance) {
        onCommit?.();
      }
    } catch {
      setError(createFailedText ?? 'Create failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cogita-lookup">
      <label className="cogita-field">
        <span>{label}</span>
        <input
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!multiple && value) onChange?.(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (!results.length) return;
              setIsOpen(true);
              setHighlightedIndex((prev) => {
                const maxVisibleIndex = Math.min(results.length, visibleCount) - 1;
                const next = prev < 0 ? 0 : Math.min(prev + 1, maxVisibleIndex);
                if (next === maxVisibleIndex && results.length > visibleCount) {
                  setVisibleCount((count) => Math.min(count + MAX_RESULTS, results.length));
                  return Math.min(prev + 1, Math.min(results.length, visibleCount + MAX_RESULTS) - 1);
                }
                return next;
              });
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (!results.length) return;
              setIsOpen(true);
              setHighlightedIndex((prev) => {
                const next = prev <= 0 ? 0 : prev - 1;
                return next;
              });
              return;
            }
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (highlightedIndex >= 0 && results[highlightedIndex]) {
              handleSelect(results[highlightedIndex]);
              return;
            }
            if (showCreate) {
              handleCreate();
              return;
            }
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          autoComplete="off"
          ref={inputRef}
        />
      </label>
      {multiple && selectedValues.length > 0 && (
        <div className="cogita-lookup-chips">
          {selectedValues.map((item) => (
            <button
              type="button"
              key={item.id}
              className="cogita-lookup-chip"
              onClick={() => onChangeMultiple?.(selectedValues.filter((entry) => entry.id !== item.id))}
            >
              {item.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      {helperText && <p className="cogita-help">{helperText}</p>}
      {error && <p className="cogita-error">{error}</p>}
      {isOpen && results.length > 0 && (
        <div className="cogita-lookup-results">
          {results.slice(0, visibleCount).map((result, index) => (
            <button
              type="button"
              key={result.id}
              className="cogita-lookup-option"
              data-active={index === highlightedIndex}
              onClick={() => handleSelect(result)}
            >
              <strong>{result.label}</strong>
              <span>{result.infoType}</span>
            </button>
          ))}
          {visibleCount < results.length && (
            <button
              type="button"
              className="cogita-lookup-more"
              onClick={() => setVisibleCount((prev) => Math.min(prev + MAX_RESULTS, results.length))}
            >
              {loadMoreLabel ?? 'Load more'}
            </button>
          )}
        </div>
      )}
      {showCreate && (
        <button type="button" className="cogita-lookup-create" onClick={handleCreate} disabled={isLoading}>
          {isLoading ? savingLabel ?? 'Saving...' : createLabel ?? `Create new ${infoType}`}
        </button>
      )}
    </div>
  );
}
