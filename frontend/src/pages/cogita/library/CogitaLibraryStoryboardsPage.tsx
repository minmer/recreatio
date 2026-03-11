import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';
import {
  createCogitaCreationProject,
  getCogitaCreationProjects,
  updateCogitaCreationProject,
  type CogitaCreationProject
} from '../../../lib/api';

type StoryboardNodeType = 'text' | 'video' | 'card' | 'revision' | 'group';
type StoryboardDependencyMode = 'fulfilled' | 'still_fulfilled';

type StoryboardNodeDependency = {
  nodeId: string;
  mode: StoryboardDependencyMode;
};

type StoryboardNodeOutcome = {
  outcomeId: string;
  label: string;
  toNodeId?: string;
};

type StoryboardNodeRecord = {
  nodeId: string;
  title: string;
  nodeType: StoryboardNodeType;
  description: string;
  text: string;
  videoUrl: string;
  cardPrompt: string;
  cardExpectedAnswer: string;
  revisionId: string;
  groupNodeIds: string[];
  dependencies: StoryboardNodeDependency[];
  outcomes: StoryboardNodeOutcome[];
  position: { x: number; y: number };
};

type StoryboardGraphDocument = {
  schema: 'cogita_storyboard_graph';
  version: 1;
  startNodeId?: string;
  script: string;
  steps: string[];
  nodes: StoryboardNodeRecord[];
};

const NODE_TYPE_OPTIONS: Array<{ value: StoryboardNodeType; label: string }> = [
  { value: 'text', label: 'Text screen' },
  { value: 'video', label: 'Video screen' },
  { value: 'card', label: 'Card check screen' },
  { value: 'revision', label: 'Revision screen' },
  { value: 'group', label: 'Group node' }
];

function toString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeNodeType(value: unknown): StoryboardNodeType {
  if (value === 'text' || value === 'video' || value === 'card' || value === 'revision' || value === 'group') {
    return value;
  }
  return 'text';
}

function normalizeDependencyMode(value: unknown): StoryboardDependencyMode {
  return value === 'still_fulfilled' ? 'still_fulfilled' : 'fulfilled';
}

