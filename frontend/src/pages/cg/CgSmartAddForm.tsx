import { useEffect, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgNode,
  type CgNodeKind,
  createNode,
  listNodes,
  upsertFieldValue,
} from './api/cgApi';

// ── Types ────────────────────────────────────────────────────────────────────

interface SlotState {
  value: string;
  stable: boolean;
}

interface FieldState {
  count: number;
  countStable: boolean;
  slots: SlotState[];
  subForms: Array<Record<string, FieldState>>;
}

type FormState = Record<string, FieldState>;

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_DEPTH = 2;

// ── Init helpers ─────────────────────────────────────────────────────────────

function initField(def: CgFieldDef, allDefs: CgFieldDef[], depth: number): FieldState {
  const defaultCount = def.isMultiValue ? (depth === 0 ? 2 : 1) : 1;
  const slots: SlotState[] = Array.from({ length: defaultCount }, () => ({ value: '', stable: false }));
  const subForms: Array<Record<string, FieldState>> =
    def.fieldType === 'Ref' && def.refNodeKindId && depth < MAX_DEPTH
      ? slots.map(() => initForm(def.refNodeKindId!, allDefs, depth + 1))
      : [];
  return { count: defaultCount, countStable: false, slots, subForms };
}

function initForm(kindId: string, allDefs: CgFieldDef[], depth: number): FormState {
  const kindDefs = allDefs.filter((d) => d.nodeKindId === kindId).sort((a, b) => a.sortOrder - b.sortOrder);
  return Object.fromEntries(kindDefs.map((d) => [d.id, initField(d, allDefs, depth)]));
}

// ── Slot helpers ──────────────────────────────────────────────────────────────

function adjustSlots(slots: SlotState[], count: number): SlotState[] {
  if (slots.length >= count) return slots.slice(0, count);
  return [...slots, ...Array.from({ length: count - slots.length }, () => ({ value: '', stable: false }))];
}

function setSlotValue(fs: FieldState, slotIdx: number, value: string): FieldState {
  return { ...fs, slots: fs.slots.map((s, i) => (i === slotIdx ? { ...s, value } : s)) };
}

function toggleStable(fs: FieldState, slotIdx: number): FieldState {
  return { ...fs, slots: fs.slots.map((s, i) => (i === slotIdx ? { ...s, stable: !s.stable } : s)) };
}

function adjustCount(fs: FieldState, newCount: number, def: CgFieldDef, allDefs: CgFieldDef[], depth: number): FieldState {
  if (newCount < 1) newCount = 1;
  const newSlots = adjustSlots(fs.slots, newCount);
  let newSubForms = fs.subForms.slice(0, newCount);
  if (def.fieldType === 'Ref' && def.refNodeKindId && depth < MAX_DEPTH) {
    while (newSubForms.length < newCount) {
      newSubForms = [...newSubForms, initForm(def.refNodeKindId!, allDefs, depth + 1)];
    }
  }
  return { ...fs, count: newCount, slots: newSlots, subForms: newSubForms };
}

// ── Stable persistence after submit ──────────────────────────────────────────

function applyStableField(fs: FieldState, def: CgFieldDef, allDefs: CgFieldDef[], depth: number): FieldState {
  const defaultCount = def.isMultiValue ? (depth === 0 ? 2 : 1) : 1;
  const newCount = fs.countStable ? fs.count : defaultCount;
  const newSlots = adjustSlots(
    fs.slots.map((s) => (s.stable ? s : { value: '', stable: false })),
    newCount,
  );
  const subDefs =
    def.fieldType === 'Ref' && def.refNodeKindId && depth < MAX_DEPTH
      ? allDefs.filter((d) => d.nodeKindId === def.refNodeKindId!).sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
  let newSubForms = fs.subForms.slice(0, newCount).map((sf) =>
    Object.fromEntries(
      subDefs.map((sd) => [
        sd.id,
        applyStableField(sf[sd.id] ?? initField(sd, allDefs, depth + 1), sd, allDefs, depth + 1),
      ]),
    ),
  );
  while (newSubForms.length < newCount && def.fieldType === 'Ref' && def.refNodeKindId && depth < MAX_DEPTH) {
    newSubForms = [...newSubForms, initForm(def.refNodeKindId!, allDefs, depth + 1)];
  }
  return { count: newCount, countStable: fs.countStable, slots: newSlots, subForms: newSubForms };
}

// ── Submit helpers ────────────────────────────────────────────────────────────

function isFormEmpty(formState: FormState): boolean {
  return Object.values(formState).every(
    (fs) =>
      fs.slots.every((s) => !s.value.trim()) &&
      fs.subForms.every((sf) => isFormEmpty(sf)),
  );
}

async function findOrCreate(libId: string, kindId: string, label: string): Promise<CgNode> {
  if (label) {
    const existing = await listNodes(libId, { kindId, q: label, limit: 20 });
    const match = existing.find((n) => n.label?.toLowerCase() === label.toLowerCase());
    if (match) return match;
  }
  return createNode(libId, { nodeType: 'Entity', nodeKindId: kindId, label: label || undefined });
}

