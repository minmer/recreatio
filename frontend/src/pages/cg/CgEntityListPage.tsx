import { useState, useEffect } from 'react';
import { getCgEntities, deleteCgEntity, getCgTypeDefDetail, CgEntityListItem, ApiError } from './cgApi';

type Props = {
  libId: number;
  typeId: number;
  typeName?: string;
  onNew: () => void;
  onEdit: (entityId: number) => void;
  onBack: () => void;
};

export function CgEntityListPage({ libId, typeId, typeName: typeNameProp, onNew, onEdit, onBack }: Props) {
  const [items, setItems] = useState<CgEntityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [typeName, setTypeName] = useState(typeNameProp ?? '');
  const limit = 50;

  const load = async (s: number) => {
    setLoading(true);
    setError(null);
    try {
      const [data, typeDef] = await Promise.all([
        getCgEntities(libId, typeId, s, limit),
        !typeNameProp ? getCgTypeDefDetail(libId, typeId) : Promise.resolve(null),
      ]);
      setItems(data);
      setSkip(s);
      if (typeDef) setTypeName(typeDef.name);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, [libId, typeId]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this entity?')) return;
    try {
      await deleteCgEntity(libId, id);
      load(skip);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="cg-page">
      <div className="cg-header">
        <button className="cg-btn cg-btn-ghost" onClick={onBack}>← Back</button>
        <h2>{typeName} — Entities</h2>
        <button className="cg-btn cg-btn-primary" onClick={onNew}>+ New entity</button>
      </div>

      {error && <p className="cg-error">{error}</p>}
      {loading && <p className="cg-muted">Loading…</p>}

      {!loading && items.length === 0 && (
        <p className="cg-muted">No entities yet.</p>
      )}

      <ul className="cg-list">
        {items.map(item => (
          <li key={item.id} className="cg-list-item">
            <span className="cg-list-item-label" style={{ cursor: 'pointer' }} onClick={() => onEdit(item.id)}>
              {item.displayValue || <em>#{item.id}</em>}
            </span>
            <span className="cg-list-item-actions">
              <button className="cg-btn cg-btn-sm" onClick={() => onEdit(item.id)}>Edit</button>
              <button className="cg-btn cg-btn-sm cg-btn-danger" onClick={() => handleDelete(item.id)}>Delete</button>
            </span>
          </li>
        ))}
      </ul>

      {(skip > 0 || items.length === limit) && (
        <div className="cg-pagination">
          {skip > 0 && (
            <button className="cg-btn cg-btn-ghost" onClick={() => load(Math.max(0, skip - limit))}>
              ← Prev
            </button>
          )}
          {items.length === limit && (
            <button className="cg-btn cg-btn-ghost" onClick={() => load(skip + limit)}>
              Next →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
