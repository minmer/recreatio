import { useEffect, useMemo, useRef, useState } from 'react';
import { createCogitaInfo, searchCogitaInfos } from '../../../../lib/api';
import type { CogitaInfoOption, CogitaInfoType } from '../types';

type InfoSearchSelectProps = {
  libraryId: string;
  infoType: CogitaInfoType;
  label: string;
  placeholder?: string;
  value: CogitaInfoOption | null;
  onChange: (value: CogitaInfoOption | null) => void;
  helperText?: string;
};

const MAX_RESULTS = 5;

export function InfoSearchSelect({
  libraryId,
  infoType,
  label,
  placeholder,
  value,
  onChange,
  helperText
}: InfoSearchSelectProps) {
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<CogitaInfoOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequest = useRef(0);

  const showCreate = useMemo(() => query.trim().length > 0 && !value, [query, value]);

  useEffect(() => {
    setQuery(value?.label ?? '');
  }, [value]);

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
        setResults(
          matches.slice(0, MAX_RESULTS).map((match) => ({
            id: match.infoId,
            label: match.label,
            infoType: match.infoType as CogitaInfoType
          }))
        );
        setIsOpen(true);
      } catch {
        if (lastRequest.current !== currentRequest) return;
        setError('Search failed.');
      } finally {
        if (lastRequest.current === currentRequest) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(requestId);
  }, [libraryId, infoType, query]);

  const handleSelect = (option: CogitaInfoOption) => {
    onChange(option);
    setQuery(option.label);
    setIsOpen(false);
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
      onChange({ id: created.infoId, label: trimmed, infoType: created.infoType as CogitaInfoType });
      setIsOpen(false);
    } catch {
      setError('Create failed.');
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
            if (value) onChange(null);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          autoComplete="off"
        />
      </label>
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
          {isLoading ? 'Saving...' : `Create new ${infoType}`}
        </button>
      )}
    </div>
  );
}
