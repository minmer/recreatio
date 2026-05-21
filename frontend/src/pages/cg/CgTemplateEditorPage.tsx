import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { CgFieldDefResponse, CgTypeDefDetailResponse } from './cgApi';
import { getCgTypeDefDetail } from './cgApi';
import {
  createCgTemplate,
  deleteCgTemplate,
  getCgTemplate,
  getCgTemplates,
  saveCgTemplate,
  type CgTemplateEdgeSaveItem,
  type CgTemplateListItem,
  type CgTemplateNodeSaveItem
} from './cgTemplateApi';

// ── Config types ──────────────────────────────────────────────────────────────

type FieldConfig = { fieldDefId: number; fieldLabel: string; inputType: string };
type PromptConfig = { label: string };
type AnswerTextConfig = { fuzzy: boolean; thresholdPct: number };
type AnswerSelectConfig = { multiSelect: boolean; shuffle: boolean };
type AnswerBoolConfig = { trueLabel: string; falseLabel: string };
type DistractorConfig = { count: number; fieldDefId: number; fieldLabel: string };
type MaskConfig = { strategy: 'prefix' | 'suffix' | 'random'; keepPct: number };

// ── Custom nodes ──────────────────────────────────────────────────────────────

function FieldNode({ data }: { data: FieldConfig }) {
  return (
    <div className="cgt-node cgt-node-field">
      <div className="cgt-node-type">Field</div>
      <div className="cgt-node-label">{data.fieldLabel || '(select field)'}</div>
      <div className="cgt-node-sub">{data.inputType}</div>
      <Handle type="source" position={Position.Right} id="value" />
    </div>
  );
}

function PromptNode({ data }: { data: PromptConfig }) {
  return (
    <div className="cgt-node cgt-node-prompt">
      <Handle type="target" position={Position.Left} id="content" />
      <div className="cgt-node-type">Prompt</div>
      <div className="cgt-node-label">{data.label || 'Stimulus'}</div>
    </div>
  );
}

function AnswerTextNode({ data }: { data: AnswerTextConfig }) {
  return (
    <div className="cgt-node cgt-node-answer">
      <Handle type="target" position={Position.Left} id="expected" />
      <div className="cgt-node-type">Text Answer</div>
      <div className="cgt-node-sub">{data.fuzzy ? `fuzzy ${data.thresholdPct}%` : 'exact'}</div>
    </div>
  );
}

function AnswerSelectNode({ data }: { data: AnswerSelectConfig }) {
  return (
    <div className="cgt-node cgt-node-answer" style={{ minHeight: 80 }}>
      <Handle type="target" position={Position.Left} id="expected" style={{ top: '35%' }} />
      <Handle type="target" position={Position.Left} id="distractor" style={{ top: '65%' }} />
      <div className="cgt-node-type">Select Answer</div>
      <div className="cgt-node-sub">{data.multiSelect ? 'multi' : 'single'}{data.shuffle ? ' · shuffle' : ''}</div>
      <div className="cgt-node-port-labels">
        <span style={{ top: '35%' }}>expected</span>
        <span style={{ top: '65%' }}>distractor</span>
      </div>
    </div>
  );
}

function AnswerOrderNode() {
  return (
    <div className="cgt-node cgt-node-answer">
      <Handle type="target" position={Position.Left} id="items" />
      <div className="cgt-node-type">Order Answer</div>
      <div className="cgt-node-sub">arrange items</div>
    </div>
  );
}

function AnswerBoolNode({ data }: { data: AnswerBoolConfig }) {
  return (
    <div className="cgt-node cgt-node-answer">
      <Handle type="target" position={Position.Left} id="expected" />
      <div className="cgt-node-type">True/False</div>
      <div className="cgt-node-sub">{data.trueLabel || 'True'} / {data.falseLabel || 'False'}</div>
    </div>
  );
}

function DistractorNode({ data }: { data: DistractorConfig }) {
  return (
    <div className="cgt-node cgt-node-distractor">
      <div className="cgt-node-type">Distractors</div>
      <div className="cgt-node-label">{data.fieldLabel || '(select field)'}</div>
      <div className="cgt-node-sub">count: {data.count}</div>
      <Handle type="source" position={Position.Right} id="distractor" />
    </div>
  );
}

function MaskNode({ data }: { data: MaskConfig }) {
  return (
    <div className="cgt-node cgt-node-mask" style={{ minHeight: 80 }}>
      <Handle type="target" position={Position.Left} id="text" />
      <div className="cgt-node-type">Mask</div>
      <div className="cgt-node-sub">{data.strategy} · keep {data.keepPct}%</div>
      <Handle type="source" position={Position.Right} id="masked" style={{ top: '35%' }} />
      <Handle type="source" position={Position.Right} id="full" style={{ top: '65%' }} />
      <div className="cgt-node-port-labels cgt-node-port-labels-right">
        <span style={{ top: '35%' }}>masked</span>
        <span style={{ top: '65%' }}>full</span>
      </div>
    </div>
  );
}

