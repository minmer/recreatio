import { useState, useEffect, useRef, useCallback } from 'react';
import { searchCgEntities, resolveCgEntities, CgEntitySearchItem } from '../cgApi';

type Props = {
  libId: number;
  targetTypeDefIds: number[];
  value: number[];
  onChange: (ids: number[]) => void;
  multiple: boolean;
  isOrdered: boolean;
};

export function CgReferenceInput({ libId, targetTypeDefIds, value, onChange, multiple, isOrdered }: Props) {
  const [resolved, setResolved] = useState<CgEntitySearchItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CgEntitySearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.length === 0) { setResolved([]); return; }
    resolveCgEntities(libId, value)
      .then(items => {
        const ordered = value.map(id => items.find(i => i.id === id)).filter(Boolean) as CgEntitySearchItem[];
        setResolved(ordered);
      })
      .catch(() => {});
  }, [libId, value.join(',')]);

  const search = useCallback((term: string) => {
    if (!term.trim()) { setResults([]); return; }
    const typeIds = targetTypeDefIds.length > 0 ? targetTypeDefIds : undefined;
    searchCgEntities(libId, term, typeIds, 20)
      .then(items => setResults(items.filter(i => !value.includes(i.id))))
      .catch(() => {});
  }, [libId, targetTypeDefIds.join(','), value.join(',')]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 250);
  };

  const select = (item: CgEntitySearchItem) => {
    if (multiple) {
      onChange([...value, item.id]);
    } else {
      onChange([item.id]);
    }
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const remove = (id: number) => {
    onChange(value.filter(v => v !== id));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...value];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };

  const moveDown = (idx: number) => {
    if (idx === value.length - 1) return;
    const next = [...value];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  };

  const showInput = multiple || value.length === 0;

  return (
    <div className="cg-ref-input">
      <div className="cg-ref-chips">
        {resolved.map((item, idx) => (
          <span key={item.id} className="cg-ref-chip">
            <span className="cg-ref-chip-label">{item.displayValue}</span>
            <span className="cg-ref-chip-type">{item.typeDefName}</span>
            {isOrdered && (
              <>
                <button type="button" className="cg-ref-chip-btn" onClick={() => moveUp(idx)} disabled={idx === 0}>▲</button>
                <button type="button" className="cg-ref-chip-btn" onClick={() => moveDown(idx)} disabled={idx === value.length - 1}>▼</button>
              </>
            )}
            <button type="button" className="cg-ref-chip-remove" onClick={() => remove(item.id)}>×</button>
          </span>
        ))}
      </div>
      {showInput && (
        <div className="cg-ref-search-wrap">
          <input
            ref={inputRef}
            type="text"
            className="cg-input"
            placeholder="Search..."
            value={query}
            onChange={handleInput}
            onFocus={() => query && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && results.length > 0 && (
            <ul className="cg-ref-dropdown">
              {results.map(item => (
                <li key={item.id} className="cg-ref-dropdown-item" onMouseDown={() => select(item)}>
                  <span>{item.displayValue}</span>
                  <span className="cg-ref-chip-type">{item.typeDefName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
