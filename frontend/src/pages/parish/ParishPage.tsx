import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction, PointerEvent as ReactPointerEvent, ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../styles/parish.css';
import { AuthAction } from '../../components/AuthAction';
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
  type EdgeChange,
  type Node,
  type NodeChange
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../content/types';
import { getParishSacramentContent, sacramentPanelMenuCopy, type SacramentContentKey } from './content/parishSacraments';
import type { RouteKey } from '../../types/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent
} from '@dnd-kit/core';
import {
  createParishSite,
  createParishMass,
  createParishMassRule,
  updateParishMass,
  getParishPublicIntentions,
  getParishPublicMasses,
  getParishSite,
  listParishMassRules,
  listParishes,
  applyParishMassRule,
  createParishConfirmationCandidate,
  createParishConfirmationMeetingSlot,
  deleteParishConfirmationMeetingSlot,
  exportParishConfirmationCandidates,
  getParishConfirmationCandidatePortal,
  getParishConfirmationCandidatePortalAdmin,
  getParishConfirmationMeetingAvailability,
  importParishConfirmationCandidates,
  mergeParishConfirmationCandidates,
  releaseParishConfirmationMeetingHost,
  simulateParishMassRule,
  sendParishConfirmationAdminMessage,
  sendParishConfirmationCandidateMessage,
  bookParishConfirmationMeetingSlot,
  listParishConfirmationMeetingSlots,
  listParishConfirmationCandidates,
  addParishConfirmationNote,
  updateParishConfirmationNote,
  updateParishConfirmationCandidate,
  updateParishConfirmationCandidatePaperConsent,
  updateParishMassRule,
  updateParishSite,
  verifyParishConfirmationPhone,
  type ParishConfirmationCandidate,
  type ParishConfirmationMeetingAvailability,
  type ParishConfirmationPortal,
  type ParishConfirmationMeetingSummary,
  type ParishConfirmationExportCandidate,
  type ParishHomepageConfig,
  type ParishLayoutItem,
  type ParishMassRule,
  type ParishMassRuleNode,
  type ParishPublicIntention,
  type ParishPublicMass,
  type ParishSacramentSection,
  type ParishSummary
} from '../../lib/api';
import { normalizePolishPhone } from '../../lib/phone';

type ThemePreset = 'classic' | 'minimal' | 'warm';
type ModuleWidth = 'one-third' | 'one-half' | 'two-thirds' | 'full';
type ModuleHeight = 'one' | 'three' | 'five';
type MassNodeCategory = 'filter' | 'mass' | 'intention' | 'save' | 'stop';
type ValidationFinding = { level: 'error' | 'warning'; message: string };
type SacramentPanelSection = 'overall' | 'parish' | 'faq' | 'form' | 'meetings' | 'candidate';
type ConfirmationDuplicateGroup = {
  key: string;
  displayName: string;
  candidates: ParishConfirmationCandidate[];
};
type MassRuleNodeData = {
  label: string;
  type: string;
  config: Record<string, string>;
  requireIntentions?: boolean;
  emitConflicts?: number;
};

const normalizeEdgeHandle = (handle?: string | null) => handle ?? 'next';

const edgeSignature = (edge: Edge) =>
  `${edge.id}|${edge.source}|${edge.target}|${normalizeEdgeHandle(edge.sourceHandle)}`;

const normalizeFlowEdges = (edges: Edge[]) => {
  const byHandle = new Map<string, Edge>();
  edges.forEach((edge) => {
    const key = `${edge.source}:${normalizeEdgeHandle(edge.sourceHandle)}`;
    byHandle.set(key, {
      ...edge,
      sourceHandle: normalizeEdgeHandle(edge.sourceHandle)
    });
  });
  return Array.from(byHandle.values()).sort((a, b) => edgeSignature(a).localeCompare(edgeSignature(b)));
};

const MASS_NODE_COLORS = {
  filter: '#2563EB',
  mass: '#F59E0B',
  intention: '#7C3AED',
  save: '#16A34A',
  stop: '#6B7280',
  error: '#DC2626'
} as const;

const HOME_GAP = 16;
const EDITOR_GAP = 0;
const EDITOR_PADDING = 12;
const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;
type LayoutBreakpoint = (typeof BREAKPOINTS)[number];
const breakpointColumns: Record<LayoutBreakpoint, number> = {
  desktop: 6,
  tablet: 4,
  mobile: 2
};
const allowedColSpans = [2, 3, 4, 6];
const snapColSpan = (value: number, columns: number) => {
  const candidates = allowedColSpans.filter((span) => span <= columns);
  if (candidates.length === 0) return columns;
  return candidates.reduce((closest, current) =>
    Math.abs(current - value) < Math.abs(closest - value) ? current : closest
  );
};
const snapRowSpan = (value: number) => {
  if (value <= 2) return 1;
  if (value <= 4) return 3;
  return 5;
};
const widthToColSpan = (width: ModuleWidth, columns: number) => {
  const base =
    width === 'one-third' ? 2 : width === 'one-half' ? 3 : width === 'two-thirds' ? 4 : 6;
  return snapColSpan(base, columns);
};
const heightToRowSpan = (height: ModuleHeight) => (height === 'one' ? 1 : height === 'three' ? 3 : 5);
const MIN_COL_SPAN = 2;
const MIN_ROW_SPAN = 1;
const MAX_ROW_SPAN = 5;
type PageId =
  | 'start'
  | 'about'
  | 'clergy'
  | 'office'
  | 'announcements'
  | 'intentions'
  | 'masses'
  | 'calendar'
  | 'koleda'
  | 'sacrament-baptism'
  | 'sacrament-communion'
  | 'sacrament-confirmation'
  | 'sacrament-marriage'
  | 'sacrament-funeral'
  | 'sacrament-sick'
  | 'community-bible'
  | 'community-formation'
  | 'contact';

type ParishOption = {
  id: string;
  slug: string;
  name: string;
  location: string;
  logo: string;
  heroImage: string;
  theme: ThemePreset;
};

type MenuItem = {
  label: string;
  id?: PageId;
  children?: { id: PageId; label: string }[];
};

const parishModuleCatalog: { type: string; label: string; width: ModuleWidth; height: ModuleHeight }[] = [
  { type: 'intentions', label: 'Intencje', width: 'one-half', height: 'three' },
  { type: 'sticky', label: 'Sticky', width: 'one-third', height: 'one' },
  { type: 'hours', label: 'Godziny', width: 'one-third', height: 'one' },
  { type: 'news', label: 'News', width: 'one-half', height: 'three' },
  { type: 'announcements', label: 'Ogłoszenia', width: 'one-third', height: 'three' },
  { type: 'calendar', label: 'Kalendarz', width: 'two-thirds', height: 'five' },
  { type: 'masses', label: 'Msze', width: 'two-thirds', height: 'one' },
  { type: 'groups', label: 'Grupy', width: 'one-half', height: 'three' },
  { type: 'events', label: 'Wydarzenia', width: 'one-half', height: 'three' },
  { type: 'sacraments', label: 'Sakramenty', width: 'one-half', height: 'three' },
  { type: 'contact', label: 'Kontakt', width: 'one-third', height: 'one' },
  { type: 'gallery', label: 'Galeria', width: 'two-thirds', height: 'three' }
];

type MassRuleConfigField = {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
};

type MassRuleNodeDefinition = {
  type: string;
  label: string;
  description: string;
  input: string;
  output: string;
  config: Record<string, string>;
  fields: MassRuleConfigField[];
};

const massRuleNodeDefinitions: MassRuleNodeDefinition[] = [
  {
    type: 'Weekday',
    label: 'Dzien tygodnia',
    description: 'Warunek przejscia tylko dla wybranych dni tygodnia.',
    input: 'Data dnia',
    output: 'true -> next, false -> else',
    config: { days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday' },
    fields: [{ key: 'days', label: 'Dni', placeholder: 'monday,tuesday,...', hint: 'Lista po przecinku.' }]
  },
  {
    type: 'NthWeekdayOfMonth',
    label: 'N-ty dzien miesiaca',
    description: 'Sprawdza np. pierwsza niedziele miesiaca.',
    input: 'Data dnia',
    output: 'true -> next, false -> else',
    config: { weekday: 'Sunday', occurrences: '1,2,3,4' },
    fields: [
      { key: 'weekday', label: 'Dzien tygodnia', placeholder: 'Sunday' },
      { key: 'occurrences', label: 'Wystapienia', placeholder: '1,2,3,4', hint: 'Numery wystapien w miesiacu.' }
    ]
  },
  {
    type: 'LiturgicalSeason',
    label: 'Okres liturgiczny',
    description: 'Warunek dla okresu: ordinary, advent, lent, easter, christmas.',
    input: 'Data dnia',
    output: 'true -> next, false -> else',
    config: { season: 'ordinary' },
    fields: [{ key: 'season', label: 'Sezon', placeholder: 'ordinary' }]
  },
  {
    type: 'Holiday',
    label: 'Swieto',
    description: 'Warunek daty swieta obliczanego (np. christmas, easter).',
    input: 'Data dnia',
    output: 'true -> next, false -> else',
    config: { key: 'christmas' },
    fields: [{ key: 'key', label: 'Klucz swieta', placeholder: 'christmas' }]
  },
  {
    type: 'DaysAfterHoliday',
    label: 'Dni po swiecie',
    description: 'Warunek zakresu dni od wskazanego swieta.',
    input: 'Data dnia',
    output: 'true -> next, false -> else',
    config: { key: 'easter', min: '1', max: '7' },
    fields: [
      { key: 'key', label: 'Swieto bazowe', placeholder: 'easter' },
      { key: 'min', label: 'Od dnia', placeholder: '1' },
      { key: 'max', label: 'Do dnia', placeholder: '7' }
    ]
  },
  {
    type: 'If',
    label: 'If',
    description: 'Uniwersalny warunek porownania lewa-operator-prawa.',
    input: 'left, operator, right',
    output: 'true -> next, false -> else',
    config: { left: '$weekday', operator: 'eq', right: 'sunday' },
    fields: [
      { key: 'left', label: 'Lewa strona', placeholder: '$weekday' },
      { key: 'operator', label: 'Operator', placeholder: 'eq | neq | contains' },
      { key: 'right', label: 'Prawa strona', placeholder: 'sunday' }
    ]
  },
  {
    type: 'MassTemplate',
    label: 'Szablon mszy',
    description: 'Ustawia parametry mszy: godzina, miejsce, nazwa, rodzaj i informacje.',
    input: 'Biezacy szkic mszy',
    output: 'Szkic mszy zaktualizowany',
    config: {
      time: '18:00',
      churchName: 'Kosciol glowny',
      title: 'Msza swieta',
      durationMinutes: '60',
      kind: 'ferialna',
      isCollective: 'false',
      note: '',
      beforeService: '',
      afterService: '',
      donationSummary: ''
    },
    fields: [
      { key: 'time', label: 'Godzina', placeholder: '18:00' },
      { key: 'churchName', label: 'Miejsce', placeholder: 'Kosciol glowny' },
      { key: 'title', label: 'Nazwa', placeholder: 'Msza swieta' },
      { key: 'durationMinutes', label: 'Czas (min)', placeholder: '60' },
      { key: 'kind', label: 'Rodzaj', placeholder: 'ferialna' },
      { key: 'isCollective', label: 'Msza zbiorowa', placeholder: 'true/false' },
      { key: 'note', label: 'Informacja', placeholder: 'Opis dodatkowy' },
      { key: 'beforeService', label: 'Przed msza', placeholder: 'Rozaniec 17:30' },
      { key: 'afterService', label: 'Po mszy', placeholder: 'Nowenna' },
      { key: 'donationSummary', label: 'Ofiara (suma)', placeholder: '150 PLN' }
    ]
  },
  {
    type: 'AddIntention',
    label: 'Dodaj intencje',
    description: 'Dopisuje intencje do aktualnie budowanej mszy.',
    input: 'tekst intencji i opcjonalna ofiara',
    output: 'Lista intencji rozszerzona',
    config: { text: 'Intencja parafialna', donation: '50 PLN' },
    fields: [
      { key: 'text', label: 'Tresc intencji', placeholder: 'Za parafian' },
      { key: 'donation', label: 'Ofiara', placeholder: '50 PLN' }
    ]
  },
  {
    type: 'Emit',
    label: 'Zapisz msze',
    description: 'Tworzy wpis mszy dla danego dnia na podstawie obecnego szkicu.',
    input: 'Szkic mszy',
    output: 'Nowa msza w wyniku',
    config: {},
    fields: []
  },
  {
    type: 'Stop',
    label: 'Stop',
    description: 'Konczy przetwarzanie grafu dla danego dnia.',
    input: 'Brak',
    output: 'Brak',
    config: {},
    fields: []
  }
];

const massRuleDefinitionsByType: Record<string, MassRuleNodeDefinition> = Object.fromEntries(
  massRuleNodeDefinitions.map((definition) => [definition.type, definition])
);

const massRuleNodeTemplates: Array<{ type: string; label: string; config: Record<string, string> }> =
  massRuleNodeDefinitions.map((definition) => ({
    type: definition.type,
    label: definition.label,
    config: definition.config
  }));

const getMassNodeCategory = (nodeType: string): MassNodeCategory => {
  if (nodeType === 'MassTemplate') return 'mass';
  if (nodeType === 'AddIntention') return 'intention';
  if (nodeType === 'Emit') return 'save';
  if (nodeType === 'Stop') return 'stop';
  return 'filter';
};

const getMassNodeColor = (nodeType: string) => MASS_NODE_COLORS[getMassNodeCategory(nodeType)];

const isMassConditionType = (nodeType: string) =>
  nodeType === 'If' ||
  nodeType === 'Weekday' ||
  nodeType === 'NthWeekdayOfMonth' ||
  nodeType === 'LiturgicalSeason' ||
  nodeType === 'Holiday' ||
  nodeType === 'DaysAfterHoliday';

const parseIntentionLines = (raw: string | undefined) =>
  (raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const defaultMassRuleSeed: ParishMassRuleNode[] = [
  {
    id: 'node-1',
    type: 'Weekday',
    nextId: 'node-2',
    elseId: 'node-9',
    config: { days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday' }
  },
  {
    id: 'node-2',
    type: 'MassTemplate',
    nextId: 'node-3',
    elseId: null,
    config: {
      time: '18:00',
      churchName: 'Kościół główny',
      title: 'Msza święta',
      durationMinutes: '60',
      kind: 'ferialna',
      isCollective: 'false'
    }
  },
  {
    id: 'node-3',
    type: 'AddIntention',
    nextId: 'node-4',
    elseId: null,
    config: { text: 'Intencja parafialna', donation: '50 PLN' }
  },
  { id: 'node-4', type: 'Emit', nextId: 'node-9', elseId: null, config: {} },
  { id: 'node-9', type: 'Stop', nextId: null, elseId: null, config: {} }
];

const getMassNodePortTypes = (nodeType: string) => {
  const category = getMassNodeCategory(nodeType);
  if (category === 'filter') return { input: 'DataDnia', output: 'Boolean' };
  if (category === 'mass') return { input: 'SzkicMszy', output: 'SzkicMszy' };
  if (category === 'intention') return { input: 'SzkicMszy', output: 'Intencje[]' };
  if (category === 'save') return { input: 'SzkicMszy', output: 'MassRow' };
  return { input: 'Any', output: 'Stop' };
};

const parseMassNodePosition = (config?: Record<string, string> | null, fallbackIndex = 0) => {
  const x = config && Number.isFinite(Number(config._x)) ? Number(config._x) : 80 + (fallbackIndex % 3) * 260;
  const y = config && Number.isFinite(Number(config._y)) ? Number(config._y) : 60 + Math.floor(fallbackIndex / 3) * 180;
  return { x, y };
};

const MassRuleGraphNode = ({ data }: { data: MassRuleNodeData }) => {
  const isBranch = isMassConditionType(data.type);
  const definition = massRuleDefinitionsByType[data.type];
  const color = getMassNodeColor(data.type);
  const portTypes = getMassNodePortTypes(data.type);
  const time = (data.config?.time ?? '').trim();
  const church = (data.config?.churchName ?? '').trim();
  const kind = (data.config?.kind ?? '').trim();
  const hasMissingTime = data.type === 'MassTemplate' && !time;
  const intentionLines = data.type === 'AddIntention' ? parseIntentionLines(data.config?.text) : [];
  const donation = (data.config?.donation ?? '').trim();
  const missingIntentions =
    data.type === 'MassTemplate' && data.requireIntentions && intentionLines.length === 0;
  const showEmitConflict = data.type === 'Emit' && (data.emitConflicts ?? 0) > 0;
  return (
    <div
      className={`mass-rule-node ${hasMissingTime || showEmitConflict ? 'has-error' : ''}`}
      style={{ ['--mass-node-color' as const]: color } as CSSProperties}
    >
      <div className="mass-rule-node-top" />
      <Handle type="target" position={Position.Left} style={{ background: color }} />
      <span className="mass-port-label mass-port-label-in">IN · {portTypes.input}</span>
      <strong>{definition?.label ?? data.type}</strong>
      <span className="muted">{definition?.description ?? data.label}</span>
      <div className="mass-rule-node-io">
        <span>IN: {definition?.input ?? 'dane dnia'}</span>
        <span>OUT: {definition?.output ?? 'next'}</span>
      </div>
      {data.type === 'MassTemplate' ? (
        <div className="mass-node-chips">
          <span className={`mass-chip ${hasMissingTime ? 'is-error' : 'is-mass'}`}>
            {hasMissingTime ? '⏰ brak' : `⏰ ${time}`}
          </span>
          {church ? <span className="mass-chip is-outline">📍 {church}</span> : null}
          {kind ? <span className="mass-chip is-outline">🕯️ {kind}</span> : null}
          {missingIntentions ? <span className="mass-chip is-intention">✝ brak intencji</span> : null}
        </div>
      ) : null}
      {data.type === 'AddIntention' ? (
        <div className="mass-intention-mini">
          {intentionLines.slice(0, 2).map((line, index) => (
            <span key={`${line}-${index}`}>• {line}</span>
          ))}
          {intentionLines.length > 2 ? <span>+{intentionLines.length - 2} więcej</span> : null}
          {donation ? <span className="mass-chip is-donation">💠 {donation}</span> : null}
        </div>
      ) : null}
      {showEmitConflict ? <div className="mass-node-alert">⚠ Wykryto kolizje terminów</div> : null}
      <Handle
        id="next"
        type="source"
        position={Position.Right}
        style={{ background: isBranch ? MASS_NODE_COLORS.save : color }}
      />
      <span className="mass-port-label mass-port-label-next">
        {isBranch ? 'TRUE' : 'OUT'} · {portTypes.output}
      </span>
      {isBranch ? (
        <>
          <Handle id="else" type="source" position={Position.Bottom} style={{ background: MASS_NODE_COLORS.stop }} />
          <span className="mass-port-label mass-port-label-else">FALSE · Stop</span>
        </>
      ) : null}
    </div>
  );
};

const massRuleNodeTypes = { massRuleNode: MassRuleGraphNode };

const toFlowNodesFromRuleNodes = (ruleNodes: ParishMassRuleNode[]): Array<Node<MassRuleNodeData>> =>
  ruleNodes.map((node, index) => ({
    id: node.id,
    type: 'massRuleNode',
    position: parseMassNodePosition(node.config, index),
    data: {
      label: node.id,
      type: node.type,
      config: { ...(node.config ?? {}) }
    }
  }));

const toFlowEdgesFromRuleNodes = (ruleNodes: ParishMassRuleNode[]): Edge[] => {
  const edges: Edge[] = [];
  ruleNodes.forEach((node) => {
    if (node.nextId) {
      edges.push({
        id: `${node.id}:next:${node.nextId}`,
        source: node.id,
        target: node.nextId,
        sourceHandle: 'next'
      });
    }
    if (node.elseId) {
      edges.push({
        id: `${node.id}:else:${node.elseId}`,
        source: node.id,
        target: node.elseId,
        sourceHandle: 'else'
      });
    }
  });
  return edges.sort((a, b) => edgeSignature(a).localeCompare(edgeSignature(b)));
};

const decorateFlowEdges = (edges: Edge[], nodes: Array<Node<MassRuleNodeData>>) => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return edges.map((edge) => {
    const source = nodeById.get(edge.source);
    const branch = source ? isMassConditionType(source.data.type) : false;
    const handle = normalizeEdgeHandle(edge.sourceHandle);
    const isTrue = branch && handle === 'next';
    const isFalse = branch && handle === 'else';
    const color = isTrue
      ? MASS_NODE_COLORS.save
      : isFalse
        ? MASS_NODE_COLORS.stop
        : source
          ? getMassNodeColor(source.data.type)
          : MASS_NODE_COLORS.filter;
    return {
      ...edge,
      style: { stroke: color, strokeWidth: isTrue ? 2.2 : isFalse ? 1.2 : 1.8 },
      label: isTrue ? 'TRUE' : isFalse ? 'FALSE' : undefined,
      labelStyle: { fill: color, fontWeight: 700, fontSize: 11 }
    } as Edge;
  });
};

const autoLayoutMassFlow = (
  nodes: Array<Node<MassRuleNodeData>>,
  edges: Edge[],
  startNodeId: string
): Array<Node<MassRuleNodeData>> => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nextBySource = new Map<string, string[]>();
  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;
    const current = nextBySource.get(source) ?? [];
    current.push(target);
    nextBySource.set(source, current);
  });

  const depth = new Map<string, number>();
  const queue: string[] = [];
  if (byId.has(startNodeId)) {
    depth.set(startNodeId, 0);
    queue.push(startNodeId);
  } else {
    nodes.forEach((node) => {
      depth.set(node.id, 0);
      queue.push(node.id);
    });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const currentDepth = depth.get(current) ?? 0;
    const targets = nextBySource.get(current) ?? [];
    targets.forEach((target) => {
      const knownDepth = depth.get(target);
      const proposed = currentDepth + 1;
      if (knownDepth === undefined || proposed > knownDepth) {
        depth.set(target, proposed);
        queue.push(target);
      }
    });
  }

  const rowsByDepth = new Map<number, number>();
  const ordered = [...nodes].sort((a, b) => {
    const ad = depth.get(a.id) ?? 0;
    const bd = depth.get(b.id) ?? 0;
    if (ad !== bd) return ad - bd;
    return a.id.localeCompare(b.id);
  });

  return ordered.map((node) => {
    const d = depth.get(node.id) ?? 0;
    const row = rowsByDepth.get(d) ?? 0;
    rowsByDepth.set(d, row + 1);
    const x = 80 + d * 280;
    const y = 70 + row * 180;
    return {
      ...node,
      position: { x, y },
      data: {
        ...node.data,
        config: {
          ...(node.data.config ?? {}),
          _x: String(x),
          _y: String(y)
        }
      }
    };
  });
};

const toRuleNodesFromFlow = (
  flowNodes: Array<Node<MassRuleNodeData>>,
  flowEdges: Edge[]
): ParishMassRuleNode[] => {
  const sortedNodes = [...flowNodes].sort((a, b) => a.id.localeCompare(b.id));
  return sortedNodes.map((node) => {
    const nextEdge = flowEdges.find(
      (edge) => edge.source === node.id && normalizeEdgeHandle(edge.sourceHandle) === 'next'
    );
    const elseEdge = flowEdges.find(
      (edge) => edge.source === node.id && normalizeEdgeHandle(edge.sourceHandle) === 'else'
    );
    return {
      id: node.id,
      type: node.data.type,
      nextId: nextEdge?.target ?? null,
      elseId: elseEdge?.target ?? null,
      config: {
        ...(node.data.config ?? {}),
        _x: String(Math.round(node.position.x)),
        _y: String(Math.round(node.position.y))
      }
    };
  });
};

const getBreakpointKey = (columns: number): LayoutBreakpoint => {
  if (columns >= 6) return 'desktop';
  if (columns >= 4) return 'tablet';
  return 'mobile';
};

const getLayoutForBreakpoint = (item: ParishLayoutItem, breakpoint: LayoutBreakpoint) => {
  if (item.layouts && item.layouts[breakpoint]) {
    return item.layouts[breakpoint]!;
  }
  if (item.position && item.size) {
    return { position: item.position, size: item.size };
  }
  const fallback = item.layouts ? Object.values(item.layouts)[0] : undefined;
  return (
    fallback ?? {
      position: { row: 1, col: 1 },
      size: { colSpan: 2, rowSpan: 1 }
    }
  );
};

const ensureLayouts = (item: ParishLayoutItem): ParishLayoutItem => {
  const layouts: Partial<Record<LayoutBreakpoint, { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } }>> =
    item.layouts ? { ...item.layouts } : {};
  const fallback = getLayoutForBreakpoint(item, 'desktop');
  BREAKPOINTS.forEach((breakpoint) => {
    if (!layouts[breakpoint]) {
      layouts[breakpoint] = fallback;
    }
  });
  return {
    ...item,
    layouts,
    position: fallback.position,
    size: fallback.size
  };
};

const placeFrames = (
  frames: { id: string; position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } }[],
  columns: number
) => {
  const occupied = new Map<string, boolean>();
  const next: typeof frames = [];
  frames.forEach((frame) => {
    let startRow = Math.max(1, frame.position.row);
    let startCol = Math.max(1, Math.min(frame.position.col, columns));
    const colSpan = snapColSpan(frame.size.colSpan, columns);
    const rowSpan = snapRowSpan(frame.size.rowSpan);
    let placed = false;
    let row = startRow;
    let col = startCol;
    while (!placed) {
      if (col + colSpan - 1 > columns) {
        col = 1;
        row += 1;
      }
      let overlap = false;
      for (let r = row; r < row + rowSpan; r += 1) {
        for (let c = col; c < col + colSpan; c += 1) {
          if (occupied.get(`${r}:${c}`)) overlap = true;
        }
      }
      if (!overlap) {
        for (let r = row; r < row + rowSpan; r += 1) {
          for (let c = col; c < col + colSpan; c += 1) {
            occupied.set(`${r}:${c}`, true);
          }
        }
        next.push({
          ...frame,
          position: { row, col },
          size: { colSpan, rowSpan }
        });
        placed = true;
      } else {
        col += 1;
      }
    }
  });
  return next;
};

const normalizeLayoutsForBreakpoint = (
  items: ParishLayoutItem[],
  breakpoint: LayoutBreakpoint,
  columns: number
) => {
  const frames = items.map((item) => {
    const layout = getLayoutForBreakpoint(item, breakpoint);
    return {
      id: item.id,
      position: {
        row: Math.max(1, layout.position.row),
        col: Math.max(1, Math.min(layout.position.col, columns))
      },
      size: {
        colSpan: snapColSpan(layout.size.colSpan, columns),
        rowSpan: snapRowSpan(layout.size.rowSpan)
      }
    };
  });
  const placed = placeFrames(frames, columns);
  const placedMap = new Map(placed.map((frame) => [frame.id, frame]));
  return items.map((item) => {
    const nextFrame = placedMap.get(item.id)!;
    const layouts = { ...ensureLayouts(item).layouts } as Record<
      LayoutBreakpoint,
      { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } }
    >;
    layouts[breakpoint] = { position: nextFrame.position, size: nextFrame.size };
    return {
      ...item,
      layouts,
      position: layouts.desktop.position,
      size: layouts.desktop.size
    };
  });
};

const normalizeLayoutsAll = (items: ParishLayoutItem[]) => {
  let next = items.map(ensureLayouts);
  BREAKPOINTS.forEach((breakpoint) => {
    const columns = breakpointColumns[breakpoint];
    next = normalizeLayoutsForBreakpoint(next, breakpoint, columns);
  });
  return next;
};

const defaultHomepageConfig: ParishHomepageConfig = {
  modules: normalizeLayoutsAll(
    parishModuleCatalog.slice(0, 4).map((module) => {
      const layouts = BREAKPOINTS.reduce((acc, breakpoint) => {
        const columns = breakpointColumns[breakpoint];
        acc[breakpoint] = {
          position: { row: 1, col: 1 },
          size: {
            colSpan: widthToColSpan(module.width, columns),
            rowSpan: snapRowSpan(heightToRowSpan(module.height))
          }
        };
        return acc;
      }, {} as Record<LayoutBreakpoint, { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } }>);
      return {
        id: `seed-${module.type}`,
        type: module.type,
        layouts,
        position: layouts.desktop.position,
        size: layouts.desktop.size,
        props: { title: module.label }
      };
    })
  )
};

const menu: MenuItem[] = [
  { label: 'Start', id: 'start' },
  {
    label: 'Parafia',
    children: [
      { id: 'about', label: 'O parafii' },
      { id: 'clergy', label: 'Duszpasterze' },
      { id: 'office', label: 'Kancelaria' }
    ]
  },
  {
    label: 'Aktualne',
    children: [
      { id: 'announcements', label: 'Ogłoszenia' },
      { id: 'intentions', label: 'Intencje' },
      { id: 'masses', label: 'Msze i nabożeństwa' },
      { id: 'calendar', label: 'Kalendarz' },
      { id: 'koleda', label: 'Kolęda' }
    ]
  },
  {
    label: 'Sakramenty',
    children: [
      { id: 'sacrament-baptism', label: 'Chrzest' },
      { id: 'sacrament-communion', label: 'I Komunia' },
      { id: 'sacrament-marriage', label: 'Małżeństwo' },
      { id: 'sacrament-funeral', label: 'Pogrzeb' },
      { id: 'sacrament-sick', label: 'Chorzy' }
    ]
  },
  { label: 'Bierzmowanie', id: 'sacrament-confirmation' },
  {
    label: 'Wspólnoty',
    children: [
      { id: 'community-bible', label: 'Krąg biblijny' },
      { id: 'community-formation', label: 'Diakonia formacji' }
    ]
  },
  { label: 'Kontakt', id: 'contact' }
];

const announcements = [
  {
    id: 'ann-1',
    title: 'Niedziela Miłosierdzia',
    date: '12 kwietnia 2025',
    excerpt: 'Zapraszamy na Koronkę do Miłosierdzia Bożego o 15:00.',
    content:
      'Zapraszamy parafian i gości do wspólnej modlitwy. Koronka o 15:00 w kościele głównym, po niej krótka adoracja. Przynieście ze sobą intencje wdzięczności.'
  },
  {
    id: 'ann-2',
    title: 'Rekolekcje wielkopostne',
    date: '9 kwietnia 2025',
    excerpt: 'Konferencje w piątek, sobotę i niedzielę.',
    content:
      'Rekolekcje poprowadzi ks. Adam Kowalski. Szczegóły w gablocie i na stronie. Spowiedź dodatkowa w sobotę od 16:00.'
  },
  {
    id: 'ann-3',
    title: 'Wsparcie dla Caritas',
    date: '6 kwietnia 2025',
    excerpt: 'Zbiórka żywności w kruchcie kościoła.',
    content:
      'W najbliższą niedzielę prowadzimy zbiórkę żywności długoterminowej. Dary można składać w wyznaczonych koszach od 7:00 do 13:00.'
  }
];

const intentionsWeek = [
  {
    day: 'Poniedziałek • 11 marca',
    items: [
      { time: '7:00', text: 'Za + Janinę i Stanisława Nowak', location: 'Kościół', priest: 'ks. Marek' },
      { time: '18:00', text: 'O zdrowie dla Katarzyny i Łukasza', location: 'Kościół', priest: 'ks. Adam' }
    ]
  },
  {
    day: 'Wtorek • 12 marca',
    items: [
      { time: '7:00', text: 'Dziękczynna za rodzinę Malinowskich', location: 'Kaplica', priest: 'ks. Marek' },
      { time: '18:00', text: 'Za + Helenę i Józefa', location: 'Kościół', priest: 'ks. Paweł' }
    ]
  },
  {
    day: 'Środa • 13 marca',
    items: [
      { time: '7:00', text: 'O pokój w rodzinie', location: 'Kościół', priest: 'ks. Adam' },
      { time: '18:00', text: 'Za + Alicję i Piotra', location: 'Kościół', priest: 'ks. Marek' }
    ]
  }
];

const massesTables = {
  Sunday: [
    { time: '7:00', place: 'Kościół główny', note: 'Cicha' },
    { time: '9:00', place: 'Kościół główny', note: 'Rodzinna' },
    { time: '11:00', place: 'Kościół główny', note: 'Suma' },
    { time: '18:00', place: 'Kościół główny', note: 'Młodzieżowa' }
  ],
  Weekdays: [
    { time: '7:00', place: 'Kaplica', note: 'Pon–Pt' },
    { time: '18:00', place: 'Kościół główny', note: 'Pon–Sb' }
  ],
  Devotions: [
    { time: 'Śr. 19:00', place: 'Kościół', note: 'Nowenna' },
    { time: 'Pt. 17:15', place: 'Kościół', note: 'Droga Krzyżowa' }
  ],
  Confession: [
    { time: 'Wt.–Sb. 17:15', place: 'Konfesjonały', note: 'Stała' },
    { time: 'Nd. 8:30', place: 'Konfesjonały', note: 'Przed Mszą' }
  ]
};

const exceptions = [
  { date: '19 marca (śr.)', detail: 'Msza o 18:00 przeniesiona do kaplicy' },
  { date: '25 marca (wt.)', detail: 'Dodatkowa Msza o 20:00 (rekolekcje)' },
  { date: '31 marca (pon.)', detail: 'Brak Mszy o 7:00 — zastępstwo' }
];

const calendarEvents = [
  {
    id: 'evt-1',
    title: 'Katecheza dla narzeczonych',
    date: '16 marca 2025',
    time: '19:00',
    place: 'Sala Jana Pawła II',
    priest: 'ks. Adam',
    category: 'Formacja',
    recurring: true,
    description: 'Spotkanie przygotowujące do sakramentu małżeństwa.'
  },
  {
    id: 'evt-2',
    title: 'Chór parafialny',
    date: '14 marca 2025',
    time: '18:30',
    place: 'Sala muzyczna',
    priest: 'ks. Marek',
    category: 'Muzyka',
    recurring: true,
    description: 'Próba chóru przed uroczystością parafialną.'
  },
  {
    id: 'evt-3',
    title: 'Spotkanie seniorów',
    date: '15 marca 2025',
    time: '10:00',
    place: 'Sala parafialna',
    priest: 'ks. Paweł',
    category: 'Wspólnota',
    recurring: false,
    description: 'Rozmowa i herbata dla seniorów, tematyka: wspomnienia z pielgrzymek.'
  }
];

const buildCalendarMock = () => {
  const now = new Date();
  const base = new Date(now);
  base.setMinutes(0, 0, 0);
  const make = (
    offsetHours: number,
    title: string,
    kind: 'mass' | 'celebration' | 'group',
    place: string,
    group?: string
  ) => {
    const start = new Date(base);
    start.setHours(base.getHours() + offsetHours);
    return {
      id: `${kind}-${offsetHours}-${title}`,
      start,
      title,
      kind,
      place,
      group
    };
  };
  return [
    make(1, 'Msza poranna', 'mass', 'Kościół główny'),
    make(2, 'Różaniec', 'celebration', 'Kaplica'),
    make(4, 'Spotkanie ministrantów', 'group', 'Sala św. Józefa', 'Ministranci'),
    make(6, 'Msza wieczorna', 'mass', 'Kościół główny'),
    make(10, 'Schola dziecięca', 'group', 'Sala muzyczna', 'Schola'),
    make(14, 'Nowenna', 'celebration', 'Kościół główny'),
    make(18, 'Msza wspólnotowa', 'mass', 'Kościół dolny'),
    make(24, 'Spotkanie seniorów', 'group', 'Sala Jana Pawła II', 'Seniorzy'),
    make(26, 'Nabożeństwo', 'celebration', 'Kaplica'),
    make(30, 'Msza poranna', 'mass', 'Kościół główny'),
    make(34, 'Spotkanie młodych', 'group', 'Kawiarenka', 'Młodzi')
  ];
};

const priests = [
  {
    id: 'pr-1',
    name: 'ks. Adam Kowalski',
    role: 'Proboszcz',
    img: '/parish/minister.jpg',
    bio: 'Duszpasterz rodzin, prowadzi katechezy dla narzeczonych.',
    contact: 'Pon.–Pt. 10:00–12:00'
  },
  {
    id: 'pr-2',
    name: 'ks. Marek Nowak',
    role: 'Wikariusz',
    img: '/parish/visit.jpg',
    bio: 'Opiekun ministrantów i chóru.',
    contact: 'Wt., Czw. 16:00–18:00'
  },
  {
    id: 'pr-3',
    name: 'ks. Paweł Zieliński',
    role: 'Rezydent',
    img: '/parish/pursuit_saint.jpg',
    bio: 'Duszpasterz chorych i seniorów.',
    contact: 'Pon. 12:00–14:00'
  }
];

const sacraments = [
  {
    id: 'baptism',
    title: 'Chrzest',
    img: '/parish/baptism.jpg',
    steps: ['Zgłoszenie w kancelarii', 'Katecheza rodziców', 'Ustalenie terminu', 'Liturgia chrztu'],
    docs: ['Akt urodzenia dziecka', 'Dane rodziców chrzestnych', 'Zgoda parafii chrzestnych']
  },
  {
    id: 'communion',
    title: 'Pierwsza Komunia',
    img: '/parish/communion.jpg',
    steps: ['Spotkania formacyjne', 'Spowiedź dzieci', 'Próby liturgiczne', 'Uroczysta Msza'],
    docs: ['Metryka chrztu', 'Zgoda szkoły', 'Karta zgłoszeniowa']
  },
  {
    id: 'confirmation',
    title: 'Bierzmowanie',
    img: '/parish/confirmation.jpg',
    steps: ['Zgłoszenie', 'Przygotowanie roczne', 'Próba generalna', 'Sakrament'],
    docs: ['Metryka chrztu', 'Świadectwo religii', 'Zgoda rodziców']
  },
  {
    id: 'marriage',
    title: 'Małżeństwo',
    img: '/parish/visit.jpg',
    steps: ['Rozmowa w kancelarii', 'Kurs przedmałżeński', 'Spisanie protokołu', 'Ślub'],
    docs: ['Akt chrztu', 'Dowody osobiste', 'Zaświadczenie z USC']
  },
  {
    id: 'funeral',
    title: 'Pogrzeb',
    img: '/parish/obit.jpg',
    steps: ['Kontakt z kancelarią', 'Ustalenie daty', 'Modlitwa różańcowa', 'Msza pogrzebowa'],
    docs: ['Akt zgonu', 'Dokumenty z USC', 'Dane osoby zmarłej']
  },
  {
    id: 'sick',
    title: 'Namaszczenie chorych',
    img: '/parish/unction.jpg',
    steps: ['Telefon do kancelarii', 'Ustalenie wizyty', 'Przygotowanie domu', 'Sakrament'],
    docs: ['Dane chorego', 'Kontakt do rodziny', 'Informacja o stanie zdrowia']
  }
];

