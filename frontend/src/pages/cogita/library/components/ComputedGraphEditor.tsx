import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../../../content/types';

export type ComputedGraphNodePayload = {
  id: string;
  type: string;
  position?: { x: number; y: number };
  name?: string;
  outputLabel?: string;
  min?: number;
  max?: number;
  value?: number;
  list?: string[];
  inputs?: string[];
  inputsByHandle?: Record<string, string[]>;
};

export type ComputedGraphDefinition = {
  nodes: ComputedGraphNodePayload[];
  output?: string | null;
  outputs?: string[];
  answerTemplate?: string;
};

type ComputedGraphEditorProps = {
  copy: Copy;
  value: ComputedGraphDefinition | null;
  onChange: (definition: ComputedGraphDefinition) => void;
};

const defaultNodes: Node[] = [];
const defaultEdges: Edge[] = [];

type NodeInputHandle = { id: string; label: string; limitOne?: boolean };

type ComputedNodeMeta = {
  label: string;
  handles: NodeInputHandle[];
  output?: boolean;
};

function ComputedGraphNode({
  data
}: {
  data: {
    title: string;
    subtitle: string;
    handles: NodeInputHandle[];
    output?: boolean;
    name?: string;
    outputLabel?: string;
    value?: number | string | null;
  };
}) {
  const showValue =
    data.value !== undefined &&
    data.value !== null &&
    (typeof data.value === 'string' ? data.value.trim() !== '' : Number.isFinite(data.value));
  const showSubtitle =
    data.subtitle &&
    (!data.title || data.subtitle.trim().toLowerCase() !== data.title.trim().toLowerCase());
  const handleCount = data.handles.length;
  const extraHeight = handleCount > 1 ? (handleCount - 1) * 18 : 0;
  return (
    <div className="cogita-graph-node" style={{ minHeight: 96 + extraHeight, paddingBottom: 12 + extraHeight * 0.4 }}>
      <div className="cogita-graph-node-labels">
        <strong>{data.title}</strong>
        {showSubtitle ? <span>{data.subtitle}</span> : null}
      </div>
      {data.name ? <div className="cogita-graph-node-meta">{data.name}</div> : null}
      {data.outputLabel ? <div className="cogita-graph-node-meta">{data.outputLabel}</div> : null}
      {showValue ? <div className="cogita-graph-node-value">{data.value}</div> : null}
      {data.handles.map((handle, index) => (
        <Handle
          key={handle.id}
          type="target"
          id={handle.id}
          position={Position.Left}
          style={{ top: 46 + index * 28 }}
        >
          {handle.id !== 'in' ? <span className="cogita-graph-handle-label">{handle.label}</span> : null}
        </Handle>
      ))}
      {data.output !== false ? <Handle type="source" id="out" position={Position.Right} /> : null}
    </div>
  );
}

