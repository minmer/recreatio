import { useEffect, useRef, useState } from 'react';
import {
  type CgFieldDef,
  type CgNode,
  type CgNodeKind,
  getNode,
  listNodes,
} from './api/cgApi';
import { CgEntityForm, type LockState } from './CgEntityForm';
import { CgModal } from './CgModal';
import type { Copy } from '../../content/types';

// ── Public types ──────────────────────────────────────────────────────────────

export interface PickedNode {
  id: string;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEBOUNCE = 250;
const MAX_VISIBLE = 5;
const PAGE = 5;
const FETCH_LIMIT = 50;

// ── CreateOption ──────────────────────────────────────────────────────────────

function CreateOption({ query, label, hasSeparator, onMouseDown }: {
  query: string; label: string; hasSeparator: boolean; onMouseDown: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.35rem',
        width: '100%', textAlign: 'left',
        padding: '0.42rem 0.7rem',
        background: hover ? 'var(--cg-cyan)44' : 'var(--cg-cyan)11',
        border: 'none',
        borderTop: hasSeparator ? '1px solid var(--cg-border)' : 'none',
        borderLeft: `3px solid ${hover ? 'var(--cg-cyan)' : 'transparent'}`,
        cursor: 'pointer',
        fontSize: '0.82rem',
        color: hover ? 'var(--cg-text)' : 'var(--cg-cyan)',
        fontWeight: 600,
        transition: 'background 0.1s',
      }}
    >
      <span style={{ opacity: 0.7 }}>+</span>
      <span>Create</span>
      <span style={{
        background: hover ? 'rgba(255,255,255,0.15)' : 'var(--cg-cyan)22',
        borderRadius: '4px', padding: '0.05rem 0.4rem',
        fontSize: '0.76rem', fontStyle: 'italic',
      }}>
        {label}
      </span>
      <span style={{ fontWeight: 400, opacity: 0.8 }}>"{query}"</span>
    </button>
  );
}

// ── CgNodePicker ──────────────────────────────────────────────────────────────
// Reusable controlled component: search existing nodes of a given kind and/or
// create new ones inline. Passes selections up to the parent via onAdd/onRemove.

interface Props {
  copy?: Copy;
  libId: string;
  refKindIds: string[];
  refKindName: string;
  allKinds: CgNodeKind[];
  allDefs: CgFieldDef[];
  selected: PickedNode[];
  onAdd: (node: PickedNode) => void;
  onRemove: (nodeId: string) => void;
  // When provided, chip labels become clickable (opens the referenced entity)
  onClickNode?: (nodeId: string) => void;
  // maxCount: 1 for single-value refs, Infinity for multi-value
  maxCount?: number;
  // depth: prevents infinite nesting of pickers inside create forms
  depth?: number;
}