const sacramentDescriptions: Record<string, string> = {
  baptism: 'Wprowadzenie dziecka do wspólnoty Kościoła wraz z błogosławieństwem rodziny.',
  communion: 'Uroczyste spotkanie dzieci z Eucharystią, przygotowanie trwa cały rok formacyjny.',
  confirmation: 'Sakrament dojrzałości chrześcijańskiej, przyjmowany w parafii wiosną.',
  marriage: 'Towarzyszymy narzeczonym od pierwszej rozmowy aż po dzień ślubu.',
  funeral: 'Pomagamy rodzinie w modlitwie i przygotowaniu liturgii pogrzebowej.',
  sick: 'Odwiedzamy chorych w domach i szpitalach, z posługą sakramentalną.'
};

const sacramentFaq: Record<string, Array<{ question: string; answer: string }>> = {
  baptism: [
    { question: 'Kiedy zgłosić chrzest?', answer: 'Najlepiej minimum 2 tygodnie przed planowanym terminem.' },
    { question: 'Czy potrzebna jest metryka chrztu rodziców chrzestnych?', answer: 'Tak, jeśli pochodzą z innej parafii.' }
  ],
  communion: [
    { question: 'Jak długo trwa przygotowanie?', answer: 'Przygotowanie obejmuje pełny rok formacyjny.' },
    { question: 'Czy są obowiązkowe próby liturgiczne?', answer: 'Tak, przed uroczystością odbywają się próby.' }
  ],
  confirmation: [
    { question: 'Czy można wysłać zgłoszenie online?', answer: 'Tak, przez formularz w zakładce „Formularz kandydata”.' },
    { question: 'Czy numer telefonu trzeba potwierdzić?', answer: 'Tak, parafia wysyła link SMS do potwierdzenia numeru.' }
  ],
  marriage: [
    { question: 'Ile wcześniej zgłosić ślub?', answer: 'Rekomendujemy minimum 3 miesiące przed datą ślubu.' },
    { question: 'Czy kurs przedmałżeński jest wymagany?', answer: 'Tak, jest wymagany przed spisaniem protokołu.' }
  ],
  funeral: [
    { question: 'Jakie dokumenty są potrzebne?', answer: 'Akt zgonu i podstawowe dane osoby zmarłej.' },
    { question: 'Czy można ustalić intencję Mszy pogrzebowej?', answer: 'Tak, w kancelarii podczas ustalania terminu.' }
  ],
  sick: [
    { question: 'Jak zgłosić chorego?', answer: 'Telefonicznie przez kancelarię lub numer alarmowy parafii.' },
    { question: 'Czy sakrament jest udzielany w domu?', answer: 'Tak, po wcześniejszym ustaleniu wizyty duszpasterskiej.' }
  ]
};

const confirmationSectionPath: Record<SacramentPanelSection, string> = {
  overall: 'overall',
  parish: 'parish-info',
  faq: 'faq',
  form: 'form',
  meetings: 'meetings',
  candidate: 'candidate'
};

const confirmationParentConsentDraft = [
  'Ja, niżej podpisany / niżej podpisana, jako rodzic / opiekun prawny kandydata do sakramentu bierzmowania, oświadczam, że wyrażam zgodę na udział mojego dziecka w spotkaniach przygotowujących do przyjęcia sakramentu bierzmowania przy Parafii Rzymskokatolickiej pw. św. Jana Chrzciciela w Krakowie, ul. Dobrego Pasterza 117, 31-416 Kraków, prowadzonych przez ks. Michała Mleczka.',
  'Oświadczam również, że przyjmuję do wiadomości zasady związane z parafialnym przygotowaniem do bierzmowania oraz zobowiązuję się do współpracy z osobami prowadzącymi przygotowanie mojego dziecka.',
  'Jednocześnie wyrażam zgodę na samodzielny powrót mojego dziecka do domu po zakończeniu spotkań przygotowujących do sakramentu bierzmowania i biorę za ten powrót pełną odpowiedzialność.'
];

