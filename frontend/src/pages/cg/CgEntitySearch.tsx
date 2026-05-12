import { useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgNode,
  type CgNodeKind,
  listNodes,
} from './api/cgApi';
import { CgEntityEditor } from './CgEntityEditor';

const DEBOUNCE = 250;
const LIMIT = 10;

interface Props {
  copy: Copy;
  libId: string;
  kinds: CgNodeKind[];
  fieldDefs: CgFieldDef[];
  selectedKindId: string;
  onKindChange: (kindId: string) => void;
  // Called only when a NEW entity is created (not when picking existing)
  onCreated: (node: CgNode) => void;
  onOpenNode?: (nodeId: string) => void;
}

// undefined = editor closed, null = new entity, string = editing existing id
type ActiveEditor = string | null | undefined;

export function CgEntitySearch({
  copy, libId, kinds, fieldDefs, selectedKindId, onKindChange, onCreated, onOpenNode,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CgNode[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  // Active editor: undefined=closed, null=new, string=existing node id
  const [active, setActive] = useState<ActiveEditor>(undefined);
  const [activeLabel, setActiveLabel] = useState('');

  // Batch state
  const [targetCount, setTargetCount] = useState(1);
  const [addedCount, setAddedCount] = useState(0);

  // Lock state persisted between successive entity creations
  const [lockedRefNodeIds, setLockedRefNodeIds] = useState<Set<string>>(new Set());
  const [lockedRefCounts, setLockedRefCounts] = useState<Record<string, number | null>>({});

  const cache = useRef(new Map<string, CgNode[]>());
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedKind = kinds.find((k) => k.id === selectedKindId);

  // Reset on kind change
  useEffect(() => {
    setActive(undefined);
    setQuery('');
    setResults([]);
    setLockedRefNodeIds(new Set());
    setLockedRefCounts({});
    setAddedCount(0);
  }, [selectedKindId]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }
    const key = `${libId}:${selectedKindId}:${trimmed.toLowerCase()}`;
    const hit = cache.current.get(key);
    if (hit) {
      setResults(hit);
      setHighlighted(hit.length > 0 ? 0 : results.length); // highlight "Create new" if no results
      setIsOpen(true);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await listNodes(libId, { kindId: selectedKindId, q: trimmed, limit: LIMIT });
        cache.current.set(key, res);
        setResults(res);
        setHighlighted(res.length > 0 ? 0 : 0); // always start at first item
        setIsOpen(true);
      } catch { /* silent */ } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [libId, selectedKindId, query]);

  function openExisting(node: CgNode) {
    setActive(node.id);
    setActiveLabel(node.label ?? '');
    setQuery('');
    setIsOpen(false);
  }

  function openNew() {
    setActive(null);
    setActiveLabel(query.trim());
    setQuery('');
    setIsOpen(false);
  }

  function handleNext() {
    setActive(undefined);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleCreated(node: CgNode) {
    onCreated(node);
    const next = addedCount + 1;
    setAddedCount(next >= targetCount ? 0 : next);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    const itemCount = results.length + 1; // results + "Create new"
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, itemCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < results.length) {
        openExisting(results[highlighted]);
      } else {
        openNew();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  const showEditor = active !== undefined;
  const progress = targetCount > 1 && addedCount > 0;

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Header: kind selector + count */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.65rem',
      }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--cg-text-dim)', flexShrink: 0,
        }}>
          {copy.cg.graph.addNode}
        </span>
        <select
          className="cg-select"
          value={selectedKindId}
          onChange={(e) => onKindChange(e.target.value)}
        >
          {kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--cg-text-dim)' }}>×</span>
          <input
            type="number"
            className="cg-input"
            min={1}
            max={999}
            value={targetCount}
            onChange={(e) => { setTargetCount(Math.max(1, Number(e.target.value))); setAddedCount(0); }}
            style={{ width: '4rem', textAlign: 'center' }}
            title="How many to add"
          />
        </div>
      </div>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: showEditor || progress ? '0.65rem' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <input
            ref={inputRef}
            className="cg-input"
            style={{ flex: 1 }}
            placeholder={`Search or create ${selectedKind?.name ?? ''}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => { if (results.length > 0 || query.trim()) setIsOpen(true); }}
            onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          />
          {isSearching && (
            <span style={{ fontSize: '0.75rem', color: 'var(--cg-text-dim)', flexShrink: 0 }}>…</span>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (results.length > 0 || query.trim()) && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--cg-surface)', border: '1px solid var(--cg-border)',
            borderRadius: 'var(--cg-radius)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            marginTop: 3,
          }}>
            {results.map((node, idx) => (
              <button
                key={node.id}
                type="button"
                onMouseDown={() => openExisting(node)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem',
                  background: idx === highlighted ? 'var(--cg-cyan)22' : 'none',
                  color: idx === highlighted ? 'var(--cg-cyan)' : 'var(--cg-text)',
                  border: 'none', cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                <span>{node.label ?? '(unnamed)'}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--cg-text-dim)' }}>
                  {selectedKind?.name}
                </span>
              </button>
            ))}
            {/* Create new — always visible when there's a query */}
            {query.trim() && (
              <button
                type="button"
                onMouseDown={openNew}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.45rem 0.75rem',
                  background: highlighted === results.length ? 'var(--cg-cyan)22' : 'none',
                  color: 'var(--cg-cyan)',
                  border: 'none',
                  borderTop: results.length > 0 ? '1px solid var(--cg-border)' : 'none',
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                }}
              >
                + Create "{query.trim()}"
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar (batch mode) */}
      {progress && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
          <div style={{
            flex: 1, height: '3px', background: 'var(--cg-border)',
            borderRadius: '999px', overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, (addedCount / targetCount) * 100)}%`,
              height: '100%', background: 'var(--cg-cyan)', borderRadius: '999px',
              transition: 'width 0.2s ease',
            }} />
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--cg-text-dim)', flexShrink: 0 }}>
            {addedCount} / {targetCount}
          </span>
        </div>
      )}

      {/* Entity editor */}
      {showEditor && selectedKindId && (
        <CgEntityEditor
          copy={copy}
          libId={libId}
          kinds={kinds}
          fieldDefs={fieldDefs}
          kindId={selectedKindId}
          initialNodeId={active}
          initialLabel={activeLabel}
          lockedRefNodeIds={lockedRefNodeIds}
          lockedRefCounts={lockedRefCounts}
          onToggleLockRef={(nodeId) =>
            setLockedRefNodeIds((prev) => {
              const next = new Set(prev);
              if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
              return next;
            })
          }
          onToggleLockCount={(defId, count) =>
            setLockedRefCounts((prev) => ({ ...prev, [defId]: count }))
          }
          onCreated={handleCreated}
          onClose={() => setActive(undefined)}
          onOpenNode={onOpenNode}
          onNext={targetCount > 1 ? handleNext : undefined}
          nextLabel={targetCount > 1 ? `Next (${addedCount + 1} / ${targetCount})` : undefined}
          depth={0}
        />
      )}
    </div>
  );
}
