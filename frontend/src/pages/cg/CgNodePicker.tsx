import { useEffect, useRef, useState } from 'react';
import {
  type CgFieldDef,
  type CgNode,
  type CgNodeKind,
  createNode,
  getRefKindIds,
  listNodes,
  upsertFieldValue,
} from './api/cgApi';
import { CgEntityForm } from './CgEntityForm';
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
// Ref fields inside create forms fall back to plain text at this nesting depth.
const MAX_PICKER_DEPTH = 3;

// ── Inline-create form helpers ────────────────────────────────────────────────

interface CreateField {
  scalar: string;
  refs: PickedNode[];
}

type CreateForm = Record<string, CreateField>; // keyed by fieldDefId



async function persistCreateForm(
  libId: string,
  kindId: string,
  kindDefs: CgFieldDef[],
  form: CreateForm,
): Promise<CgNode> {
  const firstText = kindDefs.find((d) => d.fieldType === 'Text');
  const label = firstText ? form[firstText.id]?.scalar.trim() || undefined : undefined;

  const node = await createNode(libId, { nodeType: 'Entity', nodeKindId: kindId, label });

  for (const def of kindDefs) {
    const field = form[def.id];
    if (!field) continue;

    if (def.fieldType === 'Ref' && def.refNodeKindId) {
      if (field.refs.length > 0) {
        for (let i = 0; i < field.refs.length; i++) {
          await upsertFieldValue(libId, node.id, {
            fieldDefId: def.id,
            refNodeId: field.refs[i].id,
            sortOrder: i,
          });
        }
      } else if (field.scalar.trim()) {
        // Plain-text fallback at max depth — find-or-create by label
        const lbl = field.scalar.trim();
        const hits = await listNodes(libId, { kindId: def.refNodeKindId, q: lbl, limit: 20 });
        const match = hits.find((n) => n.label?.toLowerCase() === lbl.toLowerCase());
        const ref =
          match ??
          (await createNode(libId, { nodeType: 'Entity', nodeKindId: def.refNodeKindId, label: lbl }));
        await upsertFieldValue(libId, node.id, { fieldDefId: def.id, refNodeId: ref.id, sortOrder: 0 });
      }
    } else {
      const val = field.scalar.trim();
      if (!val) continue;
      const body: Parameters<typeof upsertFieldValue>[2] = { fieldDefId: def.id, sortOrder: 0 };
      if (def.fieldType === 'Text') body.textValue = val;
      else if (def.fieldType === 'Number') body.numberValue = Number(val);
      else if (def.fieldType === 'Date') body.dateValue = val;
      else if (def.fieldType === 'Boolean') body.boolValue = val === 'true';
      else continue;
      await upsertFieldValue(libId, node.id, body);
    }
  }

  return node;
}

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
  const createKindDefs = allDefs
    .filter((d) => d.nodeKindId === createKindId)
    .sort((a, b) => a.sortOrder - b.sortOrder);


  const canAddMore = selected.length < maxCount;

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
  const [createForm, setCreateForm] = useState<CreateForm>({});
  const [isSaving, setIsSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createFormRef = useRef<HTMLDivElement>(null);

  // Per-field pin/stable: pinned fields survive between successive creates
  const [pinnedInCreate, setPinnedInCreate] = useState<Set<string>>(new Set());
  const [stableInCreate, setStableInCreate] = useState<CreateForm>({});

  const selectedIds = new Set(selected.map((n) => n.id));

  // Focus first focusable input in the create form whenever it opens
  useEffect(() => {
    if (!showCreate || !createFormRef.current) return;
    const first = createFormRef.current.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled])',
    );
    first?.focus();
  }, [showCreate]);

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
    const targetKindId = kindIdOverride ?? refKindIds[0] ?? '';
    setCreateKindId(targetKindId);
    const defs = allDefs
      .filter((d) => d.nodeKindId === targetKindId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    // Seed pinned fields from stable values; pre-fill query into first UNPINNED text field
    const form: CreateForm = {};
    for (const def of defs) {
      form[def.id] = pinnedInCreate.has(def.id)
        ? (stableInCreate[def.id] ?? { scalar: '', refs: [] })
        : { scalar: '', refs: [] };
    }
    const firstUnpinnedText = defs.find((d) => d.fieldType === 'Text' && !pinnedInCreate.has(d.id));
    if (firstUnpinnedText && query.trim()) {
      form[firstUnpinnedText.id] = { scalar: query.trim(), refs: [] };
    }
    setCreateForm(form);
    setCreateError(null);
    setShowCreate(true);
    setIsOpen(false);
    setQuery('');
  }

  function togglePinInCreate(defId: string) {
    setPinnedInCreate((prev) => {
      const next = new Set(prev);
      if (next.has(defId)) next.delete(defId); else next.add(defId);
      return next;
    });
  }

  function cancelCreate() {
    setShowCreate(false);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function saveCreate() {
    setIsSaving(true);
    setCreateError(null);
    try {
      const node = await persistCreateForm(libId, createKindId, createKindDefs, createForm);
      const cacheKey = `${libId}:${refKindIds.join(',')}:${(node.label ?? '').toLowerCase()}`;
      cache.current.set(cacheKey, [node, ...(cache.current.get(cacheKey) ?? [])]);
      // Persist current values for pinned fields so next open re-uses them
      if (pinnedInCreate.size > 0) {
        setStableInCreate((prev) => {
          const next = { ...prev };
          for (const defId of pinnedInCreate) {
            next[defId] = createForm[defId] ?? { scalar: '', refs: [] };
          }
          return next;
        });
      }
      onAdd({ id: node.id, label: node.label ?? '' });
      setShowCreate(false);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    } catch {
      setCreateError('Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  // Navigate between scalar inputs in THIS create form (depth-scoped to avoid matching nested forms)
  function handleCreateScalarKey(
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelCreate();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!createFormRef.current) {
        saveCreate();
        return;
      }
      // data-cg-create-scalar={depth} is set ONLY on scalars in THIS form; nested
      // forms at depth+1 have a different attribute value so they are skipped.
      const myInputs = Array.from(
        createFormRef.current.querySelectorAll<HTMLElement>(
          `[data-cg-create-scalar="${depth}"]`,
        ),
      );
      const idx = myInputs.findIndex((el) => el === e.currentTarget);
      if (idx >= 0 && idx < myInputs.length - 1) {
        (myInputs[idx + 1] as HTMLInputElement).focus();
      } else {
        saveCreate();
      }
    }
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

      {/* Search input — hidden when at max count or create form is open */}
      {canAddMore && !showCreate && (
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
          ref={createFormRef}
          style={{
            border: '1px solid var(--cg-cyan)44',
            borderRadius: 'var(--cg-radius)',
            padding: '0.75rem',
            background: 'var(--cg-bg)',
            marginTop: '0.35rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <p style={{
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: 'var(--cg-cyan)', margin: 0,
            }}>
              New
            </p>
            {refKindIds.length > 1 ? (
              <select
                className="cg-select"
                style={{ fontSize: '0.78rem', padding: '0.15rem 0.4rem' }}
                value={createKindId}
                onChange={(e) => openCreate(e.target.value)}
              >
                {refKindIds.map((kid) => {
                  const kObj = allKinds.find((k) => k.id === kid);
                  return kObj ? <option key={kid} value={kid}>{kObj.name}</option> : null;
                })}
              </select>
            ) : (
              <p style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--cg-cyan)', margin: 0,
              }}>
                {refKindName}
              </p>
            )}
          </div>

          {createError && (
            <p
              style={{ fontSize: '0.75rem', color: 'var(--cg-danger)', marginBottom: '0.4rem' }}
            >
              {createError}
            </p>
          )}

          {createKindDefs.map((def) => {
            const field = createForm[def.id] ?? { scalar: '', refs: [] };
            const defRefKindIds = getRefKindIds(def);
            const defRefKindNames = defRefKindIds
              .map((id) => allKinds.find((k) => k.id === id)?.name)
              .filter(Boolean) as string[];
            const isPinned = pinnedInCreate.has(def.id);

            return (
              <div key={def.id} style={{ marginBottom: '0.55rem', opacity: isPinned ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <p
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--cg-text-dim)',
                      margin: 0,
                      flex: 1,
                    }}
                  >
                    {def.fieldName}
                    {defRefKindNames.length > 0 && (
                      <span style={{ fontWeight: 400 }}> → {defRefKindNames.join(', ')}</span>
                    )}
                  </p>
                  <button
                    className="cg-btn cg-btn-ghost cg-btn-sm"
                    type="button"
                    tabIndex={-1}
                    title={isPinned ? 'Pinned — persists after create' : 'Pin this field'}
                    style={{ color: isPinned ? 'var(--cg-cyan)' : 'var(--cg-text-dim)', padding: '0 0.2rem', lineHeight: 1 }}
                    onClick={() => togglePinInCreate(def.id)}
                  >
                    {isPinned ? '🔒' : '🔓'}
                  </button>
                </div>

                {def.fieldType === 'Ref' && defRefKindIds.length > 0 ? (
                  depth < MAX_PICKER_DEPTH ? (
                    // Nested picker
                    <CgNodePicker
                      libId={libId}
                      refKindIds={defRefKindIds}
                      refKindName={defRefKindNames.join(' / ')}
                      allKinds={allKinds}
                      allDefs={allDefs}
                      selected={field.refs}
                      onAdd={(node) =>
                        setCreateForm((prev) => {
                          const cur = prev[def.id] ?? { scalar: '', refs: [] };
                          return {
                            ...prev,
                            [def.id]: {
                              ...cur,
                              refs: def.isMultiValue ? [...cur.refs, node] : [node],
                            },
                          };
                        })
                      }
                      onRemove={(nodeId) =>
                        setCreateForm((prev) => {
                          const cur = prev[def.id] ?? { scalar: '', refs: [] };
                          return {
                            ...prev,
                            [def.id]: {
                              ...cur,
                              refs: cur.refs.filter((n) => n.id !== nodeId),
                            },
                          };
                        })
                      }
                      maxCount={def.isMultiValue ? Infinity : 1}
                      depth={depth + 1}
                    />
                  ) : (
                    // Max depth — plain text, find-or-create by label on save
                    <input
                      className="cg-input"
                      style={{ width: '100%' }}
                      placeholder={`${defRefKindNames.join(' / ')}…`}
                      value={field.scalar}
                      data-cg-create-scalar={depth}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          [def.id]: {
                            ...(prev[def.id] ?? { scalar: '', refs: [] }),
                            scalar: e.target.value,
                          },
                        }))
                      }
                      onKeyDown={handleCreateScalarKey}
                    />
                  )
                ) : def.fieldType === 'Boolean' ? (
                  <select
                    className="cg-select"
                    style={{ width: '100%' }}
                    value={field.scalar || 'false'}
                    data-cg-create-scalar={depth}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        [def.id]: {
                          ...(prev[def.id] ?? { scalar: '', refs: [] }),
                          scalar: e.target.value,
                        },
                      }))
                    }
                    onKeyDown={handleCreateScalarKey}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    className="cg-input"
                    style={{ width: '100%' }}
                    placeholder={def.fieldName}
                    value={field.scalar}
                    type={
                      def.fieldType === 'Number'
                        ? 'number'
                        : def.fieldType === 'Date'
                          ? 'date'
                          : 'text'
                    }
                    data-cg-create-scalar={depth}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        [def.id]: {
                          ...(prev[def.id] ?? { scalar: '', refs: [] }),
                          scalar: e.target.value,
                        },
                      }))
                    }
                    onKeyDown={handleCreateScalarKey}
                  />
                )}
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.55rem' }}>
            <button
              className="cg-btn cg-btn-primary cg-btn-sm"
              type="button"
              onClick={saveCreate}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : `Save ${refKindName}`}
            </button>
            <button
              className="cg-btn cg-btn-ghost cg-btn-sm"
              type="button"
              onClick={cancelCreate}
            >
              Cancel
            </button>
          </div>
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
