import { useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgNode,
  type CgNodeDetail,
  type CgNodeKind,
  deleteFieldValue,
  getNode,
  getRefKindIds,
  updateNode,
  upsertFieldValue,
} from './api/cgApi';
import { type AddFormState, type RefField, type RefSlot, type ScalarField } from './CgSmartAddForm';
import { CgNodePicker, type PickedNode } from './CgNodePicker';

interface Props {
  copy: Copy;
  libId: string;
  node: CgNode;
  kinds: CgNodeKind[];
  fieldDefs: CgFieldDef[];
  onSaved: (updatedNode: CgNode) => void;
  onCancel: () => void;
}

export function CgNodeEditForm({ copy, libId, node, kinds, fieldDefs, onSaved, onCancel }: Props) {
  const t = copy.cg.graph;

  const kindDefs = fieldDefs
    .filter((d) => d.nodeKindId === node.nodeKindId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const [formState, setFormState] = useState<AddFormState>({});
  const [originalDetail, setOriginalDetail] = useState<CgNodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const selectedKind = node.nodeKindId ? kinds.find((k) => k.id === node.nodeKindId) : null;

  // Load existing field values and resolve ref node labels in parallel
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getNode(libId, node.id)
      .then(async (detail) => {
        if (cancelled) return;
        setOriginalDetail(detail);

        const uniqueRefIds = [
          ...new Set(detail.fieldValues.filter((v) => v.refNodeId).map((v) => v.refNodeId!)),
        ];
        const refNodeDetails = await Promise.all(uniqueRefIds.map((id) => getNode(libId, id)));
        if (cancelled) return;
        const refNodeMap = new Map(refNodeDetails.map((d) => [d.node.id, d.node]));

        const state: AddFormState = {};
        for (const def of kindDefs) {
          const values = detail.fieldValues
            .filter((v) => v.fieldDefId === def.id)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          if (def.fieldType === 'Ref') {
            const slots: RefSlot[] = values
              .filter((v) => v.refNodeId)
              .map((v) => {
                const refNode = refNodeMap.get(v.refNodeId!);
                return { node: refNode ? { id: refNode.id, label: refNode.label ?? '' } : null, pinned: false };
              })
              .filter((s): s is RefSlot & { node: PickedNode } => s.node !== null);

            state[def.id] = {
              kind: 'ref',
              slots: slots.length > 0 ? slots : [{ node: null, pinned: false }],
            } satisfies RefField;
          } else {
            const fv = values[0];
            let value = '';
            if (fv) {
              if (def.fieldType === 'Text') value = fv.textValue ?? '';
              else if (def.fieldType === 'Number') value = fv.numberValue != null ? String(fv.numberValue) : '';
              else if (def.fieldType === 'Date') value = fv.dateValue ?? '';
              else if (def.fieldType === 'Boolean') value = fv.boolValue != null ? String(fv.boolValue) : 'false';
            }
            state[def.id] = { kind: 'scalar', value, stable: false } satisfies ScalarField;
          }
        }

        setFormState(state);
      })
      .catch(() => setError(t.loadFailed))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libId, node.id]);

  // ── Save ──

  async function handleSave() {
    if (!originalDetail) return;
    setSaving(true);
    setError(null);
    try {
      for (const def of kindDefs) {
        // Delete all existing values for this field, then re-insert current
        const existing = originalDetail.fieldValues.filter((v) => v.fieldDefId === def.id);
        for (const v of existing) {
          await deleteFieldValue(libId, node.id, v.id);
        }

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

      // Sync node label from first Text field
      const firstText = kindDefs.find((d) => d.fieldType === 'Text');
      const labelEntry = firstText ? formState[firstText.id] : undefined;
      const label = labelEntry?.kind === 'scalar' ? labelEntry.value.trim() || undefined : undefined;
      const updatedNode = await updateNode(libId, node.id, label);

      onSaved(updatedNode);
    } catch {
      setError(t.updateFailed);
    } finally {
      setSaving(false);
    }
  }

  // ── Field helpers ──

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
      handleSave();
    }
  }

  function setSlotNode(defId: string, slotIdx: number, picked: PickedNode | null) {
    setFormState((prev) => {
      const entry = prev[defId] as RefField;
      const slots = entry.slots.map((s, i) => (i === slotIdx ? { ...s, node: picked } : s));
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

  // ── Render ──

  if (loading) {
    return (
      <div style={{
        background: 'var(--cg-surface)', border: '1px solid var(--cg-cyan)44',
        borderRadius: 'var(--cg-radius)', padding: '1rem', marginBottom: '1rem',
        color: 'var(--cg-text-dim)', fontSize: '0.85rem',
      }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--cg-surface)', border: '1px solid var(--cg-cyan)44',
      borderRadius: 'var(--cg-radius)', padding: '1rem', marginBottom: '1rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {selectedKind && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--cg-cyan)', flexShrink: 0,
          }}>
            {selectedKind.name}
          </span>
        )}
        <span style={{ fontSize: '0.85rem', color: 'var(--cg-text)', fontWeight: 600 }}>
          {node.label ?? '(unnamed)'}
        </span>
        <button
          className="cg-btn cg-btn-ghost cg-btn-sm"
          type="button"
          tabIndex={-1}
          style={{ marginLeft: 'auto' }}
          onClick={onCancel}
        >
          ✕
        </button>
      </div>

      {error && <p className="cg-error" style={{ marginBottom: '0.5rem' }}>{error}</p>}

      {/* Fields — same rendering as CgSmartAddForm, without pin/stable toggles */}
      {kindDefs.map((def, defIdx) => {
        const entry = formState[def.id];
        if (!entry) return null;

        const defRefKindIds = getRefKindIds(def);
        const refKinds = def.fieldType === 'Ref'
          ? defRefKindIds.map((id) => kinds.find((k) => k.id === id)).filter(Boolean) as CgNodeKind[]
          : [];
        const refKindName = refKinds.map((k) => k.name).join(' / ');

        return (
          <div key={def.id} style={{ marginBottom: '0.85rem' }}>
            <div style={{ marginBottom: '0.3rem' }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--cg-text-dim)',
              }}>
                {def.fieldName}
                {refKinds.length > 0 && (
                  <span style={{ fontWeight: 400, marginLeft: '0.25rem', textTransform: 'none' }}>
                    → {refKinds.map((k) => k.name).join(', ')}
                  </span>
                )}
              </span>
            </div>

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
                        onAdd={(n) => setSlotNode(def.id, slotIdx, n)}
                        onRemove={() => setSlotNode(def.id, slotIdx, null)}
                        maxCount={1}
                        depth={0}
                      />
                    </div>
                    {def.isMultiValue && entry.slots.length > 1 && (
                      <button
                        className="cg-btn cg-btn-ghost cg-btn-sm"
                        type="button"
                        tabIndex={-1}
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
                  data-cg-scalar-input={def.id}
                  onChange={(e) => setScalar(def.id, e.target.value)}
                  onKeyDown={(e) => handleScalarKey(e, def.id)}
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
                  data-cg-scalar-input={def.id}
                  onChange={(e) => setScalar(def.id, e.target.value)}
                  onKeyDown={(e) => handleScalarKey(e, def.id)}
                />
              )
            ) : null}
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        <button
          className="cg-btn cg-btn-primary"
          type="button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t.savingChanges : t.saveAction}
        </button>
        <button
          className="cg-btn cg-btn-ghost"
          type="button"
          onClick={onCancel}
        >
          {copy.cg.node.cancelAction}
        </button>
      </div>
    </div>
  );
}