const NODE_TYPES = {
  field: FieldNode,
  prompt: PromptNode,
  'answer-text': AnswerTextNode,
  'answer-select': AnswerSelectNode,
  'answer-order': AnswerOrderNode,
  'answer-bool': AnswerBoolNode,
  distractor: DistractorNode,
  mask: MaskNode
};

// ── Default configs ───────────────────────────────────────────────────────────

function defaultConfig(nodeType: string): object {
  switch (nodeType) {
    case 'field':         return { fieldDefId: 0, fieldLabel: '', inputType: 'text' };
    case 'prompt':        return { label: 'Prompt' };
    case 'answer-text':   return { fuzzy: true, thresholdPct: 85 };
    case 'answer-select': return { multiSelect: false, shuffle: true };
    case 'answer-order':  return {};
    case 'answer-bool':   return { trueLabel: 'True', falseLabel: 'False' };
    case 'distractor':    return { count: 3, fieldDefId: 0, fieldLabel: '' };
    case 'mask':          return { strategy: 'suffix', keepPct: 30 };
    default:              return {};
  }
}

// ── Config panel ──────────────────────────────────────────────────────────────

function ConfigPanel({
  node,
  fields,
  onChange
}: {
  node: Node;
  fields: CgFieldDefResponse[];
  onChange: (id: string, config: object) => void;
}) {
  const cfg = node.data as Record<string, unknown>;
  const type = node.type ?? '';

  function set(key: string, value: unknown) {
    onChange(node.id, { ...cfg, [key]: value });
  }

  const fieldSelect = (defKey: string, labelKey: string) => (
    <div className="cgt-cfg-row">
      <label className="cgt-cfg-label">Field</label>
      <select
        className="cg-select"
        value={(cfg[defKey] as number) ?? 0}
        onChange={e => {
          const id = Number(e.target.value);
          const f = fields.find(x => x.id === id);
          onChange(node.id, {
            ...cfg,
            [defKey]: id,
            [labelKey]: f?.label ?? '',
            ...(type === 'field' ? { inputType: f?.inputType ?? 'text' } : {})
          });
        }}
      >
        <option value={0}>— select field —</option>
        {fields.map(f => (
          <option key={f.id} value={f.id}>{f.label} ({f.inputType})</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="cgt-config-panel">
      <div className="cgt-cfg-title">{type}</div>

      {(type === 'field') && fieldSelect('fieldDefId', 'fieldLabel')}

      {type === 'prompt' && (
        <div className="cgt-cfg-row">
          <label className="cgt-cfg-label">Label</label>
          <input className="cg-input" value={(cfg.label as string) ?? ''} onChange={e => set('label', e.target.value)} />
        </div>
      )}

      {type === 'answer-text' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label cgt-cfg-check">
              <input type="checkbox" checked={(cfg.fuzzy as boolean) ?? true} onChange={e => set('fuzzy', e.target.checked)} />
              Fuzzy match
            </label>
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Threshold %</label>
            <input type="number" className="cg-input cgt-num" min={50} max={100} value={(cfg.thresholdPct as number) ?? 85} onChange={e => set('thresholdPct', Number(e.target.value))} />
          </div>
        </>
      )}

      {type === 'answer-select' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label cgt-cfg-check">
              <input type="checkbox" checked={(cfg.multiSelect as boolean) ?? false} onChange={e => set('multiSelect', e.target.checked)} />
              Multi-select
            </label>
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label cgt-cfg-check">
              <input type="checkbox" checked={(cfg.shuffle as boolean) ?? true} onChange={e => set('shuffle', e.target.checked)} />
              Shuffle options
            </label>
          </div>
        </>
      )}

      {type === 'answer-bool' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">True label</label>
            <input className="cg-input" value={(cfg.trueLabel as string) ?? 'True'} onChange={e => set('trueLabel', e.target.value)} />
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">False label</label>
            <input className="cg-input" value={(cfg.falseLabel as string) ?? 'False'} onChange={e => set('falseLabel', e.target.value)} />
          </div>
        </>
      )}

      {type === 'distractor' && (
        <>
          {fieldSelect('fieldDefId', 'fieldLabel')}
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Count</label>
            <input type="number" className="cg-input cgt-num" min={1} max={10} value={(cfg.count as number) ?? 3} onChange={e => set('count', Number(e.target.value))} />
          </div>
        </>
      )}

      {type === 'mask' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Strategy</label>
            <select className="cg-select" value={(cfg.strategy as string) ?? 'suffix'} onChange={e => set('strategy', e.target.value)}>
              <option value="prefix">Prefix (keep start)</option>
              <option value="suffix">Suffix (keep end)</option>
              <option value="random">Random</option>
            </select>
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Keep %</label>
            <input type="number" className="cg-input cgt-num" min={5} max={90} value={(cfg.keepPct as number) ?? 30} onChange={e => set('keepPct', Number(e.target.value))} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  { type: 'field',         label: 'Field',        hint: 'reads entity field' },
  { type: 'prompt',        label: 'Prompt',       hint: 'shows stimulus' },
  { type: 'answer-text',   label: 'Text Answer',  hint: 'type the answer' },
  { type: 'answer-select', label: 'Select',       hint: 'pick from options' },
  { type: 'answer-order',  label: 'Order',        hint: 'arrange items' },
  { type: 'answer-bool',   label: 'True/False',   hint: 'boolean answer' },
  { type: 'distractor',    label: 'Distractors',  hint: 'wrong options source' },
  { type: 'mask',          label: 'Mask',         hint: 'hide part of text' }
];

// ── Inner editor (must be inside ReactFlowProvider) ───────────────────────────

let _seq = 1;
function uid() { return `n${_seq++}`; }

function EditorCanvas({
  libId,
  typeId,
  graphId,
  graphName,
  initialNodes,
  initialEdges,
  typeDef,
  onBack
}: {
  libId: number;
  typeId: number;
  graphId: number;
  graphName: string;
  initialNodes: Node[];
  initialEdges: Edge[];
  typeDef: CgTypeDefDetailResponse;
  onBack: () => void;
}) {
  const [name, setName] = useState(graphName);
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selected, setSelected] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
    setDirty(true);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
    setDirty(true);
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    setEdges(eds => addEdge({ ...conn, id: `e-${uid()}` }, eds));
    setDirty(true);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelected(node), []);
  const onPaneClick = useCallback(() => setSelected(null), []);

  function addNode(type: string) {
    const bounds = wrapRef.current?.getBoundingClientRect();
    const cx = bounds ? bounds.left + bounds.width / 2 : 200;
    const cy = bounds ? bounds.top + bounds.height / 2 : 200;
    const pos = project({ x: cx + (Math.random() * 40 - 20), y: cy + (Math.random() * 40 - 20) });
    setNodes(nds => [...nds, { id: uid(), type, position: pos, data: defaultConfig(type) }]);
    setDirty(true);
  }

  function updateConfig(id: string, cfg: object) {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: cfg } : n));
    setSelected(prev => prev?.id === id ? { ...prev, data: cfg } : prev);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const nodeItems: CgTemplateNodeSaveItem[] = nodes.map(n => ({
        nodeKey: n.id,
        nodeType: n.type ?? 'field',
        configJson: JSON.stringify(n.data),
        positionX: n.position.x,
        positionY: n.position.y
      }));
      const edgeItems: CgTemplateEdgeSaveItem[] = edges.map(e => ({
        edgeKey: e.id,
        sourceKey: e.source,
        targetKey: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null
      }));
      await saveCgTemplate(libId, typeId, graphId, name, nodeItems, edgeItems);
      setDirty(false);
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cgt-layout">
      <div className="cg-header">
        <button className="cg-back" onClick={onBack}>← Templates</button>
        <input
          className="cg-input cgt-name-input"
          value={name}
          onChange={e => { setName(e.target.value); setDirty(true); }}
        />
        <div className="cg-header-actions">
          {error && <span className="cg-error-inline" onClick={() => setError(null)}>{error}</span>}
          <button className="cg-btn" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="cgt-body">
        <aside className="cgt-palette">
          <div className="cgt-palette-title">Add Node</div>
          {PALETTE.map(p => (
            <button key={p.type} className="cgt-palette-btn" onClick={() => addNode(p.type)}>
              <span className="cgt-palette-label">{p.label}</span>
              <span className="cgt-palette-hint">{p.hint}</span>
            </button>
          ))}
        </aside>

        <div className="cgt-canvas" ref={wrapRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            deleteKeyCode="Delete"
          >
            <Background color="#1e2330" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {selected && (
          <ConfigPanel node={selected} fields={typeDef.fields} onChange={updateConfig} />
        )}
      </div>
    </div>
  );
}

