import { useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgFieldValue,
  type CgNode,
  type CgNodeKind,
  createNode,
  deleteFieldValue,
  getKindLabel,
  getNode,
  getRefKindIds,
  updateNode,
  upsertFieldValue,
} from './api/cgApi';
import { CgNodePicker } from './CgNodePicker';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LockState {
  // per-fieldDefId list of refs that persist to the next entity creation
  lockedRefs: Record<string, Array<{ id: string; label: string }>>;
  // per-fieldDefId locked count (null = not locked)
  refCounts: Record<string, number | null>;
}

export interface CgEntityFormProps {
  copy: Copy;
  libId: string;
  kinds: CgNodeKind[];
  fieldDefs: CgFieldDef[];
  kindId: string;
  // null = new entity, string = editing existing
  nodeId: string | null;
  // Pre-fill label for new entity
  initialLabel?: string;
  // Lock state for batch-create reuse (managed by parent)
  lockState?: LockState;
  onToggleLockRef?: (defId: string, nodeId: string, label: string) => void;
  onToggleLockCount?: (defId: string, currentCount: number) => void;
  // Lifecycle
  onCreated?: (node: CgNode) => void;
  onOpenNode?: (nodeId: string) => void;
  // Batch mode
  onNext?: () => void;
  nextLabel?: string;
  onAddAnother?: () => void;
  // Nesting depth — controls hierarchical sub-entity expansion
  depth?: number;
}

const DEBOUNCE_MS = 300;
const MAX_DEPTH = 5;

// ── Component ─────────────────────────────────────────────────────────────────

