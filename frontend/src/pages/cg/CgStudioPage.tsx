import { useEffect, useState } from 'react';
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
  libId: string;
}

const FIELD_TYPES = ['Text', 'Number', 'Date', 'Boolean', 'Media', 'Ref'];

export function CgStudioPage({ libId }: Props) {
  const [kinds, setKinds] = useState<CgNodeKind[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CgFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New kind form
  const [newKindName, setNewKindName] = useState('');
  const [newKindSubentity, setNewKindSubentity] = useState(false);
  const [addingKind, setAddingKind] = useState(false);

  // New field form — keyed by kindId
  const [fieldForms, setFieldForms] = useState<Record<string, { name: string; type: string; multi: boolean; range: boolean }>>({});
  const [expandedKind, setExpandedKind] = useState<string | null>(null);

  useEffect(() => {
    getLibrary(libId)
      .then((d) => {
        setKinds(d.nodeKinds);
        setFieldDefs(d.fieldDefs);
      })
      .catch(() => setError('Failed to load schema'))
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
      setError('Failed to add node type');
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
      setError('Failed to delete node type');
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
      setError('Failed to add field');
    }
  }

  async function handleDeleteField(defId: string, kindId: string) {
    try {
      await deleteFieldDef(libId, kindId, defId);
      setFieldDefs((prev) => prev.filter((f) => f.id !== defId));
    } catch {
      setError('Failed to delete field');
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
      <h1 className="cg-page-title">Schema editor</h1>
      <p className="cg-page-sub">Define node types and their fields. The first field becomes the display label.</p>

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
              {kind.isSubentity && <span className="cg-kind-subentity-badge">subentity</span>}
              <span style={{ fontSize: '0.78rem', color: 'var(--cg-text-dim)', marginLeft: 'auto', marginRight: '0.5rem' }}>
                {kindFields.length} field{kindFields.length !== 1 ? 's' : ''}
              </span>
              <button
                className="cg-btn cg-btn-danger cg-btn-sm"
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteKind(kind.id); }}
              >
                Delete type
              </button>
            </div>

            {expanded && (
              <div className="cg-kind-body">
                {kindFields.length === 0 && (
                  <p style={{ color: 'var(--cg-text-dim)', fontSize: '0.82rem', margin: '0 0 0.75rem' }}>
                    No fields yet. Add one below.
                  </p>
                )}

                {kindFields.map((f, idx) => (
                  <div key={f.id} className="cg-field-row">
                    <span style={{ fontSize: '0.72rem', color: 'var(--cg-text-dim)', minWidth: '1.5rem' }}>
                      {idx === 0 ? '★' : `${idx + 1}`}
                    </span>
                    <span className="cg-field-name">{f.fieldName}</span>
                    <span className="cg-field-type">{f.fieldType}</span>
                    <div className="cg-field-flags">
                      {f.isMultiValue && <span>multi</span>}
                      {f.isRangeCapable && <span>range</span>}
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
                    Add field
                  </p>
                  <div className="cg-inline-form" style={{ flexWrap: 'wrap' }}>
                    <input
                      className="cg-input"
                      placeholder="Field name"
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
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--cg-text-dim)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.multi} onChange={(e) => setForm(kind.id, { multi: e.target.checked })} />
                      Multi-value
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--cg-text-dim)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.range} onChange={(e) => setForm(kind.id, { range: e.target.checked })} />
                      Range
                    </label>
                    <button
                      className="cg-btn cg-btn-primary cg-btn-sm"
                      type="button"
                      onClick={() => handleAddField(kind.id)}
                      disabled={!form.name.trim()}
                    >
                      Add
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
          Add node type
        </p>
        <div className="cg-inline-form">
          <input
            className="cg-input"
            placeholder="Type name (e.g. Person, WordPair…)"
            value={newKindName}
            onChange={(e) => setNewKindName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKind()}
            style={{ maxWidth: 280 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--cg-text-dim)', cursor: 'pointer' }}>
            <input type="checkbox" checked={newKindSubentity} onChange={(e) => setNewKindSubentity(e.target.checked)} />
            Subentity
          </label>
          <button
            className="cg-btn cg-btn-primary"
            type="button"
            onClick={handleAddKind}
            disabled={addingKind || !newKindName.trim()}
          >
            {addingKind ? 'Adding…' : 'Add type'}
          </button>
        </div>
      </div>
    </div>
  );
}
