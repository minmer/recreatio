import { useCallback, useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgNode,
  type CgNodeKind,
  deleteNode,
  getKindLabel,
  listNodes,
} from './api/cgApi';
import { CgEntityForm, type LockState } from './CgEntityForm';
import { CgModal } from './CgModal';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CgEntityPanelProps {
  copy: Copy;
  libId: string;
  kinds: CgNodeKind[];
  fieldDefs: CgFieldDef[];

  // Feature flags
  allowSearch?: boolean;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;

  // compact = small input+dropdown (ref picker use case)
  // full    = input + kind-filter chips + scrollable list (graph page use case)
  compact?: boolean;

  // Compact mode only: restrict to specific kinds; fires when user picks/removes
  refKindIds?: string[];
  selected?: { id: string; label: string }[];
  onPick?: (node: CgNode) => void;
  onRemove?: (nodeId: string) => void;
  maxCount?: number;

  // Full mode callbacks
  onCreated?: (node: CgNode) => void;
  onDeleted?: (nodeId: string) => void;
  onOpenNode?: (nodeId: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEBOUNCE = 250;
const COMPACT_LIMIT = 10;
const FULL_LIMIT = 500;

// ── Component ─────────────────────────────────────────────────────────────────

export function CgEntityPanel({
  copy, libId, kinds, fieldDefs,
  allowSearch = true,
  allowCreate = true,
  allowEdit = true,
  allowDelete = false,
  compact = false,
  refKindIds,
  selected = [],
  onPick,
  onRemove,
  maxCount = Infinity,
  onCreated,
  onDeleted,
  onOpenNode,
}: CgEntityPanelProps) {

  // ── Effective kinds for this panel ──
  // In compact mode, restrict to refKindIds if provided
  const effectiveKinds = refKindIds
    ? kinds.filter((k) => refKindIds.includes(k.id))
    : kinds;

  // ── Search state ──
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CgNode[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const cache = useRef(new Map<string, CgNode[]>());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Full-mode state ──
  const [nodes, setNodes] = useState<CgNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(!compact);
  const [activeKindIds, setActiveKindIds] = useState<Set<string>>(new Set()); // empty = all
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Modal state ──
  // undefined = closed, null = new entity, string = existing node id
  const [modalNodeId, setModalNodeId] = useState<string | null | undefined>(undefined);
  const [modalKindId, setModalKindId] = useState<string>('');

  // ── Batch / lock state ──
  const [targetCount, setTargetCount] = useState(1);
  const [addedCount, setAddedCount] = useState(0);
  const [lockState, setLockState] = useState<LockState>({ lockedRefs: {}, refCounts: {} });

  // ── Load full-mode node list ──
  const loadNodes = useCallback(() => {
    if (compact) return;
    setLoadingNodes(true);
    const kindId = activeKindIds.size === 1
      ? [...activeKindIds][0]
      : undefined;
    listNodes(libId, { q: query || undefined, kindId, limit: FULL_LIMIT })
      .then((list) => {
        // client-side filter if multiple kinds active
        if (activeKindIds.size > 1) {
          setNodes(list.filter((n) => n.nodeKindId && activeKindIds.has(n.nodeKindId)));
        } else {
          setNodes(list);
        }
      })
      .catch(() => {/* silent */})
      .finally(() => setLoadingNodes(false));
  }, [compact, libId, query, activeKindIds]);

  useEffect(() => { loadNodes(); }, [loadNodes]);

  // ── Debounced search (dropdown) ──
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchOpen(false);
      setIsSearching(false);
      return;
    }
    // In full mode, search is handled by loadNodes; dropdown only in compact
    if (!compact && !allowCreate) return;

    const kindIds = refKindIds ?? effectiveKinds.map((k) => k.id);
    const cacheKey = `${libId}:${kindIds.join(',')}:${trimmed.toLowerCase()}`;
    const hit = cache.current.get(cacheKey);
    if (hit) {
      const selectedIds = new Set(selected.map((s) => s.id));
      setResults(hit.filter((n) => !selectedIds.has(n.id)));
      setHighlighted(0);
      setSearchOpen(true);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const perKind = await Promise.all(
          kindIds.map((kid) => listNodes(libId, { kindId: kid, q: trimmed, limit: COMPACT_LIMIT })),
        );
        const seen = new Set<string>();
        const merged: CgNode[] = [];
        for (const list of perKind) {
          for (const n of list) {
            if (!seen.has(n.id)) { seen.add(n.id); merged.push(n); }
          }
        }
        cache.current.set(cacheKey, merged);
        const selectedIds = new Set(selected.map((s) => s.id));
        setResults(merged.filter((n) => !selectedIds.has(n.id)));
        setHighlighted(0);
        setSearchOpen(true);
      } catch {/* silent */} finally {
        setIsSearching(false);
      }
    }, DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [libId, query, compact]);

  // ── Modal open helpers ──

  function openCreate(kindId: string) {
    setModalKindId(kindId);
    setModalNodeId(null);
    setQuery('');
    setSearchOpen(false);
  }

  function openEdit(nodeId: string, kindId: string) {
    setModalKindId(kindId);
    setModalNodeId(nodeId);
  }

  function closeModal() {
    setModalNodeId(undefined);
  }

  // ── Entity created inside modal ──

  function handleCreated(node: CgNode) {
    if (compact) {
      if (selected.length < maxCount) onPick?.(node);
    } else {
      setNodes((prev) => (prev.some((n) => n.id === node.id) ? prev : [node, ...prev]));
      onCreated?.(node);
    }
    const next = addedCount + 1;
    setAddedCount(next >= targetCount ? 0 : next);
  }

  function handleNext() {
    closeModal();
    window.setTimeout(() => {
      // Re-open create modal with same kind, locked state intact
      setModalKindId(modalKindId);
      setModalNodeId(null);
    }, 50);
  }

  // ── Delete ──

  async function handleDelete(nodeId: string) {
    try {
      await deleteNode(libId, nodeId);
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setDeleteConfirm(null);
      onDeleted?.(nodeId);
    } catch {/* silent */}
  }

  // ── Lock state toggles ──

  function toggleLockRef(defId: string, nodeId: string, label: string) {
    setLockState((prev) => {
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

  function toggleLockCount(defId: string, currentCount: number) {
    setLockState((prev) => ({
      ...prev,
      refCounts: {
        ...prev.refCounts,
        [defId]: prev.refCounts[defId] != null ? null : currentCount,
      },
    }));
  }

  // ── Kind chip toggle (full mode) ──

  function toggleKind(kindId: string) {
    setActiveKindIds((prev) => {
      const next = new Set(prev);
      if (next.has(kindId)) next.delete(kindId); else next.add(kindId);
      return next;
    });
  }

  // ── Keyboard navigation ──

  const allDropdownItems = results.length
    + (allowCreate ? effectiveKinds.length : 0);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, allDropdownItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < results.length) {
        const node = results[highlighted];
        if (compact) onPick?.(node);
        else openEdit(node.id, node.nodeKindId ?? effectiveKinds[0]?.id ?? '');
      } else if (allowCreate) {
        const createIdx = highlighted - results.length;
        const targetKind = effectiveKinds[createIdx] ?? effectiveKinds[0];
        if (targetKind) openCreate(targetKind.id);
      }
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  }

  // ── Rendered dropdown ──

  const canAddMore = selected.length < maxCount;

  const dropdown = searchOpen && (results.length > 0 || (allowCreate && query.trim())) && (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
      background: 'var(--cg-surface)', border: '1px solid var(--cg-border)',
      borderRadius: 'var(--cg-radius)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      marginTop: 3,
    }}>
      {/* Existing results */}
      {results.map((node, idx) => (
        <button
          key={node.id}
          type="button"
          onMouseDown={() => {
            if (compact) {
              if (canAddMore) onPick?.(node);
            } else {
              openEdit(node.id, node.nodeKindId ?? effectiveKinds[0]?.id ?? '');
            }
            setQuery('');
            setSearchOpen(false);
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', textAlign: 'left', padding: '0.42rem 0.75rem',
            background: idx === highlighted ? 'var(--cg-cyan)22' : 'none',
            color: idx === highlighted ? 'var(--cg-cyan)' : 'var(--cg-text)',
            border: 'none', cursor: canAddMore || !compact ? 'pointer' : 'default',
            fontSize: '0.85rem',
          }}
        >
          <span>{node.label ?? '(unnamed)'}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--cg-text-dim)', marginLeft: '0.5rem' }}>
            {(() => { const k = node.nodeKindId ? kinds.find((kk) => kk.id === node.nodeKindId) : undefined; return k ? getKindLabel(k, fieldDefs) : ''; })()}
          </span>
        </button>
      ))}

      {/* Create options — one per kind */}
      {allowCreate && query.trim() && (
        <div style={{ borderTop: results.length > 0 ? '1px solid var(--cg-border)' : 'none' }}>
          {effectiveKinds.map((k, i) => {
            const idx = results.length + i;
            const isHl = idx === highlighted;
            return (
              <button
                key={k.id}
                type="button"
                onMouseDown={() => { openCreate(k.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  width: '100%', textAlign: 'left',
                  padding: '0.45rem 0.75rem',
                  background: isHl ? 'var(--cg-cyan)44' : 'var(--cg-cyan)11',
                  color: isHl ? 'var(--cg-text)' : 'var(--cg-cyan)',
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: 600,
                  borderLeft: `3px solid ${isHl ? 'var(--cg-cyan)' : 'transparent'}`,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ opacity: 0.7 }}>+</span>
                <span>Create</span>
                <span style={{
                  background: isHl ? 'rgba(255,255,255,0.15)' : 'var(--cg-cyan)22',
                  borderRadius: '4px', padding: '0.05rem 0.4rem',
                  fontSize: '0.76rem', fontStyle: 'italic',
                }}>
                  {getKindLabel(k, fieldDefs)}
                </span>
                <span style={{ fontWeight: 400, opacity: 0.8 }}>"{query.trim()}"</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Modal content ──

  const modalOpen = modalNodeId !== undefined;
  const isCreating = modalNodeId === null;

  // ── Render: compact mode ──

  if (compact) {
    return (
      <div>
        {/* Selected chips */}
        {selected.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
            {selected.map((node) => (
              <span
                key={node.id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                  background: 'var(--cg-cyan)1e', color: 'var(--cg-cyan)',
                  borderRadius: '999px', padding: '0.13rem 0.25rem 0.13rem 0.6rem',
                  fontSize: '0.82rem', fontWeight: 600,
                }}
              >
                <span
                  style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '2px' }}
                  onClick={allowEdit ? () => {
                    const kindId = effectiveKinds[0]?.id ?? '';
                    openEdit(node.id, kindId);
                  } : undefined}
                >
                  {node.label || '(unnamed)'}
                </span>
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(node.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 0.25rem', lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        {canAddMore && allowSearch && (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input
                ref={searchInputRef}
                className="cg-input"
                style={{ flex: 1 }}
                placeholder={`Search or create ${effectiveKinds.map((k) => getKindLabel(k, fieldDefs)).join(' / ')}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                onFocus={() => { if (results.length > 0 || query.trim()) setSearchOpen(true); }}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              />
              {isSearching && (
                <span style={{ fontSize: '0.75rem', color: 'var(--cg-text-dim)' }}>…</span>
              )}
            </div>
            {dropdown}
          </div>
        )}

        {/* Edit modal */}
        <CgModal
          isOpen={modalOpen}
          onClose={closeModal}
          title={isCreating
            ? `New ${(() => { const k = kinds.find((kk) => kk.id === modalKindId); return k ? getKindLabel(k, fieldDefs) : ''; })()}`
            : undefined}
        >
          {modalOpen && modalKindId && (
            <CgEntityForm
              copy={copy}
              libId={libId}
              kinds={kinds}
              fieldDefs={fieldDefs}
              kindId={modalKindId}
              nodeId={modalNodeId}

              lockState={lockState}
              onToggleLockRef={toggleLockRef}
              onToggleLockCount={toggleLockCount}
              onCreated={handleCreated}
              onOpenNode={onOpenNode}
              onNext={targetCount > 1 ? handleNext : undefined}
              nextLabel={targetCount > 1 ? `Next (${addedCount + 1} / ${targetCount})` : undefined}
              onAddAnother={isCreating ? handleNext : undefined}
              depth={0}
            />
          )}
        </CgModal>
      </div>
    );
  }

  // ── Render: full mode ──

  const kindMap = Object.fromEntries(kinds.map((k) => [k.id, k]));

  return (
    <div>
      {/* Search bar + kind filter chips + batch count */}
      <div style={{
        background: 'var(--cg-surface)', border: '1px solid var(--cg-border)',
        borderRadius: 'var(--cg-radius)', padding: '0.85rem 1rem', marginBottom: '1rem',
      }}>
        {/* Row 1: search input + count */}
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={searchInputRef}
              className="cg-input"
              style={{ width: '100%' }}
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => { if (results.length > 0 || query.trim()) setSearchOpen(true); }}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
            />
            {isSearching && (
              <span style={{
                position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                fontSize: '0.75rem', color: 'var(--cg-text-dim)',
              }}>
                …
              </span>
            )}
            {dropdown}
          </div>
          {allowCreate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--cg-text-dim)' }}>×</span>
              <input
                type="number"
                className="cg-input"
                min={1} max={999}
                value={targetCount}
                onChange={(e) => { setTargetCount(Math.max(1, Number(e.target.value))); setAddedCount(0); }}
                style={{ width: '4rem', textAlign: 'center' }}
                title="How many to add"
              />
            </div>
          )}
        </div>

        {/* Row 2: kind filter toggle chips */}
        {kinds.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {kinds.map((k) => {
              const active = activeKindIds.has(k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => toggleKind(k.id)}
                  style={{
                    padding: '0.15rem 0.6rem',
                    borderRadius: '999px',
                    border: `1px solid ${active ? 'var(--cg-cyan)' : 'var(--cg-border)'}`,
                    background: active ? 'var(--cg-cyan)22' : 'transparent',
                    color: active ? 'var(--cg-cyan)' : 'var(--cg-text-dim)',
                    fontSize: '0.75rem', fontWeight: active ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {getKindLabel(k, fieldDefs)}
                </button>
              );
            })}
          </div>
        )}

        {/* Progress bar (batch mode) */}
        {targetCount > 1 && addedCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.55rem' }}>
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
      </div>

      {/* Node list */}
      {loadingNodes ? (
        <div className="cg-loading">Loading…</div>
      ) : nodes.length === 0 ? (
        <div className="cg-empty">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>◎</p>
          <p>{copy.cg.graph.noNodes}</p>
          <p>{copy.cg.graph.noNodesDesc}</p>
        </div>
      ) : (
        <div className="cg-table-wrap">
          <table className="cg-table">
            <thead>
              <tr>
                <th>{copy.cg.graph.labelColumn}</th>
                <th>{copy.cg.graph.typeColumn}</th>
                <th style={{ width: allowEdit && allowDelete ? '9rem' : allowEdit || allowDelete ? '6rem' : '0' }} />
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  kindMap={kindMap}
                  fieldDefs={fieldDefs}
                  allowEdit={allowEdit}
                  allowDelete={allowDelete}
                  deleteConfirm={deleteConfirm}
                  onEdit={() => openEdit(node.id, node.nodeKindId ?? kinds[0]?.id ?? '')}
                  onOpenNode={onOpenNode}
                  onDeleteRequest={() => setDeleteConfirm(node.id)}
                  onDeleteConfirm={() => handleDelete(node.id)}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                  copy={copy}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / create modal */}
      <CgModal
        isOpen={modalOpen}
        onClose={closeModal}
        title={isCreating
          ? `New ${(() => { const k = kinds.find((kk) => kk.id === modalKindId); return k ? getKindLabel(k, fieldDefs) : ''; })()}`
          : undefined}
      >
        {modalOpen && modalKindId && (
          <CgEntityForm
            copy={copy}
            libId={libId}
            kinds={kinds}
            fieldDefs={fieldDefs}
            kindId={modalKindId}
            nodeId={modalNodeId}
            lockState={isCreating ? lockState : undefined}
            onToggleLockRef={isCreating ? toggleLockRef : undefined}
            onToggleLockCount={isCreating ? toggleLockCount : undefined}
            onCreated={handleCreated}
            onOpenNode={onOpenNode}
            onNext={isCreating && targetCount > 1 ? handleNext : undefined}
            nextLabel={isCreating && targetCount > 1
              ? `Next (${addedCount + 1} / ${targetCount})`
              : undefined}
            onAddAnother={isCreating ? handleNext : undefined}
            depth={0}
          />
        )}
      </CgModal>
    </div>
  );
}

// ── NodeRow ───────────────────────────────────────────────────────────────────

function NodeRow({
  node, kindMap, fieldDefs, allowEdit, allowDelete,
  deleteConfirm, onEdit, onOpenNode,
  onDeleteRequest, onDeleteConfirm, onDeleteCancel,
  copy,
}: {
  node: CgNode;
  kindMap: Record<string, CgNodeKind>;
  fieldDefs: CgFieldDef[];
  allowEdit: boolean;
  allowDelete: boolean;
  deleteConfirm: string | null;
  onEdit: () => void;
  onOpenNode?: (nodeId: string) => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  copy: Copy;
}) {
  const isConfirming = deleteConfirm === node.id;
  const kindForNode = node.nodeKindId ? kindMap[node.nodeKindId] : undefined;

  return (
    <tr>
      <td>
        <button
          type="button"
          onClick={() => onOpenNode ? onOpenNode(node.id) : onEdit()}
          style={{
            background: 'none', border: 'none',
            color: 'var(--cg-cyan)', cursor: 'pointer',
            fontWeight: 600, textAlign: 'left', padding: 0,
          }}
        >
          {node.label ?? '(unnamed)'}
        </button>
      </td>
      <td>
        <span className="cg-field-type" style={{ fontSize: '0.78rem' }}>
          {kindForNode ? getKindLabel(kindForNode, fieldDefs) : (node.nodeKindId ? '—' : node.nodeType)}
        </span>
      </td>
      <td>
        <div className="cg-table-actions">
          {isConfirming ? (
            <>
              <button className="cg-btn cg-btn-danger cg-btn-sm" type="button" onClick={onDeleteConfirm}>
                Del
              </button>
              <button className="cg-btn cg-btn-ghost cg-btn-sm" type="button" onClick={onDeleteCancel}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {allowEdit && (
                <button
                  className="cg-btn cg-btn-ghost cg-btn-sm"
                  type="button"
                  onClick={onEdit}
                >
                  {copy.cg.graph.editAction}
                </button>
              )}
              {allowDelete && (
                <button
                  className="cg-btn cg-btn-ghost cg-btn-sm"
                  type="button"
                  onClick={onDeleteRequest}
                >
                  ✕
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
