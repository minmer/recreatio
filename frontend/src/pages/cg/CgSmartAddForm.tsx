import { useEffect, useRef, useState } from 'react';
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
  nodeId?: string; // set when user picks from autocomplete
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

function setSlotValue(fs: FieldState, slotIdx: number, value: string, nodeId?: string): FieldState {
  return { ...fs, slots: fs.slots.map((s, i) => (i === slotIdx ? { ...s, value, nodeId } : s)) };
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
    (fs) => fs.slots.every((s) => !s.value.trim()) && fs.subForms.every((sf) => isFormEmpty(sf)),
  );
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
    defId: string; textValue?: string; refNodeId?: string;
    numberValue?: number; dateValue?: string; boolValue?: boolean; sortOrder: number;
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
            def.refNodeKindId, sf, libId, allDefs, depth + 1, true,
          );
          fieldValues.push({ defId: def.id, refNodeId: refNode.id, sortOrder: i });
          if (labelParts.length === 0 || i > 0) labelParts.push(refLabel);
        }
      } else {
        for (let i = 0; i < fieldState.count; i++) {
          const slot = fieldState.slots[i];
          if (!slot) continue;
          // Use pinned nodeId directly, skip API search
          if (slot.nodeId) {
            fieldValues.push({ defId: def.id, refNodeId: slot.nodeId, sortOrder: i });
          } else {
            const label = slot.value.trim();
            if (!label) continue;
            const existing = await listNodes(libId, { kindId: def.refNodeKindId, q: label, limit: 20 });
            const match = existing.find((n) => n.label?.toLowerCase() === label.toLowerCase());
            const refNode = match ?? await createNode(libId, { nodeType: 'Entity', nodeKindId: def.refNodeKindId, label });
            fieldValues.push({ defId: def.id, refNodeId: refNode.id, sortOrder: i });
          }
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
      fieldDefId: fv.defId, textValue: fv.textValue, refNodeId: fv.refNodeId,
      numberValue: fv.numberValue, dateValue: fv.dateValue, boolValue: fv.boolValue,
      sortOrder: fv.sortOrder,
    });
  }

  return { node, label };
}

// ── RefSelect ─────────────────────────────────────────────────────────────────

