import { useEffect, useState } from 'react';
import type { Copy } from '../../content/types';
import { type CgLibraryDetail, getLibrary, updateLibrary } from './api/cgApi';

interface Props {
  copy: Copy;
  libId: string;
  onNavigate: (sub: string) => void;
}

const TEMPLATE_COLORS: Record<string, string> = {
  vocabulary: '#3a9bd5',
  phonebook:  '#10b981',
  lesson:     '#8b5cf6',
  custom:     '#f97316',
};

const TEMPLATE_ICONS: Record<string, string> = {
  vocabulary: '📖',
  phonebook:  '📇',
  lesson:     '🎓',
  custom:     '◉',
};

export function CgLibraryPage({ copy, libId, onNavigate }: Props) {
  const t = copy.cg.library;
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
      .catch(() => setError(t.renameFailed))
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
      setError(t.renameFailed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="cg-loading">Loading…</div>;
  if (error || !detail) return <p className="cg-error">{error ?? 'Not found'}</p>;

  const { library, nodeKinds, fieldDefs, nodeCount } = detail;
  const color = TEMPLATE_COLORS[library.template] ?? TEMPLATE_COLORS.custom;
  const icon  = TEMPLATE_ICONS[library.template]  ?? TEMPLATE_ICONS.custom;
  const kicker = t.kicker[library.template] ?? t.kicker.custom;

  const fieldsByKind = fieldDefs.reduce<Record<string, typeof fieldDefs>>((acc, f) => {
    (acc[f.nodeKindId] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div>
      <div className="cg-lib-header">
        <div className="cg-lib-icon" style={{ background: `${color}22`, color }}>
          {icon}
        </div>
        <div className="cg-lib-info">
          <p className="cg-lib-kicker">{kicker}</p>
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
                {t.saveAction}
              </button>
              <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={() => setEditName(null)} type="button">
                {t.cancelAction}
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
          <span className="cg-stat-label">{t.nodeTypes}</span>
        </div>
        <div className="cg-stat">
          <span className="cg-stat-value">{fieldDefs.length}</span>
          <span className="cg-stat-label">{t.fields}</span>
        </div>
        <div className="cg-stat">
          <span className="cg-stat-value">{nodeCount}</span>
          <span className="cg-stat-label">{t.nodes}</span>
        </div>
      </div>

      <div className="cg-action-row">
        <button className="cg-btn cg-btn-primary" onClick={() => onNavigate('nodes')} type="button">
          {t.browseNodes}
        </button>
        <button className="cg-btn cg-btn-ghost" onClick={() => onNavigate('studio')} type="button">
          {t.editSchema}
        </button>
      </div>

      {nodeKinds.length > 0 && (
        <div className="cg-section">
          <p className="cg-section-title">{t.schemaPreview}</p>
          {nodeKinds.map((kind) => {
            const kindFields = fieldsByKind[kind.id] ?? [];
            return (
              <div key={kind.id} className="cg-kind-panel">
                <div className="cg-kind-header">
                  <span className="cg-kind-name">{kind.name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--cg-text-dim)' }}>
                    {kindFields.length}
                  </span>
                </div>
                <div className="cg-kind-body">
                  {kindFields.length === 0 ? (
                    <p style={{ color: 'var(--cg-text-dim)', fontSize: '0.82rem', margin: 0 }}>{t.noFields}</p>
                  ) : (
                    kindFields.map((f) => (
                      <div key={f.id} className="cg-field-row">
                        <span className="cg-field-name">{f.fieldName}</span>
                        <span className="cg-field-type">{f.fieldType}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="cg-section" style={{ marginTop: '2rem' }}>
        <p className="cg-section-title">{t.goTo}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={() => onNavigate('nodes')} type="button">{t.allNodes}</button>
          <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={() => onNavigate('studio')} type="button">{t.schemaEditor}</button>
          <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={() => onNavigate('home')} type="button">{t.allLibraries}</button>
        </div>
      </div>
    </div>
  );
}