const confirmationRodoClauseDraft = {
  intro:
    'Zgodnie z art. 13 ust. 1 i 2 RODO oraz art. 8 ust. 1 Dekretu ogólnego Konferencji Episkopatu Polski w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych w Kościele katolickim informujemy, że:',
  admin:
    'Administratorem danych osobowych jest Parafia Rzymskokatolicka pw. św. Jana Chrzciciela w Krakowie, ul. Dobrego Pasterza 117, 31-416 Kraków, e-mail: parafia@janchrzciciel.eu.',
  iod: 'Kontakt z Inspektorem Ochrony Danych jest możliwy pod adresem e-mail: diod@diecezja.krakow.pl.',
  purposesLead: 'Dane osobowe rodzica / opiekuna prawnego oraz dziecka są przetwarzane w celu:',
  purposes: [
    'organizacji i prowadzenia przygotowania do sakramentu bierzmowania,',
    'kontaktu w sprawach związanych z przygotowaniem,',
    'prowadzenia dokumentacji parafialnej związanej z przygotowaniem do sakramentu bierzmowania,',
    'realizacji obowiązków wynikających z przepisów prawa kościelnego i powszechnie obowiązującego.'
  ],
  recipients:
    'Odbiorcami danych mogą być wyłącznie podmioty uprawnione do ich otrzymania na podstawie przepisów prawa, podmioty współpracujące z administratorem na podstawie stosownych upoważnień oraz właściwe podmioty kościelne w zakresie niezbędnym do realizacji celu przetwarzania.',
  retention:
    'Dane osobowe będą przechowywane przez okres niezbędny do realizacji celu, dla którego zostały zebrane, a następnie przez okres wynikający z przepisów prawa kościelnego i powszechnie obowiązującego.',
  rights:
    'Przysługuje Pani / Panu prawo dostępu do danych osobowych, ich sprostowania, ograniczenia przetwarzania, a w przypadkach przewidzianych przepisami także żądania usunięcia danych.',
  supervision:
    'W przypadku danych osobowych związanych z działalnością kanoniczną Kościoła katolickiego właściwym organem nadzoru jest Kościelny Inspektor Ochrony Danych, Skwer kard. Stefana Wyszyńskiego 6, 01-015 Warszawa, e-mail: kiod@episkopat.pl. W przypadku danych związanych z pozostałą działalnością właściwym organem nadzorczym jest Prezes Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa.',
  automation: 'Dane osobowe nie będą przetwarzane w sposób zautomatyzowany, w tym również w formie profilowania.',
  required:
    'Podanie danych jest dobrowolne, ale niezbędne do udziału dziecka w parafialnym przygotowaniu do sakramentu bierzmowania.',
  acknowledgment: 'Oświadczam, że zapoznałem / zapoznałam się z treścią powyższej klauzuli informacyjnej.'
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseConfirmationSection = (value?: string | null): SacramentPanelSection => {
  if (value === 'parish-info') return 'parish';
  if (value === 'faq') return 'faq';
  if (value === 'form') return 'form';
  if (value === 'meetings') return 'meetings';
  if (value === 'candidate') return 'candidate';
  return 'overall';
};

const isKnownConfirmationSectionPath = (value?: string | null): boolean =>
  value === 'overall' ||
  value === 'parish-info' ||
  value === 'faq' ||
  value === 'form' ||
  value === 'meetings' ||
  value === 'candidate';

const sacramentPageMap: Record<PageId, string> = {
  'sacrament-baptism': 'baptism',
  'sacrament-communion': 'communion',
  'sacrament-confirmation': 'confirmation',
  'sacrament-marriage': 'marriage',
  'sacrament-funeral': 'funeral',
  'sacrament-sick': 'sick',
  start: '',
  about: '',
  clergy: '',
  office: '',
  announcements: '',
  intentions: '',
  masses: '',
  calendar: '',
  koleda: '',
  'community-bible': '',
  'community-formation': '',
  contact: ''
};

const communityPages: Record<
  'community-bible' | 'community-formation',
  {
    title: string;
    image: string;
    lead: string;
    cadence: string;
    location: string;
    leader: string;
    roles: string[];
    plan: string[];
  }
> = {
  'community-bible': {
    title: 'Krąg biblijny',
    image: '/parish/bible_circle.jpg',
    lead: 'Spotkania z Pismem Świętym, dzielenie się i wspólna modlitwa.',
    cadence: 'Co dwa tygodnie, środa 19:00',
    location: 'Biblioteka parafialna',
    leader: 'ks. Paweł Zieliński',
    roles: ['prowadzący', 'uczestnik'],
    plan: ['Modlitwa wstępna', 'Lectio divina', 'Dzielenie w grupach', 'Zakończenie']
  },
  'community-formation': {
    title: 'Diakonia formacji',
    image: '/parish/choir.jpg',
    lead: 'Zespół odpowiedzialny za formację wspólnot i przygotowanie spotkań.',
    cadence: 'Co tydzień, wtorek 18:30',
    location: 'Sala Jana Pawła II',
    leader: 'Anna Nowak',
    roles: ['koordynator', 'mentor', 'wolontariusz'],
    plan: ['Przygotowanie materiałów', 'Konsultacje z duszpasterzem', 'Warsztaty', 'Podsumowanie']
  }
};

const koledaByDate = [
  {
    date: '7 stycznia',
    window: '16:00–20:00',
    area: 'Os. Zielone 12–24',
    priest: 'ks. Marek'
  },
  {
    date: '8 stycznia',
    window: '16:00–20:00',
    area: 'ul. Dobrego Pasterza 1–15',
    priest: 'ks. Adam'
  },
  {
    date: '9 stycznia',
    window: '16:00–20:00',
    area: 'Os. Cegielniana 5–18',
    priest: 'ks. Paweł'
  }
];

const koledaByArea = [
  { area: 'Os. Zielone', streets: 'Bloki 1–30', date: '7–10 stycznia', priest: 'ks. Marek' },
  { area: 'ul. Dobrego Pasterza', streets: '1–45', date: '8–12 stycznia', priest: 'ks. Adam' },
  { area: 'Os. Cegielniana', streets: '1–22', date: '9–11 stycznia', priest: 'ks. Paweł' }
];

const stickyItems = [
  {
    id: 'sticky-1',
    title: 'Misje parafialne',
    summary: 'Spotkania z rekolekcjonistami od poniedziałku do soboty.',
    image: '/parish/minister.jpg',
    date: '4–10 marca',
    category: 'Aktualne',
    href: '/#/parish/aktualnosci/misje'
  },
  {
    id: 'sticky-2',
    title: 'Wieczór uwielbienia',
    summary: 'Wspólna modlitwa i muzyka w kościele dolnym.',
    image: '/parish/visit.jpg',
    date: '14 marca, 19:00',
    category: 'Wydarzenia',
    href: '/#/parish/wydarzenia/uwielbienie'
  },
  {
    id: 'sticky-3',
    title: 'Spotkanie młodych',
    summary: 'Zapisy na wyjazd do Lednicy oraz dyżury w marcu.',
    image: '/parish/pursuit_saint.jpg',
    date: 'Sobota, 17:30',
    category: 'Wspólnoty',
    href: '/#/parish/wspolnoty/mlodzi'
  }
];

const intentionsDayMock = [
  { time: '7:00', text: 'Za + Janinę i Stanisława Nowak', location: 'Kościół główny' },
  { time: '12:00', text: 'Dziękczynna za rodzinę Malinowskich', location: 'Kaplica' },
  { time: '18:00', text: 'O zdrowie dla Katarzyny i Łukasza', location: 'Kościół główny' }
];

const intentionsWeekMock = [
  {
    label: 'Poniedziałek',
    items: [
      { time: '7:00', text: 'Za + Annę i Tadeusza', location: 'Kościół' },
      { time: '18:00', text: 'O pokój w rodzinie', location: 'Kościół' }
    ]
  },
  {
    label: 'Środa',
    items: [
      { time: '7:00', text: 'Za + Helenę i Józefa', location: 'Kaplica' },
      { time: '18:00', text: 'W intencji młodzieży', location: 'Kościół' }
    ]
  },
  {
    label: 'Piątek',
    items: [
      { time: '7:00', text: 'Za + Alicję i Piotra', location: 'Kościół' },
      { time: '18:00', text: 'O zdrowie dla chorych', location: 'Kościół' }
    ]
  }
];

const intentionsObitsMock = [
  { name: 'Jan Kowalski', date: '10 marca', note: 'Wypominki roczne' },
  { name: 'Maria Nowak', date: '12 marca', note: 'Miesiąc po pogrzebie' },
  { name: 'Stanisław Zieliński', date: '14 marca', note: 'Rocznica' }
];

const officeHours = [
  { day: 'Poniedziałek', hours: '9:00–11:00, 16:00–18:00' },
  { day: 'Wtorek', hours: '9:00–11:00, 16:00–18:00' },
  { day: 'Środa', hours: '9:00–11:00' },
  { day: 'Czwartek', hours: '9:00–11:00, 16:00–18:00' },
  { day: 'Piątek', hours: '9:00–11:00, 16:00–18:00' }
];

  const aboutHighlights = [
    { label: 'Rok założenia', value: '1984' },
    { label: 'Wspólnoty', value: '12' },
    { label: 'Msze tygodniowo', value: '18' },
    { label: 'Wolontariusze', value: '45' }
  ];

const StickyModule = ({
  layout,
  columns
}: {
  layout: { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } };
  columns: number;
}) => {
  const colSpan = snapColSpan(layout.size.colSpan, columns);
  const rowSpan = snapRowSpan(layout.size.rowSpan);
  const showImages = rowSpan > 1;
  const showSideList = showImages && colSpan >= 6 && rowSpan >= 5;
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isHoveringList, setIsHoveringList] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const maxIndex = stickyItems.length - 1;
  const headlineItems = stickyItems.slice(0, 3);

  useEffect(() => {
    if (!showImages || stickyItems.length <= 1) return;
    if (!autoPlay || isHoveringList) return;
    if (typeof window === 'undefined') return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1 > maxIndex ? 0 : prev + 1));
    }, 6500);
    return () => window.clearInterval(timer);
  }, [showImages, maxIndex, autoPlay, isHoveringList]);

  const goNext = () => setActiveIndex((prev) => (prev + 1 > maxIndex ? 0 : prev + 1));
  const goPrev = () => setActiveIndex((prev) => (prev - 1 < 0 ? maxIndex : prev - 1));
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStartX.current = event.clientX;
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null) return;
    const delta = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 40) return;
    setAutoPlay(false);
    if (delta > 0) {
      goPrev();
    } else {
      goNext();
    }
  };

  if (!showImages) {
    return (
      <div className="sticky-headlines">
        <ul>
          {headlineItems.map((item) => (
            <li key={item.id}>
              <a href={item.href}>
                <span>{item.title}</span>
                <span className="muted">{item.date}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={`sticky-module ${showSideList ? 'has-side' : 'solo'}`}>
      <div className="sticky-carousel" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        <div className="carousel sticky-carousel-inner">
          {stickyItems.map((item, index) => (
            <a
              key={item.id}
              className={`carousel-slide ${index === activeIndex ? 'is-active' : ''}`}
              href={item.href}
            >
              <img src={item.image} alt={item.title} />
              <div className="carousel-caption">
                <h4>{item.title}</h4>
                <p className="muted">{item.summary}</p>
                <span className="muted">{item.date}</span>
              </div>
            </a>
          ))}
          {stickyItems.length > 1 && (
            <>
              <button
                type="button"
                className="carousel-arrow left"
                aria-label="Poprzedni slajd"
                onClick={() => {
                  setAutoPlay(false);
                  goPrev();
                }}
              >
                <span />
              </button>
              <button
                type="button"
                className="carousel-arrow right"
                aria-label="Następny slajd"
                onClick={() => {
                  setAutoPlay(false);
                  goNext();
                }}
              >
                <span />
              </button>
              <div className="carousel-dots">
                {stickyItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={index === activeIndex ? 'is-active' : ''}
                    aria-label={`Przejdź do slajdu ${index + 1}`}
                    onClick={() => {
                      setAutoPlay(false);
                      setActiveIndex(index);
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {showSideList && (
        <aside
          className="sticky-side"
          onMouseEnter={() => setIsHoveringList(true)}
          onMouseLeave={() => setIsHoveringList(false)}
        >
          <ul>
            {stickyItems.map((item, index) => (
              <li
                key={item.id}
                className={index === activeIndex ? 'is-active' : ''}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <a href={item.href}>
                  <span>{item.title}</span>
                  <span className="muted">{item.date}</span>
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
};

const formatIntentions = (items: ParishPublicIntention[]) => {
  const byDay = new Map<string, { label: string; items: { time: string; text: string; location: string }[] }>();
  items.forEach((item) => {
    const date = new Date(item.massDateTime);
    if (Number.isNaN(date.getTime())) return;
    const dayKey = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    const time = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const entry = byDay.get(dayKey) ?? { label, items: [] };
    entry.items.push({ time, text: item.publicText, location: item.churchName });
    byDay.set(dayKey, entry);
  });
  return Array.from(byDay.values());
};

const buildIntentionsData = (items: ParishPublicIntention[]) => {
  if (!items.length) {
    return {
      day: { label: 'Dziś', items: intentionsDayMock },
      week: intentionsWeekMock,
      obits: intentionsObitsMock
    };
  }
  const grouped = formatIntentions(items);
  const day = grouped[0] ?? { label: 'Dziś', items: [] };
  return {
    day,
    week: grouped.slice(0, 3),
    obits: intentionsObitsMock
  };
};

const IntentionsModule = ({
  layout,
  columns,
  items,
  parishSlug,
  onOpenIntentions
}: {
  layout: { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } };
  columns: number;
  items: ParishPublicIntention[];
  parishSlug?: string;
  onOpenIntentions: () => void;
}) => {
  const colSpan = snapColSpan(layout.size.colSpan, columns);
  const rowSpan = snapRowSpan(layout.size.rowSpan);
  const data = useMemo(() => buildIntentionsData(items), [items]);
  const isCompact = rowSpan === 1;
  const isExpanded = rowSpan >= 5;
  const isWide = colSpan >= 4;
  const showSideList = isExpanded && colSpan >= 6;
  const baseLink = parishSlug ? `/#/parish/${parishSlug}/intentions` : '/#/parish';
  const linkItems = [
    { label: 'Intencje dnia', href: `${baseLink}` },
    { label: 'Intencje tygodnia', href: `${baseLink}` },
    { label: 'Wypominki', href: `${baseLink}` }
  ];

  if (isCompact) {
    return (
      <div className="intentions-module intentions-compact">
        <ul className="intentions-links">
          {linkItems.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenIntentions();
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={`intentions-module ${showSideList ? 'has-side' : ''}`}>
      <div className={`intentions-board ${isWide ? 'is-wide' : ''}`}>
        <div className="intentions-day">
          <strong>{data.day.label}</strong>
          <ul>
            {data.day.items.slice(0, isExpanded ? 4 : 2).map((item, index) => (
              <li key={`${item.time}-${index}`}>
                <span>{item.time}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="intentions-day">
          <strong>Intencje tygodnia</strong>
          <ul>
            {data.week.slice(0, isExpanded ? 3 : 2).flatMap((day) =>
              day.items.slice(0, 1).map((item, index) => (
                <li key={`${day.label}-${index}`}>
                  <span>{day.label}</span>
                  <span>{item.text}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="intentions-day">
          <strong>Wypominki</strong>
          <ul>
            {data.obits.slice(0, isExpanded ? 3 : 2).map((item) => (
              <li key={item.name}>
                <span>{item.date}</span>
                <span>{item.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {showSideList && (
        <aside className="intentions-side">
          <ul>
            {data.week.slice(0, 3).flatMap((day) =>
              day.items.slice(0, 2).map((item, index) => (
                <li key={`${day.label}-${index}`}>
                  <span>{item.time}</span>
                  <span className="ellipsis">{item.text}</span>
                </li>
              ))
            )}
          </ul>
        </aside>
      )}
    </div>
  );
};

const CalendarModule = ({
  layout,
  columns
}: {
  layout: { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } };
  columns: number;
}) => {
  const colSpan = snapColSpan(layout.size.colSpan, columns);
  const rowSpan = snapRowSpan(layout.size.rowSpan);
  const isCompact = rowSpan === 1;
  const isExpanded = rowSpan >= 5;
  const isWide = colSpan >= 4;
  const showSideList = isExpanded && colSpan >= 6;
  const events = useMemo(() => buildCalendarMock(), []);
  const now = new Date();
  const nextHours = events.filter((event) => event.start >= now && event.start <= new Date(now.getTime() + 6 * 60 * 60 * 1000));
  const upcoming = nextHours.length ? nextHours : events.slice(0, 4);
  const grouped = events.reduce<Record<string, typeof events>>((acc, event) => {
    const key = event.start.toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
  const groupedDays = Object.entries(grouped)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([key, items]) => ({
      label: new Date(key).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }),
      items: items.sort((a, b) => a.start.getTime() - b.start.getTime())
    }));

  if (isCompact) {
    return (
      <div className="calendar-module calendar-compact">
        <ul>
          {upcoming.slice(0, 3).map((event) => (
            <li key={event.id}>
              <span>
                {event.start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="ellipsis">{event.title}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={`calendar-module ${showSideList ? 'has-side' : ''}`}>
      <div className={`calendar-board ${isWide ? 'is-wide' : ''}`}>
        {groupedDays.slice(0, isExpanded ? 3 : 2).map((day) => (
          <article key={day.label} className="calendar-card">
            <span className="calendar-date">{day.label}</span>
            <ul>
              {day.items.slice(0, isExpanded ? 4 : 3).map((event) => (
                <li key={event.id} className={`calendar-item calendar-item-${event.kind}`}>
                  <span>
                    {event.start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>{event.title}</span>
                  {isExpanded && <span className="muted">{event.place}</span>}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      {showSideList && (
        <aside className="calendar-side">
          <ul>
            {upcoming.slice(0, 6).map((event) => (
              <li key={event.id}>
                <span>
                  {event.start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="ellipsis">{event.title}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
};

export function ParishPage({
  copy,
  onAuthAction,
  authLabel,
  isAuthenticated,
  secureMode,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  onNavigate,
  language,
  onLanguageChange,
  parishSlug
}: {
  copy: Copy;
  onAuthAction: () => void;
  authLabel: string;
  isAuthenticated: boolean;
  secureMode: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  parishSlug?: string;
}) {
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    onNavigate('home');
  };
  const navigate = useNavigate();
  const location = useLocation();
  const [activePage, setActivePage] = useState<PageId>('start');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [parishOptions, setParishOptions] = useState<ParishOption[]>([]);
  const [parishId, setParishId] = useState('');
  const [theme, setTheme] = useState<ThemePreset>('classic');
  const [massTab, setMassTab] = useState<keyof typeof massesTables>('Sunday');
  const [announcementId, setAnnouncementId] = useState(announcements[0].id);
  const [calendarView, setCalendarView] = useState<'month' | 'agenda'>('month');
  const [selectedEventId, setSelectedEventId] = useState(calendarEvents[0].id);
  const [selectedPriestId, setSelectedPriestId] = useState(priests[0].id);
  const [selectedSacramentId, setSelectedSacramentId] = useState(sacraments[0].id);
  const [view, setView] = useState<'chooser' | 'parish' | 'builder'>(
    parishSlug ? 'parish' : 'chooser'
  );

  const parish = useMemo(
    () => parishOptions.find((item) => item.id === parishId) ?? parishOptions[0] ?? null,
    [parishId, parishOptions]
  );
  const [builderStep, setBuilderStep] = useState(0);
  const [builderName, setBuilderName] = useState('');
  const [builderLocation, setBuilderLocation] = useState('');
  const [builderSlug, setBuilderSlug] = useState('');
  const [builderSlugTouched, setBuilderSlugTouched] = useState(false);
  const [builderTheme, setBuilderTheme] = useState<ThemePreset>('classic');
  const [builderLayoutItems, setBuilderLayoutItems] = useState<ParishLayoutItem[]>([]);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [siteConfig, setSiteConfig] = useState<ParishHomepageConfig | null>(null);
  const [publicIntentions, setPublicIntentions] = useState<ParishPublicIntention[]>([]);
  const [publicMasses, setPublicMasses] = useState<ParishPublicMass[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editLayoutItems, setEditLayoutItems] = useState<ParishLayoutItem[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [newIntentionDate, setNewIntentionDate] = useState('');
  const [newIntentionChurch, setNewIntentionChurch] = useState('');
  const [newIntentionText, setNewIntentionText] = useState('');
  const [newIntentionInternal, setNewIntentionInternal] = useState('');
  const [newMassDay, setNewMassDay] = useState('');
  const [newMassTime, setNewMassTime] = useState('18:00');
  const [editingMassId, setEditingMassId] = useState<string | null>(null);
  const [newMassChurch, setNewMassChurch] = useState('');
  const [newMassTitle, setNewMassTitle] = useState('');
  const [newMassNote, setNewMassNote] = useState('');
  const [newMassKind, setNewMassKind] = useState('');
  const [newMassDurationMinutes, setNewMassDurationMinutes] = useState('60');
  const [newMassBeforeService, setNewMassBeforeService] = useState('');
  const [newMassAfterService, setNewMassAfterService] = useState('');
  const [newMassDonationSummary, setNewMassDonationSummary] = useState('');
  const [newMassIntentionsRaw, setNewMassIntentionsRaw] = useState('');
  const [newMassCollective, setNewMassCollective] = useState(false);
  const [massEditorMode, setMassEditorMode] = useState<'single' | 'serial'>('single');
  const [massRules, setMassRules] = useState<ParishMassRule[]>([]);
  const [selectedMassRuleId, setSelectedMassRuleId] = useState<string | null>(null);
  const [massRuleName, setMassRuleName] = useState('Nowa reguła');
  const [massRuleDescription, setMassRuleDescription] = useState('');
  const [massRuleStartNodeId, setMassRuleStartNodeId] = useState('node-1');
  const [massFlowNodes, setMassFlowNodes] = useState<Array<Node<MassRuleNodeData>>>(
    toFlowNodesFromRuleNodes(defaultMassRuleSeed)
  );
  const [massFlowEdges, setMassFlowEdges] = useState<Edge[]>(
    toFlowEdgesFromRuleNodes(defaultMassRuleSeed)
  );
  const [massRuleFromDate, setMassRuleFromDate] = useState('');
  const [massRuleToDate, setMassRuleToDate] = useState('');
  const [massRuleReplaceExisting, setMassRuleReplaceExisting] = useState(false);
  const [massRuleRequireIntentions, setMassRuleRequireIntentions] = useState(false);
  const [massRuleConflicts, setMassRuleConflicts] = useState<string[]>([]);
  const [massRuleWarning, setMassRuleWarning] = useState<string | null>(null);
  const [massNodeSearch, setMassNodeSearch] = useState('');
  const [massNodeCategoryFilter, setMassNodeCategoryFilter] = useState<'all' | MassNodeCategory>('all');
  const [massRuleValidation, setMassRuleValidation] = useState<ValidationFinding[]>([]);
  const [massRulePreview, setMassRulePreview] = useState<ParishPublicMass[]>([]);
  const [selectedMassFlowNodeId, setSelectedMassFlowNodeId] = useState<string | null>(null);
  const [adminFormError, setAdminFormError] = useState<string | null>(null);
  const [confirmationName, setConfirmationName] = useState('');
  const [confirmationSurname, setConfirmationSurname] = useState('');
  const [confirmationPhonesRaw, setConfirmationPhonesRaw] = useState('');
  const [confirmationAddress, setConfirmationAddress] = useState('');
  const [confirmationSchoolShort, setConfirmationSchoolShort] = useState('');
  const [confirmationAcceptedRodo, setConfirmationAcceptedRodo] = useState(false);
  const [confirmationFormError, setConfirmationFormError] = useState<string | null>(null);
  const [confirmationFormSuccess, setConfirmationFormSuccess] = useState<string | null>(null);
  const [confirmationVerifyInfo, setConfirmationVerifyInfo] = useState<string | null>(null);
  const [confirmationVerifyTone, setConfirmationVerifyTone] = useState<'success' | 'error' | 'notice'>('success');
  const [confirmationSubmitting, setConfirmationSubmitting] = useState(false);
  const [confirmationCandidates, setConfirmationCandidates] = useState<ParishConfirmationCandidate[]>([]);
  const [confirmationCandidatesError, setConfirmationCandidatesError] = useState<string | null>(null);
  const [confirmationCopiedToken, setConfirmationCopiedToken] = useState<string | null>(null);
  const [confirmationCopiedMeetingToken, setConfirmationCopiedMeetingToken] = useState<string | null>(null);
  const [confirmationCopiedInviteToken, setConfirmationCopiedInviteToken] = useState<string | null>(null);
  const [confirmationMeetingInviteCodeInput, setConfirmationMeetingInviteCodeInput] = useState('');
  const [confirmationMeetingInviteCodeApplied, setConfirmationMeetingInviteCodeApplied] = useState<string | null>(null);
  const [confirmationAdminTab, setConfirmationAdminTab] = useState<'submissions' | 'print'>('submissions');
  const [confirmationTransferBusy, setConfirmationTransferBusy] = useState(false);
  const [confirmationTransferInfo, setConfirmationTransferInfo] = useState<string | null>(null);
  const [confirmationTransferError, setConfirmationTransferError] = useState<string | null>(null);
  const [confirmationImportReplaceExisting, setConfirmationImportReplaceExisting] = useState(false);
  const [confirmationMeetingSummary, setConfirmationMeetingSummary] = useState<ParishConfirmationMeetingSummary | null>(null);
  const [confirmationMeetingLoading, setConfirmationMeetingLoading] = useState(false);
  const [confirmationMeetingSaving, setConfirmationMeetingSaving] = useState(false);
  const [confirmationMeetingError, setConfirmationMeetingError] = useState<string | null>(null);
  const [confirmationMeetingInfo, setConfirmationMeetingInfo] = useState<string | null>(null);
  const [confirmationMeetingStartsLocal, setConfirmationMeetingStartsLocal] = useState('');
  const [confirmationMeetingDuration, setConfirmationMeetingDuration] = useState('30');
  const [confirmationMeetingCapacity, setConfirmationMeetingCapacity] = useState<'2' | '3'>('3');
  const [confirmationMeetingLabel, setConfirmationMeetingLabel] = useState('');
  const [confirmationMeetingStage, setConfirmationMeetingStage] = useState<'year1-start' | 'year1-end'>('year1-start');
  const [confirmationMeetingPublicData, setConfirmationMeetingPublicData] = useState<ParishConfirmationMeetingAvailability | null>(null);
  const [confirmationMeetingPublicLoading, setConfirmationMeetingPublicLoading] = useState(false);
  const [confirmationMeetingPublicSaving, setConfirmationMeetingPublicSaving] = useState(false);
  const [confirmationMeetingPublicError, setConfirmationMeetingPublicError] = useState<string | null>(null);
  const [confirmationMeetingPublicInfo, setConfirmationMeetingPublicInfo] = useState<string | null>(null);
  const [confirmationMergeGroupKey, setConfirmationMergeGroupKey] = useState<string | null>(null);
  const [confirmationMergeTargetId, setConfirmationMergeTargetId] = useState<string | null>(null);
  const [confirmationMergeSourceId, setConfirmationMergeSourceId] = useState<string | null>(null);
  const [confirmationMergeNameSource, setConfirmationMergeNameSource] = useState<'target' | 'source'>('target');
  const [confirmationMergeSurnameSource, setConfirmationMergeSurnameSource] = useState<'target' | 'source'>('target');
  const [confirmationMergeAddressSource, setConfirmationMergeAddressSource] = useState<'target' | 'source'>('target');
  const [confirmationMergeSchoolSource, setConfirmationMergeSchoolSource] = useState<'target' | 'source'>('target');
  const [confirmationMergeMeetingSource, setConfirmationMergeMeetingSource] = useState<'none' | 'target' | 'source'>('none');
  const [confirmationMergePortalSource, setConfirmationMergePortalSource] = useState<'target' | 'source'>('target');
  const [confirmationMergeSelectedPhones, setConfirmationMergeSelectedPhones] = useState<string[]>([]);
  const [confirmationMergeBusy, setConfirmationMergeBusy] = useState(false);
  const [confirmationMergeError, setConfirmationMergeError] = useState<string | null>(null);
  const [confirmationMergeInfo, setConfirmationMergeInfo] = useState<string | null>(null);
  const [confirmationPortalData, setConfirmationPortalData] = useState<ParishConfirmationPortal | null>(null);
  const [confirmationPortalLoading, setConfirmationPortalLoading] = useState(false);
  const [confirmationPortalError, setConfirmationPortalError] = useState<string | null>(null);
  const [confirmationPortalInfo, setConfirmationPortalInfo] = useState<string | null>(null);
  const [confirmationPortalMessageDraft, setConfirmationPortalMessageDraft] = useState('');
  const [confirmationPortalSendingMessage, setConfirmationPortalSendingMessage] = useState(false);
  const [confirmationAdminCandidateSearch, setConfirmationAdminCandidateSearch] = useState('');
  const [confirmationAdminSelectedCandidateId, setConfirmationAdminSelectedCandidateId] = useState<string | null>(null);
  const [confirmationAdminPortalData, setConfirmationAdminPortalData] = useState<ParishConfirmationPortal | null>(null);
  const [confirmationAdminPortalLoading, setConfirmationAdminPortalLoading] = useState(false);
  const [confirmationAdminPortalError, setConfirmationAdminPortalError] = useState<string | null>(null);
  const [confirmationAdminPortalInfo, setConfirmationAdminPortalInfo] = useState<string | null>(null);
  const [confirmationAdminEditName, setConfirmationAdminEditName] = useState('');
  const [confirmationAdminEditSurname, setConfirmationAdminEditSurname] = useState('');
  const [confirmationAdminEditPhonesRaw, setConfirmationAdminEditPhonesRaw] = useState('');
  const [confirmationAdminEditAddress, setConfirmationAdminEditAddress] = useState('');
  const [confirmationAdminEditSchoolShort, setConfirmationAdminEditSchoolShort] = useState('');
  const [confirmationAdminEditPaperConsentReceived, setConfirmationAdminEditPaperConsentReceived] = useState(false);
  const [confirmationAdminSendingAction, setConfirmationAdminSendingAction] = useState(false);
  const [confirmationAdminMessageDraft, setConfirmationAdminMessageDraft] = useState('');
  const [confirmationAdminPublicNoteDraft, setConfirmationAdminPublicNoteDraft] = useState('');
  const [confirmationAdminPrivateNoteDraft, setConfirmationAdminPrivateNoteDraft] = useState('');
  const [confirmationAdminEditingNoteId, setConfirmationAdminEditingNoteId] = useState<string | null>(null);
  const [confirmationAdminEditingNoteText, setConfirmationAdminEditingNoteText] = useState('');
  const [confirmationAdminEditingNoteIsPublic, setConfirmationAdminEditingNoteIsPublic] = useState(true);
  const [sacramentParishEditTitle, setSacramentParishEditTitle] = useState('');
  const [sacramentParishEditLead, setSacramentParishEditLead] = useState('');
  const [sacramentParishEditNotice, setSacramentParishEditNotice] = useState('');
  const [sacramentParishEditSections, setSacramentParishEditSections] = useState<ParishSacramentSection[]>([]);
  const [sacramentParishSaving, setSacramentParishSaving] = useState(false);
  const [sacramentParishSaveError, setSacramentParishSaveError] = useState<string | null>(null);
  const [sacramentParishSaveInfo, setSacramentParishSaveInfo] = useState<string | null>(null);
  const [sacramentPanelSection, setSacramentPanelSection] = useState<SacramentPanelSection>('overall');
  const parishPathParts = useMemo(
    () => location.pathname.split('/').filter((part) => part.length > 0),
    [location.pathname]
  );
  const parishSubpage = parishPathParts[2] ?? null;
  const isConfirmationSubpage = parishSubpage === 'confirmation';
  const confirmationPathSection = parishPathParts[3] ?? null;
  const confirmationPanelSection = useMemo(
    () => parseConfirmationSection(confirmationPathSection),
    [confirmationPathSection]
  );
  const confirmationMeetingToken = useMemo(() => {
    const token = new URLSearchParams(location.search).get('meeting');
    return token?.trim() ? token.trim() : null;
  }, [location.search]);
  const confirmationMeetingInviteToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const inviteValue = params.get('code') ?? params.get('invite');
    if (!inviteValue) return null;
    const normalized = normalizeConfirmationInviteCode(inviteValue);
    return normalized || null;
  }, [location.search]);
  const confirmationPortalToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('portal') ?? params.get('meeting');
    return token?.trim() ? token.trim() : null;
  }, [location.search]);
  const baseColumns = 6;
  const [gridColumns, setGridColumns] = useState(baseColumns);
  const [gridRowHeight, setGridRowHeight] = useState(90);
  const homeGridRef = useRef<HTMLDivElement | null>(null);
  const editorGridRef = useRef<HTMLDivElement | null>(null);
  const confirmationImportFileRef = useRef<HTMLInputElement | null>(null);
  const [selectedBuilderId, setSelectedBuilderId] = useState<string | null>(null);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    layout: 'builder' | 'edit' | null;
    activeId: string | null;
    activeType: 'palette' | 'item' | null;
    activeItemId: string | null;
    size: { colSpan: number; rowSpan: number } | null;
    overCell: { row: number; col: number } | null;
    overValid: boolean;
  }>({
    layout: null,
    activeId: null,
    activeType: null,
    activeItemId: null,
    size: null,
    overCell: null,
    overValid: false
  });
  useEffect(() => {
    setBuilderLayoutItems(normalizeLayoutsAll(defaultHomepageConfig.modules));
  }, []);
  const [resizeState, setResizeState] = useState<{
    layout: 'builder' | 'edit';
    itemId: string;
    originColStart: number;
    originColEnd: number;
    originRowStart: number;
    originRowEnd: number;
    gridLeft: number;
    gridTop: number;
    cellWidth: number;
    rowHeight: number;
    handle:
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right';
  } | null>(null);
  const normalizeSlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  const normalizeConfirmationInviteCode = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
  const canCreateParish =
    builderName.trim().length > 0 &&
    builderSlug.trim().length > 0 &&
    builderLayoutItems.length > 0;

  const loadMassRuleToEditor = (rule: ParishMassRule) => {
    setSelectedMassRuleId(rule.id);
    setMassRuleName(rule.name);
    setMassRuleDescription(rule.description ?? '');
    setMassRuleStartNodeId(rule.graph.startNodeId);
    setMassFlowNodes(toFlowNodesFromRuleNodes(rule.graph.nodes));
    setMassFlowEdges(toFlowEdgesFromRuleNodes(rule.graph.nodes));
    setSelectedMassFlowNodeId(null);
    setMassRuleConflicts([]);
    setMassRuleWarning(null);
  };

  const handleStartBuilder = () => {
    setBuilderStep(0);
    setBuilderName('');
    setBuilderLocation('');
    setBuilderSlug('');
    setBuilderSlugTouched(false);
    setBuilderTheme('classic');
    setBuilderLayoutItems(normalizeLayoutsAll(defaultHomepageConfig.modules));
    setBuilderError(null);
    setView('builder');
  };

  const handleBuilderNameChange = (value: string) => {
    setBuilderName(value);
    if (!builderSlugTouched) {
      setBuilderSlug(normalizeSlug(value));
    }
  };

  const handleBuilderSlugChange = (value: string) => {
    setBuilderSlugTouched(true);
    setBuilderSlug(normalizeSlug(value));
  };


  const handleCreateParishSite = async () => {
    if (!canCreateParish) return;
    setBuilderError(null);
    try {
      const homepage = {
        modules: builderLayoutItems
      };
      const created = await createParishSite({
        name: builderName.trim(),
        location: builderLocation.trim(),
        slug: builderSlug.trim(),
        theme: builderTheme,
        heroImageUrl: null,
        homepage
      });
      const newParish: ParishOption = {
        id: created.id,
        slug: created.slug,
        name: created.name,
        location: created.location,
        logo: '/parish/logo.svg',
        heroImage: created.heroImageUrl ?? '/parish/visit.jpg',
        theme: (created.theme as ThemePreset) ?? 'classic'
      };
      setParishOptions((current) => [...current, newParish]);
      setParishId(created.id);
      setTheme((created.theme as ThemePreset) ?? builderTheme);
      setSiteConfig(created.homepage);
      setActivePage('start');
      setView('parish');
      navigate(`/parish/${created.slug}`);
    } catch (error) {
      setBuilderError('Nie udało się utworzyć strony. Spróbuj ponownie.');
    }
  };

  useEffect(() => {
    let mounted = true;
    listParishes()
      .then((items: ParishSummary[]) => {
        if (!mounted || items.length === 0) return;
        const mapped = items.map((item) => ({
          id: item.id,
          slug: item.slug,
          name: item.name,
          location: item.location,
          logo: '/parish/logo.svg',
          heroImage: item.heroImageUrl ?? '/parish/visit.jpg',
          theme: (item.theme as ThemePreset) ?? 'classic'
        }));
        setParishOptions(mapped);
        if (!parishSlug && mapped[0]) {
          setParishId(mapped[0].id);
          setTheme(mapped[0].theme);
        }
      })
      .catch(() => {
        setParishOptions([]);
      });
    return () => {
      mounted = false;
    };
  }, [parishSlug]);

  useEffect(() => {
    const resolveColumns = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      if (width < 720) {
        setGridColumns(2);
      } else if (width < 980) {
        setGridColumns(4);
      } else {
        setGridColumns(6);
      }
    };
    resolveColumns();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resolveColumns);
      return () => window.removeEventListener('resize', resolveColumns);
    }
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const target = view === 'builder' || editMode ? editorGridRef.current : homeGridRef.current;
    if (!target) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const styles = window.getComputedStyle(target);
      const paddingLeft = Number.parseFloat(styles.paddingLeft || '0');
      const paddingRight = Number.parseFloat(styles.paddingRight || '0');
      const width = entry.contentRect.width - paddingLeft - paddingRight;
      const gap = target === homeGridRef.current ? HOME_GAP : EDITOR_GAP;
      const columns = gridColumns;
      const cell = columns > 0 ? (width - gap * (columns - 1)) / columns : width;
      const rowHeight = Math.max(80, Math.round(cell * 0.23));
      setGridRowHeight(rowHeight);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [gridColumns, view, editMode]);

  useEffect(() => {
    if (!parishSlug) return;
    getParishSite(parishSlug)
      .then((data) => {
        setSiteConfig({
          ...data.homepage,
          modules: normalizeLayoutsAll(data.homepage.modules)
        });
        setTheme((data.theme as ThemePreset) ?? 'classic');
        setEditLayoutItems(normalizeLayoutsAll(data.homepage.modules));
      })
      .catch(() => {
        setSiteConfig(null);
      });
  }, [parishSlug]);

  useEffect(() => {
    if (!parishSlug) return;
    getParishPublicIntentions(parishSlug)
      .then((items) => setPublicIntentions(items))
      .catch(() => setPublicIntentions([]));
    getParishPublicMasses(parishSlug)
      .then((items) => setPublicMasses(items))
      .catch(() => setPublicMasses([]));
  }, [parishSlug]);

  useEffect(() => {
    if (newMassDay) return;
    const today = new Date();
    setNewMassDay(today.toISOString().slice(0, 10));
  }, [newMassDay]);

  useEffect(() => {
    if (!isAuthenticated || !parish) {
      setMassRules([]);
      return;
    }
    listParishMassRules(parish.id)
      .then((rules) => {
        setMassRules(rules);
        if (!selectedMassRuleId && rules[0]) {
          loadMassRuleToEditor(rules[0]);
        }
      })
      .catch(() => setMassRules([]));
  }, [isAuthenticated, parish?.id, selectedMassRuleId]);

  const loadConfirmationCandidates = async () => {
    if (!parish || !isAuthenticated) {
      setConfirmationCandidates([]);
      return;
    }
    try {
      const items = await listParishConfirmationCandidates(parish.id);
      setConfirmationCandidates(items);
      setConfirmationCandidatesError(null);
    } catch {
      setConfirmationCandidates([]);
      setConfirmationCandidatesError('Nie udało się pobrać zgłoszeń do bierzmowania.');
    }
  };

  const confirmationDuplicateGroups = useMemo<ConfirmationDuplicateGroup[]>(() => {
    const grouped = new Map<string, ParishConfirmationCandidate[]>();
    for (const candidate of confirmationCandidates) {
      const normalizedName = candidate.name.trim().toLowerCase();
      const normalizedSurname = candidate.surname.trim().toLowerCase();
      if (!normalizedName || !normalizedSurname) {
        continue;
      }

      const key = `${normalizedName}|${normalizedSurname}`;
      const current = grouped.get(key);
      if (current) {
        current.push(candidate);
      } else {
        grouped.set(key, [candidate]);
      }
    }

    return Array.from(grouped.entries())
      .filter(([, candidates]) => candidates.length > 1)
      .map(([key, candidates]) => ({
        key,
        displayName: `${candidates[0]?.name ?? ''} ${candidates[0]?.surname ?? ''}`.trim(),
        candidates
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pl'));
  }, [confirmationCandidates]);

  const selectedConfirmationDuplicateGroup = useMemo(
    () => confirmationDuplicateGroups.find((group) => group.key === confirmationMergeGroupKey) ?? null,
    [confirmationDuplicateGroups, confirmationMergeGroupKey]
  );

  const confirmationMergeTargetCandidate = useMemo(
    () =>
      selectedConfirmationDuplicateGroup?.candidates.find((candidate) => candidate.id === confirmationMergeTargetId) ??
      null,
    [selectedConfirmationDuplicateGroup, confirmationMergeTargetId]
  );

  const confirmationMergeSourceCandidate = useMemo(
    () =>
      selectedConfirmationDuplicateGroup?.candidates.find((candidate) => candidate.id === confirmationMergeSourceId) ??
      null,
    [selectedConfirmationDuplicateGroup, confirmationMergeSourceId]
  );

  const confirmationMergePhoneOptions = useMemo(() => {
    const options = new Map<string, { number: string; target: boolean; source: boolean; verified: boolean }>();
    if (confirmationMergeTargetCandidate) {
      for (const phone of confirmationMergeTargetCandidate.phoneNumbers) {
        const current = options.get(phone.number);
        options.set(phone.number, {
          number: phone.number,
          target: true,
          source: current?.source ?? false,
          verified: (current?.verified ?? false) || phone.isVerified
        });
      }
    }
    if (confirmationMergeSourceCandidate) {
      for (const phone of confirmationMergeSourceCandidate.phoneNumbers) {
        const current = options.get(phone.number);
        options.set(phone.number, {
          number: phone.number,
          target: current?.target ?? false,
          source: true,
          verified: (current?.verified ?? false) || phone.isVerified
        });
      }
    }
    return Array.from(options.values()).sort((a, b) => a.number.localeCompare(b.number));
  }, [confirmationMergeSourceCandidate, confirmationMergeTargetCandidate]);

  const confirmationPortalSelectedFirstYearSlot = useMemo(() => {
    if (!confirmationPortalData?.candidate.selectedSlotId) return null;
    return (
      confirmationPortalData.firstYearStartSlots.find((slot) => slot.id === confirmationPortalData.candidate.selectedSlotId) ??
      null
    );
  }, [confirmationPortalData]);

  const confirmationMeetingPublicSelectedSlot = useMemo(() => {
    if (!confirmationMeetingPublicData?.selectedSlotId) return null;
    return confirmationMeetingPublicData.slots.find((slot) => slot.id === confirmationMeetingPublicData.selectedSlotId) ?? null;
  }, [confirmationMeetingPublicData]);

  const loadConfirmationMeetingSummary = async () => {
    if (!parish || !isAuthenticated) {
      setConfirmationMeetingSummary(null);
      return;
    }
    setConfirmationMeetingLoading(true);
    try {
      const summary = await listParishConfirmationMeetingSlots(parish.id);
      setConfirmationMeetingSummary(summary);
      setConfirmationMeetingError(null);
    } catch {
      setConfirmationMeetingSummary(null);
      setConfirmationMeetingError('Nie udało się pobrać terminów spotkań.');
    } finally {
      setConfirmationMeetingLoading(false);
    }
  };

  const buildConfirmationMeetingLink = (token: string): string => {
    if (!parishSlug || !token.trim()) return '';
    return `${window.location.origin}/#/parish/${parishSlug}/confirmation/candidate?portal=${encodeURIComponent(token)}`;
  };

  const handleCopyConfirmationMeetingLink = async (token: string) => {
    const link = buildConfirmationMeetingLink(token);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setConfirmationCopiedMeetingToken(token);
      window.setTimeout(() => {
        setConfirmationCopiedMeetingToken((current) => (current === token ? null : current));
      }, 2200);
    } catch {
      setConfirmationCandidatesError('Nie udało się skopiować linku spotkania.');
    }
  };

  const handleCopyConfirmationMeetingInviteLink = async (inviteCode?: string | null) => {
    const normalizedInviteCode = normalizeConfirmationInviteCode(inviteCode ?? '');
    if (!normalizedInviteCode) return;
    try {
      await navigator.clipboard.writeText(normalizedInviteCode);
      setConfirmationCopiedInviteToken(normalizedInviteCode);
      window.setTimeout(() => {
        setConfirmationCopiedInviteToken((current) => (current === normalizedInviteCode ? null : current));
      }, 2200);
    } catch {
      setConfirmationCandidatesError('Nie udało się skopiować kodu zaproszenia.');
    }
  };

  const handleApplyConfirmationInviteCode = () => {
    const normalizedCode = normalizeConfirmationInviteCode(confirmationMeetingInviteCodeInput);
    setConfirmationMeetingInviteCodeInput(normalizedCode);
    setConfirmationMeetingInviteCodeApplied(normalizedCode || null);
    if (!normalizedCode) {
      setConfirmationMeetingPublicInfo('Kod zaproszenia został wyczyszczony.');
      setConfirmationPortalInfo('Kod zaproszenia został wyczyszczony.');
      return;
    }

    setConfirmationMeetingPublicInfo(`Zastosowano kod zaproszenia: ${normalizedCode}.`);
    setConfirmationPortalInfo(`Zastosowano kod zaproszenia: ${normalizedCode}.`);
  };

  const handleClearConfirmationInviteCode = () => {
    setConfirmationMeetingInviteCodeInput('');
    setConfirmationMeetingInviteCodeApplied(null);
    setConfirmationMeetingPublicInfo('Kod zaproszenia został usunięty.');
    setConfirmationPortalInfo('Kod zaproszenia został usunięty.');
  };

  const handleCreateConfirmationMeetingSlot = async () => {
    if (!parish || !isAuthenticated) return;
    const startsLocal = confirmationMeetingStartsLocal.trim();
    if (!startsLocal) {
      setConfirmationMeetingError('Podaj datę i godzinę terminu.');
      return;
    }

    const startsDate = new Date(startsLocal);
    if (Number.isNaN(startsDate.getTime())) {
      setConfirmationMeetingError('Nieprawidłowa data lub godzina.');
      return;
    }

    const durationMinutes = Number.parseInt(confirmationMeetingDuration, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 10 || durationMinutes > 180) {
      setConfirmationMeetingError('Czas spotkania musi mieścić się w zakresie 10-180 minut.');
      return;
    }

    const capacity = Number.parseInt(confirmationMeetingCapacity, 10);
    if (capacity < 2 || capacity > 3) {
      setConfirmationMeetingError('Pojemność terminu może wynosić 2 lub 3 osoby.');
      return;
    }

    setConfirmationMeetingSaving(true);
    setConfirmationMeetingError(null);
    setConfirmationMeetingInfo(null);
    try {
      await createParishConfirmationMeetingSlot(parish.id, {
        startsAtUtc: startsDate.toISOString(),
        durationMinutes,
        capacity,
        label: confirmationMeetingLabel.trim() || null,
        stage: confirmationMeetingStage
      });
      setConfirmationMeetingInfo('Dodano nowy termin spotkania.');
      setConfirmationMeetingDuration('30');
      setConfirmationMeetingCapacity('3');
      setConfirmationMeetingLabel('');
      setConfirmationMeetingStage('year1-start');
      await loadConfirmationMeetingSummary();
    } catch {
      setConfirmationMeetingError('Nie udało się dodać terminu spotkania.');
    } finally {
      setConfirmationMeetingSaving(false);
    }
  };

  const handleDeleteConfirmationMeetingSlot = async (slotId: string) => {
    if (!parish || !isAuthenticated) return;
    setConfirmationMeetingSaving(true);
    setConfirmationMeetingError(null);
    setConfirmationMeetingInfo(null);
    try {
      await deleteParishConfirmationMeetingSlot(parish.id, slotId);
      setConfirmationMeetingInfo('Usunięto termin spotkania. Kandydaci z tego terminu zostali odpięci.');
      await loadConfirmationMeetingSummary();
    } catch {
      setConfirmationMeetingError('Nie udało się usunąć terminu spotkania.');
    } finally {
      setConfirmationMeetingSaving(false);
    }
  };

  const loadConfirmationMeetingAvailability = async (token: string, inviteCode?: string | null) => {
    if (!parishSlug) return;
    setConfirmationMeetingPublicLoading(true);
    setConfirmationMeetingPublicError(null);
    try {
      const data = await getParishConfirmationMeetingAvailability(parishSlug, token, inviteCode ?? null);
      setConfirmationMeetingPublicData(data);
    } catch {
      setConfirmationMeetingPublicData(null);
      setConfirmationMeetingPublicError('Link do zapisów na spotkanie jest nieprawidłowy lub wygasł.');
    } finally {
      setConfirmationMeetingPublicLoading(false);
    }
  };

  const loadConfirmationCandidatePortal = async (token: string, inviteCode?: string | null) => {
    if (!parishSlug) return;
    setConfirmationPortalLoading(true);
    setConfirmationPortalError(null);
    try {
      const portal = await getParishConfirmationCandidatePortal(parishSlug, token, inviteCode ?? null);
      setConfirmationPortalData(portal);
    } catch {
      setConfirmationPortalData(null);
      setConfirmationPortalError('Portal kandydata jest niedostępny. Sprawdź poprawność linku.');
    } finally {
      setConfirmationPortalLoading(false);
    }
  };

  const loadConfirmationAdminCandidatePortal = async (candidateId: string) => {
    if (!parish || !isAuthenticated) return;
    setConfirmationAdminPortalLoading(true);
    setConfirmationAdminPortalError(null);
    try {
      const portal = await getParishConfirmationCandidatePortalAdmin(parish.id, candidateId);
      setConfirmationAdminPortalData(portal);
      setConfirmationAdminEditName(portal.candidate.name);
      setConfirmationAdminEditSurname(portal.candidate.surname);
      setConfirmationAdminEditAddress(portal.candidate.address);
      setConfirmationAdminEditSchoolShort(portal.candidate.schoolShort);
      setConfirmationAdminEditPhonesRaw(portal.candidate.phoneNumbers.map((item) => item.number).join('\n'));
      setConfirmationAdminEditPaperConsentReceived(portal.candidate.paperConsentReceived);
    } catch {
      setConfirmationAdminPortalData(null);
      setConfirmationAdminPortalError('Nie udało się pobrać portalu kandydata.');
    } finally {
      setConfirmationAdminPortalLoading(false);
    }
  };

  const handleBookConfirmationMeetingSlot = async (slotId: string) => {
    const bookingToken = confirmationPortalToken ?? confirmationMeetingToken;
    if (!parishSlug || !bookingToken) return;
    setConfirmationMeetingPublicSaving(true);
    setConfirmationMeetingPublicError(null);
    setConfirmationMeetingPublicInfo(null);
    setConfirmationPortalError(null);
    setConfirmationPortalInfo(null);
    try {
      const result = await bookParishConfirmationMeetingSlot(parishSlug, {
        token: bookingToken,
        slotId,
        inviteCode: confirmationMeetingInviteCodeApplied
      });
      if (result.status === 'slot-full') {
        const message = 'Wybrany termin jest już pełny. Wybierz inny dostępny termin.';
        setConfirmationMeetingPublicError(message);
        setConfirmationPortalError(message);
      } else if (result.status === 'invite-required') {
        const message = 'Ten termin wymaga kodu zaproszenia od administratora terminu.';
        setConfirmationMeetingPublicError(message);
        setConfirmationPortalError(message);
      } else if (result.status === 'slot-locked') {
        const message = 'Ten termin jest zamknięty i nie przyjmuje nowych zapisów.';
        setConfirmationMeetingPublicError(message);
        setConfirmationPortalError(message);
      } else if (result.status === 'already-selected') {
        const message = 'Ten termin był już wybrany wcześniej.';
        setConfirmationMeetingPublicInfo(message);
        setConfirmationPortalInfo(message);
      } else {
        const message = 'Termin spotkania został zapisany.';
        setConfirmationMeetingPublicInfo(message);
        setConfirmationPortalInfo(message);
      }
      await loadConfirmationMeetingAvailability(bookingToken, confirmationMeetingInviteCodeApplied);
      await loadConfirmationCandidatePortal(bookingToken, confirmationMeetingInviteCodeApplied);
      if (isAuthenticated) {
        await loadConfirmationMeetingSummary();
        await loadConfirmationCandidates();
      }
    } catch {
      setConfirmationMeetingPublicError('Nie udało się zapisać terminu spotkania.');
    } finally {
      setConfirmationMeetingPublicSaving(false);
    }
  };

  const handleReleaseConfirmationMeetingHost = async () => {
    const bookingToken = confirmationPortalToken ?? confirmationMeetingToken;
    if (!parishSlug || !bookingToken) return;
    setConfirmationMeetingPublicSaving(true);
    setConfirmationMeetingPublicError(null);
    setConfirmationMeetingPublicInfo(null);
    setConfirmationPortalError(null);
    setConfirmationPortalInfo(null);
    try {
      const result = await releaseParishConfirmationMeetingHost(parishSlug, bookingToken);
      if (result.status === 'released') {
        setConfirmationMeetingPublicInfo('Uprawnienia administratora terminu zostały zwolnione.');
        setConfirmationPortalInfo('Uprawnienia administratora terminu zostały zwolnione.');
      } else if (result.status === 'not-eligible') {
        const message = 'Nie można zwolnić uprawnień, gdy w terminie jest więcej niż 1 kandydat.';
        setConfirmationMeetingPublicError(message);
        setConfirmationPortalError(message);
      } else if (result.status === 'not-host') {
        const message = 'Tylko aktualny administrator terminu może zwolnić uprawnienia.';
        setConfirmationMeetingPublicError(message);
        setConfirmationPortalError(message);
      } else if (result.status === 'already-public') {
        const message = 'Ten termin jest już publicznie dostępny.';
        setConfirmationMeetingPublicInfo(message);
        setConfirmationPortalInfo(message);
      } else {
        const message = 'Nie udało się zwolnić uprawnień administratora terminu.';
        setConfirmationMeetingPublicError(message);
        setConfirmationPortalError(message);
      }

      await loadConfirmationMeetingAvailability(bookingToken, confirmationMeetingInviteCodeApplied);
      await loadConfirmationCandidatePortal(bookingToken, confirmationMeetingInviteCodeApplied);
      if (isAuthenticated) {
        await loadConfirmationMeetingSummary();
      }
    } catch {
      setConfirmationMeetingPublicError('Nie udało się zwolnić uprawnień administratora terminu.');
      setConfirmationPortalError('Nie udało się zwolnić uprawnień administratora terminu.');
    } finally {
      setConfirmationMeetingPublicSaving(false);
    }
  };

  const handleSendConfirmationPortalMessage = async () => {
    if (!parishSlug || !confirmationPortalToken) return;
    const messageText = confirmationPortalMessageDraft.trim();
    if (!messageText) {
      setConfirmationPortalError('Wpisz wiadomość przed wysłaniem.');
      return;
    }
    setConfirmationPortalSendingMessage(true);
    setConfirmationPortalError(null);
    setConfirmationPortalInfo(null);
    try {
      await sendParishConfirmationCandidateMessage(parishSlug, {
        token: confirmationPortalToken,
        messageText
      });
      setConfirmationPortalMessageDraft('');
      setConfirmationPortalInfo('Wiadomość została wysłana do parafii.');
      await loadConfirmationCandidatePortal(confirmationPortalToken, confirmationMeetingInviteCodeApplied);
      if (isAuthenticated && confirmationAdminSelectedCandidateId) {
        await loadConfirmationAdminCandidatePortal(confirmationAdminSelectedCandidateId);
      }
    } catch {
      setConfirmationPortalError('Nie udało się wysłać wiadomości.');
    } finally {
      setConfirmationPortalSendingMessage(false);
    }
  };

  const handleAdminUpdateCandidateData = async () => {
    if (!parish || !confirmationAdminSelectedCandidateId) return;
    const phoneNumbers = confirmationAdminEditPhonesRaw
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => normalizePolishPhone(item))
      .filter((item): item is string => Boolean(item));

    if (
      !confirmationAdminEditName.trim() ||
      !confirmationAdminEditSurname.trim() ||
      !confirmationAdminEditAddress.trim() ||
      !confirmationAdminEditSchoolShort.trim() ||
      phoneNumbers.length === 0
    ) {
      setConfirmationAdminPortalError('Uzupełnij wszystkie dane kandydata oraz poprawne numery telefonów.');
      return;
    }

    setConfirmationAdminSendingAction(true);
    setConfirmationAdminPortalError(null);
    setConfirmationAdminPortalInfo(null);
    try {
      await updateParishConfirmationCandidate(parish.id, confirmationAdminSelectedCandidateId, {
        name: confirmationAdminEditName.trim(),
        surname: confirmationAdminEditSurname.trim(),
        phoneNumbers,
        address: confirmationAdminEditAddress.trim(),
        schoolShort: confirmationAdminEditSchoolShort.trim()
      });
      setConfirmationAdminPortalInfo('Dane kandydata zostały zapisane.');
      await loadConfirmationCandidates();
      await loadConfirmationAdminCandidatePortal(confirmationAdminSelectedCandidateId);
    } catch {
      setConfirmationAdminPortalError('Nie udało się zapisać danych kandydata.');
    } finally {
      setConfirmationAdminSendingAction(false);
    }
  };

  const handleAdminUpdateCandidatePaperConsent = async () => {
    if (!parish || !confirmationAdminSelectedCandidateId) return;
    setConfirmationAdminSendingAction(true);
    setConfirmationAdminPortalError(null);
    setConfirmationAdminPortalInfo(null);
    try {
      await updateParishConfirmationCandidatePaperConsent(
        parish.id,
        confirmationAdminSelectedCandidateId,
        confirmationAdminEditPaperConsentReceived
      );
      setConfirmationAdminPortalInfo('Status oświadczenia papierowego został zapisany.');
      await loadConfirmationCandidates();
      await loadConfirmationAdminCandidatePortal(confirmationAdminSelectedCandidateId);
      if (confirmationPortalToken && confirmationAdminPortalData?.candidate.portalToken === confirmationPortalToken) {
        await loadConfirmationCandidatePortal(confirmationPortalToken, confirmationMeetingInviteCodeApplied);
      }
    } catch {
      setConfirmationAdminPortalError('Nie udało się zapisać statusu oświadczenia papierowego.');
    } finally {
      setConfirmationAdminSendingAction(false);
    }
  };

  const handleAdminToggleCandidatePaperConsent = async (candidateId: string, nextValue: boolean) => {
    if (!parish) return;
    setConfirmationAdminSendingAction(true);
    setConfirmationCandidatesError(null);
    try {
      await updateParishConfirmationCandidatePaperConsent(parish.id, candidateId, nextValue);
      await loadConfirmationCandidates();
      if (confirmationAdminSelectedCandidateId === candidateId) {
        setConfirmationAdminEditPaperConsentReceived(nextValue);
        await loadConfirmationAdminCandidatePortal(candidateId);
      }
      if (confirmationPortalToken && confirmationAdminPortalData?.candidate.portalToken === confirmationPortalToken) {
        await loadConfirmationCandidatePortal(confirmationPortalToken, confirmationMeetingInviteCodeApplied);
      }
    } catch {
      setConfirmationCandidatesError('Nie udało się zaktualizować statusu oświadczenia papierowego.');
    } finally {
      setConfirmationAdminSendingAction(false);
    }
  };

  const handleAdminSendMessageToCandidate = async () => {
    if (!parish || !confirmationAdminSelectedCandidateId) return;
    const messageText = confirmationAdminMessageDraft.trim();
    if (!messageText) {
      setConfirmationAdminPortalError('Wpisz wiadomość do kandydata.');
      return;
    }
    setConfirmationAdminSendingAction(true);
    setConfirmationAdminPortalError(null);
    setConfirmationAdminPortalInfo(null);
    try {
      await sendParishConfirmationAdminMessage(parish.id, confirmationAdminSelectedCandidateId, messageText);
      setConfirmationAdminMessageDraft('');
      setConfirmationAdminPortalInfo('Wiadomość została wysłana do kandydata.');
      await loadConfirmationAdminCandidatePortal(confirmationAdminSelectedCandidateId);
    } catch {
      setConfirmationAdminPortalError('Nie udało się wysłać wiadomości.');
    } finally {
      setConfirmationAdminSendingAction(false);
    }
  };

  const handleAdminAddCandidateNote = async (isPublic: boolean) => {
    if (!parish || !confirmationAdminSelectedCandidateId) return;
    const noteText = (isPublic ? confirmationAdminPublicNoteDraft : confirmationAdminPrivateNoteDraft).trim();
    if (!noteText) {
      setConfirmationAdminPortalError('Wpisz treść adnotacji.');
      return;
    }
    setConfirmationAdminSendingAction(true);
    setConfirmationAdminPortalError(null);
    setConfirmationAdminPortalInfo(null);
    try {
      await addParishConfirmationNote(parish.id, confirmationAdminSelectedCandidateId, {
        noteText,
        isPublic
      });
      if (isPublic) {
        setConfirmationAdminPublicNoteDraft('');
      } else {
        setConfirmationAdminPrivateNoteDraft('');
      }
      setConfirmationAdminPortalInfo(isPublic ? 'Dodano publiczną adnotację.' : 'Dodano prywatną adnotację.');
      await loadConfirmationAdminCandidatePortal(confirmationAdminSelectedCandidateId);
      if (confirmationPortalToken && confirmationAdminPortalData?.candidate.portalToken === confirmationPortalToken) {
        await loadConfirmationCandidatePortal(confirmationPortalToken, confirmationMeetingInviteCodeApplied);
      }
    } catch {
      setConfirmationAdminPortalError('Nie udało się dodać adnotacji.');
    } finally {
      setConfirmationAdminSendingAction(false);
    }
  };

  const handleAdminStartEditNote = (noteId: string, noteText: string, isPublic: boolean) => {
    setConfirmationAdminEditingNoteId(noteId);
    setConfirmationAdminEditingNoteText(noteText);
    setConfirmationAdminEditingNoteIsPublic(isPublic);
  };

  const handleAdminSaveEditedNote = async () => {
    if (!parish || !confirmationAdminSelectedCandidateId || !confirmationAdminEditingNoteId) return;
    const noteText = confirmationAdminEditingNoteText.trim();
    if (!noteText) {
      setConfirmationAdminPortalError('Treść adnotacji nie może być pusta.');
      return;
    }
    setConfirmationAdminSendingAction(true);
    setConfirmationAdminPortalError(null);
    setConfirmationAdminPortalInfo(null);
    try {
      await updateParishConfirmationNote(parish.id, confirmationAdminSelectedCandidateId, confirmationAdminEditingNoteId, {
        noteText,
        isPublic: confirmationAdminEditingNoteIsPublic
      });
      setConfirmationAdminPortalInfo('Adnotacja została zaktualizowana.');
      setConfirmationAdminEditingNoteId(null);
      setConfirmationAdminEditingNoteText('');
      await loadConfirmationAdminCandidatePortal(confirmationAdminSelectedCandidateId);
      if (confirmationPortalToken && confirmationAdminPortalData?.candidate.portalToken === confirmationPortalToken) {
        await loadConfirmationCandidatePortal(confirmationPortalToken, confirmationMeetingInviteCodeApplied);
      }
    } catch {
      setConfirmationAdminPortalError('Nie udało się zaktualizować adnotacji.');
    } finally {
      setConfirmationAdminSendingAction(false);
    }
  };

  const handleToggleConfirmationMergePhone = (number: string, checked: boolean) => {
    setConfirmationMergeSelectedPhones((current) => {
      if (checked) {
        if (current.includes(number)) {
          return current;
        }
        return [...current, number];
      }

      return current.filter((item) => item !== number);
    });
  };

  const handleMergeDuplicateConfirmationCandidates = async () => {
    if (!parish || !confirmationMergeTargetCandidate || !confirmationMergeSourceCandidate) {
      return;
    }
    if (confirmationMergeTargetCandidate.id === confirmationMergeSourceCandidate.id) {
      setConfirmationMergeError('Rekord docelowy i źródłowy muszą być różne.');
      return;
    }

    const selectedPhones = confirmationMergeSelectedPhones
      .map((phone) => normalizePolishPhone(phone))
      .filter((phone): phone is string => Boolean(phone));
    const mergedPhones = Array.from(new Set(selectedPhones));
    if (mergedPhones.length === 0) {
      setConfirmationMergeError('Wybierz co najmniej jeden numer telefonu do zachowania.');
      return;
    }

    const mergedName =
      (confirmationMergeNameSource === 'source'
        ? confirmationMergeSourceCandidate.name
        : confirmationMergeTargetCandidate.name).trim();
    const mergedSurname =
      (confirmationMergeSurnameSource === 'source'
        ? confirmationMergeSourceCandidate.surname
        : confirmationMergeTargetCandidate.surname).trim();
    const mergedAddress =
      (confirmationMergeAddressSource === 'source'
        ? confirmationMergeSourceCandidate.address
        : confirmationMergeTargetCandidate.address).trim();
    const mergedSchool =
      (confirmationMergeSchoolSource === 'source'
        ? confirmationMergeSourceCandidate.schoolShort
        : confirmationMergeTargetCandidate.schoolShort).trim();

    if (!mergedName || !mergedSurname || !mergedAddress || !mergedSchool) {
      setConfirmationMergeError('Dane scalone są niekompletne. Wybierz wartości dla każdego pola.');
      return;
    }

    const selectedMeetingSlotId =
      confirmationMergeMeetingSource === 'target'
        ? confirmationMergeTargetCandidate.meetingSlotId ?? null
        : confirmationMergeMeetingSource === 'source'
        ? confirmationMergeSourceCandidate.meetingSlotId ?? null
        : null;
    const portalTokenFromCandidateId =
      confirmationMergePortalSource === 'source'
        ? confirmationMergeSourceCandidate.id
        : confirmationMergeTargetCandidate.id;

    setConfirmationMergeBusy(true);
    setConfirmationMergeError(null);
    setConfirmationMergeInfo(null);
    try {
      const result = await mergeParishConfirmationCandidates(parish.id, {
        targetCandidateId: confirmationMergeTargetCandidate.id,
        sourceCandidateId: confirmationMergeSourceCandidate.id,
        name: mergedName,
        surname: mergedSurname,
        phoneNumbers: mergedPhones,
        address: mergedAddress,
        schoolShort: mergedSchool,
        selectedMeetingSlotId,
        portalTokenFromCandidateId
      });

      setConfirmationMergeInfo(
        `Scalono zgłoszenia. Zachowano rekord ${result.candidateId}, usunięto ${result.removedCandidateId}.`
      );
      await loadConfirmationCandidates();
      await loadConfirmationMeetingSummary();
      if (confirmationAdminSelectedCandidateId === confirmationMergeSourceCandidate.id) {
        setConfirmationAdminSelectedCandidateId(result.candidateId);
      }
      if (confirmationAdminSelectedCandidateId === confirmationMergeTargetCandidate.id) {
        await loadConfirmationAdminCandidatePortal(confirmationMergeTargetCandidate.id);
      }
    } catch {
      setConfirmationMergeError('Nie udało się scalić zgłoszeń kandydatów.');
    } finally {
      setConfirmationMergeBusy(false);
    }
  };

  const parseConfirmationImportCandidates = (value: unknown): ParishConfirmationExportCandidate[] | null => {
    if (Array.isArray(value)) {
      return value as ParishConfirmationExportCandidate[];
    }
    if (!value || typeof value !== 'object') {
      return null;
    }

    const withCandidates = value as { candidates?: unknown };
    if (!Array.isArray(withCandidates.candidates)) {
      return null;
    }
    return withCandidates.candidates as ParishConfirmationExportCandidate[];
  };

  const handleExportConfirmationCandidates = async () => {
    if (!parish) return;
    setConfirmationTransferBusy(true);
    setConfirmationTransferError(null);
    setConfirmationTransferInfo(null);
    try {
      const exportPayload = await exportParishConfirmationCandidates(parish.id);
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `confirmation-candidates-${parish.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setConfirmationTransferInfo(`Wyeksportowano ${exportPayload.candidates.length} zgłoszeń.`);
    } catch {
      setConfirmationTransferError('Nie udało się wyeksportować zgłoszeń.');
    } finally {
      setConfirmationTransferBusy(false);
    }
  };

  const handleImportConfirmationCandidates = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!parish) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setConfirmationTransferBusy(true);
    setConfirmationTransferError(null);
    setConfirmationTransferInfo(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const candidates = parseConfirmationImportCandidates(parsed);
      if (!candidates) {
        setConfirmationTransferError('Plik importu ma nieprawidłowy format JSON.');
        return;
      }

      const result = await importParishConfirmationCandidates(parish.id, {
        candidates,
        replaceExisting: confirmationImportReplaceExisting
      });
      setConfirmationTransferInfo(
        `Import zakończony: ${result.importedCandidates} zgłoszeń, ${result.importedPhoneNumbers} numerów, pominięto ${result.skippedCandidates}.`
      );
      await loadConfirmationCandidates();
      await loadConfirmationMeetingSummary();
    } catch {
      setConfirmationTransferError('Nie udało się zaimportować zgłoszeń.');
    } finally {
      if (confirmationImportFileRef.current) {
        confirmationImportFileRef.current.value = '';
      }
      setConfirmationTransferBusy(false);
    }
  };

  const handlePrintConfirmationCards = () => {
    if (confirmationCandidates.length === 0) return;
    const printedAt = new Date().toLocaleString('pl-PL');
    const parentParagraphsHtml = confirmationParentConsentDraft
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join('');
    const rodoPurposesHtml = confirmationRodoClauseDraft.purposes
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');

    const sheetsHtml = confirmationCandidates
      .map((candidate) => {
        const phonesHtml = candidate.phoneNumbers.map((phone) => `<li>${escapeHtml(phone.number)}</li>`).join('');
        const fullName = `${candidate.name} ${candidate.surname}`.trim();
        return `
          <article class="sheet">
            <section class="page page-front">
              <p class="tag">Bierzmowanie</p>
              <h1>Oświadczenie rodzica / opiekuna prawnego</h1>
              <p class="lead">OŚWIADCZENIE RODZICA / OPIEKUNA PRAWNEGO DOTYCZĄCE UDZIAŁU DZIECKA W PRZYGOTOWANIU DO SAKRAMENTU BIERZMOWANIA</p>
              <p><strong>Imię i nazwisko:</strong> ${escapeHtml(fullName)}</p>
              <p><strong>Adres zamieszkania:</strong> ${escapeHtml(candidate.address)}</p>
              <p><strong>Szkoła (skrót):</strong> ${escapeHtml(candidate.schoolShort)}</p>
              <p><strong>Numery kontaktowe:</strong></p>
              <ul>${phonesHtml}</ul>
              <p><strong>Data zgłoszenia:</strong> ${escapeHtml(new Date(candidate.createdUtc).toLocaleDateString('pl-PL'))}</p>
              ${parentParagraphsHtml}
              <div class="signature-block">
                <p>Miejscowość, data: .............................................................</p>
                <p>Podpis rodzica / opiekuna prawnego: .............................................................</p>
              </div>
            </section>
            <section class="page page-back">
              <p class="tag">RODO</p>
              <h1>Klauzula informacyjna RODO</h1>
              <p class="lead">KLAUZULA INFORMACYJNA DOTYCZĄCA PRZETWARZANIA DANYCH OSOBOWYCH</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.intro)}</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.admin)}</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.iod)}</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.purposesLead)}</p>
              <ul>${rodoPurposesHtml}</ul>
              <p>${escapeHtml(confirmationRodoClauseDraft.recipients)}</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.retention)}</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.rights)}</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.supervision)}</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.automation)}</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.required)}</p>
              <p>${escapeHtml(confirmationRodoClauseDraft.acknowledgment)}</p>
            </section>
          </article>
        `;
      })
      .join('');

    const html = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Karty bierzmowanie - wydruk</title>
  <style>
    :root {
      color-scheme: light;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #f3f4f7;
      color: #111;
      font-family: "Segoe UI", Tahoma, sans-serif;
      line-height: 1.35;
    }
    .print-info {
      max-width: 860px;
      margin: 16px auto;
      padding: 10px 14px;
      border: 1px solid #d6dae2;
      border-radius: 10px;
      background: #fff;
      font-size: 0.9rem;
    }
    .print-info p {
      margin: 0;
    }
    .sheet {
      margin: 14px auto;
      width: 148mm;
    }
    .page {
      width: 148mm;
      min-height: 210mm;
      padding: 10mm;
      background: #fff;
      border: 1px solid #cfd5df;
      overflow: hidden;
    }
    .page + .page {
      margin-top: 8mm;
    }
    .tag {
      margin: 0 0 8px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #31527f;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 1.08rem;
      line-height: 1.25;
    }
    p {
      margin: 0 0 7px;
      font-size: 0.87rem;
    }
    .lead {
      margin-bottom: 10px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      font-weight: 700;
    }
    ul {
      margin: 0 0 10px 18px;
      padding: 0;
      font-size: 0.86rem;
    }
    li {
      margin: 0 0 4px;
    }
    .page-back {
      font-size: 0.82rem;
    }
    .page-back p,
    .page-back ul {
      font-size: 0.82rem;
    }
    .signature-block {
      margin-top: 16px;
    }
    @page {
      size: A5 portrait;
      margin: 8mm;
    }
    @media print {
      html, body {
        background: #fff;
      }
      .print-info {
        display: none;
      }
      .sheet {
        margin: 0;
        width: auto;
      }
      .page {
        width: auto;
        min-height: 0;
        border: none;
        padding: 0;
        border-radius: 0;
        break-after: page;
        page-break-after: always;
      }
      .sheet:last-child .page:last-child {
        break-after: auto;
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>
  <div class="print-info">
    <p>Dokument do druku dwustronnego A5. Wygenerowano: ${escapeHtml(printedAt)}. Liczba kart: ${confirmationCandidates.length}.</p>
  </div>
  ${sheetsHtml}
  <script>
    window.addEventListener('load', function () {
      window.print();
    });
  </script>
</body>
</html>`;
    const printWindow = window.open('about:blank', '_blank') ?? window.open('about:blank', '_self');
    if (!printWindow) {
      setConfirmationTransferError('Nie udało się otworzyć strony wydruku.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setConfirmationTransferError(null);
  };

  useEffect(() => {
    if (!isConfirmationSubpage) {
      setConfirmationVerifyInfo(null);
      return;
    }
    if (!isKnownConfirmationSectionPath(confirmationPathSection)) return;
    if (!parishSlug) return;
    const token = new URLSearchParams(location.search).get('verifyPhone');
    if (!token) return;
    verifyParishConfirmationPhone(parishSlug, token)
      .then((result) => {
        if (result.status === 'verified') {
          setConfirmationVerifyTone('success');
          setConfirmationVerifyInfo(
            'Numer telefonu został potwierdzony. Dziękujemy. Nie wysyłaj ponownie formularza zgłoszeniowego dla tej samej osoby.'
          );
        } else if (result.status === 'already-verified') {
          setConfirmationVerifyTone('notice');
          setConfirmationVerifyInfo(
            'Ten numer telefonu był już wcześniej potwierdzony. Nie wysyłaj ponownie formularza zgłoszeniowego, aby uniknąć duplikatów.'
          );
        } else {
          setConfirmationVerifyTone('error');
          setConfirmationVerifyInfo('Link weryfikacyjny jest nieprawidłowy. Skontaktuj się z parafią, aby otrzymać nowy link.');
        }
      })
      .catch(() => {
        setConfirmationVerifyTone('error');
        setConfirmationVerifyInfo('Nie udało się potwierdzić numeru telefonu. Spróbuj ponownie później lub skontaktuj się z parafią.');
      })
      .finally(() => {
        navigate(`/parish/${parishSlug}/confirmation/overall`, { replace: true });
      });
  }, [isConfirmationSubpage, confirmationPathSection, parishSlug, location.search, navigate]);

  useEffect(() => {
    if (!isConfirmationSubpage || !isAuthenticated || !parish) {
      setConfirmationCandidates([]);
      return;
    }
    void loadConfirmationCandidates();
  }, [isConfirmationSubpage, isAuthenticated, parish?.id]);

  useEffect(() => {
    if (confirmationDuplicateGroups.length === 0) {
      setConfirmationMergeGroupKey(null);
      setConfirmationMergeTargetId(null);
      setConfirmationMergeSourceId(null);
      return;
    }

    if (!confirmationMergeGroupKey || !confirmationDuplicateGroups.some((group) => group.key === confirmationMergeGroupKey)) {
      setConfirmationMergeGroupKey(confirmationDuplicateGroups[0].key);
    }
  }, [confirmationDuplicateGroups, confirmationMergeGroupKey]);

  useEffect(() => {
    if (!selectedConfirmationDuplicateGroup) {
      setConfirmationMergeTargetId(null);
      setConfirmationMergeSourceId(null);
      return;
    }

    const candidates = selectedConfirmationDuplicateGroup.candidates;
    const fallbackTarget = candidates[0]?.id ?? null;
    const nextTargetId = candidates.some((candidate) => candidate.id === confirmationMergeTargetId)
      ? confirmationMergeTargetId
      : fallbackTarget;
    if (nextTargetId !== confirmationMergeTargetId) {
      setConfirmationMergeTargetId(nextTargetId);
      return;
    }

    const fallbackSource =
      candidates.find((candidate) => candidate.id !== nextTargetId)?.id ??
      null;
    const nextSourceId =
      confirmationMergeSourceId &&
      confirmationMergeSourceId !== nextTargetId &&
      candidates.some((candidate) => candidate.id === confirmationMergeSourceId)
        ? confirmationMergeSourceId
        : fallbackSource;
    if (nextSourceId !== confirmationMergeSourceId) {
      setConfirmationMergeSourceId(nextSourceId);
    }
  }, [selectedConfirmationDuplicateGroup, confirmationMergeTargetId, confirmationMergeSourceId]);

  useEffect(() => {
    if (!confirmationMergeTargetCandidate || !confirmationMergeSourceCandidate) {
      setConfirmationMergeSelectedPhones([]);
      return;
    }

    const mergedPhones = Array.from(
      new Set([
        ...confirmationMergeTargetCandidate.phoneNumbers.map((phone) => phone.number),
        ...confirmationMergeSourceCandidate.phoneNumbers.map((phone) => phone.number)
      ])
    );
    setConfirmationMergeNameSource('target');
    setConfirmationMergeSurnameSource('target');
    setConfirmationMergeAddressSource('target');
    setConfirmationMergeSchoolSource('target');
    setConfirmationMergeMeetingSource(
      confirmationMergeTargetCandidate.meetingSlotId
        ? 'target'
        : confirmationMergeSourceCandidate.meetingSlotId
        ? 'source'
        : 'none'
    );
    setConfirmationMergePortalSource('target');
    setConfirmationMergeSelectedPhones(mergedPhones);
    setConfirmationMergeError(null);
    setConfirmationMergeInfo(null);
  }, [confirmationMergeTargetCandidate, confirmationMergeSourceCandidate]);

  useEffect(() => {
    if (!isConfirmationSubpage || !isAuthenticated || !parish) {
      setConfirmationMeetingSummary(null);
      return;
    }
    if (
      confirmationPanelSection !== 'meetings' &&
      confirmationPanelSection !== 'form' &&
      confirmationPanelSection !== 'candidate'
    ) {
      return;
    }
    void loadConfirmationMeetingSummary();
  }, [isConfirmationSubpage, isAuthenticated, parish?.id, confirmationPanelSection]);

  useEffect(() => {
    const normalizedCode = confirmationMeetingInviteToken ? normalizeConfirmationInviteCode(confirmationMeetingInviteToken) : '';
    setConfirmationMeetingInviteCodeInput(normalizedCode);
    setConfirmationMeetingInviteCodeApplied(normalizedCode || null);
  }, [confirmationMeetingInviteToken]);

  useEffect(() => {
    if (!isConfirmationSubpage || confirmationPanelSection !== 'meetings') {
      setConfirmationMeetingPublicData(null);
      setConfirmationMeetingPublicError(null);
      setConfirmationMeetingPublicInfo(null);
      return;
    }

    if (!confirmationMeetingToken) {
      setConfirmationMeetingPublicData(null);
      setConfirmationMeetingPublicError(
        'Aby zapisać się na spotkanie, użyj indywidualnego linku przekazanego przez parafię.'
      );
      setConfirmationMeetingPublicInfo(null);
      return;
    }

    void loadConfirmationMeetingAvailability(confirmationMeetingToken, confirmationMeetingInviteCodeApplied);
  }, [isConfirmationSubpage, confirmationPanelSection, confirmationMeetingToken, confirmationMeetingInviteCodeApplied, parishSlug]);

  useEffect(() => {
    if (!isConfirmationSubpage || confirmationPanelSection !== 'candidate') {
      setConfirmationPortalData(null);
      setConfirmationPortalError(null);
      setConfirmationPortalInfo(null);
      return;
    }
    if (!confirmationPortalToken) {
      setConfirmationPortalData(null);
      setConfirmationPortalError('Aby otworzyć portal kandydata, użyj indywidualnego linku parafii.');
      return;
    }
    void loadConfirmationCandidatePortal(confirmationPortalToken, confirmationMeetingInviteCodeApplied);
  }, [isConfirmationSubpage, confirmationPanelSection, confirmationPortalToken, confirmationMeetingInviteCodeApplied, parishSlug]);

  useEffect(() => {
    if (!isConfirmationSubpage || !isAuthenticated || !parish || confirmationPanelSection !== 'candidate') {
      setConfirmationAdminSelectedCandidateId(null);
      setConfirmationAdminPortalData(null);
      setConfirmationAdminPortalError(null);
      return;
    }

    if (confirmationCandidates.length === 0) {
      setConfirmationAdminSelectedCandidateId(null);
      setConfirmationAdminPortalData(null);
      return;
    }

    const normalizedQuery = confirmationAdminCandidateSearch.trim().toLowerCase();
    const filtered = normalizedQuery.length === 0
      ? confirmationCandidates
      : confirmationCandidates.filter((candidate) =>
          `${candidate.name} ${candidate.surname} ${candidate.address} ${candidate.schoolShort}`
            .toLowerCase()
            .includes(normalizedQuery)
        );

    if (filtered.length === 0) {
      setConfirmationAdminSelectedCandidateId(null);
      setConfirmationAdminPortalData(null);
      return;
    }

    const selectedStillExists = filtered.some((candidate) => candidate.id === confirmationAdminSelectedCandidateId);
    const nextSelectedId = selectedStillExists
      ? confirmationAdminSelectedCandidateId
      : filtered[0].id;
    if (!nextSelectedId) {
      return;
    }
    if (nextSelectedId !== confirmationAdminSelectedCandidateId) {
      setConfirmationAdminSelectedCandidateId(nextSelectedId);
      return;
    }
    void loadConfirmationAdminCandidatePortal(nextSelectedId);
  }, [
    isConfirmationSubpage,
    isAuthenticated,
    parish?.id,
    confirmationPanelSection,
    confirmationCandidates,
    confirmationAdminCandidateSearch,
    confirmationAdminSelectedCandidateId
  ]);

  useEffect(() => {
    if (!isConfirmationSubpage || !parishSlug) return;
    if (isKnownConfirmationSectionPath(confirmationPathSection)) return;
    const nextSection = 'overall';
    navigate(`/parish/${parishSlug}/confirmation/${nextSection}${location.search}`, { replace: true });
  }, [isConfirmationSubpage, parishSlug, confirmationPathSection, location.search, navigate]);

  const parishMockNotice = (
    <section className="parish-section parish-mock-notice-section">
      <article className="parish-card parish-mock-notice" role="status" aria-live="polite">
        <p className="tag">Ważne</p>
        <h2>Treści demonstracyjne (MOCK)</h2>
        <p>
          Wszystkie widoczne tutaj informacje mają charakter demonstracyjny i są w budowie. Nie należy traktować ich
          jako aktualnych informacji parafialnych.
        </p>
      </article>
    </section>
  );

  useEffect(() => {
    setMassRuleConflicts([]);
    setMassRuleValidation([]);
  }, [massFlowNodes, massFlowEdges, massRuleFromDate, massRuleToDate]);

  const announcement = useMemo(
    () => announcements.find((item) => item.id === announcementId) ?? announcements[0],
    [announcementId]
  );
  const selectedEvent = useMemo(
    () => calendarEvents.find((item) => item.id === selectedEventId) ?? calendarEvents[0],
    [selectedEventId]
  );
  const selectedPriest = useMemo(() => priests.find((item) => item.id === selectedPriestId) ?? priests[0], [
    selectedPriestId
  ]);

  const selectedSacrament = useMemo(
    () => sacraments.find((item) => item.id === selectedSacramentId) ?? sacraments[0],
    [selectedSacramentId]
  );
  const selectedSacramentContent = useMemo(
    () => getParishSacramentContent(language, selectedSacrament.id as SacramentContentKey),
    [language, selectedSacrament.id]
  );
  const selectedSacramentFaq = selectedSacramentContent?.faqPage.items ?? sacramentFaq[selectedSacrament.id] ?? [];
  const selectedSacramentParishInfo = useMemo(
    () => [
      `Parafia: ${parish?.name ?? 'Wybrana parafia'}.`,
      'Szczegółowe terminy i harmonogram przygotowania publikuje kancelaria parafialna.',
      'Dokumenty są przyjmowane w kancelarii w godzinach urzędowania.',
      'W kolejnych etapach pojawią się dodatkowe moduły i formularze online dla pozostałych sakramentów.'
    ],
    [parish?.name]
  );
  const selectedSacramentParishPage = siteConfig?.sacramentParishPages?.[selectedSacrament.id] ?? null;
  const filteredConfirmationCandidates = useMemo(() => {
    const query = confirmationAdminCandidateSearch.trim().toLowerCase();
    if (!query) return confirmationCandidates;
    return confirmationCandidates.filter((candidate) =>
      `${candidate.name} ${candidate.surname} ${candidate.address} ${candidate.schoolShort}`
        .toLowerCase()
        .includes(query)
    );
  }, [confirmationCandidates, confirmationAdminCandidateSearch]);
  const selectedSacramentOverallInfo = useMemo(
    () => [
      sacramentDescriptions[selectedSacrament.id],
      'Informacje ogólne mają charakter wspólny dla wszystkich parafii.',
      ...selectedSacrament.steps.map((step) => `Etap: ${step}`)
    ],
    [selectedSacrament]
  );
  const selectedSacramentOverallPage = selectedSacramentContent?.generalPage ?? null;
  const selectedSacramentFaqPage = selectedSacramentContent?.faqPage ?? null;
  const selectedSacramentDisplayTitle = selectedSacramentOverallPage?.title ?? selectedSacrament.title;
  const selectedSacramentLead = selectedSacramentOverallPage?.lead ?? sacramentDescriptions[selectedSacrament.id];
  const selectedSacramentParishSections = selectedSacramentParishPage?.sections ?? [];
  const sacramentMenuLabels = sacramentPanelMenuCopy[language];

  useEffect(() => {
    if (selectedSacramentParishPage) {
      setSacramentParishEditTitle(selectedSacramentParishPage.title ?? '');
      setSacramentParishEditLead(selectedSacramentParishPage.lead ?? '');
      setSacramentParishEditNotice(selectedSacramentParishPage.notice ?? '');
      setSacramentParishEditSections(selectedSacramentParishPage.sections ?? []);
    } else {
      setSacramentParishEditTitle('');
      setSacramentParishEditLead('');
      setSacramentParishEditNotice('');
      setSacramentParishEditSections([]);
    }
    setSacramentParishSaveError(null);
    setSacramentParishSaveInfo(null);
  }, [selectedSacrament.id, selectedSacramentParishPage]);

  const communityData = useMemo(() => {
    if (activePage === 'community-bible' || activePage === 'community-formation') {
      return communityPages[activePage];
    }
    return null;
  }, [activePage]);

  const activeSacramentPanelSection =
    selectedSacrament.id === 'confirmation' ? confirmationPanelSection : sacramentPanelSection;

  const selectPage = (next: PageId) => {
    setActivePage(next);
    setMenuOpen(false);
    setOpenSection(null);
    if (sacramentPageMap[next]) {
      setSelectedSacramentId(sacramentPageMap[next]);
    }
    if (!parishSlug) {
      return;
    }
    if (next === 'sacrament-confirmation') {
      navigate(`/parish/${parishSlug}/confirmation/overall`);
      return;
    }
    if (isConfirmationSubpage) {
      navigate(`/parish/${parishSlug}`);
    }
    if (next.startsWith('sacrament-')) {
      setSacramentPanelSection('overall');
    }
  };
  const openIntentionsPage = () => selectPage('intentions');

  const openSacramentPanelSection = (section: SacramentPanelSection) => {
    if (selectedSacrament.id === 'confirmation') {
      if (!parishSlug) return;
      navigate(`/parish/${parishSlug}/confirmation/${confirmationSectionPath[section]}`);
      return;
    }
    if (section === 'form') {
      return;
    }
    setSacramentPanelSection(section);
  };

  useEffect(() => {
    if (!parishSlug) {
      if (view !== 'builder') {
        setView('chooser');
      }
      return;
    }
    const nextParish = parishOptions.find((item) => item.slug === parishSlug);
    if (nextParish) {
      setParishId(nextParish.id);
      setTheme(nextParish.theme);
      setView('parish');
      if (isConfirmationSubpage) {
        setActivePage('sacrament-confirmation');
        setSelectedSacramentId('confirmation');
      } else if (activePage === 'sacrament-confirmation') {
        setActivePage('start');
      }
    }
  }, [parishSlug, parishOptions, view, isConfirmationSubpage, activePage]);

  const renderModuleContent = (module: ParishLayoutItem, breakpoint: LayoutBreakpoint) => {
    const layout = getLayoutForBreakpoint(module, breakpoint);
    if (module.type === 'sticky') {
      return <StickyModule layout={layout} columns={breakpointColumns[breakpoint]} />;
    }
    if (module.type === 'intentions') {
      return (
        <IntentionsModule
          layout={layout}
          columns={breakpointColumns[breakpoint]}
          items={publicIntentions}
          parishSlug={parishSlug}
          onOpenIntentions={openIntentionsPage}
        />
      );
    }
    if (module.type === 'calendar') {
      return <CalendarModule layout={layout} columns={breakpointColumns[breakpoint]} />;
    }
    return (
      <div className="module-placeholder">
        <p>Moduł: {module.type}</p>
        <span className="muted">
          Rozmiar: {snapColSpan(layout.size.colSpan, breakpointColumns[breakpoint])}x
          {snapRowSpan(layout.size.rowSpan)}
        </span>
      </div>
    );
  };

  const createLayoutItem = (type: string, row = 1, col = 1, breakpoint: LayoutBreakpoint): ParishLayoutItem => {
    const moduleDef = parishModuleCatalog.find((module) => module.type === type);
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${type}-${Date.now()}`;
    const layouts: Partial<Record<LayoutBreakpoint, { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } }>> =
      {};
    BREAKPOINTS.forEach((bp) => {
      layouts[bp] = {
        position: { row: 1, col: 1 },
        size: { colSpan: MIN_COL_SPAN, rowSpan: MIN_ROW_SPAN }
      };
    });
    layouts[breakpoint] = {
      position: { row, col },
      size: { colSpan: MIN_COL_SPAN, rowSpan: MIN_ROW_SPAN }
    };
    return {
      id,
      type,
      layouts,
      position: layouts.desktop?.position,
      size: layouts.desktop?.size,
      props: { title: moduleDef?.label ?? type }
    };
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const parseCellId = (id: string) => {
    if (!id.startsWith('cell:')) return null;
    const [, rowStr, colStr] = id.split(':');
    const row = Number(rowStr);
    const col = Number(colStr);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
    return { row, col };
  };

  const activeBreakpoint = getBreakpointKey(gridColumns);
  const activeColumns = breakpointColumns[activeBreakpoint];

  const getValidDropCells = (
    items: ParishLayoutItem[],
    size: { colSpan: number; rowSpan: number },
    columns: number,
    breakpoint: LayoutBreakpoint,
    excludeId?: string | null
  ) => {
    const occupied = new Set<string>();
    let maxRow = 4;
    items.forEach((item) => {
      if (excludeId && item.id === excludeId) return;
      const layout = getLayoutForBreakpoint(item, breakpoint);
      const colSpan = snapColSpan(layout.size.colSpan, columns);
      const rowSpan = snapRowSpan(layout.size.rowSpan);
      const endRow = layout.position.row + rowSpan - 1;
      maxRow = Math.max(maxRow, endRow);
      for (let r = layout.position.row; r < layout.position.row + rowSpan; r += 1) {
        for (let c = layout.position.col; c < layout.position.col + colSpan; c += 1) {
          occupied.add(`${r}:${c}`);
        }
      }
    });
    const clampedSize = {
      colSpan: snapColSpan(size.colSpan, columns),
      rowSpan: snapRowSpan(size.rowSpan)
    };
    const targetRows = Math.max(4, maxRow + 4);
    const valid = new Set<string>();
    for (let row = 1; row <= targetRows; row += 1) {
      for (let col = 1; col <= columns; col += 1) {
        if (col + clampedSize.colSpan - 1 > columns) continue;
        let overlap = false;
        for (let r = row; r < row + clampedSize.rowSpan; r += 1) {
          for (let c = col; c < col + clampedSize.colSpan; c += 1) {
            if (occupied.has(`${r}:${c}`)) {
              overlap = true;
              break;
            }
          }
          if (overlap) break;
        }
        if (!overlap) valid.add(`${row}:${col}`);
      }
    }
    return { valid, rows: targetRows, size: clampedSize };
  };

  const findFirstValidCell = (
    items: ParishLayoutItem[],
    size: { colSpan: number; rowSpan: number },
    columns: number,
    breakpoint: LayoutBreakpoint
  ) => {
    const { valid } = getValidDropCells(items, size, columns, breakpoint);
    const sorted = Array.from(valid)
      .map((key) => {
        const [rowStr, colStr] = key.split(':');
        return { row: Number(rowStr), col: Number(colStr) };
      })
      .sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));
    return sorted[0] ?? { row: 1, col: 1 };
  };

  const canPlaceItem = (
    items: ParishLayoutItem[],
    candidate: { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } },
    columns: number,
    breakpoint: LayoutBreakpoint,
    excludeId?: string | null
  ) => {
    const colSpan = snapColSpan(candidate.size.colSpan, columns);
    const rowSpan = snapRowSpan(candidate.size.rowSpan);
    const startRow = candidate.position.row;
    const startCol = candidate.position.col;
    if (startRow < 1 || startCol < 1) return false;
    if (startCol + colSpan - 1 > columns) return false;
    const occupied = new Set<string>();
    items.forEach((item) => {
      if (excludeId && item.id === excludeId) return;
      const layout = getLayoutForBreakpoint(item, breakpoint);
      const itemColSpan = snapColSpan(layout.size.colSpan, columns);
      const itemRowSpan = snapRowSpan(layout.size.rowSpan);
      for (let r = layout.position.row; r < layout.position.row + itemRowSpan; r += 1) {
        for (let c = layout.position.col; c < layout.position.col + itemColSpan; c += 1) {
          occupied.add(`${r}:${c}`);
        }
      }
    });
    for (let r = startRow; r < startRow + rowSpan; r += 1) {
      for (let c = startCol; c < startCol + colSpan; c += 1) {
        if (occupied.has(`${r}:${c}`)) return false;
      }
    }
    return true;
  };

  const handleLayoutDragStart = (
    event: DragStartEvent,
    layout: 'builder' | 'edit',
    items: ParishLayoutItem[],
    onSelect: (id: string) => void
  ) => {
    const activeId = String(event.active.id);
    if (activeId.startsWith('palette:')) {
      const size = {
        colSpan: MIN_COL_SPAN,
        rowSpan: MIN_ROW_SPAN
      };
      setDragState({
        layout,
        activeId,
        activeType: 'palette',
        activeItemId: null,
        size,
        overCell: null,
        overValid: false
      });
      return;
    }
    if (activeId.startsWith('item:')) {
      const itemId = activeId.replace('item:', '');
      const existing = items.find((item) => item.id === itemId);
      if (!existing) return;
      onSelect(itemId);
      const layoutFrame = getLayoutForBreakpoint(existing, activeBreakpoint);
      setDragState({
        layout,
        activeId,
        activeType: 'item',
        activeItemId: itemId,
        size: { ...layoutFrame.size },
        overCell: null,
        overValid: false
      });
    }
  };

  const handleLayoutDragOver = (
    event: DragOverEvent,
    layout: 'builder' | 'edit',
    items: ParishLayoutItem[]
  ) => {
    if (dragState.layout !== layout || !dragState.size) return;
    const { over } = event;
    if (!over) {
      setDragState((prev) => ({ ...prev, overCell: null, overValid: false }));
      return;
    }
    const target = parseCellId(String(over.id));
    if (!target) {
      setDragState((prev) => ({ ...prev, overCell: null, overValid: false }));
      return;
    }
    const { valid } = getValidDropCells(
      items,
      dragState.size,
      activeColumns,
      activeBreakpoint,
      dragState.activeItemId ?? undefined
    );
    const key = `${target.row}:${target.col}`;
    setDragState((prev) => ({
      ...prev,
      overCell: target,
      overValid: valid.has(key)
    }));
  };

  const handleLayoutDragCancel = () => {
    setDragState({
      layout: null,
      activeId: null,
      activeType: null,
      activeItemId: null,
      size: null,
      overCell: null,
      overValid: false
    });
  };

  const handleLayoutDragEnd = (
    event: DragEndEvent,
    layout: 'builder' | 'edit',
    items: ParishLayoutItem[],
    setItems: Dispatch<SetStateAction<ParishLayoutItem[]>>,
    onSelect: (id: string) => void
  ) => {
    const { active, over } = event;
    const activeId = String(active.id);
    if (!over) {
      handleLayoutDragCancel();
      return;
    }
    const target = parseCellId(String(over.id));
    if (!target) {
      handleLayoutDragCancel();
      return;
    }
    if (dragState.layout !== layout || !dragState.size) {
      handleLayoutDragCancel();
      return;
    }
    const { valid } = getValidDropCells(
      items,
      dragState.size,
      activeColumns,
      activeBreakpoint,
      dragState.activeItemId ?? undefined
    );
    const key = `${target.row}:${target.col}`;
    if (!valid.has(key)) {
      handleLayoutDragCancel();
      return;
    }
    if (activeId.startsWith('palette:')) {
      const type = activeId.replace('palette:', '');
      const newItem = ensureLayouts(createLayoutItem(type, target.row, target.col, activeBreakpoint));
      const sizedLayout = getLayoutForBreakpoint(newItem, activeBreakpoint);
      const layouts = { ...(newItem.layouts ?? {}) } as Record<
        LayoutBreakpoint,
        { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } }
      >;
      BREAKPOINTS.forEach((bp) => {
        const columns = breakpointColumns[bp];
        const snappedSize = {
          colSpan: snapColSpan(sizedLayout.size.colSpan, columns),
          rowSpan: snapRowSpan(sizedLayout.size.rowSpan)
        };
        if (bp === activeBreakpoint) {
          layouts[bp] = {
            position: { row: target.row, col: target.col },
            size: snappedSize
          };
          return;
        }
        const first = findFirstValidCell(items, snappedSize, columns, bp);
        layouts[bp] = {
          position: first,
          size: snappedSize
        };
      });
      const next = [
        ...items,
        {
          ...newItem,
          layouts,
          position: layouts.desktop?.position ?? newItem.position,
          size: layouts.desktop?.size ?? newItem.size
        }
      ];
      setItems(next);
      onSelect(newItem.id);
      handleLayoutDragCancel();
      return;
    }
    if (activeId.startsWith('item:')) {
      const itemId = activeId.replace('item:', '');
      const existing = items.find((item) => item.id === itemId);
      if (!existing) {
        handleLayoutDragCancel();
        return;
      }
      const updated = items.map((item) => {
        if (item.id !== itemId) return item;
        const layouts = { ...(item.layouts ?? {}) } as Record<LayoutBreakpoint, { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } }>;
        const existingLayout = getLayoutForBreakpoint(item, activeBreakpoint);
        layouts[activeBreakpoint] = {
          position: { row: target.row, col: target.col },
          size: { ...existingLayout.size }
        };
        return {
          ...item,
          layouts,
          position: layouts.desktop?.position ?? item.position,
          size: layouts.desktop?.size ?? item.size
        };
      });
      setItems(updated);
      onSelect(itemId);
    }
    handleLayoutDragCancel();
  };

  const compactLayout = (items: ParishLayoutItem[], setItems: Dispatch<SetStateAction<ParishLayoutItem[]>>) => {
    setItems(normalizeLayoutsForBreakpoint(items, activeBreakpoint, activeColumns));
  };

  const PaletteButton = ({ type, label }: { type: string; label: string }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` });
    return (
      <button
        ref={setNodeRef}
        type="button"
        className={`module-pill ${isDragging ? 'is-dragging' : ''}`}
        {...listeners}
        {...attributes}
      >
        {label}
      </button>
    );
  };

  const DroppableCell = ({
    row,
    col,
    isValid,
    isActive
  }: {
    row: number;
    col: number;
    isValid: boolean;
    isActive: boolean;
  }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `cell:${row}:${col}` });
    return (
      <div
        ref={setNodeRef}
        className={`editor-cell is-dropzone ${isActive ? 'is-active' : ''} ${isValid ? 'is-valid' : ''} ${
          isOver ? 'is-over' : ''
        }`}
      />
    );
  };

  const GridItem = ({
    item,
    frame,
    isActive,
    onSelect,
    isHidden,
    onResizeStart,
    children
  }: {
    item: ParishLayoutItem;
    frame: { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } };
    isActive?: boolean;
    onSelect?: () => void;
    isHidden?: boolean;
    onResizeStart?: (
      handle:
        | 'left'
        | 'right'
        | 'top'
        | 'bottom'
        | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right',
      event: ReactPointerEvent<HTMLButtonElement>
    ) => void;
    children?: React.ReactNode;
  }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${item.id}` });
    return (
      <div
        ref={setNodeRef}
        className={`editor-module ${isActive ? 'is-active' : ''} ${isDragging ? 'is-dragging' : ''} ${
          isHidden ? 'is-hidden' : ''
        }`}
        style={{
          gridColumn: `${frame.position.col} / span ${snapColSpan(frame.size.colSpan, activeColumns)}`,
          gridRow: `${frame.position.row} / span ${snapRowSpan(frame.size.rowSpan)}`
        }}
        onClick={onSelect}
        {...listeners}
        {...attributes}
      >
        <div className="editor-module-content">{children}</div>
        {onResizeStart ? (
          <>
            <button
              type="button"
              className="resize-handle resize-handle-left"
              aria-label="Zmień szerokość modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('left', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-right"
              aria-label="Zmień szerokość modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('right', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-top"
              aria-label="Zmień wysokość modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('top', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-bottom"
              aria-label="Zmień wysokość modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('bottom', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-top-left"
              aria-label="Zmień rozmiar modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('top-left', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-top-right"
              aria-label="Zmień rozmiar modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('top-right', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-bottom-left"
              aria-label="Zmień rozmiar modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('bottom-left', event);
              }}
            />
            <button
              type="button"
              className="resize-handle resize-handle-bottom-right"
              aria-label="Zmień rozmiar modułu"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart('bottom-right', event);
              }}
            />
          </>
        ) : null}
      </div>
    );
  };

  const builderSteps = ['Dane podstawowe', 'Zawartość', 'Wygląd', 'Podsumowanie'];
  const selectedModuleLabels = builderLayoutItems.map((module) => module.type);
  const homepageModules = (siteConfig ?? defaultHomepageConfig).modules;
  const dragLabel = useMemo(() => {
    if (!dragState.activeId) return 'Moduł';
    if (dragState.activeType === 'palette') {
      const type = dragState.activeId.replace('palette:', '');
      return parishModuleCatalog.find((module) => module.type === type)?.label ?? type;
    }
    if (dragState.activeType === 'item') {
      const itemId = dragState.activeId.replace('item:', '');
      const source =
        (dragState.layout === 'builder' ? builderLayoutItems : editLayoutItems).find(
          (item) => item.id === itemId
        ) ?? null;
      return source?.type ?? 'Moduł';
    }
    return 'Moduł';
  }, [dragState, builderLayoutItems, editLayoutItems]);
  const builderDragActive = dragState.layout === 'builder' && !!dragState.activeId;
  const builderDropInfo =
    builderDragActive && dragState.size
      ? getValidDropCells(
          builderLayoutItems,
          dragState.size,
          activeColumns,
          activeBreakpoint,
          dragState.activeItemId
        )
      : null;
  const editDragActive = dragState.layout === 'edit' && !!dragState.activeId;
  const editDropInfo =
    editDragActive && dragState.size
      ? getValidDropCells(editLayoutItems, dragState.size, activeColumns, activeBreakpoint, dragState.activeItemId)
      : null;
  const selectedMassRuleNode = useMemo(() => {
    if (!selectedMassFlowNodeId) return null;
    const node = massFlowNodes.find((item) => item.id === selectedMassFlowNodeId);
    if (!node) return null;
    const nextEdge = massFlowEdges.find(
      (edge) => edge.source === node.id && normalizeEdgeHandle(edge.sourceHandle) === 'next'
    );
    const elseEdge = massFlowEdges.find(
      (edge) => edge.source === node.id && normalizeEdgeHandle(edge.sourceHandle) === 'else'
    );
    return {
      id: node.id,
      type: node.data.type,
      nextId: nextEdge?.target ?? null,
      elseId: elseEdge?.target ?? null,
      config: node.data.config ?? {}
    } as ParishMassRuleNode;
  }, [selectedMassFlowNodeId, massFlowNodes, massFlowEdges]);
  const selectedMassRuleDefinition = selectedMassRuleNode
    ? massRuleDefinitionsByType[selectedMassRuleNode.type]
    : null;
  const selectedMassRuleFields = useMemo(() => {
    if (!selectedMassRuleNode) return [] as MassRuleConfigField[];
    const configured = selectedMassRuleDefinition?.fields ?? [];
    const configuredKeys = new Set(configured.map((field) => field.key));
    const extra = Object.keys(selectedMassRuleNode.config ?? {})
      .filter((key) => !key.startsWith('_') && !configuredKeys.has(key))
      .map((key) => ({ key, label: key } as MassRuleConfigField));
    return [...configured, ...extra];
  }, [selectedMassRuleDefinition, selectedMassRuleNode]);
  const filteredMassRuleTemplates = useMemo(() => {
    const search = massNodeSearch.trim().toLowerCase();
    return massRuleNodeTemplates.filter((template) => {
      const category = getMassNodeCategory(template.type);
      if (massNodeCategoryFilter !== 'all' && category !== massNodeCategoryFilter) return false;
      if (!search) return true;
      const definition = massRuleDefinitionsByType[template.type];
      const hay = `${template.label} ${definition?.description ?? ''} ${template.type}`.toLowerCase();
      return hay.includes(search);
    });
  }, [massNodeSearch, massNodeCategoryFilter]);
  const renderedMassFlowNodes = useMemo(
    () =>
      massFlowNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          requireIntentions: massRuleRequireIntentions,
          emitConflicts: node.data.type === 'Emit' ? massRuleConflicts.length : 0
        }
      })),
    [massFlowNodes, massRuleRequireIntentions, massRuleConflicts.length]
  );
  const renderedMassFlowEdges = useMemo(
    () => decorateFlowEdges(massFlowEdges, renderedMassFlowNodes),
    [massFlowEdges, renderedMassFlowNodes]
  );
  const massRulePreviewConflictKeys = useMemo(() => {
    const counts = new Map<string, number>();
    massRulePreview.forEach((item) => {
      const key = new Date(item.massDateTime).toISOString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key));
  }, [massRulePreview]);
  const massesOfSelectedDay = useMemo(() => {
    if (!newMassDay) return [] as ParishPublicMass[];
    return publicMasses
      .filter((mass) => {
        const isoDay = new Date(mass.massDateTime).toISOString().slice(0, 10);
        return isoDay === newMassDay;
      })
      .sort((a, b) => new Date(a.massDateTime).getTime() - new Date(b.massDateTime).getTime());
  }, [publicMasses, newMassDay]);


  const handleSaveLayout = async () => {
    if (!parish) return;
    try {
      setEditError(null);
      const homepage: ParishHomepageConfig = {
        modules: editLayoutItems,
        sacramentParishPages: siteConfig?.sacramentParishPages ?? null
      };
      await updateParishSite(parish.id, { homepage, isPublished: true });
      setSiteConfig(homepage);
      setEditMode(false);
    } catch {
      setEditError('Nie udało się zapisać układu strony.');
    }
  };

  const handleAddMass = async () => {
    if (!parish) return;
    if (!newMassDay || !newMassTime || !newMassChurch || !newMassTitle) {
      setAdminFormError('Uzupełnij datę, kościół i nazwę mszy.');
      return;
    }
    setAdminFormError(null);
    try {
      const massDateTime = new Date(`${newMassDay}T${newMassTime}`).toISOString();
      const payload = {
        massDateTime,
        churchName: newMassChurch,
        title: newMassTitle,
        note: newMassNote || null,
        isCollective: newMassCollective,
        durationMinutes: Number.isFinite(Number(newMassDurationMinutes)) ? Number(newMassDurationMinutes) : null,
        kind: newMassKind || null,
        beforeService: newMassBeforeService || null,
        afterService: newMassAfterService || null,
        donationSummary: newMassDonationSummary || null,
        intentions: newMassIntentionsRaw
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => {
            const [text, donation] = line.split('|').map((x) => x.trim());
            return { text, donation: donation || null };
          })
      };
      if (editingMassId) {
        await updateParishMass(parish.id, editingMassId, payload);
      } else {
        await createParishMass(parish.id, payload);
      }
      setNewMassTime('18:00');
      setEditingMassId(null);
      setNewMassChurch('');
      setNewMassTitle('');
      setNewMassNote('');
      setNewMassKind('');
      setNewMassDurationMinutes('60');
      setNewMassBeforeService('');
      setNewMassAfterService('');
      setNewMassDonationSummary('');
      setNewMassIntentionsRaw('');
      setNewMassCollective(false);
      if (parishSlug) {
        const items = await getParishPublicMasses(parishSlug);
        setPublicMasses(items);
      }
    } catch {
      setAdminFormError('Nie udało się zapisać mszy.');
    }
  };

  const handlePickMassForEdit = (mass: ParishPublicMass) => {
    const dt = new Date(mass.massDateTime);
    const day = dt.toISOString().slice(0, 10);
    const time = dt.toISOString().slice(11, 16);
    setEditingMassId(mass.id);
    setNewMassDay(day);
    setNewMassTime(time);
    setNewMassChurch(mass.churchName ?? '');
    setNewMassTitle(mass.title ?? '');
    setNewMassNote(mass.note ?? '');
    setNewMassKind(mass.kind ?? '');
    setNewMassDurationMinutes(mass.durationMinutes ? String(mass.durationMinutes) : '60');
    setNewMassBeforeService(mass.beforeService ?? '');
    setNewMassAfterService(mass.afterService ?? '');
    setNewMassDonationSummary(mass.donationSummary ?? '');
    setNewMassCollective(Boolean(mass.isCollective));
    try {
      const intentions = mass.intentionsJson ? (JSON.parse(mass.intentionsJson) as Array<{ text: string; donation?: string | null }>) : [];
      setNewMassIntentionsRaw(intentions.map((item) => `${item.text}${item.donation ? ` | ${item.donation}` : ''}`).join('\n'));
    } catch {
      setNewMassIntentionsRaw('');
    }
  };

  const handleAddRuleNode = (type: string) => {
    const template = massRuleNodeTemplates.find((item) => item.type === type);
    if (!template) return;
    const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let wasEmpty = false;
    setMassFlowNodes((current) => {
      if (current.length === 0) {
        wasEmpty = true;
      }
      const nextNode: Node<MassRuleNodeData> = {
        id,
        type: 'massRuleNode',
        position: {
          x: 120 + (current.length % 3) * 260,
          y: 60 + Math.floor(current.length / 3) * 180
        },
        data: {
          label: id,
          type: template.type,
          config: { ...template.config }
        }
      };
      return [...current, nextNode];
    });
    if (selectedMassFlowNodeId) {
      updateRuleNodeConnection(selectedMassFlowNodeId, 'next', id);
    } else if (wasEmpty) {
      setMassRuleStartNodeId(id);
    }
    setSelectedMassFlowNodeId(id);
  };

  const handleDuplicateSelectedRuleNode = () => {
    if (!selectedMassRuleNode) return;
    const definition = massRuleDefinitionsByType[selectedMassRuleNode.type];
    const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setMassFlowNodes((current) => {
      const source = current.find((item) => item.id === selectedMassRuleNode.id);
      if (!source) return current;
      return [
        ...current,
        {
          ...source,
          id,
          position: { x: source.position.x + 48, y: source.position.y + 48 },
          data: {
            ...source.data,
            label: id,
            type: definition?.type ?? source.data.type,
            config: { ...(source.data.config ?? {}) }
          }
        }
      ];
    });
    setSelectedMassFlowNodeId(id);
  };

  const handleDeleteSelectedRuleNode = () => {
    if (!selectedMassRuleNode) return;
    const nodeId = selectedMassRuleNode.id;
    setMassFlowNodes((current) => {
      const next = current.filter((item) => item.id !== nodeId);
      if (massRuleStartNodeId === nodeId) {
        setMassRuleStartNodeId(next[0]?.id ?? '');
      }
      return next;
    });
    setMassFlowEdges((current) => normalizeFlowEdges(current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)));
    setSelectedMassFlowNodeId(null);
  };

  const handleNewMassRule = () => {
    const seedEdges = toFlowEdgesFromRuleNodes(defaultMassRuleSeed);
    const seedNodes = autoLayoutMassFlow(toFlowNodesFromRuleNodes(defaultMassRuleSeed), seedEdges, 'node-1');
    setSelectedMassRuleId(null);
    setMassRuleName('Nowa reguła');
    setMassRuleDescription('');
    setMassRuleStartNodeId('node-1');
    setMassFlowNodes(seedNodes);
    setMassFlowEdges(seedEdges);
    setMassRuleConflicts([]);
    setMassRuleValidation([]);
    setMassRuleWarning(null);
    setSelectedMassFlowNodeId(null);
  };

  const validateMassGraph = (): ValidationFinding[] => {
    const findings: ValidationFinding[] = [];
    if (!massRuleStartNodeId || !massFlowNodes.some((node) => node.id === massRuleStartNodeId)) {
      findings.push({ level: 'error', message: 'Brak poprawnego node startowego.' });
    }
    if (!massFlowNodes.some((node) => node.data.type === 'Emit')) {
      findings.push({ level: 'error', message: 'Graf nie zawiera node "Zapisz mszę".' });
    }
    massFlowNodes.forEach((node) => {
      if (node.data.type === 'MassTemplate' && !(node.data.config?.time ?? '').trim()) {
        findings.push({ level: 'error', message: `Node ${node.id}: brak godziny mszy.` });
      }
      if (node.data.type === 'AddIntention' && massRuleRequireIntentions && parseIntentionLines(node.data.config?.text).length === 0) {
        findings.push({ level: 'warning', message: `Node ${node.id}: brak treści intencji.` });
      }
      const outgoing = massFlowEdges.filter((edge) => edge.source === node.id);
      if (node.data.type !== 'Stop' && outgoing.length === 0) {
        findings.push({ level: 'warning', message: `Node ${node.id}: brak wyjścia.` });
      }
      if (isMassConditionType(node.data.type)) {
        const hasTrue = outgoing.some((edge) => normalizeEdgeHandle(edge.sourceHandle) === 'next');
        const hasFalse = outgoing.some((edge) => normalizeEdgeHandle(edge.sourceHandle) === 'else');
        if (!hasTrue || !hasFalse) {
          findings.push({ level: 'warning', message: `Node ${node.id}: warunek powinien mieć gałąź TRUE i FALSE.` });
        }
      }
    });
    return findings;
  };

  const handleValidateMassGraph = () => {
    const findings = validateMassGraph();
    setMassRuleValidation(findings);
    const firstError = findings.find((item) => item.level === 'error');
    if (firstError) {
      setAdminFormError(firstError.message);
    } else {
      setAdminFormError(null);
    }
  };

  const handleMassNodesChange = (changes: NodeChange[]) => {
    setMassFlowNodes((current) => {
      const nextNodes = applyNodeChanges(changes, current);
      const ids = new Set(nextNodes.map((node) => node.id));
      setMassFlowEdges((edges) =>
        normalizeFlowEdges(edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)))
      );
      return nextNodes;
    });
  };

  const handleMassNodeDragStop = (_: unknown, node: Node<MassRuleNodeData>) => {
    const nextX = String(Math.round(node.position.x));
    const nextY = String(Math.round(node.position.y));
    setMassFlowNodes((current) =>
      current.map((item) =>
        item.id === node.id
          ? {
              ...item,
              position: node.position,
              data: {
                ...item.data,
                config: {
                  ...(item.data.config ?? {}),
                  _x: nextX,
                  _y: nextY
                }
              }
            }
          : item
      )
    );
  };

  const handleMassEdgesChange = (changes: EdgeChange[]) => {
    setMassFlowEdges((current) => normalizeFlowEdges(applyEdgeChanges(changes, current)));
  };

  const handleMassConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const source = connection.source;
    const target = connection.target;
    const sourceHandle = connection.sourceHandle ?? 'next';
    setMassFlowEdges((current) =>
      normalizeFlowEdges(
        addEdge(
        {
          id: `${source}:${sourceHandle}:${target}`,
          source,
          target,
          sourceHandle
        },
        current.filter(
          (edge) =>
            !(edge.source === source && normalizeEdgeHandle(edge.sourceHandle) === sourceHandle)
        )
        )
      )
    );
  };

  const updateRuleNodeType = (nodeId: string, nextType: string) => {
    setMassFlowNodes((current) =>
      current.map((item) =>
        item.id === nodeId
          ? {
              ...item,
              data: {
                ...item.data,
                type: nextType
              }
            }
          : item
      )
    );
  };

  const updateRuleNodeConfig = (nodeId: string, key: string, value: string) => {
    setMassFlowNodes((current) =>
      current.map((item) =>
        item.id === nodeId
          ? {
              ...item,
              data: {
                ...item.data,
                config: {
                  ...(item.data.config ?? {}),
                  [key]: value
                }
              }
            }
          : item
      )
    );
  };

  const updateRuleNodeConnection = (nodeId: string, handle: 'next' | 'else', target: string | null) => {
    setMassFlowEdges((current) => {
      const withoutHandle = current.filter(
        (edge) => !(edge.source === nodeId && normalizeEdgeHandle(edge.sourceHandle) === handle)
      );
      if (!target) {
        return normalizeFlowEdges(withoutHandle);
      }
      return normalizeFlowEdges([
        ...withoutHandle,
        {
          id: `${nodeId}:${handle}:${target}`,
          source: nodeId,
          target,
          sourceHandle: handle
        }
      ]);
    });
  };

  const handleAutoLayoutMassGraph = () => {
    setMassFlowNodes((current) => autoLayoutMassFlow(current, massFlowEdges, massRuleStartNodeId));
  };

  const handleSaveMassRule = async () => {
    if (!parish) return;
    if (!massRuleName.trim()) {
      setAdminFormError('Podaj nazwę reguły.');
      return;
    }
    if (!massRuleStartNodeId.trim()) {
      setAdminFormError('Podaj startowy node reguły.');
      return;
    }
    setAdminFormError(null);
    setMassRuleWarning(null);
    const validationFindings = validateMassGraph();
    setMassRuleValidation(validationFindings);
    const blocking = validationFindings.find((item) => item.level === 'error');
    if (blocking) {
      setAdminFormError(blocking.message);
      return;
    }
    try {
      const ruleNodes = toRuleNodesFromFlow(massFlowNodes, massFlowEdges);
      const missingTimeNode = ruleNodes.find(
        (node) => node.type === 'MassTemplate' && !(node.config?.time ?? '').trim()
      );
      if (missingTimeNode) {
        setSelectedMassFlowNodeId(missingTimeNode.id);
        setAdminFormError('Szablon mszy ma brak godziny (⏰ brak). Uzupełnij przed zapisem.');
        return;
      }
      if (
        massRuleRequireIntentions &&
        !ruleNodes.some((node) => node.type === 'AddIntention' && (node.config?.text ?? '').trim().length > 0)
      ) {
        setMassRuleWarning('Wymagane intencje: w grafie brak aktywnego node Dodaj intencje.');
      }
      const payload = {
        name: massRuleName.trim(),
        description: massRuleDescription.trim() || null,
        graph: {
          startNodeId: massRuleStartNodeId.trim(),
          nodes: ruleNodes.map((node) => ({
            id: node.id,
            type: node.type,
            nextId: node.nextId ?? null,
            elseId: node.elseId ?? null,
            config: node.config ?? {}
          })),
          metadata: {
            builtins: 'easter,advent,christmas,lent,ordinary,weekday-nth'
          }
        }
      };

      let currentRuleId = selectedMassRuleId;
      if (selectedMassRuleId) {
        await updateParishMassRule(parish.id, selectedMassRuleId, payload);
      } else {
        currentRuleId = await createParishMassRule(parish.id, payload);
      }
      const rules = await listParishMassRules(parish.id);
      setMassRules(rules);
      setSelectedMassRuleId(currentRuleId);
    } catch {
      setAdminFormError('Nie udało się zapisać reguły.');
    }
  };

  const handleSimulateMassRule = async () => {
    if (!parish || !selectedMassRuleId || !massRuleFromDate || !massRuleToDate) {
      setAdminFormError('Wybierz regułę oraz zakres dat do symulacji.');
      return;
    }
    setAdminFormError(null);
    setMassRuleWarning(null);
    try {
      const preview = await simulateParishMassRule(parish.id, selectedMassRuleId, {
        fromDate: massRuleFromDate,
        toDate: massRuleToDate,
        includeExisting: false
      });
      setMassRulePreview(preview);
      const bySlot = new Map<string, number>();
      preview.forEach((item) => {
        const key = new Date(item.massDateTime).toISOString();
        bySlot.set(key, (bySlot.get(key) ?? 0) + 1);
      });
      const conflicts = Array.from(bySlot.entries())
        .filter(([, count]) => count > 1)
        .map(([slot, count]) => `${new Date(slot).toLocaleString()} (${count} wpisy)`);
      setMassRuleConflicts(conflicts);
      if (conflicts.length > 0) {
        setMassRuleWarning('W podglądzie są kolizje terminów. Sprawdź listę konfliktów.');
      }
    } catch {
      setAdminFormError('Nie udało się zasymulować reguły.');
    }
  };

  const handleApplyMassRule = async () => {
    if (!parish || !selectedMassRuleId || !massRuleFromDate || !massRuleToDate) {
      setAdminFormError('Wybierz regułę oraz zakres dat.');
      return;
    }
    setAdminFormError(null);
    setMassRuleWarning(null);
    if (massRuleConflicts.length > 0) {
      setAdminFormError('Wykryto kolizje terminów w podglądzie. Popraw graf przed zastosowaniem.');
      return;
    }
    try {
      await applyParishMassRule(parish.id, selectedMassRuleId, {
        fromDate: massRuleFromDate,
        toDate: massRuleToDate,
        replaceExisting: massRuleReplaceExisting
      });
      if (parishSlug) {
        const items = await getParishPublicMasses(parishSlug);
        setPublicMasses(items);
      }
    } catch {
      setAdminFormError('Nie udało się zastosować reguły.');
    }
  };

  const handleAddSacramentParishSection = () => {
    setSacramentParishEditSections((current) => [...current, { title: '', body: '' }]);
  };

  const handleUpdateSacramentParishSection = (index: number, key: 'title' | 'body', value: string) => {
    setSacramentParishEditSections((current) =>
      current.map((section, sectionIndex) =>
        sectionIndex === index
          ? {
              ...section,
              [key]: value
            }
          : section
      )
    );
  };

  const handleRemoveSacramentParishSection = (index: number) => {
    setSacramentParishEditSections((current) => current.filter((_, sectionIndex) => sectionIndex !== index));
  };

  const handleSaveSacramentParishPage = async () => {
    if (!parish || !siteConfig) return;

    const title = sacramentParishEditTitle.trim();
    const lead = sacramentParishEditLead.trim();
    const notice = sacramentParishEditNotice.trim();
    const sections = sacramentParishEditSections
      .map((section) => ({
        title: section.title.trim(),
        body: section.body.trim()
      }))
      .filter((section) => section.title.length > 0 || section.body.length > 0);

    const clearRequested = title.length === 0 && lead.length === 0 && notice.length === 0 && sections.length === 0;

    if (!clearRequested && (title.length === 0 || lead.length === 0 || sections.length === 0)) {
      setSacramentParishSaveError('Aby zapisać stronę parafialną, uzupełnij tytuł, lead i co najmniej jedną sekcję.');
      setSacramentParishSaveInfo(null);
      return;
    }

    setSacramentParishSaving(true);
    setSacramentParishSaveError(null);
    setSacramentParishSaveInfo(null);
    try {
      const nextPages = { ...(siteConfig.sacramentParishPages ?? {}) };
      if (clearRequested) {
        delete nextPages[selectedSacrament.id];
      } else {
        nextPages[selectedSacrament.id] = {
          title,
          lead,
          notice: notice || null,
          sections
        };
      }

      const normalizedPages = Object.keys(nextPages).length > 0 ? nextPages : null;
      const nextHomepage: ParishHomepageConfig = {
        ...siteConfig,
        sacramentParishPages: normalizedPages
      };

      await updateParishSite(parish.id, {
        homepage: nextHomepage,
        isPublished: true
      });

      setSiteConfig(nextHomepage);
      setSacramentParishSaveInfo(clearRequested ? 'Treść parafialna została wyczyszczona.' : 'Treść parafialna została zapisana.');
    } catch {
      setSacramentParishSaveError('Nie udało się zapisać treści parafialnej.');
    } finally {
      setSacramentParishSaving(false);
    }
  };

  const handleSubmitConfirmationCandidate = async () => {
    if (!parishSlug) return;
    const phoneRows = confirmationPhonesRaw
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const invalidPhones = phoneRows.filter((item) => !normalizePolishPhone(item));
    const phoneNumbers = phoneRows
      .map((item) => normalizePolishPhone(item))
      .filter((item): item is string => Boolean(item));

    if (
      !confirmationName.trim() ||
      !confirmationSurname.trim() ||
      !confirmationAddress.trim() ||
      !confirmationSchoolShort.trim()
    ) {
      setConfirmationFormError('Uzupełnij imię, nazwisko, adres i szkołę.');
      setConfirmationFormSuccess(null);
      return;
    }
    if (phoneNumbers.length === 0) {
      setConfirmationFormError('Podaj co najmniej jeden numer telefonu.');
      setConfirmationFormSuccess(null);
      return;
    }
    if (invalidPhones.length > 0) {
      setConfirmationFormError('Każdy numer telefonu musi mieć format +48 i 9 cyfr.');
      setConfirmationFormSuccess(null);
      return;
    }
    if (!confirmationAcceptedRodo) {
      setConfirmationFormError('Musisz zaakceptować RODO.');
      setConfirmationFormSuccess(null);
      return;
    }

    setConfirmationSubmitting(true);
    setConfirmationFormError(null);
    setConfirmationFormSuccess(null);
    try {
      await createParishConfirmationCandidate(parishSlug, {
        name: confirmationName.trim(),
        surname: confirmationSurname.trim(),
        phoneNumbers,
        address: confirmationAddress.trim(),
        schoolShort: confirmationSchoolShort.trim(),
        acceptedRodo: true
      });
      setConfirmationName('');
      setConfirmationSurname('');
      setConfirmationPhonesRaw('');
      setConfirmationAddress('');
      setConfirmationSchoolShort('');
      setConfirmationAcceptedRodo(false);
      setConfirmationFormSuccess('Zgłoszenie zostało wysłane.');
      if (isAuthenticated && parish) {
        await loadConfirmationCandidates();
        await loadConfirmationMeetingSummary();
      }
    } catch {
      setConfirmationFormError('Nie udało się wysłać zgłoszenia.');
    } finally {
      setConfirmationSubmitting(false);
    }
  };

  const buildConfirmationVerificationLink = (token: string) => {
    if (!parishSlug || !token) return '';
    return `${window.location.origin}/#/parish/${parishSlug}/confirmation/form?verifyPhone=${encodeURIComponent(token)}`;
  };

  const buildConfirmationSmsHref = (phoneNumber: string, messageText: string) => {
    if (!messageText.trim()) return '';
    const normalizedPhone = normalizePolishPhone(phoneNumber) ?? phoneNumber.replace(/[^\d+]/g, '');
    const smsTarget = normalizedPhone.length > 0 ? `sms:${normalizedPhone}` : 'sms:';
    return `${smsTarget}?body=${encodeURIComponent(messageText)}`;
  };

  const buildConfirmationVerificationSmsHref = (phoneNumber: string, token: string) => {
    const verificationLink = buildConfirmationVerificationLink(token);
    if (!verificationLink) return '';
    const parishLabel = parish?.name?.trim() || 'parafii św. Jana Chrzciciela';
    const message =
      `Szczęść Boże!\n` +
      `Ten numer telefonu został podany przy zgłoszeniu do przygotowania do bierzmowania w parafii św. Jana Chrzciciela.\n` +
      `Aby potwierdzić numer, proszę kliknąć w poniższy link:\n${verificationLink}`;
    return buildConfirmationSmsHref(phoneNumber, message);
  };

  const buildConfirmationVerificationWarningSmsHref = (phoneNumber: string, token: string) => {
    const verificationLink = buildConfirmationVerificationLink(token);
    if (!verificationLink) return '';
    const parishLabel = parish?.name?.trim() || 'parafii św. Jana Chrzciciela';
    const message =
      `Szczęść Boże!\n` +
      `Przypominamy o konieczności potwierdzenia numeru telefonu dla przygotowania do bierzmowania w parafii św. Jana Chrzciciela.\n` +
      `Brak weryfikacji spowoduje usunięcie numeru z listy kontaktowej.\n` +
      `Link do weryfikacji:\n${verificationLink}`;
    return buildConfirmationSmsHref(phoneNumber, message);
  };

  const buildConfirmationPortalInviteSmsHref = (phoneNumber: string, portalToken: string) => {
    const portalLink = buildConfirmationMeetingLink(portalToken);
    if (!portalLink) return '';
    const parishLabel = parish?.name?.trim() || 'parafii św. Jana Chrzciciela';
    const message =
      `Szczęść Boże!\n` +
      `Numer telefonu został potwierdzony. Zapraszamy do portalu kandydata przygotowania do bierzmowania w parafii św. Jana Chrzciciela.\n` +
      `Twój indywidualny link:\n${portalLink}`;
    return buildConfirmationSmsHref(phoneNumber, message);
  };

  const handleCopyConfirmationVerificationLink = async (token: string) => {
    if (!parishSlug || !token) return;
    const link = buildConfirmationVerificationLink(token);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setConfirmationCopiedToken(token);
      window.setTimeout(() => {
        setConfirmationCopiedToken((current) => (current === token ? null : current));
      }, 1800);
    } catch {
      setConfirmationCandidatesError('Nie udało się skopiować linku weryfikacyjnego.');
    }
  };

  const startResize = (
    layout: 'builder' | 'edit',
    item: ParishLayoutItem,
    handle:
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right',
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const grid = editorGridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const totalWidth = rect.width;
    const cellWidth =
      gridColumns > 0 ? (totalWidth - EDITOR_GAP * (gridColumns - 1)) / gridColumns : totalWidth;
    const layoutFrame = getLayoutForBreakpoint(item, activeBreakpoint);
    const colSpan = snapColSpan(layoutFrame.size.colSpan, activeColumns);
    const rowSpan = snapRowSpan(layoutFrame.size.rowSpan);
    setResizeState({
      layout,
      itemId: item.id,
      originColStart: layoutFrame.position.col,
      originColEnd: layoutFrame.position.col + colSpan - 1,
      originRowStart: layoutFrame.position.row,
      originRowEnd: layoutFrame.position.row + rowSpan - 1,
      gridLeft: rect.left,
      gridTop: rect.top,
      cellWidth,
      rowHeight: gridRowHeight,
      handle
    });
    if (typeof document !== 'undefined') {
      document.body.style.userSelect = 'none';
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!resizeState) return;
    const handlePointerMove = (event: PointerEvent) => {
      const {
        layout,
        itemId,
        originColStart,
        originColEnd,
        originRowStart,
        originRowEnd,
        gridLeft,
        gridTop,
        cellWidth,
        rowHeight,
        handle
      } = resizeState;
      const pointerCol = Math.floor((event.clientX - gridLeft) / (cellWidth + EDITOR_GAP)) + 1;
      const pointerRow = Math.floor((event.clientY - gridTop) / (rowHeight + EDITOR_GAP)) + 1;
      const maxColSpan = Math.min(baseColumns, activeColumns);
      const updateItems = (current: ParishLayoutItem[]) => {
        let nextColStart = originColStart;
        let nextColEnd = originColEnd;
        let nextRowStart = originRowStart;
        let nextRowEnd = originRowEnd;

        if (handle === 'left' || handle === 'top-left' || handle === 'bottom-left') {
          nextColStart = clamp(pointerCol, 1, originColEnd);
        }
        if (handle === 'right' || handle === 'top-right' || handle === 'bottom-right') {
          nextColEnd = clamp(pointerCol, originColStart, gridColumns);
        }
        if (handle === 'top' || handle === 'top-left' || handle === 'top-right') {
          nextRowStart = clamp(pointerRow, 1, originRowEnd);
        }
        if (handle === 'bottom' || handle === 'bottom-left' || handle === 'bottom-right') {
          nextRowEnd = clamp(pointerRow, originRowStart, originRowStart + MAX_ROW_SPAN + 6);
        }

        let resolvedColSpan = snapColSpan(
          clamp(nextColEnd - nextColStart + 1, MIN_COL_SPAN, maxColSpan),
          gridColumns
        );
        let resolvedRowSpan = snapRowSpan(clamp(nextRowEnd - nextRowStart + 1, MIN_ROW_SPAN, MAX_ROW_SPAN));

        if (handle === 'left' || handle === 'top-left' || handle === 'bottom-left') {
          nextColStart = nextColEnd - resolvedColSpan + 1;
        }
        if (handle === 'top' || handle === 'top-left' || handle === 'top-right') {
          nextRowStart = nextRowEnd - resolvedRowSpan + 1;
        }

        if (nextColStart < 1) {
          nextColStart = 1;
        }
        if (nextColStart + resolvedColSpan - 1 > gridColumns) {
          nextColStart = gridColumns - resolvedColSpan + 1;
        }

        const candidate = {
          position: { row: nextRowStart, col: nextColStart },
          size: { colSpan: resolvedColSpan, rowSpan: resolvedRowSpan }
        };

        if (!canPlaceItem(current, candidate, activeColumns, activeBreakpoint, itemId)) {
          return current;
        }

        return current.map((item) => {
          if (item.id !== itemId) return item;
          const layouts = { ...(item.layouts ?? {}) } as Record<
            LayoutBreakpoint,
            { position: { row: number; col: number }; size: { colSpan: number; rowSpan: number } }
          >;
          layouts[activeBreakpoint] = {
            position: { row: nextRowStart, col: nextColStart },
            size: { colSpan: resolvedColSpan, rowSpan: resolvedRowSpan }
          };
          return {
            ...item,
            layouts,
            position: layouts.desktop?.position ?? item.position,
            size: layouts.desktop?.size ?? item.size
          };
        });
      };
      if (layout === 'builder') {
        setBuilderLayoutItems(updateItems);
      } else {
        setEditLayoutItems(updateItems);
      }
    };
    const handlePointerUp = () => {
      setResizeState(null);
      if (typeof document !== 'undefined') {
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizeState, baseColumns, gridColumns]);

  return (
    <div className={`parish-portal theme-${theme}`} lang={language}>
      {view === 'chooser' ? (
        <>
          <header className="parish-header parish-header--chooser">
            <div className="parish-header-left">
              <button type="button" className="parish-back" onClick={handleBack}>
                Back
              </button>
              <a className="parish-up" href="/#/">
                Up
              </a>
              <a className="parish-brand" href="/#/">
                <img src="/parish/logo.svg" alt="Logo parafii" className="parish-logo" />
                <span className="parish-name">Parafie</span>
              </a>
            </div>
            <div className="parish-controls">
              {isAuthenticated && (
                <button type="button" className="parish-create" onClick={handleStartBuilder}>
                  Utwórz stronę parafii
                </button>
              )}
              <AuthAction
                copy={copy}
                label={authLabel}
                isAuthenticated={isAuthenticated}
                secureMode={secureMode}
                onLogin={onAuthAction}
                onProfileNavigate={onProfileNavigate}
                onToggleSecureMode={onToggleSecureMode}
                onLogout={onLogout}
                variant="ghost"
              />
            </div>
          </header>
          <main className="parish-main">
            {parishMockNotice}
            <section className="parish-chooser">
              <div className="chooser-card">
                <div>
                  <p className="tag">Portal parafialny</p>
                  <h1>Wybierz parafię</h1>
                  <p className="lead">Wybierz parafię z listy lub utwórz nową stronę.</p>
                </div>
                <div className="chooser-list">
                  {parishOptions.length === 0 ? (
                    <p className="muted">Brak stron parafii.</p>
                  ) : (
                    parishOptions.map((item) => (
                      <a
                        key={item.id}
                        className="chooser-item"
                        href={`/#/parish/${item.slug}`}
                      >
                        <div>
                          <strong>{item.name}</strong>
                          <span className="muted">{item.location}</span>
                        </div>
                        <span className="pill">Wejdź</span>
                      </a>
                    ))
                  )}
                </div>
                {isAuthenticated && (
                  <div className="chooser-action">
                    <button type="button" className="parish-create" onClick={handleStartBuilder}>
                      Utwórz nową parafię
                    </button>
                  </div>
                )}
              </div>
            </section>
          </main>
        </>
      ) : view === 'builder' ? (
        <>
          <header className="parish-header parish-header--chooser">
            <div className="parish-header-left">
              <button
                type="button"
                className="parish-back"
                onClick={() => {
                  if (builderStep === 0) {
                    setView('chooser');
                    return;
                  }
                  setBuilderStep((current) => Math.max(0, current - 1));
                }}
              >
                Wróć
              </button>
              <button
                type="button"
                className="parish-brand"
                onClick={() => {
                  setView('chooser');
                  setBuilderStep(0);
                }}
              >
                <img src="/parish/logo.svg" alt="Logo parafii" className="parish-logo" />
                <span className="parish-name">Nowa strona parafii</span>
              </button>
            </div>
            <div className="parish-controls">
              <AuthAction
                copy={copy}
                label={authLabel}
                isAuthenticated={isAuthenticated}
                secureMode={secureMode}
                onLogin={onAuthAction}
                onProfileNavigate={onProfileNavigate}
                onToggleSecureMode={onToggleSecureMode}
                onLogout={onLogout}
                variant="ghost"
              />
            </div>
          </header>
          <main className="parish-main">
            {parishMockNotice}
            <section className="parish-builder">
              <div className="builder-card">
                <div className="builder-intro">
                  <p className="tag">Panel tworzenia</p>
                  <h1>Stwórz witrynę parafii</h1>
                  <p className="lead">
                    Wybierz zakres informacji, które mają być widoczne publicznie. Po utworzeniu
                    zostaniesz głównym administratorem i możesz przydzielać role.
                  </p>
                </div>
                <div className="builder-steps">
                  {builderSteps.map((label, index) => (
                    <div
                      key={label}
                      className={`builder-step ${builderStep === index ? 'is-active' : ''} ${
                        builderStep > index ? 'is-done' : ''
                      }`}
                    >
                      <span>{index + 1}</span>
                      <strong>{label}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="builder-card">
                {builderStep === 0 && (
                  <div className="builder-panel">
                    <h2>Dane parafii</h2>
                    <div className="builder-grid">
                      <label className="builder-field">
                        <span>Nazwa parafii</span>
                        <input
                          type="text"
                          value={builderName}
                          onChange={(event) => handleBuilderNameChange(event.target.value)}
                          placeholder="np. Parafia św. Jana"
                        />
                      </label>
                      <label className="builder-field">
                        <span>Lokalizacja</span>
                        <input
                          type="text"
                          value={builderLocation}
                          onChange={(event) => setBuilderLocation(event.target.value)}
                          placeholder="np. Kraków • Prądnik"
                        />
                      </label>
                      <label className="builder-field">
                        <span>Adres w URL (slug)</span>
                        <input
                          type="text"
                          value={builderSlug}
                          onChange={(event) => handleBuilderSlugChange(event.target.value)}
                          placeholder="np. sw-jan"
                        />
                      </label>
                    </div>
                  </div>
                )}
                {builderStep === 1 && (
                  <div className="builder-panel">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={pointerWithin}
                      onDragStart={(event) =>
                        handleLayoutDragStart(event, 'builder', builderLayoutItems, setSelectedBuilderId)
                      }
                      onDragOver={(event) => handleLayoutDragOver(event, 'builder', builderLayoutItems)}
                      onDragCancel={handleLayoutDragCancel}
                      onDragEnd={(event) =>
                        handleLayoutDragEnd(
                          event,
                          'builder',
                          builderLayoutItems,
                          setBuilderLayoutItems,
                          setSelectedBuilderId
                        )
                      }
                    >
                      <div className="layout-header">
                        <h2>Układ strony</h2>
                        <div className="layout-subheader">Moduły</div>
                        <div className="layout-palette">
                          {parishModuleCatalog.map((module) => (
                            <PaletteButton key={module.type} type={module.type} label={module.label} />
                          ))}
                        </div>
                      </div>
                      {(() => {
                        const rows = builderDropInfo?.rows
                          ? builderDropInfo.rows
                          : Math.max(
                              4,
                              Math.max(
                                1,
                                ...builderLayoutItems.map((module) => {
                                  const layout = getLayoutForBreakpoint(module, activeBreakpoint);
                                  return layout.position.row + snapRowSpan(layout.size.rowSpan) - 1;
                                })
                              ) + 2
                            );
                        const shellHeight =
                          rows * gridRowHeight + (rows - 1) * EDITOR_GAP + EDITOR_PADDING * 2;
                        return (
                          <div
                            className={`editor-grid-shell ${builderDragActive ? 'is-dragging' : ''}`}
                            ref={editorGridRef}
                            style={
                              {
                                '--grid-row-height': `${gridRowHeight}px`,
                                '--grid-gap': `${EDITOR_GAP}px`,
                                '--grid-columns': gridColumns,
                                height: `${shellHeight}px`
                              } as CSSProperties
                            }
                          >
                            <div className="editor-grid-layer editor-grid-cells">
                              {Array.from({ length: rows }).flatMap((_, rowIndex) => {
                                const r = rowIndex + 1;
                                return Array.from({ length: gridColumns }).map((__, colIndex) => {
                                  const c = colIndex + 1;
                                  const key = `${r}:${c}`;
                                  const isValid = builderDragActive && (builderDropInfo?.valid?.has(key) ?? false);
                                  return (
                                    <DroppableCell
                                      key={`builder-cell-${r}-${c}`}
                                      row={r}
                                      col={c}
                                      isValid={isValid}
                                      isActive={builderDragActive}
                                    />
                                  );
                                });
                              })}
                            </div>
                            <div className="editor-grid-layer editor-grid-modules">
                                {builderLayoutItems.map((module) => (
                                  <GridItem
                                    key={`builder-item-${module.id}`}
                                    item={module}
                                    frame={getLayoutForBreakpoint(module, activeBreakpoint)}
                                    isActive={selectedBuilderId === module.id}
                                    onSelect={() => setSelectedBuilderId(module.id)}
                                    isHidden={builderDragActive && dragState.activeItemId === module.id}
                                    onResizeStart={(mode, event) => startResize('builder', module, mode, event)}
                                  >
                                    {renderModuleContent(module, activeBreakpoint)}
                                  </GridItem>
                                ))}
                              {builderDragActive && dragState.overValid && dragState.overCell && dragState.size ? (
                                <div
                                  className="editor-module is-ghost"
                                  style={{
                              gridColumn: `${dragState.overCell.col} / span ${snapColSpan(
                                dragState.size.colSpan,
                                activeColumns
                              )}`,
                                    gridRow: `${dragState.overCell.row} / span ${snapRowSpan(dragState.size.rowSpan)}`
                                  }}
                                >
                                  <strong>Podgląd</strong>
                                  <span className="muted">
                                      {snapColSpan(dragState.size.colSpan, activeColumns)}x
                                    {snapRowSpan(dragState.size.rowSpan)}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                      <DragOverlay>
                        {builderDragActive && !dragState.overValid && dragState.size ? (
                          <div className="editor-module drag-overlay">
                            <strong>{dragLabel}</strong>
                            <span className="muted">
                                {snapColSpan(dragState.size.colSpan, activeColumns)}x{snapRowSpan(dragState.size.rowSpan)}
                            </span>
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                    <div className="builder-actions">
                      <button
                        type="button"
                        className="parish-back"
                        onClick={() => compactLayout(builderLayoutItems, setBuilderLayoutItems)}
                      >
                        Compact layout
                      </button>
                    </div>
                    {selectedBuilderId && (
                      <div className="builder-layout">
                        <h3>Ustawienia modułu</h3>
                        {builderLayoutItems
                          .filter((module) => module.id === selectedBuilderId)
                          .map((module) => (
                            <div key={module.id} className="builder-layout-row">
                              <strong>{module.type}</strong>
                                <span className="muted">
                                  Rozmiar: {snapColSpan(
                                    getLayoutForBreakpoint(module, activeBreakpoint).size.colSpan,
                                    activeColumns
                                  )}
                                  x
                                  {snapRowSpan(getLayoutForBreakpoint(module, activeBreakpoint).size.rowSpan)} (zmień
                                  przez przeciągnięcie narożnika)
                                </span>
                            </div>
                          ))}
                      </div>
                    )}
                    {builderError && <p className="builder-error">{builderError}</p>}
                  </div>
                )}
                {builderStep === 2 && (
                  <div className="builder-panel">
                    <h2>Styl i motyw</h2>
                    <div className="builder-options builder-themes">
                      {(['classic', 'warm', 'minimal'] as ThemePreset[]).map((preset) => (
                        <label key={preset} className="builder-theme">
                          <input
                            type="radio"
                            name="theme"
                            checked={builderTheme === preset}
                            onChange={() => setBuilderTheme(preset)}
                          />
                          <span>{preset === 'classic' ? 'Klasyczny' : preset === 'warm' ? 'Ciepły' : 'Minimal'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {builderStep === 3 && (
                  <div className="builder-panel">
                    <h2>Podsumowanie</h2>
                    <div className="builder-summary">
                      <div>
                        <strong>{builderName || 'Nowa parafia'}</strong>
                        <span className="muted">{builderLocation || 'Lokalizacja do uzupełnienia'}</span>
                        <span className="muted">Adres: /parish/{builderSlug || 'slug'}</span>
                      </div>
                      <div>
                        <strong>Moduły</strong>
                        <span className="muted">
                          {selectedModuleLabels.length ? selectedModuleLabels.join(', ') : 'Brak wybranych modułów'}
                        </span>
                      </div>
                      <div>
                        <strong>Rola główna</strong>
                        <span className="muted">Po utworzeniu zostaniesz głównym administratorem.</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="builder-actions">
                  <button
                    type="button"
                    className="parish-back"
                    onClick={() => {
                      if (builderStep === 0) {
                        setView('chooser');
                        return;
                      }
                      setBuilderStep((current) => Math.max(0, current - 1));
                    }}
                  >
                    Wróć
                  </button>
                  {builderStep < 3 ? (
                    <button
                      type="button"
                      className="parish-login"
                      onClick={() => setBuilderStep((current) => Math.min(3, current + 1))}
                    >
                      Dalej
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="parish-login"
                      disabled={!canCreateParish}
                      onClick={handleCreateParishSite}
                    >
                      Utwórz stronę
                    </button>
                  )}
                </div>
              </div>
            </section>
          </main>
        </>
      ) : !parish ? (
        <>
          <header className="parish-header parish-header--chooser">
            <div className="parish-header-left">
              <button type="button" className="parish-back" onClick={handleBack}>
                Back
              </button>
              <a className="parish-up" href="/#/parish">
                Up
              </a>
            </div>
            <div className="parish-controls">
              <AuthAction
                copy={copy}
                label={authLabel}
                isAuthenticated={isAuthenticated}
                secureMode={secureMode}
                onLogin={onAuthAction}
                onProfileNavigate={onProfileNavigate}
                onToggleSecureMode={onToggleSecureMode}
                onLogout={onLogout}
                variant="ghost"
              />
            </div>
          </header>
          <main className="parish-main">
            {parishMockNotice}
            <section className="parish-section">
              <article className="parish-card">
                <p className="muted">Nie znaleziono strony parafii.</p>
              </article>
            </section>
          </main>
        </>
      ) : (
        <>
          <header className="parish-header">
            <div className="parish-header-left">
              <button type="button" className="parish-back" onClick={handleBack}>
                Back
              </button>
              <a className="parish-up" href="/#/parish">
                Up
              </a>
              <button
                type="button"
                className="parish-brand"
                onClick={() => {
                  setActivePage('start');
                  setMenuOpen(false);
                  setOpenSection(null);
                  navigate(`/parish/${parish.slug}`);
                }}
              >
                <img src={parish.logo} alt={`Logo ${parish.name}`} className="parish-logo" />
                <span className="parish-name">{parish.name}</span>
              </button>
            </div>
            <nav className={`parish-menu ${menuOpen ? 'open' : ''}`} aria-label="Menu parafialne">
              {menu.map((item) => {
                if (item.children) {
                  const isActiveGroup = item.children.some((child) => child.id === activePage);
                  const isOpen = openSection === item.label;
                  return (
                    <div key={item.label} className={`menu-item ${isActiveGroup ? 'is-active' : ''} ${isOpen ? 'open' : ''}`}>
                      <button
                        type="button"
                        className="menu-button"
                        aria-haspopup="true"
                        onClick={() => setOpenSection((current) => (current === item.label ? null : item.label))}
                      >
                        {item.label}
                      </button>
                      <button
                        type="button"
                        className="submenu-toggle"
                        aria-label={`Rozwiń ${item.label}`}
                        onClick={() => setOpenSection((current) => (current === item.label ? null : item.label))}
                      >
                        ▾
                      </button>
                      <div className="submenu">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            className={`submenu-link ${activePage === child.id ? 'is-active' : ''}`}
                            onClick={() => selectPage(child.id)}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`menu-link ${activePage === item.id ? 'is-active' : ''}`}
                    onClick={() => selectPage(item.id as PageId)}
                  >
                    {item.label}
                  </button>
                );
              })}
              {isAuthenticated && (
                <button
                  type="button"
                  className={`menu-link ${activePage === 'intentions' ? 'is-active' : ''}`}
                  onClick={() => selectPage('intentions')}
                >
                  Panel intencji
                </button>
              )}
            </nav>
            <div className="parish-header-right">
              <div className="parish-menu-control">
                <button
                  type="button"
                  className="menu-toggle"
                  onClick={() => {
                    setMenuOpen((open) => {
                      if (open) setOpenSection(null);
                      return !open;
                    });
                  }}
                >
                  Menu
                </button>
              </div>
              {isAuthenticated && (
                <div className="parish-edit-control">
                  <button
                    type="button"
                    className={`parish-back ${editMode ? 'is-active' : ''}`}
                    onClick={() => setEditMode((current) => !current)}
                  >
                    {editMode ? 'Zakończ edycję' : 'Tryb edycji'}
                  </button>
                </div>
              )}
              <AuthAction
                copy={copy}
                label={authLabel}
                isAuthenticated={isAuthenticated}
                secureMode={secureMode}
                onLogin={onAuthAction}
                onProfileNavigate={onProfileNavigate}
                onToggleSecureMode={onToggleSecureMode}
                onLogout={onLogout}
                variant="ghost"
              />
            </div>
          </header>
          <main className="parish-main">
            {parishMockNotice}
            {activePage === 'start' && (
              <section className="parish-section home-grid-section">
                {editMode && (
                  <div className="home-grid-editor">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={pointerWithin}
                      onDragStart={(event) =>
                        handleLayoutDragStart(event, 'edit', editLayoutItems, setSelectedEditId)
                      }
                      onDragOver={(event) => handleLayoutDragOver(event, 'edit', editLayoutItems)}
                      onDragCancel={handleLayoutDragCancel}
                      onDragEnd={(event) =>
                        handleLayoutDragEnd(
                          event,
                          'edit',
                          editLayoutItems,
                          setEditLayoutItems,
                          setSelectedEditId
                        )
                      }
                    >
                      <div className="layout-header">
                        <h3>Edycja układu</h3>
                        <div className="layout-subheader">Moduły</div>
                        <div className="layout-palette">
                          {parishModuleCatalog.map((module) => (
                            <PaletteButton key={`edit-${module.type}`} type={module.type} label={module.label} />
                          ))}
                        </div>
                      </div>
                      {(() => {
                        const rows = editDropInfo?.rows
                          ? editDropInfo.rows
                          : Math.max(
                              4,
                              Math.max(
                                1,
                                ...editLayoutItems.map((module) => {
                                  const layout = getLayoutForBreakpoint(module, activeBreakpoint);
                                  return layout.position.row + snapRowSpan(layout.size.rowSpan) - 1;
                                })
                              ) + 2
                            );
                        const shellHeight =
                          rows * gridRowHeight + (rows - 1) * EDITOR_GAP + EDITOR_PADDING * 2;
                        return (
                          <div
                            className={`editor-grid-shell ${editDragActive ? 'is-dragging' : ''}`}
                            ref={editorGridRef}
                            style={
                              {
                                '--grid-row-height': `${gridRowHeight}px`,
                                '--grid-gap': `${EDITOR_GAP}px`,
                                '--grid-columns': gridColumns,
                                height: `${shellHeight}px`
                              } as CSSProperties
                            }
                          >
                            <div className="editor-grid-layer editor-grid-cells">
                              {Array.from({ length: rows }).flatMap((_, rowIndex) => {
                                const r = rowIndex + 1;
                                return Array.from({ length: gridColumns }).map((__, colIndex) => {
                                  const c = colIndex + 1;
                                  const key = `${r}:${c}`;
                                  const isValid = editDragActive && (editDropInfo?.valid?.has(key) ?? false);
                                  return (
                                    <DroppableCell
                                      key={`edit-cell-${r}-${c}`}
                                      row={r}
                                      col={c}
                                      isValid={isValid}
                                      isActive={editDragActive}
                                    />
                                  );
                                });
                              })}
                            </div>
                            <div className="editor-grid-layer editor-grid-modules">
                                {editLayoutItems.map((module) => (
                                  <GridItem
                                    key={`edit-item-${module.id}`}
                                    item={module}
                                    frame={getLayoutForBreakpoint(module, activeBreakpoint)}
                                    isActive={selectedEditId === module.id}
                                    onSelect={() => setSelectedEditId(module.id)}
                                    isHidden={editDragActive && dragState.activeItemId === module.id}
                                    onResizeStart={(mode, event) => startResize('edit', module, mode, event)}
                                  >
                                    {renderModuleContent(module, activeBreakpoint)}
                                  </GridItem>
                                ))}
                              {editDragActive && dragState.overValid && dragState.overCell && dragState.size ? (
                                <div
                                  className="editor-module is-ghost"
                                  style={{
                                      gridColumn: `${dragState.overCell.col} / span ${snapColSpan(
                                        dragState.size.colSpan,
                                        activeColumns
                                      )}`,
                                    gridRow: `${dragState.overCell.row} / span ${snapRowSpan(dragState.size.rowSpan)}`
                                  }}
                                >
                                  <strong>Podgląd</strong>
                                  <span className="muted">
                                      {snapColSpan(dragState.size.colSpan, activeColumns)}x
                                    {snapRowSpan(dragState.size.rowSpan)}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                      <DragOverlay>
                        {editDragActive && !dragState.overValid && dragState.size ? (
                          <div className="editor-module drag-overlay">
                            <strong>{dragLabel}</strong>
                            <span className="muted">
                                {snapColSpan(dragState.size.colSpan, activeColumns)}x{snapRowSpan(dragState.size.rowSpan)}
                            </span>
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                    <div className="builder-actions">
                      <button
                        type="button"
                        className="parish-back"
                        onClick={() => compactLayout(editLayoutItems, setEditLayoutItems)}
                      >
                        Compact layout
                      </button>
                      <button type="button" className="parish-back" onClick={() => setEditMode(false)}>
                        Anuluj
                      </button>
                      <button type="button" className="parish-login" onClick={handleSaveLayout}>
                        Zapisz układ
                      </button>
                    </div>
                    {selectedEditId && (
                      <div className="builder-layout">
                        <h3>Ustawienia modułu</h3>
                        {editLayoutItems
                          .filter((module) => module.id === selectedEditId)
                          .map((module) => (
                            <div key={module.id} className="builder-layout-row">
                              <strong>{module.type}</strong>
                                <span className="muted">
                                  Rozmiar: {snapColSpan(
                                    getLayoutForBreakpoint(module, activeBreakpoint).size.colSpan,
                                    activeColumns
                                  )}
                                  x
                                  {snapRowSpan(getLayoutForBreakpoint(module, activeBreakpoint).size.rowSpan)} (zmień
                                  przez przeciągnięcie narożnika)
                                </span>
                            </div>
                          ))}
                      </div>
                    )}
                    {editError && <p className="builder-error">{editError}</p>}
                  </div>
                )}
                <div
                  className="home-grid"
                  ref={homeGridRef}
                  style={
                    {
                      '--grid-row-height': `${gridRowHeight}px`
                    } as CSSProperties
                  }
                >
                  {homepageModules.map((module) => {
                    const layout = getLayoutForBreakpoint(module, activeBreakpoint);
                    return (
                      <article
                        key={module.id}
                        className={`home-module ${module.type === 'sticky' ? 'home-module--sticky' : ''}`}
                        style={{
                          gridColumn: `${layout.position.col} / span ${snapColSpan(
                            layout.size.colSpan,
                            activeColumns
                          )}`,
                          gridRow: `${layout.position.row} / span ${snapRowSpan(layout.size.rowSpan)}`
                        }}
                      >
                        <div className={`module-body module-body-${module.type}`}>
                          {renderModuleContent(module, activeBreakpoint)}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            {activePage === 'about' && (
              <section className="parish-section about-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Parafia</p>
                    <h2>O parafii</h2>
                  </div>
                  <span className="muted">Historia i misja wspólnoty</span>
                </div>
                <div className="about-grid">
                  <div className="parish-card">
                    <h3>Misja i wspólnota</h3>
                    <p className="note">
                      Tworzymy miejsce modlitwy, edukacji i pomocy. Każda inicjatywa służy budowaniu relacji i
                      wzmacnianiu wiary.
                    </p>
                    <div className="highlight-grid">
                      {aboutHighlights.map((item) => (
                        <div key={item.label}>
                          <strong>{item.value}</strong>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="parish-card">
                    <h3>Historia parafii</h3>
                    <p className="note">
                      Parafia powstała w odpowiedzi na rozwój dzielnicy. Od początku łączy duchowość z aktywnym
                      zaangażowaniem społecznym.
                    </p>
                    <ul className="history-list">
                      <li>1984 — erygowanie parafii i budowa kościoła.</li>
                      <li>2002 — otwarcie centrum formacji i biblioteki.</li>
                      <li>2020 — uruchomienie transmisji i nowych wspólnot.</li>
                    </ul>
                  </div>
                  <div className="parish-card about-media">
                    <img src="/parish/trip.jpg" alt="Wspólnota parafialna" />
                    <div>
                      <h3>Zaangażowanie</h3>
                      <p className="note">Wspieramy wolontariat, wydarzenia rodzinne oraz działania charytatywne.</p>
                    </div>
                  </div>
                </div>
              </section>
            )}
            {activePage === 'office' && (
              <section className="parish-section office-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Kancelaria</p>
                    <h2>Godziny przyjęć i kontakt</h2>
                  </div>
                  <button type="button" className="ghost">
                    Pobierz formularze
                  </button>
                </div>
                <div className="office-grid">
                  <div className="parish-card">
                    <h3>Godziny kancelarii</h3>
                    <ul className="office-hours">
                      {officeHours.map((item) => (
                        <li key={item.day}>
                          <strong>{item.day}</strong>
                          <span>{item.hours}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="notice">
                      <strong>Uwaga</strong>
                      <p>W święta i uroczystości godziny mogą ulec zmianie.</p>
                    </div>
                  </div>
                  <div className="parish-card">
                    <h3>Sprawy urzędowe</h3>
                    <p className="note">Spisanie protokołów, zapisy na sakramenty i sprawy administracyjne.</p>
                    <div className="detail-grid">
                      <div>
                        <span className="label">Telefon</span>
                        <strong>+48 12 412 58 50</strong>
                      </div>
                      <div>
                        <span className="label">E-mail</span>
                        <strong>kancelaria@janchrzciciel.eu</strong>
                      </div>
                      <div>
                        <span className="label">Lokalizacja</span>
                        <strong>Wejście od strony plebanii</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
            {activePage === 'masses' && (
              <section className="parish-section">
                {isAuthenticated && (
                  <div className="parish-card admin-form">
                    <div className="section-header">
                      <div>
                        <p className="tag">Panel admina</p>
                        <h3>Zarządzanie mszami</h3>
                      </div>
                    </div>
                    <div className="tabs small">
                      <button
                        type="button"
                        className={massEditorMode === 'single' ? 'is-active' : undefined}
                        onClick={() => setMassEditorMode('single')}
                      >
                        Pojedyncza msza
                      </button>
                      <button
                        type="button"
                        className={massEditorMode === 'serial' ? 'is-active' : undefined}
                        onClick={() => setMassEditorMode('serial')}
                      >
                        Dodawanie seryjne (node)
                      </button>
                    </div>
                    {massEditorMode === 'single' ? (
                      <>
                        <div className="admin-form-grid">
                          <label>
                            <span>Dzień</span>
                            <input
                              type="date"
                              value={newMassDay}
                              onChange={(event) => {
                                setNewMassDay(event.target.value);
                                setEditingMassId(null);
                              }}
                            />
                          </label>
                          <label>
                            <span>Godzina</span>
                            <input
                              type="time"
                              value={newMassTime}
                              onChange={(event) => setNewMassTime(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Kościół</span>
                            <input
                              type="text"
                              value={newMassChurch}
                              onChange={(event) => setNewMassChurch(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Rodzaj</span>
                            <input
                              type="text"
                              value={newMassKind}
                              onChange={(event) => setNewMassKind(event.target.value)}
                              placeholder="np. ferialna, świąteczna"
                            />
                          </label>
                          <label>
                            <span>Czas trwania (min)</span>
                            <input
                              type="number"
                              min={1}
                              value={newMassDurationMinutes}
                              onChange={(event) => setNewMassDurationMinutes(event.target.value)}
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Nazwa</span>
                            <input
                              type="text"
                              value={newMassTitle}
                              onChange={(event) => setNewMassTitle(event.target.value)}
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Uwagi</span>
                            <input
                              type="text"
                              value={newMassNote}
                              onChange={(event) => setNewMassNote(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Nabożeństwo przed</span>
                            <input
                              type="text"
                              value={newMassBeforeService}
                              onChange={(event) => setNewMassBeforeService(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Nabożeństwo po</span>
                            <input
                              type="text"
                              value={newMassAfterService}
                              onChange={(event) => setNewMassAfterService(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Suma ofiar</span>
                            <input
                              type="text"
                              value={newMassDonationSummary}
                              onChange={(event) => setNewMassDonationSummary(event.target.value)}
                              placeholder="np. 150 PLN"
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Intencje (linia: tekst | ofiara)</span>
                            <textarea
                              value={newMassIntentionsRaw}
                              onChange={(event) => setNewMassIntentionsRaw(event.target.value)}
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Msza zbiorowa</span>
                            <input
                              type="checkbox"
                              checked={newMassCollective}
                              onChange={(event) => setNewMassCollective(event.target.checked)}
                            />
                          </label>
                        </div>
                        <div className="parish-card">
                          <div className="section-header">
                            <h3>Msze dnia</h3>
                            <span className="muted">{newMassDay || '-'}</span>
                          </div>
                          <ul className="status-list">
                            {massesOfSelectedDay.length === 0 ? (
                              <li>
                                <span className="muted">Brak mszy w tym dniu.</span>
                              </li>
                            ) : (
                              massesOfSelectedDay.map((mass) => (
                                <li key={mass.id}>
                                  <button type="button" className="ghost" onClick={() => handlePickMassForEdit(mass)}>
                                    {new Date(mass.massDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {mass.title}
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                        <div className="builder-actions">
                          <button type="button" className="parish-login" onClick={handleAddMass}>
                            {editingMassId ? 'Zapisz zmiany mszy' : 'Dodaj mszę'}
                          </button>
                          {editingMassId && (
                            <button
                              type="button"
                              className="parish-back"
                              onClick={() => {
                                setEditingMassId(null);
                                setNewMassTime('18:00');
                              }}
                            >
                              Anuluj edycję
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mass-rule-builder">
                        <div className="parish-card mass-rule-guide">
                          <h4>Jak budowac graf mszy</h4>
                          <ul>
                            <li>1. Dodaj warunki (np. dzien tygodnia, sezon, swieto), aby wybrac dni.</li>
                            <li>2. Dodaj `Szablon mszy`, aby ustawic godzine, miejsce, rodzaj i informacje.</li>
                            <li>3. Dodaj `Dodaj intencje` (mozna wiele razy), aby uzupelnic intencje i ofiary.</li>
                            <li>4. Dodaj `Zapisz msze`, aby utworzyc wpis dla dnia.</li>
                            <li>5. Zakoncz sciezke `Stop` i podlacz `next/else` bez rozlaczonych wezlow.</li>
                          </ul>
                        </div>
                        <div className="parish-card mass-rule-legend">
                          <span><i style={{ background: '#2563EB' }} /> Warunki / filtry dat</span>
                          <span><i style={{ background: '#F59E0B' }} /> Msza / slot / godzina</span>
                          <span><i style={{ background: '#7C3AED' }} /> Intencje / ofiara</span>
                          <span><i style={{ background: '#16A34A' }} /> Zapis do bazy</span>
                          <span><i style={{ background: '#6B7280' }} /> Stop</span>
                          <span><i style={{ background: '#DC2626' }} /> Błąd / konflikt</span>
                        </div>
                        <div className="builder-actions">
                          <label className="mass-require-intentions">
                            <input
                              type="checkbox"
                              checked={massRuleRequireIntentions}
                              onChange={(event) => setMassRuleRequireIntentions(event.target.checked)}
                            />
                            <span>Wymagaj intencji w grafie</span>
                          </label>
                          <button type="button" className="parish-back" onClick={handleNewMassRule}>
                            Nowa reguła
                          </button>
                          <button type="button" className="parish-back" onClick={handleAutoLayoutMassGraph}>
                            Ułóż graf lewo-&gt;prawo
                          </button>
                          <button type="button" className="parish-back" onClick={handleValidateMassGraph}>
                            Sprawdź graf
                          </button>
                        </div>
                        <div className="admin-form-grid">
                          <label>
                            <span>Szukaj node</span>
                            <input
                              type="text"
                              value={massNodeSearch}
                              onChange={(event) => setMassNodeSearch(event.target.value)}
                              placeholder="np. msza, intencja, sezon"
                            />
                          </label>
                          <label>
                            <span>Kategoria</span>
                            <select
                              value={massNodeCategoryFilter}
                              onChange={(event) => setMassNodeCategoryFilter(event.target.value as 'all' | MassNodeCategory)}
                            >
                              <option value="all">Wszystkie</option>
                              <option value="filter">Warunki</option>
                              <option value="mass">Msza</option>
                              <option value="intention">Intencje</option>
                              <option value="save">Zapis</option>
                              <option value="stop">Stop</option>
                            </select>
                          </label>
                        </div>
                        {massRuleConflicts.length > 0 && (
                          <div className="parish-card mass-rule-conflicts">
                            <strong>⚠ Konflikty terminów</strong>
                            <ul>
                              {massRuleConflicts.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {massRuleValidation.length > 0 && (
                          <div className="parish-card mass-rule-validation">
                            <strong>Wynik walidacji</strong>
                            <ul>
                              {massRuleValidation.map((item, index) => (
                                <li key={`${item.level}-${index}`} className={item.level === 'error' ? 'is-error' : 'is-warning'}>
                                  {item.level === 'error' ? '⛔' : '⚠'} {item.message}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="admin-form-grid">
                          <label>
                            <span>Nazwa reguły</span>
                            <input
                              type="text"
                              value={massRuleName}
                              onChange={(event) => setMassRuleName(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Node startowy</span>
                            <input
                              type="text"
                              value={massRuleStartNodeId}
                              onChange={(event) => setMassRuleStartNodeId(event.target.value)}
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Opis</span>
                            <input
                              type="text"
                              value={massRuleDescription}
                              onChange={(event) => setMassRuleDescription(event.target.value)}
                            />
                          </label>
                        </div>
                        <div className="layout-palette">
                          {filteredMassRuleTemplates.map((template) => (
                            <button
                              key={template.type}
                              type="button"
                              className="module-pill"
                              onClick={() => handleAddRuleNode(template.type)}
                            >
                              {template.label}
                            </button>
                          ))}
                        </div>
                        <div className="mass-rule-graph-shell">
                          <ReactFlow
                            nodes={renderedMassFlowNodes}
                            edges={renderedMassFlowEdges}
                            nodeTypes={massRuleNodeTypes}
                            onNodesChange={handleMassNodesChange}
                            onNodeDragStop={handleMassNodeDragStop}
                            onEdgesChange={handleMassEdgesChange}
                            onConnect={handleMassConnect}
                            onNodeClick={(_, node) => setSelectedMassFlowNodeId(node.id)}
                            fitView
                            connectionLineStyle={{ stroke: '#7a6b58', strokeWidth: 2 }}
                          >
                            <Background />
                            <Controls />
                          </ReactFlow>
                        </div>
                        <div className="parish-card">
                          {!selectedMassRuleNode ? (
                            <p className="muted">Wybierz node w grafie, aby edytować szczegóły.</p>
                          ) : (
                            <div className="admin-form-grid">
                              <div className="admin-form-full mass-node-intro">
                                <strong>{selectedMassRuleDefinition?.label ?? selectedMassRuleNode.type}</strong>
                                <p className="note">{selectedMassRuleDefinition?.description ?? 'Konfiguracja wezla.'}</p>
                                <p className="muted">
                                  Wejscie: {selectedMassRuleDefinition?.input ?? 'dane dnia'} | Wyjscie:{' '}
                                  {selectedMassRuleDefinition?.output ?? 'next'}
                                </p>
                              </div>
                              <label>
                                <span>Node ID</span>
                                <input type="text" value={selectedMassRuleNode.id} readOnly />
                              </label>
                              <label>
                                <span>Typ</span>
                                <select
                                  value={selectedMassRuleNode.type}
                                  onChange={(event) => {
                                    const nextType = event.target.value;
                                    const nextDefinition = massRuleDefinitionsByType[nextType];
                                    updateRuleNodeType(selectedMassRuleNode.id, nextType);
                                    if (nextDefinition) {
                                      Object.entries(nextDefinition.config).forEach(([key, value]) => {
                                        updateRuleNodeConfig(selectedMassRuleNode.id, key, value);
                                      });
                                    }
                                  }}
                                >
                                  {massRuleNodeTemplates.map((template) => (
                                    <option key={template.type} value={template.type}>
                                      {template.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Next</span>
                                <select
                                  value={selectedMassRuleNode.nextId ?? ''}
                                  onChange={(event) =>
                                    updateRuleNodeConnection(selectedMassRuleNode.id, 'next', event.target.value || null)
                                  }
                                >
                                  <option value="">-- brak --</option>
                                  {massFlowNodes
                                    .filter((node) => node.id !== selectedMassRuleNode.id)
                                    .map((node) => (
                                      <option key={node.id} value={node.id}>
                                        {node.id}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label>
                                <span>Else</span>
                                <select
                                  value={selectedMassRuleNode.elseId ?? ''}
                                  onChange={(event) =>
                                    updateRuleNodeConnection(selectedMassRuleNode.id, 'else', event.target.value || null)
                                  }
                                >
                                  <option value="">-- brak --</option>
                                  {massFlowNodes
                                    .filter((node) => node.id !== selectedMassRuleNode.id)
                                    .map((node) => (
                                      <option key={node.id} value={node.id}>
                                        {node.id}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              {selectedMassRuleFields.map((field) => (
                                <label key={field.key}>
                                  <span>{field.label}</span>
                                  <input
                                    type="text"
                                    value={selectedMassRuleNode.config?.[field.key] ?? ''}
                                    placeholder={field.placeholder}
                                    onChange={(event) => updateRuleNodeConfig(selectedMassRuleNode.id, field.key, event.target.value)}
                                  />
                                  {field.hint ? <span className="muted">{field.hint}</span> : null}
                                </label>
                              ))}
                              <div className="builder-actions admin-form-full">
                                <button type="button" className="parish-back" onClick={handleDuplicateSelectedRuleNode}>
                                  Duplikuj node
                                </button>
                                <button type="button" className="parish-back" onClick={handleDeleteSelectedRuleNode}>
                                  Usuń node
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="admin-form-grid">
                          <label>
                            <span>Od</span>
                            <input type="date" value={massRuleFromDate} onChange={(event) => setMassRuleFromDate(event.target.value)} />
                          </label>
                          <label>
                            <span>Do</span>
                            <input type="date" value={massRuleToDate} onChange={(event) => setMassRuleToDate(event.target.value)} />
                          </label>
                          <label>
                            <span>Podmień istniejące</span>
                            <input
                              type="checkbox"
                              checked={massRuleReplaceExisting}
                              onChange={(event) => setMassRuleReplaceExisting(event.target.checked)}
                            />
                          </label>
                          <label>
                            <span>Wybór reguły</span>
                            <select
                              value={selectedMassRuleId ?? ''}
                              onChange={(event) => {
                                const nextId = event.target.value || null;
                                if (!nextId) {
                                  setSelectedMassRuleId(null);
                                  return;
                                }
                                const nextRule = massRules.find((rule) => rule.id === nextId);
                                if (nextRule) {
                                  loadMassRuleToEditor(nextRule);
                                } else {
                                  setSelectedMassRuleId(nextId);
                                }
                              }}
                            >
                              <option value="">--</option>
                              {massRules.map((rule) => (
                                <option key={rule.id} value={rule.id}>
                                  {rule.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="builder-actions">
                          <button type="button" className="parish-back" onClick={handleSaveMassRule}>
                            Zapisz regułę
                          </button>
                          <button type="button" className="parish-back" onClick={handleSimulateMassRule}>
                            Symuluj
                          </button>
                          <button type="button" className="parish-login" onClick={handleApplyMassRule}>
                            Zastosuj regułę
                          </button>
                        </div>
                        {massRulePreview.length > 0 && (
                          <ul className="status-list mass-rule-preview-list">
                            {massRulePreview.slice(0, 8).map((item) => (
                              <li key={item.id} className={massRulePreviewConflictKeys.has(new Date(item.massDateTime).toISOString()) ? 'is-conflict' : undefined}>
                                <strong>
                                  <span className="mass-preview-time">
                                    {new Date(item.massDateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                  {massRulePreviewConflictKeys.has(new Date(item.massDateTime).toISOString()) ? (
                                    <span className="mass-preview-conflict">⚠ kolizja</span>
                                  ) : null}
                                </strong>
                                <span className="mass-preview-title">{item.title}</span>
                                <span className="mass-preview-intention">
                                  {(item.intentionsJson ?? '').slice(0, 80) || 'Brak intencji'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {adminFormError && <p className="builder-error">{adminFormError}</p>}
                    {massRuleWarning && <p className="muted">{massRuleWarning}</p>}
                  </div>
                )}
                <div className="section-header">
                  <div>
                    <p className="tag">Msze i nabożeństwa</p>
                    <h2>Stały rytm tygodnia</h2>
                  </div>
                  <span className="muted">Tydzień 11–17 marca 2025</span>
                </div>
                <div className="tabs">
                  {(['Sunday', 'Weekdays', 'Devotions', 'Confession'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={massTab === tab ? 'is-active' : undefined}
                      onClick={() => setMassTab(tab)}
                    >
                      {tab === 'Sunday' && 'Niedziele'}
                      {tab === 'Weekdays' && 'Dni powszednie'}
                      {tab === 'Devotions' && 'Nabożeństwa'}
                      {tab === 'Confession' && 'Spowiedź'}
                    </button>
                  ))}
                </div>
                {publicMasses.length > 0 && (
                  <div className="parish-card">
                    <div className="section-header">
                      <h3>Najbliższe Msze</h3>
                      <span className="muted">Publiczne ogłoszenia</span>
                    </div>
                    <ul className="status-list">
                      {publicMasses.slice(0, 6).map((mass) => (
                        <li key={mass.id}>
                          <strong>
                            {new Date(mass.massDateTime).toLocaleString([], {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </strong>
                          <span>{mass.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="parish-card">
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th>Godzina</th>
                        <th>Miejsce</th>
                        <th>Uwagi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {massesTables[massTab].map((row) => (
                        <tr key={`${massTab}-${row.time}`}>
                          <td>{row.time}</td>
                          <td>{row.place}</td>
                          <td>{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="parish-card exceptions">
                  <div className="section-header">
                    <h3>Wyjątki i zmiany</h3>
                    <span className="muted">Nadpisują plan tygodniowy</span>
                  </div>
                  <ul>
                    {exceptions.map((item) => (
                      <li key={item.date}>
                        <strong>{item.date}</strong>
                        <span>{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
            {activePage === 'intentions' && (
              <section className="parish-section intentions-page">
                {isAuthenticated && (
                  <div className="parish-card admin-form">
                    <div className="section-header">
                      <div>
                        <p className="tag">Panel admina</p>
                        <h3>Zarządzanie mszami i intencjami</h3>
                      </div>
                    </div>
                    <div className="tabs small">
                      <button
                        type="button"
                        className={massEditorMode === 'single' ? 'is-active' : undefined}
                        onClick={() => setMassEditorMode('single')}
                      >
                        Pojedyncza msza
                      </button>
                      <button
                        type="button"
                        className={massEditorMode === 'serial' ? 'is-active' : undefined}
                        onClick={() => setMassEditorMode('serial')}
                      >
                        Dodawanie seryjne (node)
                      </button>
                    </div>
                    {massEditorMode === 'single' ? (
                      <>
                        <div className="admin-form-grid">
                          <label>
                            <span>Dzień</span>
                            <input
                              type="date"
                              value={newMassDay}
                              onChange={(event) => {
                                setNewMassDay(event.target.value);
                                setEditingMassId(null);
                              }}
                            />
                          </label>
                          <label>
                            <span>Godzina</span>
                            <input
                              type="time"
                              value={newMassTime}
                              onChange={(event) => setNewMassTime(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Kościół</span>
                            <input
                              type="text"
                              value={newMassChurch}
                              onChange={(event) => setNewMassChurch(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Rodzaj</span>
                            <input
                              type="text"
                              value={newMassKind}
                              onChange={(event) => setNewMassKind(event.target.value)}
                              placeholder="np. ferialna, świąteczna"
                            />
                          </label>
                          <label>
                            <span>Czas trwania (min)</span>
                            <input
                              type="number"
                              min={1}
                              value={newMassDurationMinutes}
                              onChange={(event) => setNewMassDurationMinutes(event.target.value)}
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Nazwa</span>
                            <input
                              type="text"
                              value={newMassTitle}
                              onChange={(event) => setNewMassTitle(event.target.value)}
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Uwagi</span>
                            <input
                              type="text"
                              value={newMassNote}
                              onChange={(event) => setNewMassNote(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Nabożeństwo przed</span>
                            <input
                              type="text"
                              value={newMassBeforeService}
                              onChange={(event) => setNewMassBeforeService(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Nabożeństwo po</span>
                            <input
                              type="text"
                              value={newMassAfterService}
                              onChange={(event) => setNewMassAfterService(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Suma ofiar</span>
                            <input
                              type="text"
                              value={newMassDonationSummary}
                              onChange={(event) => setNewMassDonationSummary(event.target.value)}
                              placeholder="np. 150 PLN"
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Intencje (linia: tekst | ofiara)</span>
                            <textarea
                              value={newMassIntentionsRaw}
                              onChange={(event) => setNewMassIntentionsRaw(event.target.value)}
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Msza zbiorowa</span>
                            <input
                              type="checkbox"
                              checked={newMassCollective}
                              onChange={(event) => setNewMassCollective(event.target.checked)}
                            />
                          </label>
                        </div>
                        <div className="parish-card">
                          <div className="section-header">
                            <h3>Msze dnia</h3>
                            <span className="muted">{newMassDay || '-'}</span>
                          </div>
                          <ul className="status-list">
                            {massesOfSelectedDay.length === 0 ? (
                              <li>
                                <span className="muted">Brak mszy w tym dniu.</span>
                              </li>
                            ) : (
                              massesOfSelectedDay.map((mass) => (
                                <li key={mass.id}>
                                  <button type="button" className="ghost" onClick={() => handlePickMassForEdit(mass)}>
                                    {new Date(mass.massDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {mass.title}
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                        <div className="builder-actions">
                          <button type="button" className="parish-login" onClick={handleAddMass}>
                            {editingMassId ? 'Zapisz zmiany mszy' : 'Dodaj mszę'}
                          </button>
                          {editingMassId && (
                            <button
                              type="button"
                              className="parish-back"
                              onClick={() => {
                                setEditingMassId(null);
                                setNewMassTime('18:00');
                              }}
                            >
                              Anuluj edycję
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mass-rule-builder">
                        <div className="parish-card mass-rule-guide">
                          <h4>Jak budowac graf mszy</h4>
                          <ul>
                            <li>1. Dodaj warunki (np. dzien tygodnia, sezon, swieto), aby wybrac dni.</li>
                            <li>2. Dodaj `Szablon mszy`, aby ustawic godzine, miejsce, rodzaj i informacje.</li>
                            <li>3. Dodaj `Dodaj intencje` (mozna wiele razy), aby uzupelnic intencje i ofiary.</li>
                            <li>4. Dodaj `Zapisz msze`, aby utworzyc wpis dla dnia.</li>
                            <li>5. Zakoncz sciezke `Stop` i podlacz `next/else` bez rozlaczonych wezlow.</li>
                          </ul>
                        </div>
                        <div className="parish-card mass-rule-legend">
                          <span><i style={{ background: '#2563EB' }} /> Warunki / filtry dat</span>
                          <span><i style={{ background: '#F59E0B' }} /> Msza / slot / godzina</span>
                          <span><i style={{ background: '#7C3AED' }} /> Intencje / ofiara</span>
                          <span><i style={{ background: '#16A34A' }} /> Zapis do bazy</span>
                          <span><i style={{ background: '#6B7280' }} /> Stop</span>
                          <span><i style={{ background: '#DC2626' }} /> Błąd / konflikt</span>
                        </div>
                        <div className="builder-actions">
                          <label className="mass-require-intentions">
                            <input
                              type="checkbox"
                              checked={massRuleRequireIntentions}
                              onChange={(event) => setMassRuleRequireIntentions(event.target.checked)}
                            />
                            <span>Wymagaj intencji w grafie</span>
                          </label>
                          <button type="button" className="parish-back" onClick={handleNewMassRule}>
                            Nowa reguła
                          </button>
                          <button type="button" className="parish-back" onClick={handleAutoLayoutMassGraph}>
                            Ułóż graf lewo-&gt;prawo
                          </button>
                          <button type="button" className="parish-back" onClick={handleValidateMassGraph}>
                            Sprawdź graf
                          </button>
                        </div>
                        <div className="admin-form-grid">
                          <label>
                            <span>Szukaj node</span>
                            <input
                              type="text"
                              value={massNodeSearch}
                              onChange={(event) => setMassNodeSearch(event.target.value)}
                              placeholder="np. msza, intencja, sezon"
                            />
                          </label>
                          <label>
                            <span>Kategoria</span>
                            <select
                              value={massNodeCategoryFilter}
                              onChange={(event) => setMassNodeCategoryFilter(event.target.value as 'all' | MassNodeCategory)}
                            >
                              <option value="all">Wszystkie</option>
                              <option value="filter">Warunki</option>
                              <option value="mass">Msza</option>
                              <option value="intention">Intencje</option>
                              <option value="save">Zapis</option>
                              <option value="stop">Stop</option>
                            </select>
                          </label>
                        </div>
                        {massRuleConflicts.length > 0 && (
                          <div className="parish-card mass-rule-conflicts">
                            <strong>⚠ Konflikty terminów</strong>
                            <ul>
                              {massRuleConflicts.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {massRuleValidation.length > 0 && (
                          <div className="parish-card mass-rule-validation">
                            <strong>Wynik walidacji</strong>
                            <ul>
                              {massRuleValidation.map((item, index) => (
                                <li key={`${item.level}-${index}`} className={item.level === 'error' ? 'is-error' : 'is-warning'}>
                                  {item.level === 'error' ? '⛔' : '⚠'} {item.message}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="admin-form-grid">
                          <label>
                            <span>Nazwa reguły</span>
                            <input
                              type="text"
                              value={massRuleName}
                              onChange={(event) => setMassRuleName(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Node startowy</span>
                            <input
                              type="text"
                              value={massRuleStartNodeId}
                              onChange={(event) => setMassRuleStartNodeId(event.target.value)}
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Opis</span>
                            <input
                              type="text"
                              value={massRuleDescription}
                              onChange={(event) => setMassRuleDescription(event.target.value)}
                            />
                          </label>
                        </div>
                        <div className="layout-palette">
                          {filteredMassRuleTemplates.map((template) => (
                            <button
                              key={template.type}
                              type="button"
                              className="module-pill"
                              onClick={() => handleAddRuleNode(template.type)}
                            >
                              {template.label}
                            </button>
                          ))}
                        </div>
                        <div className="mass-rule-graph-shell">
                          <ReactFlow
                            nodes={renderedMassFlowNodes}
                            edges={renderedMassFlowEdges}
                            nodeTypes={massRuleNodeTypes}
                            onNodesChange={handleMassNodesChange}
                            onNodeDragStop={handleMassNodeDragStop}
                            onEdgesChange={handleMassEdgesChange}
                            onConnect={handleMassConnect}
                            onNodeClick={(_, node) => setSelectedMassFlowNodeId(node.id)}
                            fitView
                            connectionLineStyle={{ stroke: '#7a6b58', strokeWidth: 2 }}
                          >
                            <Background />
                            <Controls />
                          </ReactFlow>
                        </div>
                        <div className="parish-card">
                          {!selectedMassRuleNode ? (
                            <p className="muted">Wybierz node w grafie, aby edytować szczegóły.</p>
                          ) : (
                            <div className="admin-form-grid">
                              <div className="admin-form-full mass-node-intro">
                                <strong>{selectedMassRuleDefinition?.label ?? selectedMassRuleNode.type}</strong>
                                <p className="note">{selectedMassRuleDefinition?.description ?? 'Konfiguracja wezla.'}</p>
                                <p className="muted">
                                  Wejscie: {selectedMassRuleDefinition?.input ?? 'dane dnia'} | Wyjscie:{' '}
                                  {selectedMassRuleDefinition?.output ?? 'next'}
                                </p>
                              </div>
                              <label>
                                <span>Node ID</span>
                                <input type="text" value={selectedMassRuleNode.id} readOnly />
                              </label>
                              <label>
                                <span>Typ</span>
                                <select
                                  value={selectedMassRuleNode.type}
                                  onChange={(event) => {
                                    const nextType = event.target.value;
                                    const nextDefinition = massRuleDefinitionsByType[nextType];
                                    updateRuleNodeType(selectedMassRuleNode.id, nextType);
                                    if (nextDefinition) {
                                      Object.entries(nextDefinition.config).forEach(([key, value]) => {
                                        updateRuleNodeConfig(selectedMassRuleNode.id, key, value);
                                      });
                                    }
                                  }}
                                >
                                  {massRuleNodeTemplates.map((template) => (
                                    <option key={template.type} value={template.type}>
                                      {template.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Next</span>
                                <select
                                  value={selectedMassRuleNode.nextId ?? ''}
                                  onChange={(event) =>
                                    updateRuleNodeConnection(selectedMassRuleNode.id, 'next', event.target.value || null)
                                  }
                                >
                                  <option value="">-- brak --</option>
                                  {massFlowNodes
                                    .filter((node) => node.id !== selectedMassRuleNode.id)
                                    .map((node) => (
                                      <option key={node.id} value={node.id}>
                                        {node.id}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label>
                                <span>Else</span>
                                <select
                                  value={selectedMassRuleNode.elseId ?? ''}
                                  onChange={(event) =>
                                    updateRuleNodeConnection(selectedMassRuleNode.id, 'else', event.target.value || null)
                                  }
                                >
                                  <option value="">-- brak --</option>
                                  {massFlowNodes
                                    .filter((node) => node.id !== selectedMassRuleNode.id)
                                    .map((node) => (
                                      <option key={node.id} value={node.id}>
                                        {node.id}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              {selectedMassRuleFields.map((field) => (
                                <label key={field.key}>
                                  <span>{field.label}</span>
                                  <input
                                    type="text"
                                    value={selectedMassRuleNode.config?.[field.key] ?? ''}
                                    placeholder={field.placeholder}
                                    onChange={(event) => updateRuleNodeConfig(selectedMassRuleNode.id, field.key, event.target.value)}
                                  />
                                  {field.hint ? <span className="muted">{field.hint}</span> : null}
                                </label>
                              ))}
                              <div className="builder-actions admin-form-full">
                                <button type="button" className="parish-back" onClick={handleDuplicateSelectedRuleNode}>
                                  Duplikuj node
                                </button>
                                <button type="button" className="parish-back" onClick={handleDeleteSelectedRuleNode}>
                                  Usuń node
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="admin-form-grid">
                          <label>
                            <span>Od</span>
                            <input type="date" value={massRuleFromDate} onChange={(event) => setMassRuleFromDate(event.target.value)} />
                          </label>
                          <label>
                            <span>Do</span>
                            <input type="date" value={massRuleToDate} onChange={(event) => setMassRuleToDate(event.target.value)} />
                          </label>
                          <label>
                            <span>Podmień istniejące</span>
                            <input
                              type="checkbox"
                              checked={massRuleReplaceExisting}
                              onChange={(event) => setMassRuleReplaceExisting(event.target.checked)}
                            />
                          </label>
                          <label>
                            <span>Wybór reguły</span>
                            <select
                              value={selectedMassRuleId ?? ''}
                              onChange={(event) => {
                                const nextId = event.target.value || null;
                                if (!nextId) {
                                  setSelectedMassRuleId(null);
                                  return;
                                }
                                const nextRule = massRules.find((rule) => rule.id === nextId);
                                if (nextRule) {
                                  loadMassRuleToEditor(nextRule);
                                } else {
                                  setSelectedMassRuleId(nextId);
                                }
                              }}
                            >
                              <option value="">--</option>
                              {massRules.map((rule) => (
                                <option key={rule.id} value={rule.id}>
                                  {rule.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="builder-actions">
                          <button type="button" className="parish-back" onClick={handleSaveMassRule}>
                            Zapisz regułę
                          </button>
                          <button type="button" className="parish-back" onClick={handleSimulateMassRule}>
                            Symuluj
                          </button>
                          <button type="button" className="parish-login" onClick={handleApplyMassRule}>
                            Zastosuj regułę
                          </button>
                        </div>
                        {massRulePreview.length > 0 && (
                          <ul className="status-list mass-rule-preview-list">
                            {massRulePreview.slice(0, 8).map((item) => (
                              <li key={item.id} className={massRulePreviewConflictKeys.has(new Date(item.massDateTime).toISOString()) ? 'is-conflict' : undefined}>
                                <strong>
                                  <span className="mass-preview-time">
                                    {new Date(item.massDateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                  {massRulePreviewConflictKeys.has(new Date(item.massDateTime).toISOString()) ? (
                                    <span className="mass-preview-conflict">⚠ kolizja</span>
                                  ) : null}
                                </strong>
                                <span className="mass-preview-title">{item.title}</span>
                                <span className="mass-preview-intention">
                                  {(item.intentionsJson ?? '').slice(0, 80) || 'Brak intencji'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {adminFormError && <p className="builder-error">{adminFormError}</p>}
                    {massRuleWarning && <p className="muted">{massRuleWarning}</p>}
                  </div>
                )}
                <div className="section-header">
                  <div>
                    <p className="tag">Intencje</p>
                    <h2>Lista intencji na tydzień</h2>
                  </div>
                  <div className="intentions-controls">
                    <button type="button" className="ghost">
                      Dzisiaj
                    </button>
                    <button type="button" className="ghost">
                      Ta niedziela
                    </button>
                    <button type="button" className="ghost">
                      Drukuj
                    </button>
                  </div>
                </div>
                <div className="intentions-layout">
                  <div className="parish-card">
                    <div className="intentions-search">
                      <input type="text" placeholder="Szukaj intencji (mock)" />
                      <span>Tydzień 11–17 marca 2025</span>
                    </div>
                    {publicIntentions.length > 0 && (
                      <div className="intentions-public">
                        {publicIntentions.slice(0, 8).map((item) => (
                          <div key={item.id} className="intent-row">
                            <span>{new Date(item.massDateTime).toLocaleString()}</span>
                            <div>
                              <p>{item.publicText}</p>
                              <span className="muted">{item.churchName}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="accordion">
                      {intentionsWeek.map((day) => (
                        <details key={day.day} open>
                          <summary>{day.day}</summary>
                          <div className="accordion-body">
                            {day.items.map((item) => (
                              <div key={`${day.day}-${item.time}`} className="intent-row">
                                <span>{item.time}</span>
                                <div>
                                  <p>{item.text}</p>
                                  <span className="muted">
                                    {item.location} • {item.priest}
                                  </span>
                                </div>
                                <span className="chip">{item.priest}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                  <aside className="parish-card">
                    <div className="section-header">
                      <h3>Moje intencje</h3>
                      <span className="muted">Statusy</span>
                    </div>
                    <ul className="status-list">
                      <li>
                        <strong>14 marca, 7:00</strong>
                        <span>W toku</span>
                      </li>
                      <li>
                        <strong>17 marca, 18:00</strong>
                        <span>Potwierdzona</span>
                      </li>
                      <li>
                        <strong>21 marca, 7:00</strong>
                        <span>Weryfikacja</span>
                      </li>
                    </ul>
                    <button type="button" className="cta ghost">
                      Zgłoś intencję
                    </button>
                  </aside>
                </div>
              </section>
            )}
            {activePage === 'announcements' && (
              <section className="parish-section announcements-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Ogłoszenia</p>
                    <h2>Aktualności parafialne</h2>
                  </div>
                  <div className="intentions-controls">
                    <button type="button" className="ghost">
                      Drukuj
                    </button>
                    <button type="button" className="ghost">
                      Udostępnij
                    </button>
                  </div>
                </div>
                <div className="announcement-layout">
                  <div className="parish-card announcement-list">
                    {announcements.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={item.id === announcementId ? 'is-active' : undefined}
                        onClick={() => setAnnouncementId(item.id)}
                      >
                        <span>{item.date}</span>
                        <strong>{item.title}</strong>
                        <p className="note">{item.excerpt}</p>
                      </button>
                    ))}
                  </div>
                  <article className="parish-card announcement-detail">
                    <p className="date">{announcement.date}</p>
                    <h3>{announcement.title}</h3>
                    <p className="lead">{announcement.content}</p>
                    <div className="print-row">
                      <button type="button" className="ghost">
                        Drukuj
                      </button>
                      <button type="button" className="ghost">
                        Udostępnij
                      </button>
                    </div>
                  </article>
                  <aside className="parish-card archive">
                    <h3>Archiwum</h3>
                    <ul>
                      <li>Marzec 2025</li>
                      <li>Luty 2025</li>
                      <li>Styczeń 2025</li>
                      <li>Grudzień 2024</li>
                    </ul>
                  </aside>
                </div>
              </section>
            )}
            {activePage === 'calendar' && (
              <section className="parish-section calendar-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Kalendarz</p>
                    <h2>Wydarzenia i spotkania</h2>
                  </div>
                  <div className="calendar-controls">
                    <div className="tabs small">
                      <button
                        type="button"
                        className={calendarView === 'month' ? 'is-active' : undefined}
                        onClick={() => setCalendarView('month')}
                      >
                        Miesiąc
                      </button>
                      <button
                        type="button"
                        className={calendarView === 'agenda' ? 'is-active' : undefined}
                        onClick={() => setCalendarView('agenda')}
                      >
                        Agenda
                      </button>
                    </div>
                    <select className="parish-select">
                      <option>Wszystkie kategorie</option>
                      <option>Liturgia</option>
                      <option>Muzyka</option>
                      <option>Formacja</option>
                    </select>
                    <select className="parish-select">
                      <option>Wszystkie miejsca</option>
                      <option>Kościół główny</option>
                      <option>Sala Jana Pawła II</option>
                      <option>Kaplica</option>
                    </select>
                  </div>
                </div>
                <div className="calendar-layout">
                  <div className="parish-card calendar-main">
                    {calendarView === 'month' ? (
                      <>
                        <div className="calendar-grid">
                          {Array.from({ length: 30 }).map((_, index) => (
                            <div key={`day-${index + 1}`} className="calendar-day">
                              <span>{index + 1}</span>
                              {index % 6 === 0 && <em>Spotkanie</em>}
                            </div>
                          ))}
                        </div>
                        <div className="empty-state">
                          <strong>Brak wydarzeń w tym filtrze</strong>
                          <p>Wybierz inną kategorię lub lokalizację.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <ul className="agenda-list">
                          {calendarEvents.map((event) => (
                            <li key={event.id}>
                              <div>
                                <strong>{event.title}</strong>
                                <span>{event.date}</span>
                              </div>
                              <button type="button" className="ghost" onClick={() => setSelectedEventId(event.id)}>
                                Szczegóły
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="empty-state">
                          <strong>Brak wydarzeń w tym filtrze</strong>
                          <p>Wybierz inną kategorię lub lokalizację.</p>
                        </div>
                      </>
                    )}
                  </div>
                  <aside className="parish-card calendar-drawer">
                    <div className="section-header">
                      <h3>Szczegóły wydarzenia</h3>
                      <button type="button" className="ghost" onClick={() => setSelectedEventId(calendarEvents[0].id)}>
                        Reset
                      </button>
                    </div>
                    <p className="date">
                      {selectedEvent.date} • {selectedEvent.time}
                    </p>
                    <h4>{selectedEvent.title}</h4>
                    <p className="note">{selectedEvent.description}</p>
                    <div className="chip-row">
                      <span className="chip">{selectedEvent.category}</span>
                      <span className="chip">{selectedEvent.place}</span>
                    </div>
                    <p className="muted">Prowadzi: {selectedEvent.priest}</p>
                    {selectedEvent.recurring && <span className="pill">Wydarzenie cykliczne</span>}
                    <div className="exception-callout">
                      <strong>Wyjątki</strong>
                      <p>Wielki Piątek: wydarzenie odwołane.</p>
                    </div>
                  </aside>
                </div>
              </section>
            )}
            {activePage === 'clergy' && (
              <section className="parish-section clergy-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Duchowieństwo</p>
                    <h2>Księża posługujący w parafii</h2>
                  </div>
                  <span className="muted">Publiczne godziny kontaktu</span>
                </div>
                <div className="clergy-layout">
                  <div className="clergy-grid">
                    {priests.map((priest) => (
                      <button
                        key={priest.id}
                        type="button"
                        className={`clergy-card ${priest.id === selectedPriestId ? 'is-active' : ''}`}
                        onClick={() => setSelectedPriestId(priest.id)}
                      >
                        <img src={priest.img} alt={priest.name} />
                        <div>
                          <strong>{priest.name}</strong>
                          <span>{priest.role}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <article className="parish-card clergy-profile">
                    <div className="profile-header">
                      <img src={selectedPriest.img} alt={selectedPriest.name} />
                      <div>
                        <h3>{selectedPriest.name}</h3>
                        <p className="note">{selectedPriest.role}</p>
                        <span className="pill">Kontakt: {selectedPriest.contact}</span>
                      </div>
                    </div>
                    <p>{selectedPriest.bio}</p>
                    <div className="schedule-snippet">
                      <h4>Najbliższe 7 dni</h4>
                      <ul>
                        <li>Pt., 15 marca — Msza 18:00</li>
                        <li>Sb., 16 marca — Spowiedź 17:00</li>
                        <li>Nd., 17 marca — Suma 11:00</li>
                      </ul>
                    </div>
                  </article>
                </div>
              </section>
            )}
            {(activePage === 'community-bible' || activePage === 'community-formation') && communityData && (
              <section className="parish-section community-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Wspólnoty</p>
                    <h2>{communityData.title}</h2>
                  </div>
                  <button type="button" className="ghost">
                    Dołącz do wspólnoty
                  </button>
                </div>
                <div className="community-hero">
                  <img src={communityData.image} alt={communityData.title} />
                  <div className="parish-card">
                    <p className="lead">{communityData.lead}</p>
                    <div className="detail-grid">
                      <div>
                        <span className="label">Spotkania</span>
                        <strong>{communityData.cadence}</strong>
                      </div>
                      <div>
                        <span className="label">Miejsce</span>
                        <strong>{communityData.location}</strong>
                      </div>
                      <div>
                        <span className="label">Prowadzący</span>
                        <strong>{communityData.leader}</strong>
                      </div>
                    </div>
                    <div className="chip-row">
                      {communityData.roles.map((role) => (
                        <span key={role} className="chip">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="parish-card">
                  <h3>Plan spotkania</h3>
                  <ul className="plan-list">
                    {communityData.plan.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="parish-card">
                  <h3>Aktualności wspólnoty</h3>
                  <p className="note">Najbliższe spotkanie: 19 marca, 19:00. Temat: Ewangelia wg św. Marka.</p>
                </div>
              </section>
            )}
            {activePage === 'koleda' && (
              <section className="parish-section koleda-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Kolęda</p>
                    <h2>Plan wizyt duszpasterskich</h2>
                  </div>
                  <span className="pill">Aktualizacja: 5 stycznia</span>
                </div>
                <div className="notice">
                  <strong>Zmiany i aktualizacje</strong>
                  <p>
                    Z powodu choroby ks. Pawła, plan na 10 stycznia został przesunięty na 12 stycznia. Szczegóły w tabeli.
                  </p>
                </div>
                <div className="koleda-layout">
                  <div className="parish-card">
                    <h3>Plan wg dat</h3>
                    <ul className="koleda-list">
                      {koledaByDate.map((item) => (
                        <li key={item.date}>
                          <div>
                            <strong>{item.date}</strong>
                            <span>{item.window}</span>
                          </div>
                          <div>
                            <span>{item.area}</span>
                            <span className="chip">{item.priest}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="parish-card">
                    <h3>Plan wg ulic i rejonów</h3>
                    <ul className="koleda-list">
                      {koledaByArea.map((item) => (
                        <li key={item.area}>
                          <div>
                            <strong>{item.area}</strong>
                            <span>{item.streets}</span>
                          </div>
                          <div>
                            <span>{item.date}</span>
                            <span className="chip">{item.priest}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <aside className="parish-card my-area">
                    <h3>Moja okolica</h3>
                    <p className="note">Os. Zielone 12–24 — 7 stycznia</p>
                    <button type="button" className="cta ghost">
                      Zobacz trasę
                    </button>
                  </aside>
                </div>
              </section>
            )}
            {activePage.startsWith('sacrament-') && (
              <section className="parish-section sacrament-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Sakramenty</p>
                    <h2>{selectedSacramentDisplayTitle}</h2>
                    <p className="lead">{selectedSacramentLead}</p>
                  </div>
                  <button type="button" className="ghost">
                    Pobierz checklistę
                  </button>
                </div>
                <div className="parish-card sacrament-shortcuts">
                  <p className="tag">{sacramentMenuLabels.panelTitle}</p>
                  <div className="tabs small sacrament-shortcuts-tabs">
                    <button
                      type="button"
                      className={activeSacramentPanelSection === 'overall' ? 'is-active' : undefined}
                      onClick={() => openSacramentPanelSection('overall')}
                    >
                      {sacramentMenuLabels.overall}
                    </button>
                    <button
                      type="button"
                      className={activeSacramentPanelSection === 'parish' ? 'is-active' : undefined}
                      onClick={() => openSacramentPanelSection('parish')}
                    >
                      {sacramentMenuLabels.parish}
                    </button>
                    <button
                      type="button"
                      className={activeSacramentPanelSection === 'faq' ? 'is-active' : undefined}
                      onClick={() => openSacramentPanelSection('faq')}
                    >
                      {sacramentMenuLabels.faq}
                    </button>
                    {selectedSacrament.id === 'confirmation' && (
                      <button
                        type="button"
                        className={activeSacramentPanelSection === 'form' ? 'is-active' : undefined}
                        onClick={() => openSacramentPanelSection('form')}
                      >
                        {sacramentMenuLabels.form}
                      </button>
                    )}
                    {selectedSacrament.id === 'confirmation' && (
                      <button
                        type="button"
                        className={activeSacramentPanelSection === 'meetings' ? 'is-active' : undefined}
                        onClick={() => openSacramentPanelSection('meetings')}
                      >
                        {sacramentMenuLabels.meetings}
                      </button>
                    )}
                    {selectedSacrament.id === 'confirmation' && (
                      <button
                        type="button"
                        className={activeSacramentPanelSection === 'candidate' ? 'is-active' : undefined}
                        onClick={() => openSacramentPanelSection('candidate')}
                      >
                        {sacramentMenuLabels.candidatePortal}
                      </button>
                    )}
                  </div>
                  <p className="muted">
                    Sekcje będą rozwijane o kolejne części dla wszystkich sakramentów. Aktualnie dla bierzmowania dostępny jest formularz online, panel zapisów na spotkania i indywidualny portal kandydata.
                  </p>
                </div>
                {selectedSacrament.id === 'confirmation' && confirmationVerifyInfo ? (
                  <div
                    className={`parish-card confirmation-verify-banner ${
                      confirmationVerifyTone === 'error'
                        ? 'confirmation-verify-banner-error'
                        : confirmationVerifyTone === 'notice'
                        ? 'confirmation-verify-banner-notice'
                        : 'confirmation-verify-banner-success'
                    }`}
                  >
                    <h3>Weryfikacja numeru telefonu</h3>
                    <p>{confirmationVerifyInfo}</p>
                    <p className="note">
                      Jeśli zgłoszenie zostało już wysłane, nie wysyłaj kolejnego formularza. W razie pomyłki skontaktuj się bezpośrednio z parafią.
                    </p>
                    <button type="button" className="ghost" onClick={() => openSacramentPanelSection('form')}>
                      Przejdź do formularza tylko jeśli to nowe zgłoszenie
                    </button>
                  </div>
                ) : null}
                {activeSacramentPanelSection === 'overall' && (
                  <>
                    {selectedSacramentOverallPage ? (
                      <div className="parish-card sacrament-panel-content">
                        <h3>{selectedSacramentOverallPage.title}</h3>
                        <p className="note">{selectedSacramentOverallPage.lead}</p>
                        <div className="sacrament-page-sections">
                          {selectedSacramentOverallPage.sections.map((section, index) => (
                            <article key={`${selectedSacrament.id}-overall-section-${index}`}>
                              <h4>{section.title}</h4>
                              <p className="note">{section.body}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="sacrament-hero">
                          <img src={selectedSacrament.img} alt={selectedSacrament.title} />
                          <div className="parish-card">
                            <h3>Kontakt w sprawie sakramentu</h3>
                            <p className="note">Kancelaria: Pon.–Pt. 9:00–11:00, 16:00–18:00</p>
                            <button type="button" className="cta">
                              Umów spotkanie
                            </button>
                          </div>
                        </div>
                        <div className="parish-card sacrament-detail">
                          <div className="detail-columns">
                            <div>
                              <h4>Kroki</h4>
                              <ol>
                                {selectedSacrament.steps.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ol>
                            </div>
                            <div>
                              <h4>Wymagane dokumenty</h4>
                              <ul className="download-list">
                                {selectedSacrament.docs.map((doc) => (
                                  <li key={doc}>
                                    <span>{doc}</span>
                                    <button type="button" className="ghost">
                                      Pobierz
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="contact-box">
                              <h4>Informacje wspólne (ogólne)</h4>
                              <ul className="status-list">
                                {selectedSacramentOverallInfo.map((item, index) => (
                                  <li key={`${selectedSacrament.id}-overall-${index}`}>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
                {activeSacramentPanelSection === 'parish' && (
                  <>
                    <div className="parish-card sacrament-panel-content">
                      {selectedSacramentParishPage ? (
                        <>
                          <h3>{selectedSacramentParishPage.title}</h3>
                          <p className="note">{selectedSacramentParishPage.lead}</p>
                          {selectedSacramentParishPage.notice ? (
                            <p className="confirmation-info confirmation-info-success">{selectedSacramentParishPage.notice}</p>
                          ) : null}
                          <div className="sacrament-page-sections">
                            {selectedSacramentParishSections.map((section, index) => (
                              <article key={`${selectedSacrament.id}-parish-section-${index}`}>
                                <h4>{section.title}</h4>
                                <p className="note">{section.body}</p>
                              </article>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <h3>Informacje parafialne</h3>
                          <ul className="status-list">
                            {selectedSacramentParishInfo.map((item, index) => (
                              <li key={`${selectedSacrament.id}-parish-${index}`}>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                    {isAuthenticated && (
                      <div className="parish-card sacrament-panel-editor">
                        <div className="section-header">
                          <div>
                            <p className="tag">Panel admina</p>
                            <h3>Treść parafialna: {selectedSacrament.title}</h3>
                          </div>
                        </div>
                        <div className="admin-form-grid">
                          <label className="admin-form-full">
                            <span>Tytuł sekcji parafialnej</span>
                            <input
                              type="text"
                              value={sacramentParishEditTitle}
                              onChange={(event) => setSacramentParishEditTitle(event.target.value)}
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Lead (opis)</span>
                            <textarea
                              rows={3}
                              value={sacramentParishEditLead}
                              onChange={(event) => setSacramentParishEditLead(event.target.value)}
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Notatka wyróżniona (opcjonalnie)</span>
                            <textarea
                              rows={2}
                              value={sacramentParishEditNotice}
                              onChange={(event) => setSacramentParishEditNotice(event.target.value)}
                            />
                          </label>
                        </div>
                        <div className="sacrament-editor-sections">
                          <div className="section-header">
                            <h4>Sekcje parafialne</h4>
                            <button type="button" className="ghost" onClick={handleAddSacramentParishSection}>
                              Dodaj sekcję
                            </button>
                          </div>
                          {sacramentParishEditSections.length === 0 ? (
                            <p className="muted">Brak sekcji. Dodaj pierwszą sekcję lub wyczyść i zapisz.</p>
                          ) : (
                            sacramentParishEditSections.map((section, index) => (
                              <article key={`${selectedSacrament.id}-editor-section-${index}`} className="sacrament-editor-section">
                                <label>
                                  <span>Tytuł</span>
                                  <input
                                    type="text"
                                    value={section.title}
                                    onChange={(event) => handleUpdateSacramentParishSection(index, 'title', event.target.value)}
                                  />
                                </label>
                                <label>
                                  <span>Treść</span>
                                  <textarea
                                    rows={4}
                                    value={section.body}
                                    onChange={(event) => handleUpdateSacramentParishSection(index, 'body', event.target.value)}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className="ghost"
                                  onClick={() => handleRemoveSacramentParishSection(index)}
                                >
                                  Usuń sekcję
                                </button>
                              </article>
                            ))
                          )}
                        </div>
                        {sacramentParishSaveError ? (
                          <p className="confirmation-info confirmation-info-error">{sacramentParishSaveError}</p>
                        ) : null}
                        {sacramentParishSaveInfo ? (
                          <p className="confirmation-info confirmation-info-success">{sacramentParishSaveInfo}</p>
                        ) : null}
                        <div className="builder-actions">
                          <button
                            type="button"
                            className="parish-login"
                            disabled={sacramentParishSaving}
                            onClick={() => void handleSaveSacramentParishPage()}
                          >
                            {sacramentParishSaving ? 'Zapisywanie...' : 'Zapisz treść parafialną'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {activeSacramentPanelSection === 'faq' && (
                  <div className="parish-card sacrament-panel-content">
                    <h3>{selectedSacramentFaqPage?.title ?? 'FAQ (ogólne)'}</h3>
                    {selectedSacramentFaqPage?.lead ? <p className="note">{selectedSacramentFaqPage.lead}</p> : null}
                    <div className="accordion">
                      {selectedSacramentFaq.map((item, index) => (
                        <details key={`${selectedSacrament.id}-faq-${index}`}>
                          <summary>{item.question}</summary>
                          <div className="accordion-body">
                            <p className="note">{item.answer}</p>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSacrament.id === 'confirmation' && activeSacramentPanelSection === 'form' && (
                  <>
                    <div className="parish-card confirmation-form-card">
                      <div className="section-header">
                        <div>
                          <p className="tag">Bierzmowanie</p>
                          <h3>Formularz zgłoszeniowy</h3>
                        </div>
                        <span className="muted">Bez logowania. Zgłoszenia są jednokierunkowe.</span>
                      </div>
                      <div className="admin-form-grid">
                        <label>
                          <span>Imię</span>
                          <input
                            type="text"
                            value={confirmationName}
                            onChange={(event) => setConfirmationName(event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Nazwisko</span>
                          <input
                            type="text"
                            value={confirmationSurname}
                            onChange={(event) => setConfirmationSurname(event.target.value)}
                          />
                        </label>
                        <label className="admin-form-full">
                          <span>Numery telefonów (każdy numer w nowej linii)</span>
                          <textarea
                            rows={3}
                            value={confirmationPhonesRaw}
                            onChange={(event) => setConfirmationPhonesRaw(event.target.value)}
                            placeholder="+48 600 111 222&#10;+48 600 333 444"
                          />
                        </label>
                        <label className="admin-form-full">
                          <span>Adres zamieszkania</span>
                          <textarea
                            rows={2}
                            value={confirmationAddress}
                            onChange={(event) => setConfirmationAddress(event.target.value)}
                          />
                        </label>
                        <label className="admin-form-full">
                          <span>Szkoła (skrót)</span>
                          <input
                            type="text"
                            value={confirmationSchoolShort}
                            onChange={(event) => setConfirmationSchoolShort(event.target.value)}
                            placeholder="np. SP12"
                          />
                        </label>
                        <label className="mass-require-intentions admin-form-full">
                          <input
                            type="checkbox"
                            checked={confirmationAcceptedRodo}
                            onChange={(event) => setConfirmationAcceptedRodo(event.target.checked)}
                          />
                          <span>Akceptuję RODO.</span>
                        </label>
                      </div>
                      {confirmationFormError ? <p className="confirmation-info confirmation-info-error">{confirmationFormError}</p> : null}
                      {confirmationFormSuccess ? (
                        <p className="confirmation-info confirmation-info-success">{confirmationFormSuccess}</p>
                      ) : null}
                      <div className="builder-actions">
                        <button
                          type="button"
                          className="parish-login"
                          disabled={confirmationSubmitting}
                          onClick={handleSubmitConfirmationCandidate}
                        >
                          {confirmationSubmitting ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
                        </button>
                      </div>
                    </div>
                    {isAuthenticated && (
                      <div className="parish-card confirmation-admin-card">
                        <div className="section-header">
                          <div>
                            <p className="tag">Panel admina</p>
                            <h3>Zgłoszenia do bierzmowania</h3>
                          </div>
                          <button type="button" className="ghost" onClick={() => void loadConfirmationCandidates()}>
                            Odśwież
                          </button>
                        </div>
                        <div className="tabs small confirmation-admin-tabs">
                          <button
                            type="button"
                            className={confirmationAdminTab === 'submissions' ? 'is-active' : undefined}
                            onClick={() => setConfirmationAdminTab('submissions')}
                          >
                            Zgłoszenia
                          </button>
                          <button
                            type="button"
                            className={confirmationAdminTab === 'print' ? 'is-active' : undefined}
                            onClick={() => setConfirmationAdminTab('print')}
                          >
                            Karty do druku (A5)
                          </button>
                        </div>
                        <div className="confirmation-admin-actions">
                          <button
                            type="button"
                            className="ghost"
                            disabled={confirmationTransferBusy}
                            onClick={() => void handleExportConfirmationCandidates()}
                          >
                            {confirmationTransferBusy ? 'Przetwarzanie...' : 'Eksportuj JSON'}
                          </button>
                          <label className="ghost">
                            Importuj JSON
                            <input
                              ref={confirmationImportFileRef}
                              type="file"
                              accept="application/json"
                              disabled={confirmationTransferBusy}
                              onChange={(event) => void handleImportConfirmationCandidates(event)}
                              hidden
                            />
                          </label>
                          <label className="mass-require-intentions">
                            <input
                              type="checkbox"
                              checked={confirmationImportReplaceExisting}
                              disabled={confirmationTransferBusy}
                              onChange={(event) => setConfirmationImportReplaceExisting(event.target.checked)}
                            />
                            <span>Zastąp obecne zgłoszenia przy imporcie</span>
                          </label>
                        </div>
                        {confirmationTransferError ? (
                          <p className="confirmation-info confirmation-info-error">{confirmationTransferError}</p>
                        ) : null}
                        {confirmationTransferInfo ? (
                          <p className="confirmation-info confirmation-info-success">{confirmationTransferInfo}</p>
                        ) : null}
                        {confirmationCandidatesError ? (
                          <p className="confirmation-info confirmation-info-error">{confirmationCandidatesError}</p>
                        ) : null}
                        {confirmationAdminTab === 'submissions' ? (
                          <>
                            <div className="confirmation-duplicate-panel">
                              <div className="section-header">
                                <div>
                                  <p className="tag">Duplikaty</p>
                                  <h4>Wykryte zgłoszenia o tym samym imieniu i nazwisku</h4>
                                </div>
                              </div>
                              {confirmationDuplicateGroups.length === 0 ? (
                                <p className="muted">Brak wykrytych duplikatów kandydatów.</p>
                              ) : (
                                <>
                                  <div className="admin-form-grid">
                                    <label className="admin-form-full">
                                      <span>Grupa duplikatów</span>
                                      <select
                                        value={confirmationMergeGroupKey ?? ''}
                                        onChange={(event) => setConfirmationMergeGroupKey(event.target.value || null)}
                                      >
                                        {confirmationDuplicateGroups.map((group) => (
                                          <option key={`dup-group-${group.key}`} value={group.key}>
                                            {group.displayName} ({group.candidates.length})
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label>
                                      <span>Rekord docelowy (zostaje)</span>
                                      <select
                                        value={confirmationMergeTargetId ?? ''}
                                        onChange={(event) => setConfirmationMergeTargetId(event.target.value || null)}
                                      >
                                        {(selectedConfirmationDuplicateGroup?.candidates ?? []).map((candidate) => (
                                          <option key={`merge-target-${candidate.id}`} value={candidate.id}>
                                            {candidate.name} {candidate.surname} • {new Date(candidate.createdUtc).toLocaleDateString('pl-PL')}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label>
                                      <span>Rekord źródłowy (zniknie)</span>
                                      <select
                                        value={confirmationMergeSourceId ?? ''}
                                        onChange={(event) => setConfirmationMergeSourceId(event.target.value || null)}
                                      >
                                        {(selectedConfirmationDuplicateGroup?.candidates ?? [])
                                          .filter((candidate) => candidate.id !== confirmationMergeTargetId)
                                          .map((candidate) => (
                                            <option key={`merge-source-${candidate.id}`} value={candidate.id}>
                                              {candidate.name} {candidate.surname} • {new Date(candidate.createdUtc).toLocaleDateString('pl-PL')}
                                            </option>
                                          ))}
                                      </select>
                                    </label>
                                  </div>
                                  {confirmationMergeTargetCandidate && confirmationMergeSourceCandidate ? (
                                    <>
                                      <div className="admin-form-grid">
                                        <label>
                                          <span>Imię</span>
                                          <select
                                            value={confirmationMergeNameSource}
                                            onChange={(event) =>
                                              setConfirmationMergeNameSource(
                                                event.target.value === 'source' ? 'source' : 'target'
                                              )
                                            }
                                          >
                                            <option value="target">{confirmationMergeTargetCandidate.name}</option>
                                            <option value="source">{confirmationMergeSourceCandidate.name}</option>
                                          </select>
                                        </label>
                                        <label>
                                          <span>Nazwisko</span>
                                          <select
                                            value={confirmationMergeSurnameSource}
                                            onChange={(event) =>
                                              setConfirmationMergeSurnameSource(
                                                event.target.value === 'source' ? 'source' : 'target'
                                              )
                                            }
                                          >
                                            <option value="target">{confirmationMergeTargetCandidate.surname}</option>
                                            <option value="source">{confirmationMergeSourceCandidate.surname}</option>
                                          </select>
                                        </label>
                                        <label>
                                          <span>Adres</span>
                                          <select
                                            value={confirmationMergeAddressSource}
                                            onChange={(event) =>
                                              setConfirmationMergeAddressSource(
                                                event.target.value === 'source' ? 'source' : 'target'
                                              )
                                            }
                                          >
                                            <option value="target">{confirmationMergeTargetCandidate.address}</option>
                                            <option value="source">{confirmationMergeSourceCandidate.address}</option>
                                          </select>
                                        </label>
                                        <label>
                                          <span>Szkoła</span>
                                          <select
                                            value={confirmationMergeSchoolSource}
                                            onChange={(event) =>
                                              setConfirmationMergeSchoolSource(
                                                event.target.value === 'source' ? 'source' : 'target'
                                              )
                                            }
                                          >
                                            <option value="target">{confirmationMergeTargetCandidate.schoolShort}</option>
                                            <option value="source">{confirmationMergeSourceCandidate.schoolShort}</option>
                                          </select>
                                        </label>
                                        <label>
                                          <span>Termin spotkania</span>
                                          <select
                                            value={confirmationMergeMeetingSource}
                                            onChange={(event) =>
                                              setConfirmationMergeMeetingSource(
                                                event.target.value === 'target'
                                                  ? 'target'
                                                  : event.target.value === 'source'
                                                  ? 'source'
                                                  : 'none'
                                              )
                                            }
                                          >
                                            <option value="none">Brak terminu</option>
                                            <option value="target">
                                              Rekord docelowy {confirmationMergeTargetCandidate.meetingSlotId ? '(ma termin)' : '(bez terminu)'}
                                            </option>
                                            <option value="source">
                                              Rekord źródłowy {confirmationMergeSourceCandidate.meetingSlotId ? '(ma termin)' : '(bez terminu)'}
                                            </option>
                                          </select>
                                        </label>
                                        <label>
                                          <span>Link portalu po scaleniu</span>
                                          <select
                                            value={confirmationMergePortalSource}
                                            onChange={(event) =>
                                              setConfirmationMergePortalSource(
                                                event.target.value === 'source' ? 'source' : 'target'
                                              )
                                            }
                                          >
                                            <option value="target">Z rekordu docelowego</option>
                                            <option value="source">Z rekordu źródłowego</option>
                                          </select>
                                        </label>
                                        <label className="admin-form-full">
                                          <span>Numery telefonów do zachowania</span>
                                          <div className="confirmation-merge-phone-list">
                                            {confirmationMergePhoneOptions.map((option) => (
                                              <label key={`merge-phone-${option.number}`} className="mass-require-intentions">
                                                <input
                                                  type="checkbox"
                                                  checked={confirmationMergeSelectedPhones.includes(option.number)}
                                                  onChange={(event) =>
                                                    handleToggleConfirmationMergePhone(option.number, event.target.checked)
                                                  }
                                                />
                                                <span>
                                                  {option.number}
                                                  {option.target ? ' [docelowy]' : ''}
                                                  {option.source ? ' [źródłowy]' : ''}
                                                  {option.verified ? ' • zweryfikowany' : ' • niezweryfikowany'}
                                                </span>
                                              </label>
                                            ))}
                                          </div>
                                        </label>
                                      </div>
                                      <div className="builder-actions">
                                        <button
                                          type="button"
                                          className="parish-login"
                                          disabled={confirmationMergeBusy || !confirmationMergeSourceId || !confirmationMergeTargetId}
                                          onClick={() => void handleMergeDuplicateConfirmationCandidates()}
                                        >
                                          {confirmationMergeBusy ? 'Scalanie...' : 'Scal wybrane zgłoszenia'}
                                        </button>
                                      </div>
                                    </>
                                  ) : null}
                                  {confirmationMergeError ? (
                                    <p className="confirmation-info confirmation-info-error">{confirmationMergeError}</p>
                                  ) : null}
                                  {confirmationMergeInfo ? (
                                    <p className="confirmation-info confirmation-info-success">{confirmationMergeInfo}</p>
                                  ) : null}
                                </>
                              )}
                            </div>
                            {confirmationCandidates.length === 0 ? (
                              <p className="muted">Brak zgłoszeń.</p>
                            ) : (
                              <div className="confirmation-candidate-list">
                                {confirmationCandidates.map((candidate) => (
                                  <article key={candidate.id} className="confirmation-candidate-item">
                                    <div className="confirmation-candidate-head">
                                      <strong>
                                        {candidate.name} {candidate.surname}
                                      </strong>
                                      <span className="muted">
                                        {new Date(candidate.createdUtc).toLocaleString('pl-PL')}
                                      </span>
                                    </div>
                                    <p className="note">
                                      <strong>Adres:</strong> {candidate.address}
                                    </p>
                                    <p className="note">
                                      <strong>Szkoła:</strong> {candidate.schoolShort}
                                    </p>
                                    <p className="note">
                                      <strong>Spotkanie:</strong>{' '}
                                      {candidate.meetingSlotId ? 'Termin wybrany' : 'Brak wybranego terminu'}
                                    </p>
                                    <p className="note">
                                      <strong>Oświadczenie papierowe rodzica:</strong>{' '}
                                      {candidate.paperConsentReceived ? 'Dostarczone do księdza' : 'Niepotwierdzone'}
                                    </p>
                                    <div className="confirmation-candidate-links">
                                      <button
                                        type="button"
                                        className="ghost"
                                        onClick={() => void handleCopyConfirmationMeetingLink(candidate.meetingToken)}
                                      >
                                        {confirmationCopiedMeetingToken === candidate.meetingToken
                                          ? 'Skopiowano link portalu'
                                          : 'Kopiuj link portalu'}
                                      </button>
                                      <button
                                        type="button"
                                        className="ghost"
                                        disabled={confirmationAdminSendingAction}
                                        onClick={() =>
                                          void handleAdminToggleCandidatePaperConsent(
                                            candidate.id,
                                            !candidate.paperConsentReceived
                                          )
                                        }
                                      >
                                        {candidate.paperConsentReceived ? 'Oznacz jako brak oświadczenia' : 'Oznacz jako dostarczone'}
                                      </button>
                                    </div>
                                    <ul className="confirmation-phone-list">
                                      {candidate.phoneNumbers.map((phone) => {
                                        const verificationSmsHref = buildConfirmationVerificationSmsHref(
                                          phone.number,
                                          phone.verificationToken
                                        );
                                        const warningSmsHref = buildConfirmationVerificationWarningSmsHref(
                                          phone.number,
                                          phone.verificationToken
                                        );
                                        const portalSmsHref = buildConfirmationPortalInviteSmsHref(
                                          phone.number,
                                          candidate.meetingToken
                                        );
                                        return (
                                          <li key={`${candidate.id}-${phone.index}`}>
                                            <span>{phone.number}</span>
                                            {phone.isVerified ? (
                                              <>
                                                <span className="pill">Zweryfikowany</span>
                                                <div className="confirmation-phone-actions">
                                                  {portalSmsHref ? (
                                                    <a className="ghost" href={portalSmsHref}>
                                                      SMS: portal kandydata
                                                    </a>
                                                  ) : null}
                                                </div>
                                              </>
                                            ) : (
                                              <>
                                                <span className="pill">Niezweryfikowany</span>
                                                <div className="confirmation-phone-actions">
                                                  {verificationSmsHref ? (
                                                    <a className="ghost" href={verificationSmsHref}>
                                                      SMS: weryfikacja
                                                    </a>
                                                  ) : null}
                                                  {warningSmsHref ? (
                                                    <a className="ghost" href={warningSmsHref}>
                                                      SMS: brak weryfikacji
                                                    </a>
                                                  ) : null}
                                                  <button
                                                    type="button"
                                                    className="ghost"
                                                    onClick={() => void handleCopyConfirmationVerificationLink(phone.verificationToken)}
                                                  >
                                                    {confirmationCopiedToken === phone.verificationToken
                                                      ? 'Skopiowano'
                                                      : 'Kopiuj link weryfikacji'}
                                                  </button>
                                                </div>
                                              </>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </article>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="confirmation-print-panel">
                            <div className="confirmation-print-toolbar">
                              <p className="note">
                                Wydruk otwiera się jako osobny dokument A5 (preferowana nowa karta; przy blokadzie popup bieżąca karta).
                              </p>
                              <button type="button" className="parish-login" onClick={handlePrintConfirmationCards}>
                                Drukuj wszystkie karty
                              </button>
                            </div>
                            {confirmationCandidates.length === 0 ? (
                              <p className="muted">Brak zgłoszeń do wydruku.</p>
                            ) : (
                              <div className="confirmation-print-root">
                                {confirmationCandidates.map((candidate) => (
                                  <article key={`print-${candidate.id}`} className="confirmation-print-sheet">
                                    <section className="confirmation-print-side confirmation-print-side-front">
                                      <p className="tag">Bierzmowanie</p>
                                      <h4>Oświadczenie rodzica / opiekuna prawnego</h4>
                                      <p className="confirmation-print-lead">
                                        OŚWIADCZENIE RODZICA / OPIEKUNA PRAWNEGO DOTYCZĄCE UDZIAŁU DZIECKA W PRZYGOTOWANIU DO
                                        SAKRAMENTU BIERZMOWANIA
                                      </p>
                                      <p>
                                        <strong>Imię i nazwisko:</strong> {candidate.name} {candidate.surname}
                                      </p>
                                      <p>
                                        <strong>Adres zamieszkania:</strong> {candidate.address}
                                      </p>
                                      <p>
                                        <strong>Szkoła (skrót):</strong> {candidate.schoolShort}
                                      </p>
                                      <p>
                                        <strong>Numery kontaktowe:</strong>
                                      </p>
                                      <ul className="confirmation-print-phones">
                                        {candidate.phoneNumbers.map((phone) => (
                                          <li key={`print-${candidate.id}-${phone.index}`}>
                                            {phone.number}
                                          </li>
                                        ))}
                                      </ul>
                                      <p>
                                        <strong>Data zgłoszenia:</strong> {new Date(candidate.createdUtc).toLocaleDateString('pl-PL')}
                                      </p>
                                      {confirmationParentConsentDraft.map((paragraph, index) => (
                                        <p key={`parent-consent-${candidate.id}-${index}`}>{paragraph}</p>
                                      ))}
                                      <div className="confirmation-print-signature-block">
                                        <p>Miejscowość, data: .............................................................</p>
                                        <p>Podpis rodzica / opiekuna prawnego: .............................................................</p>
                                      </div>
                                    </section>
                                    <section className="confirmation-print-side confirmation-print-side-back">
                                      <p className="tag">RODO</p>
                                      <h4>Klauzula informacyjna RODO</h4>
                                      <p className="confirmation-print-lead">
                                        KLAUZULA INFORMACYJNA DOTYCZĄCA PRZETWARZANIA DANYCH OSOBOWYCH
                                      </p>
                                      <p>{confirmationRodoClauseDraft.intro}</p>
                                      <p>{confirmationRodoClauseDraft.admin}</p>
                                      <p>{confirmationRodoClauseDraft.iod}</p>
                                      <p>{confirmationRodoClauseDraft.purposesLead}</p>
                                      <ul className="confirmation-print-phones confirmation-print-rodo-list">
                                        {confirmationRodoClauseDraft.purposes.map((item, index) => (
                                          <li key={`rodo-purpose-${candidate.id}-${index}`}>{item}</li>
                                        ))}
                                      </ul>
                                      <p>{confirmationRodoClauseDraft.recipients}</p>
                                      <p>{confirmationRodoClauseDraft.retention}</p>
                                      <p>{confirmationRodoClauseDraft.rights}</p>
                                      <p>{confirmationRodoClauseDraft.supervision}</p>
                                      <p>{confirmationRodoClauseDraft.automation}</p>
                                      <p>{confirmationRodoClauseDraft.required}</p>
                                      <p>{confirmationRodoClauseDraft.acknowledgment}</p>
                                    </section>
                                  </article>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                {selectedSacrament.id === 'confirmation' && activeSacramentPanelSection === 'candidate' && (
                  <>
                    <div className="parish-card confirmation-candidate-portal">
                      <div className="section-header">
                        <div>
                          <p className="tag">Portal kandydata</p>
                          <h3>Indywidualny portal przygotowania</h3>
                        </div>
                        <span className="pill">Mock / w budowie</span>
                      </div>
                      {confirmationPortalLoading ? <p className="muted">Ładowanie portalu kandydata...</p> : null}
                      {confirmationPortalError ? <p className="confirmation-info confirmation-info-error">{confirmationPortalError}</p> : null}
                      {confirmationPortalInfo ? <p className="confirmation-info confirmation-info-success">{confirmationPortalInfo}</p> : null}
                      {confirmationPortalData ? (
                        <>
                          <div className="confirmation-portal-columns">
                            <article className="confirmation-portal-card">
                              <h4>Dane kandydata</h4>
                              <p>
                                <strong>Imię i nazwisko:</strong> {confirmationPortalData.candidate.name} {confirmationPortalData.candidate.surname}
                              </p>
                              <p>
                                <strong>Adres:</strong> {confirmationPortalData.candidate.address}
                              </p>
                              <p>
                                <strong>Szkoła:</strong> {confirmationPortalData.candidate.schoolShort}
                              </p>
                              <p>
                                <strong>Oświadczenie papierowe rodzica:</strong>{' '}
                                {confirmationPortalData.candidate.paperConsentReceived
                                  ? 'Dostarczone do księdza'
                                  : 'Jeszcze niedostarczone'}
                              </p>
                              <p>
                                <strong>Telefony:</strong>
                              </p>
                              <ul className="confirmation-meeting-candidate-list">
                                {confirmationPortalData.candidate.phoneNumbers.map((phone) => (
                                  <li key={`portal-phone-${phone.index}`}>
                                    {phone.number} {phone.isVerified ? '(zweryfikowany)' : '(oczekuje na weryfikację)'}
                                  </li>
                                ))}
                              </ul>
                            </article>
                            <article className="confirmation-portal-card">
                              <h4>Spotkanie początkowe (1. rok)</h4>
                              {!confirmationPortalData.candidate.selectedSlotId ? (
                                <>
                                  <div className="confirmation-candidate-instruction">
                                    <p className="note">
                                      <strong>Krok 1: wybierz termin spotkania.</strong>
                                    </p>
                                    <ol className="confirmation-meeting-candidate-list">
                                      <li>Sprawdź listę terminów i wybierz jeden pasujący termin.</li>
                                      <li>Jeśli termin wymaga kodu zaproszenia, wpisz kod 6-znakowy i kliknij „Zastosuj kod”.</li>
                                      <li>Po zapisie pojawi się status z wybraną datą i godziną.</li>
                                      <li>W razie problemów napisz wiadomość do parafii poniżej.</li>
                                    </ol>
                                  </div>
                                  <div className="confirmation-candidate-links">
                                    <label>
                                      <span>Kod zaproszenia do terminu (6 znaków)</span>
                                      <input
                                        type="text"
                                        value={confirmationMeetingInviteCodeInput}
                                        onChange={(event) =>
                                          setConfirmationMeetingInviteCodeInput(
                                            normalizeConfirmationInviteCode(event.target.value)
                                          )
                                        }
                                        placeholder="np. A3K9Q2"
                                        maxLength={6}
                                      />
                                    </label>
                                    <button type="button" className="ghost" onClick={handleApplyConfirmationInviteCode}>
                                      Zastosuj kod
                                    </button>
                                    <button type="button" className="ghost" onClick={handleClearConfirmationInviteCode}>
                                      Wyczyść kod
                                    </button>
                                  </div>
                                  {confirmationPortalData.firstYearStartSlots.length === 0 ? (
                                    <p className="muted">Brak aktywnych terminów spotkań.</p>
                                  ) : (
                                    <div className="confirmation-meeting-slot-list">
                                      {confirmationPortalData.firstYearStartSlots.map((slot) => {
                                        const starts = new Date(slot.startsAtUtc);
                                        const availablePlaces = Math.max(slot.capacity - slot.reservedCount, 0);
                                        return (
                                          <article key={`portal-slot-${slot.id}`} className="confirmation-meeting-slot">
                                            <p>
                                              <strong>{starts.toLocaleString('pl-PL')}</strong>
                                            </p>
                                            <p className="note">
                                              Czas: {slot.durationMinutes} min • Zajętość: {slot.reservedCount}/{slot.capacity}
                                              {slot.label ? ` • ${slot.label}` : ''}
                                            </p>
                                            <p className="note">
                                              {slot.isAvailable
                                                ? `Możesz dołączyć. Pozostało miejsc: ${availablePlaces}.`
                                                : slot.requiresInviteCode
                                                ? 'Termin wymaga aktywnego kodu zaproszenia od administratora terminu.'
                                                : 'Termin jest zamknięty lub pełny.'}
                                            </p>
                                            <button
                                              type="button"
                                              className="parish-login"
                                              disabled={confirmationMeetingPublicSaving || !slot.isAvailable}
                                              onClick={() => void handleBookConfirmationMeetingSlot(slot.id)}
                                            >
                                              {confirmationMeetingPublicSaving ? 'Zapisywanie...' : 'Wybierz termin'}
                                            </button>
                                          </article>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="confirmation-selected-slot">
                                    <p className="note">
                                      <strong>Wybrany termin spotkania:</strong>{' '}
                                      {confirmationPortalSelectedFirstYearSlot
                                        ? new Date(confirmationPortalSelectedFirstYearSlot.startsAtUtc).toLocaleString('pl-PL')
                                        : 'Termin zapisany'}
                                    </p>
                                    {confirmationPortalSelectedFirstYearSlot ? (
                                      <p className="note">
                                        Czas: {confirmationPortalSelectedFirstYearSlot.durationMinutes} min • Zajętość:{' '}
                                        {confirmationPortalSelectedFirstYearSlot.reservedCount}/{confirmationPortalSelectedFirstYearSlot.capacity}
                                        {confirmationPortalSelectedFirstYearSlot.label
                                          ? ` • ${confirmationPortalSelectedFirstYearSlot.label}`
                                          : ''}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="confirmation-candidate-instruction">
                                    <p className="note">
                                      <strong>Krok 2: po wyborze terminu.</strong>
                                    </p>
                                    <ol className="confirmation-meeting-candidate-list">
                                      <li>Przyjdź na spotkanie punktualnie, z przygotowanymi pytaniami.</li>
                                      <li>Jeśli jesteś administratorem terminu, przekaż kod zaproszenia kolejnym osobom.</li>
                                      <li>Jeśli chcesz zwolnić uprawnienia administratora wcześniej, użyj przycisku poniżej.</li>
                                    </ol>
                                  </div>
                                  {confirmationPortalData.candidate.canInviteToSelectedSlot &&
                                  confirmationPortalData.candidate.selectedSlotInviteCode ? (
                                    <div className="confirmation-candidate-links">
                                      <p className="note">
                                        Twój kod zaproszenia: <strong>{confirmationPortalData.candidate.selectedSlotInviteCode}</strong>.
                                        Kod wygasa:
                                        {' '}
                                        {confirmationPortalData.candidate.selectedSlotInviteExpiresUtc
                                          ? new Date(confirmationPortalData.candidate.selectedSlotInviteExpiresUtc).toLocaleString('pl-PL')
                                          : 'wkrótce'}
                                        .
                                      </p>
                                      <button
                                        type="button"
                                        className="ghost"
                                        onClick={() =>
                                          void handleCopyConfirmationMeetingInviteLink(
                                            confirmationPortalData.candidate.selectedSlotInviteCode
                                          )
                                        }
                                      >
                                        {confirmationCopiedInviteToken === confirmationPortalData.candidate.selectedSlotInviteCode
                                          ? 'Skopiowano kod'
                                          : 'Kopiuj kod zaproszenia'}
                                      </button>
                                      <button
                                        type="button"
                                        className="ghost"
                                        disabled={confirmationMeetingPublicSaving}
                                        onClick={() => void handleReleaseConfirmationMeetingHost()}
                                      >
                                        {confirmationMeetingPublicSaving ? 'Zwalnianie...' : 'Zwolnij uprawnienia administratora'}
                                      </button>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </article>
                          </div>
                          <article className="confirmation-portal-card">
                            <h4>Spotkanie końcowe (1. rok)</h4>
                            <p className="note">{confirmationPortalData.secondMeetingAnnouncement}</p>
                          </article>
                          <div className="confirmation-portal-columns">
                            <article className="confirmation-portal-card">
                              <h4>Wiadomości kandydat ↔ parafia</h4>
                              {confirmationPortalData.messages.length === 0 ? (
                                <p className="muted">Brak wiadomości.</p>
                              ) : (
                                <ul className="confirmation-portal-message-list">
                                  {confirmationPortalData.messages.map((message) => (
                                    <li key={`portal-msg-${message.id}`}>
                                      <strong>{message.senderType === 'admin' ? 'Parafia' : 'Kandydat'}:</strong> {message.messageText}
                                      <br />
                                      <span className="muted">{new Date(message.createdUtc).toLocaleString('pl-PL')}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <label>
                                <span>Nowa wiadomość do parafii</span>
                                <textarea
                                  rows={3}
                                  value={confirmationPortalMessageDraft}
                                  onChange={(event) => setConfirmationPortalMessageDraft(event.target.value)}
                                />
                              </label>
                              <button
                                type="button"
                                className="parish-login"
                                disabled={confirmationPortalSendingMessage}
                                onClick={() => void handleSendConfirmationPortalMessage()}
                              >
                                {confirmationPortalSendingMessage ? 'Wysyłanie...' : 'Wyślij wiadomość'}
                              </button>
                            </article>
                            <article className="confirmation-portal-card">
                              <h4>Publiczne adnotacje parafii</h4>
                              {confirmationPortalData.publicNotes.length === 0 ? (
                                <p className="muted">Brak publicznych adnotacji.</p>
                              ) : (
                                <ul className="confirmation-portal-message-list">
                                  {confirmationPortalData.publicNotes.map((note) => (
                                    <li key={`portal-public-note-${note.id}`}>
                                      {note.noteText}
                                      <br />
                                      <span className="muted">{new Date(note.updatedUtc).toLocaleString('pl-PL')}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </article>
                          </div>
                        </>
                      ) : null}
                    </div>
                    {isAuthenticated && (
                      <div className="parish-card confirmation-candidate-admin-portal">
                        <div className="section-header">
                          <div>
                            <p className="tag">Panel admina</p>
                            <h3>Wyszukiwarka i edycja kandydatów</h3>
                          </div>
                          <button type="button" className="ghost" onClick={() => void loadConfirmationCandidates()}>
                            Odśwież kandydatów
                          </button>
                        </div>
                        <div className="admin-form-grid">
                          <label className="admin-form-full">
                            <span>Szukaj kandydata</span>
                            <input
                              type="text"
                              value={confirmationAdminCandidateSearch}
                              onChange={(event) => setConfirmationAdminCandidateSearch(event.target.value)}
                              placeholder="Imię, nazwisko, adres, szkoła"
                            />
                          </label>
                          <label className="admin-form-full">
                            <span>Wybierz kandydata</span>
                            <select
                              value={confirmationAdminSelectedCandidateId ?? ''}
                              onChange={(event) => setConfirmationAdminSelectedCandidateId(event.target.value || null)}
                            >
                              {filteredConfirmationCandidates.length === 0 ? (
                                <option value="">Brak kandydatów dla tego filtra</option>
                              ) : (
                                filteredConfirmationCandidates.map((candidate) => (
                                  <option key={`portal-candidate-${candidate.id}`} value={candidate.id}>
                                    {candidate.name} {candidate.surname} • {candidate.schoolShort}
                                  </option>
                                ))
                              )}
                            </select>
                          </label>
                        </div>
                        {confirmationAdminPortalLoading ? <p className="muted">Ładowanie danych kandydata...</p> : null}
                        {confirmationAdminPortalError ? (
                          <p className="confirmation-info confirmation-info-error">{confirmationAdminPortalError}</p>
                        ) : null}
                        {confirmationAdminPortalInfo ? (
                          <p className="confirmation-info confirmation-info-success">{confirmationAdminPortalInfo}</p>
                        ) : null}
                        {confirmationAdminPortalData ? (
                          <>
                            <div className="confirmation-candidate-links">
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => void handleCopyConfirmationMeetingLink(confirmationAdminPortalData.candidate.portalToken)}
                              >
                                {confirmationCopiedMeetingToken === confirmationAdminPortalData.candidate.portalToken
                                  ? 'Skopiowano link portalu'
                                  : 'Kopiuj link portalu kandydata'}
                              </button>
                              {confirmationAdminPortalData.candidate.canInviteToSelectedSlot &&
                              confirmationAdminPortalData.candidate.selectedSlotInviteCode ? (
                                <button
                                  type="button"
                                  className="ghost"
                                  onClick={() =>
                                    void handleCopyConfirmationMeetingInviteLink(
                                      confirmationAdminPortalData.candidate.selectedSlotInviteCode
                                    )
                                  }
                                >
                                  {confirmationCopiedInviteToken === confirmationAdminPortalData.candidate.selectedSlotInviteCode
                                    ? 'Skopiowano kod zaproszenia'
                                    : 'Kopiuj kod zaproszenia'}
                                </button>
                              ) : null}
                            </div>
                            <div className="admin-form-grid">
                              <label>
                                <span>Imię</span>
                                <input
                                  type="text"
                                  value={confirmationAdminEditName}
                                  onChange={(event) => setConfirmationAdminEditName(event.target.value)}
                                />
                              </label>
                              <label>
                                <span>Nazwisko</span>
                                <input
                                  type="text"
                                  value={confirmationAdminEditSurname}
                                  onChange={(event) => setConfirmationAdminEditSurname(event.target.value)}
                                />
                              </label>
                              <label className="admin-form-full">
                                <span>Numery telefonów (linia po linii)</span>
                                <textarea
                                  rows={3}
                                  value={confirmationAdminEditPhonesRaw}
                                  onChange={(event) => setConfirmationAdminEditPhonesRaw(event.target.value)}
                                />
                              </label>
                              <label className="admin-form-full">
                                <span>Adres</span>
                                <textarea
                                  rows={2}
                                  value={confirmationAdminEditAddress}
                                  onChange={(event) => setConfirmationAdminEditAddress(event.target.value)}
                                />
                              </label>
                              <label className="admin-form-full">
                                <span>Szkoła (skrót)</span>
                                <input
                                  type="text"
                                  value={confirmationAdminEditSchoolShort}
                                  onChange={(event) => setConfirmationAdminEditSchoolShort(event.target.value)}
                                />
                              </label>
                              <label className="admin-form-full builder-option">
                                <input
                                  type="checkbox"
                                  checked={confirmationAdminEditPaperConsentReceived}
                                  onChange={(event) => setConfirmationAdminEditPaperConsentReceived(event.target.checked)}
                                />
                                <span>Oświadczenie papierowe rodzica dostarczone do księdza</span>
                              </label>
                            </div>
                            <div className="builder-actions">
                              <button
                                type="button"
                                className="parish-login"
                                disabled={confirmationAdminSendingAction}
                                onClick={() => void handleAdminUpdateCandidateData()}
                              >
                                {confirmationAdminSendingAction ? 'Zapisywanie...' : 'Zapisz dane kandydata'}
                              </button>
                              <button
                                type="button"
                                className="ghost"
                                disabled={confirmationAdminSendingAction}
                                onClick={() => void handleAdminUpdateCandidatePaperConsent()}
                              >
                                {confirmationAdminSendingAction ? 'Zapisywanie...' : 'Zapisz status oświadczenia papierowego'}
                              </button>
                            </div>
                            <div className="confirmation-portal-columns">
                              <article className="confirmation-portal-card">
                                <h4>Wyślij wiadomość do kandydata</h4>
                                <textarea
                                  rows={3}
                                  value={confirmationAdminMessageDraft}
                                  onChange={(event) => setConfirmationAdminMessageDraft(event.target.value)}
                                />
                                <button
                                  type="button"
                                  className="parish-login"
                                  disabled={confirmationAdminSendingAction}
                                  onClick={() => void handleAdminSendMessageToCandidate()}
                                >
                                  Wyślij wiadomość
                                </button>
                              </article>
                              <article className="confirmation-portal-card">
                                <h4>Adnotacje publiczne</h4>
                                <textarea
                                  rows={3}
                                  value={confirmationAdminPublicNoteDraft}
                                  onChange={(event) => setConfirmationAdminPublicNoteDraft(event.target.value)}
                                />
                                <button
                                  type="button"
                                  className="parish-login"
                                  disabled={confirmationAdminSendingAction}
                                  onClick={() => void handleAdminAddCandidateNote(true)}
                                >
                                  Dodaj adnotację publiczną
                                </button>
                              </article>
                              <article className="confirmation-portal-card">
                                <h4>Adnotacje prywatne</h4>
                                <textarea
                                  rows={3}
                                  value={confirmationAdminPrivateNoteDraft}
                                  onChange={(event) => setConfirmationAdminPrivateNoteDraft(event.target.value)}
                                />
                                <button
                                  type="button"
                                  className="parish-login"
                                  disabled={confirmationAdminSendingAction}
                                  onClick={() => void handleAdminAddCandidateNote(false)}
                                >
                                  Dodaj adnotację prywatną
                                </button>
                              </article>
                            </div>
                            <div className="confirmation-portal-columns">
                              <article className="confirmation-portal-card">
                                <h4>Historia wiadomości</h4>
                                {confirmationAdminPortalData.messages.length === 0 ? (
                                  <p className="muted">Brak wiadomości.</p>
                                ) : (
                                  <ul className="confirmation-portal-message-list">
                                    {confirmationAdminPortalData.messages.map((message) => (
                                      <li key={`admin-msg-${message.id}`}>
                                        <strong>{message.senderType === 'admin' ? 'Admin' : 'Kandydat'}:</strong> {message.messageText}
                                        <br />
                                        <span className="muted">{new Date(message.createdUtc).toLocaleString('pl-PL')}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </article>
                              <article className="confirmation-portal-card">
                                <h4>Adnotacje publiczne (lista)</h4>
                                {confirmationAdminPortalData.publicNotes.length === 0 ? (
                                  <p className="muted">Brak publicznych adnotacji.</p>
                                ) : (
                                  <ul className="confirmation-portal-message-list">
                                    {confirmationAdminPortalData.publicNotes.map((note) => (
                                      <li key={`admin-public-note-${note.id}`}>
                                        {note.noteText}
                                        <br />
                                        <span className="muted">{new Date(note.updatedUtc).toLocaleString('pl-PL')}</span>
                                        <br />
                                        <button
                                          type="button"
                                          className="ghost"
                                          onClick={() => handleAdminStartEditNote(note.id, note.noteText, note.isPublic)}
                                        >
                                          Edytuj
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </article>
                              <article className="confirmation-portal-card">
                                <h4>Adnotacje prywatne (lista)</h4>
                                {confirmationAdminPortalData.privateNotes && confirmationAdminPortalData.privateNotes.length > 0 ? (
                                  <ul className="confirmation-portal-message-list">
                                    {confirmationAdminPortalData.privateNotes.map((note) => (
                                      <li key={`admin-private-note-${note.id}`}>
                                        {note.noteText}
                                        <br />
                                        <span className="muted">{new Date(note.updatedUtc).toLocaleString('pl-PL')}</span>
                                        <br />
                                        <button
                                          type="button"
                                          className="ghost"
                                          onClick={() => handleAdminStartEditNote(note.id, note.noteText, note.isPublic)}
                                        >
                                          Edytuj
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="muted">Brak prywatnych adnotacji.</p>
                                )}
                              </article>
                            </div>
                            {confirmationAdminEditingNoteId ? (
                              <article className="confirmation-portal-card">
                                <h4>Edycja adnotacji</h4>
                                <label>
                                  <span>Treść</span>
                                  <textarea
                                    rows={4}
                                    value={confirmationAdminEditingNoteText}
                                    onChange={(event) => setConfirmationAdminEditingNoteText(event.target.value)}
                                  />
                                </label>
                                <label className="mass-require-intentions">
                                  <input
                                    type="checkbox"
                                    checked={confirmationAdminEditingNoteIsPublic}
                                    onChange={(event) => setConfirmationAdminEditingNoteIsPublic(event.target.checked)}
                                  />
                                  <span>Adnotacja publiczna (widoczna dla kandydata)</span>
                                </label>
                                <div className="builder-actions">
                                  <button
                                    type="button"
                                    className="parish-login"
                                    disabled={confirmationAdminSendingAction}
                                    onClick={() => void handleAdminSaveEditedNote()}
                                  >
                                    Zapisz adnotację
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => {
                                      setConfirmationAdminEditingNoteId(null);
                                      setConfirmationAdminEditingNoteText('');
                                    }}
                                  >
                                    Anuluj
                                  </button>
                                </div>
                              </article>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
                {selectedSacrament.id === 'confirmation' && activeSacramentPanelSection === 'meetings' && (
                  <>
                    <div className="parish-card confirmation-meetings-public">
                      <div className="section-header">
                        <div>
                          <p className="tag">Bierzmowanie</p>
                          <h3>Zapisy na spotkanie z kandydatami</h3>
                        </div>
                        {confirmationMeetingPublicData?.selectedSlotId ? (
                          <span className="pill">Termin wybrany</span>
                        ) : (
                          <span className="pill">Wybierz termin</span>
                        )}
                      </div>
                      {confirmationMeetingPublicLoading ? <p className="muted">Ładowanie terminów...</p> : null}
                      {confirmationMeetingPublicError ? (
                        <p className="confirmation-info confirmation-info-error">{confirmationMeetingPublicError}</p>
                      ) : null}
                      {confirmationMeetingPublicInfo ? (
                        <p className="confirmation-info confirmation-info-success">{confirmationMeetingPublicInfo}</p>
                      ) : null}
                      {confirmationMeetingPublicData ? (
                        <>
                          <p className="note">
                            Kandydat: <strong>{confirmationMeetingPublicData.candidateName}</strong>
                          </p>
                          <p className="note">
                            Oświadczenie papierowe rodzica:{' '}
                            <strong>
                              {confirmationMeetingPublicData.paperConsentReceived
                                ? 'dostarczone do księdza'
                                : 'jeszcze niedostarczone'}
                            </strong>
                          </p>
                          {!confirmationMeetingPublicData.selectedSlotId ? (
                            <>
                              <div className="confirmation-candidate-instruction">
                                <p className="note">
                                  <strong>Krok 1: wybierz termin spotkania.</strong>
                                </p>
                                <ol className="confirmation-meeting-candidate-list">
                                  <li>Wybierz pasujący termin z listy.</li>
                                  <li>Jeśli termin wymaga kodu, wpisz 6-znakowy kod i kliknij „Zastosuj kod”.</li>
                                  <li>Po zapisie termin pojawi się jako wybrany.</li>
                                </ol>
                              </div>
                              <div className="confirmation-candidate-links">
                                <label>
                                  <span>Kod zaproszenia (6 znaków)</span>
                                  <input
                                    type="text"
                                    value={confirmationMeetingInviteCodeInput}
                                    onChange={(event) =>
                                      setConfirmationMeetingInviteCodeInput(
                                        normalizeConfirmationInviteCode(event.target.value)
                                      )
                                    }
                                    placeholder="np. A3K9Q2"
                                    maxLength={6}
                                  />
                                </label>
                                <button type="button" className="ghost" onClick={handleApplyConfirmationInviteCode}>
                                  Zastosuj kod
                                </button>
                                <button type="button" className="ghost" onClick={handleClearConfirmationInviteCode}>
                                  Wyczyść kod
                                </button>
                              </div>
                              {confirmationMeetingPublicData.slots.length === 0 ? (
                                <p className="muted">Brak dostępnych terminów. Skontaktuj się z parafią.</p>
                              ) : (
                                <div className="confirmation-meeting-slot-list">
                                  {confirmationMeetingPublicData.slots.map((slot) => {
                                    const starts = new Date(slot.startsAtUtc);
                                    const availablePlaces = Math.max(slot.capacity - slot.reservedCount, 0);
                                    return (
                                      <article key={slot.id} className="confirmation-meeting-slot">
                                        <p>
                                          <strong>{starts.toLocaleString('pl-PL')}</strong>
                                        </p>
                                        <p className="note">
                                          Czas: {slot.durationMinutes} min • Miejsca: {slot.reservedCount}/{slot.capacity}
                                          {slot.label ? ` • ${slot.label}` : ''}
                                        </p>
                                        <p className="note">
                                          {slot.isAvailable
                                            ? `Pozostało miejsc: ${availablePlaces}.`
                                            : slot.requiresInviteCode
                                            ? 'Termin jest dostępny tylko z aktywnym kodem zaproszenia.'
                                            : slot.reservedCount >= slot.capacity
                                            ? 'Termin pełny.'
                                            : 'Termin jest obecnie zamknięty.'}
                                        </p>
                                        <button
                                          type="button"
                                          className="parish-login"
                                          disabled={confirmationMeetingPublicSaving || !slot.isAvailable}
                                          onClick={() => void handleBookConfirmationMeetingSlot(slot.id)}
                                        >
                                          {confirmationMeetingPublicSaving ? 'Zapisywanie...' : 'Wybierz ten termin'}
                                        </button>
                                      </article>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="confirmation-selected-slot">
                                <p className="note">
                                  <strong>Wybrany termin:</strong>{' '}
                                  {confirmationMeetingPublicSelectedSlot
                                    ? new Date(confirmationMeetingPublicSelectedSlot.startsAtUtc).toLocaleString('pl-PL')
                                    : 'Termin zapisany'}
                                </p>
                                {confirmationMeetingPublicSelectedSlot ? (
                                  <p className="note">
                                    Czas: {confirmationMeetingPublicSelectedSlot.durationMinutes} min • Miejsca:{' '}
                                    {confirmationMeetingPublicSelectedSlot.reservedCount}/{confirmationMeetingPublicSelectedSlot.capacity}
                                    {confirmationMeetingPublicSelectedSlot.label
                                      ? ` • ${confirmationMeetingPublicSelectedSlot.label}`
                                      : ''}
                                  </p>
                                ) : null}
                              </div>
                              <div className="confirmation-candidate-instruction">
                                <p className="note">
                                  <strong>Krok 2: zapraszanie innych do tego samego terminu.</strong>
                                </p>
                                <ol className="confirmation-meeting-candidate-list">
                                  <li>Przekaż kod zaproszenia osobom, które mają dołączyć do tego terminu.</li>
                                  <li>Kod działa przez 3 dni od wyboru terminu.</li>
                                  <li>Możesz zwolnić uprawnienia administratora wcześniej.</li>
                                </ol>
                              </div>
                              {confirmationMeetingPublicData.canInviteToSelectedSlot &&
                              confirmationMeetingPublicData.selectedSlotInviteCode ? (
                                <div className="confirmation-candidate-links">
                                  <p className="note">
                                    Twój kod zaproszenia: <strong>{confirmationMeetingPublicData.selectedSlotInviteCode}</strong>.
                                    Kod wygasa:
                                    {' '}
                                    {confirmationMeetingPublicData.selectedSlotInviteExpiresUtc
                                      ? new Date(confirmationMeetingPublicData.selectedSlotInviteExpiresUtc).toLocaleString('pl-PL')
                                      : 'wkrótce'}
                                    .
                                  </p>
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() =>
                                      void handleCopyConfirmationMeetingInviteLink(
                                        confirmationMeetingPublicData.selectedSlotInviteCode
                                      )
                                    }
                                  >
                                    {confirmationCopiedInviteToken === confirmationMeetingPublicData.selectedSlotInviteCode
                                      ? 'Skopiowano kod'
                                      : 'Kopiuj kod zaproszenia'}
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost"
                                    disabled={confirmationMeetingPublicSaving}
                                    onClick={() => void handleReleaseConfirmationMeetingHost()}
                                  >
                                    {confirmationMeetingPublicSaving ? 'Zwalnianie...' : 'Zwolnij uprawnienia administratora'}
                                  </button>
                                </div>
                              ) : null}
                            </>
                          )}
                        </>
                      ) : null}
                    </div>
                    {isAuthenticated && (
                      <div className="parish-card confirmation-meetings-admin">
                        <div className="section-header">
                          <div>
                            <p className="tag">Panel admina</p>
                            <h3>Terminy spotkań kandydatów</h3>
                          </div>
                          <button type="button" className="ghost" onClick={() => void loadConfirmationMeetingSummary()}>
                            Odśwież terminy
                          </button>
                        </div>
                        <div className="admin-form-grid">
                          <label>
                            <span>Data i godzina</span>
                            <input
                              type="datetime-local"
                              value={confirmationMeetingStartsLocal}
                              onChange={(event) => setConfirmationMeetingStartsLocal(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Czas trwania (min)</span>
                            <input
                              type="number"
                              min={10}
                              max={180}
                              value={confirmationMeetingDuration}
                              onChange={(event) => setConfirmationMeetingDuration(event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Pojemność slotu</span>
                            <select
                              value={confirmationMeetingCapacity}
                              onChange={(event) => setConfirmationMeetingCapacity(event.target.value === '2' ? '2' : '3')}
                            >
                              <option value="2">2 osoby</option>
                              <option value="3">3 osoby</option>
                            </select>
                          </label>
                          <label>
                            <span>Etap spotkania</span>
                            <select
                              value={confirmationMeetingStage}
                              onChange={(event) =>
                                setConfirmationMeetingStage(
                                  event.target.value === 'year1-end' ? 'year1-end' : 'year1-start'
                                )
                              }
                            >
                              <option value="year1-start">Początek 1. roku</option>
                              <option value="year1-end">Koniec 1. roku</option>
                            </select>
                          </label>
                          <label className="admin-form-full">
                            <span>Opis slotu (opcjonalnie)</span>
                            <input
                              type="text"
                              value={confirmationMeetingLabel}
                              onChange={(event) => setConfirmationMeetingLabel(event.target.value)}
                              placeholder="np. sala katechetyczna, grupa A"
                            />
                          </label>
                        </div>
                        <div className="builder-actions">
                          <button
                            type="button"
                            className="parish-login"
                            disabled={confirmationMeetingSaving}
                            onClick={() => void handleCreateConfirmationMeetingSlot()}
                          >
                            {confirmationMeetingSaving ? 'Zapisywanie...' : 'Dodaj termin'}
                          </button>
                        </div>
                        {confirmationMeetingError ? (
                          <p className="confirmation-info confirmation-info-error">{confirmationMeetingError}</p>
                        ) : null}
                        {confirmationMeetingInfo ? (
                          <p className="confirmation-info confirmation-info-success">{confirmationMeetingInfo}</p>
                        ) : null}
                        {confirmationMeetingLoading ? <p className="muted">Ładowanie slotów...</p> : null}
                        {confirmationMeetingSummary ? (
                          <>
                            <p className="note">Kandydaci bez wybranego terminu: {confirmationMeetingSummary.unassignedCount}</p>
                            {confirmationMeetingSummary.slots.length === 0 ? (
                              <p className="muted">Brak zdefiniowanych terminów.</p>
                            ) : (
                              <div className="confirmation-meeting-slot-list admin">
                                {confirmationMeetingSummary.slots.map((slot) => (
                                  <article key={`admin-slot-${slot.id}`} className="confirmation-meeting-slot">
                                    <p>
                                      <strong>{new Date(slot.startsAtUtc).toLocaleString('pl-PL')}</strong>
                                    </p>
                                    <p className="note">
                                      Czas: {slot.durationMinutes} min • Zajętość: {slot.reservedCount}/{slot.capacity}
                                      {slot.label ? ` • ${slot.label}` : ''} •
                                      {slot.stage === 'year1-end' ? ' Koniec 1. roku' : ' Początek 1. roku'}
                                    </p>
                                    {slot.candidates.length > 0 ? (
                                      <ul className="confirmation-meeting-candidate-list">
                                        {slot.candidates.map((candidate) => (
                                          <li key={`${slot.id}-${candidate.candidateId}`}>
                                            {candidate.name} {candidate.surname}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="muted">Brak zapisanych kandydatów.</p>
                                    )}
                                    <button
                                      type="button"
                                      className="ghost"
                                      disabled={confirmationMeetingSaving}
                                      onClick={() => void handleDeleteConfirmationMeetingSlot(slot.id)}
                                    >
                                      Usuń termin
                                    </button>
                                  </article>
                                ))}
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
            {activePage === 'contact' && (
              <section className="parish-section contact-page">
                <div className="section-header">
                  <div>
                    <p className="tag">Kontakt</p>
                    <h2>Adresy i godziny</h2>
                  </div>
                  <span className="muted">Gotowe do wydruku</span>
                </div>
                <div className="contact-grid">
                  <div className="parish-card address-card">
                    <h3>Adres główny</h3>
                    <p>ul. Dobrego Pasterza 117, 31-416 Kraków</p>
                    <div className="map-placeholder">Mapa</div>
                    <p className="note">Wejście główne, parking po prawej stronie.</p>
                    <div className="address-meta">
                      <span>Otwarte: 6:30–20:30</span>
                      <span>Dostępność: podjazd</span>
                    </div>
                  </div>
                  <div className="parish-card address-card">
                    <h3>Kancelaria parafialna</h3>
                    <p>ul. Dobrego Pasterza 117, pokój 2</p>
                    <div className="map-placeholder">Mapa</div>
                    <p className="note">Wejście od strony plebanii, domofon.</p>
                    <div className="address-meta">
                      <span>Pon.–Pt. 9:00–11:00</span>
                      <span>Pon.–Pt. 16:00–18:00</span>
                    </div>
                  </div>
                  <div className="parish-card address-card">
                    <h3>Kaplica adoracji</h3>
                    <p>Wejście boczne, dziedziniec</p>
                    <div className="map-placeholder">Mapa</div>
                    <p className="note">Dostępna codziennie, cisza.</p>
                    <div className="address-meta">
                      <span>8:00–19:00</span>
                      <span>Parking rowerowy</span>
                    </div>
                  </div>
                </div>
                <div className="emergency-card">
                  <div>
                    <h3>Telefon alarmowy</h3>
                    <p className="note">Pogrzeb / namaszczenie chorych</p>
                  </div>
                  <button type="button" className="cta">
                    Zadzwoń: +48 600 123 456
                  </button>
                </div>
              </section>
            )}
          </main>
          <footer className="parish-footer">
            <div className="footer-grid">
              <div className="footer-card">
                <h4>Adres parafii</h4>
                <p>ul. Dobrego Pasterza 117, 31-416 Kraków</p>
                <p className="note">Tel. +48 12 412 58 50 • parafia@janchrzciciel.eu</p>
              </div>
              <div className="footer-card">
                <h4>Godziny kancelarii</h4>
                <p>Pon.–Pt. 9:00–11:00</p>
                <p>Pon.–Pt. 16:00–18:00</p>
              </div>
              <div className="footer-card">
                <h4>Telefon alarmowy</h4>
                <p className="note">Pogrzeb / chorzy</p>
                <strong>+48 600 123 456</strong>
              </div>
              <div className="footer-card">
                <h4>Polityki</h4>
                <button type="button" className="footer-link">
                  {copy.footer.imprint}
                </button>
                <button type="button" className="footer-link">
                  {copy.footer.security}
                </button>
                <label className="language-label" htmlFor="parish-language">
                  Język
                </label>
                <select
                  id="parish-language"
                  className="parish-select"
                  value={language}
                  onChange={(event) => onLanguageChange(event.target.value as 'pl' | 'en' | 'de')}
                >
                  <option value="pl">Polski</option>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
            </div>
            <div className="parish-footer-brand">
              <a className="portal-brand" href="/#/">
                <img src="/logo_new.svg" alt="Recreatio" className="parish-footer-logo" />
              </a>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