export function ComputedGraphEditor({ copy, value, onChange }: ComputedGraphEditorProps) {
  const nodeMeta = useMemo<Record<string, ComputedNodeMeta>>(
    () => ({
      'input.random': { label: copy.cogita.library.graph.nodeTypes.inputRandom, handles: [], output: true },
      'input.const': { label: copy.cogita.library.graph.nodeTypes.inputConst, handles: [], output: true },
      'input.list': {
        label: copy.cogita.library.graph.nodeTypes.inputList,
        handles: [{ id: 'index', label: copy.cogita.library.graph.handleLabels.index, limitOne: true }],
        output: true
      },
      'compute.add': {
        label: copy.cogita.library.graph.nodeTypes.add,
        handles: [{ id: 'in', label: copy.cogita.library.graph.handleLabels.input }],
        output: true
      },
      'compute.sub': {
        label: copy.cogita.library.graph.nodeTypes.sub,
        handles: [
          { id: 'add', label: copy.cogita.library.graph.handleLabels.add },
          { id: 'sub', label: copy.cogita.library.graph.handleLabels.sub }
        ],
        output: true
      },
      'compute.mul': {
        label: copy.cogita.library.graph.nodeTypes.mul,
        handles: [{ id: 'in', label: copy.cogita.library.graph.handleLabels.input }],
        output: true
      },
      'compute.div': {
        label: copy.cogita.library.graph.nodeTypes.div,
        handles: [
          { id: 'num', label: copy.cogita.library.graph.handleLabels.numerator, limitOne: true },
          { id: 'den', label: copy.cogita.library.graph.handleLabels.denominator }
        ],
        output: true
      },
      'compute.pow': {
        label: copy.cogita.library.graph.nodeTypes.pow,
        handles: [
          { id: 'base', label: copy.cogita.library.graph.handleLabels.base, limitOne: true },
          { id: 'exp', label: copy.cogita.library.graph.handleLabels.exponent, limitOne: true }
        ],
        output: true
      },
      'compute.exp': {
        label: copy.cogita.library.graph.nodeTypes.exp,
        handles: [
          { id: 'base', label: copy.cogita.library.graph.handleLabels.base, limitOne: true },
          { id: 'exp', label: copy.cogita.library.graph.handleLabels.exponent, limitOne: true }
        ],
        output: true
      },
      'compute.log': {
        label: copy.cogita.library.graph.nodeTypes.log,
        handles: [
          { id: 'value', label: copy.cogita.library.graph.handleLabels.value, limitOne: true },
          { id: 'base', label: copy.cogita.library.graph.handleLabels.base, limitOne: true }
        ],
        output: true
      },
      'compute.abs': {
        label: copy.cogita.library.graph.nodeTypes.abs,
        handles: [{ id: 'in', label: copy.cogita.library.graph.handleLabels.input, limitOne: true }],
        output: true
      },
      'compute.min': {
        label: copy.cogita.library.graph.nodeTypes.min,
        handles: [{ id: 'in', label: copy.cogita.library.graph.handleLabels.input }],
        output: true
      },
      'compute.max': {
        label: copy.cogita.library.graph.nodeTypes.max,
        handles: [{ id: 'in', label: copy.cogita.library.graph.handleLabels.input }],
        output: true
      },
      'compute.floor': {
        label: copy.cogita.library.graph.nodeTypes.floor,
        handles: [{ id: 'in', label: copy.cogita.library.graph.handleLabels.input, limitOne: true }],
        output: true
      },
      'compute.ceil': {
        label: copy.cogita.library.graph.nodeTypes.ceil,
        handles: [{ id: 'in', label: copy.cogita.library.graph.handleLabels.input, limitOne: true }],
        output: true
      },
      'compute.round': {
        label: copy.cogita.library.graph.nodeTypes.round,
        handles: [{ id: 'in', label: copy.cogita.library.graph.handleLabels.input, limitOne: true }],
        output: true
      },
      'compute.mod': {
        label: copy.cogita.library.graph.nodeTypes.mod,
        handles: [
          { id: 'a', label: copy.cogita.library.graph.handleLabels.numerator, limitOne: true },
          { id: 'b', label: copy.cogita.library.graph.handleLabels.denominator, limitOne: true }
        ],
        output: true
      },
      'compute.concat': {
        label: copy.cogita.library.graph.nodeTypes.concat,
        handles: [{ id: 'in', label: copy.cogita.library.graph.handleLabels.input }],
        output: true
      },
      'compute.trim': {
        label: copy.cogita.library.graph.nodeTypes.trim,
        handles: [
          { id: 'text', label: copy.cogita.library.graph.handleLabels.text, limitOne: true },
          { id: 'start', label: copy.cogita.library.graph.handleLabels.start, limitOne: true },
          { id: 'end', label: copy.cogita.library.graph.handleLabels.end, limitOne: true }
        ],
        output: true
      },
      output: {
        label: copy.cogita.library.graph.nodeTypes.output,
        handles: [
          { id: 'in', label: copy.cogita.library.graph.handleLabels.input, limitOne: true },
          { id: 'name', label: copy.cogita.library.graph.handleLabels.name, limitOne: true }
        ],
        output: false
      }
    }),
    [copy]
  );
  const buildNodesFromValue = (definition: ComputedGraphDefinition | null) => {
    if (!definition || definition.nodes.length === 0) return defaultNodes;
    return definition.nodes.map((node, index) => ({
      id: node.id,
      type: 'computed',
      position: node.position ?? { x: 40 + index * 160, y: 60 + (index % 3) * 80 },
      data: {
        title: node.name || nodeMeta[node.type]?.label || node.type,
        subtitle: nodeMeta[node.type]?.label || node.type,
        type: node.type,
        name: node.name,
        outputLabel: node.outputLabel,
        min: node.min,
        max: node.max,
        value: node.type === 'input.const' ? node.value : undefined,
        list: node.list,
        handles: nodeMeta[node.type]?.handles ?? [],
        output: nodeMeta[node.type]?.output ?? true
      }
    })) as Node[];
  };

  const buildEdgesFromValue = (definition: ComputedGraphDefinition | null) => {
    if (!definition || definition.nodes.length === 0) return defaultEdges;
    const nodeIds = new Set(definition.nodes.map((node) => node.id));
    const edges: Edge[] = [];
    let counter = 0;
    definition.nodes.forEach((node) => {
      const inputs = node.inputsByHandle ?? (node.inputs ? { in: node.inputs } : {});
      Object.entries(inputs).forEach(([handle, ids]) => {
        ids.forEach((sourceId) => {
          if (!nodeIds.has(sourceId)) return;
          edges.push({
            id: `${node.id}-${handle}-${sourceId}-${counter++}`,
            source: sourceId,
            target: node.id,
            targetHandle: handle === 'in' ? undefined : handle
          });
        });
      });
    });
    return edges;
  };

  const initialNodes = useMemo(() => buildNodesFromValue(value), [value, nodeMeta]);
  const initialEdges = useMemo(() => buildEdgesFromValue(value), [value]);
  const buildDefinitionSignature = (definition: ComputedGraphDefinition | null, includePosition: boolean) => {
    if (!definition) return 'null';
    const nodeParts = definition.nodes
      .map((node) => {
        const listValue = (node.list ?? []).join(',');
        const inputs = node.inputs ? node.inputs.join(',') : '';
        const handles = node.inputsByHandle
          ? Object.entries(node.inputsByHandle)
              .map(([key, ids]) => `${key}:${[...ids].sort().join(',')}`)
              .sort()
              .join('|')
          : '';
        const pos = includePosition && node.position ? `${node.position.x},${node.position.y}` : '';
        return [
          node.id,
          node.type,
          node.name ?? '',
          node.outputLabel ?? '',
          node.min ?? '',
          node.max ?? '',
          listValue,
          inputs,
          handles,
          pos
        ].join(':');
      })
      .sort()
      .join('||');
    const outputs = definition.outputs ? [...definition.outputs].sort().join(',') : definition.output ?? '';
    return `${nodeParts}::${outputs}`;
  };
  const valueSignature = useMemo(() => {
    const hasPositions = !!value?.nodes?.some((node) => !!node.position);
    return buildDefinitionSignature(value, hasPositions);
  }, [value]);
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [nameWarning, setNameWarning] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [randomValues, setRandomValues] = useState<Record<string, number>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const onChangeRef = useRef(onChange);
  const lastValueSignatureRef = useRef(valueSignature);
  const lastEmittedSignatureRef = useRef(valueSignature);
  const lastEmittedSignatureNoPosRef = useRef(buildDefinitionSignature(value, false));
  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId]
  );
  const displayNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId
      })),
    [nodes, selectedNodeId]
  );

  useEffect(() => {
    setNameWarning(null);
    setNameError(null);
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedEdgeIds.length === 0) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      setEdges((prev) => prev.filter((edge) => !selectedEdgeIds.includes(edge.id)));
      setSelectedEdgeIds([]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedEdgeIds, setEdges]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (lastValueSignatureRef.current === valueSignature) {
      return;
    }
    if (lastEmittedSignatureRef.current === valueSignature || lastEmittedSignatureNoPosRef.current === valueSignature) {
      lastValueSignatureRef.current = valueSignature;
      return;
    }
    lastValueSignatureRef.current = valueSignature;
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodeId(null);
    setNameWarning(null);
    setNameError(null);
    setRandomValues({});
    setRefreshTick((prev) => prev + 1);
  }, [initialNodes, initialEdges, setEdges, setNodes, valueSignature]);

  useEffect(() => {
    const outputs = nodes
      .filter((node) => node.data?.type === 'output')
      .map((node) => node.id)
      .sort();
    const inputsByHandle = new Map<string, Record<string, string[]>>();
    edges.forEach((edge) => {
      let entry: Record<string, string[]> | undefined = inputsByHandle.get(edge.target);
      if (!entry) {
        entry = {};
        inputsByHandle.set(edge.target, entry);
      }
      const handleId = edge.targetHandle || 'in';
      if (!entry[handleId]) {
        entry[handleId] = [];
      }
      entry[handleId].push(edge.source);
    });
    inputsByHandle.forEach((handles) => {
      Object.values(handles).forEach((list) => list.sort());
    });
    const definition: ComputedGraphDefinition = {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.data?.type ?? 'compute.add',
        position: node.position,
        name: node.data?.name,
        outputLabel: node.data?.outputLabel,
        min: node.data?.min,
        max: node.data?.max,
        value: node.data?.type === 'input.const' ? node.data?.value : undefined,
        list: node.data?.list,
        inputs: inputsByHandle.get(node.id)?.in,
        inputsByHandle: inputsByHandle.get(node.id)
      })),
      output: outputs[0] ?? null,
      outputs
    };
    const signature = buildDefinitionSignature(definition, true);
    const signatureNoPos = buildDefinitionSignature(definition, false);
    if (
      signature === lastEmittedSignatureRef.current ||
      signatureNoPos === lastEmittedSignatureNoPosRef.current
    ) {
      return;
    }
    lastEmittedSignatureRef.current = signature;
    lastEmittedSignatureNoPosRef.current = signatureNoPos;
    onChangeRef.current(definition);
  }, [nodes, edges]);

  useEffect(() => {
    const next: Record<string, number> = {};
    let changed = false;
    nodes.forEach((node) => {
      if (node.data?.type !== 'input.random') return;
      if (randomValues[node.id] !== undefined) {
        next[node.id] = randomValues[node.id];
        return;
      }
      const min = Number.isFinite(node.data?.min) ? Number(node.data?.min) : 0;
      const max = Number.isFinite(node.data?.max) ? Number(node.data?.max) : min + 10;
      const low = Math.min(min, max);
      const high = Math.max(min, max);
      next[node.id] = Math.floor(Math.random() * (high - low + 1)) + low;
      changed = true;
    });
    if (changed || Object.keys(next).length !== Object.keys(randomValues).length) {
      setRandomValues(next);
    }
  }, [nodes, randomValues, refreshTick]);

  const nodeSignature = useMemo(() => {
    const list = nodes
      .map((node) => {
        const listValue = (node.data?.list ?? []).join(',');
        return [
          node.id,
          node.data?.type ?? '',
          node.data?.name ?? '',
          node.data?.min ?? '',
          node.data?.max ?? '',
          listValue
        ].join(':');
      })
      .sort();
    return list.join('|');
  }, [nodes]);

  const edgeSignature = useMemo(() => {
    const list = edges
      .map((edge) => `${edge.source}:${edge.target}:${edge.targetHandle ?? ''}`)
      .sort();
    return list.join('|');
  }, [edges]);

  const computedValues = useMemo(() => {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const inputsByHandle = new Map<string, Record<string, string[]>>();
    edges.forEach((edge) => {
      let entry: Record<string, string[]> | undefined = inputsByHandle.get(edge.target);
      if (!entry) {
        entry = {};
        inputsByHandle.set(edge.target, entry);
      }
      const handleId = edge.targetHandle || 'in';
      if (!entry[handleId]) {
        entry[handleId] = [];
      }
      entry[handleId].push(edge.source);
    });

    const values = new Map<string, number | string>();
    const visiting = new Set<string>();

    const asNumber = (value: number | string | undefined): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const resolveInputIds = (node: Node, handle?: string): string[] =>
      handle ? inputsByHandle.get(node.id)?.[handle] ?? [] : inputsByHandle.get(node.id)?.in ?? [];

    const resolveInputs = (node: Node, handle?: string): number[] =>
      resolveInputIds(node, handle).map((id) => asNumber(evaluateNode(id)));

    const resolveInputsRaw = (node: Node, handle?: string): Array<number | string> =>
      resolveInputIds(node, handle).map((id) => evaluateNode(id));

    const evaluateNode = (nodeId: string): number | string => {
      if (values.has(nodeId)) return values.get(nodeId)!;
      if (visiting.has(nodeId)) return 0;
      const node = nodeMap.get(nodeId);
      if (!node) return 0;
      visiting.add(nodeId);
      const type = node.data?.type ?? '';
      let result: number | string = 0;
      switch (type) {
        case 'input.random': {
          result = randomValues[nodeId] ?? 0;
          break;
        }
        case 'input.const': {
          result = Number.isFinite(node.data?.value) ? Number(node.data?.value) : 0;
          break;
        }
        case 'input.list': {
          const list = (node.data?.list ?? []).filter(Boolean);
          const index = Math.round(resolveInputs(node, 'index')[0] ?? 0);
          const selected = list.length ? list[Math.max(0, Math.min(list.length - 1, index))] : '';
          result = selected || String(index);
          break;
        }
        case 'compute.add': {
          result = resolveInputs(node, 'in').reduce((sum: number, value: number) => sum + value, 0);
          break;
        }
        case 'compute.sub': {
          result =
            resolveInputs(node, 'add').reduce((sum: number, value: number) => sum + value, 0) -
            resolveInputs(node, 'sub').reduce((sum: number, value: number) => sum + value, 0);
          break;
        }
        case 'compute.mul': {
          const list = resolveInputs(node, 'in');
          result = list.length ? list.reduce((prod: number, value: number) => prod * value, 1) : 0;
          break;
        }
        case 'compute.div': {
          const numerator = resolveInputs(node, 'num')[0] ?? 0;
          const denominator = resolveInputs(node, 'den').reduce((sum: number, value: number) => sum + value, 0);
          result = Math.abs(denominator) < Number.EPSILON ? 0 : numerator / denominator;
          break;
        }
        case 'compute.pow': {
          const base = resolveInputs(node, 'base')[0] ?? 0;
          const exp = resolveInputs(node, 'exp')[0] ?? 0;
          result = Math.pow(base, exp);
          break;
        }
        case 'compute.exp': {
          const base = resolveInputs(node, 'base')[0] ?? 0;
          const exp = resolveInputs(node, 'exp')[0] ?? 0;
          result = Math.pow(base, exp);
          break;
        }
        case 'compute.log': {
          const value = resolveInputs(node, 'value')[0] ?? 0;
          const base = resolveInputs(node, 'base')[0] ?? 0;
          const safeValue = Math.max(value, Number.EPSILON);
          result = Math.abs(base) < Number.EPSILON ? Math.log(safeValue) : Math.log(safeValue) / Math.log(base);
          break;
        }
        case 'compute.abs': {
          result = Math.abs(resolveInputs(node, 'in')[0] ?? 0);
          break;
        }
        case 'compute.min': {
          const list = resolveInputs(node, 'in');
          result = list.length ? Math.min(...list) : 0;
          break;
        }
        case 'compute.max': {
          const list = resolveInputs(node, 'in');
          result = list.length ? Math.max(...list) : 0;
          break;
        }
        case 'compute.floor': {
          result = Math.floor(resolveInputs(node, 'in')[0] ?? 0);
          break;
        }
        case 'compute.ceil': {
          result = Math.ceil(resolveInputs(node, 'in')[0] ?? 0);
          break;
        }
        case 'compute.round': {
          result = Math.round(resolveInputs(node, 'in')[0] ?? 0);
          break;
        }
        case 'compute.mod': {
          const a = resolveInputs(node, 'a')[0] ?? 0;
          const b = resolveInputs(node, 'b')[0] ?? 0;
          result = Math.abs(b) < Number.EPSILON ? 0 : a % b;
          break;
        }
        case 'compute.concat': {
          const inputs = resolveInputsRaw(node, 'in');
          const list = inputs.length ? inputs : resolveInputsRaw(node);
          result = list.map((value) => (value === undefined || value === null ? '' : String(value))).join('');
          break;
        }
        case 'compute.trim': {
          const textValue = resolveInputsRaw(node, 'text')[0] ?? resolveInputsRaw(node, 'in')[0] ?? '';
          const rawText = textValue === undefined || textValue === null ? '' : String(textValue);
          const startTrim = Math.max(0, Math.round(resolveInputs(node, 'start')[0] ?? 0));
          const endTrim = Math.max(0, Math.round(resolveInputs(node, 'end')[0] ?? 0));
          result =
            startTrim + endTrim >= rawText.length
              ? ''
              : rawText.substring(startTrim, rawText.length - endTrim);
          break;
        }
        case 'output': {
          const inputId = resolveInputIds(node, 'in')[0];
          result = inputId ? evaluateNode(inputId) : 0;
          break;
        }
        default:
          result = 0;
      }
      visiting.delete(nodeId);
      values.set(nodeId, result);
      return result;
    };

    nodes.forEach((node) => evaluateNode(node.id));
    return values;
  }, [nodeSignature, edgeSignature, randomValues]);

  const computedValuesRef = useRef(computedValues);
  useEffect(() => {
    computedValuesRef.current = computedValues;
  }, [computedValues]);

  const ComputedGraphNodeWithValues = useCallback((props: NodeProps) => {
    const nextValue = computedValuesRef.current.get(props.id);
    return <ComputedGraphNode data={{ ...props.data, value: nextValue }} />;
  }, []);

  const nodeTypes = useMemo(() => ({ computed: ComputedGraphNodeWithValues }), [ComputedGraphNodeWithValues]);

  const onConnect = (connection: Connection) => {
    if (!connection.target || !connection.targetHandle) {
      setEdges((prev) => addEdge(connection, prev));
      return;
    }
    const targetNode = nodes.find((node) => node.id === connection.target);
    const meta = targetNode ? nodeMeta[targetNode.data?.type ?? ''] : null;
    const handleConfig = meta?.handles.find((handle) => handle.id === connection.targetHandle);
    setEdges((prev) => {
      let next = prev;
      if (handleConfig?.limitOne) {
        next = prev.filter((edge) => !(edge.target === connection.target && edge.targetHandle === connection.targetHandle));
      }
      return addEdge(connection, next);
    });
  };

  const addNode = (nodeType: string) => {
    const id = crypto.randomUUID();
    const meta = nodeMeta[nodeType] ?? { label: nodeType, handles: [] };
    const label = meta.label;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'computed',
        position: { x: 80 + prev.length * 40, y: 80 + prev.length * 30 },
        data: {
          title: label,
          subtitle: meta.label,
          type: nodeType,
          name: '',
          handles: meta.handles,
          list: nodeType === 'input.list' ? [] : undefined,
          output: meta.output ?? true
        }
      }
    ]);
  };

  const updateSelectedNode = (
    updates: Partial<{ type: string; name: string; outputLabel: string; min: number; max: number; value: number; list: string[] }>
  ) => {
    if (!selectedNodeId) return;
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      const latexOk = trimmed === '' || /^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed);
      setNameError(latexOk ? null : copy.cogita.library.graph.invalidName);
      if (!trimmed) {
        setNameWarning(null);
      } else {
        const collision = nodes.find(
          (node) =>
            node.id !== selectedNodeId &&
            node.data?.name &&
            node.data.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        setNameWarning(collision ? copy.cogita.library.graph.duplicateName : null);
      }
    }
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...updates,
                title: updates.name
                  ? updates.name
                  : node.data?.title,
                subtitle: nodeMeta[updates.type ?? node.data?.type ?? '']?.label ?? node.data?.subtitle
              }
            }
          : node
      )
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
    setEdges((prev) => prev.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setRandomValues((prev) => {
      const next = { ...prev };
      delete next[selectedNodeId];
      return next;
    });
    setSelectedNodeId(null);
    setNameWarning(null);
  };

  const selectionRef = useRef<{ nodeId: string | null; edgeIds: string[] }>({
    nodeId: null,
    edgeIds: []
  });

  const handleSelectionChange = (selection: { nodes: Node[]; edges: Edge[] }) => {
    const nextNodeId = selection.nodes[0]?.id ?? null;
    const nextEdgeIds = selection.edges.map((edge) => edge.id);
    const prev = selectionRef.current;
    const sameNode = prev.nodeId === nextNodeId;
    const sameEdges =
      prev.edgeIds.length === nextEdgeIds.length &&
      prev.edgeIds.every((id, index) => id === nextEdgeIds[index]);
    if (sameNode && sameEdges) {
      return;
    }
    selectionRef.current = { nodeId: nextNodeId, edgeIds: nextEdgeIds };
    setSelectedNodeId(nextNodeId);
    setSelectedEdgeIds(nextEdgeIds);
  };

  const handleNodesChange = (changes: Parameters<typeof applyNodeChanges>[0]) => {
    const filtered = changes.filter((change) => change.type !== 'select' && change.type !== 'dimensions');
    if (filtered.length === 0) return;
    setNodes((prev) => applyNodeChanges(filtered, prev));
  };

  const handleEdgesChange = (changes: Parameters<typeof applyEdgeChanges>[0]) => {
    const filtered = changes.filter((change) => change.type !== 'select');
    if (filtered.length === 0) return;
    setEdges((prev) => applyEdgeChanges(filtered, prev));
  };

  return (
    <div className="cogita-collection-graph cogita-computed-graph">
      <div className="cogita-collection-graph-canvas">
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={displayNodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onSelectionChange={handleSelectionChange}
          nodesDraggable
          nodesConnectable
          elementsSelectable
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
              {copy.cogita.library.graph.nodeTypes.inputRandom}
            </button>
            <button type="button" onClick={() => addNode('input.const')}>
              {copy.cogita.library.graph.nodeTypes.inputConst}
            </button>
            <button type="button" onClick={() => addNode('input.list')}>
              {copy.cogita.library.graph.nodeTypes.inputList}
            </button>
            <button type="button" onClick={() => addNode('compute.add')}>
              {copy.cogita.library.graph.nodeTypes.add}
            </button>
            <button type="button" onClick={() => addNode('compute.sub')}>
              {copy.cogita.library.graph.nodeTypes.sub}
            </button>
            <button type="button" onClick={() => addNode('compute.mul')}>
              {copy.cogita.library.graph.nodeTypes.mul}
            </button>
            <button type="button" onClick={() => addNode('compute.div')}>
              {copy.cogita.library.graph.nodeTypes.div}
            </button>
            <button type="button" onClick={() => addNode('compute.pow')}>
              {copy.cogita.library.graph.nodeTypes.pow}
            </button>
            <button type="button" onClick={() => addNode('compute.exp')}>
              {copy.cogita.library.graph.nodeTypes.exp}
            </button>
            <button type="button" onClick={() => addNode('compute.log')}>
              {copy.cogita.library.graph.nodeTypes.log}
            </button>
            <button type="button" onClick={() => addNode('compute.abs')}>
              {copy.cogita.library.graph.nodeTypes.abs}
            </button>
            <button type="button" onClick={() => addNode('compute.min')}>
              {copy.cogita.library.graph.nodeTypes.min}
            </button>
            <button type="button" onClick={() => addNode('compute.max')}>
              {copy.cogita.library.graph.nodeTypes.max}
            </button>
            <button type="button" onClick={() => addNode('compute.floor')}>
              {copy.cogita.library.graph.nodeTypes.floor}
            </button>
            <button type="button" onClick={() => addNode('compute.ceil')}>
              {copy.cogita.library.graph.nodeTypes.ceil}
            </button>
            <button type="button" onClick={() => addNode('compute.round')}>
              {copy.cogita.library.graph.nodeTypes.round}
            </button>
            <button type="button" onClick={() => addNode('compute.mod')}>
              {copy.cogita.library.graph.nodeTypes.mod}
            </button>
            <button type="button" onClick={() => addNode('compute.concat')}>
              {copy.cogita.library.graph.nodeTypes.concat}
            </button>
            <button type="button" onClick={() => addNode('compute.trim')}>
              {copy.cogita.library.graph.nodeTypes.trim}
            </button>
            <button type="button" onClick={() => addNode('output')}>
              {copy.cogita.library.graph.nodeTypes.output}
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
                {nameError ? <em className="cogita-help">{nameError}</em> : null}
                <em className="cogita-help">{copy.cogita.library.graph.nameHint}</em>
              </label>
              <p className="cogita-graph-readonly">
                {copy.cogita.library.graph.typeLabel} {nodeMeta[selectedNode.data?.type ?? '']?.label ?? selectedNode.data?.type}
              </p>
              {selectedNode.data?.type === 'output' && (
                <label className="cogita-field">
                  <span>{copy.cogita.library.graph.outputLabel}</span>
                  <input
                    type="text"
                    value={selectedNode.data?.outputLabel ?? ''}
                    onChange={(event) => updateSelectedNode({ outputLabel: event.target.value })}
                    placeholder={copy.cogita.library.graph.outputPlaceholder}
                  />
                </label>
              )}
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
              {selectedNode.data?.type === 'input.list' && (
                <label className="cogita-field">
                  <span>{copy.cogita.library.graph.listLabel}</span>
                  <textarea
                    value={(selectedNode.data?.list ?? []).join('\n')}
                    onChange={(event) =>
                      updateSelectedNode({
                        list: event.target.value
                          .split('\n')
                          .map((line) => line.replace(/\r$/, ''))
                          .filter((line) => line.length > 0)
                      })
                    }
                    placeholder={copy.cogita.library.graph.listPlaceholder}
                  />
                </label>
              )}
              {selectedNode.data?.type === 'input.random' && (
                <div className="cogita-form-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      if (!selectedNodeId) return;
                      setRandomValues((prev) => {
                        const min = Number.isFinite(selectedNode.data?.min) ? Number(selectedNode.data?.min) : 0;
                        const max = Number.isFinite(selectedNode.data?.max) ? Number(selectedNode.data?.max) : min + 10;
                        const low = Math.min(min, max);
                        const high = Math.max(min, max);
                        return {
                          ...prev,
                          [selectedNodeId]: Math.floor(Math.random() * (high - low + 1)) + low
                        };
                      });
                      setRefreshTick((prev) => prev + 1);
                    }}
                  >
                    {copy.cogita.library.graph.regenerateRandom}
                  </button>
                </div>
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
