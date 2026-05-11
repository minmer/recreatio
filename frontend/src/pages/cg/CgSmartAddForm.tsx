import { useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgNode,
  type CgNodeKind,
  createNode,
  getRefKindIds,
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

// ── Schema description (collapsed summary) ────────────────────────────────────

function buildDescription(kindId: string, allKinds: CgNodeKind[], allDefs: CgFieldDef[]): string {
  const defs = allDefs
    .filter((d) => d.nodeKindId === kindId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return defs
    .map((d) => {
      const refKindIds = getRefKindIds(d);
      if (d.fieldType === 'Ref' && refKindIds.length > 0) {
        const names = refKindIds.map((id) => allKinds.find((k) => k.id === id)?.name).filter(Boolean);
        return names.length ? `${d.fieldName} → ${names.join(', ')}` : d.fieldName;
      }
      return d.fieldName;
    })
    .join(' · ');
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

export function CgSmartAddForm({
  copy, libId, kinds, fieldDefs, selectedKindId, onKindChange, onCreated,
}: Props) {
  const [formState, setFormState] = useState<AddFormState>(
    () => initFormState(selectedKindId, fieldDefs),
  );
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormState(initFormState(selectedKindId, fieldDefs));
  }, [selectedKindId, fieldDefs]);

  const selectedKind = kinds.find((k) => k.id === selectedKindId);
  if (!selectedKind) return null;

  const kindDefs = fieldDefs
    .filter((d) => d.nodeKindId === selectedKindId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const description = buildDescription(selectedKindId, kinds, fieldDefs);

  // ── Submit ──

  async function handleSubmit() {
    setAdding(true);
    setError(null);
    try {
      const firstText = kindDefs.find((d) => d.fieldType === 'Text');
      const labelEntry = firstText ? formState[firstText.id] : undefined;
      const label =
        labelEntry?.kind === 'scalar' ? labelEntry.value.trim() || undefined : undefined;

      const node = await createNode(libId, {
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
      onCreated(node);
      setTimeout(() => firstInputRef.current?.focus(), 50);
    } catch {
      setError(copy.cg.graph.createFailed);
    } finally {
      setAdding(false);
    }
  }

  // ── Scalar helpers ──

  function setScalar(defId: string, value: string) {
    setFormState((prev) => ({
      ...prev,
      [defId]: { ...prev[defId], kind: 'scalar', value } as ScalarField,
    }));
  }

  function toggleScalarStable(defId: string) {
    setFormState((prev) => {
      const e = prev[defId] as ScalarField;
      return { ...prev, [defId]: { ...e, stable: !e.stable } };
    });
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

  function toggleSlotPin(defId: string, slotIdx: number) {
    setFormState((prev) => {
      const entry = prev[defId] as RefField;
      const slots = entry.slots.map((s, i) =>
        i === slotIdx ? { ...s, pinned: !s.pinned } : s,
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

  // ── Render ──

  return (
    <div style={{
      background: 'var(--cg-surface)', border: '1px solid var(--cg-border)',
      borderRadius: 'var(--cg-radius)', padding: '1rem', marginBottom: '1rem',
    }}>
      {/* Header — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <p style={{
          fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--cg-text-dim)', margin: 0, flexShrink: 0,
        }}>
          {copy.cg.graph.addNode}
        </p>
        <select
          className="cg-select"
          value={selectedKindId}
          onChange={(e) => { onKindChange(e.target.value); setExpanded(true); }}
        >
          {kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        {!expanded && (
          <span style={{
            fontSize: '0.8rem', color: 'var(--cg-text-dim)', flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {description}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
          {expanded ? (
            <button
              className="cg-btn cg-btn-ghost cg-btn-sm"
              type="button"
              tabIndex={-1}
              onClick={() => setExpanded(false)}
            >
              ✕
            </button>
          ) : (
            <button
              className="cg-btn cg-btn-primary"
              type="button"
              onClick={() => {
                setExpanded(true);
                setTimeout(() => firstInputRef.current?.focus(), 50);
              }}
            >
              {copy.cg.graph.addAction}
            </button>
          )}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div style={{ marginTop: '1rem' }}>
          {error && <p className="cg-error" style={{ marginBottom: '0.5rem' }}>{error}</p>}

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
                {/* Field label row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem',
                }}>
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

                  {/* Stable toggle only for scalar fields */}
                  {entry.kind === 'scalar' && (
                    <button
                      className="cg-btn cg-btn-ghost cg-btn-sm"
                      style={entry.stable
                        ? { color: 'var(--cg-cyan)', marginLeft: 'auto' }
                        : { color: 'var(--cg-text-dim)', marginLeft: 'auto' }}
                      type="button"
                      tabIndex={-1}
                      title={entry.stable ? 'Pinned — persists after add' : 'Pin this field'}
                      onClick={() => toggleScalarStable(def.id)}
                    >
                      {entry.stable ? '🔒' : '🔓'}
                    </button>
                  )}
                </div>

                {/* Field input */}
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

                        {/* Per-slot pin toggle */}
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

                        {/* Remove slot (only if multi-value and more than one slot) */}
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

                    {/* Add another slot for multi-value fields */}
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
            );
          })}

          <button
            className="cg-btn cg-btn-primary"
            type="button"
            onClick={handleSubmit}
            disabled={adding}
            style={{ marginTop: '0.25rem' }}
          >
            {adding ? copy.cg.graph.adding : copy.cg.graph.addAction}
          </button>
        </div>
      )}
    </div>
  );
}
