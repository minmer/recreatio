import { useEffect, useState } from 'react';
import { type CgLibrary, createLibrary, deleteLibrary, listLibraries } from './api/cgApi';

const TEMPLATES = [
  {
    key: 'vocabulary',
    icon: '📖',
    name: 'Vocabulary',
    desc: 'Bilingual word pairs in any language combination, ready for revision.',
  },
  {
    key: 'phonebook',
    icon: '📇',
    name: 'Phonebook',
    desc: 'Contacts with phones, emails and notes — always searchable.',
  },
  {
    key: 'lesson',
    icon: '🎓',
    name: 'Lesson',
    desc: 'Concepts, questions and topics structured for teaching or studying.',
  },
  {
    key: 'custom',
    icon: '◉',
    name: 'Custom',
    desc: 'Start with a blank schema and define your own node types.',
  },
] as const;

interface Props {
  onOpenLibrary: (libId: string) => void;
  onNavigateToCogita: () => void;
}

export function CgHomePage({ onOpenLibrary, onNavigateToCogita }: Props) {
  const [libraries, setLibraries] = useState<CgLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const [showWizard, setShowWizard] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    listLibraries()
      .then(setLibraries)
      .catch(() => setError('Failed to load libraries'))
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
      setError('Failed to create library');
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
      setError('Failed to delete library');
    }
  }

  const templateLabel: Record<string, string> = {
    vocabulary: 'Vocabulary',
    phonebook: 'Phonebook',
    lesson: 'Lesson',
    custom: 'Custom',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="cg-page-title">Graph Libraries</h1>
          <p className="cg-page-sub">Each library has its own node schema and graph.</p>
        </div>
        <button className="cg-btn cg-btn-primary" onClick={() => setShowWizard(true)} type="button">
          + New Library
        </button>
      </div>

      {error && <p className="cg-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {showWizard && (
        <div className="cg-wizard" style={{ marginBottom: '2rem', background: 'var(--cg-surface)', border: '1px solid var(--cg-border)', borderRadius: 'var(--cg-radius)', padding: '1.25rem' }}>
          <p className="cg-wizard-title">New library</p>

          <div className="cg-field-group">
            <label className="cg-label">Name</label>
            <input
              className="cg-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Spanish vocab, My contacts…"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <div className="cg-field-group">
            <label className="cg-label">Template</label>
            <div className="cg-template-grid">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`cg-template-card${selectedTemplate === t.key ? ' selected' : ''}`}
                  onClick={() => setSelectedTemplate(t.key)}
                >
                  <div className="cg-template-icon">{t.icon}</div>
                  <p className="cg-template-name">{t.name}</p>
                  <p className="cg-template-desc">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="cg-btn cg-btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()} type="button">
              {creating ? 'Creating…' : 'Create library'}
            </button>
            <button className="cg-btn cg-btn-ghost" onClick={() => setShowWizard(false)} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="cg-loading">Loading…</div>
      ) : libraries.length === 0 ? (
        <div className="cg-empty">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>◉</p>
          <p>No libraries yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="cg-card-grid">
          {libraries.map((lib) => (
            <div key={lib.id} className="cg-card" onClick={() => onOpenLibrary(lib.id)} style={{ position: 'relative' }}>
              <p className="cg-card-title">{lib.name}</p>
              <span className={`cg-card-badge ${lib.template}`}>{templateLabel[lib.template] ?? lib.template}</span>
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
                    Confirm delete
                  </button>
                  <button
                    className="cg-btn cg-btn-ghost cg-btn-sm"
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Cancel
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
          ← Cogita (classic)
        </button>
      </div>
    </div>
  );
}
