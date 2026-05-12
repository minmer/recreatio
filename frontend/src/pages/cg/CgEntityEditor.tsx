import { useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgFieldValue,
  type CgNode,
  type CgNodeKind,
  createNode,
  deleteFieldValue,
  getNode,
  getRefKindIds,
  updateNode,
  upsertFieldValue,
} from './api/cgApi';
import { CgNodePicker } from './CgNodePicker';

const MAX_DEPTH = 3;
const DEBOUNCE_MS = 600;

export interface CgEntityEditorProps {
  copy: Copy;
  libId: string;
  kinds: CgNodeKind[];
  fieldDefs: CgFieldDef[];
  kindId: string;
  // null = new entity; string = editing existing
  initialNodeId: string | null;
  initialLabel?: string;
  // Lock state managed by parent (for batch create reuse)
  lockedRefNodeIds?: Set<string>;
  lockedRefCounts?: Record<string, number | null>;
  onToggleLockRef?: (nodeId: string) => void;
  onToggleLockCount?: (defId: string, count: number | null) => void;
  // Lifecycle callbacks
  onCreated?: (node: CgNode) => void;
  onClose?: () => void;
  onOpenNode?: (nodeId: string) => void;
  // Batch mode: show "Next" button
  onNext?: () => void;
  nextLabel?: string;
  depth?: number;
}

