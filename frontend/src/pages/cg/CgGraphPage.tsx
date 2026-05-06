import { useEffect, useState } from 'react';
import { type CgFieldDef, type CgFieldValue, type CgNode, type CgNodeKind, createNode, deleteNode, getLibrary, getNode, listNodes, upsertFieldValue } from './api/cgApi';

interface Props {
  libId: string;
  onOpenNode: (nodeId: string) => void;
}

export function CgGraphPage({ libId, onOpenNode }: Props) {
  const [nodes, setNodes] = useState<CgNode[]>([]);
  const [kinds, setKinds] = useState<CgNodeKind[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CgFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterKindId, setFilterKindId] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Quick-add form
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKindId, setNewKindId] = useState('');
  // Inline field values for quick-add
  const [inlineValues, setInlineValues] = useState<Record<string, string>>({});

  useEffect(() => {
    getLibrary(libId)
      .then((d) => {
        setKinds(d.nodeKinds);
        setFieldDefs(d.fieldDefs);
        if (d.nodeKinds.length > 0) setNewKindId(d.nodeKinds[0].id);
      })
      .catch(() => setError('Failed to load schema'));
  }, [libId]);

  useEffect(() => {
    setLoading(true);
    const params = {
      kindId: filterKindId || undefined,
      q: filterQ || undefined,
      limit: 500,
    };
    listNodes(libId, params)
      .then(setNodes)
      .catch(() => setError('Failed to load nodes'))
      .finally(() => setLoading(false));
  }, [libId, filterKindId, filterQ]);

  const selectedKind = kinds.find((k) => k.id === newKindId) ?? kinds[0];
  const selectedKindFields = fieldDefs.filter((f) => f.nodeKindId === (selectedKind?.id ?? ''));

  async function handleAddNode() {
    if (!newLabel.trim() && selectedKindFields.length > 0) {
      // Use the first field's value as label if no explicit label given
    }
    const label = newLabel.trim() || inlineValues[selectedKindFields[0]?.id ?? '']?.trim() || '(unnamed)';
    setAdding(true);
    try {
      const node = await createNode(libId, {
        nodeType: 'Entity',
        nodeKindId: selectedKind?.id,
        label,
      });

      // Save inline field values
      for (const [fieldDefId, val] of Object.entries(inlineValues)) {
        if (val.trim()) {
          await upsertFieldValue(libId, node.id, { fieldDefId, textValue: val.trim(), sortOrder: 0 });
        }
      }

      setNodes((prev) => [node, ...prev]);
      setNewLabel('');
      setInlineValues({});
    } catch {
      setError('Failed to create node');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(nodeId: string) {
    try {
      await deleteNode(libId, nodeId);
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setDeleteConfirm(null);
    } catch {
      setError('Failed to delete node');
    }
  }

  const kindMap = Object.fromEntries(kinds.map((k) => [k.id, k]));

  // Columns: for the selected filter kind, show its field names
  const displayKind = filterKindId ? kinds.find((k) => k.id === filterKindId) : null;
  const displayFields = displayKind ? fieldDefs.filter((f) => f.nodeKindId === displayKind.id).slice(0, 4) : [];

  return (
    <div>
      <h1 className="cg-page-title">Nodes</h1>

      <div className="cg-toolbar">
        <input
          className="cg-input cg-search"
          placeholder="Search by label…"
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
        />
        <select
          className="cg-select"
          value={filterKindId}
          onChange={(e) => setFilterKindId(e.target.value)}
        >
          <option value="">All types</option>
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
        </select>
      </div>

      {/* Quick-add row */}
      {kinds.length > 0 && (
        <div style={{ background: 'var(--cg-surface)', border: '1px solid var(--cg-border)', borderRadius: 'var(--cg-radius)', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cg-text-dim)', margin: '0 0 0.6rem' }}>
            Add node
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="cg-select"
              value={newKindId}
              onChange={(e) => { setNewKindId(e.target.value); setInlineValues({}); setNewLabel(''); }}
            >
              {kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>

            {selectedKindFields.slice(0, 3).map((f, idx) => (
              <input
                key={f.id}
                className="cg-input"
                placeholder={f.fieldName}
                value={inlineValues[f.id] ?? ''}
                onChange={(e) => setInlineValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNode()}
                style={{ maxWidth: idx === 0 ? 220 : 160 }}
                autoFocus={idx === 0}
              />
            ))}

            {selectedKindFields.length === 0 && (
              <input
                className="cg-input"
                placeholder="Label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNode()}
                style={{ maxWidth: 220 }}
              />
            )}

            <button
              className="cg-btn cg-btn-primary"
              type="button"
              onClick={handleAddNode}
              disabled={adding}
            >
              {adding ? 'Adding…' : '+ Add'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="cg-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {loading ? (
        <div className="cg-loading">Loading…</div>
      ) : nodes.length === 0 ? (
        <div className="cg-empty">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>◎</p>
          <p>No nodes yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="cg-table-wrap">
          <table className="cg-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Type</th>
                {displayFields.map((f) => <th key={f.id}>{f.fieldName}</th>)}
                <th style={{ width: '6rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  kindMap={kindMap}
                  displayFields={displayFields}
                  libId={libId}
                  onOpen={() => onOpenNode(node.id)}
                  deleteConfirm={deleteConfirm}
                  onDeleteRequest={() => setDeleteConfirm(node.id)}
                  onDeleteConfirm={() => handleDelete(node.id)}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NodeRow({
  node, kindMap, displayFields, libId, onOpen,
  deleteConfirm, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: {
  node: CgNode;
  kindMap: Record<string, CgNodeKind>;
  displayFields: CgFieldDef[];
  libId: string;
  onOpen: () => void;
  deleteConfirm: string | null;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const [fieldValues, setFieldValues] = useState<CgFieldValue[] | null>(null);

  useEffect(() => {
    if (displayFields.length === 0) return;
    getNode(libId, node.id).then((d) => setFieldValues(d.fieldValues));
  }, [libId, node.id, displayFields.length]);

  const valByFieldDef = fieldValues
    ? Object.fromEntries(fieldValues.map((v) => [v.fieldDefId, v]))
    : {};

  const isConfirming = deleteConfirm === node.id;

  return (
    <tr>
      <td>
        <button
          type="button"
          onClick={onOpen}
          style={{ background: 'none', border: 'none', color: 'var(--cg-cyan)', cursor: 'pointer', fontWeight: 600, textAlign: 'left', padding: 0 }}
        >
          {node.label ?? '(unnamed)'}
        </button>
      </td>
      <td>
        <span className="cg-field-type" style={{ fontSize: '0.78rem' }}>
          {node.nodeKindId ? (kindMap[node.nodeKindId]?.name ?? '—') : node.nodeType}
        </span>
      </td>
      {displayFields.map((f) => (
        <td key={f.id} style={{ color: 'var(--cg-text-dim)', fontSize: '0.82rem' }}>
          {valByFieldDef[f.id]?.textValue ?? '—'}
        </td>
      ))}
      <td>
        <div className="cg-table-actions">
          {isConfirming ? (
            <>
              <button className="cg-btn cg-btn-danger cg-btn-sm" type="button" onClick={onDeleteConfirm}>Del</button>
              <button className="cg-btn cg-btn-ghost cg-btn-sm" type="button" onClick={onDeleteCancel}>Cancel</button>
            </>
          ) : (
            <button className="cg-btn cg-btn-ghost cg-btn-sm" type="button" onClick={onDeleteRequest}>✕</button>
          )}
        </div>
      </td>
    </tr>
  );
}
