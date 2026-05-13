import { useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgFieldValue,
  type CgNodeDetail,
  type CgNodeKind,
  deleteFieldValue,
  getLibrary,
  getNode,
  getRefKindIds,
  updateNode,
  upsertFieldValue,
} from './api/cgApi';
import { CgNodePicker, type PickedNode } from './CgNodePicker';

interface Props {
  copy: Copy;
  libId: string;
  nodeId: string;
  onBack: () => void;
  onOpenNode: (nodeId: string) => void;
}

const DEBOUNCE_MS = 300;

export function CgNodeEditorPage({ copy, libId, nodeId, onBack, onOpenNode }: Props) {
  const t = copy.cg.node;
  const [detail, setDetail] = useState<CgNodeDetail | null>(null);
  const [kinds, setKinds] = useState<CgNodeKind[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CgFieldDef[]>([]);
  const [refNodeLabels, setRefNodeLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const debRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getNode(libId, nodeId), getLibrary(libId)])
      .then(async ([nodeDetail, libDetail]) => {
        if (cancelled) return;
        setDetail(nodeDetail);
        setKinds(libDetail.nodeKinds);
        setFieldDefs(libDetail.fieldDefs);
        const uniqueRefIds = [
          ...new Set(nodeDetail.fieldValues.filter((v) => v.refNodeId).map((v) => v.refNodeId!)),
        ];
        const refDetails = await Promise.all(uniqueRefIds.map((id) => getNode(libId, id)));
        if (cancelled) return;
        setRefNodeLabels(new Map(refDetails.map((d) => [d.node.id, d.node.label ?? ''])));
      })
      .catch(() => setError(t.saveFailed))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [libId, nodeId]);

  function handleScalarChange(def: CgFieldDef, val: string, sortOrder: number, firstTextDefId?: string) {
    const key = `${def.id}:${sortOrder}`;
    setDrafts((prev) => ({ ...prev, [key]: val }));
    clearTimeout(debRefs.current[key]);
    debRefs.current[key] = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = await upsertFieldValue(libId, nodeId, {
          fieldDefId: def.id,
          textValue: def.fieldType === 'Text' ? (val.trim() || undefined) : undefined,
          numberValue: def.fieldType === 'Number' ? (val ? Number(val) : undefined) : undefined,
          dateValue: def.fieldType === 'Date' ? (val || undefined) : undefined,
          boolValue: def.fieldType === 'Boolean' ? (val === 'true') : undefined,
          sortOrder,
        });
        setDetail((d) => d ? { ...d, fieldValues: updated } : d);
        setDrafts((prev) => { const n = { ...prev }; delete n[key]; return n; });
        if (def.id === firstTextDefId) {
          await updateNode(libId, nodeId, val.trim() || undefined);
          setDetail((d) => d ? { ...d, node: { ...d.node, label: val.trim() || null } } : d);
        }
      } catch {
        setError(t.fieldSaveFailed);
      } finally {
        setSaving(false);
      }
    }, DEBOUNCE_MS);
  }

  async function handleDeleteValue(valueId: string) {
    try {
      await deleteFieldValue(libId, nodeId, valueId);
      setDetail((d) => d ? { ...d, fieldValues: d.fieldValues.filter((v) => v.id !== valueId) } : d);
    } catch {
      setError(t.deleteValueFailed);
    }
  }

  function handleRefAdd(def: CgFieldDef, existing: CgFieldValue[], picked: PickedNode) {
    setRefNodeLabels((prev) => new Map(prev).set(picked.id, picked.label));
    upsertFieldValue(libId, nodeId, {
      fieldDefId: def.id,
      refNodeId: picked.id,
      sortOrder: existing.length,
    })
      .then((updated) => setDetail((d) => d ? { ...d, fieldValues: updated } : d))
      .catch(() => setError(t.fieldSaveFailed));
  }

  function handleRefRemove(existing: CgFieldValue[], removedNodeId: string) {
    const val = existing.find((v) => v.refNodeId === removedNodeId);
    if (!val) return;
    deleteFieldValue(libId, nodeId, val.id)
      .then(() =>
        setDetail((d) => d ? { ...d, fieldValues: d.fieldValues.filter((v) => v.id !== val.id) } : d),
      )
      .catch(() => setError(t.deleteValueFailed));
  }

  if (loading) return <div className="cg-loading">Loading…</div>;
  if (error || !detail) return <p className="cg-error">{error ?? 'Not found'}</p>;

  const { node, fieldValues } = detail;
  const nodeKind = kinds.find((k) => k.id === node.nodeKindId);
  const thisKindFields = fieldDefs
    .filter((f) => f.nodeKindId === (node.nodeKindId ?? ''))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const firstTextDefId = thisKindFields.find((f) => f.fieldType === 'Text')?.id;

  const valsByFieldDef = fieldValues.reduce<Record<string, CgFieldValue[]>>((acc, v) => {
    (acc[v.fieldDefId] ??= []).push(v);
    return acc;
  }, {});

  return (
    <div className="cg-node-editor">
      <div className="cg-node-editor-header">
        <button className="cg-btn cg-btn-ghost cg-btn-sm" type="button" onClick={onBack}>
          {t.backAction}
        </button>
        {nodeKind && (
          <span className="cg-field-type" style={{ fontSize: '0.8rem' }}>{nodeKind.name}</span>
        )}
        {saving && (
          <span style={{ fontSize: '0.72rem', color: 'var(--cg-text-dim)', marginLeft: 'auto' }}>
            saving…
          </span>
        )}
      </div>

      {error && <p className="cg-error" style={{ marginBottom: '0.5rem' }}>{error}</p>}

      {thisKindFields.length > 0 && (
        <div className="cg-section">
          <p className="cg-section-title">{t.fieldsSection}</p>

          {thisKindFields.map((def) => {
            const existing = valsByFieldDef[def.id] ?? [];
            const defRefKindIds = getRefKindIds(def);
            const refKinds = def.fieldType === 'Ref'
              ? defRefKindIds.map((id) => kinds.find((k) => k.id === id)).filter(Boolean) as CgNodeKind[]
              : [];
            const refKindName = refKinds.map((k) => k.name).join(' / ');

            return (
              <div key={def.id} style={{ marginBottom: '1.25rem' }}>
                <p style={{
                  fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--cg-text-dim)', marginBottom: '0.4rem',
                }}>
                  {def.fieldName}
                  {refKinds.length > 0 && (
                    <span style={{ fontWeight: 400, marginLeft: '0.25rem', textTransform: 'none' }}>
                      → {refKinds.map((k) => k.name).join(', ')}
                    </span>
                  )}
                  {def.isMultiValue && refKinds.length === 0 && (
                    <span style={{ fontWeight: 400, marginLeft: '0.35rem' }}>{t.multi}</span>
                  )}
                </p>

                {def.fieldType === 'Ref' && refKinds.length > 0 ? (
                  <CgNodePicker
                    libId={libId}
                    refKindIds={defRefKindIds}
                    refKindName={refKindName}
                    allKinds={kinds}
                    allDefs={fieldDefs}
                    selected={existing
                      .filter((v) => v.refNodeId)
                      .map((v) => ({
                        id: v.refNodeId!,
                        label: refNodeLabels.get(v.refNodeId!) ?? '',
                      }))}
                    onAdd={(picked) => handleRefAdd(def, existing, picked)}
                    onRemove={(removedId) => handleRefRemove(existing, removedId)}
                    onClickNode={onOpenNode}
                    maxCount={def.isMultiValue ? Infinity : 1}
                    depth={0}
                  />
                ) : (
                  (() => {
                    const allValues = def.isMultiValue ? [...existing, undefined] : [existing[0]];
                    return allValues.map((val, idx) => {
                      const key = `${def.id}:${idx}`;
                      const currentText =
                        val?.textValue ??
                        val?.dateValue ??
                        (val?.numberValue != null ? String(val.numberValue) : '') ??
                        (val?.boolValue != null ? String(val.boolValue) : '');
                      const displayVal = drafts[key] ?? currentText;
                      const isNewSlot = val === undefined && def.isMultiValue;

                      return (
                        <div key={val?.id ?? `new-${idx}`} className="cg-field-value-row">
                          {def.fieldType === 'Boolean' ? (
                            <select
                              className="cg-select cg-field-value-input"
                              value={displayVal || 'false'}
                              onChange={(e) => handleScalarChange(def, e.target.value, idx, firstTextDefId)}
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              className="cg-input cg-field-value-input"
                              placeholder={isNewSlot ? `${def.fieldName}…` : def.fieldName}
                              value={displayVal}
                              type={
                                def.fieldType === 'Number' ? 'number'
                                : def.fieldType === 'Date' ? 'date'
                                : 'text'
                              }
                              onChange={(e) => handleScalarChange(def, e.target.value, idx, firstTextDefId)}
                            />
                          )}
                          {val && def.fieldType !== 'Ref' && (
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
                    });
                  })()
                )}
              </div>
            );
          })}
        </div>
      )}

      {(detail.outEdges.length > 0 || detail.inEdges.length > 0) && (
        <div className="cg-section">
          <p className="cg-section-title">{t.connectionsSection}</p>
          {detail.outEdges.map((e) => (
            <div key={e.id} className="cg-field-row">
              <span style={{ color: 'var(--cg-text-dim)', fontSize: '0.8rem' }}>{t.outgoing}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--cg-text-dim)' }}>{e.targetNodeId}</span>
            </div>
          ))}
          {detail.inEdges.map((e) => (
            <div key={e.id} className="cg-field-row">
              <span style={{ color: 'var(--cg-text-dim)', fontSize: '0.8rem' }}>{t.incoming}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--cg-text-dim)' }}>{e.sourceNodeId}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: '1rem', paddingTop: '1rem',
        borderTop: '1px solid var(--cg-border)',
        fontSize: '0.75rem', color: 'var(--cg-text-dim)',
      }}>
        {t.created} {new Date(node.createdUtc).toLocaleString()} ·
        {t.updated} {new Date(node.updatedUtc).toLocaleString()}
      </div>
    </div>
  );
}