function createNodeId() {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createOutcomeId() {
  return `outcome-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultNode(index: number, nodeType: StoryboardNodeType = 'text'): StoryboardNodeRecord {
  return {
    nodeId: createNodeId(),
    title: `Step ${index}`,
    nodeType,
    description: '',
    text: '',
    videoUrl: '',
    cardPrompt: '',
    cardExpectedAnswer: '',
    revisionId: '',
    groupNodeIds: [],
    dependencies: [],
    outcomes: [],
    position: {
      x: 90 + ((index - 1) % 4) * 240,
      y: 80 + Math.floor((index - 1) / 4) * 170
    }
  };
}

function parseLegacyStoryboardScript(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!content || typeof content !== 'object') {
    return '';
  }
  const root = content as Record<string, unknown>;
  if (typeof root.script === 'string') {
    return root.script;
  }
  if (Array.isArray(root.steps)) {
    const lines = root.steps.map((item) => String(item ?? '').trim()).filter((item) => item.length > 0);
    return lines.join('\n\n');
  }
  if (typeof root.body === 'string') {
    return root.body;
  }
  return '';
}

function parseLegacyStoryboardSteps(content: unknown): string[] {
  const script = parseLegacyStoryboardScript(content);
  const normalized = script.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const chunks = normalized
    .split(/\n{2,}|\n---+\n/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return chunks.length > 0 ? chunks : [normalized];
}

function buildStepText(node: StoryboardNodeRecord): string {
  const title = node.title.trim() || node.nodeId;
  if (node.nodeType === 'text') {
    const body = node.text.trim() || node.description.trim();
    return body ? `${title}\n${body}` : title;
  }
  if (node.nodeType === 'video') {
    const detail = node.videoUrl.trim() || node.description.trim();
    return detail ? `${title}\nVideo: ${detail}` : `${title}\nVideo`;
  }
  if (node.nodeType === 'card') {
    const prompt = node.cardPrompt.trim() || node.description.trim();
    if (!prompt) return `${title}\nCard`;
    const expected = node.cardExpectedAnswer.trim();
    return expected ? `${title}\nCard: ${prompt}\nExpected: ${expected}` : `${title}\nCard: ${prompt}`;
  }
  if (node.nodeType === 'revision') {
    const revision = node.revisionId.trim();
    return revision ? `${title}\nRevision: ${revision}` : `${title}\nRevision`;
  }
  const members = node.groupNodeIds.length > 0 ? `Members: ${node.groupNodeIds.join(', ')}` : 'Group';
  return `${title}\n${members}`;
}

function normalizeStoryboardDocument(content: unknown): StoryboardGraphDocument {
  if (content && typeof content === 'object') {
    const root = content as Record<string, unknown>;
    if (root.schema === 'cogita_storyboard_graph' && Array.isArray(root.nodes)) {
      const rawNodes = root.nodes as Array<Record<string, unknown>>;
      const provisionalNodes = rawNodes.map((raw, index) => {
        const nodeId = toString(raw.nodeId).trim() || `node-${index + 1}`;
        const nodeType = normalizeNodeType(raw.nodeType);
        const rawPosition = (raw.position ?? {}) as Record<string, unknown>;
        const x = typeof rawPosition.x === 'number' && Number.isFinite(rawPosition.x) ? rawPosition.x : 90 + (index % 4) * 240;
        const y = typeof rawPosition.y === 'number' && Number.isFinite(rawPosition.y) ? rawPosition.y : 80 + Math.floor(index / 4) * 170;
        return {
          nodeId,
          title: toString(raw.title).trim() || `Step ${index + 1}`,
          nodeType,
          description: toString(raw.description),
          text: toString(raw.text),
          videoUrl: toString(raw.videoUrl),
          cardPrompt: toString(raw.cardPrompt),
          cardExpectedAnswer: toString(raw.cardExpectedAnswer),
          revisionId: toString(raw.revisionId),
          groupNodeIds: Array.isArray(raw.groupNodeIds) ? raw.groupNodeIds.map((item) => toString(item).trim()).filter(Boolean) : [],
          dependencies: Array.isArray(raw.dependencies)
            ? raw.dependencies.map((item) => {
                const dep = (item ?? {}) as Record<string, unknown>;
                return {
                  nodeId: toString(dep.nodeId).trim(),
                  mode: normalizeDependencyMode(dep.mode)
                };
              })
            : [],
          outcomes: Array.isArray(raw.outcomes)
            ? raw.outcomes.map((item) => {
                const outcome = (item ?? {}) as Record<string, unknown>;
                return {
                  outcomeId: toString(outcome.outcomeId).trim() || createOutcomeId(),
                  label: toString(outcome.label),
                  toNodeId: toString(outcome.toNodeId).trim() || undefined
                };
              })
            : [],
          position: { x, y }
        } satisfies StoryboardNodeRecord;
      });

      const nodeIdSet = new Set(provisionalNodes.map((node) => node.nodeId));
      const nodes = provisionalNodes.map((node) => ({
        ...node,
        groupNodeIds: node.groupNodeIds.filter((id) => id !== node.nodeId && nodeIdSet.has(id)),
        dependencies: node.dependencies
          .filter((dep) => dep.nodeId !== node.nodeId && nodeIdSet.has(dep.nodeId))
          .filter((dep, depIndex, source) => source.findIndex((item) => item.nodeId === dep.nodeId && item.mode === dep.mode) === depIndex),
        outcomes: node.outcomes
          .map((outcome) => ({ ...outcome, toNodeId: outcome.toNodeId && nodeIdSet.has(outcome.toNodeId) ? outcome.toNodeId : undefined }))
          .filter((outcome, outcomeIndex, source) => source.findIndex((item) => item.outcomeId === outcome.outcomeId) === outcomeIndex)
      }));

      const startNodeIdRaw = toString(root.startNodeId).trim();
      const startNodeId = startNodeIdRaw && nodeIdSet.has(startNodeIdRaw) ? startNodeIdRaw : nodes[0]?.nodeId;
      const steps = nodes.filter((node) => node.nodeType !== 'group').map(buildStepText).filter((entry) => entry.trim().length > 0);
      const script = toString(root.script).trim() || steps.join('\n\n---\n\n');

      return {
        schema: 'cogita_storyboard_graph',
        version: 1,
        startNodeId,
        script,
        steps,
        nodes
      };
    }
  }

  const steps = parseLegacyStoryboardSteps(content);
  if (steps.length === 0) {
    const first = createDefaultNode(1);
    return {
      schema: 'cogita_storyboard_graph',
      version: 1,
      startNodeId: first.nodeId,
      script: '',
      steps: [],
      nodes: [first]
    };
  }

  const nodes = steps.map((step, index) => {
    const node = createDefaultNode(index + 1, 'text');
    node.title = `Step ${index + 1}`;
    node.text = step;
    if (index > 0) {
      node.dependencies = [{ nodeId: `legacy-step-${index}`, mode: 'fulfilled' }];
    }
    return {
      ...node,
      nodeId: `legacy-step-${index + 1}`,
      position: {
        x: 90 + (index % 4) * 240,
        y: 80 + Math.floor(index / 4) * 170
      }
    };
  });

  for (let index = 0; index < nodes.length - 1; index += 1) {
    nodes[index].outcomes.push({
      outcomeId: createOutcomeId(),
      label: 'Next',
      toNodeId: nodes[index + 1].nodeId
    });
  }

  const script = steps.join('\n\n---\n\n');
  return {
    schema: 'cogita_storyboard_graph',
    version: 1,
    startNodeId: nodes[0]?.nodeId,
    script,
    steps,
    nodes
  };
}

function toStoryboardDocument(nodes: StoryboardNodeRecord[], currentStartNodeId?: string): StoryboardGraphDocument {
  const nodeIdSet = new Set(nodes.map((node) => node.nodeId));
  const normalizedNodes = nodes.map((node) => ({
    ...node,
    title: node.title.trim() || node.nodeId,
    description: node.description,
    text: node.text,
    videoUrl: node.videoUrl,
    cardPrompt: node.cardPrompt,
    cardExpectedAnswer: node.cardExpectedAnswer,
    revisionId: node.revisionId,
    dependencies: node.dependencies
      .filter((dep) => dep.nodeId && dep.nodeId !== node.nodeId && nodeIdSet.has(dep.nodeId))
      .filter((dep, depIndex, source) => source.findIndex((item) => item.nodeId === dep.nodeId && item.mode === dep.mode) === depIndex),
    outcomes: node.outcomes
      .map((outcome) => ({
        ...outcome,
        label: outcome.label,
        toNodeId: outcome.toNodeId && nodeIdSet.has(outcome.toNodeId) ? outcome.toNodeId : undefined
      }))
      .filter((outcome) => outcome.outcomeId),
    groupNodeIds: node.groupNodeIds.filter((memberId) => memberId !== node.nodeId && nodeIdSet.has(memberId))
  }));

  const stepNodes = normalizedNodes.filter((node) => node.nodeType !== 'group');
  const steps = stepNodes.map(buildStepText).filter((item) => item.trim().length > 0);
  const script = steps.join('\n\n---\n\n');
  const resolvedStart = currentStartNodeId && nodeIdSet.has(currentStartNodeId) ? currentStartNodeId : normalizedNodes[0]?.nodeId;

  return {
    schema: 'cogita_storyboard_graph',
    version: 1,
    startNodeId: resolvedStart,
    script,
    steps,
    nodes: normalizedNodes
  };
}

function getNodeBadge(nodeType: StoryboardNodeType) {
  if (nodeType === 'text') return 'TEXT';
  if (nodeType === 'video') return 'VIDEO';
  if (nodeType === 'card') return 'CARD';
  if (nodeType === 'revision') return 'REV';
  return 'GROUP';
}

function getNodeColor(nodeType: StoryboardNodeType) {
  if (nodeType === 'text') return 'rgba(125, 210, 255, 0.9)';
  if (nodeType === 'video') return 'rgba(130, 220, 170, 0.9)';
  if (nodeType === 'card') return 'rgba(252, 205, 117, 0.92)';
  if (nodeType === 'revision') return 'rgba(255, 168, 126, 0.95)';
  return 'rgba(213, 184, 255, 0.9)';
}

export function CogitaLibraryStoryboardsPage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  libraryId
}: {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  libraryId: string;
}) {
  const navigate = useNavigate();
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const [name, setName] = useState('');
  const [items, setItems] = useState<CogitaCreationProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [nodes, setNodes] = useState<StoryboardNodeRecord[]>([]);
  const [startNodeId, setStartNodeId] = useState<string | undefined>(undefined);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    getCogitaCreationProjects({ libraryId, projectType: 'storyboard' })
      .then((projects) => {
        if (cancelled) return;
        setItems(projects);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setLoadFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedProjectId('');
      setProjectName('');
      setNodes([]);
      setSelectedNodeId('');
      setStartNodeId(undefined);
      return;
    }
    setSelectedProjectId((current) => {
      if (current && items.some((item) => item.projectId === current)) return current;
      return items[0].projectId;
    });
  }, [items]);

  const selectedProject = useMemo(
    () => items.find((item) => item.projectId === selectedProjectId) ?? null,
    [items, selectedProjectId]
  );

  useEffect(() => {
    if (!selectedProject) {
      setProjectName('');
      setNodes([]);
      setSelectedNodeId('');
      setStartNodeId(undefined);
      return;
    }
    setProjectName(selectedProject.name);
    const normalized = normalizeStoryboardDocument(selectedProject.content);
    setNodes(normalized.nodes);
    setStartNodeId(normalized.startNodeId);
    setSelectedNodeId((current) => {
      if (current && normalized.nodes.some((node) => node.nodeId === current)) return current;
      return normalized.nodes[0]?.nodeId ?? '';
    });
  }, [selectedProject]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.nodeId === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const flowNodes = useMemo<Node[]>(
    () =>
      nodes.map((node) => {
        const isSelected = node.nodeId === selectedNodeId;
        const color = getNodeColor(node.nodeType);
        const dependencyLabel = node.dependencies.length > 0 ? `Deps ${node.dependencies.length}` : 'No deps';
        const outcomeLabel = node.outcomes.length > 0 ? `Paths ${node.outcomes.length}` : 'No paths';
        return {
          id: node.nodeId,
          position: node.position,
          draggable: true,
          selectable: true,
          data: {
            label: (
              <div className="cogita-storyboard-node-label">
                <div className="cogita-storyboard-node-badge" style={{ borderColor: color, color }}>
                  {getNodeBadge(node.nodeType)}
                </div>
                <strong>{node.title || node.nodeId}</strong>
                <small>{dependencyLabel} · {outcomeLabel}</small>
              </div>
            )
          },
          style: {
            borderRadius: 12,
            border: isSelected ? '2px solid rgba(171, 221, 255, 0.95)' : `1px solid ${color}`,
            background: isSelected ? 'rgba(20, 46, 71, 0.95)' : 'rgba(10, 29, 47, 0.88)',
            color: 'rgba(236, 245, 255, 0.95)',
            width: 210,
            boxShadow: isSelected ? '0 0 0 1px rgba(171, 221, 255, 0.35)' : 'none'
          }
        };
      }),
    [nodes, selectedNodeId]
  );

  const flowEdges = useMemo<Edge[]>(() => {
    const edges: Edge[] = [];
    const nodeIdSet = new Set(nodes.map((node) => node.nodeId));

    nodes.forEach((node) => {
      node.dependencies.forEach((dependency, index) => {
        if (!nodeIdSet.has(dependency.nodeId)) return;
        edges.push({
          id: `dep:${dependency.nodeId}:${node.nodeId}:${index}`,
          source: dependency.nodeId,
          target: node.nodeId,
          animated: false,
          label: dependency.mode === 'still_fulfilled' ? 'requires still fulfilled' : 'requires fulfilled',
          style: {
            stroke: dependency.mode === 'still_fulfilled' ? 'rgba(255, 210, 160, 0.9)' : 'rgba(162, 214, 255, 0.85)',
            strokeDasharray: dependency.mode === 'still_fulfilled' ? '6 4' : undefined
          },
          labelStyle: {
            fill: dependency.mode === 'still_fulfilled' ? 'rgba(255, 230, 196, 0.92)' : 'rgba(205, 232, 255, 0.9)',
            fontSize: 11
          }
        });
      });

      node.outcomes.forEach((outcome) => {
        if (!outcome.toNodeId || !nodeIdSet.has(outcome.toNodeId)) return;
        edges.push({
          id: `out:${node.nodeId}:${outcome.outcomeId}`,
          source: node.nodeId,
          target: outcome.toNodeId,
          animated: true,
          label: outcome.label.trim() || 'path',
          style: {
            stroke: 'rgba(161, 242, 184, 0.95)'
          },
          labelStyle: {
            fill: 'rgba(198, 250, 219, 0.95)',
            fontSize: 11
          }
        });
      });
    });

    return edges;
  }, [nodes]);

  const nodeOptions = useMemo(
    () => nodes.map((node) => ({ value: node.nodeId, label: node.title || node.nodeId })),
    [nodes]
  );

  const availableDependencyOptions = useMemo(
    () => nodeOptions.filter((option) => option.value !== selectedNodeId),
    [nodeOptions, selectedNodeId]
  );

  const availableGroupMembers = useMemo(
    () => nodes.filter((node) => node.nodeId !== selectedNodeId && node.nodeType !== 'group'),
    [nodes, selectedNodeId]
  );

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaveFailed(false);
    setSaving(true);
    setStatus(null);
    try {
      const firstNode = createDefaultNode(1, 'text');
      const content = toStoryboardDocument([firstNode], firstNode.nodeId);
      const created = await createCogitaCreationProject({
        libraryId,
        projectType: 'storyboard',
        name: trimmed,
        content
      });
      setItems((current) => [created, ...current]);
      setSelectedProjectId(created.projectId);
      setName('');
      setStatus('Storyboard project created.');
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const saveProject = async () => {
    if (!selectedProjectId || saving) return;
    setSaveFailed(false);
    setSaving(true);
    setStatus(null);
    try {
      const content = toStoryboardDocument(nodes, startNodeId);
      const updated = await updateCogitaCreationProject({
        libraryId,
        projectId: selectedProjectId,
        name: projectName.trim() || 'Storyboard draft',
        content
      });
      setItems((current) => current.map((item) => (item.projectId === updated.projectId ? updated : item)));
      setStatus('Storyboard graph saved.');
    } catch {
      setSaveFailed(true);
      setStatus('Failed to save storyboard graph.');
    } finally {
      setSaving(false);
    }
  };

  const addNode = (nodeType: StoryboardNodeType = 'text') => {
    const next = createDefaultNode(nodes.length + 1, nodeType);
    setNodes((current) => [...current, next]);
    if (!startNodeId) {
      setStartNodeId(next.nodeId);
    }
    setSelectedNodeId(next.nodeId);
  };

  const duplicateNode = () => {
    if (!selectedNode) return;
    const clone: StoryboardNodeRecord = {
      ...selectedNode,
      nodeId: createNodeId(),
      title: `${selectedNode.title} copy`,
      groupNodeIds: [...selectedNode.groupNodeIds],
      dependencies: [...selectedNode.dependencies],
      outcomes: selectedNode.outcomes.map((item) => ({ ...item, outcomeId: createOutcomeId() })),
      position: { x: selectedNode.position.x + 70, y: selectedNode.position.y + 70 }
    };
    setNodes((current) => [...current, clone]);
    setSelectedNodeId(clone.nodeId);
  };

  const removeNode = () => {
    if (!selectedNode) return;
    const removedNodeId = selectedNode.nodeId;
    const nextNodes = nodes
      .filter((node) => node.nodeId !== removedNodeId)
      .map((node) => ({
        ...node,
        dependencies: node.dependencies.filter((dep) => dep.nodeId !== removedNodeId),
        outcomes: node.outcomes.map((outcome) => ({
          ...outcome,
          toNodeId: outcome.toNodeId === removedNodeId ? undefined : outcome.toNodeId
        })),
        groupNodeIds: node.groupNodeIds.filter((memberId) => memberId !== removedNodeId)
      }));

    setNodes(nextNodes);
    setSelectedNodeId(nextNodes[0]?.nodeId ?? '');
    if (startNodeId === removedNodeId) {
      setStartNodeId(nextNodes[0]?.nodeId);
    }
  };

  const updateSelectedNode = (updater: (node: StoryboardNodeRecord) => StoryboardNodeRecord) => {
    if (!selectedNode) return;
    setNodes((current) => current.map((node) => (node.nodeId === selectedNode.nodeId ? updater(node) : node)));
  };

  const setNodePosition = (nodeId: string, position: { x: number; y: number }) => {
    setNodes((current) =>
      current.map((node) =>
        node.nodeId === nodeId
          ? {
              ...node,
              position: {
                x: Number.isFinite(position.x) ? position.x : node.position.x,
                y: Number.isFinite(position.y) ? position.y : node.position.y
              }
            }
          : node
      )
    );
  };

  return (
    <CogitaShell
      copy={copy}
      authLabel={authLabel}
      showProfileMenu={showProfileMenu}
      onProfileNavigate={onProfileNavigate}
      onToggleSecureMode={onToggleSecureMode}
      onLogout={onLogout}
      secureMode={secureMode}
      onNavigate={onNavigate}
      language={language}
      onLanguageChange={onLanguageChange}
    >
      <section className="cogita-library-dashboard cogita-storyboard-dashboard" data-mode="detail">
        <header className="cogita-library-dashboard-header">
          <div>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">
              Storyboard workspace graph. Top: branching story graph. Bottom: selected node editor.
            </p>
          </div>
          <div className="cogita-library-actions">
            <button
              type="button"
              className="cta ghost"
              onClick={() =>
                selectedProjectId
                  ? navigate(`/cogita/storyboard/${encodeURIComponent(libraryId)}/${encodeURIComponent(selectedProjectId)}`)
                  : navigate(`/cogita/storyboard/${encodeURIComponent(libraryId)}`)
              }
            >
              Open runtime mode
            </button>
            <button type="button" className="cta" onClick={() => void saveProject()} disabled={!selectedProjectId || saving}>
              {saving ? 'Saving...' : 'Save storyboard'}
            </button>
          </div>
        </header>

        <div className="cogita-storyboard-layout">
          <aside className="cogita-library-detail cogita-storyboard-sidebar">
            <div className="cogita-detail-header">
              <h3 className="cogita-detail-title">Storyboard projects</h3>
            </div>
            <div className="cogita-detail-body">
              <label className="cogita-field full">
                <span>{copy.cogita.library.modules.storyboardsNewLabel}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={copy.cogita.library.modules.storyboardsNewPlaceholder}
                />
              </label>
              <div className="cogita-form-actions">
                <button type="button" className="cta" onClick={handleCreate} disabled={saving}>
                  {copy.cogita.library.modules.storyboardsCreate}
                </button>
              </div>
              {loading ? <p>{copy.cogita.library.modules.loading}</p> : null}
              {!loading && loadFailed ? <p>{copy.cogita.library.modules.loadFailed}</p> : null}
              {!loading && !loadFailed && items.length === 0 ? <p>{copy.cogita.library.modules.storyboardsEmpty}</p> : null}
              {saveFailed ? <p className="cogita-form-error">{copy.cogita.library.modules.createFailed}</p> : null}
              {status ? <p className="cogita-help">{status}</p> : null}
              <div className="cogita-storyboard-project-list">
                {items.map((item) => (
                  <button
                    key={item.projectId}
                    type="button"
                    className={`ghost ${item.projectId === selectedProjectId ? 'active' : ''}`}
                    onClick={() => setSelectedProjectId(item.projectId)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="cogita-storyboard-main">
            <section className="cogita-library-detail cogita-storyboard-top-panel">
              <div className="cogita-detail-header">
                <h3 className="cogita-detail-title">Story graph</h3>
                <div className="cogita-card-actions">
                  <button type="button" className="ghost" onClick={() => addNode('text')} disabled={!selectedProjectId}>Add text node</button>
                  <button type="button" className="ghost" onClick={() => addNode('card')} disabled={!selectedProjectId}>Add card node</button>
                  <button type="button" className="ghost" onClick={() => addNode('group')} disabled={!selectedProjectId}>Add group node</button>
                </div>
              </div>
              <div className="cogita-detail-body">
                <label className="cogita-field full">
                  <span>Storyboard name</span>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Storyboard title"
                    disabled={!selectedProjectId}
                  />
                </label>
                <div className="cogita-storyboard-graph-canvas">
                  {selectedProjectId ? (
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges}
                      fitView
                      onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                      onNodeDragStop={(_, node) => setNodePosition(node.id, node.position)}
                    >
                      <MiniMap zoomable pannable />
                      <Background gap={18} size={1} />
                      <Controls />
                    </ReactFlow>
                  ) : (
                    <div className="cogita-storyboard-empty">Select or create a storyboard project.</div>
                  )}
                </div>
              </div>
            </section>

            <section className="cogita-library-detail cogita-storyboard-bottom-panel">
              <div className="cogita-detail-header">
                <h3 className="cogita-detail-title">Node editor</h3>
                <div className="cogita-card-actions">
                  <button type="button" className="ghost" onClick={duplicateNode} disabled={!selectedNode}>Duplicate node</button>
                  <button type="button" className="ghost" onClick={removeNode} disabled={!selectedNode}>Remove node</button>
                </div>
              </div>
              <div className="cogita-detail-body">
                {!selectedNode ? (
                  <p>Select a node in the graph to edit content, dependencies, and branching outcomes.</p>
                ) : (
                  <>
                    <div className="cogita-storyboard-form-grid">
                      <label className="cogita-field full">
                        <span>Node title</span>
                        <input
                          type="text"
                          value={selectedNode.title}
                          onChange={(event) => updateSelectedNode((node) => ({ ...node, title: event.target.value }))}
                        />
                      </label>

                      <label className="cogita-field">
                        <span>Node type</span>
                        <select
                          value={selectedNode.nodeType}
                          onChange={(event) =>
                            updateSelectedNode((node) => ({
                              ...node,
                              nodeType: normalizeNodeType(event.target.value)
                            }))
                          }
                        >
                          {NODE_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="cogita-field">
                        <span>Is start node</span>
                        <select
                          value={startNodeId === selectedNode.nodeId ? 'yes' : 'no'}
                          onChange={(event) => {
                            if (event.target.value === 'yes') {
                              setStartNodeId(selectedNode.nodeId);
                            } else if (startNodeId === selectedNode.nodeId) {
                              setStartNodeId(nodes.find((node) => node.nodeId !== selectedNode.nodeId)?.nodeId);
                            }
                          }}
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </label>

                      <label className="cogita-field full">
                        <span>Description</span>
                        <textarea
                          value={selectedNode.description}
                          onChange={(event) => updateSelectedNode((node) => ({ ...node, description: event.target.value }))}
                          rows={2}
                          placeholder="Short summary visible in authoring"
                        />
                      </label>

                      {selectedNode.nodeType === 'text' ? (
                        <label className="cogita-field full">
                          <span>Screen text</span>
                          <textarea
                            value={selectedNode.text}
                            onChange={(event) => updateSelectedNode((node) => ({ ...node, text: event.target.value }))}
                            rows={4}
                          />
                        </label>
                      ) : null}

                      {selectedNode.nodeType === 'video' ? (
                        <label className="cogita-field full">
                          <span>Video URL</span>
                          <input
                            type="text"
                            value={selectedNode.videoUrl}
                            onChange={(event) => updateSelectedNode((node) => ({ ...node, videoUrl: event.target.value }))}
                            placeholder="https://..."
                          />
                        </label>
                      ) : null}

                      {selectedNode.nodeType === 'card' ? (
                        <>
                          <label className="cogita-field full">
                            <span>Card prompt</span>
                            <textarea
                              value={selectedNode.cardPrompt}
                              onChange={(event) => updateSelectedNode((node) => ({ ...node, cardPrompt: event.target.value }))}
                              rows={3}
                            />
                          </label>
                          <label className="cogita-field full">
                            <span>Expected answer</span>
                            <input
                              type="text"
                              value={selectedNode.cardExpectedAnswer}
                              onChange={(event) => updateSelectedNode((node) => ({ ...node, cardExpectedAnswer: event.target.value }))}
                            />
                          </label>
                        </>
                      ) : null}

                      {selectedNode.nodeType === 'revision' ? (
                        <label className="cogita-field full">
                          <span>Revision ID</span>
                          <input
                            type="text"
                            value={selectedNode.revisionId}
                            onChange={(event) => updateSelectedNode((node) => ({ ...node, revisionId: event.target.value }))}
                            placeholder="revision-id"
                          />
                        </label>
                      ) : null}

                      {selectedNode.nodeType === 'group' ? (
                        <div className="cogita-field full">
                          <span>Group members</span>
                          <div className="cogita-storyboard-group-grid">
                            {availableGroupMembers.length === 0 ? <p>No nodes available for grouping.</p> : null}
                            {availableGroupMembers.map((node) => {
                              const checked = selectedNode.groupNodeIds.includes(node.nodeId);
                              return (
                                <label key={node.nodeId} className="cogita-storyboard-checkline">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) =>
                                      updateSelectedNode((current) => ({
                                        ...current,
                                        groupNodeIds: event.target.checked
                                          ? [...current.groupNodeIds, node.nodeId]
                                          : current.groupNodeIds.filter((memberId) => memberId !== node.nodeId)
                                      }))
                                    }
                                  />
                                  <span>{node.title || node.nodeId}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <section className="cogita-storyboard-editor-section">
                      <div className="cogita-storyboard-editor-section-head">
                        <h4>Dependencies</h4>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            updateSelectedNode((node) => ({
                              ...node,
                              dependencies:
                                availableDependencyOptions.length === 0
                                  ? node.dependencies
                                  : [
                                      ...node.dependencies,
                                      {
                                        nodeId: availableDependencyOptions[0].value,
                                        mode: 'fulfilled'
                                      }
                                    ]
                            }))
                          }
                          disabled={availableDependencyOptions.length === 0}
                        >
                          Add dependency
                        </button>
                      </div>
                      <p className="cogita-help">A node becomes available only when required nodes are fulfilled or still fulfilled.</p>
                      {selectedNode.dependencies.length === 0 ? <p>No dependencies. This node is immediately eligible.</p> : null}
                      {selectedNode.dependencies.map((dependency, index) => (
                        <div className="cogita-storyboard-inline-row" key={`${dependency.nodeId}:${dependency.mode}:${index}`}>
                          <select
                            value={dependency.nodeId}
                            onChange={(event) => {
                              const nextNodeId = event.target.value;
                              updateSelectedNode((node) => ({
                                ...node,
                                dependencies: node.dependencies.map((item, depIndex) =>
                                  depIndex === index
                                    ? {
                                        ...item,
                                        nodeId: nextNodeId
                                      }
                                    : item
                                )
                              }));
                            }}
                          >
                            {availableDependencyOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <select
                            value={dependency.mode}
                            onChange={(event) =>
                              updateSelectedNode((node) => ({
                                ...node,
                                dependencies: node.dependencies.map((item, depIndex) =>
                                  depIndex === index
                                    ? {
                                        ...item,
                                        mode: normalizeDependencyMode(event.target.value)
                                      }
                                    : item
                                )
                              }))
                            }
                          >
                            <option value="fulfilled">fulfilled once</option>
                            <option value="still_fulfilled">must still be fulfilled</option>
                          </select>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() =>
                              updateSelectedNode((node) => ({
                                ...node,
                                dependencies: node.dependencies.filter((_, depIndex) => depIndex !== index)
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </section>

                    <section className="cogita-storyboard-editor-section">
                      <div className="cogita-storyboard-editor-section-head">
                        <h4>Outcomes / branching paths</h4>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            updateSelectedNode((node) => ({
                              ...node,
                              outcomes: [
                                ...node.outcomes,
                                {
                                  outcomeId: createOutcomeId(),
                                  label: `Path ${node.outcomes.length + 1}`,
                                  toNodeId: undefined
                                }
                              ]
                            }))
                          }
                          disabled={availableDependencyOptions.length === 0}
                        >
                          Add outcome
                        </button>
                      </div>
                      {selectedNode.outcomes.length === 0 ? <p>No outcomes yet. Add outcomes for branching story paths.</p> : null}
                      {selectedNode.outcomes.map((outcome, index) => (
                        <div className="cogita-storyboard-inline-row" key={outcome.outcomeId}>
                          <input
                            type="text"
                            value={outcome.label}
                            onChange={(event) =>
                              updateSelectedNode((node) => ({
                                ...node,
                                outcomes: node.outcomes.map((item, outcomeIndex) =>
                                  outcomeIndex === index
                                    ? {
                                        ...item,
                                        label: event.target.value
                                      }
                                    : item
                                )
                              }))
                            }
                            placeholder="Outcome label"
                          />
                          <select
                            value={outcome.toNodeId ?? ''}
                            onChange={(event) =>
                              updateSelectedNode((node) => ({
                                ...node,
                                outcomes: node.outcomes.map((item, outcomeIndex) =>
                                  outcomeIndex === index
                                    ? {
                                        ...item,
                                        toNodeId: event.target.value || undefined
                                      }
                                    : item
                                )
                              }))
                            }
                          >
                            <option value="">No target</option>
                            {availableDependencyOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() =>
                              updateSelectedNode((node) => ({
                                ...node,
                                outcomes: node.outcomes.filter((_, outcomeIndex) => outcomeIndex !== index)
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </section>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
