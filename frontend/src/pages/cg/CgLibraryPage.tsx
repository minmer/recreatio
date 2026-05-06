import { useEffect, useState } from 'react';
import { type CgLibraryDetail, getLibrary, updateLibrary } from './api/cgApi';

interface Props {
  libId: string;
  onNavigate: (sub: string) => void;
}

const TEMPLATE_META: Record<string, { icon: string; label: string; color: string }> = {
  vocabulary: { icon: '📖', label: 'Vocabulary library', color: '#3a9bd5' },
  phonebook:  { icon: '📇', label: 'Phonebook library',  color: '#10b981' },
  lesson:     { icon: '🎓', label: 'Lesson library',      color: '#8b5cf6' },
  custom:     { icon: '◉',  label: 'Custom library',      color: '#f97316' },
};

export function CgLibraryPage({ libId, onNavigate }: Props) {
  const [detail, setDetail] = useState<CgLibraryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editName, setEditName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getLibrary(libId)
      .then(setDetail)
      .catch(() => setError('Failed to load library'))
      .finally(() => setLoading(false));
  }, [libId]);

  async function handleRename() {
    if (!detail || editName === null) return;
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const updated = await updateLibrary(libId, name);
      setDetail((d) => d ? { ...d, library: updated } : d);
      setEditName(null);
    } catch {
      setError('Failed to rename');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="cg-loading">Loading…</div>;
  if (error || !detail) return <p className="cg-error">{error ?? 'Not found'}</p>;

  const { library, nodeKinds, fieldDefs, nodeCount } = detail;
  const meta = TEMPLATE_META[library.template] ?? TEMPLATE_META.custom;

  const fieldsByKind = fieldDefs.reduce<Record<string, typeof fieldDefs>>((acc, f) => {
    (acc[f.nodeKindId] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div>
      <div className="cg-lib-header">
        <div className="cg-lib-icon" style={{ background: `${meta.color}22`, color: meta.color }}>
          {meta.icon}
        </div>
        <div className="cg-lib-info">
          <p className="cg-lib-kicker">{meta.label}</p>
          {editName !== null ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                className="cg-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditName(null); }}
                autoFocus
                style={{ fontSize: '1.2rem', fontWeight: 700, maxWidth: 320 }}
              />
              <button className="cg-btn cg-btn-primary cg-btn-sm" onClick={handleRename} disabled={saving} type="button">
                Save
              </button>
              <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={() => setEditName(null)} type="button">
                Cancel
              </button>
            </div>
          ) : (
            <h1 className="cg-lib-name" onClick={() => setEditName(library.name)} title="Click to rename" style={{ cursor: 'pointer' }}>
              {library.name}
            </h1>
          )}
        </div>
      </div>

      <div className="cg-stats-row">
        <div className="cg-stat">
          <span className="cg-stat-value">{nodeKinds.length}</span>
          <span className="cg-stat-label">Node types</span>
        </div>
        <div className="cg-stat">
          <span className="cg-stat-value">{fieldDefs.length}</span>
          <span className="cg-stat-label">Fields</span>
        </div>
        <div className="cg-stat">
          <span className="cg-stat-value">{nodeCount}</span>
          <span className="cg-stat-label">Nodes</span>
        </div>
      </div>

      <div className="cg-action-row">
        <button className="cg-btn cg-btn-primary" onClick={() => onNavigate('nodes')} type="button">
          ▶ Browse nodes
        </button>
        <button className="cg-btn cg-btn-ghost" onClick={() => onNavigate('studio')} type="button">
          ✎ Edit schema
        </button>
      </div>

      {nodeKinds.length > 0 && (
        <div className="cg-section">
          <p className="cg-section-title">Schema preview</p>
          {nodeKinds.map((kind) => (
            <div key={kind.id} className="cg-kind-panel">
              <div className="cg-kind-header">
                <span className="cg-kind-name">{kind.name}</span>
                {kind.isSubentity && <span className="cg-kind-subentity-badge">subentity</span>}
                <span style={{ fontSize: '0.78rem', color: 'var(--cg-text-dim)' }}>
                  {(fieldsByKind[kind.id] ?? []).length} field{(fieldsByKind[kind.id] ?? []).length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="cg-kind-body">
                {(fieldsByKind[kind.id] ?? []).length === 0 ? (
                  <p style={{ color: 'var(--cg-text-dim)', fontSize: '0.82rem', margin: 0 }}>No fields defined</p>
                ) : (
                  (fieldsByKind[kind.id] ?? []).map((f) => (
                    <div key={f.id} className="cg-field-row">
                      <span className="cg-field-name">{f.fieldName}</span>
                      <span className="cg-field-type">{f.fieldType}</span>
                      <div className="cg-field-flags">
                        {f.isMultiValue && <span>multi</span>}
                        {f.isRangeCapable && <span>range</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="cg-section" style={{ marginTop: '2rem' }}>
        <p className="cg-section-title">Go to</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={() => onNavigate('nodes')} type="button">All nodes</button>
          <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={() => onNavigate('studio')} type="button">Schema editor</button>
          <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={() => onNavigate('home')} type="button">← All libraries</button>
        </div>
      </div>
    </div>
  );
}
