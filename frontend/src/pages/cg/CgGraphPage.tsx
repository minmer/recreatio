import { useEffect, useState } from 'react';
import type { Copy } from '../../content/types';
import { type CgFieldDef, type CgFieldValue, type CgNode, type CgNodeKind, deleteNode, getLibrary, getNode, listNodes } from './api/cgApi';
import { CgSmartAddForm } from './CgSmartAddForm';

interface Props {
  copy: Copy;
  libId: string;
  onOpenNode: (nodeId: string) => void;
}

export function CgGraphPage({ copy, libId, onOpenNode }: Props) {
  const t = copy.cg.graph;
  const [nodes, setNodes] = useState<CgNode[]>([]);
  const [kinds, setKinds] = useState<CgNodeKind[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CgFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterKindId, setFilterKindId] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [selectedKindId, setSelectedKindId] = useState('');

  useEffect(() => {
    getLibrary(libId)
      .then((d) => {
        setKinds(d.nodeKinds);
        setFieldDefs(d.fieldDefs);
        if (d.nodeKinds.length > 0) setSelectedKindId(d.nodeKinds[0].id);
      })
      .catch(() => setError(t.loadFailed));
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
      .catch(() => setError(t.loadFailed))
      .finally(() => setLoading(false));
  }, [libId, filterKindId, filterQ]);

  async function handleDelete(nodeId: string) {
    try {
      await deleteNode(libId, nodeId);
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setDeleteConfirm(null);
    } catch {
      setError(t.deleteFailed);
    }
  }

  const kindMap = Object.fromEntries(kinds.map((k) => [k.id, k]));

  const displayKind = filterKindId ? kinds.find((k) => k.id === filterKindId) : null;
  const displayFields = displayKind ? fieldDefs.filter((f) => f.nodeKindId === displayKind.id).slice(0, 4) : [];

  return (
    <div>
      <h1 className="cg-page-title">{t.title}</h1>

      <div className="cg-toolbar">
        <input
          className="cg-input cg-search"
          placeholder={t.searchPlaceholder}
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
        />
        <select
          className="cg-select"
          value={filterKindId}
          onChange={(e) => setFilterKindId(e.target.value)}
        >
          <option value="">{t.allTypes}</option>
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
        </select>
      </div>

      {kinds.length > 0 && selectedKindId && (
        <CgSmartAddForm
          copy={copy}
          libId={libId}
          kinds={kinds}
          fieldDefs={fieldDefs}
          selectedKindId={selectedKindId}
          onKindChange={setSelectedKindId}
          onCreated={(node) => setNodes((prev) => [node, ...prev])}
        />
      )}

      {error && <p className="cg-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {loading ? (
        <div className="cg-loading">Loading…</div>
      ) : nodes.length === 0 ? (
        <div className="cg-empty">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>◎</p>
          <p>{t.noNodes}</p>
          <p>{t.noNodesDesc}</p>
        </div>
      ) : (
        <div className="cg-table-wrap">
          <table className="cg-table">
            <thead>
              <tr>
                <th>{t.labelColumn}</th>
                <th>{t.typeColumn}</th>
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
