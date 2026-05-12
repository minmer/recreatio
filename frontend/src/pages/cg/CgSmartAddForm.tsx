import { useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgNode,
  type CgNodeKind,
  createNode,
  getRefKindIds,
  listNodes,
  upsertFieldValue,
} from './api/cgApi';
import { CgNodePicker, type PickedNode } from './CgNodePicker';

// ── Form state ────────────────────────────────────────────────────────────────

export interface ScalarField {
  kind: 'scalar';
  value: string;
  stable: boolean;
}

export interface RefSlot {
  node: PickedNode | null;
  pinned: boolean;
}

export interface RefField {
  kind: 'ref';
  slots: RefSlot[];
}

type FieldEntry = ScalarField | RefField;
export type AddFormState = Record<string, FieldEntry>; // keyed by fieldDefId

function initFormState(kindId: string, allDefs: CgFieldDef[]): AddFormState {
  const defs = allDefs
    .filter((d) => d.nodeKindId === kindId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return Object.fromEntries(
    defs.map((d) => [
      d.id,
      d.fieldType === 'Ref'
        ? ({ kind: 'ref', slots: [{ node: null, pinned: false }] } as RefField)
        : ({ kind: 'scalar', value: '', stable: false } as ScalarField),
    ]),
  );
}

// After each submission: clear non-pinned ref slots, reset non-stable scalar values.
// Always keep at least one slot per ref field.
function applyStable(state: AddFormState): AddFormState {
  return Object.fromEntries(
    Object.entries(state).map(([id, entry]) => {
      if (entry.kind === 'ref') {
        const kept = entry.slots.filter((s) => s.pinned);
        return [id, { ...entry, slots: kept.length > 0 ? kept : [{ node: null, pinned: false }] }];
      } else {
        return [id, { ...entry, value: entry.stable ? entry.value : '' }];
      }
    }),
  );
}

function isEntryPinned(entry: FieldEntry): boolean {
  if (entry.kind === 'scalar') return entry.stable;
  return entry.slots.some((s) => s.pinned && s.node !== null);
}

function getEntrySummary(entry: FieldEntry): string {
  if (entry.kind === 'scalar') return entry.value.trim() || '—';
  const labels = entry.slots.filter((s) => s.node).map((s) => s.node!.label || '(unnamed)');
  return labels.length > 0 ? labels.join(', ') : '—';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  copy: Copy;
  libId: string;
  kinds: CgNodeKind[];
  fieldDefs: CgFieldDef[];
  selectedKindId: string;
  onKindChange: (kindId: string) => void;
  onCreated: (node: CgNode) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SEARCH_DEBOUNCE = 250;
const SEARCH_LIMIT = 10;

export function CgSmartAddForm({
  copy, libId, kinds, fieldDefs, selectedKindId, onKindChange, onCreated,
}: Props) {
  const [formState, setFormState] = useState<AddFormState>(
    () => initFormState(selectedKindId, fieldDefs),
  );
  const [fieldExpanded, setFieldExpanded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetCount, setTargetCount] = useState(1);
  const [addedCount, setAddedCount] = useState(0);

  // Search-to-pick-existing state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CgNode[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedExisting, setSelectedExisting] = useState<CgNode | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchCache = useRef(new Map<string, CgNode[]>());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormState(initFormState(selectedKindId, fieldDefs));
    setFieldExpanded({});
    setSelectedExisting(null);
    setSearchQuery('');
    setSearchResults([]);
  }, [selectedKindId, fieldDefs]);

  // Debounced search for existing nodes
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 1) {
      setSearchResults([]);
      setSearchOpen(false);
      setIsSearching(false);
      return;
    }
    const cacheKey = `${libId}:${selectedKindId}:${trimmed.toLowerCase()}`;
    const hit = searchCache.current.get(cacheKey);
    if (hit) {
      setSearchResults(hit);
      setSearchOpen(true);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await listNodes(libId, { kindId: selectedKindId, q: trimmed, limit: SEARCH_LIMIT });
        searchCache.current.set(cacheKey, results);
        setSearchResults(results);
        setSearchOpen(true);
      } catch { /* silent */ } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [libId, selectedKindId, searchQuery]);

  const selectedKind = kinds.find((k) => k.id === selectedKindId);
  if (!selectedKind) return null;

  const kindDefs = fieldDefs
    .filter((d) => d.nodeKindId === selectedKindId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const isExistingMode = selectedExisting !== null;

  function getFieldExpanded(defId: string): boolean {
    return fieldExpanded[defId] ?? true;
  }

  function clearExisting() {
    setSelectedExisting(null);
    setSearchQuery('');
    setSearchResults([]);
  }

  // ── Submit ──

  async function handleSubmit() {
    setAdding(true);
    setError(null);
    try {
      let node: CgNode;

      if (selectedExisting) {
        node = selectedExisting;
        clearExisting();
      } else {
        const firstText = kindDefs.find((d) => d.fieldType === 'Text');
        const labelEntry = firstText ? formState[firstText.id] : undefined;
        const label =
          labelEntry?.kind === 'scalar' ? labelEntry.value.trim() || undefined : undefined;

        node = await createNode(libId, {
          nodeType: 'Entity',
          nodeKindId: selectedKindId,
          label,
        });

        for (const def of kindDefs) {
          const entry = formState[def.id];
          if (!entry) continue;

          if (entry.kind === 'ref') {
            let sortIdx = 0;
            for (const slot of entry.slots) {
              if (!slot.node) continue;
              await upsertFieldValue(libId, node.id, {
                fieldDefId: def.id,
                refNodeId: slot.node.id,
                sortOrder: sortIdx++,
              });
            }
          } else {
            const val = entry.value.trim();
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

        setFormState(applyStable(formState));
      }

      const newAdded = addedCount + 1;
      setAddedCount(newAdded >= targetCount ? 0 : newAdded);
      onCreated(node);
      setTimeout(() => {
        if (isExistingMode) searchInputRef.current?.focus();
        else firstInputRef.current?.focus();
      }, 50);
    } catch {
      setError(copy.cg.graph.createFailed);
    } finally {
      setAdding(false);
    }
  }

  // ── Pin toggles ──

  function toggleScalarStable(defId: string) {
    setFormState((prev) => {
      const e = prev[defId] as ScalarField;
      const nowPinned = !e.stable;
      setFieldExpanded((fe) => ({ ...fe, [defId]: !nowPinned }));
      return { ...prev, [defId]: { ...e, stable: nowPinned } };
    });
  }

  function toggleSlotPin(defId: string, slotIdx: number) {
    setFormState((prev) => {
      const entry = prev[defId] as RefField;
      const slots = entry.slots.map((s, i) =>
        i === slotIdx ? { ...s, pinned: !s.pinned } : s,
      );
      const anyPinned = slots.some((s) => s.pinned && s.node !== null);
      setFieldExpanded((fe) => ({ ...fe, [defId]: !anyPinned }));
      return { ...prev, [defId]: { ...entry, slots } };
    });
  }

  // ── Scalar helpers ──

  function setScalar(defId: string, value: string) {
    setFormState((prev) => ({
      ...prev,
      [defId]: { ...prev[defId], kind: 'scalar', value } as ScalarField,
    }));
  }

  function handleScalarKey(
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    defId: string,
  ) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const scalarInputs = Array.from(
      document.querySelectorAll<HTMLElement>('[data-cg-scalar-input]'),
    );
    const idx = scalarInputs.findIndex((el) => el.dataset.cgScalarInput === defId);
    if (idx >= 0 && idx < scalarInputs.length - 1) {
      scalarInputs[idx + 1].focus();
    } else {
      handleSubmit();
    }
  }

  // ── Ref slot helpers ──

  function setSlotNode(defId: string, slotIdx: number, node: PickedNode | null) {
    setFormState((prev) => {
      const entry = prev[defId] as RefField;
      const slots = entry.slots.map((s, i) =>
        i === slotIdx ? { ...s, node } : s,
      );
      return { ...prev, [defId]: { ...entry, slots } };
    });
  }

  function addSlot(defId: string) {
    setFormState((prev) => {
      const entry = prev[defId] as RefField;
      return {
        ...prev,
        [defId]: { ...entry, slots: [...entry.slots, { node: null, pinned: false }] },
      };
    });
  }

  function removeSlot(defId: string, slotIdx: number) {
    setFormState((prev) => {
      const entry = prev[defId] as RefField;
      const slots = entry.slots.filter((_, i) => i !== slotIdx);
      return {
        ...prev,
        [defId]: { ...entry, slots: slots.length > 0 ? slots : [{ node: null, pinned: false }] },
      };
    });
  }

  // ── Button label ──

  function submitLabel() {
    if (adding) return isExistingMode ? 'Adding…' : copy.cg.graph.adding;
    if (isExistingMode) return `Add "${selectedExisting!.label ?? '(unnamed)'}"`;
    if (targetCount > 1) return `Create ${addedCount + 1} / ${targetCount}`;
    return copy.cg.graph.addAction;
  }

  // ── Render ──

  return (
    <div style={{
      background: 'var(--cg-surface)', border: '1px solid var(--cg-border)',
      borderRadius: 'var(--cg-radius)', padding: '1rem', marginBottom: '1rem',
    }}>
      {/* Header: label + kind selector + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <p style={{
          fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--cg-text-dim)', margin: 0, flexShrink: 0,
        }}>
          {copy.cg.graph.addNode}
        </p>
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

      {error && <p className="cg-error" style={{ marginBottom: '0.5rem' }}>{error}</p>}

      {/* Search-to-pick-existing */}
      <div style={{ marginBottom: '0.85rem', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--cg-text-dim)',
          }}>
            {isExistingMode ? 'Selected existing' : `Search ${selectedKind.name}`}
          </span>
          {isExistingMode && (
            <button
              className="cg-btn cg-btn-ghost cg-btn-sm"
              type="button"
              onClick={clearExisting}
              style={{ marginLeft: 'auto', color: 'var(--cg-text-dim)' }}
            >
              ✕ Clear
            </button>
          )}
        </div>
        {isExistingMode ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            background: 'var(--cg-cyan)22', color: 'var(--cg-cyan)',
            borderRadius: '999px', padding: '0.2rem 0.5rem 0.2rem 0.7rem',
            fontSize: '0.85rem', fontWeight: 600,
          }}>
            {selectedExisting.label ?? '(unnamed)'}
            <button
              type="button"
              onClick={clearExisting}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 0.2rem', lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input
                ref={searchInputRef}
                className="cg-input"
                style={{ flex: 1 }}
                placeholder={`Search existing ${selectedKind.name}…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              />
              {isSearching && (
                <span style={{ fontSize: '0.75rem', color: 'var(--cg-text-dim)', flexShrink: 0 }}>…</span>
              )}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--cg-surface)', border: '1px solid var(--cg-border)',
                borderRadius: 'var(--cg-radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                marginTop: 3,
              }}>
                {searchResults.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onMouseDown={() => {
                      setSelectedExisting(node);
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '0.4rem 0.7rem', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '0.85rem', color: 'var(--cg-text)',
                    }}
                  >
                    {node.label ?? '(unnamed)'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider with "Create new" label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: isExistingMode ? 'var(--cg-text-dim)' : 'var(--cg-text-dim)',
          opacity: isExistingMode ? 0.5 : 1, flexShrink: 0,
        }}>
          Create new
        </span>
        <div style={{ flex: 1, height: '1px', background: 'var(--cg-border)', opacity: isExistingMode ? 0.4 : 1 }} />
      </div>

      {/* Creation fields — collapsible per field */}
      <div style={{ opacity: isExistingMode ? 0.45 : 1, pointerEvents: isExistingMode ? 'none' : undefined }}>
        {kindDefs.map((def, defIdx) => {
          const entry = formState[def.id];
          if (!entry) return null;

          const defRefKindIds = getRefKindIds(def);
          const refKinds = def.fieldType === 'Ref'
            ? defRefKindIds.map((id) => kinds.find((k) => k.id === id)).filter(Boolean) as CgNodeKind[]
            : [];
          const refKindName = refKinds.map((k) => k.name).join(' / ');
          const pinned = isEntryPinned(entry);
          const expanded = getFieldExpanded(def.id);
          const summary = getEntrySummary(entry);

          return (
            <div
              key={def.id}
              style={{
                marginBottom: '0.5rem',
                border: '1px solid var(--cg-border)',
                borderRadius: 'var(--cg-radius)',
                background: pinned ? 'var(--cg-cyan)06' : 'transparent',
              }}
            >
              {/* Collapsible header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.5rem', cursor: 'pointer',
                  borderRadius: expanded ? 'var(--cg-radius) var(--cg-radius) 0 0' : 'var(--cg-radius)',
                  userSelect: 'none',
                }}
                onClick={() => setFieldExpanded((fe) => ({ ...fe, [def.id]: !expanded }))}
              >
                <span style={{ fontSize: '0.65rem', color: 'var(--cg-text-dim)', flexShrink: 0 }}>
                  {expanded ? '▾' : '▸'}
                </span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: 'var(--cg-text-dim)', flex: 1,
                  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {def.fieldName}
                  {refKinds.length > 0 && (
                    <span style={{ fontWeight: 400, marginLeft: '0.25rem', textTransform: 'none' }}>
                      → {refKinds.map((k) => k.name).join(', ')}
                    </span>
                  )}
                </span>
                {!expanded && (
                  <span style={{
                    fontSize: '0.78rem', color: pinned ? 'var(--cg-cyan)' : 'var(--cg-text-dim)',
                    maxWidth: '9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {summary}
                  </span>
                )}
                {/* Pin/lock button */}
                {entry.kind === 'scalar' ? (
                  <button
                    className="cg-btn cg-btn-ghost cg-btn-sm"
                    style={{
                      color: pinned ? 'var(--cg-cyan)' : 'var(--cg-text-dim)',
                      padding: '0 0.15rem', lineHeight: 1, flexShrink: 0,
                    }}
                    type="button"
                    tabIndex={-1}
                    title={pinned ? 'Pinned — persists after add' : 'Pin this field'}
                    onClick={(e) => { e.stopPropagation(); toggleScalarStable(def.id); }}
                  >
                    {pinned ? '🔒' : '🔓'}
                  </button>
                ) : (
                  /* For ref fields the per-slot pins are inside; just show state */
                  <span style={{ fontSize: '0.85rem', flexShrink: 0, opacity: pinned ? 1 : 0.35 }}>
                    {pinned ? '🔒' : '🔓'}
                  </span>
                )}
              </div>

              {/* Field input — shown when expanded */}
              {expanded && (
                <div style={{ padding: '0.3rem 0.5rem 0.5rem', borderTop: '1px solid var(--cg-border)' }}>
                  {entry.kind === 'ref' && refKinds.length > 0 ? (
                    <div>
                      {entry.slots.map((slot, slotIdx) => (
                        <div
                          key={slotIdx}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.35rem',
                            marginBottom: '0.35rem',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <CgNodePicker
                              libId={libId}
                              refKindIds={defRefKindIds}
                              refKindName={refKindName}
                              allKinds={kinds}
                              allDefs={fieldDefs}
                              selected={slot.node ? [slot.node] : []}
                              onAdd={(node) => setSlotNode(def.id, slotIdx, node)}
                              onRemove={() => setSlotNode(def.id, slotIdx, null)}
                              maxCount={1}
                              depth={0}
                            />
                          </div>
                          <button
                            className="cg-btn cg-btn-ghost cg-btn-sm"
                            type="button"
                            tabIndex={-1}
                            title={slot.pinned ? 'Pinned — persists after add' : 'Pin this slot'}
                            style={{ color: slot.pinned ? 'var(--cg-cyan)' : 'var(--cg-text-dim)', marginTop: '1px' }}
                            onClick={() => toggleSlotPin(def.id, slotIdx)}
                          >
                            {slot.pinned ? '🔒' : '🔓'}
                          </button>
                          {def.isMultiValue && entry.slots.length > 1 && (
                            <button
                              className="cg-btn cg-btn-ghost cg-btn-sm"
                              type="button"
                              tabIndex={-1}
                              title="Remove this slot"
                              style={{ color: 'var(--cg-text-dim)', marginTop: '1px' }}
                              onClick={() => removeSlot(def.id, slotIdx)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      {def.isMultiValue && (
                        <button
                          className="cg-btn cg-btn-ghost cg-btn-sm"
                          type="button"
                          tabIndex={-1}
                          onClick={() => addSlot(def.id)}
                          style={{ color: 'var(--cg-cyan)', marginTop: '0.1rem' }}
                        >
                          + {refKindName}
                        </button>
                      )}
                    </div>
                  ) : entry.kind === 'scalar' ? (
                    def.fieldType === 'Boolean' ? (
                      <select
                        className="cg-select"
                        style={{ width: '100%' }}
                        value={entry.value || 'false'}
                        tabIndex={entry.stable ? -1 : 0}
                        onChange={(e) => setScalar(def.id, e.target.value)}
                        onKeyDown={(e) => handleScalarKey(e, def.id)}
                        data-cg-scalar-input={def.id}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        ref={defIdx === 0 ? firstInputRef : undefined}
                        className="cg-input"
                        style={{ width: '100%' }}
                        placeholder={def.fieldName}
                        value={entry.value}
                        type={
                          def.fieldType === 'Number'
                            ? 'number'
                            : def.fieldType === 'Date'
                              ? 'date'
                              : 'text'
                        }
                        tabIndex={entry.stable ? -1 : 0}
                        data-cg-scalar-input={def.id}
                        onChange={(e) => setScalar(def.id, e.target.value)}
                        onKeyDown={(e) => handleScalarKey(e, def.id)}
                      />
                    )
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit + progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className="cg-btn cg-btn-primary"
          type="button"
          onClick={handleSubmit}
          disabled={adding}
        >
          {submitLabel()}
        </button>
        {targetCount > 1 && (addedCount > 0 || adding) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '6rem' }}>
            <div style={{
              flex: 1, height: '4px', background: 'var(--cg-border)',
              borderRadius: '999px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(100, (addedCount / targetCount) * 100)}%`,
                height: '100%', background: 'var(--cg-cyan)', borderRadius: '999px',
                transition: 'width 0.2s ease',
              }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--cg-text-dim)', flexShrink: 0 }}>
              {addedCount} / {targetCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
