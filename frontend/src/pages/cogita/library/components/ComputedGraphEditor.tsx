import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../../../content/types';

export type ComputedGraphNodePayload = {
  id: string;
  type: string;
  name?: string;
  min?: number;
  max?: number;
  value?: number;
  inputs?: string[];
};

export type ComputedGraphDefinition = {
  nodes: ComputedGraphNodePayload[];
  output?: string | null;
  outputs?: string[];
};

type ComputedGraphEditorProps = {
  copy: Copy;
  value: ComputedGraphDefinition | null;
  onChange: (definition: ComputedGraphDefinition) => void;
};

const defaultNodes: Node[] = [
  {
    id: 'a',
    type: 'default',
    position: { x: 40, y: 40 },
    data: { label: 'A (random)', type: 'input.random', min: 1, max: 10, name: 'a' }
  },
  {
    id: 'b',
    type: 'default',
    position: { x: 40, y: 140 },
    data: { label: 'B (random)', type: 'input.random', min: 1, max: 10, name: 'b' }
  },
  {
    id: 'sum',
    type: 'default',
    position: { x: 280, y: 90 },
    data: { label: 'Add', type: 'compute.add', name: 'sum' }
  },
  {
    id: 'out',
    type: 'default',
    position: { x: 520, y: 90 },
    data: { label: 'Output', type: 'output', name: 'result' }
  }
];

const defaultEdges: Edge[] = [
  { id: 'e-a-sum', source: 'a', target: 'sum' },
  { id: 'e-b-sum', source: 'b', target: 'sum' },
  { id: 'e-sum-out', source: 'sum', target: 'out' }
];

