import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCgTypeDefs,
  createCgTypeDef,
  renameCgTypeDef,
  deleteCgTypeDef,
  type CgTypeDefResponse,
  type CgTypeDeleteConflictResponse,
  ApiError
} from './cgApi';

export function CgLibraryPage({ libId }: { libId: number }) {
  const navigate = useNavigate();
  const [types, setTypes] = useState<CgTypeDefResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState('');
  const [conflict, setConflict] = useState<{ typeId: number; typeName: string; data: CgTypeDeleteConflictResponse } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getCgTypeDefs(libId)
      .then(setTypes)
      .catch(() => setError('Failed to load types.'))
      .finally(() => setLoading(false));
  }, [libId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const type = await createCgTypeDef(libId, name);
      setTypes((prev) => [...prev, type].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
    } catch {
      setError('Failed to create type.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(typeId: number) {
    const name = renameName.trim();
    if (!name) return;
    try {
      await renameCgTypeDef(libId, typeId, name);
      setTypes((prev) =>
        prev.map((t) => (t.id === typeId ? { ...t, name } : t)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setRenameId(null);
    } catch {
      setError('Failed to rename type.');
    }
  }

  async function handleDelete(typeId: number, typeName: string, force = false) {
    try {
      await deleteCgTypeDef(libId, typeId, force);
      setTypes((prev) => prev.filter((t) => t.id !== typeId));
      setConflict(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = JSON.parse(err.message) as CgTypeDeleteConflictResponse;
        setConflict({ typeId, typeName, data });
      } else {
        setError('Failed to delete type.');
      }
    }
  }

  return (
    <div className="cg-page">
      <div className="cg-header">
        <button className="cg-back" onClick={() => navigate('/cg')}>
          ← Libraries
        </button>
        <h1 className="cg-title">Types</h1>
      </div>

      {error && (
        <div className="cg-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {conflict && (
        <div className="cg-conflict-overlay">
          <div className="cg-conflict-dialog">
            <h3>Delete "{conflict.typeName}"?</h3>
            <p>This type is referenced by the following fields:</p>
            <ul className="cg-conflict-list">
              {conflict.data.references.map((ref) => (
                <li key={ref.fieldDefId}>
                  <strong>{ref.typeDefName}</strong> → {ref.fieldLabel}
                </li>
              ))}
            </ul>
            <p>Deleting with force will remove those references.</p>
            <div className="cg-conflict-actions">
              <button
                className="cg-btn cg-btn-danger"
                onClick={() => handleDelete(conflict.typeId, conflict.typeName, true)}
              >
                Force Delete
              </button>
              <button className="cg-btn cg-btn-ghost" onClick={() => setConflict(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cg-section">
        {loading ? (
          <div className="cg-loading">Loading…</div>
        ) : types.length === 0 ? (
          <p className="cg-empty">No types yet. Create one below.</p>
        ) : (
          <ul className="cg-list">
            {types.map((type) => (
              <li key={type.id} className="cg-list-item">
                {renameId === type.id ? (
                  <form
                    className="cg-inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRename(type.id);
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
                      onClick={() => navigate(`/cg/libraries/${libId}/types/${type.id}`)}
                    >
                      <span className="cg-type-name">{type.name}</span>
                      <span className="cg-type-meta">{type.fieldCount} field{type.fieldCount !== 1 ? 's' : ''}</span>
                    </button>
                    <div className="cg-list-actions">
                      <button
                        className="cg-btn cg-btn-sm"
                        onClick={() => navigate(`/cg/libraries/${libId}/types/${type.id}/entities`)}
                      >
                        Entities
                      </button>
                      <button
                        className="cg-btn cg-btn-sm cg-btn-ghost"
                        onClick={() => {
                          setRenameId(type.id);
                          setRenameName(type.name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="cg-btn cg-btn-sm cg-btn-danger"
                        onClick={() => handleDelete(type.id, type.name)}
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
            placeholder="New type name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="cg-btn" type="submit" disabled={creating || !newName.trim()}>
            {creating ? 'Creating…' : 'Create Type'}
          </button>
        </form>
      </div>
    </div>
  );
}