// ── Template list ─────────────────────────────────────────────────────────────

function TemplateList({
  libId,
  typeId,
  typeName,
  onEdit,
  onBack
}: {
  libId: number;
  typeId: number;
  typeName: string;
  onEdit: (id: number) => void;
  onBack: () => void;
}) {
  const [templates, setTemplates] = useState<CgTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getCgTemplates(libId, typeId)
      .then(setTemplates)
      .catch(() => setError('Failed to load templates.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [libId, typeId]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      const t = await createCgTemplate(libId, typeId, name);
      setNewName('');
      setShowNew(false);
      onEdit(t.id);
    } catch {
      setError('Failed to create.');
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this template?')) return;
    try {
      await deleteCgTemplate(libId, typeId, id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Failed to delete.');
    }
  }

  return (
    <div className="cg-page">
      <div className="cg-header">
        <button className="cg-back" onClick={onBack}>← {typeName}</button>
        <h1 className="cg-title">Question Templates</h1>
        <div className="cg-header-actions">
          <button className="cg-btn" onClick={() => setShowNew(true)}>+ New Template</button>
        </div>
      </div>

      {error && <div className="cg-error" onClick={() => setError(null)}>{error}</div>}

      <div className="cg-section">
        {showNew && (
          <div className="cgt-new-form">
            <input
              className="cg-input"
              placeholder="Template name…"
              value={newName}
              autoFocus
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setShowNew(false);
              }}
            />
            <button className="cg-btn cg-btn-primary" onClick={handleCreate}>Create</button>
            <button className="cg-btn" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        )}

        {loading ? (
          <div className="cg-loading">Loading…</div>
        ) : templates.length === 0 ? (
          <p className="cg-empty">No templates yet. Create one to define how quiz questions are generated from this entity type.</p>
        ) : (
          <div className="cg-list">
            {templates.map(t => (
              <div key={t.id} className="cg-list-item">
                <span className="cg-list-item-label">{t.name}</span>
                <span className="cg-muted">{t.nodeCount} nodes</span>
                <div className="cg-list-item-actions">
                  <button className="cg-btn cg-btn-sm" onClick={() => onEdit(t.id)}>Edit</button>
                  <button className="cg-btn cg-btn-sm cg-btn-danger" onClick={() => handleDelete(t.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function CgTemplateEditorPage({
  libId,
  typeId,
  onBack
}: {
  libId: number;
  typeId: number;
  onBack: () => void;
}) {
  const [activeGraphId, setActiveGraphId] = useState<number | null>(null);
  const [typeDef, setTypeDef] = useState<CgTypeDefDetailResponse | null>(null);
  const [graphData, setGraphData] = useState<{ name: string; nodes: Node[]; edges: Edge[] } | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCgTypeDefDetail(libId, typeId)
      .then(setTypeDef)
      .catch(() => setError('Failed to load type definition.'));
  }, [libId, typeId]);

  useEffect(() => {
    if (!activeGraphId) { setGraphData(null); return; }
    setLoadingGraph(true);
    getCgTemplate(libId, typeId, activeGraphId)
      .then(g => {
        const nodes: Node[] = g.nodes.map(n => ({
          id: n.nodeKey,
          type: n.nodeType,
          position: { x: Number(n.positionX), y: Number(n.positionY) },
          data: JSON.parse(n.configJson) as object
        }));
        const edges: Edge[] = g.edges.map(e => ({
          id: e.edgeKey,
          source: e.sourceKey,
          target: e.targetKey,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined
        }));
        setGraphData({ name: g.name, nodes, edges });
      })
      .catch(() => setError('Failed to load template.'))
      .finally(() => setLoadingGraph(false));
  }, [libId, typeId, activeGraphId]);

  if (error) {
    return (
      <div className="cg-page">
        <div className="cg-header">
          <button className="cg-back" onClick={onBack}>← Back</button>
        </div>
        <div className="cg-section">
          <div className="cg-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!typeDef) {
    return <div className="cg-page"><div className="cg-loading">Loading…</div></div>;
  }

  if (activeGraphId && loadingGraph) {
    return <div className="cg-page"><div className="cg-loading">Loading template…</div></div>;
  }

  if (activeGraphId && graphData) {
    return (
      <ReactFlowProvider>
        <EditorCanvas
          libId={libId}
          typeId={typeId}
          graphId={activeGraphId}
          graphName={graphData.name}
          initialNodes={graphData.nodes}
          initialEdges={graphData.edges}
          typeDef={typeDef}
          onBack={() => { setActiveGraphId(null); setGraphData(null); }}
        />
      </ReactFlowProvider>
    );
  }

  return (
    <TemplateList
      libId={libId}
      typeId={typeId}
      typeName={typeDef.name}
      onEdit={id => setActiveGraphId(id)}
      onBack={onBack}
    />
  );
}