async function submitKind(
  kindId: string,
  formState: FormState,
  libId: string,
  allDefs: CgFieldDef[],
  depth: number,
  findOrCreateMode: boolean,
): Promise<{ node: CgNode; label: string }> {
  const kindDefs = allDefs.filter((d) => d.nodeKindId === kindId).sort((a, b) => a.sortOrder - b.sortOrder);
  const fieldValues: Array<{
    defId: string;
    textValue?: string;
    refNodeId?: string;
    numberValue?: number;
    dateValue?: string;
    boolValue?: boolean;
    sortOrder: number;
  }> = [];
  const labelParts: string[] = [];

  for (const def of kindDefs) {
    const fieldState = formState[def.id];
    if (!fieldState) continue;

    if (def.fieldType === 'Ref' && def.refNodeKindId) {
      if (depth < MAX_DEPTH && fieldState.subForms.length > 0) {
        for (let i = 0; i < Math.min(fieldState.count, fieldState.subForms.length); i++) {
          const sf = fieldState.subForms[i];
          if (isFormEmpty(sf)) continue;
          const { node: refNode, label: refLabel } = await submitKind(
            def.refNodeKindId,
            sf,
            libId,
            allDefs,
            depth + 1,
            true,
          );
          fieldValues.push({ defId: def.id, refNodeId: refNode.id, sortOrder: i });
          if (labelParts.length === 0 || i > 0) labelParts.push(refLabel);
        }
      } else {
        for (let i = 0; i < fieldState.count; i++) {
          const label = fieldState.slots[i]?.value.trim() ?? '';
          if (!label) continue;
          const refNode = await findOrCreate(libId, def.refNodeKindId, label);
          fieldValues.push({ defId: def.id, refNodeId: refNode.id, sortOrder: i });
        }
      }
    } else {
      for (let i = 0; i < fieldState.count; i++) {
        const slot = fieldState.slots[i];
        if (!slot) continue;
        const value = slot.value.trim();
        if (!value) continue;
        const fv: (typeof fieldValues)[0] = { defId: def.id, sortOrder: i };
        if (def.fieldType === 'Text') fv.textValue = value;
        else if (def.fieldType === 'Number') fv.numberValue = Number(value);
        else if (def.fieldType === 'Date') fv.dateValue = value;
        else if (def.fieldType === 'Boolean') fv.boolValue = value === 'true';
        fieldValues.push(fv);
        if (i === 0 && labelParts.length === 0) labelParts.push(value);
      }
    }
  }

  const label = labelParts.join(' / ');

  let node: CgNode;
  if (findOrCreateMode && label) {
    const existing = await listNodes(libId, { kindId, q: label, limit: 20 });
    const match = existing.find((n) => n.label?.toLowerCase() === label.toLowerCase());
    if (match) return { node: match, label };
    node = await createNode(libId, { nodeType: 'Entity', nodeKindId: kindId, label });
  } else {
    node = await createNode(libId, { nodeType: 'Entity', nodeKindId: kindId, label: label || undefined });
  }

  for (const fv of fieldValues) {
    await upsertFieldValue(libId, node.id, {
      fieldDefId: fv.defId,
      textValue: fv.textValue,
      refNodeId: fv.refNodeId,
      numberValue: fv.numberValue,
      dateValue: fv.dateValue,
      boolValue: fv.boolValue,
      sortOrder: fv.sortOrder,
    });
  }

  return { node, label };
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

export function CgSmartAddForm({ copy, libId, kinds, fieldDefs, selectedKindId, onKindChange, onCreated }: Props) {
  const [formState, setFormState] = useState<FormState>(() => initForm(selectedKindId, fieldDefs, 0));
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormState(initForm(selectedKindId, fieldDefs, 0));
  }, [selectedKindId]);

  async function handleSubmit() {
    setAdding(true);
    setError(null);
    try {
      const { node } = await submitKind(selectedKindId, formState, libId, fieldDefs, 0, false);
      const kindDefs = fieldDefs
        .filter((d) => d.nodeKindId === selectedKindId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const newState: FormState = {};
      for (const def of kindDefs) {
        if (formState[def.id]) {
          newState[def.id] = applyStableField(formState[def.id], def, fieldDefs, 0);
        }
      }
      setFormState(newState);
      onCreated(node);
    } catch {
      setError(copy.cg.graph.createFailed);
    } finally {
      setAdding(false);
    }
  }

  const selectedKind = kinds.find((k) => k.id === selectedKindId);
  if (!selectedKind) return null;
  const kindDefs = fieldDefs
    .filter((d) => d.nodeKindId === selectedKindId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function renderField(
    def: CgFieldDef,
    fieldState: FieldState,
    onChange: (f: FieldState) => void,
    depth: number,
  ): React.ReactNode {
    const isExpandedRef = def.fieldType === 'Ref' && def.refNodeKindId && depth < MAX_DEPTH;
    const subKind = isExpandedRef ? kinds.find((k) => k.id === def.refNodeKindId) : null;
    const subDefs = subKind
      ? fieldDefs.filter((d) => d.nodeKindId === subKind.id).sort((a, b) => a.sortOrder - b.sortOrder)
      : [];

    return (
      <div key={def.id} style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--cg-text-dim)',
            }}
          >
            {def.fieldName}
          </span>
          {def.isMultiValue && (
            <>
              <button
                className="cg-btn cg-btn-ghost cg-btn-sm"
                type="button"
                onClick={() => onChange(adjustCount(fieldState, fieldState.count - 1, def, fieldDefs, depth))}
                disabled={fieldState.count <= 1}
              >
                −
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--cg-text)' }}>{fieldState.count}</span>
              <button
                className="cg-btn cg-btn-ghost cg-btn-sm"
                type="button"
                onClick={() => onChange(adjustCount(fieldState, fieldState.count + 1, def, fieldDefs, depth))}
              >
                +
              </button>
              <button
                className={`cg-btn cg-btn-ghost cg-btn-sm${fieldState.countStable ? ' active' : ''}`}
                style={fieldState.countStable ? { color: 'var(--cg-cyan)' } : {}}
                type="button"
                title={fieldState.countStable ? 'Count pinned' : 'Pin count'}
                onClick={() => onChange({ ...fieldState, countStable: !fieldState.countStable })}
              >
                {fieldState.countStable ? '🔒' : '🔓'}
              </button>
            </>
          )}
        </div>

        {Array.from({ length: fieldState.count }, (_, slotIdx) => (
          <div
            key={slotIdx}
            style={
              isExpandedRef
                ? {
                    border: '1px solid var(--cg-border)',
                    borderRadius: 'var(--cg-radius)',
                    padding: '0.65rem',
                    marginBottom: '0.5rem',
                    background: depth === 0 ? 'var(--cg-surface)' : 'var(--cg-bg)',
                  }
                : { display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.3rem' }
            }
          >
            {isExpandedRef && subKind && fieldState.count > 1 && (
              <p
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--cg-text-dim)',
                  margin: '0 0 0.4rem',
                }}
              >
                {subKind.name} {slotIdx + 1}
              </p>
            )}

            {isExpandedRef ? (
              subDefs.map((subDef) => {
                const subFieldState = fieldState.subForms[slotIdx]?.[subDef.id];
                if (!subFieldState) return null;
                return renderField(subDef, subFieldState, (updated) => {
                  const newSubForms = fieldState.subForms.map((sf, i) =>
                    i === slotIdx ? { ...sf, [subDef.id]: updated } : sf,
                  );
                  onChange({ ...fieldState, subForms: newSubForms });
                }, depth + 1);
              })
            ) : (
              <>
                {def.fieldType === 'Boolean' ? (
                  <select
                    className="cg-select"
                    style={{ flex: 1 }}
                    value={fieldState.slots[slotIdx]?.value || 'false'}
                    onChange={(e) => onChange(setSlotValue(fieldState, slotIdx, e.target.value))}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    className="cg-input"
                    style={{ flex: 1 }}
                    placeholder={def.fieldName}
                    value={fieldState.slots[slotIdx]?.value ?? ''}
                    type={
                      def.fieldType === 'Number' ? 'number' : def.fieldType === 'Date' ? 'date' : 'text'
                    }
                    onChange={(e) => onChange(setSlotValue(fieldState, slotIdx, e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmit();
                    }}
                  />
                )}
                <button
                  className="cg-btn cg-btn-ghost cg-btn-sm"
                  style={
                    fieldState.slots[slotIdx]?.stable
                      ? { color: 'var(--cg-cyan)' }
                      : { color: 'var(--cg-text-dim)' }
                  }
                  type="button"
                  title={
                    fieldState.slots[slotIdx]?.stable
                      ? 'Pinned (persists after add)'
                      : 'Pin this value'
                  }
                  onClick={() => onChange(toggleStable(fieldState, slotIdx))}
                >
                  {fieldState.slots[slotIdx]?.stable ? '🔒' : '🔓'}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--cg-surface)',
        border: '1px solid var(--cg-border)',
        borderRadius: 'var(--cg-radius)',
        padding: '1rem',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.85rem',
          flexWrap: 'wrap',
        }}
      >
        <p
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--cg-text-dim)',
            margin: 0,
          }}
        >
          {copy.cg.graph.addNode}
        </p>
        <select
          className="cg-select"
          value={selectedKindId}
          onChange={(e) => onKindChange(e.target.value)}
        >
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="cg-error" style={{ marginBottom: '0.5rem' }}>{error}</p>}

      {kindDefs.map((def) =>
        formState[def.id]
          ? renderField(def, formState[def.id], (updated) =>
              setFormState((prev) => ({ ...prev, [def.id]: updated })),
            0)
          : null,
      )}

      <button
        className="cg-btn cg-btn-primary"
        type="button"
        onClick={handleSubmit}
        disabled={adding}
      >
        {adding ? copy.cg.graph.adding : copy.cg.graph.addAction}
      </button>
    </div>
  );
}
