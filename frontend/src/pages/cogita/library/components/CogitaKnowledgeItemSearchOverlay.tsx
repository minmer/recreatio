import { useEffect, useRef, useState } from 'react';
import {
  getCogitaInfoCheckcards,
  searchCogitaInfos,
  type CogitaCardSearchResult,
  type CogitaInfoSearchResult
} from '../../../../lib/api';

type SearchResultWithCards = {
  info: CogitaInfoSearchResult;
  cards: CogitaCardSearchResult[];
};

export function CogitaKnowledgeItemSearchOverlay({
  libraryId,
  open,
  title,
  closeLabel,
  searchLabel,
  searchPlaceholder,
  searchingLabel,
  emptyLabel,
  failedLabel,
  resultSuffixLabel,
  onClose,
  onSelect
}: {
  libraryId: string;
  open: boolean;
  title: string;
  closeLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchingLabel: string;
  emptyLabel: string;
  failedLabel: string;
  resultSuffixLabel: string;
  onClose: () => void;
  onSelect: (result: SearchResultWithCards) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultWithCards[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardsCacheRef = useRef(new Map<string, CogitaCardSearchResult[]>());

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const found = await searchCogitaInfos({
          libraryId,
          query: trimmed,
          limit: 24
        });

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
        setResults(enriched.filter((item): item is SearchResultWithCards => Boolean(item)));
      } catch {
        if (cancelled) return;
        setError(failedLabel);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [failedLabel, libraryId, open, query]);

  if (!open) return null;

  return (
    <div className="cogita-overlay" role="dialog" aria-modal="true">
      <div className="cogita-overlay-card">
        <div className="cogita-detail-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="ghost" onClick={onClose}>{closeLabel}</button>
        </div>
        <label className="cogita-field full">
          <span>{searchLabel}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
          />
        </label>
        {loading ? <p className="cogita-help">{searchingLabel}</p> : null}
        {error ? <p className="cogita-form-error">{error}</p> : null}
        {!loading && query.trim().length >= 2 && results.length === 0 ? (
          <p className="cogita-help">{emptyLabel}</p>
        ) : null}
        <div className="cogita-info-tree" style={{ maxHeight: 320, overflow: 'auto' }}>
          {results.map((result) => (
            <button
              key={result.info.infoId}
              type="button"
              className="ghost cogita-checkcard-row"
              onClick={() => onSelect(result)}
            >
              <span>{result.info.label}</span>
              <small>{`${result.info.infoType} · ${result.cards.length} ${resultSuffixLabel}`}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
