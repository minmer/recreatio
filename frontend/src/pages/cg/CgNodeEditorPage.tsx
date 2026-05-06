import { useEffect, useState } from 'react';
import {
  type CgFieldDef,
  type CgFieldValue,
  type CgNodeDetail,
  type CgNodeKind,
  deleteFieldValue,
  getLibrary,
  getNode,
  updateNode,
  upsertFieldValue,
} from './api/cgApi';

interface Props {
  libId: string;
  nodeId: string;
  onBack: () => void;
}

export function CgNodeEditorPage({ libId, nodeId, onBack }: Props) {
  const [detail, setDetail] = useState<CgNodeDetail | null>(null);
  const [kinds, setKinds] = useState<CgNodeKind[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CgFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Per-field edit state: fieldDefId -> draft value
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const [fieldSaving, setFieldSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    Promise.all([getNode(libId, nodeId), getLibrary(libId)])
      .then(([nodeDetail, libDetail]) => {
        setDetail(nodeDetail);
        setKinds(libDetail.nodeKinds);
        setFieldDefs(libDetail.fieldDefs);
      })
      .catch(() => setError('Failed to load node'))
      .finally(() => setLoading(false));
  }, [libId, nodeId]);

  async function handleSaveLabel() {
    if (labelDraft === null) return;
    setSaving(true);
    try {
      const updated = await updateNode(libId, nodeId, labelDraft.trim());
      setDetail((d) => d ? { ...d, node: updated } : d);
      setLabelDraft(null);
    } catch {
      setError('Failed to save label');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveField(def: CgFieldDef, existingValue: CgFieldValue | undefined, sortOrder: number) {
    const draft = fieldDrafts[`${def.id}:${sortOrder}`] ?? '';
    setFieldSaving((prev) => ({ ...prev, [`${def.id}:${sortOrder}`]: true }));
    try {
      const updated = await upsertFieldValue(libId, nodeId, {
        fieldDefId: def.id,
        textValue: def.fieldType === 'Text' ? draft : undefined,
        numberValue: def.fieldType === 'Number' ? Number(draft) : undefined,
        dateValue: def.fieldType === 'Date' ? draft : undefined,
        boolValue: def.fieldType === 'Boolean' ? draft === 'true' : undefined,
        sortOrder,
      });
      setDetail((d) => d ? { ...d, fieldValues: updated } : d);
      setFieldDrafts((prev) => {
        const next = { ...prev };
        delete next[`${def.id}:${sortOrder}`];
        return next;
      });
    } catch {
      setError('Failed to save field');
    } finally {
      setFieldSaving((prev) => ({ ...prev, [`${def.id}:${sortOrder}`]: false }));
    }
  }

  async function handleDeleteValue(valueId: string) {
    try {
      await deleteFieldValue(libId, nodeId, valueId);
      setDetail((d) => d ? { ...d, fieldValues: d.fieldValues.filter((v) => v.id !== valueId) } : d);
    } catch {
      setError('Failed to delete value');
    }
  }

  if (loading) return <div className="cg-loading">Loading…</div>;
  if (error || !detail) return <p className="cg-error">{error ?? 'Not found'}</p>;

  const { node, fieldValues } = detail;
  const nodeKind = kinds.find((k) => k.id === node.nodeKindId);
  const thisKindFields = fieldDefs.filter((f) => f.nodeKindId === (node.nodeKindId ?? ''));

  const valsByFieldDef = fieldValues.reduce<Record<string, CgFieldValue[]>>((acc, v) => {
    (acc[v.fieldDefId] ??= []).push(v);
    return acc;
  }, {});

  return (
    <div className="cg-node-editor">
      <div className="cg-node-editor-header">
        <button className="cg-btn cg-btn-ghost cg-btn-sm" type="button" onClick={onBack}>
          ← Back
        </button>
        {nodeKind && (
          <span className="cg-field-type" style={{ fontSize: '0.8rem' }}>{nodeKind.name}</span>
        )}
      </div>

      {/* Label */}
      <div className="cg-section">
        <p className="cg-section-title">Label</p>
        {labelDraft !== null ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="cg-input"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLabel(); if (e.key === 'Escape') setLabelDraft(null); }}
              autoFocus
              style={{ maxWidth: 400 }}
            />
            <button className="cg-btn cg-btn-primary cg-btn-sm" onClick={handleSaveLabel} disabled={saving} type="button">
              Save
            </button>
            <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={() => setLabelDraft(null)} type="button">
              Cancel
            </button>
          </div>
        ) : (
          <p
            style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--cg-text)', cursor: 'pointer', margin: 0 }}
            onClick={() => setLabelDraft(node.label ?? '')}
            title="Click to edit"
          >
            {node.label || <span style={{ color: 'var(--cg-text-dim)', fontWeight: 400, fontSize: '1rem' }}>(no label — click to set)</span>}
          </p>
        )}
      </div>

      {/* Field values */}
      {thisKindFields.length > 0 && (
        <div className="cg-section">
          <p className="cg-section-title">Fields</p>
          {thisKindFields.map((def) => {
            const existing = valsByFieldDef[def.id] ?? [];
            const allValues = def.isMultiValue
              ? [...existing, undefined]  // one extra slot for adding
              : [existing[0]];

            return (
              <div key={def.id} style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--cg-text-dim)', marginBottom: '0.4rem' }}>
                  {def.fieldName}
                  {def.isMultiValue && <span style={{ fontWeight: 400, marginLeft: '0.35rem' }}>(multi)</span>}
                </p>
                {allValues.map((val, idx) => {
                  const draftKey = `${def.id}:${idx}`;
                  const draft = fieldDrafts[draftKey];
                  const currentText = val?.textValue ?? val?.dateValue ?? (val?.numberValue != null ? String(val.numberValue) : '') ?? '';
                  const displayVal = draft ?? currentText;
                  const isDirty = draft !== undefined && draft !== currentText;
                  const isSaving = fieldSaving[draftKey];
                  const isNewSlot = val === undefined && def.isMultiValue;

                  return (
                    <div key={val?.id ?? `new-${idx}`} className="cg-field-value-row">
                      {def.fieldType === 'Boolean' ? (
                        <select
                          className="cg-select cg-field-value-input"
                          value={displayVal || 'false'}
                          onChange={(e) => setFieldDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))}
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          className="cg-input cg-field-value-input"
                          placeholder={isNewSlot ? `Add ${def.fieldName}…` : `${def.fieldName}`}
                          value={displayVal}
                          onChange={(e) => setFieldDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && isDirty) handleSaveField(def, val, idx);
                            if (e.key === 'Escape') setFieldDrafts((prev) => { const n = { ...prev }; delete n[draftKey]; return n; });
                          }}
                          type={def.fieldType === 'Number' ? 'number' : def.fieldType === 'Date' ? 'date' : 'text'}
                        />
                      )}
                      {isDirty && (
                        <button
                          className="cg-btn cg-btn-primary cg-btn-sm"
                          type="button"
                          onClick={() => handleSaveField(def, val, idx)}
                          disabled={isSaving}
                          style={{ flexShrink: 0 }}
                        >
                          {isSaving ? '…' : 'Save'}
                        </button>
                      )}
                      {val && (
                        <button
                          className="cg-btn cg-btn-danger cg-btn-sm"
                          type="button"
                          onClick={() => handleDeleteValue(val.id)}
                          style={{ flexShrink: 0 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Connections */}
      {(detail.outEdges.length > 0 || detail.inEdges.length > 0) && (
        <div className="cg-section">
          <p className="cg-section-title">Connections</p>
          {detail.outEdges.map((e) => (
            <div key={e.id} className="cg-field-row">
              <span style={{ color: 'var(--cg-text-dim)', fontSize: '0.8rem' }}>→</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--cg-text-dim)' }}>{e.targetNodeId}</span>
            </div>
          ))}
          {detail.inEdges.map((e) => (
            <div key={e.id} className="cg-field-row">
              <span style={{ color: 'var(--cg-text-dim)', fontSize: '0.8rem' }}>←</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--cg-text-dim)' }}>{e.sourceNodeId}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--cg-border)', fontSize: '0.75rem', color: 'var(--cg-text-dim)' }}>
        Created: {new Date(node.createdUtc).toLocaleString()} ·
        Updated: {new Date(node.updatedUtc).toLocaleString()}
      </div>
    </div>
  );
}