export function CgEntityForm({
  copy: _copy,
  libId, kinds, fieldDefs, kindId,
  nodeId: nodeIdProp, initialLabel = '',
  lockState,
  onToggleLockRef,
  onToggleLockCount,
  onCreated,
  onOpenNode,
  onNext, nextLabel,
  onAddAnother,
  depth = 0,
}: CgEntityFormProps) {
  // Use a ref for nodeId to avoid stale closures in debounce callbacks
  const nodeIdRef = useRef<string | null>(nodeIdProp);
  const creatingRef = useRef<Promise<string> | null>(null);

  const [fieldValues, setFieldValues] = useState<CgFieldValue[]>([]);
  const [refLabels, setRefLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(!!nodeIdProp);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});
  // scalar inputs: draft values before debounced save
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const fieldDebRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const kind = kinds.find((k) => k.id === kindId);
  const kindDefs = fieldDefs
    .filter((d) => d.nodeKindId === kindId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // ── Load existing ──

  useEffect(() => {
    nodeIdRef.current = nodeIdProp;
    setFieldValues([]);
    setRefLabels(new Map());
    setOpenSubs({});

    if (!nodeIdProp) {
      // Pre-fill first text field from initialLabel (replaces separate label input)
      const firstText = kindDefs.find((d) => d.fieldType === 'Text');
      const initDrafts: Record<string, string> = firstText && initialLabel
        ? { [`${firstText.id}:0`]: initialLabel }
        : {};
      // Pre-populate locked refs for batch creation
      if (lockState) {
        const labels = new Map<string, string>();
        Object.values(lockState.lockedRefs).flat().forEach((r) => labels.set(r.id, r.label));
        setRefLabels(labels);
        const synthetic: CgFieldValue[] = Object.entries(lockState.lockedRefs).flatMap(([defId, refs]) =>
          refs.map((ref, i) => ({
            id: `__locked_${defId}_${ref.id}`,
            nodeId: '', fieldDefId: defId,
            textValue: null, numberValue: null, dateValue: null, boolValue: null,
            refNodeId: ref.id, pvState: null, pvNote: null, sortOrder: i, createdUtc: '',
          })),
        );
        setFieldValues(synthetic);
      }
      setDrafts(initDrafts);
      setLoading(false);
      return;
    }

    setDrafts({});
    setLoading(true);
    getNode(libId, nodeIdProp)
      .then(async (detail) => {
        setFieldValues(detail.fieldValues);
        const refIds = [...new Set(
          detail.fieldValues.filter((v) => v.refNodeId).map((v) => v.refNodeId!),
        )];
        const refDetails = await Promise.all(refIds.map((id) => getNode(libId, id)));
        setRefLabels(new Map(refDetails.map((d) => [d.node.id, d.node.label ?? '(unnamed)'])));
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [libId, nodeIdProp]);

  // ── Ensure entity exists before saving ──

  function ensureNode(): Promise<string> {
    if (nodeIdRef.current) return Promise.resolve(nodeIdRef.current);
    if (creatingRef.current) return creatingRef.current;
    const firstText = kindDefs.find((d) => d.fieldType === 'Text');
    const derivedLabel = firstText ? (drafts[`${firstText.id}:0`] ?? '').trim() : '';
    creatingRef.current = createNode(libId, {
      nodeType: 'Entity',
      nodeKindId: kindId,
      label: derivedLabel || undefined,
    }).then(async (created) => {
      nodeIdRef.current = created.id;
      onCreated?.(created);
      creatingRef.current = null;
      // Persist locked refs into the newly created node
      if (lockState) {
        let latestValues: CgFieldValue[] = [];
        for (const [defId, refs] of Object.entries(lockState.lockedRefs)) {
          for (let i = 0; i < refs.length; i++) {
            latestValues = await upsertFieldValue(libId, created.id, {
              fieldDefId: defId, refNodeId: refs[i].id, sortOrder: i,
            });
          }
        }
        if (latestValues.length > 0) setFieldValues(latestValues);
      }
      return created.id;
    });
    return creatingRef.current;
  }

  // ── Scalar ──

  function getScalarDisplay(defId: string, sortOrder: number): string {
    const key = `${defId}:${sortOrder}`;
    if (key in drafts) return drafts[key];
    const val = fieldValues
      .filter((v) => v.fieldDefId === defId)
      .sort((a, b) => a.sortOrder - b.sortOrder)[sortOrder];
    if (!val) return '';
    return val.textValue ?? val.dateValue
      ?? (val.numberValue != null ? String(val.numberValue) : '')
      ?? (val.boolValue != null ? String(val.boolValue) : '');
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
        // Keep node.label in sync with the first text field (slot 0)
        const firstText = kindDefs.find((d) => d.fieldType === 'Text');
        if (firstText && def.id === firstText.id && sortOrder === 0) {
          await updateNode(libId, nid, val.trim() || undefined);
        }
      } catch { setError('Failed to save'); }
      finally { setSaving(false); }
    }, DEBOUNCE_MS);
  }

  async function handleDeleteScalar(valueId: string) {
    const nid = nodeIdRef.current;
    if (!nid) return;
    try {
      await deleteFieldValue(libId, nid, valueId);
      setFieldValues((prev) => prev.filter((v) => v.id !== valueId));
    } catch { setError('Failed to delete'); }
  }

  // ── Ref ──

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
    } catch { setError('Failed to save ref'); }
    finally { setSaving(false); }
  }

  async function handleRefRemove(valueId: string) {
    const nid = nodeIdRef.current;
    if (!nid) return;
    setSaving(true);
    try {
      await deleteFieldValue(libId, nid, valueId);
      setFieldValues((prev) => prev.filter((v) => v.id !== valueId));
    } catch { setError('Failed to remove ref'); }
    finally { setSaving(false); }
  }

  // ── Render ──

  if (loading) {
    return (
      <div style={{ padding: '1rem', color: 'var(--cg-text-dim)', fontSize: '0.85rem' }}>
        Loading…
      </div>
    );
  }

  // Indent style for sub-editors at depth > 0
  const indentStyle = depth > 0
    ? { marginLeft: `${depth * 0.75}rem`, borderLeft: '2px solid var(--cg-cyan)33', paddingLeft: '0.75rem' }
    : {};

  const firstTextDef = kindDefs.find((d) => d.fieldType === 'Text');

  return (
    <div style={indentStyle}>
      {/* Header: kind badge + status + open-full */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {kind && (
          <span style={{
            fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--cg-cyan)', flexShrink: 0,
          }}>
            {getKindLabel(kind, fieldDefs)}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {saving && (
          <span style={{ fontSize: '0.67rem', color: 'var(--cg-text-dim)', flexShrink: 0 }}>
            saving…
          </span>
        )}
        {nodeIdRef.current && onOpenNode && (
          <button
            className="cg-btn cg-btn-ghost cg-btn-sm"
            type="button"
            tabIndex={-1}
            title="Open full page"
            onClick={() => onOpenNode(nodeIdRef.current!)}
          >
            ⊡
          </button>
        )}
      </div>

      {error && (
        <p className="cg-error" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>{error}</p>
      )}

      {/* Fields */}
      {kindDefs.map((def) => {
        const defRefKindIds = getRefKindIds(def);
        const refKinds = def.fieldType === 'Ref'
          ? defRefKindIds.map((id) => kinds.find((k) => k.id === id)).filter(Boolean) as CgNodeKind[]
          : [];
        const refKindName = refKinds.map((k) => getKindLabel(k, fieldDefs)).join(' / ');

        const existingRefs = fieldValues
          .filter((v) => v.fieldDefId === def.id && v.refNodeId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const existingScalars = fieldValues
          .filter((v) => v.fieldDefId === def.id && !v.refNodeId)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const lockedCount = lockState?.refCounts[def.id] ?? null;

        return (
          <div
            key={def.id}
            style={{ marginBottom: '0.45rem', border: '1px solid var(--cg-border)', borderRadius: 'var(--cg-radius)' }}
          >
            {/* Field header — always visible, not collapsible */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.28rem 0.5rem',
              borderBottom: '1px solid var(--cg-border)',
              borderRadius: 'calc(var(--cg-radius) - 1px) calc(var(--cg-radius) - 1px) 0 0',
            }}>
              <span style={{
                fontSize: '0.69rem', fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--cg-text-dim)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {def.fieldName}
                {refKinds.length > 0 && (
                  <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: '0.25rem' }}>
                    → {refKinds.map((k) => getKindLabel(k, fieldDefs)).join(', ')}
                  </span>
                )}
              </span>
              {/* Lock count button — visible when lock callbacks provided */}
              {def.fieldType === 'Ref' && onToggleLockCount && (
                <button
                  className="cg-btn cg-btn-ghost cg-btn-sm"
                  type="button"
                  tabIndex={-1}
                  title={lockedCount != null
                    ? `Count locked at ${lockedCount} — click to unlock`
                    : 'Lock count for batch creation'}
                  style={{
                    color: lockedCount != null ? 'var(--cg-cyan)' : 'var(--cg-text-dim)',
                    padding: '0 0.25rem', fontSize: '0.75rem', flexShrink: 0,
                  }}
                  onClick={() => onToggleLockCount(def.id, lockedCount ?? Math.max(1, existingRefs.length))}
                >
                  {lockedCount != null ? `🔒 ×${lockedCount}` : '🔓'}
                </button>
              )}
            </div>

            {/* Field body — always visible */}
            <div style={{ padding: '0.3rem 0.5rem 0.45rem' }}>
              {def.fieldType === 'Ref' && refKinds.length > 0 ? (
                <div>
                  {/* Ref chips — each with lock, hierarchical expand, remove */}
                  {existingRefs.map((v) => {
                    const rid = v.refNodeId!;
                    const rlabel = refLabels.get(rid) ?? rid;
                    const isLocked = lockState?.lockedRefs[def.id]?.some((r) => r.id === rid) ?? false;
                    const subKey = `${def.id}:${v.id}`;
                    const subOpen = openSubs[subKey] ?? false;
                    const subKindId = defRefKindIds[0];

                    return (
                      <div key={v.id} style={{ marginBottom: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.22rem' }}>
                          {/* Chip */}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            background: 'var(--cg-cyan)18', color: 'var(--cg-cyan)',
                            borderRadius: '999px', padding: '0.13rem 0.55rem',
                            fontSize: '0.81rem', fontWeight: 600,
                            flex: 1, minWidth: 0,
                          }}>
                            <span
                              style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                cursor: onOpenNode ? 'pointer' : 'default',
                                textDecoration: onOpenNode ? 'underline dotted' : 'none',
                                textUnderlineOffset: '2px',
                              }}
                              onClick={onOpenNode ? () => onOpenNode(rid) : undefined}
                            >
                              {rlabel}
                            </span>
                          </span>
                          {/* Lock ref node */}
                          {onToggleLockRef && (
                            <button
                              className="cg-btn cg-btn-ghost cg-btn-sm"
                              type="button"
                              tabIndex={-1}
                              title={isLocked ? 'Locked — persists to next entry' : 'Lock this reference'}
                              style={{ color: isLocked ? 'var(--cg-cyan)' : 'var(--cg-text-dim)', padding: '0 0.1rem' }}
                              onClick={() => onToggleLockRef(def.id, rid, rlabel)}
                            >
                              {isLocked ? '🔒' : '🔓'}
                            </button>
                          )}
                          {/* Expand sub-entity hierarchically */}
                          {depth < MAX_DEPTH && subKindId && (
                            <button
                              className="cg-btn cg-btn-ghost cg-btn-sm"
                              type="button"
                              tabIndex={-1}
                              title={subOpen ? 'Collapse' : 'Expand sub-entity'}
                              style={{ color: subOpen ? 'var(--cg-cyan)' : 'var(--cg-text-dim)', padding: '0 0.1rem' }}
                              onClick={() => setOpenSubs((prev) => ({ ...prev, [subKey]: !subOpen }))}
                            >
                              {subOpen ? '▾' : '▸'}
                            </button>
                          )}
                          {/* Remove (disabled for locked refs) */}
                          {!isLocked && (
                            <button
                              className="cg-btn cg-btn-ghost cg-btn-sm"
                              type="button"
                              tabIndex={-1}
                              style={{ color: 'var(--cg-text-dim)', padding: '0 0.1rem' }}
                              onClick={() => handleRefRemove(v.id)}
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Hierarchical sub-entity editor — same component, deeper indent */}
                        {subOpen && subKindId && depth < MAX_DEPTH && (
                          <div style={{ marginTop: '0.4rem' }}>
                            <CgEntityForm
                              copy={_copy}
                              libId={libId}
                              kinds={kinds}
                              fieldDefs={fieldDefs}
                              kindId={subKindId}
                              nodeId={rid}
                              onOpenNode={onOpenNode}
                              depth={depth + 1}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Picker to add refs (respects locked count) */}
                  {(def.isMultiValue || existingRefs.length === 0) &&
                    (lockedCount === null || existingRefs.length < lockedCount) && (
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
                          if (val) handleRefRemove(val.id);
                        }}
                        onClickNode={onOpenNode}
                        maxCount={def.isMultiValue ? (lockedCount ?? Infinity) : 1}
                        depth={depth}
                      />
                    )}

                  {lockedCount !== null && existingRefs.length >= lockedCount && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--cg-text-dim)', margin: '0.2rem 0 0' }}>
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
                        style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.22rem', alignItems: 'center' }}
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
                              def.fieldType === 'Number' ? 'number'
                              : def.fieldType === 'Date' ? 'date'
                              : 'text'
                            }
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus={!nodeIdProp && depth === 0 && def.id === firstTextDef?.id && sortOrder === 0}
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
          </div>
        );
      })}

      {/* Batch / add-another buttons */}
      {(onNext || onAddAnother) && (
        <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem' }}>
          {onNext && (
            <button className="cg-btn cg-btn-primary" type="button" onClick={onNext}>
              {nextLabel ?? 'Next →'}
            </button>
          )}
          {onAddAnother && (
            <button className="cg-btn cg-btn-ghost" type="button" onClick={onAddAnother}>
              + Add another
            </button>
          )}
        </div>
      )}
    </div>
  );
}
