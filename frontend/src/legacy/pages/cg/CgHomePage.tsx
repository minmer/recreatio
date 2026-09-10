import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCgLibraries,
  createCgLibrary,
  renameCgLibrary,
  deleteCgLibrary,
  type CgLibraryResponse
} from './cgApi';

export function CgHomePage() {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<CgLibraryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getCgLibraries()
      .then(setLibraries)
      .catch(() => setError('Failed to load libraries.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const lib = await createCgLibrary(name);
      setLibraries((prev) => [...prev, lib].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
    } catch {
      setError('Failed to create library.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: number) {
    const name = renameName.trim();
    if (!name) return;
    try {
      await renameCgLibrary(id, name);
      setLibraries((prev) =>
        prev.map((l) => (l.id === id ? { ...l, name } : l)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setRenameId(null);
    } catch {
      setError('Failed to rename library.');
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete library "${name}" and all its types? This cannot be undone.`)) return;
    try {
      await deleteCgLibrary(id);
      setLibraries((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setError('Failed to delete library.');
    }
  }

  return (
    <div className="cg-page">
      <div className="cg-header">
        <h1 className="cg-title">Cogita Graph</h1>
      </div>

      {error && (
        <div className="cg-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="cg-section">
        <h2 className="cg-section-title">Libraries</h2>

        {loading ? (
          <div className="cg-loading">Loading…</div>
        ) : libraries.length === 0 ? (
          <p className="cg-empty">No libraries yet. Create one below.</p>
        ) : (
          <ul className="cg-list">
            {libraries.map((lib) => (
              <li key={lib.id} className="cg-list-item">
                {renameId === lib.id ? (
                  <form
                    className="cg-inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRename(lib.id);
                    }}
                  >
                    <input
                      className="cg-input"
                      value={renameName}
                      onChange={(e) => setRenameName(e.target.value)}
                      autoFocus
                    />
                    <button className="cg-btn cg-btn-sm" type="submit">
                      Save
                    </button>
                    <button
                      className="cg-btn cg-btn-sm cg-btn-ghost"
                      type="button"
                      onClick={() => setRenameId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      className="cg-list-name"
                      onClick={() => navigate(`/cg/libraries/${lib.id}`)}
                    >
                      {lib.name}
                    </button>
                    <div className="cg-list-actions">
                      <button
                        className="cg-btn cg-btn-sm cg-btn-ghost"
                        onClick={() => {
                          setRenameId(lib.id);
                          setRenameName(lib.name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="cg-btn cg-btn-sm cg-btn-danger"
                        onClick={() => handleDelete(lib.id, lib.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <form className="cg-create-form" onSubmit={handleCreate}>
          <input
            className="cg-input"
            placeholder="New library name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="cg-btn" type="submit" disabled={creating || !newName.trim()}>
            {creating ? 'Creating…' : 'Create Library'}
          </button>
        </form>
      </div>
    </div>
  );
}
