import { useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgNode,
  type CgNodeKind,
  createNode,
  upsertFieldValue,
} from './api/cgApi';
import { CgNodePicker, type PickedNode } from './CgNodePicker';

// ── Form state ────────────────────────────────────────────────────────────────

interface ScalarField {
  kind: 'scalar';
  value: string;
  stable: boolean;
}

interface RefField {
  kind: 'ref';
  nodes: PickedNode[];
  stable: boolean;
}

type FieldEntry = ScalarField | RefField;
type AddFormState = Record<string, FieldEntry>; // keyed by fieldDefId

function initFormState(kindId: string, allDefs: CgFieldDef[]): AddFormState {
  const defs = allDefs.filter((d) => d.nodeKindId === kindId).sort((a, b) => a.sortOrder - b.sortOrder);
  return Object.fromEntries(
    defs.map((d) => [
      d.id,
      d.fieldType === 'Ref'
        ? { kind: 'ref', nodes: [], stable: false }
        : { kind: 'scalar', value: '', stable: false },
    ]),
  );
}

function applyStable(state: AddFormState): AddFormState {
  return Object.fromEntries(
    Object.entries(state).map(([id, entry]) => {
      if (entry.kind === 'ref') {
        return [id, { ...entry, nodes: entry.stable ? entry.nodes : [] }];
      }
      return [id, { ...entry, value: entry.stable ? entry.value : '' }];
    }),
  );
}

// ── Schema description (collapsed summary) ────────────────────────────────────

function buildDescription(kindId: string, allKinds: CgNodeKind[], allDefs: CgFieldDef[]): string {
  const defs = allDefs.filter((d) => d.nodeKindId === kindId).sort((a, b) => a.sortOrder - b.sortOrder);
  return defs
    .map((d) => {
      if (d.fieldType === 'Ref' && d.refNodeKindId) {
        const ref = allKinds.find((k) => k.id === d.refNodeKindId);
        return ref ? `${d.fieldName} → ${ref.name}` : d.fieldName;
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
      // Derive label from first scalar Text field
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
          for (let i = 0; i < entry.nodes.length; i++) {
            await upsertFieldValue(libId, node.id, {
              fieldDefId: def.id,
              refNodeId: entry.nodes[i].id,
              sortOrder: i,
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

  // ── Helpers to update individual fields ──

  function setScalar(defId: string, value: string) {
    setFormState((prev) => ({
      ...prev,
      [defId]: { ...prev[defId], kind: 'scalar', value } as ScalarField,
    }));
  }

  function toggleScalarStable(defId: string) {
    setFormState((prev) => {
      const e = prev[defId];
      return { ...prev, [defId]: { ...e, stable: !e.stable } };
    });
  }

  function setRefNodes(defId: string, nodes: PickedNode[]) {
    setFormState((prev) => ({
      ...prev,
      [defId]: { ...prev[defId], kind: 'ref', nodes } as RefField,
    }));
  }

  function toggleRefStable(defId: string) {
    setFormState((prev) => {
      const e = prev[defId];
      return { ...prev, [defId]: { ...e, stable: !e.stable } };
    });
  }

  function handleScalarKey(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, defId: string) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // find next scalar input
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

            const refKind = def.fieldType === 'Ref' && def.refNodeKindId
              ? kinds.find((k) => k.id === def.refNodeKindId)
              : null;

            return (
              <div key={def.id} style={{ marginBottom: '0.85rem' }}>
                {/* Field label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: 'var(--cg-text-dim)',
                  }}>
                    {def.fieldName}
                    {refKind && (
                      <span style={{ fontWeight: 400, marginLeft: '0.25rem', textTransform: 'none' }}>
                        → {refKind.name}
                      </span>
                    )}
                  </span>

                  {/* Stable toggle (per-field) */}
                  <button
                    className="cg-btn cg-btn-ghost cg-btn-sm"
                    style={entry.stable ? { color: 'var(--cg-cyan)', marginLeft: 'auto' } : { color: 'var(--cg-text-dim)', marginLeft: 'auto' }}
                    type="button"
                    tabIndex={-1}
                    title={entry.stable ? 'Pinned — persists after add' : 'Pin this field'}
                    onClick={() =>
                      entry.kind === 'ref' ? toggleRefStable(def.id) : toggleScalarStable(def.id)
                    }
                  >
                    {entry.stable ? '🔒' : '🔓'}
                  </button>
                </div>

                {/* Field input */}
                {entry.kind === 'ref' && refKind ? (
                  <CgNodePicker
                    libId={libId}
                    refKindId={def.refNodeKindId!}
                    refKindName={refKind.name}
                    allKinds={kinds}
                    allDefs={fieldDefs}
                    selected={entry.nodes}
                    onAdd={(node) =>
                      setRefNodes(
                        def.id,
                        def.isMultiValue ? [...entry.nodes, node] : [node],
                      )
                    }
                    onRemove={(nodeId) =>
                      setRefNodes(def.id, entry.nodes.filter((n) => n.id !== nodeId))
                    }
                    maxCount={def.isMultiValue ? Infinity : 1}
                    depth={0}
                  />
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
                      type={def.fieldType === 'Number' ? 'number' : def.fieldType === 'Date' ? 'date' : 'text'}
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