export function CgNodePicker({
  copy,
  libId,
  refKindIds,
  refKindName,
  allKinds,
  allDefs,
  selected,
  onAdd,
  onRemove,
  onClickNode,
  maxCount = Infinity,
  depth = 0,
}: Props) {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const editKindId = editingNodeId
    ? (allKinds.find((k) => refKindIds.includes(k.id))?.id ?? refKindIds[0] ?? '')
    : '';
  // Which kind to create in the inline form (defaults to first; user can switch when multi-kind)
  const [createKindId, setCreateKindId] = useState(() => refKindIds[0] ?? '');

  const canAddMore = selected.length < maxCount;

  // ── Nested create lock state ──
  const [nestedLockState, setNestedLockState] = useState<LockState>({ lockedRefs: {}, refCounts: {} });
  // ID of node created in inline form (null until first auto-save fires onCreated)
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);

  function toggleNestedLockRef(defId: string, nodeId: string, label: string) {
    setNestedLockState((prev) => {
      const current = prev.lockedRefs[defId] ?? [];
      const exists = current.some((r) => r.id === nodeId);
      return {
        ...prev,
        lockedRefs: {
          ...prev.lockedRefs,
          [defId]: exists ? current.filter((r) => r.id !== nodeId) : [...current, { id: nodeId, label }],
        },
      };
    });
  }

  function toggleNestedLockCount(defId: string, currentCount: number) {
    setNestedLockState((prev) => ({
      ...prev,
      refCounts: {
        ...prev.refCounts,
        [defId]: prev.refCounts[defId] != null ? null : currentCount,
      },
    }));
  }

  // ── Search state ──
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CgNode[]>([]);
  const [visibleCount, setVisibleCount] = useState(MAX_VISIBLE);
  const [highlighted, setHighlighted] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const cache = useRef(new Map<string, CgNode[]>());
  const lastReq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Create-form state ──
  const [showCreate, setShowCreate] = useState(false);

  const selectedIds = new Set(selected.map((n) => n.id));

  // Debounced search — runs across all refKindIds in parallel and merges results
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setIsOpen(false);
      setHighlighted(-1);
      setIsSearching(false);
      return;
    }
    const cacheKey = `${libId}:${refKindIds.join(',')}:${trimmed.toLowerCase()}`;
    const hit = cache.current.get(cacheKey);
    if (hit) {
      setResults(hit.filter((n) => !selectedIds.has(n.id)));
      setVisibleCount(MAX_VISIBLE);
      setHighlighted(-1);
      setIsOpen(true);
      setIsSearching(false);
      return;
    }
    const id = window.setTimeout(async () => {
      const ts = Date.now();
      lastReq.current = ts;
      setIsSearching(true);
      try {
        const perKind = await Promise.all(
          refKindIds.map((kindId) => listNodes(libId, { kindId, q: trimmed, limit: FETCH_LIMIT })),
        );
        if (lastReq.current !== ts) return;
        // Merge and deduplicate preserving order (first kind's results first)
        const seen = new Set<string>();
        const nodes: CgNode[] = [];
        for (const list of perKind) {
          for (const n of list) {
            if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); }
          }
        }
        cache.current.set(cacheKey, nodes);
        setResults(nodes.filter((n) => !selectedIds.has(n.id)));
        setVisibleCount(MAX_VISIBLE);
        setHighlighted(-1);
        setIsOpen(true);
      } catch {
        /* silent */
      } finally {
        if (lastReq.current === ts) setIsSearching(false);
      }
    }, DEBOUNCE);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libId, refKindIds.join(','), query]);

  function pick(node: CgNode) {
    onAdd({ id: node.id, label: node.label ?? '' });
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setHighlighted(-1);
  }

  function openCreate(kindIdOverride?: string) {
    setCreateKindId(kindIdOverride ?? refKindIds[0] ?? '');
    setPendingNodeId(null);
    setShowCreate(true);
    setIsOpen(false);
    setQuery('');
  }

  function closeCreate() {
    setShowCreate(false);
    setPendingNodeId(null);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function addPending() {
    if (!pendingNodeId) return;
    const detail = await getNode(libId, pendingNodeId);
    onAdd({ id: detail.node.id, label: detail.node.label ?? '' });
    closeCreate();
  }

  // After picking via Tab, focus the element that follows this entire picker in DOM order.
  // Runs in a setTimeout so React has re-rendered (input may have unmounted for single-value).
  function focusAfterPicker() {
    window.setTimeout(() => {
      if (!containerRef.current) return;
      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled])',
        ),
      ).filter((el) => el.tabIndex !== -1 && el.offsetParent !== null);

      const inContainer = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), button:not([disabled])',
        ),
      ).filter((el) => el.tabIndex !== -1 && el.offsetParent !== null);

      const anchor = inContainer[inContainer.length - 1];
      if (!anchor) return;
      const idx = focusable.indexOf(anchor);
      if (idx >= 0 && idx < focusable.length - 1) focusable[idx + 1].focus();
    }, 0);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!results.length) return;
      if (!isOpen) {
        // Open and immediately highlight the first row so Tab can pick right away
        setIsOpen(true);
        setHighlighted(0);
        return;
      }
      setHighlighted((prev) => {
        const max = Math.min(results.length, visibleCount) - 1;
        const next = prev < 0 ? 0 : Math.min(prev + 1, max);
        if (next === max && results.length > visibleCount)
          setVisibleCount((c) => Math.min(c + PAGE, results.length));
        return next;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((prev) => (prev <= 0 ? 0 : prev - 1));
      return;
    }
    if (e.key === 'Tab') {
      if (isOpen) {
        e.preventDefault();
        if (highlighted >= 0 && results[highlighted]) {
          // Pick the highlighted row and advance past the whole picker
          pick(results[highlighted]);
        } else {
          // Close the dropdown without picking; don't let Tab land on a dropdown button
          setIsOpen(false);
        }
        focusAfterPicker();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && results[highlighted]) {
        pick(results[highlighted]);
        return;
      }
      if (query.trim()) openCreate();
    }
  }

  const showCreateBtn = query.trim().length >= 1;

  // ── Render ──

  return (
    <div ref={containerRef}>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
          {selected.map((node) => (
            <span
              key={node.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                background: 'var(--cg-cyan)22',
                color: 'var(--cg-cyan)',
                borderRadius: '999px',
                padding: '0.15rem 0.25rem 0.15rem 0.6rem',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              {onClickNode ? (
                <button
                  type="button"
                  onClick={() => onClickNode(node.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'inherit', padding: 0, fontWeight: 'inherit',
                    fontSize: 'inherit', textDecoration: 'underline',
                    textDecorationStyle: 'dotted', textUnderlineOffset: '2px',
                  }}
                >
                  {node.label || '(unnamed)'}
                </button>
              ) : (
                <span>{node.label || '(unnamed)'}</span>
              )}
              {/* Edit chip — opens modal */}
              {copy && (
                <button
                  type="button"
                  onClick={() => setEditingNodeId(node.id)}
                  title="Edit"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'inherit', padding: '0 0.1rem', lineHeight: 1,
                    fontSize: '0.75rem', opacity: 0.7,
                  }}
                >
                  ✎
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(node.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'inherit', padding: '0 0.25rem', lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input — hidden only when at max count */}
      {canAddMore && (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <input
              ref={inputRef}
              className="cg-input"
              style={{ flex: 1 }}
              placeholder={`Search or create ${refKindName}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => {
                if (results.length > 0) setIsOpen(true);
              }}
              onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
            />
            {isSearching && (
              <span style={{ fontSize: '0.75rem', color: 'var(--cg-text-dim)', flexShrink: 0 }}>
                …
              </span>
            )}
          </div>

          {/* Dropdown */}
          {isOpen && (results.length > 0 || showCreateBtn) && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                background: 'var(--cg-surface)',
                border: '1px solid var(--cg-border)',
                borderRadius: 'var(--cg-radius)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                marginTop: 3,
              }}
            >
              {results.slice(0, visibleCount).map((node, idx) => (
                <button
                  key={node.id}
                  type="button"
                  onMouseDown={() => pick(node)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.4rem 0.7rem',
                    background: idx === highlighted ? 'var(--cg-cyan)22' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: idx === highlighted ? 'var(--cg-cyan)' : 'var(--cg-text)',
                  }}
                >
                  <span>{node.label ?? '(unnamed)'}</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--cg-text-dim)',
                      marginLeft: '0.5rem',
                    }}
                  >
                    {refKindName}
                  </span>
                </button>
              ))}
              {results.length > visibleCount && (
                <button
                  type="button"
                  onMouseDown={() => setVisibleCount((c) => c + PAGE)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'center',
                    padding: '0.3rem',
                    background: 'none',
                    border: 'none',
                    borderTop: '1px solid var(--cg-border)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    color: 'var(--cg-text-dim)',
                  }}
                >
                  Load more
                </button>
              )}
              {showCreateBtn && (
                <CreateOption
                  query={query.trim()}
                  label={refKindName}
                  hasSeparator={results.length > 0}
                  onMouseDown={() => openCreate()}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Inline create form */}
      {showCreate && (
        <div
          style={{
            border: '1px solid var(--cg-cyan)44',
            borderRadius: 'var(--cg-radius)',
            marginTop: '0.35rem',
            overflow: 'hidden',
          }}
        >
          {/* Header: kind selector (multi-kind) or kind name + close */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            padding: '0.3rem 0.5rem',
            borderBottom: '1px solid var(--cg-cyan)33',
            background: 'var(--cg-cyan)08',
          }}>
            {refKindIds.length > 1 ? (
              <select
                className="cg-select"
                style={{ fontSize: '0.78rem', padding: '0.1rem 0.3rem', flex: 1 }}
                value={createKindId}
                onChange={(e) => openCreate(e.target.value)}
              >
                {refKindIds.map((kid) => {
                  const kObj = allKinds.find((k) => k.id === kid);
                  return kObj ? <option key={kid} value={kid}>{kObj.name}</option> : null;
                })}
              </select>
            ) : (
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--cg-cyan)', flex: 1,
              }}>
                {refKindName}
              </span>
            )}
            <button
              type="button"
              tabIndex={-1}
              title="Close"
              onClick={closeCreate}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--cg-text-dim)', fontSize: '0.85rem', lineHeight: 1,
                padding: '0 0.1rem',
              }}
            >
              ×
            </button>
          </div>

          {/* CgEntityForm with lock support */}
          <CgEntityForm
            libId={libId}
            kinds={allKinds}
            fieldDefs={allDefs}
            kindId={createKindId}
            nodeId={null}
            lockState={nestedLockState}
            onToggleLockRef={toggleNestedLockRef}
            onToggleLockCount={toggleNestedLockCount}
            onCreated={(node) => setPendingNodeId(node.id)}
            depth={(depth ?? 0) + 1}
          />

          {/* Footer: Add button (appears once the node is created via auto-save) */}
          {pendingNodeId && (
            <div style={{
              padding: '0.3rem 0.5rem',
              borderTop: '1px solid var(--cg-cyan)33',
              background: 'var(--cg-cyan)08',
            }}>
              <button
                type="button"
                className="cg-btn cg-btn-primary cg-btn-sm"
                onClick={addPending}
              >
                + Add {refKindName}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit modal — opens CgEntityForm for chip editing */}
      {copy && (
        <CgModal
          isOpen={!!editingNodeId}
          onClose={() => setEditingNodeId(null)}
        >
          {editingNodeId && editKindId && (
            <CgEntityForm
              copy={copy}
              libId={libId}
              kinds={allKinds}
              fieldDefs={allDefs}
              kindId={editKindId}
              nodeId={editingNodeId}
              onOpenNode={onClickNode}
              depth={0}
            />
          )}
        </CgModal>
      )}
    </div>
  );
}
