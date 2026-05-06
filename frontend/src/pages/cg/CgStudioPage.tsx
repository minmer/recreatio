import { useEffect, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  type CgFieldDef,
  type CgNodeKind,
  createFieldDef,
  createNodeKind,
  deleteFieldDef,
  deleteNodeKind,
  getLibrary,
} from './api/cgApi';

interface Props {
  copy: Copy;
  libId: string;
}

const FIELD_TYPES = ['Text', 'Number', 'Date', 'Boolean', 'Media', 'Ref'];

export function CgStudioPage({ copy, libId }: Props) {
  const t = copy.cg.studio;
  const [kinds, setKinds] = useState<CgNodeKind[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CgFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newKindName, setNewKindName] = useState('');
  const [newKindSubentity, setNewKindSubentity] = useState(false);
  const [addingKind, setAddingKind] = useState(false);

  const [fieldForms, setFieldForms] = useState<Record<string, { name: string; type: string; multi: boolean; range: boolean }>>({});
  const [expandedKind, setExpandedKind] = useState<string | null>(null);

  useEffect(() => {
    getLibrary(libId)
      .then((d) => {
        setKinds(d.nodeKinds);
        setFieldDefs(d.fieldDefs);
      })
      .catch(() => setError(t.addTypeFailed))
      .finally(() => setLoading(false));
  }, [libId]);

  async function handleAddKind() {
    const name = newKindName.trim();
    if (!name) return;
    setAddingKind(true);
    try {
      const kind = await createNodeKind(libId, name, newKindSubentity, kinds.length);
      setKinds((prev) => [...prev, kind]);
      setNewKindName('');
      setNewKindSubentity(false);
      setExpandedKind(kind.id);
    } catch {
      setError(t.addTypeFailed);
    } finally {
      setAddingKind(false);
    }
  }

  async function handleDeleteKind(kindId: string) {
    try {
      await deleteNodeKind(libId, kindId);
      setKinds((prev) => prev.filter((k) => k.id !== kindId));
      setFieldDefs((prev) => prev.filter((f) => f.nodeKindId !== kindId));
    } catch {
      setError(t.deleteTypeFailed);
    }
  }

  async function handleAddField(kindId: string) {
    const form = fieldForms[kindId];
    if (!form?.name.trim()) return;
    const existingCount = fieldDefs.filter((f) => f.nodeKindId === kindId).length;
    try {
      const def = await createFieldDef(
        libId, kindId,
        form.name.trim(), form.type,
        form.multi, form.range,
        existingCount,
      );
      setFieldDefs((prev) => [...prev, def]);
      setFieldForms((prev) => ({ ...prev, [kindId]: { name: '', type: 'Text', multi: false, range: false } }));
    } catch {
      setError(t.addFieldFailed);
    }
  }

  async function handleDeleteField(defId: string, kindId: string) {
    try {
      await deleteFieldDef(libId, kindId, defId);
      setFieldDefs((prev) => prev.filter((f) => f.id !== defId));
    } catch {
      setError(t.deleteFieldFailed);
    }
  }

  const getForm = (kindId: string) =>
    fieldForms[kindId] ?? { name: '', type: 'Text', multi: false, range: false };

  const setForm = (kindId: string, patch: Partial<{ name: string; type: string; multi: boolean; range: boolean }>) =>
    setFieldForms((prev) => ({ ...prev, [kindId]: { ...getForm(kindId), ...patch } }));

  if (loading) return <div className="cg-loading">Loading…</div>;
  if (error) return <p className="cg-error">{error}</p>;

  const fieldsByKind = fieldDefs.reduce<Record<string, CgFieldDef[]>>((acc, f) => {
    (acc[f.nodeKindId] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="cg-page-title">{t.title}</h1>
      <p className="cg-page-sub">{t.sub}</p>

      {kinds.map((kind) => {
        const kindFields = fieldsByKind[kind.id] ?? [];
        const expanded = expandedKind === kind.id;
        const form = getForm(kind.id);

        return (
          <div key={kind.id} className="cg-kind-panel">
            <div className="cg-kind-header" onClick={() => setExpandedKind(expanded ? null : kind.id)}>
              <span style={{ fontSize: '0.78rem', color: 'var(--cg-text-dim)', marginRight: '0.25rem' }}>
                {expanded ? '▾' : '▸'}
              </span>
              <span className="cg-kind-name">{kind.name}</span>
              {kind.isSubentity && <span className="cg-kind-subentity-badge">{t.isSubentity}</span>}
              <span style={{ fontSize: '0.78rem', color: 'var(--cg-text-dim)', marginLeft: 'auto', marginRight: '0.5rem' }}>
                {kindFields.length}
              </span>
              <button
                className="cg-btn cg-btn-danger cg-btn-sm"
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteKind(kind.id); }}
              >
                {t.deleteType}
              </button>
            </div>

            {expanded && (
              <div className="cg-kind-body">
                {kindFields.length === 0 && (
                  <p style={{ color: 'var(--cg-text-dim)', fontSize: '0.82rem', margin: '0 0 0.75rem' }}>
                    {t.noFields}
                  </p>
                )}

                {kindFields.map((f, idx) => (
                  <div key={f.id} className="cg-field-row">
                    <span style={{ fontSize: '0.72rem', color: 'var(--cg-text-dim)', minWidth: '1.5rem' }}>
                      {idx === 0 ? t.labelIndex : `${idx + 1}`}
                    </span>
                    <span className="cg-field-name">{f.fieldName}</span>
                    <span className="cg-field-type">{f.fieldType}</span>
                    <div className="cg-field-flags">
                      {f.isMultiValue && <span>{t.multiValue}</span>}
                      {f.isRangeCapable && <span>{t.range}</span>}
                    </div>
                    <button
                      className="cg-btn cg-btn-danger cg-btn-sm"
                      type="button"
                      onClick={() => handleDeleteField(f.id, kind.id)}
                      style={{ marginLeft: 'auto' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <div style={{ borderTop: '1px solid var(--cg-border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--cg-text-dim)', margin: '0 0 0.5rem' }}>
                    {t.addField}
                  </p>
                  <div className="cg-inline-form" style={{ flexWrap: 'wrap' }}>
                    <input
                      className="cg-input"
                      placeholder={t.fieldName}
                      value={form.name}
                      onChange={(e) => setForm(kind.id, { name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddField(kind.id)}
                      style={{ maxWidth: 180 }}
                    />
                    <select
                      className="cg-select"
                      value={form.type}
                      onChange={(e) => setForm(kind.id, { type: e.target.value })}
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft} value={ft}>{ft}</option>
                      ))}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--cg-text-dim)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.multi} onChange={(e) => setForm(kind.id, { multi: e.target.checked })} />
                      {t.multiValue}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--cg-text-dim)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.range} onChange={(e) => setForm(kind.id, { range: e.target.checked })} />
                      {t.range}
                    </label>
                    <button
                      className="cg-btn cg-btn-primary cg-btn-sm"
                      type="button"
                      onClick={() => handleAddField(kind.id)}
                      disabled={!form.name.trim()}
                    >
                      {t.addAction}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: '1.5rem', background: 'var(--cg-surface)', border: '1px solid var(--cg-border)', borderRadius: 'var(--cg-radius)', padding: '1rem' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cg-text-dim)', margin: '0 0 0.75rem' }}>
          {t.addTypeTitle}
        </p>
        <div className="cg-inline-form">
          <input
            className="cg-input"
            placeholder={t.typePlaceholder}
            value={newKindName}
            onChange={(e) => setNewKindName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKind()}
            style={{ maxWidth: 280 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--cg-text-dim)', cursor: 'pointer' }}>
            <input type="checkbox" checked={newKindSubentity} onChange={(e) => setNewKindSubentity(e.target.checked)} />
            {t.isSubentity}
          </label>
          <button
            className="cg-btn cg-btn-primary"
            type="button"
            onClick={handleAddKind}
            disabled={addingKind || !newKindName.trim()}
          >
            {addingKind ? t.addingType : t.addTypeAction}
          </button>
        </div>
      </div>
    </div>
  );
}