export function ComputedGraphEditor({ copy, value, onChange }: ComputedGraphEditorProps) {
  const initialNodes = useMemo(() => {
    if (!value || value.nodes.length === 0) return defaultNodes;
    return value.nodes.map((node, index) => ({
      id: node.id,
      type: 'default',
      position: { x: 40 + index * 160, y: 60 + (index % 3) * 80 },
      data: {
        label: node.name || node.type,
        type: node.type,
        name: node.name,
        min: node.min,
        max: node.max,
        value: node.value
      }
    })) as Node[];
  }, [value]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nameWarning, setNameWarning] = useState<string | null>(null);

  useEffect(() => {
    setNameWarning(null);
  }, [selectedNode]);

  useEffect(() => {
    const inputsByNode = new Map<string, string[]>();
    edges.forEach((edge) => {
      if (!inputsByNode.has(edge.target)) {
        inputsByNode.set(edge.target, []);
      }
      inputsByNode.get(edge.target)!.push(edge.source);
    });

    const outputs = nodes
      .filter((node) => node.data?.type === 'output')
      .map((node) => node.id);
    const definition: ComputedGraphDefinition = {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.data?.type ?? 'compute.add',
        name: node.data?.name,
        min: node.data?.min,
        max: node.data?.max,
        value: node.data?.value,
        inputs: inputsByNode.get(node.id)
      })),
      output: outputs[0] ?? null,
      outputs
    };
    onChange(definition);
  }, [nodes, edges, onChange]);

  const onConnect = (connection: Connection) => {
    setEdges((prev) => addEdge(connection, prev));
  };

  const addNode = (nodeType: string) => {
    const id = crypto.randomUUID();
    const label = nodeType.replace('.', ' ');
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'default',
        position: { x: 80 + prev.length * 40, y: 80 + prev.length * 30 },
        data: { label, type: nodeType }
      }
    ]);
  };

  const updateSelectedNode = (updates: Partial<{ type: string; name: string; min: number; max: number; value: number }>) => {
    if (!selectedNode) return;
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        setNameWarning(null);
      } else {
        const collision = nodes.find(
          (node) =>
            node.id !== selectedNode.id &&
            node.data?.name &&
            node.data.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        setNameWarning(collision ? copy.cogita.library.graph.duplicateName : null);
      }
    }
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                ...updates,
                label: updates.name
                  ? updates.name
                  : updates.type
                    ? updates.type.replace('.', ' ')
                    : node.data?.label
              }
            }
          : node
      )
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((prev) => prev.filter((node) => node.id !== selectedNode.id));
    setEdges((prev) => prev.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedNode(null);
    setNameWarning(null);
  };

  return (
    <div className="cogita-collection-graph cogita-computed-graph">
      <div className="cogita-collection-graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNode(node)}
          fitView
        >
          <Background gap={18} size={1} />
          <Controls />
        </ReactFlow>
      </div>
      <div className="cogita-collection-graph-sidebar">
        <div className="cogita-graph-section">
          <p className="cogita-graph-section-title">{copy.cogita.library.graph.palette}</p>
          <div className="cogita-graph-palette">
            <button type="button" onClick={() => addNode('input.random')}>
              Random
            </button>
            <button type="button" onClick={() => addNode('input.const')}>
              Constant
            </button>
            <button type="button" onClick={() => addNode('compute.add')}>
              Add
            </button>
            <button type="button" onClick={() => addNode('compute.sub')}>
              Subtract
            </button>
            <button type="button" onClick={() => addNode('compute.mul')}>
              Multiply
            </button>
            <button type="button" onClick={() => addNode('compute.div')}>
              Divide
            </button>
            <button type="button" onClick={() => addNode('output')}>
              Output
            </button>
          </div>
        </div>
        <div className="cogita-graph-section">
          <p className="cogita-graph-section-title">{copy.cogita.library.graph.inspector}</p>
          {selectedNode ? (
            <div className="cogita-graph-inspector">
              <label className="cogita-field">
                <span>{copy.cogita.library.graph.nameLabel}</span>
                <input
                  type="text"
                  value={selectedNode.data?.name ?? ''}
                  placeholder={copy.cogita.library.graph.namePlaceholder}
                  onChange={(event) => updateSelectedNode({ name: event.target.value })}
                />
                {nameWarning ? <em className="cogita-help">{nameWarning}</em> : null}
              </label>
              <label className="cogita-field">
                <span>Type</span>
                <select
                  value={selectedNode.data?.type ?? 'compute.add'}
                  onChange={(event) => updateSelectedNode({ type: event.target.value })}
                >
                  <option value="input.random">Random</option>
                  <option value="input.const">Constant</option>
                  <option value="compute.add">Add</option>
                  <option value="compute.sub">Subtract</option>
                  <option value="compute.mul">Multiply</option>
                  <option value="compute.div">Divide</option>
                  <option value="output">Output</option>
                </select>
              </label>
              {selectedNode.data?.type === 'input.random' && (
                <>
                  <label className="cogita-field">
                    <span>Min</span>
                    <input
                      type="number"
                      value={selectedNode.data?.min ?? 0}
                      onChange={(event) => updateSelectedNode({ min: Number(event.target.value) })}
                    />
                  </label>
                  <label className="cogita-field">
                    <span>Max</span>
                    <input
                      type="number"
                      value={selectedNode.data?.max ?? 10}
                      onChange={(event) => updateSelectedNode({ max: Number(event.target.value) })}
                    />
                  </label>
                </>
              )}
              {selectedNode.data?.type === 'input.const' && (
                <label className="cogita-field">
                  <span>Value</span>
                  <input
                    type="number"
                    value={selectedNode.data?.value ?? 0}
                    onChange={(event) => updateSelectedNode({ value: Number(event.target.value) })}
                  />
                </label>
              )}
              <div className="cogita-form-actions">
                <button type="button" className="ghost" onClick={deleteSelectedNode}>
                  {copy.cogita.library.graph.deleteNode}
                </button>
              </div>
            </div>
          ) : (
            <p className="cogita-help">{copy.cogita.library.graph.emptyInspector}</p>
          )}
        </div>
      </div>
    </div>
  );
}
