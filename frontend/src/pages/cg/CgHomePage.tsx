import { useEffect, useState } from 'react';
import type { Copy } from '../../content/types';
import { type CgLibrary, createLibrary, deleteLibrary, listLibraries } from './api/cgApi';

interface Props {
  copy: Copy;
  onOpenLibrary: (libId: string) => void;
  onNavigateToCogita: () => void;
}

export function CgHomePage({ copy, onOpenLibrary, onNavigateToCogita }: Props) {
  const t = copy.cg.home;
  const [libraries, setLibraries] = useState<CgLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const [showWizard, setShowWizard] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const TEMPLATES = [
    { key: 'vocabulary', icon: '📖', name: t.templates.vocabulary.name, desc: t.templates.vocabulary.desc },
    { key: 'phonebook',  icon: '📇', name: t.templates.phonebook.name,  desc: t.templates.phonebook.desc  },
    { key: 'lesson',     icon: '🎓', name: t.templates.lesson.name,     desc: t.templates.lesson.desc     },
    { key: 'custom',     icon: '◉',  name: t.templates.custom.name,     desc: t.templates.custom.desc     },
  ];

  useEffect(() => {
    listLibraries()
      .then(setLibraries)
      .catch(() => setError(t.loadFailed))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const lib = await createLibrary(name, selectedTemplate);
      setLibraries((prev) => [lib, ...prev]);
      setNewName('');
      setShowWizard(false);
      onOpenLibrary(lib.id);
    } catch {
      setError(t.createFailed);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(libId: string) {
    try {
      await deleteLibrary(libId);
      setLibraries((prev) => prev.filter((l) => l.id !== libId));
      setDeleteConfirm(null);
    } catch {
      setError(t.deleteFailed);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="cg-page-title">{t.title}</h1>
          <p className="cg-page-sub">{t.sub}</p>
        </div>
        <button className="cg-btn cg-btn-primary" onClick={() => setShowWizard(true)} type="button">
          {t.newLibrary}
        </button>
      </div>

      {error && <p className="cg-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {showWizard && (
        <div className="cg-wizard" style={{ marginBottom: '2rem', background: 'var(--cg-surface)', border: '1px solid var(--cg-border)', borderRadius: 'var(--cg-radius)', padding: '1.25rem' }}>
          <p className="cg-wizard-title">{t.wizardTitle}</p>

          <div className="cg-field-group">
            <label className="cg-label">{t.nameLabel}</label>
            <input
              className="cg-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t.namePlaceholder}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <div className="cg-field-group">
            <label className="cg-label">{t.templateLabel}</label>
            <div className="cg-template-grid">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.key}
                  type="button"
                  className={`cg-template-card${selectedTemplate === tmpl.key ? ' selected' : ''}`}
                  onClick={() => setSelectedTemplate(tmpl.key)}
                >
                  <div className="cg-template-icon">{tmpl.icon}</div>
                  <p className="cg-template-name">{tmpl.name}</p>
                  <p className="cg-template-desc">{tmpl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="cg-btn cg-btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()} type="button">
              {creating ? t.creating : t.createAction}
            </button>
            <button className="cg-btn cg-btn-ghost" onClick={() => setShowWizard(false)} type="button">
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="cg-loading">Loading…</div>
      ) : libraries.length === 0 ? (
        <div className="cg-empty">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>◉</p>
          <p>{t.emptyTitle}</p>
          <p>{t.emptyDesc}</p>
        </div>
      ) : (
        <div className="cg-card-grid">
          {libraries.map((lib) => (
            <div key={lib.id} className="cg-card" onClick={() => onOpenLibrary(lib.id)} style={{ position: 'relative' }}>
              <p className="cg-card-title">{lib.name}</p>
              <span className={`cg-card-badge ${lib.template}`}>{t.templateLabels[lib.template] ?? lib.template}</span>
              <p className="cg-card-meta">{new Date(lib.createdUtc).toLocaleDateString()}</p>
              {deleteConfirm === lib.id ? (
                <div
                  style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="cg-btn cg-btn-danger cg-btn-sm"
                    type="button"
                    onClick={() => handleDelete(lib.id)}
                  >
                    {t.deleteConfirm}
                  </button>
                  <button
                    className="cg-btn cg-btn-ghost cg-btn-sm"
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    {t.deleteCancel}
                  </button>
                </div>
              ) : (
                <button
                  className="cg-btn cg-btn-ghost cg-btn-sm"
                  style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(lib.id); }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--cg-border)' }}>
        <button className="cg-btn cg-btn-ghost cg-btn-sm" onClick={onNavigateToCogita} type="button">
          {t.backToCogita}
        </button>
      </div>
    </div>
  );
}
