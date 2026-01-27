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
  inputRef,
  autoAdvance,
  onCommit,
  multiple
}: InfoSearchSelectProps) {
  const selectedValues = multiple ? values ?? EMPTY_OPTIONS : EMPTY_OPTIONS;
  const [query, setQuery] = useState(multiple ? '' : value?.label ?? '');
  const [results, setResults] = useState<CogitaInfoOption[]>([]);
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
        const mapped = matches.slice(0, MAX_RESULTS).map((match) => ({
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
      return;
    }
    onChange?.(option);
    setQuery(option.label);
    setIsOpen(false);
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
        return;
      }
      onChange?.(createdOption);
      setIsOpen(false);
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
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (results.length > 0) {
              handleSelect(results[0]);
              return;
            }
            if (showCreate) {
              handleCreate();
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
          {results.map((result) => (
            <button
              type="button"
              key={result.id}
              className="cogita-lookup-option"
              onClick={() => handleSelect(result)}
            >
              <strong>{result.label}</strong>
              <span>{result.infoType}</span>
            </button>
          ))}
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