function RefSelect({ libId, refKindId, refKindName, slot, onUpdate, onEnter, tabIndex: tabIdx }: {
  libId: string;
  refKindId: string;
  refKindName: string;
  slot: SlotState;
  onUpdate: (slot: SlotState) => void;
  onEnter: (el: HTMLInputElement) => void;
  tabIndex?: number;
}) {
  const [query, setQuery] = useState(slot.value);
  const [suggestions, setSuggestions] = useState<CgNode[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slot.stable) setQuery(slot.value);
  }, [slot.value, slot.stable]);

  function handleChange(val: string) {
    setQuery(val);
    onUpdate({ ...slot, value: val, nodeId: undefined });
    if (timer.current) clearTimeout(timer.current);
    if (val.length >= 1) {
      timer.current = setTimeout(async () => {
        try {
          const results = await listNodes(libId, { kindId: refKindId, q: val, limit: 8 });
          setSuggestions(results);
          setOpen(results.length > 0);
        } catch { /* ignore */ }
      }, 200);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  }

  function select(node: CgNode) {
    const label = node.label ?? '';
    setQuery(label);
    setSuggestions([]);
    setOpen(false);
    onUpdate({ value: label, nodeId: node.id, stable: true });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && suggestions.length > 0) {
        select(suggestions[0]);
      } else {
        setOpen(false);
        if (inputRef.current) onEnter(inputRef.current);
      }
    }
  }

  if (slot.nodeId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--cg-cyan)', letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>
          {refKindName}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          background: 'var(--cg-cyan)22', color: 'var(--cg-cyan)',
          borderRadius: '999px', padding: '0.15rem 0.55rem',
          fontSize: '0.82rem', fontWeight: 600,
        }}>
          {slot.value}
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}
            onClick={() => { onUpdate({ value: '', nodeId: undefined, stable: false }); setQuery(''); }}
          >
            ×
          </button>
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        ref={inputRef}
        className="cg-input"
        style={{ width: '100%' }}
        placeholder={`${refKindName}…`}
        value={query}
        tabIndex={tabIdx}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { setTimeout(() => setOpen(false), 150); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--cg-surface)', border: '1px solid var(--cg-border)',
          borderRadius: 'var(--cg-radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          marginTop: 2, maxHeight: 160, overflowY: 'auto',
        }}>
          {suggestions.map((n) => (
            <button
              key={n.id}
              type="button"
              onMouseDown={() => select(n)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.4rem 0.65rem', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '0.85rem', color: 'var(--cg-text)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              {n.label ?? '(unnamed)'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Schema description ────────────────────────────────────────────────────────

function buildDescription(kindId: string, allKinds: CgNodeKind[], allDefs: CgFieldDef[]): string {
  const kindDefs = allDefs.filter((d) => d.nodeKindId === kindId).sort((a, b) => a.sortOrder - b.sortOrder);
  const parts = kindDefs.map((d) => {
    if (d.fieldType === 'Ref' && d.refNodeKindId) {
      const refKind = allKinds.find((k) => k.id === d.refNodeKindId);
      return refKind ? `${d.fieldName} (${refKind.name})` : d.fieldName;
    }
    return d.fieldName;
  });
  return parts.join(' · ');
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
  const [expanded, setExpanded] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFormState(initForm(selectedKindId, fieldDefs, 0));
  }, [selectedKindId]);

  const selectedKind = kinds.find((k) => k.id === selectedKindId);
  if (!selectedKind) return null;

  const kindDefs = fieldDefs.filter((d) => d.nodeKindId === selectedKindId).sort((a, b) => a.sortOrder - b.sortOrder);
  const description = buildDescription(selectedKindId, kinds, fieldDefs);

  async function handleSubmit() {
    setAdding(true);
    setError(null);
    try {
      const { node } = await submitKind(selectedKindId, formState, libId, fieldDefs, 0, false);
      const newState: FormState = {};
      for (const def of kindDefs) {
        if (formState[def.id]) {
          newState[def.id] = applyStableField(formState[def.id], def, fieldDefs, 0);
        }
      }
      setFormState(newState);
      onCreated(node);
      // refocus first non-stable input
      setTimeout(() => {
        const first = formRef.current?.querySelector<HTMLElement>('input:not([tabindex="-1"]), select:not([tabindex="-1"])');
        first?.focus();
      }, 50);
    } catch {
      setError(copy.cg.graph.createFailed);
    } finally {
      setAdding(false);
    }
  }

  function focusNext(currentEl: HTMLElement) {
    if (!formRef.current) return;
    const inputs = Array.from(
      formRef.current.querySelectorAll<HTMLElement>('input:not([tabindex="-1"]), select:not([tabindex="-1"])')
    );
    const idx = inputs.indexOf(currentEl);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    } else {
      handleSubmit();
    }
  }

  function handleFieldKey(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    focusNext(e.currentTarget as HTMLElement);
  }

  function renderField(
    def: CgFieldDef,
    fieldState: FieldState,
    onChange: (f: FieldState) => void,
    depth: number,
  ): React.ReactNode {
    const isExpandedRef = def.fieldType === 'Ref' && def.refNodeKindId && depth < MAX_DEPTH;
    const isLeafRef = def.fieldType === 'Ref' && def.refNodeKindId && depth >= MAX_DEPTH;
    const refKind = def.fieldType === 'Ref' && def.refNodeKindId ? kinds.find((k) => k.id === def.refNodeKindId) : null;
    const subKind = isExpandedRef ? refKind : null;
    const subDefs = subKind
      ? fieldDefs.filter((d) => d.nodeKindId === subKind.id).sort((a, b) => a.sortOrder - b.sortOrder)
      : [];

    return (
      <div key={def.id} style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--cg-text-dim)' }}>
            {def.fieldName}
            {refKind && (
              <span style={{ fontWeight: 400, marginLeft: '0.25rem', textTransform: 'none' }}>→ {refKind.name}</span>
            )}
          </span>
          {def.isMultiValue && (
            <>
              <button className="cg-btn cg-btn-ghost cg-btn-sm" type="button" tabIndex={-1}
                onClick={() => onChange(adjustCount(fieldState, fieldState.count - 1, def, fieldDefs, depth))}
                disabled={fieldState.count <= 1}>−</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--cg-text)', minWidth: '1rem', textAlign: 'center' }}>{fieldState.count}</span>
              <button className="cg-btn cg-btn-ghost cg-btn-sm" type="button" tabIndex={-1}
                onClick={() => onChange(adjustCount(fieldState, fieldState.count + 1, def, fieldDefs, depth))}>+</button>
              <button
                className="cg-btn cg-btn-ghost cg-btn-sm"
                style={fieldState.countStable ? { color: 'var(--cg-cyan)' } : {}}
                type="button" tabIndex={-1}
                title={fieldState.countStable ? 'Count pinned' : 'Pin count'}
                onClick={() => onChange({ ...fieldState, countStable: !fieldState.countStable })}>
                {fieldState.countStable ? '🔒' : '🔓'}
              </button>
            </>
          )}
        </div>

        {Array.from({ length: fieldState.count }, (_, slotIdx) => {
          const slot = fieldState.slots[slotIdx] ?? { value: '', stable: false };
          const isStable = slot.stable;

          return (
            <div
              key={slotIdx}
              style={
                isExpandedRef
                  ? {
                      border: '1px solid var(--cg-border)', borderRadius: 'var(--cg-radius)',
                      padding: '0.65rem', marginBottom: '0.5rem',
                      background: depth === 0 ? 'var(--cg-surface)' : 'var(--cg-bg)',
                    }
                  : { display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.3rem' }
              }
            >
              {isExpandedRef && subKind && fieldState.count > 1 && (
                <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--cg-text-dim)', margin: '0 0 0.4rem' }}>
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
              ) : isLeafRef ? (
                <>
                  <RefSelect
                    libId={libId}
                    refKindId={def.refNodeKindId!}
                    refKindName={refKind?.name ?? def.fieldName}
                    slot={slot}
                    onUpdate={(newSlot) =>
                      onChange({ ...fieldState, slots: fieldState.slots.map((s, i) => (i === slotIdx ? newSlot : s)) })
                    }
                    onEnter={(el) => focusNext(el)}
                    tabIndex={isStable ? -1 : 0}
                  />
                  <button
                    className="cg-btn cg-btn-ghost cg-btn-sm"
                    style={isStable ? { color: 'var(--cg-cyan)' } : { color: 'var(--cg-text-dim)' }}
                    type="button" tabIndex={-1}
                    title={isStable ? 'Pinned' : 'Pin this value'}
                    onClick={() => onChange(toggleStable(fieldState, slotIdx))}>
                    {isStable ? '🔒' : '🔓'}
                  </button>
                </>
              ) : (
                <>
                  {def.fieldType === 'Boolean' ? (
                    <select
                      className="cg-select" style={{ flex: 1 }}
                      value={slot.value || 'false'}
                      tabIndex={isStable ? -1 : 0}
                      onChange={(e) => onChange(setSlotValue(fieldState, slotIdx, e.target.value))}
                      onKeyDown={handleFieldKey}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input
                      className="cg-input" style={{ flex: 1 }}
                      placeholder={def.fieldName}
                      value={slot.value}
                      type={def.fieldType === 'Number' ? 'number' : def.fieldType === 'Date' ? 'date' : 'text'}
                      tabIndex={isStable ? -1 : 0}
                      onChange={(e) => onChange(setSlotValue(fieldState, slotIdx, e.target.value))}
                      onKeyDown={handleFieldKey}
                    />
                  )}
                  <button
                    className="cg-btn cg-btn-ghost cg-btn-sm"
                    style={isStable ? { color: 'var(--cg-cyan)' } : { color: 'var(--cg-text-dim)' }}
                    type="button" tabIndex={-1}
                    title={isStable ? 'Pinned' : 'Pin this value'}
                    onClick={() => onChange(toggleStable(fieldState, slotIdx))}>
                    {isStable ? '🔒' : '🔓'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cg-surface)', border: '1px solid var(--cg-border)', borderRadius: 'var(--cg-radius)', padding: '1rem', marginBottom: '1rem' }}>
      {/* Collapsed header — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cg-text-dim)', margin: 0, flexShrink: 0 }}>
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
          <span style={{ fontSize: '0.8rem', color: 'var(--cg-text-dim)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {description}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
          {expanded ? (
            <button className="cg-btn cg-btn-ghost cg-btn-sm" type="button" tabIndex={-1} onClick={() => setExpanded(false)}>✕</button>
          ) : (
            <button className="cg-btn cg-btn-primary" type="button" onClick={() => { setExpanded(true); setTimeout(() => { const first = formRef.current?.querySelector<HTMLElement>('input:not([tabindex="-1"]), select:not([tabindex="-1"])'); first?.focus(); }, 50); }}>
              {copy.cg.graph.addAction}
            </button>
          )}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div ref={formRef} style={{ marginTop: '1rem' }}>
          {error && <p className="cg-error" style={{ marginBottom: '0.5rem' }}>{error}</p>}
          {kindDefs.map((def) =>
            formState[def.id]
              ? renderField(def, formState[def.id], (updated) => setFormState((prev) => ({ ...prev, [def.id]: updated })), 0)
              : null
          )}
          <button className="cg-btn cg-btn-primary" type="button" onClick={handleSubmit} disabled={adding} style={{ marginTop: '0.5rem' }}>
            {adding ? copy.cg.graph.adding : copy.cg.graph.addAction}
          </button>
        </div>
      )}
    </div>
  );
}