export function CgEntityEditor({
  copy: _copy,
  libId, kinds, fieldDefs, kindId,
  initialNodeId, initialLabel = '',
  lockedRefNodeIds = new Set(),
  lockedRefCounts = {},
  onToggleLockRef,
  onToggleLockCount,
  onCreated,
  onClose,
  onOpenNode,
  onNext,
  nextLabel,
  depth = 0,
}: CgEntityEditorProps) {
  const nodeIdRef = useRef<string | null>(initialNodeId);
  const [nodeId, setNodeId] = useState<string | null>(initialNodeId);
  const [label, setLabel] = useState(initialLabel);
  const [fieldValues, setFieldValues] = useState<CgFieldValue[]>([]);
  const [refLabels, setRefLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(!!initialNodeId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldExpanded, setFieldExpanded] = useState<Record<string, boolean>>({});
  const [openSubEditors, setOpenSubEditors] = useState<Record<string, string | null>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const creatingRef = useRef<Promise<string> | null>(null);
  const labelDebRef = useRef<ReturnType<typeof setTimeout>>();
  const fieldDebRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const kind = kinds.find((k) => k.id === kindId);
  const kindDefs = fieldDefs
    .filter((d) => d.nodeKindId === kindId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // ── Load existing ──

  useEffect(() => {
    nodeIdRef.current = initialNodeId;
    setNodeId(initialNodeId);
    setLabel(initialLabel);
    setFieldValues([]);
    setRefLabels(new Map());
    setDrafts({});
    setOpenSubEditors({});

    if (!initialNodeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getNode(libId, initialNodeId)
      .then(async (detail) => {
        setLabel(detail.node.label ?? '');
        setFieldValues(detail.fieldValues);
        const refIds = [
          ...new Set(detail.fieldValues.filter((v) => v.refNodeId).map((v) => v.refNodeId!)),
        ];
        const refDetails = await Promise.all(refIds.map((id) => getNode(libId, id)));
        setRefLabels(new Map(refDetails.map((d) => [d.node.id, d.node.label ?? '(unnamed)'])));
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [libId, initialNodeId]);

  // ── Ensure entity exists before first save ──

  function ensureNode(): Promise<string> {
    if (nodeIdRef.current) return Promise.resolve(nodeIdRef.current);
    if (creatingRef.current) return creatingRef.current;
    creatingRef.current = createNode(libId, {
      nodeType: 'Entity',
      nodeKindId: kindId,
      label: label.trim() || undefined,
    }).then((created) => {
      nodeIdRef.current = created.id;
      setNodeId(created.id);
      onCreated?.(created);
      creatingRef.current = null;
      return created.id;
    });
    return creatingRef.current;
  }

  // ── Label ──

  function handleLabelChange(val: string) {
    setLabel(val);
    clearTimeout(labelDebRef.current);
    labelDebRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const nid = await ensureNode();
        await updateNode(libId, nid, val.trim() || undefined);
      } catch {
        setError('Failed to save label');
      } finally {
        setSaving(false);
      }
    }, DEBOUNCE_MS);
  }

  // ── Scalar fields ──

  function getScalarDisplay(defId: string, sortOrder: number): string {
    const key = `${defId}:${sortOrder}`;
    if (key in drafts) return drafts[key];
    const val = fieldValues
      .filter((v) => v.fieldDefId === defId)
      .sort((a, b) => a.sortOrder - b.sortOrder)[sortOrder];
    if (!val) return '';
    return val.textValue ?? val.dateValue ?? (val.numberValue != null ? String(val.numberValue) : '') ?? (val.boolValue != null ? String(val.boolValue) : '') ?? '';
  }

  function handleScalarChange(def: CgFieldDef, val: string, sortOrder: number) {
    const key = `${def.id}:${sortOrder}`;
    setDrafts((prev) => ({ ...prev, [key]: val }));
    clearTimeout(fieldDebRefs.current[key]);
    fieldDebRefs.current[key] = setTimeout(async () => {
      setSaving(true);
      try {
        const nid = await ensureNode();
        const updated = await upsertFieldValue(libId, nid, {
          fieldDefId: def.id,
          textValue: def.fieldType === 'Text' ? (val.trim() || undefined) : undefined,
          numberValue: def.fieldType === 'Number' ? (val ? Number(val) : undefined) : undefined,
          dateValue: def.fieldType === 'Date' ? (val || undefined) : undefined,
          boolValue: def.fieldType === 'Boolean' ? (val === 'true') : undefined,
          sortOrder,
        });
        setFieldValues(updated);
        setDrafts((prev) => { const n = { ...prev }; delete n[key]; return n; });
      } catch {
        setError('Failed to save');
      } finally {
        setSaving(false);
      }
    }, DEBOUNCE_MS);
  }

  async function handleDeleteScalar(valueId: string) {
    const nid = nodeIdRef.current;
    if (!nid) return;
    try {
      await deleteFieldValue(libId, nid, valueId);
      setFieldValues((prev) => prev.filter((v) => v.id !== valueId));
    } catch {
      setError('Failed to delete');
    }
  }

  // ── Ref fields ──

  async function handleRefAdd(def: CgFieldDef, picked: { id: string; label: string }) {
    setRefLabels((prev) => new Map(prev).set(picked.id, picked.label || '(unnamed)'));
    setSaving(true);
    try {
      const nid = await ensureNode();
      const existing = fieldValues.filter((v) => v.fieldDefId === def.id && v.refNodeId);
      const updated = await upsertFieldValue(libId, nid, {
        fieldDefId: def.id,
        refNodeId: picked.id,
        sortOrder: existing.length,
      });
      setFieldValues(updated);
    } catch {
      setError('Failed to save ref');
    } finally {
      setSaving(false);
    }
  }

  async function handleRefRemove(_def: CgFieldDef, valueId: string) {
    const nid = nodeIdRef.current;
    if (!nid) return;
    setSaving(true);
    try {
      await deleteFieldValue(libId, nid, valueId);
      setFieldValues((prev) => prev.filter((v) => v.id !== valueId));
    } catch {
      setError('Failed to remove ref');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div style={{
        background: 'var(--cg-surface)', border: '1px solid var(--cg-cyan)44',
        borderRadius: 'var(--cg-radius)', padding: '1rem',
        color: 'var(--cg-text-dim)', fontSize: '0.85rem',
      }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--cg-surface)', border: '1px solid var(--cg-cyan)44',
      borderRadius: 'var(--cg-radius)', padding: '0.85rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {kind && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--cg-cyan)', flexShrink: 0,
          }}>
            {kind.name}
          </span>
        )}
        <input
          className="cg-input"
          style={{ flex: 1, fontWeight: 600, minWidth: 0 }}
          placeholder={`${kind?.name ?? 'Entity'} name…`}
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={!initialNodeId}
        />
        {saving && (
          <span style={{ fontSize: '0.68rem', color: 'var(--cg-text-dim)', flexShrink: 0 }}>
            saving…
          </span>
        )}
        {nodeId && onOpenNode && (
          <button
            className="cg-btn cg-btn-ghost cg-btn-sm"
            type="button"
            tabIndex={-1}
            title="Open full editor"
            onClick={() => onOpenNode(nodeId)}
          >
            ⊡
          </button>
        )}
        {onClose && (
          <button
            className="cg-btn cg-btn-ghost cg-btn-sm"
            type="button"
            tabIndex={-1}
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <p className="cg-error" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>{error}</p>
      )}

      {/* Fields */}
      {kindDefs.map((def) => {
        const defRefKindIds = getRefKindIds(def);
        const refKinds = def.fieldType === 'Ref'
          ? defRefKindIds.map((id) => kinds.find((k) => k.id === id)).filter(Boolean) as CgNodeKind[]
          : [];
        const refKindName = refKinds.map((k) => k.name).join(' / ');

        const existingRefs = fieldValues
          .filter((v) => v.fieldDefId === def.id && v.refNodeId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const existingScalars = fieldValues
          .filter((v) => v.fieldDefId === def.id && !v.refNodeId)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const expanded = fieldExpanded[def.id] ?? true;
        const lockedCount = lockedRefCounts[def.id] ?? null;

        const collapsedSummary = def.fieldType === 'Ref'
          ? (existingRefs.map((v) => refLabels.get(v.refNodeId!) ?? '…').join(', ') || '—')
          : (() => {
              const v = existingScalars[0];
              if (!v) return '—';
              return v.textValue ?? v.dateValue ?? (v.numberValue != null ? String(v.numberValue) : '') ?? (v.boolValue != null ? String(v.boolValue) : '') ?? '—';
            })();

        return (
          <div
            key={def.id}
            style={{
              marginBottom: '0.5rem',
              border: '1px solid var(--cg-border)',
              borderRadius: 'var(--cg-radius)',
            }}
          >
            {/* Field header */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.3rem 0.5rem', cursor: 'pointer', userSelect: 'none',
                borderRadius: expanded ? 'var(--cg-radius) var(--cg-radius) 0 0' : 'var(--cg-radius)',
              }}
              onClick={() => setFieldExpanded((fe) => ({ ...fe, [def.id]: !expanded }))}
            >
              <span style={{ fontSize: '0.62rem', color: 'var(--cg-text-dim)', flexShrink: 0, lineHeight: 1 }}>
                {expanded ? '▾' : '▸'}
              </span>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--cg-text-dim)', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {def.fieldName}
                {refKinds.length > 0 && (
                  <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '0.25rem' }}>
                    → {refKinds.map((k) => k.name).join(', ')}
                  </span>
                )}
              </span>
              {/* Collapsed summary */}
              {!expanded && (
                <span style={{
                  fontSize: '0.78rem', color: 'var(--cg-text-dim)', flexShrink: 0,
                  maxWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {collapsedSummary}
                </span>
              )}
              {/* Lock count for ref fields */}
              {def.fieldType === 'Ref' && onToggleLockCount && (
                <button
                  className="cg-btn cg-btn-ghost cg-btn-sm"
                  type="button"
                  tabIndex={-1}
                  title={lockedCount != null ? `Locked ×${lockedCount} — click to unlock` : 'Lock count for this ref field'}
                  style={{
                    color: lockedCount != null ? 'var(--cg-cyan)' : 'var(--cg-text-dim)',
                    padding: '0 0.1rem', lineHeight: 1, fontSize: '0.78rem', flexShrink: 0,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLockCount(
                      def.id,
                      lockedCount != null ? null : Math.max(1, existingRefs.length),
                    );
                  }}
                >
                  {lockedCount != null ? `🔒×${lockedCount}` : '🔓'}
                </button>
              )}
            </div>

            {/* Field body */}
            {expanded && (
              <div style={{ padding: '0.35rem 0.5rem 0.5rem', borderTop: '1px solid var(--cg-border)' }}>
                {def.fieldType === 'Ref' && refKinds.length > 0 ? (
                  <div>
                    {/* Ref chips with lock / inline expand / remove */}
                    {existingRefs.map((v) => {
                      const refNodeId = v.refNodeId!;
                      const refLabel = refLabels.get(refNodeId) ?? refNodeId;
                      const isLocked = lockedRefNodeIds.has(refNodeId);
                      const subKey = `${def.id}:${v.id}`;
                      const subOpen = openSubEditors[subKey] ?? null;
                      // Determine which kind to use for the sub-editor
                      const subKindId = defRefKindIds[0];

                      return (
                        <div key={v.id} style={{ marginBottom: '0.4rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center',
                              background: 'var(--cg-cyan)1a', color: 'var(--cg-cyan)',
                              borderRadius: '999px', padding: '0.15rem 0.55rem',
                              fontSize: '0.82rem', fontWeight: 600, flex: 1, minWidth: 0,
                            }}>
                              <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                cursor: onOpenNode ? 'pointer' : 'default',
                                textDecoration: onOpenNode ? 'underline dotted' : 'none',
                                textUnderlineOffset: '2px',
                              }}
                                onClick={onOpenNode ? () => onOpenNode(refNodeId) : undefined}
                              >
                                {refLabel}
                              </span>
                            </span>
                            {/* Lock ref node */}
                            {onToggleLockRef && (
                              <button
                                className="cg-btn cg-btn-ghost cg-btn-sm"
                                type="button"
                                tabIndex={-1}
                                title={isLocked ? 'Locked — persists to next entry' : 'Lock this reference'}
                                style={{ color: isLocked ? 'var(--cg-cyan)' : 'var(--cg-text-dim)', padding: '0 0.1rem', lineHeight: 1 }}
                                onClick={() => onToggleLockRef(refNodeId)}
                              >
                                {isLocked ? '🔒' : '🔓'}
                              </button>
                            )}
                            {/* Expand sub-editor inline */}
                            {depth < MAX_DEPTH && subKindId && (
                              <button
                                className="cg-btn cg-btn-ghost cg-btn-sm"
                                type="button"
                                tabIndex={-1}
                                title={subOpen ? 'Close inline editor' : 'Edit inline'}
                                style={{ color: subOpen ? 'var(--cg-cyan)' : 'var(--cg-text-dim)', padding: '0 0.1rem', lineHeight: 1 }}
                                onClick={() => setOpenSubEditors((prev) => ({
                                  ...prev,
                                  [subKey]: prev[subKey] ? null : refNodeId,
                                }))}
                              >
                                {subOpen ? '▾' : '▸'}
                              </button>
                            )}
                            {/* Remove */}
                            <button
                              className="cg-btn cg-btn-ghost cg-btn-sm"
                              type="button"
                              tabIndex={-1}
                              style={{ color: 'var(--cg-text-dim)', padding: '0 0.1rem', lineHeight: 1 }}
                              onClick={() => handleRefRemove(def, v.id)}
                            >
                              ✕
                            </button>
                          </div>
                          {/* Inline sub-entity editor */}
                          {subOpen && subKindId && depth < MAX_DEPTH && (
                            <div style={{ marginTop: '0.4rem', marginLeft: '1.2rem' }}>
                              <CgEntityEditor
                                copy={_copy}
                                libId={libId}
                                kinds={kinds}
                                fieldDefs={fieldDefs}
                                kindId={subKindId}
                                initialNodeId={subOpen}
                                onOpenNode={onOpenNode}
                                onClose={() => setOpenSubEditors((prev) => ({ ...prev, [subKey]: null }))}
                                depth={depth + 1}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Picker — add more (respects locked count) */}
                    {(def.isMultiValue || existingRefs.length === 0) &&
                      (lockedCount === null || existingRefs.length < lockedCount) ? (
                        <CgNodePicker
                          libId={libId}
                          refKindIds={defRefKindIds}
                          refKindName={refKindName}
                          allKinds={kinds}
                          allDefs={fieldDefs}
                          selected={existingRefs.map((v) => ({
                            id: v.refNodeId!,
                            label: refLabels.get(v.refNodeId!) ?? '',
                          }))}
                          onAdd={(picked) => handleRefAdd(def, picked)}
                          onRemove={(removedId) => {
                            const val = existingRefs.find((v) => v.refNodeId === removedId);
                            if (val) handleRefRemove(def, val.id);
                          }}
                          onClickNode={onOpenNode}
                          maxCount={def.isMultiValue ? (lockedCount ?? Infinity) : 1}
                          depth={depth}
                        />
                      ) : null}

                    {lockedCount !== null && existingRefs.length >= lockedCount && (
                      <p style={{ fontSize: '0.73rem', color: 'var(--cg-text-dim)', margin: '0.2rem 0 0' }}>
                        Count locked at {lockedCount} ×
                      </p>
                    )}
                  </div>
                ) : (
                  // Scalar slots
                  (() => {
                    const slots = def.isMultiValue
                      ? Array.from({ length: existingScalars.length + 1 }, (_, i) => i)
                      : [0];
                    return slots.map((sortOrder) => {
                      const valAtSlot = existingScalars[sortOrder];
                      const display = getScalarDisplay(def.id, sortOrder);
                      return (
                        <div
                          key={sortOrder}
                          style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.25rem', alignItems: 'center' }}
                        >
                          {def.fieldType === 'Boolean' ? (
                            <select
                              className="cg-select"
                              style={{ flex: 1 }}
                              value={display || 'false'}
                              onChange={(e) => handleScalarChange(def, e.target.value, sortOrder)}
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              className="cg-input"
                              style={{ flex: 1 }}
                              placeholder={!valAtSlot ? `${def.fieldName}…` : def.fieldName}
                              value={display}
                              type={
                                def.fieldType === 'Number' ? 'number' :
                                def.fieldType === 'Date' ? 'date' : 'text'
                              }
                              onChange={(e) => handleScalarChange(def, e.target.value, sortOrder)}
                            />
                          )}
                          {valAtSlot && (
                            <button
                              className="cg-btn cg-btn-ghost cg-btn-sm"
                              type="button"
                              tabIndex={-1}
                              style={{ color: 'var(--cg-text-dim)', flexShrink: 0 }}
                              onClick={() => handleDeleteScalar(valAtSlot.id)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Next button (batch mode) */}
      {onNext && (
        <div style={{ marginTop: '0.6rem' }}>
          <button
            className="cg-btn cg-btn-primary"
            type="button"
            onClick={onNext}
          >
            {nextLabel ?? 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}
